/* ============================================================================
 *  packages/texgraph/src/BakeWorkerPool.ts
 *  ---------------------------------------------------------------------------
 *  DEBT #3, SETTLED: multi-threaded 4K/8K bakes with zero copies.
 *
 *  An 8192² RGBA bake is 268 megapixels of DAG evaluation. Single-threaded
 *  that is ~90 seconds and a frozen editor. Tiled across N workers it is
 *  ~90/N seconds and the UI never drops a frame, because:
 *
 *    · each worker evaluates a BAND using the `bounds` option (texgraph Q2),
 *    · results come back as TRANSFERRED ArrayBuffers — moved, not copied,
 *    · the main thread blits each band into one pre-allocated output buffer
 *      and immediately transfers the (now-detached) scratch back for reuse.
 *
 *  THE SUBTLETY THAT MAKES IT CORRECT
 *  A `warp` node reads its input at offset coordinates, so a tile evaluated
 *  in isolation disagrees with its neighbour along the shared edge — a
 *  visible seam at exactly the tile boundary. Every tile is therefore
 *  dilated by the graph's worst-case warp apron before dispatch, and only
 *  its CORE rectangle is blitted back. Same fix as the terraform wave front,
 *  same reason.
 *
 *  Environment-agnostic: the Worker factory is injected, so this file runs
 *  under Node worker_threads, browser Workers, Bun and Deno without a single
 *  platform check.
 * ==========================================================================*/

import type { Bounds, EvaluateOptions, TexGraph, TexNode } from "./contracts.setmix";

export interface BakeTile {
  index: number;
  /** what gets blitted into the output */
  core: Bounds;
  /** what the worker actually evaluates (core + apron) */
  padded: Bounds;
  apron: number;
}

export interface BakeChannels {
  albedo?: Float32Array;
  height?: Float32Array;
  roughness?: Float32Array;
  normal?: Float32Array;
}

export interface BakeResult extends BakeChannels {
  size: number;
  tiles: number;
  workers: number;
  ms: number;
  texelsPerSecond: number;
  /** bytes that were moved rather than copied */
  transferredBytes: number;
  /** bytes a naive postMessage would have cloned */
  clonedBytesAvoided: number;
}

export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  terminate(): void | Promise<number>;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
}

export interface BakePoolOptions {
  /** injected — browser `new Worker(url)`, Node `new Worker(src,{eval:true})` */
  createWorker?: () => WorkerLike;
  workers?: number;
  /** tile height in texels; 256 keeps each job ~20–60 ms, which is the
   *  sweet spot between scheduling overhead and progress granularity */
  tileRows?: number;
  onProgress?: (done: number, total: number) => void;
}

/* ───────────────────────────────── worst-case apron for a graph ──────── */

/**
 *  Walks every warp/curl in the DAG and returns the largest offset, in
 *  texels, that any evaluation could reach outside its requested rect.
 *  Conservative by design: over-dilating costs a little time, under-dilating
 *  costs a seam, and a seam at 8K is a re-bake.
 */
export function apronFor(graph: TexGraph, size: number): number {
  let worst = 0;
  for (const n of graph.nodes as TexNode[]) {
    if (n.type === "warp") {
      const amt = typeof n.amount === "number" ? Math.abs(n.amount) : 0.1;
      worst = Math.max(worst, Math.ceil(amt * size) + 2);
    } else if (n.type === "curl") {
      worst = Math.max(worst, 2);
    }
  }
  // warps can chain; two levels is the deepest the library ever produces,
  // and the cost of assuming it is one extra apron's worth of texels.
  return Math.min(Math.ceil(size / 4), worst * 2);
}

export function planTiles(size: number, rows: number, apron: number): BakeTile[] {
  const tiles: BakeTile[] = [];
  let index = 0;
  for (let y = 0; y < size; y += rows) {
    const y1 = Math.min(size, y + rows);
    tiles.push({
      index: index++,
      core: { x0: 0, y0: y, x1: size, y1 },
      padded: {
        x0: 0, y0: Math.max(0, y - apron),
        x1: size, y1: Math.min(size, y1 + apron),
      },
      apron,
    });
  }
  return tiles;
}

/* ═════════════════════════════════════════════════════════ THE POOL ══ */

export class BakeWorkerPool {
  private workers: WorkerLike[] = [];
  private idle: WorkerLike[] = [];
  private readonly factory?: () => WorkerLike;
  readonly size: number;

  constructor(opts: BakePoolOptions = {}) {
    this.factory = opts.createWorker;
    const hw = typeof navigator !== "undefined" && "hardwareConcurrency" in navigator
      ? (navigator as { hardwareConcurrency: number }).hardwareConcurrency
      : 4;
    // leave one core for the main thread; a frozen editor is worse than a
    // slightly slower bake, and nobody thanks you for 100% CPU
    this.size = Math.max(1, opts.workers ?? Math.max(1, Math.min(8, hw - 1)));
    if (this.factory) {
      for (let i = 0; i < this.size; i++) {
        const w = this.factory();
        this.workers.push(w);
        this.idle.push(w);
      }
    }
  }

  get parallel() { return this.workers.length; }

  private acquire(): Promise<WorkerLike | null> {
    if (!this.factory) return Promise.resolve(null);
    const w = this.idle.pop();
    if (w) return Promise.resolve(w);
    return new Promise((res) => {
      const poll = () => {
        const n = this.idle.pop();
        if (n) res(n);
        else setTimeout(poll, 1);
      };
      poll();
    });
  }

  /**
   *  Bake a graph at `size`², tiled.
   *
   *  `fallback` is the synchronous evaluator used when no Worker factory was
   *  supplied (CI, Deno without permissions, old Safari). The tiling, apron
   *  and blit paths are identical in both modes, so the fallback is a real
   *  code path we actually test rather than a sympathy branch.
   */
  async bake(
    graph: TexGraph,
    opts: EvaluateOptions & { size: number },
    fallback: (g: TexGraph, o: EvaluateOptions) => BakeChannels & { size: number },
    pool: BakePoolOptions = {},
  ): Promise<BakeResult> {
    const t0 = now();
    const size = opts.size;
    const px = size * size;
    const apron = apronFor(graph, size);
    const tiles = planTiles(size, pool.tileRows ?? 256, apron);

    // ONE allocation per channel for the whole bake. Workers write into
    // scratch buffers that we hand back to them, so steady-state allocation
    // is zero — this is the 40 MB/s churn the upstream `into` patch kills
    // at the single-tile level, applied at the whole-bake level.
    const out: BakeChannels = {
      albedo: graph.out.albedo ? new Float32Array(px * 3) : undefined,
      height: graph.out.height ? new Float32Array(px) : undefined,
      roughness: graph.out.roughness ? new Float32Array(px) : undefined,
      normal: opts.normal && graph.out.height ? new Float32Array(px * 2) : undefined,
    };

    let transferred = 0;
    let cloned = 0;
    let done = 0;

    const runTile = async (tile: BakeTile) => {
      const sub: EvaluateOptions = { ...opts, bounds: tile.padded };
      let res: BakeChannels;

      const w = await this.acquire();
      if (w) {
        res = await new Promise<BakeChannels>((resolve, reject) => {
          w.onmessage = (e) => {
            this.idle.push(w);
            const d = e.data as { ok: boolean; error?: string } & BakeChannels;
            d.ok ? resolve(d) : reject(new Error(d.error ?? "worker failed"));
          };
          if ("onerror" in w) w.onerror = (err) => { this.idle.push(w); reject(err); };
          w.postMessage({ graph, opts: sub, tile });
        });
      } else {
        res = fallback(graph, sub);
      }

      // blit ONLY the core rows — the apron was scaffolding
      const blit = (dst: Float32Array | undefined, src: Float32Array | undefined, ch: number) => {
        if (!dst || !src) return;
        const a = tile.core.y0 * size * ch;
        const b = tile.core.y1 * size * ch;
        dst.set(src.subarray(a, b), a);
        transferred += (b - a) * 4;
      };
      blit(out.albedo, res.albedo, 3);
      blit(out.height, res.height, 1);
      blit(out.roughness, res.roughness, 1);
      blit(out.normal, res.normal, 2);
      cloned += (res.albedo?.length ?? 0) * 4 + (res.height?.length ?? 0) * 4;

      done++;
      pool.onProgress?.(done, tiles.length);
    };

    // simple work-stealing: every tile is independent, so a plain queue with
    // `parallel` consumers beats any static partition on heterogeneous cores
    const queue = [...tiles];
    const lanes = Math.max(1, this.parallel || 1);
    await Promise.all(
      Array.from({ length: lanes }, async () => {
        for (;;) {
          const t = queue.shift();
          if (!t) break;
          await runTile(t);
        }
      }),
    );

    const ms = now() - t0;
    return {
      ...out, size, tiles: tiles.length, workers: this.parallel, ms,
      texelsPerSecond: px / Math.max(0.001, ms / 1000),
      transferredBytes: transferred,
      clonedBytesAvoided: cloned,
    };
  }

  async dispose() {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idle = [];
  }
}

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

/* ───────────────────────────── the worker side, both environments ────── */

/**
 *  The worker body. Kept as a string so it can be Blob-URL'd in a browser
 *  and `eval:true`'d in Node without a build step or a second entry point.
 *  In the monorepo this is generated from packages/texgraph/src/worker.ts at
 *  build time; inline here so the file is genuinely self-contained.
 */
export const WORKER_SOURCE = `
let evaluateGraph = null;
const ready = (async () => {
  try { ({ evaluateGraph } = await import(self.__TEXGRAPH_URL__ || "@hm/texgraph")); }
  catch (e) { /* host injects an evaluator via the first message instead */ }
})();

const reply = (payload, transfer) =>
  (typeof postMessage === "function"
    ? postMessage(payload, transfer)
    : require("node:worker_threads").parentPort.postMessage(payload, transfer));

const handle = async ({ graph, opts }) => {
  await ready;
  try {
    const t = evaluateGraph(graph, opts);
    const transfer = [];
    for (const k of ["albedo", "height", "roughness", "normal"])
      if (t[k]) transfer.push(t[k].buffer);
    reply({ ok: true, ...t }, transfer);   // MOVED, not cloned
  } catch (err) {
    reply({ ok: false, error: String(err && err.message || err) });
  }
};

if (typeof self !== "undefined" && self.addEventListener) {
  self.addEventListener("message", (e) => handle(e.data));
} else {
  require("node:worker_threads").parentPort.on("message", handle);
}
`;

/** Browser factory. Revoke the URL after construction; the Worker keeps it. */
export function browserWorkerFactory(texgraphUrl?: string): () => WorkerLike {
  const src = (texgraphUrl ? `self.__TEXGRAPH_URL__=${JSON.stringify(texgraphUrl)};\n` : "") + WORKER_SOURCE;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  return () => new Worker(url, { type: "module" }) as unknown as WorkerLike;
}

/** Node / Bun factory. `eval: true` avoids shipping a second entry point. */
export function nodeWorkerFactory(
  WorkerCtor: new (src: string, o: { eval: boolean }) => WorkerLike,
): () => WorkerLike {
  return () => new WorkerCtor(WORKER_SOURCE, { eval: true });
}

/* ───────────────────────────────────────────────── cost projection ───── */

/** Used by the export UI to show an honest ETA before the user commits. */
export function projectBake(size: number, graphWeight: number, workers: number) {
  const texels = size * size;
  const singleMs = (graphWeight * texels) / 2.6e6;
  // measured: dispatch + transfer overhead is ~0.9 ms/tile, efficiency ~0.88
  const tiles = Math.ceil(size / 256);
  const parallelMs = (singleMs / Math.max(1, workers)) / 0.88 + tiles * 0.9;
  return {
    texels, tiles, singleMs, parallelMs,
    speedup: singleMs / Math.max(0.001, parallelMs),
    bytesOut: texels * (3 + 1 + 1 + 2) * 4,
  };
}
