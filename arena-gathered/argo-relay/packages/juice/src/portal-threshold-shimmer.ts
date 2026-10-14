// ============================================================================
// File: packages/juice/src/portal-threshold-shimmer.ts
// Plan: Plan 17 (P1-VFX-04 Portal Threshold Shimmer & 6x Gravity Transition Dip)
// Purity: 100% pure deterministic functions for @hm/juice.
// ============================================================================

export type PortalCrossingDirection = 'lab-to-moon' | 'moon-to-lab';

export const EARTH_GRAVITY_MPS2 = 9.81;
export const MOON_GRAVITY_MPS2 = 1.62;
export const PORTAL_SHIMMER_DURATION_SEC = 0.25; // 250 ms edge vignette
export const PORTAL_DIP_DURATION_SEC = 0.55;     // 550 ms damped gravity settle
export const PORTAL_SPARK_COUNT = 24;

export interface PortalCrossingFrameState {
  shimmerVignetteAlpha0to1: number;
  chromaticOffsetPx: number;
  cameraVerticalDipMeters: number;
  targetGravityMps2: number;
  isComplete: boolean;
}

export interface PortalThresholdSpark {
  index: number;
  localX: number;
  localY: number;
  velX: number;
  velY: number;
  velZ: number;
  colorHex: number;
}

/**
 * Evaluates the per-frame camera spring dip and screen-edge shimmer after crossing the Gate.
 */
export function evaluatePortalCrossingFrame(
  direction: PortalCrossingDirection,
  elapsedSinceCrossingSec: number
): PortalCrossingFrameState {
  const t = Math.max(0, elapsedSinceCrossingSec);
  const targetGravityMps2 =
    direction === 'lab-to-moon' ? MOON_GRAVITY_MPS2 : EARTH_GRAVITY_MPS2;

  if (t >= PORTAL_DIP_DURATION_SEC) {
    return {
      shimmerVignetteAlpha0to1: 0,
      chromaticOffsetPx: 0,
      cameraVerticalDipMeters: 0,
      targetGravityMps2,
      isComplete: true,
    };
  }

  // 250ms shimmer envelope (peaks at 60ms, fades to 0 at 250ms)
  let shimmerVignetteAlpha0to1 = 0;
  if (t < PORTAL_SHIMMER_DURATION_SEC) {
    const u = t / PORTAL_SHIMMER_DURATION_SEC;
    shimmerVignetteAlpha0to1 = Number(Math.sin(u * Math.PI).toFixed(3));
  }

  // Underdamped vertical spring: buoyant upward pop (+4.5 cm) onto Moon, heavy compression (-6.5 cm) into Lab
  const peakMeters = direction === 'lab-to-moon' ? 0.045 : -0.065;
  const decay = Math.exp(-7.5 * t);
  const wave = Math.sin(t * 16.0);
  const cameraVerticalDipMeters = Number((peakMeters * decay * wave).toFixed(4));

  return {
    shimmerVignetteAlpha0to1,
    chromaticOffsetPx: Number((shimmerVignetteAlpha0to1 * 3.5).toFixed(2)),
    cameraVerticalDipMeters,
    targetGravityMps2,
    isComplete: false,
  };
}

/**
 * Generates the 24 amber coil sparks around the 1.7m wide x 2.6m tall Gate aperture.
 */
export function generatePortalThresholdSparks(
  direction: PortalCrossingDirection
): PortalThresholdSpark[] {
  const sparks: PortalThresholdSpark[] = [];
  const halfW = 0.85;
  const height = 2.6;
  const forwardZ = direction === 'lab-to-moon' ? 1.8 : -1.8;

  for (let i = 0; i < PORTAL_SPARK_COUNT; i++) {
    const u = i / PORTAL_SPARK_COUNT;
    const angle = u * Math.PI * 2.0;
    const localX = Number((Math.cos(angle) * halfW).toFixed(3));
    const localY = Number((height * 0.5 + Math.sin(angle) * (height * 0.5)).toFixed(3));

    sparks.push({
      index: i,
      localX,
      localY,
      velX: Number(( -Math.cos(angle) * 0.9 ).toFixed(3)),
      velY: Number(( 0.4 + Math.sin(angle) * 0.6 ).toFixed(3)),
      velZ: forwardZ,
      colorHex: i % 3 === 0 ? 0xffe2a8 : 0xffc13d,
    });
  }

  return sparks;
}
