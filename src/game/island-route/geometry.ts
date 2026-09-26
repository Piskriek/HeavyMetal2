/**
 * ISLAND-ROUTE: small authoring helpers for Basalt Isle's roads.
 *
 * The island is centred on the volcano at world (0, 0). Roads are authored in polar terms around it:
 * `theta` in degrees, 0 = north (−z), growing clockwise seen from above (90 = east, +x); `r` is the
 * distance from the volcano's axis; `y` is height (sea level 0). Travelling clockwise, a racer's left is
 * the sea side and their right is the volcano, so a fork lists its branches outer (left) to inner (right).
 */
import type { CPoint, CenterlineWaypoint, TrackStageId } from '../track-space';

export interface PolarPoint {
  readonly theta: number;
  readonly r: number;
  readonly y: number;
}

const RAD = Math.PI / 180;

/** World position of a polar point. */
export function polar(p: PolarPoint): CPoint {
  return { x: p.r * Math.sin(p.theta * RAD), y: p.y, z: -p.r * Math.cos(p.theta * RAD) };
}

/** A waypoint at a polar point. */
export function wp(p: PolarPoint, stage: TrackStageId, label?: string): CenterlineWaypoint {
  const w = polar(p);
  return label ? { ...w, stage, label } : { ...w, stage };
}

/**
 * `n` waypoints strictly after `from`, ending exactly on `to`, easing theta, r and y between them
 * (y eases so a stretch starts and ends level with its neighbours).
 */
export function sweep(from: PolarPoint, to: PolarPoint, n: number, stage: TrackStageId): CenterlineWaypoint[] {
  const out: CenterlineWaypoint[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t * t * (3 - 2 * t);
    out.push(wp({
      theta: from.theta + (to.theta - from.theta) * t,
      r: from.r + (to.r - from.r) * t,
      y: from.y + (to.y - from.y) * (0.35 * t + 0.65 * e),
    }, stage));
  }
  return out;
}

/** Polar points along the way, with a sideways wobble `amp` (units of r) repeated `waves` times. */
export function wiggle(from: PolarPoint, to: PolarPoint, n: number, amp: number, waves: number, stage: TrackStageId): CenterlineWaypoint[] {
  const out: CenterlineWaypoint[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t * t * (3 - 2 * t);
    out.push(wp({
      theta: from.theta + (to.theta - from.theta) * t,
      r: from.r + (to.r - from.r) * t + amp * Math.sin(t * waves * Math.PI * 2) * Math.sin(t * Math.PI),
      y: from.y + (to.y - from.y) * e,
    }, stage));
  }
  return out;
}

/** Arc length of a polyline through the points (a quick authoring estimate; the map measures the spline). */
export function polylineLength(points: readonly CPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z);
  }
  return total;
}
