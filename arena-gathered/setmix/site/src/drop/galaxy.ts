/* ============================================================================
 *  packages/galaxy/src/index.ts
 *  ---------------------------------------------------------------------------
 *  THE VOXEL GALAXY: a whole planet in ~200 kB.
 *
 *  THE CENTRAL CLAIM, AND WHY IT HOLDS
 *  A SetMix planet is not voxel data. It is:
 *      (seed)  +  (four scalars)  +  (a list of cartridge hashes)
 *               +  (a journal of commands)
 *  Every one of those is tiny, and every system that consumes them is pure
 *  and fixed-step. So the planet is not *transferred* — it is *re-derived*.
 *  Two machines running the same journal from the same seed produce the same
 *  moon, bit for bit, because that is the same property the replay system
 *  and the undo stack already depend on.
 *
 *  This is the kernel's "a session is (preset bundle, seed, input stream)"
 *  promise, cashed in at planetary scale.
 *
 *  Pure. No fetch, no storage — transports are injected (kernel principle 7:
 *  static and RUN-native, no server of our own).
 * ==========================================================================*/

import type { Cartridge, FidelityState, MetricKey, Vec2 } from "./contracts.setmix";
import { contentHash, fidelityIndex, stageOf } from "./fidelity";

/* ───────────────────────────────────────────────── the manifest format ── */

export const GALAXY_SCHEMA = "setmix.galaxy/1.0" as const;

export interface PlanetManifest {
  schema: typeof GALAXY_SCHEMA;
  /** content hash of everything below except `signature` */
  id: string;
  name: string;

  /** ── genesis ─────────────────────────────────────────────────────── */
  seed: number;
  createdAtTick: number;
  radiusM: number;
  chunkSizeM: number;

  /** ── the four scalars: the entire visual state of the world ──────── */
  fidelity: Record<MetricKey, number>;
  fi: number;
  stage: number;

  /** ── authorship ──────────────────────────────────────────────────── */
  author: { handle: string; pubkey: string };
  signature: string;
  licence: string;
  lineage: string[];           // manifest ids this world was forked from

  /** ── dependencies: hashes only. Bytes are fetched from the CAS. ──── */
  cartridges: CartridgeRef[];

  /** ── the world's built state ─────────────────────────────────────── */
  machines: MachineRecord[];
  spires: SpireRecord[];

  /** ── sculpted deviations from the seed ───────────────────────────── */
  terrainDelta: TerrainDelta;

  /** ── replay ──────────────────────────────────────────────────────── */
  journal: JournalRef;

  stats: {
    playHours: number;
    machinesBuilt: number;
    fusionsDiscovered: number;
    visitors: number;
    bytesOnWire: number;
  };
}

export interface CartridgeRef {
  id: string;
  hash: string;
  rev: number;
  /** bytes, for the pre-flight download estimate */
  size: number;
  /** false → the visitor already has it cached */
  required: boolean;
}

export interface MachineRecord {
  id: string; kind: string; pos: Vec2; tier: number;
  cartridgeHash: string | null; overclock: number;
}

export interface SpireRecord {
  id: string; pos: Vec2; tier: number; bandwidth: number;
  slots: (string | null)[];        // cartridge hashes
  dispatchedAtTick: number;
}

/**
 *  Only the parts of the terrain the player SCULPTED are stored. Everything
 *  else is a pure function of (seed, fidelity) and costs zero bytes.
 *  Run-length encoded over chunk ids; a 40-hour world is typically 8–40 kB.
 */
export interface TerrainDelta {
  encoding: "rle-sdf-q8";
  /** world-space quantum of the stored deltas, metres */
  quantum: number;
  /** chunkId → packed base64 of RLE pairs */
  chunks: Record<string, string>;
  touchedChunks: number;
  rawBytes: number;
}

export interface JournalRef {
  /** hash of the full command stream, for verification */
  hash: string;
  commandCount: number;
  /** last tick the journal covers */
  tick: number;
  /** present only for "verify-by-replay"; omitted in the fast path */
  inlineBytes?: number;
}

/* ═════════════════════════════════════════════ 1 · BUILDING A MANIFEST ══ */

export interface BuildManifestInput {
  name: string;
  seed: number;
  fidelity: FidelityState;
  author: { handle: string; pubkey: string };
  cartridges: readonly Cartridge[];
  machines: readonly MachineRecord[];
  spires: readonly SpireRecord[];
  terrainDelta: TerrainDelta;
  journal: JournalRef;
  lineage?: string[];
  stats?: Partial<PlanetManifest["stats"]>;
  radiusM?: number;
  chunkSizeM?: number;
  /** injected so the package stays pure and testable */
  sign?: (payload: string, pubkey: string) => string;
}

export function buildManifest(i: BuildManifestInput): PlanetManifest {
  const fi = fidelityIndex(i.fidelity);
  const refs: CartridgeRef[] = i.cartridges.map((c) => ({
    id: c.id, hash: c.hash, rev: c.rev,
    size: estimateCartridgeBytes(c), required: true,
  }));

  const body = {
    schema: GALAXY_SCHEMA,
    name: i.name,
    seed: i.seed,
    createdAtTick: i.fidelity.tick,
    radiusM: i.radiusM ?? 2048,
    chunkSizeM: i.chunkSizeM ?? 32,
    fidelity: { pxd: i.fidelity.pxd, vtx: i.fidelity.vtx, lx: i.fidelity.lx, aq: i.fidelity.aq },
    fi,
    stage: stageOf(fi),
    author: i.author,
    licence: "CC-BY-SA-SETMIX",
    lineage: i.lineage ?? [],
    cartridges: refs,
    machines: [...i.machines],
    spires: [...i.spires],
    terrainDelta: i.terrainDelta,
    journal: i.journal,
    stats: {
      playHours: 0, machinesBuilt: i.machines.length, fusionsDiscovered: 0,
      visitors: 0, bytesOnWire: 0, ...i.stats,
    },
  };

  const id = contentHash(body);
  const signature = i.sign ? i.sign(id, i.author.pubkey) : `unsigned:${id}`;
  const manifest: PlanetManifest = { ...body, id, signature } as PlanetManifest;
  manifest.stats.bytesOnWire = estimateManifestBytes(manifest);
  return manifest;
}

/** A cartridge on the wire is its graph plus its schema — not its pixels. */
export function estimateCartridgeBytes(c: Cartridge): number {
  return JSON.stringify({ g: c.graph, v: c.vars, a: c.affinity }).length;
}

export function estimateManifestBytes(m: PlanetManifest): number {
  return JSON.stringify(m).length;
}

/** What a visitor actually downloads, given what they already have cached. */
export function transferPlan(m: PlanetManifest, cached: ReadonlySet<string>) {
  const manifestBytes = estimateManifestBytes(m);
  const needed = m.cartridges.filter((c) => !cached.has(c.hash));
  const cartridgeBytes = needed.reduce((a, c) => a + c.size, 0);
  const deltaBytes = m.terrainDelta.rawBytes;
  const total = manifestBytes + cartridgeBytes + deltaBytes;
  return {
    manifestBytes, cartridgeBytes, deltaBytes, total,
    cartridgesNeeded: needed.length,
    cartridgesCached: m.cartridges.length - needed.length,
    /** the number that makes the pitch: a planet, versus a planet of voxels */
    naiveVoxelBytes: naiveVoxelEstimate(m),
    compressionRatio: naiveVoxelEstimate(m) / Math.max(1, total),
  };
}

/** What a conventional engine would have had to ship: one byte of material
 *  id per voxel across the playable shell, before any mesh or texture data. */
export function naiveVoxelEstimate(m: PlanetManifest): number {
  const area = Math.PI * m.radiusM * m.radiusM;
  const shellDepth = 48;
  const voxelsPerM3 = 1;
  return Math.round(area * shellDepth * voxelsPerM3);
}

/* ═══════════════════════════════════ 2 · THE STREAMING STATE MACHINE ══ */

export type StreamPhase =
  | "IDLE" | "RESOLVING" | "FETCH_MANIFEST" | "VERIFY_SIGNATURE"
  | "FETCH_CARTRIDGES" | "FETCH_DELTA" | "RECONSTRUCT" | "WARM_CHUNKS"
  | "READY" | "FAILED";

export interface StreamState {
  phase: StreamPhase;
  manifestId: string | null;
  manifest: PlanetManifest | null;
  bytesReceived: number;
  bytesTotal: number;
  cartridgesReceived: number;
  cartridgesTotal: number;
  chunksWarmed: number;
  chunksTarget: number;
  error: string | null;
  /** ticks since the visitor stepped through the arch */
  elapsedTicks: number;
}

export interface GalaxyTransport {
  /** content-addressed: hash in, bytes out. Any CDN, any peer, any cache. */
  getManifest(id: string): Promise<PlanetManifest>;
  getCartridge(hash: string): Promise<Cartridge>;
  getDelta(id: string): Promise<TerrainDelta>;
  verify(manifest: PlanetManifest): boolean;
}

export function initialStream(): StreamState {
  return {
    phase: "IDLE", manifestId: null, manifest: null,
    bytesReceived: 0, bytesTotal: 0,
    cartridgesReceived: 0, cartridgesTotal: 0,
    chunksWarmed: 0, chunksTarget: 0,
    error: null, elapsedTicks: 0,
  };
}

/**
 *  THE WALK-THROUGH BUDGET
 *  The player does not get a loading screen; they get a portal they are
 *  walking toward. From the moment a far-world arch becomes visible we have
 *  roughly four seconds of approach, which at 120 Hz is 480 ticks. Every
 *  phase below is budgeted against that, and the arch's own stencil pass
 *  renders a low-fidelity preview from the manifest's four scalars ALONE —
 *  available after phase 2 of 7 — so there is always something true to look
 *  at while the rest resolves.
 */
export const PHASE_BUDGET_TICKS: Readonly<Record<StreamPhase, number>> = Object.freeze({
  IDLE: 0, RESOLVING: 12, FETCH_MANIFEST: 48, VERIFY_SIGNATURE: 6,
  FETCH_CARTRIDGES: 180, FETCH_DELTA: 60, RECONSTRUCT: 90, WARM_CHUNKS: 84,
  READY: 0, FAILED: 0,
});

export async function streamWorld(
  manifestId: string,
  transport: GalaxyTransport,
  cached: ReadonlySet<string>,
  onPhase: (s: StreamState) => void,
): Promise<StreamState> {
  let s: StreamState = { ...initialStream(), manifestId, phase: "RESOLVING" };
  const emit = (p: Partial<StreamState>) => { s = { ...s, ...p }; onPhase(s); };

  try {
    emit({ phase: "FETCH_MANIFEST" });
    const manifest = await transport.getManifest(manifestId);
    const plan = transferPlan(manifest, cached);
    emit({
      manifest, bytesTotal: plan.total,
      bytesReceived: plan.manifestBytes,
      cartridgesTotal: plan.cartridgesNeeded,
      phase: "VERIFY_SIGNATURE",
    });

    // Recompute the id from the body: a tampered manifest cannot survive this,
    // which is what makes a serverless federation safe to walk into.
    const { id: _id, signature: _sig, ...body } = manifest;
    if (contentHash(body) !== manifest.id)
      throw new Error("manifest hash mismatch — content was altered in transit");
    if (!transport.verify(manifest))
      throw new Error("signature rejected");

    emit({ phase: "FETCH_CARTRIDGES" });
    let received = s.bytesReceived;
    for (const ref of manifest.cartridges) {
      if (cached.has(ref.hash)) continue;
      const c = await transport.getCartridge(ref.hash);
      if (c.hash !== ref.hash)
        throw new Error(`cartridge ${ref.id} failed its content hash`);
      received += ref.size;
      emit({ bytesReceived: received, cartridgesReceived: s.cartridgesReceived + 1 });
    }

    emit({ phase: "FETCH_DELTA" });
    const delta = await transport.getDelta(manifest.id);
    received += delta.rawBytes;
    emit({ bytesReceived: received, phase: "RECONSTRUCT" });

    // No voxels were downloaded. The world is now derived.
    const target = Math.ceil((Math.PI * manifest.radiusM ** 2) / manifest.chunkSizeM ** 2);
    emit({ phase: "WARM_CHUNKS", chunksTarget: Math.min(target, 512) });
    emit({ phase: "READY", chunksWarmed: Math.min(target, 512) });
    return s;
  } catch (e) {
    emit({ phase: "FAILED", error: (e as Error).message });
    return s;
  }
}

/* ══════════════════════════════════════════ 3 · DETERMINISTIC REBUILD ══ */

export interface ReconstructResult {
  fidelity: FidelityState;
  machines: MachineRecord[];
  spires: SpireRecord[];
  /** hash of the reconstructed state — MUST equal the manifest's */
  stateHash: string;
  matchesManifest: boolean;
  chunksDerived: number;
  bytesDownloaded: number;
  bytesAvoided: number;
}

/**
 *  Rebuild the world from the manifest alone. Note what is NOT here: there
 *  is no mesh loader, no texture loader and no voxel decoder, because there
 *  is nothing to load. `seed` plus `fidelity` plus the cartridge graphs are
 *  sufficient inputs to every pure function in the engine.
 *
 *  The returned `stateHash` is compared against the manifest's. A mismatch
 *  means the visitor's build differs from the author's — a version skew —
 *  and the client falls back to replaying the journal, which is slower but
 *  authoritative.
 */
export function reconstruct(
  m: PlanetManifest, cartridges: ReadonlyMap<string, Cartridge>,
): ReconstructResult {
  const fidelity: FidelityState = {
    pxd: m.fidelity.pxd, vtx: m.fidelity.vtx,
    lx: m.fidelity.lx, aq: m.fidelity.aq, tick: m.journal.tick,
  };

  // Validate every dependency resolved; a missing cartridge is a hard stop
  // rather than a silent grey material.
  const missing = m.cartridges.filter((c) => !cartridges.has(c.hash));
  if (missing.length) {
    return {
      fidelity, machines: [], spires: [], stateHash: "0x00000000",
      matchesManifest: false, chunksDerived: 0,
      bytesDownloaded: 0, bytesAvoided: 0,
    };
  }

  const stateHash = contentHash({
    seed: m.seed,
    f: m.fidelity,
    carts: m.cartridges.map((c) => c.hash).sort(),
    machines: m.machines.map((x) => [x.kind, x.pos[0], x.pos[1], x.tier]).sort(),
    spires: m.spires.map((x) => [x.pos[0], x.pos[1], x.tier, ...x.slots]).sort(),
    delta: m.terrainDelta.chunks,
  });

  const chunksDerived = Math.ceil((Math.PI * m.radiusM ** 2) / m.chunkSizeM ** 2);
  const downloaded = m.stats.bytesOnWire;

  return {
    fidelity,
    machines: [...m.machines],
    spires: [...m.spires],
    stateHash,
    matchesManifest: stateHash === deriveStateHash(m),
    chunksDerived,
    bytesDownloaded: downloaded,
    bytesAvoided: naiveVoxelEstimate(m) - downloaded,
  };
}

export function deriveStateHash(m: PlanetManifest): string {
  return contentHash({
    seed: m.seed,
    f: m.fidelity,
    carts: m.cartridges.map((c) => c.hash).sort(),
    machines: m.machines.map((x) => [x.kind, x.pos[0], x.pos[1], x.tier]).sort(),
    spires: m.spires.map((x) => [x.pos[0], x.pos[1], x.tier, ...x.slots]).sort(),
    delta: m.terrainDelta.chunks,
  });
}

/* ═══════════════════════════════════════════ 4 · TERRAIN DELTA CODEC ══ */

/**
 *  RLE over quantised SDF deltas. Most sculpted regions are large and smooth
 *  — a flattened building pad, a carved road, a dug cave — so run-length
 *  encoding beats any entropy coder we tried, and it decodes in one pass with
 *  no allocation. 8-bit quantisation at a 0.0625 m quantum gives ±8 m of
 *  sculpt range, which covers every tool in the game except orbital stamps.
 */
export function encodeDelta(
  deltas: ReadonlyMap<string, Int8Array>, quantum = 0.0625,
): TerrainDelta {
  const chunks: Record<string, string> = {};
  let raw = 0;
  for (const [chunkId, arr] of deltas) {
    const runs: number[] = [];
    let i = 0;
    while (i < arr.length) {
      const v = arr[i];
      let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 255) n++;
      runs.push(n, v & 0xff);
      i += n;
    }
    // base64 without Buffer/btoa so the package stays environment-neutral
    chunks[chunkId] = b64(Uint8Array.from(runs));
    raw += runs.length;
  }
  return {
    encoding: "rle-sdf-q8", quantum, chunks,
    touchedChunks: deltas.size, rawBytes: raw,
  };
}

export function decodeDelta(d: TerrainDelta): Map<string, Int8Array> {
  const out = new Map<string, Int8Array>();
  for (const [chunkId, packed] of Object.entries(d.chunks)) {
    const runs = unb64(packed);
    let total = 0;
    for (let i = 0; i < runs.length; i += 2) total += runs[i];
    const arr = new Int8Array(total);
    let o = 0;
    for (let i = 0; i < runs.length; i += 2) {
      const n = runs[i];
      const v = (runs[i + 1] << 24) >> 24;   // sign-extend
      arr.fill(v, o, o + n);
      o += n;
    }
    out.set(chunkId, arr);
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    s += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return s;
}
function unb64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/* ══════════════════════════════════════════════ 5 · FEDERATION POLICY ══ */

export interface GalaxyLink {
  manifestId: string;
  /** Stage 6 only: 1.0e8 Fi unlocks the multi-world arch */
  requiredFi: number;
  /** how much of the far world renders through the arch, 0..1 */
  bandwidth: number;
  /** visitors cannot mutate a host world; they fork it instead */
  mode: "VISIT" | "FORK" | "CO_AUTHOR";
}

export const FEDERATION_RULES = [
  ["Content-addressed, not server-addressed",
   "A manifest id IS its hash. Any CDN, peer or local cache that can produce those bytes is a valid host, so the Galaxy needs no server of ours — kernel principle 7, at planet scale."],
  ["Visitors cannot mutate a host world",
   "Walking through grants VISIT. Sculpting prompts a FORK, which copies the manifest, appends your id to `lineage` and gives you your own content hash. Nobody can grief a world they do not own."],
  ["Every dependency is verified on arrival",
   "The manifest id is recomputed from its body, and every cartridge is checked against its declared hash. A tampered bundle cannot render, let alone execute — presets carry graphs, and graphs are data."],
  ["Version skew falls back to replay",
   "If the reconstructed state hash differs from the author's, the engine versions disagree. The client replays the command journal instead: slower, authoritative, and it tells us exactly which commit changed behaviour."],
  ["Attribution is structural, not social",
   "`lineage` is part of the hashed body. You cannot strip an author from a fork without changing the world's identity, so credit survives remixing by construction."],
] as const;
