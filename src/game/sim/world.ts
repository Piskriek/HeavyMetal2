/**
 * T04 — the headless world half of the simulation seam.
 *
 * The race engine and a qualifying attempt ask exactly the same questions of the course:
 * where is the surface, is this lane a gap, which obstacles/pickups are near this x? Those
 * queries used to live inside `GameEngine` (bucket maps plus `courseY`/`courseSlope`), which
 * made them unreachable without a canvas, a renderer and a WebGL context.
 *
 * This module is the same code with the DOM taken out: pure data in, pure answers out. The
 * engine keeps ownership of rendering and of the mutable obstacle array; it only asks this
 * world for samples. A qualifying attempt builds its own world from a **clone** of the layout,
 * so one participant's exploded TNT or broken bridge never exists for anybody else.
 *
 * Bucket sizing is copied from the engine (`BUCKET = 512`, pickup margin 65, loop obstacles
 * filed from their centre ± width/2, everything else from `x` to `x + width`, both padded by
 * two ball radii) so the candidate sets are identical and physics cannot drift between the
 * race and a qualifying attempt.
 */
import { dpow } from './det-math';
import { RADIUS, courseSlope, courseY, occupiesLane, rampSurface, type Obstacle } from '../scene';
import type { CourseId } from '../types';
import type { AirPickup } from '../powerups';
import { onRoute, routeKey, type RacerRoute } from './route';

/** Spatial bucket width shared by the obstacle and pickup indices. */
export const SPATIAL_BUCKET = 512;
/** Half-reach a pickup is filed with, matching the engine's swept-collection margin. */
export const PICKUP_BUCKET_MARGIN = 65;

const NO_OBSTACLES: readonly Obstacle[] = Object.freeze([]);
const NO_PICKUPS: readonly AirPickup[] = Object.freeze([]);

export interface SurfaceSample {
  /** Course height at `x` (engine space: larger `y` is lower). */
  readonly y: number;
  readonly slope: number;
  /** The ramp the sample landed on, when one is under this lateral position. */
  readonly ramp: Obstacle | null;
}

export interface SimWorld {
  readonly course: CourseId;
  /** The live obstacle array. Elements are mutable (`hit`, `broken`, `hitAt`); the list is not. */
  readonly obstacles: readonly Obstacle[];
  readonly pickups: readonly AirPickup[];
  y(x: number): number;
  slope(x: number): number;
  surfaceAt(x: number, z: number): SurfaceSample;
  inGap(x: number, z: number): boolean;
  obstaclesNear(x: number): readonly Obstacle[];
  pickupsNear(x: number): readonly AirPickup[];
  /** Every candidate in `[fromX, toX]`, bucket by bucket in ascending order. */
  obstaclesInSpan(fromX: number, toX: number): readonly Obstacle[];
  pickupsInSpan(fromX: number, toX: number): readonly AirPickup[];
  /** Points the world at a new course/layout and rebuilds both indices. */
  configure(course: CourseId, obstacles: readonly Obstacle[], pickups?: readonly AirPickup[]): void;
  /** ROUTE-1: true when any obstacle or pickup is tagged to a branch. */
  readonly routed: boolean;
  /**
   * ROUTE-1: the world as a racer on `route` meets it (content on other branches is absent). When
   * nothing is tagged this is the world itself, so an unforked course runs exactly as before.
   */
  forRoute(route: RacerRoute | undefined): SimWorld;
}

/** Altitude above the road surface in world units; `0` is rolling on the dirt. */
export function altitudeAboveSurface(world: SimWorld, x: number, y: number): number {
  return world.y(x) - RADIUS - y;
}

export function createSimWorld(
  course: CourseId,
  obstacles: readonly Obstacle[] = NO_OBSTACLES,
  pickups: readonly AirPickup[] = NO_PICKUPS,
): SimWorld {
  const views = new Map<string, SimWorld>();
  let routed = false;
  const scanRouted = () => { routed = activeObstacles.some((o) => o.route) || activePickups.some((p) => p.route); };
  let activeCourse = course;
  let activeObstacles: readonly Obstacle[] = obstacles;
  let activePickups: readonly AirPickup[] = pickups;
  const obstacleBuckets = new Map<number, Obstacle[]>();
  const pickupBuckets = new Map<number, AirPickup[]>();

  const indexObstacles = () => {
    obstacleBuckets.clear();
    for (const obstacle of activeObstacles) {
      const left = obstacle.kind === 'loop' ? obstacle.x - obstacle.width / 2 : obstacle.x;
      const right = obstacle.kind === 'loop' ? obstacle.x + obstacle.width / 2 : obstacle.x + obstacle.width;
      for (let key = Math.floor((left - RADIUS * 2) / SPATIAL_BUCKET); key <= Math.floor((right + RADIUS * 2) / SPATIAL_BUCKET); key++) {
        const bucket = obstacleBuckets.get(key);
        if (bucket) bucket.push(obstacle); else obstacleBuckets.set(key, [obstacle]);
      }
    }
  };

  const indexPickups = () => {
    pickupBuckets.clear();
    for (const pickup of activePickups) {
      for (let key = Math.floor((pickup.x - PICKUP_BUCKET_MARGIN) / SPATIAL_BUCKET); key <= Math.floor((pickup.x + PICKUP_BUCKET_MARGIN) / SPATIAL_BUCKET); key++) {
        const bucket = pickupBuckets.get(key);
        if (bucket) bucket.push(pickup); else pickupBuckets.set(key, [pickup]);
      }
    }
  };

  indexObstacles();
  indexPickups();
  scanRouted();

  const world: SimWorld = {
    get course() { return activeCourse; },
    get obstacles() { return activeObstacles; },
    get pickups() { return activePickups; },
    y: (x) => courseY(x, activeCourse),
    slope: (x) => courseSlope(x, activeCourse),
    obstaclesNear: (x) => obstacleBuckets.get(Math.floor(x / SPATIAL_BUCKET)) ?? NO_OBSTACLES,
    pickupsNear: (x) => pickupBuckets.get(Math.floor(x / SPATIAL_BUCKET)) ?? NO_PICKUPS,
    obstaclesInSpan: (fromX, toX) => {
      const first = Math.floor(Math.min(fromX, toX) / SPATIAL_BUCKET);
      const last = Math.floor(Math.max(fromX, toX) / SPATIAL_BUCKET);
      if (first === last) return obstacleBuckets.get(first) ?? NO_OBSTACLES;
      const found: Obstacle[] = [];
      for (let key = first; key <= last; key++) {
        const bucket = obstacleBuckets.get(key);
        if (bucket) found.push(...bucket);
      }
      return found;
    },
    pickupsInSpan: (fromX, toX) => {
      const first = Math.floor(Math.min(fromX, toX) / SPATIAL_BUCKET);
      const last = Math.floor(Math.max(fromX, toX) / SPATIAL_BUCKET);
      if (first === last) return pickupBuckets.get(first) ?? NO_PICKUPS;
      const found: AirPickup[] = [];
      for (let key = first; key <= last; key++) {
        const bucket = pickupBuckets.get(key);
        if (bucket) found.push(...bucket);
      }
      return found;
    },
    inGap: (x, z) => (obstacleBuckets.get(Math.floor(x / SPATIAL_BUCKET)) ?? NO_OBSTACLES)
      .some((obstacle) => obstacle.kind === 'gap' && x > obstacle.x && x < obstacle.x + obstacle.width && occupiesLane(obstacle, z, 0)),
    surfaceAt: (x, z) => {
      let y = courseY(x, activeCourse);
      let slope = courseSlope(x, activeCourse);
      let ramp: Obstacle | null = null;
      for (const obstacle of obstacleBuckets.get(Math.floor(x / SPATIAL_BUCKET)) ?? NO_OBSTACLES) {
        if (obstacle.kind === 'ramp' && x >= obstacle.x && x <= obstacle.x + obstacle.width && occupiesLane(obstacle, z, 5)) {
          y = rampSurface(obstacle, x, activeCourse);
          slope -= 1.6 * obstacle.height / obstacle.width * dpow((x - obstacle.x) / obstacle.width, 0.6);
          ramp = obstacle;
        }
      }
      return { y, slope, ramp };
    },
    configure: (nextCourse, nextObstacles, nextPickups) => {
      activeCourse = nextCourse;
      activeObstacles = nextObstacles;
      if (nextPickups) activePickups = nextPickups;
      indexObstacles();
      indexPickups();
      scanRouted();
      views.clear();
    },
    get routed() { return routed; },
    forRoute: (route) => {
      if (!routed) return world;
      const key = routeKey(route);
      let view = views.get(key);
      if (!view) {
        // A view shares the live obstacle and pickup records (hits, breaks and collections stay
        // one truth) but indexes only what is on this route. Built once per route, cached.
        view = createSimWorld(
          activeCourse,
          activeObstacles.filter((o) => onRoute(o.route, route)),
          activePickups.filter((p) => onRoute(p.route, route)),
        );
        // A view is already on its route: asking it again returns itself.
        const self = view;
        (view as { forRoute: SimWorld['forRoute'] }).forRoute = () => self;
        views.set(key, view);
      }
      return view;
    },
  };
  return world;
}

/**
 * A deep-enough clone of a course layout for one isolated attempt: every obstacle and pickup
 * gets its own mutable record, so `hit`, `broken`, `hitAt`, `hitBy` and `collectedBy` belong to
 * that attempt alone. The clone keeps a stable index so an attempt can be replayed and compared.
 */
export function cloneLayout(
  obstacles: readonly Obstacle[],
  pickups: readonly AirPickup[],
): { obstacles: Obstacle[]; pickups: AirPickup[] } {
  return {
    obstacles: obstacles.map((obstacle) => ({
      ...obstacle,
      // Every mutable bit of an obstacle belongs to the attempt that owns the clone: an
      // exploded barrel, a worn-off sheep or a broken bridge in one attempt is brand new in
      // the next one, and a hidden participant cannot pre-break anything for a visible one.
      hit: false,
      hitAt: -100,
      hitMask: 0,
      hitBy: undefined,
      broken: false,
    })),
    pickups: pickups.map((pickup) => ({ ...pickup, collectedBy: null, collectedAt: -100 })),
  };
}
