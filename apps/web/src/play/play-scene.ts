// The first Play's 3D (SETMIX_PLAN Phase 2b): you walk the lab in first person; the gate is a two-sided doorway onto your
// plot; the planet is drawn at low resolution and post-processed by stage (black-and-white dither at stage 0, colour from
// stage 1, a wave between, sweeping out from your first machine); sync runs down while you are there.
//
// Two scenes, one walker. Crossing the gate's opening carries you (and the camera) from one gate's frame to the other's.
// Each frame the far side is drawn from a virtual camera into a texture, and the near side shows it in the opening.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { StageLook } from '../crafter/looks';
import { createWorld, PLANET_DIR, SUN, type Neighbour, type World } from '../crafter/world';
import { createPlume, type PlumeMode } from '@hm/plume';
import { GATE, KINDS, type Machine, type MachineKind, type PlotState } from '@hm/plotsim';
import { createPlotGround, type BoulderInfo, type PlotGround } from './plot-ground';
import { fx as sfx } from '../maker/feedback';
import * as kit from '@hm/labkit';
import { createLabRoom, GATE_AT, POWER_OFF, POWER_ON, POWER_SECONDS, powerAt, ROOM, type LabRoom } from './lab-room';
import { createPlotHolo, type PlotHolo } from './plot-holo';
import { COLOUR_MARK_FRAGMENT, MARK_VERTEX, OPENING_FRAGMENT, OPENING_MARK_FRAGMENT, OPENING_VERTEX, PLUME_GLOW_FRAGMENT, PLUME_GLOW_VERTEX, POST_FRAGMENT, QUAD_VERTEX } from './portal-shaders';
import { MACHINE_FIELD, METRIC_COLOUR, stepSync, type PlayAvatar } from './quest';
import { disposeProp, lineSpan, machineProp, PIXELS_OF, type MachineProp } from './machine-props';
import { createScientistInstance } from '../avatar/scientist/scientist-model';
import { loadScientistAnimations, type ClipName } from '../avatar/scientist/anims-loader';
import { createScientistAnimator, type OneShotKind, type ScientistAnimator } from '../avatar/scientist/animator';

export type Where = 'lab' | 'planet';
/** What the screen gives the scene each frame. */
export interface Controls {
  /** Walk: x right, z forward, each -1..1. */
  readonly move: { readonly x: number; readonly z: number };
  /** Look: mouse movement since the last frame, in pixels. */
  readonly look: { readonly dx: number; readonly dy: number };
  readonly run: boolean;
}
export type LabMachineKind = 'rack' | 'bench' | 'combiner';

/** What the scene tells the screen each frame. */
export interface FrameOut {
  readonly where: Where;
  readonly sync: number;
  /** You are looking at the main lever, close enough to pull it. */
  readonly atLever: boolean;
  /** You are looking at the console while the gate is on, close enough to dial a plot. */
  readonly atDial: boolean;
  /** The build ghost's verdict, when building. */
  readonly ghost: { readonly ok: boolean; readonly why: string } | null;
  /** The machine you are looking at, close enough to use (its plot id), when not building. */
  readonly aimed: number | null;
  /** The boulder with ore you are looking at, close enough to gather from. */
  readonly aimedBoulder: number | null;
  /** The lab machine you are looking at, close enough to use. */
  readonly aimedLab: LabMachineKind | null;
  /** The stage the picture shows (a wave brings the next one across the plot). */
  readonly stage: number;
  /** Something happened this frame ('stage-up': a wave has finished bringing `stage`). */
  readonly event: 'to-planet' | 'to-lab' | 'sync-lost' | 'powered' | 'stage-up' | null;
}

/** What the display governor and Settings change while you play: how the machines' pixels are drawn, and the ground's triangles. */
export interface Detail {
  readonly plumes: PlumeMode; readonly plumeDensity: number; readonly groundBudget: number;
  /** The most lines the planet is drawn at (the later stages' resolution is capped on the light tiers). */
  readonly planetLines: number;
  /** A soft coloured glow on the ground under each pouring machine. */
  readonly plumeGlow: boolean;
  /** Pouring pixels cast dynamic light on their surroundings (Ultra only). */
  readonly pixelLights: boolean;
}

const EYE = 1.68, RADIUS = 0.3, WALK = 3.0, RUN = 5.6;
/**
 * Each stage's look (the stages raise the resolution of one natural world): how many lines tall the planet is drawn, its colour
 * levels (0 = all) and stage 0's black-and-white dither. Stage 1 is about 240 lines, like a 1990s 3D game, whatever the screen; a
 * look's pixels are whole screen pixels, so the grid never shimmers. The planet's picture is drawn at a whole fraction of the screen,
 * as fine as the finest look shown and never coarser than stage 1.
 */
const STAGE_LOOK: readonly { readonly lines: number; readonly levels: number; readonly dither: boolean }[] = [
  { lines: 120, levels: 0, dither: true }, { lines: 240, levels: 10, dither: false }, { lines: 360, levels: 16, dither: false }, { lines: 480, levels: 28, dither: false },
  { lines: 720, levels: 0, dither: false }, { lines: 1080, levels: 0, dither: false }, { lines: 1e5, levels: 0, dither: false },
];
const BASE_LINES = 240;
/**
 * The wave never pops (owner, 2026-10-07: "the hill and the sky popped"): its front crosses your plot at a walk-and-a-half, then
 * races out ever faster over the plains and the neighbours to the horizon (the ground ends about 4.5 km from the gate), then climbs
 * the sky from the horizon to the zenith. Metres from the wave's centre, t seconds after it starts.
 */
const waveFront = (t: number): number => 25 * t + 4 * (Math.exp(0.6 * t) - 1);
const GROUND_REACH = 4800, SKY_SECONDS = 3.2;
/** When the front reaches the horizon (about 11.6 s). */
const GROUND_SECONDS = ((): number => { let lo = 0, hi = 60; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (waveFront(m) < GROUND_REACH) lo = m; else hi = m; } return hi; })();
/** The pixels that race the front go no further than this (beyond it they would be a blur too small to see). */
const RACER_REACH = 300;
/** The planet's wind for the plumes: from the west-south-west, enough to lean a pour about 3 m downwind by the top. */
const WIND = { x: 0.94, z: 0.35, speed: 3.3 };
/** The texture mill's pour: a full, wide plume (the owner: pixels visibly spewing out), 220 pixels at density 1. */
const MILL_POUR = { count: 220, height: 7.5, spread: 4.5 };

export interface PlayScene {
  /** Puts the planet in place (once, after its looks are baked). */
  setPlanet(base: StageLook, plot: StageLook, neighbours: readonly Neighbour[]): void;
  /** The saved state, applied at once: the gate on or off, the plot's machines standing (already running), its stage. */
  restore(o: { readonly gateOn: boolean; readonly plot: PlotState; readonly running: ReadonlyMap<number, number>; readonly connected: ReadonlySet<number> }): void;
  /** The plot as it is now: machines built or removed appear or go (with their cables), running ones pour their pixels. */
  setPlot(plot: PlotState, running: ReadonlyMap<number, number>, connected: ReadonlySet<number>): void;
  /** Ore in the ground at x, z, 0..1 (rock and scree rich, dust poor): the drills' richness. */
  richness(x: number, z: number): number;
  /** Throws the main lever: the power-on sequence runs, then a 'powered' event. */
  pullLever(): void;
  /** Shows the build ghost of a machine (null hides it), on the planet; `check` says whether it may stand where it is aimed. */
  setBuilding(kind: MachineKind | null, check?: (x: number, z: number) => { readonly ok: boolean; readonly why: string }): void;
  /** Where the ghost stands, facing the gate, if it may stand there. */
  aim(): { readonly x: number; readonly z: number; readonly yaw: number } | null;
  /** The plot reached a stage: a wave from `from` (ground x, z) brings its look across the plot, out to the horizon and up the sky. */
  raiseStage(to: number, from: { readonly x: number; readonly z: number }): void;
  frame(now: number, dt: number, c: Controls): FrameOut;
  resize(width: number, height: number, pixelRatio: number): void;
  /** The live detail (the display governor's tier, with your own Settings on top). */
  setDetail(d: Detail): void;
  /** Activity of the lab machines (bench writing, combiner mixing, rack cataloguing) for the lab plume. */
  setLabActivity(act: { readonly bench: number; readonly combiner: number; readonly rack: number }): void;
  /** Sets first person (body hidden) or third person over the shoulder. */
  setCameraView(mode: 'first' | 'third'): void;
  getCameraView(): 'first' | 'third';
  /** Plays a scientist one-shot animation action (lever, button, plant, cheer, wave, point). */
  playAction(kind: OneShotKind): void;
  /** Updates the scientist avatar appearance. */
  setAvatar(avatar: PlayAvatar | null): void;
  /** Gathers ore from a boulder. */
  gatherBoulder(id: number, amount: number): number;
  /**
   * Compiles every shader the frames will need, for each place it draws, behind the loading bar: a compile mid-play is a hitch the
   * display governor would read as a slow machine (and the owner's rule is never to start a screen choppy).
   */
  warm(): void;
  /** For the tests and the e2e: where you are, and a way to stand somewhere. */
  readonly debug: {
    groundTriangles(): number; showGround(on: boolean): void; where(): Where; position(): THREE.Vector3; teleport(where: Where, x: number, z: number, yaw: number, pitch?: number): void; sync(): number;
    stats(): { readonly triangles: number; readonly calls: number }; wave(): number; gatePlanet(): { x: number; z: number };
    /** The detail in use, the planet picture's size, and the pixels each machine pours now. */
    detail(): Detail & { readonly planet: readonly [number, number]; readonly pixels: number };
    /** Machines standing on the plot, and how many pour pixels now. */
    machines(): { readonly standing: number; readonly pouring: number };
    holo(): { readonly visible: boolean; readonly machines: number };
    view(): 'first' | 'third';
    clipWeight(name: ClipName): number;
    currentOneShot(): OneShotKind | null;
    animator(): ScientistAnimator | null;
    gather(amount: number): number;
    aimedBoulder(): number | null;
    boulders(): readonly BoulderInfo[];
    twinStage(): number;
    plumeGlowCount(): number;
    pixelLightCount(): number;
  };
  dispose(): void;
}

export function createPlayScene(o: {
  readonly canvas: HTMLCanvasElement; readonly gridSpacing: number; readonly antialias: boolean; readonly powerPreference: WebGLPowerPreference; readonly reducedMotion: boolean; readonly textureSize: number;
  /** The size of the ground's material tiles (by the starting tier), and the live detail to start with. */
  readonly groundTexture: number; readonly detail: Detail;
  readonly cameraView?: 'first' | 'third';
  readonly avatar?: PlayAvatar | null;
}): PlayScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const virtual = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- render targets: the planet (low res, with depth), its post-processed picture (for the lab's view), the lab (for the planet's view)
  const target = (w: number, h: number, depth: boolean, nearest: boolean): THREE.WebGLRenderTarget => {
    const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, ...(depth ? { depthTexture: new THREE.DepthTexture(w, h) } : {}) });
    t.texture.minFilter = t.texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.texture.generateMipmaps = false;
    return keep(t);
  };
  let planetRT = target(16, 16, true, true), viewRT = target(16, 16, false, true), labRT = target(16, 16, false, false);
  const screen = new THREE.Vector2(1, 1);

  // ---- the lab
  const openingUniforms = { uView: { value: viewRT.texture as THREE.Texture }, uScreen: { value: screen }, uStatic: { value: 1 }, uTime: { value: 0 } };
  const openingMat = keep(new THREE.ShaderMaterial({ vertexShader: OPENING_VERTEX, fragmentShader: OPENING_FRAGMENT, uniforms: openingUniforms, side: THREE.DoubleSide }));
  const labScene = new THREE.Scene();
  const room: LabRoom = createLabRoom({ textureSize: o.textureSize, portalMaterial: openingMat });
  labScene.add(room.group);
  const holo: PlotHolo = createPlotHolo();
  room.group.add(holo.group);
  holo.group.position.set(-3.6, 0, -5.2);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const roomEnv = new RoomEnvironment();
  labScene.environment = keep(pmrem.fromScene(roomEnv, 0.04).texture);
  labScene.environmentIntensity = 0.22;
  roomEnv.dispose();
  room.group.updateMatrixWorld(true);
  const labGateM = room.gate.group.matrixWorld.clone();

  // one plume for the lab's machines (@hm/plume)
  const labPlume = createPlume({ mode: o.detail.plumes, density: o.detail.plumeDensity, markAlpha: 0.5 });
  labScene.add(labPlume.object);
  keep(labPlume);

  let benchEmitter: number | null = null;
  let combinerEmitter: number | null = null;
  let rackEmitter: number | null = null;

  const setLabActivity = (act: { readonly bench: number; readonly combiner: number; readonly rack: number }): void => {
    // bench pours pink (#ff3d8a) while writing
    if (act.bench > 0 && benchEmitter === null) {
      benchEmitter = labPlume.add({ at: [9.25, 0.9, -3.4], colour: '#ff3d8a', count: 140, height: 2.2, spread: 0.9, life: 1.8 });
    } else if (act.bench <= 0 && benchEmitter !== null) {
      labPlume.remove(benchEmitter);
      benchEmitter = null;
    }
    // combiner pours violet (#b46bff) while mixing
    if (act.combiner > 0 && combinerEmitter === null) {
      combinerEmitter = labPlume.add({ at: [9.1, 1.25, -0.6], colour: '#b46bff', count: 150, height: 2.4, spread: 1.1, life: 2.0 });
    } else if (act.combiner <= 0 && combinerEmitter !== null) {
      labPlume.remove(combinerEmitter);
      combinerEmitter = null;
    }
    // rack shows faint violet wisp at its indexer while cataloguing
    if (act.rack > 0 && rackEmitter === null) {
      rackEmitter = labPlume.add({ at: [-9.35, 1.4, -5.5], colour: '#b46bff', count: 35, height: 1.0, spread: 0.4, life: 1.2 });
    } else if (act.rack <= 0 && rackEmitter !== null) {
      labPlume.remove(rackEmitter);
      rackEmitter = null;
    }
  };

  // ---- the planet
  const planetScene = new THREE.Scene();
  const m = kit.createMaterials();
  let world: World | null = null, ground: PlotGround | null = null;
  let twin = kit.gate(m, { twin: true, stage: 1 });
  let twinStage = 1;
  const openingMark = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: OPENING_MARK_FRAGMENT, side: THREE.DoubleSide, blending: THREE.NoBlending }));
  const twinOpening = new THREE.Mesh(keep(new THREE.PlaneGeometry(twin.opening.width, twin.opening.height)), openingMark);
  twinOpening.position.set(0, twin.opening.sill + twin.opening.height / 2, twin.opening.z);
  twin.group.add(twinOpening);
  // the footing goes down into the ground, so the pad never floats on the slope of the peak
  const footing = new THREE.Mesh(keep(new THREE.BoxGeometry(3.6, 2.4, 2.6)), m.concrete);
  footing.position.y = -1.2;
  twin.group.add(footing);
  // you step out facing the goblin planet: the twin's back (-z) looks that way
  const view = new THREE.Vector2(PLANET_DIR.x, PLANET_DIR.z).normalize();
  twin.group.rotation.y = Math.atan2(-view.x, -view.y);
  const gateYawDelta = twin.group.rotation.y;
  planetScene.add(twin.group);
  let planetGateM = new THREE.Matrix4(), toPlanet = new THREE.Matrix4(), toLab = new THREE.Matrix4();
  const syncPlanetMatrices = (): void => {
    twin.group.updateMatrixWorld(true);
    planetGateM = twin.group.matrixWorld.clone();
    toPlanet = planetGateM.clone().multiply(labGateM.clone().invert());
    toLab = toPlanet.clone().invert();
  };
  let padTop = 0;
  const groundAt = (x: number, z: number): number => {
    // on the footing pad you stand on the pad
    const local = new THREE.Vector3(x, 0, z).applyMatrix4(new THREE.Matrix4().copy(twin.group.matrixWorld).invert());
    if (Math.abs(local.x) < 1.9 && Math.abs(local.z) < 1.25) return padTop;
    return ground ? ground.heightAt(x, z) : 0;
  };

  // ---- the plot's machines (`@hm/plotsim`): each a prop (machine-props.ts) on the ground, its cable from the node that powers it,
  // the lines between pylons, and the pixels pouring from every pixel machine that runs (one plume for all, `@hm/plume`)
  interface MachineView { readonly m: Machine; prop: MachineProp; vent: THREE.Vector3 | null; emitter: number | null; running: number; glow: THREE.Mesh | null; light: THREE.PointLight | null }
  const views = new Map<number, MachineView>();
  let cables: THREE.Mesh[] = [];
  /** The detail the props are built at: chunky low poly until the plot shows stage 2. */
  let propStage = 1;
  let detail: Detail = o.detail;
  // every machine's pixels in one plume (`@hm/plume`, one draw call): drawn as the tier asks, always in colour (alpha 0.5 marks them)
  const plume = createPlume({ mode: detail.plumes, density: detail.plumeDensity, markAlpha: 0.5 });
  plume.setWind(WIND.x, WIND.z, WIND.speed);
  planetScene.add(plume.object);
  keep(plume);
  const cableMat = m.rubber;
  const worldOf = (v: MachineView, local: THREE.Vector3): THREE.Vector3 => local.clone().applyMatrix4(v.prop.group.matrixWorld);
  const GLOW_RADIUS = 3.6, GLOW_SEGS = 8;
  const makePlumeGroundGlow = (x: number, z: number, colorHex: string): THREE.Mesh => {
    const geo = new THREE.PlaneGeometry(GLOW_RADIUS * 2, GLOW_RADIUS * 2, GLOW_SEGS, GLOW_SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = x + lx, wz = z + lz;
      pos.setXYZ(i, wx, groundAt(wx, wz) + 0.04, wz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLUME_GLOW_VERTEX,
      fragmentShader: PLUME_GLOW_FRAGMENT,
      uniforms: {
        uColour: { value: new THREE.Color(colorHex) },
        uStrength: { value: 0.8 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 0);
    mesh.visible = false;
    return mesh;
  };
  const setGlowStrength = (mesh: THREE.Mesh, strength: number): void => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform>;
    if (u['uStrength']) u['uStrength'].value = strength;
  };
  const setGlowTime = (mesh: THREE.Mesh, time: number): void => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform>;
    if (u['uTime']) u['uTime'].value = time;
  };
  const build = (mm: Machine): MachineView => {
    const prop = machineProp(m, mm.kind, propStage);
    prop.group.position.set(mm.x, groundAt(mm.x, mm.z) - 0.05, mm.z);
    prop.group.rotation.y = mm.yaw;
    planetScene.add(prop.group);
    prop.group.updateMatrixWorld(true);
    prop.light(0.1);
    const metric = PIXELS_OF[mm.kind];
    let glow: THREE.Mesh | null = null;
    let light: THREE.PointLight | null = null;
    if (metric) {
      glow = makePlumeGroundGlow(mm.x, mm.z, METRIC_COLOUR[metric]);
      planetScene.add(glow);
      if (prop.vent) {
        const vPos = prop.vent.clone().applyMatrix4(prop.group.matrixWorld);
        light = new THREE.PointLight(METRIC_COLOUR[metric], 0, 18, 1.2);
        light.position.set(vPos.x, vPos.y + 1.2, vPos.z);
        light.visible = false;
        planetScene.add(light);
      }
    }
    return { m: mm, prop, vent: prop.vent ? prop.vent.clone().applyMatrix4(prop.group.matrixWorld) : null, emitter: null, running: 0, glow, light };
  };
  const unbuild = (v: MachineView): void => {
    planetScene.remove(v.prop.group);
    disposeProp(v.prop);
    if (v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; }
    if (v.glow) {
      planetScene.remove(v.glow);
      v.glow.geometry.dispose();
      (v.glow.material as THREE.Material).dispose();
      v.glow = null;
    }
    if (v.light) {
      planetScene.remove(v.light);
      v.light.dispose();
      v.light = null;
    }
  };
  /** A cable lying on the ground from a to b (both world points). */
  const groundCable = (a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh => {
    const pts: THREE.Vector3[] = [];
    const n = Math.max(6, Math.ceil(a.distanceTo(b) / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      pts.push(new THREE.Vector3(x, i === 0 ? a.y : i === n ? b.y : groundAt(x, z) + 0.05, z));
    }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.045, 6, false), cableMat);
  };
  /** The cables: each connected machine from the node that powers it (the gate's junction box when in its reach, else the nearest
   *  connected pylon or power unit in reach); a pylon powered by a pylon hangs its line from top to top. */
  const relay = (connected: ReadonlySet<number>): void => {
    for (const c of cables) { planetScene.remove(c); c.geometry.dispose(); }
    cables = [];
    const junction = new THREE.Vector3(...twin.sockets.find((x) => x.name === 'rear-junction')!.at).applyMatrix4(twin.group.matrixWorld);
    const nodes = [...views.values()].filter((v) => KINDS[v.m.kind].reach > 0 && connected.has(v.m.id));
    const g = twin.group.position;
    for (const v of views.values()) {
      if (!connected.has(v.m.id)) continue;
      let from: MachineView | null = null;
      if (Math.hypot(v.m.x - g.x, v.m.z - g.z) > GATE.reach) {
        let best = Infinity;
        for (const n of nodes) {
          if (n === v) continue;
          const d = Math.hypot(n.m.x - v.m.x, n.m.z - v.m.z);
          if (d <= KINDS[n.m.kind].reach && d < best) { best = d; from = n; }
        }
      }
      const line = from && from.prop.top && v.prop.top
        ? lineSpan(m, worldOf(from, from.prop.top), worldOf(v, v.prop.top))
        : groundCable(from ? worldOf(from, from.prop.power) : junction, worldOf(v, v.prop.power));
      planetScene.add(line);
      cables.push(line);
    }
  };
  /** Rebuilds the planet's twin gate at stage 1 (chunky) or stage 6 (full detail). */
  const rebuildTwin = (wantStage: number): void => {
    if (wantStage === twinStage) return;
    twinStage = wantStage;
    const oldGroup = twin.group;
    oldGroup.remove(twinOpening);
    oldGroup.remove(footing);
    planetScene.remove(oldGroup);
    oldGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && mesh !== twinOpening && mesh !== footing) {
        mesh.geometry.dispose();
      }
    });
    const oldPos = oldGroup.position.clone();
    const oldRotY = oldGroup.rotation.y;

    twin = kit.gate(m, { twin: true, stage: twinStage });
    twinOpening.position.set(0, twin.opening.sill + twin.opening.height / 2, twin.opening.z);
    twin.group.add(twinOpening);
    twin.group.add(footing);
    twin.group.position.copy(oldPos);
    twin.group.rotation.y = oldRotY;
    planetScene.add(twin.group);
    syncPlanetMatrices();
  };
  /** Rebuilds every machine and the twin gate at the detail of the stage the plot shows (chunky until stage 2). */
  const rebuildProps = (stageShown: number): void => {
    const want = stageShown <= 1 ? 1 : 6;
    rebuildTwin(want);
    if (want === propStage) return;
    propStage = want;
    for (const [id, v] of views) {
      const running = v.running, emitter = v.emitter;
      v.emitter = null;
      unbuild(v);
      const nv = build(v.m);
      nv.running = running; nv.emitter = emitter;
      if (running > 0.05) nv.prop.light(1);
      if (nv.glow) {
        nv.glow.visible = detail.plumeGlow && running > 0.05;
        setGlowStrength(nv.glow, Math.min(1.0, running) * 0.75);
      }
      if (nv.light) {
        nv.light.visible = detail.pixelLights && running > 0.05;
        nv.light.intensity = nv.light.visible ? running * 12.0 : 0;
      }
      views.set(id, nv);
    }
    relay(lastConnected);
  };
  let lastConnected: ReadonlySet<number> = new Set();

  // the build ghost: the chosen machine's shape, green where it may stand, red where it may not; always in colour
  const ghostOk = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#6dff8a') }, uLit: { value: 1 } } }));
  const ghostBad = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#ff5a4a') }, uLit: { value: 1 } } }));
  let ghost: MachineProp | null = null, ghostKind: MachineKind | null = null;
  let ghostCheck: ((x: number, z: number) => { readonly ok: boolean; readonly why: string }) | null = null;
  const dropGhost = (): void => {
    if (!ghost) return;
    planetScene.remove(ghost.group);
    ghost.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
    ghost = null;
  };
  const paintGhost = (ok: boolean): void => ghost?.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.material = ok ? ghostOk : ghostBad; });
  let building = false, ghostVerdict: { ok: boolean; why: string } = { ok: false, why: '' };
  const ghostAt = new THREE.Vector3();

  // ---- the post pass (planet picture by stage)
  const postUniforms = {
    uColour: { value: planetRT.texture as THREE.Texture }, uDepth: { value: planetRT.depthTexture as THREE.Texture | null }, uLab: { value: labRT.texture as THREE.Texture },
    uRes: { value: new THREE.Vector2(16, 16) }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uWaveCentre: { value: new THREE.Vector3() }, uWaveR: { value: -1 }, uSkyRise: { value: -1 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uLost: { value: 0 },
    uLookOut: { value: new THREE.Vector4(0.01, 0.01, 0, 1) }, uLookIn: { value: new THREE.Vector4(0.01, 0.01, 0, 1) },
  };
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), keep(new THREE.ShaderMaterial({ vertexShader: QUAD_VERTEX, fragmentShader: POST_FRAGMENT, uniforms: postUniforms, depthTest: false, depthWrite: false }))));

  // ---- you
  let where: Where = 'lab';
  const pos = new THREE.Vector3(room.spawn.x, EYE, room.spawn.z);
  let yaw = room.spawn.yaw, pitch = -0.04;
  let sync = 1, lostAt = -100;
  /** Metres walked since the last footstep, and how many relay lamps the sequence has lit (one click each). */
  let stride = 0, relaysHeard = 0;
  let powerT = -1, gateOn = false;
  /** The plot's stage, the stage the picture shows, and the stage a running wave brings (-1: none) and since when. */
  let stage = 0, shown = 0, waveTo = -1, waveStart = -1;
  /** The drawn picture's size in pixels: a look's pixels are whole pixels of it. */
  let bufW = 16, bufH = 16, planetK = 0;
  let pendingEvent: FrameOut['event'] = null;
  let clock = 0;

  // ---- scientist character model & animation (TASK-07, POL-18)
  let cameraView: 'first' | 'third' = o.cameraView ?? 'first';
  let scientistAnimator: ScientistAnimator | null = null;
  const scientistHolder = new THREE.Group();
  scientistHolder.visible = cameraView === 'third';
  labScene.add(scientistHolder);

  let visorMaterials: THREE.MeshStandardMaterial[] = [];
  const setVisorColor = (hex: string): void => {
    const col = new THREE.Color(hex);
    for (const mat of visorMaterials) {
      mat.color.copy(col);
      mat.emissive.copy(col);
    }
  };

  const initialVisor = o.avatar?.kind === 'scientist' ? o.avatar.visor : '#f59e0b';
  void Promise.all([createScientistInstance(initialVisor), loadScientistAnimations()]).then(
    ([{ group, visorMaterials: vm }, clips]) => {
      scientistHolder.add(group);
      visorMaterials = vm;
      scientistAnimator = createScientistAnimator(group, clips);
    }
  ).catch((err) => {
    console.warn('Failed to load scientist in Play:', err);
  });

  /** Push a circle of RADIUS out of the lab's boxes. */
  const collide = (p: THREE.Vector3): void => {
    for (let pass = 0; pass < 2; pass++) for (const b of room.colliders) {
      if (b.max[1] < 0.15 || b.min[1] > 1.8) continue;
      const cx = Math.max(b.min[0], Math.min(p.x, b.max[0])), cz = Math.max(b.min[2], Math.min(p.z, b.max[2]));
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      if (d > 1e-6) { p.x = cx + (dx / d) * RADIUS; p.z = cz + (dz / d) * RADIUS; continue; }
      // inside the box: out by the nearest face
      const out = [p.x - b.min[0], b.max[0] - p.x, p.z - b.min[2], b.max[2] - p.z];
      const k = out.indexOf(Math.min(...out));
      if (k === 0) p.x = b.min[0] - RADIUS; else if (k === 1) p.x = b.max[0] + RADIUS; else if (k === 2) p.z = b.min[2] - RADIUS; else p.z = b.max[2] + RADIUS;
    }
  };

  /** Where a point is in a gate's own frame. */
  const local = (gateM: THREE.Matrix4, p: THREE.Vector3): THREE.Vector3 => p.clone().applyMatrix4(gateM.clone().invert());

  const crossTo = (next: Where): void => {
    const M = next === 'planet' ? toPlanet : toLab;
    pos.applyMatrix4(M);
    yaw += next === 'planet' ? gateYawDelta : -gateYawDelta;
    if (where !== next) {
      if (next === 'planet') {
        labScene.remove(scientistHolder);
        planetScene.add(scientistHolder);
      } else {
        planetScene.remove(scientistHolder);
        labScene.add(scientistHolder);
      }
    }
    where = next;
    pendingEvent = next === 'planet' ? 'to-planet' : 'to-lab';
    sfx('static-burst', { volume: 0.35 });
  };

  /** Over-the-shoulder third-person camera raycast/collision clamping against lab walls, props, and ground. */
  const resolveThirdPersonCamera = (head: THREE.Vector3, desired: THREE.Vector3, inWhere: Where): THREE.Vector3 => {
    const result = desired.clone();
    const dir = desired.clone().sub(head);
    const maxDist = dir.length();
    if (maxDist < 1e-4) return result;
    dir.normalize();

    let hitDist = maxDist;
    const ray = new THREE.Ray(head, dir);
    const hitPoint = new THREE.Vector3();

    if (inWhere === 'lab') {
      const margin = 0.32;
      result.x = Math.max(ROOM.left + margin, Math.min(ROOM.right - margin, result.x));
      result.y = Math.max(0.25 + margin, Math.min(ROOM.height - margin, result.y));
      result.z = Math.max(ROOM.back + margin, Math.min(ROOM.front - margin, result.z));
      hitDist = Math.min(hitDist, result.distanceTo(head));

      const colBox = new THREE.Box3();
      for (const b of room.colliders) {
        colBox.min.set(b.min[0] - 0.25, b.min[1] - 0.25, b.min[2] - 0.25);
        colBox.max.set(b.max[0] + 0.25, b.max[1] + 0.25, b.max[2] + 0.25);
        if (ray.intersectBox(colBox, hitPoint)) {
          const d = head.distanceTo(hitPoint);
          if (d < hitDist) {
            hitDist = Math.max(0.4, d - 0.1);
          }
        }
      }
      result.copy(head).addScaledVector(dir, hitDist);
    } else {
      for (let t = 0.3; t <= maxDist; t += 0.35) {
        const p = head.clone().addScaledVector(dir, t);
        const gy = groundAt(p.x, p.z) + 0.35;
        if (p.y < gy) {
          hitDist = Math.min(hitDist, Math.max(0.4, t - 0.2));
          break;
        }
      }
      result.copy(head).addScaledVector(dir, hitDist);
      const groundMin = groundAt(result.x, result.z) + 0.35;
      if (result.y < groundMin) result.y = groundMin;
    }

    return result;
  };

  const aimGround = (): THREE.Vector3 | null => {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const p = pos.clone();
    for (let d = 1; d < 36; d += 0.25) {
      const q = p.clone().addScaledVector(dir, d);
      if (q.y <= groundAt(q.x, q.z)) return q;
    }
    return null;
  };

  const visible = (mesh: THREE.Object3D, cam: THREE.Camera): boolean => {
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    return f.intersectsBox(new THREE.Box3().setFromObject(mesh));
  };

  const drawPlanet = (cam: THREE.PerspectiveCamera, to: THREE.WebGLRenderTarget | null, hideTwin: boolean): void => {
    twin.group.visible = !hideTwin;
    renderer.setRenderTarget(planetRT);
    renderer.clear();
    renderer.render(planetScene, cam);
    twin.group.visible = true;
    postUniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    postUniforms.uCamWorld.value.copy(cam.matrixWorld);
    renderer.setRenderTarget(to);
    renderer.render(postScene, postCam);
  };

  /** The front on the ground (metres; -1 none, 1e7 done) and on the sky (the sine of the elevation it has climbed to). */
  const waveNow = (): { readonly r: number; readonly sky: number } => {
    if (waveTo < 0) return { r: -1, sky: -1 };
    const t = Math.max(0, clock - waveStart);
    if (t < GROUND_SECONDS) return { r: waveFront(t), sky: -1 };
    const p = (t - GROUND_SECONDS) / SKY_SECONDS;
    if (p >= 1) return { r: 1e7, sky: 1 };
    // from just below the horizon (the far ground's edge sits below eye level) to the zenith, easing in and out
    return { r: GROUND_REACH, sky: -0.25 + 1.25 * p * p * (3 - 2 * p) };
  };
  /** -1 before the first stage, 1e7 once a stage has crossed the plot (the e2e waits on it), the front while a wave runs. */
  const waveRadius = (): number => (waveTo >= 0 ? waveNow().r : shown >= 1 ? 1e7 : -1);

  /** A stage's look pixel in screen pixels: its lines on this screen, never finer than the tier allows. */
  const cellPx = (st: number): number => {
    const look = STAGE_LOOK[Math.max(0, Math.min(6, st))]!;
    return Math.max(1, Math.round(bufH / Math.min(look.lines, detail.planetLines)));
  };
  /** The looks either side of the wave, and the planet's picture as fine as the finest look shown (never coarser than stage 1). */
  const fitLooks = (): void => {
    const inStage = waveTo >= 0 ? waveTo : shown;
    const cOut = cellPx(shown), cIn = cellPx(inStage);
    const setLook = (v: THREE.Vector4, st: number, c: number): void => { const look = STAGE_LOOK[Math.max(0, Math.min(6, st))]!; v.set(c / bufW, c / bufH, look.levels, look.dither ? 1 : 0); };
    setLook(postUniforms.uLookOut.value, shown, cOut);
    setLook(postUniforms.uLookIn.value, inStage, cIn);
    const k = Math.max(1, Math.min(cOut, cIn, Math.round(bufH / BASE_LINES)));
    if (k === planetK) return;
    planetK = k;
    const pw = Math.max(64, Math.round(bufW / k)), ph = Math.max(36, Math.round(bufH / k));
    planetRT.dispose(); viewRT.dispose();
    planetRT = target(pw, ph, true, true);
    viewRT = target(pw, ph, false, true);
    postUniforms.uColour.value = planetRT.texture; postUniforms.uDepth.value = planetRT.depthTexture;
    postUniforms.uRes.value.set(pw, ph);
    openingUniforms.uView.value = viewRT.texture;
    plume.setViewport(ph);
  };

  let lastAimedBoulder: number | null = null;

  const api: PlayScene = {
    setPlanet(base, plot, neighbours) {
      if (world) return;
      // the plot's natural ground (its own terrain and materials); the old world brings the sky, the stars and the neighbours, seated on it
      const g = createPlotGround(planetScene, { seed: 7, sunDir: SUN, stage: Math.max(1, stage), textureSize: o.groundTexture, budget: detail.groundBudget });
      ground = g;
      world = createWorld(planetScene, { gridSpacing: o.gridSpacing, reducedMotion: o.reducedMotion, ground: false });
      world.setPlanet(base, neighbours, { treeDetailRange: 150, height: (x, z) => g.terrain.height(x, z) + 0.6 });
      world.show(plot);
      const gy = g.heightAt(0, 0);
      padTop = gy + 0.25;
      twin.group.position.set(0, gy, 0);
      syncPlanetMatrices();
      g.update(0, 0, true);
      holo.build(g, { x: 0, z: 0 });
    },
    restore(s) {
      gateOn = s.gateOn;
      room.setPower(gateOn ? POWER_ON : POWER_OFF);
      if (gateOn) room.lever.rotation.x = -1.1;
      openingUniforms.uStatic.value = gateOn ? 0 : 1;
      stage = shown = s.plot.stage;
      waveTo = -1;
      ground?.setStage(Math.max(1, stage));
      fitLooks();
      propStage = stage <= 1 ? 1 : 6;
      rebuildTwin(propStage);
      if (where === 'lab') {
        if (scientistHolder.parent !== labScene) {
          planetScene.remove(scientistHolder);
          labScene.add(scientistHolder);
        }
      } else {
        if (scientistHolder.parent !== planetScene) {
          labScene.remove(scientistHolder);
          planetScene.add(scientistHolder);
        }
      }
      api.setPlot(s.plot, s.running, s.connected);
      holo.setPlot(s.plot, s.running, s.connected);
      // a restored plot's machines are already running: their pixels show at once
      for (const v of views.values()) if (v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; }
      for (const v of views.values()) {
        const metric = PIXELS_OF[v.m.kind];
        if (metric && v.vent && v.running > 0.05) v.emitter = plume.add({ at: [v.vent.x, v.vent.y, v.vent.z], colour: METRIC_COLOUR[metric], ...MILL_POUR, startAt: -100 });
        if (v.glow) {
          v.glow.visible = detail.plumeGlow && v.running > 0.05;
          setGlowStrength(v.glow, Math.min(1.0, v.running) * 0.75);
        }
        if (v.light) {
          v.light.visible = detail.pixelLights && v.running > 0.05;
          v.light.intensity = v.light.visible ? v.running * 12.0 : 0;
        }
      }
    },
    setPlot(plot, running, connected) {
      const ids = new Set(plot.machines.map((mm) => mm.id));
      let changed = false;
      for (const [id, v] of views) if (!ids.has(id)) { unbuild(v); views.delete(id); changed = true; }
      for (const mm of plot.machines) if (!views.has(mm.id)) { views.set(mm.id, build(mm)); changed = true; }
      const sameNet = connected.size === lastConnected.size && [...connected].every((id) => lastConnected.has(id));
      if (changed || !sameNet) { relay(connected); lastConnected = new Set(connected); }
      holo.setPlot(plot, running, connected);
      // pixels pour from every pixel machine while it runs; lamps show which run
      for (const v of views.values()) {
        const r = running.get(v.m.id) ?? 0;
        if ((r > 0.05) !== (v.running > 0.05)) v.prop.light(r > 0.05 ? 1 : 0.1);
        v.running = r;
        if (v.glow) {
          v.glow.visible = detail.plumeGlow && r > 0.05;
          setGlowStrength(v.glow, Math.min(1.0, r) * 0.75);
        }
        if (v.light) {
          v.light.visible = detail.pixelLights && r > 0.05;
          v.light.intensity = v.light.visible ? r * 12.0 : 0;
        }
        const metric = PIXELS_OF[v.m.kind];
        if (!metric || !v.vent) continue;
        if (r > 0.05 && v.emitter === null) v.emitter = plume.add({ at: [v.vent.x, v.vent.y, v.vent.z], colour: METRIC_COLOUR[metric], ...MILL_POUR, startAt: clock + 0.6 });
        else if (r <= 0.05 && v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; }
      }
    },
    richness(x, z) {
      if (!ground) return 0;
      // rock, scree, gravel, dust, cracked flats, red soil: ore is in the rock
      const w = ground.terrain.materials(x, z);
      const ore = [1, 0.85, 0.55, 0.1, 0.3, 0.6];
      let sum = 0, total = 0;
      w.forEach((v, i) => { sum += v * ore[i]!; total += v; });
      return total > 0 ? sum / total : 0;
    },
    pullLever() {
      if (gateOn || powerT >= 0) return;
      powerT = 0;
      relaysHeard = 0;
      sfx('lever-throw');
      scientistAnimator?.playOneShot('lever');
    },
    setBuilding(kind, check) {
      const k = kind && where === 'planet' ? kind : null;
      if (k !== ghostKind) { dropGhost(); ghostKind = k; if (k) { ghost = machineProp(m, k, propStage); paintGhost(false); planetScene.add(ghost.group); } }
      ghostCheck = check ?? null;
      building = !!k;
      if (ghost) ghost.group.visible = false;
      ghostVerdict = { ok: false, why: '' };
    },
    aim() {
      if (!building || !ghostVerdict.ok) return null;
      const g = twin.group.position;
      return { x: ghostAt.x, z: ghostAt.z, yaw: Math.atan2(ghostAt.x - g.x, ghostAt.z - g.z) };
    },
    raiseStage(to, from) {
      if (to <= stage) return;
      scientistAnimator?.playOneShot('cheer');
      // a wave still running is overtaken: the stage it was bringing shows at once
      if (waveTo >= 0) shown = waveTo;
      stage = to;
      waveTo = to;
      waveStart = clock + (shown === 0 ? 2.0 : 0.8);
      postUniforms.uWaveCentre.value.set(from.x, groundAt(from.x, from.z), from.z);
      ground?.setStage(Math.max(1, to));
      fitLooks();
    },
    frame(now, dt, c) {
      clock = now;
      // ---- the power-on sequence
      if (powerT >= 0) {
        const before = powerT;
        powerT += dt;
        const crossed = (at: number): boolean => before < at && powerT >= at;
        if (crossed(1.2)) sfx('power-surge');
        if (crossed(2.0)) sfx('coil-charge');
        if (crossed(3.8)) sfx('static-burst', { volume: 0.6 });
        if (crossed(POWER_SECONDS - 0.6)) sfx('gate-open');
        room.lever.rotation.x = -1.1 * Math.min(1, powerT / 0.35);
        const p = powerAt(powerT);
        const lit = Math.floor(p.relays * 12);
        while (relaysHeard < lit) { relaysHeard++; sfx('relay-click', { pitch: 0.92 + (relaysHeard % 4) * 0.05 }); }
        room.setPower(p);
        openingUniforms.uStatic.value = p.static;
        if (powerT >= POWER_SECONDS) { powerT = -1; gateOn = true; pendingEvent = 'powered'; }
      }
      // ---- look and walk
      const sens = 0.0024;
      yaw -= c.look.dx * sens;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - c.look.dy * sens));
      const speed = (c.run ? RUN : WALK) * dt;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const before = pos.clone();
      pos.x += (fx * c.move.z + rx * c.move.x) * speed;
      pos.z += (fz * c.move.z + rz * c.move.x) * speed;
      stride += Math.hypot(pos.x - before.x, pos.z - before.z);
      if (stride > 1.35) {
        stride = 0;
        sfx('step-grit', where === 'planet' ? { pitch: 0.85 + Math.random() * 0.25, volume: 0.55 } : { pitch: 1.5 + Math.random() * 0.2, volume: 0.3 });
      }
      if (where === 'lab') {
        collide(pos);
        pos.y = EYE;
      } else {
        // keep to your plot's surroundings; stand on the ground
        const r = Math.hypot(pos.x, pos.z);
        if (r > 420) { pos.x *= 420 / r; pos.z *= 420 / r; }
        const target = groundAt(pos.x, pos.z) + EYE;
        pos.y += (target - pos.y) * Math.min(1, dt * 14);
      }
      // ---- through the gate (only when it is on and the picture is clear)
      if (gateOn && world) {
        const gateM = where === 'lab' ? labGateM : planetGateM;
        const a = local(gateM, before), b = local(gateM, pos);
        const op = where === 'lab' ? room.gate.opening : twin.opening;
        if (Math.sign(a.z - op.z) !== Math.sign(b.z - op.z) && Math.abs(b.x) < op.width / 2 - 0.15) crossTo(where === 'lab' ? 'planet' : 'lab');
      }
      // ---- sync
      let nearMachine = false;
      if (shown >= 1 && waveTo < 0) for (const v of views.values()) if (v.running > 0.05 && Math.hypot(v.m.x - pos.x, v.m.z - pos.z) < MACHINE_FIELD) { nearMachine = true; break; }
      sync = stepSync(sync, dt, { onPlanet: where === 'planet', stage, nearMachine });
      if (where === 'planet' && sync > 0 && sync < 0.3) sfx('sync-warning', { minGapMs: 1400, volume: 0.6 });
      if (where === 'planet' && sync <= 0) {
        sfx('sync-lost');
        // pulled back to the lab, in front of the gate, facing it
        lostAt = now;
        where = 'lab';
        pos.set(GATE_AT.x, EYE, GATE_AT.z + 3.2);
        yaw = 0; pitch = 0;
        sync = 0.05;
        building = false; if (ghost) ghost.group.visible = false;
        pendingEvent = 'sync-lost';
      }
      // ---- character model & animator (TASK-07, POL-18)
      scientistHolder.position.set(pos.x, pos.y - EYE, pos.z);
      scientistHolder.rotation.set(0, yaw + Math.PI, 0);
      scientistHolder.visible = cameraView === 'third';

      if (scientistAnimator) {
        scientistAnimator.update(dt, {
          forward: c.move.z,
          strafe: c.move.x,
          run: c.run,
          jumping: false,
        });
      }

      // ---- the camera (first person or over-the-shoulder third person)
      if (cameraView === 'third') {
        const camRot = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        const rightVec = new THREE.Vector3(1, 0, 0).applyEuler(camRot);
        const upVec = new THREE.Vector3(0, 1, 0).applyEuler(camRot);
        const backVec = new THREE.Vector3(0, 0, 1).applyEuler(camRot);
        const desiredPos = pos.clone()
          .addScaledVector(rightVec, 0.38)
          .addScaledVector(upVec, 0.12)
          .addScaledVector(backVec, 2.2);
        const clampedPos = resolveThirdPersonCamera(pos, desiredPos, where);
        camera.position.copy(clampedPos);
      } else {
        camera.position.copy(pos);
      }
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
      // ---- the build ghost
      if (building && ghost) {
        const hit = aimGround();
        ghost.group.visible = !!hit;
        if (hit) {
          ghostAt.copy(hit);
          ghost.group.position.set(hit.x, groundAt(hit.x, hit.z), hit.z);
          ghost.group.rotation.y = Math.atan2(hit.x - twin.group.position.x, hit.z - twin.group.position.z);
          const verdict = ghostCheck ? ghostCheck(hit.x, hit.z) : { ok: false, why: '' };
          if (verdict.ok !== ghostVerdict.ok) paintGhost(verdict.ok);
          ghostVerdict = { ok: verdict.ok, why: verdict.why };
        } else ghostVerdict = { ok: false, why: 'Aim at the ground near the gate.' };
      }
      // ---- machines at work
      for (const v of views.values()) {
        v.prop.animate(now, v.running);
        if (v.glow && v.glow.visible) setGlowTime(v.glow, now);
        if (v.light && v.light.visible) {
          const flicker = 0.88 + 0.12 * Math.sin(now * 8.5 + v.m.id * 2.7);
          v.light.intensity = v.running * 12.0 * flicker;
          if (v.vent) {
            v.light.position.set(
              v.vent.x + Math.sin(now * 2.5 + v.m.id) * 0.25,
              v.vent.y + 1.2 + Math.cos(now * 3.0) * 0.18,
              v.vent.z + Math.cos(now * 2.1 + v.m.id) * 0.25
            );
          }
        }
      }
      // ---- the wave, and the event when it has crossed
      const wave = waveNow(), r = wave.r;
      if (waveTo >= 0 && r > 1e6) { shown = waveTo; waveTo = -1; fitLooks(); rebuildProps(shown); pendingEvent = pendingEvent ?? 'stage-up'; sfx('stage-up'); }
      postUniforms.uWaveR.value = waveTo >= 0 ? r : -1;
      postUniforms.uSkyRise.value = wave.sky;
      // a quarter of the pixels race out to the wave's front while it runs
      const wc = postUniforms.uWaveCentre.value;
      plume.setWave([wc.x, wc.y, wc.z], waveTo >= 0 ? Math.min(r, RACER_REACH) : -1);
      plume.update(now);
      labPlume.update(now);
      postUniforms.uTime.value = now;
      postUniforms.uGlitch.value = where === 'planet' ? Math.max(0, Math.min(1, (0.4 - sync) / 0.4)) : 0;
      postUniforms.uLost.value = Math.max(0, 1 - (now - lostAt) / 0.6);
      openingUniforms.uTime.value = now;
      room.update(now, dt);
      const mainPower = powerT >= 0 ? powerAt(powerT).main : (gateOn ? 1 : 0);
      holo.update(now, dt, mainPower, waveTo >= 0 ? r : -1);
      // the ground's chunks follow you on the planet; from the lab, they stay round the gate
      ground?.regrow(dt);
      ground?.update(where === 'planet' ? pos.x : 0, where === 'planet' ? pos.z : 0);
      labScene.environmentIntensity = room.envLevel();
      world?.update(now, dt, where === 'planet' ? camera.position : virtual.position);

      // ---- draw
      renderer.info.autoReset = false;
      renderer.info.reset();
      if (where === 'lab') {
        if (world && room.portal.visible && visible(room.portal, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toPlanet);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          drawPlanet(virtual, viewRT, true);
        }
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(labScene, camera);
      } else {
        if (gateOn && visible(twinOpening, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toLab);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          room.gate.group.visible = false;
          renderer.setRenderTarget(labRT);
          renderer.clear();
          renderer.render(labScene, virtual);
          room.gate.group.visible = true;
        }
        drawPlanet(camera, null, false);
      }
      // ---- what you are looking at: a machine on the planet within reach of your hand, a boulder with ore, the lab's main lever, or lab machines
      let aimed: number | null = null;
      let aimedBoulder: number | null = null;
      if (where === 'planet' && !building) {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let best = 6;
        for (const v of views.values()) {
          const c = new THREE.Vector3(v.m.x, groundAt(v.m.x, v.m.z) + 1.0, v.m.z).sub(pos);
          const t = c.dot(dir);
          if (t <= 0 || t >= best) continue;
          if (c.addScaledVector(dir, -t).length() < KINDS[v.m.kind].radius + 0.4) { best = t; aimed = v.m.id; }
        }
        if (ground) {
          const bId = ground.findAimedBoulder(pos, dir, 5.0);
          if (bId !== null) {
            if (aimed !== null) {
              const bInfo = ground.getBoulders().find((b) => b.id === bId);
              if (bInfo) {
                const bDist = Math.hypot(bInfo.x - pos.x, bInfo.z - pos.z);
                if (bDist < best) {
                  aimed = null;
                  aimedBoulder = bId;
                }
              }
            } else {
              aimedBoulder = bId;
            }
          }
        }
      }
      lastAimedBoulder = aimedBoulder;
      let atLever = false;
      let atDial = false;
      let aimedLab: LabMachineKind | null = null;
      if (where === 'lab') {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const to = room.leverAt.clone().sub(pos);
        const atConsole = to.length() < 2.4 && to.normalize().dot(dir) > 0.86;
        if (!gateOn && powerT < 0) {
          atLever = atConsole;
        } else if (gateOn) {
          atDial = atConsole;
        }
        const targets: [LabMachineKind, THREE.Vector3, number, number][] = [
          ['rack', new THREE.Vector3(-9.55, 1.2, -5.5), 1.6, 4.0],
          ['bench', new THREE.Vector3(9.25, 0.85, -3.4), 1.2, 3.8],
          ['combiner', new THREE.Vector3(9.1, 0.9, -0.6), 1.0, 3.5],
        ];
        let bestLab = 4.5;
        for (const [kind, targetPos, radius, maxDist] of targets) {
          const c = targetPos.clone().sub(pos);
          const t = c.dot(dir);
          if (t <= 0 || t >= bestLab || t > maxDist) continue;
          if (c.addScaledVector(dir, -t).length() < radius + 0.35) {
            bestLab = t;
            aimedLab = kind;
          }
        }
      }
      const ev = pendingEvent;
      pendingEvent = null;
      return { where, sync, atLever, atDial, ghost: building ? ghostVerdict : null, aimed, aimedBoulder, aimedLab, stage: shown, event: ev };
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      screen.copy(buf);
      bufW = buf.x; bufH = buf.y;
      camera.aspect = virtual.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix(); virtual.updateProjectionMatrix();
      labRT.dispose();
      labRT = target(Math.round(buf.x / 2), Math.round(buf.y / 2), false, false);
      postUniforms.uLab.value = labRT.texture;
      // the planet's picture is fitted to the new screen
      planetK = 0;
      fitLooks();
    },
    setDetail(d) {
      detail = d;
      fitLooks();
      ground?.setBudget(d.groundBudget);
      plume.setMode(d.plumes);
      plume.setDensity(d.plumeDensity);
      labPlume.setMode(d.plumes);
      labPlume.setDensity(d.plumeDensity);
      for (const v of views.values()) {
        if (v.glow) v.glow.visible = detail.plumeGlow && v.running > 0.05;
        if (v.light) {
          v.light.visible = detail.pixelLights && v.running > 0.05;
          v.light.intensity = v.light.visible ? v.running * 12.0 : 0;
        }
      }
    },
    setLabActivity,
    setCameraView(mode) {
      cameraView = mode;
      scientistHolder.visible = (mode === 'third');
    },
    getCameraView: () => cameraView,
    playAction(kind) {
      scientistAnimator?.playOneShot(kind);
    },
    setAvatar(avatar) {
      if (avatar?.kind === 'scientist') setVisorColor(avatar.visor);
    },
    gatherBoulder(id, amount) {
      return ground?.gather(id, amount) ?? 0;
    },
    warm() {
      // each scene for each place it draws to (the screen's colour space differs from the targets'), hidden things included (the
      // plume's three ways), with one of every machine standing in, and again in the ghost's marks: what first appears mid-play is
      // compiled here, not as a hitch
      const kinds = Object.keys(KINDS) as MachineKind[];
      const stand = kinds.map((k) => { const p = machineProp(m, k, propStage); p.group.visible = false; planetScene.add(p.group); return p; });
      const passes: [THREE.Scene, THREE.Camera, THREE.WebGLRenderTarget | null][] = [
        [planetScene, camera, planetRT], [postScene, postCam, viewRT], [postScene, postCam, null], [labScene, camera, null], [labScene, camera, labRT],
      ];
      for (const [sc, cam, to] of passes) { renderer.setRenderTarget(to); renderer.compile(sc, cam); }
      for (const p of stand) p.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.material = ghostOk; });
      renderer.setRenderTarget(planetRT);
      renderer.compile(planetScene, camera);
      renderer.setRenderTarget(null);
      for (const p of stand) { planetScene.remove(p.group); p.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); }); }
      holo.warm(renderer, camera);
    },
    debug: {
      groundTriangles: () => ground?.triangles() ?? 0,
      showGround: (on) => ground?.setVisible(on),
      where: () => where,
      position: () => pos.clone(),
      teleport(w, x, z, y, p) {
        if (where !== w) {
          if (w === 'planet') {
            labScene.remove(scientistHolder);
            planetScene.add(scientistHolder);
          } else {
            planetScene.remove(scientistHolder);
            labScene.add(scientistHolder);
          }
          pendingEvent = w === 'planet' ? 'to-planet' : 'to-lab';
        }
        where = w; pos.set(x, w === 'lab' ? EYE : groundAt(x, z) + EYE, z); yaw = y; if (p !== undefined) pitch = p;
      },
      sync: () => sync,
      stats: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),
      wave: () => waveRadius(),
      gatePlanet: () => ({ x: twin.group.position.x, z: twin.group.position.z }),
      detail: () => ({ ...detail, planet: [postUniforms.uRes.value.x, postUniforms.uRes.value.y] as const, pixels: plume.stats().pixels }),
      machines: () => { let pouring = 0; for (const v of views.values()) if (v.emitter !== null) pouring++; return { standing: views.size, pouring }; },
      holo: () => holo.debug(),
      view: () => cameraView,
      clipWeight: (name: ClipName) => scientistAnimator?.getClipWeight(name) ?? 0,
      currentOneShot: () => scientistAnimator?.currentOneShot ?? null,
      animator: () => scientistAnimator,
      gather(amount) {
        if (!ground) return 0;
        const targetId = lastAimedBoulder ?? ground.findNearestBoulder(pos);
        if (targetId === null) return 0;
        return ground.gather(targetId, amount);
      },
      aimedBoulder: () => lastAimedBoulder,
      boulders: () => ground?.getBoulders() ?? [],
      twinStage: () => twinStage,
      plumeGlowCount: () => {
        let count = 0;
        for (const v of views.values()) if (v.glow && v.glow.visible) count++;
        return count;
      },
      pixelLightCount: () => {
        let count = 0;
        for (const v of views.values()) if (v.light && v.light.visible) count++;
        return count;
      },
    },
    dispose() {
      scientistAnimator?.dispose();
      labScene.remove(scientistHolder);
      planetScene.remove(scientistHolder);
      for (const v of views.values()) unbuild(v);
      for (const c of cables) c.geometry.dispose();
      dropGhost();
      world?.dispose();
      ground?.dispose();
      holo.dispose();
      room.dispose();
      for (const x of owned) x.dispose();
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
      renderer.dispose();
    },
  };
  return api;
}

/** Lab bounds, for the screen's hints. */
export const LAB_BOUNDS = ROOM;
