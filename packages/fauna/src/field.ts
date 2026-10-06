// The animals of a terraformed world as population densities on a coarse grid (from the SetMix Arena drop):
// Lotka-Volterra with logistic limits; carrying capacity follows the flora, so green land fills with herds by itself.
import { clamp } from "./util";

/* ═══════════════════════════════════════════════════ 1 · THE SPECIES ══ */

export type FaunaId = "MOON_STRIDER" | "CRYSTAL_TORTOISE" | "SKY_MANTA" | "GLIMMER_SHOAL";
export type Trophic = "GRAZER" | "BROWSER" | "PREDATOR" | "FILTER";
export type Gait = "WALK" | "TROT" | "GALLOP" | "GLIDE" | "SWIM";

export interface FaunaSpec {
  id: FaunaId;
  label: string;
  trophic: Trophic;
  legs: 0 | 4 | 6;
  /** intrinsic growth rate r, per simulated hour */
  r: number;
  /** carrying capacity per km² at biomass 1.0 */
  K: number;
  /** Lotka-Volterra predation coefficient against its prey */
  predation: number;
  preyOf: FaunaId | null;
  bodyM: number;
  legLenM: number;
  speedMs: number;
  /** boid weights */
  cohesion: number;
  separation: number;
  alignment: number;
  /** metres — flees when the player is closer than this */
  fleeRadiusM: number;
  /** nocturnal creatures invert the sleep curve */
  nocturnal: boolean;
  colour: string;
  /** minimum Aq for this species to exist at all */
  aqFloor: number;
}

export const FAUNA: Readonly<Record<FaunaId, FaunaSpec>> = Object.freeze({
  MOON_STRIDER: {
    id: "MOON_STRIDER", label: "Moon Strider", trophic: "GRAZER", legs: 4,
    r: 0.42, K: 140, predation: 0, preyOf: null,
    bodyM: 2.1, legLenM: 1.5, speedMs: 6.2,
    cohesion: 0.9, separation: 1.5, alignment: 1.1, fleeRadiusM: 34,
    nocturnal: false, colour: "#d8a24a", aqFloor: 0.1,
  },
  CRYSTAL_TORTOISE: {
    id: "CRYSTAL_TORTOISE", label: "Crystal Tortoise", trophic: "BROWSER", legs: 6,
    r: 0.14, K: 38, predation: 0, preyOf: null,
    bodyM: 3.4, legLenM: 0.8, speedMs: 1.1,
    cohesion: 0.25, separation: 2.2, alignment: 0.2, fleeRadiusM: 12,
    nocturnal: false, colour: "#6ee7ff", aqFloor: 0.05,
  },
  SKY_MANTA: {
    id: "SKY_MANTA", label: "Sky Manta", trophic: "PREDATOR", legs: 0,
    r: 0.18, K: 22, predation: 0.0065, preyOf: "MOON_STRIDER",
    bodyM: 5.2, legLenM: 0, speedMs: 11.5,
    cohesion: 1.4, separation: 1.0, alignment: 1.8, fleeRadiusM: 0,
    nocturnal: true, colour: "#b46bff", aqFloor: 0.18,
  },
  GLIMMER_SHOAL: {
    id: "GLIMMER_SHOAL", label: "Glimmer Shoal", trophic: "FILTER", legs: 0,
    r: 0.95, K: 420, predation: 0, preyOf: null,
    bodyM: 0.35, legLenM: 0, speedMs: 3.4,
    cohesion: 2.6, separation: 1.8, alignment: 2.4, fleeRadiusM: 9,
    nocturnal: false, colour: "#3dc8ff", aqFloor: 0.5,
  },
});

/* ═════════════════════════════════ 2 · THE MACROSCOPIC DENSITY FIELD ══ */

export interface DensityField {
  res: number;
  /** metres covered per cell */
  cellM: number;
  /** world origin of cell (0,0) */
  ox: number;
  oz: number;
  /** individuals per cell, per species */
  n: Record<FaunaId, Float32Array>;
  tick: number;
}

export function makeField(res = 48, cellM = 512, ox = 0, oz = 0): DensityField {
  const mk = () => new Float32Array(res * res);
  return {
    res, cellM, ox, oz, tick: 0,
    n: {
      MOON_STRIDER: mk(), CRYSTAL_TORTOISE: mk(),
      SKY_MANTA: mk(), GLIMMER_SHOAL: mk(),
    },
  };
}

export interface EcoCtx {
  /** 0..1 biomass available at a world point — from the flora cycle */
  biomass: (x: number, z: number) => number;
  /** 0..1 water at a world point */
  water: (x: number, z: number) => number;
  /** 0..1 normalised Aq, gates which species can exist */
  aq: number;
  /** simulated hours elapsed this step */
  dtHours: number;
}

/**
 *  LOTKA-VOLTERRA WITH LOGISTIC SELF-LIMITING, per cell:
 *
 *      dN/dt = r·N·(1 − N/K)  −  α·N·P
 *      dP/dt = β·α·N·P  −  m·P
 *
 *  K is not a constant: it is the local biomass the flora cycle produced.
 *  That is the whole coupling — terraform a valley green and herds appear in
 *  it two simulated days later without anyone writing a spawn rule.
 *
 *  Diffusion (migration) is a 5-point Laplacian, which is what makes herds
 *  spread into newly-fertile land rather than teleporting there.
 */
export function stepField(f: DensityField, ctx: EcoCtx): DensityField {
  const { res, cellM } = f;
  const out: Record<FaunaId, Float32Array> = {
    MOON_STRIDER: new Float32Array(res * res),
    CRYSTAL_TORTOISE: new Float32Array(res * res),
    SKY_MANTA: new Float32Array(res * res),
    GLIMMER_SHOAL: new Float32Array(res * res),
  };
  const ids = Object.keys(FAUNA) as FaunaId[];
  const km2 = (cellM * cellM) / 1e6;

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      const wx = f.ox + (i + 0.5) * cellM;
      const wz = f.oz + (j + 0.5) * cellM;
      const bio = ctx.biomass(wx, wz);
      const wat = ctx.water(wx, wz);

      for (const id of ids) {
        const s = FAUNA[id];
        const N = f.n[id][k]!;
        if (ctx.aq < s.aqFloor) { out[id][k] = N * 0.96; continue; }

        // carrying capacity follows the flora; filter feeders follow water
        const resource = s.trophic === "FILTER" ? wat : bio;
        const K = Math.max(0.01, s.K * km2 * resource);

        let dN = s.r * N * (1 - N / K);

        // predation: predators eat their prey, and convert it at 12%
        if (s.preyOf) {
          const prey = f.n[s.preyOf][k]!;
          const eaten = s.predation * prey * N;
          dN += eaten * 0.12 - N * 0.08;            // conversion − mortality
          out[s.preyOf][k]! -= eaten * ctx.dtHours;
        }

        // migration: 5-point Laplacian × mobility
        const mob = s.speedMs * 0.0016;
        const nb =
          (f.n[id][j * res + Math.max(0, i - 1)]! +
           f.n[id][j * res + Math.min(res - 1, i + 1)]! +
           f.n[id][Math.max(0, j - 1) * res + i]! +
           f.n[id][Math.min(res - 1, j + 1) * res + i]!) * 0.25;
        dN += (nb - N) * mob;

        // a species never goes fully extinct where its resource exists —
        // a trickle of recolonisation keeps the world from dying silently
        const floor = resource > 0.25 ? 0.015 * km2 : 0;
        out[id][k]! += Math.max(floor, N + dN * ctx.dtHours);
      }
    }
  }
  for (const id of ids) for (let k = 0; k < out[id].length; k++) out[id][k] = Math.max(0, out[id][k]!);
  return { ...f, n: out, tick: f.tick + Math.round(ctx.dtHours * 3600 * 120) };
}

export function densityAt(f: DensityField, id: FaunaId, x: number, z: number): number {
  const i = clamp(Math.floor((x - f.ox) / f.cellM), 0, f.res - 1);
  const j = clamp(Math.floor((z - f.oz) / f.cellM), 0, f.res - 1);
  return f.n[id][j * f.res + i]!;
}

export function totalPopulation(f: DensityField, id: FaunaId): number {
  let s = 0;
  const a = f.n[id];
  for (let i = 0; i < a.length; i++) s += a[i]!;
  return s;
}
