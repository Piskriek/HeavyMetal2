import { quatFromYaw, quatMul, rotateVec } from './quat.js';
import type { Part, Quat, Vec3 } from './types.js';

export interface Pose {
  position: Vec3;
  /** Radians; 0 = facing +x, positive turns +x towards +z. */
  yaw: number;
}

/**
 * Place a single part in world space.
 * Local position is rotated about +y by `yaw`, then translated by `pose.position`.
 * Rotation = `quatMul(quatFromYaw(yaw), part.rotation)`.
 */
export function placePart(
  p: Part,
  pose: Pose,
): { position: Vec3; rotation: Quat } {
  const yQ = quatFromYaw(pose.yaw);
  const rotated = rotateVec(yQ, p.position);
  const position: Vec3 = [
    rotated[0] + pose.position[0],
    rotated[1] + pose.position[1],
    rotated[2] + pose.position[2],
  ];
  const rotation = quatMul(yQ, p.rotation);
  return { position, rotation };
}

export function placeAll(
  parts: readonly Part[],
  pose: Pose,
): { id: string; position: Vec3; rotation: Quat }[] {
  const out: { id: string; position: Vec3; rotation: Quat }[] = [];
  for (const p of parts) {
    const r = placePart(p, pose);
    out.push({ id: p.id, position: r.position, rotation: r.rotation });
  }
  return out;
}

/**
 * Yaw (about +y) such that +x rotated by this yaw equals the heading vector (hx, hz).
 */
export function yawFromHeading(hx: number, hz: number): number {
  return Math.atan2(hz, hx);
}