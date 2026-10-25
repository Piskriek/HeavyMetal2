/**
 * The Quantum Archway Stargate as a **modular kit** (plan 42 §4.3, PLAN-42-GATE): the plot's own gate, built from
 * `@hm/partgen` parts on `@hm/kitspec` sockets and dressed in `@hm/matstack` presets, so a player retunes it with the same
 * Part, Material and Light cartridges the beam fires at every other machine.
 *
 * The frame, in the kit's own space: base centre at the origin, y up, the ring in the XY plane, its face toward +z.
 *  - `plinth` — the grounded pad the annulus stands on;
 *  - `ring-segment` × 9 — a bevelled `panel` per segment, each tangent to the ring, so the annulus is nine radial bevels
 *    with 40-degree seams between them. The fold-aware edge wear in `@hm/matstack`'s `mask-mesh` keeps each bevel's wear
 *    band full width and narrows each seam's, which is what makes the ring read as machined metal rather than as facets;
 *  - `chevron0..8` — one lamp per segment, each with its own Kelvin so the nine stay nine meshes (the dial lights them in
 *    order; `stargateChevronSlot` maps the six-symbol dial onto the physical nine);
 *  - the ramp — four grounded blocks climbing to the aperture sill;
 *  - the dialing `pedestal` — a `can` console with a `grille` face and a status lamp, the thing a player stands at to dial;
 *  - the `iris` — the shield that closes across the aperture. It is present only when the gate is not open
 *    (`stargateKit('code-only')` / `stargateKit('closed')`); `stargateIrisClosed(access)` is the single rule.
 *
 * Sizing, measured off `flatten(stargateKit('open'))`: the annulus is 3.24 m across and the build runs 3.29 m to the top of
 * the highest chevron, on a 2.64 m aperture whose sill is 0.36 m above the ground. With the dialing pedestal the whole kit
 * boxes 4.32 × 3.29 × 2.07 m — the pedestal, not the ring, is what makes it wider than it is tall.
 */
import type { Kit, Placement, SocketDef } from '@hm/kitspec';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';

/** The assembly name: what `buildKitPreset` and the beam's overrides key on. */
export const STARGATE_PRESET = 'stargate';

/** Physical chevrons around the ring. The dial uses six symbols (plan 42 §4.3); the ring carries nine, as a Stargate does. */
export const STARGATE_CHEVRON_COUNT = 9;

/** The ring's centreline radius (m), the radial thickness of a segment, and the ring's depth along z. */
export const STARGATE_RING_RADIUS = 1.42;
export const STARGATE_SEGMENT_RADIAL = 0.2;
export const STARGATE_RING_DEPTH = 0.34;
/** The plinth's height, and the ring's centre height above the ground. */
export const STARGATE_PLINTH_H = 0.16;
export const STARGATE_RING_CENTRE_Y = STARGATE_PLINTH_H + STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2;
/** The aperture: its radius (2.5 m across) and the height of its sill, which the ramp climbs to. */
export const STARGATE_APERTURE_R = STARGATE_RING_RADIUS - STARGATE_SEGMENT_RADIAL / 2;
export const STARGATE_SILL_Y = STARGATE_RING_CENTRE_Y - STARGATE_APERTURE_R;

/** The six-symbol dial lights six of the nine chevrons, bottom pair first and outward: never three of them twice. */
export const STARGATE_DIAL_CHEVRONS: readonly number[] = Object.freeze([0, 2, 4, 5, 7, 8]);

/** The materials: painted housing, structural steel and dark hardware, all from the 4d trim palette. */
const SEGMENT_MATERIAL = 'hull-steel';
const CHEVRON_BACKING = 'accent-hardware';
const RAMP_MATERIAL = 'khaki-paint';
const IRIS_MATERIAL = 'hopper-slate';
const IRIS_TRIM = 'accent-hardware';

/** Each chevron's own Kelvin (1 K apart, so nine distinct lamp materials = nine meshes for the ignition sweep). */
export const stargateChevronMaterial = (index: number): string => `lx:${2400 + (index % STARGATE_CHEVRON_COUNT)}:1.25:steady`;

/** The pedestal's status lamp: a cool slow pulse while the gate is dialable. */
export const STARGATE_DIAL_LAMP = 'lx:5200:1.4:pulse';

/** Whether the iris covers the aperture: closed and code-only gates are sealed from the outside, open gates are not. */
export function stargateIrisClosed(access: GateAccessMode): boolean {
  return access === 'closed' || access === 'code-only';
}

/** The physical chevron a dial slot lights (a six-symbol code on a nine-chevron ring). */
export function stargateChevronSlot(slot: number): number {
  const n = STARGATE_CHEVRON_COUNT;
  const i = ((Math.trunc(slot) % n) + n) % n;
  return STARGATE_DIAL_CHEVRONS[i % STARGATE_DIAL_CHEVRONS.length]!;
}

/** The chord a segment spans: `2 R sin(pi / 9)`. A segment is cut 3 cm wider so neighbours overlap instead of meeting at a corner:
 *  a nine-sided ring of exactly-chord segments only touches at the inner corners, which leaves a grout line of sky. */
export const STARGATE_CHORD = 2 * STARGATE_RING_RADIUS * Math.sin(Math.PI / STARGATE_CHEVRON_COUNT);
export const STARGATE_SEGMENT_WIDTH = STARGATE_CHORD + 0.03;

/** Where segment `i` sits. A box rotated about z by phi extends along its local +y toward the ring's centre, so its origin is
 *  on the outer circle of the segment and the box runs inward to the aperture. */
export function stargateSegmentPose(index: number): { readonly rot: readonly [number, number, number]; readonly at: readonly [number, number, number] } {
  const phi = (index * 360) / STARGATE_CHEVRON_COUNT;
  const rad = (phi * Math.PI) / 180;
  const r = STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2;
  return { rot: [0, 0, phi], at: [round(r * Math.sin(rad)), round(STARGATE_RING_CENTRE_Y - r * Math.cos(rad)), 0] };
}

/** Where chevron `i` sits: outside its segment, the box running inward onto the segment's outer face. */
export function stargateChevronPose(index: number, depth = 0.12): { readonly rot: readonly [number, number, number]; readonly at: readonly [number, number, number] } {
  const phi = (index * 360) / STARGATE_CHEVRON_COUNT;
  const rad = (phi * Math.PI) / 180;
  const r = STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2 + depth;
  return { rot: [0, 0, phi], at: [round(r * Math.sin(rad)), round(STARGATE_RING_CENTRE_Y - r * Math.cos(rad)), 0] };
}

/** Pose numbers to a tenth of a millimetre: a kit hash should not carry float noise from sin/cos. */
const round = (v: number): number => Number(v.toFixed(4));

/** The ramp's blocks: which height each climbs to, and where it stands (z, its centre). */
/** Four blocks, each a quarter of the climb, the last exactly the sill height. */
const RAMP_STEPS: readonly { readonly key: string; readonly height: number; readonly z: number }[] = Object.freeze(
  [0.25, 0.5, 0.75, 1].map((f, i) => ({ key: `step${i + 1}`, height: Number((STARGATE_SILL_Y * f).toFixed(4)), z: Number((1.1 - i * 0.32).toFixed(4)) })),
);

/** The pedestal's pose: the console stands to the gate's right, its face toward the walker coming up the ramp. */
const PEDESTAL = { x: 2.3, z: 1.15 } as const;

const chevronParts = (): Record<string, Kit['parts'][string]> =>
  Object.fromEntries(
    Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => [
      `chevron${i}`,
      { source: { kind: 'box', size: [0.34, 0.1, 0.36] }, material: stargateChevronMaterial(i), rank: 1 },
    ]),
  );

const rampParts = (): Record<string, Kit['parts'][string]> =>
  Object.fromEntries(RAMP_STEPS.map((s) => [`ramp-${s.key}`, { source: { kind: 'box', size: [2.0, s.height, 0.34] }, material: RAMP_MATERIAL, rank: 0 }]));

const children = (): Placement[] => [
  { ref: 'plinth', key: 'plinth' },
  { ref: 'plinth-rim', key: 'plinth-rim', at: [0, STARGATE_PLINTH_H - 0.02, 0] },
  ...Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
    const pose = stargateSegmentPose(i);
    return { ref: 'ring-segment', key: `segment${i}`, at: pose.at, rot: pose.rot };
  }),
  ...Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
    const pose = stargateChevronPose(i);
    return { ref: 'chevron-backing', key: `backing${i}`, at: pose.at, rot: pose.rot };
  }),
  ...Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
    const pose = stargateChevronPose(i, 0.12);
    return { ref: `chevron${i}`, key: `chevron${i}`, at: pose.at, rot: pose.rot };
  }),
  // the ramp climbs in 0.12 m steps to the sill, every block standing on the ground
  ...RAMP_STEPS.map((s) => ({ ref: `ramp-${s.key}`, key: `ramp-${s.key}`, at: [0, 0, s.z] as readonly [number, number, number] })),
  { ref: 'sill', key: 'sill', at: [0, 0, 0] },
  { ref: 'pedestal', key: 'pedestal', at: [PEDESTAL.x, 0, PEDESTAL.z] },
  { ref: 'pedestal-cap', key: 'cap', at: [PEDESTAL.x, 1.05, PEDESTAL.z] },
  { ref: 'dial-face', key: 'dial-face', at: [PEDESTAL.x, 0.62, round(PEDESTAL.z + 0.17)] },
  { ref: 'dial-lamp', key: 'dial-lamp', at: [PEDESTAL.x, 0.94, round(PEDESTAL.z + 0.18)] },
  { ref: 'anchor-bolt', key: 'bolts-front', at: [-1.4, STARGATE_PLINTH_H, 0.55], repeat: { count: 5, step: [0.7, 0, 0] } },
  { ref: 'anchor-bolt', key: 'bolts-back', at: [-1.4, STARGATE_PLINTH_H, -0.55], repeat: { count: 5, step: [0.7, 0, 0] } },
];

const sockets = (): Record<string, SocketDef> => {
  const out: Record<string, SocketDef> = {
    gateway: { at: [0, STARGATE_RING_CENTRE_Y, 0] },
    iris: { at: [0, STARGATE_RING_CENTRE_Y, 0] },
    ramp: { at: [0, 0, 1.11] },
    dial: { at: [PEDESTAL.x, 1.1, PEDESTAL.z] },
  };
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i += 1) out[`chevron${i}`] = { at: stargateChevronPose(i).at };
  return out;
};

/** The gate with every module on it and no iris: an open gate. */
export const STARGATE_KIT: Kit = Object.freeze({
  parts: {
    plinth: { source: { kind: 'box', size: [3.5, STARGATE_PLINTH_H, 1.3] }, material: IRIS_MATERIAL, rank: 0 },
    'plinth-rim': { source: { kind: 'box', size: [3.54, 0.04, 1.34] }, material: 'accent-hardware', rank: 1 },
    // a bevelled panel per segment: its bevel runs round the segment's perimeter, so the annulus has radial bevels
    'ring-segment': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: STARGATE_SEGMENT_WIDTH, depth: STARGATE_RING_DEPTH, thickness: STARGATE_SEGMENT_RADIAL, bevel: 0.05, seam: 0, boltsPerSide: 2, boltHead: 0.03 },
      },
      material: SEGMENT_MATERIAL,
      rank: 0,
    },
    // each chevron: a dark backing plate on the segment, with its own lamp in front of it
    'chevron-backing': { source: { kind: 'box', size: [0.4, 0.12, 0.42] }, material: CHEVRON_BACKING, rank: 1 },
    ...chevronParts(),
    ...rampParts(),
    sill: { source: { kind: 'box', size: [2.0, STARGATE_SILL_Y, 0.34] }, material: 'hull-steel', rank: 0 },
    pedestal: {
      source: { kind: 'param', gen: 'can', params: { width: 0.44, depth: 0.44, height: 1.05, bevel: 0.03, plinthHeight: 0.06, plinthInset: 0.02, topLip: 0.02 } },
      material: SEGMENT_MATERIAL,
      rank: 0,
      sockets: { dial: { at: [0, 1.05, 0] } },
    },
    'pedestal-cap': { source: { kind: 'box', size: [0.5, 0.05, 0.5] }, material: 'accent-hardware', rank: 1 },
    'dial-face': { source: { kind: 'param', gen: 'grille', params: { width: 0.34, height: 0.26 } }, material: 'hopper-slate', rank: 1 },
    'dial-lamp': { source: { kind: 'box', size: [0.16, 0.09, 0.05] }, material: STARGATE_DIAL_LAMP, rank: 1 },
    'anchor-bolt': { source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.04, headHeight: 0.02, shankLength: 0 } }, material: 'accent-hardware', rank: 2 },
    // the iris shield: a `can` turned on its side, its face the aperture's
    iris: {
      source: { kind: 'param', gen: 'can', params: { width: STARGATE_APERTURE_R * 2, depth: STARGATE_APERTURE_R * 2, height: 0.06, bevel: 0.01 } },
      material: IRIS_MATERIAL,
      rank: 1,
    },
    'iris-hub': { source: { kind: 'param', gen: 'can', params: { width: 0.26, depth: 0.26, height: 0.05 } }, material: IRIS_TRIM, rank: 2 },
  },
  assemblies: { [STARGATE_PRESET]: { children: children(), sockets: sockets() } },
} as Kit);

/**
 * The gate as it stands with `access` set: the iris disc and its hub are added across the aperture for `'closed'` and
 * `'code-only'`, and left out for `'open'` (the rule is `stargateIrisClosed`). Everything else is the same kit, so opening and
 * closing the iris never disturbs a part or material override already on the ring.
 */
export function stargateKit(access: GateAccessMode): Kit {
  if (!stargateIrisClosed(access)) return STARGATE_KIT;
  const assembly = STARGATE_KIT.assemblies[STARGATE_PRESET]!;
  const built = assembly.children;
  // the iris goes in after the ring and before the ramp: nothing it can crowd
  const at = built.findIndex((c) => c.key === 'ramp-step1');
  const iris: Placement[] = [
    // a 90-degree x-turn stands the disc up in the aperture
    { ref: 'iris', key: 'iris', at: [0, STARGATE_RING_CENTRE_Y, -0.03], rot: [90, 0, 0] },
    { ref: 'iris-hub', key: 'iris-hub', at: [0, STARGATE_RING_CENTRE_Y, 0.03], rot: [90, 0, 0] },
  ];
  return {
    parts: { ...STARGATE_KIT.parts },
    assemblies: {
      ...STARGATE_KIT.assemblies,
      [STARGATE_PRESET]: {
        ...assembly,
        children: at < 0 ? [...built, ...iris] : [...built.slice(0, at), ...iris, ...built.slice(at)],
      },
    },
  };
}
