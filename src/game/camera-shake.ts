/**
 * M01 · T5 dressing — **impact shake, for the camera the player is actually behind.**
 *
 * The engine has always kept a shake value: a heavy bump sets it from the closing speed (up to 15), a
 * shield hold sets 2, a plain nudge 4, and it decays as `exp(-9t)` every tick. It rides the frame as
 * `frame.shake` — and the 3D renderer, which is the only renderer left, read it **nowhere**. So the
 * collision feedback the shake was for did not exist in the first-person game.
 *
 * The laws, all pure and all asserted in `tests/camera-shake.test.ts`:
 *
 *  - **Deterministic.** The offsets come from sinusoids of the race clock, not from a random number
 *    generator: the render path must not roll dice, and a test can name the exact frame.
 *  - **Bounded, as a distance.** The offset is a vector of *constant length* `strength ×
 *    SHAKE_MAX_OFFSET` whose direction rotates, so the eye is never further from where the camera was
 *    placed than the impact is allowed to move it — a fifteen-unit impact cannot throw the eye out of
 *    the cockpit or through a wall, whichever way the axes line up.
 *  - **Silent under reduced motion**, at every amount and every time, like every other motion effect in
 *    this project.
 *  - **The axes are deliberately incommensurate** (31 / 24 / 17 rad/s): a shake built from one
 *    frequency reads as a wobble on a loop rather than an impact.
 */
/** The engine's own ceiling on the value it hands over (`Math.min(15, closing * 0.05)`). */
export const SHAKE_MAX_UNITS = 15;
/** World units of camera travel at a full fifteen-unit impact. A ball is 62 across. */
export const SHAKE_MAX_OFFSET = 30;
/** How much of the shake goes along the view axis. Pushing into the screen reads worse than sideways. */
export const SHAKE_FORWARD_SHARE = 0.35;
/** Radians per second per axis, deliberately not multiples of one another. */
export const SHAKE_FREQUENCIES = Object.freeze({ right: 31, up: 24, forward: 17 });
/** Phase offsets so the three axes never pass through zero together. */
const SHAKE_PHASES = Object.freeze({ right: 0, up: Math.PI / 3, forward: 2 * Math.PI / 3 });

export interface ShakeOffset {
  /** Along the camera's own right vector. */
  readonly right: number;
  /** Along the camera's own up vector. */
  readonly up: number;
  /** Along the view direction (small). */
  readonly forward: number;
}

/** Local, so this module owns no runtime import of the scene's helper. */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const STILL: ShakeOffset = Object.freeze({ right: 0, up: 0, forward: 0 });

/** The amount, as a share of the ceiling: 0 (still) … 1 (the heaviest impact). */
export function shakeStrength(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return clamp(amount, 0, SHAKE_MAX_UNITS) / SHAKE_MAX_UNITS;
}

/**
 * The camera offset for this frame. `time` is the race clock (already paused-aware), `reducedMotion`
 * silences it entirely.
 */
export function cameraShake(amount: number, time: number, reducedMotion: boolean): ShakeOffset {
  if (reducedMotion) return STILL;
  const strength = shakeStrength(amount);
  if (strength <= 0 || !Number.isFinite(time)) return STILL;
  const travel = strength * SHAKE_MAX_OFFSET;
  const right = Math.sin(time * SHAKE_FREQUENCIES.right + SHAKE_PHASES.right);
  const up = Math.cos(time * SHAKE_FREQUENCIES.up + SHAKE_PHASES.up);
  const forward = Math.sin(time * SHAKE_FREQUENCIES.forward + SHAKE_PHASES.forward) * SHAKE_FORWARD_SHARE;
  // Constant magnitude, rotating direction: the eye swings on an arc of exactly `travel` rather than
  // on a box whose corners reach √(1 + 1 + share²) times further. That is the safety law in the
  // cockpit — the eye can never travel further than the impact is allowed to move it, whichever way
  // the three sinusoids happen to line up — and it reads as a knock rather than a wobble.
  const magnitude = Math.hypot(right, up, forward);
  if (magnitude < 1e-9) return STILL;
  const scale = travel / magnitude;
  return { right: right * scale, up: up * scale, forward: forward * scale };
}

/**
 * H8 — the hit kick. On top of the shake, a hit knocks the camera *away from the side it came from*
 * and lets it settle, in `KICK_SECONDS`. `side` is +1 for a hit from the camera's right (the rival
 * at higher z), −1 from the left and 0 straight on (an obstacle), which only dips the view. With
 * reduced motion the kick is cut to a tenth, a nudge you can feel but not a lurch.
 */
export const KICK_MAX_OFFSET = 18;
export const KICK_SECONDS = 0.18;
export const KICK_REDUCED_SHARE = 0.1;

/** 1 at the moment of the hit, easing to 0 at `KICK_SECONDS`; 0 before and after. */
export function impactEnvelope(since: number): number {
  if (!(since >= 0) || since >= KICK_SECONDS) return 0;
  const left = 1 - since / KICK_SECONDS;
  return left * left;
}

export function cameraKick(side: -1 | 0 | 1, strength: number, since: number, reducedMotion: boolean): ShakeOffset {
  const amount = impactEnvelope(since) * clamp(Number.isFinite(strength) ? strength : 0, 0, 1);
  if (amount <= 0) return STILL;
  const travel = amount * KICK_MAX_OFFSET * (reducedMotion ? KICK_REDUCED_SHARE : 1);
  return { right: side === 0 ? 0 : -side * travel, up: -0.35 * travel, forward: 0 };
}
