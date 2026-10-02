/**
 * Pure `TrackDraft` operations.
 *
 * Every function returns a NEW draft (or the very same draft when the request
 * is a no-op) and never mutates its input. Numbers are kept finite: NaN/Infinity
 * input leaves the draft untouched. Positions are quantised to 0.01 m.
 */

import { bboxOf, clamp, clampWidth, isNum, pointSegment, round2 } from './math';
import type { ControlPoint, TrackDraft, Vec2 } from './types';

const DEFAULT_WIDTH = 12;

function widthOr(w: number, fallback: number): number {
  return isNum(w) ? clampWidth(w) : fallback;
}

function toPoint(p: Vec2): ControlPoint | null {
  if (!isNum(p[0]) || !isNum(p[1])) return null;
  return { x: round2(p[0]), z: round2(p[1]) };
}

function hasIndex(d: TrackDraft, i: number): boolean {
  return isNum(i) && Number.isInteger(i) && i >= 0 && i < d.points.length;
}

function withPoints(d: TrackDraft, points: readonly ControlPoint[]): TrackDraft {
  return { ...d, points };
}

function bboxCentre(d: TrackDraft): Vec2 | null {
  if (d.points.length === 0) return null;
  const b = bboxOf(d.points.map((p): Vec2 => [p.x, p.z]));
  return [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
}

/** A fresh, empty draft. */
export function emptyDraft(width = DEFAULT_WIDTH): TrackDraft {
  return { points: [], closed: false, width: widthOr(width, DEFAULT_WIDTH) };
}

/** Append a point, or insert it at `index` (clamped into range). */
export function addPoint(d: TrackDraft, p: Vec2, index?: number): TrackDraft {
  const cp = toPoint(p);
  if (!cp) return d;
  const points = [...d.points];
  const at =
    index === undefined || !isNum(index)
      ? points.length
      : clamp(Math.floor(index), 0, points.length);
  points.splice(at, 0, cp);
  return withPoints(d, points);
}

/** Index of the segment (its start point) closest to `p`; `-1` when undefined. */
function nearestSegment(d: TrackDraft, p: Vec2): number {
  const n = d.points.length;
  if (n < 2) return -1;
  const count = d.closed ? n : n - 1;
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < count; i++) {
    const a = d.points[i]!;
    const b = d.points[(i + 1) % n]!;
    const { distance } = pointSegment(p, [a.x, a.z], [b.x, b.z]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** Insert `p` into the segment nearest to it (closing segment included when closed). */
export function insertOnSegment(d: TrackDraft, p: Vec2): TrackDraft {
  if (d.points.length < 2) return addPoint(d, p);
  const seg = nearestSegment(d, [p[0], p[1]]);
  if (seg < 0) return addPoint(d, p);
  return addPoint(d, [p[0], p[1]], seg + 1);
}

export function movePoint(d: TrackDraft, i: number, p: Vec2): TrackDraft {
  if (!hasIndex(d, i) || !isNum(p[0]) || !isNum(p[1])) return d;
  return withPoints(
    d,
    d.points.map((cp, k) => (k === i ? { ...cp, x: round2(p[0]), z: round2(p[1]) } : cp)),
  );
}

/** Deleting from a closed draft never drops it below three points. */
export function deletePoint(d: TrackDraft, i: number): TrackDraft {
  if (!hasIndex(d, i)) return d;
  if (d.closed && d.points.length <= 3) return d;
  return withPoints(d, d.points.filter((_, k) => k !== i));
}

/** Set (clamped 4..40) or clear (`undefined`) the local width override of a point. */
export function setPointWidth(d: TrackDraft, i: number, w: number | undefined): TrackDraft {
  if (!hasIndex(d, i)) return d;
  return withPoints(
    d,
    d.points.map((cp, k) => {
      if (k !== i) return cp;
      if (w === undefined) return { x: cp.x, z: cp.z };
      if (!isNum(w)) return cp;
      return { x: cp.x, z: cp.z, width: clampWidth(w) };
    }),
  );
}

export function setWidth(d: TrackDraft, w: number): TrackDraft {
  if (!isNum(w)) return d;
  return { ...d, width: clampWidth(w) };
}

export function closeLoop(d: TrackDraft): TrackDraft {
  return d.points.length >= 3 ? { ...d, closed: true } : d;
}

export function openLoop(d: TrackDraft): TrackDraft {
  return d.closed ? { ...d, closed: false } : d;
}

export function reverse(d: TrackDraft): TrackDraft {
  return withPoints(d, [...d.points].reverse());
}

export function translate(d: TrackDraft, dx: number, dz: number): TrackDraft {
  if (!isNum(dx) || !isNum(dz)) return d;
  return withPoints(d, d.points.map((p) => ({ ...p, x: round2(p.x + dx), z: round2(p.z + dz) })));
}

export function rotate(d: TrackDraft, radians: number, about: Vec2): TrackDraft {
  if (!isNum(radians) || !isNum(about[0]) || !isNum(about[1])) return d;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = about[0];
  const cz = about[1];
  return withPoints(
    d,
    d.points.map((p) => {
      const x = p.x - cx;
      const z = p.z - cz;
      return { ...p, x: round2(cx + x * cos - z * sin), z: round2(cz + x * sin + z * cos) };
    }),
  );
}

export function scale(d: TrackDraft, k: number, about: Vec2): TrackDraft {
  if (!isNum(k) || k <= 0 || !isNum(about[0]) || !isNum(about[1])) return d;
  const cx = about[0];
  const cz = about[1];
  return withPoints(
    d,
    d.points.map((p) => ({
      ...p,
      x: round2(cx + (p.x - cx) * k),
      z: round2(cz + (p.z - cz) * k),
    })),
  );
}

/** Mirror across the vertical plane `x = bbox.midX`; order reversed to keep the loop orientation. */
export function mirrorX(d: TrackDraft): TrackDraft {
  const c = bboxCentre(d);
  if (!c) return d;
  return reverse(
    withPoints(d, d.points.map((p) => ({ ...p, x: round2(2 * c[0] - p.x) }))),
  );
}

/** Mirror across the horizontal plane `z = bbox.midZ`; order reversed as well. */
export function mirrorZ(d: TrackDraft): TrackDraft {
  const c = bboxCentre(d);
  if (!c) return d;
  return reverse(
    withPoints(d, d.points.map((p) => ({ ...p, z: round2(2 * c[1] - p.z) }))),
  );
}


