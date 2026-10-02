import type { DirtyRect, TerrainLike, TrackShape } from './types';
import { loopMetrics } from './geometry';
import { nearestOnLoop } from './centerline';

export interface CarveOptions {
  shoulder: number;
  roadSurface: number;
  shoulderSurface: number;
  smoothing?: number;
  maxSlope?: number;
}

export interface CarveResult {
  dirty: DirtyRect | null;
  roadHeights: number[];
  maxSlope: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function toByte(value: number): number {
  const integer = Math.trunc(value);
  return ((integer % 256) + 256) % 256;
}

function sampleHeight(t: TerrainLike, x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0 || cell <= 0) return 0;
  const gx = clamp((x - originX) / cell, 0, cols - 1);
  const gz = clamp((z - originZ) / cell, 0, rows - 1);
  const c0 = Math.floor(gx);
  const r0 = Math.floor(gz);
  const c1 = Math.min(c0 + 1, cols - 1);
  const r1 = Math.min(r0 + 1, rows - 1);
  const tx = gx - c0;
  const tz = gz - r0;
  const h00 = t.heights[r0 * cols + c0] ?? 0;
  const h10 = t.heights[r0 * cols + c1] ?? 0;
  const h01 = t.heights[r1 * cols + c0] ?? 0;
  const h11 = t.heights[r1 * cols + c1] ?? 0;
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

function limitSlope(heights: number[], segmentLengths: readonly number[], maxSlope: number): void {
  const n = heights.length;
  if (n < 2) return;
  for (let round = 0; round < 50; round++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const previous = (i + n - 1) % n;
      const limit = maxSlope * segmentLengths[previous]!;
      const bounded = clamp(heights[i]!, heights[previous]! - limit, heights[previous]! + limit);
      if (bounded !== heights[i]) {
        heights[i] = bounded;
        changed = true;
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      const next = (i + 1) % n;
      const limit = maxSlope * segmentLengths[i]!;
      const bounded = clamp(heights[i]!, heights[next]! - limit, heights[next]! + limit);
      if (bounded !== heights[i]) {
        heights[i] = bounded;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function measuredSlope(heights: readonly number[], segmentLengths: readonly number[]): number {
  let maximum = 0;
  for (let i = 0; i < heights.length; i++) {
    const next = (i + 1) % heights.length;
    const rise = Math.abs(heights[next]! - heights[i]!);
    const length = segmentLengths[i]!;
    const slope = length > 0 ? rise / length : rise === 0 ? 0 : Infinity;
    maximum = Math.max(maximum, slope);
  }
  return maximum;
}

export function carveTrack(t: TerrainLike, track: TrackShape, o: CarveOptions): CarveResult {
  const smoothing = o.smoothing ?? 30;
  const maxSlope = o.maxSlope ?? 0.25;
  if (!Number.isFinite(track.width) || track.width < 0) throw new RangeError('track width must be non-negative and finite');
  if (!Number.isFinite(o.shoulder) || o.shoulder < 0) throw new RangeError('shoulder must be non-negative and finite');
  if (!Number.isFinite(smoothing) || smoothing < 0) throw new RangeError('smoothing must be non-negative and finite');
  if (!Number.isFinite(maxSlope) || maxSlope < 0) throw new RangeError('maxSlope must be non-negative and finite');
  if (track.points.length === 0) return { dirty: null, roadHeights: [], maxSlope: 0 };

  const metrics = loopMetrics(track.points);
  const segmentLengths = metrics.lengths;
  const sampled = track.points.map(([x, z]) => sampleHeight(t, x, z));
  const roadHeights = sampled.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < sampled.length; j++) {
      const rawDistance = Math.abs(metrics.starts[i]! - metrics.starts[j]!);
      const arcDistance = metrics.total > 0 ? Math.min(rawDistance, metrics.total - rawDistance) : 0;
      if (arcDistance <= smoothing) {
        sum += sampled[j]!;
        count++;
      }
    }
    return count > 0 ? sum / count : sampled[i]!;
  });
  limitSlope(roadHeights, segmentLengths, maxSlope);

  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0 || cell <= 0) return { dirty: null, roadHeights, maxSlope: measuredSlope(roadHeights, segmentLengths) };
  const radius = track.width / 2 + o.shoulder;
  const xs = track.points.map((point) => point[0]);
  const zs = track.points.map((point) => point[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - radius - originX) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - radius - originZ) / cell));
  const c1 = Math.min(cols - 1, Math.ceil((Math.max(...xs) + radius - originX) / cell));
  const r1 = Math.min(rows - 1, Math.ceil((Math.max(...zs) + radius - originZ) / cell));
  const roadSurface = toByte(o.roadSurface);
  const shoulderSurface = toByte(o.shoulderSurface);
  let dirty: DirtyRect | null = null;

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const index = r * cols + c;
      const x = originX + c * cell;
      const z = originZ + r * cell;
      const nearest = nearestOnLoop(track.points, [x, z]);
      if (nearest.distance > radius) continue;
      const h0 = t.heights[index] ?? 0;
      const a0 = t.surfaceA[index] ?? 0;
      const b0 = t.surfaceB[index] ?? 0;
      const blend0 = t.blend[index] ?? 0;
      const hA = roadHeights[nearest.index]!;
      const hB = roadHeights[(nearest.index + 1) % roadHeights.length]!;
      const target = hA + (hB - hA) * nearest.t;

      if (nearest.distance <= track.width / 2) {
        t.heights[index] = target;
        t.surfaceA[index] = roadSurface;
        t.surfaceB[index] = roadSurface;
        t.blend[index] = 0;
      } else if (o.shoulder > 0) {
        const k = smoothstep(1 - (nearest.distance - track.width / 2) / o.shoulder);
        t.heights[index] = h0 + (target - h0) * k;
        t.surfaceA[index] = shoulderSurface;
        if (a0 === shoulderSurface) {
          t.surfaceB[index] = shoulderSurface;
          t.blend[index] = 0;
        } else {
          t.surfaceB[index] = a0;
          t.blend[index] = clamp(Math.round((1 - k) * 255), 1, 254);
        }
      }

      if (t.heights[index] !== h0 || t.surfaceA[index] !== a0 || t.surfaceB[index] !== b0 || t.blend[index] !== blend0) {
        if (dirty === null) dirty = { c0: c, r0: r, c1: c, r1: r };
        else {
          dirty.c0 = Math.min(dirty.c0, c);
          dirty.r0 = Math.min(dirty.r0, r);
          dirty.c1 = Math.max(dirty.c1, c);
          dirty.r1 = Math.max(dirty.r1, r);
        }
      }
    }
  }
  return { dirty, roadHeights, maxSlope: measuredSlope(roadHeights, segmentLengths) };
}