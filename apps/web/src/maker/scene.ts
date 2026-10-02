import type { Params, PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { MATERIALS, PROPS } from '@hm/content';
import { encodeTerrain, generateIsland, type Terrain, type VolcanoOptions } from '@hm/terrain';
import { dress } from './dress';
import { SURF } from '@hm/render';
import { DRAFT_PRESETS } from '@hm/trackedit';

export interface MakerScene { sceneId: PresetId; terrainId: PresetId; trackId: PresetId; materialIds: Map<string, PresetId> }

/** The starting map of the Map Maker: a generated island, the material library, and an empty-ish track the user can reshape. */
/** How each island template is shaped, until the templates are authored as real presets. */
export interface TemplateShape {
  readonly seed: number; readonly radius: number; readonly height: number; readonly roughness: number; readonly track: boolean; readonly name: string;
  /** A cone with a crater in the middle of the island. */
  readonly volcano?: VolcanoOptions;
  /** Foliage and rocks scattered at this density when the island is made (0 or left out: bare ground). */
  readonly dress?: number;
  /** The ready-made lighting the island starts on. */
  readonly look?: string;
}
export const TEMPLATE_SHAPES: Readonly<Record<string, TemplateShape>> = {
  'blank-island': { seed: 21, radius: 0.8, height: 9, roughness: 3, track: false, name: 'My Island' },
  'palm-beach': { seed: 5, radius: 0.88, height: 11, roughness: 4, track: false, name: 'Palm Beach', dress: 1.2 },
  'rocky-cove': { seed: 9, radius: 0.9, height: 24, roughness: 11, track: false, name: 'Rocky Cove', dress: 0.6 },
  volcano: { seed: 12, radius: 0.92, height: 11, roughness: 4, track: false, name: 'Volcano Isle', volcano: { peak: 40, cone: 0.34, crater: 0.2, craterDepth: 17 }, dress: 0.9 },
  'racing-starter': { seed: 7, radius: 0.95, height: 18, roughness: 7, track: true, name: 'Racing Island' },
  'floating-rocks': { seed: 33, radius: 0.55, height: 15, roughness: 13, track: false, name: 'Floating Rocks', dress: 0.5 },
  'empty-sea': { seed: 3, radius: 0.18, height: 3, roughness: 2, track: false, name: 'Empty Sea' },
};

export function buildMakerScene(rt: Runtime, seed = 7, shape?: TemplateShape | { radius: number; height: number; roughness: number; track: boolean; name: string }): MakerScene {
  const extra = shape as TemplateShape | undefined;
  const materialIds = new Map<string, PresetId>();
  for (const m of MATERIALS) {
    const p = rt.store.put({ kind: 'material', name: m.name, params: m.params as Params, tags: m.tags, tier: m.tier });
    materialIds.set(m.name, p.id);
  }
  const terrain: Terrain = generateIsland({ cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 }, seed, {
    surfaces: { seabed: SURF.seabed, sand: SURF.sand, grass: SURF.grass, rock: SURF.rock, cliff: SURF.cliff, lava: SURF.lava, scree: SURF.scree, basalt: SURF.basalt, soil: SURF.soil },
    radius: shape?.radius ?? 0.95, height: shape?.height ?? 18, roughness: shape?.roughness ?? 7, ...(extra?.volcano ? { volcano: extra.volcano } : {}),
  });
  const ground = rt.store.put({ kind: 'terrain', name: 'Island', params: { data: encodeTerrain(terrain) as never, soft: 0.55, bump: 1, friction: 0.9, restitution: 0 } });
  const oval = DRAFT_PRESETS[0]!.draft;
  const track = rt.store.put({
    kind: 'track', name: 'Main track',
    params: { points: (shape && !shape.track ? [] : oval.points.map((p) => [p.x, p.z])) as never, width: oval.width, closed: true, laps: 3 },
  });
  const cam = rt.store.put({ kind: 'camera', name: 'Overview', params: { fov: 50, distance: 150, yaw: 0.5, pitch: 0.75, targetY: 4 } });
  // template islands come dressed: palms, bushes and rocks scattered by the tropical rules (stored as the scene's foliage preset, not as an edit)
  const decorRef: { ref: PresetId }[] = [];
  if (extra?.dress && extra.dress > 0) {
    const dressSeed = seed * 7 + 3;
    const d = dress(terrain, { ...oval, points: [], closed: false }, dressSeed, extra.dress);
    const decor = rt.store.put({ kind: 'decor', name: 'Foliage', params: { seed: dressSeed, density: extra.dress, kinds: d.kinds as never, items: d.items as never }, tier: 'play' });
    decorRef.push({ ref: decor.id });
  }
  const scene = rt.store.put({
    kind: 'scene', name: shape?.name ?? 'My map', params: { gravity: 19, camera: { ref: cam.id }, track: { ref: track.id }, ...(extra?.look ? { look: extra.look } : {}) },
    children: { terrain: [{ ref: ground.id }], ...(decorRef.length ? { decor: decorRef } : {}) },
  });
  rt.loadScene(scene.id);
  return { sceneId: scene.id, terrainId: ground.id, trackId: track.id, materialIds };
}

export const PROP_CARDS = PROPS.map((p) => ({ id: p.name, name: p.name, kind: 'prop', tags: p.tags, tier: p.tier }));
export const propSeed = (name: string) => PROPS.find((p) => p.name === name);
