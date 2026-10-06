/* ============================================================================
   @hm/setmix-field — THE TERRAFORM WAVE ENGINE
   Pure functions. No Date.now(), no Math.random(), no I/O.
   Depends on: setmix-contracts only.  Consumed by: @hm/sim, @hm/chunkworld.

   THE CENTRAL INSIGHT
   -------------------
   r(t) is analytic and strictly monotone, so it is INVERTIBLE. A chunk never
   polls the wave field. At the moment a wave is created, every chunk that the
   wave will ever reach computes its own enter/exit ticks in O(1) and then
   SLEEPS until the scheduler wakes it. A 100,000-chunk planet with 40 active
   spires costs ~0 per tick; work is proportional to chunks *in band*, which
   is an annulus, which is O(r), not O(r²).
   ========================================================================== */

import { TICK_HZ } from "./core";

/* ───────────────────────────────────────────────────────────── contracts */

export type Vec2 = readonly [number, number];

export type ChunkWaveState = "DORMANT" | "APPROACHING" | "INSIDE_BAND" | "STABILIZED";

export interface WaveSource {
  id: string;
  spireId: string;
  cartridgeId: string | null;
  pos: Vec2;
  /** sim tick at which the wave was dispatched (or re-dispatched) */
  startedAt: number;
  /** spire tier 1..4 */
  tier: number;
  /** portal bandwidth channels assigned, 0..256 */
  bandwidth: number;
  /** cartridge complexity 0.5..4 — scales τ, so complex presets spread slower */
  complexity: number;
  /** 1 = advancing, −1 = receding (cartridge pulled / spire destroyed) */
  dir: 1 | -1;
  /** tick at which dir flipped to −1 */
  reversedAt?: number;
  /** elapsed seconds at the instant of reversal — frozen so the recede
   *  replays the identical forward curve backwards */
  reversedElapsed?: number;
  /** relative strength when several waves overlap */
  influence: number;
  /** 0..1 — the Dominance dial set in the lab */
  dominance: number;
}

export interface ChunkRef {
  id: string;
  /** chunk-space coordinate */
  cx: number;
  cz: number;
  /** world centre */
  centre: Vec2;
  /** half-diagonal of the chunk AABB — the conservative test radius */
  radius: number;
}

export interface ChunkSchedule {
  chunkId: string;
  sourceId: string;
  /** tick the band's leading edge first touches the chunk sphere */
  tEnter: number;
  /** tick the band's trailing edge clears the chunk sphere */
  tExit: number;
  /** false when the wave's R_max never reaches this chunk */
  reachable: boolean;
}

export interface WaveFieldState {
  tick: number;
  sources: WaveSource[];
  /** min-heap by wake tick; the ONLY thing stepWaveField walks each tick */
  wake: { tick: number; chunkId: string; sourceId: string }[];
  /** chunks currently requiring per-tick geomorph evaluation */
  active: Set<string>;
  /** append-only journal; the reverse wave replays this */
  journal: WaveJournalEntry[];
  stats: WaveStats;
}

export interface WaveJournalEntry {
  tick: number;
  kind: "dispatch" | "reverse" | "settle" | "cancel";
  sourceId: string;
  chunkId?: string;
  /** content hash of the chunk's pre-wave terrain, for exact restore */
  prevHash?: string;
}

export interface WaveStats {
  tick: number;
  activeChunks: number;
  wakeQueueLength: number;
  chunksEnteredThisTick: number;
  chunksSettledThisTick: number;
  texelReEvalsThisTick: number;
}

export interface ChunkWaveSample {
  state: ChunkWaveState;
  /** dominant source for this chunk, or null */
  sourceId: string | null;
  /** 0..1 geomorph parameter across the whole chunk (centre sample) */
  phase: number;
  /** fraction of the chunk's footprint already behind the band */
  coverage: number;
  /** distance from chunk centre to the band's leading edge (metres) */
  edgeDist: number;
  /** true while the chunk must re-mesh every tick */
  needsRemesh: boolean;
}

/* ───────────────────────────────────────────────────── wave kinematics ── */

/** R_max = 180 m · tier · (1 + bandwidth/64) */
export function waveRMax(s: Pick<WaveSource, "tier" | "bandwidth">): number {
  return 180 * s.tier * (1 + s.bandwidth / 64);
}

/** τ = 90 s · cartridgeComplexity */
export function waveTau(s: Pick<WaveSource, "complexity">): number {
  return 90 * s.complexity;
}

/**
 *  r(t) = ∫₀ᵗ v(τ)dτ = R_max · (1 − e^(−t/τ))
 *  Closed form, so no integration error accumulates over a 40-hour session.
 */
export function waveRadius(elapsedSec: number, s: WaveSource): number {
  if (elapsedSec <= 0) return 0;
  return waveRMax(s) * (1 - Math.exp(-elapsedSec / waveTau(s)));
}

/**
 *  v(t) = dr/dt = (R_max/τ)·e^(−t/τ) = (R_max − r)/τ
 *  Expressed in terms of r so the renderer can get velocity from radius
 *  without knowing the elapsed time.
 */
export function waveVelocity(elapsedSec: number, s: WaveSource): number {
  const r = waveRadius(elapsedSec, s);
  return (waveRMax(s) - r) / waveTau(s);
}

/**
 *  THE INVERSE. t(r) = −τ · ln(1 − r/R_max).
 *  This is why chunks can sleep: given a distance, we know the exact tick.
 *  Returns +Infinity when r is unreachable.
 */
export function waveTimeToRadius(r: number, s: WaveSource): number {
  const R = waveRMax(s);
  if (r <= 0) return 0;
  if (r >= R) return Infinity;
  return -waveTau(s) * Math.log(1 - r / R);
}

/** Shell thickness grows with speed so a fast front is never thinner than
 *  one geomorph's worth of travel. Clamped to the authored 8–14 m. */
export function bandThickness(elapsedSec: number, s: WaveSource): number {
  const v = waveVelocity(elapsedSec, s);
  return Math.min(14, Math.max(8, 8 + v * 1.9));
}

/** Seconds of wave-time elapsed at `tick`, honouring a reversal.
 *  On reverse we rewind the SAME curve at 2× rate, which guarantees the
 *  recede visits every chunk in the exact reverse order it advanced. */
export function elapsedAt(s: WaveSource, tick: number): number {
  if (s.dir === 1) return Math.max(0, (tick - s.startedAt) / TICK_HZ);
  const atRev = s.reversedElapsed ?? (s.reversedAt! - s.startedAt) / TICK_HZ;
  const since = Math.max(0, (tick - (s.reversedAt ?? tick)) / TICK_HZ);
  return Math.max(0, atRev - 2 * since);
}

/** Tick at which a receding wave fully collapses. */
export function reverseCompletionTick(s: WaveSource): number {
  if (s.dir !== -1 || s.reversedAt === undefined) return Infinity;
  const atRev = s.reversedElapsed ?? (s.reversedAt - s.startedAt) / TICK_HZ;
  return s.reversedAt + Math.ceil((atRev / 2) * TICK_HZ);
}

/* ──────────────────────────────────────────── C¹ geomorph interpolation ─ */

/** S(u) = u²(3−2u). C¹-continuous: S(0)=0, S(1)=1, S'(0)=S'(1)=0.
 *  The zero end-derivatives are the whole point — terrain velocity is
 *  continuous at both ends of the morph, so nothing visibly "starts". */
export function smoothstepC1(u: number): number {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return t * t * (3 - 2 * t);
}

/** C² variant for the few props whose silhouette betrays curvature
 *  discontinuity (towers, masts). Costs one extra multiply. */
export function smoothstepC2(u: number): number {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 *  THE GEOMORPH.  H(x,z,t) = lerp(H_prev, H_next, S((r − d)/Δr))
 *
 *  Note that `s` is a function of WORLD POSITION and nothing else — it does
 *  not depend on which chunk you are in. That single property is what makes
 *  the seam problem disappear: two adjacent chunks sampling the same world
 *  point necessarily compute the same blend factor, to the bit.
 */
export function sampleWaveTransition(
  p: Vec2,
  sources: WaveSource[],
  tick: number,
): {
  s: number;
  dominant: WaveSource | null;
  weights: { sourceId: string; w: number }[];
  alphaHashThreshold: number;
  inBand: boolean;
} {
  let best: WaveSource | null = null;
  let bestS = 0;
  let bestEdge = -Infinity;
  let sum = 0;
  const raw: { sourceId: string; w: number }[] = [];

  for (const src of sources) {
    const e = elapsedAt(src, tick);
    if (e <= 0) continue;
    const r = waveRadius(e, src);
    const dr = bandThickness(e, src);
    const d = Math.hypot(p[0] - src.pos[0], p[1] - src.pos[1]);
    // s = 1 well inside, 0 well outside, C¹ across the shell
    const s = smoothstepC1((r - d) / dr);
    if (s <= 0) continue;
    // falloff keeps late-game mega-spires from flattening local authorship
    const falloff = 1 - 0.35 * Math.min(1, d / Math.max(1, waveRMax(src)));
    const w = s * src.influence * falloff * src.dominance;
    raw.push({ sourceId: src.id, w });
    sum += w;
    const edge = r - d;
    if (edge > bestEdge) {
      bestEdge = edge;
      best = src;
      bestS = s;
    }
  }

  const weights = sum > 0 ? raw.map((x) => ({ ...x, w: x.w / sum })) : raw;
  return {
    s: bestS,
    dominant: best,
    weights,
    // stochastic coverage: compare against a blue-noise/IGN value per pixel
    alphaHashThreshold: bestS,
    inBand: bestS > 0.001 && bestS < 0.999,
  };
}

/* ───────────────────────────────────────────── chunk state machine ────── */

/** Hysteresis margin (metres) so a chunk straddling a threshold cannot
 *  oscillate between states on consecutive ticks. */
const HYST = 1.5;

export function evaluateChunkWaveState(
  chunk: ChunkRef,
  sources: WaveSource[],
  tick: number,
  prev?: ChunkWaveState,
): ChunkWaveSample {
  let state: ChunkWaveState = "DORMANT";
  let sourceId: string | null = null;
  let phase = 0;
  let coverage = 0;
  let edgeDist = Infinity;

  for (const src of sources) {
    const e = elapsedAt(src, tick);
    const r = waveRadius(e, src);
    const dr = bandThickness(e, src);
    const d = Math.hypot(chunk.centre[0] - src.pos[0], chunk.centre[1] - src.pos[1]);
    const near = d - chunk.radius; // closest point of the chunk
    const far = d + chunk.radius; // furthest point

    let st: ChunkWaveState;
    const enterEdge = prev === "INSIDE_BAND" ? HYST : 0;
    if (r - enterEdge >= far + dr) st = "STABILIZED";
    else if (r + dr + enterEdge >= near) st = "INSIDE_BAND";
    else if (r + dr * 3 >= near) st = "APPROACHING";
    else st = "DORMANT";

    const rank = (x: ChunkWaveState) =>
      x === "INSIDE_BAND" ? 3 : x === "STABILIZED" ? 2 : x === "APPROACHING" ? 1 : 0;
    if (rank(st) > rank(state)) {
      state = st;
      sourceId = src.id;
      phase = smoothstepC1((r - d) / dr);
      coverage = Math.min(1, Math.max(0, (r - near) / Math.max(1e-3, far - near)));
      edgeDist = r - d;
    }
  }

  return {
    state,
    sourceId,
    phase,
    coverage,
    edgeDist,
    needsRemesh: state === "INSIDE_BAND",
  };
}

/** O(1) per (chunk × source). Called ONCE when a wave is dispatched. */
export function scheduleChunk(chunk: ChunkRef, src: WaveSource): ChunkSchedule {
  const d = Math.hypot(chunk.centre[0] - src.pos[0], chunk.centre[1] - src.pos[1]);
  const near = Math.max(0, d - chunk.radius);
  const far = d + chunk.radius;
  const R = waveRMax(src);

  if (near >= R) {
    return { chunkId: chunk.id, sourceId: src.id, tEnter: Infinity, tExit: Infinity, reachable: false };
  }
  // the band leads the radius by Δr, so the chunk is touched when r = near − Δr.
  // Δr itself depends on t, so we solve once with the thickness at the naive
  // arrival time — a single fixed-point iteration is accurate to <1 tick.
  let tE = waveTimeToRadius(near, src);
  const dr0 = bandThickness(tE, src);
  tE = waveTimeToRadius(Math.max(0, near - dr0), src);
  const drE = bandThickness(tE, src);
  tE = waveTimeToRadius(Math.max(0, near - drE), src);

  const tX = far >= R ? Infinity : waveTimeToRadius(far, src);

  return {
    chunkId: chunk.id,
    sourceId: src.id,
    tEnter: src.startedAt + Math.floor(tE * TICK_HZ),
    tExit: far >= R ? Infinity : src.startedAt + Math.ceil(tX * TICK_HZ),
    reachable: true,
  };
}

/* ───────────────────────────────────────────────── the 120 Hz stepper ── */

export interface StepInput {
  chunks: Map<string, ChunkRef>;
  /** dispatched this tick by the command bus */
  dispatch?: WaveSource[];
  /** source ids reversed this tick (cartridge pulled / spire destroyed) */
  reverse?: string[];
  /** texels re-evaluated per chunk entering the band (from graphCost) */
  texelsPerChunk?: number;
  ticks?: number;
}

/**
 *  Advances the field. Does NOT iterate chunks — only the wake queue.
 *  Cost per tick is O(chunks waking) + O(active chunks), both of which are
 *  proportional to the band's circumference, not the planet's area.
 */
export function stepWaveField(f: WaveFieldState, input: StepInput): WaveFieldState {
  const ticks = input.ticks ?? 1;
  const tick = f.tick + ticks;
  let sources = f.sources;
  const journal = f.journal.slice();
  const wake = f.wake.slice();
  const active = new Set(f.active);
  let entered = 0;
  let settled = 0;

  /* ---- 1. new dispatches: schedule every reachable chunk, then sleep ---- */
  if (input.dispatch?.length) {
    sources = [...sources, ...input.dispatch];
    for (const src of input.dispatch) {
      journal.push({ tick, kind: "dispatch", sourceId: src.id });
      for (const chunk of input.chunks.values()) {
        const sch = scheduleChunk(chunk, src);
        if (!sch.reachable) continue;
        wake.push({ tick: sch.tEnter, chunkId: chunk.id, sourceId: src.id });
      }
    }
    wake.sort((a, b) => a.tick - b.tick);
  }

  /* ---- 2. reversals: flip direction, freeze elapsed, re-schedule ------- */
  if (input.reverse?.length) {
    sources = sources.map((s) => {
      if (!input.reverse!.includes(s.id) || s.dir === -1) return s;
      const frozen = elapsedAt(s, tick);
      journal.push({ tick, kind: "reverse", sourceId: s.id });
      return { ...s, dir: -1 as const, reversedAt: tick, reversedElapsed: frozen };
    });
    // Everything the forward wave touched must be revisited in reverse order.
    // Because the recede replays r(·) backwards at 2×, we can derive each
    // chunk's wake tick analytically rather than storing a per-chunk list.
    for (const s of sources) {
      if (s.dir !== -1 || s.reversedAt !== tick) continue;
      const atRev = s.reversedElapsed!;
      for (const chunk of input.chunks.values()) {
        const d = Math.hypot(chunk.centre[0] - s.pos[0], chunk.centre[1] - s.pos[1]);
        const tTouch = waveTimeToRadius(Math.max(0, d - chunk.radius), s);
        if (!isFinite(tTouch) || tTouch > atRev) continue;
        // forward time tTouch maps to reverse wall-clock: rev + (atRev − t)/2
        wake.push({
          tick: s.reversedAt! + Math.floor(((atRev - tTouch) / 2) * TICK_HZ),
          chunkId: chunk.id,
          sourceId: s.id,
        });
      }
    }
    wake.sort((a, b) => a.tick - b.tick);
  }

  /* ---- 3. drain the wake queue ---------------------------------------- */
  let head = 0;
  while (head < wake.length && wake[head].tick <= tick) {
    const w = wake[head++];
    const chunk = input.chunks.get(w.chunkId);
    if (chunk) {
      active.add(w.chunkId);
      entered++;
    }
  }
  const remaining = wake.slice(head);

  /* ---- 4. retire chunks that have fully stabilised --------------------- */
  for (const id of active) {
    const chunk = input.chunks.get(id);
    if (!chunk) {
      active.delete(id);
      continue;
    }
    const smp = evaluateChunkWaveState(chunk, sources, tick, "INSIDE_BAND");
    if (smp.state === "STABILIZED") {
      active.delete(id);
      settled++;
      journal.push({ tick, kind: "settle", sourceId: smp.sourceId ?? "—", chunkId: id });
    } else if (smp.state === "DORMANT") {
      // only reachable via a fully receded wave: terrain is restored
      active.delete(id);
      settled++;
    }
  }

  /* ---- 5. garbage-collect collapsed reverse waves ---------------------- */
  sources = sources.filter((s) => !(s.dir === -1 && tick >= reverseCompletionTick(s)));

  return {
    tick,
    sources,
    wake: remaining,
    active,
    journal: journal.slice(-512),
    stats: {
      tick,
      activeChunks: active.size,
      wakeQueueLength: remaining.length,
      chunksEnteredThisTick: entered,
      chunksSettledThisTick: settled,
      texelReEvalsThisTick: entered * (input.texelsPerChunk ?? 0),
    },
  };
}

export function emptyField(tick = 0): WaveFieldState {
  return {
    tick,
    sources: [],
    wake: [],
    active: new Set(),
    journal: [],
    stats: {
      tick,
      activeChunks: 0,
      wakeQueueLength: 0,
      chunksEnteredThisTick: 0,
      chunksSettledThisTick: 0,
      texelReEvalsThisTick: 0,
    },
  };
}

/* ──────────────────────── Q2 bridge: band → texgraph bounds ───────────── */

/** Converts the slice of a chunk currently inside the band into the
 *  `EvaluateOptions.bounds` rectangle that @hm/texgraph now accepts.
 *  Returns null when the whole chunk must be re-evaluated. */
export function bandBoundsForChunk(
  chunk: ChunkRef,
  src: WaveSource,
  tick: number,
  chunkWorldSize: number,
  texSize: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const e = elapsedAt(src, tick);
  const r = waveRadius(e, src);
  const dr = bandThickness(e, src);
  const half = chunkWorldSize / 2;
  const ox = chunk.centre[0] - half,
    oz = chunk.centre[1] - half;

  // world-space AABB of the annulus ∩ chunk
  const lo = Math.max(0, r - dr),
    hi = r + dr;
  const ax0 = Math.max(ox, src.pos[0] - hi),
    ax1 = Math.min(ox + chunkWorldSize, src.pos[0] + hi);
  const az0 = Math.max(oz, src.pos[1] - hi),
    az1 = Math.min(oz + chunkWorldSize, src.pos[1] + hi);
  if (ax1 <= ax0 || az1 <= az0) return null;

  const covered =
    Math.hypot(chunk.centre[0] - src.pos[0], chunk.centre[1] - src.pos[1]) + chunk.radius < lo;
  if (covered) return null;

  const k = texSize / chunkWorldSize;
  return {
    x0: Math.max(0, Math.floor((ax0 - ox) * k) - 1),
    y0: Math.max(0, Math.floor((az0 - oz) * k) - 1),
    x1: Math.min(texSize, Math.ceil((ax1 - ox) * k) + 1),
    y1: Math.min(texSize, Math.ceil((az1 - oz) * k) + 1),
  };
}

/* ────────────────────────── the 4-phase anti-pop contract ─────────────── */

export const ANTIPOP = [
  {
    phase: "01 · MATERIAL",
    window: "0.60 s",
    mech: "alpha-hash stochastic coverage against an interleaved-gradient-noise value, resolved by TAA",
    why: "Stochastic beats a dissolve texture because the noise is already temporally jittered — the transition never bands and never reveals a pattern.",
  },
  {
    phase: "02 · GEOMETRY",
    window: "1.40 s",
    mech: "H = lerp(H_prev, H_next, S((r−d)/Δr)) with S′(0)=S′(1)=0",
    why: "Zero end-derivatives mean the ground's vertical velocity is continuous. Nothing appears to start or stop moving; the terrain just swells.",
  },
  {
    phase: "03 · PROPS",
    window: "0.30 s each",
    mech: "scale-and-sway curve, spawn order from a blue-noise rank, never more than 6% of a chunk's props per frame",
    why: "Blue-noise ordering makes the fill look like growth instead of a wipe, and the 6% cap bounds the instancing upload spike.",
  },
  {
    phase: "04 · AUDIO",
    window: "0.18 s, 2 frames EARLY",
    mech: "low-passed whoosh bussed to the band's screen-space position",
    why: "Sound arriving marginally before a visual change makes the eye attribute the change to the sound. It is the cheapest frame budget in the industry.",
  },
] as const;
