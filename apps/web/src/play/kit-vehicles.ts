/**
 * The three plot vehicles as from-scratch modular kits (JOB-08v; `docs/argo/RULES.md` 8a, `wheresryan22/anatomy`).
 *
 * There is no generated `.glb` hull behind any of them and no loader fallback: every part is an `@hm/partgen`
 * primitive (a `wheel`, a `track`, a `can`, a `beam`, a `pipe`, a `lamp`, a `conduit`) on an `@hm/kitspec` socket,
 * dressed in the `@hm/matstack` presets a vehicle earns (`mat:rubber-seal` tyres, `mat:field-worn-hazard` trim,
 * `mat:scorch-burn` cutter heads) and `lx:` light cartridges.
 *
 * Each vehicle is one preset of the five functional assemblies `kit-groups.ts` names, in its order: the `base` carries
 * the frame and the wheels and touches the ground, `structure` the body and its cage, `mechanism` the parts that move
 * on a `KitMotionSpec`, `controls` the faces a person and a Beam Rifle cartridge act on, and `subject` what the
 * vehicle is *for* — a tilting ore bed, a twin cutter head, a scanner dish.
 *
 * Two rules shape the geometry, and they are the ones `studio.kit.audit` measures:
 *
 *  1. **A part overlaps only its parent.** The clearance sweep exempts a declared joint, so everything that has to
 *     interpenetrate (a wheel on its hub, a rod in its gland) is a socket child of the thing it sits in, and parts
 *     that are not in that relation keep a gap. Where a group meets the base it *touches* it (0 mm) rather than
 *     sinking into it, because a group assembly's parts are the base's siblings, not its children.
 *  2. **A part reaches the ground through touching boxes.** `validate()` floats anything whose box chain does not
 *     reach y = 0, so every plate, cage bar and beacon sits on the face of the part under it.
 *
 * Frame: metres, y up, +z forward (the nose), the tyre and track bottoms on the ground at y = 0.
 */
import type { AssemblyDef, Kit, KitMotionSpec, PartDef, Placement, SocketDef } from '@hm/kitspec';

/** The assembly that is the whole vehicle (what `buildKitPreset`, the beam's overrides and the audit key on). */
export const VEHICLE_PRESET = 'vehicle';

/** The three vehicles, in the order the plot's garage lists them. */
export const VEHICLE_KINDS = Object.freeze(['hauler', 'crawler', 'scout'] as const);
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

/** What a vehicle's subject group is: the one group that means something different on each of the three. */
export type VehicleSubject = 'cargo-bed' | 'cutter-head' | 'scanner-mast';

/** One vehicle's blueprint variation. */
export interface VehicleKitSpec {
  readonly kind: VehicleKind;
  /** The part-id prefix, so two vehicles never share a part id. */
  readonly prefix: string;
  readonly subject: VehicleSubject;
  /** The envelope the kit is authored inside, in metres (the `gen-props` `VEHICLE_FIT` body it replaces). */
  readonly envelope: { readonly width: number; readonly height: number; readonly length: number };
  /** Where the wheels' hubs are, in the preset frame (the scene's wheel pivots, and what a drive test reads). */
  readonly hubs: readonly (readonly [number, number, number])[];
  /** The part count the anatomy standard expects of it. */
  readonly parts: { readonly min: number; readonly max: number };
}

/** A part definition with its id baked in, so the blueprint below reads as a bill of materials. */
const part = (source: PartDef['source'], material: string, rank: PartDef['rank'], extra: Partial<PartDef> = {}): PartDef => ({
  source,
  material,
  rank,
  ...extra,
});

const param = (gen: string, params: Readonly<Record<string, number>>): PartDef['source'] => ({ kind: 'param', gen, params });

const box = (size: readonly [number, number, number]): PartDef['source'] => ({ kind: 'box', size: [size[0], size[1], size[2]] });

/** A part hung on a socket of an earlier sibling in the same assembly (the only way a kit may interpenetrate). */
const on = (child: number, socket: string): Placement['on'] => ({ child, socket });

/** A round part's own axis, as a `KitMotionSpec` names it. */
const spin = (rateHz: number, axis: 'x' | 'y' | 'z' = 'x'): KitMotionSpec => ({ kind: 'spin', axis, rateHz, amplitude: 0 });
const sway = (rateHz: number, amplitude: number, axis: 'x' | 'y' | 'z'): KitMotionSpec => ({ kind: 'oscillate', axis, rateHz, amplitude });
const stroke = (rateHz: number, amplitude: number, axis: 'y' | 'z' | 'x' = 'y'): KitMotionSpec => ({ kind: 'reciprocate', axis, rateHz, amplitude });

// ============================================================================
// HAULER — the 6x6 articulated heavy transporter (40-55 parts)
// ============================================================================

/** The 4d trim palette plus the three `mat:` presets a working truck earns, and its one `lx:` cartridge. */
export const HAULER_MATERIALS = Object.freeze({
  body: 'khaki-paint',
  steel: 'hull-steel',
  hardware: 'accent-hardware',
  /** `rubber-grain` on the tyres: the tread is a generator feature, the grain is the skin. */
  tyre: 'mat:rubber-seal',
  /** The bed's high-contrast hazard trim (the owner's marker colour, so a load is visible from the cab). */
  hazard: 'mat:field-worn-hazard',
  /** The headlamp and beacon cartridges: warm tungsten at the nose, amber above the cab. */
  lamp: 'lx:2100:1.3:steady',
  beacon: 'lx:590:1.1:pulse',
});

/** The tyre the hauler rolls on: 1.10 m across, so its hub is 0.55 m up (the scene's `VEHICLE_FIT.hauler` radius). */
export const HAULER_WHEEL = Object.freeze({
  radius: 0.55,
  width: 0.52,
  hubRadius: 0.26,
  treadDepth: 0.03,
  lugs: 18,
});

/** The axles' z positions: front, middle, rear (the 6x6's three bogies). */
const HAULER_AXLES = Object.freeze([1.8, -0.6, -1.8]);

/**
 * `base`: the twin-rail chassis frame, its three axle bogies and the six wheels.
 *
 * The spine is the one wide part everything else is a child of, the rails hang off its flanks, each rail carries one
 * hub per axle and each hub carries its wheel — so the wheels are the frame's grandchildren and a wheel may sink into
 * its own hub and its own rail without ever touching a part that is not in that chain.
 */
function haulerBase(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'hauler';
  const spineSockets: Record<string, SocketDef> = {
    railLeft: { at: [-0.62, 0.02, 0] },
    railRight: { at: [0.62, 0.02, 0] },
  };
  const railSockets: Record<string, SocketDef> = Object.fromEntries(
    HAULER_AXLES.map((z, i) => [`hub${i}`, { at: [-0.14, -0.22, z] as const }]),
  );
  const hubSockets: Record<string, SocketDef> = { wheelMount: { at: [-0.32, -0.42, 0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-chassis-spine`]: part(box([1.12, 0.34, 5.1]), HAULER_MATERIALS.steel, 0, { sockets: spineSockets }),
    [`${P}-frame-rail`]: part(box([0.2, 0.24, 5.2]), HAULER_MATERIALS.body, 0, { sockets: railSockets }),
    [`${P}-axle-hub`]: part(param('can', { width: 0.26, depth: 0.3, height: 0.34, bevel: 0.02, baseBand: 0.05, bands: 1 }), HAULER_MATERIALS.hardware, 1, { sockets: hubSockets }),
    [`${P}-wheel`]: part(param('wheel', HAULER_WHEEL), HAULER_MATERIALS.tyre, 0),
  };
  const children: Placement[] = [
    { ref: `${P}-chassis-spine`, key: 'chassis-spine', at: [0, 0.62, 0] },
    { ref: `${P}-frame-rail`, key: 'rail-left', on: on(0, 'railLeft') },
    { ref: `${P}-frame-rail`, key: 'rail-right', on: on(0, 'railRight'), mirror: 'x' },
  ];
  // six hubs on the two rails, then the six wheels on them
  const hubKeys: string[] = [];
  for (let i = 0; i < HAULER_AXLES.length; i += 1) {
    for (const [side, rail] of [['l', 1], ['r', 2]] as const) {
      hubKeys.push(`hub-${i}${side}`);
      children.push({ ref: `${P}-axle-hub`, key: `hub-${i}${side}`, on: on(rail, `hub${i}`) });
    }
  }
  hubKeys.forEach((key, i) => {
    children.push({ ref: `${P}-wheel`, key: `wheel-${i}`, on: on(children.findIndex((c) => c.key === key), 'wheelMount') });
  });
  // the two group mounts the structure and the bed stand on, and the nose the controls hang off
  const sockets: Record<string, SocketDef> = {
    structureMount: { at: [0, 0.96, 1.3] },
    mechanismMount: { at: [0, 0.96, 0.1] },
    // the cab's front face, at wing height: the instrument binnacle and the headlamps stand proud of it
    controlsMount: { at: [0, 1.5, 2.15] },
    subjectMount: { at: [0, 0.96, -1.5] },
  };
  return { parts, assembly: { children, sockets } };
}

/**
 * `structure`: the armoured cab, its roll cage, the bulkhead behind it, the twin stacks and the two mudguards.
 *
 * The cab is the one tall box; everything else is hung on one of its faces, and the mudguards brush its underside so
 * each is a part of a chain that reaches the spine through the cab cradle rather than a panel floating over a wheel.
 */
function haulerStructure(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'hauler';
  const cabSockets: Record<string, SocketDef> = {
    postLeft: { at: [-0.62, 0.86, -0.3] },
    postRight: { at: [0.62, 0.86, -0.3] },
    rollBrace: { at: [0, 1.4, -0.3] },
    bulkhead: { at: [0, 0.34, -0.74] },
    stackLeft: { at: [-0.62, 0.86, 0.62] },
    stackRight: { at: [0.62, 0.86, 0.62] },
    // the mudguards hang from the cab's underside: a socket may sit below a face, and this one is what seats them
    mudguardLeft: { at: [-1.0, -0.08, -0.2] },
    mudguardRight: { at: [1.0, -0.08, -0.2] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-cab-cradle`]: part(param('can', { width: 1.3, depth: 1.55, height: 0.26, bevel: 0.03, baseBand: 0.05, bands: 1 }), HAULER_MATERIALS.hardware, 1, {
      sockets: { cabSeat: { at: [0, 0.26, 0] } },
    }),
    [`${P}-cab-shell`]: part(param('can', { width: 1.72, depth: 1.48, height: 0.86, bevel: 0.05, baseBand: 0.12, bands: 1 }), HAULER_MATERIALS.body, 0, { sockets: cabSockets }),
    [`${P}-roll-post`]: part(param('can', { width: 0.1, depth: 0.1, height: 0.54, bevel: 0.01, baseBand: 0.02, bands: 0 }), HAULER_MATERIALS.steel, 1),
    [`${P}-roll-brace`]: part(param('beam', { length: 1.44, section: 0.1, wall: 0.05 }), HAULER_MATERIALS.steel, 1),
    [`${P}-cab-bulkhead`]: part(param('can', { width: 1.3, depth: 0.1, height: 0.86, bevel: 0.02, baseBand: 0.04, bands: 1 }), HAULER_MATERIALS.steel, 1),
    [`${P}-exhaust-stack`]: part(param('pipe', { radius: 0.055, length: 0.7, armLength: 0.12, elbow: 0, sides: 10, flangeWidth: 0.03 }), HAULER_MATERIALS.hardware, 2),
    [`${P}-mudguard`]: part(param('can', { width: 0.56, depth: 1.9, height: 0.08, bevel: 0.02, baseBand: 0.02, bands: 0 }), HAULER_MATERIALS.steel, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-cab-cradle`, key: 'cab-cradle' },
    { ref: `${P}-cab-shell`, key: 'cab-shell', on: on(0, 'cabSeat') },
    { ref: `${P}-roll-post`, key: 'roll-post-left', on: on(1, 'postLeft') },
    { ref: `${P}-roll-post`, key: 'roll-post-right', on: on(1, 'postRight') },
    { ref: `${P}-roll-brace`, key: 'roll-brace', on: on(1, 'rollBrace') },
    { ref: `${P}-cab-bulkhead`, key: 'cab-bulkhead', on: on(1, 'bulkhead') },
    { ref: `${P}-exhaust-stack`, key: 'stack-left', on: on(1, 'stackLeft') },
    { ref: `${P}-exhaust-stack`, key: 'stack-right', on: on(1, 'stackRight') },
    { ref: `${P}-mudguard`, key: 'mudguard-left', on: on(1, 'mudguardLeft') },
    { ref: `${P}-mudguard`, key: 'mudguard-right', on: on(1, 'mudguardRight') },
  ];
  return { parts, assembly: { children } };
}

/**
 * `mechanism`: the yoke the working parts stand on, the two bed rams that lift and their one supply hose (which ends
 * flush on a port at each end), the steering bracket and its knuckle that steers, and the winch drum turning over the
 * bed. The drum is the rotating part the anatomy standard asks a mechanism for; its swept circle clears the deck it
 * turns above by a mast's height, because a wheel's origin is at its rim and a spin carries its box all the way round.
 */
function haulerMechanism(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'hauler';
  const yokeSockets: Record<string, SocketDef> = {
    ramLeft: { at: [-0.4, 0.16, 0.0] },
    ramRight: { at: [0.4, 0.16, 0.0] },
    manifold: { at: [-0.62, 0.16, 0.0] },
    steerBase: { at: [0, 0, 2.2] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-mechanism-yoke`]: part(param('can', { width: 1.3, depth: 0.26, height: 0.16, bevel: 0.02, baseBand: 0.03, bands: 1 }), HAULER_MATERIALS.hardware, 1, { sockets: yokeSockets }),
    [`${P}-dump-ram`]: part(param('can', { width: 0.18, depth: 0.2, height: 0.38, bevel: 0.02, baseBand: 0.03, bands: 2 }), HAULER_MATERIALS.steel, 1, {
      sockets: {
        rodPort: { at: [0, 0.38, 0] },
        // where the supply hose lands, on the cylinder's inboard face (flush, so the terminal check reads a port)
        portInlet: { at: [-0.095, 0.155, 0] },
      },
    }),
    [`${P}-dump-piston`]: part(param('pipe', { radius: 0.05, length: 0.26, armLength: 0.08, elbow: 0, sides: 8, flangeWidth: 0.025 }), HAULER_MATERIALS.hardware, 1, {
      motion: stroke(0.4, 0.12, 'y'),
    }),
    [`${P}-hydraulic-manifold`]: part(param('can', { width: 0.16, depth: 0.2, height: 0.3, bevel: 0.01, baseBand: 0.02, bands: 1 }), HAULER_MATERIALS.hardware, 2, {
      sockets: { portOutlet: { at: [-0.075, 0.155, 0] } },
    }),
    [`${P}-hydraulic-hose`]: part(param('conduit', { length: 0.21, width: 0.05, height: 0.05, clips: 1, glandLength: 0.03 }), HAULER_MATERIALS.hardware, 2),
    [`${P}-winch-post`]: part(param('can', { width: 0.14, depth: 0.14, height: 0.45, bevel: 0.01, baseBand: 0.02, bands: 1 }), HAULER_MATERIALS.steel, 2, {
      sockets: { drumSeat: { at: [0, 0.45, 0] } },
    }),
    [`${P}-winch-drum`]: part(param('wheel', { radius: 0.2, width: 0.08, hubRadius: 0.09, treadDepth: 0.012, lugs: 8 }), HAULER_MATERIALS.hardware, 1, {
      motion: spin(0.3),
    }),
    [`${P}-steer-bracket`]: part(param('can', { width: 0.26, depth: 0.26, height: 0.14, bevel: 0.01, baseBand: 0.02, bands: 1 }), HAULER_MATERIALS.steel, 2, {
      sockets: { knuckleSeat: { at: [0, 0.14, 0] } },
    }),
    [`${P}-steering-knuckle`]: part(param('can', { width: 0.3, depth: 0.26, height: 0.18, bevel: 0.02, baseBand: 0.03, bands: 1 }), HAULER_MATERIALS.hardware, 1, {
      motion: sway(0.5, 0.1, 'y'),
      sockets: { linkSeat: { at: [0, 0.04, 0.13] } },
    }),
    [`${P}-steer-link`]: part(param('beam', { length: 0.6, section: 0.06, wall: 0.02 }), HAULER_MATERIALS.hardware, 2),
  };
  const children: Placement[] = [
    { ref: `${P}-mechanism-yoke`, key: 'mechanism-yoke' },
    { ref: `${P}-dump-ram`, key: 'ram-left', on: on(0, 'ramLeft') },
    { ref: `${P}-dump-ram`, key: 'ram-right', on: on(0, 'ramRight') },
    { ref: `${P}-dump-piston`, key: 'piston-left', on: on(1, 'rodPort') },
    { ref: `${P}-dump-piston`, key: 'piston-right', on: on(2, 'rodPort') },
    { ref: `${P}-hydraulic-manifold`, key: 'manifold', on: on(0, 'manifold') },
    // the hose is the one part that spans two mounts, so it is placed by its middle: its ends are the two ports
    { ref: `${P}-hydraulic-hose`, key: 'hydraulic-hose', at: [-0.595, 0.29, 0.0] },
    // the winch stands on the ore bed's headboard deck, one mast clear of the plate so its drum can turn
    { ref: `${P}-winch-post`, key: 'winch-post', at: [0, 0.58, -0.45] },
    { ref: `${P}-winch-drum`, key: 'winch-drum', on: on(7, 'drumSeat') },
    { ref: `${P}-steer-bracket`, key: 'steer-bracket', on: on(0, 'steerBase') },
    { ref: `${P}-steering-knuckle`, key: 'steering-knuckle', on: on(9, 'knuckleSeat') },
    { ref: `${P}-steer-link`, key: 'steer-link', on: on(10, 'linkSeat') },
  ];
  return { parts, assembly: { children } };
}

/**
 * `controls`: the instrument binnacle and its gauge, the twin `lx:` headlamps, the roof beacons, the winch valve bank
 * with its handwheel, and the wiregraph coupling port at the tail. Every one of them is on a face the beam can see
 * from outside, because that is what a cartridge aims at.
 */
function haulerControls(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'hauler';
  const binnacleSockets: Record<string, SocketDef> = {
    gauge: { at: [0, -0.02, 0.11] },
    lampLeft: { at: [-0.62, 0.11, 0.11] },
    lampRight: { at: [0.62, 0.11, 0.11] },
    beaconLeft: { at: [-0.55, 0.58, -0.6] },
    beaconRight: { at: [0.55, 0.58, -0.6] },
  };
  const bankSockets: Record<string, SocketDef> = {
    handwheel: { at: [0, 0.14, 0] },
    portDeck: { at: [0, 0.02, 0.12] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-instrument-binnacle`]: part(param('can', { width: 1.5, depth: 0.22, height: 0.22, bevel: 0.02, baseBand: 0.03, bands: 1 }), HAULER_MATERIALS.hardware, 1, {
      sockets: binnacleSockets,
    }),
    [`${P}-gauge-dial`]: part(param('bolt', { headWidth: 0.14, headHeight: 0.03, shankDia: 0.03, shankLength: 0.03, head: 1 }), HAULER_MATERIALS.hardware, 2, {
      motion: spin(0.2, 'z'),
    }),
    [`${P}-headlamp-housing`]: part(param('lamp', { width: 0.28, height: 0.18, depth: 0.12, bezel: 0.02, visor: 0.03, guards: 2 }), HAULER_MATERIALS.lamp, 1),
    [`${P}-beacon-lamp`]: part(param('lamp', { width: 0.14, height: 0.12, depth: 0.1, bezel: 0.015, visor: 0, guards: 0 }), HAULER_MATERIALS.beacon, 1),
    [`${P}-winch-valve-bank`]: part(param('can', { width: 0.34, depth: 0.3, height: 0.14, bevel: 0.02, baseBand: 0.03, bands: 1 }), HAULER_MATERIALS.body, 1, {
      sockets: bankSockets,
    }),
    [`${P}-valve-handle`]: part(param('handle', { span: 0.16, reach: 0.12, thickness: 0.012, gripWidth: 0.04, mode: 0 }), HAULER_MATERIALS.hardware, 1),
    [`${P}-coupling-port`]: part(param('can', { width: 0.2, depth: 0.08, height: 0.2, bevel: 0.02, baseBand: 0.03, bands: 1 }), HAULER_MATERIALS.hardware, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-instrument-binnacle`, key: 'instrument-binnacle' },
    { ref: `${P}-gauge-dial`, key: 'gauge-dial', on: on(0, 'gauge') },
    { ref: `${P}-headlamp-housing`, key: 'headlamp-left', on: on(0, 'lampLeft') },
    { ref: `${P}-headlamp-housing`, key: 'headlamp-right', on: on(0, 'lampRight') },
    { ref: `${P}-beacon-lamp`, key: 'beacon-left', on: on(0, 'beaconLeft') },
    { ref: `${P}-beacon-lamp`, key: 'beacon-right', on: on(0, 'beaconRight') },
    // the winch bank stands on the ore bed's front rail, and its port faces the tail coupling
    { ref: `${P}-winch-valve-bank`, key: 'winch-valve-bank', at: [-0.44, 0.04, -2.54] },
    { ref: `${P}-valve-handle`, key: 'valve-handle', on: on(6, 'handwheel') },
    { ref: `${P}-coupling-port`, key: 'coupling-port', at: [0.55, 0.04, -4.75] },
  ];
  return { parts, assembly: { children } };
}

/**
 * `subject`: the tilting ore bed, its two lock rails, the hazard stripe across its tail and the tie-down brackets.
 * The bed is the load-bearing assembly: it stands on its cradle, which stands on the spine.
 */
function haulerSubject(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'hauler';
  const bedSockets: Record<string, SocketDef> = {
    railLeft: { at: [-0.95, 0.3, 0] },
    railRight: { at: [0.95, 0.3, 0] },
    stripe: { at: [0, 0.16, -1.33] },
    tieLeft: { at: [-1.1, 0.16, -0.9] },
    tieRight: { at: [1.1, 0.16, -0.9] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-bed-cradle`]: part(param('can', { width: 1.4, depth: 2.2, height: 0.28, bevel: 0.03, baseBand: 0.05, bands: 1 }), HAULER_MATERIALS.hardware, 1, {
      sockets: { bedSeat: { at: [0, 0.28, 0] } },
    }),
    [`${P}-cargo-bed`]: part(param('can', { width: 2.3, depth: 2.6, height: 0.3, bevel: 0.04, baseBand: 0.08, bands: 1 }), HAULER_MATERIALS.body, 0, { sockets: bedSockets }),
    [`${P}-cargo-lock-rail`]: part(param('beam', { length: 2.4, section: 0.08, wall: 0.03 }), HAULER_MATERIALS.steel, 1),
    [`${P}-hazard-stripe`]: part(param('can', { width: 2.1, depth: 0.06, height: 0.1, bevel: 0.01, baseBand: 0.02, bands: 0 }), HAULER_MATERIALS.hazard, 1),
    [`${P}-tie-down-bracket`]: part(param('bracket', { width: 0.14, upright: 0.16, foot: 0.12, thickness: 0.014, gusset: 1 }), HAULER_MATERIALS.hardware, 2),
  };
  const children: Placement[] = [
    { ref: `${P}-bed-cradle`, key: 'bed-cradle' },
    { ref: `${P}-cargo-bed`, key: 'cargo-bed', on: on(0, 'bedSeat') },
    { ref: `${P}-cargo-lock-rail`, key: 'lock-rail-left', on: on(1, 'railLeft'), rot: [0, 90, 0] },
    { ref: `${P}-cargo-lock-rail`, key: 'lock-rail-right', on: on(1, 'railRight'), rot: [0, 90, 0] },
    { ref: `${P}-hazard-stripe`, key: 'hazard-stripe', on: on(1, 'stripe') },
    { ref: `${P}-tie-down-bracket`, key: 'tie-down-left', on: on(1, 'tieLeft') },
    { ref: `${P}-tie-down-bracket`, key: 'tie-down-right', on: on(1, 'tieRight') },
  ];
  return { parts, assembly: { children } };
}

/** The Hauler's spec: its envelope holds the body and the bed, its hubs are the six wheel positions. */
export const HAULER_KIT_SPEC: VehicleKitSpec = Object.freeze({
  kind: 'hauler',
  prefix: 'hauler',
  subject: 'cargo-bed',
  envelope: { width: 2.85, height: 2.93, length: 5.99 },
  hubs: Object.freeze(
    HAULER_AXLES.flatMap((z) => [
      Object.freeze([-1.08, 0.55, z] as const),
      Object.freeze([1.08, 0.55, z] as const),
    ]),
  ),
  parts: { min: 40, max: 55 },
});

function haulerKit(): Kit {
  const base = haulerBase();
  const structure = haulerStructure();
  const mechanism = haulerMechanism();
  const controls = haulerControls();
  const subject = haulerSubject();
  return {
    parts: { ...base.parts, ...structure.parts, ...mechanism.parts, ...controls.parts, ...subject.parts },
    assemblies: {
      [VEHICLE_PRESET]: {
        children: [
          { ref: 'base', key: 'base' },
          { ref: 'structure', key: 'structure', on: on(0, 'structureMount') },
          { ref: 'mechanism', key: 'mechanism', on: on(0, 'mechanismMount') },
          { ref: 'controls', key: 'controls', on: on(0, 'controlsMount') },
          { ref: 'subject', key: 'subject', on: on(0, 'subjectMount') },
        ],
        sockets: {
          seatLeft: { at: [-0.45, 1.5, 1.55] },
          seatRight: { at: [0.45, 1.5, 1.55] },
          lampLeft: { at: [-0.62, 1.33, 2.1] },
          lampRight: { at: [0.62, 1.33, 2.1] },
          cargo: { at: [0, 1.54, -1.5] },
          coupling: { at: [0.55, 1.54, -2.6] },
          power: { at: [0, 1.12, 0.1] },
        },
      },
      base: base.assembly,
      structure: structure.assembly,
      mechanism: mechanism.assembly,
      controls: controls.assembly,
      subject: subject.assembly,
    },
  };
}

/** The Hauler's kit. Built once: the same vehicle always gives the same kit, in the same order. */
export const HAULER_KIT: Kit = Object.freeze(haulerKit());

// ============================================================================
// CRAWLER — the tracked excavation and drilling rig (45-60 parts)
// ============================================================================

export const CRAWLER_MATERIALS = Object.freeze({
  body: 'khaki-paint',
  steel: 'hull-steel',
  hardware: 'accent-hardware',
  /** The track belts' grain, the same `rubber-grain` skin the hauler's tyres wear. */
  track: 'mat:rubber-seal',
  /** The cutter heads: heat-scarred steel, so the business end reads as the business end. */
  scorch: 'mat:scorch-burn',
  hazard: 'mat:field-worn-hazard',
  lamp: 'lx:4800:1.4:steady',
  beacon: 'lx:590:1.1:pulse',
});

/** The track pod: 3.4 m of belt, 0.74 m tall, 0.54 m across — the crawler's whole ground contact. */
export const CRAWLER_TRACK = Object.freeze({
  length: 3.4,
  height: 0.74,
  width: 0.54,
  beltThickness: 0.08,
  wheels: 4,
  cleats: 10,
});

/** The track's road wheels: 0.50 m discs, one sprocket and one idler per pod. */
const CRAWLER_TRACK_WHEEL = Object.freeze({ radius: 0.25, width: 0.12, hubRadius: 0.12, treadDepth: 0.02, lugs: 12 });

/** `base`: the H-frame undercarriage, its two track pods, the four road wheels and the tensioners that keep them on. */
function crawlerBase(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'crawler';
  const frameSockets: Record<string, SocketDef> = {
    trackLeft: { at: [-0.92, -0.24, 0] },
    trackRight: { at: [0.92, -0.24, 0] },
  };
  const podSockets: Record<string, SocketDef> = {
    'wheel-front': { at: [-0.3, 0.09, 1.32] },
    'wheel-rear': { at: [-0.3, 0.09, -1.32] },
    fender: { at: [0, 0.74, 0] },
  };
  const fenderSockets: Record<string, SocketDef> = { tensioner: { at: [-0.2, 0.08, -1.0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-under-frame`]: part(box([1.34, 0.3, 4.3]), CRAWLER_MATERIALS.steel, 0, { sockets: frameSockets }),
    [`${P}-track-pod`]: part(param('track', CRAWLER_TRACK), CRAWLER_MATERIALS.track, 0, { sockets: podSockets }),
    [`${P}-track-wheel`]: part(param('wheel', CRAWLER_TRACK_WHEEL), CRAWLER_MATERIALS.hardware, 1),
    [`${P}-track-fender`]: part(param('can', { width: 0.6, depth: 2.6, height: 0.08, bevel: 0.02, baseBand: 0.02, bands: 0 }), CRAWLER_MATERIALS.steel, 1, {
      sockets: fenderSockets,
    }),
    [`${P}-track-tensioner`]: part(param('can', { width: 0.14, depth: 0.34, height: 0.16, bevel: 0.01, baseBand: 0.02, bands: 1 }), CRAWLER_MATERIALS.hardware, 2, {
      sockets: { boltRow: { at: [0, 0.16, -0.12] } },
    }),
    [`${P}-track-bolt`]: part(param('bolt', { headWidth: 0.05, headHeight: 0.02, shankDia: 0.018, shankLength: 0.02, head: 1 }), CRAWLER_MATERIALS.hardware, 2),
  };
  const children: Placement[] = [
    { ref: `${P}-under-frame`, key: 'under-frame', at: [0, 0.24, 0] },
    { ref: `${P}-track-pod`, key: 'track-left', on: on(0, 'trackLeft') },
    { ref: `${P}-track-pod`, key: 'track-right', on: on(0, 'trackRight'), mirror: 'x' },
    { ref: `${P}-track-wheel`, key: 'sprocket-left', on: on(1, 'wheel-rear') },
    { ref: `${P}-track-wheel`, key: 'idler-left', on: on(1, 'wheel-front') },
    { ref: `${P}-track-wheel`, key: 'sprocket-right', on: on(2, 'wheel-rear') },
    { ref: `${P}-track-wheel`, key: 'idler-right', on: on(2, 'wheel-front') },
    { ref: `${P}-track-fender`, key: 'fender-left', on: on(1, 'fender') },
    { ref: `${P}-track-fender`, key: 'fender-right', on: on(2, 'fender') },
    { ref: `${P}-track-tensioner`, key: 'tensioner-left', on: on(7, 'tensioner') },
    { ref: `${P}-track-tensioner`, key: 'tensioner-right', on: on(8, 'tensioner') },
    { ref: `${P}-track-bolt`, key: 'bolts-left', on: on(9, 'boltRow'), repeat: { count: 3, step: [0, 0, 0.12] } },
    { ref: `${P}-track-bolt`, key: 'bolts-right', on: on(10, 'boltRow'), repeat: { count: 3, step: [0, 0, 0.12] } },
  ];
  const sockets: Record<string, SocketDef> = {
    structureMount: { at: [0, 0.54, 0] },
    // the boom hinging on the deck's front edge, and the console standing on the cage roof
    mechanismMount: { at: [0, 0.84, 1.05] },
    controlsMount: { at: [0.55, 1.74, 0.62] },
    subjectMount: { at: [0, 1.4, 2.4] },
  };
  return { parts, assembly: { children, sockets } };
}

/** `structure`: the slew ring and deck, the engine housing and its grille, the operator cage and the boom gantry. */
function crawlerStructure(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'crawler';
  const ringSockets: Record<string, SocketDef> = { deckSeat: { at: [0, 0.12, 0] } };
  const deckSockets: Record<string, SocketDef> = {
    engineSeat: { at: [0, 0.18, -0.58] },
    cageSeat: { at: [0, 0.18, 0.35] },
    postLeft: { at: [-0.55, 0.18, 1.05] },
    postRight: { at: [0.55, 0.18, 1.05] },
    cleatLeft: { at: [-0.55, 0.18, 0.6] },
    cleatRight: { at: [0.55, 0.18, 0.6] },
  };
  const housingSockets: Record<string, SocketDef> = {
    grilleSeat: { at: [0, 0.06, -0.48] },
    ventLeft: { at: [-0.3, 0.52, 0.35] },
    ventRight: { at: [0.3, 0.52, 0.35] },
  };
  const cageSockets: Record<string, SocketDef> = { roofSeat: { at: [0, 0.8, 0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-slew-ring`]: part(param('can', { width: 1.1, depth: 1.1, height: 0.12, bevel: 0.02, baseBand: 0.03, bands: 1 }), CRAWLER_MATERIALS.hardware, 1, {
      sockets: ringSockets,
    }),
    [`${P}-slew-deck`]: part(param('can', { width: 1.24, depth: 2.2, height: 0.18, bevel: 0.03, baseBand: 0.05, bands: 1 }), CRAWLER_MATERIALS.body, 0, {
      sockets: deckSockets,
    }),
    [`${P}-engine-housing`]: part(param('can', { width: 1.2, depth: 0.96, height: 0.52, bevel: 0.03, baseBand: 0.06, bands: 2 }), CRAWLER_MATERIALS.body, 0, {
      sockets: housingSockets,
    }),
    [`${P}-radiator-grille`]: part(param('grille', { width: 1.1, height: 0.42, depth: 0.06, frame: 0.03, slats: 6, slat: 0.012 }), CRAWLER_MATERIALS.hardware, 1),
    [`${P}-engine-vent`]: part(param('louvre', { width: 0.5, height: 0.18, hoodDepth: 0.08, flange: 0.015, slats: 5 }), CRAWLER_MATERIALS.hardware, 2),
    [`${P}-operator-cage`]: part(param('can', { width: 0.86, depth: 0.9, height: 0.8, bevel: 0.03, baseBand: 0.05, bands: 1 }), CRAWLER_MATERIALS.body, 0, {
      sockets: cageSockets,
    }),
    [`${P}-cage-roof`]: part(param('can', { width: 0.96, depth: 1, height: 0.1, bevel: 0.02, baseBand: 0.02, bands: 0 }), CRAWLER_MATERIALS.steel, 1),
    [`${P}-gantry-post`]: part(param('can', { width: 0.14, depth: 0.2, height: 0.9, bevel: 0.01, baseBand: 0.02, bands: 0 }), CRAWLER_MATERIALS.steel, 1),
    [`${P}-gantry-brace`]: part(param('beam', { length: 1.3, section: 0.12, wall: 0.04 }), CRAWLER_MATERIALS.steel, 1),
    [`${P}-deck-cleat`]: part(param('can', { width: 0.16, depth: 0.14, height: 0.12, bevel: 0.01, baseBand: 0.02, bands: 0 }), CRAWLER_MATERIALS.hardware, 2),
    [`${P}-counterweight`]: part(param('can', { width: 1.2, depth: 0.3, height: 0.2, bevel: 0.02, baseBand: 0.03, bands: 1 }), CRAWLER_MATERIALS.steel, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-slew-ring`, key: 'slew-ring' },
    { ref: `${P}-slew-deck`, key: 'slew-deck', on: on(0, 'deckSeat') },
    { ref: `${P}-engine-housing`, key: 'engine-housing', on: on(1, 'engineSeat') },
    { ref: `${P}-radiator-grille`, key: 'radiator-grille', on: on(2, 'grilleSeat') },
    { ref: `${P}-engine-vent`, key: 'vent-left', on: on(2, 'ventLeft') },
    { ref: `${P}-engine-vent`, key: 'vent-right', on: on(2, 'ventRight') },
    { ref: `${P}-operator-cage`, key: 'operator-cage', on: on(1, 'cageSeat') },
    { ref: `${P}-cage-roof`, key: 'cage-roof', on: on(6, 'roofSeat') },
    { ref: `${P}-gantry-post`, key: 'post-left', on: on(1, 'postLeft') },
    { ref: `${P}-gantry-post`, key: 'post-right', on: on(1, 'postRight') },
    { ref: `${P}-gantry-brace`, key: 'gantry-brace', at: [0, 1.2, 1.05] },
    { ref: `${P}-deck-cleat`, key: 'cleat-left', on: on(1, 'cleatLeft') },
    { ref: `${P}-deck-cleat`, key: 'cleat-right', on: on(1, 'cleatRight') },
    { ref: `${P}-counterweight`, key: 'counterweight', at: [0, 0.3, -1.21] },
  ];
  return { parts, assembly: { children } };
}

/** `mechanism`: the boom pivot, the arm that swings on it, the dipper cylinder and the rod that slides in it. */
function crawlerMechanism(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'crawler';
  const pivotSockets: Record<string, SocketDef> = { armSeat: { at: [0, 0.46, 0.58] } };
  const armSockets: Record<string, SocketDef> = {
    dipperSeat: { at: [-0.5, 0.2, 0] },
    // the cutter carriage's mount, at the arm's tip: the subject group hangs off it
    tipSeat: { at: [0.62, 0.1, 0] },
  };
  const cylinderSockets: Record<string, SocketDef> = { rodSeat: { at: [0, 0.26, 0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-boom-pivot`]: part(param('can', { width: 0.34, depth: 0.34, height: 0.46, bevel: 0.02, baseBand: 0.04, bands: 1 }), CRAWLER_MATERIALS.steel, 0, {
      sockets: pivotSockets,
    }),
    [`${P}-boom-arm`]: part(param('beam', { length: 1.24, section: 0.2, wall: 0.06 }), CRAWLER_MATERIALS.steel, 0, {
      sockets: armSockets,
      motion: sway(0.45, 0.12, 'x'),
    }),
    [`${P}-dipper-cylinder`]: part(param('can', { width: 0.16, depth: 0.18, height: 0.26, bevel: 0.01, baseBand: 0.02, bands: 2 }), CRAWLER_MATERIALS.hardware, 1, {
      sockets: cylinderSockets,
    }),
    [`${P}-dipper-rod`]: part(param('pipe', { radius: 0.045, length: 0.22, armLength: 0.06, elbow: 0, sides: 8, flangeWidth: 0.02 }), CRAWLER_MATERIALS.hardware, 1, {
      motion: stroke(0.35, 0.1, 'y'),
    }),
  };
  const children: Placement[] = [
    { ref: `${P}-boom-pivot`, key: 'boom-pivot' },
    { ref: `${P}-boom-arm`, key: 'boom-arm', on: on(0, 'armSeat'), rot: [0, 90, 0] },
    { ref: `${P}-dipper-cylinder`, key: 'dipper-cylinder', on: on(1, 'dipperSeat') },
    { ref: `${P}-dipper-rod`, key: 'dipper-rod', on: on(2, 'rodSeat') },
  ];
  return {
    parts,
    assembly: {
      children,
      sockets: {
        // where the cutter carriage mounts: the arm's tip, in the mechanism assembly's own frame
        boomTip: { at: [0, 0.56, 1.4] },
      },
    },
  };
}

/** `controls`: the operator console with its gauges and sticks, the floodlights, the beacon and the umbilical port. */
function crawlerControls(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'crawler';
  const consoleSockets: Record<string, SocketDef> = {
    gaugeLeft: { at: [-0.09, 0.14, -0.15] },
    gaugeRight: { at: [0.09, 0.14, -0.15] },
    stickLeft: { at: [-0.12, 0.24, 0] },
    stickRight: { at: [0.12, 0.24, 0] },
    cutoff: { at: [0.16, 0.24, 0.1] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-operator-console`]: part(param('can', { width: 0.4, depth: 0.3, height: 0.24, bevel: 0.02, baseBand: 0.03, bands: 1 }), CRAWLER_MATERIALS.body, 1, {
      sockets: consoleSockets,
    }),
    [`${P}-pressure-gauge`]: part(param('bolt', { headWidth: 0.12, headHeight: 0.03, shankDia: 0.03, shankLength: 0.03, head: 1 }), CRAWLER_MATERIALS.hardware, 2),
    [`${P}-joystick`]: part(param('handle', { span: 0.1, reach: 0.1, thickness: 0.01, gripWidth: 0.03, mode: 0 }), CRAWLER_MATERIALS.hardware, 1),
    [`${P}-cutoff-lever`]: part(param('handle', { span: 0.12, reach: 0.12, thickness: 0.01, gripWidth: 0.03, mode: 1 }), CRAWLER_MATERIALS.hardware, 1),
    [`${P}-floodlight`]: part(param('lamp', { width: 0.22, height: 0.16, depth: 0.1, bezel: 0.02, visor: 0.03, guards: 2 }), CRAWLER_MATERIALS.lamp, 1),
    [`${P}-beacon-post`]: part(param('can', { width: 0.08, depth: 0.08, height: 0.1, bevel: 0.01, baseBand: 0.01, bands: 0 }), CRAWLER_MATERIALS.steel, 2, {
      sockets: { beaconSeat: { at: [0, 0.1, 0] } },
    }),
    [`${P}-roof-beacon`]: part(param('lamp', { width: 0.14, height: 0.12, depth: 0.1, bezel: 0.015, visor: 0, guards: 0 }), CRAWLER_MATERIALS.beacon, 1),
    [`${P}-umbilical-port`]: part(param('can', { width: 0.18, depth: 0.14, height: 0.18, bevel: 0.02, baseBand: 0.02, bands: 1 }), CRAWLER_MATERIALS.hardware, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-operator-console`, key: 'operator-console' },
    { ref: `${P}-pressure-gauge`, key: 'gauge-left', on: on(0, 'gaugeLeft') },
    { ref: `${P}-pressure-gauge`, key: 'gauge-right', on: on(0, 'gaugeRight') },
    { ref: `${P}-joystick`, key: 'stick-left', on: on(0, 'stickLeft') },
    { ref: `${P}-joystick`, key: 'stick-right', on: on(0, 'stickRight') },
    { ref: `${P}-cutoff-lever`, key: 'cutoff-lever', on: on(0, 'cutoff') },
    // the floods and the beacon stand on the cage roof, forward and aft of the console
    { ref: `${P}-floodlight`, key: 'flood-left', at: [-0.91, 0, 0.23] },
    { ref: `${P}-floodlight`, key: 'flood-right', at: [-0.19, 0, 0.23] },
    { ref: `${P}-beacon-post`, key: 'beacon-post', at: [-0.55, 0, -0.67] },
    { ref: `${P}-roof-beacon`, key: 'roof-beacon', on: on(8, 'beaconSeat') },
    // and the wiregraph umbilical sits on the engine housing's deck
    { ref: `${P}-umbilical-port`, key: 'umbilical-port', at: [-0.1, -0.38, -1.57] },
  ];
  return { parts, assembly: { children } };
}

/** `subject`: the cutter carriage and its counter-rotating twin heads, the rig's business end. */
function crawlerSubject(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'crawler';
  const carriageSockets: Record<string, SocketDef> = {
    headLeft: { at: [-0.2, 0.3, 0.15] },
    headRight: { at: [0.2, 0.3, 0.15] },
  };
  const parts: Record<string, PartDef> = {
    [`${P}-cutter-carriage`]: part(param('can', { width: 0.5, depth: 0.4, height: 0.3, bevel: 0.02, baseBand: 0.03, bands: 1 }), CRAWLER_MATERIALS.steel, 0, {
      sockets: carriageSockets,
    }),
    // sixteen lugs a head: the exposed teeth that chew the rock, and the part the cartridge dresses
    [`${P}-cutter-head`]: part(param('wheel', { radius: 0.22, width: 0.12, hubRadius: 0.1, treadDepth: 0.03, lugs: 16 }), CRAWLER_MATERIALS.scorch, 0, {
      motion: spin(0.8),
    }),
  };
  const children: Placement[] = [
    { ref: `${P}-cutter-carriage`, key: 'cutter-carriage' },
    { ref: `${P}-cutter-head`, key: 'head-left', on: on(0, 'headLeft') },
    // the twin turns the other way: the same part, one placement over with the rate negated
    { ref: `${P}-cutter-head`, key: 'head-right', on: on(0, 'headRight'), motion: { kind: 'spin', axis: 'x', rateHz: -0.8, amplitude: 0 } },
  ];
  return { parts, assembly: { children } };
}

export const CRAWLER_KIT_SPEC: VehicleKitSpec = Object.freeze({
  kind: 'crawler',
  prefix: 'crawler',
  subject: 'cutter-head',
  envelope: { width: 2.6, height: 2.4, length: 6.6 },
  hubs: Object.freeze([
    Object.freeze([-0.92, 0.37, 1.32] as const),
    Object.freeze([0.92, 0.37, 1.32] as const),
    Object.freeze([-0.92, 0.37, -1.32] as const),
    Object.freeze([0.92, 0.37, -1.32] as const),
  ]),
  parts: { min: 45, max: 60 },
});

function crawlerKit(): Kit {
  const base = crawlerBase();
  const structure = crawlerStructure();
  const mechanism = crawlerMechanism();
  const controls = crawlerControls();
  const subject = crawlerSubject();
  return {
    parts: { ...base.parts, ...structure.parts, ...mechanism.parts, ...controls.parts, ...subject.parts },
    assemblies: {
      [VEHICLE_PRESET]: {
        children: [
          { ref: 'base', key: 'base' },
          { ref: 'structure', key: 'structure', on: on(0, 'structureMount') },
          { ref: 'mechanism', key: 'mechanism', on: on(0, 'mechanismMount') },
          { ref: 'controls', key: 'controls', on: on(0, 'controlsMount') },
          // the cutter carriage hangs on the boom's tip, which is the mechanism assembly's own exposed socket
          { ref: 'subject', key: 'subject', on: on(2, 'boomTip') },
        ],
        sockets: {
          seat: { at: [0.55, 1.74, 0.62] },
          drill: { at: [0, 1.4, 2.4] },
          mast: { at: [0, 1.86, 1.05] },
          lampLeft: { at: [-0.36, 1.74, 0.85] },
          lampRight: { at: [0.36, 1.74, 0.85] },
          power: { at: [0.45, 1.36, -0.95] },
        },
      },
      base: base.assembly,
      structure: structure.assembly,
      mechanism: mechanism.assembly,
      controls: controls.assembly,
      subject: subject.assembly,
    },
  };
}

/** The Crawler's kit. Built once, deterministic. */
export const CRAWLER_KIT: Kit = Object.freeze(crawlerKit());

// ============================================================================
// SCOUT — the high-agility reconnaissance rover (30-42 parts)
// ============================================================================

export const SCOUT_MATERIALS = Object.freeze({
  body: 'khaki-paint',
  steel: 'hull-steel',
  hardware: 'accent-hardware',
  tyre: 'mat:rubber-seal',
  hazard: 'mat:field-worn-hazard',
  lamp: 'lx:2100:1.3:steady',
  /** The scanner's emit face: a cold cartridge, so the dish reads as an instrument and not as a lamp. */
  sensor: 'lx:6500:1.6:steady',
  beacon: 'lx:590:1.1:pulse',
});

/** The balloon tyre the scout rides on: 0.90 m across, 0.36 m wide (the scene's `VEHICLE_FIT.scout` radius 0.45). */
export const SCOUT_WHEEL = Object.freeze({ radius: 0.45, width: 0.36, hubRadius: 0.18, treadDepth: 0.03, lugs: 14 });

/** `base`: the spaceframe tub, its four wishbone arms and the four balloon wheels on them. */
function scoutBase(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'scout';
  const tubSockets: Record<string, SocketDef> = {
    armFrontRight: { at: [0.66, 0, 1.1] },
    armFrontLeft: { at: [-0.66, 0, 1.1] },
    armRearRight: { at: [0.66, 0, -1.1] },
    armRearLeft: { at: [-0.66, 0, -1.1] },
  };
  const armSockets: Record<string, SocketDef> = { hubMount: { at: [-0.14, -0.3, 0] } };
  const parts: Record<string, PartDef> = {
    // the frame is a box: a spaceframe run is longer than a `can` may be, and `kitspec` allows a box
    [`${P}-frame-tub`]: part(box([1.0, 0.24, 2.3]), SCOUT_MATERIALS.steel, 0, { sockets: tubSockets }),
    [`${P}-wishbone-arm`]: part(param('can', { width: 0.36, depth: 0.14, height: 0.16, bevel: 0.02, baseBand: 0.03, bands: 1 }), SCOUT_MATERIALS.hardware, 1, {
      sockets: armSockets,
    }),
    [`${P}-wheel`]: part(param('wheel', SCOUT_WHEEL), SCOUT_MATERIALS.tyre, 0),
  };
  const children: Placement[] = [
    { ref: `${P}-frame-tub`, key: 'frame-tub', at: [0, 0.3, 0] },
    { ref: `${P}-wishbone-arm`, key: 'arm-front-left', on: on(0, 'armFrontLeft') },
    { ref: `${P}-wishbone-arm`, key: 'arm-front-right', on: on(0, 'armFrontRight'), mirror: 'x' },
    { ref: `${P}-wishbone-arm`, key: 'arm-rear-left', on: on(0, 'armRearLeft') },
    { ref: `${P}-wishbone-arm`, key: 'arm-rear-right', on: on(0, 'armRearRight'), mirror: 'x' },
    { ref: `${P}-wheel`, key: 'wheel-front-left', on: on(1, 'hubMount') },
    { ref: `${P}-wheel`, key: 'wheel-front-right', on: on(2, 'hubMount') },
    { ref: `${P}-wheel`, key: 'wheel-rear-left', on: on(3, 'hubMount') },
    { ref: `${P}-wheel`, key: 'wheel-rear-right', on: on(4, 'hubMount') },
  ];
  const sockets: Record<string, SocketDef> = {
    structureMount: { at: [0, 0.54, 0] },
    mechanismMount: { at: [0, 0.54, -0.75] },
    controlsMount: { at: [0, 0.54, 0.1] },
    // the scanner mast stands on the tub's right shoulder, behind the driver's saddle
    subjectMount: { at: [0.42, 0.54, -0.85] },
  };
  return { parts, assembly: { children, sockets } };
}

/**
 * `structure`: the nose skid plate, the roll hoop on its two posts and the battery saddles slung on the tub. Nothing
 * rides the hoop itself: a part standing on a beam that low cannot be separated from it by the audit's exploded view,
 * so the instruments live on the tub's deck and on the dash, where their mounts are below the rover's centre and drag
 * clear of what they stand on.
 */
function scoutStructure(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'scout';
  const parts: Record<string, PartDef> = {
    [`${P}-skid-plate`]: part(param('can', { width: 0.88, depth: 0.3, height: 0.24, bevel: 0.02, baseBand: 0.02, bands: 0 }), SCOUT_MATERIALS.hazard, 1),
    [`${P}-roll-post`]: part(param('can', { width: 0.09, depth: 0.09, height: 0.9, bevel: 0.01, baseBand: 0.02, bands: 0 }), SCOUT_MATERIALS.steel, 0),
    [`${P}-roll-hoop`]: part(param('beam', { length: 0.98, section: 0.09, wall: 0.02 }), SCOUT_MATERIALS.steel, 0),
    [`${P}-battery-saddle`]: part(param('can', { width: 0.34, depth: 0.6, height: 0.22, bevel: 0.02, baseBand: 0.03, bands: 1 }), SCOUT_MATERIALS.hardware, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-skid-plate`, key: 'skid-plate', at: [0, -0.24, 1.3] },
    { ref: `${P}-roll-post`, key: 'post-left', at: [-0.4, 0, -0.3] },
    { ref: `${P}-roll-post`, key: 'post-right', at: [0.4, 0, -0.3] },
    { ref: `${P}-roll-hoop`, key: 'roll-hoop', at: [0, 0.9, -0.3] },
    { ref: `${P}-battery-saddle`, key: 'saddle-left', at: [-0.34, 0, 0.2] },
    { ref: `${P}-battery-saddle`, key: 'saddle-right', at: [0.34, 0, 0.2] },
  ];
  return { parts, assembly: { children } };
}

/**
 * `mechanism`: the rear engine block, the cooling fan turning on its post above it, and the steering rack on the
 * nose. The fan is a `wheel`, whose origin is its rim, so its box turns a full circle around that origin: it rides a
 * post tall enough to clear the engine and the tub it stands between.
 */
function scoutMechanism(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'scout';
  const engineSockets: Record<string, SocketDef> = { postSeat: { at: [0, 0.3, -0.15] } };
  const postSockets: Record<string, SocketDef> = { fanSeat: { at: [0, 0.5, 0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-engine-block`]: part(param('can', { width: 0.7, depth: 0.5, height: 0.3, bevel: 0.02, baseBand: 0.04, bands: 2 }), SCOUT_MATERIALS.body, 0, {
      sockets: engineSockets,
    }),
    [`${P}-fan-post`]: part(param('can', { width: 0.1, depth: 0.1, height: 0.5, bevel: 0.01, baseBand: 0.02, bands: 0 }), SCOUT_MATERIALS.steel, 2, {
      sockets: postSockets,
    }),
    [`${P}-cooling-fan`]: part(param('wheel', { radius: 0.2, width: 0.08, hubRadius: 0.08, treadDepth: 0.012, lugs: 10 }), SCOUT_MATERIALS.hardware, 1, {
      motion: spin(0.45),
    }),
    [`${P}-steering-rack`]: part(param('can', { width: 0.6, depth: 0.1, height: 0.12, bevel: 0.01, baseBand: 0.02, bands: 1 }), SCOUT_MATERIALS.hardware, 1, {
      motion: sway(0.6, 0.08, 'y'),
    }),
  };
  const children: Placement[] = [
    { ref: `${P}-engine-block`, key: 'engine-block' },
    { ref: `${P}-fan-post`, key: 'fan-post', on: on(0, 'postSeat') },
    { ref: `${P}-cooling-fan`, key: 'cooling-fan', on: on(1, 'fanSeat') },
    { ref: `${P}-steering-rack`, key: 'steering-rack', at: [0, 0, 1.45] },
  ];
  return { parts, assembly: { children } };
}

/** `controls`: the handlebar yoke and its bar, the dash and its HUD, the searchlight over the dash and the beacon. */
function scoutControls(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'scout';
  const yokeSockets: Record<string, SocketDef> = {
    barSeat: { at: [0, 0.3, 0] },
    dashSeat: { at: [0, 0, -0.15] },
    ledSeat: { at: [0, 0.3, 0.08] },
  };
  const dashSockets: Record<string, SocketDef> = {
    hudSeat: { at: [0, 0.32, -0.07] },

    lightSeat: { at: [-0.1, 0.44, 0.04] },
  };
  const mastSockets: Record<string, SocketDef> = { beaconSeat: { at: [0, 0.4, 0] } };
  const parts: Record<string, PartDef> = {
    [`${P}-yoke`]: part(param('can', { width: 0.12, depth: 0.16, height: 0.3, bevel: 0.02, baseBand: 0.03, bands: 1 }), SCOUT_MATERIALS.hardware, 1, {
      sockets: yokeSockets,
    }),
    [`${P}-handlebar`]: part(param('handle', { span: 0.44, reach: 0.1, thickness: 0.014, gripWidth: 0.1, mode: 0 }), SCOUT_MATERIALS.hardware, 1),
    [`${P}-dash-console`]: part(param('can', { width: 0.3, depth: 0.14, height: 0.44, bevel: 0.02, baseBand: 0.02, bands: 1 }), SCOUT_MATERIALS.body, 1, {
      sockets: dashSockets,
    }),
    [`${P}-hud-gauge`]: part(param('grille', { width: 0.22, height: 0.14, depth: 0.02, frame: 0.01, slats: 3, slat: 0.01 }), SCOUT_MATERIALS.sensor, 1),
    [`${P}-searchlight`]: part(param('lamp', { width: 0.18, height: 0.13, depth: 0.09, bezel: 0.015, visor: 0.025, guards: 1 }), SCOUT_MATERIALS.lamp, 1),
    [`${P}-status-bar`]: part(param('can', { width: 0.24, depth: 0.08, height: 0.06, bevel: 0.01, baseBand: 0.01, bands: 0 }), SCOUT_MATERIALS.sensor, 1),
    [`${P}-beacon-mast`]: part(param('can', { width: 0.08, depth: 0.08, height: 0.4, bevel: 0.01, baseBand: 0.01, bands: 0 }), SCOUT_MATERIALS.steel, 2, {
      sockets: mastSockets,
    }),
    [`${P}-beacon-lamp`]: part(param('lamp', { width: 0.12, height: 0.1, depth: 0.08, bezel: 0.015, visor: 0, guards: 0 }), SCOUT_MATERIALS.beacon, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-yoke`, key: 'yoke' },
    { ref: `${P}-handlebar`, key: 'handlebar', on: on(0, 'barSeat') },
    // the dash stands in front of the yoke: its tall face is what the HUD, the status bar and the light look along
    { ref: `${P}-dash-console`, key: 'dash-console', on: on(0, 'dashSeat') },
    { ref: `${P}-hud-gauge`, key: 'hud-gauge', on: on(2, 'hudSeat'), rot: [0, 180, 0] },
    { ref: `${P}-status-bar`, key: 'status-bar', on: on(0, 'ledSeat') },
    { ref: `${P}-searchlight`, key: 'searchlight', on: on(2, 'lightSeat') },
    { ref: `${P}-beacon-mast`, key: 'beacon-mast', at: [0.42, 0, -0.65] },
    { ref: `${P}-beacon-lamp`, key: 'beacon-lamp', on: on(6, 'beaconSeat') },
  ];
  return { parts, assembly: { children } };
}

/** `subject`: the scanner mast, its core, the pan/tilt gimbal and the high-gain dish — the rover's eyes. */
function scoutSubject(): { parts: Record<string, PartDef>; assembly: AssemblyDef } {
  const P = 'scout';
  const parts: Record<string, PartDef> = {
    [`${P}-mast-foot`]: part(param('can', { width: 0.14, depth: 0.14, height: 0.12, bevel: 0.01, baseBand: 0, bands: 0 }), SCOUT_MATERIALS.steel, 2, {
      sockets: { mastSeat: { at: [0, 0.12, 0] } },
    }),
    [`${P}-scanner-mast`]: part(param('can', { width: 0.1, depth: 0.1, height: 0.3, bevel: 0.01, baseBand: 0.02, bands: 1 }), SCOUT_MATERIALS.steel, 1, {
      sockets: { coreSeat: { at: [0, 0.3, 0] } },
    }),
    [`${P}-scanner-core`]: part(param('can', { width: 0.16, depth: 0.14, height: 0.1, bevel: 0.01, baseBand: 0.02, bands: 1 }), SCOUT_MATERIALS.sensor, 1, {
      sockets: { gimbalSeat: { at: [0, 0.1, 0] } },
    }),
    [`${P}-dish-gimbal`]: part(param('can', { width: 0.14, depth: 0.12, height: 0.12, bevel: 0.01, baseBand: 0.02, bands: 1 }), SCOUT_MATERIALS.hardware, 1, {
      motion: sway(0.3, 0.2, 'x'),
      sockets: { dishSeat: { at: [0, 0.12, 0] } },
    }),
    // the dish is the panel generator's plate lying on the gimbal's crown, turned with it
    [`${P}-scanner-dish`]: part(param('panel', { width: 0.4, depth: 0.4, thickness: 0.03, bevel: 0.004, seam: 0.02, boltsPerSide: 2, boltHead: 0.012 }), SCOUT_MATERIALS.hardware, 1),
  };
  const children: Placement[] = [
    { ref: `${P}-mast-foot`, key: 'mast-foot' },
    { ref: `${P}-scanner-mast`, key: 'scanner-mast', on: on(0, 'mastSeat') },
    { ref: `${P}-scanner-core`, key: 'scanner-core', on: on(1, 'coreSeat') },
    { ref: `${P}-dish-gimbal`, key: 'dish-gimbal', on: on(2, 'gimbalSeat') },
    { ref: `${P}-scanner-dish`, key: 'scanner-dish', on: on(3, 'dishSeat') },
  ];
  return { parts, assembly: { children } };
}

export const SCOUT_KIT_SPEC: VehicleKitSpec = Object.freeze({
  kind: 'scout',
  prefix: 'scout',
  subject: 'scanner-mast',
  envelope: { width: 2.0, height: 2.2, length: 3.2 },
  hubs: Object.freeze([
    Object.freeze([-0.8, 0.45, 1.1] as const),
    Object.freeze([0.8, 0.45, 1.1] as const),
    Object.freeze([-0.8, 0.45, -1.1] as const),
    Object.freeze([0.8, 0.45, -1.1] as const),
  ]),
  parts: { min: 30, max: 42 },
});

function scoutKit(): Kit {
  const base = scoutBase();
  const structure = scoutStructure();
  const mechanism = scoutMechanism();
  const controls = scoutControls();
  const subject = scoutSubject();
  return {
    parts: { ...base.parts, ...structure.parts, ...mechanism.parts, ...controls.parts, ...subject.parts },
    assemblies: {
      [VEHICLE_PRESET]: {
        children: [
          { ref: 'base', key: 'base' },
          { ref: 'structure', key: 'structure', on: on(0, 'structureMount') },
          { ref: 'mechanism', key: 'mechanism', on: on(0, 'mechanismMount') },
          { ref: 'controls', key: 'controls', on: on(0, 'controlsMount') },
          { ref: 'subject', key: 'subject', on: on(0, 'subjectMount') },
        ],
        sockets: {
          seat: { at: [0, 0.6, 0.1] },
          bar: { at: [0, 0.8, 0.1] },
          lampLeft: { at: [-0.1, 1.02, -0.05] },
          lampRight: { at: [0.42, 0.94, -0.65] },
          scanner: { at: [0.42, 1.18, -0.85] },
          power: { at: [0, 0.84, -0.75] },
        },
      },
      base: base.assembly,
      structure: structure.assembly,
      mechanism: mechanism.assembly,
      controls: controls.assembly,
      subject: subject.assembly,
    },
  };
}

/** The Scout's kit. Built once, deterministic. */
export const SCOUT_KIT: Kit = Object.freeze(scoutKit());

/** Every vehicle's kit, by kind. Built once: the same kind always gives the same kit, in the same order. */
export const VEHICLE_KITS: Readonly<Record<VehicleKind, Kit>> = Object.freeze({
  hauler: HAULER_KIT,
  crawler: CRAWLER_KIT,
  scout: SCOUT_KIT,
});

/** The spec a kind was built from. */
export function vehicleKitSpec(kind: VehicleKind): VehicleKitSpec {
  return kind === 'hauler' ? HAULER_KIT_SPEC : kind === 'crawler' ? CRAWLER_KIT_SPEC : SCOUT_KIT_SPEC;
}

/** The kit a kind builds. */
export function vehicleKit(kind: VehicleKind): Kit {
  return VEHICLE_KITS[kind];
}
