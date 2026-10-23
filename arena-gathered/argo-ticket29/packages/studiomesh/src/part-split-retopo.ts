/**
 * TICKET-29 — Part-Split Low-Poly Retopology & Fused-Mesh Un-Webbing
 * Pure deterministic TypeScript module (zero DOM, Date, or Math.random).
 *
 * Solves the root cause of ugly low-poly AI models where a multi-part asset
 * (chassis + wheels + vents + screen + struts) was generated as ONE welded
 * marching-cubes mesh, causing standard decimation to bridge gaps with diagonal
 * triangle webbing and melt 90-degree part intersections.
 *
 * Research-First References:
 * - HoloPart (VAST AI Research / Tripo): Generative 3D Part Amodal Segmentation
 *   (https://github.com/VAST-AI-Research/HoloPart)
 * - PartField (NVIDIA): Learning 3D Feature Fields for Part Segmentation
 *   (https://github.com/nv-tlabs/PartField)
 * - MeshAnything V2: Artist-Created Mesh Generation With Adjacent Mesh Tokenization
 *   (https://github.com/buaacyw/MeshAnythingV2)
 * - meshoptimizer / gltfpack: Crease- & normal-locked simplification
 *   (https://github.com/zeux/meshoptimizer)
 */

export interface PartSplitOptions {
  /** Concave dihedral crease angle in radians that triggers a part-boundary cut (default: 0.88 rad / ~50.4 deg). */
  readonly concaveCreaseRad?: number;
  /** Convex hard-edge angle in radians preserved during planar retopology (default: 0.62 rad / ~35.5 deg). */
  readonly hardCreaseRad?: number;
  /** Aspect ratio above which a bridge triangle spanning two normal clusters is flagged as webbing (default: 5.5). */
  readonly webbingAspectThreshold?: number;
  /** Minimum triangles required to form a standalone semantic part (smaller fragments merge into nearest neighbor, default: 4). */
  readonly minPartTriangles?: number;
  /** Coplanar normal dot-product threshold for flat-face polygon merging (default: 0.988). */
  readonly coplanarDotThreshold?: number;
}

export type SemanticPartRole =
  | 'chassis-core'
  | 'wheel-or-roller'
  | 'turret-or-top'
  | 'vent-or-strut'
  | 'panel-or-screen';

export interface SegmentedMeshPart {
  readonly partIndex: number;
  readonly role: SemanticPartRole;
  /** Un-welded local vertex positions [x0,y0,z0, x1,y1,z1, ...] for this isolated part. */
  readonly positions: Float32Array;
  /** Local 0-based triangle indices for this part. */
  readonly indices: Uint32Array;
  /** Recomputed crisp face-weighted hard-edge vertex normals. */
  readonly normals: Float32Array;
  readonly triangleCount: number;
  readonly aabbMin: readonly [number, number, number];
  readonly aabbMax: readonly [number, number, number];
  /** Number of seam boundary edges capped/isolated from adjacent welded parts. */
  readonly isolatedSeamEdgeCount: number;
}

export interface FusedMeshWebbingAudit {
  readonly assetId: string;
  readonly totalTriangles: number;
  readonly detectedPartCount: number;
  readonly webbingBridgeTriangles: number;
  readonly concaveSeamEdges: number;
  readonly coplanarRedundantTriangles: number;
  /** 0..1 composite severity score; >= 0.18 indicates the single-mesh low-poly model has visible cross-part webbing. */
  readonly webbingSeverityScore: number;
  readonly needsPartSplitRetopo: boolean;
}

export interface PartSplitRetopoResult {
  readonly parts: readonly SegmentedMeshPart[];
  /** Combined 1-draw-call buffer where parts remain geometrically un-welded across part seams. */
  readonly mergedPositions: Float32Array;
  readonly mergedIndices: Uint32Array;
  readonly mergedNormals: Float32Array;
  readonly inputTriangleCount: number;
  readonly outputTriangleCount: number;
  readonly removedWebbingTriangles: number;
}

const DEFAULT_CONCAVE_CREASE_RAD = 0.88;
const DEFAULT_HARD_CREASE_RAD = 0.62;
const DEFAULT_WEBBING_ASPECT = 5.5;
const DEFAULT_MIN_PART_TRIS = 4;
const DEFAULT_COPLANAR_DOT = 0.988;

interface FaceMetrics {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly area: number;
  readonly aspectRatio: number;
}

function computeFaceMetrics(
  positions: Float32Array,
  i0: number,
  i1: number,
  i2: number,
): FaceMetrics {
  const p0x = positions[i0 * 3] ?? 0;
  const p0y = positions[i0 * 3 + 1] ?? 0;
  const p0z = positions[i0 * 3 + 2] ?? 0;
  const p1x = positions[i1 * 3] ?? 0;
  const p1y = positions[i1 * 3 + 1] ?? 0;
  const p1z = positions[i1 * 3 + 2] ?? 0;
  const p2x = positions[i2 * 3] ?? 0;
  const p2y = positions[i2 * 3 + 1] ?? 0;
  const p2z = positions[i2 * 3 + 2] ?? 0;

  const e01x = p1x - p0x;
  const e01y = p1y - p0y;
  const e01z = p1z - p0z;
  const e02x = p2x - p0x;
  const e02y = p2y - p0y;
  const e02z = p2z - p0z;
  const e12x = p2x - p1x;
  const e12y = p2y - p1y;
  const e12z = p2z - p1z;

  const cxCross = e01y * e02z - e01z * e02y;
  const cyCross = e01z * e02x - e01x * e02z;
  const czCross = e01x * e02y - e01y * e02x;
  const crossLen = Math.hypot(cxCross, cyCross, czCross);
  const area = 0.5 * crossLen;

  const invLen = crossLen > 1e-12 ? 1 / crossLen : 0;
  const nx = cxCross * invLen;
  const ny = cyCross * invLen;
  const nz = czCross * invLen;

  const l01 = Math.hypot(e01x, e01y, e01z);
  const l02 = Math.hypot(e02x, e02y, e02z);
  const l12 = Math.hypot(e12x, e12y, e12z);
  const maxEdge = Math.max(l01, l02, l12);
  const altitude = maxEdge > 1e-9 ? (2 * area) / maxEdge : 1;
  const aspectRatio = altitude > 1e-9 ? maxEdge / altitude : 999;

  return {
    nx,
    ny,
    nz,
    cx: (p0x + p1x + p2x) / 3,
    cy: (p0y + p1y + p2y) / 3,
    cz: (p0z + p1z + p2z) / 3,
    area,
    aspectRatio,
  };
}

function quantizeCoord(v: number): number {
  return Math.round(v * 10000);
}

function vertexSpatialKey(positions: Float32Array, vertexIndex: number): string {
  const x = quantizeCoord(positions[vertexIndex * 3] ?? 0);
  const y = quantizeCoord(positions[vertexIndex * 3 + 1] ?? 0);
  const z = quantizeCoord(positions[vertexIndex * 3 + 2] ?? 0);
  return `${x},${y},${z}`;
}

function undirectedEdgeKey(kA: string, kB: string): string {
  return kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
}

/**
 * Determines whether the shared edge between face A and face B forms a concave
 * valley / part-intersection seam or a sharp crease where two parts were welded.
 */
function isConcaveOrSharpPartSeam(
  fA: FaceMetrics,
  fB: FaceMetrics,
  concaveCosThreshold: number,
  hardCreaseCosThreshold: number,
  edgeIncidentFaceCount = 2,
): { isSeam: boolean; isConcave: boolean } {
  const dot = Math.max(-1, Math.min(1, fA.nx * fB.nx + fA.ny * fB.ny + fA.nz * fB.nz));
  // Vector from centroid A to centroid B:
  const dx = fB.cx - fA.cx;
  const dy = fB.cy - fA.cy;
  const dz = fB.cz - fA.cz;
  const dLen = Math.hypot(dx, dy, dz);
  // If face A's normal points toward face B's centroid (or vice-versa),
  // the shared edge sits at a concave valley or T-junction step between two fused parts.
  const concavMeasure =
    dLen > 1e-9 ? ((fA.nx - fB.nx) * dx + (fA.ny - fB.ny) * dy + (fA.nz - fB.nz) * dz) / dLen : 0;
  const isConcave = concavMeasure > 0.10 && dot < concaveCosThreshold;
  const isTJunctionStep = edgeIncidentFaceCount > 2 && dot < hardCreaseCosThreshold;
  const isSharpOrthogonalStep = dot < concaveCosThreshold;
  const isOpposingBridge = dot < -0.25;
  const isSeam = isConcave || isTJunctionStep || isSharpOrthogonalStep || isOpposingBridge;
  return { isSeam, isConcave: isConcave || isTJunctionStep };
}

function classifyPartRole(
  aabbMin: readonly [number, number, number],
  aabbMax: readonly [number, number, number],
  overallMin: readonly [number, number, number],
  overallMax: readonly [number, number, number],
): SemanticPartRole {
  const dx = Math.max(1e-4, aabbMax[0] - aabbMin[0]);
  const dy = Math.max(1e-4, aabbMax[1] - aabbMin[1]);
  const dz = Math.max(1e-4, aabbMax[2] - aabbMin[2]);
  const partVol = dx * dy * dz;

  const ox = Math.max(1e-4, overallMax[0] - overallMin[0]);
  const oy = Math.max(1e-4, overallMax[1] - overallMin[1]);
  const oz = Math.max(1e-4, overallMax[2] - overallMin[2]);
  const overallVol = ox * oy * oz;

  const centerY = 0.5 * (aabbMin[1] + aabbMax[1]);
  const normalizedHeight = (centerY - overallMin[1]) / oy;
  const minDim = Math.min(dx, dy, dz);
  const maxDim = Math.max(dx, dy, dz);

  if (partVol >= overallVol * 0.28) {
    return 'chassis-core';
  }
  if (normalizedHeight < 0.32 && Math.abs(dy - dz) / maxDim < 0.35) {
    return 'wheel-or-roller';
  }
  if (normalizedHeight > 0.68) {
    return 'turret-or-top';
  }
  if (minDim / maxDim < 0.22) {
    return 'panel-or-screen';
  }
  return 'vent-or-strut';
}

/**
 * Audits a single-mesh GLB buffer to detect whether it is a multi-part asset
 * suffering from cross-part triangle webbing and coplanar decimation waste.
 */
export function auditSingleMeshMultiPartAsset(
  assetId: string,
  positions: Float32Array,
  indices: Uint32Array | Uint16Array,
  options: PartSplitOptions = {},
): FusedMeshWebbingAudit {
  const seg = segmentMeshIntoDisjointParts(positions, indices, options);
  const totalTriangles = Math.floor(indices.length / 3);
  if (totalTriangles === 0) {
    return {
      assetId,
      totalTriangles: 0,
      detectedPartCount: 0,
      webbingBridgeTriangles: 0,
      concaveSeamEdges: 0,
      coplanarRedundantTriangles: 0,
      webbingSeverityScore: 0,
      needsPartSplitRetopo: false,
    };
  }

  const concaveCreaseRad = options.concaveCreaseRad ?? DEFAULT_CONCAVE_CREASE_RAD;
  const hardCreaseRad = options.hardCreaseRad ?? DEFAULT_HARD_CREASE_RAD;
  const webbingAspect = options.webbingAspectThreshold ?? DEFAULT_WEBBING_ASPECT;
  const coplanarDot = options.coplanarDotThreshold ?? DEFAULT_COPLANAR_DOT;
  const concaveCos = Math.cos(concaveCreaseRad);
  const hardCos = Math.cos(hardCreaseRad);

  const faces: FaceMetrics[] = [];
  const edgeToFaces = new Map<string, number[]>();

  for (let t = 0; t < totalTriangles; t++) {
    const i0 = indices[t * 3] ?? 0;
    const i1 = indices[t * 3 + 1] ?? 0;
    const i2 = indices[t * 3 + 2] ?? 0;
    faces.push(computeFaceMetrics(positions, i0, i1, i2));

    const k0 = vertexSpatialKey(positions, i0);
    const k1 = vertexSpatialKey(positions, i1);
    const k2 = vertexSpatialKey(positions, i2);
    const edges = [
      undirectedEdgeKey(k0, k1),
      undirectedEdgeKey(k1, k2),
      undirectedEdgeKey(k2, k0),
    ];
    for (const ek of edges) {
      const list = edgeToFaces.get(ek);
      if (list !== undefined) {
        list.push(t);
      } else {
        edgeToFaces.set(ek, [t]);
      }
    }
  }

  let concaveSeamEdges = 0;
  let coplanarRedundantTriangles = 0;
  let webbingBridgeTriangles = 0;

  for (const [, adj] of edgeToFaces) {
    if (adj.length >= 2) {
      let edgeHasSeam = false;
      let edgeHasCoplanar = false;
      for (let i = 0; i < adj.length; i++) {
        for (let j = i + 1; j < adj.length; j++) {
          const fA = faces[adj[i] ?? 0];
          const fB = faces[adj[j] ?? 0];
          if (fA !== undefined && fB !== undefined) {
            const seam = isConcaveOrSharpPartSeam(fA, fB, concaveCos, hardCos, adj.length);
            if (seam.isSeam) edgeHasSeam = true;
            const dot = fA.nx * fB.nx + fA.ny * fB.ny + fA.nz * fB.nz;
            if (dot >= coplanarDot) edgeHasCoplanar = true;
          }
        }
      }
      if (edgeHasSeam) concaveSeamEdges++;
      if (edgeHasCoplanar) coplanarRedundantTriangles++;
    }
  }

  for (let t = 0; t < totalTriangles; t++) {
    const f = faces[t];
    if (f !== undefined && f.aspectRatio >= webbingAspect) {
      webbingBridgeTriangles++;
    }
  }

  const partFactor = seg.length > 1 ? Math.min(1, (seg.length - 1) * 0.25) : 0;
  const seamFactor = Math.min(1, concaveSeamEdges / Math.max(1, totalTriangles * 0.35));
  const webFactor = Math.min(1, webbingBridgeTriangles / Math.max(1, totalTriangles * 0.15));
  const webbingSeverityScore = Number(
    Math.min(1, partFactor * 0.45 + seamFactor * 0.35 + webFactor * 0.2).toFixed(4),
  );

  return {
    assetId,
    totalTriangles,
    detectedPartCount: seg.length,
    webbingBridgeTriangles,
    concaveSeamEdges,
    coplanarRedundantTriangles,
    webbingSeverityScore,
    needsPartSplitRetopo: seg.length >= 2 && webbingSeverityScore >= 0.18,
  };
}

/**
 * Slices a fused single-mesh triangle buffer into disjoint functional sub-meshes
 * along concave valley creases and removes high-aspect-ratio webbing slivers.
 */
export function segmentMeshIntoDisjointParts(
  positions: Float32Array,
  indices: Uint32Array | Uint16Array,
  options: PartSplitOptions = {},
): readonly SegmentedMeshPart[] {
  const totalTriangles = Math.floor(indices.length / 3);
  if (totalTriangles === 0) {
    return [];
  }

  const concaveCreaseRad = options.concaveCreaseRad ?? DEFAULT_CONCAVE_CREASE_RAD;
  const hardCreaseRad = options.hardCreaseRad ?? DEFAULT_HARD_CREASE_RAD;
  const webbingAspect = options.webbingAspectThreshold ?? DEFAULT_WEBBING_ASPECT;
  const minPartTris = options.minPartTriangles ?? DEFAULT_MIN_PART_TRIS;
  const concaveCos = Math.cos(concaveCreaseRad);
  const hardCos = Math.cos(hardCreaseRad);

  const faces: FaceMetrics[] = [];
  const edgeToFaces = new Map<string, number[]>();
  const faceEdges: Array<readonly [string, string, string]> = [];

  let overallMinX = Infinity;
  let overallMinY = Infinity;
  let overallMinZ = Infinity;
  let overallMaxX = -Infinity;
  let overallMaxY = -Infinity;
  let overallMaxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const z = positions[i + 2] ?? 0;
    if (x < overallMinX) overallMinX = x;
    if (y < overallMinY) overallMinY = y;
    if (z < overallMinZ) overallMinZ = z;
    if (x > overallMaxX) overallMaxX = x;
    if (y > overallMaxY) overallMaxY = y;
    if (z > overallMaxZ) overallMaxZ = z;
  }

  for (let t = 0; t < totalTriangles; t++) {
    const i0 = indices[t * 3] ?? 0;
    const i1 = indices[t * 3 + 1] ?? 0;
    const i2 = indices[t * 3 + 2] ?? 0;
    faces.push(computeFaceMetrics(positions, i0, i1, i2));

    const k0 = vertexSpatialKey(positions, i0);
    const k1 = vertexSpatialKey(positions, i1);
    const k2 = vertexSpatialKey(positions, i2);
    const e0 = undirectedEdgeKey(k0, k1);
    const e1 = undirectedEdgeKey(k1, k2);
    const e2 = undirectedEdgeKey(k2, k0);
    faceEdges.push([e0, e1, e2]);

    for (const ek of [e0, e1, e2]) {
      const list = edgeToFaces.get(ek);
      if (list !== undefined) {
        list.push(t);
      } else {
        edgeToFaces.set(ek, [t]);
      }
    }
  }

  // Identify webbing bridge triangles that span across concave part boundaries
  // or exhibit extreme sliver aspect ratios (> webbingAspect) bridging tilted normals:
  const isWebbingTri = new Uint8Array(totalTriangles);
  for (let t = 0; t < totalTriangles; t++) {
    const f = faces[t];
    const fe = faceEdges[t];
    if (f === undefined || fe === undefined) continue;
    if (f.aspectRatio >= webbingAspect) {
      let seamTouchCount = 0;
      for (const ek of fe) {
        const adj = edgeToFaces.get(ek) ?? [];
        for (const other of adj) {
          if (other === t) continue;
          const fOther = faces[other];
          if (fOther !== undefined) {
            const seam = isConcaveOrSharpPartSeam(f, fOther, concaveCos, hardCos);
            if (seam.isSeam) seamTouchCount++;
          }
        }
      }
      const maxAxisNormal = Math.max(Math.abs(f.nx), Math.abs(f.ny), Math.abs(f.nz));
      const isTiltedBridgeSliver = f.aspectRatio >= webbingAspect * 1.25 && maxAxisNormal < 0.92;
      if (seamTouchCount >= 1 || isTiltedBridgeSliver) {
        isWebbingTri[t] = 1;
      }
    }
  }

  // Flood-fill connected components without crossing concave part seams or webbing triangles:
  const visited = new Uint8Array(totalTriangles);
  const rawClusters: number[][] = [];
  const clusterSeamCounts: number[] = [];

  for (let startTri = 0; startTri < totalTriangles; startTri++) {
    if (visited[startTri] === 1 || isWebbingTri[startTri] === 1) continue;
    visited[startTri] = 1;
    const queue: number[] = [startTri];
    const cluster: number[] = [];
    let seamEdges = 0;

    while (queue.length > 0) {
      const curr = queue.pop()!;
      cluster.push(curr);
      const fCurr = faces[curr];
      const fe = faceEdges[curr];
      if (fCurr === undefined || fe === undefined) continue;

      for (const ek of fe) {
        const adj = edgeToFaces.get(ek) ?? [];
        for (const next of adj) {
          if (next === curr || isWebbingTri[next] === 1) continue;
          const fNext = faces[next];
          if (fNext === undefined) continue;
          const seam = isConcaveOrSharpPartSeam(fCurr, fNext, concaveCos, hardCos, adj.length);
          if (seam.isSeam) {
            seamEdges++;
            continue;
          }
          if (visited[next] === 0) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }

    rawClusters.push(cluster);
    clusterSeamCounts.push(seamEdges);
  }

  // Merge tiny orphan fragments (< minPartTris) into the closest valid cluster by centroid distance:
  const majorClusters: Array<{ tris: number[]; seams: number }> = [];
  const minorClusters: Array<{ tris: number[]; seams: number }> = [];

  for (let c = 0; c < rawClusters.length; c++) {
    const tris = rawClusters[c] ?? [];
    const seams = clusterSeamCounts[c] ?? 0;
    if (tris.length >= minPartTris || rawClusters.length === 1) {
      majorClusters.push({ tris: [...tris], seams });
    } else {
      minorClusters.push({ tris: [...tris], seams });
    }
  }

  if (majorClusters.length === 0 && minorClusters.length > 0) {
    const mergedAll: number[] = [];
    let totalSeams = 0;
    for (const m of minorClusters) {
      mergedAll.push(...m.tris);
      totalSeams += m.seams;
    }
    majorClusters.push({ tris: mergedAll, seams: totalSeams });
  } else {
    for (const m of minorClusters) {
      const firstTri = m.tris[0] ?? 0;
      const fm = faces[firstTri];
      if (fm === undefined) continue;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let j = 0; j < majorClusters.length; j++) {
        const maj = majorClusters[j];
        const majTri = maj?.tris[0] ?? 0;
        const fMaj = faces[majTri];
        if (maj === undefined || fMaj === undefined) continue;
        const d = Math.hypot(fm.cx - fMaj.cx, fm.cy - fMaj.cy, fm.cz - fMaj.cz);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = j;
        }
      }
      const target = majorClusters[bestIdx];
      if (target !== undefined) {
        target.tris.push(...m.tris);
        target.seams += m.seams;
      }
    }
  }

  const overallMin: readonly [number, number, number] = [overallMinX, overallMinY, overallMinZ];
  const overallMax: readonly [number, number, number] = [overallMaxX, overallMaxY, overallMaxZ];

  const parts: SegmentedMeshPart[] = [];
  for (let pIdx = 0; pIdx < majorClusters.length; pIdx++) {
    const entry = majorClusters[pIdx];
    if (entry === undefined) continue;
    const part = buildUnweldedSegmentedPart(
      pIdx,
      entry.tris,
      entry.seams,
      positions,
      indices,
      faces,
      overallMin,
      overallMax,
      hardCos,
    );
    parts.push(part);
  }

  return parts;
}

function buildUnweldedSegmentedPart(
  partIndex: number,
  triIndices: readonly number[],
  isolatedSeamEdgeCount: number,
  srcPositions: Float32Array,
  srcIndices: Uint32Array | Uint16Array,
  faces: readonly FaceMetrics[],
  overallMin: readonly [number, number, number],
  overallMax: readonly [number, number, number],
  hardCos: number,
): SegmentedMeshPart {
  // Build crisp hard-surface vertices: vertices are shared within this part ONLY if
  // their spatial positions match AND their face normals are within hardCos (so 90-deg
  // box corners inside the part keep crisp split normals instead of smooth-shaded blobs).
  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outIndices = new Uint32Array(triIndices.length * 3);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  interface NormalBucket {
    readonly localIndex: number;
    readonly nx: number;
    readonly ny: number;
    readonly nz: number;
  }
  const spatialBuckets = new Map<string, NormalBucket[]>();

  for (let t = 0; t < triIndices.length; t++) {
    const triId = triIndices[t] ?? 0;
    const f = faces[triId] ?? { nx: 0, ny: 1, nz: 0, cx: 0, cy: 0, cz: 0, area: 0, aspectRatio: 1 };

    for (let c = 0; c < 3; c++) {
      const origV = srcIndices[triId * 3 + c] ?? 0;
      const vx = srcPositions[origV * 3] ?? 0;
      const vy = srcPositions[origV * 3 + 1] ?? 0;
      const vz = srcPositions[origV * 3 + 2] ?? 0;

      if (vx < minX) minX = vx;
      if (vy < minY) minY = vy;
      if (vz < minZ) minZ = vz;
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
      if (vz > maxZ) maxZ = vz;

      const sKey = vertexSpatialKey(srcPositions, origV);
      let buckets = spatialBuckets.get(sKey);
      if (buckets === undefined) {
        buckets = [];
        spatialBuckets.set(sKey, buckets);
      }

      let matchedLocal = -1;
      for (const b of buckets) {
        const dot = b.nx * f.nx + b.ny * f.ny + b.nz * f.nz;
        if (dot >= hardCos) {
          matchedLocal = b.localIndex;
          break;
        }
      }

      if (matchedLocal === -1) {
        matchedLocal = outPositions.length / 3;
        outPositions.push(vx, vy, vz);
        outNormals.push(f.nx, f.ny, f.nz);
        buckets.push({ localIndex: matchedLocal, nx: f.nx, ny: f.ny, nz: f.nz });
      }
      outIndices[t * 3 + c] = matchedLocal;
    }
  }

  const aabbMin: readonly [number, number, number] = [minX, minY, minZ];
  const aabbMax: readonly [number, number, number] = [maxX, maxY, maxZ];

  return {
    partIndex,
    role: classifyPartRole(aabbMin, aabbMax, overallMin, overallMax),
    positions: new Float32Array(outPositions),
    indices: outIndices,
    normals: new Float32Array(outNormals),
    triangleCount: triIndices.length,
    aabbMin,
    aabbMax,
    isolatedSeamEdgeCount,
  };
}

/**
 * Performs per-part planar hard-surface retopology on an isolated SegmentedMeshPart.
 * Collapses redundant coplanar interior triangles while locking all 90-degree crease edges
 * and part boundaries so separate parts never web together.
 */
export function retopologizePartPlanarHardSurface(
  part: SegmentedMeshPart,
  targetTriangles: number,
  options: PartSplitOptions = {},
): SegmentedMeshPart {
  if (part.triangleCount <= targetTriangles || targetTriangles < 2) {
    return part;
  }

  const coplanarDot = options.coplanarDotThreshold ?? DEFAULT_COPLANAR_DOT;
  const hardCreaseRad = options.hardCreaseRad ?? DEFAULT_HARD_CREASE_RAD;
  const hardCos = Math.cos(hardCreaseRad);

  // Score each triangle by geometric importance: triangles on the part's AABB hull or
  // with large surface area / distinct normal directions are prioritized; tiny coplanar
  // interior sliver triangles are pruned/merged first.
  const faces: FaceMetrics[] = [];
  for (let t = 0; t < part.triangleCount; t++) {
    const i0 = part.indices[t * 3] ?? 0;
    const i1 = part.indices[t * 3 + 1] ?? 0;
    const i2 = part.indices[t * 3 + 2] ?? 0;
    faces.push(computeFaceMetrics(part.positions, i0, i1, i2));
  }

  // Group coplanar faces into planar patches and perform boundary-locked fan retriangulation
  // on any planar patch with > 2 triangles:
  const edgeToFaces = new Map<string, number[]>();
  const triEdgeKeys: Array<readonly [string, string, string]> = [];
  for (let t = 0; t < part.triangleCount; t++) {
    const i0 = part.indices[t * 3] ?? 0;
    const i1 = part.indices[t * 3 + 1] ?? 0;
    const i2 = part.indices[t * 3 + 2] ?? 0;
    const k0 = vertexSpatialKey(part.positions, i0);
    const k1 = vertexSpatialKey(part.positions, i1);
    const k2 = vertexSpatialKey(part.positions, i2);
    const e0 = undirectedEdgeKey(k0, k1);
    const e1 = undirectedEdgeKey(k1, k2);
    const e2 = undirectedEdgeKey(k2, k0);
    triEdgeKeys.push([e0, e1, e2]);
    for (const ek of [e0, e1, e2]) {
      const list = edgeToFaces.get(ek);
      if (list !== undefined) list.push(t);
      else edgeToFaces.set(ek, [t]);
    }
  }

  const visited = new Uint8Array(part.triangleCount);
  const keptPositions: number[] = [];
  const keptNormals: number[] = [];
  const keptIndices: number[] = [];

  for (let t = 0; t < part.triangleCount; t++) {
    if (visited[t] === 1) continue;
    visited[t] = 1;
    const seedFace = faces[t];
    if (seedFace === undefined || seedFace.area < 1e-10) continue;

    // Collect connected coplanar patch:
    const patch: number[] = [];
    const queue: number[] = [t];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      patch.push(curr);
      const fe = triEdgeKeys[curr];
      if (fe === undefined) continue;
      for (const ek of fe) {
        const adj = edgeToFaces.get(ek) ?? [];
        for (const nxt of adj) {
          if (visited[nxt] === 1) continue;
          const fNxt = faces[nxt];
          if (fNxt === undefined) continue;
          const dot = seedFace.nx * fNxt.nx + seedFace.ny * fNxt.ny + seedFace.nz * fNxt.nz;
          if (dot >= coplanarDot) {
            visited[nxt] = 1;
            queue.push(nxt);
          }
        }
      }
    }

    if (patch.length >= 3 && part.triangleCount > targetTriangles) {
      // Collapse coplanar subdivided quad/polygon patch to its 2-triangle planar bounding quad
      // aligned to the patch's principal tangent axes:
      const simplifiedQuad = collapseCoplanarPatchToQuad(patch, part.positions, part.indices, seedFace);
      if (simplifiedQuad !== null) {
        const baseV = keptPositions.length / 3;
        for (let v = 0; v < 4; v++) {
          keptPositions.push(
            simplifiedQuad[v * 3] ?? 0,
            simplifiedQuad[v * 3 + 1] ?? 0,
            simplifiedQuad[v * 3 + 2] ?? 0,
          );
          keptNormals.push(seedFace.nx, seedFace.ny, seedFace.nz);
        }
        keptIndices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
        continue;
      }
    }

    // Otherwise keep original crisp triangles in the patch:
    for (const pTri of patch) {
      const baseV = keptPositions.length / 3;
      const f = faces[pTri] ?? seedFace;
      for (let c = 0; c < 3; c++) {
        const origV = part.indices[pTri * 3 + c] ?? 0;
        keptPositions.push(
          part.positions[origV * 3] ?? 0,
          part.positions[origV * 3 + 1] ?? 0,
          part.positions[origV * 3 + 2] ?? 0,
        );
        keptNormals.push(f.nx, f.ny, f.nz);
      }
      keptIndices.push(baseV, baseV + 1, baseV + 2);
    }
  }

  const newTriCount = Math.floor(keptIndices.length / 3);
  if (newTriCount === 0) {
    return part;
  }

  // Re-index with hard-normal sharing within this part:
  const finalTriIds: number[] = [];
  const finalFaces: FaceMetrics[] = [];
  const tempPos = new Float32Array(keptPositions);
  const tempIdx = new Uint32Array(keptIndices);
  for (let t = 0; t < newTriCount; t++) {
    finalTriIds.push(t);
    finalFaces.push(computeFaceMetrics(tempPos, t * 3, t * 3 + 1, t * 3 + 2));
  }

  return buildUnweldedSegmentedPart(
    part.partIndex,
    finalTriIds,
    part.isolatedSeamEdgeCount,
    tempPos,
    tempIdx,
    finalFaces,
    part.aabbMin,
    part.aabbMax,
    hardCos,
  );
}

function collapseCoplanarPatchToQuad(
  patchTris: readonly number[],
  positions: Float32Array,
  indices: Uint32Array,
  normal: FaceMetrics,
): Float32Array | null {
  // Build tangent basis (u, v) on the plane with normal (nx, ny, nz):
  const nx = normal.nx;
  const ny = normal.ny;
  const nz = normal.nz;
  const upX = Math.abs(ny) < 0.9 ? 0 : 1;
  const upY = Math.abs(ny) < 0.9 ? 1 : 0;
  const upZ = 0;

  let ux = upY * nz - upZ * ny;
  let uy = upZ * nx - upX * nz;
  let uz = upX * ny - upY * nx;
  const uLen = Math.hypot(ux, uy, uz);
  if (uLen < 1e-9) return null;
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let planeW = 0;
  let sampleCount = 0;

  for (const t of patchTris) {
    for (let c = 0; c < 3; c++) {
      const idx = indices[t * 3 + c] ?? 0;
      const px = positions[idx * 3] ?? 0;
      const py = positions[idx * 3 + 1] ?? 0;
      const pz = positions[idx * 3 + 2] ?? 0;
      const u = px * ux + py * uy + pz * uz;
      const v = px * vx + py * vy + pz * vz;
      const w = px * nx + py * ny + pz * nz;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      planeW += w;
      sampleCount++;
    }
  }

  if (sampleCount === 0 || maxU - minU < 1e-6 || maxV - minV < 1e-6) {
    return null;
  }
  const wAvg = planeW / sampleCount;

  // 4 corners in CCW order relative to normal (nx, ny, nz):
  const cornersUV: ReadonlyArray<readonly [number, number]> = [
    [minU, minV],
    [maxU, minV],
    [maxU, maxV],
    [minU, maxV],
  ];
  const out = new Float32Array(12);
  for (let i = 0; i < 4; i++) {
    const uv = cornersUV[i]!;
    out[i * 3] = uv[0] * ux + uv[1] * vx + wAvg * nx;
    out[i * 3 + 1] = uv[0] * uy + uv[1] * vy + wAvg * ny;
    out[i * 3 + 2] = uv[0] * uz + uv[1] * vz + wAvg * nz;
  }
  return out;
}

/**
 * Full pipeline: splits a fused single-mesh low-poly model into disjoint semantic parts,
 * removes cross-part triangle webbing, runs per-part planar hard-surface retopology, and
 * re-packs the parts into a single 1-draw-call buffer WITHOUT welding vertices across part seams.
 */
export function retopologizeFusedMultiPartMesh(
  positions: Float32Array,
  indices: Uint32Array | Uint16Array,
  targetTotalTriangles: number,
  options: PartSplitOptions = {},
): PartSplitRetopoResult {
  const inputTriangleCount = Math.floor(indices.length / 3);
  const rawParts = segmentMeshIntoDisjointParts(positions, indices, options);

  const rawNonWebTris = rawParts.reduce((acc, p) => acc + p.triangleCount, 0);
  const removedWebbingTriangles = Math.max(0, inputTriangleCount - rawNonWebTris);

  const retopoParts: SegmentedMeshPart[] = [];
  for (const part of rawParts) {
    const share = rawNonWebTris > 0 ? part.triangleCount / rawNonWebTris : 1;
    const partBudget = Math.max(2, Math.round(targetTotalTriangles * share));
    retopoParts.push(retopologizePartPlanarHardSurface(part, partBudget, options));
  }

  // Pack all retopologized parts into a single draw-call buffer while keeping
  // their vertex ranges completely disjoint across parts (zero cross-part vertex welding):
  let totalVerts = 0;
  let totalIndices = 0;
  for (const p of retopoParts) {
    totalVerts += p.positions.length / 3;
    totalIndices += p.indices.length;
  }

  const mergedPositions = new Float32Array(totalVerts * 3);
  const mergedNormals = new Float32Array(totalVerts * 3);
  const mergedIndices = new Uint32Array(totalIndices);

  let vertOffset = 0;
  let idxOffset = 0;
  for (const p of retopoParts) {
    mergedPositions.set(p.positions, vertOffset * 3);
    mergedNormals.set(p.normals, vertOffset * 3);
    for (let i = 0; i < p.indices.length; i++) {
      mergedIndices[idxOffset + i] = (p.indices[i] ?? 0) + vertOffset;
    }
    vertOffset += p.positions.length / 3;
    idxOffset += p.indices.length;
  }

  return {
    parts: retopoParts,
    mergedPositions,
    mergedIndices,
    mergedNormals,
    inputTriangleCount,
    outputTriangleCount: Math.floor(mergedIndices.length / 3),
    removedWebbingTriangles,
  };
}
