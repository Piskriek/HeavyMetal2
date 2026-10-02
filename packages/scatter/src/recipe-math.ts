import type { Vec3 } from './types';

/** Quaternion as [x, y, z, w]. */
export type Quat = readonly [number, number, number, number];

export const TAU = Math.PI * 2;
export const IDENTITY: Quat = [0, 0, 0, 1];

export function normalizeQuat(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  return len > 0 ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : IDENTITY;
}

/** Rotation of `angle` radians about the (not necessarily unit) axis (x, y, z). */
export function axisAngle(x: number, y: number, z: number, angle: number): Quat {
  const len = Math.hypot(x, y, z);
  if (len === 0) return IDENTITY;
  const s = Math.sin(angle / 2) / len;
  return normalizeQuat([x * s, y * s, z * s, Math.cos(angle / 2)]);
}

export const yawQuat = (angle: number): Quat => axisAngle(0, 1, 0, angle);

/** Hamilton product a * b (b is applied first, then a). */
export function mulQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return normalizeQuat([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

/** Direction the local +Y axis points after leaning `angle` radians towards `azimuth` (in the xz plane). */
export function leanDir(azimuth: number, angle: number): Vec3 {
  const s = Math.sin(angle);
  return [s * Math.cos(azimuth), Math.cos(angle), s * Math.sin(azimuth)];
}

/** Rotation that takes +Y to leanDir(azimuth, angle). */
export const tiltQuat = (azimuth: number, angle: number): Quat => axisAngle(Math.sin(azimuth), 0, -Math.cos(azimuth), angle);

/** Vary a '#rrggbb' colour by up to +-`amount` (brightness) with a little per-channel drift; lowercase output. */
export function varyColor(hex: string, rng: () => number, amount: number): string {
  const brightness = 1 + (rng() * 2 - 1) * amount;
  const channel = (i: number): string => {
    const base = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const v = Math.round(base * brightness * (1 + (rng() * 2 - 1) * amount * 0.35));
    return Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
