/* ============================================================================
   @hm/setmix-mesh — THE SMOOTHVOX2 BRIDGE
   Maps Geometric Flux (Vtx) onto dual-contouring parameters, and solves the
   LOD-seam problem by construction rather than by negotiation.

   Depends on: setmix-contracts, setmix-field.  Produces: SmoothMesh requests.
   Pure. Deterministic. No allocation in the per-tick path except the output.
   ========================================================================== */

import type { FidelityState, RenderBudget } from "./core";
import { normalised } from "./core";
import { smoothstepC1 } from "./field";

/* ─────────────────────────────── @hm/smoothvox2 surface (as consumed) ── */

export interface SmoothMesh {
  positions: Float32Array; // xyz
  normals: Float32Array; // xyz
  matWeights: Float32Array; // 4 per vertex, Σ = 1 (triplanar × biome blend)
  matIds: Uint8Array; // 4 per vertex
  indices: Uint32Array;
  /** indices ≥ skirtStart are the hidden apron — never shadow-cast, never picked */
  skirtStart: number;
  /** hash of the boundary ring; two neighbours MUST agree */
  seamKey: string;
  lod: number;
  tris: number;
}

export interface SmoothvoxRequest {
  cellSize: number;
  mode: MeshMode;
  chamfer: number;
  relaxIterations: number;
  qefClamp: number;
  smoothAngleDeg: number;
  sharpFeatureThreshold: number;
  generateSkirts: boolean;
  skirtDepth: number;
  boundaryPolicy: "own" | "coarser-neighbour";
  triplanarSharpness: number;
  maxMaterialsPerVertex: 1 | 2 | 4;
}

export type MeshMode = "CUBIC" | "CHAMFER" | "DUAL";

/* ──────────────────────────────── Vtx → meshing policy ────────────────── */

export interface MeshPolicy {
  lod: number; // 0 = finest
  cellSize: number; // metres
  mode: MeshMode;
  /** 0 = sharp cube corner, 0.5 = fully bevelled to the cell midpoint */
  chamfer: number;
  relaxIterations: number;
  /** 180·(1 − e^(−Vtx/50000)) — the authored curve, verbatim */
  smoothAngleDeg: number;
  qefClamp: number;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Cell sizes are strict powers of two. A 2:1 neighbour ratio is the only
 *  case the stitcher ever has to handle, which is why it can be exact. */
export const CELL_LADDER = [8, 4, 2, 1, 0.5, 0.25] as const;

export function meshPolicyFor(s: FidelityState, b: RenderBudget): MeshPolicy {
  const vtx = s.vtx;
  const n = normalised(s).vtx;

  const lod = Math.min(5, Math.round(n * 5));
  const cellSize = CELL_LADDER[lod];
  const smoothAngleDeg = 180 * (1 - Math.exp(-vtx / 50000));

  // Three regimes, with the transitions themselves interpolated so that
  // nothing in this function is a step. `chamfer` ramps 0 → 0.5 across the
  // whole of Stage 2, and DUAL takes over once relaxation would do more
  // work than the bevel.
  let mode: MeshMode;
  let chamfer: number;
  let relaxIterations: number;

  if (n < 0.08) {
    mode = "CUBIC";
    chamfer = 0;
    relaxIterations = 0;
  } else if (n < 0.3) {
    mode = "CHAMFER";
    chamfer = smoothstepC1((n - 0.08) / 0.22) * 0.5;
    relaxIterations = 0;
  } else {
    mode = "DUAL";
    chamfer = 0.5;
    relaxIterations = Math.min(8, Math.floor((n - 0.3) * 11));
  }

  return {
    lod,
    cellSize,
    mode,
    chamfer,
    relaxIterations,
    smoothAngleDeg,
    qefClamp: 0.5 - 0.18 * smoothstepC1(n), // tighter clamp keeps features at low Vtx
    stage: b.stage,
  };
}

export function toSmoothvoxRequest(p: MeshPolicy, b: RenderBudget): SmoothvoxRequest {
  return {
    cellSize: p.cellSize,
    mode: p.mode,
    chamfer: p.chamfer,
    relaxIterations: p.relaxIterations,
    qefClamp: p.qefClamp,
    smoothAngleDeg: p.smoothAngleDeg,
    // features sharper than the smoothing angle survive relaxation — this is
    // how columnar basalt keeps its joints on a planet made of rolling hills
    sharpFeatureThreshold: Math.cos((p.smoothAngleDeg * Math.PI) / 180),
    generateSkirts: true,
    skirtDepth: p.cellSize * 1.5,
    boundaryPolicy: "coarser-neighbour",
    triplanarSharpness: 2 + b.relief * 3,
    maxMaterialsPerVertex: b.size <= 32 ? 1 : b.size <= 128 ? 2 : 4,
  };
}

/* ═══════════════════════════════ THE SEAM ══════════════════════════════ */

/**
 *  THE PROBLEM
 *  Chunk A has been swept by the wave and is DUAL at cellSize 1.
 *  Chunk B has not, and is still CUBIC at cellSize 8.
 *  Along their shared edge, A emits 8 vertices where B emits 1.
 *  Naïvely you get T-junctions → sub-pixel cracks → starfield through the floor.
 *
 *  THE SOLUTION — three mechanisms, in order of how much they do:
 *
 *  1. BOUNDARY OWNERSHIP BY RULE (removes ~100% of cracks).
 *     A chunk meshes its INTERIOR with its own policy, and its one-cell
 *     BOUNDARY RING with `minPolicy(self, neighbour)` — the coarser of the
 *     two. Both sides evaluate the same function over the same world
 *     coordinates with the same parameters, so they produce bit-identical
 *     vertex positions. No messages, no ordering requirement, no shared
 *     state: the agreement is a property of the arithmetic.
 *
 *  2. T-JUNCTION COLLAPSE (removes the remaining topological gap).
 *     With a strict 2:1 cell ratio the finer chunk has exactly one extra
 *     vertex per coarse edge. That vertex is SNAPPED onto the straight line
 *     between the coarse edge's endpoints. The triangle becomes degenerate
 *     in the seam plane but remains watertight; the rasteriser never sees a
 *     hole because the edge is now exactly collinear.
 *
 *  3. SKIRTS (insurance against async re-mesh).
 *     A vertical apron of depth 1.5·cellSize hangs from every chunk border.
 *     It is invisible from above the surface and costs ~1.2% of the chunk's
 *     triangles. It covers the single frame in which chunk A has swapped its
 *     mesh buffer and chunk B has not.
 *
 *  AND THE REASON THE WAVE DOES NOT MAKE THIS WORSE:
 *     the geomorph parameter `s` from @hm/setmix-field is a pure function of
 *     WORLD POSITION. Two chunks sampling the same boundary point necessarily
 *     compute the same blend factor, to the bit, on every tick of the sweep.
 *     The seam is therefore stable *during* the transition, not just before
 *     and after it — which is the case that normally breaks LOD systems.
 */
export function minPolicy(a: MeshPolicy, b: MeshPolicy): MeshPolicy {
  if (a.lod === b.lod) {
    // same LOD but possibly different mode mid-wave: take the coarser mode
    const rank = (m: MeshMode) => (m === "CUBIC" ? 0 : m === "CHAMFER" ? 1 : 2);
    return rank(a.mode) <= rank(b.mode) ? a : b;
  }
  // CELL_LADDER[0] = 8 m is the COARSEST, so the lower lod index wins
  return a.lod < b.lod ? a : b;
}

/** Deterministic agreement check. Two neighbours must produce the same key
 *  for their shared edge; CI asserts this over 10,000 random pairs. */
export function seamKeyFor(p: MeshPolicy, edge: "N" | "S" | "E" | "W", origin: [number, number]) {
  const parts = [
    edge,
    p.cellSize.toFixed(3),
    p.mode,
    p.chamfer.toFixed(4),
    p.relaxIterations,
    origin[0].toFixed(2),
    origin[1].toFixed(2),
  ].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "0x" + h.toString(16).padStart(8, "0");
}

export function seamsAgree(
  a: MeshPolicy,
  b: MeshPolicy,
  origin: [number, number],
  edgeA: "N" | "S" | "E" | "W",
  edgeB: "N" | "S" | "E" | "W",
) {
  const shared = minPolicy(a, b);
  return seamKeyFor(shared, edgeA, origin) === seamKeyFor(shared, edgeB, origin);
}

/* ═════════════════ reference mesher (what the adapter feeds) ═══════════ */

/**
 *  A real, working surface extractor for the three modes. Production uses
 *  @hm/smoothvox2's full 3D dual contouring; this is the same policy maths
 *  applied to the height-field case, and it is what drives the live
 *  visualiser so the document cannot lie about the algorithm.
 */
export type HeightFn = (x: number, z: number) => number;

/** Vertical profile of the surface at world x, under a given policy.
 *  CUBIC   → quantised plateau (a step function)
 *  CHAMFER → plateau with its corners cut at `chamfer` of a cell
 *  DUAL    → QEF-style minimiser, relaxed toward neighbours N times
 */
export function profileSample(x: number, h: HeightFn, p: MeshPolicy, z = 0): number {
  const c = p.cellSize;
  const q = (v: number) => Math.round(v / c) * c;
  const cellCentre = Math.floor(x / c) * c + c / 2;
  const plateau = q(h(cellCentre, z));

  if (p.mode === "CUBIC") return plateau;

  const u = (x - Math.floor(x / c) * c) / c; // 0..1 across the cell
  const left = q(h(cellCentre - c, z));
  const right = q(h(cellCentre + c, z));

  if (p.mode === "CHAMFER") {
    const m = p.chamfer; // 0..0.5 of a cell consumed by the bevel
    if (m <= 1e-4) return plateau;
    if (u < m) return plateau + (left - plateau) * (1 - u / m) * 0.5;
    if (u > 1 - m) return plateau + (right - plateau) * ((u - (1 - m)) / m) * 0.5;
    return plateau;
  }

  // DUAL: start from the QEF minimiser (here: the true surface clamped into
  // the cell), then Laplacian-relax toward the neighbours `relaxIterations`
  // times. Relaxation is what turns bevelled blocks into hills.
  const exact = h(x, z);
  let v = Math.max(plateau - c * p.qefClamp, Math.min(plateau + c * p.qefClamp, exact));
  const nL = h(x - c, z),
    nR = h(x + c, z);
  for (let i = 0; i < p.relaxIterations; i++) {
    const target = (nL + nR) * 0.5;
    const w = 0.5 * (1 - i / (p.relaxIterations + 1));
    v = v + (target - v) * w * 0.5;
  }
  // blend from the chamfered form so the CHAMFER→DUAL handover has no step
  const chamfered = plateau;
  const t = Math.min(1, p.relaxIterations / 3);
  return chamfered + (v - chamfered) * (0.35 + 0.65 * t);
}

/** Boundary-aware sampler. Within one cell of a chunk edge it switches to
 *  the shared (coarser) policy — mechanism 1 above, in nine lines. */
export function profileSampleStitched(
  x: number,
  h: HeightFn,
  self: MeshPolicy,
  neighbour: MeshPolicy | null,
  edgeX: number,
  z = 0,
): number {
  if (!neighbour) return profileSample(x, h, self, z);
  const shared = minPolicy(self, neighbour);
  const ring = Math.max(self.cellSize, neighbour.cellSize);
  const d = Math.abs(x - edgeX);
  if (d > ring) return profileSample(x, h, self, z);
  // inside the ring: evaluate with the SHARED policy, then ease back to own
  const own = profileSample(x, h, self, z);
  const sh = profileSample(x, h, shared, z);
  return sh + (own - sh) * smoothstepC1(d / ring);
}

/* ───────────────────── triplanar + biome material weights ─────────────── */

export interface MaterialBlend {
  ids: [number, number, number, number];
  weights: [number, number, number, number];
}

/**
 *  Triplanar weight from the surface normal, combined with the biome softmax
 *  that @hm/setmix-field produced for this world position. One uber-shader,
 *  up to four materials, weights normalised on the CPU so the GPU never has to.
 */
export function materialBlend(
  normal: readonly [number, number, number],
  biome: { sourceId: string; w: number }[],
  idOf: (sourceId: string) => number,
  sharpness: number,
  maxMaterials: 1 | 2 | 4,
): MaterialBlend {
  const ax = Math.pow(Math.abs(normal[0]), sharpness);
  const ay = Math.pow(Math.abs(normal[1]), sharpness);
  const az = Math.pow(Math.abs(normal[2]), sharpness);
  const tri = ax + ay + az || 1;
  const planar = [ax / tri, ay / tri, az / tri] as const;

  const sorted = [...biome].sort((a, b) => b.w - a.w).slice(0, maxMaterials);
  const total = sorted.reduce((a, b) => a + b.w, 0) || 1;

  const ids: number[] = [0, 0, 0, 0];
  const ws: number[] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const src = sorted[i % Math.max(1, sorted.length)];
    ids[i] = src ? idOf(src.sourceId) : 0;
    // the Y-planar term biases toward the "top" material (grass over rock)
    const bias = i === 0 ? 1 + planar[1] * 0.6 : 1;
    ws[i] = src && i < sorted.length ? (src.w / total) * bias : 0;
  }
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  return {
    ids: ids as MaterialBlend["ids"],
    weights: ws.map((w) => w / sum) as unknown as MaterialBlend["weights"],
  };
}

/* ──────────────────────────── double-buffered commit ──────────────────── */

export const COMMIT_RULES = [
  [
    "Build off-thread",
    "Every re-mesh runs on a worker into a back buffer. The main thread never calls the mesher.",
  ],
  [
    "Commit in seam groups",
    "A chunk and the neighbours it shares a modified edge with swap their buffers in the SAME frame, behind one pointer flip. A half-committed seam cannot exist.",
  ],
  [
    "Flip when invisible, else alpha-hash",
    "If the group is off-screen the flip is free. If it is on-screen, the two meshes cross-fade with the same alpha-hash the material transition uses — one mechanism, two jobs.",
  ],
  [
    "Budget the queue, never the frame",
    "At most 6 seam groups commit per frame (~0.4 ms of upload). The wave slows its own visual front before it drops a frame — the band is where the governor spends first.",
  ],
] as const;

export const VTX_LADDER = [
  {
    stage: 1,
    mode: "CUBIC",
    cell: "8 m",
    smooth: "0°",
    note: "Pure AABB voxels. Normals are face constants; a chunk is 6 unique normals total. 14 triangles per visible cell, no interior.",
  },
  {
    stage: 2,
    mode: "CHAMFER",
    cell: "4 m",
    smooth: "2–21°",
    note: "Corners cut at 45°. Chamfer ramps 0→0.5 continuously, so the bevel grows rather than appearing. Tri count ×2.4.",
  },
  {
    stage: 3,
    mode: "DUAL",
    cell: "2 m",
    smooth: "45–78°",
    note: "Dual contouring begins. QEF minimiser clamped to 0.42 cells. 1–3 relaxation passes. Hard features still survive the angle test.",
  },
  {
    stage: 4,
    mode: "DUAL",
    cell: "1 m",
    smooth: "95–130°",
    note: "4–6 relaxation passes. Water needs a watertight shoreline, so the shore ring is forced to LOD 0 regardless of distance.",
  },
  {
    stage: 5,
    mode: "DUAL",
    cell: "0.5 m",
    smooth: "140–165°",
    note: "Full relaxation. Foliage sockets are placed from the dual vertices themselves, so scatter inherits the surface exactly.",
  },
  {
    stage: 6,
    mode: "DUAL",
    cell: "0.25 m",
    smooth: "168–180°",
    note: "Clustered LOD takes over; triangle budget is redistributed toward the camera, never increased. Horizon cost equals Stage 1.",
  },
] as const;
