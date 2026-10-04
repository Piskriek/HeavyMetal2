/**
 * Transform gizmo maths for a 3D editor: move arrows and planes, rotate rings,
 * scale handles, with hit tests, drag results and snapping.
 *
 * Pure maths: no DOM, no Date, no randomness, no imports.
 */

export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type GizmoMode = 'move' | 'rotate' | 'scale';

export type Handle =
  | { kind: 'axis'; axis: Axis }
  | { kind: 'plane'; axes: [Axis, Axis] }
  | { kind: 'ring'; axis: Axis }
  | { kind: 'view-ring' }
  | { kind: 'uniform' };

export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

export interface GizmoState {
  mode: GizmoMode;
  pivot: Vec3;
}

export interface Snap {
  move?: number;
  turn?: number;
  scale?: number;
}

export interface DragResult {
  translate: Vec3;
  rotateAxis: Vec3 | null;
  rotateDeg: number;
  scale: Vec3;
}

/* ------------------------------------------------------------------ */
/* small vector helpers                                                */
/* ------------------------------------------------------------------ */

const EPS = 1e-9;

const v = (x: number, y: number, z: number): Vec3 => [x, y, z];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
/** Negation written as a subtraction so that 0 never becomes -0. */
const neg = (a: Vec3): Vec3 => [0 - a[0], 0 - a[1], 0 - a[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vlen = (a: Vec3): number => Math.sqrt(dot(a, a));
const dist = (a: Vec3, b: Vec3): number => vlen(sub(a, b));

const AXIS_INDEX: { x: 0; y: 1; z: 2 } = { x: 0, y: 1, z: 2 };
const AXES: readonly Axis[] = ['x', 'y', 'z'];

const axisIndex = (a: Axis): 0 | 1 | 2 => AXIS_INDEX[a];

const axisVec = (a: Axis): Vec3 => {
  const out: Vec3 = [0, 0, 0];
  out[axisIndex(a)] = 1;
  return out;
};

const comp = (a: Vec3, i: 0 | 1 | 2): number => a[i];

const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

const snapTo = (value: number, step: number | undefined): number =>
  step !== undefined && step > 0 ? Math.round(value / step) * step : value;

const PLANES: ReadonlyArray<{ axes: [Axis, Axis]; normal: Axis }> = [
  { axes: ['x', 'y'], normal: 'z' },
  { axes: ['x', 'z'], normal: 'y' },
  { axes: ['y', 'z'], normal: 'x' },
];

/* ------------------------------------------------------------------ */
/* geometry primitives                                                 */
/* ------------------------------------------------------------------ */

/** Intersect a ray with the plane through `p` with unit normal `n`. */
const rayPlane = (ray: Ray, p: Vec3, n: Vec3): { t: number; point: Vec3 } | null => {
  const denom = dot(ray.dir, n);
  if (Math.abs(denom) < EPS) return null;
  const t = dot(sub(p, ray.origin), n) / denom;
  if (t < 0) return null;
  return { t, point: add(ray.origin, mul(ray.dir, t)) };
};

/** Closest approach between a ray (t >= 0) and the segment a..b. */
const raySegment = (ray: Ray, a: Vec3, b: Vec3): { t: number; distance: number } => {
  const u = ray.dir;
  const w = sub(b, a);
  const w0 = sub(ray.origin, a);
  const a1 = dot(u, u);
  const b1 = dot(u, w);
  const c1 = dot(w, w);
  const d1 = dot(u, w0);
  const e1 = dot(w, w0);
  const denom = a1 * c1 - b1 * b1;

  let s: number;
  let t: number;
  if (Math.abs(denom) < 1e-12 || c1 < 1e-12) {
    t = Math.max(0, -d1);
    s = c1 < 1e-12 ? 0 : clamp((e1 + t * b1) / c1, 0, 1);
  } else {
    s = clamp((a1 * e1 - b1 * d1) / denom, 0, 1);
    t = Math.max(0, -d1 + s * b1);
    s = clamp((e1 + t * b1) / c1, 0, 1);
  }
  const onRay = add(ray.origin, mul(u, t));
  const onSeg = add(a, mul(w, s));
  return { t, distance: dist(onRay, onSeg) };
};

/** Closest point on the infinite line through `p` with direction `d` to a ray. */
const rayLinePoint = (ray: Ray, p: Vec3, d: Vec3): Vec3 => {
  const w0 = sub(ray.origin, p);
  const a1 = dot(ray.dir, ray.dir);
  const b1 = dot(ray.dir, d);
  const c1 = dot(d, d);
  const d1 = dot(ray.dir, w0);
  const e1 = dot(d, w0);
  const denom = a1 * c1 - b1 * b1;
  if (Math.abs(denom) < 1e-12) return p;
  const s = (a1 * e1 - b1 * d1) / denom;
  return add(p, mul(d, s));
};

/** Distance from a point to a ray's line (unclamped line distance). */
const rayPointDistance = (ray: Ray, p: Vec3): { t: number; distance: number } => {
  const w = sub(p, ray.origin);
  const t = dot(w, ray.dir) / dot(ray.dir, ray.dir);
  const closest = add(ray.origin, mul(ray.dir, t));
  return { t, distance: dist(closest, p) };
};

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/** The +/- keys: each step multiplies by 1.15 (negative steps divide); clamped to 0.2..5. */
export function gizmoGrow(scale: number, steps: number): number {
  return clamp(scale * Math.pow(1.15, steps), 0.2, 5);
}

/** World length of one arrow so the gizmo keeps its size on screen. */
export function worldLength(pivot: Vec3, camera: Vec3, fovDeg: number, scale: number): number {
  return dist(camera, pivot) * Math.tan((fovDeg * Math.PI) / 360) * 0.18 * scale;
}

interface Candidate {
  handle: Handle;
  t: number;
  priority: number; // bigger wins regardless of t
}

export function hitTest(state: GizmoState, ray: Ray, len: number): Handle | null {
  const p = state.pivot;
  const candidates: Candidate[] = [];

  if (state.mode === 'move' || state.mode === 'scale') {
    for (const a of AXES) {
      const tip = add(p, mul(axisVec(a), len));
      const hit = raySegment(ray, p, tip);
      if (hit.distance <= 0.08 * len) {
        candidates.push({ handle: { kind: 'axis', axis: a }, t: hit.t, priority: 0 });
      }
    }
  }

  if (state.mode === 'move') {
    for (const plane of PLANES) {
      const n = axisVec(plane.normal);
      const hit = rayPlane(ray, p, n);
      if (hit === null) continue;
      const local = sub(hit.point, p);
      const i0 = axisIndex(plane.axes[0]);
      const i1 = axisIndex(plane.axes[1]);
      const u = comp(local, i0);
      const w = comp(local, i1);
      const lo = 0.2 * len;
      const hi = 0.45 * len;
      if (u >= lo && u <= hi && w >= lo && w <= hi) {
        candidates.push({
          handle: { kind: 'plane', axes: [plane.axes[0], plane.axes[1]] },
          t: hit.t,
          priority: 1,
        });
      }
    }
  }

  if (state.mode === 'scale') {
    const sphere = rayPointDistance(ray, p);
    if (sphere.t >= 0 && sphere.distance <= 0.15 * len) {
      candidates.push({ handle: { kind: 'uniform' }, t: sphere.t, priority: 1 });
    }
  }

  if (state.mode === 'rotate') {
    for (const a of AXES) {
      const hit = rayPlane(ray, p, axisVec(a));
      if (hit === null) continue;
      const r = dist(hit.point, p);
      if (Math.abs(r - len) <= 0.08 * len) {
        candidates.push({ handle: { kind: 'ring', axis: a }, t: hit.t, priority: 1 });
      }
    }
    const viewNormal = neg(ray.dir);
    const viewHit = rayPlane(ray, p, viewNormal);
    if (viewHit !== null) {
      const r = dist(viewHit.point, p);
      if (Math.abs(r - 1.2 * len) <= 0.08 * len) {
        candidates.push({ handle: { kind: 'view-ring' }, t: viewHit.t, priority: 0 });
      }
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0] as Candidate;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i] as Candidate;
    if (c.priority > best.priority || (c.priority === best.priority && c.t < best.t)) {
      best = c;
    }
  }
  return best.handle;
}

const idle = (): DragResult => ({
  translate: [0, 0, 0],
  rotateAxis: null,
  rotateDeg: 0,
  scale: [1, 1, 1],
});

const ratio = (from: number, to: number): number =>
  Math.abs(from) < 1e-12 ? 1 : to / from;

export function drag(
  state: GizmoState,
  handle: Handle,
  start: Ray,
  now: Ray,
  len: number,
  snap?: Snap,
): DragResult {
  const p = state.pivot;
  const result = idle();

  if (handle.kind === 'axis') {
    const d = axisVec(handle.axis);
    const i = axisIndex(handle.axis);
    const a0 = comp(sub(rayLinePoint(start, p, d), p), i);
    const a1 = comp(sub(rayLinePoint(now, p, d), p), i);
    if (state.mode === 'scale') {
      const r = snapTo(ratio(a0, a1), snap?.scale);
      const s: Vec3 = [1, 1, 1];
      s[i] = r;
      result.scale = s;
    } else {
      const moved = snapTo(a1 - a0, snap?.move);
      const t: Vec3 = [0, 0, 0];
      t[i] = moved;
      result.translate = t;
    }
    return result;
  }

  if (handle.kind === 'plane') {
    const i0 = axisIndex(handle.axes[0]);
    const i1 = axisIndex(handle.axes[1]);
    const normalIndex = (3 - i0 - i1) as 0 | 1 | 2;
    const n: Vec3 = [0, 0, 0];
    n[normalIndex] = 1;
    const h0 = rayPlane(start, p, n);
    const h1 = rayPlane(now, p, n);
    if (h0 === null || h1 === null) return result;
    const delta = sub(h1.point, h0.point);
    const t: Vec3 = [0, 0, 0];
    t[i0] = snapTo(comp(delta, i0), snap?.move);
    t[i1] = snapTo(comp(delta, i1), snap?.move);
    result.translate = t;
    return result;
  }

  if (handle.kind === 'ring' || handle.kind === 'view-ring') {
    const n: Vec3 = handle.kind === 'ring' ? axisVec(handle.axis) : neg(start.dir);
    const h0 = rayPlane(start, p, n);
    const h1 = rayPlane(now, p, n);
    result.rotateAxis = v(n[0], n[1], n[2]);
    if (h0 === null || h1 === null) return result;
    const v0 = sub(h0.point, p);
    const v1 = sub(h1.point, p);
    // a degenerate hit (right on the pivot) gives no meaningful angle
    const tiny = 1e-12 * Math.max(1, Math.abs(len));
    if (vlen(v0) <= tiny || vlen(v1) <= tiny) return result;
    const sinPart = dot(cross(v0, v1), n);
    const cosPart = dot(v0, v1);
    const deg = (Math.atan2(sinPart, cosPart) * 180) / Math.PI;
    result.rotateDeg = snapTo(deg, snap?.turn);
    return result;
  }

  // uniform scale
  const n = neg(start.dir);
  const h0 = rayPlane(start, p, n);
  const h1 = rayPlane(now, p, n);
  if (h0 === null || h1 === null) return result;
  const r = snapTo(ratio(dist(h0.point, p), dist(h1.point, p)), snap?.scale);
  result.scale = [r, r, r];
  return result;
}