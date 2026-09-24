/**
 * M01 · T3 — the gyro ball (IF-GYRO).
 *
 * The goblin rides inside a ball whose shell rolls but whose *frame* does not: two brass caps sit
 * either side of him and stay level, so the rider (and the cockpit camera) never tumbles while the
 * core spins under the track surface. That split is the whole trick of the reference goblin-ball,
 * and it is expressed here as pure arithmetic: a roll phase the physics owns, and a pose the
 * renderer copies.
 *
 * Everything is immutable tuples and numbers — no THREE, no DOM, no allocation on the hot path
 * (`advanceRoll` mutates the state it is handed, because it runs per racer at 120 Hz).
 *
 * Conventions: `core` = basis ∘ rotation(−rollPhase) about the frame's right axis, so the shell
 * rolls *forward* as the ball gains speed; `gyro` = the basis alone, which is what the caps, the
 * rider and the camera wear. World up is unchanged by any roll phase — that is the acceptance test.
 */
import type { GyroFrame, Vec3 } from './first-person';

/* -----------------------------------------------------------------------------
   1. FROZEN CONSTANTS (IF-GYRO, D2)
   -------------------------------------------------------------------------- */

/** Angular radius of each brass cap, radians. */
export const CAP_THETA = 0.62;
/** Caps ride slightly proud of the shell so they never z-fight with it. */
export const CAP_RADIUS_SCALE = 1.04;
/** Airborne spin decays at this rate, 1/s. */
export const AIR_ROLL_DECAY = 0.6;
/** Ball radius, repeated here so the roll law is self-contained. */
export const GYRO_RADIUS = 31;
export const TAU = Math.PI * 2;

/* -----------------------------------------------------------------------------
   2. THE ROLL LAW
   -------------------------------------------------------------------------- */

export interface RollState {
  /** Radians, always in [0, TAU). */
  rollPhase: number;
  /** Radians/s. */
  rollRate: number;
}

export interface RollMotion {
  vx: number;
  vz: number;
  grounded: boolean;
  inLoop: boolean;
}

/**
 * Advances the shell's roll.
 *
 * Grounded (or riding a loop) the shell rolls without slipping: `Δphase = hypot(vx, vz)·dt / R`.
 * Airborne there is nothing to grip, so the rate bleeds off exponentially and the phase keeps
 * coasting. Mutates and returns `state` — the racer's own fields — so a 120 Hz step never allocates.
 */
export function advanceRoll(state: RollState, motion: RollMotion, dt: number): RollState {
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  // A corrupt phase must not poison every later frame: the shell may as well start from rest.
  if (!Number.isFinite(state.rollPhase)) state.rollPhase = 0;
  if (!Number.isFinite(state.rollRate)) state.rollRate = 0;
  if (motion.grounded || motion.inLoop) {
    state.rollRate = Math.hypot(motion.vx, motion.vz) / GYRO_RADIUS;
  } else {
    state.rollRate *= Math.exp(-AIR_ROLL_DECAY * step);
  }
  const phase = state.rollPhase + state.rollRate * step;
  state.rollPhase = ((phase % TAU) + TAU) % TAU;
  return state;
}

/* -----------------------------------------------------------------------------
   3. THE POSE
   -------------------------------------------------------------------------- */

/** x, y, z, w — the same order as `Quaternion.set`. */
export type Quat = readonly [number, number, number, number];

export interface GyroPose {
  /** The rolling shell: basis ∘ rotation(−rollPhase) about the frame's right axis. */
  readonly core: Quat;
  /** The level part: caps, rider and camera. Identical for every roll phase. */
  readonly gyro: Quat;
}

const IDENTITY: Quat = [0, 0, 0, 1];

/** Normalises a vector, or returns null when it cannot (zero or non-finite). */
function unit(v: Vec3): [number, number, number] | null {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(length) || length < 1e-9) return null;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Quaternion from an orthonormal basis given as its three column axes (local X, Y, Z in world
 * space). Shepperd's method: pick the largest diagonal term, so no near-zero square root is ever
 * taken and a 90° rotation is as accurate as a 0° one.
 */
export function quatFromBasis(xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Quat {
  const m00 = xAxis[0], m10 = xAxis[1], m20 = xAxis[2];
  const m01 = yAxis[0], m11 = yAxis[1], m21 = yAxis[2];
  const m02 = zAxis[0], m12 = zAxis[1], m22 = zAxis[2];
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4;
  }
  const length = Math.hypot(x, y, z, w);
  if (!Number.isFinite(length) || length < 1e-9) return IDENTITY;
  return [x / length, y / length, z / length, w / length];
}

/** `a ∘ b`: b's rotation applied first, then a's. */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Unit quaternion for a rotation of `angle` radians about `axis` (normalised for you). */
export function quatAxisAngle(axis: Vec3, angle: number): Quat {
  const unitAxis = unit(axis);
  if (!unitAxis) return IDENTITY;
  const half = angle / 2;
  const s = Math.sin(half);
  return [unitAxis[0] * s, unitAxis[1] * s, unitAxis[2] * s, Math.cos(half)];
}

/** World vector a quaternion sends the given local vector to. */
export function quatRotate(q: Quat, v: Vec3): [number, number, number] {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // t = 2·(q × v), then v' = v + w·t + q × t.
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/**
 * The pose the renderer wears: the level basis for the caps, the rider and the camera, and the
 * basis with the shell's roll folded in for the core.
 *
 * The basis maps local +X to the frame's right, +Y to up and +Z to *backward* (three.js's own
 * convention: a mesh's face looks down −Z), which is why the tangent enters negated.
 */
export function gyroPose(rollPhase: number, frame: GyroFrame): GyroPose {
  const right = unit(frame.right) ?? [1, 0, 0];
  const up = unit(frame.up) ?? [0, 1, 0];
  // Re-orthogonalise: a frame that arrives slightly skewed must still give a clean basis. The track
  // builds its frame as right = forward × up, so the right-handed triple here is (right, up, back)
  // with back = right × up = −forward — three.js's own convention, where a mesh faces down −Z.
  const back = unit(cross(right, up)) ?? [0, 0, 1];
  const gyro = quatFromBasis(right, up, back);
  if (!Number.isFinite(rollPhase) || rollPhase === 0) return { core: gyro, gyro };
  return { core: quatMultiply(gyro, quatAxisAngle([1, 0, 0], -rollPhase)), gyro };
}

/* -----------------------------------------------------------------------------
   4. THE FRAME
   -------------------------------------------------------------------------- */

/**
 * Which way is up for the gyro this frame.
 *
 * - Riding a loop: up points at the ring's centre, so the view goes head-over-heels with the track
 *   (the honest feel of a loop) and up never degenerates however the ball is oriented.
 * - Falling: the frame freezes at the last grounded one; a camera that keeps turning while the ball
 *   is in free fall is the fastest way to make a player sick.
 * - Otherwise: the track's own frame, untouched.
 */
export function gyroFrameFor(
  sample: GyroFrame,
  loop: { readonly centre: Vec3 } | null,
  ballCentre: Vec3,
  falling: boolean,
  lastGrounded: GyroFrame,
): GyroFrame {
  if (falling) return lastGrounded;
  if (loop) {
    const toCentre: Vec3 = [
      loop.centre[0] - ballCentre[0],
      loop.centre[1] - ballCentre[1],
      loop.centre[2] - ballCentre[2],
    ];
    const up = unit(toCentre);
    if (up) {
      // Keep the track's heading, projected square onto the new up; fall back to the frame's own
      // right axis when the heading is parallel to up (the ball at the top of the ring).
      const heading = sample.forward;
      let forward: [number, number, number] | null = null;
      const along = dot(heading, up);
      const projected: Vec3 = [
        heading[0] - up[0] * along,
        heading[1] - up[1] * along,
        heading[2] - up[2] * along,
      ];
      forward = unit(projected);
      if (!forward) forward = unit(cross(up, sample.right));
      if (forward) {
        const right = unit(cross(forward, up)) ?? sample.right;
        return { forward, up, right };
      }
    }
  }
  return sample;
}
