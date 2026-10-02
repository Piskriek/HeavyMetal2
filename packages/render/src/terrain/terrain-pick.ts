import type { Vec3 } from '@hm/contracts';
import type { Ray } from '../camera-math';
import type { TerrainLike } from './terrain-view';

/** Height under (x, z) with the same triangulation as the physics heightfield (diagonal from node (c,r) to (c+1,r+1)); clamped at the edge. */
export function terrainHeight(t: TerrainLike, x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const fx = Math.min(cols - 1, Math.max(0, (x - originX) / cell));
  const fz = Math.min(rows - 1, Math.max(0, (z - originZ) / cell));
  const c = Math.min(cols - 2, Math.floor(fx)), r = Math.min(rows - 2, Math.floor(fz));
  const u = fx - c, v = fz - r;
  const h = (cc: number, rr: number): number => t.heights[rr * cols + cc]!;
  const ha = h(c, r), hb = h(c + 1, r), hc = h(c, r + 1), hd = h(c + 1, r + 1);
  return u >= v ? ha + u * (hb - ha) + v * (hd - hb) : ha + v * (hc - ha) + u * (hd - hc);
}

export interface TerrainHit { readonly point: Vec3; readonly normal: Vec3; readonly distance: number }

/** First hit of a ray with the terrain surface: march in half-cell steps, then bisect the crossing. */
export function pickTerrain(t: TerrainLike, ray: Ray, maxDistance = 4000): TerrainHit | null {
  const { cell } = t.spec;
  const step = cell * 0.5;
  const o = ray.origin, d = ray.direction;
  const above = (s: number): number => o[1] + d[1] * s - terrainHeight(t, o[0] + d[0] * s, o[2] + d[2] * s);
  let prev = 0;
  let prevAbove = above(0);
  if (prevAbove < 0) return null; // started under the ground
  for (let s = step; s <= maxDistance; s += step) {
    const a = above(s);
    if (a <= 0) {
      let lo = prev, hi = s;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (above(mid) > 0) lo = mid; else hi = mid; }
      const dist = (lo + hi) / 2;
      const x = o[0] + d[0] * dist, z = o[2] + d[2] * dist;
      const e = cell * 0.5;
      const dx = (terrainHeight(t, x + e, z) - terrainHeight(t, x - e, z)) / (2 * e);
      const dz = (terrainHeight(t, x, z + e) - terrainHeight(t, x, z - e)) / (2 * e);
      const l = Math.hypot(dx, 1, dz);
      return { point: [x, o[1] + d[1] * dist, z], normal: [-dx / l, 1 / l, -dz / l], distance: dist };
    }
    prev = s; prevAbove = a;
  }
  void prevAbove;
  return null;
}
