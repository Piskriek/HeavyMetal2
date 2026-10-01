import type { Quat, Vec3 } from '@hm/contracts';

export type V3 = [number, number, number];
export type Q4 = [number, number, number, number];
export const ZERO: Vec3 = [0, 0, 0];
export const IDENTITY: Quat = [0, 0, 0, 1];
export const add = (a: Vec3, b: Vec3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const unit = (a: Vec3): V3 => { const n = length(a); return n > 0 ? mul(a, 1 / n) : [0, 1, 0]; };
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function normalizeQuat(q: Quat): Q4 {
  const l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  return l > 0 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : [0, 0, 0, 1];
}

export function rotate(v: Vec3, q: Quat): V3 {
  const u: V3 = [q[0], q[1], q[2]];
  const t = mul(cross(u, v), 2);
  return add(v, add(mul(t, q[3]), cross(u, t)));
}

export const inverseRotate = (v: Vec3, q: Quat): V3 => rotate(v, [-q[0], -q[1], -q[2], q[3]]);

export function integrateQuat(q: Quat, w: Vec3, dt: number): Q4 {
  const h = 0.5 * dt;
  return normalizeQuat([
    q[0] + h * (w[0] * q[3] + w[1] * q[2] - w[2] * q[1]),
    q[1] + h * (-w[0] * q[2] + w[1] * q[3] + w[2] * q[0]),
    q[2] + h * (w[0] * q[1] - w[1] * q[0] + w[2] * q[3]),
    q[3] - h * (w[0] * q[0] + w[1] * q[1] + w[2] * q[2]),
  ]);
}