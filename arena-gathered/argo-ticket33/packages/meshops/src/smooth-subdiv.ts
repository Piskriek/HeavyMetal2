/**
 * TICKET-33 — Studio Deep Editing Operator Family 1: Smoothing, Fairing & Subdivision
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `smooth-taubin` — One-Click Preset: "Smooth (Volume-Safe)" (Taubin lambda/mu fairing, zero shrinkage)
 * 2. `smooth-laplacian` — One-Click Preset: "Soft Polish" (Crease- & boundary-aware Laplacian + HC push)
 * 3. `subdivide-mid-smooth` — One-Click Preset: "Subdivide & Round" (1-to-4 midpoint split + Taubin round)
 * 4. `spherize-cast` — One-Click Preset: "Dome / Bulge" (Blender Cast / ZBrush Spherize blend)
 * 5. `peak-inflate` — One-Click Preset: "Thicken / Inflate" (Houdini Peak / ZBrush Inflate along vertex normals)
 */

import {
  resolveParams,
  type MeshData,
  type ParamSpec,
  type Params,
  type Slot,
  type V3,
} from '@hm/partgen';

export type OperatorFamilyId =
  | 'smooth-subdiv'
  | 'hardsurface-cad'
  | 'cleanup-remesh'
  | 'deformers'
  | 'symmetry-cloner'
  | 'uv-wear-stack';

export interface MeshOperator {
  readonly id: string;
  readonly family: OperatorFamilyId;
  readonly label: string;
  readonly oneClickPresetLabel: string;
  readonly description: string;
  readonly params: readonly ParamSpec[];
  readonly oneClickPreset: Params;
  readonly namedPresets: Readonly<Record<string, Params>>;
  apply(mesh: MeshData, given?: Params): MeshData;
}

const pSpec = (
  key: string,
  label: string,
  unit: 'm' | 'count' | 'choice',
  min: number,
  max: number,
  step: number,
  def: number,
  choices?: readonly string[],
): ParamSpec =>
  choices !== undefined
    ? { key, label, unit, min, max, step, default: def, choices }
    : { key, label, unit, min, max, step, default: def };

function spatialKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 100000)},${Math.round(y * 100000)},${Math.round(z * 100000)}`;
}

/**
 * Builds a spatial Equivalence Graph across split flat-shaded vertices so smoothing and
 * inflating move shared geometric corners together without tearing hard-shaded faces apart.
 */
export function buildSpatialTopology(mesh: MeshData): {
  readonly uniqueCoords: Float64Array;
  readonly vertexToUnique: Int32Array;
  readonly neighbors: ReadonlyArray<readonly number[]>;
  readonly isBoundary: Uint8Array;
  readonly maxCreaseCos: Float64Array;
  readonly smoothNormals: Float64Array;
} {
  const vCount = mesh.positions.length / 3;
  const vertexToUnique = new Int32Array(vCount);
  const keyToUnique = new Map<string, number>();
  const uCoords: number[] = [];

  for (let i = 0; i < vCount; i++) {
    const x = mesh.positions[i * 3] ?? 0;
    const y = mesh.positions[i * 3 + 1] ?? 0;
    const z = mesh.positions[i * 3 + 2] ?? 0;
    const k = spatialKey(x, y, z);
    let uIdx = keyToUnique.get(k);
    if (uIdx === undefined) {
      uIdx = uCoords.length / 3;
      keyToUnique.set(k, uIdx);
      uCoords.push(x, y, z);
    }
    vertexToUnique[i] = uIdx;
  }

  const uCount = uCoords.length / 3;
  const adjSets: Array<Set<number>> = Array.from({ length: uCount }, () => new Set<number>());
  const edgeFaceNormals = new Map<string, number[]>();
  const smoothNormals = new Float64Array(uCount * 3);

  const triCount = Math.floor(mesh.indices.length / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] ?? 0;
    const i1 = mesh.indices[t * 3 + 1] ?? 0;
    const i2 = mesh.indices[t * 3 + 2] ?? 0;
    const u0 = vertexToUnique[i0]!;
    const u1 = vertexToUnique[i1]!;
    const u2 = vertexToUnique[i2]!;
    if (u0 === u1 || u1 === u2 || u2 === u0) continue;

    adjSets[u0]!.add(u1);
    adjSets[u0]!.add(u2);
    adjSets[u1]!.add(u0);
    adjSets[u1]!.add(u2);
    adjSets[u2]!.add(u0);
    adjSets[u2]!.add(u1);

    const ax = uCoords[u0 * 3]!, ay = uCoords[u0 * 3 + 1]!, az = uCoords[u0 * 3 + 2]!;
    const bx = uCoords[u1 * 3]!, by = uCoords[u1 * 3 + 1]!, bz = uCoords[u1 * 3 + 2]!;
    const cx = uCoords[u2 * 3]!, cy = uCoords[u2 * 3 + 1]!, cz = uCoords[u2 * 3 + 2]!;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    for (const u of [u0, u1, u2]) {
      smoothNormals[u * 3]! += nx * len;
      smoothNormals[u * 3 + 1]! += ny * len;
      smoothNormals[u * 3 + 2]! += nz * len;
    }

    const pairs: ReadonlyArray<readonly [number, number]> = [
      [u0, u1],
      [u1, u2],
      [u2, u0],
    ];
    for (const [a, b] of pairs) {
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      let list = edgeFaceNormals.get(ek);
      if (!list) edgeFaceNormals.set(ek, (list = []));
      list.push(nx, ny, nz);
    }
  }

  for (let u = 0; u < uCount; u++) {
    const lx = smoothNormals[u * 3]!;
    const ly = smoothNormals[u * 3 + 1]!;
    const lz = smoothNormals[u * 3 + 2]!;
    const l = Math.hypot(lx, ly, lz) || 1;
    smoothNormals[u * 3] = lx / l;
    smoothNormals[u * 3 + 1] = ly / l;
    smoothNormals[u * 3 + 2] = lz / l;
  }

  const isBoundary = new Uint8Array(uCount);
  const maxCreaseCos = new Float64Array(uCount).fill(1.0);

  for (const [ek, nList] of edgeFaceNormals) {
    const parts = ek.split('|');
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (nList.length < 6) {
      isBoundary[a] = 1;
      isBoundary[b] = 1;
    } else {
      const dot = nList[0]! * nList[3]! + nList[1]! * nList[4]! + nList[2]! * nList[5]!;
      if (dot < maxCreaseCos[a]!) maxCreaseCos[a] = dot;
      if (dot < maxCreaseCos[b]!) maxCreaseCos[b] = dot;
    }
  }

  return {
    uniqueCoords: new Float64Array(uCoords),
    vertexToUnique,
    neighbors: adjSets.map((s) => Array.from(s)),
    isBoundary,
    maxCreaseCos,
    smoothNormals,
  };
}

/**
 * Rebuilds a MeshData with updated unique vertex positions and recomputed normals/bounds/UVs.
 */
export function applyUniqueCoordsToMesh(
  mesh: MeshData,
  uniqueCoords: Float64Array,
  vertexToUnique: Int32Array,
  smoothShading = false,
  smoothNormals?: Float64Array,
): MeshData {
  const vCount = mesh.positions.length / 3;
  const positions = new Float32Array(vCount * 3);
  const normals = new Float32Array(vCount * 3);
  const uvs = new Float32Array(mesh.uvs);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < vCount; i++) {
    const u = vertexToUnique[i]!;
    const x = uniqueCoords[u * 3]!;
    const y = uniqueCoords[u * 3 + 1]!;
    const z = uniqueCoords[u * 3 + 2]!;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  const triCount = Math.floor(mesh.indices.length / 3);
  if (smoothShading && smoothNormals !== undefined) {
    // Recompute smooth vertex normals on the deformed unique coordinates:
    const recomputedSmooth = new Float64Array(uniqueCoords.length);
    for (let t = 0; t < triCount; t++) {
      const i0 = mesh.indices[t * 3]!;
      const i1 = mesh.indices[t * 3 + 1]!;
      const i2 = mesh.indices[t * 3 + 2]!;
      const u0 = vertexToUnique[i0]!, u1 = vertexToUnique[i1]!, u2 = vertexToUnique[i2]!;
      const ax = uniqueCoords[u0 * 3]!, ay = uniqueCoords[u0 * 3 + 1]!, az = uniqueCoords[u0 * 3 + 2]!;
      const bx = uniqueCoords[u1 * 3]!, by = uniqueCoords[u1 * 3 + 1]!, bz = uniqueCoords[u1 * 3 + 2]!;
      const cx = uniqueCoords[u2 * 3]!, cy = uniqueCoords[u2 * 3 + 1]!, cz = uniqueCoords[u2 * 3 + 2]!;
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      for (const u of [u0, u1, u2]) {
        recomputedSmooth[u * 3]! += nx;
        recomputedSmooth[u * 3 + 1]! += ny;
        recomputedSmooth[u * 3 + 2]! += nz;
      }
    }
    for (let i = 0; i < vCount; i++) {
      const u = vertexToUnique[i]!;
      const nx = recomputedSmooth[u * 3]!;
      const ny = recomputedSmooth[u * 3 + 1]!;
      const nz = recomputedSmooth[u * 3 + 2]!;
      const l = Math.hypot(nx, ny, nz) || 1;
      normals[i * 3] = nx / l;
      normals[i * 3 + 1] = ny / l;
      normals[i * 3 + 2] = nz / l;
    }
  } else {
    // Recompute flat face normals per triangle:
    for (let t = 0; t < triCount; t++) {
      const i0 = mesh.indices[t * 3]!;
      const i1 = mesh.indices[t * 3 + 1]!;
      const i2 = mesh.indices[t * 3 + 2]!;
      const ax = positions[i0 * 3]!, ay = positions[i0 * 3 + 1]!, az = positions[i0 * 3 + 2]!;
      const bx = positions[i1 * 3]!, by = positions[i1 * 3 + 1]!, bz = positions[i1 * 3 + 2]!;
      const cx = positions[i2 * 3]!, cy = positions[i2 * 3 + 1]!, cz = positions[i2 * 3 + 2]!;
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (const idx of [i0, i1, i2]) {
        normals[idx * 3] = nx;
        normals[idx * 3 + 1] = ny;
        normals[idx * 3 + 2] = nz;
      }
    }
  }

  const empty = vCount === 0;
  return {
    positions,
    normals,
    uvs,
    indices: new Uint32Array(mesh.indices),
    slots: mesh.slots,
    min: empty ? [0, 0, 0] : min,
    max: empty ? [0, 0, 0] : max,
  };
}

function laplacianStep(
  coords: Float64Array,
  neighbors: ReadonlyArray<readonly number[]>,
  isBoundary: Uint8Array,
  lockBoundaries: boolean,
  weight: number,
): Float64Array {
  const uCount = coords.length / 3;
  const next = new Float64Array(coords.length);
  for (let u = 0; u < uCount; u++) {
    const nbs = neighbors[u]!;
    if (nbs.length === 0 || (lockBoundaries && isBoundary[u] === 1)) {
      next[u * 3] = coords[u * 3]!;
      next[u * 3 + 1] = coords[u * 3 + 1]!;
      next[u * 3 + 2] = coords[u * 3 + 2]!;
      continue;
    }
    let sx = 0, sy = 0, sz = 0;
    for (const nb of nbs) {
      sx += coords[nb * 3]!;
      sy += coords[nb * 3 + 1]!;
      sz += coords[nb * 3 + 2]!;
    }
    const inv = 1 / nbs.length;
    const cx = coords[u * 3]!, cy = coords[u * 3 + 1]!, cz = coords[u * 3 + 2]!;
    next[u * 3] = cx + weight * (sx * inv - cx);
    next[u * 3 + 1] = cy + weight * (sy * inv - cy);
    next[u * 3 + 2] = cz + weight * (sz * inv - cz);
  }
  return next;
}

/**
 * 1. Taubin Volume-Preserving Smooth Operator ("Smooth (Volume-Safe)")
 * Alternates a positive shrinking pass (+lambda) and a negative un-shrinking pass (-mu)
 * so corners soften without collapsing the part's overall bounding dimensions.
 */
export const smoothTaubin: MeshOperator = {
  id: 'smooth-taubin',
  family: 'smooth-subdiv',
  label: 'Taubin Smooth',
  oneClickPresetLabel: 'Smooth (Volume-Safe)',
  description: 'Volume-preserving lambda/mu smoothing that softens edges without shrinking the model.',
  params: [
    pSpec('iterations', 'Iterations', 'count', 1, 20, 1, 4),
    pSpec('lambda', 'Shrink pass (lambda)', 'm', 0.1, 0.8, 0.02, 0.5),
    pSpec('mu', 'Inflate pass (mu)', 'm', 0.1, 0.85, 0.01, 0.50),
    pSpec('lockBoundaries', 'Lock open borders', 'choice', 0, 1, 1, 1, ['free', 'locked']),
    pSpec('shading', 'Output normals', 'choice', 0, 1, 1, 1, ['faceted', 'smooth']),
  ],
  oneClickPreset: { iterations: 4, lambda: 0.45, mu: 0.47, lockBoundaries: 1, shading: 1 },
  namedPresets: {
    'subtle-polish': { iterations: 2, lambda: 0.35, mu: 0.37, lockBoundaries: 1, shading: 0 },
    'smooth-volume-safe': { iterations: 4, lambda: 0.5, mu: 0.53, lockBoundaries: 1, shading: 1 },
    'organic-round': { iterations: 10, lambda: 0.55, mu: 0.58, lockBoundaries: 0, shading: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const iters = p.iterations as number;
    const lambda = p.lambda as number;
    const mu = -(p.mu as number);
    const lock = p.lockBoundaries === 1;
    const topo = buildSpatialTopology(mesh);
    let coords = topo.uniqueCoords;
    for (let i = 0; i < iters; i++) {
      coords = laplacianStep(coords, topo.neighbors, topo.isBoundary, lock, lambda);
      coords = laplacianStep(coords, topo.neighbors, topo.isBoundary, lock, mu);
    }
    // Clamp to original CAD AABB envelope so flat face centers never bulge past nominal dimensions:
    for (let u = 0; u < coords.length / 3; u++) {
      for (let k = 0; k < 3; k++) {
        const v = coords[u * 3 + k]!;
        coords[u * 3 + k] = Math.max(mesh.min[k]!, Math.min(mesh.max[k]!, v));
      }
    }
    return applyUniqueCoordsToMesh(mesh, coords, topo.vertexToUnique, p.shading === 1, topo.smoothNormals);
  },
};

/**
 * 2. Humphrey-Classes (HC) / Laplacian Smooth Operator ("Soft Polish")
 */
export const smoothLaplacian: MeshOperator = {
  id: 'smooth-laplacian',
  family: 'smooth-subdiv',
  label: 'Laplacian HC Smooth',
  oneClickPresetLabel: 'Soft Polish',
  description: 'Laplacian relaxation with HC volume-push compensation.',
  params: [
    pSpec('iterations', 'Iterations', 'count', 1, 20, 1, 3),
    pSpec('factor', 'Smooth factor', 'm', 0.05, 1.0, 0.05, 0.45),
    pSpec('hcBeta', 'Volume retention', 'm', 0.0, 1.0, 0.05, 0.6),
    pSpec('lockBoundaries', 'Lock open borders', 'choice', 0, 1, 1, 1, ['free', 'locked']),
  ],
  oneClickPreset: { iterations: 3, factor: 0.45, hcBeta: 0.6, lockBoundaries: 1 },
  namedPresets: {
    'soft-polish': { iterations: 3, factor: 0.45, hcBeta: 0.6, lockBoundaries: 1 },
    'heavy-relax': { iterations: 8, factor: 0.7, hcBeta: 0.3, lockBoundaries: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const iters = p.iterations as number;
    const factor = p.factor as number;
    const beta = p.hcBeta as number;
    const lock = p.lockBoundaries === 1;
    const topo = buildSpatialTopology(mesh);
    const orig = new Float64Array(topo.uniqueCoords);
    let coords = new Float64Array(topo.uniqueCoords);

    for (let it = 0; it < iters; it++) {
      const prev = coords;
      const next = laplacianStep(prev, topo.neighbors, topo.isBoundary, lock, factor);
      if (beta > 0) {
        const bVec = new Float64Array(coords.length);
        for (let k = 0; k < coords.length; k++) {
          bVec[k] = next[k]! - (beta * orig[k]! + (1 - beta) * prev[k]!);
        }
        const uCount = coords.length / 3;
        for (let u = 0; u < uCount; u++) {
          const nbs = topo.neighbors[u]!;
          if (nbs.length === 0 || (lock && topo.isBoundary[u] === 1)) continue;
          let bx = 0, by = 0, bz = 0;
          for (const nb of nbs) {
            bx += bVec[nb * 3]!;
            by += bVec[nb * 3 + 1]!;
            bz += bVec[nb * 3 + 2]!;
          }
          const inv = 1 / nbs.length;
          next[u * 3]! -= 0.5 * (bVec[u * 3]! + bx * inv);
          next[u * 3 + 1]! -= 0.5 * (bVec[u * 3 + 1]! + by * inv);
          next[u * 3 + 2]! -= 0.5 * (bVec[u * 3 + 2]! + bz * inv);
        }
      }
      coords = next;
    }
    return applyUniqueCoordsToMesh(mesh, coords, topo.vertexToUnique, false, topo.smoothNormals);
  },
};

/**
 * 3. Subdivide & Round Operator ("Subdivide & Round")
 * Splits every triangle into 4 sub-triangles (preserving material slots) and optionally
 * applies Taubin rounding so low-poly boxes can be smoothed cleanly.
 */
export const subdivideMidSmooth: MeshOperator = {
  id: 'subdivide-mid-smooth',
  family: 'smooth-subdiv',
  label: 'Subdivide Surface',
  oneClickPresetLabel: 'Subdivide & Round',
  description: 'Splits each triangle into 4 sub-triangles and applies optional volume-safe rounding.',
  params: [
    pSpec('levels', 'Subdivision levels', 'count', 1, 3, 1, 1),
    pSpec('roundness', 'Corner roundness', 'm', 0.0, 1.0, 0.05, 0.5),
  ],
  oneClickPreset: { levels: 1, roundness: 0.5 },
  namedPresets: {
    'flat-tessellate': { levels: 1, roundness: 0.0 },
    'subdivide-and-round': { levels: 1, roundness: 0.5 },
    'high-smooth-cage': { levels: 2, roundness: 0.75 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const levels = p.levels as number;
    const roundness = p.roundness as number;

    let current = mesh;
    for (let lv = 0; lv < levels; lv++) {
      current = subdivideOnce(current);
    }
    if (roundness > 1e-4) {
      current = smoothTaubin.apply(current, {
        iterations: Math.max(1, Math.round(roundness * 6)),
        lambda: 0.48 * roundness,
        mu: 0.485 * roundness,
        lockBoundaries: 1,
        shading: roundness >= 0.4 ? 1 : 0,
      });
    }
    return current;
  },
};

function subdivideOnce(mesh: MeshData): MeshData {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const slots: Slot[] = [];

  const pushTri = (
    p0: V3, p1: V3, p2: V3,
    n: V3,
    u0: readonly [number, number],
    u1: readonly [number, number],
    u2: readonly [number, number],
  ): void => {
    const base = pos.length / 3;
    pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    nor.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    uv.push(u0[0], u0[1], u1[0], u1[1], u2[0], u2[1]);
    idx.push(base, base + 1, base + 2);
  };

  const mid3 = (a: V3, b: V3): V3 => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
  const mid2 = (a: readonly [number, number], b: readonly [number, number]): readonly [number, number] => [
    (a[0] + b[0]) * 0.5,
    (a[1] + b[1]) * 0.5,
  ];

  const slotList = mesh.slots.length > 0 ? mesh.slots : [{ name: 'default', start: 0, count: mesh.indices.length }];
  for (const sl of slotList) {
    const startIdx = idx.length;
    for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
      const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
      const p0: V3 = [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!];
      const p1: V3 = [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!];
      const p2: V3 = [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!];
      const n: V3 = [mesh.normals[i0 * 3]!, mesh.normals[i0 * 3 + 1]!, mesh.normals[i0 * 3 + 2]!];
      const u0: readonly [number, number] = [mesh.uvs[i0 * 2] ?? 0, mesh.uvs[i0 * 2 + 1] ?? 0];
      const u1: readonly [number, number] = [mesh.uvs[i1 * 2] ?? 0, mesh.uvs[i1 * 2 + 1] ?? 0];
      const u2: readonly [number, number] = [mesh.uvs[i2 * 2] ?? 0, mesh.uvs[i2 * 2 + 1] ?? 0];

      const m01 = mid3(p0, p1), m12 = mid3(p1, p2), m20 = mid3(p2, p0);
      const uv01 = mid2(u0, u1), uv12 = mid2(u1, u2), uv20 = mid2(u2, u0);

      pushTri(p0, m01, m20, n, u0, uv01, uv20);
      pushTri(m01, p1, m12, n, uv01, u1, uv12);
      pushTri(m20, m12, p2, n, uv20, uv12, u2);
      pushTri(m01, m12, m20, n, uv01, uv12, uv20);
    }
    slots.push({ name: sl.name, start: startIdx, count: idx.length - startIdx });
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uv),
    indices: new Uint32Array(idx),
    slots,
    min: mesh.min,
    max: mesh.max,
  };
}

/**
 * 4. Spherize / Cast Operator ("Dome / Bulge")
 * Blends vertex positions toward a bounding sphere or cylinder (Blender Cast / ZBrush Spherize).
 */
export const spherizeCast: MeshOperator = {
  id: 'spherize-cast',
  family: 'smooth-subdiv',
  label: 'Cast / Spherize',
  oneClickPresetLabel: 'Dome / Bulge',
  description: 'Blends the mesh silhouette toward a sphere or vertical cylinder.',
  params: [
    pSpec('shape', 'Target shape', 'choice', 0, 1, 1, 0, ['sphere', 'cylinder-y']),
    pSpec('factor', 'Blend factor', 'm', 0.0, 1.0, 0.05, 0.5),
  ],
  oneClickPreset: { shape: 0, factor: 0.5 },
  namedPresets: {
    'dome-bulge': { shape: 0, factor: 0.5 },
    'round-canister': { shape: 1, factor: 0.75 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const shape = p.shape as number;
    const factor = p.factor as number;
    const topo = buildSpatialTopology(mesh);
    const coords = new Float64Array(topo.uniqueCoords);

    const cx = 0.5 * (mesh.min[0] + mesh.max[0]);
    const cy = 0.5 * (mesh.min[1] + mesh.max[1]);
    const cz = 0.5 * (mesh.min[2] + mesh.max[2]);
    const rx = Math.max(1e-4, 0.5 * (mesh.max[0] - mesh.min[0]));
    const ry = Math.max(1e-4, 0.5 * (mesh.max[1] - mesh.min[1]));
    const rz = Math.max(1e-4, 0.5 * (mesh.max[2] - mesh.min[2]));
    const rSphere = (rx + ry + rz) / 3;
    const rCyl = (rx + rz) * 0.5;

    const uCount = coords.length / 3;
    for (let u = 0; u < uCount; u++) {
      const x = coords[u * 3]!, y = coords[u * 3 + 1]!, z = coords[u * 3 + 2]!;
      if (shape === 0) {
        const dx = x - cx, dy = y - cy, dz = z - cz;
        const d = Math.hypot(dx, dy, dz) || 1;
        const tx = cx + (dx / d) * rSphere;
        const ty = cy + (dy / d) * rSphere;
        const tz = cz + (dz / d) * rSphere;
        coords[u * 3] = x + (tx - x) * factor;
        coords[u * 3 + 1] = y + (ty - y) * factor;
        coords[u * 3 + 2] = z + (tz - z) * factor;
      } else {
        const dx = x - cx, dz = z - cz;
        const d = Math.hypot(dx, dz) || 1;
        const tx = cx + (dx / d) * rCyl;
        const tz = cz + (dz / d) * rCyl;
        coords[u * 3] = x + (tx - x) * factor;
        coords[u * 3 + 2] = z + (tz - z) * factor;
      }
    }
    return applyUniqueCoordsToMesh(mesh, coords, topo.vertexToUnique, false);
  },
};

/**
 * 5. Peak / Inflate Operator ("Thicken / Inflate")
 * Pushes vertices outward or inward along their smooth averaged vertex normals (Houdini Peak / ZBrush Inflate).
 */
export const peakInflate: MeshOperator = {
  id: 'peak-inflate',
  family: 'smooth-subdiv',
  label: 'Peak / Inflate',
  oneClickPresetLabel: 'Thicken / Inflate',
  description: 'Displaces vertices along their averaged surface normals while keeping base grounding.',
  params: [
    pSpec('offset', 'Normal offset', 'm', -0.25, 0.25, 0.005, 0.02),
    pSpec('keepGrounded', 'Pin base (y=0)', 'choice', 0, 1, 1, 1, ['free', 'pinned']),
  ],
  oneClickPreset: { offset: 0.02, keepGrounded: 1 },
  namedPresets: {
    'thicken-inflate': { offset: 0.02, keepGrounded: 1 },
    'slim-deflate': { offset: -0.015, keepGrounded: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const offset = p.offset as number;
    const pinBase = p.keepGrounded === 1;
    const topo = buildSpatialTopology(mesh);
    const coords = new Float64Array(topo.uniqueCoords);
    const uCount = coords.length / 3;
    const baseY = mesh.min[1];

    for (let u = 0; u < uCount; u++) {
      const y = coords[u * 3 + 1]!;
      const nx = topo.smoothNormals[u * 3]!;
      const ny = topo.smoothNormals[u * 3 + 1]!;
      const nz = topo.smoothNormals[u * 3 + 2]!;
      coords[u * 3]! += nx * offset;
      if (!(pinBase && Math.abs(y - baseY) < 1e-4)) {
        coords[u * 3 + 1]! += ny * offset;
      }
      coords[u * 3 + 2]! += nz * offset;
    }
    return applyUniqueCoordsToMesh(mesh, coords, topo.vertexToUnique, false);
  },
};

export const FAMILY1_SMOOTH_SUBDIV_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'smooth-taubin': smoothTaubin,
  'smooth-laplacian': smoothLaplacian,
  'subdivide-mid-smooth': subdivideMidSmooth,
  'spherize-cast': spherizeCast,
  'peak-inflate': peakInflate,
});
