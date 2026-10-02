import type { Vec2 } from './types';
import { loopMetrics, sampleLoop, wrapDistance } from './geometry';

/**
 * Painted road furniture laid along a closed centreline: the start/finish line, red-and-white rumble strips on the corners
 * and boost pads. Pure data (strips of points with a width), drawn as decals by the renderer; boost pads are also gameplay
 * rectangles (`PadRect`). Everything is deterministic from the centreline.
 */

export interface RoadFeature {
  readonly kind: 'startLine' | 'rumble' | 'boostPad';
  /** Centre line of the strip, in driving order. */
  readonly points: readonly Vec2[];
  readonly width: number;
  /** Metres along the strip for one repeat of the pattern. */
  readonly period: number;
}

/** A boost pad as a rectangle: centre, unit heading, length along the road and width across it. */
export interface PadRect { readonly x: number; readonly z: number; readonly hx: number; readonly hz: number; readonly length: number; readonly width: number }

export interface RoadFeatureOptions {
  readonly boostPads?: number;      // default 3, 0 = none
  readonly padLength?: number;      // default 9 m
  readonly rumble?: boolean;        // default true
  readonly startLine?: boolean;     // default true
}

const strip = (pts: readonly Vec2[], from: number, to: number, step: number, offset: number): Vec2[] => {
  const metrics = loopMetrics(pts);
  const out: Vec2[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  for (let i = 0; i <= n; i++) {
    const s = from + ((to - from) * i) / n;
    const q = sampleLoop(pts, s, metrics);
    out.push([q.point[0] - q.tangent[1] * offset, q.point[1] + q.tangent[0] * offset]);
  }
  return out;
};

/** Turn rate (radians per metre) of the loop at distance s, measured over +-4 m. */
function curvature(pts: readonly Vec2[], s: number, metrics = loopMetrics(pts)): number {
  const a = sampleLoop(pts, s - 4, metrics).tangent, b = sampleLoop(pts, s + 4, metrics).tangent;
  return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) / 8;
}

export function roadFeatures(points: readonly Vec2[], width: number, o: RoadFeatureOptions = {}): { features: RoadFeature[]; pads: PadRect[] } {
  const features: RoadFeature[] = [];
  const pads: PadRect[] = [];
  if (points.length < 3 || !(width > 0)) return { features, pads };
  const metrics = loopMetrics(points);
  const total = metrics.total;
  if (total < 40) return { features, pads };

  if (o.startLine !== false) features.push({ kind: 'startLine', points: strip(points, -1.5, 1.5, 1.5, 0), width, period: 3 });

  if (o.rumble !== false) {
    // runs of corner: where the loop turns faster than 0.02 rad/m (radius under 50 m), at least 8 m long
    const step = 2;
    const sMax = Math.floor(total / step);
    const flags: boolean[] = [];
    for (let i = 0; i < sMax; i++) flags.push(curvature(points, i * step, metrics) > 0.02);
    let i = 0;
    while (i < sMax) {
      if (!flags[i]) { i++; continue; }
      let j = i;
      while (j + 1 < sMax && flags[j + 1]) j++;
      const a = i * step, b = (j + 1) * step;
      if (b - a >= 8) for (const side of [1, -1]) features.push({ kind: 'rumble', points: strip(points, a, b, 1.5, side * (width / 2 - 0.6)), width: 1.1, period: 3 });
      i = j + 1;
    }
  }

  const count = o.boostPads ?? 3;
  const padLength = o.padLength ?? 9;
  const padWidth = Math.min(6, width * 0.5);
  for (let k = 0; k < count; k++) {
    // aim for evenly spaced spots, then slide to the straightest stretch within +-12% of the lap
    const target = ((k + 0.5) / count) * total;
    let best = target, bestC = Infinity;
    for (let d = -0.12 * total; d <= 0.12 * total; d += 3) {
      const s = wrapDistance(target + d, total);
      const c = curvature(points, s - padLength, metrics) + curvature(points, s, metrics) + curvature(points, s + padLength, metrics);
      if (c < bestC - 1e-9) { bestC = c; best = s; }
    }
    const lateral = k % 3 === 0 ? 0 : k % 3 === 1 ? -width * 0.16 : width * 0.16;
    const mid = sampleLoop(points, best, metrics);
    const cx = mid.point[0] - mid.tangent[1] * lateral, cz = mid.point[1] + mid.tangent[0] * lateral;
    features.push({ kind: 'boostPad', points: strip(points, best - padLength / 2, best + padLength / 2, 1.5, lateral), width: padWidth, period: padLength / 2 });
    pads.push({ x: cx, z: cz, hx: mid.tangent[0], hz: mid.tangent[1], length: padLength, width: padWidth });
  }
  return { features, pads };
}

/** Is a ground position on the pad? (Used by the race to give a boost.) */
export function onPad(p: PadRect, x: number, z: number): boolean {
  const dx = x - p.x, dz = z - p.z;
  const along = dx * p.hx + dz * p.hz, lat = -dx * p.hz + dz * p.hx;
  return Math.abs(along) <= p.length / 2 && Math.abs(lat) <= p.width / 2;
}
