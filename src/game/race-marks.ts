/**
 * Start and finish lines placed in build mode (kit props `kit_start-line` and `kit_finish-line`, on the
 * Race shelf). Where each one stands along the course is read from its position on the road, so
 * moving a line in the builder moves the finish. The engine races to the finish the player picks
 * (session `finish` / `finishes`, engine `finishX`).
 */
import type { PlacedProp } from './builder/prop-catalog';
import { courseTrackSpace } from './island-route/island-space';
import { engineFromWorld, engineXFromDistance, getTrackSpace, worldFromCanonical, engineDistanceFromX, type TrackSpaceMap } from './track-space';
import { FINISH, START_X } from './scene';
import type { CourseId } from './types';

export const START_LINE_TYPE = 'kit_start-line';
export const FINISH_LINE_TYPE = 'kit_finish-line';
export const isRaceMarkType = (type: string) => type === START_LINE_TYPE || type === FINISH_LINE_TYPE;

/** A finish a race can end at: engine x along the course, and the name it was placed under. */
export interface CourseFinish {
  id: string; name: string; x: number;
  /** Share of the full course, 0..1. */
  share: number;
  /** Where it stands in the world (x, z), for the island map. */
  world: { x: number; z: number };
}

/** Where a point in the world lies along the course, as engine x (clamped to the course). */
export function engineXAt(space: TrackSpaceMap, point: { x: number; y: number; z: number }): number {
  const canonical = engineFromWorld(space, point);
  return Math.min(FINISH, Math.max(START_X, engineXFromDistance(canonical.distance)));
}

/** The middle of the road at engine x, and the heading along it (rotY), for snapping a placed line. */
export function roadPoseAt(space: TrackSpaceMap, x: number): { x: number; y: number; z: number; rotY: number } {
  const at = (ex: number) => worldFromCanonical(space, { s: space.trackDistFromEngineDistance(engineDistanceFromX(ex)), laneZ: 0, altitude: 0 }).world;
  const p = at(x);
  const a = at(Math.max(START_X, x - 60));
  const b = at(Math.min(FINISH, x + 60));
  // The gate faces down the road: its width spans the road, so it turns with the road's heading.
  return { x: p.x, y: p.y, z: p.z, rotY: Math.atan2(b.x - a.x, b.z - a.z) };
}

/**
 * The course's placed start and finishes. Finishes come in order down the course; unnamed ones (the
 * shelf's default name) are numbered in that order.
 */
export function courseMarks(props: readonly PlacedProp[], course: CourseId): { start: number | null; startWorld: { x: number; z: number } | null; finishes: CourseFinish[] } {
  const space = course === 'basalt' ? courseTrackSpace(course) : getTrackSpace();
  const startProps = props.filter((p) => p.type === START_LINE_TYPE && p.visible !== false);
  const starts = startProps.map((p) => engineXAt(space, p));
  const first = starts.length ? startProps[starts.indexOf(Math.min(...starts))] : null;
  const placed = props
    .filter((p) => p.type === FINISH_LINE_TYPE && p.visible !== false)
    .map((p) => ({ id: p.id, custom: p.name && p.name !== 'Finish Line' ? p.name : '', x: engineXAt(space, p), world: { x: p.x, z: p.z } }))
    .sort((a, b) => a.x - b.x);
  const finishes = placed.map((f, i) => ({
    id: f.id,
    name: f.custom || `Finish ${i + 1}`,
    x: Math.round(f.x),
    share: (f.x - START_X) / (FINISH - START_X),
    world: f.world,
  }));
  return { start: starts.length ? Math.min(...starts) : null, startWorld: first ? { x: first.x, z: first.z } : null, finishes };
}

/** The world (x, z) of a point on the road's middle at engine x (the full run's end, the start line). */
export function roadPointAt(course: CourseId, x: number): { x: number; z: number } {
  const space = course === 'basalt' ? courseTrackSpace(course) : getTrackSpace();
  const p = roadPoseAt(space, x);
  return { x: p.x, z: p.z };
}
