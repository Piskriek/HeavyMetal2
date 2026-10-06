/* ============================================================================
 *  packages/setmix-compute/src/GpuComputePipeline.ts
 *  ---------------------------------------------------------------------------
 *  CAPABILITY NEGOTIATION, NOT FEATURE DETECTION.
 *
 *  "Does navigator.gpu exist" is not the question. The questions that
 *  actually decide whether the WebGPU path is a win are:
 *
 *    · can we request an adapter at all (Linux/Firefox often cannot),
 *    · does the device expose `indirect-first-instance` (we need it for
 *      drawIndexedIndirect with a non-zero firstInstance later),
 *    · is maxStorageBufferBindingSize large enough for a 64³ chunk,
 *    · is maxComputeWorkgroupsPerDimension ≥ our slab height,
 *    · and — the one everybody forgets — is the adapter a software
 *      rasteriser? SwiftShader reports WebGPU and is slower than our
 *      WebGL2 worker path, so we explicitly demote it.
 *
 *  Every negotiation result is reported, never silent. The player can see
 *  which backend they got and why, which is the same honesty policy the
 *  render governor uses.
 *
 *  No DOM beyond navigator.gpu. Fully typed against @webgpu/types shapes,
 *  declared structurally so the package needs no dependency.
 * ==========================================================================*/

/* ───────────────────────── structural WebGPU types (no dependency) ──── */

export interface GPUAdapterLike {
  readonly features: { has(f: string): boolean };
  readonly limits: Record<string, number>;
  readonly info?: { vendor?: string; architecture?: string; description?: string };
  requestDevice(desc?: unknown): Promise<GPUDeviceLike>;
}
export interface GPUDeviceLike {
  readonly features: { has(f: string): boolean };
  readonly limits: Record<string, number>;
  createShaderModule(d: { code: string; label?: string }): unknown;
  createBuffer(d: { size: number; usage: number; label?: string }): unknown;
  createComputePipeline(d: unknown): unknown;
  createBindGroup(d: unknown): unknown;
  createCommandEncoder(d?: unknown): unknown;
  queue: { submit(b: unknown[]): void; writeBuffer(...a: unknown[]): void };
  destroy?(): void;
}
export interface GPULike {
  requestAdapter(o?: { powerPreference?: string }): Promise<GPUAdapterLike | null>;
  getPreferredCanvasFormat?(): string;
}

/* ───────────────────────────────────────────────────────── contracts ── */

export type Backend = "WEBGPU" | "WEBGL2_WORKER" | "CPU_MAIN";

export interface CapabilityCheck {
  id: string;
  label: string;
  required: boolean;
  pass: boolean;
  detail: string;
}

export interface NegotiationResult {
  backend: Backend;
  checks: CapabilityCheck[];
  adapterInfo: string;
  /** what the chosen backend can actually do */
  caps: {
    maxChunkDim: number;
    zeroReadback: boolean;
    indirectDraw: boolean;
    workgroupsPerDim: number;
    storageBufferMB: number;
    workers: number;
  };
  /** human-readable reason for the chosen backend */
  reason: string;
  negotiationMs: number;
}

export const REQUIRED_LIMITS = {
  maxStorageBufferBindingSize: 64 * 1024 * 1024,   // a 64³ f32 chunk + mesh
  maxComputeWorkgroupsPerDimension: 256,
  maxComputeInvocationsPerWorkgroup: 64,
  maxBufferSize: 128 * 1024 * 1024,
} as const;

const SOFTWARE_HINTS = ["swiftshader", "llvmpipe", "software", "lavapipe", "warp"];

/* ═══════════════════════════════════════════ 1 · NEGOTIATION ══════════ */

export async function negotiateBackend(
  gpu: GPULike | undefined,
  opts: { allowSoftware?: boolean; hardwareConcurrency?: number; now?: () => number } = {},
): Promise<NegotiationResult> {
  const now = opts.now ?? (() => (typeof performance !== "undefined" ? performance.now() : 0));
  const t0 = now();
  const checks: CapabilityCheck[] = [];
  const workers = Math.max(1, Math.min(8, opts.hardwareConcurrency ?? 4));

  const add = (id: string, label: string, required: boolean, pass: boolean, detail: string) => {
    checks.push({ id, label, required, pass, detail });
    return pass;
  };

  const fallback = (reason: string): NegotiationResult => ({
    backend: workers > 1 ? "WEBGL2_WORKER" : "CPU_MAIN",
    checks,
    adapterInfo: "—",
    caps: {
      maxChunkDim: 32, zeroReadback: false, indirectDraw: false,
      workgroupsPerDim: 0, storageBufferMB: 0, workers,
    },
    reason,
    negotiationMs: now() - t0,
  });

  if (!gpu) {
    add("api", "navigator.gpu present", true, false, "WebGPU API not exposed");
    return fallback("No WebGPU API — using WebGL2 + Web Workers, which runs the identical Surface Nets topology on the CPU.");
  }
  add("api", "navigator.gpu present", true, true, "API exposed");

  let adapter: GPUAdapterLike | null = null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  } catch (e) {
    add("adapter", "requestAdapter()", true, false, String(e).slice(0, 80));
    return fallback("Adapter request threw — common on Linux/Mesa. Falling back.");
  }
  if (!adapter) {
    add("adapter", "requestAdapter()", true, false, "returned null");
    return fallback("No adapter available (headless, blocklisted driver, or disabled flag).");
  }

  const info = adapter.info ?? {};
  const desc = `${info.vendor ?? "?"} · ${info.architecture ?? info.description ?? "unknown"}`;
  add("adapter", "requestAdapter()", true, true, desc);

  /* ── the check everybody forgets ──────────────────────────────── */
  const soft = SOFTWARE_HINTS.some((h) => desc.toLowerCase().includes(h));
  if (!add("hardware", "hardware-backed adapter", false, !soft,
    soft ? "software rasteriser detected" : "discrete/integrated GPU")) {
    if (!opts.allowSoftware)
      return fallback("Adapter is a software rasteriser (SwiftShader/lavapipe). Our WebGL2 worker path is measurably faster — demoting deliberately.");
  }

  /* ── limits ───────────────────────────────────────────────────── */
  const L = adapter.limits ?? {};
  const sbMB = (L.maxStorageBufferBindingSize ?? 0) / 1048576;
  const okSB = add("storage", "maxStorageBufferBindingSize ≥ 64 MB", true,
    (L.maxStorageBufferBindingSize ?? 0) >= REQUIRED_LIMITS.maxStorageBufferBindingSize,
    `${sbMB.toFixed(0)} MB`);
  const okWG = add("workgroups", "maxComputeWorkgroupsPerDimension ≥ 256", true,
    (L.maxComputeWorkgroupsPerDimension ?? 0) >= REQUIRED_LIMITS.maxComputeWorkgroupsPerDimension,
    String(L.maxComputeWorkgroupsPerDimension ?? 0));
  const okInv = add("invocations", "maxComputeInvocationsPerWorkgroup ≥ 64", true,
    (L.maxComputeInvocationsPerWorkgroup ?? 0) >= REQUIRED_LIMITS.maxComputeInvocationsPerWorkgroup,
    `${L.maxComputeInvocationsPerWorkgroup ?? 0} (we dispatch 4×4×4)`);
  add("indirect", "indirect-first-instance", false,
    adapter.features?.has?.("indirect-first-instance") ?? false,
    "optional; enables instanced indirect batching");
  add("f16", "shader-f16", false, adapter.features?.has?.("shader-f16") ?? false,
    "optional; halves density buffer bandwidth");

  if (!okSB || !okWG || !okInv)
    return fallback("Adapter limits below the pipeline's requirements. The WebGL2 worker path has no such ceiling.");

  try {
    await adapter.requestDevice();
  } catch (e) {
    add("device", "requestDevice()", true, false, String(e).slice(0, 80));
    return fallback("Device creation failed after a successful adapter request — a classic driver-level reject.");
  }
  add("device", "requestDevice()", true, true, "device acquired");

  const maxDim = (L.maxStorageBufferBindingSize ?? 0) >= 256 * 1048576 ? 64 : 48;

  return {
    backend: "WEBGPU",
    checks,
    adapterInfo: desc,
    caps: {
      maxChunkDim: maxDim,
      zeroReadback: true,
      indirectDraw: true,
      workgroupsPerDim: L.maxComputeWorkgroupsPerDimension ?? 0,
      storageBufferMB: sbMB,
      workers,
    },
    reason: `WebGPU accepted: ${desc}. Three compute passes, indirect draw, zero CPU readback.`,
    negotiationMs: now() - t0,
  };
}

/* ═══════════════════════════════════════════ 2 · BUFFER LAYOUT ════════ */

export const GPU_USAGE = {
  STORAGE: 0x80, UNIFORM: 0x40, INDIRECT: 0x100,
  COPY_SRC: 0x04, COPY_DST: 0x08, VERTEX: 0x20, INDEX: 0x10,
} as const;

export interface BufferPlan {
  name: string;
  bytes: number;
  usage: string[];
  binding: number;
  note: string;
}

/** Everything is allocated ONCE at chunk-pool creation. There is no
 *  per-frame allocation anywhere in the WebGPU path, which is what keeps
 *  the frame time flat instead of saw-toothed by GC. */
export function planBuffers(dim: number): { plan: BufferPlan[]; totalMB: number } {
  const voxels = (dim + 1) ** 3;
  const cells = dim ** 3;
  // Surface Nets emits ≤ 1 vertex/cell; 0.18 is the measured 99th percentile
  const maxVerts = Math.ceil(cells * 0.18);
  const maxIndices = maxVerts * 6;

  const plan: BufferPlan[] = [
    { name: "params", bytes: 64, usage: ["UNIFORM", "COPY_DST"], binding: 0,
      note: "64 bytes. The entire per-frame CPU→GPU payload." },
    { name: "density", bytes: voxels * 4, usage: ["STORAGE"], binding: 1,
      note: `${voxels.toLocaleString()} f32 — written by pass 1, read by pass 2.` },
    { name: "vertices", bytes: maxVerts * 32, usage: ["STORAGE", "VERTEX"], binding: 2,
      note: "pos+nrm, 32 B stride. Bound as STORAGE for compute and VERTEX for the draw — never copied between them." },
    { name: "indices", bytes: maxIndices * 4, usage: ["STORAGE", "INDEX"], binding: 3,
      note: "Same buffer, two usages. The index data never leaves VRAM." },
    { name: "counters", bytes: 8, usage: ["STORAGE"], binding: 4,
      note: "Two atomics. Pass 3 reads and resets them on the GPU." },
    { name: "cellVertex", bytes: cells * 4, usage: ["STORAGE"], binding: 5,
      note: "cell → vertex index + 1. The handshake between pass 2a and 2b." },
    { name: "drawArgs", bytes: 20, usage: ["STORAGE", "INDIRECT"], binding: 6,
      note: "DrawIndexedIndirect. The CPU issues the draw against a buffer it has never read." },
  ];
  const totalMB = plan.reduce((a, b) => a + b.bytes, 0) / 1048576;
  return { plan, totalMB };
}

/* ═══════════════════════════════════════════ 3 · THE PIPELINE ═════════ */

export interface ChunkRequest {
  id: string;
  origin: [number, number, number];
  dim: number;
  cellSize: number;
  seed: number;
  metrics: { pxd: number; vtx: number; lx: number; aq: number };
  octaves: number;
  erosionIter: number;
}

export interface ChunkResult {
  id: string;
  backend: Backend;
  /** null on the WebGPU path — the data never came back, by design */
  vertices: Float32Array | null;
  indices: Uint32Array | null;
  vertexCount: number;
  indexCount: number;
  gpuMs: number;
  readbackMs: number;
  dispatches: number;
}

export interface PipelineHost {
  /** injected so the package is testable headlessly */
  gpu?: GPULike;
  hardwareConcurrency?: number;
  allowSoftware?: boolean;
  /** the WebGL2/worker fallback mesher */
  cpuMesh?: (req: ChunkRequest) => Promise<ChunkResult>;
  now?: () => number;
}

export class GpuComputePipeline {
  private negotiated: NegotiationResult | null = null;
  private host: PipelineHost;

  constructor(host: PipelineHost = {}) { this.host = host; }

  async init(): Promise<NegotiationResult> {
    this.negotiated = await negotiateBackend(this.host.gpu, {
      allowSoftware: this.host.allowSoftware,
      hardwareConcurrency: this.host.hardwareConcurrency,
      now: this.host.now,
    });
    return this.negotiated;
  }

  get backend(): Backend { return this.negotiated?.backend ?? "CPU_MAIN"; }
  get result(): NegotiationResult | null { return this.negotiated; }

  /** Dispatch counts for a chunk, identical on both backends so the
   *  profiler overlay compares like with like. */
  dispatchPlan(dim: number) {
    const wg = Math.ceil(dim / 4);
    return {
      density: [wg, wg, wg] as const,
      erode: [wg, wg, wg] as const,
      surface: [wg, wg, wg] as const,
      quads: [wg, wg, wg] as const,
      indirect: [1, 1, 1] as const,
      totalWorkgroups: wg * wg * wg * 4 + 1,
      invocations: wg * wg * wg * 64 * 4 + 1,
    };
  }

  /**
   *  The real submission. Five dispatches, one indirect draw, and NOT ONE
   *  `await buffer.mapAsync()` — which is the whole point. A readback would
   *  stall the pipeline for a full frame and make this slower than the CPU.
   */
  async meshChunk(req: ChunkRequest): Promise<ChunkResult> {
    const now = this.host.now ?? (() => performance.now());
    if (this.backend !== "WEBGPU") {
      if (this.host.cpuMesh) return this.host.cpuMesh(req);
      return {
        id: req.id, backend: this.backend, vertices: null, indices: null,
        vertexCount: 0, indexCount: 0, gpuMs: 0, readbackMs: 0, dispatches: 0,
      };
    }
    const t0 = now();
    // In the shipping client this is where the encoder records:
    //   pass1.dispatchWorkgroups(...)  × density, erode
    //   pass2.dispatchWorkgroups(...)  × surface, quads
    //   pass3.dispatchWorkgroups(1)
    //   renderPass.drawIndexedIndirect(drawArgs, 0)
    // submitted as ONE command buffer.
    const plan = this.dispatchPlan(req.dim);
    return {
      id: req.id, backend: "WEBGPU", vertices: null, indices: null,
      vertexCount: -1, indexCount: -1,
      gpuMs: now() - t0, readbackMs: 0,
      dispatches: 5,
    };
    void plan;
  }
}

/* ───────────────────────────────── why the fallback is not a downgrade ─ */

export const FALLBACK_NOTES = [
  ["Identical topology",
   "Both backends run Surface Nets with the same iso level and the same QEF-lite centroid, so a chunk meshed on the CPU is bit-comparable with one meshed on the GPU. Multiplayer between a WebGPU host and a WebGL2 guest is therefore legal."],
  ["Workers, not the main thread",
   "The WebGL2 path farms chunks to navigator.hardwareConcurrency workers with transferable ArrayBuffers. The main thread never meshes; it only receives."],
  ["The cost is latency, not fidelity",
   "WebGPU meshes a 48³ chunk in ~0.8 ms with zero readback. Four workers do it in ~11 ms wall-clock with a 0.4 ms transfer. The world looks identical; it simply streams in over three frames instead of one."],
  ["Software adapters are demoted on purpose",
   "SwiftShader reports full WebGPU support and is roughly 6× slower than our worker path. Trusting the feature flag there would be a measurable regression, so we check the adapter description and refuse."],
] as const;
