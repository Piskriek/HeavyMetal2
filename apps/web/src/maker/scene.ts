import type { Params, PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { MATERIALS, PROPS } from '@hm/content';
import { encodeTerrain, generateIsland, type Terrain } from '@hm/terrain';
import { SURF } from '@hm/render';
import { DRAFT_PRESETS } from '@hm/trackedit';

export interface MakerScene { sceneId: PresetId; terrainId: PresetId; trackId: PresetId; materialIds: Map<string, PresetId> }

/** The starting map of the Map Maker: a generated island, the material library, and an empty-ish track the user can reshape. */
export function buildMakerScene(rt: Runtime, seed = 7): MakerScene {
  const materialIds = new Map<string, PresetId>();
  for (const m of MATERIALS) {
    const p = rt.store.put({ kind: 'material', name: m.name, params: m.params as Params, tags: m.tags, tier: m.tier });
    materialIds.set(m.name, p.id);
  }
  const terrain: Terrain = generateIsland({ cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 }, seed, {
    surfaces: { seabed: SURF.seabed, sand: SURF.sand, grass: SURF.grass, rock: SURF.rock, cliff: SURF.cliff }, radius: 0.95, height: 18, roughness: 7,
  });
  const ground = rt.store.put({ kind: 'terrain', name: 'Island', params: { data: encodeTerrain(terrain) as never, soft: 0.55, bump: 1, friction: 0.9, restitution: 0 } });
  const oval = DRAFT_PRESETS[0]!.draft;
  const track = rt.store.put({
    kind: 'track', name: 'Main track',
    params: { points: oval.points.map((p) => [p.x, p.z]) as never, width: oval.width, closed: true, laps: 3 },
  });
  const cam = rt.store.put({ kind: 'camera', name: 'Overview', params: { fov: 50, distance: 150, yaw: 0.5, pitch: 0.75, targetY: 4 } });
  const scene = rt.store.put({
    kind: 'scene', name: 'My map', params: { gravity: 19, camera: { ref: cam.id }, track: { ref: track.id } },
    children: { terrain: [{ ref: ground.id }] },
  });
  rt.loadScene(scene.id);
  return { sceneId: scene.id, terrainId: ground.id, trackId: track.id, materialIds };
}

export const PROP_CARDS = PROPS.map((p) => ({ id: p.name, name: p.name, kind: 'prop', tags: p.tags, tier: p.tier }));
export const propSeed = (name: string) => PROPS.find((p) => p.name === name);
