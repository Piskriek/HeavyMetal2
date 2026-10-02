/**
 * Centreline generation: centripetal Catmull-Rom through the control points,
 * densely sampled and then re-sampled to (near) equal arc-length spacing.
 *
 * The re-sampling keeps every control point pinned on the centreline: the slots
 * a control point lands on get the exact control point position and the
 * remaining slots in between are spread evenly, so the curve passes through the
 * control points (0 m error) while the sample gap stays close to `spacing`.
 */

import { dist, isNum, lerp2, round2 } from './math';
import type { TrackDraft, Vec2 } from './types';

const DEFAULT_SPACING = 6;
const DEFAULT_ALPHA = 0.5;
const MAX_STEP = 1; // dense sample step in metres before re-sampling

interface Knots {
  readonly p0: Vec2;
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly p3: Vec2;
  readonly t0: number;
  readonly t1: number;
  readonly t2: number;
  readonly t3: number;
}

interface Curve {
  closed: boolean;
  /** Dense samples; for a closed curve the first point is repeated at the end. */
  readonly work: readonly Vec2[];
  /** Cumulative arc length per entry of `work`. */
  readonly cum: readonly number[];
  readonly total: number;
  /** Arc length of every control point along the curve. */
  readonly anchors: readonly number[];
}

function knots(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, alpha: number): Knots {
  const step = (a: Vec2, b: Vec2): number => Math.pow(Math.max(dist(a, b), 1e-3), alpha);
  const t0 = 0;
  const t1 = t0 + step(p0, p1);
  const t2 = t1 + step(p1, p2);
  const t3 = t2 + step(p2, p3);
  return { p0, p1, p2, p3, t0, t1, t2, t3 };
}

/** Barry-Goldman evaluation of the centripetal Catmull-Rom spline. */
function evaluate(k: Knots, t: number): Vec2 {
  const a1 = lerp2(k.p0, k.p1, (t - k.t0) / (k.t1 - k.t0));
  const a2 = lerp2(k.p1, k.p2, (t - k.t1) / (k.t2 - k.t1));
  const a3 = lerp2(k.p2, k.p3, (t - k.t2) / (k.t3 - k.t2));
  const b1 = lerp2(a1, a2, (t - k.t0) / (k.t2 - k.t0));
  const b2 = lerp2(a2, a3, (t - k.t1) / (k.t3 - k.t1));
  return lerp2(b1, b2, (t - k.t1) / (k.t2 - k.t1));
}

function buildCurve(ctrl: readonly Vec2[], closed: boolean, alpha: number): Curve {
  const m = ctrl.length;
  const segments = closed ? m : m - 1;
  const samples: Vec2[] = [ctrl[0]!];
  const ctrlIndex: number[] = [0];
  for (let i = 0; i < segments; i++) {
    const p1 = ctrl[i]!;
    const p2 = ctrl[(i + 1) % m]!;
    const p0 = ctrl[closed ? (i - 1 + m) % m : Math.max(0, i - 1)]!;
    const p3 = ctrl[closed ? (i + 2) % m : Math.min(m - 1, i + 2)]!;
    const k = knots(p0, p1, p2, p3, alpha);
    const steps = Math.max(8, Math.min(1024, Math.ceil(dist(p1, p2) / MAX_STEP)));
    for (let s = 1; s <= steps; s++) {
      samples.push(evaluate(k, k.t1 + ((k.t2 - k.t1) * s) / steps));
    }
    if (i + 1 < segments) ctrlIndex.push(samples.length - 1);
  }
  // a closed dense curve already ends on its first point, so it wraps by itself
  const work = samples;
  const cum: number[] = [0];
  for (let i = 1; i < work.length; i++) cum.push(cum[i - 1]! + dist(work[i - 1]!, work[i]!));
  const total = cum[cum.length - 1]!;
  return { closed, work, cum, total, anchors: ctrlIndex.map((i) => cum[i]!) };
}

function pointAtArc(c: Curve, s: number): Vec2 {
  const total = c.total;
  const target = c.closed ? ((s % total) + total) % total : Math.min(Math.max(s, 0), total);
  let lo = 0;
  let hi = c.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((c.cum[mid] ?? 0) <= target) lo = mid;
    else hi = mid;
  }
  const a = c.work[lo]!;
  const b = c.work[lo + 1] ?? c.work[c.work.length - 1]!;
  const span = (c.cum[lo + 1] ?? total) - (c.cum[lo] ?? 0);
  const u = span > 1e-12 ? (target - (c.cum[lo] ?? 0)) / span : 0;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/**
 * Arc positions for `count` slots. Control points are pinned to the slot
 * nearest to their arc length; the slots in between are spread evenly.
 * Returns `null` when the pins cannot fit (then the caller falls back to a
 * plain uniform re-sample).
 */
function pinnedArcs(
  total: number,
  count: number,
  closed: boolean,
  anchors: readonly number[],
): number[] | null {
  if (count < 3 || total <= 0 || anchors.length < 2) return null;
  const last = closed ? count : count - 1;
  const slots: number[] = [];
  let prev = -1;
  for (const arc of anchors) {
    let slot = Math.round((arc / total) * last);
    if (slot <= prev) slot = prev + 1;
    if (slot > last) return null;
    slots.push(slot);
    prev = slot;
  }
  if (slots[0] !== 0 || slots.length < 2) return null;
  const arcs: number[] = new Array<number>(count).fill(0);
  for (let j = 0; j < slots.length; j++) {
    const isFinal = j === slots.length - 1;
    const edge = closed ? count : count - 1;
    const s0 = slots[j]!;
    const s1 = isFinal ? edge : slots[j + 1]!;
    const a0 = anchors[j]!;
    const a1 = isFinal ? total : anchors[j + 1]!;
    const steps = s1 - s0;
    if (steps < 1) {
      if (isFinal && !closed && s0 === edge && a0 === total) continue;
      return null;
    }
    for (let k = 0; k < steps; k++) {
      const slot = s0 + k;
      if (slot >= count) return null;
      arcs[slot] = a0 + ((a1 - a0) * k) / steps;
    }
  }
  if (!closed) arcs[count - 1] = total;
  return arcs;
}

function uniformArcs(total: number, count: number, closed: boolean): number[] {
  const denom = closed ? count : count - 1;
  const arcs: number[] = [];
  for (let i = 0; i < count; i++) arcs.push(denom > 0 ? (total * i) / denom : 0);
  return arcs;
}

const clean = (p: Vec2): Vec2 => [round2(p[0]), round2(p[1])];

/**
 * Smooth centreline of a draft.
 *
 * * `< 2` control points -> `[]`
 * * `2` control points -> a straight, open line
 * * otherwise -> centripetal Catmull-Rom sampled to `count = max(3, round(length / spacing))`
 *   points; closed drafts yield a closed loop (the first point is not repeated).
 */
export function toCenterline(d: TrackDraft, spacing = DEFAULT_SPACING, alpha = DEFAULT_ALPHA): Vec2[] {
  const ctrl: Vec2[] = d.points.map((p): Vec2 => [p.x, p.z]);
  if (ctrl.length < 2) return [];
  const step = isNum(spacing) && spacing >= 0.1 ? spacing : DEFAULT_SPACING;
  const bend = isNum(alpha) && alpha > 0 && alpha <= 1 ? alpha : DEFAULT_ALPHA;
  if (ctrl.length === 2) {
    const p = ctrl[0]!;
    const q = ctrl[1]!;
    const len = dist(p, q);
    if (!(len > 1e-9)) return [clean(p), clean(q)];
    const count = Math.max(3, Math.round(len / step));
    const line: Vec2[] = [];
    for (let i = 0; i < count; i++) line.push(lerp2(p, q, i / (count - 1)));
    return line.map(clean);
  }
  const closed = d.closed;
  const curve = buildCurve(ctrl, closed, bend);
  const count = Math.max(3, Math.round(curve.total / step));
  const arcs = pinnedArcs(curve.total, count, closed, curve.anchors) ?? uniformArcs(curve.total, count, closed);
  return arcs.map((s) => clean(pointAtArc(curve, s)));
}

/** Polyline length; a closed loop adds the hop back to the first point. */
export function loopLength(points: readonly Vec2[], closed: boolean): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!);
  if (closed && points.length > 1) total += dist(points[points.length - 1]!, points[0]!);
  return total;
}
