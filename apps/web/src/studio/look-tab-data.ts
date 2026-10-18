// ============================================================================
// File: apps/web/src/studio/look-tab-data.ts
// Pure data types and stage/sky calculation helpers for the Studio Look tab (POL-87/93).
// Does NOT import CSS so Node unit tests can import this safely.
// ============================================================================

import {
  stageLook,
  type GroundStage,
} from '@hm/groundshader';
import { bakePlotBiome, type BiomeBake } from '@hm/plotbiome';
import { density as skyDensityOf, skyUniforms } from '@hm/sky';
import type { GenLevel } from '../assets/gen';

export interface LookFrame {
  readonly stage: number;
  readonly sunElevDeg: number;
  readonly sunDir: readonly [number, number, number];
  readonly ground: GroundStage & {
    readonly uStage: number;
    readonly coverOn: number;
    /** Human-readable colour quantisation readout ('12', '24', or 'Full (24-bit)' when levels === 0, POL-95). */
    readonly levelsLabel: string;
  };
  readonly sky: {
    readonly zenith: readonly [number, number, number];
    readonly horizon: readonly [number, number, number];
    readonly sunGlow: readonly [number, number, number];
    readonly sunColour: readonly [number, number, number];
    readonly density: number;
  };
  readonly assetLevel: GenLevel;
  /** Alias for assetLevel. */
  readonly level: GenLevel;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Maps a planetary fidelity stage (`0..6`) to the packed asset LOD (`low`, `mid`, `high`). */
export function stageAssetLevel(stage: number): GenLevel {
  const s = clamp(Number.isFinite(stage) ? stage : 0, 0, 6);
  if (s < 2) return 'low';
  if (s < 4) return 'mid';
  return 'high';
}

/**
 * Pure helper (TICKET-08b Item A):
 * Returns the uniform values for the ground (`stageLook`), the sky (`skyUniforms` + `density`),
 * the unit sun direction vector, and the asset level (`low` | `mid` | `high`) for a given
 * planetary stage (`0..6`) and sun elevation angle in degrees (`-90..90`).
 */
export function lookFrame(stage: number, sunElevDeg: number, sunAzimuthDeg = 35): LookFrame {
  const clampedStage = clamp(Number.isFinite(stage) ? stage : 0, 0, 6);
  const clampedElev = clamp(Number.isFinite(sunElevDeg) ? sunElevDeg : 32, -90, 90);
  const elevRad = (clampedElev * Math.PI) / 180;
  const azRad = ((Number.isFinite(sunAzimuthDeg) ? sunAzimuthDeg : 35) * Math.PI) / 180;

  const cosE = Math.cos(elevRad);
  const sinE = Math.sin(elevRad);
  const sunDir: readonly [number, number, number] = [
    cosE * Math.cos(azRad),
    sinE,
    cosE * Math.sin(azRad),
  ];

  const g = stageLook(clampedStage);
  const s = skyUniforms(sunDir, clampedStage);
  const dens = skyDensityOf(clampedStage);
  const assetLevel = stageAssetLevel(clampedStage);

  return {
    stage: clampedStage,
    sunElevDeg: clampedElev,
    sunDir,
    ground: {
      ...g,
      uStage: Math.max(1, Math.min(6, clampedStage)),
      coverOn: clampedStage >= 2 ? 1 : 0,
      levelsLabel: g.levels > 0 ? String(Math.round(g.levels)) : 'Full (24-bit)',
    },
    sky: {
      zenith: s.zenith,
      horizon: s.horizon,
      sunGlow: s.sunGlow,
      sunColour: s.sunColour,
      density: dens,
    },
    assetLevel,
    level: assetLevel,
  };
}

export const PATCH_CELLS = 32;
export const PATCH_CELL_M = 1.25;
export const PATCH_SPAN = PATCH_CELLS * PATCH_CELL_M;

/** Bakes a deterministic `@hm/plotbiome` coverage mask for the Studio Look test plot. */
export function bakeLookTestCoverage(stage: number, seed = 42): {
  readonly bake: BiomeBake;
  readonly height: Float32Array;
  readonly water: Uint8Array;
  readonly n: number;
  readonly cellM: number;
  readonly x0: number;
  readonly z0: number;
  readonly span: number;
} {
  const n = PATCH_CELLS;
  const cellM = PATCH_CELL_M;
  const span = PATCH_SPAN;
  const x0 = -span / 2;
  const z0 = -span / 2;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);
  const clampedStage = clamp(stage, 0, 6);

  for (let j = 0; j < n; j++) {
    const z = z0 + (j + 0.5) * cellM;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * cellM;
      const r = Math.hypot(x, z);
      const apron = Math.min(1, Math.max(0, (r - 3.5) / 8));
      const h = apron * (0.45 * Math.sin(x * 0.19) * Math.cos(z * 0.17) + 0.25 * Math.cos((x + z) * 0.14));
      height[j * n + i] = h;
      // Small pond near (6.5, -5.5) in centered coords
      if (Math.hypot(x - 6.5, z + 5.5) <= 4.2) {
        water[j * n + i] = 255;
      }
    }
  }

  const tier = clampedStage >= 4 ? "high" : clampedStage >= 2 ? "mid" : "low";
  const sMetric = clamp(clampedStage / 6, 0, 1);
  const bake = bakePlotBiome({
    n,
    cellM,
    height,
    water,
    stage: clampedStage,
    s: { pxd: sMetric, vtx: sMetric, lx: sMetric, aq: sMetric },
    machines: [{ x: span / 2, z: span / 2, r: 2.8 }],
    keepouts: [],
    seed,
    tier,
  });

  return { bake, height, water, n, cellM, x0, z0, span };
}
