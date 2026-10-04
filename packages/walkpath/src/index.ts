export type Vec3 = [number, number, number];
export interface PathPoint { pos: Vec3; wait: number }
export type PathMode = 'once' | 'loop' | 'ping-pong';
export interface WalkPath { points: PathPoint[]; mode: PathMode; speed: number; smooth: boolean }
export interface WalkState { pos: Vec3; yaw: number; moving: boolean; done: boolean }

interface Leg { from: number; to: number; length: number; pts: Vec3[]; cum: number[] }

const PIECES = 32;
const ZERO: Vec3 = [0, 0, 0];

const dist = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const yawDeg = (dx: number, dz: number): number => (Math.atan2(dx, dz) * 180) / Math.PI;

function at(p: WalkPath, i: number): Vec3 {
  const q = p.points[i];
  return q ? [q.pos[0], q.pos[1], q.pos[2]] : [0, 0, 0];
}
function waitAt(p: WalkPath, i: number): number {
  const q = p.points[i];
  return q && q.wait > 0 ? q.wait : 0;
}

/** Control point for Catmull-Rom; wraps for loops, mirrors at the ends otherwise. */
function ctrl(p: WalkPath, i: number): Vec3 {
  const n = p.points.length;
  if (p.mode === 'loop') return at(p, ((i % n) + n) % n);
  if (i < 0) { const a = at(p, 0), b = at(p, 1); return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }
  if (i >= n) { const a = at(p, n - 1), b = at(p, n - 2); return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }
  return at(p, i);
}

function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const u2 = u * u, u3 = u2 * u;
  const c = (k: 0 | 1 | 2): number =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
  return [c(0), c(1), c(2)];
}

/** Build a leg; `seg` is the forward segment index (seg -> seg+1, wrapping for loop), `reversed` walks it backwards. */
function buildLeg(p: WalkPath, seg: number, reversed: boolean): Leg {
  const n = p.points.length;
  const a = seg, b = (seg + 1) % n;
  let pts: Vec3[];
  if (!p.smooth) {
    pts = [at(p, a), at(p, b)];
  } else {
    const p0 = ctrl(p, seg - 1), p1 = at(p, a), p2 = at(p, b), p3 = ctrl(p, seg + 2);
    pts = [];
    for (let k = 0; k <= PIECES; k++) pts.push(k === 0 ? p1 : k === PIECES ? p2 : catmull(p0, p1, p2, p3, k / PIECES));
  }
  if (reversed) pts.reverse();
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    if (prev && cur) total += dist(prev, cur);
    cum.push(total);
  }
  return { from: reversed ? b : a, to: reversed ? a : b, length: total, pts, cum };
}

function buildLegs(p: WalkPath): Leg[] {
  const n = p.points.length;
  if (n < 2) return [];
  const out: Leg[] = [];
  if (p.mode === 'loop') {
    for (let s = 0; s < n; s++) out.push(buildLeg(p, s, false));
  } else {
    for (let s = 0; s < n - 1; s++) out.push(buildLeg(p, s, false));
    if (p.mode === 'ping-pong') for (let s = n - 2; s >= 0; s--) out.push(buildLeg(p, s, true));
  }
  return out;
}

/** Position and direction at distance d along a polyline. Direction is zero if no piece has length. */
function alongPolyline(pts: Vec3[], cum: number[], d: number): { pos: Vec3; dir: Vec3 } {
  const last = pts.length - 1;
  const total = cum[last] ?? 0;
  const dd = Math.max(0, Math.min(total, d));
  let i = 0;
  while (i < last - 1 && (cum[i + 1] ?? 0) < dd) i++;
  // skip to a piece with positive length when sitting exactly on a boundary of a zero piece
  while (i < last - 1 && (cum[i + 1] ?? 0) - (cum[i] ?? 0) <= 0 && (cum[i + 1] ?? 0) <= dd) i++;
  const a = pts[i] ?? ZERO, b = pts[i + 1] ?? a;
  const len = (cum[i + 1] ?? 0) - (cum[i] ?? 0);
  const u = len > 0 ? (dd - (cum[i] ?? 0)) / len : 0;
  const dir: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { pos: [a[0] + dir[0] * u, a[1] + dir[1] * u, a[2] + dir[2] * u], dir };
}

function firstYaw(leg: Leg, fallback: number): number {
  for (let i = 1; i < leg.pts.length; i++) {
    const a = leg.pts[i - 1], b = leg.pts[i];
    if (a && b && (b[0] !== a[0] || b[2] !== a[2])) return yawDeg(b[0] - a[0], b[2] - a[2]);
  }
  return fallback;
}
function lastYaw(leg: Leg, fallback: number): number {
  for (let i = leg.pts.length - 1; i >= 1; i--) {
    const a = leg.pts[i - 1], b = leg.pts[i];
    if (a && b && (b[0] !== a[0] || b[2] !== a[2])) return yawDeg(b[0] - a[0], b[2] - a[2]);
  }
  return fallback;
}

export function legs(p: WalkPath): { from: number; to: number; length: number }[] {
  return buildLegs(p).map((l) => ({ from: l.from, to: l.to, length: l.length }));
}

export function pathLength(p: WalkPath): number {
  return buildLegs(p).reduce((s, l) => s + l.length, 0);
}

function cycleTimeOf(p: WalkPath, ls: Leg[]): number {
  if (ls.length === 0 || p.speed <= 0) return 0;
  let t = 0;
  for (const l of ls) t += waitAt(p, l.from) + l.length / p.speed;
  if (p.mode === 'once') t += waitAt(p, p.points.length - 1);
  return t;
}

export function cycleTime(p: WalkPath): number {
  return cycleTimeOf(p, buildLegs(p));
}

export function walkerAt(p: WalkPath, t: number): WalkState {
  const ls = buildLegs(p);
  const first = ls[0];
  if (!first || p.speed <= 0) {
    return { pos: at(p, 0), yaw: first ? firstYaw(first, 0) : 0, moving: false, done: p.mode === 'once' };
  }
  const total = cycleTimeOf(p, ls);
  let tt = Math.max(0, t);
  if (p.mode === 'once') {
    if (tt >= total) {
      const end = ls[ls.length - 1] ?? first;
      return { pos: at(p, p.points.length - 1), yaw: lastYaw(end, firstYaw(first, 0)), moving: false, done: true };
    }
  } else if (total > 0) {
    tt = tt % total;
  } else {
    tt = 0;
  }
  let yaw = firstYaw(first, 0);
  for (const l of ls) {
    const w = waitAt(p, l.from);
    if (tt < w) return { pos: at(p, l.from), yaw, moving: false, done: false };
    tt -= w;
    const dur = l.length / p.speed;
    if (tt < dur) {
      const { pos, dir } = alongPolyline(l.pts, l.cum, tt * p.speed);
      if (dir[0] !== 0 || dir[2] !== 0) yaw = yawDeg(dir[0], dir[2]);
      return { pos, yaw, moving: true, done: false };
    }
    tt -= dur;
    yaw = lastYaw(l, yaw);
  }
  // only reachable for 'once' inside the final wait (or at a zero-length cycle)
  const last = ls[ls.length - 1] ?? first;
  return { pos: at(p, last.to), yaw, moving: false, done: false };
}

export function samplePath(p: WalkPath, step: number): Vec3[] {
  const ls = buildLegs(p);
  if (ls.length === 0) return p.points.length > 0 ? [at(p, 0)] : [];
  const pts: Vec3[] = [];
  const cum: number[] = [];
  let total = 0;
  for (const l of ls) {
    for (let i = 0; i < l.pts.length; i++) {
      const q = l.pts[i];
      if (!q) continue;
      if (i === 0 && pts.length > 0) continue; // join shares the previous leg's end
      const prev = pts[pts.length - 1];
      if (prev) total += dist(prev, q);
      pts.push([q[0], q[1], q[2]]);
      cum.push(total);
    }
  }
  const end = pts[pts.length - 1] ?? at(p, 0);
  if (!(step > 0) || total <= 0) return [pts[0] ?? at(p, 0), [end[0], end[1], end[2]]];
  const out: Vec3[] = [];
  const count = Math.floor(total / step + 1e-9);
  for (let k = 0; k <= count; k++) out.push(alongPolyline(pts, cum, k * step).pos);
  const lastOut = out[out.length - 1];
  if (!lastOut || dist(lastOut, end) > 1e-9) out.push([end[0], end[1], end[2]]);
  return out;
}