import type { Vec3 } from '@hm/contracts';
import { clamp } from './math';
import type { Triangle } from './triangles';

export interface TriangleGrid {
  minX: number; minZ: number; maxX: number; maxZ: number;
  cols: number; rows: number; cellX: number; cellZ: number;
  buckets: Map<number, number[]>;
}

export function buildGrid(triangles: readonly Triangle[]): TriangleGrid {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const t of triangles) {
    minX = Math.min(minX, t.min[0]); minZ = Math.min(minZ, t.min[2]);
    maxX = Math.max(maxX, t.max[0]); maxZ = Math.max(maxZ, t.max[2]);
  }
  const count = clamp(Math.ceil(Math.sqrt(triangles.length)), 1, 64);
  const grid: TriangleGrid = {
    minX, minZ, maxX, maxZ, cols: count, rows: count,
    cellX: maxX > minX ? (maxX - minX) / count : 1,
    cellZ: maxZ > minZ ? (maxZ - minZ) / count : 1,
    buckets: new Map(),
  };
  triangles.forEach((t, index) => {
    const x0 = clamp(Math.floor((t.min[0] - minX) / grid.cellX), 0, count - 1);
    const x1 = clamp(Math.floor((t.max[0] - minX) / grid.cellX), 0, count - 1);
    const z0 = clamp(Math.floor((t.min[2] - minZ) / grid.cellZ), 0, count - 1);
    const z1 = clamp(Math.floor((t.max[2] - minZ) / grid.cellZ), 0, count - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const key = z * count + x, bucket = grid.buckets.get(key);
      if (bucket) bucket.push(index);
      else grid.buckets.set(key, [index]);
    }
  });
  return grid;
}

export function nearby(grid: TriangleGrid, p: Vec3, radius: number): number[] {
  if (p[0] + radius < grid.minX || p[0] - radius > grid.maxX ||
      p[2] + radius < grid.minZ || p[2] - radius > grid.maxZ) return [];
  const x0 = clamp(Math.floor((p[0] - radius - grid.minX) / grid.cellX), 0, grid.cols - 1);
  const x1 = clamp(Math.floor((p[0] + radius - grid.minX) / grid.cellX), 0, grid.cols - 1);
  const z0 = clamp(Math.floor((p[2] - radius - grid.minZ) / grid.cellZ), 0, grid.rows - 1);
  const z1 = clamp(Math.floor((p[2] + radius - grid.minZ) / grid.cellZ), 0, grid.rows - 1);
  const seen = new Set<number>(), result: number[] = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    for (const i of grid.buckets.get(z * grid.cols + x) ?? []) {
      if (!seen.has(i)) { seen.add(i); result.push(i); }
    }
  }
  return result.sort((a, b) => a - b);
}