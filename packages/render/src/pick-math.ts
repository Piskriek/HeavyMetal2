import type { EntityId, Pick, Vec3 } from '@hm/contracts';
import type { Ray } from './camera-math';

const EPSILON = 1e-12;

export interface PickItem {
  readonly entity: EntityId;
  readonly shape: 'sphere' | 'box' | 'cylinder' | 'plane';
  readonly center: Vec3;
  readonly size: number;
}

export function rayHitSphere(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const ox = origin[0] - center[0];
  const oy = origin[1] - center[1];
  const oz = origin[2] - center[2];
  const a = dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2;
  if (a <= EPSILON) return null;
  const b = 2 * (ox * dir[0] + oy * dir[1] + oz * dir[2]);
  const c = ox * ox + oy * oy + oz * oz - Math.abs(radius) ** 2;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = (-b - root) / (2 * a);
  const far = (-b + root) / (2 * a);
  return near >= 0 ? near : far >= 0 ? far : null;
}

export function rayHitBox(origin: Vec3, dir: Vec3, center: Vec3, half: Vec3): number | null {
  const h: Vec3 = [Math.abs(half[0]), Math.abs(half[1]), Math.abs(half[2])];
  const inside = [0, 1, 2].every((axis) => Math.abs(origin[axis]! - center[axis]!) <= h[axis]!);
  if (inside) return 0;
  let near = -Infinity;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const delta = origin[axis]! - center[axis]!;
    const direction = dir[axis]!;
    if (Math.abs(direction) <= EPSILON) {
      if (Math.abs(delta) > h[axis]!) return null;
      continue;
    }
    let a = (-h[axis]! - delta) / direction;
    let b = (h[axis]! - delta) / direction;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return null;
  }
  if (far < 0 || !Number.isFinite(near)) return null;
  return Math.max(0, near);
}

export function rayHitPlaneY(origin: Vec3, dir: Vec3, y: number): number | null {
  if (Math.abs(dir[1]) <= EPSILON) return null;
  const distance = (y - origin[1]) / dir[1];
  return distance >= 0 ? distance : null;
}

const pointAt = (ray: Ray, distance: number): Vec3 => [
  ray.origin[0] + ray.direction[0] * distance,
  ray.origin[1] + ray.direction[1] * distance,
  ray.origin[2] + ray.direction[2] * distance,
];

const sphereNormal = (point: Vec3, center: Vec3): Vec3 => {
  const raw: Vec3 = [point[0] - center[0], point[1] - center[1], point[2] - center[2]];
  const length = Math.hypot(...raw);
  return length > EPSILON ? [raw[0] / length, raw[1] / length, raw[2] / length] : [0, 1, 0];
};

const boxNormal = (point: Vec3, center: Vec3, half: Vec3): Vec3 => {
  let bestAxis = 0;
  let bestError = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const error = Math.abs(Math.abs(point[axis]! - center[axis]!) - Math.abs(half[axis]!));
    if (error < bestError) {
      bestAxis = axis;
      bestError = error;
    }
  }
  const result: [number, number, number] = [0, 0, 0];
  result[bestAxis] = point[bestAxis]! >= center[bestAxis]! ? 1 : -1;
  return result;
};

export function pickScene(ray: Ray, items: readonly PickItem[], groundY: number | null): Pick {
  let best: Pick = { entity: null, point: null, normal: null, distance: Infinity };
  for (const item of items) {
    const size = Math.abs(item.size);
    const isRound = item.shape === 'sphere' || item.shape === 'cylinder';
    const half: Vec3 = item.shape === 'plane' ? [size, 0.01, size] : [size, size, size];
    const distance = isRound
      ? rayHitSphere(ray.origin, ray.direction, item.center, size)
      : rayHitBox(ray.origin, ray.direction, item.center, half);
    if (distance === null || distance >= best.distance) continue;
    const point = pointAt(ray, distance);
    best = {
      entity: item.entity,
      point,
      normal: isRound ? sphereNormal(point, item.center) : boxNormal(point, item.center, half),
      distance,
    };
  }
  if (groundY !== null) {
    const distance = rayHitPlaneY(ray.origin, ray.direction, groundY);
    if (distance !== null && distance < best.distance) {
      best = { entity: null, point: pointAt(ray, distance), normal: [0, 1, 0], distance };
    }
  }
  return best;
}