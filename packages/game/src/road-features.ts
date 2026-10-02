import { roadFeatures, type PadRect, type RoadFeatureOptions } from '@hm/trackgen';
import { heightAt, type Terrain } from '@hm/terrain';
import type { RoadDecalDef } from '@hm/render';

/**
 * The painted road for a track on a terrain: drawable decals (heights from the ground) plus the boost-pad rectangles the race
 * uses for gameplay. The maker previews exactly what the race will have because both call this with the same centreline.
 */
export function buildRoad(points: readonly (readonly [number, number])[], width: number, terrain: Terrain, o: RoadFeatureOptions = {}): { decals: RoadDecalDef[]; pads: PadRect[] } {
  const { features, pads } = roadFeatures(points, width, o);
  const decals = features.map((f): RoadDecalDef => ({
    kind: f.kind, width: f.width, period: f.period,
    points: f.points.map((p) => [p[0], heightAt(terrain, p[0], p[1]), p[1]] as const),
  }));
  return { decals, pads };
}
