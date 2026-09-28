/**
 * The course's loops (`loop`, `lava_loop`) are scenery the ball rolls past, not rings it rides. The
 * race removes them from the physics layout; the 3D track still draws them.
 */
import type { Obstacle } from '../scene';

export const isLoopRide = (obstacle: Pick<Obstacle, 'kind'>): boolean =>
  obstacle.kind === 'loop' || obstacle.kind === 'lava_loop';

export function withoutLoopRides<T extends Pick<Obstacle, 'kind'>>(obstacles: readonly T[]): T[] {
  return obstacles.filter((obstacle) => !isLoopRide(obstacle));
}
