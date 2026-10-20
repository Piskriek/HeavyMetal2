// ============================================================================
// File: packages/tooljuice/src/beat-synced-plume-and-turbobass.ts
// TASK-34 / TICKET-15: 144 BPM Beat-Synced Plumes & [V] Turbo Bass Swarmer Knockback
// Rules: Rule 2 (Pure deterministic math), Rule 23 (Non-griefing crowd control)
// T09a Routing: Turbo Bass routes strictly to 'combatUi' (never 'voice')
// ============================================================================

export const TURBO_BASS_BPM = 144.0;
export const TURBO_BASS_COOLDOWN_SEC = 4.0;
export const TURBO_BASS_RADIUS_M = 12.0;
export const TURBO_BASS_KNOCKBACK_M = 4.0;
export const TURBO_BASS_BUS = 'combatUi' as const;

export interface BeatSyncedPlumeModulation {
  readonly cubeScaleMultiplier: number; // 1.0 .. 1.35 on the 144 BPM downbeat
  readonly upwardSpeedMultiplier: number;
  readonly ledEmissiveBoost: number;
}

export interface SwarmerKnockbackResult<TId extends string | number = string> {
  readonly id: TId;
  readonly newX: number;
  readonly newZ: number;
  readonly wasKnockedBack: boolean;
}

/**
 * Pure 144 BPM downbeat pulse envelope (0..1, peaking at 1.0 on every beat)
 * used by play-scene.ts Window D Hook #1 (`beatPulse(t, 144)`).
 */
export function beatPulse(timeSec: number, bpm = TURBO_BASS_BPM): number {
  const safeT = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : TURBO_BASS_BPM;
  const beatDur = 60.0 / safeBpm;
  const totalBeats = safeT / beatDur;
  const phase = totalBeats - Math.floor(totalBeats);
  return Number(Math.exp(-4.5 * phase).toFixed(3));
}

/**
 * Modulates machine pixel-plume cube scale and LED glow in sync with the 144 BPM song beat.
 * When all 4 machine stems converge (isHarmonicConvergenceLocked), the pulse reaches full 1.35x scale.
 */
export function evaluateBeatSyncedPlumeModulation(
  downbeatPulse0to1: number,
  isHarmonicConvergenceLocked: boolean,
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
 * pushing nearby ankle-biter swarmers outward by up to 4.0m on the downbeat (+25% downbeat bonus).
 */
export function applyTurboBassSwarmerKnockback<TId extends string | number = string>(
  originX: number,
  originZ: number,
  downbeatPulse0to1: number,
  swarmers: readonly { readonly id: TId; readonly x: number; readonly z: number }[],
  radiusM = TURBO_BASS_RADIUS_M,
  knockbackM = TURBO_BASS_KNOCKBACK_M,
): SwarmerKnockbackResult<TId>[] {
  // Knockback is 25% stronger if timed on the downbeat (downbeatPulse0to1 >= 0.6)
  const timingBonus = downbeatPulse0to1 >= 0.6 ? 1.25 : 1.0;
  const safeRadius = radiusM > 0 ? radiusM : TURBO_BASS_RADIUS_M;
  const safePush = knockbackM >= 0 ? knockbackM : TURBO_BASS_KNOCKBACK_M;

  return swarmers.map((s) => {
    const dx = s.x - originX;
    const dz = s.z - originZ;
    const dist = Math.hypot(dx, dz);

    if (dist > safeRadius || dist < 0.001) {
      return { id: s.id, newX: s.x, newZ: s.z, wasKnockedBack: false };
    }

    const falloff = 1.0 - dist / safeRadius;
    const pushDist = safePush * falloff * timingBonus;
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
