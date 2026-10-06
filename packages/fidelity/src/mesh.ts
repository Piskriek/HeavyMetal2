// How the ground is meshed as vertex density grows, and how neighbouring chunks agree on their shared edge.
import type { FidelityState, MeshMode, MeshPolicy, RenderBudget } from "./types";
import { CELL_LADDER } from "./types";
import { normalised, smoothstepC1 } from "./metrics";
import { contentHash } from "./hash";

/** Blocks below 8% vertex density, chamfered blocks up to 30%, then smooth dual contouring with relaxing. */
export function meshPolicyFor(s: FidelityState, b: RenderBudget): MeshPolicy {
  const n = normalised(s).vtx;
  const lod = Math.min(5, Math.round(n * 5));
  let mode: MeshMode, chamfer: number, relax: number;
  if (n < 0.08) { mode = "CUBIC"; chamfer = 0; relax = 0; }
  else if (n < 0.3) { mode = "CHAMFER"; chamfer = smoothstepC1((n - 0.08) / 0.22) * 0.5; relax = 0; }
  else { mode = "DUAL"; chamfer = 0.5; relax = Math.min(8, Math.floor((n - 0.3) * 11)); }
  return {
    lod, cellSize: CELL_LADDER[lod]!, mode, chamfer, relaxIterations: relax,
    smoothAngleDeg: 180 * (1 - Math.exp(-s.vtx / 50000)),
    qefClamp: 0.5 - 0.18 * smoothstepC1(n),
    stage: b.stage,
  };
}

const MODE_RANK: Readonly<Record<MeshMode, number>> = { CUBIC: 0, CHAMFER: 1, DUAL: 2 };

/** Every field in coarse-first order: lower level of detail, blockier mode, less chamfer, fewer relax steps, then the rest. */
function coarseness(p: MeshPolicy): number[] {
  return [p.lod, MODE_RANK[p.mode], p.chamfer, p.relaxIterations, p.smoothAngleDeg, p.qefClamp, p.stage];
}

/**
 * The coarser of two policies, by a total order over every field, so minPolicy(a, b) and minPolicy(b, a)
 * are the same policy and both neighbours build the same edge. (The Arena drop compared only the level of
 * detail and the mode, so two chunks with the same mode but different chamfer could each keep their own: cracks.)
 */
export function minPolicy(a: MeshPolicy, b: MeshPolicy): MeshPolicy {
  const ka = coarseness(a), kb = coarseness(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i]! < kb[i]!) return a;
    if (ka[i]! > kb[i]!) return b;
  }
  return a;
}

/** A key for the edge a chunk shares: the same policy, edge and origin give the same key. */
export function seamKeyFor(p: MeshPolicy, edge: "N" | "S" | "E" | "W", origin: readonly [number, number]): string {
  return contentHash([edge, p.cellSize, p.mode, +p.chamfer.toFixed(4), p.relaxIterations, +origin[0].toFixed(2), +origin[1].toFixed(2)]);
}

/** Whether two neighbouring chunks, each picking the shared policy from its own side, build the same edge. */
export function seamsAgree(
  a: MeshPolicy, b: MeshPolicy, origin: readonly [number, number],
  edgeA: "N" | "S" | "E" | "W", edgeB: "N" | "S" | "E" | "W",
): boolean {
  const fromA = minPolicy(a, b), fromB = minPolicy(b, a);
  return seamKeyFor(fromA, edgeA, origin) === seamKeyFor(fromB, edgeA, origin)
    && seamKeyFor(fromA, edgeB, origin) === seamKeyFor(fromB, edgeB, origin);
}
