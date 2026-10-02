import type { TerrainLike, Vec2 } from './types';

const RAD_TO_DEG = 180 / Math.PI;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function usable(t: TerrainLike): boolean {
  const { cols, rows, cell } = t.spec;
  return cols >= 1 && rows >= 1 && cell > 0;
}

/** Bilinearly interpolated height. Positions outside the grid clamp to the nearest edge node. */
export function heightAt(t: TerrainLike, x: number, z: number): number {
  if (!usable(t)) return 0;
  const { cols, rows, cell, originX, originZ } = t.spec;
  const fc = clamp((x - originX) / cell, 0, cols - 1);
  const fr = clamp((z - originZ) / cell, 0, rows - 1);
  const c0 = Math.floor(fc);
  const r0 = Math.floor(fr);
  const c1 = Math.min(c0 + 1, cols - 1);
  const r1 = Math.min(r0 + 1, rows - 1);
  const tc = fc - c0;
  const tr = fr - r0;
  const h = (c: number, r: number): number => t.heights[r * cols + c] ?? 0;
  const near = h(c0, r0) * (1 - tc) + h(c1, r0) * tc;
  const far = h(c0, r1) * (1 - tc) + h(c1, r1) * tc;
  return near * (1 - tr) + far * tr;
}

/** Slope in degrees (0..90) from central differences spanning one cell in x and in z. */
export function slopeDeg(t: TerrainLike, x: number, z: number): number {
  if (!usable(t)) return 0;
  const half = t.spec.cell / 2;
  const dx = (heightAt(t, x + half, z) - heightAt(t, x - half, z)) / t.spec.cell;
  const dz = (heightAt(t, x, z + half) - heightAt(t, x, z - half)) / t.spec.cell;
  return Math.atan(Math.hypot(dx, dz)) * RAD_TO_DEG;
}

/** Surface of the nearest node: its A surface, or its B surface when blend >= 128. */
export function dominantSurface(t: TerrainLike, x: number, z: number): number {
  if (!usable(t)) return 0;
  const { cols, rows, cell, originX, originZ } = t.spec;
  const c = clamp(Math.round((x - originX) / cell), 0, cols - 1);
  const r = clamp(Math.round((z - originZ) / cell), 0, rows - 1);
  const i = r * cols + c;
  return (t.blend[i] ?? 0) >= 128 ? (t.surfaceB[i] ?? 0) : (t.surfaceA[i] ?? 0);
}

function segmentDistance(a: Vec2, b: Vec2, p: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const u = len2 === 0 ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2, 0, 1);
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dz));
}

/** Distance from p to the closed polyline through `points` (last point joins the first). Infinity for an empty loop. */
export function distanceToLoop(points: readonly Vec2[], p: Vec2): number {
  const n = points.length;
  if (n === 0) return Infinity;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    best = Math.min(best, segmentDistance(points[i]!, points[(i + 1) % n]!, p));
  }
  return best;
}
