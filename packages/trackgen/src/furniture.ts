import type { TrackShape, Vec2 } from './types';
import { loopMetrics, sampleLoop } from './geometry';

export interface WallPiece {
  x: number;
  z: number;
  dx: number;
  dz: number;
  length: number;
}

export interface Gate {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

export interface GridSlot {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

function unit(x: number, z: number): Vec2 {
  const length = Math.hypot(x, z);
  return length > 0 ? [x / length, z / length] : [0, 0];
}

function offsetLoop(points: readonly Vec2[], offset: number, side: 'left' | 'right'): Vec2[] {
  const n = points.length;
  if (n === 0) return [];
  const sign = side === 'left' ? 1 : -1;
  const normals: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const tangent = unit(b[0] - a[0], b[1] - a[1]);
    normals.push([-tangent[1] * sign, tangent[0] * sign]);
  }
  return points.map((point, i) => {
    const previous = normals[(i + n - 1) % n]!;
    const next = normals[i]!;
    let miter = unit(previous[0] + next[0], previous[1] + next[1]);
    if (miter[0] === 0 && miter[1] === 0) miter = next;
    if (miter[0] === 0 && miter[1] === 0) return [point[0], point[1]] as Vec2;
    const projection = miter[0] * next[0] + miter[1] * next[1];
    const magnitude = Math.abs(projection) > 1e-9 ? offset / projection : offset;
    return [point[0] + miter[0] * magnitude, point[1] + miter[1] * magnitude] as Vec2;
  });
}

function piecesForSide(track: TrackShape, offset: number, spacing: number, side: 'left' | 'right'): WallPiece[] {
  const curve = offsetLoop(track.points, offset, side);
  const metrics = loopMetrics(curve);
  const count = Math.max(3, Math.round(metrics.total / spacing));
  const pieceArcLength = metrics.total / count;
  const pieces: WallPiece[] = [];
  for (let i = 0; i < count; i++) {
    const start = sampleLoop(curve, i * pieceArcLength, metrics);
    const end = sampleLoop(curve, (i + 1) * pieceArcLength, metrics);
    const vx = end.point[0] - start.point[0];
    const vz = end.point[1] - start.point[1];
    const chordLength = Math.hypot(vx, vz);
    const direction = chordLength > 0 ? [vx / chordLength, vz / chordLength] as Vec2 : start.tangent;
    pieces.push({
      x: (start.point[0] + end.point[0]) / 2,
      z: (start.point[1] + end.point[1]) / 2,
      dx: direction[0] || 0,
      dz: direction[1] || 0,
      length: pieceArcLength,
    });
  }
  return pieces;
}

export function trackWalls(track: TrackShape, o: {
  offset: number;
  spacing: number;
  side: 'left' | 'right' | 'both';
}): WallPiece[] {
  if (!Number.isFinite(o.spacing) || o.spacing <= 0) throw new RangeError('spacing must be positive and finite');
  const left = o.side === 'right' ? [] : piecesForSide(track, o.offset, o.spacing, 'left');
  const right = o.side === 'left' ? [] : piecesForSide(track, o.offset, o.spacing, 'right');
  return [...left, ...right];
}

export function checkpointGates(track: TrackShape, count: number): Gate[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  if (count === 0 || track.points.length === 0) return [];
  const metrics = loopMetrics(track.points);
  return Array.from({ length: count }, (_, i) => {
    const sample = sampleLoop(track.points, (metrics.total * i) / count, metrics);
    return { x: sample.point[0], z: sample.point[1], dx: sample.tangent[0], dz: sample.tangent[1] };
  });
}

export function startGrid(track: TrackShape, n: number, o?: {
  rowSpacing?: number;
  lateral?: number;
  firstRow?: number;
}): GridSlot[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer');
  if (n === 0 || track.points.length === 0) return [];
  const rowSpacing = o?.rowSpacing ?? 4;
  const lateral = o?.lateral ?? 3;
  const firstRow = o?.firstRow ?? 6;
  const metrics = loopMetrics(track.points);
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const sample = sampleLoop(track.points, metrics.total - firstRow - row * rowSpacing, metrics);
    const side = i % 2 === 0 ? 1 : -1;
    const leftX = -sample.tangent[1];
    const leftZ = sample.tangent[0];
    return {
      x: sample.point[0] + leftX * lateral * side,
      z: sample.point[1] + leftZ * lateral * side,
      hx: sample.tangent[0],
      hz: sample.tangent[1],
    };
  });
}