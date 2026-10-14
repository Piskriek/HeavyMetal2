// ============================================================================
// File: apps/web/src/lab/lab-choreography-and-heal.ts
// Briefs: Brief 28 (Lab Choreography & Window Vista) + Plan 26 (Act IX Breach Heal)
// ============================================================================

export interface LabLightingState {
  ambientIntensity: number;
  ambientHex: number;
  emergencyStrobeIntensity: number;
  stripBankIntensities: [number, number, number]; // Back, Mid, Front overhead banks
  relayBeaconIntensity: number;
  cableRampPulsePhase: number;
  gateCoilLevels: [number, number, number, number, number, number, number, number]; // 8 ribbed coils bottom-to-top
  gateApertureOpenMix: number; // 0.0 (closed) -> 1.0 (open stencil portal)
}

export interface WindowVistaHealState {
  breachWidthScale: number;      // 1.0 (storming) -> 0.0 (zipped shut)
  breachGlitchAmplitude: number; // 1.0 -> 0.0
  pocketRadiusMultiplier: number;// 1.0 (r=4..9m) -> 18.0 (merges across entire vista)
  skyGoldenHourMix: number;      // 0.0 (luma 88 storm) -> 1.0 (warm golden-hour sunlight)
  earthCoverageBloomMix: number; // 0.0 (desolate ash) -> 1.0 (emerald grass/moss/trees)
  triggerCreditsVideo: boolean;  // Fires 3.0s after heal finishes (A9-03)
}

/**
 * Pure deterministic evaluator for Lab interior lighting & Gate coil ignition (Brief 28).
 */
export function evaluateLabChoreography(
  timeSec: number,
  breakerThrownAtSec: number | null,
  gateLeverPulledAtSec: number | null
): LabLightingState {
  // 1. Cold Boot State (Before Breaker Throw)
  if (breakerThrownAtSec === null || timeSec < breakerThrownAtSec) {
    const strobe = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2.0 * 1.2); // 1.2 Hz red strobe
    return {
      ambientIntensity: 0.08,
      ambientHex: 0x1a2433,
      emergencyStrobeIntensity: 0.35 + strobe * 1.65,
      stripBankIntensities: [0, 0, 0],
      relayBeaconIntensity: 0,
      cableRampPulsePhase: 0,
      gateCoilLevels: [0, 0, 0, 0, 0, 0, 0, 0],
      gateApertureOpenMix: 0,
    };
  }

  // 2. Sequential Overhead Strip-Light Power-On (1.8s back-to-front)
  const sinceBreaker = timeSec - breakerThrownAtSec;
  const bank0 = Math.min(1, Math.max(0, sinceBreaker / 0.45)) * 1.8;
  const bank1 = Math.min(1, Math.max(0, (sinceBreaker - 0.55) / 0.45)) * 1.8;
  const bank2 = Math.min(1, Math.max(0, (sinceBreaker - 1.10) / 0.45)) * 1.8;

  // 3. Sequential Bottom-to-Top Gate Ribbed Coil Ignition (8 blocks over 3.0s = 0.35s spacing)
  const gateCoilLevels: [number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 0, 0,
  ];
  let gateApertureOpenMix = 0;

  if (gateLeverPulledAtSec !== null && timeSec >= gateLeverPulledAtSec) {
    const sinceGate = timeSec - gateLeverPulledAtSec;
    for (let i = 0; i < 8; i++) {
      gateCoilLevels[i] = Math.min(1, Math.max(0, (sinceGate - i * 0.35) / 0.25));
    }
    gateApertureOpenMix = Math.min(1, Math.max(0, (sinceGate - 2.8) / 0.7));
  }

  return {
    ambientIntensity: 0.08 + Math.min(1, sinceBreaker / 1.8) * 0.52,
    ambientHex: 0xd8e4f2,
    emergencyStrobeIntensity: Math.max(0, 1 - sinceBreaker / 0.6) * 1.2,
    stripBankIntensities: [bank0, bank1, bank2],
    relayBeaconIntensity: Math.min(1, sinceBreaker / 1.0) * 1.4,
    cableRampPulsePhase: (sinceBreaker * 2.2) % 1.0,
    gateCoilLevels,
    gateApertureOpenMix,
  };
}

/**
 * Pure deterministic evaluator for the Act IX Earth Window Breach Heal (Plan 26 §5).
 */
export function evaluateWindowVistaHeal(
  timeSec: number,
  masterSyncPulledAtSec: number | null
): WindowVistaHealState {
  if (masterSyncPulledAtSec === null || timeSec < masterSyncPulledAtSec) {
    return {
      breachWidthScale: 1.0,
      breachGlitchAmplitude: 1.0,
      pocketRadiusMultiplier: 1.0,
      skyGoldenHourMix: 0.0,
      earthCoverageBloomMix: 0.0,
      triggerCreditsVideo: false,
    };
  }

  const elapsed = timeSec - masterSyncPulledAtSec;
  // 0..3.5s: Breach column collapses & zips shut
  const breachCollapse = Math.min(1, Math.max(0, elapsed / 3.5));
  // 1.0..5.5s: 3 spherical S-pockets expand to merge across the ruined datacentre vista
  const pocketExpand = Math.min(1, Math.max(0, (elapsed - 1.0) / 4.5));
  // 2.0..6.0s: Storm parts into golden-hour sunlight & green turf/trees bloom
  const goldenBloom = Math.min(1, Math.max(0, (elapsed - 2.0) / 4.0));

  return {
    breachWidthScale: 1.0 - breachCollapse * breachCollapse,
    breachGlitchAmplitude: 1.0 - breachCollapse,
    pocketRadiusMultiplier: 1.0 + pocketExpand * 17.0,
    skyGoldenHourMix: goldenBloom,
    earthCoverageBloomMix: goldenBloom * goldenBloom,
    triggerCreditsVideo: elapsed >= 9.0, // 6.0s heal + 3.0s pause for A9-03 voiceover
  };
}
