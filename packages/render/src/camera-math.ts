import type { Vec3 } from '@hm/contracts';

export interface OrbitState {
  readonly target: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly fov: number;
}

export interface Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export const MAX_PITCH = 1.5;
export const MIN_DIST = 0.5;
export const MAX_DIST = 2000;

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

const basis = (state: OrbitState): { right: Vec3; up: Vec3; forward: Vec3 } => {
  const cy = Math.cos(state.yaw);
  const sy = Math.sin(state.yaw);
  const cp = Math.cos(state.pitch);
  const sp = Math.sin(state.pitch);
  return {
    right: [cy, 0, -sy],
    up: [-sp * sy, cp, -sp * cy],
    forward: [-cp * sy, -sp, -cp * cy],
  };
};

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function orbitPosition(state: OrbitState): Vec3 {
  const horizontal = Math.cos(state.pitch) * state.distance;
  return [
    state.target[0] + horizontal * Math.sin(state.yaw),
    state.target[1] + state.distance * Math.sin(state.pitch),
    state.target[2] + horizontal * Math.cos(state.yaw),
  ];
}

export function stateFromPositionTarget(position: Vec3, target: Vec3, fov: number): OrbitState {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const rawDistance = Math.hypot(dx, dy, dz);
  const distance = Math.max(MIN_DIST, rawDistance);
  return {
    target: [...target],
    yaw: rawDistance > 0 ? Math.atan2(dx, dz) : 0,
    pitch: rawDistance > 0 ? Math.asin(clamp(dy / rawDistance, -1, 1)) : 0,
    distance,
    fov,
  };
}

export function orbit(state: OrbitState, dYaw: number, dPitch: number): OrbitState {
  return { ...state, target: [...state.target], yaw: state.yaw + dYaw, pitch: clamp(state.pitch + dPitch, -MAX_PITCH, MAX_PITCH) };
}

export function zoom(state: OrbitState, factor: number): OrbitState {
  return { ...state, target: [...state.target], distance: clamp(state.distance * factor, MIN_DIST, MAX_DIST) };
}

export function pan(state: OrbitState, right: number, up: number): OrbitState {
  const axes = basis(state);
  return {
    ...state,
    target: [
      state.target[0] + axes.right[0] * right + axes.up[0] * up,
      state.target[1] + axes.right[1] * right + axes.up[1] * up,
      state.target[2] + axes.right[2] * right + axes.up[2] * up,
    ],
  };
}

export function project(state: OrbitState, point: Vec3, width: number, height: number): readonly [number, number] | null {
  if (width <= 0 || height <= 0) return null;
  const position = orbitPosition(state);
  const axes = basis(state);
  const delta: Vec3 = [point[0] - position[0], point[1] - position[1], point[2] - position[2]];
  const depth = dot(delta, axes.forward);
  if (depth <= 0) return null;
  const halfHeight = Math.tan(state.fov * Math.PI / 360) * depth;
  if (!(halfHeight > 0)) return null;
  const ndcX = dot(delta, axes.right) / (halfHeight * (width / height));
  const ndcY = dot(delta, axes.up) / halfHeight;
  return [(ndcX + 1) * width / 2, (1 - ndcY) * height / 2];
}

export function rayFromPixel(state: OrbitState, x: number, y: number, width: number, height: number): Ray {
  const axes = basis(state);
  const safeWidth = width > 0 ? width : 1;
  const safeHeight = height > 0 ? height : 1;
  const tangent = Math.tan(state.fov * Math.PI / 360);
  const horizontal = (2 * x / safeWidth - 1) * tangent * (safeWidth / safeHeight);
  const vertical = (1 - 2 * y / safeHeight) * tangent;
  const raw: Vec3 = [
    axes.forward[0] + axes.right[0] * horizontal + axes.up[0] * vertical,
    axes.forward[1] + axes.right[1] * horizontal + axes.up[1] * vertical,
    axes.forward[2] + axes.right[2] * horizontal + axes.up[2] * vertical,
  ];
  const length = Math.hypot(...raw) || 1;
  return { origin: orbitPosition(state), direction: [raw[0] / length, raw[1] / length, raw[2] / length] };
}