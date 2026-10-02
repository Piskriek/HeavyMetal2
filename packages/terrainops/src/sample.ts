import type { TerrainLike } from './types.js';

/**
 * Returns the height at an integer node index (c, r).
 * Clamped to grid bounds.
 */
export function nodeAt(t: TerrainLike, c: number, r: number): number {
  const cc = Math.max(0, Math.min(t.spec.cols - 1, c | 0));
  const rr = Math.max(0, Math.min(t.spec.rows - 1, r | 0));
  return t.heights[rr * t.spec.cols + cc] ?? 0;
}

/**
 * Evaluates the terrain height at any world position (x, z) using bilinear interpolation.
 * Coordinates outside the terrain bounding rectangle are clamped to the nearest edge.
 */
export function heightAt(t: TerrainLike, x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0) return 0;
  if (cols === 1 && rows === 1) return t.heights[0] ?? 0;

  const gx = (x - originX) / cell;
  const gz = (z - originZ) / cell;

  const clampedGx = Math.max(0, Math.min(cols - 1, gx));
  const clampedGz = Math.max(0, Math.min(rows - 1, gz));

  const c0 = Math.floor(clampedGx);
  const c1 = Math.min(cols - 1, c0 + 1);
  const r0 = Math.floor(clampedGz);
  const r1 = Math.min(rows - 1, r0 + 1);

  const fx = clampedGx - c0;
  const fz = clampedGz - r0;

  const h00 = t.heights[r0 * cols + c0] ?? 0;
  const h10 = t.heights[r0 * cols + c1] ?? 0;
  const h01 = t.heights[r1 * cols + c0] ?? 0;
  const h11 = t.heights[r1 * cols + c1] ?? 0;

  const top = h00 + fx * (h10 - h00);
  const bot = h01 + fx * (h11 - h01);

  return top + fz * (bot - top);
}
