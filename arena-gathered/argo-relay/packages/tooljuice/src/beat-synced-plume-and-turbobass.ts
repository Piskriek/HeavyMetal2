// ============================================================================
// File: packages/tooljuice/src/beat-synced-plume-and-turbobass.ts
// R&D Innovation: 112 BPM Beat-Synced Plumes & [V] Turbo Bass Swarmer Knockback
// Rules: Rule 2 (Pure deterministic math), Rule 23 (Non-griefing crowd control)
// ============================================================================

export const TURBO_BASS_COOLDOWN_SEC = 4.0;
export const TURBO_BASS_RADIUS_M = 12.0;
export const TURBO_BASS_KNOCKBACK_M = 4.0;

export interface BeatSyncedPlumeModulation {
  cubeScaleMultiplier: number; // 1.0 .. 1.35 on the 112 BPM downbeat
  upwardSpeedMultiplier: number;
  ledEmissiveBoost: number;
}

export interface SwarmerKnockbackResult {
  id: string;
  newX: number;
  newZ: number;
  wasKnockedBack: boolean;
}

/**
 * Modulates machine pixel-plume cube scale and LED glow in sync with the 112 BPM song beat.
 * When all 4 machine stems converge (isHarmonicConvergenceLocked), the pulse doubles in vibrancy.
 */
export function evaluateBeatSyncedPlumeModulation(
  downbeatPulse0to1: number,
  isHarmonicConvergenceLocked: boolean
): BeatSyncedPlumeModulation {
  const boostFactor = isHarmonicConvergenceLocked ? 1.0 : 0.55;
  const p = Math.max(0, Math.min(1, downbeatPulse0to1)) * boostFactor;

  return {
    cubeScaleMultiplier: Number((1.0 + 0.35 * p).toFixed(3)),
    upwardSpeedMultiplier: Number((1.0 + 0.25 * p).toFixed(3)),
    ledEmissiveBoost: Number((0.4 + 1.2 * p).toFixed(3)),
  };
}

/**
 * Evaluates the [V] Turbo Bass Sub-Bass Pulse from the Rover or Suit Boombox,
 * pushing nearby ankle-biter swarmers outward by up to 4.0m on the downbeat.
 */
export function applyTurboBassSwarmerKnockback(
  originX: number,
  originZ: number,
  downbeatPulse0to1: number,
  swarmers: Array<{ id: string; x: number; z: number }>
): SwarmerKnockbackResult[] {
  // Knockback is 25% stronger if timed on the downbeat (downbeatPulse0to1 >= 0.6)
  const timingBonus = downbeatPulse0to1 >= 0.6 ? 1.25 : 1.0;

  return swarmers.map((s) => {
    const dx = s.x - originX;
    const dz = s.z - originZ;
    const dist = Math.hypot(dx, dz);

    if (dist > TURBO_BASS_RADIUS_M || dist < 0.001) {
      return { id: s.id, newX: s.x, newZ: s.z, wasKnockedBack: false };
    }

    const falloff = 1.0 - dist / TURBO_BASS_RADIUS_M;
    const pushDist = TURBO_BASS_KNOCKBACK_M * falloff * timingBonus;
    const nx = dx / dist;
    const nz = dz / dist;

    return {
      id: s.id,
      newX: Number((s.x + nx * pushDist).toFixed(3)),
      newZ: Number((s.z + nz * pushDist).toFixed(3)),
      wasKnockedBack: true,
    };
  });
}
