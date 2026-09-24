/**
 * T04 — the canonical qualifying entry gate.
 *
 * The gate is **named and anchored**, not configured by hand: it is the entry to the first loop on
 * the course (`QUALIFYING_GATE_ID`, frozen in the T01 contract), derived from that loop's own
 * geometry so an authored or rebuilt course moves the gate with it.
 *
 * `gate.x` is the loop's *outer reach* — `loop.x - (ringRadius + ballRadius)` — which is exactly the
 * furthest back the loop can engage a racer (`stepRacer` requires `|dx| <= radius + RADIUS`). So no
 * racer can be riding the loop before crossing the gate plane, and the speed and vector captured at
 * the crossing are always the **pre-loop** ones: before the ride floors the speed at 650, and before
 * its exit hands back `speed * 1.08`.
 *
 * Validation belongs to `validateGateCrossing` in `contracts/qualifying.ts` — the swept forward
 * crossing, lane containment, altitude band, segment identity. This module only translates
 * engine-space samples into that contract's inputs, which is also the seam T03's track-space adapter
 * feeds when multi-deck courses need a real segment map.
 */
import {
  LANE_WIDTH, RADIUS, SECTION_2_START, SECTION_3_START, SECTION_3_END, SECTION_LIP_START, START_X,
  loopGeometry, obstacleZ, type Obstacle,
} from '../scene';
import type { CourseId } from '../types';
import {
  QUALIFYING_GATE_ALTITUDE_TOLERANCE, QUALIFYING_GATE_ID, validateGateCrossing,
  type CrossingInput, type CrossingOutcome, type QualifyingGate,
} from '../contracts/qualifying';
import type { SimWorld } from '../sim/world';
import { QualifyingError } from './errors';

/** Canonical ground segments, named after the course geography they correspond to. */
export const CANONICAL_SEGMENTS = ['approach', 'canyon-lip', 'waterfall-zigzag', 'mine', 'stadium'] as const;
export type CanonicalSegment = (typeof CANONICAL_SEGMENTS)[number];

/** The prefix a racer occupies while they are actually riding a loop. */
export const LOOP_SEGMENT_PREFIX = 'loop';

/**
 * The ground segment a down-range position belongs to. The boundaries are the same constants the
 * renderer and the physics use for their gravity bands, so "wrong segment" means one thing to all
 * three.
 */
export function segmentAtX(x: number): CanonicalSegment {
  if (x < SECTION_LIP_START) return 'approach';
  if (x < SECTION_2_START) return 'canyon-lip';
  if (x < SECTION_3_START) return 'waterfall-zigzag';
  if (x < SECTION_3_END) return 'mine';
  return 'stadium';
}

/** Riding a loop is a different place from standing on the ground underneath it. */
export function loopSegmentOf(obstacle: Obstacle): string {
  return `${LOOP_SEGMENT_PREFIX}:${obstacle.x}`;
}

export interface SegmentView {
  readonly x: number;
  /** The loop the racer is inside, when they are inside one. */
  readonly loop: Obstacle | null;
}

/**
 * How an attempt decides which segment a racer occupies. The default is the current course's ground
 * bands plus the loop-ride override; T03's adapter can replace it for authored multi-deck space,
 * which is the case where "wrong segment" stops being theoretical.
 */
export interface SegmentProvider {
  segmentOf(view: SegmentView): string;
}

const defaultSegmentProvider: SegmentProvider = {
  segmentOf: ({ x, loop }) => (loop ? loopSegmentOf(loop) : segmentAtX(x)),
};

export const DEFAULT_SEGMENT_PROVIDER: SegmentProvider = Object.freeze(defaultSegmentProvider);

/** Equal segments report the segment for the whole step; a straddle reports `null`, per the contract. */
export function segmentForStep(provider: SegmentProvider, from: SegmentView, to: SegmentView): string | null {
  const start = provider.segmentOf(from);
  const end = provider.segmentOf(to);
  return start === end ? start : null;
}

/** The gate, plus the loop it was derived from. Everything here is derived; nothing is authored. */
export interface QualifyingGateSpec extends QualifyingGate {
  readonly id: typeof QUALIFYING_GATE_ID;
  /** The loop obstacle the gate is anchored to. */
  readonly loop: Obstacle;
  readonly loopLane: number;
  /** Ring radius, kept for the "no engagement before the plane" check and for diagnostics. */
  readonly ringRadius: number;
  /** The gate expressed in race-distance units, for HUD copy. */
  readonly distance: number;
}

/**
 * Every loop on a course in down-range order. `kind === 'loop'` only; lava loops are a section 3
 * feature. Sorted by `x` rather than taken in array order, because the layout is not guaranteed to
 * be sorted and "the first loop" has to mean down the hill, not first in a list.
 */
export function loopsInOrder(obstacles: readonly Obstacle[]): Obstacle[] {
  return obstacles.filter((obstacle) => obstacle.kind === 'loop').sort((a, b) => a.x - b.x);
}

/** The lowest-`x` loop on a course. */
export function findFirstLoop(obstacles: readonly Obstacle[]): Obstacle | null {
  return loopsInOrder(obstacles)[0] ?? null;
}

/**
 * The loop at a given index in down-range order, or `null` when the course has fewer than that many.
 * `findFirstLoop` is this at index 0, kept because the qualifying attempt's language is "the first
 * loop" and every one of its call sites should keep saying that.
 */
export function findLoopAt(obstacles: readonly Obstacle[], loopIndex: number): Obstacle | null {
  const index = Math.max(0, Math.floor(loopIndex));
  return loopsInOrder(obstacles)[index] ?? null;
}

/**
 * Altitude above the road surface, in world units: `0` is rolling on the dirt. This is the same
 * measure the camera and the airborne ground decal use, so the gate band and the visuals agree.
 */
export const surfaceAltitude = (world: SimWorld, x: number, y: number): number => world.y(x) - RADIUS - y;

/**
 * How far back from a loop's centre the physics may engage a racer: `stepRacer` requires
 * `|dx| <= radius + RADIUS`. The gate sits exactly on that plane, which is the whole reason the
 * captured speed is pre-loop — nothing before it can already be riding.
 */
export function loopEngagementReach(obstacle: Obstacle, course: CourseId): number {
  return loopGeometry(obstacle, course).radius + RADIUS;
}

/**
 * M01 · T1c — which loop a gate is anchored to.
 *
 * The qualifying attempt always qualifies at the **first** loop (index 0, the historical behaviour),
 * while the race's merge pool sorts the field at a later one so the opening stint is a real run
 * rather than the two seconds it takes to fall off the start pad (see `MERGE_SORTING_LOOP_INDEX` in
 * the engine). Indexing rather than a distance keeps the choice course-independent and readable:
 * every course's loops are authored in down-range order.
 */
export interface QualifyingGateOptions {
  /** Zero-based loop index, in down-range order. Defaults to the first loop. */
  readonly loopIndex?: number;
}

export function createQualifyingGate(
  course: CourseId,
  obstacles: readonly Obstacle[],
  options: QualifyingGateOptions = {},
): QualifyingGateSpec {
  const loop = findLoopAt(obstacles, options.loopIndex ?? 0);
  if (!loop) {
    throw new QualifyingError('E_GATE_MISSING', `Course "${course}" has no loop to anchor the qualifying gate to.`, {
      course, obstacles: obstacles.length,
    });
  }
  const geometry = loopGeometry(loop, course);
  const x = loop.x - loopEngagementReach(loop, course);
  return Object.freeze({
    id: QUALIFYING_GATE_ID,
    x,
    z: obstacleZ(loop),
    // Half a lane: you qualify in the loop's own lane, and a racer one lane over is 240 away.
    halfWidth: LANE_WIDTH / 2,
    altitude: 0,
    altitudeTolerance: QUALIFYING_GATE_ALTITUDE_TOLERANCE,
    segment: segmentAtX(x),
    loop,
    loopLane: loop.lane ?? 2,
    ringRadius: geometry.radius,
    distance: Math.max(0, (x - START_X) / 2),
  });
}

export interface PositionSample { readonly x: number; readonly y: number; readonly z: number }

/** Builds the contract's swept-crossing input from two engine-space samples of one tick. */
export function crossingInput(
  world: SimWorld,
  gate: QualifyingGateSpec,
  from: PositionSample,
  to: PositionSample,
  segment: string | null,
): CrossingInput {
  return {
    from: { x: from.x, z: from.z, altitude: surfaceAltitude(world, from.x, from.y) },
    to: { x: to.x, z: to.z, altitude: surfaceAltitude(world, to.x, to.y) },
    gate,
    segment,
  };
}

export function evaluateCrossing(
  world: SimWorld,
  gate: QualifyingGateSpec,
  from: PositionSample,
  to: PositionSample,
  segment: string | null,
): CrossingOutcome {
  return validateGateCrossing(crossingInput(world, gate, from, to, segment));
}

/** Canonical speed, units per second — the magnitude the entry records. */
export const canonicalSpeed = (vx: number, vy: number): number => Math.hypot(vx, vy);

/** The unit the HUD shows. `engine.ts` has displayed `speed * 0.16` since the first version. */
export const speedToDisplay = (speed: number): number => Math.round(speed * 0.16 * 10) / 10;

/** A crossing, as the attempt records it. Times are sub-tick, like the race's finish times. */
export interface GateCrossing {
  readonly ok: true;
  readonly tick: number;
  readonly fraction: number;
  /** Seconds from the attempt's own launch. */
  readonly time: number;
  readonly speed: number;
  readonly vx: number;
  readonly vy: number;
  readonly distance: number;
}

export function recordCrossing(tick: number, outcome: Extract<CrossingOutcome, { ok: true }>, vx: number, vy: number, step: number): GateCrossing {
  return Object.freeze({
    ok: true as const,
    tick,
    fraction: outcome.fraction,
    time: (tick + outcome.fraction) * step,
    speed: canonicalSpeed(vx, vy),
    vx, vy,
    distance: outcome.distance,
  });
}
