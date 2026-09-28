/**
 * IF-MODEL-IMPORT: Pure model ingestion, parsing, mesh analysis, and validation.
 * Supports GLTF, GLB, and OBJ formats with strict bounds, deduplication and geometry metrics.
 */

export const MAX_SOURCE_BYTES = 64 * 1024 * 1024; // 64 MB
export const TRI_WARN = 50_000;
export const TRI_REFUSE = 300_000;
export const TERRAIN_TRI_CAP = 20_000;
export const UNITS_PER_METER = 62; // marble diameter ~62 world units ≈ 1 meter

export type SourceKind = 'glb' | 'gltf' | 'obj';
export type MeshRole = 'decoration' | 'barrier' | 'terrain';

export type ImportRefusal =
  | 'too_large'
  | 'too_many_tris'
  | 'no_geometry'
  | 'unsupported_format'
  | 'draco_unsupported'
  | 'ktx2_unsupported'
  | 'external_uri'
  | 'missing_companion_file'
  | 'parse_error'
  | 'quota_exceeded'
  | 'idb_unavailable';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type MeshWarningCode =
  | 'tri_budget_warn'
  | 'terrain_tri_cap'
  | 'degenerate'
  | 'open_mesh'
  | 'non_manifold'
  | 'inverted'
  | 'tiny'
  | 'huge';

export interface MeshAnalysis {
  tris: number;
  verts: number;
  meshes: number;
  materials: number;
  textures: number;
  aabb: { min: Vec3; max: Vec3 };
  boundingRadius: number;
  degenerate: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  signedVolume: number;
  inverted: boolean;
  strippedLights: number;
  strippedCameras: number;
  animationsIgnored: number;
  skinned: boolean;
  suggestedScale: number;
  warnings: { code: MeshWarningCode; detail: string }[];
}

export interface AssetRecord {
  assetId: string;
  sha256: string;
  name: string;
  kind: SourceKind;
  bytes: number;
  companions: { name: string; sha256: string }[];
  analysis: MeshAnalysis;
  importedAt: string;
  defaultRole: MeshRole;
  defaultScale: number;
}

export interface RawMesh {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
}

export type ObjResult =
  | { ok: true; mesh: RawMesh; skippedLines: number }
  | { ok: false; error: ImportRefusal; line?: number };

/**
 * Pure Wavefront OBJ parser.
 * Supports standard vertices and 1-based / negative relative polygon face indices.
 */
export function parseOBJ(text: string, name = 'model'): ObjResult {
  const pos: number[] = [];
  const idx: number[] = [];
  let skippedLines = 0;
  const lines = text.split(/\r?\n/);

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === 'v') {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return { ok: false, error: 'parse_error', line: li + 1 };
      }
      pos.push(x, y, z);
    } else if (parts[0] === 'f') {
      const vc = pos.length / 3;
      const face: number[] = [];
      for (let k = 1; k < parts.length; k++) {
        const token = parts[k].split('/')[0];
        if (!token) continue;
        const n = parseInt(token, 10);
        const i = n < 0 ? vc + n : n - 1;
        if (!Number.isInteger(i) || i < 0 || i >= vc) {
          return { ok: false, error: 'parse_error', line: li + 1 };
        }
        face.push(i);
      }

      // Triangulate face fan
      for (let k = 1; k + 1 < face.length; k++) {
        idx.push(face[0], face[k], face[k + 1]);
      }

      if (idx.length / 3 > TRI_REFUSE) {
        return { ok: false, error: 'too_many_tris', line: li + 1 };
      }
    } else {
      skippedLines++;
    }
  }

  if (idx.length === 0) {
    return { ok: false, error: 'no_geometry' };
  }

  return {
    ok: true,
    mesh: {
      name,
      positions: new Float32Array(pos),
      indices: new Uint32Array(idx),
    },
    skippedLines,
  };
}

/**
 * Welds vertices within position epsilon (1e-4) so duplicate edge seams don't read as holes.
 */
export function weldVertices(
  positions: Float32Array,
  eps = 1e-4,
): { map: Uint32Array; count: number } {
  const n = positions.length / 3;
  const map = new Uint32Array(n);
  const seen = new Map<string, number>();
  const q = 1 / eps;

  for (let i = 0; i < n; i++) {
    const key = `${Math.round(positions[i * 3] * q)},${Math.round(positions[i * 3 + 1] * q)},${Math.round(positions[i * 3 + 2] * q)}`;
    let id = seen.get(key);
    if (id === undefined) {
      id = seen.size;
      seen.set(key, id);
    }
    map[i] = id;
  }

  return { map, count: seen.size };
}

/**
 * Analyzes geometry topology, metrics, volume, manifold edges, and boundary holes.
 */
export function analyzeMesh(mesh: RawMesh, targetSize = 400): MeshAnalysis {
  const p = mesh.positions;
  const f = mesh.indices;
  const tris = f.length / 3;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i]);
    minY = Math.min(minY, p[i + 1]);
    minZ = Math.min(minZ, p[i + 2]);
    maxX = Math.max(maxX, p[i]);
    maxY = Math.max(maxY, p[i + 1]);
    maxZ = Math.max(maxZ, p[i + 2]);
  }

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxDim = Math.max(sizeX, sizeY, sizeZ) || 1;
  const boundingRadius = Math.hypot(sizeX, sizeY, sizeZ) / 2;

  const { map } = weldVertices(p);
  const edges = new Map<string, number>();
  let degenerate = 0;
  let signedVolume = 0;

  for (let t = 0; t < tris; t++) {
    const a = f[t * 3];
    const b = f[t * 3 + 1];
    const c = f[t * 3 + 2];

    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const bx = p[b * 3], by = p[b * 3 + 1], bz = p[b * 3 + 2];
    const cx = p[c * 3], cy = p[c * 3 + 1], cz = p[c * 3 + 2];

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    if (Math.hypot(nx, ny, nz) < 1e-9) degenerate++;

    // Signed volume tetrahedron contribution
    signedVolume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    const w = [map[a], map[b], map[c]];
    for (let e = 0; e < 3; e++) {
      const i = w[e];
      const j = w[(e + 1) % 3];
      if (i === j) continue;
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  edges.forEach((cnt) => {
    if (cnt === 1) boundaryEdges++;
    else if (cnt > 2) nonManifoldEdges++;
  });

  const inverted = signedVolume < 0 && boundaryEdges <= 0.05 * edges.size;

  const warnings: MeshAnalysis['warnings'] = [];
  if (tris > TRI_WARN) {
    warnings.push({ code: 'tri_budget_warn', detail: `${tris} triangles exceeds budget warning (${TRI_WARN})` });
  }
  if (tris > TERRAIN_TRI_CAP) {
    warnings.push({ code: 'terrain_tri_cap', detail: `${tris} triangles exceeds terrain cap (${TERRAIN_TRI_CAP})` });
  }
  if (degenerate > 0) {
    warnings.push({ code: 'degenerate', detail: `${degenerate} zero-area triangles detected` });
  }
  if (boundaryEdges > 0) {
    warnings.push({ code: 'open_mesh', detail: `${boundaryEdges} boundary edges detected (mesh has holes)` });
  }
  if (nonManifoldEdges > 0) {
    warnings.push({ code: 'non_manifold', detail: `${nonManifoldEdges} non-manifold edges detected` });
  }
  if (inverted) {
    warnings.push({ code: 'inverted', detail: 'Mesh appears inverted (negative signed volume)' });
  }
  if (maxDim < 5) {
    warnings.push({ code: 'tiny', detail: `Small dimensions (${maxDim.toFixed(2)}): likely meters (×${UNITS_PER_METER} recommended)` });
  }
  if (maxDim > 20000) {
    warnings.push({ code: 'huge', detail: `Large dimensions (${maxDim.toFixed(0)}): likely millimeters` });
  }

  const suggestedScale = maxDim < 5 ? UNITS_PER_METER : targetSize / maxDim;

  return {
    tris,
    verts: p.length / 3,
    meshes: 1,
    materials: 1,
    textures: 0,
    aabb: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
    boundingRadius,
    degenerate,
    boundaryEdges,
    nonManifoldEdges,
    signedVolume,
    inverted,
    strippedLights: 0,
    strippedCameras: 0,
    animationsIgnored: 0,
    skinned: false,
    suggestedScale,
    warnings,
  };
}
