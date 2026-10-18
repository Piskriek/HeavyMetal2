// ============================================================================
// File: packages/terrainbrush/src/seam-stitch.ts
// TICKET-10 (POL-29 — Geomipmap Border-Vertex Seam Stitcher):
// Snaps a refined terrain chunk's border vertices to the linear edge segments
// of any coarser neighbour chunk (`strideRatio` = 2, 4, 8), eliminating the
// straight crack between 16 m sculpt-refined leaves and coarse neighbours
// with zero additional triangles.
// Pure TypeScript: zero DOM, zero timers, zero external dependencies.
// ============================================================================

export type BorderEdge = 'north' | 'south' | 'west' | 'east';

export interface NeighbourStrides {
  /** Stride ratio along z = 0 (top / north edge): 1 = same LOD, 2 = neighbour is 2x coarser, 4 = 4x coarser. */
  readonly north?: number;
  /** Stride ratio along z = gridVerts - 1 (bottom / south edge). */
  readonly south?: number;
  /** Stride ratio along x = 0 (left / west edge). */
  readonly west?: number;
  /** Stride ratio along x = gridVerts - 1 (right / east edge). */
  readonly east?: number;
}

const nz = (v: number): number => (v === 0 ? 0 : v);

function sanitizeRatio(r: number | undefined, segments: number): number {
  if (r === undefined || !Number.isInteger(r) || r <= 1) return 1;
  return Math.min(segments, r);
}

/**
 * Snaps a 1D array of vertex heights (`heights`, length `gridVerts x gridVerts`, row-major `z * gridVerts + x`)
 * along any border where the neighbour chunk is coarser (`stride > 1`).
 * Returns the number of border vertices modified.
 */
export function snapBorderHeights(
  heights: Float32Array | number[],
  gridVerts: number,
  strides: NeighbourStrides,
): number {
  const segments = gridVerts - 1;
  if (segments < 2 || heights.length < gridVerts * gridVerts) return 0;

  let snappedCount = 0;

  const snapLine = (indexAt: (i: number) => number, ratioRaw: number | undefined): void => {
    const ratio = sanitizeRatio(ratioRaw, segments);
    if (ratio <= 1) return;
    for (let i = 0; i <= segments; i++) {
      const rem = i % ratio;
      if (rem === 0) continue;
      const i0 = i - rem;
      const i1 = Math.min(segments, i0 + ratio);
      if (i1 <= i0) continue;
      const t = (i - i0) / (i1 - i0);
      const y0 = heights[indexAt(i0)]!;
      const y1 = heights[indexAt(i1)]!;
      const targetY = nz(y0 + (y1 - y0) * t);
      const idx = indexAt(i);
      if (Math.abs(heights[idx]! - targetY) > 1e-9) {
        heights[idx] = targetY;
        snappedCount++;
      }
    }
  };

  // North edge: z = 0, x = 0..segments
  snapLine((x) => x, strides.north);
  // South edge: z = segments, x = 0..segments
  snapLine((x) => segments * gridVerts + x, strides.south);
  // West edge: x = 0, z = 0..segments
  snapLine((z) => z * gridVerts, strides.west);
  // East edge: x = segments, z = 0..segments
  snapLine((z) => z * gridVerts + segments, strides.east);

  return snappedCount;
}

/**
 * Snaps a 3D interleaved `positions` buffer (`[x, y, z, ...]`, length `>= gridVerts * gridVerts * 3`)
 * and optional `normals` buffer along borders where a neighbour chunk is coarser (`POL-29`).
 * Returns the number of border vertices stitched.
 */
export function stitchChunkBorder(
  positions: Float32Array | number[],
  gridVerts: number,
  strides: NeighbourStrides,
  normals?: Float32Array | number[],
): number {
  const segments = gridVerts - 1;
  if (segments < 2 || positions.length < gridVerts * gridVerts * 3) return 0;

  let stitched = 0;

  const stitchEdge = (vertexIndexAt: (i: number) => number, ratioRaw: number | undefined): void => {
    const ratio = sanitizeRatio(ratioRaw, segments);
    if (ratio <= 1) return;
    for (let i = 0; i <= segments; i++) {
      const rem = i % ratio;
      if (rem === 0) continue;
      const i0 = i - rem;
      const i1 = Math.min(segments, i0 + ratio);
      if (i1 <= i0) continue;
      const t = (i - i0) / (i1 - i0);
      const v0 = vertexIndexAt(i0) * 3;
      const v1 = vertexIndexAt(i1) * 3;
      const vi = vertexIndexAt(i) * 3;

      const y0 = positions[v0 + 1]!;
      const y1 = positions[v1 + 1]!;
      const targetY = nz(y0 + (y1 - y0) * t);
      if (Math.abs(positions[vi + 1]! - targetY) > 1e-9) {
        positions[vi + 1] = targetY;
        stitched++;
      }

      if (normals && normals.length >= gridVerts * gridVerts * 3) {
        const nx = normals[v0]! + (normals[v1]! - normals[v0]!) * t;
        const ny = normals[v0 + 1]! + (normals[v1 + 1]! - normals[v0 + 1]!) * t;
        const nzVal = normals[v0 + 2]! + (normals[v1 + 2]! - normals[v0 + 2]!) * t;
        const l = Math.hypot(nx, ny, nzVal) || 1;
        normals[vi] = nz(nx / l);
        normals[vi + 1] = nz(ny / l);
        normals[vi + 2] = nz(nzVal / l);
      }
    }
  };

  stitchEdge((x) => x, strides.north);
  stitchEdge((x) => segments * gridVerts + x, strides.south);
  stitchEdge((z) => z * gridVerts, strides.west);
  stitchEdge((z) => z * gridVerts + segments, strides.east);

  return stitched;
}

/**
 * Inspects a group of terrain chunk meshes (each carrying a square surface grid in the top
 * `gridVerts * gridVerts` vertices of its `position` attribute) and stitches any refined
 * chunk edge that abuts a coarser neighbour chunk (`POL-29`).
 */
export interface ChunkMeshCandidate {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly gridVerts: number;
  readonly positions: Float32Array | number[];
  readonly normals?: Float32Array | number[];
  onStitched?(): void;
}

export function stitchChunkCandidates(chunks: readonly ChunkMeshCandidate[]): number {
  let totalStitched = 0;
  const eps = 0.25;

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    const spanX = c.maxX - c.minX;
    const spanZ = c.maxZ - c.minZ;
    if (spanX <= 0 || spanZ <= 0 || c.gridVerts < 3) continue;
    const stepFine = spanX / (c.gridVerts - 1);

    let north = 1;
    let south = 1;
    let west = 1;
    let east = 1;

    for (let j = 0; j < chunks.length; j++) {
      if (i === j) continue;
      const n = chunks[j]!;
      const nSpanX = n.maxX - n.minX;
      if (nSpanX <= 0 || n.gridVerts < 3) continue;
      const stepNeighbour = nSpanX / (n.gridVerts - 1);
      const ratio = Math.round(stepNeighbour / stepFine);
      if (ratio <= 1) continue;

      const overlapX = Math.min(c.maxX, n.maxX) - Math.max(c.minX, n.minX);
      const overlapZ = Math.min(c.maxZ, n.maxZ) - Math.max(c.minZ, n.minZ);

      if (overlapX > spanX * 0.5) {
        if (Math.abs(c.minZ - n.maxZ) <= eps) north = Math.max(north, ratio);
        if (Math.abs(c.maxZ - n.minZ) <= eps) south = Math.max(south, ratio);
      }
      if (overlapZ > spanZ * 0.5) {
        if (Math.abs(c.minX - n.maxX) <= eps) west = Math.max(west, ratio);
        if (Math.abs(c.maxX - n.minX) <= eps) east = Math.max(east, ratio);
      }
    }

    if (north > 1 || south > 1 || west > 1 || east > 1) {
      const count = stitchChunkBorder(c.positions, c.gridVerts, { north, south, west, east }, c.normals);
      if (count > 0) {
        totalStitched += count;
        c.onStitched?.();
      }
    }
  }

  return totalStitched;
}
