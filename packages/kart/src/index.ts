export type Vec3 = [number, number, number];

export interface KartSpec {
  maxSpeed: number;
  accel: number;
  brake: number;
  turnRate: number;
  grip: number;
  mass: number;
}

export const DEFAULT_KART: KartSpec = {
  maxSpeed: 12,
  accel: 8,
  brake: 16,
  turnRate: 120,
  grip: 0.85,
  mass: 80,
};

export interface KartState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  onGround: boolean;
  airTime: number;
}

export interface KartInput {
  throttle: number;
  steer: number;
  brake: boolean;
}

export interface Ground {
  heightAt(x: number, z: number): number;
  isWater?(x: number, z: number): boolean;
}

const GRAVITY = 9.8;
const MAX_STEP = 0.05;

interface Basis {
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
}

function basis(yaw: number): Basis {
  const radians = (yaw * Math.PI) / 180;
  return {
    forwardX: Math.sin(radians),
    forwardZ: Math.cos(radians),
    rightX: Math.cos(radians),
    rightZ: -Math.sin(radians),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function approachZero(value: number, amount: number): number {
  if (value > 0) return Math.max(0, value - amount);
  if (value < 0) return Math.min(0, value + amount);
  return 0;
}

function copyState(s: KartState): KartState {
  return {
    pos: [s.pos[0], s.pos[1], s.pos[2]],
    vel: [s.vel[0], s.vel[1], s.vel[2]],
    yaw: s.yaw,
    onGround: s.onGround,
    airTime: s.airTime,
  };
}

export function spawnKart(pos: Vec3, yaw: number): KartState {
  return {
    pos: [pos[0], pos[1], pos[2]],
    vel: [0, 0, 0],
    yaw,
    onGround: true,
    airTime: 0,
  };
}

/** Speed along the facing direction, negative when reversing. */
export function forwardSpeed(s: KartState): number {
  const direction = basis(s.yaw);
  return s.vel[0] * direction.forwardX + s.vel[2] * direction.forwardZ;
}

function stepOnGround(
  s: KartState,
  input: KartInput,
  dt: number,
  ground: Ground,
  spec: KartSpec,
): KartState {
  const speedBeforeTurn = forwardSpeed(s);
  const steeringScale = Math.min(1, Math.abs(speedBeforeTurn) / 3);
  const yaw =
    s.yaw +
    spec.turnRate *
      clamp(input.steer, -1, 1) *
      steeringScale *
      Math.sign(speedBeforeTurn) *
      dt;
  const direction = basis(yaw);

  let forward = s.vel[0] * direction.forwardX + s.vel[2] * direction.forwardZ;
  const side = s.vel[0] * direction.rightX + s.vel[2] * direction.rightZ;
  const grip = clamp(spec.grip, 0, 1);
  const nextSide = side * Math.pow(1 - grip, dt / MAX_STEP);

  if (input.brake) {
    forward = approachZero(forward, spec.brake * dt);
  } else {
    const throttle = clamp(input.throttle, -1, 1);
    if (throttle === 0) {
      forward = approachZero(forward, 3 * dt);
    } else {
      forward += spec.accel * throttle * dt;
    }
  }

  const xVelocity = direction.forwardX * forward + direction.rightX * nextSide;
  const zVelocity = direction.forwardZ * forward + direction.rightZ * nextSide;
  const x = s.pos[0] + xVelocity * dt;
  const z = s.pos[2] + zVelocity * dt;
  const inWater = ground.isWater?.(x, z) === true;
  const maxForward = spec.maxSpeed * (inWater ? 0.5 : 1);
  forward = clamp(forward, -maxForward * 0.4, maxForward);

  const nextXVelocity = direction.forwardX * forward + direction.rightX * nextSide;
  const nextZVelocity = direction.forwardZ * forward + direction.rightZ * nextSide;
  const nextX = s.pos[0] + nextXVelocity * dt;
  const nextZ = s.pos[2] + nextZVelocity * dt;
  const floor = ground.heightAt(nextX, nextZ);
  const fallingY = s.pos[1] - 0.5 * GRAVITY * dt * dt;

  if (fallingY <= floor) {
    return {
      pos: [nextX, floor, nextZ],
      vel: [nextXVelocity, 0, nextZVelocity],
      yaw,
      onGround: true,
      airTime: 0,
    };
  }

  return {
    pos: [nextX, fallingY, nextZ],
    vel: [nextXVelocity, -GRAVITY * dt, nextZVelocity],
    yaw,
    onGround: false,
    airTime: s.airTime + dt,
  };
}

function stepInAir(s: KartState, dt: number, ground: Ground): KartState {
  const x = s.pos[0] + s.vel[0] * dt;
  const z = s.pos[2] + s.vel[2] * dt;
  const y = s.pos[1] + s.vel[1] * dt - 0.5 * GRAVITY * dt * dt;
  const verticalVelocity = s.vel[1] - GRAVITY * dt;
  const floor = ground.heightAt(x, z);

  if (y <= floor) {
    return {
      pos: [x, floor, z],
      vel: [s.vel[0], 0, s.vel[2]],
      yaw: s.yaw,
      onGround: true,
      airTime: 0,
    };
  }

  return {
    pos: [x, y, z],
    vel: [s.vel[0], verticalVelocity, s.vel[2]],
    yaw: s.yaw,
    onGround: false,
    airTime: s.airTime + dt,
  };
}

function stepOnce(
  s: KartState,
  input: KartInput,
  dt: number,
  ground: Ground,
  spec: KartSpec,
): KartState {
  return s.onGround
    ? stepOnGround(s, input, dt, ground, spec)
    : stepInAir(s, dt, ground);
}

/** Advance by dt, splitting longer durations into steps of at most 0.05 seconds. */
export function stepKart(
  s: KartState,
  input: KartInput,
  dt: number,
  ground: Ground,
  spec?: KartSpec,
): KartState {
  if (!(dt > 0) || !Number.isFinite(dt)) return copyState(s);

  const selectedSpec = spec ?? DEFAULT_KART;
  const stepCount = Math.ceil(dt / MAX_STEP);
  let state = copyState(s);

  for (let i = 0; i < stepCount; i += 1) {
    const substep = Math.min(MAX_STEP, dt - i * MAX_STEP);
    state = stepOnce(state, input, substep, ground, selectedSpec);
  }

  return state;
}

/** Tilt from terrain heights beneath the front, back, left and right wheels. */
export function tilt(
  s: KartState,
  ground: Ground,
): { pitch: number; roll: number } {
  const direction = basis(s.yaw);
  const frontHeight = ground.heightAt(
    s.pos[0] + direction.forwardX * 0.3,
    s.pos[2] + direction.forwardZ * 0.3,
  );
  const backHeight = ground.heightAt(
    s.pos[0] - direction.forwardX * 0.3,
    s.pos[2] - direction.forwardZ * 0.3,
  );
  const rightHeight = ground.heightAt(
    s.pos[0] + direction.rightX * 0.25,
    s.pos[2] + direction.rightZ * 0.25,
  );
  const leftHeight = ground.heightAt(
    s.pos[0] - direction.rightX * 0.25,
    s.pos[2] - direction.rightZ * 0.25,
  );
  const degrees = 180 / Math.PI;

  return {
    pitch: Math.atan2(frontHeight - backHeight, 0.6) * degrees,
    roll: Math.atan2(rightHeight - leftHeight, 0.5) * degrees,
  };
}