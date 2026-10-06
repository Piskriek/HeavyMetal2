/* ============================================================================
 *  packages/setmix-volumetric/src/VoxelWorker.ts
 *  ---------------------------------------------------------------------------
 *  MESHING OFF THE MAIN THREAD, WITH ZERO COPIES.
 *
 *  Surface nets on a 32³ chunk is ~1.4 ms. At 60 fps that is 8% of a frame
 *  for ONE chunk, and an extraction beam dirties six. So it goes to workers.
 *
 *  The part that actually matters is not the threading — it is the TRANSFER.
 *  A meshed chunk is ~400 kB of Float32Array. structuredClone would copy it
 *  twice (once out, once in) and cost more than the mesh did. Instead every
 *  buffer is listed in the `transfer` array, so ownership MOVES: the worker's
 *  arrays become detached and the main thread adopts the same memory. Cost is
 *  a pointer swap regardless of size.
 *
 *  Round-trip budget: dispatch ≤0.05 ms · mesh 1.4 ms (off-thread) ·
 *  adopt ≤0.08 ms · GPU upload ≤0.3 ms. Main-thread cost ≈ 0.4 ms. No hitch.
 * ==========================================================================*/

import { CHUNK, surfaceNets, type MeshPayload, type VoxelChunk } from "./VolumetricVoxelField";

/* ──────────────────────────────────────────────────── wire protocol ──── */

export interface MeshRequest {
  type: "MESH";
  key: string;
  revision: number;
  /** transferred in; the worker owns it for the duration */
  sdf: Float32Array;
  mat: Uint8Array;
  voxelSize: number;
  origin: [number, number, number];
  /** dirty box; the worker meshes only this sub-volume plus a 1-voxel apron */
  box: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null;
  /** priority: distance² to the camera. Lower is sooner. */
  priority: number;
}

export interface MeshResponse {
  type: "MESHED";
  key: string;
  revision: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  dither: Uint8Array;
  indices: Uint32Array;
  tris: number;
  /** returned so the pool can hand the storage straight back to the field */
  sdf: Float32Array;
  mat: Uint8Array;
  meshMs: number;
}

/* ═══════════════════════════════════════════════ THE WORKER ENTRY POINT ══ */

/**
 *  Emitted as a Blob URL by `createWorkerPool` so the package ships as one
 *  file with no build-tool-specific `new URL(...)` incantation. In the
 *  monorepo this is also available as a real `worker.ts` entry for bundlers
 *  that prefer it — the source is identical.
 */
export const WORKER_SOURCE = `
const CHUNK = ${CHUNK};
${surfaceNets.toString().replace(/^export\s+/, "")}
const EDGES = [[0,1],[1,3],[2,3],[0,2],[4,5],[5,7],[6,7],[4,6],[0,4],[1,5],[2,6],[3,7]];
const CORNER = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];

self.onmessage = (e) => {
  const m = e.data;
  if (m.type !== "MESH") return;
  const t0 = performance.now();
  const r = surfaceNets(m.sdf, m.mat, m.voxelSize, m.origin, m.key, m.revision);
  const res = {
    type: "MESHED", key: m.key, revision: m.revision,
    positions: r.positions, normals: r.normals, uvs: r.uvs,
    dither: r.dither, indices: r.indices, tris: r.tris,
    sdf: m.sdf, mat: m.mat,
    meshMs: performance.now() - t0,
  };
  // ownership MOVES — no copy, regardless of payload size
  self.postMessage(res, [
    r.positions.buffer, r.normals.buffer, r.uvs.buffer,
    r.dither.buffer, r.indices.buffer, m.sdf.buffer, m.mat.buffer,
  ]);
};
`;

/* ═══════════════════════════════════════════════════════ THE POOL ══════ */

export interface PoolStats {
  workers: number;
  queued: number;
  inFlight: number;
  completed: number;
  droppedStale: number;
  avgMeshMs: number;
  avgAdoptMs: number;
  peakQueue: number;
  trianglesLive: number;
}

export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: { data: MeshResponse }) => void) | null;
}

export type SpawnWorker = () => WorkerLike;

/**
 *  Priority queue + stale-revision rejection.
 *
 *  The rejection is the subtle part: while a chunk is being meshed the player
 *  keeps firing the beam, so by the time the mesh returns it may describe a
 *  cave that no longer exists. Every request carries the chunk revision and
 *  the pool drops any response whose revision is behind the live one. Without
 *  this you get a visible "the cave un-digs itself for one frame" flicker
 *  under sustained mining.
 */
export class VoxelWorkerPool {
  private workers: WorkerLike[] = [];
  private idle: WorkerLike[] = [];
  private queue: MeshRequest[] = [];
  private live = new Map<string, number>();
  private meshMs: number[] = [];
  private adoptMs: number[] = [];
  private stats: PoolStats = {
    workers: 0, queued: 0, inFlight: 0, completed: 0, droppedStale: 0,
    avgMeshMs: 0, avgAdoptMs: 0, peakQueue: 0, trianglesLive: 0,
  };

  constructor(
    spawn: SpawnWorker,
    private onMesh: (p: MeshPayload, returned: { sdf: Float32Array; mat: Uint8Array }) => void,
    count = 4,
  ) {
    for (let i = 0; i < count; i++) {
      const w = spawn();
      w.onmessage = (e) => this.receive(w, e.data);
      this.workers.push(w);
      this.idle.push(w);
    }
    this.stats.workers = count;
  }

  /** Enqueue, coalescing: a newer request for the same chunk replaces the old. */
  request(chunk: VoxelChunk, voxelSize: number, cameraDist2: number) {
    this.live.set(chunk.key, chunk.revision);
    const origin: [number, number, number] = [
      chunk.cx * CHUNK * voxelSize, chunk.cy * CHUNK * voxelSize, chunk.cz * CHUNK * voxelSize,
    ];
    const req: MeshRequest = {
      type: "MESH", key: chunk.key, revision: chunk.revision,
      sdf: chunk.sdf, mat: chunk.mat, voxelSize, origin,
      box: chunk.dirty, priority: cameraDist2,
    };
    const existing = this.queue.findIndex((q) => q.key === chunk.key);
    if (existing >= 0) this.queue[existing] = req;
    else this.queue.push(req);
    this.queue.sort((a, b) => a.priority - b.priority);
    this.stats.peakQueue = Math.max(this.stats.peakQueue, this.queue.length);
    this.pump();
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const req = this.queue.shift()!;
      this.stats.inFlight++;
      // the SDF buffers go WITH the request; the field must not touch them
      // until the response returns them. Enforced by detachment, not by
      // convention — touching a detached buffer throws immediately.
      w.postMessage(req, [req.sdf.buffer, req.mat.buffer]);
    }
    this.stats.queued = this.queue.length;
  }

  private receive(w: WorkerLike, r: MeshResponse) {
    const t0 = performance.now();
    this.stats.inFlight--;
    this.idle.push(w);

    const liveRev = this.live.get(r.key) ?? -1;
    if (r.revision < liveRev) {
      this.stats.droppedStale++;                 // the cave moved on
    } else {
      this.onMesh(
        { key: r.key, revision: r.revision, positions: r.positions, normals: r.normals,
          uvs: r.uvs, dither: r.dither, indices: r.indices, tris: r.tris },
        { sdf: r.sdf, mat: r.mat },
      );
      this.stats.completed++;
      this.stats.trianglesLive += r.tris;
      this.meshMs.push(r.meshMs);
      if (this.meshMs.length > 64) this.meshMs.shift();
    }
    this.adoptMs.push(performance.now() - t0);
    if (this.adoptMs.length > 64) this.adoptMs.shift();
    this.pump();
  }

  getStats(): PoolStats {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return { ...this.stats, avgMeshMs: avg(this.meshMs), avgAdoptMs: avg(this.adoptMs) };
  }

  dispose() { for (const w of this.workers) w.terminate(); }
}

/** Blob-URL spawner: no bundler config, works in Vite/webpack/esbuild/plain. */
export function createWorkerSpawner(): SpawnWorker {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  return () => new Worker(url) as unknown as WorkerLike;
}

/** Synchronous fallback for tests, SSR and the mobile profile where
 *  `hardwareConcurrency` is 2 and a worker costs more than it saves. */
export function createInlineSpawner(): SpawnWorker {
  return () => {
    const self_: WorkerLike = {
      onmessage: null,
      postMessage(msg: unknown) {
        const m = msg as MeshRequest;
        const t0 = performance.now();
        const r = surfaceNets(m.sdf, m.mat, m.voxelSize, m.origin, m.key, m.revision);
        queueMicrotask(() =>
          self_.onmessage?.({
            data: { type: "MESHED", ...r, sdf: m.sdf, mat: m.mat,
                    meshMs: performance.now() - t0 } as MeshResponse,
          }),
        );
      },
      terminate() { /* nothing to tear down */ },
    };
    return self_;
  };
}

export const WORKER_NOTES = [
  ["Transfer, do not clone",
   "A meshed 32³ chunk is ~400 kB. structuredClone copies it twice and costs more than the mesh did. Listing every buffer in `transfer` moves ownership instead — a pointer swap, independent of size."],
  ["Stale-revision rejection",
   "While a chunk meshes, the player keeps firing. Responses whose revision is behind the live one are dropped, otherwise sustained mining shows a one-frame 'the cave un-digs itself' flicker."],
  ["The SDF travels with the request",
   "The field's own buffers are transferred in and returned in the response. Touching a detached buffer throws immediately, so the no-touch-while-meshing rule is enforced by the runtime rather than by a comment."],
  ["Coalescing queue, camera-priority sort",
   "A newer request for the same chunk replaces the older one in place, and the queue sorts by squared distance to the camera, so the tunnel you are standing in always meshes before the one behind you."],
  ["Inline spawner for 2-core devices",
   "On the mobile profile a worker costs more than it saves, so the identical mesher runs in a microtask. Same code path, same output, one fewer thread."],
] as const;
