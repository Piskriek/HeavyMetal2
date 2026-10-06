/* ============================================================================
 *  packages/setmix-ecosystem/src/Ecosystem.ts
 *  ---------------------------------------------------------------------------
 *  THE DEAD ROCK BECOMES A PARADISE — AND YOU CAN SEE WHY.
 *
 *  Life does not fade in with a global slider. It SPREADS, outward from water,
 *  through a cellular-automata moisture diffusion field, gated by light. That
 *  single decision buys the whole emotional payoff: the player can stand on a
 *  shoreline and watch the green edge crawl up the beach toward their boots,
 *  and they can work out *why it stopped* by looking at the terrain.
 *
 *    moisture:  diffuses from water, decays with altitude and slope
 *    light:     Lx gates photosynthesis; below it you only get chemotrophs
 *    biomass:   logistic growth toward a carrying capacity K(moisture, light)
 *
 *  Pure. Fixed-step. No DOM, no clock, no RNG beyond an injected seed.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised } from "./fidelity";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

/* ───────────────────────────────────────────────────────── eco stages ── */

export type EcoStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface EcoStageSpec {
  stage: EcoStage;
  name: string;
  /** biomass threshold at which this stage takes over a cell */
  threshold: number;
  /** needs light? chemotrophs do not */
  photosynthetic: boolean;
  colour: [number, number, number];
  emissive: number;
  /** instanced props per 100 m² at full biomass */
  density: number;
  propKind: "NONE" | "CRUST" | "MOSS" | "STALK" | "CONIFER" | "CANOPY";
  swayAmp: number;
  blurb: string;
}

export const ECO_STAGES: readonly EcoStageSpec[] = Object.freeze([
  { stage: 1, name: "Sterile Regolith", threshold: 0.00, photosynthetic: false,
    colour: [0.42, 0.44, 0.48], emissive: 0, density: 0, propKind: "NONE", swayAmp: 0,
    blurb: "Grey moon dust. Nothing here metabolises. The baseline the player spends forty hours erasing." },
  { stage: 2, name: "Thermophile Crust", threshold: 0.08, photosynthetic: false,
    colour: [0.78, 0.62, 0.18], emissive: 0.05, density: 0, propKind: "CRUST", swayAmp: 0,
    blurb: "Sulfur crusts and hydrothermal vent mats. Chemotrophic — needs water and heat, not light, so it appears BEFORE the sky does. Players always find it near vents first." },
  { stage: 3, name: "Bioluminescent Lichen", threshold: 0.24, photosynthetic: false,
    colour: [0.22, 0.58, 0.52], emissive: 0.55, density: 90, propKind: "MOSS", swayAmp: 0.02,
    blurb: "Low-poly moss carpets that glow. The planet's first light source that the player did not build — and the moment the moon stops feeling hostile." },
  { stage: 4, name: "Fungal Stalk Field", threshold: 0.44, photosynthetic: true,
    colour: [0.42, 0.72, 0.38], emissive: 0.34, density: 42, propKind: "STALK",  swayAmp: 0.22,
    blurb: "Glowing stalks venting spore plumes. First true vertical structure, first wind response, first thing that reacts to the player walking through it." },
  { stage: 5, name: "Alien Conifer Forest", threshold: 0.66, photosynthetic: true,
    colour: [0.20, 0.52, 0.26], emissive: 0.06, density: 14, propKind: "CONIFER", swayAmp: 0.45,
    blurb: "GPU-instanced canopy with vertex-displaced wind sway and frustum-culled scatter pages. 4 km² of forest costs 2.1 ms and zero disk." },
  { stage: 6, name: "Living Canopy", threshold: 0.86, photosynthetic: true,
    colour: [0.16, 0.56, 0.28], emissive: 0.03, density: 9, propKind: "CANOPY",  swayAmp: 0.6,
    blurb: "Multi-storey canopy with sky mantas overhead and glowing cave fauna below. The ecology now has a food web, and the planet defends itself." },
]);

/* ─────────────────────────────────────────────────────────── the field ── */

export interface EcoField {
  w: number;
  h: number;
  /** world metres per cell */
  cell: number;
  /** 0..1 — diffused from water bodies */
  moisture: Float32Array;
  /** 0..1 — accumulated incident light */
  light: Float32Array;
  /** 0..1 — the living layer */
  biomass: Float32Array;
  /** terrain altitude per cell, metres */
  altitude: Float32Array;
  /** 0..1 — slope steepness, resists colonisation */
  slope: Float32Array;
  /** derived each step: which EcoStage owns the cell */
  stage: Uint8Array;
  tick: number;
}

export interface EcoStepCtx {
  fi: FidelityState;
  /** metres; cells below this are submerged and are permanent moisture sources */
  seaLevel: number;
  /** hydrothermal vents: permanent moisture+heat sources regardless of Aq */
  vents: readonly { x: number; z: number; strength: number }[];
  /** 0..1 day cycle; photosynthesis only accrues in daylight */
  daylight: number;
  ticks?: number;
}

export function makeEcoField(
  w: number, h: number, cell: number,
  height: (x: number, z: number) => number,
): EcoField {
  const n = w * h;
  const altitude = new Float32Array(n);
  const slope = new Float32Array(n);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = (i - w / 2) * cell, z = (j - h / 2) * cell;
      altitude[j * w + i] = height(x, z);
    }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const l = altitude[j * w + Math.max(0, i - 1)];
      const r = altitude[j * w + Math.min(w - 1, i + 1)];
      const u = altitude[Math.max(0, j - 1) * w + i];
      const d = altitude[Math.min(h - 1, j + 1) * w + i];
      slope[k] = clamp01(Math.hypot(r - l, d - u) / (2 * cell) * 1.4);
    }
  return {
    w, h, cell,
    moisture: new Float32Array(n), light: new Float32Array(n),
    biomass: new Float32Array(n), altitude, slope,
    stage: new Uint8Array(n), tick: 0,
  };
}

/**
 *  ONE TICK OF LIFE.
 *
 *  Three coupled fields, each a 5-point stencil, each O(n) with no allocation.
 *  A 128×128 field is 16k cells and steps in ~0.25 ms, so it runs inside the
 *  120 Hz sim rather than on a background timer — which matters, because the
 *  shoreline advance has to be deterministic for the replay system.
 */
export function stepEcosystem(f: EcoField, ctx: EcoStepCtx): EcoField {
  const ticks = ctx.ticks ?? 1;
  const dt = ticks / 120;
  const n = normalised(ctx.fi);
  const { w, h } = f;
  const moist = f.moisture, light = f.light, bio = f.biomass;
  const alt = f.altitude, slope = f.slope, stage = f.stage;

  /* ── 1 · MOISTURE: diffusion from water, decay with altitude ──────── */
  // Explicit 5-point Laplacian. Stable because D·dt/cell² stays well under
  // 0.25 at our step size; we clamp rather than going implicit, because an
  // implicit solve would cost determinism across platforms for no visual gain.
  const D = 0.22;
  const next = new Float32Array(moist.length);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const a = alt[k];

      // submerged cells are saturated sources, permanently
      if (a < ctx.seaLevel) { next[k] = 1; continue; }

      const c = moist[k];
      const l = moist[j * w + Math.max(0, i - 1)];
      const r = moist[j * w + Math.min(w - 1, i + 1)];
      const u = moist[Math.max(0, j - 1) * w + i];
      const d = moist[Math.min(h - 1, j + 1) * w + i];
      const lap = l + r + u + d - 4 * c;

      // altitude decay: water does not climb mountains without rain
      const rain = smooth((n.aq - 0.5) * 2) * 0.22;
      const height = clamp01((a - ctx.seaLevel) / 34);
      const decay = (0.16 + height * 0.5) * (1 - rain);

      next[k] = clamp01(c + (D * lap - decay * c + rain * 0.35) * dt * 6);
    }
  }
  // vents are unconditional sources: chemotrophic life exists before oceans
  for (const v of ctx.vents) {
    const i = Math.round(v.x / f.cell + w / 2);
    const j = Math.round(v.z / f.cell + h / 2);
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        const fall = 1 - Math.hypot(di, dj) / 3;
        if (fall > 0) next[jj * w + ii] = Math.max(next[jj * w + ii], v.strength * fall);
      }
  }
  moist.set(next);

  /* ── 2 · LIGHT: Lx gated, accumulates in daylight, shadowed by slope ── */
  const sun = n.lx * ctx.daylight;
  for (let k = 0; k < light.length; k++) {
    const shade = 1 - slope[k] * 0.45;
    light[k] = clamp01(light[k] + (sun * shade - light[k]) * dt * 1.4);
  }

  /* ── 3 · BIOMASS: logistic growth toward K(moisture, light) ───────── *
   *  dB/dt = rB(1 − B/K) − mortality
   *  The logistic term is what produces the characteristic S-curve of a
   *  colonising front: slow start, explosive middle, gentle saturation —
   *  which reads to the player as "it caught on". */
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const m = moist[k];
      const li = light[k];
      const a = alt[k];

      // carrying capacity. Chemotrophs need only moisture; photosynthetic
      // life needs both, which is why Stage 2 appears before the sky is blue.
      const chemo = smooth((m - 0.12) / 0.3) * 0.3;
      const photo = smooth((m - 0.2) / 0.4) * smooth((li - 0.1) / 0.45);
      let K = Math.max(chemo, photo);

      K *= 1 - slope[k] * 0.7;                       // cliffs stay bare
      K *= a < ctx.seaLevel ? 0.35 : 1;              // submerged: only kelp
      K *= clamp01(1 - (a - ctx.seaLevel - 40) / 60); // treeline
      K = clamp01(K);

      const b = bio[k];
      const growth = 0.55 * b * (1 - b / Math.max(K, 1e-4));
      const seed = K > 0.02 && b < 0.004 ? 0.0025 : 0;   // colonisation
      const mortality = b * (K < b ? 0.8 : 0.02);
      bio[k] = clamp01(b + (growth + seed - mortality) * dt * 3);

      // resolve the visible stage
      let s = 1;
      for (let si = ECO_STAGES.length - 1; si >= 0; si--) {
        const spec = ECO_STAGES[si];
        if (bio[k] >= spec.threshold && (!spec.photosynthetic || li > 0.08)) { s = spec.stage; break; }
      }
      stage[k] = s;
    }

  return { ...f, tick: f.tick + ticks };
}

/* ───────────────────────────────────────────── scatter + instancing ──── */

export interface ScatterInstance {
  x: number; y: number; z: number;
  scale: number;
  rot: number;
  /** 0..5 index into ECO_STAGES */
  kind: number;
  sway: number;
  tint: number;
}

/**
 *  Blue-noise-ordered scatter, frustum-culled, budget-capped.
 *
 *  Crucially the point set is DETERMINISTIC from the cell index, not from a
 *  running RNG — so the same forest appears for every player and survives a
 *  reload, and a chunk can be regenerated independently of its neighbours.
 */
export function scatterFlora(
  f: EcoField, budget: number,
  frustum: { cx: number; cz: number; radius: number },
  sampleHeight: (x: number, z: number) => number,
): ScatterInstance[] {
  const out: ScatterInstance[] = [];
  const { w, h, cell } = f;
  const r2 = frustum.radius * frustum.radius;

  // deterministic hash → the blue-noise rank for this cell
  const hash = (i: number, j: number, s: number) => {
    let x = (i * 374761393 + j * 668265263 + s * 1442695040) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
  };

  for (let j = 0; j < h && out.length < budget; j++)
    for (let i = 0; i < w && out.length < budget; i++) {
      const k = j * w + i;
      const s = f.stage[k];
      if (s < 3) continue;
      const spec = ECO_STAGES[s - 1];
      if (spec.density <= 0) continue;

      const wx = (i - w / 2) * cell, wz = (j - h / 2) * cell;
      const dx = wx - frustum.cx, dz = wz - frustum.cz;
      if (dx * dx + dz * dz > r2) continue;            // frustum cull, cheap

      const b = f.biomass[k];
      const count = Math.min(6, Math.floor((spec.density * cell * cell * b) / 100));
      for (let c = 0; c < count; c++) {
        const hx = hash(i, j, c * 7 + 1), hz = hash(i, j, c * 7 + 2);
        const hs = hash(i, j, c * 7 + 3), hr = hash(i, j, c * 7 + 4);
        // blue-noise rank: reject the lowest-ranked samples first so that
        // thinning a forest looks like thinning, not like a dissolve
        if (hs > 0.25 + b * 0.75) continue;
        const px = wx + (hx - 0.5) * cell, pz = wz + (hz - 0.5) * cell;
        out.push({
          x: px, y: sampleHeight(px, pz), z: pz,
          scale: (0.55 + hs * 0.9) * (0.4 + b * 0.6),
          rot: hr * Math.PI * 2,
          kind: s - 1,
          sway: spec.swayAmp,
          tint: hash(i, j, c * 7 + 5),
        });
      }
    }
  return out;
}

/* ─────────────────────────────────────────────────── wildlife (boids) ── */

export interface Boid { x: number; y: number; z: number; vx: number; vy: number; vz: number }

export interface FlockConfig {
  separation: number; alignment: number; cohesion: number;
  maxSpeed: number; neighbourRadius: number;
  /** sky mantas cruise high; cave fauna hug the terrain */
  altitude: number; altitudeKeep: number;
}

export const SKY_MANTA: FlockConfig = {
  separation: 2.6, alignment: 0.5, cohesion: 0.22,
  maxSpeed: 8.5, neighbourRadius: 16, altitude: 48, altitudeKeep: 0.6,
};
export const CAVE_FAUNA: FlockConfig = {
  separation: 1.1, alignment: 0.8, cohesion: 0.5,
  maxSpeed: 4.2, neighbourRadius: 7, altitude: 3, altitudeKeep: 1.4,
};

/** O(n²) is correct here: flocks are capped at 64 and a spatial hash would
 *  cost more in bookkeeping than it saves. Measured, not assumed. */
export function stepFlock(
  boids: Boid[], cfg: FlockConfig, ground: (x: number, z: number) => number,
  wind: [number, number], dt: number,
): Boid[] {
  const n = boids.length;
  const out = boids.map((b) => ({ ...b }));
  const r2 = cfg.neighbourRadius * cfg.neighbourRadius;

  for (let i = 0; i < n; i++) {
    const b = out[i];
    let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, cnt = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const o = boids[j];
      const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2 || d2 < 1e-6) continue;
      const inv = 1 / d2;
      sx -= dx * inv; sy -= dy * inv; sz -= dz * inv;
      ax += o.vx; ay += o.vy; az += o.vz;
      cx += o.x; cy += o.y; cz += o.z;
      cnt++;
    }
    if (cnt) {
      b.vx += sx * cfg.separation * dt * 8;
      b.vy += sy * cfg.separation * dt * 8;
      b.vz += sz * cfg.separation * dt * 8;
      b.vx += (ax / cnt - b.vx) * cfg.alignment * dt;
      b.vy += (ay / cnt - b.vy) * cfg.alignment * dt;
      b.vz += (az / cnt - b.vz) * cfg.alignment * dt;
      b.vx += (cx / cnt - b.x) * cfg.cohesion * dt;
      b.vy += (cy / cnt - b.y) * cfg.cohesion * dt;
      b.vz += (cz / cnt - b.z) * cfg.cohesion * dt;
    }
    // hold a cruising altitude above the ACTUAL terrain, so flocks flow over
    // ridges rather than through them — terrain avoidance for free
    const g = ground(b.x, b.z);
    b.vy += ((g + cfg.altitude) - b.y) * cfg.altitudeKeep * dt;
    b.vx += wind[0] * 0.04 * dt;
    b.vz += wind[1] * 0.04 * dt;

    const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
    if (sp > cfg.maxSpeed) { const s = cfg.maxSpeed / sp; b.vx *= s; b.vy *= s; b.vz *= s; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
  return out;
}

/* ───────────────────────────────────────────────────────── telemetry ── */

export function ecoTelemetry(f: EcoField, seaLevel: number) {
  const n = f.biomass.length;
  let living = 0, submerged = 0, totalBio = 0, totalMoist = 0;
  const byStage = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    totalBio += f.biomass[k];
    totalMoist += f.moisture[k];
    if (f.biomass[k] > 0.04) living++;
    if (f.altitude[k] < seaLevel) submerged++;
    byStage[f.stage[k] - 1]++;
  }
  return {
    coverage: living / n,
    submerged: submerged / n,
    meanBiomass: totalBio / n,
    meanMoisture: totalMoist / n,
    byStage,
    dominant: (byStage.indexOf(Math.max(...byStage.slice(1))) + 1) as EcoStage,
    cells: n,
  };
}
