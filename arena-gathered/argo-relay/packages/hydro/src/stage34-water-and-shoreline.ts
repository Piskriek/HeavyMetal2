// ============================================================================
// File: packages/hydro/src/stage34-water-and-shoreline.ts
// Plans: Plan 01 & Plan 14 (@hm/hydro Stage 3-6 Water Table, Gerstner Waves & Coverage Creep)
// Rules: Rule 1 & DEC-01 (Driven strictly by S = Pxd, Vtx, Lx, Aq; zero 5th float)
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export interface HydroSurfaceSample {
  hasWater: boolean;
  waterSurfaceY: number;
  waterDepthM: number;
  shorelineWetness0to1: number;
  shorelineRoughness: number;
  causticIntensity0to1: number;
  coverageCreep0to1: number;
}

/**
 * Computes the global water table elevation (in meters relative to Gate pad y = 0)
 * from Aquatic Level (Aq). Water begins pooling at Aq >= 0.35 in the -3.65m eastern basin
 * and reaches -1.25m at Aq >= 0.85.
 */
export function computeWaterTableY(Aq: number): { hasWater: boolean; baseWaterY: number } {
  if (Aq < 0.35) {
    return { hasWater: false, baseWaterY: -4.0 };
  }
  const t = Math.min(1.0, (Aq - 0.35) / 0.50);
  const baseWaterY = -3.65 + t * 2.40; // Rises from -3.65m to -1.25m
  return { hasWater: true, baseWaterY };
}

/**
 * Evaluates Gerstner wave height offset, shoreline wetness/roughness gradient,
 * and coverage creep density (09-sheet-coverage-growth.png) at world (x, terrainY, z).
 */
export function sampleHydroAndCoverageAtPoint(
  x: number,
  terrainY: number,
  z: number,
  s: FourFloats,
  timeSec: number,
  nearestMachineDistanceM = 999.0
): HydroSurfaceSample {
  const { hasWater, baseWaterY } = computeWaterTableY(s.Aq);

  // Two-octave deterministic Gerstner wave ripple
  const wave1 = Math.sin(x * 0.65 + timeSec * 1.8) * Math.cos(z * 0.55 + timeSec * 1.4) * 0.045;
  const wave2 = Math.sin((x - z) * 1.3 - timeSec * 2.6) * 0.02;
  const waterSurfaceY = hasWater ? baseWaterY + (wave1 + wave2) * Math.min(1.0, s.Aq) : -999.0;

  const waterDepthM = hasWater ? Math.max(0.0, waterSurfaceY - terrainY) : 0.0;

  // Wet-shoreline band extends 3.2m vertically above waterSurfaceY
  const heightAboveWater = terrainY - waterSurfaceY;
  const shorelineWetness0to1 =
    !hasWater || heightAboveWater < 0.0 || heightAboveWater > 3.2
      ? waterDepthM > 0
        ? 1.0
        : 0.0
      : Math.pow(1.0 - heightAboveWater / 3.2, 1.8);

  // Wet basalt/soil drops roughness from 0.82 (dry) down to 0.18 (glistening wet shoreline)
  const shorelineRoughness = 0.82 - shorelineWetness0to1 * 0.64;

  // Caustics bloom in shallow water (depth 0.1m .. 2.8m) when Lx >= 0.50
  const causticIntensity0to1 =
    waterDepthM > 0.05 && waterDepthM < 3.0 && s.Lx >= 0.45
      ? Math.min(1.0, (s.Lx - 0.45) / 0.45) *
        (0.6 + 0.4 * Math.sin(x * 2.1 + z * 1.9 + timeSec * 3.2))
      : 0.0;

  // Sheet 09 Coverage Creep: nucleates around shorelines AND within 18m of running machines
  // once Aq >= 0.40 and Lx >= 0.45, locking across the whole crater at Stage 5-6 (meanS >= 0.70)
  const bioReadiness =
    s.Aq >= 0.38 && s.Lx >= 0.40
      ? Math.min(1.0, ((s.Aq - 0.38) / 0.47) * ((s.Lx - 0.40) / 0.45))
      : 0.0;

  const machineTendril =
    nearestMachineDistanceM < 18.0 ? 1.0 - nearestMachineDistanceM / 18.0 : 0.0;
  const shoreTendril =
    hasWater && heightAboveWater >= 0.0 && heightAboveWater < 14.0
      ? 1.0 - heightAboveWater / 14.0
      : 0.0;

  const coverageCreep0to1 = Math.min(
    1.0,
    bioReadiness * Math.max(0.35, Math.max(machineTendril, shoreTendril) + bioReadiness * 0.65)
  );

  return {
    hasWater: waterDepthM > 0.0,
    waterSurfaceY,
    waterDepthM,
    shorelineWetness0to1,
    shorelineRoughness,
    causticIntensity0to1,
    coverageCreep0to1,
  };
}
