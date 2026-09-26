/* =============================================================================
   HEAVY METAL GP 2 — SHARED TRACK-SPACE & COLLISION-COORDINATE ADAPTER (T03)

   This module is the single source of truth for the mapping between the
   headless 2D physics space ("engine space") and the 3D world space used by
   the Three.js renderer ("world space"). It is pure TypeScript: no DOM, no
   WebGL, no three.js — so headless physics, tests, and tooling can compile and
   consume the exact same immutable mapping data the renderer draws from.

   Spaces (all distances in the game's world units; 240 world units = 1 lane):

   ENGINE SPACE (headless physics, 2.5D)
     x        down-track position, START_X=190 .. FINISH=190+72000 (2 px/unit)
     y        screen altitude: surface height = courseY(x) − y (y grows DOWN)
     z        lateral lane coordinate, −480 .. +480 in 240-unit lanes

   TRACK SPACE (canonical physical space, what this adapter defines)
     s        arc-length distance along the 3D centerline spline
     lane     lateral offset across the ribbon (scaled by local half-width)
     alt      height above the ribbon surface along the local frame "up"

   WORLD SPACE (Three.js renderer)
     Right-handed world; centerline waypoints below. Position on the ribbon:
       P(s, lane, alt) = frame(s).pos + frame(s).right * lane + frame(s).up * (RADIUS + alt)

   The linear engine↔track mapping (legacy `trackDistFromDistance`):
       s = D_START + clamp(distance / TRACK_DISTANCE, 0..1) * (D_END − D_START)
       distance = (x − START_X) / 2

   Visual-only effects (camera rig, fog, sprite bobbing, sphere roll spin, sky
   rotation, water/lava texture scroll) are NOT part of this mapping and must
   stay in the renderer. The old renderer-only scripted ramp "jump arc" was
   removed for the same reason: ballistic trajectories belong to physics.
   ========================================================================== */
import { LANE_WIDTH, RADIUS, START_X, TRACK_DISTANCE, courseY } from './scene';
import type { CourseId } from './types';

/* -----------------------------------------------------------------------------
   0. ERROR TYPE — singular/ambiguous transforms fail visibly
   -------------------------------------------------------------------------- */
export class TrackSpaceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[track-space:${code}] ${message}`);
    this.name = 'TrackSpaceError';
    this.code = code;
  }
}

/* -----------------------------------------------------------------------------
   1. IMMUTABLE CENTERLINE INPUT DATA
   Extracted verbatim from the renderer's centerline definition; the renderer
   now consumes the compiled map built from this table instead of keeping its
   own copy. Loop waypoints are generated procedurally from LOOP_DEFINITIONS.
   -------------------------------------------------------------------------- */
export type TrackStageId =
  | 'alpine' | 'canyon' | 'zigzag' | 'cavern' | 'mine' | 'breakthrough' | 'stadium';

export interface CPoint { readonly x: number; readonly y: number; readonly z: number }

export interface CenterlineWaypoint extends CPoint {
  readonly stage: TrackStageId;
  readonly label?: string;
}

export interface LoopDefinition {
  readonly entry: CPoint;
  readonly forward: CPoint;
  readonly radius: number;
  readonly shift: number;
  readonly stage: TrackStageId;
  readonly label: string;
  /** Loop circle points are appended immediately after this waypoint index. */
  readonly insertAfterIndex: number;
  /** Anchor coordinates the waypoint at insertAfterIndex must match. */
  readonly anchor: CPoint;
  readonly segments: number;
}

export const TRACK_HALF_WIDTH = LANE_WIDTH * 2; // 480 → 960 wide
export const TRACK_SAMPLE_SPACING = 50; // arc-length per compiled sample
export const ARC_LENGTH_DIVISIONS = 6000; // matches the renderer's legacy table
export const LOOP_SEGMENTS = 12; // 13 points per loop, k = 0..12 inclusive

/**
 * Race-distance → track-arc anchors (legacy constants from the renderer):
 *  - engine distance 0 maps D_START units along the spline,
 *  - engine distance TRACK_DISTANCE maps to distOf('finish') + D_END_RUNOUT.
 */
export const D_START = 1100;
export const D_END_RUNOUT = 350;

/** Engine lateral scale anchor: lane z ∈ [−480, +480]. */
export const LANE_Z_RANGE = 480;
/** Lateral ball margin: drivable lateral = (z/480) * (halfWidth − RADIUS*1.2). */
export const LATERAL_RADIUS_FACTOR = 1.2;

export const CENTERLINE_WAYPOINTS: readonly CenterlineWaypoint[] = [
  // ---- 1. ALPINE DOWNHILL ----
  { x: 0, y: 18000, z: -2400, stage: 'alpine', label: 'start' },
  { x: 0, y: 18000, z: -1000, stage: 'alpine', label: 'startRamp' },
  { x: 0, y: 17950, z: 400, stage: 'alpine', label: 'launchEdge' },
  { x: 500, y: 17550, z: 3000, stage: 'alpine' },
  { x: 1600, y: 17000, z: 5600, stage: 'alpine', label: 'ramp1' },
  { x: 1000, y: 16450, z: 8200, stage: 'alpine' },
  { x: -700, y: 15950, z: 10800, stage: 'alpine' },
  { x: -1200, y: 15450, z: 13200, stage: 'alpine' },
  { x: -1200, y: 15250, z: 14200, stage: 'alpine' },
  // (alpineLoop inserted here by LOOP_DEFINITIONS)
  { x: -2300, y: 14950, z: 16400, stage: 'alpine' },
  { x: -1800, y: 14650, z: 18400, stage: 'alpine', label: 'ramp2' },
  { x: -800, y: 14250, z: 20600, stage: 'alpine' },
  { x: -200, y: 13850, z: 22800, stage: 'alpine' },
  { x: -300, y: 13650, z: 24300, stage: 'alpine', label: 'alpineEnd' },

  // ---- 2. CANYON LIP ----
  { x: -700, y: 13500, z: 25300, stage: 'canyon', label: 'canyonStart' },
  { x: -1500, y: 13350, z: 26100, stage: 'canyon', label: 'canyonApex' },
  { x: -2500, y: 13250, z: 26500, stage: 'canyon' },
  { x: -3600, y: 13150, z: 26600, stage: 'canyon' },

  // ---- 3. WATERFALL CLIFF ZIGZAG ----
  { x: -6100, y: 11850, z: 26650, stage: 'zigzag', label: 'zigzagStart' },
  { x: -8600, y: 10550, z: 26700, stage: 'zigzag' },
  { x: -10000, y: 10250, z: 27300, stage: 'zigzag' },
  { x: -10500, y: 10000, z: 27900, stage: 'zigzag', label: 'hairpin1' },
  { x: -10000, y: 9750, z: 28500, stage: 'zigzag' },
  { x: -8600, y: 9450, z: 29100, stage: 'zigzag', label: 'bridge1a' },
  { x: -6100, y: 8150, z: 29200, stage: 'zigzag', label: 'bridge1b' },
  { x: -3600, y: 6850, z: 29200, stage: 'zigzag' },
  { x: -2200, y: 6550, z: 29800, stage: 'zigzag' },
  { x: -1700, y: 6300, z: 30400, stage: 'zigzag', label: 'hairpin2' },
  { x: -2200, y: 6050, z: 31000, stage: 'zigzag' },
  { x: -3600, y: 5750, z: 31700, stage: 'zigzag' },
  { x: -6100, y: 4450, z: 31800, stage: 'zigzag', label: 'boulders' },
  { x: -8600, y: 3150, z: 31800, stage: 'zigzag' },
  { x: -10000, y: 2850, z: 32400, stage: 'zigzag' },
  { x: -10500, y: 2600, z: 33000, stage: 'zigzag', label: 'hairpin3' },
  { x: -10000, y: 2350, z: 33600, stage: 'zigzag' },
  { x: -8600, y: 2050, z: 34300, stage: 'zigzag', label: 'bridge2a' },
  { x: -6100, y: 750, z: 34400, stage: 'zigzag', label: 'bridge2b' },
  { x: -3600, y: -550, z: 34400, stage: 'zigzag' },
  { x: -2200, y: -850, z: 35000, stage: 'zigzag' },
  { x: -1700, y: -1100, z: 35600, stage: 'zigzag', label: 'hairpin4' },
  { x: -2200, y: -1350, z: 36200, stage: 'zigzag' },
  { x: -3600, y: -1650, z: 36900, stage: 'zigzag' },
  { x: -6100, y: -2200, z: 37000, stage: 'zigzag' },

  // ---- 4. CAVERN ENTRANCE ----
  { x: -8500, y: -2700, z: 37000, stage: 'cavern', label: 'cavernStart' },
  { x: -10500, y: -3000, z: 37000, stage: 'cavern' },
  { x: -12500, y: -3300, z: 37000, stage: 'cavern', label: 'caveEnter' },
  { x: -14500, y: -3600, z: 37050, stage: 'cavern' },

  // ---- 5. MINE ROLLER COASTER ----
  { x: -17000, y: -4200, z: 37300, stage: 'mine', label: 'mineStart' },
  { x: -19500, y: -3300, z: 37800, stage: 'mine' },
  { x: -21500, y: -4700, z: 37400, stage: 'mine' },
  { x: -23300, y: -4400, z: 36900, stage: 'mine' },
  // (lavaLoop1 inserted here)
  { x: -26500, y: -4700, z: 35500, stage: 'mine' },
  { x: -29000, y: -3700, z: 35700, stage: 'mine' },
  { x: -31500, y: -5300, z: 36200, stage: 'mine' },
  { x: -34000, y: -4800, z: 36600, stage: 'mine' },
  { x: -35700, y: -5000, z: 36700, stage: 'mine' },
  // (lavaLoop2 inserted here)
  { x: -39000, y: -5500, z: 35500, stage: 'mine' },
  { x: -41000, y: -5900, z: 35600, stage: 'mine' },
  { x: -43000, y: -5600, z: 35400, stage: 'mine' },

  // ---- 6. WATERFALL BREAKTHROUGH ----
  { x: -44300, y: -5100, z: 35200, stage: 'breakthrough', label: 'breakStart' },
  { x: -45300, y: -3700, z: 35100, stage: 'breakthrough' },
  { x: -46200, y: -2200, z: 35000, stage: 'breakthrough' },
  { x: -47000, y: -600, z: 35000, stage: 'breakthrough' },
  { x: -47500, y: -150, z: 35000, stage: 'breakthrough', label: 'caveExit' },

  // ---- 7. STADIUM FINISH ----
  { x: -48300, y: -80, z: 35000, stage: 'stadium', label: 'stadiumStart' },
  { x: -49500, y: 0, z: 35000, stage: 'stadium' },
  { x: -51500, y: 0, z: 35000, stage: 'stadium', label: 'grandstand' },
  { x: -53200, y: 0, z: 35000, stage: 'stadium', label: 'finish' },
  { x: -54300, y: 0, z: 35000, stage: 'stadium', label: 'end' },
];

export const LOOP_DEFINITIONS: readonly LoopDefinition[] = [
  {
    entry: { x: -1200, y: 15150, z: 15200 },
    forward: { x: 0, y: 0, z: 1 },
    radius: 1400, shift: 1100, stage: 'alpine', label: 'alpineLoop',
    insertAfterIndex: 8, anchor: { x: -1200, y: 15250, z: 14200 }, segments: LOOP_SEGMENTS,
  },
  {
    entry: { x: -24700, y: -4500, z: 36800 },
    forward: { x: -1, y: 0, z: 0 },
    radius: 1600, shift: 1100, stage: 'mine', label: 'lavaLoop1',
    insertAfterIndex: 50, anchor: { x: -23300, y: -4400, z: 36900 }, segments: LOOP_SEGMENTS,
  },
  {
    entry: { x: -37100, y: -5100, z: 36700 },
    forward: { x: -1, y: 0, z: 0 },
    radius: 1500, shift: 1100, stage: 'mine', label: 'lavaLoop2',
    insertAfterIndex: 55, anchor: { x: -35700, y: -5000, z: 36700 }, segments: LOOP_SEGMENTS,
  },
];

export const BRIDGE_SPAN_LABELS: readonly { start: string; end: string }[] = [
  { start: 'bridge1a', end: 'bridge1b' },
  { start: 'bridge2a', end: 'bridge2b' },
];

/** Half-width profile constants (extracted from the renderer). */
export const CANYON_HALF_WIDTH = 400;
export const BRIDGE_HALF_WIDTH = 420;
export const STADIUM_HALF_WIDTH = 660;

/* -----------------------------------------------------------------------------
   2. SMALL VECTOR MATH (plain objects; everything here is frozen data)
   -------------------------------------------------------------------------- */
const v3 = (x: number, y: number, z: number): CPoint => Object.freeze({ x, y, z });
const vadd = (a: CPoint, b: CPoint): CPoint => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const vsub = (a: CPoint, b: CPoint): CPoint => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const vscale = (a: CPoint, k: number): CPoint => v3(a.x * k, a.y * k, a.z * k);
const vdot = (a: CPoint, b: CPoint): number => a.x * b.x + a.y * b.y + a.z * b.z;
const vcross = (a: CPoint, b: CPoint): CPoint =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const vlen = (a: CPoint): number => Math.hypot(a.x, a.y, a.z);
const vunit = (a: CPoint): CPoint => {
  const l = vlen(a);
  if (!Number.isFinite(l) || l < 1e-12) {
    throw new TrackSpaceError('degenerate-vector', `cannot normalize vector of length ${l}`);
  }
  return vscale(a, 1 / l);
};
const vdist2 = (a: CPoint, b: CPoint): number => {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstepN = (a: number, b: number, x: number) => {
  const t = clampN((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bumpN = (x: number, a: number, b: number, feather: number) =>
  smoothstepN(a - feather, a, x) * (1 - smoothstepN(b, b + feather, x));
/** d/dx of smoothstepN with respect to x (continuous, 0 at the plateaus). */
const dSmoothstepN = (a: number, b: number, x: number) => {
  const t = clampN((x - a) / (b - a), 0, 1);
  return 6 * t * (1 - t) / (b - a);
};
const dBumpN = (x: number, a: number, b: number, feather: number) =>
  dSmoothstepN(a - feather, a, x) * (1 - smoothstepN(b, b + feather, x))
  - smoothstepN(a - feather, a, x) * dSmoothstepN(b, b + feather, x);

const WORLD_UP: CPoint = v3(0, 1, 0);

const isFinitePoint = (p: CPoint) =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

/* -----------------------------------------------------------------------------
   3. CENTERLINE EXPANSION — waypoints + procedural loop circles
   -------------------------------------------------------------------------- */
export interface ExpandedCenterline {
  readonly points: readonly CPoint[];
  readonly stages: readonly TrackStageId[];
  readonly labelIndex: Readonly<Record<string, number>>;
  readonly loops: readonly {
    readonly def: LoopDefinition;
    readonly forward: CPoint;
    readonly right: CPoint;
    readonly fromIdx: number;
    readonly toIdx: number;
  }[];
}

export function expandCenterline(
  waypoints: readonly CenterlineWaypoint[] = CENTERLINE_WAYPOINTS,
  loopDefs: readonly LoopDefinition[] = LOOP_DEFINITIONS,
): ExpandedCenterline {
  const out: CPoint[] = [];
  const stages: TrackStageId[] = [];
  const labelIndex: Record<string, number> = {};
  const loops: ExpandedCenterline['loops'][number][] = [];

  waypoints.forEach((wp, i) => {
    if (!isFinitePoint(wp)) {
      throw new TrackSpaceError('bad-waypoint', `waypoint ${i} has non-finite coordinates`);
    }
    if (wp.label) labelIndex[wp.label] = out.length;
    out.push(v3(wp.x, wp.y, wp.z));
    stages.push(wp.stage);

    for (const def of loopDefs) {
      if (def.insertAfterIndex !== i) continue;
      const a = def.anchor;
      const wpAnchor = waypoints[i];
      if (Math.abs(wpAnchor.x - a.x) > 1e-6 || Math.abs(wpAnchor.y - a.y) > 1e-6 || Math.abs(wpAnchor.z - a.z) > 1e-6) {
        throw new TrackSpaceError(
          'loop-anchor-drift',
          `loop "${def.label}" anchor (${a.x},${a.y},${a.z}) no longer matches waypoint ${i} — update insertAfterIndex`,
        );
      }
      const forward = vunit(def.forward);
      const right = vunit(vcross(forward, WORLD_UP));
      const fromIdx = out.length;
      for (let k = 0; k <= def.segments; k++) {
        const ang = (k / def.segments) * Math.PI * 2;
        const p = vadd(
          vadd(def.entry, vscale(forward, Math.sin(ang) * def.radius)),
          vadd(vscale(WORLD_UP, (1 - Math.cos(ang)) * def.radius), vscale(right, (k / def.segments) * def.shift)),
        );
        if (k === 0) labelIndex[def.label] = out.length;
        out.push(p);
        stages.push(def.stage);
      }
      loops.push(Object.freeze({ def, forward, right, fromIdx, toIdx: out.length - 1 }));
    }
  });

  return Object.freeze({
    points: Object.freeze(out.slice()),
    stages: Object.freeze(stages.slice()),
    labelIndex: Object.freeze({ ...labelIndex }),
    loops: Object.freeze(loops),
  });
}

/* -----------------------------------------------------------------------------
   4. CENTRIPETAL CATMULL-ROM — bit-faithful port of three.js r186 behavior
   (CatmullRomCurve3 'centripetal' + Curve.getLengths/getUtoTmapping/getTangent)
   -------------------------------------------------------------------------- */
interface CubicPoly { c0: number; c1: number; c2: number; c3: number }

function initPoly(x0: number, x1: number, t0: number, t1: number): CubicPoly {
  return { c0: x0, c1: t0, c2: -3 * x0 + 3 * x1 - 2 * t0 - t1, c3: 2 * x0 - 2 * x1 + t0 + t1 };
}
function initNonuniformCR(x0: number, x1: number, x2: number, x3: number, dt0: number, dt1: number, dt2: number): CubicPoly {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1;
  t2 *= dt1;
  return initPoly(x1, x2, t1, t2);
}
const calcPoly = (p: CubicPoly, t: number) => p.c0 + p.c1 * t + p.c2 * t * t + p.c3 * t * t * t;

/** Exact port of CatmullRomCurve3.getPoint(t) for a non-closed centripetal curve. */
export function catmullRomPointAt(points: readonly CPoint[], t: number): CPoint {
  const l = points.length;
  if (l < 2) throw new TrackSpaceError('spline-too-short', `need ≥2 control points, got ${l}`);
  const p = (l - 1) * t;
  let intPoint = Math.floor(p);
  let weight = p - intPoint;
  if (weight === 0 && intPoint === l - 1) {
    intPoint = l - 2;
    weight = 1;
  }
  // three.js extrapolates phantom endpoints instead of clamping
  const p0 = intPoint > 0 ? points[intPoint - 1] : v3(
    points[0].x + (points[0].x - points[1].x),
    points[0].y + (points[0].y - points[1].y),
    points[0].z + (points[0].z - points[1].z),
  );
  const p1 = points[intPoint % l];
  const p2 = points[(intPoint + 1) % l];
  const p3 = intPoint + 2 < l ? points[intPoint + 2] : v3(
    points[l - 1].x + (points[l - 1].x - points[l - 2].x),
    points[l - 1].y + (points[l - 1].y - points[l - 2].y),
    points[l - 1].z + (points[l - 1].z - points[l - 2].z),
  );

  const pow4 = 0.25; // centripetal
  let dt0 = Math.pow(vdist2(p0, p1), pow4);
  let dt1 = Math.pow(vdist2(p1, p2), pow4);
  let dt2 = Math.pow(vdist2(p2, p3), pow4);
  if (dt1 < 1e-4) dt1 = 1.0;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;

  const px = initNonuniformCR(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
  const py = initNonuniformCR(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
  const pz = initNonuniformCR(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
  return v3(calcPoly(px, weight), calcPoly(py, weight), calcPoly(pz, weight));
}

/** Exact port of Curve.getTangent(t): central difference with delta 1e-4. */
function catmullRomTangentAt(points: readonly CPoint[], t: number): CPoint {
  const delta = 0.0001;
  const t1 = Math.max(0, t - delta);
  const t2 = Math.min(1, t + delta);
  const pt1 = catmullRomPointAt(points, t1);
  const pt2 = catmullRomPointAt(points, t2);
  return vunit(vsub(pt2, pt1));
}

export interface SplineArcTable {
  readonly points: readonly CPoint[];
  readonly divisions: number;
  /** Cumulative chord lengths, length = divisions + 1 entries. */
  readonly lengths: readonly number[];
  readonly length: number;
}

export function buildSplineArcTable(points: readonly CPoint[], divisions = ARC_LENGTH_DIVISIONS): SplineArcTable {
  const lengths = new Array<number>(divisions + 1);
  lengths[0] = 0;
  let prev = catmullRomPointAt(points, 0);
  let sum = 0;
  for (let i = 1; i <= divisions; i++) {
    const p = catmullRomPointAt(points, i / divisions);
    sum += Math.sqrt(vdist2(p, prev));
    lengths[i] = sum;
    prev = p;
  }
  return Object.freeze({ points, divisions, lengths: Object.freeze(lengths), length: sum });
}

/** Exact port of Curve.getUtoTmapping (binary search + linear interpolation). */
function uToT(table: SplineArcTable, u: number): number {
  const arcLengths = table.lengths;
  const il = arcLengths.length;
  const targetArcLength = u * arcLengths[il - 1];

  let low = 0, high = il - 1, i = 0;
  while (low <= high) {
    i = Math.floor(low + (high - low) / 2);
    const comparison = arcLengths[i] - targetArcLength;
    if (comparison < 0) low = i + 1;
    else if (comparison > 0) high = i - 1;
    else { high = i; break; }
  }
  i = high;
  if (arcLengths[i] === targetArcLength) return i / (il - 1);
  const lengthBefore = arcLengths[i];
  const lengthAfter = arcLengths[i + 1];
  const segmentFraction = (targetArcLength - lengthBefore) / (lengthAfter - lengthBefore);
  return (i + segmentFraction) / (il - 1);
}

/** Arc-length-parameterized position, identical to curve.getPointAt(u). */
export function splinePointAt(table: SplineArcTable, u: number): CPoint {
  return catmullRomPointAt(table.points, uToT(table, u));
}
/** Arc-length-parameterized unit tangent, identical to curve.getTangentAt(u).normalize(). */
export function splineTangentAt(table: SplineArcTable, u: number): CPoint {
  return catmullRomTangentAt(table.points, uToT(table, u));
}
/** Waypoint arc distance, identical to the renderer's distAtWaypoint lookup. */
export function arcDistAtIndex(table: SplineArcTable, index: number): number {
  const n = table.points.length;
  const t = index / (n - 1);
  const f = t * table.divisions;
  const k = Math.min(table.divisions - 1, Math.floor(f));
  return lerpN(table.lengths[k], table.lengths[k + 1], f - k);
}

/* -----------------------------------------------------------------------------
   5. FRAME TYPES & VALIDATION
   -------------------------------------------------------------------------- */
export interface TrackFrameData {
  readonly index: number;
  readonly pos: CPoint;
  readonly tangent: CPoint;
  readonly up: CPoint;
  readonly right: CPoint;
  /** World-space arc distance of this knot. */
  readonly dist: number;
  readonly stage: TrackStageId;
  readonly halfWidth: number;
  readonly turnRate: number;
  readonly inLoop: boolean;
  readonly onBridge: boolean;
}

export interface TrackLoopSpan {
  readonly label: string;
  readonly stage: TrackStageId;
  readonly start: number;
  readonly end: number;
  readonly entry: CPoint;
  readonly forward: CPoint;
  readonly right: CPoint;
  readonly radius: number;
  readonly shift: number;
}

export interface TrackBridgeSpan { readonly start: number; readonly end: number }

export interface TrackSpaceValidationIssue {
  readonly code: string;
  readonly detail: string;
}

/** Pure structural validation for any sampled frame list (testable on bad data). */
export function validateFrameList(
  frames: readonly Pick<TrackFrameData, 'index' | 'pos' | 'tangent' | 'up' | 'right' | 'halfWidth'>[],
  minHalfWidth = 2 * RADIUS,
): TrackSpaceValidationIssue[] {
  const issues: TrackSpaceValidationIssue[] = [];
  frames.forEach((f) => {
    if (!isFinitePoint(f.pos) || !isFinitePoint(f.tangent) || !isFinitePoint(f.up) || !isFinitePoint(f.right)) {
      issues.push({ code: 'non-finite', detail: `frame ${f.index} contains non-finite values` });
      return;
    }
    const tl = vlen(f.tangent), ul = vlen(f.up), rl = vlen(f.right);
    if (Math.abs(tl - 1) > 1e-3 || Math.abs(ul - 1) > 1e-3 || Math.abs(rl - 1) > 1e-3) {
      issues.push({ code: 'non-unit-basis', detail: `frame ${f.index} basis lengths t=${tl.toFixed(4)} u=${ul.toFixed(4)} r=${rl.toFixed(4)}` });
    }
    if (Math.abs(vdot(f.tangent, f.up)) > 1e-3 || Math.abs(vdot(f.tangent, f.right)) > 1e-3) {
      issues.push({ code: 'non-orthogonal-basis', detail: `frame ${f.index} tangent not perpendicular to up/right` });
    }
    // handedness: right must equal tangent × up
    const rExpected = vcross(f.tangent, f.up);
    if (vdist2(rExpected, f.right) > 1e-3) {
      issues.push({ code: 'bad-handedness', detail: `frame ${f.index} right ≠ tangent × up — ambiguous lateral sign` });
    }
    if (!Number.isFinite(f.halfWidth) || f.halfWidth < minHalfWidth || f.halfWidth > 1e5) {
      issues.push({ code: 'singular-lane-scale', detail: `frame ${f.index} halfWidth=${f.halfWidth} — lateral mapping singular/insane` });
    }
  });
  return issues;
}

/* -----------------------------------------------------------------------------
   6. THE COMPILED TRACK-SPACE MAP (immutable)
   -------------------------------------------------------------------------- */
const BANK_GAIN = 7;
const BANK_LERP = 0.15;
const BANK_CLAMP = 0.35;
const GRAVITY_LERP = 0.12;
const LOOP_MARGIN = 60; // legacy inLoop arc tolerance

export interface InterpolatedFrame {
  readonly dist: number;
  readonly pos: CPoint;
  readonly tangent: CPoint;
  readonly up: CPoint;
  readonly right: CPoint;
  readonly halfWidth: number;
  readonly stage: TrackStageId;
  readonly inLoop: boolean;
  readonly onBridge: boolean;
  /** Segment index i of the host cell [i, i+1] and local parameter t ∈ [0,1). */
  readonly cellIndex: number;
  readonly cellT: number;
}

export interface TrackSpaceMap {
  readonly spline: SplineArcTable;
  readonly length: number;
  readonly centerline: ExpandedCenterline;
  readonly samples: readonly TrackFrameData[];
  readonly samplesPerArc: number;
  readonly stageStart: Readonly<Record<TrackStageId, number>>;
  readonly stageEnd: Readonly<Record<TrackStageId, number>>;
  readonly loops: readonly TrackLoopSpan[];
  readonly bridges: readonly TrackBridgeSpan[];
  /** Engine race distance (0..TRACK_DISTANCE) mapped onto world arc length. */
  readonly D_START: number;
  readonly D_END: number;
  readonly TRACK_DISTANCE: number;
  /** World arc units per engine distance unit: (D_END − D_START)/TRACK_DISTANCE. */
  readonly ARC_PER_ENGINE_DISTANCE: number;
  /**
   * The local rate at an engine distance. Without knots it is ARC_PER_ENGINE_DISTANCE everywhere;
   * with knots (ISLAND-ROUTE) it is the slope of the knot segment the distance falls in.
   */
  arcPerEngineDistanceAt(distance: number): number;
  distOf(label: string): number;
  halfWidthAt(dist: number): number;
  dHalfWidthAt(dist: number): number;
  sampleAt(dist: number): TrackFrameData;
  frameAt(dist: number): InterpolatedFrame;
  trackDistFromEngineDistance(distance: number): number;
  engineDistanceFromTrackDist(dist: number): number;
}

let compiledMap: TrackSpaceMap | null = null;
/** Returns the process-wide immutable track-space map, building it on first use. */
export function getTrackSpace(): TrackSpaceMap {
  if (!compiledMap) compiledMap = buildTrackSpace();
  return compiledMap;
}
/** Test hook: drop the memoized map (e.g. after monkey-patching constants). */
export function resetTrackSpaceForTests(): void {
  compiledMap = null;
}

/**
 * ISLAND-ROUTE: pins a labelled waypoint to an engine x, so a course authors exactly where each part of
 * the race lands in the world (the Maw at the sorting gate, every fork's split and merge). Between knots
 * the engine distance maps linearly onto arc length.
 */
export interface TrackKnot {
  readonly label: string;
  readonly x: number;
}

export interface TrackSpaceOptions {
  /**
   * Engine-x knots, in ascending x. Without them the map is the legacy single linear segment from
   * D_START to the finish run-out, byte for byte. With them, engine distance 0 and TRACK_DISTANCE map
   * to the first and last knot (author the start and the run-out as knots).
   */
  readonly knots?: readonly TrackKnot[];
}

export function buildTrackSpace(
  waypoints: readonly CenterlineWaypoint[] = CENTERLINE_WAYPOINTS,
  loopDefs: readonly LoopDefinition[] = LOOP_DEFINITIONS,
  bridgeLabels: readonly { start: string; end: string }[] = BRIDGE_SPAN_LABELS,
  options: TrackSpaceOptions = {},
): TrackSpaceMap {
  const centerline = expandCenterline(waypoints, loopDefs);
  const { points, stages, labelIndex } = centerline;
  if (points.length < 4) {
    throw new TrackSpaceError('centerline-too-short', `need ≥4 points, got ${points.length}`);
  }

  const spline = buildSplineArcTable(points, ARC_LENGTH_DIVISIONS);
  const length = spline.length;

  const distAtWaypoint = (i: number) => arcDistAtIndex(spline, i);
  const distOf = (label: string): number => {
    const idx = labelIndex[label];
    if (idx === undefined) {
      throw new TrackSpaceError('unknown-label', `no centerline waypoint labeled "${label}"`);
    }
    return distAtWaypoint(idx);
  };

  const stageStart = {} as Record<TrackStageId, number>;
  const stageEnd = {} as Record<TrackStageId, number>;
  stages.forEach((s, i) => {
    if (stageStart[s] === undefined) stageStart[s] = distAtWaypoint(i);
    stageEnd[s] = i + 1 < points.length ? distAtWaypoint(i + 1) : length;
  });

  const loops: TrackLoopSpan[] = centerline.loops.map((l) =>
    Object.freeze({
      label: l.def.label,
      stage: l.def.stage,
      start: distAtWaypoint(l.fromIdx),
      end: distAtWaypoint(l.toIdx),
      entry: l.def.entry,
      forward: l.forward,
      right: l.right,
      radius: l.def.radius,
      shift: l.def.shift,
    }));
  const bridges: TrackBridgeSpan[] = bridgeLabels.map((b) =>
    Object.freeze({ start: distOf(b.start), end: distOf(b.end) }));

  const halfWidthAt = (d: number): number => {
    let hw = TRACK_HALF_WIDTH;
    hw = lerpN(hw, CANYON_HALF_WIDTH, bumpN(d, stageStart.canyon, stageEnd.canyon, 700));
    bridges.forEach((b) => (hw = lerpN(hw, BRIDGE_HALF_WIDTH, bumpN(d, b.start, b.end, 300))));
    hw = lerpN(hw, STADIUM_HALF_WIDTH, smoothstepN(stageStart.stadium - 300, stageStart.stadium + 1200, d));
    return hw;
  };
  const dHalfWidthAt = (d: number): number => {
    // chain through the same lerp composition, differentiating each blend factor
    let hw = TRACK_HALF_WIDTH, dhw = 0;
    let k = bumpN(d, stageStart.canyon, stageEnd.canyon, 700);
    let dk = dBumpN(d, stageStart.canyon, stageEnd.canyon, 700);
    dhw = dhw * (1 - k) + (CANYON_HALF_WIDTH - hw) * dk;
    hw = lerpN(hw, CANYON_HALF_WIDTH, k);
    for (const b of bridges) {
      k = bumpN(d, b.start, b.end, 300);
      dk = dBumpN(d, b.start, b.end, 300);
      dhw = dhw * (1 - k) + (BRIDGE_HALF_WIDTH - hw) * dk;
      hw = lerpN(hw, BRIDGE_HALF_WIDTH, k);
    }
    k = smoothstepN(stageStart.stadium - 300, stageStart.stadium + 1200, d);
    dk = dSmoothstepN(stageStart.stadium - 300, stageStart.stadium + 1200, d);
    dhw = dhw * (1 - k) + (STADIUM_HALF_WIDTH - hw) * dk;
    return dhw;
  };

  const count = Math.ceil(length / TRACK_SAMPLE_SPACING);
  const samples: TrackFrameData[] = [];
  let transportUp = WORLD_UP;
  let prevTangent = v3(0, 0, 1);
  let bank = 0;

  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const dist = u * length;
    const pos = splinePointAt(spline, u);
    const tangent = splineTangentAt(spline, u);

    // parallel transport, then gentle gravity correction (same order as renderer)
    transportUp = vunit(vsub(transportUp, vscale(tangent, vdot(transportUp, tangent))));
    const gravUpRaw = vsub(WORLD_UP, vscale(tangent, tangent.y));
    if (vdot(gravUpRaw, gravUpRaw) > 0.04) {
      const gravUp = vunit(gravUpRaw);
      const k = GRAVITY_LERP * clampN(transportUp.y, 0, 1);
      transportUp = vunit(vadd(vscale(transportUp, 1 - k), vscale(gravUp, k)));
    }
    const turn = i === 0 ? 0 : vdot(vcross(prevTangent, tangent), transportUp);
    bank = lerpN(bank, clampN(-turn * BANK_GAIN, -BANK_CLAMP, BANK_CLAMP), BANK_LERP);
    // rotate transported up around the tangent by bank
    const up = vunit(rotateAroundAxis(transportUp, tangent, bank));
    const right = vunit(vcross(tangent, up));
    prevTangent = tangent;

    let stage: TrackStageId = 'stadium';
    for (const s of Object.keys(stageStart) as TrackStageId[]) {
      if (dist >= stageStart[s] && dist < stageEnd[s]) stage = s;
    }

    samples.push(Object.freeze({
      index: i,
      pos, tangent, up, right, dist, stage,
      halfWidth: halfWidthAt(dist),
      turnRate: turn / TRACK_SAMPLE_SPACING,
      inLoop: loops.some((l) => dist >= l.start - LOOP_MARGIN && dist <= l.end + LOOP_MARGIN),
      onBridge: bridges.some((b) => dist >= b.start && dist <= b.end),
    }));
  }

  const knotted = options.knots?.length ? compileKnots(options.knots, distOf) : null;
  const D_START_MAP = knotted ? knotted.arc[0] : D_START;
  const D_END = knotted ? knotted.arc[knotted.arc.length - 1] : distOf('finish') + D_END_RUNOUT;
  const samplesPerArc = count / length;

  const sampleAt = (dist: number): TrackFrameData => {
    const i = clampN(Math.round(dist * samplesPerArc), 0, count);
    return samples[i];
  };

  const frameAt = (dist: number): InterpolatedFrame => {
    const d = clampN(dist, 0, length);
    const f = d * samplesPerArc;
    const i = Math.min(count - 1, Math.floor(f));
    const t = f - i;
    const a = samples[i];
    const b = samples[i + 1];
    const mix = (pa: CPoint, pb: CPoint): CPoint =>
      v3(lerpN(pa.x, pb.x, t), lerpN(pa.y, pb.y, t), lerpN(pa.z, pb.z, t));
    const pos = mix(a.pos, b.pos);
    const tangent = vunit(mix(a.tangent, b.tangent));
    const upRaw = mix(a.up, b.up);
    const up = vunit(vsub(upRaw, vscale(tangent, vdot(upRaw, tangent))));
    const right = vunit(vcross(tangent, up));
    return Object.freeze({
      dist: d, pos, tangent, up, right,
      halfWidth: halfWidthAt(d),
      stage: t < 0.5 ? a.stage : b.stage,
      inLoop: loops.some((l) => d >= l.start - LOOP_MARGIN && d <= l.end + LOOP_MARGIN),
      onBridge: bridges.some((bb) => d >= bb.start && d <= bb.end),
      cellIndex: i,
      cellT: t,
    });
  };

  const map: TrackSpaceMap = Object.freeze({
    spline, length, centerline, samples: Object.freeze(samples), samplesPerArc,
    stageStart: Object.freeze({ ...stageStart }), stageEnd: Object.freeze({ ...stageEnd }),
    loops: Object.freeze(loops), bridges: Object.freeze(bridges),
    D_START: D_START_MAP, D_END, TRACK_DISTANCE,
    ARC_PER_ENGINE_DISTANCE: (D_END - D_START_MAP) / TRACK_DISTANCE,
    distOf, halfWidthAt, dHalfWidthAt, sampleAt, frameAt,
    ...(knotted ? knotted.mapping : {
      trackDistFromEngineDistance: (distance: number) =>
        lerpN(D_START, D_END, clampN(distance / TRACK_DISTANCE, 0, 1)),
      engineDistanceFromTrackDist: (dist: number) =>
        clampN((dist - D_START) / (D_END - D_START), 0, 1) * TRACK_DISTANCE,
      arcPerEngineDistanceAt: () => (D_END - D_START) / TRACK_DISTANCE,
    }),
  });

  // Fail visibly if the compiled map itself is structurally broken.
  const issues = validateFrameList(samples);
  if (issues.length > 0) {
    throw new TrackSpaceError(
      'invalid-map',
      `compiled track map failed validation: ${issues.slice(0, 5).map((i) => i.detail).join('; ')}`
        + (issues.length > 5 ? ` (+${issues.length - 5} more)` : ''),
    );
  }

  return map;
}

/** Rodrigues rotation of v around unit axis k by angle θ (matches applyAxisAngle). */
function rotateAroundAxis(v: CPoint, k: CPoint, angle: number): CPoint {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // v*c + (k×v)*s + k*(k·v)*(1−c)
  const kxv = vcross(k, v);
  const kkv = vscale(k, vdot(k, v) * (1 - c));
  return v3(
    v.x * c + kxv.x * s + kkv.x,
    v.y * c + kxv.y * s + kkv.y,
    v.z * c + kxv.z * s + kkv.z,
  );
}

/**
 * Engine distance ↔ arc length through knots: strictly increasing on both sides, the first knot at
 * engine distance 0 and the last at TRACK_DISTANCE. Throws on a knot out of order, so a bad course fails
 * at load instead of racing backwards.
 */
function compileKnots(knots: readonly TrackKnot[], distOf: (label: string) => number) {
  const dist = knots.map((k) => clampN((k.x - START_X) / 2, 0, TRACK_DISTANCE));
  const arc = knots.map((k) => distOf(k.label));
  if (dist[0] !== 0 || dist[dist.length - 1] !== TRACK_DISTANCE) {
    throw new TrackSpaceError('knot-range', `knots must start at x ${START_X} and end at the finish run-out`);
  }
  for (let i = 1; i < knots.length; i++) {
    if (!(dist[i] > dist[i - 1]) || !(arc[i] > arc[i - 1])) {
      throw new TrackSpaceError('knot-order', `knot "${knots[i].label}" is not after "${knots[i - 1].label}"`);
    }
  }
  const segment = (values: readonly number[], v: number) => {
    let i = 0;
    while (i < values.length - 2 && v >= values[i + 1]) i++;
    return i;
  };
  const mapping = {
    trackDistFromEngineDistance: (distance: number) => {
      const d = clampN(distance, 0, TRACK_DISTANCE);
      const i = segment(dist, d);
      return lerpN(arc[i], arc[i + 1], (d - dist[i]) / (dist[i + 1] - dist[i]));
    },
    engineDistanceFromTrackDist: (a: number) => {
      const v = clampN(a, arc[0], arc[arc.length - 1]);
      const i = segment(arc, v);
      return lerpN(dist[i], dist[i + 1], (v - arc[i]) / (arc[i + 1] - arc[i]));
    },
    arcPerEngineDistanceAt: (distance: number) => {
      const i = segment(dist, clampN(distance, 0, TRACK_DISTANCE));
      return (arc[i + 1] - arc[i]) / (dist[i + 1] - dist[i]);
    },
  };
  return { dist, arc, mapping };
}

/* -----------------------------------------------------------------------------
   7. CANONICAL STATE, PLACEMENT, AND THE LEGACY RACER COMPOSITION
   -------------------------------------------------------------------------- */

/** Canonical physical state in track space. */
export interface CanonicalState {
  /** Arc distance along the centerline spline. */
  readonly s: number;
  /** Engine lateral lane coordinate (−480..+480; positive = +right of frame). */
  readonly laneZ: number;
  /** Height of the ball BOTTOM above the ribbon surface (see placement docs). */
  readonly altitude: number;
}

/** Canonical velocity: rates of the canonical state coordinates. */
export interface CanonicalVelocity {
  readonly ds: number;
  readonly dz: number;
  readonly dAlt: number;
}

export interface WorldPlacement {
  readonly world: CPoint;
  readonly state: CanonicalState;
  readonly frame: InterpolatedFrame;
  readonly lateral: number;
}

/** Drivable lateral offset for an engine lane coordinate at arc distance s. */
export function lateralFromLaneZ(map: TrackSpaceMap, s: number, laneZ: number): number {
  const hw = clampN(map.halfWidthAt(s), 2 * RADIUS, 1e5);
  return (laneZ / LANE_Z_RANGE) * (hw - RADIUS * LATERAL_RADIUS_FACTOR);
}
/** Inverse of lateralFromLaneZ. */
export function laneZFromLateral(map: TrackSpaceMap, s: number, lateral: number): number {
  const hw = clampN(map.halfWidthAt(s), 2 * RADIUS, 1e5);
  return (lateral / (hw - RADIUS * LATERAL_RADIUS_FACTOR)) * LANE_Z_RANGE;
}

/** World position of a canonical state. P(s, z, a) = pos + right·λ + up·(R + a). */
export function worldFromCanonical(map: TrackSpaceMap, state: CanonicalState): WorldPlacement {
  const frame = map.frameAt(state.s);
  const lateral = lateralFromLaneZ(map, frame.dist, state.laneZ);
  const world = vadd(
    vadd(frame.pos, vscale(frame.right, lateral)),
    vscale(frame.up, RADIUS + state.altitude),
  );
  return Object.freeze({ world, state, frame, lateral });
}

/**
 * Analytic Jacobian of P(s, z, a) with respect to (s, z, a), in world space.
 * Differentiates the exact nlerp + re-orthonormalization chain used by frameAt,
 * so velocity conversions agree with the placement function to machine noise.
 */
export function placementJacobian(map: TrackSpaceMap, state: CanonicalState): {
  readonly ds: CPoint; readonly dz: CPoint; readonly dAlt: CPoint;
} {
  const d = clampN(state.s, 0, map.length);
  const f = d * map.samplesPerArc;
  const i = Math.min(map.samples.length - 2, Math.floor(f));
  const t = f - i;
  const a = map.samples[i];
  const b = map.samples[i + 1];
  // cell arc width (knots are evenly spaced in u; each knot spans length/count)
  const cellArc = 1 / map.samplesPerArc;

  // d/ds of a linear interpolation between knot vectors
  const mix = (pa: CPoint, pb: CPoint): CPoint =>
    v3(lerpN(pa.x, pb.x, t), lerpN(pa.y, pb.y, t), lerpN(pa.z, pb.z, t));
  const mixD = (pa: CPoint, pb: CPoint): CPoint => vscale(vsub(pb, pa), 1 / cellArc);
  // d/ds of normalize(m): (I − mm̂ᵀ)·m′ / |m|
  const dNorm = (m: CPoint, dm: CPoint): CPoint => {
    const l = vlen(m);
    const u = vscale(m, 1 / l);
    return vscale(vsub(dm, vscale(u, vdot(u, dm))), 1 / l);
  };

  const dPos = mixD(a.pos, b.pos);

  const mT = mix(a.tangent, b.tangent);
  const dmT = mixD(a.tangent, b.tangent);
  const T = vunit(mT);
  const dT = dNorm(mT, dmT);

  const mU = mix(a.up, b.up);
  const dmU = mixD(a.up, b.up);
  // Gram–Schmidt against T: g = mU − T·(T·mU); up = norm(g)
  const g = vsub(mU, vscale(T, vdot(T, mU)));
  const dg = vsub(
    dmU,
    vadd(
      vscale(dT, vdot(T, mU)),
      vscale(T, vdot(dT, mU) + vdot(T, dmU)),
    ),
  );
  const U = vunit(g);
  const dU = dNorm(g, dg);

  // right = normalize(tangent × up); |t×u| = 1 for orthonormal pairs, but keep exact
  const rRaw = vcross(T, U);
  const drRaw = vadd(vcross(dT, U), vcross(T, dU));
  const R = vunit(rRaw);
  const dR = dNorm(rRaw, drRaw);

  const hw = map.halfWidthAt(d);
  const dhw = map.dHalfWidthAt(d);
  const latMargin = Math.max(1e-6, hw - RADIUS * LATERAL_RADIUS_FACTOR);
  const lateral = (state.laneZ / LANE_Z_RANGE) * latMargin;
  const dLateral = (state.laneZ / LANE_Z_RANGE) * dhw;

  // ∂P/∂s = pos′ + R′·λ + R·λ′ + U′·(RAD + a)
  const dsd = vadd(
    vadd(dPos, vscale(dR, lateral)),
    vadd(vscale(R, dLateral), vscale(dU, RADIUS + state.altitude)),
  );
  // ∂P/∂z = R · (hw − 1.2R)/480
  const dzd = vscale(R, latMargin / LANE_Z_RANGE);
  // ∂P/∂a = U
  return Object.freeze({ ds: dsd, dz: dzd, dAlt: U });
}

/** World velocity from a canonical velocity. v = J · [ṡ, ż, ȧ]. */
export function worldVelocityFromCanonical(
  map: TrackSpaceMap, state: CanonicalState, vel: CanonicalVelocity,
): CPoint {
  const J = placementJacobian(map, state);
  return vadd(vadd(vscale(J.ds, vel.ds), vscale(J.dz, vel.dz)), vscale(J.dAlt, vel.dAlt));
}

/**
 * Canonical velocity from world velocity (Jacobian inverse via 3×3 Cramer).
 * Throws TrackSpaceError('singular-jacobian') when the local transform is
 * degenerate — singular transforms fail visibly rather than producing
 * plausible-looking garbage.
 */
export function canonicalVelocityFromWorld(
  map: TrackSpaceMap, state: CanonicalState, worldV: CPoint,
): CanonicalVelocity {
  const J = placementJacobian(map, state);
  const det = vdot(J.ds, vcross(J.dz, J.dAlt));
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) {
    throw new TrackSpaceError(
      'singular-jacobian',
      `Jacobian singular at s=${state.s.toFixed(1)} z=${state.laneZ.toFixed(1)} a=${state.altitude.toFixed(1)} (det=${det})`,
    );
  }
  return Object.freeze({
    ds: vdot(worldV, vcross(J.dz, J.dAlt)) / det,
    dz: vdot(worldV, vcross(J.dAlt, J.ds)) / det,
    dAlt: vdot(worldV, vcross(J.ds, J.dz)) / det,
  });
}

/** Signed world displacement of a canonical displacement, local-linear exact. */
export function worldDisplacementFromCanonical(
  map: TrackSpaceMap, state: CanonicalState, delta: CanonicalVelocity,
): CPoint {
  return worldVelocityFromCanonical(map, state, delta);
}

/* -----------------------------------------------------------------------------
   8. ENGINE-SPACE CONVERSIONS (the legacy renderer formulas, extracted)
   -------------------------------------------------------------------------- */
export interface EngineRacerState {
  /** Engine down-track position x (START_X-based). Use either x or distance. */
  readonly x?: number;
  /** Engine race distance = (x − START_X)/2, clamped 0..TRACK_DISTANCE. */
  readonly distance?: number;
  /** Engine lateral lane coordinate (−480..+480). */
  readonly z: number;
  /** Engine screen Y (y grows downward in engine space). */
  readonly y: number;
  readonly grounded?: boolean;
  /**
   * The course the engine state belongs to. Engine y follows *that course's* hill profile
   * (`courseY`), so an altitude above the road must be measured against the same profile: measured
   * against Ridge's, Boomtown and Sheep lifted every ball, pickup and effect off the road. Every
   * caller says which course it is placing on (M10); there is no module-wide default.
   */
  readonly course: CourseId;
}

export interface EngineVelocity {
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** Engine x position from race distance (inverse of distance = (x − START_X)/2). */
export const engineXFromDistance = (distance: number): number => START_X + distance * 2;
/** Engine race distance from engine x (clamped like the engine/renderer). */
export const engineDistanceFromX = (x: number): number => clampN((x - START_X) / 2, 0, TRACK_DISTANCE);

/** Canonical state (s, laneZ, altitude-source tag) extracted from engine state. */
export function canonicalFromEngine(
  map: TrackSpaceMap, st: EngineRacerState,
): { s: number; laneZ: number; engineAlt: number; engineDistance: number; engineX: number } {
  const engineDistance = st.distance ?? (st.x !== undefined ? engineDistanceFromX(st.x) : 0);
  const engineX = st.x ?? engineXFromDistance(engineDistance);
  const s = map.trackDistFromEngineDistance(engineDistance);
  // Height is always measured from the course under the ball. The slingshot-era rule that measured an
  // airborne ball from the flat legacy ground (GROUND − RADIUS) floated it ~210 units too high
  // wherever the course sits above that ground, such as the start pad (M5).
  const engineAlt = Math.max(0, courseY(engineX, st.course) - st.y);
  return { s, laneZ: st.z, engineAlt, engineDistance, engineX };
}

/**
 * Full racer placement: the legacy Renderer3D altitude composition
 * (max of engine elevation, airborne elevation and ramp elevation), extracted
 * so the renderer and headless physics share one implementation.
 *
 * `altitude` here is the ball-BOTTOM height above the ribbon; the ball CENTER
 * sits at RADIUS + altitude above the surface (legacy +RADIUS lift preserved).
 */
export function placementFromEngine(
  map: TrackSpaceMap,
  st: EngineRacerState,
  ramps?: readonly PhysicalRampSurface[],
): WorldPlacement & {
  readonly altitude: number;
  readonly altSource: 'engine' | 'airborne' | 'ramp' | 'flat';
} {
  const c = canonicalFromEngine(map, st);
  const rampAlt = ramps && ramps.length > 0 ? rampHeightAt(ramps, c.s, lateralFromLaneZ(map, c.s, c.laneZ)) : 0;
  const altitude = Math.max(c.engineAlt, rampAlt);
  const altSource =
    altitude === rampAlt && rampAlt > 0 ? 'ramp'
      : altitude === c.engineAlt && c.engineAlt > 0 ? (st.grounded === false ? 'airborne' : 'engine') : 'flat';
  const placement = worldFromCanonical(map, { s: c.s, laneZ: c.laneZ, altitude });
  return Object.freeze({ ...placement, altitude, altSource });
}

/**
 * World velocity of a racer from engine velocity (vx, vy, vz; engine units/s).
 *
 * Engine → canonical rates:
 *   ṡ   = (vx/2) · ARC_PER_ENGINE_DISTANCE        (x‑units/s → arc/s)
 *   ż   = vz                                       (lane units/s)
 *   ȧ   = piecewise on the ACTIVE altitude source: (documented in TRACK_SPACE.md)
 *     'engine'   → courseSlope(x)·vx − vy
 *     'airborne' → −vy
 *     'ramp'     → dh/ds · ṡ  (dh/dz = 0 inside a ramp's flat lateral window)
 */
export function worldVelocityFromEngine(
  map: TrackSpaceMap,
  st: EngineRacerState,
  vel: EngineVelocity,
  ramps?: readonly PhysicalRampSurface[],
): { worldV: CPoint; canonical: CanonicalVelocity; state: CanonicalState } {
  const c = canonicalFromEngine(map, st);
  const rampAlt = ramps && ramps.length > 0 ? rampHeightAt(ramps, c.s, lateralFromLaneZ(map, c.s, c.laneZ)) : 0;
  const altitude = Math.max(c.engineAlt, rampAlt);
  const ds = (vel.vx / 2) * map.arcPerEngineDistanceAt(c.engineDistance);
  let dAlt: number;
  if (altitude === rampAlt && rampAlt > 0) {
    dAlt = rampSlopeAt(ramps!, c.s, lateralFromLaneZ(map, c.s, c.laneZ)) * ds;
  } else {
    dAlt = engineSlopeApprox(c.engineX, st.course) * vel.vx - vel.vy;
  }
  const state: CanonicalState = { s: c.s, laneZ: c.laneZ, altitude };
  return {
    worldV: worldVelocityFromCanonical(map, state, { ds, dz: vel.vz, dAlt }),
    canonical: { ds, dz: vel.vz, dAlt },
    state,
  };
}

/**
 * Local engine-course slope dy/dx. The engine ground is a precomputed table
 * lerped piecewise-linearly every 16 x-units (see scene.ts), so a ±4 stencil
 * reads the exact local table slope without the ±24 cross-cell averaging the
 * legacy courseSlope() uses for its own collision cycle. At table knots the
 * slope is a subgradient between the two linear pieces (documented kink).
 */
function engineSlopeApprox(engineX: number, course: CourseId): number {
  return (courseY(engineX + 4, course) - courseY(engineX - 4, course)) / 8;
}

/**
 * Inverse projection: world point → engine state, with ambiguity detection.
 * Scans the compiled knots, refines inside the best cell, and reports
 * `ambiguous: true` when a second topologically distinct ribbon sheet is
 * comparably close (e.g. loop/stacked-deck crossovers) so callers can fail
 * loudly instead of picking a random master sheet.
 */
export function engineFromWorld(
  map: TrackSpaceMap,
  world: CPoint,
): {
  readonly distance: number;
  readonly s: number;
  readonly laneZ: number;
  readonly altitude: number;
  readonly ambiguous: boolean;
  readonly residual: number;
} {
  if (!isFinitePoint(world)) {
    throw new TrackSpaceError('non-finite-input', 'engineFromWorld received a non-finite world point');
  }
  const n = map.samples.length;
  let best = 0, bestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const d2 = vdist2(world, map.samples[i].pos);
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  // refine inside the neighbouring cells by projecting along the frame basis
  let s = map.samples[best].dist;
  const lo = Math.max(0, best - 1);
  const hi = Math.min(n - 1, best + 1);
  let refined = s;
  let bestLocal = bestD2;
  for (let k = lo; k < hi; k++) {
    const a = map.samples[k];
    const bFrame = map.samples[k + 1];
    const seg = vsub(bFrame.pos, a.pos);
    const segLen2 = Math.max(1e-9, vdot(seg, seg));
    const tt = clampN(vdot(vsub(world, a.pos), seg) / segLen2, 0, 1);
    const q = vadd(a.pos, vscale(seg, tt));
    const d2 = vdist2(world, q);
    if (d2 < bestLocal) { bestLocal = d2; refined = a.dist + tt * (bFrame.dist - a.dist); }
  }
  s = refined;
  // Newton polish: slide along the interpolated centerline until the residual
  // is perpendicular to the tangent (converges past the chord-projection bias
  // the coarse step leaves on tight hairpins)
  for (let it = 0; it < 4; it++) {
    const f = map.frameAt(s);
    const along = vdot(vsub(world, f.pos), f.tangent);
    if (Math.abs(along) < 1e-3) break;
    s = clampN(s + clampN(along, -TRACK_SAMPLE_SPACING / 2, TRACK_SAMPLE_SPACING / 2), 0, map.length);
  }

  const frame = map.frameAt(s);
  const rel = vsub(world, frame.pos);
  const lateral = vdot(rel, frame.right);
  const altitude = vdot(rel, frame.up) - RADIUS;
  const laneZ = laneZFromLateral(map, frame.dist, lateral);
  const distance = map.engineDistanceFromTrackDist(s);
  const residual = Math.sqrt(bestLocal);

  // ambiguity: another topologically distinct sheet comparably close
  const step = Math.max(8, Math.floor(n / 200));
  let second = -1, secondD2 = Infinity;
  for (let i = 0; i < n; i += step) {
    if (Math.abs(i - best) < step * 2) continue;
    const d2 = vdist2(world, map.samples[i].pos);
    if (d2 < secondD2) { secondD2 = d2; second = i; }
  }
  let ambiguous = false;
  if (second >= 0) {
    const hwBand = Math.min(
      map.halfWidthAt(map.samples[best].dist),
      map.halfWidthAt(map.samples[second].dist),
    );
    const secondRel = Math.sqrt(secondD2);
    ambiguous = secondRel < residual + hwBand * 0.75;
  }

  return Object.freeze({ distance, s, laneZ, altitude, ambiguous, residual });
}

/** Ribbon surface normal at (s, lateral) — simply the frame up vector. */
export function surfaceNormalAt(map: TrackSpaceMap, s: number): CPoint {
  return map.frameAt(s).up;
}

/* -----------------------------------------------------------------------------
   9. PLACED-RAMP DECISION (T03 "required decision")
   A builder ramp is promoted to a PHYSICAL surface only when it reduces to an
   unambiguous longitudinal height profile over the drivable ribbon. Anything
   else is rejected with an explicit reason and contributes NO elevation, so
   renderer and physics can never silently disagree about ramp support.
   -------------------------------------------------------------------------- */

/** Legacy ramp profile dimensions (must match the ramp prop artwork). */
export const RAMP_BASE_LENGTH = 1100;
export const RAMP_BASE_HEIGHT = 260;
export const RAMP_BASE_HALF_WIDTH = 960 / 2;
export const RAMP_PROFILE_EXPONENT = 1.4;

export interface RampLikeProp {
  readonly id?: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY?: number;
  readonly scale: number;
  readonly trackDist?: number;
}

export interface PhysicalRampSurface {
  readonly propId?: string;
  /** Crest arc position (ramp top edge). Base sits at crestDist − length. */
  readonly crestDist: number;
  readonly startDist: number;
  readonly length: number;
  readonly height: number;
  readonly centerLateral: number;
  readonly halfWidth: number;
  readonly exponent: number;
}

export type RampRejectionCode =
  | 'non-finite'
  | 'invalid-scale'
  | 'projection-failed'
  | 'ambiguous-backing'
  | 'insufficient-width'
  | 'unsupported-region-loop';

export interface RampClassification {
  readonly supported: boolean;
  readonly surface?: PhysicalRampSurface;
  readonly reason?: RampRejectionCode;
  readonly detail?: string;
}

/** Height tolerance of a ramp footprint projecting onto the ribbon. */
export const RAMP_PROJECTION_TOLERANCE = 1200;
// Note: prop yaw (rotY) is deliberately NOT part of classification. The legacy
// elevation reducer ran the profile along the track tangent regardless of yaw
// (alignToTrack placements already set rotY = atan2(tangent)). The physical
// ramp profile is therefore defined in track space, independent of yaw; yaw
// only changes how the prop is drawn. This is documented in TRACK_SPACE.md.

/** Classify one placed ramp prop; compile a physical surface when supported. */
export function classifyPlacedRamp(map: TrackSpaceMap, prop: RampLikeProp): RampClassification {
  if (!isFinitePoint({ x: prop.x, y: prop.y, z: prop.z }) || !Number.isFinite(prop.scale)) {
    return Object.freeze({ supported: false, reason: 'non-finite', detail: `ramp ${prop.id ?? '?'} has non-finite transform` });
  }
  if (!(prop.scale > 0.04) || prop.scale > 100) {
    return Object.freeze({ supported: false, reason: 'invalid-scale', detail: `ramp ${prop.id ?? '?'} scale=${prop.scale}` });
  }

  // Project the prop onto the ribbon: legacy behaviour used prop.trackDist
  // when present and fell back to nearest-knot projection otherwise.
  let crestDist: number;
  if (prop.trackDist !== undefined && Number.isFinite(prop.trackDist)) {
    crestDist = clampN(prop.trackDist, 0, map.length);
  } else {
    let bestD = 0, bestD2 = Infinity;
    for (let i = 0; i < map.samples.length; i++) {
      const s = map.samples[i];
      const dx = s.pos.x - prop.x, dz = s.pos.z - prop.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; bestD = s.dist; }
    }
    crestDist = bestD;
  }

  const length = RAMP_BASE_LENGTH * prop.scale;
  const height = RAMP_BASE_HEIGHT * prop.scale;
  const halfWidth = RAMP_BASE_HALF_WIDTH * prop.scale;
  const startDist = Math.max(0, crestDist - length);

  // lateral position of the ramp crest on the ribbon
  const crestFrame = map.frameAt(crestDist);
  const centerLateral =
    (prop.x - crestFrame.pos.x) * crestFrame.right.x + (prop.z - crestFrame.pos.z) * crestFrame.right.z;

  // The footprint must sit near the ribbon, on ONE unambiguous backing sheet.
  const projection = engineFromWorld(map, { x: prop.x, y: crestFrame.pos.y, z: prop.z });
  if (projection.residual > RAMP_PROJECTION_TOLERANCE) {
    return Object.freeze({
      supported: false, reason: 'projection-failed',
      detail: `ramp ${prop.id ?? '?'} is ${projection.residual.toFixed(0)} units from the nearest ribbon (>${RAMP_PROJECTION_TOLERANCE})`,
    });
  }
  if (projection.ambiguous) {
    return Object.freeze({
      supported: false, reason: 'ambiguous-backing',
      detail: `ramp ${prop.id ?? '?'} sits over ≥2 ribbon sheets; physical backing is ambiguous`,
    });
  }

  // Whole covered span must remain inside the drivable ribbon width.
  let s = startDist;
  let minMargin = Infinity;
  let inLoop = false;
  while (s <= crestDist + 1e-6) {
    const f = map.frameAt(s);
    minMargin = Math.min(minMargin, f.halfWidth - (Math.abs(centerLateral) + halfWidth));
    if (f.inLoop) inLoop = true;
    s = Math.min(crestDist + 1, s + TRACK_SAMPLE_SPACING / 2);
  }
  if (inLoop) {
    return Object.freeze({
      supported: false, reason: 'unsupported-region-loop',
      detail: `ramp ${prop.id ?? '?'} covers loop arc [${startDist.toFixed(0)}, ${crestDist.toFixed(0)}] — launch ballistics on inverted ribbons are undefined`,
    });
  }
  if (minMargin < -RADIUS) {
    return Object.freeze({
      supported: false, reason: 'insufficient-width',
      detail: `ramp ${prop.id ?? '?'} overhangs the ribbon by ${(-minMargin).toFixed(0)} units — lateral elevation would be undefined beyond the edge`,
    });
  }

  return Object.freeze({
    supported: true,
    surface: Object.freeze({
      propId: prop.id,
      crestDist, startDist, length, height, centerLateral, halfWidth,
      exponent: RAMP_PROFILE_EXPONENT,
    }),
  });
}

/** Compile all supported ramp surfaces from placed props; collect rejections. */
export function compileRampSurfaces(
  map: TrackSpaceMap, props: readonly RampLikeProp[],
): { readonly surfaces: readonly PhysicalRampSurface[]; readonly rejected: readonly RampClassification[] } {
  const surfaces: PhysicalRampSurface[] = [];
  const rejected: RampClassification[] = [];
  props.forEach((p, i) => {
    const c = classifyPlacedRamp(map, p);
    if (c.supported && c.surface) surfaces.push(c.surface);
    else rejected.push(Object.freeze({ ...c, detail: c.detail ?? `ramp #${i} rejected: ${c.reason}` }));
  });
  return Object.freeze({ surfaces: Object.freeze(surfaces), rejected: Object.freeze(rejected) });
}

/**
 * Physical ramp elevation at (s, lateral) — the legacy incline profile
 * h = height · ((s − start)/length)^1.4, max over overlapping ramps.
 * NOTE: the old renderer-only scripted "jump arc" past the crest is gone;
 * ballistics past the crest belong to physics (exit-speed preserving).
 */
export function rampHeightAt(ramps: readonly PhysicalRampSurface[], s: number, lateral: number): number {
  let maxElev = 0;
  for (const ramp of ramps) {
    if (Math.abs(lateral - ramp.centerLateral) > ramp.halfWidth + RADIUS) continue;
    const delta = s - ramp.startDist;
    if (delta < 0 || delta > ramp.length) continue;
    const h = ramp.height * Math.pow(delta / ramp.length, ramp.exponent);
    if (h > maxElev) maxElev = h;
  }
  return maxElev;
}

/** dh/ds of the active ramp surface (0 when no ramp is active). */
export function rampSlopeAt(ramps: readonly PhysicalRampSurface[], s: number, lateral: number): number {
  let best: PhysicalRampSurface | null = null;
  let maxElev = 0;
  for (const ramp of ramps) {
    if (Math.abs(lateral - ramp.centerLateral) > ramp.halfWidth + RADIUS) continue;
    const delta = s - ramp.startDist;
    if (delta < 0 || delta > ramp.length) continue;
    const h = ramp.height * Math.pow(delta / ramp.length, ramp.exponent);
    if (h > maxElev) { maxElev = h; best = ramp; }
  }
  if (!best) return 0;
  const delta = s - best.startDist;
  if (delta <= 0) return 0;
  return best.height * (best.exponent / best.length) * Math.pow(delta / best.length, best.exponent - 1);
}

/** Surface normal on a ramp (blend of ribbon up against incline gradients). */
export function rampNormalAt(map: TrackSpaceMap, ramps: readonly PhysicalRampSurface[], s: number, lateral: number): CPoint {
  const frame = map.frameAt(s);
  const slope = rampSlopeAt(ramps, s, lateral);
  if (slope === 0) return frame.up;
  // n = normalize(up − tangent·∂h/∂s)
  return vunit(vsub(frame.up, vscale(frame.tangent, slope)));
}
