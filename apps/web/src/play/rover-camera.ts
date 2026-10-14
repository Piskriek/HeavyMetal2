// The rover's third-person camera (TASK-27b, P0-VEH-01). Pure and deterministic: no DOM, no clock, no randomness.
//
// The arm runs from a pivot 1.4 m above the chassis to the wanted spot 5.5 m behind it and 2.1 m up. The caller casts the arm
// against the terrain, the boulders and the placed pieces. On a hit the arm pulls in to the hit minus 0.35 m: it snaps in with
// a 25 ms time constant and eases back out over 250 ms. The camera never goes below the ground at its own x and z plus 0.65 m.
// The horizon stays level: the arm has no roll input, and pitch only lifts the look target, with a 0.12 s lag, so small bumps
// do not shake the picture.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The arm's numbers (the brief's P0-VEH-01). Metres and seconds. */
export const ROVER_CAMERA = {
  pivotHeight: 1.4,
  armBack: 5.5,
  armUp: 2.1,
  sphereRadius: 0.35,
  floorClearance: 0.65,
  /** Time to 95% of a change: the snap in to a wall is within 25 ms, the ease back out takes 250 ms. */
  snapInSec: 0.025,
  easeOutSec: 0.25,
  pitchLagSec: 0.12,
  lookAhead: 2.5,
  minArm: 1.1,
} as const;

/** Casts a ray from `origin` along the unit `dir`: the distance to the first surface within `maxDist`, or null for none. */
export type SurfaceCast = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

/** ln(20): a first-order approach is 95% done after three time constants, so tau = time to 95% / ln(20). */
const TAU_95 = Math.log(20);

export interface RoverArmState {
  /** The arm's current length from the pivot (m). */
  arm: number;
  /** The chassis pitch as the camera sees it (rad, nose up positive), lagged. */
  pitch: number;
}

export function createRoverArmState(): RoverArmState {
  return { arm: Math.hypot(ROVER_CAMERA.armBack, ROVER_CAMERA.armUp), pitch: 0 };
}

export interface RoverArmInput {
  /** The chassis position (its origin, on the ground). */
  readonly chassis: Vec3;
  /** The chassis heading (rad): the forward vector is (sin yaw, 0, cos yaw). */
  readonly yaw: number;
  /** The chassis pitch (rad, nose up positive). */
  readonly pitch: number;
  readonly dt: number;
  /** The ground height at x, z. */
  readonly groundAt: (x: number, z: number) => number;
  /** Optional obstacle cast (terrain, boulders, pieces) along the arm. */
  readonly cast?: SurfaceCast;
}

export interface RoverArmOutput {
  readonly camera: Vec3;
  readonly lookAt: Vec3;
  /** The arm's length after this step (m). */
  readonly arm: number;
  /** The arm is pulled in by something on its line. */
  readonly obstructed: boolean;
  /** The floor clamp raised the camera this step. */
  readonly floorClamped: boolean;
}

/** One step of the rover camera. Mutates `state` (the arm and the lagged pitch) and returns where the camera is. */
export function stepRoverArm(state: RoverArmState, input: RoverArmInput): RoverArmOutput {
  const cfg = ROVER_CAMERA;
  const dt = Math.max(0, input.dt);

  // the horizon: pitch follows the chassis with a lag, so a bump does not shake the picture
  state.pitch += (input.pitch - state.pitch) * (1 - Math.exp(-dt / cfg.pitchLagSec));

  const pivot: Vec3 = { x: input.chassis.x, y: input.chassis.y + cfg.pivotHeight, z: input.chassis.z };
  const sinYaw = Math.sin(input.yaw), cosYaw = Math.cos(input.yaw);
  const full = Math.hypot(cfg.armBack, cfg.armUp);
  // the arm's direction: horizontal back from the heading, lifted by the arm's own height
  const dir = normalise({ x: -sinYaw * cfg.armBack, y: cfg.armUp, z: -cosYaw * cfg.armBack });

  // the sphere cast: the first surface on the arm pulls it in to the hit minus the sphere radius
  let target = full;
  let obstructed = false;
  if (input.cast) {
    const hit = input.cast(pivot, dir, full);
    if (hit !== null && hit - cfg.sphereRadius < full) {
      target = Math.max(cfg.minArm, hit - cfg.sphereRadius);
      obstructed = true;
    }
  }
  const settle = target < state.arm ? cfg.snapInSec : cfg.easeOutSec;
  state.arm += (target - state.arm) * (1 - Math.exp(-dt / (settle / TAU_95)));

  const camera: Vec3 = {
    x: pivot.x + dir.x * state.arm,
    y: pivot.y + dir.y * state.arm,
    z: pivot.z + dir.z * state.arm,
  };
  // the floor clamp: never below the ground at the camera's own x and z, plus the clearance
  const floor = input.groundAt(camera.x, camera.z) + cfg.floorClearance;
  const floorClamped = camera.y < floor;
  const finalCamera: Vec3 = floorClamped ? { x: camera.x, y: floor, z: camera.z } : camera;

  // the look target: straight ahead on the heading, lifted or dropped by the damped pitch
  const cosPitch = Math.cos(state.pitch);
  const lookAt: Vec3 = {
    x: pivot.x + sinYaw * cfg.lookAhead * cosPitch,
    y: pivot.y + 0.25 + Math.sin(state.pitch) * cfg.lookAhead,
    z: pivot.z + cosYaw * cfg.lookAhead * cosPitch,
  };
  return { camera: finalCamera, lookAt, arm: state.arm, obstructed, floorClamped };
}

function normalise(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * The first distance along `dir` (unit) at which the ray from `origin` goes under the heightfield, refined by bisection; null
 * when it stays above the ground for `maxDist`. A ray that starts under the ground hits at 0.
 */
export function castHeightfield(origin: Vec3, dir: Vec3, maxDist: number, groundAt: (x: number, z: number) => number, step = 0.2): number | null {
  const under = (t: number): boolean => {
    const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
    return y < groundAt(x, z);
  };
  if (under(0)) return 0;
  let prev = 0;
  for (let t = step; ; t += step) {
    const at = Math.min(t, maxDist);
    if (under(at)) {
      let lo = prev, hi = at;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (under(mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    if (at >= maxDist) return null;
    prev = at;
  }
}

/** A sphere for the sphere casts (the boulders). */
export interface CastSphere {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
}

/** The first distance along `dir` (unit) at which the ray from `origin` enters any sphere within `maxDist`, or null. */
export function castSpheres(origin: Vec3, dir: Vec3, maxDist: number, spheres: readonly CastSphere[]): number | null {
  let best: number | null = null;
  for (const s of spheres) {
    const ox = origin.x - s.x, oy = origin.y - s.y, oz = origin.z - s.z;
    const b = ox * dir.x + oy * dir.y + oz * dir.z;
    const c = ox * ox + oy * oy + oz * oz - s.r * s.r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    const t = c <= 0 ? 0 : -b - root;
    if (t < 0 || t > maxDist) continue;
    if (best === null || t < best) best = t;
  }
  return best;
}

/** The nearer of two optional hits. */
export function nearestHit(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
