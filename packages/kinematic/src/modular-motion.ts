/**
 * Plan 43: Modular Locomotion (`loc:`), Stage-Fidelity Animation (`anim:`), and Declarative Kit Motion & Logic Presets (`logic:`).
 * Pure, deterministic, zero-I/O functions so player movement, jumping, machine animations, and interactive behaviours
 * are editable via curated sliders in-game and full node/track graphs in The Studio across all Fidelity Stages (S0..S6).
 */

export type LocomotionPresetId = 'earth-standard' | 'lunar-ballast' | 'lunar-low-g' | 'arcade-quake';

export interface LocomotionPreset {
  readonly id: LocomotionPresetId | string;
  readonly name: string;
  readonly walkSpeedMps: number;
  readonly runSpeedMps: number;
  readonly jumpImpulseMps: number;
  readonly gravityMps2: number;
  readonly airControl: number;
  readonly coyoteTimeSec: number;
  readonly jumpBufferSec: number;
  readonly stepUpM: number;
  readonly ceilingHeightM: number;
  readonly landingSpringStiffness: number;
  readonly landingSpringDamping: number;
}

export const LOCOMOTION_PRESETS: Readonly<Record<LocomotionPresetId, LocomotionPreset>> = {
  'earth-standard': {
    id: 'earth-standard',
    name: 'Earth Standard (1.0 G)',
    walkSpeedMps: 3.0,
    runSpeedMps: 5.6,
    jumpImpulseMps: 4.8,
    gravityMps2: 14.5,
    airControl: 0.45,
    coyoteTimeSec: 0.12,
    jumpBufferSec: 0.12,
    stepUpM: 0.55,
    ceilingHeightM: 3.8,
    landingSpringStiffness: 180,
    landingSpringDamping: 22,
  },
  'lunar-ballast': {
    id: 'lunar-ballast',
    name: 'Lunar Suit Ballast (0.65 G)',
    walkSpeedMps: 3.0,
    runSpeedMps: 5.6,
    jumpImpulseMps: 5.2,
    gravityMps2: 9.8,
    airControl: 0.55,
    coyoteTimeSec: 0.14,
    jumpBufferSec: 0.14,
    stepUpM: 0.55,
    ceilingHeightM: 200,
    landingSpringStiffness: 150,
    landingSpringDamping: 20,
  },
  'lunar-low-g': {
    id: 'lunar-low-g',
    name: 'Lunar Unballasted (0.25 G)',
    walkSpeedMps: 3.2,
    runSpeedMps: 6.0,
    jumpImpulseMps: 4.6,
    gravityMps2: 3.6,
    airControl: 0.7,
    coyoteTimeSec: 0.18,
    jumpBufferSec: 0.16,
    stepUpM: 0.65,
    ceilingHeightM: 200,
    landingSpringStiffness: 110,
    landingSpringDamping: 16,
  },
  'arcade-quake': {
    id: 'arcade-quake',
    name: 'Shareware Arena (High Air-Control)',
    walkSpeedMps: 4.0,
    runSpeedMps: 7.2,
    jumpImpulseMps: 5.8,
    gravityMps2: 12.0,
    airControl: 0.85,
    coyoteTimeSec: 0.15,
    jumpBufferSec: 0.15,
    stepUpM: 0.6,
    ceilingHeightM: 200,
    landingSpringStiffness: 200,
    landingSpringDamping: 24,
  },
};

export interface VerticalJumpState {
  /** Height offset above the current support floor (m, >= 0). */
  readonly heightAboveFloor: number;
  /** Vertical velocity (m/s, positive = upward). */
  readonly vy: number;
  /** True when standing on the floor or a structure surface. */
  readonly onGround: boolean;
  /** True during an active jump arc (from liftoff until landing). */
  readonly jumping: boolean;
  /** Seconds remaining in ledge coyote-time window. */
  readonly coyoteTimer: number;
  /** Seconds remaining in jump-input buffer window. */
  readonly jumpBufferTimer: number;
  /** Whether the jump key was held on the previous frame (for edge detection). */
  readonly jumpHeldLast: boolean;
  /** Critically-damped camera knee-dip offset (m, negative = downward dip on landing). */
  readonly landingDip: number;
  /** Velocity of the landing knee-dip spring (m/s). */
  readonly landingDipVel: number;
  /** True on the exact frame the character lifts off. */
  readonly justJumped: boolean;
  /** True on the exact frame the character touches down. */
  readonly justLanded: boolean;
}

export function createVerticalJumpState(): VerticalJumpState {
  return {
    heightAboveFloor: 0,
    vy: 0,
    onGround: true,
    jumping: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHeldLast: false,
    landingDip: 0,
    landingDipVel: 0,
    justJumped: false,
    justLanded: false,
  };
}

/**
 * Pure deterministic vertical jump, gravity, coyote-time, jump-buffer & landing spring-damper solver.
 */
export function stepVerticalJump(
  state: VerticalJumpState,
  input: {
    readonly dt: number;
    readonly jumpHeld: boolean;
    readonly maxHeadroomM?: number;
  },
  preset: LocomotionPreset = LOCOMOTION_PRESETS['lunar-ballast'],
): VerticalJumpState {
  const dt = Math.max(0, Math.min(0.1, input.dt));
  const jumpPressedEdge = input.jumpHeld && !state.jumpHeldLast;

  let coyoteTimer = state.onGround ? preset.coyoteTimeSec : Math.max(0, state.coyoteTimer - dt);
  let jumpBufferTimer = jumpPressedEdge ? preset.jumpBufferSec : Math.max(0, state.jumpBufferTimer - dt);

  let vy = state.vy;
  let heightAboveFloor = state.heightAboveFloor;
  let onGround = state.onGround;
  let jumping = state.jumping;
  let justJumped = false;
  let justLanded = false;
  let landingDip = state.landingDip;
  let landingDipVel = state.landingDipVel;

  // Trigger jump if buffered input + within coyote time (or onGround while holding jump)
  const canJump = onGround || coyoteTimer > 0;
  if (canJump && (jumpBufferTimer > 0 || (onGround && input.jumpHeld && !jumping))) {
    vy = preset.jumpImpulseMps;
    onGround = false;
    jumping = true;
    justJumped = true;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
  }

  if (!onGround) {
    heightAboveFloor += vy * dt;
    vy -= preset.gravityMps2 * dt;

    const maxHeadroom = input.maxHeadroomM ?? preset.ceilingHeightM;
    if (heightAboveFloor >= maxHeadroom) {
      heightAboveFloor = maxHeadroom;
      if (vy > 0) vy = 0;
    }

    if (heightAboveFloor <= 0 && vy <= 0) {
      const impactSpeed = Math.abs(vy);
      heightAboveFloor = 0;
      vy = 0;
      onGround = true;
      jumping = false;
      justLanded = true;
      // Inject downward impulse into the landing knee-dip spring proportional to impact velocity
      landingDipVel -= Math.min(2.2, impactSpeed * 0.28);
    }
  } else {
    heightAboveFloor = 0;
    vy = 0;
  }

  // Step critically-damped landing dip spring: F = -k * x - c * v
  const springForce = -preset.landingSpringStiffness * landingDip - preset.landingSpringDamping * landingDipVel;
  landingDipVel += springForce * dt;
  landingDip = Math.max(-0.22, Math.min(0.06, landingDip + landingDipVel * dt));
  if (Math.abs(landingDip) < 1e-4 && Math.abs(landingDipVel) < 1e-4) {
    landingDip = 0;
    landingDipVel = 0;
  }

  return {
    heightAboveFloor,
    vy,
    onGround,
    jumping,
    coyoteTimer,
    jumpBufferTimer,
    jumpHeldLast: input.jumpHeld,
    landingDip,
    landingDipVel,
    justJumped,
    justLanded,
  };
}

// ============================================================================
// 2. STAGE-FIDELITY ANIMATION QUANTIZATION & DECLARATIVE KIT MOTION PRESETS
// ============================================================================

/**
 * Returns the animation sample rate (Hz) for a given Fidelity Stage (S0..S6) — the cadence at which a procedural pose is
 * held, so the stage's motion reads as its era's hardware:
 * - Stage 0 (Wireframe / 1-Bit): 8 Hz stepped pose cadence
 * - Stage 1 (16-colour EGA):     12 Hz shareware flipbook cadence
 * - Stage 2 (256-colour VGA):    18 Hz Quake vertex-keyframe cadence
 * - Stage 3 (Gouraud):           30 Hz console cadence
 * - Stage 4..6 (Full PBR):       60 Hz — the frame cadence itself, so the spring-damper and IK poses are continuous
 *
 * 60 at the top of the ladder is not a cap on quality: it is the fastest a 60 Hz frame can ask, and a machine that
 * samples every frame is smooth. A caller that wants a rate above the frame cadence should not quantise at all.
 */
export function stageAnimRateHz(stage: number): number {
  if (stage <= 0) return 8;
  if (stage === 1) return 12;
  if (stage === 2) return 18;
  if (stage === 3) return 30;
  return 60;
}

/**
 * Quantizes continuous time `tSec` to the stage's animation cadence so procedural kit animations
 * visually upgrade from stepped low-bit motion at Stage 0-2 to silky continuous motion at Stage 4-6.
 *
 * Pure in its arguments: the same time always gives the same pose, which is what lets the Studio's scrubbar seek to any
 * timestamp — and what an animation must never do is accumulate a frame delta instead (`pos += vel * dt` drifts).
 */
export function quantizeStageTime(tSec: number, stage: number): number {
  const rate = stageAnimRateHz(stage);
  if (!(rate > 0)) return tSec;
  return Math.floor(tSec * rate) / rate;
}

export type KitMotionKind = 'reciprocate' | 'spin' | 'oscillate' | 'gantry-slide' | 'iris-aperture';

export interface KitMotionSpec {
  readonly kind: KitMotionKind;
  readonly axis: 'x' | 'y' | 'z';
  readonly rateHz: number;
  readonly amplitude: number;
  readonly phaseRad?: number;
}

/**
 * Pure evaluator for declarative kit part motion (`KitMotionSpec`), replacing hardcoded `Math.sin` closures.
 * Returns position offset `[dx, dy, dz]` (m) and Euler rotation offset `[rx, ry, rz]` (rad).
 */
export function evaluateKitMotion(
  spec: KitMotionSpec,
  timeSec: number,
  running: number,
  stage = 6,
): { readonly posOffset: readonly [number, number, number]; readonly rotOffset: readonly [number, number, number] } {
  const run = Math.max(0, Math.min(1, running));
  if (run <= 1e-4) {
    return { posOffset: [0, 0, 0], rotOffset: [0, 0, 0] };
  }
  const t = quantizeStageTime(timeSec, stage);
  const phase = (spec.phaseRad ?? 0) + t * spec.rateHz * Math.PI * 2;
  const axIdx = spec.axis === 'x' ? 0 : spec.axis === 'y' ? 1 : 2;
  const pos: [number, number, number] = [0, 0, 0];
  const rot: [number, number, number] = [0, 0, 0];

  switch (spec.kind) {
    case 'reciprocate': {
      // Downward or axial stamp stroke (0..amplitude)
      pos[axIdx] = -Math.max(0, Math.sin(phase)) * spec.amplitude * run;
      break;
    }
    case 'gantry-slide': {
      pos[axIdx] = Math.sin(phase) * spec.amplitude * run;
      break;
    }
    case 'spin': {
      rot[axIdx] = (t * spec.rateHz * Math.PI * 2 * run) % (Math.PI * 2);
      break;
    }
    case 'oscillate':
    case 'iris-aperture': {
      rot[axIdx] = Math.sin(phase) * spec.amplitude * run;
      break;
    }
  }
  return { posOffset: pos, rotOffset: rot };
}
