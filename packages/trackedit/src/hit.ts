/**
 * Picking and snapping for the drawing tool.
 */

import { isNum, pointSegment } from './math';
import type { Hit, TrackDraft, Vec2 } from './types';

/**
 * Pick against a draft: the nearest control point inside `radius` wins,
 * otherwise the nearest segment (the closing one included when the draft is
 * closed) within `radius`, otherwise nothing.
 */
export function hitTest(d: TrackDraft, p: Vec2, radius: number): Hit {
  const none: Hit = { kind: 'none', index: -1, distance: Infinity };
  if (!isNum(p[0]) || !isNum(p[1]) || !isNum(radius) || radius < 0) return none;

  let pointIndex = -1;
  let pointDistance = Infinity;
  d.points.forEach((cp, i) => {
    const distance = Math.hypot(cp.x - p[0], cp.z - p[1]);
    if (distance < pointDistance) {
      pointDistance = distance;
      pointIndex = i;
    }
  });
  if (pointIndex >= 0 && pointDistance <= radius) {
    return { kind: 'point', index: pointIndex, distance: pointDistance };
  }

  const n = d.points.length;
  const segments = d.closed ? n : n - 1;
  let segIndex = -1;
  let segDistance = Infinity;
  let segT = 0;
  for (let i = 0; i < segments; i++) {
    const a = d.points[i]!;
    const b = d.points[(i + 1) % n]!;
    const { distance, t } = pointSegment(p, [a.x, a.z], [b.x, b.z]);
    if (distance < segDistance) {
      segDistance = distance;
      segIndex = i;
      segT = t;
    }
  }
  if (segIndex >= 0 && segDistance <= radius) {
    return { kind: 'segment', index: segIndex, distance: segDistance, t: segT };
  }
  return none;
}

/** Snap to a grid in metres; `grid <= 0` leaves the point alone. */
export function snapPoint(p: Vec2, grid: number): Vec2 {
  if (!isNum(grid) || grid <= 0 || !isNum(p[0]) || !isNum(p[1])) return [p[0], p[1]];
  const nz = (v: number): number => (v === 0 ? 0 : v); // never emit -0
  return [nz(Math.round(p[0] / grid) * grid), nz(Math.round(p[1] / grid) * grid)];
}
