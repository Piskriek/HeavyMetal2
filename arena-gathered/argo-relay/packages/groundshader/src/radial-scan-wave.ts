// ============================================================================
// File: packages/groundshader/src/radial-scan-wave.ts
// Brief: Brief 30 (P1-LIGHT-04 Radial Volumetric Scan-Wave & P1-LIGHT-05 POL-04 60 FPS Governor)
// Rules: Rule 20 (GTX 950M 60 FPS on Low) & Rule 21 (Toggle Rule)
// ============================================================================

export type GraphicsQualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface RadialScanWaveState {
  isActive: boolean;
  originXZ: [number, number];
  startedAtSec: number;
  durationSec: number;     // Default 4.5s
  maxRadiusM: number;      // Default 450.0m
  ringThicknessM: number;  // Default 6.0m wireframe tessellation band
  currentRadiusM: number;
  accentHex: number;       // #ff3d8a, #7cff4d, #ffc13d, #3dc8ff, or #b46bff
  fromStageIndex: number;
  toStageIndex: number;
}

export function createRadialScanWaveState(): RadialScanWaveState {
  return {
    isActive: false,
    originXZ: [0, 0],
    startedAtSec: 0,
    durationSec: 4.5,
    maxRadiusM: 450.0,
    ringThicknessM: 6.0,
    currentRadiusM: 0,
    accentHex: 0x7cff4d,
    fromStageIndex: 0,
    toStageIndex: 1,
  };
}

export function triggerRadialScanWave(
  state: RadialScanWaveState,
  nowSec: number,
  originX: number,
  originZ: number,
  fromStageIndex: number,
  toStageIndex: number,
  accentHex = 0x7cff4d
): void {
  state.isActive = true;
  state.originXZ = [originX, originZ];
  state.startedAtSec = nowSec;
  state.currentRadiusM = 0;
  state.fromStageIndex = fromStageIndex;
  state.toStageIndex = toStageIndex;
  state.accentHex = accentHex;
}

export function stepRadialScanWave(
  state: RadialScanWaveState,
  nowSec: number
): RadialScanWaveState {
  if (!state.isActive) return state;

  const elapsed = Math.max(0, nowSec - state.startedAtSec);
  const u = Math.min(1.0, elapsed / state.durationSec);
  // Ease-out cubic expansion from 0 -> 450m
  const eased = 1.0 - Math.pow(1.0 - u, 3);
  state.currentRadiusM = eased * state.maxRadiusM;

  if (u >= 1.0) {
    state.isActive = false;
  }
  return state;
}

export interface LowSpecGovernorProfile {
  maxGroundNoiseOctavesNear: number;
  maxGroundNoiseOctavesFar: number;
  farOctaveCutoffDistanceM: number;
  shadowMapResolution: number;
  renderNeighborDomeShadows: boolean;
  enablePlumePointLights: boolean; // POL-02 / POL-03 (High/Ultra only)
  maxGlobalParticles: number;
  rebakeSkyPmremMinLxDelta: number;
}

/**
 * P1-LIGHT-05 (Closes POL-04):
 * Recovers ~3.3 ms/frame in Stage 4–6 on the GTX 950M Low tier to lock 60.0 FPS
 * while keeping High/Ultra plume bounce lights (POL-02/03) behind the quality toggle (Rule 21).
 */
export function getStageGovernorProfile(tier: GraphicsQualityTier): LowSpecGovernorProfile {
  switch (tier) {
    case 'low':
      return {
        maxGroundNoiseOctavesNear: 3,
        maxGroundNoiseOctavesFar: 2, // Capped at 2 beyond 80m on Low
        farOctaveCutoffDistanceM: 80.0,
        shadowMapResolution: 1024,
        renderNeighborDomeShadows: false, // Skips shadow cascades on domes > 250m
        enablePlumePointLights: false,
        maxGlobalParticles: 2048,
        rebakeSkyPmremMinLxDelta: 0.06,
      };
    case 'medium':
      return {
        maxGroundNoiseOctavesNear: 4,
        maxGroundNoiseOctavesFar: 2,
        farOctaveCutoffDistanceM: 120.0,
        shadowMapResolution: 1024,
        renderNeighborDomeShadows: false,
        enablePlumePointLights: false,
        maxGlobalParticles: 4096,
        rebakeSkyPmremMinLxDelta: 0.05,
      };
    case 'high':
      return {
        maxGroundNoiseOctavesNear: 5,
        maxGroundNoiseOctavesFar: 3,
        farOctaveCutoffDistanceM: 180.0,
        shadowMapResolution: 2048,
        renderNeighborDomeShadows: true,
        enablePlumePointLights: true, // POL-02 / POL-03 enabled on High
        maxGlobalParticles: 8192,
        rebakeSkyPmremMinLxDelta: 0.03,
      };
    case 'ultra':
      return {
        maxGroundNoiseOctavesNear: 6,
        maxGroundNoiseOctavesFar: 4,
        farOctaveCutoffDistanceM: 260.0,
        shadowMapResolution: 2048,
        renderNeighborDomeShadows: true,
        enablePlumePointLights: true,
        maxGlobalParticles: 12288,
        rebakeSkyPmremMinLxDelta: 0.02,
      };
  }
}
