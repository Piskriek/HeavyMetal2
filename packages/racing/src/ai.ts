import { pointAt, project, trackLength, type Track } from './track';

export interface AiSkill {
  lookahead: number;
  cornerCare: number;
  noise: number;
}

export interface AiState {
  x: number;
  z: number;
  hx: number;
  hz: number;
  speed: number;
}

export interface AiControl {
  steer: number;
  throttle: number;
}

type Direction = readonly [number, number];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function directionAt(track: Track, s: number): Direction {
  const count = track.points.length;
  const length = trackLength(track);
  if (count === 0 || !(length > 0)) return [0, 0];

  let remaining = ((s % length) + length) % length;
  for (let i = 0; i < count; i += 1) {
    const a = track.points[i]!;
    const b = track.points[(i + 1) % count]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const segmentLength = Math.sqrt(dx * dx + dz * dz);
    if (segmentLength === 0) continue;
    if (remaining < segmentLength) return [dx / segmentLength, dz / segmentLength];
    remaining -= segmentLength;
  }

  for (let i = 0; i < count; i += 1) {
    const a = track.points[i]!;
    const b = track.points[(i + 1) % count]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const segmentLength = Math.sqrt(dx * dx + dz * dz);
    if (segmentLength > 0) return [dx / segmentLength, dz / segmentLength];
  }
  return [0, 0];
}

export function aiControl(track: Track, s: AiState, skill: AiSkill, rng: () => number): AiControl {
  const projection = project(track, [s.x, s.z]);
  const target = pointAt(track, projection.s + skill.lookahead);
  const toTargetX = target[0] - s.x;
  const toTargetZ = target[1] - s.z;
  const targetDistance = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);
  const cross = s.hx * toTargetZ - s.hz * toTargetX;
  const baseSteer = targetDistance > 0 ? clamp((cross / targetDistance) * 2.5, -1, 1) : 0;
  const noisySteer = clamp(baseSteer + (rng() - 0.5) * 0.2 * skill.noise, -1, 1);

  const currentDirection = directionAt(track, projection.s);
  const futureDirection = directionAt(track, projection.s + 2 * skill.lookahead);
  const directionCross = currentDirection[0] * futureDirection[1] - currentDirection[1] * futureDirection[0];
  const directionDot = currentDirection[0] * futureDirection[0] + currentDirection[1] * futureDirection[1];
  const angle = Math.atan2(Math.abs(directionCross), directionDot);
  const turnAngleFraction = Math.min(1, angle / (Math.PI / 2));
  const speedFraction = Math.min(1, s.speed / 25);
  const throttle = clamp(1 - skill.cornerCare * turnAngleFraction * speedFraction, 0.25, 1);

  return { steer: noisySteer, throttle };
}

export function rubberBand(position: number, racers: number): number {
  if (racers <= 1) return 1;
  const placeFraction = clamp((position - 1) / (racers - 1), 0, 1);
  return 0.92 + 0.16 * placeFraction;
}