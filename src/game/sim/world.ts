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
import { surfaceWithPatches } from '../collision/patch-index';
import type { Patch } from '../collision/terrain-patch';

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
  /** True when the surface is a placed rideable model's deck, not the road. */
  readonly deck?: boolean;
}

/**
 * How far above the ball's underside a deck may be and still be ground: a ball rolls up a ramp's
 * slope a few units a tick, but a sheer face or a bridge overhead is not something it steps onto.
 */
export const DECK_STEP_UP = 30;

/** A placed model's solid part must stand this far above the ball's underside to stop it (1.5 ball radii). */
export const SOLID_MIN_HEIGHT = RADIUS * 1.5;

export interface SimWorld {
  readonly course: CourseId;
  /** The live obstacle array. Elements are mutable (`hit`, `broken`, `hitAt`); the list is not. */
  readonly obstacles: readonly Obstacle[];
  readonly pickups: readonly AirPickup[];
  y(x: number): number;
  slope(x: number): number;
  /**
   * The ground under (x, z). `footY` is the ball's underside (engine y): a placed deck counts only
   * when it is no more than DECK_STEP_UP above it. Without `footY` the highest surface is taken.
   */
  surfaceAt(x: number, z: number, footY?: number): SurfaceSample;
  inGap(x: number, z: number): boolean;
  obstaclesNear(x: number): readonly Obstacle[];
  pickupsNear(x: number): readonly AirPickup[];
  /** Every candidate in `[fromX, toX]`, bucket by bucket in ascending order. */
  obstaclesInSpan(fromX: number, toX: number): readonly Obstacle[];
  pickupsInSpan(fromX: number, toX: number): readonly AirPickup[];
  /**
   * Points the world at a new course/layout and rebuilds both indices. `patches` are the rideable
   * models placed on the course (their drive surfaces as heightfields); absent keeps the current ones.
   */
  configure(course: CourseId, obstacles: readonly Obstacle[], pickups?: readonly AirPickup[], patches?: readonly Patch[]): void;
  /** The rideable models' surfaces (empty on a course with none: the road alone, exactly as before). */
  readonly patches: readonly Patch[];
  /**
   * The bounce off a placed model's solid part at (x, z) for a ball centred at engine y, or 0 when the
   * spot is free: nothing there, a surface low enough to roll onto, or high enough to roll under.
   * `climb`: extra rise allowed (a probe ahead of the ball on a slope it can roll up). A ball that was on a
   * model's drive surface at (fromX, fromZ) is riding it: that model does not block it (the ride does).
   */
  solidAt(x: number, z: number, y: number, climb?: number, fromX?: number, fromZ?: number): number;
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
  patches: readonly Patch[] = [],
): SimWorld {
  const views = new Map<string, SimWorld>();
  let activePatches = patches;
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
    surfaceAt: (x, z, footY) => {
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
      // A placed rideable model (a deck, a bridge, a stunt ramp) is ridden where it stands above the road.
      if (activePatches.length) {
        const deck = surfaceWithPatches(activePatches, x, z, 0);
        if (deck.fromPatch && deck.y > 0) {
          const deckY = courseY(x, activeCourse) - deck.y;
          const reachable = footY === undefined || deckY >= footY - DECK_STEP_UP;
          if (deckY < y && reachable) return { y: deckY, slope: courseSlope(x, activeCourse) - deck.slopeX, ramp: null, deck: true };
        }
      }
      return { y, slope, ramp };
    },
    configure: (nextCourse, nextObstacles, nextPickups, nextPatches) => {
      activeCourse = nextCourse;
      if (nextPatches) activePatches = nextPatches;
      activeObstacles = nextObstacles;
      if (nextPickups) activePickups = nextPickups;
      indexObstacles();
      indexPickups();
      scanRouted();
      views.clear();
    },
    get routed() { return routed; },
    get patches() { return activePatches; },
    solidAt: (x, z, y, climb = 0, fromX, fromZ) => {
      if (!activePatches.length) return 0;
      const road = courseY(x, activeCourse);
      const foot = y + RADIUS, head = y - RADIUS;
      for (const patch of activePatches) {
        const s = patch.solid;
        if (!s) continue;
        if (fromX !== undefined && fromZ !== undefined) {
          const di = Math.floor((fromX - patch.x0) / patch.cellX), dj = Math.floor((fromZ - patch.z0) / patch.cellZ);
          if (di >= 0 && dj >= 0 && di < patch.nx && dj < patch.nz && !Number.isNaN(patch.heights[di * patch.nz + dj])) continue;
        }
        const i = Math.floor((x - s.x0) / s.cellX), j = Math.floor((z - s.z0) / s.cellZ);
        if (i < 0 || j < 0 || i >= s.nx || j >= s.nz) continue;
        const k = i * s.nz + j;
        const top = s.top[k];
        if (Number.isNaN(top)) continue;
        // Engine y grows downward: the solid spans [road - top, road - bottom].
        const topY = road - top, bottomY = road - s.bottom[k];
        // Only what stands clearly taller than the ball can step blocks it (a thin lip or curb is rolled past).
        const steppable = topY >= foot - SOLID_MIN_HEIGHT - climb;
        const overhead = bottomY <= head;
        if (!steppable && !overhead) return s.restitution;
      }
      return 0;
    },
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
          activePatches,
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
