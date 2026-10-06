// Plants as a closed-form function of time (from the SetMix Arena drop, arena-gathered/setmix): a seed of six numbers plus
// the time since planting gives height, girth, branches and leaves; climate scales the clock, not the plant.
import { clamp01, hash1, hash2i, smooth } from "./util";

/* ═══════════════════════════════════════════════ 1 · THE SEED RECORD ══ */

export type Species = "TREE" | "FUNGAL_SPIRE" | "ALIEN_KELP" | "SHRUB";

/** 24 bytes on the wire. This is the entire plant. */
export interface FloraSeed {
  /** world position, metres (doubles — see InfinitePlanet) */
  x: number;
  z: number;
  /** tick at which it germinated */
  plantedAt: number;
  species: Species;
  /** 0..1 — per-instance variation, drives every "random" decision */
  variant: number;
  /** which cartridge authored this plant's aesthetic */
  cartridgeHash: string;
}

export interface SpeciesParams {
  species: Species;
  /** logistic steepness — how abruptly it shoots up */
  k: number;
  /** inflection, in SECONDS of game time */
  tau0: number;
  /** full-grown height, metres */
  maxHeight: number;
  maxBranches: number;
  /** trunk radius as a fraction of height */
  girthRatio: number;
  /** golden-angle-ish divergence between successive branches, radians */
  phyllotaxis: number;
  branchAngleDeg: number;
  /** canopy leaf volume at maturity, m³ */
  canopyVolume: number;
  /** soil moisture below which growth halts */
  moistureFloor: number;
  /** Lx below which photosynthesis stalls */
  lightFloor: number;
  /** ticks from maturity to senescence; Infinity = evergreen */
  lifespanSec: number;
  colour: [number, number, number];
  leafColour: [number, number, number];
}

export const SPECIES: Readonly<Record<Species, SpeciesParams>> = Object.freeze({
  TREE: {
    species: "TREE", k: 0.055, tau0: 150, maxHeight: 14, maxBranches: 34,
    girthRatio: 0.045, phyllotaxis: 2.39996, branchAngleDeg: 38,
    canopyVolume: 42, moistureFloor: 0.22, lightFloor: 0.18, lifespanSec: 4200,
    colour: [0.28, 0.2, 0.13], leafColour: [0.26, 0.56, 0.22],
  },
  FUNGAL_SPIRE: {
    species: "FUNGAL_SPIRE", k: 0.12, tau0: 60, maxHeight: 7.5, maxBranches: 6,
    girthRatio: 0.11, phyllotaxis: 1.0472, branchAngleDeg: 14,
    canopyVolume: 9, moistureFloor: 0.42, lightFloor: 0.0, lifespanSec: 900,
    colour: [0.42, 0.3, 0.5], leafColour: [0.72, 0.4, 0.95],
  },
  ALIEN_KELP: {
    species: "ALIEN_KELP", k: 0.08, tau0: 95, maxHeight: 19, maxBranches: 18,
    girthRatio: 0.018, phyllotaxis: 2.39996, branchAngleDeg: 9,
    canopyVolume: 16, moistureFloor: 0.85, lightFloor: 0.05, lifespanSec: 2600,
    colour: [0.1, 0.38, 0.4], leafColour: [0.22, 0.78, 0.66],
  },
  SHRUB: {
    species: "SHRUB", k: 0.18, tau0: 38, maxHeight: 1.6, maxBranches: 11,
    girthRatio: 0.07, phyllotaxis: 2.39996, branchAngleDeg: 52,
    canopyVolume: 3.2, moistureFloor: 0.15, lightFloor: 0.12, lifespanSec: 1400,
    colour: [0.3, 0.24, 0.16], leafColour: [0.42, 0.6, 0.26],
  },
});

/* ═══════════════════════════════════════════ 2 · THE GROWTH FUNCTION ══ */

export interface Climate {
  /** 0..1 soil moisture at this point — derived from Aq + local flow */
  moisture: number;
  /** 0..1 incident light — Lx modulated by canopy shadow and latitude */
  light: number;
  /** °C; freezing halts growth without killing */
  temperature: number;
  /** 0..1 — wind exposure, bends and stunts */
  exposure: number;
}

export interface PlantState {
  /** 0..1 logistic growth */
  scale: number;
  heightM: number;
  girthM: number;
  branches: number;
  canopyM3: number;
  /** 0 seed · 1 sprout · 2 sapling · 3 mature · 4 senescent · 5 dead */
  lifeStage: number;
  /** 0..1 — autumn/stress colouring */
  stress: number;
  /** seconds since planting, clamped by climate gating */
  tau: number;
  /** effective growth seconds actually accrued (climate-gated) */
  effectiveTau: number;
  alive: boolean;
}

/**
 *  THE CURVE
 *      Scale(τ)    = 1 / (1 + e^(−k(τ − τ₀)))        logistic
 *      Branches(τ) = ⌊ N_max · Scale(τ) ⌋
 *
 *  Climate does not scale the OUTPUT — it scales the CLOCK. A tree in a dry
 *  biome is not a small tree; it is a young tree that has lived a long time.
 *  That single decision makes drought, shade and seasons read correctly
 *  without a single extra term, and it keeps the function invertible: given
 *  a size you can solve for the effective age.
 */
export function growthRate(p: SpeciesParams, c: Climate): number {
  const m = smooth((c.moisture - p.moistureFloor) / 0.3);
  const l = smooth((c.light - p.lightFloor) / 0.25);
  const t = smooth((c.temperature + 4) / 18) * (1 - smooth((c.temperature - 42) / 16));
  const w = 1 - c.exposure * 0.35;
  return clamp01(m * l * t * w);
}

export function evaluatePlant(
  seed: FloraSeed, nowSec: number, plantedSec: number, c: Climate,
): PlantState {
  const p = SPECIES[seed.species];
  const tau = Math.max(0, nowSec - plantedSec);
  const rate = growthRate(p, c);
  const effectiveTau = tau * rate;

  const scale = 1 / (1 + Math.exp(-p.k * (effectiveTau - p.tau0)));
  const v = 0.72 + seed.variant * 0.56;          // per-instance size variation
  const heightM = p.maxHeight * scale * v;
  const girthM = heightM * p.girthRatio * (0.8 + seed.variant * 0.4);
  const branches = Math.floor(p.maxBranches * scale);
  const canopyM3 = p.canopyVolume * scale * scale * v;

  const senescence = clamp01((effectiveTau - p.lifespanSec) / (p.lifespanSec * 0.25));
  const stress = clamp01(1 - rate) * 0.7 + senescence * 0.3;
  const alive = senescence < 1;

  const lifeStage =
    scale < 0.02 ? 0 : scale < 0.15 ? 1 : scale < 0.6 ? 2
      : senescence <= 0 ? 3 : senescence < 1 ? 4 : 5;

  return { scale, heightM, girthM, branches, canopyM3, lifeStage, stress, tau, effectiveTau, alive };
}

/* ═════════════════════════════════════ 3 · THE L-SYSTEM / BÉZIER SKELETON ══ */

export interface Branch {
  /** cubic Bézier control points, local space */
  p0: [number, number, number];
  p1: [number, number, number];
  p2: [number, number, number];
  p3: [number, number, number];
  radius0: number;
  radius1: number;
  depth: number;
  /** 0..1 — how far unfolded; the vertex shader animates this */
  unfold: number;
  leafBud: number;
}

/**
 *  Deterministic parametric L-system. Rather than rewriting a string we walk
 *  the derivation directly, because the only thing we need from the grammar
 *  is the i-th branch's transform — and that is a closed-form product of
 *  phyllotactic rotations.
 *
 *  Branches unfold in INDEX ORDER as Scale(τ) rises, so a growing tree is
 *  literally the same function sampled at a later τ. There is no "grow"
 *  animation; there is only evaluation.
 */
export function buildSkeleton(
  seed: FloraSeed, st: PlantState, maxDepth = 3,
): Branch[] {
  const p = SPECIES[seed.species];
  const out: Branch[] = [];
  const H = st.heightM;
  if (H < 0.02) return out;

  const lean = (seed.variant - 0.5) * 0.22;
  // trunk: a gentle S-curve, so nothing is a cylinder
  out.push({
    p0: [0, 0, 0],
    p1: [lean * H * 0.1, H * 0.34, lean * H * 0.05],
    p2: [lean * H * 0.3, H * 0.7, lean * H * 0.18],
    p3: [lean * H * 0.42, H, lean * H * 0.26],
    radius0: st.girthM, radius1: st.girthM * 0.34, depth: 0, unfold: 1,
    leafBud: p.species === "ALIEN_KELP" ? 0.4 : 0,
  });

  const ang = (p.branchAngleDeg * Math.PI) / 180;
  const n = st.branches;
  for (let i = 0; i < n; i++) {
    // where up the trunk, and which way around — golden angle phyllotaxis
    const u = 0.28 + (i / Math.max(1, p.maxBranches)) * 0.68;
    const theta = i * p.phyllotaxis + seed.variant * 6.283;
    const depth = i % 7 === 6 ? 2 : i % 3 === 2 ? 1 : 1;
    if (depth > maxDepth) continue;

    // unfolding is per-branch: later branches are still budding
    const need = (i + 1) / Math.max(1, p.maxBranches);
    const unfold = clamp01((st.scale - need * 0.82) / 0.16);
    if (unfold <= 0) continue;

    const base: [number, number, number] = [lean * H * u * 0.4, H * u, lean * H * u * 0.25];
    const L = H * (0.46 - u * 0.3) * (0.7 + hash1(i, 7) * 0.6) * unfold;
    const droop = p.species === "ALIEN_KELP" ? -0.5 : p.species === "FUNGAL_SPIRE" ? 0.1 : 0.14;
    const dx = Math.cos(theta) * Math.sin(ang), dz = Math.sin(theta) * Math.sin(ang);
    const dy = Math.cos(ang);

    out.push({
      p0: base,
      p1: [base[0] + dx * L * 0.35, base[1] + dy * L * 0.4, base[2] + dz * L * 0.35],
      p2: [base[0] + dx * L * 0.75, base[1] + dy * L * 0.78 + droop * L * 0.3, base[2] + dz * L * 0.75],
      p3: [base[0] + dx * L, base[1] + dy * L + droop * L, base[2] + dz * L],
      radius0: st.girthM * (0.42 - depth * 0.12) * unfold,
      radius1: st.girthM * (0.1 - depth * 0.02) * unfold,
      depth, unfold,
      leafBud: clamp01((st.scale - 0.3) / 0.4) * unfold * (1 - st.stress * 0.6),
    });
  }
  return out;
}

export function bezier(b: Branch, t: number): [number, number, number] {
  const u = 1 - t;
  const a = u * u * u, c = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return [
    a * b.p0[0] + c * b.p1[0] + d * b.p2[0] + e * b.p3[0],
    a * b.p0[1] + c * b.p1[1] + d * b.p2[1] + e * b.p3[1],
    a * b.p0[2] + c * b.p1[2] + d * b.p2[2] + e * b.p3[2],
  ];
}

/* ═══════════════════════════════════ 4 · SCATTERING & INSTANCE BUFFER ══ */

/**
 *  Seeds are not stored — they are DERIVED from the cell coordinate. A
 *  100,000-tree forest has no seed list anywhere in memory or on the wire;
 *  it has a density function and a hash. Walking into a new cell generates
 *  its flora in microseconds, and walking out frees it with no bookkeeping.
 */
export function scatterCell(
  cx: number, cz: number, cellM: number, planetSeed: number,
  density: (x: number, z: number) => number,
  species: (x: number, z: number) => Species,
  cartridgeHash: string,
): FloraSeed[] {
  const out: FloraSeed[] = [];
  const base = density((cx + 0.5) * cellM, (cz + 0.5) * cellM);
  const n = Math.floor(base * 24);
  for (let i = 0; i < n; i++) {
    const h1 = hash2i(cx * 73 + i, cz * 131, planetSeed);
    const h2 = hash2i(cx * 17, cz * 251 + i, planetSeed ^ 0x9e37);
    const h3 = hash2i(cx + i * 7, cz - i * 3, planetSeed ^ 0x51ed);
    const x = (cx + h1) * cellM;
    const z = (cz + h2) * cellM;
    if (density(x, z) < h3 * 0.9) continue;          // rejection → natural clumping
    out.push({
      x, z,
      // staggered germination: a forest is not all the same age. The spread
      // is ~10 simulated minutes, which at Stage-5 growth rates produces the
      // mixed-cohort canopy real forests have.
      plantedAt: Math.floor(h3 * 620 * 120),
      species: species(x, z),
      variant: hash2i(cx * 991 + i, cz * 379, planetSeed ^ 0x77),
      cartridgeHash,
    });
  }
  return out;
}

/** xyz · scaleY · girth · variant · stress · leafBud  (8 floats / instance) */
export const FLORA_STRIDE = 8;

export function packFloraInstances(
  seeds: readonly FloraSeed[], nowSec: number, climateAt: (x: number, z: number) => Climate,
  heightAt: (x: number, z: number) => number, out: Float32Array,
): number {
  let n = 0;
  for (const s of seeds) {
    if ((n + 1) * FLORA_STRIDE > out.length) break;
    const c = climateAt(s.x, s.z);
    const st = evaluatePlant(s, nowSec, s.plantedAt / 120, c);
    if (!st.alive || st.heightM < 0.05) continue;
    const o = n * FLORA_STRIDE;
    out[o] = s.x; out[o + 1] = heightAt(s.x, s.z); out[o + 2] = s.z;
    out[o + 3] = st.heightM; out[o + 4] = st.girthM;
    out[o + 5] = s.variant; out[o + 6] = st.stress;
    out[o + 7] = clamp01((st.scale - 0.3) / 0.4);
    n++;
  }
  return n;
}
