/* ============================================================================
 *  packages/setmix-flora/src/{ProceduralFlora,GrassMaterial}.ts
 *  ---------------------------------------------------------------------------
 *  LIFE AS A CLOSED-FORM FUNCTION OF TIME.
 *
 *  A tree in SetMix is not a prop that was placed. It is a SEED — six numbers —
 *  plus the current tick. Its height, girth, branch count, canopy volume and
 *  leaf colour are all evaluated from τ = t − t_planted on demand, which means:
 *
 *    · a 100,000-tree forest costs 100,000 × 24 bytes of seeds, not meshes
 *    · growth needs no per-frame CPU: the vertex shader evaluates the curve
 *    · two players scrubbing to the same tick see the same forest, exactly
 *    · you can fast-forward a continent 200 years and it is O(1)
 *
 *  Pure. No clock, no RNG, no allocation in the hot path.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised } from "./fidelity";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

/* ───────────────────────────────── deterministic hash (no Math.random) ── */

export function hash2i(x: number, y: number, s = 0): number {
  let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function hash1(i: number, s = 0): number {
  let n = (i * 668265263 + s * 374761393) | 0;
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967295;
}

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

/* ═══════════════════════════════ 5 · FLORA VERTEX SHADER (GPU growth) ══ */

export const FLORA_VERT = /* glsl */ `
// per-vertex: the UNIT tree. Every vertex carries where it sits in the plant.
in vec3  a_pos;          // position on the unit plant (y ∈ [0,1])
in float a_branchIndex;  // which branch this vertex belongs to
in float a_alongBranch;  // 0..1 along the branch
in float a_isLeaf;

// per-instance: 8 floats, written by packFloraInstances
in vec3  i_world;
in float i_height;
in float i_girth;
in float i_variant;
in float i_stress;
in float i_leafBud;

uniform mat4  u_viewProj;
uniform float u_time;
uniform vec3  u_wind;        // xz direction, y = strength
uniform float u_maxBranches;
uniform vec3  u_barkColour;
uniform vec3  u_leafColour;

out vec3 v_colour;
out float v_ao;

void main(){
  // BRANCH UNFOLDING, evaluated per-vertex on the GPU. The CPU never knows
  // how many branches are visible; it just uploads scale.
  float need   = (a_branchIndex + 1.0) / u_maxBranches;
  float unfold = clamp((i_height / 14.0 - need * 0.82) / 0.16, 0.0, 1.0);
  if (a_branchIndex > 0.5 && unfold <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // degenerate: clipped, free
    return;
  }

  vec3 p = a_pos;
  p.y   *= i_height;
  p.xz  *= i_girth * mix(1.0, 0.25, a_alongBranch);
  p     *= mix(1.0, unfold, step(0.5, a_branchIndex));

  // wind: amplitude grows with height², phase offset per instance so a
  // forest never sways in lockstep
  float sway = u_wind.y * pow(p.y / max(i_height, 0.001), 2.0) * i_height * 0.045;
  float ph   = u_time * 1.3 + i_variant * 31.4 + i_world.x * 0.04 + i_world.z * 0.03;
  p.x += sin(ph) * sway * u_wind.x;
  p.z += cos(ph * 0.87) * sway * u_wind.z;
  // leaves flutter at a higher harmonic
  p += a_isLeaf * vec3(sin(ph * 4.1), cos(ph * 3.3), sin(ph * 3.7)) * sway * 0.4;

  vec3 world = i_world + p;

  vec3 leaf = mix(u_leafColour, vec3(0.74, 0.46, 0.14), i_stress);  // autumn = stress
  v_colour  = mix(u_barkColour, leaf, a_isLeaf * i_leafBud);
  v_ao      = mix(0.55, 1.0, clamp(p.y / max(i_height, 0.001), 0.0, 1.0));

  gl_Position = u_viewProj * vec4(world, 1.0);
}`;

/* ════════════════════════════════════════ 6 · GRASS: WIND + WAKE ══ */

export interface GrassConfig {
  bladesPerM2: number;
  heightM: number;
  /** metres — Gerstner wavelength of the big rolling gusts */
  gustWavelength: number;
  gustSpeed: number;
  /** resolution of the dynamic flow canvas */
  wakeResolution: number;
  /** metres covered by the wake canvas, centred on the player */
  wakeExtentM: number;
  /** seconds for a flattened blade to spring back */
  recoverySec: number;
}

export const GRASS_DEFAULT: GrassConfig = {
  bladesPerM2: 42, heightM: 0.55, gustWavelength: 34, gustSpeed: 6.2,
  wakeResolution: 256, wakeExtentM: 64, recoverySec: 2.4,
};

/**
 *  THE WAKE CANVAS
 *  A single R8 texture centred on the player. Agents stamp a soft radial
 *  dent; every frame the whole canvas relaxes back toward zero. The grass
 *  shader reads it as a displacement field.
 *
 *  Why a canvas and not per-blade state: a blade has no identity. There are
 *  four million of them and they are generated in the vertex shader from
 *  gl_InstanceID. The only thing with identity is the DENT, and dents are
 *  sparse — so we store the sparse thing.
 */
export interface WakeField {
  res: number;
  extentM: number;
  data: Float32Array;
  /** world centre of the canvas */
  cx: number;
  cz: number;
}

export function makeWake(cfg: GrassConfig = GRASS_DEFAULT): WakeField {
  return {
    res: cfg.wakeResolution, extentM: cfg.wakeExtentM,
    data: new Float32Array(cfg.wakeResolution * cfg.wakeResolution), cx: 0, cz: 0,
  };
}

export function stampWake(
  w: WakeField, x: number, z: number, radiusM: number, strength = 1,
): void {
  const half = w.extentM / 2;
  const u = ((x - w.cx + half) / w.extentM) * w.res;
  const v = ((z - w.cz + half) / w.extentM) * w.res;
  const rp = (radiusM / w.extentM) * w.res;
  const x0 = Math.max(0, Math.floor(u - rp)), x1 = Math.min(w.res - 1, Math.ceil(u + rp));
  const z0 = Math.max(0, Math.floor(v - rp)), z1 = Math.min(w.res - 1, Math.ceil(v + rp));
  for (let j = z0; j <= z1; j++)
    for (let i = x0; i <= x1; i++) {
      const d = Math.hypot(i - u, j - v) / Math.max(1e-3, rp);
      if (d > 1) continue;
      const f = (1 - d * d) * strength;
      const k = j * w.res + i;
      if (f > w.data[k]) w.data[k] = Math.min(1, f);
    }
}

/** Exponential relaxation — springs back, never snaps. */
export function relaxWake(w: WakeField, dt: number, cfg: GrassConfig = GRASS_DEFAULT): void {
  const k = Math.exp(-dt / cfg.recoverySec);
  const d = w.data;
  for (let i = 0; i < d.length; i++) d[i] *= k;
}

/** Re-centre on the player; shifting by whole texels keeps it artefact-free. */
export function recentreWake(w: WakeField, x: number, z: number): void {
  const texel = w.extentM / w.res;
  const nx = Math.round(x / texel) * texel;
  const nz = Math.round(z / texel) * texel;
  const dx = Math.round((nx - w.cx) / texel);
  const dz = Math.round((nz - w.cz) / texel);
  if (!dx && !dz) return;
  const src = w.data.slice();
  w.data.fill(0);
  for (let j = 0; j < w.res; j++) {
    const sj = j + dz;
    if (sj < 0 || sj >= w.res) continue;
    for (let i = 0; i < w.res; i++) {
      const si = i + dx;
      if (si < 0 || si >= w.res) continue;
      w.data[j * w.res + i] = src[sj * w.res + si];
    }
  }
  w.cx = nx; w.cz = nz;
}

export const GRASS_VERT = /* glsl */ `
// ONE unit blade, instanced four million times. There is no blade buffer:
// position comes from gl_InstanceID hashed into the cell, which means the
// entire prairie costs 6 vertices of VRAM.
in vec3  a_blade;        // unit blade, y ∈ [0,1]
uniform mat4  u_viewProj;
uniform vec2  u_patchOrigin;
uniform float u_patchSizeM;
uniform float u_bladesPerRow;
uniform float u_time;
uniform float u_heightM;
uniform vec2  u_windDir;
uniform float u_windStrength;
uniform float u_gustWavelength;
uniform float u_gustSpeed;
uniform sampler2D u_wake;     // R channel, 0 = upright, 1 = flattened
uniform vec2  u_wakeCentre;
uniform float u_wakeExtent;
uniform vec3  u_colourBase;
uniform vec3  u_colourTip;
uniform float u_aq;           // Hydrology → lushness
out vec3 v_colour;
out float v_bend;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main(){
  float id = float(gl_InstanceID);
  vec2 cell = vec2(mod(id, u_bladesPerRow), floor(id / u_bladesPerRow));
  vec2 jitter = vec2(h21(cell), h21(cell + 7.3)) - 0.5;
  vec2 world2 = u_patchOrigin + (cell + 0.5 + jitter) * (u_patchSizeM / u_bladesPerRow);

  float rnd = h21(world2 * 0.37);
  float h   = u_heightM * (0.55 + rnd * 0.9) * clamp(u_aq * 1.6, 0.25, 1.0);

  // ── GERSTNER GUST: two crossed trains so the field never looks striped
  float k1 = 6.2831853 / u_gustWavelength;
  float k2 = 6.2831853 / (u_gustWavelength * 0.61);
  float ph1 = dot(world2, normalize(u_windDir)) * k1 - u_time * u_gustSpeed * k1;
  float ph2 = dot(world2, normalize(u_windDir + vec2(0.6, -0.4))) * k2 - u_time * u_gustSpeed * k2 * 1.3;
  float gust = (sin(ph1) * 0.65 + sin(ph2) * 0.35) * 0.5 + 0.5;
  float bend = gust * u_windStrength * (0.35 + rnd * 0.3);

  // ── WAKE: sample the dynamic flow canvas
  vec2 wuv = (world2 - u_wakeCentre) / u_wakeExtent + 0.5;
  float wake = (wuv.x >= 0.0 && wuv.x <= 1.0 && wuv.y >= 0.0 && wuv.y <= 1.0)
             ? texture(u_wake, wuv).r : 0.0;
  bend = max(bend, wake * 1.55);

  // quadratic bend: the tip travels, the base does not
  vec3 p = a_blade;
  float t = p.y;
  p.y *= h * (1.0 - wake * 0.45);
  p.x *= 0.016 * (1.0 - t * 0.85);
  vec2 dir = normalize(u_windDir + vec2(rnd - 0.5) * 0.5);
  p.xz += dir * bend * t * t * h;

  v_bend   = bend;
  v_colour = mix(u_colourBase, u_colourTip, t) * (1.0 - wake * 0.22);
  gl_Position = u_viewProj * vec4(vec3(world2.x, 0.0, world2.y) + p, 1.0);
}`;

/* ═══════════════════════════════════ 7 · THE HYDROLOGICAL CYCLE ══ */

export interface CycleState {
  /** 0..1 — water held in the atmosphere */
  humidity: number;
  /** 0..1 — cloud cover, lags humidity */
  cloud: number;
  /** mm/s falling now */
  rainfall: number;
  /** 0..1 — soil moisture, the thing flora actually reads */
  soilMoisture: number;
  /** 0..1 — standing water / lake level contribution */
  surfaceWater: number;
  /** total biomass, which feeds back into evapotranspiration */
  biomass: number;
  tick: number;
}

/**
 *  THE UNBROKEN LOOP, as four coupled ODEs:
 *
 *      evaporation   ∝ Lx · surfaceWater · (1 − humidity)
 *      condensation  ∝ max(0, humidity − dewPoint)
 *      infiltration  ∝ rainfall · (1 − soilSaturation)
 *      transpiration ∝ biomass · soilMoisture · Lx
 *
 *  Sun lifts water, water becomes cloud, cloud becomes rain, rain feeds
 *  soil, soil grows flora, flora transpires back into humidity — and more
 *  flora means more rain, which is why a terraformed continent gets WETTER
 *  as it gets greener. The player discovers positive feedback by causing it.
 */
export function stepCycle(c: CycleState, fi: FidelityState, dtSec: number): CycleState {
  const n = normalised(fi);
  const lx = n.lx, aq = n.aq;

  const surfaceWater = clamp01(aq * 1.15);
  const evaporation = lx * surfaceWater * (1 - c.humidity) * 0.055;
  const transpiration = c.biomass * c.soilMoisture * lx * 0.018;

  const dewPoint = 0.62 - lx * 0.1;
  const condensation = Math.max(0, c.humidity - dewPoint) * 0.42;
  const cloud = c.cloud + (clamp01(c.humidity * 1.3) - c.cloud) * 0.25 * dtSec;
  const rainfall = condensation * cloud * 3.2;

  const humidity = clamp01(c.humidity + (evaporation + transpiration - condensation) * dtSec);
  const infiltration = rainfall * (1 - c.soilMoisture) * 0.9;
  const drainage = c.soilMoisture * (0.012 + lx * 0.02);
  const soilMoisture = clamp01(c.soilMoisture + (infiltration - drainage - transpiration * 0.4) * dtSec);

  // biomass grows where soil is wet and lit, and decays otherwise
  const growth = soilMoisture * lx * 0.03 - c.biomass * 0.004;
  const biomass = clamp01(c.biomass + growth * dtSec);

  return {
    humidity, cloud: clamp01(cloud), rainfall, soilMoisture,
    surfaceWater, biomass, tick: c.tick + Math.round(dtSec * 120),
  };
}

export function initialCycle(): CycleState {
  return { humidity: 0.08, cloud: 0, rainfall: 0, soilMoisture: 0.05, surfaceWater: 0, biomass: 0.01, tick: 0 };
}
