import type { Quat, Vec3 } from '@hm/contracts';
import { add, clamp, dot, inverseRotate, length, mul, rotate, sub, type V3 } from './math';
import type { RayHit, SurfaceHit } from './triangles';

export interface BoxShape { position: V3; rotation: Quat; half: V3 }
const localPoint = (box: BoxShape, p: Vec3): V3 => inverseRotate(sub(p, box.position), box.rotation);

export function insideBox(box: BoxShape, p: Vec3): boolean {
  const local = localPoint(box, p);
  return Math.abs(local[0]) <= box.half[0] && Math.abs(local[1]) <= box.half[1] && Math.abs(local[2]) <= box.half[2];
}

export function boxContact(box: BoxShape, p: Vec3, radius: number): SurfaceHit | null {
  const local = localPoint(box, p);
  const closest: V3 = [
    clamp(local[0], -box.half[0], box.half[0]),
    clamp(local[1], -box.half[1], box.half[1]),
    clamp(local[2], -box.half[2], box.half[2]),
  ];
  const delta = sub(local, closest), distance = length(delta);
  if (distance > 1e-12) {
    if (distance >= radius - 1e-10) return null;
    return {
      point: add(box.position, rotate(closest, box.rotation)),
      normal: rotate(mul(delta, 1 / distance), box.rotation),
      penetration: radius - distance,
    };
  }
  // Inside: pick the nearest face, not an arbitrary zero-length normal.
  let axis = 0, depth = box.half[0] - Math.abs(local[0]);
  for (let i = 1; i < 3; i++) {
    const candidate = box.half[i]! - Math.abs(local[i]!);
    if (candidate < depth) { depth = candidate; axis = i; }
  }
  const sign = local[axis]! < 0 ? -1 : 1, face: V3 = [...closest];
  face[axis] = sign * box.half[axis]!;
  const normal: V3 = [0, 0, 0]; normal[axis] = sign;
  return {
    point: add(box.position, rotate(face, box.rotation)),
    normal: rotate(normal, box.rotation), penetration: radius + depth,
  };
}

export function rayBox(box: BoxShape, origin: Vec3, dir: Vec3, maxDistance: number): RayHit | null {
  const local = localPoint(box, origin), d = inverseRotate(dir, box.rotation);
  let enter = -Infinity, exit = Infinity, enterNormal: V3 = [0, 0, 0], exitNormal: V3 = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const o = local[axis]!, v = d[axis]!, h = box.half[axis]!;
    if (Math.abs(v) < 1e-14) { if (o < -h || o > h) return null; continue; }
    let t0 = (-h - o) / v, t1 = (h - o) / v;
    let sign = -1;
    if (t0 > t1) { const temp = t0; t0 = t1; t1 = temp; sign = 1; }
    if (t0 > enter) { enter = t0; enterNormal = [0, 0, 0]; enterNormal[axis] = sign; }
    if (t1 < exit) { exit = t1; exitNormal = [0, 0, 0]; exitNormal[axis] = -sign; }
    if (enter > exit) return null;
  }
  const distance = enter >= 0 ? enter : exit;
  if (distance < 0 || distance > maxDistance) return null;
  let normal = rotate(enter >= 0 ? enterNormal : exitNormal, box.rotation);
  if (dot(normal, dir) > 0) normal = mul(normal, -1);
  return { distance, point: add(origin, mul(dir, distance)), normal };
}