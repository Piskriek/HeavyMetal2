// ============================================================================
// File: packages/particles/src/stage-roost-and-footsteps.ts
// Plan: Plan 17 (P2-VFX-05 Stage-Reactive Footstep & Rover Tire Roost Particles)
// Rules: Rule 20 (2,048 Low / 8,192 High instanced mesh pool cap)
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';
import type { GraphicsQualityTier } from '../../groundshader/src/radial-scan-wave';

export type RoostSurfaceStyle =
  | 'stage0-1bit-pixels'
  | 'stage12-regolith-dust'
  | 'stage3-hydro-splash'
  | 'stage46-meadow-flecks';

export interface RoostBurstSpec {
  style: RoostSurfaceStyle;
  particleCount: number;
  primaryHex: number;
  secondaryHex: number;
  upwardVelocityMps: number;
  lifetimeSec: number;
}

export function getGlobalParticlePoolCap(tier: GraphicsQualityTier): number {
  return tier === 'low' ? 2048 : tier === 'medium' ? 4096 : 8192;
}

/**
 * Computes the stage-authentic particle burst when boots or rover tires kick up terrain.
 */
export function evaluateRoostBurst(
  s: FourFloats,
  isInWaterBasin: boolean,
  speedMps: number,
  isRoverTire: boolean
): RoostBurstSpec {
  const baseCount = isRoverTire
    ? Math.min(24, Math.max(4, Math.round(speedMps * 1.6)))
    : 5;

  if (isInWaterBasin && s.Aq >= 0.35) {
    return {
      style: 'stage3-hydro-splash',
      particleCount: baseCount + 4,
      primaryHex: 0x3dc8ff,
      secondaryHex: 0xe8eef5,
      upwardVelocityMps: isRoverTire ? 4.2 : 2.1,
      lifetimeSec: 0.55,
    };
  }

  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx, s.Aq);
  if (minFloat >= 0.65) {
    return {
      style: 'stage46-meadow-flecks',
      particleCount: baseCount,
      primaryHex: 0x7cff4d,
      secondaryHex: 0x5c4332,
      upwardVelocityMps: isRoverTire ? 3.5 : 1.6,
      lifetimeSec: 0.65,
    };
  }

  if (s.Pxd < 0.15 && s.Lx < 0.15) {
    return {
      style: 'stage0-1bit-pixels',
      particleCount: baseCount,
      primaryHex: 0xe8eef5,
      secondaryHex: 0x050608,
      upwardVelocityMps: isRoverTire ? 3.8 : 1.8,
      lifetimeSec: 0.45,
    };
  }

  return {
    style: 'stage12-regolith-dust',
    particleCount: baseCount,
    primaryHex: 0x8c7b6b,
    secondaryHex: 0x4a5568,
    upwardVelocityMps: isRoverTire ? 3.2 : 1.5,
    lifetimeSec: 0.70,
  };
}
