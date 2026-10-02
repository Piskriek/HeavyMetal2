import type { Vec2 } from './types';

export interface LoopMetrics {
  starts: number[];
  lengths: number[];
  total: number;
}

export interface LoopSample {
  point: Vec2;
  tangent: Vec2;
  index: number;
  t: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function loopMetrics(points: readonly Vec2[]): LoopMetrics {
  const starts = new Array<number>(points.length);
  const lengths = new Array<number>(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    starts[i] = total;
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const length = points.length > 1 ? distance(a, b) : 0;
    lengths[i] = length;
    total += length;
  }
  return { starts, lengths, total };
}

export function wrapDistance(value: number, total: number): number {
  if (total <= 0) return 0;
  const wrapped = value % total;
  return wrapped < 0 ? wrapped + total : wrapped;
}

export function sampleLoop(points: readonly Vec2[], value: number, metrics = loopMetrics(points)): LoopSample {
  if (points.length === 0) return { point: [0, 0], tangent: [0, 0], index: 0, t: 0 };
  const target = wrapDistance(value, metrics.total);
  for (let i = 0; i < points.length; i++) {
    const length = metrics.lengths[i]!;
    if (length <= 0) continue;
    const start = metrics.starts[i]!;
    const end = start + length;
    if (target < end) {
      const t = Math.max(0, Math.min(1, (target - start) / length));
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      return {
        point: [a[0] + dx * t, a[1] + dz * t],
        tangent: [dx / length, dz / length],
        index: i,
        t,
      };
    }
  }
  for (let i = 0; i < points.length; i++) {
    if (metrics.lengths[i]! > 0) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const length = metrics.lengths[i]!;
      return { point: a, tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length], index: i, t: 0 };
    }
  }
  return { point: points[0]!, tangent: [0, 0], index: 0, t: 0 };
}