/**
 * Race pieces placed in build mode (the Race shelf): 3D powerups that float and spin and are real
 * pickups, and 3D boost pads, spring pads, TNT crates and sheep that are real obstacles. On the island
 * these are the only pickups and obstacles; the classic courses' generated 2D ones are not raced there.
 *
 * Each placed piece is read from where it stands: its engine x along the road, its z across it and
 * (for a powerup) its height above it.
 */
import type { PlacedProp } from './builder/prop-catalog';
import { engineFromWorld, engineXFromDistance, type TrackSpaceMap } from './track-space';
import { FINISH, START_X, closestLane, courseY, type Obstacle, type ObstacleKind } from './scene';
import type { AirPickup, PowerupKind } from './powerups';
import type { CourseId } from './types';

interface ObstacleSpec { kind: ObstacleKind; width: number; height: number }

/** The powerup each floating pickup model gives. */
export const POWERUP_PIECES: Readonly<Record<string, PowerupKind>> = {
  'kit_powerup-fuel': 'fuel',
  'kit_powerup-shield': 'shield',
  'kit_powerup-bounce': 'bounce',
};

/** The obstacle each hazard model is in a race (sizes as the classic layout's own). */
export const OBSTACLE_PIECES: Readonly<Record<string, ObstacleSpec>> = {
  'kit_boost-pad': { kind: 'boost', width: 130, height: 15 },
  'kit_spring-pad': { kind: 'spring', width: 82, height: 56 },
  'kit_tnt-crate': { kind: 'tnt', width: 65, height: 70 },
  'kit_sheep': { kind: 'sheep', width: 62, height: 59 },
};

export const isPowerupPiece = (type: string) => type in POWERUP_PIECES;
export const isRacePieceType = (type: string) => type in POWERUP_PIECES || type in OBSTACLE_PIECES;

/** A pickup floats this far above the road at least (engine units), so a racer rolls through it. */
const PICKUP_MIN_ALTITUDE = 70;
const PICKUP_MAX_ALTITUDE = 420;
/** The model stands on its base; the pickup's centre is this far above the base. */
const PICKUP_CENTRE_LIFT = 90;

/** The obstacles and pickups the placed race pieces make, in race order (engine x). */
export function racePiecesFrom(
  props: readonly PlacedProp[], space: TrackSpaceMap, course: CourseId,
): { obstacles: Obstacle[]; pickups: AirPickup[] } {
  const obstacles: Obstacle[] = [];
  const pickups: AirPickup[] = [];
  for (const prop of props) {
    if (prop.visible === false) continue;
    const powerup = POWERUP_PIECES[prop.type];
    const hazard = OBSTACLE_PIECES[prop.type];
    if (!powerup && !hazard) continue;
    const where = engineFromWorld(space, { x: prop.x, y: prop.y, z: prop.z });
    const x = Math.min(FINISH - 60, Math.max(START_X + 200, engineXFromDistance(where.distance)));
    const z = where.laneZ;
    if (powerup) {
      const altitude = Math.min(PICKUP_MAX_ALTITUDE, Math.max(PICKUP_MIN_ALTITUDE, where.altitude + PICKUP_CENTRE_LIFT));
      pickups.push({
        id: pickups.length, kind: powerup, x, y: courseY(x, course) - altitude, z, lane: closestLane(z),
        collectedBy: null, collectedAt: -100, propId: prop.id,
      });
    } else {
      const scale = prop.scale || 1;
      obstacles.push({
        kind: hazard.kind, x: x - (hazard.width * scale) / 2, width: hazard.width * scale, height: hazard.height * scale,
        lane: closestLane(z), z, hit: false, hitAt: -100, propId: prop.id,
      });
    }
  }
  obstacles.sort((a, b) => a.x - b.x);
  pickups.sort((a, b) => a.x - b.x).forEach((pickup, index) => { pickup.id = index; });
  return { obstacles, pickups };
}
