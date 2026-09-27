/**
 * The island course's route: the owner's Serpentine Isle model, raced down its main carved groove.
 *
 * The race runs in the groove, not on a road of its own: the track's centre line is the groove's floor
 * (serpentine-groove.ts, found in the model), so the ribbon the engine places balls on lies on the model
 * and nothing is drawn for it. The groove is one width all the way down and its floor is level across,
 * so the track has a fixed half-width that keeps every lane on the floor, and it never banks.
 *
 * Units: the route is authored in "route units" (the groove's coordinates, serpentine-groove.ts); the OBJ
 * is exported at a hundredth of that (MODEL_TO_ROUTE). World placement: route units times ISLAND_SCALE,
 * lifted so the model's lowest point sits on the sand base just above the sea. At 500 times the groove is about 1,250 units across its floor and the
 * route about 157,000 units long, which gives the same 3D length per race distance as the classic
 * course, so racers look as fast as they do there.
 */
import type { CenterlineWaypoint, TrackKnot, TrackSpaceOptions } from '../track-space';
import type { RouteGraph } from '../sim/route';
import { FINISH, START_X } from '../scene';
import { SERPENTINE_GROOVE } from './serpentine-groove';

/** World units per route unit. */
export const ISLAND_SCALE = 500;
/** Route units per OBJ unit: the owner's export is 1/100 of the route's coordinates. */
export const MODEL_TO_ROUTE = 100;
/** The model's lowest point (route units) and the world height it is placed at (the sand base). */
export const ISLAND_MODEL_FLOOR = -18.0569;
export const ISLAND_BASE_Y = 60;

/** A route point in world units. */
export function islandWorld(x: number, y: number, z: number): { x: number; y: number; z: number } {
  return { x: x * ISLAND_SCALE, y: (y - ISLAND_MODEL_FLOOR) * ISLAND_SCALE + ISLAND_BASE_Y, z: z * ISLAND_SCALE };
}

/** The groove floor is ~2.5 model units wide; this keeps the outer lanes' balls on it. */
export const ISLAND_HALF_WIDTH = 540;

/** How many groove points lie behind the start line (the road the chase camera looks back along). */
const LEAD_POINTS = 4;
/** How many points lie past the finish line (the run-out). */
const RUNOUT_POINTS = 4;

/** No forks yet: the owner adds more tracks with the 3D platforms. */
export const ISLAND_ROUTE_GRAPH: RouteGraph = { sections: [] };

/** The route as a track-space centre line, its knots and its options. */
export function islandCenterline(): { waypoints: CenterlineWaypoint[]; knots: TrackKnot[]; options: TrackSpaceOptions } {
  const last = SERPENTINE_GROOVE.length - 1;
  const waypoints = SERPENTINE_GROOVE.map(([x, y, z], i): CenterlineWaypoint => {
    const p = islandWorld(x, y, z);
    const label = i === 0 ? 'shack' : i === LEAD_POINTS ? 'start' : i === last - RUNOUT_POINTS ? 'finish' : i === last ? 'end' : undefined;
    // The last stretch is the finish straight (the renderer's stadium stage).
    const stage = i >= last - RUNOUT_POINTS - 6 ? 'stadium' : 'alpine';
    return label ? { ...p, stage, label } : { ...p, stage };
  });
  const knots: TrackKnot[] = [{ label: 'start', x: START_X }, { label: 'finish', x: FINISH }];
  return { waypoints, knots, options: { knots, halfWidth: ISLAND_HALF_WIDTH, bank: false } };
}
