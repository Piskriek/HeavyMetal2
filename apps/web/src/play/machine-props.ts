// Each machine of the plot (`@hm/plotsim`) as a prop: the texture mill from `@hm/labkit`, the six others from `@hm/fieldkit`
// (both Arena Battles, built to sheet 12 of the concept art). Where its power comes in, where its pixels come out, and the parts
// that move while it runs.
import * as THREE from 'three';
import * as field from '@hm/fieldkit';
import * as lab from '@hm/labkit';
import * as basegear from '@hm/basegear';
import * as heavygear from '@hm/heavygear';
import { textureMill as consoleMillTextureMill, setLamp as setConsoleMillLamp } from '@hm/consolemill';
import type { MachineKind, Metric } from '@hm/plotsim';
import { type GenLevel, getGenSync } from '../assets/gen';
import { machineSize } from '../base/machine-inspect';
import { plumeShare } from './brownout-visual';
import { PRINT_EDGE_HEX } from '@hm/tooljuice';

export type MachineLedStatus = 'running' | 'warn' | 'unpowered';

export const HOUSING_LED_COLOURS: Readonly<Record<MachineLedStatus, string>> = {
  running: '#22c55e',   // Green: running with power & feed
  warn: '#f59e0b',      // Amber blink: no ore, idle, or brownout
  unpowered: '#ef4444', // Red: unpowered / disconnected
};

/**
 * Per-kind housing surface anchor [x, y, z] in metres (fitted prop frame) where the
 * square status LED sits on the front face of the housing (POL-39).
 */
export const HOUSING_LED_ANCHOR: Readonly<Record<MachineKind, readonly [number, number, number]>> = {
  drill: [0.38, 1.35, 0.92],
  mill: [0.44, 1.32, 0.96],
  pylon: [0.0, 1.25, 0.42],
  press: [0.46, 1.38, 1.02],
  power: [0.42, 1.30, 0.98],
  projector: [0.34, 1.42, 0.82],
  water: [0.52, 1.34, 1.08],
  'heavy-mill': [0.95, 2.15, 2.28],
  'heavy-press': [1.02, 2.25, 2.38],
  'heavy-projector': [0.88, 2.35, 2.22],
  'heavy-water': [1.08, 2.20, 2.46],
};

/** Pure evaluator for the square housing status LED colour & intensity (POL-39). */
export function housingLedState(
  running: number,
  connected: boolean,
  satisfaction = 1,
  timeSec = 0,
): { readonly status: MachineLedStatus; readonly colour: string; readonly intensity: number } {
  if (!connected) {
    return { status: 'unpowered', colour: HOUSING_LED_COLOURS.unpowered, intensity: 0.85 };
  }
  if (running <= 0.05 || satisfaction < 0.99) {
    const blinkOn = Math.sin(timeSec * Math.PI * 4) >= -0.1;
    return {
      status: 'warn',
      colour: HOUSING_LED_COLOURS.warn,
      intensity: blinkOn ? 0.9 : 0.2,
    };
  }
  return { status: 'running', colour: HOUSING_LED_COLOURS.running, intensity: 0.95 };
}

export interface MachineProp {
  readonly group: THREE.Group;
  /** Where its cable comes in (the prop's own frame); a pylon's is the box at its foot. */
  readonly power: THREE.Vector3;
  /** Where its pixels pour out (pixel machines), its steam (the power unit), or null. */
  readonly vent: THREE.Vector3 | null;
  /** Where its ore goes in (the feed hopper, dark grey cubes drop into it while it consumes), or null: a drill, a projector, the power
   *  unit and a pylon take none (ARGO_NOTE_16 ruling 3). Optional only for the unused gen-asset builder in assets/gen-props.ts, which
   *  predates the feed socket. */
  readonly feed?: THREE.Vector3 | null;
  /** A pylon's line attachment, for the spans between pylons. */
  readonly top: THREE.Vector3 | null;
  readonly lamps: readonly THREE.Mesh[];
  /** Square emissive status LED mesh mounted on the housing (POL-39). */
  readonly statusLed?: THREE.Mesh;
  /** Housing LED anchor in the prop's frame (POL-39). */
  readonly ledAnchor?: THREE.Vector3;
  /** Moves what moves while it runs (0..1 how hard it runs), t in seconds. */
  animate(t: number, running: number): void;
  /** Lights its lamps, 0..1. */
  light(glow: number): void;
  /** Updates the square housing status LED from live telemetry (POL-39). */
  setStatusLed?(running: number, connected: boolean, satisfaction?: number, t?: number): void;
  /** Apply print sweep frame (T09b, P0-VFX-02): clip 0..1 with #7cff4d leading edge, and vertical offset. */
  applyPrintSweep?(clip: number, offsetM: number): void;
}

/** The metric a machine's pixels raise (null: it pours none). */
export const PIXELS_OF: Readonly<Record<MachineKind, Metric | null>> = {
  drill: null, mill: 'pxd', pylon: null, press: 'vtx', power: null, projector: 'lx', water: 'aq',
  'heavy-mill': 'pxd', 'heavy-press': 'vtx', 'heavy-projector': 'lx', 'heavy-water': 'aq',
};

/** Hardpoint ring top height where heavy machines stand. */
export const RING_TOP_Y = 0.78;

export type PlumeCadence = 'continuous' | 'ram-fast' | 'ram-heavy' | 'shimmer' | 'chatter' | 'crackle';

/** One machine kind's plume (ARGO_NOTE_08 §2): colour, pour rate at full run (pixels/s), rise speed (m/s), cone half-angle (rad),
 *  pixel size (m), gravity (m/s^2, negative = buoyant), lifetime (s), and the cadence that modulates the pour. */
export interface MachinePlumeSpec {
  readonly colour: string;
  readonly rate: number;
  readonly speed: number;
  readonly spread: number;
  readonly pixelSize: number;
  readonly gravity: number;
  readonly lifetime: number;
  readonly cadence: PlumeCadence;
}

/**
 * The live count of each kind is rate x lifetime at full run (ARGO_NOTE_16 ruling 1, POL-261). The starter press, the projector
 * and the water maker keep their T03P numbers (the ruling does not list them).
 */
export const MACHINE_PLUME_SPECS: Readonly<Record<MachineKind, MachinePlumeSpec>> = {
  mill: { colour: '#ff3d8a', rate: 56, speed: 2.4, spread: 0.22, pixelSize: 0.11, gravity: -0.4, lifetime: 2.5, cadence: 'continuous' },
  'heavy-mill': { colour: '#ff3d8a', rate: 72, speed: 3.6, spread: 0.30, pixelSize: 0.16, gravity: -0.6, lifetime: 2.5, cadence: 'continuous' },
  press: { colour: '#7cff4d', rate: 32, speed: 2.8, spread: 0.48, pixelSize: 0.12, gravity: 0.2, lifetime: 1.4, cadence: 'ram-fast' },
  'heavy-press': { colour: '#7cff4d', rate: 72, speed: 4.0, spread: 0.58, pixelSize: 0.18, gravity: 0.3, lifetime: 2.5, cadence: 'ram-heavy' },
  projector: { colour: '#ffc13d', rate: 26, speed: 3.4, spread: 0.14, pixelSize: 0.10, gravity: -0.8, lifetime: 2.2, cadence: 'shimmer' },
  'heavy-projector': { colour: '#ffc13d', rate: 80, speed: 4.8, spread: 0.18, pixelSize: 0.16, gravity: -1.1, lifetime: 2.5, cadence: 'shimmer' },
  water: { colour: '#3dc8ff', rate: 34, speed: 1.9, spread: 0.52, pixelSize: 0.14, gravity: -0.2, lifetime: 2.0, cadence: 'continuous' },
  'heavy-water': { colour: '#3dc8ff', rate: 72, speed: 2.9, spread: 0.65, pixelSize: 0.20, gravity: -0.3, lifetime: 2.5, cadence: 'continuous' },
  drill: { colour: '#ff7b3d', rate: 48, speed: 3.2, spread: 0.62, pixelSize: 0.09, gravity: 4.5, lifetime: 2.0, cadence: 'chatter' },
  power: { colour: '#b46bff', rate: 56, speed: 3.5, spread: 0.25, pixelSize: 0.12, gravity: -0.5, lifetime: 2.0, cadence: 'continuous' },
  pylon: { colour: '#5ce1e6', rate: 30, speed: 1.1, spread: 0.75, pixelSize: 0.07, gravity: 1.2, lifetime: 1.2, cadence: 'crackle' },
};

export function machinePlumeSpec(kind: MachineKind): MachinePlumeSpec {
  return MACHINE_PLUME_SPECS[kind];
}

/** The cadence multiplier at time t (seconds): how the pour pulses (ARGO_NOTE_08 §3). Pure. */
export function plumeCadenceMultiplier(cadence: PlumeCadence, t: number): number {
  switch (cadence) {
    case 'continuous':
      return 1.0;
    case 'ram-fast':
      return Math.max(0.15, Math.sin(t * 3.1));
    case 'ram-heavy':
      return Math.max(0.15, Math.sin(t * 2.0));
    case 'shimmer':
      return 0.85 + 0.15 * Math.sin(t * 6.0);
    case 'chatter':
      return 0.7 + 0.3 * Math.sin(t * 18.0);
    case 'crackle':
      return Math.sin(t * 14.0) > 0.4 ? 1.0 : 0.0;
  }
}

/** The emitter's look for @hm/plume: its height (metres), its cone spread (the plume's diameter at the top), its life and pixel size. */
export interface PlumeEmitterLook {
  readonly height: number;
  readonly spread: number;
  readonly life: number;
  readonly size: number;
}

/** The look of a kind's pour: the rise is speed x lifetime x 0.6 (the plume eases out), its spread is the cone's width at that height. */
export function machinePlumeLookOf(s: MachinePlumeSpec): PlumeEmitterLook {
  const height = s.speed * s.lifetime * 0.6;
  return { height, spread: 2 * height * Math.tan(s.spread), life: s.lifetime, size: s.pixelSize };
}

export function machinePlumeLook(kind: MachineKind): PlumeEmitterLook {
  return machinePlumeLookOf(MACHINE_PLUME_SPECS[kind]);
}

/**
 * The base fabricator is not in ARGO_NOTE_08. It pours Synthesis Violet (METRIC_COLOURS.all, ARGO_NOTE_16 ruling 4) at 64/s for
 * 2.0 s (128 live, ruling 1) while it prints: printing is operating, so the pour follows the print state alone.
 */
export const FABRICATOR_PLUME: MachinePlumeSpec = {
  colour: '#b46bff', rate: 64, speed: 2.2, spread: 0.22, pixelSize: 0.11, gravity: -0.4, lifetime: 2.0, cadence: 'continuous',
};

/**
 * The fabricator's exhaust vent, in its station's frame (the frame stands on the 0.78 m ring). Found from renders of the model
 * (front and side, the shots of the T03P follow-up): the top of the frame, at the back, clear of the gantry beam.
 */
export const FABRICATOR_VENT: readonly [number, number, number] = [0, RING_TOP_Y + 5.0, -2.4];

/**
 * THE one number a kind's emitter pours: its steady count of live pixels (rate x lifetime at full run), times its run share
 * (0 when it does not operate, the plume's own tenths), times its cadence at time t. T15 multiplies this by the beat pulse.
 */
export function machinePlumeCountOf(s: MachinePlumeSpec, run: number, t: number): number {
  return Math.round(s.rate * s.lifetime * plumeShare(run) * plumeCadenceMultiplier(s.cadence, t));
}

export function machinePlumeCount(kind: MachineKind, run: number, t: number): number {
  return machinePlumeCountOf(MACHINE_PLUME_SPECS[kind], run, t);
}

/** A pour's steady live count, rate x lifetime at full run: the emitter's maxCount, so a count change never rebuilds its buffers. */
export function machinePlumeSteady(s: MachinePlumeSpec): number {
  return Math.round(s.rate * s.lifetime);
}

/**
 * The falling pours: the drill's slag sparks and the pylon's corona sparks on their own ballistic arcs (ARGO_NOTE_08), and the
 * presses' stamped-solid pours a small settle (ARGO_NOTE_17, ruling b, POL-282), all under the spec's gravity. The buoyant pours
 * (mill, projectors, water, power, fabricator and the heavies) rise straight, with no arc: gravity 0.
 */
const FALLING_KINDS: ReadonlySet<MachineKind> = new Set<MachineKind>(['drill', 'pylon', 'press', 'heavy-press']);
export function machinePlumeGravity(kind: MachineKind): number {
  return FALLING_KINDS.has(kind) ? MACHINE_PLUME_SPECS[kind].gravity : 0;
}

/**
 * The feed hoppers of the generated meshes, in each asset's own frame: the sockets the asset registry (apps/web/src/assets/gen/
 * registry.json) measures on each model, checked against close shots (T03P follow-up). The old raycast from the side missed the
 * funnels: it landed on the tank top.
 */
const GEN_FEED: Readonly<Record<'mill' | 'press' | 'water', readonly [number, number, number]>> = {
  mill: [0, 4.16, 0],
  press: [0, 4.26, 0],
  water: [3.05, 1.6, 0],
};
/**
 * The exhaust vents of the mill and the press, in the same frame: their measured side stacks (registry.json). The pixels pour from
 * here, so the top opening takes only the falling ore cubes (ARGO_NOTE_16 ruling 5).
 */
const GEN_VENT: Readonly<Record<'mill' | 'press', readonly [number, number, number]>> = {
  mill: [1.715, 2.28, -0.48],
  // POL-281 (ARGO_NOTE_17 ruling a): kept as measured; no side stack (0.77 m behind the chute is clearance enough)
  press: [0, 3.44, -0.56],
};
/** A measured socket in a generated mesh's frame. Each mesh's origin is its base, so a hardpoint machine adds the ring height. */
const genPoint = (p: readonly [number, number, number], base: number): THREE.Vector3 => new THREE.Vector3(p[0], p[1] + base, p[2]);

/** Ore cubes falling into a feed hopper: at most this many at full run, one drop cycle takes FEED_DROP_SEC. */
export const FEED_CUBES_FULL = 4;
export const FEED_DROP_SEC = 1.2;

/** How many feed cubes drop at this run (0 when the machine does not run). */
export function feedCubeCount(run: number): number {
  return Math.round(FEED_CUBES_FULL * plumeShare(run));
}

/** Where a feed cube is in its drop, 0 (at the top of the drop) to 1 (in the hopper): slot k of n, at time t. */
export function feedCubeProgress(t: number, slot: number, slots: number): number {
  const x = t / FEED_DROP_SEC + slot / Math.max(1, slots);
  return x - Math.floor(x);
}

const at = (sockets: readonly { readonly name: string; readonly at: readonly [number, number, number] }[], ...names: string[]): THREE.Vector3 | null => {
  for (const n of names) { const s = sockets.find((x) => x.name === n); if (s) return new THREE.Vector3(...s.at); }
  return null;
};

/** Finds vent location by raycasting down onto the machine mesh, or highest vertex cluster + 0.05m. */
export function findMachineVent(obj: THREE.Object3D, baseY: number, prefX = 0, prefZ = 0): THREE.Vector3 {
  obj.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(prefX, baseY + 12.0, prefZ),
    new THREE.Vector3(0, -1, 0),
    0,
    20
  );
  const hits = raycaster.intersectObject(obj, true);
  if (hits.length > 0 && hits[0]) {
    const p = hits[0].point;
    return new THREE.Vector3(p.x, p.y + 0.05, p.z);
  }
  let maxY = baseY;
  let topX = prefX;
  let topZ = prefZ;
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const pos = mesh.geometry.attributes.position;
      if (pos) {
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          v.applyMatrix4(mesh.matrixWorld);
          if (v.y > maxY) {
            maxY = v.y;
            topX = v.x;
            topZ = v.z;
          }
        }
      }
    }
  });
  return new THREE.Vector3(topX, maxY + 0.05, topZ);
}

/**
 * Stands a built prop at its real height (machineSize, OPUS_NOTE_09 / BB-09): one uniform scale, its base kept where
 * it was (the ground, or the 0.78 m ring for the heavies). The parts scale with it, and so do the sockets (power,
 * vent, top), which are in the prop's own frame. The scale sits on an inner group, so the caller's group keeps its
 * position and yaw.
 */
function fitToTable(p: MachineProp, kind: MachineKind): MachineProp {
  const target = machineSize(kind).h;
  const inner = new THREE.Group();
  inner.name = 'fit-to-table';
  for (const child of [...p.group.children]) inner.add(child);
  p.group.add(inner);
  p.group.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(p.group.matrixWorld).invert();
  const box = new THREE.Box3().setFromObject(inner).applyMatrix4(toGroup);
  const native = box.max.y - box.min.y;
  const s = native > 1e-6 ? target / native : 1;
  const lift = native > 1e-6 ? box.min.y * (1 - s) : 0;
  inner.scale.setScalar(s);
  inner.position.set(0, lift, 0);
  const scalePt = (v: THREE.Vector3): THREE.Vector3 => v.clone().multiplyScalar(s).add(new THREE.Vector3(0, lift, 0));

  // POL-39: Mount square emissive status LED on the housing surface anchor
  const anchorTuple = HOUSING_LED_ANCHOR[kind] ?? HOUSING_LED_ANCHOR.mill;
  const ledAnchor = new THREE.Vector3(anchorTuple[0], anchorTuple[1], anchorTuple[2]);
  const isHeavy = kind.startsWith('heavy-');
  const ledSize = isHeavy ? 0.18 : 0.13;
  const ledGeo = new THREE.BoxGeometry(ledSize, ledSize, 0.045);
  const ledMat = new THREE.MeshStandardMaterial({
    color: HOUSING_LED_COLOURS.unpowered,
    emissive: HOUSING_LED_COLOURS.unpowered,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  const statusLed = new THREE.Mesh(ledGeo, ledMat);
  statusLed.name = 'housing-status-led';
  statusLed.position.copy(ledAnchor);
  p.group.add(statusLed);

  let lastConnected = true;
  let lastSatisfaction = 1;

  const setStatusLed = (running: number, connected: boolean, satisfaction = 1, t = 0): void => {
    lastConnected = connected;
    lastSatisfaction = satisfaction;
    const st = housingLedState(running, connected, satisfaction, t);
    ledMat.color.set(st.colour);
    ledMat.emissive.set(st.colour);
    ledMat.emissiveIntensity = st.intensity;
    statusLed.userData.ledStatus = st.status;
  };

  const baseAnimate = p.animate;
  const baseLight = p.light;

  let edgeMesh: THREE.Mesh | null = null;
  let baseY: number | null = null;

  return {
    ...p,
    power: scalePt(p.power),
    vent: p.vent ? scalePt(p.vent) : null,
    feed: p.feed ? scalePt(p.feed) : null,
    top: p.top ? scalePt(p.top) : null,
    lamps: [...p.lamps, statusLed],
    statusLed,
    ledAnchor,
    animate(t, running) {
      baseAnimate(t, running);
      if (kind !== 'pylon') {
        setStatusLed(running, lastConnected, lastSatisfaction, t);
      }
    },
    light(glow) {
      baseLight(glow);
      if (glow > 0.5) {
        setStatusLed(1, true, 1, 0);
      } else if (glow > 0.05) {
        setStatusLed(0, true, 0.5, 0);
      } else {
        setStatusLed(0, false, 0, 0);
      }
    },
    setStatusLed,
    applyPrintSweep(clip: number, offsetM: number): void {
      if (baseY === null) baseY = p.group.position.y;
      p.group.position.y = baseY + offsetM;
      if (clip < 1.0) {
        inner.scale.set(s, Math.max(0.02, s * clip), s);
        if (!edgeMesh) {
          const edgeW = Math.max(1.2, (box.max.x - box.min.x) * s * 1.08);
          const edgeD = Math.max(1.2, (box.max.z - box.min.z) * s * 1.08);
          const edgeGeo = new THREE.BoxGeometry(edgeW, 0.05, edgeD);
          const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PRINT_EDGE_HEX), transparent: true, opacity: 0.95 });
          edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
          edgeMesh.name = 'print-sweep-edge';
          p.group.add(edgeMesh);
        }
        edgeMesh.position.set(0, target * clip, 0);
      } else {
        inner.scale.setScalar(s);
        if (edgeMesh) {
          p.group.remove(edgeMesh);
          edgeMesh.geometry.dispose();
          (edgeMesh.material as THREE.Material).dispose();
          edgeMesh = null;
        }
        baseY = null;
      }
    },
  };
}

/** The prop for a machine at a stage (0 or 1: chunky low poly; from 2: full detail), standing its real height (fitToTable). */
export function machineProp(m: lab.LabMaterials, kind: MachineKind, stage: number, genLevel: GenLevel = 'low'): MachineProp {
  return fitToTable(buildMachineProp(m, kind, stage, genLevel), kind);
}

function buildMachineProp(m: lab.LabMaterials, kind: MachineKind, stage: number, genLevel: GenLevel): MachineProp {
  const st = stage <= 1 ? 1 : 6;
  const still = (): void => undefined;
  const lift = new THREE.Vector3(0, RING_TOP_Y, 0);

  switch (kind) {
    case 'heavy-mill':
    case 'mill': {
      const gen = getGenSync('mill', genLevel);
      if (gen) {
        const group = new THREE.Group();
        group.name = `gen-${kind}`;
        const isHeavy = kind === 'heavy-mill';
        if (isHeavy) gen.position.copy(lift);
        group.add(gen);
        // the ore goes in at the top hopper; the pixels come out of the side stack (GEN_VENT, the measured socket: ARGO_NOTE_16 ruling 5)
        const base = isHeavy ? RING_TOP_Y : 0;
        const vent = genPoint(GEN_VENT.mill, base);
        const feed = genPoint(GEN_FEED.mill, base);
        const power = new THREE.Vector3(0, base + 0.2, -1.8);
        return {
          group,
          power,
          vent,
          feed,
          top: null,
          lamps: [],
          animate: still,
          light: still,
        };
      }
      if (kind === 'heavy-mill') {
        const p = basegear.heavyMill(m as any, { stage: st });
        p.group.position.y += RING_TOP_Y;
        const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0.1, -1.58);
        const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(1.715, 2.28, -0.48);
        const rawFeed = at(p.sockets, 'hopper', 'feed');
        return {
          group: p.group,
          power: rawPower.clone().add(lift),
          vent: rawVent.clone().add(lift),
          feed: rawFeed ? rawFeed.clone().add(lift) : findMachineVent(p.group, RING_TOP_Y, 0, 0.6),
          top: null,
          lamps: p.lamps,
          animate: still,
          light: (g) => p.lamps.forEach((l) => basegear.setLamp(l, g)),
        };
      }
      const p = consoleMillTextureMill(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'stack'), feed: at(p.sockets, 'hopper'), top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => setConsoleMillLamp(l, g)) };
    }
    case 'heavy-press':
    case 'press': {
      const frame = getGenSync('press-frame', genLevel);
      const ram1 = getGenSync('press-ram', genLevel);
      const ram2 = getGenSync('press-ram', genLevel);
      if (frame && ram1 && ram2) {
        const group = new THREE.Group();
        group.name = `gen-${kind}`;
        const isHeavy = kind === 'heavy-press';
        const baseY = isHeavy ? RING_TOP_Y : 0;
        frame.position.set(0, baseY, 0);
        group.add(frame);
        const restY = baseY + 2.1;
        ram1.position.set(-0.55, restY, 0);
        ram2.position.set(0.55, restY, 0);
        group.add(ram1, ram2);
        // the rock goes in at the top chute; the pixels come out of the measured side stack (GEN_VENT, ARGO_NOTE_16 ruling 5)
        const vent = genPoint(GEN_VENT.press, baseY);
        const feed = genPoint(GEN_FEED.press, baseY);
        const power = new THREE.Vector3(0, baseY + 0.2, 0.8);
        return {
          group,
          power,
          vent,
          feed,
          top: null,
          lamps: [],
          animate: (t, run) => {
            ram1.position.y = restY - Math.max(0, Math.sin(t * 3.1)) * 0.35 * run;
            ram2.position.y = restY - Math.max(0, Math.sin(t * 3.1 + Math.PI)) * 0.35 * run;
          },
          light: still,
        };
      }
      if (kind === 'heavy-press') {
        const p = heavygear.heavyPress(m as any, { stage: st });
        p.group.position.y += RING_TOP_Y;
        const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.76);
        const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 3.2, -0.56);
        const rawFeed = at(p.sockets, 'chute', 'hopper', 'feed') ?? new THREE.Vector3(0, 4.26, 0);
        const ram = p.parts?.ram;
        const restY = ram?.position.y ?? 0;
        return {
          group: p.group,
          power: rawPower.clone().add(lift),
          vent: rawVent.clone().add(lift),
          feed: rawFeed.clone().add(lift),
          top: null,
          lamps: p.lamps,
          animate: (t, run) => {
            if (ram) ram.position.y = restY - Math.max(0, Math.sin(t * 2.0)) * 0.6 * run;
          },
          light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
        };
      }
      const p = field.shapePress(m, { stage: st });
      const rest = p.rams.map((r) => r.position.y);
      return {
        group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), feed: at(p.sockets, 'feed'), top: null, lamps: p.lamps,
        animate: (t, run) => p.rams.forEach((r, i) => { r.position.y = rest[i]! - Math.max(0, Math.sin(t * 3.1 + i * Math.PI)) * 0.18 * run; }),
        light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)),
      };
    }
    case 'heavy-projector':
    case 'projector': {
      const mast = getGenSync('projector-mast', genLevel);
      const head = getGenSync('projector-head', genLevel);
      if (mast && head) {
        const group = new THREE.Group();
        group.name = `gen-${kind}`;
        const isHeavy = kind === 'heavy-projector';
        const baseY = isHeavy ? RING_TOP_Y : 0;
        mast.position.set(0, baseY, 0);
        group.add(mast);
        const restY = baseY + 2.65;
        head.position.set(0, restY, 0);
        group.add(head);
        const vent = findMachineVent(group, baseY, 0, 0);
        const power = new THREE.Vector3(0, baseY + 0.2, 0.8);
        return {
          group,
          power,
          vent,
          feed: null,
          top: null,
          lamps: [],
          animate: (t, run) => {
            head.rotation.x = Math.sin(t * 0.35) * 0.08 * run;
          },
          light: still,
        };
      }
      if (kind === 'heavy-projector') {
        const p = heavygear.heavyProjector(m as any, { stage: st });
        p.group.position.y += RING_TOP_Y;
        const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.6);
        const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 4.1, -0.66);
        const head = p.parts?.head;
        const restRotX = head?.rotation.x ?? 0;
        return {
          group: p.group,
          power: rawPower.clone().add(lift),
          vent: rawVent.clone().add(lift),
          feed: null,
          top: null,
          lamps: p.lamps,
          animate: (t, run) => {
            if (head) head.rotation.x = restRotX + Math.sin(t * 0.35) * 0.08 * run;
          },
          light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
        };
      }
      const p = field.lightProjector(m, { stage: st });
      const tilt = p.head.rotation.x;
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), feed: null, top: null, lamps: p.lamps, animate: (t, run) => { p.head.rotation.x = tilt + Math.sin(t * 0.35) * 0.08 * run; }, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'heavy-water':
    case 'water': {
      const gen = getGenSync('watermaker', genLevel);
      if (gen) {
        const group = new THREE.Group();
        group.name = `gen-${kind}`;
        const isHeavy = kind === 'heavy-water';
        const baseY = isHeavy ? RING_TOP_Y : 0;
        gen.position.set(0, baseY, 0);
        group.add(gen);
        // sheet 12: the ore comes in at the side screw, the cyan pixels out of the top-rear vent
        const vent = findMachineVent(gen, baseY, 0, -0.6);
        const feed = genPoint(GEN_FEED.water, baseY);
        const power = new THREE.Vector3(0, baseY + 0.2, 0.8);
        return {
          group,
          power,
          vent,
          feed,
          top: null,
          lamps: [],
          animate: still,
          light: still,
        };
      }
      if (kind === 'heavy-water') {
        const p = heavygear.heavyWater(m as any, { stage: st });
        p.group.position.y += RING_TOP_Y;
        const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.6);
        const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 3.155, -0.58);
        const rawFeed = at(p.sockets, 'hopper', 'feed') ?? new THREE.Vector3(1.4, 1.6, 0);
        return {
          group: p.group,
          power: rawPower.clone().add(lift),
          vent: rawVent.clone().add(lift),
          feed: rawFeed.clone().add(lift),
          top: null,
          lamps: p.lamps,
          animate: still,
          light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
        };
      }
      const p = field.waterMaker(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), feed: at(p.sockets, 'feed'), top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'drill': {
      // the drill takes no ore in (its ore leaves at the tray, sheet 12): no feed hopper; its dim wisp comes from the rear stack
      const p = field.rockDrill(m, { stage: st });
      const vent = at(p.sockets, 'vent', 'exhaust') ?? findMachineVent(p.group, 0, 0, -0.25);
      return { group: p.group, power: at(p.sockets, 'power')!, vent, feed: null, top: null, lamps: p.lamps, animate: (t, run) => { p.bit.rotation.y = t * 9 * run; }, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'power': {
      // the power unit takes no ore in (ARGO_NOTE_16 ruling 3): no feed hopper, and its violet steam comes off the steam socket
      const p = field.powerUnit(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'out')!, vent: at(p.sockets, 'steam'), feed: null, top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'pylon': {
      // a pylon takes no material in: its corona sparks come off the top insulator, under load
      const p = field.relayPylon(m, { stage: st });
      const top = new THREE.Vector3(...p.top);
      return { group: p.group, power: at(p.sockets, 'box')!, vent: top.clone(), feed: null, top, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
  }
}

/** A sagging line between two pylons' tops (world points). */
export function lineSpan(m: lab.LabMaterials, a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh {
  return field.cableSpan(m, [a.x, a.y, a.z], [b.x, b.y, b.z], Math.max(0.4, a.distanceTo(b) * 0.035));
}

/** Frees a prop's geometry (its materials are shared, or its own lamps', which go with it). */
export function disposeProp(p: MachineProp): void {
  p.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    if (p.lamps.includes(mesh)) (mesh.material as THREE.Material).dispose();
  });
}

/**
 * POL-282 (ARGO_NOTE_17 Ruling #2): Per-machine plume gravity (m/s^2).
 */
export const MACHINE_PLUME_GRAVITY: Readonly<Record<MachineKind | 'fabricator', number>> = Object.freeze({
  drill: -3.6,
  pylon: -4.8,
  press: -0.65,
  'heavy-press': -0.75,
  mill: 0.35,
  'heavy-mill': 0.42,
  water: 0.55,
  'heavy-water': 0.65,
  projector: 0.70,
  'heavy-projector': 0.75,
  power: 0.40,
  fabricator: 0.30,
});
