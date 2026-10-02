import type { DirtyRect, TerrainLike, Vec2 } from './types.js';

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function pointInPolygon(px: number, pz: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const p1 = poly[i];
    const p2 = poly[j];
    if (!p1 || !p2) continue;
    const xi = p1[0];
    const zi = p1[1];
    const xj = p2[0];
    const zj = p2[1];

    const intersect =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToPolygonBoundary(px: number, pz: number, poly: readonly Vec2[]): number {
  let minDistSq = Infinity;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const p1 = poly[j];
    const p2 = poly[i];
    if (!p1 || !p2) continue;
    const x1 = p1[0];
    const z1 = p1[1];
    const x2 = p2[0];
    const z2 = p2[1];

    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;

    let dSq = 0;
    if (lenSq === 0) {
      dSq = (px - x1) * (px - x1) + (pz - z1) * (pz - z1);
    } else {
      const s = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
      const projX = x1 + s * dx;
      const projZ = z1 + s * dz;
      dSq = (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
    }

    if (dSq < minDistSq) {
      minDistSq = dSq;
    }
  }
  return Math.sqrt(minDistSq);
}

/**
 * Levels a polygon pad to a target height with an optional blended falloff outside.
 * Uses the even-odd rule for inside tests. Polygons with < 3 points return null.
 */
export function levelPolygon(
  t: TerrainLike,
  polygon: readonly Vec2[],
  height: number,
  falloff: number
): DirtyRect | null {
  if (polygon.length < 3) return null;

  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0) return null;

  const safeFalloff = Math.max(0, falloff);

  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinZ = Infinity;
  let pMaxZ = -Infinity;

  for (const pt of polygon) {
    if (pt[0] < pMinX) pMinX = pt[0];
    if (pt[0] > pMaxX) pMaxX = pt[0];
    if (pt[1] < pMinZ) pMinZ = pt[1];
    if (pt[1] > pMaxZ) pMaxZ = pt[1];
  }

  const minX = pMinX - safeFalloff;
  const maxX = pMaxX + safeFalloff;
  const minZ = pMinZ - safeFalloff;
  const maxZ = pMaxZ + safeFalloff;

  const cMin = Math.max(0, Math.floor((minX - originX) / cell));
  const cMax = Math.min(cols - 1, Math.ceil((maxX - originX) / cell));
  const rMin = Math.max(0, Math.floor((minZ - originZ) / cell));
  const rMax = Math.min(rows - 1, Math.ceil((maxZ - originZ) / cell));

  if (cMin > cMax || rMin > rMax) return null;

  let dirtyC0 = cols;
  let dirtyR0 = rows;
  let dirtyC1 = -1;
  let dirtyR1 = -1;
  let touched = false;

  for (let r = rMin; r <= rMax; r++) {
    const pz = originZ + r * cell;
    const rowOffset = r * cols;

    for (let c = cMin; c <= cMax; c++) {
      const px = originX + c * cell;
      const idx = rowOffset + c;

      if (pointInPolygon(px, pz, polygon)) {
        t.heights[idx] = height;
        touched = true;
        if (c < dirtyC0) dirtyC0 = c;
        if (c > dirtyC1) dirtyC1 = c;
        if (r < dirtyR0) dirtyR0 = r;
        if (r > dirtyR1) dirtyR1 = r;
      } else if (safeFalloff > 0) {
        const d = distToPolygonBoundary(px, pz, polygon);
        if (d <= safeFalloff) {
          const k = smoothstep(1 - d / safeFalloff);
          if (k > 0) {
            const oldH = t.heights[idx] ?? 0;
            t.heights[idx] = oldH + (height - oldH) * k;
            touched = true;
            if (c < dirtyC0) dirtyC0 = c;
            if (c > dirtyC1) dirtyC1 = c;
            if (r < dirtyR0) dirtyR0 = r;
            if (r > dirtyR1) dirtyR1 = r;
          }
        }
      }
    }
  }

  if (!touched) return null;

  return {
    c0: dirtyC0,
    r0: dirtyR0,
    c1: dirtyC1,
    r1: dirtyR1,
  };
}
