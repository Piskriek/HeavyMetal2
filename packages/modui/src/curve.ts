import type { Box, Pt } from './types';

/** Clamp a number into 0..1 (NaN/Infinity fall back to 0, -0 is normalised). */
export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c === 0 ? 0 : c;
}

/** Snap to a grid (0 = off), then clamp into 0..1. */
export function snap01(v: number, snap: number): number {
  if (!(snap > 0)) return clamp01(v);
  return clamp01(Math.round(v / snap) * snap);
}

const copy = (points: readonly Pt[]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

/** Data space (x 0..1, y 0..1) -> SVG pixels, y flipped so 1 is the top. */
export function toPx(box: Box, p: Pt): Pt {
  return [box.x + p[0] * box.w, box.y + box.h - p[1] * box.h];
}

/** SVG pixels -> data space, clamped into 0..1. */
export function fromPx(box: Box, px: Pt): Pt {
  return [clamp01((px[0] - box.x) / box.w), clamp01((box.y + box.h - px[1]) / box.h)];
}

/** Evaluate the graph at `x` (already clamped to the first/last point outside of it). */
export function sampleCurve(points: readonly Pt[], x: number, interpolation: 'linear' | 'smooth' | 'step'): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]![1];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (x < a[0] || x > b[0]) continue;
    if (interpolation === 'step') return a[1];
    const span = b[0] - a[0];
    let t = span === 0 ? 1 : (x - a[0]) / span;
    if (interpolation === 'smooth') t = t * t * (3 - 2 * t);
    return a[1] + (b[1] - a[1]) * t;
  }
  return last[1];
}

const num = (n: number): string => String(Math.round(n * 100) / 100);

/** SVG path ('M x y L x y ...') of the sampled curve, in pixels. Empty points -> ''. */
export function curvePath(box: Box, points: readonly Pt[], interpolation: 'linear' | 'smooth' | 'step', samples = 64): string {
  if (points.length === 0 || samples < 1) return '';
  const x0 = points[0]![0];
  const x1 = points[points.length - 1]![0];
  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = x0 + (x1 - x0) * (i / samples);
    const px = toPx(box, [x, sampleCurve(points, x, interpolation)]);
    parts.push(`${num(px[0])} ${num(px[1])}`);
  }
  return `M ${parts[0]} L ${parts.slice(1).join(' L ')}`;
}

/** Index of the nearest point within `radius` pixels of `px`, else -1. */
export function hitPoint(box: Box, points: readonly Pt[], px: Pt, radius: number): number {
  let best = -1;
  let bestD = radius >= 0 ? radius * radius : -1;
  for (let i = 0; i < points.length; i++) {
    const p = toPx(box, points[i]!);
    const dx = p[0] - px[0];
    const dy = p[1] - px[1];
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Move one point: clamped to 0..1, optionally snapped, never crossing its neighbours, ends pinned. */
export function movePoint(points: readonly Pt[], index: number, to: Pt, snap = 0): Pt[] {
  const next = copy(points);
  if (index < 0 || index >= next.length) return next;
  const n = next.length;
  let x = snap01(to[0], snap);
  const y = snap01(to[1], snap);
  if (n >= 2) {
    const prev = index > 0 ? next[index - 1]![0] : undefined;
    const nxt = index < n - 1 ? next[index + 1]![0] : undefined;
    if (prev !== undefined && nxt !== undefined) {
      const lo = prev + 0.001;
      const hi = nxt - 0.001;
      x = lo > hi ? (prev + nxt) / 2 : Math.min(Math.max(x, lo), hi);
    } else if (prev !== undefined) {
      x = Math.max(x, prev + 0.001);
    } else if (nxt !== undefined) {
      x = Math.min(x, nxt - 0.001);
    }
    if (index === 0) x = 0;
    if (index === n - 1) x = 1;
  }
  next[index] = [x === 0 ? 0 : x, y === 0 ? 0 : y];
  next.sort((a, b) => a[0] - b[0]);
  return next;
}

/** Insert a point keeping the x order; points closer than 0.002 in x to an existing one are ignored. */
export function addPoint(points: readonly Pt[], at: Pt, snap = 0): Pt[] {
  const x = snap01(at[0], snap);
  const y = snap01(at[1], snap);
  for (const p of points) if (Math.abs(p[0] - x) < 0.002) return copy(points);
  const next = copy(points);
  next.push([x, y]);
  next.sort((a, b) => a[0] - b[0]);
  return next;
}

/** Remove a point, but never drop below two points. */
export function removePoint(points: readonly Pt[], index: number): Pt[] {
  if (points.length <= 2 || index < 0 || index >= points.length) return copy(points);
  return points.filter((_, i) => i !== index).map((p) => [p[0], p[1]] as Pt);
}
