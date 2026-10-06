/* ============================================================================
 *  packages/setmix-enclaves/src/{InfinitePlanet,CartridgeLattice}.ts
 *  ---------------------------------------------------------------------------
 *  A 40,000 KM PLANET THAT FITS IN A FLOAT32 VERTEX BUFFER.
 *
 *  Two problems, two solutions:
 *
 *  1. PRECISION. A float32 has ~7 significant digits. At 20,000 km from the
 *     origin, one ULP is about 2 metres — the player's hand jitters between
 *     positions, shadows crawl, and physics explodes. Nobody fixes this by
 *     "using doubles on the GPU", because there are none.
 *     → FLOATING ORIGIN. World positions are stored as (sector:int32,
 *       local:float64). The renderer is handed local coordinates relative to
 *       a frequently-rebased origin, so the GPU never sees a number above
 *       ~4096. Precision at the antipode is identical to precision at spawn.
 *
 *  2. AUTHORSHIP. Thousands of players each imprinting their own aesthetic
 *     on one shared surface, with no seams and no ownership disputes.
 *     → PARTITION OF UNITY over Gaussian spire envelopes. Every point on the
 *       planet is a normalised weighted blend of every nearby author's
 *       cartridge. Borders are not negotiated; they are the place where two
 *       weights happen to be equal.
 *
 *  Pure. No clock, no RNG.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { contentHash } from "./fidelity";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/* ═══════════════════════════════════ 1 · ENDLESS COORDINATE SPACE ══ */

/** Sector edge length, metres. 4096 keeps local coords inside float32's
 *  sweet spot (≈0.0005 m resolution) with room for tall terrain. */
export const SECTOR_M = 4096;
/** 40,000 km circumference ⇒ 9,766 sectors around. */
export const PLANET_CIRCUMFERENCE_M = 40_000_000;
export const SECTORS_AROUND = Math.round(PLANET_CIRCUMFERENCE_M / SECTOR_M);

/**
 *  A position anywhere on an endless planet, exactly.
 *  sector* are int32; local* are float64 in [0, SECTOR_M).
 *  Total addressable range: ±4.4 × 10¹² m — about 29 AU. Comfortable.
 */
export interface GlobalPos {
  sx: number; sz: number;
  lx: number; ly: number; lz: number;
}

export function makeGlobal(x: number, y: number, z: number): GlobalPos {
  const sx = Math.floor(x / SECTOR_M), sz = Math.floor(z / SECTOR_M);
  return { sx, sz, lx: x - sx * SECTOR_M, ly: y, lz: z - sz * SECTOR_M };
}

/** Canonicalise after arithmetic: carry local overflow into the sector. */
export function normaliseGlobal(p: GlobalPos): GlobalPos {
  let { sx, sz, lx, ly, lz } = p;
  const cx = Math.floor(lx / SECTOR_M), cz = Math.floor(lz / SECTOR_M);
  sx += cx; sz += cz; lx -= cx * SECTOR_M; lz -= cz * SECTOR_M;
  // wrap around the planet — east of the dateline is west of it
  sx = ((sx % SECTORS_AROUND) + SECTORS_AROUND) % SECTORS_AROUND;
  return { sx, sz, lx, ly, lz };
}

export function addGlobal(p: GlobalPos, dx: number, dy: number, dz: number): GlobalPos {
  return normaliseGlobal({ ...p, lx: p.lx + dx, ly: p.ly + dy, lz: p.lz + dz });
}

/**
 *  Exact separation between two global positions, computed in sector space
 *  FIRST so the subtraction never loses precision. This is the function that
 *  makes "you are 7,412 km from the nearest other player" a true statement
 *  rather than a rounded one.
 */
export function deltaGlobal(a: GlobalPos, b: GlobalPos): [number, number, number] {
  let dsx = b.sx - a.sx;
  // take the short way round the planet
  if (dsx > SECTORS_AROUND / 2) dsx -= SECTORS_AROUND;
  if (dsx < -SECTORS_AROUND / 2) dsx += SECTORS_AROUND;
  return [dsx * SECTOR_M + (b.lx - a.lx), b.ly - a.ly, (b.sz - a.sz) * SECTOR_M + (b.lz - a.lz)];
}

export function distanceGlobal(a: GlobalPos, b: GlobalPos): number {
  const d = deltaGlobal(a, b);
  return Math.hypot(d[0], d[1], d[2]);
}

/* ─────────────────────────────────────────── the floating origin ─────── */

export interface OriginState {
  origin: GlobalPos;
  /** how far the camera may drift before we rebase, metres */
  thresholdM: number;
  rebases: number;
  /** worst float32 ULP currently in flight, metres — the health metric */
  worstUlpM: number;
}

export function initialOrigin(at: GlobalPos, thresholdM = 1024): OriginState {
  return { origin: { ...at }, thresholdM, rebases: 0, worstUlpM: 0 };
}

/** float32 ULP at magnitude m — the actual jitter the player would feel. */
export function ulpAt(m: number): number {
  if (m < 1e-6) return 1.19e-7;
  const e = Math.floor(Math.log2(Math.abs(m)));
  return Math.pow(2, e - 23);
}

/**
 *  REBASE. Called when the camera drifts past the threshold. Every renderable
 *  in flight is translated by the delta; nothing else changes, because every
 *  system upstream of the renderer works in GlobalPos and never saw the old
 *  origin in the first place.
 *
 *  The rebase is lossless: the delta is a whole number of metres, so no
 *  float64 precision is lost and physics state does not twitch.
 */
export function rebaseOrigin(
  st: OriginState, camera: GlobalPos,
): { state: OriginState; shift: [number, number, number]; rebased: boolean } {
  const d = deltaGlobal(st.origin, camera);
  const dist = Math.hypot(d[0], d[2]);
  if (dist < st.thresholdM) {
    return {
      state: { ...st, worstUlpM: ulpAt(Math.max(Math.abs(d[0]), Math.abs(d[2]))) },
      shift: [0, 0, 0], rebased: false,
    };
  }
  const shift: [number, number, number] = [Math.round(d[0]), 0, Math.round(d[2])];
  return {
    state: {
      ...st,
      origin: addGlobal(st.origin, shift[0], 0, shift[2]),
      rebases: st.rebases + 1,
      worstUlpM: ulpAt(st.thresholdM),
    },
    shift, rebased: true,
  };
}

/** GlobalPos → the float32 the GPU actually receives. */
export function toRenderSpace(p: GlobalPos, o: OriginState): [number, number, number] {
  const d = deltaGlobal(o.origin, p);
  return [d[0], p.ly, d[2]];
}

export interface PrecisionReport {
  distanceFromSpawnM: number;
  naiveUlpM: number;
  rebasedUlpM: number;
  improvement: number;
  naiveVerdict: string;
}

/** The pitch, as a number. At the antipode, naive float32 jitter is metres. */
export function precisionReport(distM: number, thresholdM = 1024): PrecisionReport {
  const naive = ulpAt(distM);
  const rebased = ulpAt(thresholdM);
  return {
    distanceFromSpawnM: distM,
    naiveUlpM: naive,
    rebasedUlpM: rebased,
    improvement: naive / rebased,
    naiveVerdict:
      naive < 0.001 ? "imperceptible"
        : naive < 0.01 ? "shadow shimmer"
        : naive < 0.1 ? "visible vertex crawl"
        : naive < 1 ? "physics jitter, unplayable"
        : "geometry tears apart",
  };
}

/* ═════════════════════════════════ 2 · THE CARTRIDGE LATTICE ══ */

export interface Spire {
  id: string;
  /** who built it */
  author: string;
  pos: GlobalPos;
  /** cartridge content hash this spire projects */
  cartridgeHash: string;
  /** display name + tint, cached from the cartridge for the overlay */
  label: string;
  tint: string;
  /** σ of the Gaussian envelope, metres. Tier and bandwidth set this. */
  sigmaM: number;
  /** amplitude — the Dominance dial from the lab */
  dominance: number;
  tier: number;
  dispatchedAtTick: number;
}

export interface BiomeSample {
  /** normalised weights, Σ = 1 */
  weights: { spireId: string; cartridgeHash: string; w: number; tint: string }[];
  /** the single strongest contributor */
  dominantId: string | null;
  /** 1 = pure single author, 0 = perfectly contested border */
  purity: number;
  /** how many authors meaningfully contribute here */
  contributors: number;
  /** blended tint, for the overlay */
  tint: [number, number, number];
}

/**
 *  W_i(p) = exp( −‖p − c_i‖² / (2σ²) )
 *
 *  Gaussian, not linear falloff, for one reason that matters enormously in
 *  practice: a Gaussian is C^∞. Every derivative is continuous, so terrain
 *  normals, flora density gradients and fauna carrying-capacity gradients
 *  are all smooth across a border. Linear or smoothstep falloff gives you a
 *  visible crease in the lighting exactly where two players meet, which is
 *  the one place in the game you least want an artefact.
 */
export function spireWeight(spire: Spire, p: GlobalPos): number {
  const d = deltaGlobal(spire.pos, p);
  const d2 = d[0] * d[0] + d[2] * d[2];
  const s2 = spire.sigmaM * spire.sigmaM;
  // cull at 3.5σ — below 0.2% contribution, and it bounds the neighbour query
  if (d2 > s2 * 12.25) return 0;
  return spire.dominance * Math.exp(-d2 / (2 * s2));
}

/**
 *  PARTITION OF UNITY
 *
 *      Biome(p) = Σᵢ [ Wᵢ(p) / Σⱼ Wⱼ(p) ] · Cartridgeᵢ(p)
 *
 *  Because the weights are normalised, they always sum to exactly 1 — so
 *  there is no "unclaimed" terrain, no gaps, and no double-counting where
 *  envelopes overlap. Player A's neon forest does not stop at a line; it
 *  becomes progressively less itself and progressively more Player B's
 *  basalt, and at the midpoint the terrain is genuinely 50% each — a real
 *  hybrid evaluated through adaptGraph, not a texture splat.
 */
export function sampleBiome(
  spires: readonly Spire[], p: GlobalPos, maxContributors = 4,
): BiomeSample {
  const raw: { spire: Spire; w: number }[] = [];
  let sum = 0;
  for (const s of spires) {
    const w = spireWeight(s, p);
    if (w <= 1e-6) continue;
    raw.push({ spire: s, w });
    sum += w;
  }
  if (!raw.length || sum <= 0) {
    return { weights: [], dominantId: null, purity: 1, contributors: 0, tint: [0.35, 0.37, 0.42] };
  }

  raw.sort((a, b) => b.w - a.w);
  const kept = raw.slice(0, maxContributors);
  const keptSum = kept.reduce((a, x) => a + x.w, 0);

  const weights = kept.map((x) => ({
    spireId: x.spire.id,
    cartridgeHash: x.spire.cartridgeHash,
    w: x.w / keptSum,
    tint: x.spire.tint,
  }));

  // purity = Herfindahl index; 1 when one author owns the point outright
  const purity = weights.reduce((a, x) => a + x.w * x.w, 0);

  let r = 0, g = 0, b = 0;
  for (const w of weights) {
    const c = hexToRgb(w.tint);
    r += c[0] * w.w; g += c[1] * w.w; b += c[2] * w.w;
  }
  return {
    weights, dominantId: kept[0].spire.id, purity,
    contributors: weights.filter((w) => w.w > 0.05).length,
    tint: [r, g, b],
  };
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ─────────────────────────────── spatial index over an endless plane ──── */

/**
 *  Uniform hash grid keyed on sector. Spires are sparse (a few thousand on
 *  a planet) and queries are always local, so this beats any tree — and it
 *  needs no rebalancing when a player plants a spire 9,000 km away.
 */
export class SpireLattice {
  private cells = new Map<string, Spire[]>();
  readonly cellM: number;
  constructor(cellM = SECTOR_M) { this.cellM = cellM; }

  private key(sx: number, sz: number) { return `${sx}|${sz}`; }

  insert(s: Spire): void {
    // a spire is registered in every cell its 3.5σ envelope touches
    const r = Math.ceil((s.sigmaM * 3.5) / this.cellM);
    const cx = s.pos.sx, cz = s.pos.sz;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const k = this.key(cx + i, cz + j);
        const arr = this.cells.get(k);
        if (arr) arr.push(s); else this.cells.set(k, [s]);
      }
  }

  near(p: GlobalPos): Spire[] {
    return this.cells.get(this.key(p.sx, p.sz)) ?? [];
  }

  sample(p: GlobalPos, maxContributors = 4): BiomeSample {
    return sampleBiome(this.near(p), p, maxContributors);
  }

  get size() { return this.cells.size; }
}

/* ═══════════════════════════ 3 · ENCLAVES & CROSS-BORDER SEEDING ══ */

export interface Enclave {
  id: string;
  author: string;
  /** the author's home sector */
  centre: GlobalPos;
  spireIds: string[];
  /** km² under ≥50% influence */
  claimedKm2: number;
  fi: number;
  /** manifest ids this enclave has been forked from */
  lineage: string[];
}

export interface WindField {
  /** prevailing direction, radians */
  bearing: number;
  speedMs: number;
  /** 0..1 — how much the jet stream wanders */
  turbulence: number;
}

/**
 *  CROSS-BORDER SEEDING.
 *
 *  Seeds and spores ride the global wind. A spore released in Player A's
 *  bioluminescent forest lands, with some probability, in Player B's basalt
 *  canyon — and if B's local climate supports it, it GERMINATES, using A's
 *  cartridge, inside B's enclave.
 *
 *  Nobody designed a "trade" system. Ecology is the trade system: your
 *  neighbour's aesthetic arrives in your valley on the wind, and you can
 *  either cull it or let it spread. Both are interesting.
 */
export interface Spore {
  cartridgeHash: string;
  originSpireId: string;
  from: GlobalPos;
  /** metres travelled so far */
  travelled: number;
  viability: number;
}

export function advectSpore(
  s: Spore, wind: WindField, dtSec: number, seedNoise: number,
): Spore {
  const jitter = (seedNoise - 0.5) * wind.turbulence * 1.2;
  const b = wind.bearing + jitter;
  const d = wind.speedMs * dtSec;
  return {
    ...s,
    from: addGlobal(s.from, Math.cos(b) * d, 0, Math.sin(b) * d),
    travelled: s.travelled + d,
    // viability decays with distance: most spores land near home, a few
    // make it hundreds of kilometres, which is exactly how real dispersal
    // kernels behave (fat-tailed, not Gaussian)
    viability: s.viability * Math.exp(-d / 42000),
  };
}

export function germinationChance(
  s: Spore, lattice: SpireLattice, localMoisture: number,
): number {
  const biome = lattice.sample(s.from);
  // a spore germinates more readily where its own cartridge already has
  // some influence, and struggles in a strongly foreign biome — but never
  // zero, which is what allows a slow, contestable invasion
  const kin = biome.weights.find((w) => w.cartridgeHash === s.cartridgeHash)?.w ?? 0;
  const foreign = 1 - kin;
  return clamp01(s.viability * localMoisture * (0.18 + kin * 0.8) * (1 - foreign * 0.55));
}

/* ═══════════════════════════ 4 · TERRAIN FROM THE LATTICE ══ */

export interface EnclaveTerrainCtx {
  planetSeed: number;
  fi: FidelityState;
  lattice: SpireLattice;
}

/**
 *  The height at any point on an infinite planet, blended across however
 *  many authors reach it. Note that nothing here is stored — give it a
 *  GlobalPos and it returns a number, which is why the planet is endless
 *  and why a visitor downloads 200 kB instead of a continent.
 */
export function enclaveHeight(
  p: GlobalPos, ctx: EnclaveTerrainCtx,
  baseHeight: (x: number, z: number, seed: number) => number,
  cartridgeRelief: (hash: string, x: number, z: number) => number,
): { height: number; biome: BiomeSample } {
  const wx = p.sx * SECTOR_M + p.lx;
  const wz = p.sz * SECTOR_M + p.lz;
  const base = baseHeight(wx, wz, ctx.planetSeed);
  const biome = ctx.lattice.sample(p);
  if (!biome.weights.length) return { height: base, biome };

  let relief = 0;
  for (const w of biome.weights) relief += cartridgeRelief(w.cartridgeHash, wx, wz) * w.w;
  return { height: base + relief, biome };
}

export function latticeStats(spires: readonly Spire[], enclaves: readonly Enclave[]) {
  const authors = new Set(spires.map((s) => s.author));
  const totalSigma = spires.reduce((a, s) => a + Math.PI * (s.sigmaM * 2) ** 2, 0) / 1e6;
  return {
    spires: spires.length,
    authors: authors.size,
    enclaves: enclaves.length,
    influencedKm2: Math.round(totalSigma),
    /** the whole lattice, on the wire */
    latticeBytes: spires.length * 96,
    hash: contentHash(spires.map((s) => [s.id, s.cartridgeHash, s.pos.sx, s.pos.sz, s.sigmaM])),
  };
}
