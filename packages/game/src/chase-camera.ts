export type V3 = readonly [number, number, number];
export interface ChaseTarget { x: number; y: number; z: number; hx: number; hz: number; speed: number }
export interface ChaseOptions { back: number; height: number; look: number; stiffness: number /* 1/s */; fovSpeed: number }
export const DEFAULT_CHASE: ChaseOptions = { back: 9, height: 4.2, look: 7, stiffness: 5, fovSpeed: 0.35 };

/**
 * A smoothed chase camera behind the car: the position eases towards "back and above along the heading" with an
 * exponential filter (frame-rate independent), the look-at point sits ahead of the car. Pure and deterministic.
 */
export function chaseCamera(prev: { position: V3; target: V3 } | null, t: ChaseTarget, dtMs: number, o: ChaseOptions = DEFAULT_CHASE): { position: V3; target: V3; fov: number } {
  const hl = Math.hypot(t.hx, t.hz) || 1;
  const hx = t.hx / hl, hz = t.hz / hl;
  const speedBack = Math.min(1, t.speed / 40) * 3;
  const want: V3 = [t.x - hx * (o.back + speedBack), t.y + o.height, t.z - hz * (o.back + speedBack)];
  const look: V3 = [t.x + hx * o.look, t.y + 1, t.z + hz * o.look];
  const k = 1 - Math.exp(-Math.max(0, dtMs) / 1000 * o.stiffness);
  const pos: V3 = prev ? [prev.position[0] + (want[0] - prev.position[0]) * k, prev.position[1] + (want[1] - prev.position[1]) * k, prev.position[2] + (want[2] - prev.position[2]) * k] : want;
  const tgt: V3 = prev ? [prev.target[0] + (look[0] - prev.target[0]) * k * 1.6, prev.target[1] + (look[1] - prev.target[1]) * k * 1.6, prev.target[2] + (look[2] - prev.target[2]) * k * 1.6] : look;
  return { position: pos, target: tgt, fov: 55 + Math.min(1, t.speed / 40) * 55 * o.fovSpeed * 0.5 };
}
