// The monster bench (dev only: apps/web/monsters.html, served by the Vite dev server; not part of the build).
// Modes: roster (every skin of one era, facing the viewer), turn (one skin at eight facings, to check the view pick),
// live (a leaksim arena that the bench steps by hand, so walk, wind-up, attack, pain and death all play), and window (the lab's
// vista with its walkers). `?pause` freezes the clock, so the shots are repeatable. The bench publishes `window.__monsters` for the tests.
import * as THREE from 'three';
import { addLeak, createWorld, hurt, step, type Input, type World } from '@hm/leaksim';
import { SKINS, type Era, type SkinInfo } from './roster';
import { createMonsterRenderer, type MonsterMob } from './renderer';
import { preloadSkins } from './loader';
import { skinFor } from './adapter';
import { pickView, bearing } from './timing';
import { createLabVista, preloadVista, type LabVista } from '../play/lab-vista';

const canvas = document.getElementById('bench') as HTMLCanvasElement;
const labelsEl = document.getElementById('labels') as HTMLDivElement;
const readoutEl = document.getElementById('readout') as HTMLDivElement;
const noteEl = document.getElementById('note') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const loaderEl = document.getElementById('loader') as HTMLDivElement;
const loaderBar = document.getElementById('loaderBar') as HTMLElement;

const params = new URLSearchParams(location.search);
const modeName = params.get('mode') ?? 'roster';
const eraParam = (params.get('era') ?? 'sprite') as Era | 'mixed';
const skinParam = params.get('skin') ?? 'flesh-worm';
const frozen = params.has('pause');
const MODE_LINKS: Record<string, string> = { roster: `roster-${eraParam}`, turn: 'turn', live: 'live', window: 'window' };
document.querySelectorAll<HTMLAnchorElement>('.strip a').forEach((a) => {
  if (a.dataset.mode === MODE_LINKS[modeName]) a.setAttribute('aria-current', 'page');
});

const ids = (skins: readonly SkinInfo[]): string[] => skins.map((s) => s.id);

function setLoad(done: number, total: number): void {
  loaderBar.style.width = `${total ? Math.round((done / total) * 100) : 100}%`;
}
function hideLoad(): void {
  loaderEl.classList.add('done');
}
function note(title: string, body: string): void {
  noteEl.innerHTML = `<strong></strong><span></span>`;
  (noteEl.querySelector('strong') as HTMLElement).textContent = title;
  (noteEl.querySelector('span') as HTMLElement).textContent = body;
  noteEl.hidden = false;
}

interface Anchor { readonly el: HTMLElement; readonly at: THREE.Vector3 }
const anchors: Anchor[] = [];
function chipAt(at: THREE.Vector3, title: string, sub: string): Anchor {
  const el = document.createElement('div');
  el.className = 'chip';
  const b = document.createElement('b');
  b.textContent = title;
  const s = document.createElement('span');
  s.textContent = ` ${sub}`;
  el.append(b, s);
  labelsEl.append(el);
  const a = { el, at };
  anchors.push(a);
  return a;
}
function placeChips(cam: THREE.Camera, w: number, h: number): void {
  const v = new THREE.Vector3();
  for (const a of anchors) {
    v.copy(a.at).project(cam);
    const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    a.el.style.display = visible ? '' : 'none';
    a.el.style.left = `${((v.x + 1) / 2) * w}px`;
    a.el.style.top = `${((1 - v.y) / 2) * h - 6}px`;
  }
}

function fitCamera(cam: THREE.PerspectiveCamera): void {
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}

function baseScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07090c');
  const grid = new THREE.GridHelper(80, 80, 0x1e2a35, 0x121a22);
  grid.position.y = 0;
  scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1b1410, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(4, 8, 6);
  scene.add(key);
  return scene;
}

interface Mode {
  /** Advances the bench's clock by dt seconds and draws the frame. */
  tick(dt: number): void;
  /** Mode-specific calls for the tests. */
  api: Record<string, unknown>;
  /** Advances by `seconds` in fixed steps (the live arena steps the leaksim world). */
  advance(seconds: number): void;
}

const onResize = (cb: () => void): void => { addEventListener('resize', cb); };

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  errorEl.hidden = false;
  errorEl.textContent = `WebGL is not available: ${String(err)}`;
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor('#07090c');

let activeCam: THREE.Camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 9000);
let mode: Mode | null = null;
let t = 0;
let last = performance.now();

onResize(() => {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  if (activeCam instanceof THREE.PerspectiveCamera) fitCamera(activeCam);
});

// ---- roster: every skin of one era, one per cell, facing the viewer (yaw 0)
function rosterSetup(era: Era): { ids: string[]; mode: Mode; cam: THREE.PerspectiveCamera } {
  const skins = SKINS.filter((s) => s.era === era);
  const cols = 6, sp = 4.4, rows = Math.ceil(skins.length / cols);
  const scene = baseScene();
  const mon = createMonsterRenderer(scene, { budget: { animated: 16, perSkin: 4 } });
  const mobs: MonsterMob[] = skins.map((s, i) => ({
    id: i + 1, kind: s.archetype, x: (i % cols) * sp - ((cols - 1) * sp) / 2, z: -Math.floor(i / cols) * sp, phase: 'roam', phaseT: 0, yaw: 0,
  }));
  const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500);
  const zc = -((rows - 1) * sp) / 2;
  // the camera stands back and above, so each row reads apart from the one behind it
  const halfH = (rows * sp) / 2 + 2;
  const dist = halfH / Math.tan((18 * Math.PI) / 180) + 6;
  cam.position.set(0, 3 + rows * 0.7, zc + dist);
  cam.lookAt(0, 1.0, zc);
  cam.updateProjectionMatrix();
  for (const m of mobs) chipAt(new THREE.Vector3(m.x, skins[m.id - 1]!.heightM + 0.25, m.z), skins[m.id - 1]!.id, `${skins[m.id - 1]!.archetype} ${skins[m.id - 1]!.heightM} m`);
  note(
    `${era} roster`,
    `${skins.length} skins, each facing the viewer at yaw 0. The walk clip plays on the 3D models; the sprites cycle their walk frames.`,
  );
  const m: Mode = {
    api: {
      // the measured height of every 3D monster: its roster height, and its silhouette as drawn (the blended vertices, projected)
      heights: () => scene.children
        .filter((c) => c.name.startsWith('monster-model:'))
        .map((c) => {
          const id = c.name.slice('monster-model:'.length);
          const size = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());
          const v = new THREE.Vector3();
          let lo = Infinity, hi = -Infinity;
          c.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < pos.count; i++) {
              const y = v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(cam).y;
              lo = Math.min(lo, y); hi = Math.max(hi, y);
            }
          });
          let infl = 0, nd = 0, maxd = 0; c.traverse((o) => { const mm = o as THREE.Mesh; if (!mm.isMesh) return; for (const w of mm.morphTargetInfluences ?? []) infl += Math.abs(w); nd = Math.max(nd, mm.morphTargetInfluences?.length ?? 0); maxd = Math.max(maxd, (mm.geometry.morphAttributes.position?.length ?? 0)); });
          return { id, measured: Number(size.y.toFixed(3)), roster: SKINS.find((s) => s.id === id)?.heightM ?? null, screenPx: Math.round(((hi - lo) / 2) * innerHeight), infl: Number(infl.toFixed(3)), nd, maxd };
        }),
    },
    advance(seconds) { this.tick(seconds); },
    tick(dt) {
      t += dt;
      mon.sync(mobs.map((mm) => ({ ...mm, phaseT: t })), (mm) => skins[mm.id - 1]!.id);
      mon.update(dt, cam);
      renderer.render(scene, cam);
      readout(mon.stats());
    },
  };
  return { ids: ids(skins), mode: m, cam };
}

// ---- turn: one skin at eight facings (yaw 0 to 315 degrees), to check the view pick and the mirror
function turnSetup(skinId: string): { ids: string[]; mode: Mode; cam: THREE.PerspectiveCamera } {
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0]!;
  const scene = baseScene();
  const mon = createMonsterRenderer(scene, { budget: { animated: 16, perSkin: 8 } });
  const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 500);
  cam.position.set(0, 1.7, 30);
  cam.lookAt(0, 1.0, 0);
  cam.updateProjectionMatrix();
  const mobs: MonsterMob[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1, kind: skin.archetype, x: (i - 3.5) * 2.8, z: 0, phase: 'roam', phaseT: 0, yaw: (i * Math.PI) / 4,
  }));
  mobs.forEach((m) => {
    const p = pickView(m.yaw ?? 0, bearing(m.x, m.z, cam.position.x, cam.position.z));
    chipAt(new THREE.Vector3(m.x, skin.heightM + 0.25, m.z), `${(m.yaw ?? 0) * 180 / Math.PI}°`, `view ${p.index + 1}${p.mirror ? ' mirrored' : ''}`);
  });
  note(`${skin.id} eight views`, 'Yaw turns from 0 to 315 degrees in 45 degree steps. View 1 faces the viewer; views 6 to 8 are mirrors of 4 to 2.');
  const m: Mode = {
    api: { skin: skin.id },
    advance(seconds) { this.tick(seconds); },
    tick(dt) {
      t += dt;
      mon.sync(mobs.map((mm) => ({ ...mm, phaseT: t })), () => skin.id);
      mon.update(dt, cam);
      renderer.render(scene, cam);
      readout(mon.stats());
    },
  };
  return { ids: [skin.id], mode: m, cam };
}

// ---- live: a leaksim arena, stepped by the bench (deterministic): spawns, chases, attacks, pain and death
function liveSetup(): { ids: string[]; mode: Mode; cam: THREE.PerspectiveCamera } {
  const scene = baseScene();
  const mon = createMonsterRenderer(scene, { budget: { animated: 16, perSkin: 16 } });
  const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 500);
  cam.position.set(-6, 3.4, 12);
  cam.lookAt(1, 1.0, 0);
  cam.updateProjectionMatrix();
  const player = { x: -2, z: 0, alive: true };
  const leak = { x: 6, z: 0 };
  let world: World = addLeak(createWorld(7), leak, ['charger', 'spitter', 'swarmer', 'brute', 'flyer', 'sapper']);
  const eraOf = (id: number): Era => (eraParam === 'mixed' ? (['sprite', 'early3d', 'modern3d'] as const)[id % 3]! : eraParam === 'sprite' || eraParam === 'early3d' || eraParam === 'modern3d' ? eraParam : 'sprite');
  const skinOf = (m: MonsterMob): string => skinFor(m.kind, eraOf(m.id), m.id);
  const input = (dt: number): Input => ({ dt, stage: 3, aggression: 'hard', player, machines: [], safe: [], sealing: null });
  const marker = (x: number, z: number, color: number, r: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    scene.add(m);
    return m;
  };
  marker(player.x, player.z, 0x5fe3ff, 0.9);
  marker(leak.x, leak.z, 0xffb457, 1.6);
  chipAt(new THREE.Vector3(player.x, 2.3, player.z), 'you', 'the player');
  chipAt(new THREE.Vector3(leak.x, 1.2, leak.z), 'leak', 'waves open here');
  note('Live arena', 'A leaksim world stepped by the bench. Monsters spawn from the leak after its warning and chase the player. Hurt a monster to see its pain and death.');
  // the world steps in fixed 1/30 s steps; a frame's real time is banked and paid out in those steps
  const FIXED = 1 / 30;
  let banked = 0;
  const stepOnce = (): void => {
    world = step(world, input(FIXED)).world;
    t += FIXED;
  };
  // one label per monster, kept while the monster lives (reused, not rebuilt each frame)
  const mobChips = new Map<number, { a: Anchor; title: HTMLElement; sub: HTMLElement }>();
  const syncChips = (): void => {
    const live = new Set<number>();
    for (const mm of world.mobs) {
      live.add(mm.id);
      let c = mobChips.get(mm.id);
      if (!c) {
        const el = document.createElement('div');
        el.className = 'chip';
        const title = document.createElement('b');
        const sub = document.createElement('span');
        el.append(title, sub);
        labelsEl.append(el);
        c = { a: { el, at: new THREE.Vector3() }, title, sub };
        mobChips.set(mm.id, c);
        anchors.push(c.a);
      }
      c.a.at.set(mm.x, 2.1, mm.z);
      c.title.textContent = `#${mm.id}`;
      c.sub.textContent = ` ${mm.kind} ${mm.phase}`;
    }
    for (const [id, c] of mobChips) {
      if (live.has(id)) continue;
      c.a.el.remove();
      anchors.splice(anchors.indexOf(c.a), 1);
      mobChips.delete(id);
    }
  };
  const m: Mode = {
    api: {
      mobs: () => world.mobs.map((mm) => ({ id: mm.id, kind: mm.kind, phase: mm.phase, phaseT: Number(mm.phaseT.toFixed(3)), hp: mm.hp, x: Number(mm.x.toFixed(2)), z: Number(mm.z.toFixed(2)), skin: skinOf(mm) })),
      hurt(id: number, damage: number): void { world = hurt(world, id, damage).world; },
      world: () => ({ t: world.t, mobs: world.mobs.length, leaks: world.leaks.length }),
    },
    advance(seconds) {
      const n = Math.round(seconds / FIXED);
      for (let i = 0; i < n; i++) stepOnce();
      this.tick(0);
    },
    tick(dt) {
      banked += dt;
      while (banked >= FIXED) { stepOnce(); banked -= FIXED; }
      mon.sync(world.mobs, skinOf);
      mon.update(dt, cam);
      renderer.render(scene, cam);
      readout(mon.stats());
      syncChips();
    },
  };
  // a first advance: the leak's warning (20 s) runs out and the first wave comes through
  m.advance(26);
  return { ids: SKINS.map((s) => s.id), mode: m, cam };
}

// ---- window: the lab's vista with its walkers, seen through the window rectangle
function windowSetup(): { ids: string[]; mode: Mode; cam: THREE.PerspectiveCamera; vista: LabVista } {
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 9000);
  cam.position.set(-2.5, 1.65, 1.0);
  cam.lookAt(0, 1.9, -9);
  cam.updateProjectionMatrix();
  const vista = createLabVista({ view: 'full', window: { x0: -7.4, x1: 7.4, y0: 0.4, y1: 3.5, z: -9 }, level: 'low' });
  vista.setProgress(0);
  note('Window walkers', 'The lab window looks out on the wasteland. Six monsters patrol it, from mid to far distance, each in its era\'s look.');
  // one label per walker, kept with it as it walks (so its place in the window reads at a glance)
  const walkerChips = new Map<number, Anchor>();
  const syncWalkerChips = (): void => {
    if (!params.has('labels')) return; // the shots are clean; ?labels names the walkers
    for (const w of vista.debugWalkers()) {
      let a = walkerChips.get(w.id);
      if (!a) {
        const el = document.createElement('div');
        el.className = 'chip';
        const b = document.createElement('b');
        b.textContent = `#${w.id - 1000 + 1}`;
        const s = document.createElement('span');
        s.textContent = ` ${w.kind} ${w.skin}`;
        el.append(b, s);
        labelsEl.append(el);
        a = { el, at: new THREE.Vector3() };
        walkerChips.set(w.id, a);
        anchors.push(a);
      }
      a.at.set(w.x, 2.4, w.z);
    }
  };
  const m: Mode = {
    api: {
      walkers: () => vista.debugWalkers(),
      vistaStats: () => vista.stats(),
      monsterStats: () => vista.monsterStats(),
    },
    advance(seconds) { this.tick(seconds); },
    tick(dt) {
      t += dt;
      vista.update(t, dt);
      syncWalkerChips();
      renderer.setScissorTest(false);
      renderer.clear();
      vista.render(renderer, cam, innerWidth, innerHeight);
      const s = vista.stats();
      readoutDraw(s.drawCalls, s.triangles, vista.monsterStats().sprites + vista.monsterStats().models);
    },
  };
  return { ids: [], mode: m, cam, vista };
}

function readout(s: { sprites: number; models: number; animated: number; held: number; fallbacks: number; dropped: number }): void {
  readoutEl.innerHTML = '';
  for (const [k, v] of [['sprites', s.sprites], ['3D', s.models], ['animated', s.animated], ['held', s.held], ['fallbacks', s.fallbacks], ['dropped', s.dropped]] as const) {
    const span = document.createElement('span');
    span.append(`${k} `);
    const b = document.createElement('b');
    b.textContent = String(v);
    span.append(b);
    readoutEl.append(span);
  }
}
function readoutDraw(drawCalls: number, triangles: number, monsters: number): void {
  readoutEl.innerHTML = '';
  for (const [k, v] of [['draw calls', drawCalls], ['triangles', triangles], ['monsters', monsters]] as const) {
    const span = document.createElement('span');
    span.append(`${k} `);
    const b = document.createElement('b');
    b.textContent = v.toLocaleString('en-GB');
    span.append(b);
    readoutEl.append(span);
  }
}

// ---- boot: each mode loads what it draws, behind the loading bar, then starts
async function boot(): Promise<void> {
  setLoad(0, 1);
  if (modeName === 'window') {
    await preloadVista('low');
    const w = windowSetup();
    mode = w.mode;
    activeCam = w.cam;
    publish(w.mode.api);
    hideLoad();
    return;
  }
  if (modeName === 'turn') {
    const set = turnSetup(skinParam);
    await preloadSkins(set.ids, setLoad);
    mode = set.mode;
    activeCam = set.cam;
    publish(set.mode.api);
    hideLoad();
    return;
  }
  if (modeName === 'live') {
    await preloadSkins(SKINS.map((s) => s.id), setLoad);
    const set = liveSetup();
    mode = set.mode;
    activeCam = set.cam;
    publish(set.mode.api);
    hideLoad();
    return;
  }
  const era: Era = (['sprite', 'early3d', 'modern3d'] as const).includes(eraParam as Era) ? (eraParam as Era) : 'sprite';
  const set = rosterSetup(era);
  await preloadSkins(set.ids, setLoad);
  mode = set.mode;
  activeCam = set.cam;
  publish(set.mode.api);
  hideLoad();
}

interface Bench {
  ready: boolean;
  mode: string;
  /** Advances the clock (live: the arena steps; others: the time of the walk clips) and draws. */
  advance(seconds: number): void;
  /** The current frame, drawn again without advancing. */
  draw(): void;
  [k: string]: unknown;
}
const bench: Bench = {
  ready: false,
  mode: modeName,
  advance(seconds: number) { mode?.advance(seconds); },
  draw() { mode?.tick(0); },
};
function publish(api: Record<string, unknown>): void {
  Object.assign(bench, api);
  bench.ready = true;
  (window as unknown as { __monsters: Bench }).__monsters = bench;
}
(window as unknown as { __monsters: Bench }).__monsters = bench;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mode && !frozen) mode.tick(dt);
  else if (mode && frozen) mode.tick(0);
  const w = innerWidth, h = innerHeight;
  placeChips(activeCam, w, h);
  requestAnimationFrame(frame);
}

boot().catch((err: unknown) => {
  errorEl.hidden = false;
  errorEl.textContent = `The bench failed to start: ${String(err)}`;
  console.error(err);
});
requestAnimationFrame(frame);
