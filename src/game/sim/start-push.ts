/**
 * M01 · T1 — the goblin push start (pure).
 *
 * The slingshot is retired from normal play. A run now begins with the whole field standing on the
 * start pad at the top of the hill while a starter goblin shoves every racer at once: a real,
 * seeded, tick-driven impulse that is identical on every machine and inside every headless test.
 *
 * The push is deliberately **not** an input skill (plan Q6): the only variation is a ±2 % seeded
 * spread, so nobody is rewarded for frame-perfect timing. Everything here is a pure function of
 * (pace, seed, racerId) and the physics tick, so a replay reproduces the launch exactly.
 *
 * Nothing in this module touches the DOM, THREE, the clock or `Math.random`. The pad geometry
 * itself lives in `scene.ts` (it is part of the elevation table).
 */
import type { Racer } from '../racers';
import { ContractError } from '../contracts/core';

/* -----------------------------------------------------------------------------
   1. FROZEN CONSTANTS (plan decision D5 + T1)
   -------------------------------------------------------------------------- */

/** Push duration, physics ticks at 120 Hz (0.4 s). */
export const PUSH_TICKS = 48;
/** Down-track speed the push aims for, engine x-units/s. */
export const PUSH_BASE_VX = 360;
/** Total seeded spread width (±2 %). */
export const PUSH_SPREAD = 0.04;
/** Seed used when a run has no configured seed (quick race, builder test drive). */
export const DEFAULT_PUSH_SEED = 0x5eed;

/* -----------------------------------------------------------------------------
   2. SEEDED SPREAD
   -------------------------------------------------------------------------- */

/**
 * Deterministic [0, 1) hash of (seed, racerId) — a 32-bit avalanche, not `Math.random`.
 * The roster has its own `hash01` for identity collisions; this one is the push's own stream so
 * that adding a roster slot can never re-roll an existing racer's push.
 */
export function pushHash01(seed: number, racerId: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(racerId | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The down-track speed a racer is pushed to, in engine x-units/s.
 *
 * `pace` is the racer's own pace factor (exactly 1 for the legacy four-racer field, a bounded
 * spread for larger fields), so the push stays fair by construction: nobody's push depends on
 * their lane, their handling or the frame rate.
 */
export function startPushVelocity(pace: number, seed: number, racerId: number): number {
  const spread = (pushHash01(seed, racerId) - 0.5) * PUSH_SPREAD;
  return PUSH_BASE_VX * pace * (1 + spread);
}

/**
 * Down-track speed at push tick `k` (1..PUSH_TICKS): a linear ramp from rest to `target`.
 * Outside the range this refuses with a typed error instead of silently clamping, because a
 * clamped ramp would make a mis-ordered start look correct.
 */
export function pushRampVx(target: number, k: number): number {
  if (!Number.isInteger(k) || k < 1 || k > PUSH_TICKS) {
    throw new ContractError('E_PUSH_TICK', `push_tick_range: tick ${String(k)} is outside 1..${PUSH_TICKS}`, {
      tick: k, min: 1, max: PUSH_TICKS,
    });
  }
  // The final tick is the target *exactly* — `(target · 48) / 48` is not bit-identical in IEEE 754,
  // and AC-2 (and any replay comparison) is written against the exact value.
  return k === PUSH_TICKS ? target : (target * k) / PUSH_TICKS;
}

/**
 * Applies one push tick to a racer. Mutates **only** `vx`, `vy`, `vz` and `grounded`: the pad is
 * flat and empty, so no other field moves during the push (the caller integrates the position,
 * because it owns the clock and the surface query).
 */
export function applyPushTick(racer: Racer, k: number, target: number): void {
  racer.vx = pushRampVx(target, k);
  racer.vy = 0;
  racer.vz = 0;
  racer.grounded = true;
}

/**
 * Total push distance for a target speed, in engine x-units (the area under the linear ramp).
 * Exported because the start-zone test asserts the flat pad is long enough to hold the whole push
 * with room for the grid rows behind the player.
 */
export function pushDistance(target: number, dt: number): number {
  return target * dt * ((PUSH_TICKS + 1) / 2);
}
