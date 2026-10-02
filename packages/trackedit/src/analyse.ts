/**
 * Draft validation and measurement.
 *
 * The centreline is sampled at 4 m so turns are resolved well below the road
 * width; every check reads from that single sample set, which keeps the report
 * deterministic and cheap.
 */

import { bboxOf, circumradius, fmt, isNum, segmentsCross } from './math';
import { loopLength, toCenterline } from './spline';
import type { Analysis, TrackDraft, Vec2 } from './types';

export const CENTRELINE_SPACING = 4;
export const MIN_LENGTH = 200;
export const MAX_LENGTH = 2500;

/** `true` when any two non-adjacent segments of the polyline cross. */
export function selfCrosses(points: readonly Vec2[], closed: boolean): boolean {
  const n = points.length;
  const segments = closed ? n : n - 1;
  if (segments < 3) return false;
  for (let i = 0; i < segments; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;
    for (let j = i + 2; j < segments; j++) {
      if (closed && i === 0 && j === segments - 1) continue; // neighbours through the wrap
      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (segmentsCross(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function turnRadii(points: readonly Vec2[], closed: boolean): number[] {
  const n = points.length;
  const count = closed ? n : n - 2;
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const prev = points[closed ? (i - 1 + n) % n : i - 1];
    const mid = points[i];
    const next = points[closed ? (i + 1) % n : i + 1];
    if (!prev || !mid || !next) continue;
    radii.push(circumradius(prev, mid, next));
  }
  return radii;
}

/** Validate a draft and measure it. */
export function analyse(d: TrackDraft): Analysis {
  const centre = toCenterline(d, CENTRELINE_SPACING);
  const issues: string[] = [];
  const length = loopLength(centre, d.closed);
  const limit = (isNum(d.width) ? d.width : 12) * 0.9;

  const radii = turnRadii(centre, d.closed);
  let minRadius = Infinity;
  const tight: { index: number; radius: number }[] = [];
  radii.forEach((radius, i) => {
    if (radius < minRadius) minRadius = radius;
    if (radius < limit) tight.push({ index: i, radius });
  });

  const selfIntersects = selfCrosses(centre, d.closed);

  if (d.points.length < 3) issues.push('Needs at least 3 points');
  else if (!d.closed) issues.push('Track is not closed');
  if (length < MIN_LENGTH) issues.push(`Track is too short (${fmt(length)} m, minimum ${MIN_LENGTH} m)`);
  if (length > MAX_LENGTH) issues.push(`Track is too long (${fmt(length)} m, maximum ${MAX_LENGTH} m)`);
  if (selfIntersects) issues.push('The track crosses itself');
  const firstTight = tight[0];
  if (firstTight) {
    issues.push(
      `Corner too tight near point ${firstTight.index} (radius ${fmt(firstTight.radius)} m)`,
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    length,
    minRadius,
    tightAt: tight.map((t) => t.index),
    selfIntersects,
    bbox: bboxOf(centre),
  };
}
