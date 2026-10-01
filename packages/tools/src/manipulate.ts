import type { ManipulationSettings, Quat, Vec3 } from '@hm/contracts';

/**
 * Pure manipulation math: what a "manipulation preset" (snap grid, snap angle, axes, mirror, array, magnet,
 * surface snapping) does to a raw pointer result. No state, no DOM, no three: every tool uses these, tests pin them.
 */

export const DEFAULT_MANIPULATION: ManipulationSettings = {
  snapGrid: 0,
  snapAngle: 0,
  snapToSurface: false,
  alignToNormal: false,
  axes: 'free',
  pivot: 'center',
  space: 'world',
  mirror: 'none',
  array: { count: 1, offset: [0, 0, 0] },
  magnet: { radius: 0, strength: 0 },
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/** Round to the nearest multiple of `step` (0 or less = off). Avoids -0. */
export function snapValue(v: number, step: number): number {
  if (!(step > 0)) return v;
  const r = Math.round(v / step) * step;
  return r === 0 ? 0 : r;
}

export const snapPoint = (p: Vec3, step: number): Vec3 => [snapValue(p[0], step), snapValue(p[1], step), snapValue(p[2], step)];

/** Snap an angle in degrees; the result is normalised to (-180, 180]. */
export function snapAngle(deg: number, step: number): number {
  const s = snapValue(deg, step);
  let a = ((s % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

const AXIS_MASK: Record<ManipulationSettings['axes'], readonly [number, number, number]> = {
  free: [1, 1, 1], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], xy: [1, 1, 0], xz: [1, 0, 1], yz: [0, 1, 1],
};

/** Rotate v by unit quaternion q (x,y,z,w). */
export function rotateByQuat(v: Vec3, q: Quat): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
const IDENTITY: Quat = [0, 0, 0, 1];

/** Keep only the allowed axes of a movement; in 'local' space the mask applies in the object's frame. */
export function constrainDelta(delta: Vec3, axes: ManipulationSettings['axes'], space: ManipulationSettings['space'], rotation: Quat = IDENTITY): Vec3 {
  const m = AXIS_MASK[axes];
  if (space === 'local') {
    const l = rotateByQuat(delta, conjugate(rotation));
    return rotateByQuat([l[0] * m[0], l[1] * m[1], l[2] * m[2]], rotation);
  }
  return [delta[0] * m[0], delta[1] * m[1], delta[2] * m[2]];
}

export interface SurfaceHit { readonly point: Vec3; readonly normal: Vec3 }

export interface MoveContext {
  readonly rotation?: Quat;
  /** What the pointer hit under the cursor (from the renderer's pick), if anything. */
  readonly surface?: SurfaceHit | null;
  /** Points the magnet may pull towards (other objects' anchors, track nodes ...). */
  readonly magnetTargets?: readonly Vec3[];
  /** The cursor's ground position, used when pivot is 'cursor'. */
  readonly cursor?: Vec3;
}

export interface MoveResult {
  readonly position: Vec3;
  /** Set when alignToNormal is on and a surface was hit: the up axis (0,1,0) maps to the surface normal. */
  readonly rotation: Quat | null;
  readonly snappedToSurface: boolean;
  readonly magnetTarget: Vec3 | null;
}

/** Shortest-arc rotation taking +Y to the unit-length `n` (identity if already aligned, 180 degrees about X if opposite). */
export function quatFromUpTo(n: Vec3): Quat {
  const l = len(n);
  if (l === 0) return IDENTITY;
  const x = n[0] / l, y = n[1] / l, z = n[2] / l;
  if (y < -0.999999) return [1, 0, 0, 0];
  // cross(up, n) = (z, 0, -x); w = 1 + dot
  const w = 1 + y;
  const q: Quat = [z, 0, -x, w];
  const m = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / m, q[1] / m, q[2] / m, q[3] / m];
}

/**
 * The movement pipeline of every move-like tool: axis constraint, then grid snap, then surface snap, then magnet.
 * `start` is where the object was when the drag began, `raw` the unconstrained wanted position.
 */
export function manipulateMove(s: ManipulationSettings, start: Vec3, raw: Vec3, ctx: MoveContext = {}): MoveResult {
  let p = add(start, constrainDelta(sub(raw, start), s.axes, s.space, ctx.rotation));
  if (s.snapGrid > 0) {
    const m = AXIS_MASK[s.axes];
    const g = snapPoint(p, s.snapGrid);
    // only snap the axes that are free to move; a locked axis keeps its exact start value
    p = [m[0] ? g[0] : p[0], m[1] ? g[1] : p[1], m[2] ? g[2] : p[2]];
  }
  let snapped = false;
  let rotation: Quat | null = null;
  if (s.snapToSurface && ctx.surface) {
    p = ctx.surface.point;
    snapped = true;
    if (s.alignToNormal) rotation = quatFromUpTo(ctx.surface.normal);
  }
  let target: Vec3 | null = null;
  if (s.magnet.radius > 0 && s.magnet.strength > 0 && ctx.magnetTargets) {
    let best = Infinity;
    for (const t of ctx.magnetTargets) {
      const d = len(sub(t, p));
      if (d <= s.magnet.radius && d < best) { best = d; target = t; }
    }
    if (target) {
      const k = Math.min(1, Math.max(0, s.magnet.strength));
      p = [p[0] + (target[0] - p[0]) * k, p[1] + (target[1] - p[1]) * k, p[2] + (target[2] - p[2]) * k];
    }
  }
  return { position: p, rotation, snappedToSurface: snapped, magnetTarget: target };
}

/** The pivot of a group selection: 'first' = the first member, 'ground' = centre with y 0, 'cursor' = ctx.cursor. */
export function pivotOf(s: ManipulationSettings, positions: readonly Vec3[], cursor?: Vec3): Vec3 {
  if (positions.length === 0) return [0, 0, 0];
  if (s.pivot === 'cursor' && cursor) return cursor;
  if (s.pivot === 'first') return positions[0]!;
  let x = 0, y = 0, z = 0;
  for (const p of positions) { x += p[0]; y += p[1]; z += p[2]; }
  const n = positions.length;
  return [x / n, s.pivot === 'ground' ? 0 : y / n, z / n];
}

export interface Placement { readonly position: Vec3; readonly mirrored: 'none' | 'x' | 'z'; readonly index: number }

/** Mirror a point across the plane x = c (mirror 'x') or z = c ('z'). */
export function mirrorPoint(p: Vec3, mirror: ManipulationSettings['mirror'], centre: Vec3 = [0, 0, 0]): Vec3 {
  if (mirror === 'x') return [2 * centre[0] - p[0], p[1], p[2]];
  if (mirror === 'z') return [p[0], p[1], 2 * centre[2] - p[2]];
  return p;
}

/**
 * Every instance a placement makes: `array.count` copies spaced by `array.offset`, each also mirrored when
 * mirror is on. Count is clamped to [1, 256] so a typo cannot freeze the editor.
 */
export function expandPlacements(s: ManipulationSettings, position: Vec3, mirrorCentre: Vec3 = [0, 0, 0]): readonly Placement[] {
  const count = Math.min(256, Math.max(1, Math.floor(s.array.count)));
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const p: Vec3 = [position[0] + s.array.offset[0] * i, position[1] + s.array.offset[1] * i, position[2] + s.array.offset[2] * i];
    out.push({ position: p, mirrored: 'none', index: i });
    if (s.mirror !== 'none') out.push({ position: mirrorPoint(p, s.mirror, mirrorCentre), mirrored: s.mirror, index: i });
  }
  return out;
}

/** Rotation about Y by `deg` degrees snapped by settings.snapAngle (the usual "turn" tool maths). */
export function rotateYaw(s: ManipulationSettings, currentDeg: number, deltaDeg: number): number {
  return snapAngle(currentDeg + deltaDeg, s.snapAngle);
}
