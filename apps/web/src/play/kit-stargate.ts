/**
 * The Quantum Archway Stargate as a **modular kit** (plan 42 section 4.3, PLAN-42-GATE): the plot's own gate, built from
 * `@hm/partgen` parts on `@hm/kitspec` sockets and dressed in `@hm/matstack` presets, so a player retunes it with the same
 * Part, Material and Light cartridges the beam fires at every other machine.
 *
 * The frame, in the kit's own space: base centre at the origin, y up, the ring in the XY plane, its face toward +z.
 *  - `plinth` — the grounded pad the annulus stands on;
 *  - `ring-segment` x 9 — a bevelled `panel` per segment, each tangent to the ring, so the annulus is nine radial bevels
 *    with 40-degree seams between them. The fold-aware edge wear in `@hm/matstack`'s `mask-mesh` keeps each bevel's wear
 *    band full width and narrows each seam's, which is what makes the ring read as machined metal rather than as facets;
 *  - `chevron0..8` — one lamp per segment, each with its own Kelvin so the nine stay nine meshes (the dial lights them in
 *    order; `stargateChevronSlot` maps the six-symbol dial onto the physical nine);
 *  - the ramp — three grounded blocks climbing to the landing, which stands on the plinth at the aperture's sill;
 *  - the dialing `pedestal` — a `can` console with a `grille` face and a status lamp, the thing a player stands at to dial;
 *  - the `iris` — the shield that closes across the aperture. It is present only when the gate is not open
 *    (`stargateKit('code-only')` / `stargateKit('closed')`); `stargateIrisClosed(access)` is the single rule.
 *
 * Sizing (measured off `flatten(stargateKit('open'))`): the annulus is 3.04 m across and rises 3.26 m, the chevrons reach
 * 3.44 m, and the aperture is 2.64 m across with its sill 0.42 m above the ground. With the dialing pedestal the whole kit
 * boxes 4.02 x 3.39 x 1.97 m — the pedestal, not the ring, is what makes it wider than it is tall.
 */
import type { Kit, Placement, SocketDef } from '@hm/kitspec';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';

/** The assembly name: what `buildKitPreset` and the beam's overrides key on. */
export const STARGATE_PRESET = 'stargate';

/** Physical chevrons around the ring. The dial uses six symbols (plan 42 section 4.3); the ring carries nine, as a Stargate does. */
export const STARGATE_CHEVRON_COUNT = 9;

/** The ring's centreline radius (m), the radial thickness of a segment, and the ring's depth along z. */
export const STARGATE_RING_RADIUS = 1.42;
export const STARGATE_SEGMENT_RADIAL = 0.2;
export const STARGATE_RING_DEPTH = 0.34;
/** The plinth's height, and the ring's centre height above the ground. */
export const STARGATE_PLINTH_H = 0.22;
export const STARGATE_RING_CENTRE_Y = STARGATE_PLINTH_H + STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2;
/** The aperture: its radius (2.64 m across) and the height of its sill, which the ramp climbs to. */
export const STARGATE_APERTURE_R = STARGATE_RING_RADIUS - STARGATE_SEGMENT_RADIAL / 2;
export const STARGATE_SILL_Y = STARGATE_RING_CENTRE_Y - STARGATE_APERTURE_R;

/** The six-symbol dial lights six of the nine chevrons, bottom pair first and outward: never three of them twice. */
export const STARGATE_DIAL_CHEVRONS: readonly number[] = Object.freeze([0, 2, 3, 5, 6, 8]);

/** The chevron a dial symbol lights (0..5 in), wrapped: the physical ring has more chevrons than the code has symbols. */
export function stargateChevronSlot(slot: number): number {
  const n = STARGATE_DIAL_CHEVRONS.length;
  const i = ((Math.trunc(slot) % n) + n) % n;
  return STARGATE_DIAL_CHEVRONS[i] as number;
}

/** A chevron lamp's light cartridge: a steady amber, one Kelvin step per chevron so the nine merge separately. */
export const stargateChevronMaterial = (index: number): string => `lx:${2400 + (index % STARGATE_CHEVRON_COUNT)}:1.25:steady`;

/** The dialing pedestal's status lamp: a slow pulse, warmer than the chevrons. */
export const STARGATE_DIAL_LAMP = 'lx:5200:1.4:pulse';

/** The single rule the world, the kit and the scene share: the iris is shut for everything but an open gate. */
export function stargateIrisClosed(access: GateAccessMode): boolean {
  return access !== 'open';
}

/**
 * The nonagon's chord on the ring's **outer** edge: a straight segment is widest at the outside, so that is the width
 * that closes the annulus. At the inner edge the same segments overlap a little, which is how butted panels meet.
 */
export const STARGATE_CHORD = 2 * (STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2) * Math.sin(Math.PI / STARGATE_CHEVRON_COUNT);
/** The segment's own width: the chord plus a hair, so the annulus closes instead of meeting at points. */
export const STARGATE_SEGMENT_WIDTH = STARGATE_CHORD + 0.012;

/** The ramp's three grounded treads, front to back: each stands on the ground at its own height (0.12, 0.24, 0.36 m). */
const RAMP: readonly { readonly key: string; readonly ref: string; readonly at: readonly [number, number, number] }[] = [
  { key: 'ramp-step1', ref: 'ramp-tread1', at: [0, 0, 1.31] },
  { key: 'ramp-step2', ref: 'ramp-tread2', at: [0, 0, 0.99] },
  { key: 'ramp-step3', ref: 'ramp-tread3', at: [0, 0, 0.67] },
];

/** Where the dialing pedestal stands (left of the ramp as you walk up: +x, +z). */
export const STARGATE_PEDESTAL_AT: readonly [number, number, number] = Object.freeze([2.05, 0, 1.0]);

/**
 * One segment's pose on the ring: its origin on the annulus's outer edge, so the panel grows inward by its radial
 * thickness, turned so its width runs along the ring's tangent at `angle` (0 at the bottom, counter-clockwise).
 */
export function stargateSegmentPose(index: number): { readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number] } {
  const angle = (index % STARGATE_CHEVRON_COUNT) * (2 * Math.PI / STARGATE_CHEVRON_COUNT);
  const r = STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2;
  return {
    at: [r * Math.sin(angle), STARGATE_RING_CENTRE_Y - r * Math.cos(angle), 0],
    rot: [0, 0, angle * (180 / Math.PI)],
  };
}

/** A chevron's pose: its origin on the segment's outer face, growing outward by `thickness`. */
export function stargateChevronPose(index: number, thickness = 0.12): { readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number] } {
  const angle = (index % STARGATE_CHEVRON_COUNT) * (2 * Math.PI / STARGATE_CHEVRON_COUNT);
  const r = STARGATE_RING_RADIUS + STARGATE_SEGMENT_RADIAL / 2 + thickness;
  return {
    at: [r * Math.sin(angle), STARGATE_RING_CENTRE_Y - r * Math.cos(angle), 0],
    rot: [0, 0, angle * (180 / Math.PI)],
  };
}

/** The nine chevron placements (each a backing and its own lamp). */
const CHEVRONS: readonly Placement[] = Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
  const pose = stargateChevronPose(i);
  return { ref: 'chevron', key: `chevron${i}`, at: pose.at, rot: pose.rot } satisfies Placement;
});

/** The nine ring segments, each turned onto its own tangent. */
const SEGMENTS: readonly Placement[] = Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
  const pose = stargateSegmentPose(i);
  return { ref: 'ring-segment', key: `segment${i}`, at: pose.at, rot: pose.rot } satisfies Placement;
});

/** The sockets the gate exposes to whatever hangs off it (the portal, the iris, a lamp strip, a sign). */
const SOCKETS: Readonly<Record<string, SocketDef>> = Object.freeze({
  /** The middle of the aperture: where a portal, a scan ring or a world marker is anchored. */
  gateway: { at: [0, STARGATE_RING_CENTRE_Y, 0] },
  /** The iris's own centre, behind the aperture (a light appears in front of the shield here). */
  iris: { at: [0, STARGATE_RING_CENTRE_Y, -0.03] },
  /** The top of the dialing pedestal: its console screen. */
  dial: { at: [STARGATE_PEDESTAL_AT[0], 1.12, STARGATE_PEDESTAL_AT[2]] },
  /** The foot of the ramp, where a player starts walking up. */
  ramp: { at: [0, 0, 1.47] },
  ...Object.fromEntries(Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
    const pose = stargateChevronPose(i);
    return [`chevron${i}`, { at: pose.at }];
  })),
});

/**
 * The gate as a kit. Every part is a `@hm/partgen` primitive (a `panel` segment, a `can` pedestal, a `grille` dial face,
 * `bolt`s around the plinth), so a Part cartridge has something to retune on each of them, and the materials are the
 * trim palette (`hull-steel`, `accent-hardware`, `khaki-paint`, `hopper-slate`) plus one `lx:` cartridge per lamp.
 */
export const STARGATE_KIT: Kit = {
  parts: {
    // ---- the pad the ring stands on
    plinth: { source: { kind: 'box', size: [3.3, STARGATE_PLINTH_H, 0.8] }, material: 'hull-steel', rank: 0 },
    'plinth-hazard': { source: { kind: 'box', size: [3.3, 0.06, 0.06] }, material: 'khaki-paint', rank: 1 },
    // ---- the annulus: nine bevelled segments
    'ring-segment': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: {
          width: STARGATE_SEGMENT_WIDTH,
          depth: STARGATE_RING_DEPTH,
          thickness: STARGATE_SEGMENT_RADIAL,
          bevel: 0.045,
          seam: 0.03,
          boltsPerSide: 2,
          boltHead: 0.03,
        },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 0,
    },
    // ---- the chevrons: a housing and its own lamp (one part per lamp, so the dial can light them one by one)
    chevron: { source: { kind: 'box', size: [0.4, 0.12, 0.44] }, material: 'accent-hardware', rank: 1 },
    ...Object.fromEntries(Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => [
      `chevron-lamp${i}`,
      {
        source: { kind: 'box', size: [0.28, 0.06, 0.3] },
        material: stargateChevronMaterial(i),
        rank: 1,
      },
    ])),
    // ---- the ramp: painted treads at their own heights, and a steel threshold at the sill
    'ramp-tread1': { source: { kind: 'box', size: [2.0, 0.12, 0.32] }, material: 'khaki-paint', rank: 0 },
    'ramp-tread2': { source: { kind: 'box', size: [2.0, 0.24, 0.32] }, material: 'khaki-paint', rank: 0 },
    'ramp-tread3': { source: { kind: 'box', size: [2.0, 0.36, 0.32] }, material: 'khaki-paint', rank: 0 },
    'ramp-landing': { source: { kind: 'box', size: [2.0, 0.2, 1.0] }, material: 'accent-hardware', rank: 0 },
    // ---- the dialing pedestal
    pedestal: {
      source: { kind: 'param', gen: 'can', params: { width: 0.46, depth: 0.46, height: 1.05, bevel: 0.04, baseBand: 0.12, bands: 1 } },
      material: 'hopper-slate',
      slotMaterials: { body: 'hopper-slate', trim: 'accent-hardware', band: 'khaki-paint' },
      rank: 0,
    },
    'pedestal-cap': { source: { kind: 'box', size: [0.54, 0.05, 0.54] }, material: 'accent-hardware', rank: 1 },
    // the pedestal's status lamp: the pulse a player reads as "ready to dial"
    'dial-lamp': { source: { kind: 'box', size: [0.14, 0.08, 0.05] }, material: STARGATE_DIAL_LAMP, rank: 1 },
    'dial-face': {
      source: { kind: 'param', gen: 'grille', params: { width: 0.34, height: 0.26, depth: 0.05, frame: 0.04, slats: 6, slat: 0.012 } },
      material: 'accent-hardware',
      slotMaterials: { frame: 'accent-hardware', slats: 'hopper-slate' },
      rank: 1,
    },
    // ---- the iris (placed only when the gate is not open)
    'iris-plate': {
      source: { kind: 'param', gen: 'can', params: { width: 2 * STARGATE_APERTURE_R, depth: 2 * STARGATE_APERTURE_R, height: 0.05, bevel: 0.03, baseBand: 0.08, bands: 0 } },
      material: 'hopper-slate',
      slotMaterials: { body: 'hopper-slate', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
    },
    'iris-hub': { source: { kind: 'box', size: [0.34, 0.34, 0.5] }, material: 'accent-hardware', rank: 1 },
    'anchor-bolt': {
      source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.05, headHeight: 0.025, shankDia: 0.02, shankLength: 0, head: 1 } },
      material: 'accent-hardware',
      rank: 2,
    },
  },
  assemblies: {
    [STARGATE_PRESET]: {
      sockets: SOCKETS,
      children: [
        { ref: 'plinth', key: 'plinth' },
        { ref: 'plinth-hazard', key: 'plinth-hazard', at: [0, STARGATE_PLINTH_H - 0.06, 0.38] },
        // the annulus: nine segments, tangent to the ring
        ...SEGMENTS,
        // the chevrons, one per segment, and each one's lamp sitting on its outer face
        ...CHEVRONS,
        ...Array.from({ length: STARGATE_CHEVRON_COUNT }, (_, i) => {
          const pose = stargateChevronPose(i, 0.18);
          return { ref: `chevron-lamp${i}`, key: `chevron-lamp${i}`, at: pose.at, rot: pose.rot } satisfies Placement;
        }),
        // the ramp climbs from the ground to the landing, whose top is the aperture's sill
        ...RAMP.map((r) => ({ ref: r.ref, key: r.key, at: r.at })),
        { ref: 'ramp-landing', key: 'ramp-landing', at: [0, STARGATE_PLINTH_H, 0] },
        // the dialing pedestal
        { ref: 'pedestal', key: 'pedestal', at: STARGATE_PEDESTAL_AT },
        { ref: 'pedestal-cap', key: 'pedestal-cap', at: [STARGATE_PEDESTAL_AT[0], 1.05, STARGATE_PEDESTAL_AT[2]] },
        { ref: 'dial-face', key: 'dial-face', at: [STARGATE_PEDESTAL_AT[0], 0.66, STARGATE_PEDESTAL_AT[2] + 0.21] },
        { ref: 'dial-lamp', key: 'dial-lamp', at: [STARGATE_PEDESTAL_AT[0], 0.98, STARGATE_PEDESTAL_AT[2] + 0.21] },
        // four anchor bolts at the plinth's corners
        ...[
          [-1.4, 0.3], [1.4, 0.3], [-1.4, -0.3], [1.4, -0.3],
        ].map(([x, z], i) => ({ ref: 'anchor-bolt', key: `bolt${i}`, at: [x as number, STARGATE_PLINTH_H, z as number] as const } satisfies Placement)),
      ],
    },
  },
};

/**
 * The gate a plot's access state asks for: the kit above, plus the iris when the shield is shut. The iris is a `can` disc
 * laid across the aperture (turned onto the ring's plane) with a hub, so the shield has a bevelled rim and a centre.
 */
export function stargateKit(access: GateAccessMode): Kit {
  if (!stargateIrisClosed(access)) return STARGATE_KIT;
  const gate = STARGATE_KIT.assemblies[STARGATE_PRESET];
  if (!gate) return STARGATE_KIT;
  const iris: Placement[] = [
    // the disc's own y axis becomes the ring's depth: it lies flat in the gate's plane
    { ref: 'iris-plate', key: 'iris-plate', at: [0, STARGATE_RING_CENTRE_Y, -0.025], rot: [90, 0, 0] },
    { ref: 'iris-hub', key: 'iris-hub', at: [0, STARGATE_RING_CENTRE_Y - 0.17, -0.25] },
  ];
  return {
    parts: STARGATE_KIT.parts,
    assemblies: {
      ...STARGATE_KIT.assemblies,
      [STARGATE_PRESET]: { ...gate, children: [...gate.children, ...iris] },
    },
  };
}

/** The sockets a preset exposes, for the scene and the checks (an assembly-level read of the kit). */
export const STARGATE_SOCKETS: readonly string[] = Object.freeze(Object.keys(SOCKETS));
