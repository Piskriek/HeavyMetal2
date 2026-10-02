import type { Vec2 } from './types';
import { distance } from './geometry';

const EPSILON = 1e-10;

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function samePoint(a: Vec2, b: Vec2): boolean {
  return Math.abs(a[0] - b[0]) <= EPSILON && Math.abs(a[1] - b[1]) <= EPSILON;
}

function onSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  return Math.abs(cross(a, b, p)) <= EPSILON &&
    p[0] >= Math.min(a[0], b[0]) - EPSILON && p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON && p[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function sign(value: number): number {
  return value > EPSILON ? 1 : value < -EPSILON ? -1 : 0;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = sign(cross(a, b, c));
  const o2 = sign(cross(a, b, d));
  const o3 = sign(cross(c, d, a));
  const o4 = sign(cross(c, d, b));
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true;
  return (o1 === 0 && onSegment(c, a, b)) || (o2 === 0 && onSegment(d, a, b)) ||
    (o3 === 0 && onSegment(a, c, d)) || (o4 === 0 && onSegment(b, c, d));
}

function adjacentOverlap(a: Vec2, b: Vec2, c: Vec2, d: Vec2, shared: Vec2): boolean {
  const otherA = samePoint(a, shared) ? b : a;
  const otherB = samePoint(d, shared) ? c : d;
  return onSegment(otherA, c, d) || onSegment(otherB, a, b);
}

export function isSimple(points: readonly Vec2[]): boolean {
  const n = points.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    if (samePoint(points[i]!, points[(i + 1) % n]!)) return false;
  }
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const c = points[j]!;
      const d = points[(j + 1) % n]!;
      const consecutive = j === i + 1;
      const closingPair = i === 0 && j === n - 1;
      if (!segmentsIntersect(a, b, c, d)) continue;
      if (consecutive && !adjacentOverlap(a, b, c, d, b)) continue;
      if (closingPair && !adjacentOverlap(a, b, c, d, a)) continue;
      return false;
    }
  }
  return true;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function hashNoise(seed: number, lattice: number): number {
  let value = (seed | 0) ^ Math.imul(lattice + 1, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function periodicNoise(position: number, seed: number): number {
  const lattice = Math.floor(position);
  const fraction = position - lattice;
  const cellA = ((lattice % 6) + 6) % 6;
  const cellB = (cellA + 1) % 6;
  const a = hashNoise(seed, cellA);
  const b = hashNoise(seed, cellB);
  return a + (b - a) * smoothstep(fraction);
}

function roundHundredth(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function makeCenterline(o: {
  seed: number;
  points?: number;
  radius: number;
  wobble?: number;
  squash?: number;
}): Vec2[] {
  const count = o.points ?? 48;
  const wobble = o.wobble ?? 0.35;
  const squash = o.squash ?? 1.3;
  if (!Number.isInteger(count) || count < 8 || count > 200) throw new RangeError('points must be an integer from 8 to 200');
  if (!Number.isFinite(o.radius) || o.radius <= 0) throw new RangeError('radius must be positive and finite');
  if (!Number.isFinite(wobble) || wobble < 0 || wobble > 0.5) throw new RangeError('wobble must be between 0 and 0.5');
  if (!Number.isFinite(squash) || squash <= 0) throw new RangeError('squash must be positive and finite');
  const result: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    const noise = periodicNoise((6 * i) / count, o.seed);
    const radial = o.radius * (1 + wobble * (noise - 0.5) * 1.2);
    result.push([roundHundredth(Math.cos(angle) * radial * squash), roundHundredth(Math.sin(angle) * radial)]);
  }
  return result;
}

export function chaikin(points: readonly Vec2[], iterations: number): Vec2[] {
  if (!Number.isInteger(iterations) || iterations < 0) throw new RangeError('iterations must be a non-negative integer');
  let result = points.map(([x, z]) => [x, z] as Vec2);
  for (let round = 0; round < iterations; round++) {
    const next: Vec2[] = [];
    for (let i = 0; i < result.length; i++) {
      const a = result[i]!;
      const b = result[(i + 1) % result.length]!;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    result = next;
  }
  return result;
}

export function loopLength(points: readonly Vec2[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) total += distance(points[i]!, points[(i + 1) % points.length]!);
  return total;
}

export function resample(points: readonly Vec2[], spacing: number): Vec2[] {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new RangeError('spacing must be positive and finite');
  if (points.length === 0) return [];
  const length = loopLength(points);
  const count = Math.max(3, Math.round(length / spacing));
  if (length === 0) return Array.from({ length: count }, () => [points[0]![0], points[0]![1]] as Vec2);
  const result: Vec2[] = [[points[0]![0], points[0]![1]]];
  const segmentLengths = points.map((point, i) => distance(point, points[(i + 1) % points.length]!));
  for (let i = 1; i < count; i++) {
    const target = (i * length) / count;
    let covered = 0;
    for (let segment = 0; segment < points.length; segment++) {
      const segmentLength = segmentLengths[segment]!;
      if (segmentLength > 0 && target < covered + segmentLength) {
        const t = (target - covered) / segmentLength;
        const a = points[segment]!;
        const b = points[(segment + 1) % points.length]!;
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        break;
      }
      covered += segmentLength;
    }
  }
  return result;
}

export function nearestOnLoop(points: readonly Vec2[], p: Vec2): {
  index: number;
  t: number;
  point: Vec2;
  distance: number;
  s: number;
} {
  if (points.length === 0) return { index: 0, t: 0, point: [0, 0], distance: Infinity, s: 0 };
  let best = { index: 0, t: 0, point: points[0]!, distance: Infinity, s: 0 };
  let arc = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared));
    const point: Vec2 = [a[0] + dx * t, a[1] + dz * t];
    const d = distance(p, point);
    if (d < best.distance) best = { index: i, t, point, distance: d, s: arc + Math.sqrt(lengthSquared) * t };
    arc += Math.sqrt(lengthSquared);
  }
  return best;
}