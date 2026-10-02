export type Vec2 = readonly [number, number];

export interface Track {
  points: readonly Vec2[];
  width: number;
}

function distance(dx: number, dz: number): number {
  return Math.sqrt(dx * dx + dz * dz);
}

function wrapDistance(s: number, length: number): number {
  return ((s % length) + length) % length;
}

export function trackLength(t: Track): number {
  const count = t.points.length;
  if (count < 2) return 0;

  let length = 0;
  for (let i = 0; i < count; i += 1) {
    const a = t.points[i]!;
    const b = t.points[(i + 1) % count]!;
    length += distance(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

export function pointAt(t: Track, s: number): Vec2 {
  const count = t.points.length;
  if (count === 0) return [0, 0];

  const length = trackLength(t);
  if (!(length > 0)) return t.points[0]!;

  let remaining = wrapDistance(s, length);
  for (let i = 0; i < count; i += 1) {
    const a = t.points[i]!;
    const b = t.points[(i + 1) % count]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const segmentLength = distance(dx, dz);
    if (segmentLength === 0) continue;

    if (remaining < segmentLength) {
      const fraction = remaining / segmentLength;
      return [a[0] + dx * fraction, a[1] + dz * fraction];
    }
    remaining -= segmentLength;
  }

  return t.points[0]!;
}

export interface Projection {
  segment: number;
  t: number;
  s: number;
  lateral: number;
  distance: number;
}

export function project(t: Track, p: Vec2): Projection {
  const count = t.points.length;
  if (count === 0) {
    return { segment: 0, t: 0, s: 0, lateral: 0, distance: Number.POSITIVE_INFINITY };
  }

  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let best: Projection = { segment: 0, t: 0, s: 0, lateral: 0, distance: Number.POSITIVE_INFINITY };
  let distanceAlong = 0;

  for (let i = 0; i < count; i += 1) {
    const a = t.points[i]!;
    const b = t.points[(i + 1) % count]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const segmentLength = Math.sqrt(lengthSquared);
    const parameter = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared));
    const nearestX = a[0] + parameter * dx;
    const nearestZ = a[1] + parameter * dz;
    const offsetX = p[0] - nearestX;
    const offsetZ = p[1] - nearestZ;
    const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;

    if (distanceSquared < bestDistanceSquared) {
      const unitX = segmentLength > 0 ? dx / segmentLength : 0;
      const unitZ = segmentLength > 0 ? dz / segmentLength : 0;
      const lateral = segmentLength > 0
        ? (p[0] - a[0]) * -unitZ + (p[1] - a[1]) * unitX
        : 0;
      bestDistanceSquared = distanceSquared;
      best = {
        segment: i,
        t: parameter,
        s: distanceAlong + parameter * segmentLength,
        lateral,
        distance: Math.sqrt(distanceSquared),
      };
    }

    distanceAlong += segmentLength;
  }

  return best;
}

export function onTrack(t: Track, p: Vec2): boolean {
  if (t.points.length === 0 || !(trackLength(t) > 0)) return false;
  return Math.abs(project(t, p).lateral) <= t.width / 2;
}