// Each machine of the plot (`@hm/plotsim`) as a prop, built from its own `@hm/kitspec` kit (JOB-08): 100% `@hm/partgen`
// geometry on declared sockets, five group assemblies, no generated model and no fallback. Where its power comes in, where
// its pixels come out, and the parts that move while it runs are read off the kit, not measured.
import * as THREE from 'three';
import * as field from '@hm/fieldkit';
import * as lab from '@hm/labkit';
import { flatten, maxRank, presetBounds, presetSockets, type Kit, type KitMotionSpec, type Overrides } from '@hm/kitspec';
import type { MachineKind, Metric } from '@hm/plotsim';
import type { GenLevel } from '../assets/gen';
import { machineSize } from '../base/machine-inspect';
import { plumeShare } from './brownout-visual';
import { buildKitPreset, type KitBuild } from './kit-build';
import { MACHINE_BLUEPRINT, MACHINE_KITS, MACHINE_PRESET } from './kit-machines';
import { kitLayering } from './layered-material';
import { plotKitMaterials, plotResolve } from './plot-kits';
import { tierOfLevel } from './kit-machine';
import { driveMotion, driven, type DrivenPart } from './machine-motion';
import { evaluateKitMotion } from '@hm/kinematic';
import { HOUSING_LED_BLINK, RAM_CADENCE_RAD } from './kit-motion-specs';

export type MachineLedStatus = 'running' | 'warn' | 'unpowered';

export const HOUSING_LED_COLOURS: Readonly<Record<MachineLedStatus, string>> = {
  running: '#22c55e',   // Green: running with power & feed
  warn: '#f59e0b',      // Amber blink: no ore, idle, or brownout
  unpowered: '#ef4444', // Red: unpowered / disconnected
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
    // the blink is the same declarative spec the scene poses parts with, sampled at the stage's rate: 2 Hz, mostly on
    const blinkOn = evaluateKitMotion(HOUSING_LED_BLINK, timeSec, 1).rotOffset[1] >= -0.1;
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
   *  unit and a pylon take none (ARGO_NOTE_16 ruling 3). */
  readonly feed?: THREE.Vector3 | null;
  /** A pylon's line attachment, for the spans between pylons. */
  readonly top: THREE.Vector3 | null;
  readonly lamps: readonly THREE.Mesh[];
  /** Square emissive status LED mesh mounted on the housing (POL-39). */
  readonly statusLed?: THREE.Mesh;
  /** Housing LED anchor in the prop's frame (POL-39): the kit socket the light is bolted to. */
  readonly ledAnchor?: THREE.Vector3;
  /** Moves what moves while it runs (0..1 how hard it runs), t in seconds, on the Fidelity Stage's animation rate (plan 43:
   *  the same declarative spec at every stage; the pose is quantised to the stage, so S0 steps at 8 Hz and S6 runs smooth). */
  animate(t: number, running: number, stage?: number): void;
  /** Lights its lamps, 0..1. */
  light(glow: number): void;
  /** Updates the square housing status LED from live telemetry (POL-39). */
  setStatusLed?(running: number, connected: boolean, satisfaction?: number, t?: number): void;
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
    // ram-fast and ram-heavy are the rams' own strokes (kit-motion-specs): the pour pulses when the ram strikes
    case 'ram-fast':
      return Math.max(0.15, Math.sin(t * RAM_CADENCE_RAD.fast));
    case 'ram-heavy':
      return Math.max(0.15, Math.sin(t * RAM_CADENCE_RAD.heavy));
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
 * The kit a kind is built from, its preset, and how the prop fits it to the table. Every machine is 100% `@hm/partgen`
 * geometry placed by `@hm/kitspec` (JOB-08): no generated model, no fallback, no wrapper frame around a legacy mesh, so
 * a machine's silhouette, its parts and its sockets are the same thing at every stage and every tier — only the detail
 * rank changes which parts draw.
 */
const MACHINE_LAMP_PREFIX = 'kit:lx:';

/** How far the status light stands off the housing it is bolted to (metres, prop frame). */
const LED_STANDOFF = 0.02;

/**
 * The prop for a machine at a stage (0 or 1: chunky low poly; from 2: full detail), standing its real height. A kit-built
 * machine takes the beam's part overrides (plan 38: a printed part fitted onto a bolt or a panel).
 *
 * `m` (the lab's material record) is no longer read: a machine draws in the plot's kit palette, which the trim sheet and
 * the part swatches define. It stays in the signature because the plot's callers and the Studio bench pass it, and a
 * cartridge can still put any `mat:`/`lx:` material on any part through the kit's own slots.
 */
export function machineProp(_m: lab.LabMaterials, kind: MachineKind, stage: number, genLevel: GenLevel = 'low', overrides?: Overrides): MachineProp {
  return kitProp(kind, stage, genLevel, overrides);
}

/** The part a path hangs on (`mechanism/ram-piston` → `mechanism`), or null for a group assembly's own part. */
const parentPathOf = (path: string): string | null => {
  const i = path.lastIndexOf('/');
  return i < 0 ? null : path.slice(0, i);
};

/**
 * One machine, built from its kit.
 *
 * The static parts are merged by material and rank (a machine is a handful of draw calls at any detail). The parts a
 * `KitMotionSpec` moves are built as their own builds and hung on their rest matrices, so a ram's stroke, a bit's spin
 * or a projector head's sway moves real geometry instead of a merged mesh. A moving part that hangs on another moving
 * part (the work head on the ram's rod) is placed relative to it, so the stroke carries it and its own spin adds to it.
 *
 * The socket points and the fit are arithmetic on the kit's own bounds (`presetBounds`), not a measurement of the built
 * scene: the same kit always gives the same prop, and the prop is targetable (`build`) and auditable at rest.
 */
function kitProp(kind: MachineKind, stage: number, genLevel: GenLevel, overrides?: Overrides): MachineProp {
  const kit = MACHINE_KITS[kind];
  const preset = MACHINE_PRESET;
  const rank = maxRank(stage, tierOfLevel(genLevel));
  const materials = plotKitMaterials();
  const resolveMaterial = plotResolve(genLevel, rank);
  const placed = flatten(kit, preset, overrides);
  const moving = new Map<string, KitMotionSpec>();
  for (const p of placed) {
    const motion = kit.parts[p.part]?.motion;
    if (motion) moving.set(p.path, motion);
  }
  const options = {
    materials,
    // every part of a machine is a @hm/partgen primitive: there is no generated model to wait for
    gen: () => null,
    resolveMaterial,
    layering: kitLayering,
    maxRank: rank,
    ...(overrides ? { overrides } : {}),
  };
  const build = buildKitPreset(kit, preset, { ...options, skip: (path) => moving.has(path) });
  // a machine kit holds no generated part, so a build can only fail on a malformed kit: stand the machine up empty rather
  // than leave the plot without its machines
  const staticBuild = build ?? buildKitPreset({ parts: {}, assemblies: { [preset]: { children: [] } } }, preset, options);
  const inner = new THREE.Group();
  inner.name = `fixture:${kind}`;
  const group = new THREE.Group();
  group.name = `machine:${kind}`;
  if (staticBuild) inner.add(staticBuild.group);
  group.add(inner);

  // the fit: one uniform scale to the machine's real height, its base kept at the ground or on the hardpoint ring
  const bounds = presetBounds(kit, placed);
  const native = bounds ? bounds.max[1] - Math.min(0, bounds.min[1]) : 1;
  const scale = native > 1e-6 ? machineSize(kind).h / native : 1;
  const base = kind.startsWith('heavy-') ? RING_TOP_Y : 0;
  inner.scale.setScalar(scale);
  inner.position.y = base;
  const place = (v: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(v.x * scale, base + v.y * scale, v.z * scale);

  // the moving parts: each as its own build, on its rest matrix (relative to the moving part it hangs on)
  const rests = new Map<string, THREE.Matrix4>();
  for (const p of placed) rests.set(p.path, new THREE.Matrix4().fromArray(p.matrix as number[]));
  const holders = new Map<string, THREE.Object3D>();
  const bound: DrivenPart[] = [];
  for (const p of placed) {
    const motion = moving.get(p.path);
    if (!motion) continue;
    const def = kit.parts[p.part];
    if (!def) continue;
    const single: Kit = {
      parts: { [p.part]: { source: p.source, material: p.material, rank: p.rank } },
      assemblies: { [preset]: { children: [{ ref: p.part, key: 'part' }] } },
    };
    const one = buildKitPreset(single, preset, options);
    if (!one) continue;
    const holder = new THREE.Group();
    holder.name = `mover:${p.path}`;
    holder.add(one.group);
    const parent = parentPathOf(p.path);
    const rest = rests.get(p.path);
    const parentRest = parent ? rests.get(parent) : null;
    const local = parentRest && rest ? new THREE.Matrix4().multiplyMatrices(parentRest.clone().invert(), rest) : rest;
    if (local) {
      const at = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      local.decompose(at, quat, scl);
      holder.position.copy(at);
      holder.quaternion.copy(quat);
    }
    (parent ? holders.get(parent) ?? inner : inner).add(holder);
    holders.set(p.path, holder);
    bound.push(driven(holder, motion));
  }

  const sockets = presetSockets(kit, preset);
  const point = (name: string): THREE.Vector3 | null => {
    const s = sockets[name];
    return s ? place(new THREE.Vector3(s.at[0], s.at[1], s.at[2])) : null;
  };

  // its lamps are the meshes drawn with a light cartridge (`lx:`), each with its own material so a machine glows alone
  const lamps: THREE.Mesh[] = [];
  if (staticBuild) {
    for (const c of staticBuild.group.children) {
      if (!(c as THREE.Mesh).isMesh || !c.name.startsWith(MACHINE_LAMP_PREFIX)) continue;
      const lamp = c as THREE.Mesh;
      lamp.material = (lamp.material as THREE.Material).clone();
      lamps.push(lamp);
    }
  }
  for (const h of holders.values()) {
    h.traverse((c) => {
      if (!(c as THREE.Mesh).isMesh || !c.name.startsWith(MACHINE_LAMP_PREFIX)) return;
      const lamp = c as THREE.Mesh;
      lamp.material = (lamp.material as THREE.Material).clone();
      lamps.push(lamp);
    });
  }

  // POL-39: the status light on the housing's declared socket, facing out of it (the kit names the face; nothing floats)
  const ledAnchor = point('statusLed') ?? place(new THREE.Vector3(0, MACHINE_BLUEPRINT.deck + 0.8, MACHINE_BLUEPRINT.mounts.controls[2] + 0.15));
  const ledSize = kind.startsWith('heavy-') ? 0.18 : 0.13;
  const ledMat = new THREE.MeshStandardMaterial({
    color: HOUSING_LED_COLOURS.unpowered,
    emissive: HOUSING_LED_COLOURS.unpowered,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  const statusLed = new THREE.Mesh(new THREE.BoxGeometry(ledSize, ledSize, 0.045), ledMat);
  statusLed.name = 'housing-status-led';
  statusLed.position.copy(ledAnchor).add(new THREE.Vector3(0, 0, LED_STANDOFF));
  group.add(statusLed);

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
  const motion = driveMotion(bound);
  const setGlow = (glow: number): void => {
    const g = Math.max(0, Math.min(1, glow)) * 1.6;
    for (const l of lamps) {
      const m = l.material as THREE.MeshStandardMaterial;
      if ('emissiveIntensity' in m) m.emissiveIntensity = g;
    }
  };

  const prop: MachineProp & { readonly build: KitBuild } = {
    build: staticBuild!,
    group,
    power: point('power') ?? place(new THREE.Vector3(0, MACHINE_BLUEPRINT.deck, 0)),
    vent: point('vent'),
    feed: point('feed'),
    top: point('top'),
    lamps: [...lamps, statusLed],
    statusLed,
    ledAnchor,
    animate(t, running, stageAnim) {
      motion(t, running, stageAnim);
      if (kind !== 'pylon') setStatusLed(running, lastConnected, lastSatisfaction, t);
    },
    light(glow) {
      setGlow(glow);
      if (glow > 0.5) setStatusLed(1, true, 1, 0);
      else if (glow > 0.05) setStatusLed(0, true, 0.5, 0);
      else setStatusLed(0, false, 0, 0);
    },
    setStatusLed,
  };
  return prop;
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
