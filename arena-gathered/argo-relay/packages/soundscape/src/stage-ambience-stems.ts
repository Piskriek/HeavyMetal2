// ============================================================================
// File: packages/soundscape/src/stage-ambience-stems.ts
// Plans: Plan 15 (P1-SOUND-03 5-Stem Stage Ambience & P2-SOUND-06 Shepard Swell)
// Purity: 100% pure deterministic audio stem weights (zero-MB procedural synthesis).
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export interface StageAmbienceStemWeights {
  lab50HzHum0to1: number;
  stage0HelmetRespirator0to1: number;
  stage2CraterWind0to1: number;
  stage3WaterLapping0to1: number;
  stage4CanopyAndFauna0to1: number;
}

/**
 * Computes the 5 procedural ambience stem gains [0..1] from location and S = (Pxd, Vtx, Lx, Aq).
 */
export function evaluateStageAmbienceStems(
  isInsideLab: boolean,
  s: FourFloats,
  distanceToWaterM = 999.0
): StageAmbienceStemWeights {
  if (isInsideLab) {
    return {
      lab50HzHum0to1: 0.85,
      stage0HelmetRespirator0to1: 0.0,
      stage2CraterWind0to1: 0.0,
      stage3WaterLapping0to1: 0.0,
      stage4CanopyAndFauna0to1: 0.0,
    };
  }

  // Helmet respirator dominates in airless Stage 0-1 (Lx < 0.35), opening up at Stage 2+
  const stage0HelmetRespirator0to1 =
    s.Lx < 0.35 ? Number((1.0 - s.Lx / 0.35).toFixed(3)) : 0.0;

  // Atmospheric crater wind rises once Lx >= 0.25
  const stage2CraterWind0to1 =
    s.Lx >= 0.25 ? Number(Math.min(0.75, (s.Lx - 0.25) / 0.5).toFixed(3)) : 0.1;

  // Water lapping near hydro basins once Aq >= 0.40
  const waterProximity =
    distanceToWaterM < 35.0 ? 1.0 - distanceToWaterM / 35.0 : 0.2;
  const stage3WaterLapping0to1 =
    s.Aq >= 0.38
      ? Number((Math.min(1.0, (s.Aq - 0.38) / 0.45) * waterProximity).toFixed(3))
      : 0.0;

  // Conifer needles & distant strider/bird calls once Stage 4+ (minFloat >= 0.70)
  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx, s.Aq);
  const stage4CanopyAndFauna0to1 =
    minFloat >= 0.70 ? Number(Math.min(1.0, (minFloat - 0.70) / 0.20).toFixed(3)) : 0.0;

  return {
    lab50HzHum0to1: 0.0,
    stage0HelmetRespirator0to1,
    stage2CraterWind0to1,
    stage3WaterLapping0to1,
    stage4CanopyAndFauna0to1,
  };
}

/**
 * Evaluates the 6.0-second Shepard-tone / lush pad crescendo (P2-SOUND-06)
 * when a radial stage-upgrade scan-wave sweeps past the player.
 */
export function evaluateShepardStageSwell(elapsedSinceWaveTriggerSec: number): {
  active: boolean;
  swellGain0to1: number;
  baseFreqHz: number;
} {
  const DURATION = 6.0;
  if (elapsedSinceWaveTriggerSec < 0 || elapsedSinceWaveTriggerSec > DURATION) {
    return { active: false, swellGain0to1: 0, baseFreqHz: 110 };
  }
  const u = elapsedSinceWaveTriggerSec / DURATION;
  const swellGain0to1 = Number(Math.sin(u * Math.PI).toFixed(3));
  const baseFreqHz = Number((110.0 * Math.pow(2.0, u)).toFixed(2)); // 1-octave harmonic rise
  return { active: true, swellGain0to1, baseFreqHz };
}
