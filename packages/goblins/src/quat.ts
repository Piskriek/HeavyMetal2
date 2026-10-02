import type { Quat, Vec3 } from './types.js';

export const IDENTITY: Quat = [0, 0, 0, 1];

function hypot3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function quatFromAxisAngle(axis: Vec3, radians: number): Quat {
  const [ax, ay, az] = axis;
  const len = hypot3(ax, ay, az);
  // Normalise axis inside. If the axis is the zero vector, fall back to identity.
  if (len === 0) return IDENTITY;
  const nx = ax / len;
  const ny = ay / len;
  const nz = az / len;
  const half = radians * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return [nx * s, ny * s, nz * s, c];
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  // t = 2 * (q.xyz x v)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  // v + qw * t + (q.xyz x t)
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Yaw about the +y axis such that a positive angle turns +x towards +z.
 * (Standard right-handed: thumb +y, fingers curl from +z to +x; we flip so
 * that positive rotation moves +x towards +z, matching the project's heading
 * convention.)
 */
export function quatFromYaw(radians: number): Quat {
  const half = radians * 0.5;
  return [0, -Math.sin(half), 0, Math.cos(half)];
}
