/**
 * ISLAND-ROUTE: Basalt Isle's track-space maps. The main map follows every fork's first (outer) branch;
 * each other branch has a map of its own that is identical outside its fork (the same anchors, knots and
 * stubs), so a racer on that branch is placed on that branch's road while the rest of the course stays
 * the main road. Maps are built once, on first use.
 */
import { buildTrackSpace, getTrackSpace, type TrackSpaceMap } from '../track-space';
import type { CourseId } from '../types';
import type { RacerRoute } from '../sim/route';
import { ISLAND_ROUTE_GRAPH, islandCenterline } from './basalt-route';

let mainMap: TrackSpaceMap | null = null;
const branchMaps = new Map<string, TrackSpaceMap>();

/** The island's main map (every fork on its first branch). */
export function islandTrackSpace(): TrackSpaceMap {
  if (!mainMap) {
    const { waypoints, knots } = islandCenterline();
    mainMap = buildTrackSpace(waypoints, [], [], { knots });
  }
  return mainMap;
}

/** The map for one branch of one fork (the main map for a fork's first branch). */
export function islandBranchSpace(section: string, branch: string): TrackSpaceMap {
  const fork = ISLAND_ROUTE_GRAPH.sections.find((s) => s.id === section);
  if (!fork || fork.branches[0].id === branch) return islandTrackSpace();
  const key = `${section}=${branch}`;
  let map = branchMaps.get(key);
  if (!map) {
    const { waypoints, knots } = islandCenterline({ [section]: branch });
    map = buildTrackSpace(waypoints, [], [], { knots });
    branchMaps.set(key, map);
  }
  return map;
}

/** Every branch that is not a fork's first, with its map and the arc range of its fork on that map. */
export function islandBranchRoads(): { section: string; branch: string; map: TrackSpaceMap; from: number; to: number }[] {
  return ISLAND_ROUTE_GRAPH.sections.flatMap((section) => section.branches.slice(1).map((b) => {
    const map = islandBranchSpace(section.id, b.id);
    return { section: section.id, branch: b.id, map, from: map.distOf(`${section.id}:split`), to: map.distOf(`${section.id}:merge`) };
  }));
}

/** The course's main map: the island's for Basalt Isle, the classic course's for the others. */
export function courseTrackSpace(course: CourseId | undefined): TrackSpaceMap {
  return course === 'basalt' ? islandTrackSpace() : getTrackSpace();
}

/** Every road an obstacle at engine x stands on: each branch's inside a fork, the main road elsewhere. */
export function islandRoadsAt(x: number): readonly TrackSpaceMap[] {
  const section = ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x0 && x < s.x1);
  return section ? section.branches.map((b) => islandBranchSpace(section.id, b.id)) : [islandTrackSpace()];
}

/**
 * How far past a merge (engine x) the camera keeps the branch's map: its chase rig looks back up to
 * ~3,000 arc units, and every shared stretch after a merge is longer than this.
 */
export const CAMERA_TAIL_X = 900;

/**
 * The map the camera follows the player on: its branch's map inside a fork and for a short tail past the
 * merge, so the point the camera looks back from never lands on another branch's road.
 */
export function cameraTrackSpace(course: CourseId | undefined, x: number, route: RacerRoute | undefined): TrackSpaceMap {
  if (course !== 'basalt') return getTrackSpace();
  const inside = ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x0 && x < s.x1)
    ?? ISLAND_ROUTE_GRAPH.sections.find((s) => x >= s.x1 && x < s.x1 + CAMERA_TAIL_X);
  const branch = inside ? route?.[inside.id] : undefined;
  return inside && branch ? islandBranchSpace(inside.id, branch) : islandTrackSpace();
}

/**
 * The map a racer at engine x is drawn on: its branch's map inside a fork it has chosen, the main
 * map everywhere else. Branch maps equal the main map at every split and merge, so the switch is
 * seamless (tests/island-route.test.ts holds it).
 */
export function racerTrackSpace(course: CourseId | undefined, x: number, route: RacerRoute | undefined): TrackSpaceMap {
  if (course !== 'basalt') return getTrackSpace();
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    if (x >= section.x0 && x < section.x1) {
      const branch = route?.[section.id];
      return branch ? islandBranchSpace(section.id, branch) : islandTrackSpace();
    }
  }
  return islandTrackSpace();
}
