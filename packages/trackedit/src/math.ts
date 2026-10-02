/**
 * Small deterministic geometry helpers shared by the trackedit modules.
 * No DOM, no randomness, no clock.
 */

import type { Vec2 } from './types';

export const EPS = 1e-9;
export const TAU = Math.PI * 2;

/** `true` only for real, finite numbers (rejects NaN / Infinity / non-numbers). */
export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Round to 2 decimals — control points are stored on a centimetre grid. */
export function round2(v: number): number {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r; // never hand out -0
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Road widths are clamped to the 4..40 m band the renderer expects. */
export function clampWidth(w: number): number {
  return clamp(w, 4, 40);
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function lerp2(a: Vec2, b: Vec2, u: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** Distance from `p` to segment `a-b`, plus the normalised parameter `t`. */
export function pointSegment(p: Vec2, a: Vec2, b: Vec2): { distance: number; t: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 < EPS ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2, 0, 1);
  const distance = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
  return { distance, t };
}

/**
 * Radius of the circumscribed circle of the triangle `a,b,c`.
 * Returns `Infinity` for degenerate / collinear triples (i.e. no turn at all).
 */
export function circumradius(a: Vec2, b: Vec2, c: Vec2): number {
  const la = dist(b, c);
  const lb = dist(a, c);
  const lc = dist(a, b);
  if (!(la > EPS && lb > EPS && lc > EPS)) return Infinity;
  const s = (la + lb + lc) / 2;
  const area2 = s * (s - la) * (s - lb) * (s - lc);
  if (!isNum(area2) || area2 <= 1e-12) return Infinity;
  return (la * lb * lc) / (4 * Math.sqrt(area2));
}

/** Signed sine of the turn at `b` for the path `a -> b -> c`-style cross product. */
function signedSin(o: Vec2, a: Vec2, b: Vec2): number {
  const ax = a[0] - o[0];
  const az = a[1] - o[1];
  const bx = b[0] - o[0];
  const bz = b[1] - o[1];
  const cross = ax * bz - az * bx;
  const denom = Math.hypot(ax, az) * Math.hypot(bx, bz);
  return denom < EPS ? 0 : cross / denom;
}

function between(a: Vec2, b: Vec2, p: Vec2): boolean {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 < EPS) return dist(a, p) < EPS;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

const SIN_EPS = 1e-9;

/** `true` when the segments `p1-p2` and `p3-p4` share at least one point. */
export function segmentsCross(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = signedSin(p3, p4, p1);
  const d2 = signedSin(p3, p4, p2);
  const d3 = signedSin(p1, p2, p3);
  const d4 = signedSin(p1, p2, p4);
  const proper =
    ((d1 > SIN_EPS && d2 < -SIN_EPS) || (d1 < -SIN_EPS && d2 > SIN_EPS)) &&
    ((d3 > SIN_EPS && d4 < -SIN_EPS) || (d3 < -SIN_EPS && d4 > SIN_EPS));
  if (proper) return true;
  if (Math.abs(d1) <= SIN_EPS && between(p3, p4, p1)) return true;
  if (Math.abs(d2) <= SIN_EPS && between(p3, p4, p2)) return true;
  if (Math.abs(d3) <= SIN_EPS && between(p1, p2, p3)) return true;
  if (Math.abs(d4) <= SIN_EPS && between(p1, p2, p4)) return true;
  return false;
}

export function bboxOf(points: readonly Vec2[]): {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
} {
  let minX = 0;
  let minZ = 0;
  let maxX = 0;
  let maxZ = 0;
  let first = true;
  for (const p of points) {
    if (first) {
      minX = maxX = p[0];
      minZ = maxZ = p[1];
      first = false;
      continue;
    }
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, minZ, maxX, maxZ };
}

/** Readable number: one decimal at most, no trailing `.0`. */
export function fmt(v: number): string {
  if (!isNum(v)) return '∞';
  return String(Math.round(v * 10) / 10);
}
