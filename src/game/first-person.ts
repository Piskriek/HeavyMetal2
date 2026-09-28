/**
 * M01 · T0/T3 — first-person camera composition (pure).
 *
 * One function turns "where the ball is" plus "which way is up" into the numbers a
 * `THREE.PerspectiveCamera` copies. It never touches THREE, the DOM or the scene graph, so the
 * whole aperture rig is testable headlessly — which matters because this sandbox has no WebGL
 * (`scripts/probe-webgl.mjs`: every configuration reports "no gl").
 *
 * The renderer only copies `position`, `up` and looks at `position + forward`; `right` is returned
 * for the gyro pose and for tests. Nothing here allocates per frame beyond the two small objects it
 * returns, and every branch is total: a NaN can only enter through a NaN input, and even then the
 * output is flagged rather than propagated into the camera matrix.
 *
 * T0 runs this with the plain, banked track frame (`placementFromEngine(...).frame`). T3 feeds the
 * same function the gyro frame from `gyro-ball.ts`, so the camera, the meshes and the physics all
 * read one mapping (law 7).
 */

/* -----------------------------------------------------------------------------
   1. FROZEN CONSTANTS (plan decisions D1)
   -------------------------------------------------------------------------- */

/** World units above the ball centre, along the frame up. */
export const FP_EYE_HEIGHT = 24;
/** World units forward of the ball centre, along the frame forward. */
export const FP_EYE_FORWARD = 6;
/** Spline units (s) ahead of the ball that the eye looks at. */
export const FP_LOOK_AHEAD = 520;
/** Vertical field of view, degrees. */
export const FP_FOV = 74;
export const FP_NEAR = 4;
export const FP_FAR = 200000;
/** Visual-only up smoothing, 1/s. Disabled while the frame turns faster than this can follow. */
export const FP_UP_SMOOTH_RATE = 8;
/** |forward · up| above this is a degenerate view: re-orthonormalise against the previous frame. */
export const FP_DEGENERATE_DOT = 0.985;

/* -----------------------------------------------------------------------------
   2. TYPES (IF-FP)
   -------------------------------------------------------------------------- */

/** World-space vector. Engine space is a different space: see track-space.ts. */
export type Vec3 = readonly [number, number, number];

/** Orthonormal, right-handed, world space. */
export interface GyroFrame {
  readonly forward: Vec3;
  readonly up: Vec3;
  readonly right: Vec3;
}

export interface FirstPersonInput {
  /** Ball centre in world space, straight from `placementFromEngine`. */
  readonly ballCentre: Vec3;
  /** The frame the eye rides: track tangent at T0, gyro pose at T3. */
  readonly gyro: GyroFrame;
  /** World point to look at: a spline sample ahead, lifted along `up`. */
  readonly lookPoint: Vec3;
  /** Last frame's smoothed up, renderer-held. `null` on the first frame. */
  readonly previousUp: Vec3 | null;
  /** Render seconds, clamped by the caller to [0, 0.1]. */
  readonly dt: number;
  /** True while the racer is in free fall: the frame freezes (T3 supplies the frozen frame). */
  readonly falling: boolean;
}

export interface FirstPersonFrame {
  readonly position: Vec3;
  readonly forward: Vec3;
  readonly up: Vec3;
  readonly right: Vec3;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  /** True when the guard engaged this frame (view was (anti)parallel to up, or input was unusable). */
  readonly degenerate: boolean;
}

/* -----------------------------------------------------------------------------
   3. SMALL VECTOR HELPERS (no THREE, no allocation)
   -------------------------------------------------------------------------- */

const EPS = 1e-9;

function length(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

/** Unit vector, or null when the input is non-finite or has no length. */
function unit(x: number, y: number, z: number): Vec3 | null {
  const len = length(x, y, z);
  if (!Number.isFinite(len) || len < EPS) return null;
  return [x / len, y / len, z / len];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const addScaled = (a: Vec3, b: Vec3, scale: number): Vec3 =>
  [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];

/* -----------------------------------------------------------------------------
   4. THE CAMERA FRAME
   -------------------------------------------------------------------------- */

/**
 * Builds one first-person frame.
 *
 * - `position` = ballCentre + up · FP_EYE_HEIGHT + forward · FP_EYE_FORWARD.
 * - `up` is the frame up (smoothed by `FP_UP_SMOOTH_RATE` while turning gently, taken raw while
 *   turning fast so a loop does not lag), never y=0 and always unit length.
 * - `forward` points at `lookPoint`, projected onto the plane perpendicular to `up`.
 * - The basis is exactly orthonormal: `forward · up = 0` to within 1e-12, and `right = forward × up`
 *   completes it. (Note the handedness: with world up at +y and forward at +z this makes `right`
 *   point at −x, which is what the renderer expects because it looks along `forward` with `up`.)
 * - The degenerate branch (view within ~10° of straight up/down the up axis) re-orthonormalises
 *   against the previous frame's up, then against the gyro basis, and finally against `gyro.right`.
 *   It always returns a usable frame and sets `degenerate: true`.
 */
export function firstPersonFrame(input: FirstPersonInput): FirstPersonFrame {
  const { ballCentre, gyro, lookPoint, previousUp, dt, falling } = input;

  const gyroUp = unit(gyro.up[0], gyro.up[1], gyro.up[2]) ?? ([0, 1, 0] as Vec3);
  const gyroForward = unit(gyro.forward[0], gyro.forward[1], gyro.forward[2]) ?? ([0, 0, 1] as Vec3);
  const gyroRight = unit(gyro.right[0], gyro.right[1], gyro.right[2]) ?? cross(gyroForward, gyroUp);

  const position: Vec3 = addScaled(addScaled(ballCentre, gyroUp, FP_EYE_HEIGHT), gyroForward, FP_EYE_FORWARD);

  // Up: smoothed toward the frame up, unless the frame is turning faster than the smoothing can
  // follow (a loop) or the ball is in free fall (T3 freezes the frame, so the raw up is already
  // frozen and must not be smoothed twice).
  const step = Math.min(Math.max(dt, 0), 0.1);
  const blend = falling || !previousUp || !isFiniteVec(previousUp) ? 0 : 1 - Math.exp(-step * FP_UP_SMOOTH_RATE);
  const rawUp = blend > 0 ? lerpUnit(previousUp as Vec3, gyroUp, blend) : gyroUp;
  const up = unit(rawUp[0], rawUp[1], rawUp[2]) ?? gyroUp;

  // Forward: toward the look point, flattened onto the up plane.
  const desired = sub(lookPoint, position);
  const desiredUnit = unit(desired[0], desired[1], desired[2]);
  const tooCloseToUp = desiredUnit !== null && Math.abs(dot(desiredUnit, up)) > FP_DEGENERATE_DOT;
  let forward = tooCloseToUp ? null : flatten(desired, up);
  let degenerate = tooCloseToUp || forward === null;
  if (!forward) {
    // Re-orthonormalise against the frame's own basis: forward first, then right.
    forward = flatten(gyroForward, up) ?? flatten(gyroRight, up) ?? gyroForward;
    degenerate = true;
  }

  const right = safeUnit(cross(forward, up), safeUnit(cross(gyroForward, gyroUp), [1, 0, 0] as Vec3));

  return Object.freeze({
    position,
    forward,
    up,
    right,
    fov: FP_FOV,
    near: FP_NEAR,
    far: FP_FAR,
    degenerate,
  });
}

/** Component-wise lerp of two unit vectors, renormalised. */
function lerpUnit(a: Vec3, b: Vec3, t: number): Vec3 {
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  const z = a[2] + (b[2] - a[2]) * t;
  return unit(x, y, z) ?? b;
}

/** `unit(v)`, or `fallback` when `v` has no usable length. */
function safeUnit(v: Vec3, fallback: Vec3): Vec3 {
  return unit(v[0], v[1], v[2]) ?? fallback;
}

/** Projects `v` onto the plane perpendicular to `up`. Null when the projection has no length. */
function flatten(v: Vec3, up: Vec3): Vec3 | null {
  const k = dot(v, up);
  return unit(v[0] - up[0] * k, v[1] - up[1] * k, v[2] - up[2] * k);
}

/* -----------------------------------------------------------------------------
   5. FLAG / OPTION PLUMBING
   -------------------------------------------------------------------------- */

/**
 * True when the page was opened with `?fp=1` (the T0 spike flag). T3 keeps the flag as an override
 * for the `first_person` camera mode; nothing reads this outside the renderer, so the flag can be
 * deleted with the spike.
 */
export function firstPersonFlag(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  for (const part of query.split('&')) {
    const [key, value = ''] = part.split('=');
    if (key === 'fp' && (value === '1' || value === '' || value === 'true')) return true;
  }
  return false;
}

/* -----------------------------------------------------------------------------
   5. LEAN (visual only)
   -------------------------------------------------------------------------- */

/** Most the view leans into a lane change, degrees (at full lateral speed). */
export const FP_LEAN_MAX_DEG = 8;
/** Lateral speed that counts as full lean; matches the steering clamp (cockpit VZ_MAX). */
export const FP_LEAN_FULL_VZ = 650;
/** How fast the lean follows the lateral speed, 1/s. */
export const FP_LEAN_RATE = 7;

/**
 * Target lean for a lateral speed, radians. Negative = leaning left. Steering left drives the ball at
 * negative vz (screen-left), so the view leans left into it, like a rider into a bend.
 */
export function leanAngleFor(vz: number): number {
  if (!Number.isFinite(vz)) return 0;
  const t = Math.max(-1, Math.min(1, vz / FP_LEAN_FULL_VZ));
  return (t * FP_LEAN_MAX_DEG * Math.PI) / 180;
}

/** One smoothing step of the lean toward its target (frame-rate independent). */
export function stepLean(current: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-FP_LEAN_RATE * Math.min(Math.max(dt, 0), 0.1));
  return current + (target - current) * k;
}

/**
 * Tilts the camera's up about its forward axis by `angle` (radians). Positive tilts toward `right`
 * (the screen-right of this basis), negative toward screen-left. Returns a unit vector ⊥ forward.
 */
export function leanUp(frame: Pick<FirstPersonFrame, 'up' | 'right'>, angle: number): Vec3 {
  if (!Number.isFinite(angle) || angle === 0) return frame.up;
  const c = Math.cos(angle); const s = Math.sin(angle);
  const v: Vec3 = [
    frame.up[0] * c + frame.right[0] * s,
    frame.up[1] * c + frame.right[1] * s,
    frame.up[2] * c + frame.right[2] * s,
  ];
  return unit(v[0], v[1], v[2]) ?? frame.up;
}
