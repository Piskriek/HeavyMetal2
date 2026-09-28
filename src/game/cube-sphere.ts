/**
 * T10 — Cube-Sphere Geometry
 *
 * A sphere approximated by subdividing each face of a cube and normalizing
 * vertices onto the sphere surface. This gives:
 * - 6 faces with consistent UV mapping (no pole pinch)
 * - Less distortion than UV sphere at the poles
 * - Shared normalized geometry with LOD levels
 * - Canonical six-face basis with outward winding
 *
 * Face order (standard cubemap convention):
 *   0: +X (right)   1: -X (left)
 *   2: +Y (top)     3: -Y (bottom)
 *   4: +Z (front)   5: -Z (back)
 *
 * Each face is subdivided into `resolution × resolution` quads, each split
 * into 2 triangles. Vertices are normalized to radius.
 *
 * UV mapping per face: local (u,v) ∈ [0,1]² within each face.
 * Atlas mapping: face (col, row) → atlas UV where col ∈ {0,1,2}, row ∈ {0,1}.
 */

export const CUBE_SPHERE_VERSION = 1;

export type CubeFace = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

export const FACE_ORDER: readonly CubeFace[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as const;

/** Atlas layout: 3 columns × 2 rows, face index → (col, row) */
export const FACE_ATLAS_GRID: readonly { col: number; row: number }[] = [
  { col: 0, row: 0 }, // +X
  { col: 1, row: 0 }, // -X
  { col: 2, row: 0 }, // +Y
  { col: 0, row: 1 }, // -Y
  { col: 1, row: 1 }, // +Z
  { col: 2, row: 1 }, // -Z
];

export interface CubeSphereGeometryData {
  readonly version: typeof CUBE_SPHERE_VERSION;
  readonly radius: number;
  readonly resolution: number;
  readonly faceCount: 6;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly positions: Float32Array;     // xyz per vertex
  readonly normals: Float32Array;      // xyz per vertex (normalized positions)
  readonly faceUVs: Float32Array;      // uv per vertex (local face UV, 0-1)
  readonly atlasUVs: Float32Array;     // uv per vertex (atlas UV, mapped to 2048² grid)
  readonly indices: Uint16Array | Uint32Array;
  readonly faceVertexOffsets: readonly number[]; // start vertex for each face
  readonly faceIndexOffsets: readonly number[];  // start index for each face
  readonly seams: readonly SeamEdge[];
}

export interface SeamEdge {
  readonly faceA: number;
  readonly faceB: number;
  readonly edgeA: 'top' | 'bottom' | 'left' | 'right';
  readonly edgeB: 'top' | 'bottom' | 'left' | 'right';
  readonly flipped: boolean;
}

/** Canonical seam orientation for the cube-sphere. */
export const SEAM_EDGES: readonly SeamEdge[] = [
  // +X seams
  { faceA: 0, faceB: 4, edgeA: 'left', edgeB: 'right', flipped: false },   // +X left ↔ +Z right
  { faceA: 0, faceB: 5, edgeA: 'right', edgeB: 'left', flipped: false },   // +X right ↔ -Z left
  { faceA: 0, faceB: 2, edgeA: 'top', edgeB: 'right', flipped: true },     // +X top ↔ +Y right
  { faceA: 0, faceB: 3, edgeA: 'bottom', edgeB: 'right', flipped: true },  // +X bottom ↔ -Y right
  // -X seams
  { faceA: 1, faceB: 4, edgeA: 'right', edgeB: 'left', flipped: false },
  { faceA: 1, faceB: 5, edgeA: 'left', edgeB: 'right', flipped: false },
  { faceA: 1, faceB: 2, edgeA: 'top', edgeB: 'left', flipped: true },
  { faceA: 1, faceB: 3, edgeA: 'bottom', edgeB: 'left', flipped: true },
  // +Y seams
  { faceA: 2, faceB: 4, edgeA: 'bottom', edgeB: 'top', flipped: false },
  { faceA: 2, faceB: 5, edgeA: 'top', edgeB: 'top', flipped: true },
  // -Y seams
  { faceA: 3, faceB: 4, edgeA: 'top', edgeB: 'bottom', flipped: false },
  { faceA: 3, faceB: 5, edgeA: 'bottom', edgeB: 'bottom', flipped: true },
];

/**
 * Maps a local face coordinate (s,t) ∈ [-1,1]² to a 3D point on the unit cube face.
 * The face normal determines which axis is ±1.
 */
function faceToCube(face: CubeFace, s: number, t: number): [number, number, number] {
  switch (face) {
    case '+X': return [1, -t, -s];
    case '-X': return [-1, -t, s];
    case '+Y': return [s, 1, t];
    case '-Y': return [s, -1, -t];
    case '+Z': return [s, -t, 1];
    case '-Z': return [-s, -t, -1];
  }
}

/**
 * Normalizes a 3D vector in-place and returns its length.
 */
function normalize(x: number, y: number, z: number): { nx: number; ny: number; nz: number; len: number } {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-12) return { nx: 0, ny: 1, nz: 0, len: 0 };
  return { nx: x / len, ny: y / len, nz: z / len, len };
}

/**
 * Build cube-sphere geometry data.
 *
 * @param radius - Sphere radius in world units
 * @param resolution - Subdivisions per face edge (≥1). LOD0 = 1 (cube), LOD1 = 2, etc.
 * @param atlasSize - Atlas pixel size (default 2048)
 * @param gutterPixels - Gutter around each tile for mip bleeding (default 4)
 */
export function buildCubeSphereGeometry(
  radius: number,
  resolution: number,
  atlasSize = 2048,
  gutterPixels = 4,
): CubeSphereGeometryData {
  if (radius <= 0 || !Number.isFinite(radius)) {
    throw new Error(`Invalid radius: ${radius}`);
  }
  if (resolution < 1 || !Number.isFinite(resolution) || !Number.isInteger(resolution)) {
    throw new Error(`Invalid resolution: ${resolution} (must be positive integer)`);
  }

  const vertsPerFace = (resolution + 1) * (resolution + 1);
  const trisPerFace = resolution * resolution * 2;
  const totalVerts = vertsPerFace * 6;
  const totalTris = trisPerFace * 6;
  const totalIndices = totalTris * 3;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const faceUVs = new Float32Array(totalVerts * 2);
  const atlasUVs = new Float32Array(totalVerts * 2);

  const UseUint32 = totalVerts > 65535;
  const indices = UseUint32 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  const faceVertexOffsets: number[] = [];
  const faceIndexOffsets: number[] = [];

  // Atlas tile dimensions (square tiles centered in cells)
  const cellW = atlasSize / 3;
  const cellH = atlasSize / 2;
  const rawTileW = cellW - gutterPixels * 2;
  const rawTileH = cellH - gutterPixels * 2;
  const tileSize = Math.min(rawTileW, rawTileH);

  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const face = FACE_ORDER[faceIdx];
    const grid = FACE_ATLAS_GRID[faceIdx];
    const vOffset = faceIdx * vertsPerFace;
    const iOffset = faceIdx * trisPerFace * 3;

    faceVertexOffsets.push(vOffset);
    faceIndexOffsets.push(iOffset);

    // Generate vertices
    for (let row = 0; row <= resolution; row++) {
      for (let col = 0; col <= resolution; col++) {
        const vi = vOffset + row * (resolution + 1) + col;

        // Local face coordinate s,t ∈ [-1, 1]
        const s = (col / resolution) * 2 - 1;
        const t = (row / resolution) * 2 - 1;

        // Map to cube face
        const [cx, cy, cz] = faceToCube(face, s, t);

        // Normalize to sphere
        const { nx, ny, nz } = normalize(cx, cy, cz);

        positions[vi * 3] = nx * radius;
        positions[vi * 3 + 1] = ny * radius;
        positions[vi * 3 + 2] = nz * radius;

        normals[vi * 3] = nx;
        normals[vi * 3 + 1] = ny;
        normals[vi * 3 + 2] = nz;

        // Local face UV ∈ [0, 1]
        const u = col / resolution;
        const v = row / resolution;
        faceUVs[vi * 2] = u;
        faceUVs[vi * 2 + 1] = v;

        // Atlas UV (square tile centered in cell, with V-flip for WebGL)
        const tileOffsetX = grid.col * cellW + gutterPixels + Math.floor((rawTileW - tileSize) / 2);
        const tileOffsetY = grid.row * cellH + gutterPixels + Math.floor((rawTileH - tileSize) / 2);
        const atlasU = (tileOffsetX + u * tileSize) / atlasSize;
        const atlasV = 1.0 - (tileOffsetY + v * tileSize) / atlasSize;
        atlasUVs[vi * 2] = atlasU;
        atlasUVs[vi * 2 + 1] = atlasV;
      }
    }

    // Generate indices (2 triangles per quad, outward winding)
    let ii = iOffset;
    for (let row = 0; row < resolution; row++) {
      for (let col = 0; col < resolution; col++) {
        const a = vOffset + row * (resolution + 1) + col;
        const b = a + 1;
        const c = a + (resolution + 1);
        const d = c + 1;
        // CCW winding for outward-facing normals
        indices[ii++] = a;
        indices[ii++] = c;
        indices[ii++] = b;
        indices[ii++] = b;
        indices[ii++] = c;
        indices[ii++] = d;
      }
    }
  }

  return Object.freeze({
    version: CUBE_SPHERE_VERSION as typeof CUBE_SPHERE_VERSION,
    radius,
    resolution,
    faceCount: 6 as const,
    vertexCount: totalVerts,
    triangleCount: totalTris,
    positions,
    normals,
    faceUVs,
    atlasUVs,
    indices,
    faceVertexOffsets: Object.freeze(faceVertexOffsets),
    faceIndexOffsets: Object.freeze(faceIndexOffsets),
    seams: SEAM_EDGES,
  });
}

/**
 * Validate that the geometry has correct counts, normals, winding, and UV bounds.
 */
export function validateCubeSphereGeometry(geo: CubeSphereGeometryData): readonly string[] {
  const errors: string[] = [];

  // Check vertex count
  const expectedVerts = (geo.resolution + 1) * (geo.resolution + 1) * 6;
  if (geo.vertexCount !== expectedVerts) {
    errors.push(`Vertex count ${geo.vertexCount} ≠ expected ${expectedVerts}`);
  }

  // Check triangle count
  const expectedTris = geo.resolution * geo.resolution * 2 * 6;
  if (geo.triangleCount !== expectedTris) {
    errors.push(`Triangle count ${geo.triangleCount} ≠ expected ${expectedTris}`);
  }

  // Check normals are unit length
  for (let i = 0; i < geo.vertexCount; i++) {
    const nx = geo.normals[i * 3];
    const ny = geo.normals[i * 3 + 1];
    const nz = geo.normals[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (Math.abs(len - 1.0) > 1e-5) {
      errors.push(`Normal ${i} has length ${len} (not unit)`);
      break;
    }
  }

  // Check positions are on sphere surface
  for (let i = 0; i < geo.vertexCount; i++) {
    const px = geo.positions[i * 3];
    const py = geo.positions[i * 3 + 1];
    const pz = geo.positions[i * 3 + 2];
    const dist = Math.sqrt(px * px + py * py + pz * pz);
    if (Math.abs(dist - geo.radius) > 1e-4 * geo.radius) {
      errors.push(`Vertex ${i} at distance ${dist} from origin (expected ${geo.radius})`);
      break;
    }
  }

  // Check face UVs are in [0, 1]
  for (let i = 0; i < geo.vertexCount; i++) {
    const u = geo.faceUVs[i * 2];
    const v = geo.faceUVs[i * 2 + 1];
    if (u < -1e-6 || u > 1 + 1e-6 || v < -1e-6 || v > 1 + 1e-6) {
      errors.push(`Face UV ${i} = (${u}, ${v}) out of [0,1]`);
      break;
    }
  }

  // Check atlas UVs are in [0, 1]
  for (let i = 0; i < geo.vertexCount; i++) {
    const u = geo.atlasUVs[i * 2];
    const v = geo.atlasUVs[i * 2 + 1];
    if (u < -1e-6 || u > 1 + 1e-6 || v < -1e-6 || v > 1 + 1e-6) {
      errors.push(`Atlas UV ${i} = (${u}, ${v}) out of [0,1]`);
      break;
    }
  }

  // Check winding: all face normals should point outward
  // Sample one triangle per face and check normal direction
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const iBase = geo.faceIndexOffsets[faceIdx];
    const ia = geo.indices[iBase];
    const ib = geo.indices[iBase + 1];
    const ic = geo.indices[iBase + 2];

    const ax = geo.positions[ia * 3], ay = geo.positions[ia * 3 + 1], az = geo.positions[ia * 3 + 2];
    const bx = geo.positions[ib * 3], by = geo.positions[ib * 3 + 1], bz = geo.positions[ib * 3 + 2];
    const cx = geo.positions[ic * 3], cy = geo.positions[ic * 3 + 1], cz = geo.positions[ic * 3 + 2];

    // Triangle normal (cross product of edges)
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const tnx = e1y * e2z - e1z * e2y;
    const tny = e1z * e2x - e1x * e2z;
    const tnz = e1x * e2y - e1y * e2x;

    // Average position of triangle (should be on sphere surface)
    const avgX = (ax + bx + cx) / 3;
    const avgY = (ay + by + cy) / 3;
    const avgZ = (az + bz + cz) / 3;

    // Dot product of triangle normal with position should be positive (outward)
    const dot = tnx * avgX + tny * avgY + tnz * avgZ;
    if (dot < 0) {
      errors.push(`Face ${faceIdx} (${FACE_ORDER[faceIdx]}) has inward winding (dot = ${dot})`);
    }
  }

  return Object.freeze(errors);
}

/**
 * Get the atlas tile rectangle for a given face (square tile centered in cell).
 * Returns { x, y, width, height } in pixels within the atlas.
 */
export function getAtlasTileRect(
  faceIndex: number,
  atlasSize = 2048,
  gutterPixels = 4,
): { x: number; y: number; width: number; height: number } {
  const grid = FACE_ATLAS_GRID[faceIndex];
  const cellW = atlasSize / 3;
  const cellH = atlasSize / 2;
  const tileW = cellW - gutterPixels * 2;
  const tileH = cellH - gutterPixels * 2;
  const tileSize = Math.min(tileW, tileH);
  const offsetX = grid.col * cellW + gutterPixels + Math.floor((tileW - tileSize) / 2);
  const offsetY = grid.row * cellH + gutterPixels + Math.floor((tileH - tileSize) / 2);
  return {
    x: offsetX,
    y: offsetY,
    width: tileSize,
    height: tileSize,
  };
}
