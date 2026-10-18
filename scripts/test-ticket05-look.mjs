/**
 * TICKET-05 (T05) look check: the square socket markers, the gunmetal panels, the sliding door, the avatar's light rig at 3 m,
 * the beam core, and the grounded outcrops. Run with tsx so the TS modules load directly:
 *   node --import tsx scripts/test-ticket05-look.mjs            (everything: the pure checks, then the browser checks)
 *   node --import tsx scripts/test-ticket05-look.mjs --pure     (the pure checks only, no browser)
 *
 * Pure checks (no browser):
 * - the kit templates for windowWall, door, halfWall and gable are dark gunmetal (no white or light material, lamp aside)
 * - the door template has its 'door-leaf' group and its colliders (3 for the door, as T01b set them)
 * - play-scene.ts draws no RingGeometry socket rings and no Torus or Dodecahedron node meshes (the stand-ins are gone)
 *
 * Browser checks (serves apps/web/dist on port 8198; skipped with a reason if Chrome is missing):
 * - build mode: the square socket markers show (96 triangles each, no ring), and only the slot the ghost takes is the active one
 * - the placed window wall, door, half wall and gable are dark gunmetal in their screen region
 * - opening the door slides the leaf (its centre moves, its facing does not) and shutting it brings it back
 * - third person: the avatar draws on the avatar layer only, and its head region has detail (pixel spread, shot at about 3 m)
 * - the beam core shows in first and third person, with cyan pixels between the muzzle and the hit
 * - no page errors while all of that runs
 *
 * Writes shots-run/ticket05-*.png. Exits 1 on the first failed check, and kills its server and browser.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pureOnly = process.argv.includes('--pure');
const root = fileURLToPath(new URL('../', import.meta.url));
const shots = fileURLToPath(new URL('../shots-run/', import.meta.url));
fs.mkdirSync(shots, { recursive: true });

let passed = 0;
const skipped = [];
const check = (name, ok, detail = '') => {
  if (!ok) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`OK: ${name}${detail ? ` (${detail})` : ''}`);
};
const skip = (name, why) => {
  skipped.push(`${name}: ${why}`);
  console.log(`SKIPPED: ${name} (${why})`);
};

// ----------------------------------------------------------------------------
// Pure checks
// ----------------------------------------------------------------------------

/** Relative luminance of an sRGB hex colour, 0 (black) to 1 (white). */
const lumOfHex = (hex) => {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

{
  const THREE = await import('three');
  const kit = await import(pathToFileURL(`${root}apps/web/src/base/kit-pieces.ts`).href);
  for (const kind of ['windowWall', 'door', 'halfWall', 'gable']) {
    const t = kit.globalKitPieceCache.getTemplate(kind, 1, 0);
    let meshes = 0;
    let brightest = 0;
    t.group.traverse((o) => {
      if (!o.isMesh || o.userData?.isLamp) return;
      meshes += 1;
      const hex = o.material.color.getHex();
      brightest = Math.max(brightest, lumOfHex(hex));
    });
    check(`the ${kind} panel is dark gunmetal (no white slab)`, meshes > 0 && brightest < 0.1, `${meshes} meshes, brightest luminance ${brightest.toFixed(3)}`);
  }
  const door = kit.globalKitPieceCache.getTemplate('door', 1, 0);
  const leaf = door.group.getObjectByName('door-leaf');
  check('the door template carries its sliding leaf', !!leaf && leaf instanceof THREE.Group);
  check('the door keeps its three T01b colliders', door.colliders.length === 3, `${door.colliders.length} colliders`);
  check('the door lamp survives on its lintel block', door.lamps.length === 1);
}

{
  const src = fs.readFileSync(`${root}apps/web/src/play/play-scene.ts`, 'utf8');
  check('no RingGeometry socket rings in play-scene (the markers replace them)', !/RingGeometry\(0\.45/.test(src) && /socketMarkerGeometry\(\)/.test(src));
  check('no Torus, Dodecahedron, Icosahedron or Cone node stand-ins in play-scene', !/TorusGeometry\(0\.42|DodecahedronGeometry\(0\.5|IcosahedronGeometry\(0\.55|ConeGeometry\(0\.35/.test(src) && /outcropGeometry\(/.test(src));
}

if (pureOnly) {
  console.log(skipped.length ? `Skipped: ${skipped.join('; ')}` : 'All pure checks ran.');
  process.exit(0);
}

// ----------------------------------------------------------------------------
// Browser checks
// ----------------------------------------------------------------------------

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  skip('browser checks', 'Chrome not found');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const port = 8198;
console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The house: found at the same spot the base-building test uses, with its pieces placed by the same kit indices.
const HOUSE = { x: -17, z: 35 };
const PLAN_STEPS = [
  { name: 'floor', kind: 'floor', bp: 'bp:starter', at: [0, 1, 0, 0] },
  { name: 'floor', kind: 'floor', bp: 'bp:starter', at: [1, 1, 0, 0] },
  { name: 'wall', kind: 'wall', bp: 'bp:starter', at: [0, 1, 0, 1] },
  { name: 'half wall', kind: 'halfWall', bp: 'bp:cube:basalt', at: [0, 0, 0, 1] },
  { name: 'wall', kind: 'wall', bp: 'bp:starter', at: [0, 2, 0, 0] },
  { name: 'wall', kind: 'wall', bp: 'bp:starter', at: [0, 0, 0, 0] },
  { name: 'roof', kind: 'roof', bp: 'bp:beam:basalt', at: [0, 0, 1, 0] },
  { name: 'roof', kind: 'roof', bp: 'bp:beam:basalt', at: [0, 1, 1, 2] },
  { name: 'ridge', kind: 'ridgeCap', bp: 'bp:beam:basalt', at: [0, 1, 1, 0] },
  { name: 'gable', kind: 'gable', bp: 'bp:cube:basalt', at: [0, 0, 1, 1] },
  { name: 'gable', kind: 'gable', bp: 'bp:cube:basalt', at: [0, 1, 1, 1] },
  { name: 'gable', kind: 'gable', bp: 'bp:cube:basalt', at: [1, 0, 1, 1] },
  { name: 'door', kind: 'door', bp: 'bp:cube:basalt', at: [1, 0, 0, 1] },
  { name: 'wall', kind: 'wall', bp: 'bp:starter', at: [1, 1, 0, 0] },
  { name: 'wall', kind: 'wall', bp: 'bp:starter', at: [2, 1, 0, 1] },
  { name: 'window wall', kind: 'windowWall', bp: 'bp:cube:basalt', at: [1, 2, 0, 0] },
];
const PIECES = [
  { name: 'window wall', kind: 'windowWall', at: [1, 2, 0, 0] },
  { name: 'half wall', kind: 'halfWall', at: [0, 0, 0, 1] },
  { name: 'gable', kind: 'gable', at: [0, 0, 1, 1] },
  { name: 'door', kind: 'door', at: [1, 0, 0, 1] },
];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new Error('pointer lock stubbed'));
    };
  });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  /** The page's screen, decoded: raw RGB and its size. */
  const grab = async (clip) => {
    const buf = await page.screenshot(clip ? { clip } : {});
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  };
  /** Mean and spread (std dev) of luminance (0..255) inside a square of `half` pixels around (x, y), and whether it is on screen. */
  const regionStats = (img, x, y, half) => {
    const x0 = Math.max(0, Math.floor(x - half)), x1 = Math.min(img.w - 1, Math.floor(x + half));
    const y0 = Math.max(0, Math.floor(y - half)), y1 = Math.min(img.h - 1, Math.floor(y + half));
    let n = 0, s = 0, s2 = 0;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const i = (yy * img.w + xx) * 3;
        const l = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
        n += 1;
        s += l;
        s2 += l * l;
      }
    }
    const mean = s / Math.max(1, n);
    return { mean, sd: Math.sqrt(Math.max(0, s2 / Math.max(1, n) - mean * mean)), px: n };
  };
  /**
   * Stands the player `dist` metres from a world point, looking at it. The camera looks along (-sin yaw, -cos yaw), so the
   * player stands at (sin yaw, cos yaw) * dist from the point, with the same yaw.
   */
  const faceTarget = async (tx, tz, dist = 6, yaw = 0) => {
    const px = tx + Math.sin(yaw) * dist;
    const pz = tz + Math.cos(yaw) * dist;
    await page.evaluate(([x, z, y]) => window.__playScene.debug.teleport('planet', x, z, y, 0), [px, pz, yaw]);
    await sleep(500);
  };
  /** Projects a world point to screen pixels with the main camera (the page's camera, through the debug hook). */
  const toScreen = (p) =>
    page.evaluate(([x, y, z]) => {
      const cam = window.__playScene.debug.camera();
      const V = cam.position.constructor;
      const v = new V(x, y, z).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
      return { x: (v.x + 1) * 0.5 * window.innerWidth, y: (1 - v.y) * 0.5 * window.innerHeight, z: v.z };
    }, p);

  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 30000 });
  await sleep(800);
  await page.evaluate(() => {
    window.__dev.finishAct('act4');
    (window.__hm?.base ?? window.hmPlay?.base)?.apply({ t: 'stage', stage: 2 });
    window.__dev.setStage(2);
    window.__hm?.hideOverlays?.(true);
    window.__hm?.clearToast?.();
  });
  await sleep(300);

  // ---- the house: a foundation, a bench, the cube blueprint drafted at the bench, then the four panel pieces
  const built = await page.evaluate(async ([house, pieces]) => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const at = { x: house.x, z: house.z };
    const found = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: house.x, cz: house.z, yaw: 0 });
    const placed = found.events.find((e) => e.type === 'placed');
    const sid = placed ? api.world().base.pieces.find((p) => p.id === placed.id)?.s : null;
    if (sid === undefined || sid === null) return { ok: false, error: 'the foundation was not founded', events: found.events };
    api.apply({ t: 'place', at, blueprint: 'bp:starter', piece: { s: sid, kind: 'bench', i: 0, j: 0, k: 0, r: 0 } });
    api.apply({ t: 'draft', at, primitive: 'cube', map: 'basalt' });
    // the house plan's order (test-base-building's HOUSE_PLAN): the supports come first, so the panels have something to stand on
    const steps = pieces;
    const out = [];
    for (const p of steps) {
      const before = api.world().base.pieces.length;
      api.apply({ t: 'place', at, blueprint: p.bp, piece: { s: sid, kind: p.kind, i: p.at[0], j: p.at[1], k: p.at[2], r: p.at[3] } });
      const after = api.world().base.pieces;
      const got = after.length === before + 1 ? after[after.length - 1] : null;
      out.push({ name: p.name, kind: p.kind, at: p.at, id: got?.id ?? null, placed: !!got && got.kind === p.kind });
    }
    return { ok: out.filter((o) => o.name !== 'roof' && o.name !== 'ridge').every((o) => o.placed), sid, out };
  }, [HOUSE, PLAN_STEPS]);
  if (!built.ok) {
    throw new Error(`FAILED: the house pieces were not placed: ${JSON.stringify(built.out.filter((o) => !o.placed))}`);
  }
  const want = (kind, at) => built.out.find((o) => o.kind === kind && o.at.join() === at.join());
  for (const p of PIECES) {
    const o = want(p.kind, p.at);
    if (!o || !o.placed) throw new Error(`FAILED: the ${p.name} was not placed at ${p.at}`);
    p.id = o.id;
  }
  check('the window wall, half wall, gable and door are placed on the house', true, PIECES.map((p) => `${p.name} #${p.id}`).join(', '));
  const doorId = PIECES.find((p) => p.kind === 'door').id;

  // ---- the panels: dark gunmetal in their screen region, shot from the front of the house
  await faceTarget(HOUSE.x, HOUSE.z, 7);
  await sleep(600);
  for (const o of PIECES) {
    const b = await page.evaluate((id) => window.__playScene.debug.pieceBounds(id), o.id);
    if (!b) throw new Error(`FAILED: ${o.name} has no drawn bounds`);
    const c = [0, 1, 2].map((a) => (b.min[a] + b.max[a]) / 2);
    // stand on the side of the panel that looks at it: the first of four yaws that puts its centre on screen
    let s = null;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await faceTarget(c[0], c[2], 6, yaw);
      s = await toScreen(c);
      if (s.z < 1 && s.x > 40 && s.x < 1240 && s.y > 40 && s.y < 680) break;
    }
    const img = await grab();
    const st = regionStats(img, s.x, s.y, 14);
    const onScreen = s.x > 20 && s.x < img.w - 20 && s.y > 20 && s.y < img.h - 20 && s.z < 1;
    if (!onScreen) {
      skip(`${o.name} screen colour`, `the centre is off screen at (${s.x.toFixed(0)}, ${s.y.toFixed(0)})`);
      continue;
    }
    check(`the placed ${o.name} is dark gunmetal in its screen region`, st.mean < 90, `mean luminance ${st.mean.toFixed(0)} of 255`);
  }
  await page.evaluate(() => window.__hm?.hideOverlays?.(true));
  await sleep(200);
  await faceTarget(HOUSE.x, HOUSE.z, 12, 0);
  await sleep(500);
  await page.screenshot({ path: `${shots}ticket05-panels-front.png` });
  console.log('  shot: shots-run/ticket05-panels-front.png');

  // ---- the door slides: the leaf's centre moves, its facing does not, and shutting it brings it back
  const leafAt = () => page.evaluate((id) => window.__playScene.debug.pieceBounds(id)?.leaf ?? null, doorId);
  const restLeaf = await leafAt();
  if (!restLeaf) throw new Error('FAILED: the door has no drawn leaf');
  await page.evaluate((id) => (window.__hm?.base ?? window.hmPlay?.base).apply({ t: 'door', id, open: true }), doorId);
  await sleep(120);
  const midLeaf = await leafAt();
  await sleep(900);
  const openLeaf = await leafAt();
  const moved = Math.hypot(openLeaf.centre[0] - restLeaf.centre[0], openLeaf.centre[2] - restLeaf.centre[2]);
  const turned = Math.hypot(openLeaf.normal[0] - restLeaf.normal[0], openLeaf.normal[1] - restLeaf.normal[1], openLeaf.normal[2] - restLeaf.normal[2]);
  check('opening the door slides its leaf sideways, with no turn', moved > 1.2 && turned < 1e-3, `moved ${moved.toFixed(2)} m, normal change ${turned.toExponential(1)}`);
  check('the door leaf is part way through its slide at 0.12 s', midLeaf && Math.hypot(midLeaf.centre[0] - restLeaf.centre[0], midLeaf.centre[2] - restLeaf.centre[2]) > 0.05 && moved - Math.hypot(midLeaf.centre[0] - restLeaf.centre[0], midLeaf.centre[2] - restLeaf.centre[2]) > 0.05, 'the run is a slide, not a snap');
  // the shot stands 6 m east of the doorway (the door faces east, outside), looking west at the open leaf
  await faceTarget(restLeaf.centre[0], restLeaf.centre[2], 6, Math.PI / 2);
  await sleep(400);
  await page.screenshot({ path: `${shots}ticket05-door-open.png` });
  console.log('  shot: shots-run/ticket05-door-open.png');
  await page.evaluate((id) => (window.__hm?.base ?? window.hmPlay?.base).apply({ t: 'door', id, open: false }), doorId);
  await sleep(900);
  const shutLeaf = await leafAt();
  check('shutting the door brings the leaf back', Math.hypot(shutLeaf.centre[0] - restLeaf.centre[0], shutLeaf.centre[2] - restLeaf.centre[2]) < 0.05);

  // ---- the build markers: square brackets, and only the slot the ghost takes pulses
  const poses = [-1.2, 0, 1.2].map((dx) => ({ x: HOUSE.x + dx, y: 0, z: HOUSE.z - 2.2, yaw: 0 }));
  // the held rifle takes the hand and hides the build ghost, so the build is open with the rifle put away
  await page.evaluate(() => window.__playScene.setBeamHeld(false, 'extract'));
  await sleep(300);
  // read in the same task as the calls, so the game's own frame does not overwrite them first
  const marked = await page.evaluate((ps) => {
    window.__playScene.setSocketRings(ps);
    window.__playScene.placePieceGhost({ x: ps[1].x, y: ps[1].y, z: ps[1].z, yaw: 0 }, 'ok');
    const scene = window.__playScene.debug.planetScene();
    let inst = null;
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.name === 'socket-markers' && !inst) inst = o;
    });
    const active = window.__playScene.debug.activeSocket();
    return {
      found: !!inst,
      count: inst ? inst.count : 0,
      visible: inst ? inst.visible : false,
      triangles: inst ? inst.geometry.index.count / 3 : 0,
      active,
    };
  }, poses);
  check('the square socket markers show in build mode (8 square bars, 96 triangles, no ring)', marked.found && marked.count === 3 && marked.visible && marked.triangles === 96, JSON.stringify({ count: marked.count, triangles: marked.triangles }));
  const active = marked.active;
  check('only the slot the ghost takes is the active marker', !!active && Math.abs(active[0] - poses[1].x) < 1e-3 && Math.abs(active[2] - poses[1].z) < 1e-3, JSON.stringify(active));
  await sleep(300);
  // the shot stands 4.5 m south of the active marker, looking north along the row of brackets
  await faceTarget(poses[1].x, poses[1].z, 4.5, Math.PI);
  await sleep(400);
  await page.screenshot({ path: `${shots}ticket05-build-markers.png` });
  console.log('  shot: shots-run/ticket05-build-markers.png');
  await page.evaluate(() => { window.__playScene.setSocketRings([]); window.__playScene.placePieceGhost(null, 'ok'); });
  check('the markers hide when the build closes', (await page.evaluate(() => window.__playScene.debug.activeSocket())) === null);

  // ---- the nodes: no torus or dodecahedron instanced meshes
  const nodeMeshes = await page.evaluate(() => {
    const scene = window.__playScene.debug.planetScene();
    const kinds = [];
    scene.traverse((o) => {
      if (o.isInstancedMesh) kinds.push(o.geometry.type);
    });
    return kinds;
  });
  check('no torus or dodecahedron node meshes remain', !nodeMeshes.some((t) => t === 'TorusGeometry' || t === 'DodecahedronGeometry'), `instanced geometries: ${[...new Set(nodeMeshes)].join(', ') || 'none'}`);

  // ---- third person at 3 m: the avatar on its own layer, and its head region has detail
  await faceTarget(HOUSE.x, HOUSE.z, 9);
  await page.evaluate(() => window.__playScene.setCameraView('third'));
  await page.evaluate(() => window.__playScene.setBeamHeld(true, 'extract'));
  await sleep(2500);
  const avatar = await page.evaluate(() => {
    const scene = window.__playScene.debug.planetScene();
    let skinned = 0, onLayer = 0, head = null;
    scene.traverse((o) => {
      if (o.isSkinnedMesh) {
        skinned += 1;
        if (o.layers.mask === 4) onLayer += 1;
      }
      if (o.name === 'mixamorigHead' && !head) head = o;
    });
    const hp = head ? head.getWorldPosition(new head.position.constructor()) : null;
    return { skinned, onLayer, layer: window.__playScene.debug.avatarLayer(), head: hp ? [hp.x, hp.y, hp.z] : null };
  });
  check('the avatar draws on its own layer only, in the planet pass', avatar.skinned > 0 && avatar.onLayer === avatar.skinned && avatar.layer === 2, JSON.stringify(avatar));
  if (avatar.head) {
    const s = await toScreen(avatar.head);
    const img = await grab();
    const st = regionStats(img, s.x, s.y, 45);
    check('the avatar head at 3 m has detail (pixel spread in its region)', st.sd > 6, `spread ${st.sd.toFixed(1)} over ${st.px} pixels`);
  } else {
    skip('avatar head detail', 'no head bone in the planet scene');
  }
  await page.screenshot({ path: `${shots}ticket05-third-person-3m.png` });
  console.log('  shot: shots-run/ticket05-third-person-3m.png');

  // ---- the beam core, third person then first person: cyan pixels between the muzzle and the hit
  const beamCheck = async (label) => {
    const geom = await page.evaluate(() => {
      const cam = window.__playScene.debug.camera();
      const e = cam.matrixWorld.elements;
      const muzzle = window.__playScene.beamMuzzle();
      // 6 m ahead and 5 m sideways: to the right in third person (the line clears the avatar), to the left in first person (the
      // view-model rifle sits at the lower right and would cover it); the line then crosses open ground and the house
      const side = window.__playScene.debug.view() === 'first' ? -5 : 5;
      const hit = { x: muzzle.x - e[8] * 6 + e[0] * side, y: muzzle.y - e[9] * 6 + e[1] * side, z: muzzle.z - e[10] * 6 + e[2] * side };
      // pinned, so the game's own per-frame "no beam" call does not hide the core before the picture is taken
      window.__playScene.debug.pinBeam(true);
      window.__playScene.setBeam(muzzle, hit, 'extract', '#3dc8ff', true);
      return { muzzle, hit, core: window.__playScene.debug.beamCore() };
    });
    await sleep(500);
    const core = geom.core;
    const a = await toScreen([geom.muzzle.x, geom.muzzle.y, geom.muzzle.z]);
    const b = await toScreen([geom.hit.x, geom.hit.y, geom.hit.z]);
    const img = await grab();
    let cyan = 0, probes = 0;
    for (let k = 1; k < 24; k++) {
      const x = Math.round(a.x + ((b.x - a.x) * k) / 24), y = Math.round(a.y + ((b.y - a.y) * k) / 24);
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      probes += 1;
      let hits = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = Math.min(img.w - 1, Math.max(0, x + dx)), yy = Math.min(img.h - 1, Math.max(0, y + dy));
        const i = (yy * img.w + xx) * 3;
        // beam-coloured: blue over red, and green up (the core is lerped toward white at its middle)
        if (img.data[i + 2] - img.data[i] > 40 && img.data[i + 1] > 80) hits += 1;
      }
      if (hits >= 3) cyan += 1;
    }
    await page.screenshot({ path: `${shots}ticket05-beam-${label.replace(/ /g, '-')}.png` });
    console.log(`  shot: shots-run/ticket05-beam-${label.replace(/ /g, '-')}.png`);
    check(`the beam core shows in ${label} (state and cyan pixels between muzzle and hit)`, core.shown === true && core.colour === '#3dc8ff' && cyan >= 4, `cyan probes ${cyan}/${probes}, colour ${core.colour}, muzzle at (${a.x.toFixed(0)}, ${a.y.toFixed(0)}), hit at (${b.x.toFixed(0)}, ${b.y.toFixed(0)})`);
    await page.evaluate(() => { window.__playScene.debug.pinBeam(false); window.__playScene.setBeam(null, null, 'extract', '#ffffff', false); });
    await sleep(200);
    check(`the beam core hides when the beam is off (${label})`, (await page.evaluate(() => window.__playScene.debug.beamCore())).shown === false);
  };
  await beamCheck('third person');
  await page.evaluate(() => window.__playScene.setCameraView('first'));
  await sleep(1500);
  await beamCheck('first person');

  check('no page errors while the look runs', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\nticket05 look: ${passed} checks passed${skipped.length ? `; skipped: ${skipped.join('; ')}` : ''}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
