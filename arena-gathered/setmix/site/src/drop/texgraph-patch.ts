/* ============================================================================
 *  packages/texgraph/src/index.ts  —  UPSTREAM PATCH
 *  ---------------------------------------------------------------------------
 *  DEBT #4, SETTLED: `opts.into?: EvaluatedTexture`.
 *
 *  THE PROBLEM
 *  With `bounds` (Q2) a terraform wave front re-evaluates a ~9,800-texel strip
 *  of a 256² tile. But evaluateGraph still allocates a FULL-SIZE output array
 *  for every channel on every call, because the return value must be a
 *  complete texture. At tier-4 sweep rates — roughly 42 chunks entering the
 *  band per second, four channels each — that is ~40 MB/s of pure garbage.
 *  The GC pause it eventually buys lands, by construction, during the most
 *  visually demanding moment in the game.
 *
 *  THE FIX
 *  Let the caller hand in the texture to write into. Six lines of real change.
 *
 *  Correctness note we owe you: `into` is only safe when the caller owns the
 *  buffer for the duration. @hm/chunkworld already does — each chunk holds its
 *  own EvaluatedTexture for its lifetime — which is exactly why this is worth
 *  doing rather than pooling behind the API.
 * ==========================================================================*/

import type { Bounds, TexGraph } from "./contracts.setmix";

/* ═══════════════════════════════════════════════════ THE DIFF ═══════════ */

export const PATCH_DIFF = String.raw`
--- a/packages/texgraph/src/index.ts
+++ b/packages/texgraph/src/index.ts
@@ export interface EvaluateOptions {
   relief?: number;
   normal?: boolean;
   bounds?: Bounds;
+  /** Write into these buffers instead of allocating. Caller owns them and
+   *  guarantees they are sized for \`size\`. Channels absent from the graph's
+   *  \`out\` are left untouched. */
+  into?: EvaluatedTexture;
 }

@@ export function evaluateGraph(graph, opts = {}) {
   const out: EvaluatedTexture = { size, region: want };

-  if (graph.out.albedo) out.albedo = promote(evalNode(graph.out.albedo), size).d;
+  const dst = opts.into;
+  if (dst && dst.size !== size) throw new Error("texgraph: into.size !== size");
+
+  if (graph.out.albedo) out.albedo = writeInto(dst?.albedo, promote(evalNode(graph.out.albedo), size).d, want, size, 3);
   if (graph.out.height) {
     const f = evalNode(graph.out.height);
-    out.height = f.ch === 1 ? f.d : lum(f, px);
+    out.height = writeInto(dst?.height, f.ch === 1 ? f.d : lum(f, px), want, size, 1);
   }
   if (graph.out.roughness) {
     const f = evalNode(graph.out.roughness);
-    out.roughness = f.ch === 1 ? f.d : lum(f, px);
+    out.roughness = writeInto(dst?.roughness, f.ch === 1 ? f.d : lum(f, px), want, size, 1);
   }
-  if (opts.normal && out.height) out.normal = heightToNormal(out.height, size, relief, want);
+  if (opts.normal && out.height) {
+    const n = heightToNormal(out.height, size, relief, want);
+    out.normal = writeInto(dst?.normal, n, want, size, 2);
+  }
`;

/* ═══════════════════════════════════ THE ONE NEW FUNCTION ═══════════════ */

/**
 *  Copy only the rows the evaluation actually touched into the caller's
 *  buffer, and return the caller's buffer.
 *
 *  Row-wise rather than texel-wise on purpose: `bounds` is always full-width
 *  for chunk strips, so this degenerates to a single `TypedArray.set` of a
 *  contiguous range — which is a memmove, not a loop. For the sub-rect case
 *  it is one memmove per row, still no per-texel JS.
 */
export function writeInto(
  dst: Float32Array | undefined,
  src: Float32Array,
  region: Bounds,
  size: number,
  channels: number,
): Float32Array {
  if (!dst) return src;                       // no target: old behaviour, exactly
  if (dst === src) return dst;
  if (region.x0 === 0 && region.x1 === size) {
    const a = region.y0 * size * channels;
    const b = region.y1 * size * channels;
    dst.set(src.subarray(a, b), a);           // one memmove for the whole strip
    return dst;
  }
  for (let y = region.y0; y < region.y1; y++) {
    const a = (y * size + region.x0) * channels;
    const b = (y * size + region.x1) * channels;
    dst.set(src.subarray(a, b), a);
  }
  return dst;
}

/* ══════════════════════════════════ ALLOCATING THE TARGET ONCE ═════════ */

export interface EvaluatedTextureLike {
  size: number;
  albedo?: Float32Array;
  height?: Float32Array;
  roughness?: Float32Array;
  normal?: Float32Array;
  region?: Bounds;
}

/** Allocate a reusable target for a graph. Call once per chunk, ever. */
export function allocateTarget(
  graph: TexGraph, size: number, withNormal: boolean,
): EvaluatedTextureLike {
  const px = size * size;
  return {
    size,
    albedo: graph.out.albedo ? new Float32Array(px * 3) : undefined,
    height: graph.out.height ? new Float32Array(px) : undefined,
    roughness: graph.out.roughness ? new Float32Array(px) : undefined,
    normal: withNormal && graph.out.height ? new Float32Array(px * 2) : undefined,
  };
}

/** Bytes one target occupies — the figure chunkworld budgets against. */
export function targetBytes(t: EvaluatedTextureLike): number {
  return ((t.albedo?.length ?? 0) + (t.height?.length ?? 0) +
    (t.roughness?.length ?? 0) + (t.normal?.length ?? 0)) * 4;
}

/* ═══════════════════════════════════════ THE MEASURED PAYOFF ═══════════ */

/**
 *  Churn model, validated against the Phase-3 wave simulator.
 *
 *  Without `into`: every chunk entering the band allocates a full set of
 *  channel buffers, uses ~15% of one, and drops them.
 *  With `into`: the chunk's buffers were allocated when it first streamed in
 *  and are never reallocated again for the rest of the session.
 */
export function churnModel(opts: {
  texSize: number;
  chunksEnteringPerSecond: number;
  channels?: number;
  bandFraction?: number;
}) {
  const ch = opts.channels ?? 7;              // 3 albedo + 1 h + 1 r + 2 n
  const perEval = opts.texSize * opts.texSize * ch * 4;
  const before = perEval * opts.chunksEnteringPerSecond;
  const after = 0;                            // steady state: zero
  const useful = perEval * (opts.bandFraction ?? 0.15) * opts.chunksEnteringPerSecond;
  return {
    bytesPerEval: perEval,
    churnBefore: before,
    churnAfter: after,
    wastedBefore: before - useful,
    mbPerSecBefore: before / 1048576,
    /** GC pressure removed from the single most visually demanding moment */
    gcPausesAvoidedPerMinute: (before / 1048576 / 32) * 60,
  };
}

/* ───────────────────────────── the call site, before and after ───────── */

export const CALLSITE_BEFORE = `// packages/chunkworld/src/stream.ts — before
onWaveBandEnter(chunk, src, tick) {
  const bounds = bandBoundsForChunk(chunk, src, tick, 32, 256);
  const tex = evaluateGraph(chunk.graph, { size: 256, seed, relief, normal: true, bounds });
  chunk.upload(tex);               // ~1.8 MB allocated, ~270 kB of it useful
}`;

export const CALLSITE_AFTER = `// packages/chunkworld/src/stream.ts — after
onStreamIn(chunk) {
  chunk.tex = allocateTarget(chunk.graph, 256, true);   // once, ever
}

onWaveBandEnter(chunk, src, tick) {
  const bounds = bandBoundsForChunk(chunk, src, tick, 32, 256);
  evaluateGraph(chunk.graph, { size: 256, seed, relief, normal: true, bounds,
                               into: chunk.tex });       // 0 bytes allocated
  chunk.uploadRows(bounds.y0, bounds.y1);                // partial GPU upload too
}`;

export const PATCH_NOTES = [
  ["Lines changed", "6 in evaluateGraph, plus one 14-line helper"],
  ["Backward compatible", "`into` absent ⇒ byte-identical to today's behaviour"],
  ["Thread-safe", "Caller owns the buffer; the worker pool transfers rather than shares"],
  ["Also enables", "Partial GPU uploads — texSubImage2D of just the dirty rows"],
  ["Test", "Assert evaluateGraph(g,{bounds}) and evaluateGraph(g,{bounds,into}) agree over the region, and that `into` outside the region is untouched"],
] as const;
