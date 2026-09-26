import { artUrl, drawToCanvas, loadArtImage, placeholderCanvas, supplyCell } from './art-assets';
import type { CourseId } from './types';
import { FINISH, GRAVITY, BALL_DRAW_RADIUS, RADIUS, STADIUM_START, closestLane, courseY, laneZ, type Obstacle } from './scene';
import { nearestPath, sampleLane, type LaneNetwork } from './lane-network';

export type PowerupKind = 'fuel' | 'shield' | 'bounce';
export interface AirPickup {
  id: number;
  kind: PowerupKind;
  x: number;
  y: number;
  z: number;
  lane: number;
  collectedBy: number | null;
  collectedAt: number;
  /** ROUTE-1: the branch this pickup floats over; absent = on every branch. */
  route?: import('./sim/route').RouteTag;
}
export const POWERUPS = {
  fuel: { name: 'Rocket Fuel', label: '+1 boost', color: '#ffc46f', description: 'Refills one boost charge and gives a small forward surge. Boost stock is capped at two.' },
  shield: { name: 'Skyward Shield', label: '1 hit / 6 sec', color: '#8cceff', description: 'Automatically protects against one rival bump for up to six seconds. Does not protect against gaps.' },
  bounce: { name: 'Air Spring', label: '+1 air bounce', color: '#a7e2ba', description: 'Refills one midair bounce charge. Press Space to use it. Bounce stock is capped at three.' },
} as const;
export const SHIELD_DURATION = 6;
export const PICKUP_RADIUS = 23;

export function createAirPickups(course: CourseId, obstacles: Obstacle[]): AirPickup[] {
  const pickups: AirPickup[] = [];
  const add = (kind: PowerupKind, x: number, lane: number, altitude: number) => {
    if (x > FINISH - 350) return;
    if (obstacles.some((obstacle) => obstacle.kind === 'loop' && obstacle.lane === lane && Math.abs(obstacle.x - x) < obstacle.height * 0.48 + 45)) return;
    pickups.push({ id: pickups.length, kind, x, y: courseY(x, course) - altitude, z: laneZ(lane), lane, collectedBy: null, collectedAt: -100 });
  };
  for (let lane = 0; lane < 4; lane++) add((['fuel', 'shield', 'bounce', 'fuel'] as const)[lane], 1060, lane, 153);
  let rampIndex = 0;
  let springIndex = 0;
  for (const obstacle of obstacles) {
    if (obstacle.x < 1800 || obstacle.x > STADIUM_START - 600 || obstacle.lane === undefined || obstacle.lane < 0) continue;
    if (obstacle.kind === 'ramp') {
      add((['shield', 'fuel', 'bounce'] as const)[rampIndex++ % 3], obstacle.x + obstacle.width + 125, obstacle.lane, Math.max(146, obstacle.height + 82));
    } else if (obstacle.kind === 'spring' && springIndex++ % 2 === 0) {
      add(course === 'sheep' ? 'bounce' : 'fuel', obstacle.x + 250, obstacle.lane, 212);
    }
  }
  for (let x = 2120, i = 0; x < STADIUM_START - 500; x += course === 'sheep' ? 1680 : 2150, i++) {
    const lane = (i + (course === 'boomtown' ? 1 : 2)) % 4;
    const blocked = obstacles.some((o) => (o.lane === lane || o.kind === 'gap' && lane >= (o.lane ?? 0) && lane < (o.lane ?? 0) + (o.laneSpan ?? 1))
      && x > o.x - 170 && x < o.x + o.width + 170);
    if (!blocked) add((['shield', 'bounce', 'fuel'] as const)[i % 3], x, lane, 106);
  }
  for (let lane = 0; lane < 4; lane++) add(lane % 2 ? 'shield' : 'fuel', STADIUM_START + 580, lane, 106);
  return pickups.sort((a, b) => a.x - b.x);
}

export function pickupY(pickup: AirPickup, time: number, reducedMotion: boolean) {
  return pickup.y + (reducedMotion ? 0 : Math.sin(time * 1.9 + pickup.id * 0.7) * 4);
}

export function pickupIntercept(
  from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number },
  pickup: AirPickup, y: number,
) {
  const dx = to.x - from.x; const dy = to.y - from.y; const dz = to.z - from.z;
  // Measured from the ball as drawn: its centre sits one physics radius higher (engine y grows
  // downward) and its radius is BALL_DRAW_RADIUS, so a supply that visibly touches the ball is taken.
  const rx = from.x - pickup.x; const ry = (from.y - RADIUS) - y; const rz = from.z - pickup.z;
  const radius = BALL_DRAW_RADIUS + PICKUP_RADIUS;
  const c = rx * rx + ry * ry + rz * rz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 0.0001) return null;
  const b = 2 * (rx * dx + ry * dy + rz * dz);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : null;
}

export function hopTiming(vx: number, impulse: number) {
  return Math.max(0.1, Math.min(0.39, impulse / GRAVITY * 0.75)) * Math.max(200, vx);
}

/**
 * Painted pickup icon: a real alpha PNG from the generated art library, sized 256x256 by
 * the manifest. The world and the HUD use the same source, so a supply always looks the
 * same everywhere.
 */
export function powerupIcon(kind: PowerupKind) {
  return artUrl(supplyCell(kind).image);
}

let spritePromise: Promise<Record<PowerupKind, HTMLCanvasElement>> | null = null;
/** Decodes and draws each pickup icon once per session; never called from a frame. */
export function preparePowerupSprites() {
  spritePromise ??= Promise.all((Object.keys(POWERUPS) as PowerupKind[]).map(async (kind) => {
    const cell = supplyCell(kind);
    try {
      const image = await loadArtImage(cell.image);
      return [kind, drawToCanvas(image, 128)] as [PowerupKind, HTMLCanvasElement];
    } catch {
      return [kind, placeholderCanvas(cell.runtime.width, cell.runtime.height, 128)] as [PowerupKind, HTMLCanvasElement];
    }
  })).then((entries) => Object.fromEntries(entries) as Record<PowerupKind, HTMLCanvasElement>);
  return spritePromise;
}

/**
 * M01 · T6/T7 — **pickups follow the authored lanes.**
 *
 * `createAirPickups` above lays the field out on the legacy four lanes: `laneZ(0..3)` and altars at
 * `y 106`. Under an authored network those lanes may not exist, so a pickup can hang in the air beside
 * the drivable road (or inside a wall) — collectable in principle and unreachable in practice. This
 * moves each one onto the *nearest point of the network* at its own x, keeping its altitude kind
 * (a ground-level `y 106` stay low, a ramp launch stays high) and its order down the hill.
 *
 * The laws:
 *  - **only `z` (and the lane label) move** — `y` is the pickup's own altitude design and the
 *    network says nothing about heights;
 *  - **a pickup with no path under it is dropped**, not left hanging off the road: a collectible
 *    nobody can reach is worse than one that is not there;
 *  - **`id` is re-numbered** so ids stay dense and stable for the sprite pool and for saves;
 *  - **no network means the list comes back untouched** (a copy, same values) — the legacy layout is
 *    what every course has always had, and this must not change it by a hair.
 *
 * Pure: takes the list, returns a new one. Tested headlessly in `tests/pickup-layout.test.ts`.
 */
export function layoutPickupsForNetwork(
  pickups: readonly AirPickup[],
  network: LaneNetwork | null,
): AirPickup[] {
  if (!network) return pickups.map((pickup) => ({ ...pickup }));
  const out: AirPickup[] = [];
  for (const pickup of pickups) {
    const pathId = nearestPath(network, pickup.x, pickup.z);
    if (pathId === null) continue;
    const sample = sampleLane(network, pathId, pickup.x);
    if (!sample) continue;
    // "Nearest path" is not the same as "on the road": a pickup can be kilometres away from the only
    // path active at its x. It is kept only when it is over the drivable width, which is the path's
    // own half width — otherwise the network has no road there and nobody could reach it.
    if (Math.abs(pickup.z - sample.z) > sample.halfWidth) continue;
    out.push({ ...pickup, id: out.length, z: sample.z, lane: closestLane(sample.z) });
  }
  return out;
}
