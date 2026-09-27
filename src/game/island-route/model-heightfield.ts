/**
 * ISLAND-ROUTE: the exact surface of the owner's island model seen from above, so a ball always sits on
 * the model and never inside it or hovering over it. The model's triangles (world coordinates) are
 * bucketed by their footprint in a coarse grid; a lookup tests only the few triangles in its bucket and
 * takes the highest one covering the point (what a ray cast straight down would hit). Pure numbers.
 */
export interface HeightField {
  /** The surface height at (x, z), or null off the model. */
  heightAt(x: number, z: number): number | null;
}

/**
 * `positions` is a flat triangle list (x, y, z per vertex, three vertices per triangle), already in world
 * coordinates. `cell` is the bucket size in world units.
 */
export function buildHeightField(positions: ArrayLike<number>, cell: number): HeightField {
  const tri = Float64Array.from(positions as ArrayLike<number>);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < tri.length; i += 3) {
    minX = Math.min(minX, tri[i]); maxX = Math.max(maxX, tri[i]);
    minZ = Math.min(minZ, tri[i + 2]); maxZ = Math.max(maxZ, tri[i + 2]);
  }
  const nx = Math.ceil((maxX - minX) / cell) + 1;
  const nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const buckets: number[][] = Array.from({ length: nx * nz }, () => []);
  for (let t = 0; t + 8 < tri.length; t += 9) {
    const x0 = Math.min(tri[t], tri[t + 3], tri[t + 6]), x1 = Math.max(tri[t], tri[t + 3], tri[t + 6]);
    const z0 = Math.min(tri[t + 2], tri[t + 5], tri[t + 8]), z1 = Math.max(tri[t + 2], tri[t + 5], tri[t + 8]);
    const i0 = Math.floor((x0 - minX) / cell), i1 = Math.floor((x1 - minX) / cell);
    const j0 = Math.floor((z0 - minZ) / cell), j1 = Math.floor((z1 - minZ) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) buckets[j * nx + i].push(t);
  }

  return {
    heightAt(x: number, z: number): number | null {
      const i = Math.floor((x - minX) / cell), j = Math.floor((z - minZ) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return null;
      let best = -Infinity;
      for (const t of buckets[j * nx + i]) {
        const ax = tri[t], ay = tri[t + 1], az = tri[t + 2];
        const bx = tri[t + 3], by = tri[t + 4], bz = tri[t + 5];
        const cx = tri[t + 6], cy = tri[t + 7], cz = tri[t + 8];
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(det) < 1e-9) continue; // a wall seen edge-on covers no ground
        const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) continue;
        const y = w1 * ay + w2 * by + w3 * cy;
        if (y > best) best = y;
      }
      return best === -Infinity ? null : best;
    },
  };
}
