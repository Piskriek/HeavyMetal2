/**
 * ISLAND-ROUTE: the island course's track-space maps. The main map follows the main groove. Forks (ROUTE-1)
 * are listed in ISLAND_ROUTE_GRAPH; a branch other than a fork's first gets a map of its own that equals the
 * main map outside its fork. The course has no forks yet (the owner adds tracks with the 3D platforms), so
 * today every lookup here returns the main map; the plumbing stays so forks drop straight in.
 */
import { buildTrackSpace, getTrackSpace, type TrackSpaceMap } from '../track-space';
import type { CourseId } from '../types';
import type { RacerRoute } from '../sim/route';
import { ISLAND_ROUTE_GRAPH, islandCenterline } from './serpentine-route';

let mainMap: TrackSpaceMap | null = null;

/** The island's main map. */
export function islandTrackSpace(): TrackSpaceMap {
  if (!mainMap) {
    const { waypoints, options } = islandCenterline();
    mainMap = buildTrackSpace(waypoints, [], [], options);
  }
  return mainMap;
}

/** The map for one branch of one fork (the main map until branch geometry is authored). */
export function islandBranchSpace(_section: string, _branch: string): TrackSpaceMap {
  return islandTrackSpace();
}

/** The course's main map: the island's for the island course, the classic course's for the others. */
export function courseTrackSpace(course: CourseId | undefined): TrackSpaceMap {
  return course === 'basalt' ? islandTrackSpace() : getTrackSpace();
}

/** Every road an obstacle at engine x stands on: each branch's inside a fork, the main road elsewhere. */
export function islandRoadsAt(x: number): readonly TrackSpaceMap[] {
  const section = ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x0 && x < s.x1);
  return section ? section.branches.map((b) => islandBranchSpace(section.id, b.id)) : [islandTrackSpace()];
}

/** How far past a merge (engine x) the camera keeps the branch's map, so it never looks back from another road. */
export const CAMERA_TAIL_X = 900;

/** The map the camera follows the player on: its branch's inside a fork and for a short tail past the merge. */
export function cameraTrackSpace(course: CourseId | undefined, x: number, route: RacerRoute | undefined): TrackSpaceMap {
  if (course !== 'basalt') return getTrackSpace();
  const inside = ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x0 && x < s.x1)
    ?? ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x1 && x < s.x1 + CAMERA_TAIL_X);
  const branch = inside ? route?.[inside.id] : undefined;
  return inside && branch ? islandBranchSpace(inside.id, branch) : islandTrackSpace();
}

/** The map a racer at engine x is drawn on: its branch's inside a fork it has chosen, the main map elsewhere. */
export function racerTrackSpace(course: CourseId | undefined, x: number, route: RacerRoute | undefined): TrackSpaceMap {
  if (course !== 'basalt') return getTrackSpace();
  const section = ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x0 && x < s.x1);
  const branch = section ? route?.[section.id] : undefined;
  return section && branch ? islandBranchSpace(section.id, branch) : islandTrackSpace();
}
