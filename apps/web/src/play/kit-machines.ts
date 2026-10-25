/**
 * The eleven plot machines as from-scratch modular kits (JOB-08, TICKET-40 phase 2; `docs/argo/RULES.md` 8a).
 *
 * There is no generated `.glb` core behind any of them, no loader fallback and no positional shim: every machine is
 * `@hm/partgen` primitives on `@hm/kitspec` sockets, dressed in `@hm/matstack` presets and `lx:` light cartridges. The
 * same blueprint is used for all eleven and then varied three ways, which is what keeps them a family instead of eleven
 * snowflakes:
 *
 *  - the **scale** — a heavy is the same machine, one size up (the prop is fitted to `machineSize` anyway, so the kit is
 *    authored at its own design size and the scene's `fitToTable` makes it the real height);
 *  - the **subject** — what the machine is *for*: a hopper ore bed, a fabricator nozzle, a turbine core, a condenser
 *    tank. That is the one group that changes shape between kinds, because it is the one group that means something
 *    different on each machine;
 *  - the **motion** — the press's ram strikes (a `KitMotionSpec`, never a frame delta), the drill's spindle turns, the
 *    projector's head sways. A machine with nothing to move declares no motion at all.
 *
 * The five groups are assemblies, in the order `kit-groups.ts` reads them: `base` carries the skid and its levelers,
 * `structure` the frame and its roll-cage, `mechanism` the motor and the ram, `controls` the console the player and the
 * beam act on, `subject` the business end. Every group hangs on a socket of the group before it, so a machine is one
 * chain of declared mounts from the pad on the ground to the hopper in the air — which is exactly what
 * `studio.kit.audit` measures (0 loose ends, 0 colliding pairs, 0 unterminated pipes, every control reachable).
 *
 * Frame: metres, y up, the pad on the ground at y = 0, +z the working face (where the console and the hopper outlet are).
 */
import type { AssemblyDef, Kit, KitMotionSpec, PartDef, Placement, SocketDef } from '@hm/kitspec';
import type { MachineKind } from '@hm/plotsim';
import { DRILL_BIT_SPIN, HEAVY_PRESS_RAM_STROKE, PRESS_RAM_STROKE, PROJECTOR_HEAD_TILT } from './kit-motion-specs';

/** The assembly that is the whole machine (what `buildKitPreset`, the beam's overrides and the audit key on). */
export const MACHINE_PRESET = 'machine';

/** The material ids a machine kit draws with: the 4d trim palette, two `mat:` presets for the parts that earn them, and `lx:`. */
export const MACHINE_MATERIALS = Object.freeze({
  body: 'khaki-paint',
  steel: 'hull-steel',
  hardware: 'accent-hardware',
  hopper: 'hopper-slate',
  ore: 'mat:crushed-ore-bed',
  grille: 'mat:slatted-grille-steel',
  /** The status light's `lx:` cartridge: warm, steady, bright enough to read as a light and not as paint. */
  lamp: 'lx:2100:1.3:steady',
  /** The projector's emit face: a colder cartridge, so its own light is distinguishable from the console's. */
  emit: 'lx:6500:1.6:steady',
});

/** What a machine's subject group is: the parts that make it *this* machine rather than its neighbour. */
export type MachineSubject = 'hopper' | 'bed' | 'turbine' | 'nozzle' | 'tank';

/** One machine's blueprint variation. */
export interface MachineKitSpec {
  readonly kind: MachineKind;
  /** The part-id prefix: `mill-skid`, `mill-console`, ... so two machines never share a part id. */
  readonly prefix: string;
  readonly subject: MachineSubject;
  /** What the machine's moving part does while it runs, or null when nothing moves. */
  readonly motion: KitMotionSpec | null;
  /** True when the machine takes ore in through a feed hopper (the plot's `FEEDS` list). */
  readonly feed: boolean;
  /** True for the heavies: the same kit, one size up. */
  readonly heavy: boolean;
}

/**
 * The eleven kinds. The motion column is the plot's own `MACHINE_MOTION` table, read as kit data: only the drill, the
 * two presses and the two projectors have a moving part, and each moves exactly the part the plume cadence pulses on.
 */
export const MACHINE_KIT_SPECS: Readonly<Record<MachineKind, MachineKitSpec>> = Object.freeze({
  drill: { kind: 'drill', prefix: 'drill', subject: 'bed', motion: DRILL_BIT_SPIN, feed: false, heavy: false },
  mill: { kind: 'mill', prefix: 'mill', subject: 'hopper', motion: null, feed: true, heavy: false },
  pylon: { kind: 'pylon', prefix: 'pylon', subject: 'turbine', motion: null, feed: false, heavy: false },
  press: { kind: 'press', prefix: 'press', subject: 'bed', motion: PRESS_RAM_STROKE, feed: true, heavy: false },
  power: { kind: 'power', prefix: 'power', subject: 'turbine', motion: null, feed: false, heavy: false },
  projector: { kind: 'projector', prefix: 'projector', subject: 'nozzle', motion: PROJECTOR_HEAD_TILT, feed: false, heavy: false },
  water: { kind: 'water', prefix: 'water', subject: 'tank', motion: null, feed: true, heavy: false },
  'heavy-mill': { kind: 'heavy-mill', prefix: 'heavy-mill', subject: 'hopper', motion: null, feed: true, heavy: true },
  'heavy-press': { kind: 'heavy-press', prefix: 'heavy-press', subject: 'bed', motion: HEAVY_PRESS_RAM_STROKE, feed: true, heavy: true },
  'heavy-projector': { kind: 'heavy-projector', prefix: 'heavy-projector', subject: 'nozzle', motion: PROJECTOR_HEAD_TILT, feed: false, heavy: true },
  'heavy-water': { kind: 'heavy-water', prefix: 'heavy-water', subject: 'tank', motion: null, feed: true, heavy: true },
});

/** A part definition with its id baked in, so the blueprint below reads as a bill of materials. */
const part = (source: PartDef['source'], material: string, rank: PartDef['rank'], extra: Partial<PartDef> = {}): PartDef => ({
  source,
  material,
  rank,
  ...extra,
});

const param = (gen: string, params: Readonly<Record<string, number>>): PartDef['source'] => ({ kind: 'param', gen, params });

/** The pad's size and the deck heights the blueprint hangs everything off (metres, design size). */
export const MACHINE_BLUEPRINT = Object.freeze({
  pad: { width: 1.9, depth: 1.4, height: 0.12 },
  skid: { width: 1.6, depth: 1.15, height: 0.14 },
  /** The skid's top face: where the four group assemblies stand. */
  deck: 0.26,
  mounts: {
    structure: [0, 0.26, -0.36] as const,
    mechanism: [-0.42, 0.26, 0.06] as const,
    controls: [0.5, 0.26, 0.3] as const,
    subject: [-0.02, 0.26, 0.32] as const,
  },
  /** The tallest a light machine's kit stands (the gussets over the crown), in design units. */
  height: 1.83,
  postHeight: 1.15,
});

// ------------------------------------------------------------------ the groups

/** `base`: the pad, the skid and four leveling jacks. Everything above stands on the skid's top face. */
function baseAssembly(prefix: string): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const { pad, skid, mounts } = MACHINE_BLUEPRINT;
  const jacks = [0.86, -0.86].flatMap((x) => [0.6, -0.6].map((z) => ({ x, z })));
  const padSockets: Record<string, SocketDef> = {
    deck: { at: [0, pad.height, 0] },
    ...Object.fromEntries(jacks.map((j, i) => [`jack-${i}`, { at: [j.x, pad.height, j.z] as const }])),
  };
  const skidSockets: Record<string, SocketDef> = {
    structureMount: { at: [mounts.structure[0], skid.height, mounts.structure[2]] },
    mechanismMount: { at: [mounts.mechanism[0], skid.height, mounts.mechanism[2]] },
    controlsMount: { at: [mounts.controls[0], skid.height, mounts.controls[2]] },
    subjectMount: { at: [mounts.subject[0], skid.height, mounts.subject[2]] },
  };
  // the same four mounts in the base assembly's own frame (the skid stands one pad height up), which is the frame the
  // four group assemblies are placed in: a socket measured in the wrong frame hangs every group one pad too low
  const deck = pad.height + skid.height;
  const baseSockets: Record<string, SocketDef> = {
    structureMount: { at: [mounts.structure[0], deck, mounts.structure[2]] },
    mechanismMount: { at: [mounts.mechanism[0], deck, mounts.mechanism[2]] },
    controlsMount: { at: [mounts.controls[0], deck, mounts.controls[2]] },
    subjectMount: { at: [mounts.subject[0], deck, mounts.subject[2]] },
  };
  const children: Placement[] = [
    { ref: `${prefix}-pad`, key: 'pad' },
    { ref: `${prefix}-skid`, key: 'skid', on: { child: 0, socket: 'deck' } },
    ...jacks.map((_, i) => ({ ref: `${prefix}-leveler`, key: `leveler-${i}`, on: { child: 0, socket: `jack-${i}` }, rank: 2 as const })),
  ];
  const parts: Record<string, PartDef> = {
    [`${prefix}-pad`]: part(param('can', { width: pad.width, depth: pad.depth, height: pad.height, bevel: 0.012, baseBand: 0.02, bands: 1 }), MACHINE_MATERIALS.steel, 0, { sockets: padSockets }),
    [`${prefix}-skid`]: part(
      param('can', { width: skid.width, depth: skid.depth, height: skid.height, bevel: 0.01, baseBand: 0.03, bands: 1 }),
      MACHINE_MATERIALS.body,
      0,
      { sockets: skidSockets },
    ),
    [`${prefix}-leveler`]: part(param('bolt', { headWidth: 0.1, headHeight: 0.05, shankDia: 0.03, shankLength: 0.07, head: 1 }), MACHINE_MATERIALS.hardware, 2),
  };
  return { parts, assembly: { children, sockets: baseSockets } };
}

/**
 * `structure`: the rear frame — a rail on the deck, two square-section posts, a crown across them, two corner gussets,
 * a louvred bulkhead behind it and a protective cage bar over the top. Square sections throughout (the owner's rule),
 * and every part hung on a socket of the rail or the crown.
 */
function structureAssembly(prefix: string): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const POST_H = 1.15;
  const railSockets: Record<string, SocketDef> = {
    'post-l': { at: [-0.62, 0.12, 0] },
    'post-r': { at: [0.62, 0.12, 0] },
    'rear-grille': { at: [0, 0.12, -0.02] },
  };
  const postSockets: Record<string, SocketDef> = { crownSeat: { at: [0.62, POST_H, 0] } };
  const crownSockets: Record<string, SocketDef> = {
    'gusset-l': { at: [-0.62, 0.12, 0] },
    'gusset-r': { at: [0.62, 0.12, 0] },
    'cage-bar': { at: [0, 0.12, 0] },
  };
  const parts: Record<string, PartDef> = {
    [`${prefix}-frame-rail`]: part(param('beam', { length: 1.4, section: 0.12, wall: 0.06 }), MACHINE_MATERIALS.steel, 0, { sockets: railSockets }),
    [`${prefix}-post-l`]: part(param('can', { width: 0.12, depth: 0.12, height: POST_H, bevel: 0, baseBand: 0.02, bands: 1 }), MACHINE_MATERIALS.steel, 0, { sockets: postSockets }),
    [`${prefix}-post-r`]: part(param('can', { width: 0.12, depth: 0.12, height: POST_H, bevel: 0, baseBand: 0.02, bands: 1 }), MACHINE_MATERIALS.steel, 0, { sockets: postSockets }),
    [`${prefix}-crown`]: part(param('beam', { length: 1.4, section: 0.12, wall: 0.06 }), MACHINE_MATERIALS.steel, 0, { sockets: crownSockets }),
    [`${prefix}-gusset-l`]: part(param('bracket', { width: 0.12, upright: 0.18, foot: 0.1, thickness: 0.016, gusset: 1 }), MACHINE_MATERIALS.hardware, 2),
    [`${prefix}-gusset-r`]: part(param('bracket', { width: 0.12, upright: 0.18, foot: 0.1, thickness: 0.016, gusset: 1 }), MACHINE_MATERIALS.hardware, 2),
    [`${prefix}-rear-grille`]: part(param('grille', { width: 1.06, height: 1.0, depth: 0.05, frame: 0.04, slats: 6, slat: 0.02 }), MACHINE_MATERIALS.grille, 1),
    [`${prefix}-cage-bar`]: part(param('duct', { length: 0.9, section: 0.1, wall: 0.05, flange: 0.02 }), MACHINE_MATERIALS.steel, 1),
  };
  const children: Placement[] = [
    { ref: `${prefix}-frame-rail`, key: 'frame-rail' },
    { ref: `${prefix}-post-l`, key: 'post-l', on: { child: 0, socket: 'post-l' } },
    { ref: `${prefix}-post-r`, key: 'post-r', on: { child: 0, socket: 'post-r' } },
    { ref: `${prefix}-crown`, key: 'crown', on: { child: 1, socket: 'crownSeat' } },
    { ref: `${prefix}-gusset-l`, key: 'gusset-l', on: { child: 3, socket: 'gusset-l' } },
    { ref: `${prefix}-gusset-r`, key: 'gusset-r', on: { child: 3, socket: 'gusset-r' } },
    { ref: `${prefix}-rear-grille`, key: 'rear-grille', on: { child: 0, socket: 'rear-grille' }, rot: [0, 180, 0] },
    { ref: `${prefix}-cage-bar`, key: 'cage-bar', on: { child: 3, socket: 'cage-bar' }, rot: [0, 90, 0] },
  ];
  return { parts, assembly: { children } };
}

/**
 * A kit ram rises off the motor's top face, so its travel is what the frame leaves and not what the legacy prop's
 * crown-hung ram was given: the piston's rest sits 1.08 m up, the motor's crown is at 0.66 m, and this leaves 0.38 m of
 * travel with a 4 cm margin. The plot's cadence table still names the beat (rate and phase); only the throw is the kit's.
 */
const RAM_TRAVEL_MAX = 0.38;

const frameStroke = (spec: KitMotionSpec): KitMotionSpec => ({ ...spec, amplitude: Math.min(spec.amplitude, RAM_TRAVEL_MAX) });

/**
 * `mechanism`: the motor, its flywheel, the ram cylinder and the piston in it, the drive axle, the pump beside it, the
 * flywheel's guard and the head the machine works with. `motion` is bound to the head on exactly the kinds whose part
 * moves, and the ram's stroke is bound to the piston (a `KitMotionSpec`, so a scrub or a replay lands on the same pose).
 */
function mechanismAssembly(prefix: string, spec: MachineKitSpec): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const motorSockets: Record<string, SocketDef> = {
    flywheel: { at: [0, 0, 0.19] },
    // the cylinder stands on the motor's top face, so the ram's load reaches the deck through the motor
    cylinder: { at: [0, 0.4, -0.04] },
    axle: { at: [0, 0.06, -0.17] },
    pump: { at: [0.17, 0.4, 0.1] },
    // the hood sits over the wheel's crown rather than in front of it: the wheel is 0.4 m across
    guard: { at: [0, 0.4, 0.19] },
  };
  // the ram: the rod leaves the cylinder's top face, and the head the machine works with hangs off the rod's tip, so a
  // press's stroke moves the head with the ram and a drill's spin turns it about the same seat
  const cylinderSockets: Record<string, SocketDef> = { rod: { at: [0, 0.42, 0] } };
  const pistonSockets: Record<string, SocketDef> = { tip: { at: [0, 0.34, 0] } };
  const ramMotion = spec.motion?.kind === 'reciprocate' ? frameStroke(spec.motion) : null;
  const headMotion = spec.motion && spec.motion.kind !== 'reciprocate' ? spec.motion : null;
  const parts: Record<string, PartDef> = {
    [`${prefix}-drive-motor`]: part(param('can', { width: 0.36, depth: 0.34, height: 0.4, bevel: 0.02, baseBand: 0.03, bands: 1 }), MACHINE_MATERIALS.body, 0, { sockets: motorSockets }),
    [`${prefix}-flywheel`]: part(param('wheel', { radius: 0.2, width: 0.15, hubRadius: 0.08, treadDepth: 0.012, lugs: 8 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-ram-cylinder`]: part(param('can', { width: 0.2, depth: 0.2, height: 0.42, bevel: 0.006, baseBand: 0.02, bands: 2 }), MACHINE_MATERIALS.steel, 0, { sockets: cylinderSockets }),
    [`${prefix}-ram-piston`]: part(param('pipe', { radius: 0.05, length: 0.34, armLength: 0.12, elbow: 1, sides: 8, flangeWidth: 0.03 }), MACHINE_MATERIALS.hardware, 1, { sockets: pistonSockets, ...(ramMotion ? { motion: ramMotion } : {}) }),
    [`${prefix}-drive-axle`]: part(param('beam', { length: 0.72, section: 0.09, wall: 0.045 }), MACHINE_MATERIALS.steel, 1),
    [`${prefix}-piston-pump`]: part(param('pipe', { radius: 0.04, length: 0.3, armLength: 0.1, elbow: 0, sides: 8, flangeWidth: 0.025 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-flywheel-guard`]: part(param('louvre', { width: 0.3, height: 0.36, hoodDepth: 0.05, flange: 0.02, slats: 5 }), MACHINE_MATERIALS.grille, 1),
    [`${prefix}-work-head`]: part(param('duct', { length: 0.2, section: 0.08, wall: 0.04, flange: 0.015 }), MACHINE_MATERIALS.hardware, 1, headMotion ? { motion: headMotion } : {}),
  };
  const children: Placement[] = [
    { ref: `${prefix}-drive-motor`, key: 'drive-motor' },
    { ref: `${prefix}-flywheel`, key: 'flywheel', on: { child: 0, socket: 'flywheel' } },
    { ref: `${prefix}-ram-cylinder`, key: 'ram-cylinder', on: { child: 0, socket: 'cylinder' } },
    { ref: `${prefix}-ram-piston`, key: 'ram-piston', on: { child: 2, socket: 'rod' } },
    { ref: `${prefix}-drive-axle`, key: 'drive-axle', on: { child: 0, socket: 'axle' } },
    { ref: `${prefix}-piston-pump`, key: 'piston-pump', on: { child: 0, socket: 'pump' } },
    { ref: `${prefix}-flywheel-guard`, key: 'flywheel-guard', on: { child: 0, socket: 'guard' } },
    { ref: `${prefix}-work-head`, key: 'work-head', on: { child: 3, socket: 'tip' } },
  ];
  return { parts, assembly: { children } };
}

/**
 * `controls`: the console a person stands at — a breaker lever, a valve handwheel, a gauge screen, two cartridge ports
 * joined by a short conduit, and the status light the plot's telemetry drives. Every one of them is a face with a
 * declared socket, so the beam can name it (and the audit's 24 rays can prove it is reachable).
 */
function controlsAssembly(prefix: string): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const consoleSockets: Record<string, SocketDef> = {
    lever: { at: [0, 0.95, 0.04] },
    valve: { at: [-0.09, 0.58, 0.15] },
    gauge: { at: [0.07, 0.82, 0.15] },
    'port-a': { at: [0.1, 0.3, 0.15] },
    'port-b': { at: [-0.1, 0.3, 0.15] },
    lamp: { at: [0, 0.95, -0.06] },
    hose: { at: [0, 0.36, 0.2] },
  };
  const parts: Record<string, PartDef> = {
    [`${prefix}-console`]: part(param('can', { width: 0.34, depth: 0.3, height: 0.95, bevel: 0.02, baseBand: 0.03, bands: 2 }), MACHINE_MATERIALS.body, 0, { sockets: consoleSockets }),
    [`${prefix}-breaker-lever`]: part(param('handle', { span: 0.12, reach: 0.1, thickness: 0.008, gripWidth: 0.03, mode: 0 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-valve-handle`]: part(param('bolt', { headWidth: 0.16, headHeight: 0.04, shankDia: 0.03, shankLength: 0.08, head: 1 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-gauge-screen`]: part(param('grille', { width: 0.2, height: 0.12, depth: 0.03, frame: 0.015, slats: 3, slat: 0.012 }), MACHINE_MATERIALS.grille, 1),
    [`${prefix}-cartridge-port-a`]: part(param('can', { width: 0.12, depth: 0.05, height: 0.12, bevel: 0.004, baseBand: 0.01, bands: 1 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-cartridge-port-b`]: part(param('can', { width: 0.12, depth: 0.05, height: 0.12, bevel: 0.004, baseBand: 0.01, bands: 1 }), MACHINE_MATERIALS.hardware, 1),
    [`${prefix}-status-lamp`]: part(param('lamp', { width: 0.1, height: 0.07, depth: 0.05, bezel: 0.015, visor: 0, guards: 0 }), MACHINE_MATERIALS.lamp, 1),
    [`${prefix}-control-hose`]: part(param('conduit', { length: 0.2, width: 0.03, height: 0.03, clips: 1, glandLength: 0.03 }), MACHINE_MATERIALS.hardware, 2),
  };
  const children: Placement[] = [
    { ref: `${prefix}-console`, key: 'console' },
    { ref: `${prefix}-breaker-lever`, key: 'breaker-lever', on: { child: 0, socket: 'lever' } },
    { ref: `${prefix}-valve-handle`, key: 'valve-handle', on: { child: 0, socket: 'valve' } },
    { ref: `${prefix}-gauge-screen`, key: 'gauge-screen', on: { child: 0, socket: 'gauge' } },
    { ref: `${prefix}-cartridge-port-a`, key: 'cartridge-port-a', on: { child: 0, socket: 'port-a' } },
    { ref: `${prefix}-cartridge-port-b`, key: 'cartridge-port-b', on: { child: 0, socket: 'port-b' } },
    { ref: `${prefix}-status-lamp`, key: 'status-lamp', on: { child: 0, socket: 'lamp' } },
    { ref: `${prefix}-control-hose`, key: 'control-hose', on: { child: 0, socket: 'hose' } },
  ];
  return { parts, assembly: { children } };
}

/**
 * `subject`: the riser on the deck and, on top of it, the parts that make the machine's product. One variant per kind
 * group, and each variant is a complete, self-contained set on the riser's own sockets:
 *  - `hopper` — a hopper, its ore bed and a screen: ore in at the top, out through the chute socket;
 *  - `bed` — an open ore bed with the hopper above it, for the machines that strike or drill;
 *  - `turbine` — a turbine core with its impeller and a coil stack, for the power machines and the pylon;
 *  - `nozzle` — a chamber and the fabricator nozzle, for the projectors;
 *  - `tank` — a condenser tank and its coil, for the water makers.
 */
function subjectAssembly(prefix: string, spec: MachineKitSpec): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const riserSockets: Record<string, SocketDef> = {
    hopper: { at: [0, 0.6, 0.22] },
    core: { at: [0, 0.6, -0.18] },
    nozzle: { at: [0, 0.5, 0.15] },
    cowl: { at: [0, 0.2, 0.15] },
    coil: { at: [-0.15, 0.2, 0] },
  };
  const hopperSockets: Record<string, SocketDef> = { bed: { at: [0, 0.42, 0] }, outlet: { at: [0, 0.02, 0.26] } };
  const coreSockets: Record<string, SocketDef> = { hub: { at: [0, 0.34, 0] } };
  const nozzleSockets: Record<string, SocketDef> = { tip: { at: [0.11, 0.05, 0] } };
  const parts: Record<string, PartDef> = {
    [`${prefix}-subject-riser`]: part(param('can', { width: 0.3, depth: 0.3, height: 0.6, bevel: 0.01, baseBand: 0.03, bands: 2 }), MACHINE_MATERIALS.body, 0, { sockets: riserSockets }),
    [`${prefix}-subject-cowl`]: part(param('louvre', { width: 0.26, height: 0.2, hoodDepth: 0.04, flange: 0.015, slats: 4 }), MACHINE_MATERIALS.grille, 1),
  };
  const children: Placement[] = [
    { ref: `${prefix}-subject-riser`, key: 'subject-riser' },
    { ref: `${prefix}-subject-cowl`, key: 'subject-cowl', on: { child: 0, socket: 'cowl' } },
  ];
  const addHopper = (): void => {
    parts[`${prefix}-subject-hopper`] = part(
      param('hopper', { topWidth: 0.52, topDepth: 0.44, bottomWidth: 0.22, bottomDepth: 0.22, height: 0.42, rimHeight: 0.05, wall: 0.02, shape: 0 }),
      MACHINE_MATERIALS.hopper,
      0,
      { sockets: hopperSockets },
    );
    children.push({ ref: `${prefix}-subject-hopper`, key: 'subject-hopper', on: { child: 0, socket: 'hopper' } });
    parts[`${prefix}-subject-ore-bed`] = part(param('clamp', { width: 0.4, length: 0.3, thickness: 0.024, bridgeHeight: 0.012, ribs: 1 }), MACHINE_MATERIALS.ore, 1);
    children.push({ ref: `${prefix}-subject-ore-bed`, key: 'subject-ore-bed', on: { child: 2, socket: 'bed' } });
  };
  switch (spec.subject) {
    case 'hopper': {
      addHopper();
      parts[`${prefix}-subject-nozzle`] = part(param('duct', { length: 0.3, section: 0.1, wall: 0.05, flange: 0.015 }), MACHINE_MATERIALS.hardware, 1);
      children.push({ ref: `${prefix}-subject-nozzle`, key: 'subject-nozzle', on: { child: 0, socket: 'nozzle' } });
      break;
    }
    case 'bed': {
      addHopper();
      parts[`${prefix}-subject-chute`] = part(param('chute', { width: 0.18, length: 0.44, drop: 0.34, cheekHeight: 0.05, wall: 0.015 }), MACHINE_MATERIALS.ore, 1);
      children.push({ ref: `${prefix}-subject-chute`, key: 'subject-chute', on: { child: 2, socket: 'outlet' } });
      parts[`${prefix}-subject-nozzle`] = part(param('duct', { length: 0.3, section: 0.1, wall: 0.05, flange: 0.015 }), MACHINE_MATERIALS.hardware, 1);
      children.push({ ref: `${prefix}-subject-nozzle`, key: 'subject-nozzle', on: { child: 0, socket: 'nozzle' } });
      break;
    }
    case 'turbine': {
      parts[`${prefix}-subject-core`] = part(param('tank', { radius: 0.15, length: 0.34, axis: 0, sides: 8, capLength: 0.04, ribs: 2, ribHeight: 0.012 }), MACHINE_MATERIALS.steel, 0, { sockets: coreSockets });
      children.push({ ref: `${prefix}-subject-core`, key: 'subject-core', on: { child: 0, socket: 'core' } });
      parts[`${prefix}-subject-impeller`] = part(param('wheel', { radius: 0.2, width: 0.15, hubRadius: 0.08, treadDepth: 0.008, lugs: 8 }), MACHINE_MATERIALS.hardware, 1);
      children.push({ ref: `${prefix}-subject-impeller`, key: 'subject-impeller', on: { child: 2, socket: 'hub' } });
      parts[`${prefix}-subject-coil`] = part(param('pipe', { radius: 0.045, length: 0.34, armLength: 0.1, elbow: 1, sides: 8, flangeWidth: 0.025 }), MACHINE_MATERIALS.ore, 2);
      children.push({ ref: `${prefix}-subject-coil`, key: 'subject-coil', on: { child: 0, socket: 'coil' } });
      break;
    }
    case 'nozzle': {
      parts[`${prefix}-subject-chamber`] = part(param('tank', { radius: 0.15, length: 0.3, axis: 0, sides: 8, capLength: 0.04, ribs: 2, ribHeight: 0.012 }), MACHINE_MATERIALS.steel, 0);
      children.push({ ref: `${prefix}-subject-chamber`, key: 'subject-chamber', on: { child: 0, socket: 'core' } });
      parts[`${prefix}-subject-nozzle`] = part(param('duct', { length: 0.3, section: 0.1, wall: 0.05, flange: 0.015 }), MACHINE_MATERIALS.hardware, 1, { sockets: nozzleSockets });
      children.push({ ref: `${prefix}-subject-nozzle`, key: 'subject-nozzle', on: { child: 0, socket: 'nozzle' } });
      parts[`${prefix}-subject-emitter`] = part(param('lamp', { width: 0.1, height: 0.08, depth: 0.04, bezel: 0.012, visor: 0, guards: 0 }), MACHINE_MATERIALS.emit, 1);
      children.push({ ref: `${prefix}-subject-emitter`, key: 'subject-emitter', on: { child: 3, socket: 'tip' } });
      break;
    }
    case 'tank': {
      parts[`${prefix}-subject-core`] = part(param('tank', { radius: 0.15, length: 0.38, axis: 0, sides: 8, capLength: 0.04, ribs: 2, ribHeight: 0.012 }), MACHINE_MATERIALS.steel, 0);
      children.push({ ref: `${prefix}-subject-core`, key: 'subject-core', on: { child: 0, socket: 'core' } });
      parts[`${prefix}-subject-condenser`] = part(param('pipe', { radius: 0.05, length: 0.36, armLength: 0.12, elbow: 1, sides: 8, flangeWidth: 0.03 }), MACHINE_MATERIALS.ore, 2);
      children.push({ ref: `${prefix}-subject-condenser`, key: 'subject-condenser', on: { child: 0, socket: 'coil' } });
      parts[`${prefix}-subject-nozzle`] = part(param('duct', { length: 0.3, section: 0.1, wall: 0.05, flange: 0.015 }), MACHINE_MATERIALS.hardware, 1);
      children.push({ ref: `${prefix}-subject-nozzle`, key: 'subject-nozzle', on: { child: 0, socket: 'nozzle' } });
      break;
    }
  }
  return { parts, assembly: { children } };
}

// ------------------------------------------------------------------ the preset

/** Where a machine's exposed sockets are (the plot asks for these by name, exactly as it did for the generated cores). */
function machineSockets(spec: MachineKitSpec): Record<string, SocketDef> {
  const m = MACHINE_BLUEPRINT.mounts;
  const deck = MACHINE_BLUEPRINT.deck;
  const sockets: Record<string, SocketDef> = {
    // the console's right-hand face: where the power cable comes in
    power: { at: [m.controls[0] + 0.18, deck + 0.06, m.controls[2]] },
    // the subject's business end: where the pixels pour from
    vent: { at: [m.subject[0], deck + 0.56, m.subject[2] + 0.2] },
    // the frame's crown: what a pylon's spans hang on, and the highest declared point of the machine
    top: { at: [0, deck + 0.12 + MACHINE_BLUEPRINT.postHeight + 0.12, m.structure[2]] },
    // the console's status light: the plot's telemetry drives this lamp, on a declared socket rather than a ray search
    statusLed: { at: [m.controls[0] - 0.12, deck + 0.89, m.controls[2] + 0.15] },
    // the subject's nozzle tip: what a Light cartridge aims at on a projector
    emit: { at: [m.subject[0], deck + 0.55, m.subject[2] + 0.15] },
  };
  if (spec.feed) sockets.feed = { at: [m.subject[0], deck + 1.02, m.subject[2] + 0.22] };
  return sockets;
}

/** The machine's `machine` assembly: five groups, hung on the base's own mount sockets, in taxonomy order. */
function machineAssembly(spec: MachineKitSpec): AssemblyDef {
  const children: Placement[] = [
    { ref: 'base', key: 'base' },
    { ref: 'structure', key: 'structure', on: { child: 0, socket: 'structureMount' } },
    { ref: 'mechanism', key: 'mechanism', on: { child: 0, socket: 'mechanismMount' } },
    { ref: 'controls', key: 'controls', on: { child: 0, socket: 'controlsMount' } },
    { ref: 'subject', key: 'subject', on: { child: 0, socket: 'subjectMount' } },
  ];
  return { children, sockets: machineSockets(spec) };
}

/** One machine's kit: the five group assemblies and the preset that places them. */
export function machineKit(spec: MachineKitSpec): Kit {
  const base = baseAssembly(spec.prefix);
  const structure = structureAssembly(spec.prefix);
  const mechanism = mechanismAssembly(spec.prefix, spec);
  const controls = controlsAssembly(spec.prefix);
  const subject = subjectAssembly(spec.prefix, spec);
  return {
    parts: { ...base.parts, ...structure.parts, ...mechanism.parts, ...controls.parts, ...subject.parts },
    assemblies: {
      [MACHINE_PRESET]: machineAssembly(spec),
      base: base.assembly,
      structure: structure.assembly,
      mechanism: mechanism.assembly,
      controls: controls.assembly,
      subject: subject.assembly,
    },
  };
}

/** Every machine's kit, by kind. Built once: the same kind always gives the same kit, in the same order. */
export const MACHINE_KITS: Readonly<Record<MachineKind, Kit>> = Object.freeze(
  Object.fromEntries(Object.entries(MACHINE_KIT_SPECS).map(([kind, spec]) => [kind, machineKit(spec as MachineKitSpec)])) as Record<MachineKind, Kit>,
);

/** The spec a kind was built from. */
export function machineKitSpec(kind: MachineKind): MachineKitSpec {
  return MACHINE_KIT_SPECS[kind];
}
