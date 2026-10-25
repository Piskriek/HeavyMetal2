/**
 * `studio.kit.audit`: the anatomy standard (JOB-06b, `wheresryan22/anatomy`).
 *
 * `studio.kit.validate` answers "is this kit legal?" — references resolve, nothing floats, the machine sockets are there.
 * It does not answer "is this kit *buildable*?", which is the question a 40-part assembly written by an agent actually
 * raises: two brackets occupying the same space, a hose that ends in mid-air, a lever the beam can never reach, a conduit
 * that kinks across a moving joint. This module is that second gate, and it is descriptive rather than hopeful — every
 * answer is a measured number or a named pair of parts.
 *
 * Five checks, each pure and each deterministic in the kit:
 *
 *  1. `solidClearances` — every pair of placed parts that is not a declared socket joint, tested as an oriented box pair
 *     (separating-axis theorem) at rest, in the exploded view (`explode = 1.0`) and at 8 phases of the assembly's fastest
 *     `KitMotionSpec`. A pair whose interpenetration is deeper than `collisionM` is a violation, with the depth it reached.
 *  2. `looseEnds` — every placed part outside the preset's own root must be mounted: its origin on a declared socket of
 *     another part (or of the preset) within 0.25 mm, or its own box flush against another part's box, or its foot on the
 *     ground. `looseEnds === 0` is the gate, and every loose part is named with the gap it actually left.
 *  3. `terminals` — every pipe, conduit, hose or cable segment must end flush on a declared port, collar or hub: an end face
 *     inside a port-like part, or on a socket named for one. `terminals === 0`.
 *  4. `hingeBendRadius` — a flexible conduit that crosses a moving joint must route through a coaxial pivot clip, or its
 *     declared bend radius must satisfy `R >= 2r / sin^2(e - thetaMax)` for its own outer radius `r`, the elbow angle `e`
 *     it enters at, and the joint's maximum angular travel `thetaMax`.
 *  5. `orbitClearance24` — 24 spherical rays (15-degree azimuth and elevation steps) at every control lever, valve, dial and
 *     cartridge port, so the beam's two-stage AABB aim can actually reach what the machine offers. A target the plot can
 *     never hit is a cartridge slot that does not exist.
 *
 * The geometry is the same language `@hm/kitspec` flattens in: a part's box is its `sourceBounds` (a param part's rank-0
 * silhouette), placed by its matrix. Rotations are rigid, so an oriented box is a centre, three unit axes and three half
 * extents; nothing is tessellated and no triangle is ever touched, which is what lets the audit run on every machine in a
 * unit test. Pure: no DOM, no clock, no randomness — the same kit always gives the same report, byte for byte.
 */
import {
  flatten,
  presetSockets,
  sourceBounds,
  type Box3,
  type Kit,
  type KitMotionSpec,
  type Mat4,
  type Overrides,
  type PlacedPart,
  type Vec3,
} from './index';
import { evaluateKitMotion } from '@hm/kinematic';

// ------------------------------------------------------------------ the numbers the standard names

/** The mount tolerance: a part within a quarter of a millimetre of its socket or its neighbour is seated. */
export const LOOSE_END_TOLERANCE_M = 0.00025;

/** Phases of a declared motion the clearance sweep samples (the ticket's 8). */
export const MOTION_PHASES = 8;

/** How far the exploded view pushes each part out from the preset's centre, as a fraction of the preset's diagonal. */
export const EXPLODE_FRACTION = 0.06;

/** The orbit clearance sweep: 24 rays, 15-degree steps in azimuth and elevation. */
export const ORBIT_RAY_COUNT = 24;
export const ORBIT_STEP_DEG = 15;

/** A surface an orbit ray starts from, as a multiple of the preset's half-diagonal (at least `ORBIT_MIN_DISTANCE_M`). */
export const ORBIT_DISTANCE_FACTOR = 2.5;
export const ORBIT_MIN_DISTANCE_M = 1.5;

/** A target counts as reachable when this many of its 24 rays land on it first. */
export const ORBIT_MIN_CLEAR_RAYS = 3;

/** Parts whose ids name a conduit (a flexible run that has to end on a port and may have to bend). */
const CONDUIT_PATTERN = /(^|[-_])(pipe|conduit|cable|hose|sleeve|lead)($|[-_])/i;

/** Parts whose ids name a port, collar, hub, flange or fitting: what a conduit is allowed to end on. */
const PORT_PATTERN = /(^|[-_])(port|collar|hub|flange|manifold|fitting|inlet|outlet|terminal|gland)($|[-_])/i;

/** Parts that hold a conduit at a joint (a coaxial pivot clip or a saddle clamp): a bend-radius exemption. */
const PIVOT_PATTERN = /(^|[-_])(clip|clamp|pivot|saddle|gland)($|[-_])/i;

/** Parts a beam is expected to reach: what the controls group of a machine offers a cartridge. */
const TARGET_PATTERN = /(^|[-_])(lever|valve|dial|port|cartridge|console|gauge|switch|handle|wheel|breaker|lamp)($|[-_])/i;

/** A socket name that declares a port, collar or hub (what `terminals` accepts as a flush end). */
const PORT_SOCKET_PATTERN = /(port|collar|hub|flange|inlet|outlet|terminal|gland|mount)/i;

// ------------------------------------------------------------------ small vector and matrix helpers

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaled = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lengthOf = (a: Vec3): number => Math.sqrt(dot(a, a));
const distance = (a: Vec3, b: Vec3): number => lengthOf(sub(a, b));
const round = (n: number, places = 6): number => {
  const k = 10 ** places;
  return Math.round(n * k) / k;
};

/** A point's world position under a column-major 4x4 (three.js `Matrix4.elements`). */
export function pointOf(m: Mat4, p: Vec3): Vec3 {
  return [
    (m[0] as number) * p[0] + (m[4] as number) * p[1] + (m[8] as number) * p[2] + (m[12] as number),
    (m[1] as number) * p[0] + (m[5] as number) * p[1] + (m[9] as number) * p[2] + (m[13] as number),
    (m[2] as number) * p[0] + (m[6] as number) * p[1] + (m[10] as number) * p[2] + (m[14] as number),
  ];
}

/** The three columns of a matrix as vectors (the part's own axes in the preset's frame). */
const columns = (m: Mat4): [Vec3, Vec3, Vec3] => [
  [m[0] as number, m[1] as number, m[2] as number],
  [m[4] as number, m[5] as number, m[6] as number],
  [m[8] as number, m[9] as number, m[10] as number],
];

const RAD_PER_DEG = Math.PI / 180;
const cosSinDeg = (deg: number): [number, number] => {
  const q = ((deg % 360) + 360) % 360;
  if (q === 0) return [1, 0];
  if (q === 90) return [0, 1];
  if (q === 180) return [-1, 0];
  if (q === 270) return [0, -1];
  return [Math.cos(q * RAD_PER_DEG), Math.sin(q * RAD_PER_DEG)];
};

/** The matrix a motion offset adds to a part's own pose: a translation of `posOffset` and an XYZ Euler turn of `rotOffset` (radians). */
export function motionMatrix(m: Mat4, motion: KitMotionSpec, timeSec: number, stage = 6): Mat4 {
  const { posOffset, rotOffset } = evaluateKitMotion(motion, timeSec, 1, stage);
  if (posOffset.every((v) => Math.abs(v) < 1e-12) && rotOffset.every((v) => Math.abs(v) < 1e-12)) return m;
  const [rx, ry, rz] = rotOffset.map((r) => r / RAD_PER_DEG) as [number, number, number];
  const [ca, sa] = cosSinDeg(rx);
  const [cb, sb] = cosSinDeg(ry);
  const [cc, sc] = cosSinDeg(rz);
  // Rx * Ry * Rz, the same order @hm/kitspec's `rotation` uses (three.js 'XYZ')
  const r: Mat4 = [
    cb * cc, ca * sc + sa * sb * cc, sa * sc - ca * sb * cc, 0,
    -cb * sc, ca * cc - sa * sb * sc, sa * cc + ca * sb * sc, 0,
    sb, -sa * cb, ca * cb, 0,
    0, 0, 0, 1,
  ];
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += (m[k * 4 + row] as number) * (r[col * 4 + k] as number);
      out[col * 4 + row] = s;
    }
  }
  out[12] = (out[12] as number) + posOffset[0];
  out[13] = (out[13] as number) + posOffset[1];
  out[14] = (out[14] as number) + posOffset[2];
  return out;
}

/** A part's pose pushed straight out from `centre` by `amount` times the preset's diagonal: the exploded view. */
export function explodedMatrix(m: Mat4, centre: Vec3, amount: number, diagonal: number): Mat4 {
  const p = pointOf(m, [0, 0, 0]);
  const away = sub(p, centre);
  const d = lengthOf(away);
  if (d < 1e-9 || amount === 0) return m;
  const offset = scaled(away, (amount * EXPLODE_FRACTION * diagonal) / d);
  const out = [...m];
  out[12] = (m[12] as number) + offset[0];
  out[13] = (m[13] as number) + offset[1];
  out[14] = (m[14] as number) + offset[2];
  return out;
}

// ------------------------------------------------------------------ oriented boxes

/** An oriented box: a centre, three unit axes and a half extent along each. */
export interface Obb {
  readonly centre: Vec3;
  readonly axes: readonly [Vec3, Vec3, Vec3];
  readonly half: Vec3;
}

/** The oriented box of a local box placed by `m`. A rigid pose keeps the half extents; a scale (a mirrored or scaled kit) is folded into them. */
export function obbOf(box: Box3, m: Mat4): Obb {
  const centreLocal: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const halfLocal: Vec3 = [(box.max[0] - box.min[0]) / 2, (box.max[1] - box.min[1]) / 2, (box.max[2] - box.min[2]) / 2];
  const cols = columns(m);
  const axes: Vec3[] = [];
  const half: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const c = cols[i] as Vec3;
    const l = lengthOf(c);
    axes.push(l > 1e-12 ? scaled(c, 1 / l) : [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
    half.push((halfLocal[i] as number) * (l > 1e-12 ? l : 1));
  }
  return { centre: pointOf(m, centreLocal), axes: axes as unknown as [Vec3, Vec3, Vec3], half: half as unknown as Vec3 };
}

/** A box's eight corners in the preset's frame. */
export function cornersOf(box: Box3, m: Mat4): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < 8; i += 1) {
    out.push(
      pointOf(m, [
        i & 1 ? box.max[0] : box.min[0],
        i & 2 ? box.max[1] : box.min[1],
        i & 4 ? box.max[2] : box.min[2],
      ]),
    );
  }
  return out;
}

const nearlyZero = (a: Vec3): boolean => lengthOf(a) < 1e-9;

/** The 15 separating axes of two oriented boxes, normalised, with near-duplicates dropped. */
function satAxes(a: Obb, b: Obb): Vec3[] {
  const out: Vec3[] = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) {
    const c = cross(x, y);
    if (!nearlyZero(c)) out.push(scaled(c, 1 / lengthOf(c)));
  }
  const kept: Vec3[] = [];
  for (const axis of out) {
    if (!kept.some((k) => Math.abs(dot(k, axis)) > 1 - 1e-9)) kept.push(axis);
  }
  return kept;
}

const projectedRadius = (o: Obb, axis: Vec3): number =>
  Math.abs(dot(o.axes[0], axis)) * o.half[0] +
  Math.abs(dot(o.axes[1], axis)) * o.half[1] +
  Math.abs(dot(o.axes[2], axis)) * o.half[2];

/**
 * Two oriented boxes against the separating-axis theorem. `penetration` is the deepest overlap found (0 or less when the
 * boxes are apart) and `separation` the widest gap between them (0 when they touch or overlap), so one call answers both
 * "do they collide?" and "how far apart are they?".
 */
export function obbPair(a: Obb, b: Obb): { readonly penetration: number; readonly separation: number } {
  const d = sub(b.centre, a.centre);
  let best = Number.POSITIVE_INFINITY; // the smallest overlap over the axes
  let apart = 0; // the largest gap over the axes: the boxes are apart by at least this
  for (const axis of satAxes(a, b)) {
    const distanceOnAxis = Math.abs(dot(d, axis));
    const ra = projectedRadius(a, axis);
    const rb = projectedRadius(b, axis);
    const overlap = ra + rb - distanceOnAxis;
    if (overlap < best) best = overlap;
    if (-overlap > apart) apart = -overlap;
  }
  return { penetration: best, separation: apart };
}

/** Whether a point is inside an oriented box, grown by `grow` on every side. */
export function obbContains(o: Obb, p: Vec3, grow = 0): boolean {
  const d = sub(p, o.centre);
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(dot(d, o.axes[i] as Vec3)) > (o.half[i] as number) + grow) return false;
  }
  return true;
}

/** Where a ray enters an oriented box, or null when it misses (the same slab test as `kit-target.ts`, on an oriented box). */
export function rayObbEntry(origin: Vec3, dir: Vec3, o: Obb, maxDistance = Number.POSITIVE_INFINITY): number | null {
  let t0 = 0;
  let t1 = maxDistance;
  const d = sub(origin, o.centre);
  for (let i = 0; i < 3; i += 1) {
    const axis = o.axes[i] as Vec3;
    const oi = dot(d, axis);
    const di = dot(dir, axis);
    const h = o.half[i] as number;
    if (Math.abs(di) < 1e-12) {
      if (Math.abs(oi) > h) return null;
      continue;
    }
    const inv = 1 / di;
    let near = (-h - oi) * inv;
    let far = (h - oi) * inv;
    if (near > far) {
      const t = near;
      near = far;
      far = t;
    }
    if (near > t0) t0 = near;
    if (far < t1) t1 = far;
    if (t0 > t1) return null;
  }
  return t0;
}

// ------------------------------------------------------------------ what the kit declares

/** One placed part as the audit sees it: its path, its part id, its local box and the box in the preset's frame. */
export interface AuditedPart {
  readonly path: string;
  readonly part: string;
  readonly box: Box3;
  readonly obb: Obb;
  readonly placed: PlacedPart;
  readonly motion: KitMotionSpec | null;
}

/** A declared attachment: which placed part is bolted onto which placed part's socket. */
export interface Attachment {
  readonly child: string;
  readonly parent: string;
  readonly socket: string;
}

const keyOf = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/**
 * The paths of every placement, its parent path and the socket it hangs on — `@hm/kitspec`'s own walk (children in
 * order, `key ?? ref#index`, repeats as `path[k]`, assemblies recursed) restricted to what a preset actually places, so a
 * declared joint can be told apart from two parts that merely share a socket position.
 */
export function attachmentsOf(kit: Kit, preset: string): Attachment[] {
  const out: Attachment[] = [];
  const stack: string[] = [];
  /** The paths one assembly's children produce, by child index and copy: what `on.child` refers to. */
  const walk = (id: string, prefix: string): void => {
    const asm = kit.assemblies[id];
    if (!asm || stack.includes(id)) return;
    stack.push(id);
    const frames: string[][] = [];
    asm.children.forEach((c, i) => {
      const key = c.key ?? `${c.ref}#${i}`;
      const here = prefix ? `${prefix}/${key}` : key;
      const copies: string[] = [];
      frames.push(copies);
      const part = kit.parts[c.ref];
      const sub = kit.assemblies[c.ref];
      if (!part && !sub) return;
      const parentPath = c.on ? frames[c.on.child]?.[c.on.copy ?? 0] : undefined;
      if (c.on && !parentPath) return; // a broken parent: flatten skips it too, and validate() reports it
      const count = c.repeat && Number.isInteger(c.repeat.count) && c.repeat.count >= 1 ? c.repeat.count : 1;
      for (let k = 0; k < count; k += 1) {
        const path = count > 1 ? `${here}[${k}]` : here;
        copies.push(path);
        if (c.on && parentPath) out.push({ child: path, parent: parentPath, socket: c.on.socket });
        if (sub && !part) walk(c.ref, path);
      }
    });
    stack.pop();
  };
  walk(preset, '');
  return out;
}

/** Which of `kit.assemblies` the preset is, when the caller does not say: `main`, then `machine`, then the first assembly. */
export function defaultPreset(kit: Kit): string {
  const names = Object.keys(kit.assemblies);
  if (names.includes('main')) return 'main';
  if (names.includes('machine')) return 'machine';
  if (names.includes('mill')) return 'mill';
  return names[0] ?? '';
}

const isConduitPart = (id: string): boolean => CONDUIT_PATTERN.test(id);
const isPortPart = (id: string): boolean => PORT_PATTERN.test(id);
const isPivotPart = (id: string): boolean => PIVOT_PATTERN.test(id);

// ------------------------------------------------------------------ the report

/** A pair of parts that occupy the same space, and how deep (metres). */
export interface SolidCollision {
  readonly a: string;
  readonly b: string;
  /** `rest`, `exploded`, or `motion` with the phase index in `phase`. */
  readonly mode: 'rest' | 'exploded' | 'motion';
  readonly phase: number;
  readonly depth: number;
}

/** A part that is not mounted: no socket of a neighbour at its origin, no flush box, no foot on the ground. */
export interface LooseEnd {
  readonly path: string;
  readonly part: string;
  /** The smallest gap it left to anything it could have been mounted on (metres). */
  readonly gap: number;
  readonly why: string;
}

/** A conduit end that is not flush on a declared port, collar or hub. */
export interface TerminalIssue {
  readonly path: string;
  readonly part: string;
  readonly end: 'a' | 'b';
  readonly at: Vec3;
  readonly why: string;
}

/** A flexible conduit that crosses a moving joint without a coaxial clip and bends tighter than the joint allows. */
export interface BendIssue {
  readonly path: string;
  readonly part: string;
  readonly joint: string;
  readonly radiusM: number;
  readonly requiredM: number;
  readonly why: string;
}

/** A control the beam cannot reach from enough angles. */
export interface OrbitIssue {
  readonly path: string;
  readonly part: string;
  readonly clearRays: number;
  readonly rays: number;
  /** A few of the rays that were blocked, with what stood in the way. */
  readonly blocked: readonly { readonly azimuthDeg: number; readonly elevationDeg: number; readonly by: string }[];
}

export interface OrbitReport {
  readonly ok: boolean;
  /** The 24 directions, in the order they are cast. */
  readonly angles: readonly { readonly azimuthDeg: number; readonly elevationDeg: number }[];
  readonly targets: number;
  readonly rays: number;
  readonly failures: readonly OrbitIssue[];
}

export interface KitAuditReport {
  readonly ok: boolean;
  readonly preset: string;
  /** What could not be measured at all (an unknown preset, a kit that places nothing). */
  readonly problems: readonly string[];
  readonly solidClearances: readonly SolidCollision[];
  /** The gate: 0 is a fully mounted assembly. */
  readonly looseEnds: number;
  readonly loose: readonly LooseEnd[];
  /** The gate: 0 is every pipe and cable ending on a declared port. */
  readonly terminals: number;
  readonly terminalIssues: readonly TerminalIssue[];
  readonly hingeBendRadius: { readonly ok: boolean; readonly failures: readonly BendIssue[] };
  readonly orbitClearance24: OrbitReport;
  readonly parts: number;
  /** The parts the sweep found moving, and the phases it sampled them at. */
  readonly moving: readonly string[];
  readonly phases: number;
  readonly bounds: Box3 | null;
}

export interface AuditOptions {
  /** The assembly that is the whole machine (`defaultPreset` when absent). */
  readonly preset?: string;
  readonly overrides?: Overrides;
  /** Interpenetration deeper than this is a violation (metres; 2 mm by default). */
  readonly collisionM?: number;
  /** The mount tolerance for `looseEnds` (metres; 0.25 mm by default). */
  readonly socketToleranceM?: number;
  /** The exploded view's throw, 0..1 (the ticket's 1.0 by default). */
  readonly explode?: number;
  /** Motion phases to sample (8 by default). */
  readonly phases?: number;
  /** The Fidelity Stage the motion is quantised to (6: continuous). */
  readonly stage?: number;
  /** The ground the assembly stands on, for the "its foot is on the floor" mount. */
  readonly ground?: number;
  /** Part ids to treat as conduits, on top of the id pattern (`pipe`, `conduit`, `hose`, `cable`, `sleeve`, `lead`). */
  readonly conduits?: readonly string[];
  /** Part ids a beam must be able to reach, on top of the id pattern (levers, valves, dials, ports, consoles). */
  readonly targets?: readonly string[];
  /** A bend radius to assume for a conduit that does not declare `bendRadius` (metres); absent means "assume it passes". */
  readonly defaultBendRadiusM?: number;
  /** How many of the 24 rays must land on a target (3 by default). */
  readonly minClearRays?: number;
}

// ------------------------------------------------------------------ the five checks

function partsOf(kit: Kit, preset: string, overrides: Overrides | undefined): AuditedPart[] {
  return flatten(kit, preset, overrides).map((placed) => {
    const def = kit.parts[placed.part];
    const box: Box3 = def ? sourceBounds(placed.source) : { min: [0, 0, 0], max: [0, 0, 0] };
    return {
      path: placed.path,
      part: placed.part,
      box,
      obb: obbOf(box, placed.matrix),
      placed,
      motion: placed.motion ?? null,
    };
  });
}

/** Every socket a part or the preset declares, by `path.socket`, in the preset's frame. */
function socketPoints(kit: Kit, preset: string): { readonly owner: string; readonly name: string; readonly at: Vec3 }[] {
  const out: { owner: string; name: string; at: Vec3 }[] = [];
  for (const [key, s] of Object.entries(presetSockets(kit, preset))) {
    const cut = key.lastIndexOf('.');
    const owner = cut > 0 ? key.slice(0, cut) : '';
    const name = cut > 0 ? key.slice(cut + 1) : key;
    out.push({ owner, name, at: s.at });
  }
  return out;
}

const unionBox = (boxes: readonly Box3[]): Box3 | null => {
  if (boxes.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i += 1) {
      const k = i as 0 | 1 | 2;
      if ((b.min[k] as number) < min[k]) min[k] = b.min[k] as number;
      if ((b.max[k] as number) > max[k]) max[k] = b.max[k] as number;
    }
  }
  return { min, max };
};

/** The 24 orbit directions: an azimuth every 15 degrees, its elevation stepping -15, 0, +15 around the ring. */
export const ORBIT_ANGLES: readonly { readonly azimuthDeg: number; readonly elevationDeg: number }[] = Object.freeze(
  Array.from({ length: ORBIT_RAY_COUNT }, (_, i) => ({
    azimuthDeg: (i * ORBIT_STEP_DEG) % 360,
    elevationDeg: [-ORBIT_STEP_DEG, 0, ORBIT_STEP_DEG][i % 3] as number,
  })),
);

/** The unit direction of an orbit angle (azimuth about +y, 0 toward +z; elevation up from the horizon). */
export function orbitDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * RAD_PER_DEG;
  const el = elevationDeg * RAD_PER_DEG;
  const c = Math.cos(el);
  return [Math.sin(az) * c, Math.sin(el), Math.cos(az) * c];
}

/** The angular travel a joint's motion asks of a conduit, in radians, for a conduit of `armM` metres spanning it. */
export function jointTravelRad(spec: KitMotionSpec, armM: number): number {
  switch (spec.kind) {
    case 'oscillate':
    case 'iris-aperture':
      return Math.abs(spec.amplitude);
    case 'reciprocate':
    case 'gantry-slide':
      return Math.atan2(Math.abs(spec.amplitude), Math.max(armM, 1e-3));
    case 'spin':
      return Math.PI * 2; // a full turn: nothing flexible survives it without a clip
  }
}

/**
 * The bend radius a conduit needs at a joint: `R >= 2r / sin^2(e - thetaMax)`, with `r` its outer radius, `e` the elbow
 * angle it enters the joint at and `thetaMax` the joint's maximum angular travel. A travel that swallows the elbow
 * (e - thetaMax <= 0) is unsatisfiable: the conduit must be held in a coaxial clip instead.
 */
export function requiredBendRadius(outerRadiusM: number, elbowRad: number, travelRad: number): number {
  const s = Math.sin(elbowRad - travelRad);
  if (!(Math.abs(s) > 1e-6)) return Number.POSITIVE_INFINITY;
  return (2 * outerRadiusM) / (s * s);
}

/** Every pair of placed parts that shares the preset but is not a declared joint: what the clearance sweep tests. */
function testPairs(parts: readonly AuditedPart[], attachments: readonly Attachment[]): [AuditedPart, AuditedPart][] {
  const joints = new Set(attachments.map((a) => keyOf(a.child, a.parent)));
  const out: [AuditedPart, AuditedPart][] = [];
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i] as AuditedPart;
      const b = parts[j] as AuditedPart;
      // a part's own mount (its socket ancestor) is a joint; a part and its own child too
      if (joints.has(keyOf(a.path, b.path))) continue;
      // a part and its own subtree are one another's anchors, never a clearance pair
      if (b.path.startsWith(`${a.path}/`) || a.path.startsWith(`${b.path}/`)) continue;
      out.push([a, b]);
    }
  }
  return out;
}

function clearanceSweep(
  parts: readonly AuditedPart[],
  attachments: readonly Attachment[],
  centre: Vec3,
  diagonal: number,
  collisionM: number,
  explode: number,
  phases: number,
  stage: number,
): { collisions: SolidCollision[]; moving: string[]; phaseTimes: number[] } {
  const collisions: SolidCollision[] = [];
  const pairs = testPairs(parts, attachments);
  const report = (a: string, b: string, mode: 'rest' | 'exploded' | 'motion', phase: number, depth: number): void => {
    if (depth <= collisionM) return;
    collisions.push({ a, b, mode, phase, depth: round(depth) });
  };

  // 1. at rest
  for (const [a, b] of pairs) report(a.path, b.path, 'rest', 0, obbPair(a.obb, b.obb).penetration);

  // 2. exploded
  if (explode > 0) {
    const boxes = new Map(parts.map((p) => [p.path, obbOf(p.box, explodedMatrix(p.placed.matrix, centre, explode, diagonal))]));
    for (const [a, b] of pairs) {
      const oa = boxes.get(a.path);
      const ob = boxes.get(b.path);
      if (oa && ob) report(a.path, b.path, 'exploded', 0, obbPair(oa, ob).penetration);
    }
  }

  // 3. the declared motion, at `phases` points of the assembly's fastest cycle
  const moving = parts.filter((p) => p.motion !== null);
  const fastest = moving.reduce((r, p) => Math.max(r, p.motion?.rateHz ?? 0), 0);
  const period = fastest > 0 ? 1 / fastest : 0;
  const phaseTimes = period > 0 ? Array.from({ length: phases }, (_, i) => (i / phases) * period) : [];
  if (period > 0) {
    const movingPaths = moving.map((p) => p.path);
    const movingPairs = pairs.filter(([a, b]) => a.motion !== null || b.motion !== null);
    for (let i = 0; i < phaseTimes.length; i += 1) {
      const t = phaseTimes[i] as number;
      const boxes = new Map<string, Obb>();
      for (const p of moving) boxes.set(p.path, obbOf(p.box, motionMatrix(p.placed.matrix, p.motion as KitMotionSpec, t, stage)));
      for (const [a, b] of movingPairs) {
        const oa = boxes.get(a.path) ?? a.obb;
        const ob = boxes.get(b.path) ?? b.obb;
        report(a.path, b.path, 'motion', i, obbPair(oa, ob).penetration);
      }
    }
    return { collisions, moving: movingPaths, phaseTimes };
  }
  return { collisions, moving: [], phaseTimes };
}

function looseSweep(
  parts: readonly AuditedPart[],
  sockets: readonly { readonly owner: string; readonly name: string; readonly at: Vec3 }[],
  tolerance: number,
  ground: number,
): LooseEnd[] {
  const loose: LooseEnd[] = [];
  for (const p of parts) {
    const origin = pointOf(p.placed.matrix, [0, 0, 0]);
    // (a) a socket of another part (or of the preset itself) at this part's origin: it is mounted
    const onSocket = sockets.some((s) => s.owner !== p.path && !s.owner.startsWith(`${p.path}/`) && distance(s.at, origin) <= tolerance);
    if (onSocket) continue;
    // (b) its own box flush against something else's box
    let gap = Number.POSITIVE_INFINITY;
    for (const other of parts) {
      if (other.path === p.path) continue;
      if (other.path.startsWith(`${p.path}/`) || p.path.startsWith(`${other.path}/`)) continue;
      const s = obbPair(p.obb, other.obb).separation;
      if (s < gap) gap = s;
      if (gap <= tolerance) break;
    }
    // (c) its foot on the ground: the floor is a mount
    const footY = Math.min(...cornersOf(p.box, p.placed.matrix).map((c) => c[1]));
    if (footY <= ground + tolerance) continue;
    if (gap <= tolerance) continue;
    loose.push({
      path: p.path,
      part: p.part,
      gap: round(Number.isFinite(gap) ? gap : footY - ground),
      why: `no socket at its origin and its nearest neighbour is ${(Number.isFinite(gap) ? gap * 1000 : 0).toFixed(2)} mm away`,
    });
  }
  return loose;
}

function terminalSweep(
  kit: Kit,
  parts: readonly AuditedPart[],
  sockets: readonly { readonly owner: string; readonly name: string; readonly at: Vec3 }[],
  tolerance: number,
  extraConduits: readonly string[],
): { terminalIssues: TerminalIssue[]; bendFailures: BendIssue[]; portPairs: Attachment[] } {
  const terminalIssues: TerminalIssue[] = [];
  const bendFailures: BendIssue[] = [];
  const portPairs: Attachment[] = [];
  const conduits = parts.filter((p) => isConduitPart(p.part) || extraConduits.includes(p.part));
  for (const c of conduits) {
    // the long axis of a conduit is the axis it runs along; its two faces are the ends that have to land on a port
    const axisIndex = c.obb.half[0] >= c.obb.half[1] && c.obb.half[0] >= c.obb.half[2] ? 0 : c.obb.half[1] >= c.obb.half[2] ? 1 : 2;
    const axis = c.obb.axes[axisIndex] as Vec3;
    const half = c.obb.half[axisIndex] as number;
    const ends: { readonly end: 'a' | 'b'; readonly at: Vec3 }[] = [
      { end: 'a', at: add(c.obb.centre, scaled(axis, half)) },
      { end: 'b', at: sub(c.obb.centre, scaled(axis, half)) },
    ];
    const hosts: AuditedPart[] = [];
    for (const e of ends) {
      const portPart = parts.find(
        (p) => p.path !== c.path && (isPortPart(p.part) || (kit.parts[p.part]?.sockets && Object.keys(kit.parts[p.part]?.sockets ?? {}).some((n) => PORT_SOCKET_PATTERN.test(n)))) && obbContains(p.obb, e.at, tolerance),
      );
      const portSocket = sockets.find(
        (s) => s.owner !== c.path && PORT_SOCKET_PATTERN.test(s.name) && distance(s.at, e.at) <= Math.max(tolerance, 0.005),
      );
      if (portPart) {
        hosts.push(portPart);
        // a hose plugged into a port is a declared joint, not an interpenetration: the audit's clearance sweep must not
        // report the very contact the terminal check asked for
        portPairs.push({ child: c.path, parent: portPart.path, socket: `port:${e.end}` });
      }
      if (!portPart && !portSocket) {
        terminalIssues.push({
          path: c.path,
          part: c.part,
          end: e.end,
          at: e.at.map((v) => round(v, 4)) as unknown as Vec3,
          why: 'ends in mid-air: no port, collar or hub within tolerance',
        });
      }
    }
    // a conduit that crosses a moving joint: a coaxial clip exempts it, otherwise its bend radius has to survive the travel
    const joints = hosts.filter((h) => h.motion !== null);
    if (joints.length === 0) continue;
    const clippedBy = parts.find(
      (p) => p.path !== c.path && isPivotPart(p.part) && obbPair(p.obb, c.obb).penetration > -1e-3 && obbPair(p.obb, c.obb).separation <= tolerance,
    );
    if (clippedBy) continue;
    const crossSection = Math.min(...[0, 1, 2].map((i) => c.obb.half[i] as number).filter((_, i) => i !== axisIndex));
    const params = kit.parts[c.part]?.source;
    const declared = params?.kind === 'param' ? Number(params.params.bendRadius) : Number.NaN;
    const radius = Number.isFinite(declared) ? declared : undefined;
    const elbowDeg = params?.kind === 'param' && Number.isFinite(Number(params.params.elbowDeg)) ? Number(params.params.elbowDeg) : 90;
    for (const joint of joints) {
      const travel = jointTravelRad(joint.motion as KitMotionSpec, Math.max(c.obb.half[axisIndex] as number, 0.05));
      const required = requiredBendRadius(crossSection, elbowDeg * RAD_PER_DEG, travel);
      if (!Number.isFinite(required)) {
        bendFailures.push({
          path: c.path,
          part: c.part,
          joint: joint.path,
          radiusM: radius ?? Number.POSITIVE_INFINITY,
          requiredM: Number.POSITIVE_INFINITY,
          why: `the joint turns ${(travel / RAD_PER_DEG).toFixed(0)} deg against a ${elbowDeg} deg elbow: it needs a coaxial pivot clip`,
        });
        continue;
      }
      if (radius !== undefined && radius + 1e-9 < required) {
        bendFailures.push({
          path: c.path,
          part: c.part,
          joint: joint.path,
          radiusM: round(radius),
          requiredM: round(required),
          why: `bends at ${radius.toFixed(3)} m where the joint needs ${required.toFixed(3)} m (2r / sin^2(e - thetaMax))`,
        });
      }
    }
  }
  return { terminalIssues, bendFailures, portPairs };
}

function orbitSweep(
  parts: readonly AuditedPart[],
  _centre: Vec3,
  diagonal: number,
  extraTargets: readonly string[],
  minClearRays: number,
): OrbitReport {
  const targets = parts.filter((p) => TARGET_PATTERN.test(p.part) || extraTargets.includes(p.part));
  const reach = Math.max(ORBIT_MIN_DISTANCE_M, diagonal * ORBIT_DISTANCE_FACTOR);
  const failures: OrbitIssue[] = [];
  let rays = 0;
  for (const target of targets) {
    const aim = target.obb.centre;
    let clear = 0;
    const blocked: { azimuthDeg: number; elevationDeg: number; by: string }[] = [];
    for (const angle of ORBIT_ANGLES) {
      rays += 1;
      const dir = orbitDirection(angle.azimuthDeg, angle.elevationDeg);
      const origin = add(aim, scaled(dir, reach));
      const ray = scaled(dir, -1); // toward the target
      let bestT = Number.POSITIVE_INFINITY;
      let bestPart: AuditedPart | null = null;
      for (const p of parts) {
        const t = rayObbEntry(origin, ray, p.obb, reach * 2);
        if (t !== null && t < bestT) {
          bestT = t;
          bestPart = p;
        }
      }
      if (bestPart && (bestPart.path === target.path || bestPart.path.startsWith(`${target.path}/`))) clear += 1;
      else if (blocked.length < 4) blocked.push({ ...angle, by: bestPart?.path ?? 'nothing' });
    }
    if (clear < minClearRays) failures.push({ path: target.path, part: target.part, clearRays: clear, rays: ORBIT_ANGLES.length, blocked });
  }
  return { ok: failures.length === 0, angles: ORBIT_ANGLES, targets: targets.length, rays, failures };
}

/**
 * The whole anatomy audit for one kit: the five checks, the gates they set and the two numbers an agent acts on
 * (`looseEnds`, `terminals`). Pure and deterministic; the report is the same for the same kit every time.
 */
export function kitAudit(kit: Kit, options: AuditOptions = {}): KitAuditReport {
  const preset = options.preset ?? defaultPreset(kit);
  const problems: string[] = [];
  const collisionM = options.collisionM ?? 0.002;
  const tolerance = options.socketToleranceM ?? LOOSE_END_TOLERANCE_M;
  const phases = Math.max(1, Math.trunc(options.phases ?? MOTION_PHASES));
  const explode = options.explode ?? 1;
  const stage = options.stage ?? 6;
  const ground = options.ground ?? 0;
  const extraConduits = options.conduits ?? [];
  const empty: KitAuditReport = {
    ok: false,
    preset,
    problems: ['nothing was measured'],
    solidClearances: [],
    looseEnds: 0,
    loose: [],
    terminals: 0,
    terminalIssues: [],
    hingeBendRadius: { ok: true, failures: [] },
    orbitClearance24: { ok: true, angles: ORBIT_ANGLES, targets: 0, rays: 0, failures: [] },
    parts: 0,
    moving: [],
    phases,
    bounds: null,
  };
  if (!preset || !kit.assemblies[preset]) {
    return { ...empty, problems: [`there is no assembly '${preset}' in the kit (it has ${Object.keys(kit.assemblies).join(', ') || 'none'})`] };
  }
  const parts = partsOf(kit, preset, options.overrides);
  if (parts.length === 0) return { ...empty, problems: [`the preset '${preset}' places no parts`] };

  const boxes = parts.map((p) => transformCorners(p));
  const bounds = unionBox(boxes);
  const centre: Vec3 = bounds
    ? [
        ((bounds.min[0] as number) + (bounds.max[0] as number)) / 2,
        ((bounds.min[1] as number) + (bounds.max[1] as number)) / 2,
        ((bounds.min[2] as number) + (bounds.max[2] as number)) / 2,
      ]
    : [0, 0, 0];
  const diagonal = bounds
    ? lengthOf([
        (bounds.max[0] as number) - (bounds.min[0] as number),
        (bounds.max[1] as number) - (bounds.min[1] as number),
        (bounds.max[2] as number) - (bounds.min[2] as number),
      ])
    : 1;

  const attachments = attachmentsOf(kit, preset);
  const sockets = socketPoints(kit, preset);
  // the terminal check runs first: a hose's flush end on a port is a declared joint, and the clearance sweep must skip it
  const { terminalIssues, bendFailures, portPairs } = terminalSweep(kit, parts, sockets, tolerance, extraConduits);
  const clearance = clearanceSweep(parts, [...attachments, ...portPairs], centre, diagonal, collisionM, explode, phases, stage);
  const loose = looseSweep(parts, sockets, tolerance, ground);
  const orbit = orbitSweep(parts, centre, diagonal, options.targets ?? [], options.minClearRays ?? ORBIT_MIN_CLEAR_RAYS);

  const ok = problems.length === 0 && clearance.collisions.length === 0 && loose.length === 0 && terminalIssues.length === 0 && bendFailures.length === 0 && orbit.ok;
  return {
    ok,
    preset,
    problems,
    solidClearances: clearance.collisions,
    looseEnds: loose.length,
    loose,
    terminals: terminalIssues.length,
    terminalIssues,
    hingeBendRadius: { ok: bendFailures.length === 0, failures: bendFailures },
    orbitClearance24: orbit,
    parts: parts.length,
    moving: clearance.moving,
    phases: clearance.phaseTimes.length || phases,
    bounds,
  };
}

/** A part's world axis-aligned box (the union of its eight placed corners). */
function transformCorners(p: AuditedPart): Box3 {
  const corners = cornersOf(p.box, p.placed.matrix);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const c of corners) {
    for (let i = 0; i < 3; i += 1) {
      const k = i as 0 | 1 | 2;
      if ((c[k] as number) < min[k]) min[k] = c[k] as number;
      if ((c[k] as number) > max[k]) max[k] = c[k] as number;
    }
  }
  return { min, max };
}

/** The one-line summary an agent reads first: what the audit gate says, in plain words. */
export function auditSummary(report: KitAuditReport): string {
  if (report.problems.length > 0) return `could not audit ${report.preset}: ${report.problems.join('; ')}`;
  if (report.ok) {
    return `${report.preset}: pass (${report.parts} parts, ${report.moving.length} moving, 0 loose ends, 0 terminal issues, 0 collisions, ${report.orbitClearance24.targets} targets reachable)`;
  }
  const why: string[] = [];
  if (report.solidClearances.length > 0) why.push(`${report.solidClearances.length} solid clearances`);
  if (report.looseEnds > 0) why.push(`${report.looseEnds} loose ends`);
  if (report.terminals > 0) why.push(`${report.terminals} unterminated ends`);
  if (!report.hingeBendRadius.ok) why.push(`${report.hingeBendRadius.failures.length} bend-radius failures`);
  if (!report.orbitClearance24.ok) why.push(`${report.orbitClearance24.failures.length} unreachable controls`);
  return `${report.preset}: fail (${why.join(', ')})`;
}
