/**
 * IF-CAMERA: Camera rigs (fly, orbit, focus, ortho) as pure, framerate-independent state steps.
 * Provides DCC-grade navigation for the 3D track builder.
 */

export type RigMode = 'fly' | 'orbit' | 'ortho-top' | 'ortho-front' | 'ortho-side';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RigState {
  mode: RigMode;
  position: Vec3;
  target: Vec3;
  yaw: number;
  pitch: number;
  distance: number;
  orthoHalfHeight: number;
  frame: 'world' | 'track';
}

export const FLY_SPEED = 900;
export const FLY_TURBO = 4;
export const FOCUS_MARGIN = 1.2;
export const FOCUS_DAMP_S = 0.25;

export const PITCH_MIN = -1.54;
export const PITCH_MAX = 1.54;
export const DISTANCE_MIN = 40;
export const DISTANCE_MAX = 60000;

export interface FlyInput {
  fwd: number;
  right: number;
  up: number;
  turbo: boolean;
  dYaw: number;
  dPitch: number;
}

/**
 * Pure, framerate-independent fly navigation step.
 * Integrates input velocities over dt with pitch clamped to [-1.54, 1.54].
 */
export function flyStep(s: RigState, input: FlyInput, dt: number): RigState {
  const yaw = s.yaw + input.dYaw;
  const pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.pitch + input.dPitch));

  const speed = FLY_SPEED * (input.turbo ? FLY_TURBO : 1);
  const moveDist = speed * dt;

  // Forward and right unit vectors on the horizontal (yaw) plane
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  // In our engine convention: yaw 0 looks along -Z (or along X/Z plane)
  const forwardX = -sinY;
  const forwardZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  const dx = (forwardX * input.fwd + rightX * input.right) * moveDist;
  const dy = input.up * moveDist;
  const dz = (forwardZ * input.fwd + rightZ * input.right) * moveDist;

  const newPos: Vec3 = {
    x: s.position.x + dx,
    y: s.position.y + dy,
    z: s.position.z + dz,
  };

  // Target points along look direction from new position
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const lookDir: Vec3 = {
    x: -sinY * cosP,
    y: sinP,
    z: -cosY * cosP,
  };

  const newTarget: Vec3 = {
    x: newPos.x + lookDir.x * s.distance,
    y: newPos.y + lookDir.y * s.distance,
    z: newPos.z + lookDir.z * s.distance,
  };

  return {
    ...s,
    mode: 'fly',
    position: newPos,
    target: newTarget,
    yaw,
    pitch,
  };
}

/**
 * Orbit around the target point (selection pivot or cursor hit).
 * Alt+drag rotates yaw and pitch; wheel scales distance.
 */
export function orbitStep(s: RigState, dx: number, dy: number, wheel: number): RigState {
  const yaw = s.yaw + dx;
  const pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.pitch + dy));

  let distance = s.distance;
  if (wheel !== 0) {
    const factor = wheel > 0 ? 1.1 : 1 / 1.1;
    distance = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, distance * factor));
  }

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  // Position is backed off from target by distance
  const newPos: Vec3 = {
    x: s.target.x + sinY * cosP * distance,
    y: s.target.y - sinP * distance,
    z: s.target.z + cosY * cosP * distance,
  };

  return {
    ...s,
    mode: 'orbit',
    position: newPos,
    yaw,
    pitch,
    distance,
  };
}

/**
 * Focuses camera on a bounding sphere with FOCUS_MARGIN (1.2).
 * d = FOCUS_MARGIN * r / sin(theta), where theta accounts for viewport aspect ratio.
 */
export function focusTarget(
  s: RigState,
  sphere: { center: Vec3; radius: number },
  fovDeg: number,
  aspect: number,
): RigState {
  const r = Math.max(1, sphere.radius);
  const halfFovV = ((fovDeg * Math.PI) / 180) / 2;
  const halfFovH = Math.atan(Math.tan(halfFovV) * aspect);
  const effectiveTheta = aspect < 1 ? halfFovH : halfFovV;

  const distance = Math.max(
    DISTANCE_MIN,
    Math.min(DISTANCE_MAX, (FOCUS_MARGIN * r) / Math.sin(effectiveTheta)),
  );

  const cosP = Math.cos(s.pitch);
  const sinP = Math.sin(s.pitch);
  const cosY = Math.cos(s.yaw);
  const sinY = Math.sin(s.yaw);

  const newPos: Vec3 = {
    x: sphere.center.x + sinY * cosP * distance,
    y: sphere.center.y - sinP * distance,
    z: sphere.center.z + cosY * cosP * distance,
  };

  return {
    ...s,
    target: { ...sphere.center },
    position: newPos,
    distance,
    orthoHalfHeight: FOCUS_MARGIN * r,
  };
}

/**
 * Critically damped interpolation between rig states over dt.
 */
export function dampRig(from: RigState, to: RigState, dt: number): RigState {
  if (dt <= 0) return { ...from };
  const lambda = 1 / FOCUS_DAMP_S;
  const decay = Math.exp(-lambda * dt);
  const lerp = (a: number, b: number) => b + (a - b) * decay;

  return {
    ...to,
    mode: to.mode,
    position: {
      x: lerp(from.position.x, to.position.x),
      y: lerp(from.position.y, to.position.y),
      z: lerp(from.position.z, to.position.z),
    },
    target: {
      x: lerp(from.target.x, to.target.x),
      y: lerp(from.target.y, to.target.y),
      z: lerp(from.target.z, to.target.z),
    },
    yaw: lerp(from.yaw, to.yaw),
    pitch: lerp(from.pitch, to.pitch),
    distance: lerp(from.distance, to.distance),
    orthoHalfHeight: lerp(from.orthoHalfHeight, to.orthoHalfHeight),
  };
}

export type TrackFrameSampler = (x: number, z: number) => {
  tangent: [number, number];
  right: [number, number];
  up?: [number, number, number];
};

/**
 * Configure orthographic view (top, front, side) aligned to world or track frame.
 */
export function orthoFor(
  s: RigState,
  view: 'top' | 'front' | 'side',
  trackSampler?: TrackFrameSampler,
): RigState {
  const mode: RigMode =
    view === 'top' ? 'ortho-top' : view === 'front' ? 'ortho-front' : 'ortho-side';

  let yaw = 0;
  let pitch = 0;

  if (s.frame === 'track' && trackSampler) {
    const frame = trackSampler(s.target.x, s.target.z);
    const trackAngle = Math.atan2(frame.tangent[0], -frame.tangent[1]);

    if (view === 'top') {
      yaw = trackAngle;
      pitch = -Math.PI / 2 + 1e-4; // Looking straight down
    } else if (view === 'front') {
      yaw = trackAngle;
      pitch = 0;
    } else {
      yaw = trackAngle + Math.PI / 2;
      pitch = 0;
    }
  } else {
    // World space orthographic alignments
    if (view === 'top') {
      yaw = 0;
      pitch = -Math.PI / 2 + 1e-4; // Looking along -Y
    } else if (view === 'front') {
      yaw = 0;
      pitch = 0; // Looking along -Z
    } else {
      yaw = Math.PI / 2;
      pitch = 0; // Looking along -X
    }
  }

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  const newPos: Vec3 = {
    x: s.target.x + sinY * cosP * s.distance,
    y: s.target.y - sinP * s.distance,
    z: s.target.z + cosY * cosP * s.distance,
  };

  return {
    ...s,
    mode,
    yaw,
    pitch,
    position: newPos,
  };
}
