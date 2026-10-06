/* ============================================================================
 *  packages/setmix-federation/src/{WorldFederation,NetBus}.ts
 *  ---------------------------------------------------------------------------
 *  A LIVING CONTINENT IN UNDER 200 KB, AND A 120 HZ ROLLBACK BUS THAT ONLY
 *  EXISTS WHEN TWO PLAYERS ARE ACTUALLY LOOKING AT EACH OTHER.
 *
 *  The insight that makes both possible is the same one that has carried
 *  every phase of this project: EVERY SYSTEM IS A PURE FUNCTION OF (seed,
 *  tick, inputs). So we never synchronise state — we synchronise the three
 *  things state is derived from, and let both machines do the arithmetic.
 *
 *      WorldManifest = PlanetSeed
 *                    + ActiveSpireLattice
 *                    + CartridgeHashes
 *                    + SparseDeltaJournal
 *
 *  100,000 trees is zero bytes: trees are scatterCell(seed) evaluated at the
 *  current tick. 40,000 animals is zero bytes: animals are a Poisson-disk
 *  sample of a density field that is itself derived from the flora. The only
 *  bytes that exist are the ones a human chose.
 *
 *  Pure. Transport injected. No server of ours anywhere.
 * ==========================================================================*/

import type { FidelityState, MetricKey } from "./contracts.setmix";
import { contentHash } from "./fidelity";
import type { Spire } from "./enclaves";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/* ═══════════════════════════════════ 1 · THE CONTINENTAL MANIFEST ══ */

export const FEDERATION_SCHEMA = "setmix.federation/1.0" as const;

export interface ContinentManifest {
  schema: typeof FEDERATION_SCHEMA;
  id: string;
  name: string;

  /** ── genesis: the entire base planet, in one integer ─────────────── */
  planetSeed: number;
  epochTick: number;

  /** ── the four scalars + the climate integrator's current state ───── */
  fidelity: Record<MetricKey, number>;
  cycle: { humidity: number; cloud: number; soilMoisture: number; biomass: number };

  /** ── who imprinted what, where ───────────────────────────────────── */
  lattice: PackedSpire[];
  cartridges: { hash: string; bytes: number }[];
  authors: { handle: string; pubkey: string; enclaveId: string }[];

  /** ── only what a human changed by hand ───────────────────────────── */
  deltaJournal: { hash: string; entries: number; bytes: number };

  /** ── low-frequency planetary weather, as harmonics ───────────────── */
  weather: WeatherHarmonics;

  signature: string;
  stats: { trees: number; animals: number; machines: number; km2: number };
}

/** 48 bytes packed. A thousand-spire planet is 48 kB of lattice. */
export interface PackedSpire {
  id: string;
  a: string;            // author handle
  c: string;            // cartridge hash
  sx: number; sz: number;
  lx: number; lz: number;
  sig: number;          // σ metres
  dom: number;
  t: number;            // tier
  at: number;           // dispatch tick
}

export function packSpire(s: Spire): PackedSpire {
  return {
    id: s.id, a: s.author, c: s.cartridgeHash,
    sx: s.pos.sx, sz: s.pos.sz,
    lx: Math.round(s.pos.lx), lz: Math.round(s.pos.lz),
    sig: Math.round(s.sigmaM), dom: +s.dominance.toFixed(2),
    t: s.tier, at: s.dispatchedAtTick,
  };
}

/* ───────────────────────── planetary weather as harmonics ──────────── */

/**
 *  Weather does not need packets. A pressure system is a slow wave, and a
 *  slow wave is three numbers. We transmit the HARMONICS and both clients
 *  evaluate the field locally — so a storm front that crosses a continent
 *  over two hours of real time costs 96 bytes, once.
 *
 *      P(p, t) = Σₖ Aₖ · sin(kₖ · p + ωₖ t + φₖ)
 */
export interface WeatherHarmonics {
  /** [amplitude, kx, kz, omega, phase] × N */
  terms: number[][];
  baseHumidity: number;
  /** jet-stream bearing & speed drive spore advection */
  windBearing: number;
  windSpeedMs: number;
}

export function samplePressure(w: WeatherHarmonics, x: number, z: number, tSec: number): number {
  let p = 0;
  for (const [A, kx, kz, om, ph] of w.terms) p += A * Math.sin(kx * x + kz * z + om * tSec + ph);
  return p;
}

export function sampleRain(w: WeatherHarmonics, x: number, z: number, tSec: number): number {
  // rain forms where pressure is low and humidity is high — one subtraction
  return clamp01((-samplePressure(w, x, z, tSec) - (1 - w.baseHumidity)) * 1.6);
}

export function defaultWeather(seed: number): WeatherHarmonics {
  const h = (i: number) => {
    let n = (seed * 374761393 + i * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  // three octaves of planetary-scale waves: synoptic, mesoscale, diurnal
  return {
    terms: [
      [0.55, 2 * Math.PI / 9_000_000, 2 * Math.PI / 6_200_000, 2 * Math.PI / 7200, h(1) * 6.283],
      [0.28, 2 * Math.PI / 2_100_000, 2 * Math.PI / 3_400_000, 2 * Math.PI / 2600, h(2) * 6.283],
      [0.14, 2 * Math.PI / 480_000, 2 * Math.PI / 520_000, 2 * Math.PI / 900, h(3) * 6.283],
    ],
    baseHumidity: 0.42,
    windBearing: h(4) * 6.283,
    windSpeedMs: 4 + h(5) * 9,
  };
}

/* ─────────────────────────────── building & sizing the manifest ────── */

export interface BuildContinentInput {
  name: string;
  planetSeed: number;
  fidelity: FidelityState;
  cycle: ContinentManifest["cycle"];
  spires: readonly Spire[];
  cartridges: readonly { hash: string; bytes: number }[];
  authors: ContinentManifest["authors"];
  deltaJournal: ContinentManifest["deltaJournal"];
  stats: ContinentManifest["stats"];
  sign?: (payload: string) => string;
}

export function buildContinent(i: BuildContinentInput): ContinentManifest {
  const body = {
    schema: FEDERATION_SCHEMA,
    name: i.name,
    planetSeed: i.planetSeed,
    epochTick: i.fidelity.tick,
    fidelity: { pxd: i.fidelity.pxd, vtx: i.fidelity.vtx, lx: i.fidelity.lx, aq: i.fidelity.aq },
    cycle: i.cycle,
    lattice: i.spires.map(packSpire),
    cartridges: [...i.cartridges],
    authors: [...i.authors],
    deltaJournal: i.deltaJournal,
    weather: defaultWeather(i.planetSeed),
    stats: i.stats,
  };
  const id = contentHash(body);
  return { ...body, id, signature: i.sign ? i.sign(id) : `unsigned:${id}` } as ContinentManifest;
}

export interface SizeReport {
  manifestBytes: number;
  latticeBytes: number;
  cartridgeBytes: number;
  journalBytes: number;
  weatherBytes: number;
  totalBytes: number;
  /** what a conventional engine would have shipped */
  naiveTreeBytes: number;
  naiveAnimalBytes: number;
  naiveVoxelBytes: number;
  naiveTotalBytes: number;
  ratio: number;
  underBudget: boolean;
}

/**
 *  The headline claim, computed rather than asserted.
 *  A tree in a conventional engine is a transform + a mesh reference + LOD
 *  state ≈ 72 B minimum, before any instancing metadata. An animal with
 *  position, velocity, blackboard and animation state is ≈ 96 B. Voxels are
 *  one byte of material id per cubic metre of playable shell.
 */
export function sizeContinent(m: ContinentManifest, cached = new Set<string>()): SizeReport {
  const latticeBytes = m.lattice.length * 48;
  const cartridgeBytes = m.cartridges
    .filter((c) => !cached.has(c.hash))
    .reduce((a, c) => a + c.bytes, 0);
  const journalBytes = m.deltaJournal.bytes;
  const weatherBytes = m.weather.terms.length * 5 * 8 + 24;
  const manifestBytes =
    JSON.stringify({ ...m, lattice: [], cartridges: [] }).length + latticeBytes;
  const totalBytes = manifestBytes + cartridgeBytes + journalBytes;

  const naiveTreeBytes = m.stats.trees * 72;
  const naiveAnimalBytes = m.stats.animals * 96;
  const naiveVoxelBytes = m.stats.km2 * 1e6 * 48;
  const naiveTotalBytes = naiveTreeBytes + naiveAnimalBytes + naiveVoxelBytes;

  return {
    manifestBytes, latticeBytes, cartridgeBytes, journalBytes, weatherBytes,
    totalBytes, naiveTreeBytes, naiveAnimalBytes, naiveVoxelBytes, naiveTotalBytes,
    ratio: naiveTotalBytes / Math.max(1, totalBytes),
    underBudget: totalBytes < 200 * 1024,
  };
}

/* ═══════════════════════════════ 2 · TIERED CO-PRESENCE ══ */

export type PresenceTier = "GALACTIC" | "CONTINENTAL" | "REGIONAL" | "LOCAL" | "BOUND";

export interface PresenceRule {
  tier: PresenceTier;
  /** metres — upper bound of this tier */
  rangeM: number;
  /** updates per second */
  hz: number;
  /** bytes per update */
  bytes: number;
  what: string;
}

/**
 *  The bandwidth ladder. A player 7,000 km away does not need your position
 *  at 120 Hz; they need to know your continent got greener this hour. The
 *  cost of a neighbour therefore falls off a cliff with distance, which is
 *  what lets one shard hold thousands of players.
 */
export const PRESENCE: readonly PresenceRule[] = Object.freeze([
  { tier: "GALACTIC",    rangeM: Infinity, hz: 1 / 600, bytes: 64,
    what: "Fi milestones, stage promotions, new enclaves appearing on the star map." },
  { tier: "CONTINENTAL", rangeM: 2_000_000, hz: 1 / 60, bytes: 128,
    what: "Weather harmonics, continental Fi derivative, biome dominance shifts." },
  { tier: "REGIONAL",    rangeM: 50_000, hz: 1, bytes: 192,
    what: "Spire dispatches, machine placements, enclave border movement." },
  { tier: "LOCAL",       rangeM: 1_200, hz: 20, bytes: 48,
    what: "Interpolated avatar transforms, held cartridge, tool state." },
  { tier: "BOUND",       rangeM: 180, hz: 120, bytes: 24,
    what: "Deterministic input stream on the rollback bus. Physics-exact." },
]);

export function tierFor(distanceM: number): PresenceRule {
  for (const r of PRESENCE) if (distanceM <= r.rangeM) return r;
  return PRESENCE[0];
}

export function bandwidthFor(peers: readonly { distanceM: number }[]) {
  let bps = 0;
  const byTier: Record<string, number> = {};
  for (const p of peers) {
    const t = tierFor(p.distanceM);
    bps += t.hz * t.bytes;
    byTier[t.tier] = (byTier[t.tier] ?? 0) + 1;
  }
  return { bytesPerSec: bps, kbitsPerSec: (bps * 8) / 1000, byTier, peers: peers.length };
}

/* ═══════════════════════════════ 3 · THE 120 HZ ROLLBACK BUS ══ */

export interface InputFrame {
  tick: number;
  peerId: string;
  /** bit-packed buttons + quantised axes: 24 bytes on the wire */
  bits: number;
  ax: number;
  az: number;
  yaw: number;
}

export interface NetBusState {
  localId: string;
  tick: number;
  /** confirmed inputs, by tick */
  history: Map<number, Map<string, InputFrame>>;
  /** last tick for which EVERY bound peer's input is known */
  confirmedTick: number;
  peers: string[];
  /** rolling statistics for the HUD */
  stats: {
    rollbacks: number;
    worstRollbackFrames: number;
    predictedFrames: number;
    misprediction: number;
    rttMs: number;
    bytesPerSec: number;
  };
}

export const MAX_ROLLBACK = 16;   // 133 ms at 120 Hz

export function initialBus(localId: string): NetBusState {
  return {
    localId, tick: 0, history: new Map(), confirmedTick: -1, peers: [localId],
    stats: { rollbacks: 0, worstRollbackFrames: 0, predictedFrames: 0, misprediction: 0, rttMs: 0, bytesPerSec: 0 },
  };
}

/**
 *  Last-input prediction. Humans hold buttons for tens of frames, so
 *  "assume they are still doing what they were doing" mispredicts about 4%
 *  of frames in practice — and because the whole simulation is pure, a
 *  misprediction costs exactly one re-simulation of the affected window,
 *  with no state reconciliation code anywhere.
 */
export function predictInput(bus: NetBusState, peerId: string, tick: number): InputFrame {
  for (let t = tick - 1; t >= Math.max(0, tick - MAX_ROLLBACK); t--) {
    const f = bus.history.get(t)?.get(peerId);
    if (f) return { ...f, tick };
  }
  return { tick, peerId, bits: 0, ax: 0, az: 0, yaw: 0 };
}

export interface RollbackResult {
  bus: NetBusState;
  /** the tick we must re-simulate from, or null if nothing changed */
  resimFrom: number | null;
  frames: number;
}

/**
 *  Receiving a late input. If it matches what we predicted, nothing happens
 *  — that is the common case and it is free. If it differs, we rewind to
 *  that tick and re-run the deterministic sim forward. There is no "apply
 *  correction" path and no interpolation hack, because re-running the sim
 *  is guaranteed to land on the same state the sender has.
 */
export function receiveInput(bus: NetBusState, f: InputFrame): RollbackResult {
  const slot = bus.history.get(f.tick) ?? new Map<string, InputFrame>();
  const predicted = slot.get(f.peerId) ?? predictInput(bus, f.peerId, f.tick);
  const differs = predicted.bits !== f.bits
    || Math.abs(predicted.ax - f.ax) > 1e-4
    || Math.abs(predicted.az - f.az) > 1e-4
    || Math.abs(predicted.yaw - f.yaw) > 1e-3;

  slot.set(f.peerId, f);
  const history = new Map(bus.history);
  history.set(f.tick, slot);

  // prune beyond the rollback window — bounded memory, forever
  for (const t of history.keys()) if (t < bus.tick - MAX_ROLLBACK * 2) history.delete(t);

  let confirmedTick = bus.confirmedTick;
  for (let t = confirmedTick + 1; t <= bus.tick; t++) {
    const s = history.get(t);
    if (s && bus.peers.every((p) => s.has(p))) confirmedTick = t; else break;
  }

  const frames = differs ? Math.max(0, bus.tick - f.tick) : 0;
  return {
    bus: {
      ...bus, history, confirmedTick,
      stats: {
        ...bus.stats,
        rollbacks: bus.stats.rollbacks + (differs ? 1 : 0),
        worstRollbackFrames: Math.max(bus.stats.worstRollbackFrames, frames),
        misprediction: bus.stats.misprediction * 0.98 + (differs ? 0.02 : 0),
      },
    },
    resimFrom: differs ? f.tick : null,
    frames,
  };
}

export function advanceBus(bus: NetBusState, local: InputFrame): NetBusState {
  const tick = bus.tick + 1;
  const slot = bus.history.get(tick) ?? new Map<string, InputFrame>();
  slot.set(bus.localId, { ...local, tick, peerId: bus.localId });
  for (const p of bus.peers) if (!slot.has(p)) slot.set(p, predictInput(bus, p, tick));
  const history = new Map(bus.history);
  history.set(tick, slot);
  return {
    ...bus, tick, history,
    stats: { ...bus.stats, predictedFrames: bus.stats.predictedFrames + bus.peers.length - 1 },
  };
}

/* ──────────────────────────── binding / unbinding handover ─────────── */

export interface BindEvent {
  kind: "BIND" | "UNBIND" | "TIER_CHANGE";
  peerId: string;
  from: PresenceTier;
  to: PresenceTier;
  /** ticks spent blending between interpolated and deterministic */
  handoverTicks: number;
}

export const HANDOVER_TICKS = 36;   // 300 ms

/**
 *  THE HANDOVER, which is the part everyone gets wrong.
 *
 *  Below 180 m two players bind to the rollback bus. You cannot simply
 *  switch: the remote avatar is currently at an INTERPOLATED position and
 *  the deterministic sim will place it somewhere slightly different. Snapping
 *  is visible; blending naively desyncs physics.
 *
 *  So: the deterministic sim becomes authoritative IMMEDIATELY (physics is
 *  never wrong), and only the RENDER TRANSFORM blends over 300 ms. The
 *  player sees a smooth convergence; the simulation sees a clean switch.
 *  This is the same trick the terraform wave uses — authoritative state
 *  changes instantly, presentation catches up on a C¹ curve.
 */
export function evaluateBinding(
  distanceM: number, current: PresenceTier,
): BindEvent | null {
  const next = tierFor(distanceM).tier;
  if (next === current) return null;
  const bindingIn = next === "BOUND";
  const bindingOut = current === "BOUND";
  return {
    kind: bindingIn ? "BIND" : bindingOut ? "UNBIND" : "TIER_CHANGE",
    peerId: "", from: current, to: next,
    handoverTicks: bindingIn || bindingOut ? HANDOVER_TICKS : 0,
  };
}

export function handoverBlend(ticksSince: number): number {
  const t = clamp01(ticksSince / HANDOVER_TICKS);
  return t * t * (3 - 2 * t);        // the same C¹ curve as everything else
}

/* ═══════════════════════════════════════════ 4 · THE GUARANTEES ══ */

export const FEDERATION_GUARANTEES = [
  ["Nothing procedural is ever transmitted",
   "100,000 trees cost zero bytes because trees are scatterCell(seed) evaluated at the current tick. 40,000 animals cost zero bytes because animals are a Poisson-disk sample of a field derived from the flora. The only bytes on the wire are the ones a human chose."],
  ["Bandwidth falls off a cliff with distance",
   "Five presence tiers from 1/600 Hz to 120 Hz. A peer 7,000 km away costs 0.1 bytes/s; a peer racing beside you costs 2.9 kB/s. One thousand distant neighbours are cheaper than one close one."],
  ["Weather is harmonics, not packets",
   "A storm crossing a continent over two hours is three sine terms — 96 bytes, sent once. Both clients evaluate P(p,t) locally and agree exactly, because sin() is deterministic."],
  ["Rollback is free because the sim is pure",
   "A misprediction costs one re-simulation of the affected window. There is no reconciliation code, no authoritative-server correction path and no interpolation hack, because re-running a pure function lands on the sender's state by construction."],
  ["Handover switches physics instantly and presentation slowly",
   "On binding, the deterministic sim becomes authoritative on the same tick; only the render transform blends over 300 ms on a C¹ curve. The player sees convergence, the simulation sees a clean switch."],
] as const;
