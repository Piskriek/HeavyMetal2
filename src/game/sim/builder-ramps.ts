/**
 * Builder-placed ramps as physics.
 *
 * The builder compiles each placed ramp prop into a `PhysicalRampSurface` (track space: arc distance
 * and lateral offset). Until now only the renderer read those surfaces: it lifted the ball up the
 * ramp visually, then dropped it straight back onto the road at the crest because the physics had no
 * ramp there — the "ramp stops you dead like a reset" bug. This turns each surface into an ordinary
 * engine `ramp` obstacle, so the physics climbs it and launches off the crest like any layout ramp.
 * Pure: no THREE, no DOM.
 */
import { LANE_WIDTH, laneZ, type Obstacle } from '../scene';
import {
  engineXFromDistance, laneZFromLateral, type PhysicalRampSurface, type TrackSpaceMap,
} from '../track-space';

/** Engine obstacles for the builder's compiled ramp surfaces. Surfaces that cover no lane are skipped. */
export function builderRampObstacles(map: TrackSpaceMap, surfaces: readonly PhysicalRampSurface[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const surface of surfaces) {
    const startX = engineXFromDistance(map.engineDistanceFromTrackDist(surface.startDist));
    const crestX = engineXFromDistance(map.engineDistanceFromTrackDist(surface.crestDist));
    const width = crestX - startX;
    if (!(width > 1) || !(surface.height > 0)) continue;
    // Lateral footprint → engine z, measured at the crest (where the launch happens).
    const zA = laneZFromLateral(map, surface.crestDist, surface.centerLateral - surface.halfWidth);
    const zB = laneZFromLateral(map, surface.crestDist, surface.centerLateral + surface.halfWidth);
    const zMin = Math.min(zA, zB); const zMax = Math.max(zA, zB);
    // A lane is on the ramp when at least a quarter of its width is under the footprint.
    const lanes: number[] = [];
    for (let lane = 0; lane < 4; lane++) {
      const c = laneZ(lane);
      if (c + LANE_WIDTH / 4 >= zMin && c - LANE_WIDTH / 4 <= zMax) lanes.push(lane);
    }
    if (lanes.length === 0) continue;
    // One single-lane ramp per covered lane: the physics' ramp test (`occupiesLane`) only looks at a
    // ramp's centre lane (±66), exactly like the layout's own ramps, which are all one lane wide.
    for (const lane of lanes) {
      out.push({
        kind: 'ramp', x: startX, width, height: surface.height, lane, laneSpan: 1,
        hit: false, hitAt: -100, variant: `builder:${surface.propId ?? 'ramp'}`,
      });
    }
  }
  return out.sort((a, b) => a.x - b.x);
}
