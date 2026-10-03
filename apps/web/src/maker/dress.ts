import { cmd, type PresetId } from '@hm/contracts';
import type { DecorPlacement, Runtime } from '@hm/engine';
import type { DecorInstance } from '@hm/render';
import { recipeParts, scatter, TROPICAL_RULES, type ScatterRule } from '@hm/scatter';
import type { VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { NATURE_BLOCK, NATURE_MODELS } from '@hm/voxelnature';
import type { Terrain } from '@hm/terrain';
import { toCenterline, type TrackDraft } from '@hm/trackedit';

/**
 * Which foliage kinds are drawn as voxel models (so the island matches the voxel goblin) and how big a voxel is. Anything not listed is drawn from
 * its primitive recipe. The models are built once and shared by every copy.
 */
const VOXEL_KINDS: Readonly<Record<string, { source: 'art' | 'nature'; id: string; block: number }>> = {
  palm: { source: 'art', id: 'palm', block: 0.13 },
  boulder: { source: 'art', id: 'rock', block: 0.11 },
  bush: { source: 'nature', id: 'bush', block: NATURE_BLOCK['bush']! },
  tuft: { source: 'nature', id: 'grass-clump', block: NATURE_BLOCK['grass-clump']! },
  flowers: { source: 'nature', id: 'flowers', block: NATURE_BLOCK['flowers']! },
};
const modelCache = new Map<string, VoxelModel>();
function voxelModel(kind: string): { id: string; model: VoxelModel; block: number } | null {
  const v = VOXEL_KINDS[kind];
  if (!v) return null;
  let model = modelCache.get(v.id);
  if (!model) {
    const entry = v.source === 'art' ? MODELS.find((m) => m.id === v.id) : NATURE_MODELS.find((m) => m.id === v.id);
    if (!entry) return null;
    model = entry.build() as unknown as VoxelModel;
    modelCache.set(v.id, model);
  }
  return { id: v.id, model, block: v.block };
}

/** Placements -> instanced props for the renderer: voxel models where there is one for the kind, primitives otherwise. */
export function decorInstances(placements: readonly DecorPlacement[]): DecorInstance[] {
  return placements.map((p, i) => {
    const voxel = voxelModel(p.kind);
    return voxel ? { parts: [], x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.scale, voxel } : { parts: recipeParts(p.kind, 1, i + 1), x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.scale };
  });
}

/** Flowers: colour in the meadow, on grass and moss, never on slopes. */
const FLOWERS: ScatterRule = { id: 'flowers', surfaces: [4, 11], minHeight: 0.8, maxHeight: 30, maxSlopeDeg: 22, density: 14, minSpacing: 2.2, scale: [0.8, 1.4], clump: { size: 14, cover: 0.2 } };

/** Scatter foliage over the island with the tropical rules, keeping clear of the track. Returns the flat arrays the decor preset stores. */
export function dress(terrain: Terrain, draft: TrackDraft, seed: number, density: number): { kinds: string[]; items: number[]; count: number } {
  const rules = [...TROPICAL_RULES, FLOWERS].map((r) => ({ ...r, density: r.density * density }));
  const centre = draft.closed && draft.points.length >= 3 ? toCenterline(draft, 6) : [];
  const placed = scatter(terrain, rules, {
    seed, edgeMargin: 3, margin: 2, maxCount: 4000,
    ...(centre.length > 3 ? { avoid: [{ points: centre, halfWidth: draft.width / 2 + 4 }] } : {}),
  });
  const kinds: string[] = [];
  const items: number[] = [];
  for (const p of placed) {
    let k = kinds.indexOf(p.rule);
    if (k < 0) { k = kinds.length; kinds.push(p.rule); }
    items.push(k, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.yaw * 1000) / 1000, Math.round(p.scale * 100) / 100);
  }
  return { kinds, items, count: placed.length };
}

/** Write the dressed island into the scene as ONE undoable step (creates the decor preset the first time). */
export function commitDress(rt: Runtime, sceneId: PresetId, data: { kinds: string[]; items: number[] }, seed: number, density: number): void {
  const existing = rt.store.get(sceneId)?.children['decor']?.[0]?.ref;
  rt.commands.transaction('Dress island', () => {
    if (existing) {
      rt.commands.execute(cmd.setParam(`${existing}.kinds`, data.kinds as never, 'Dress island'));
      rt.commands.execute(cmd.setParam(`${existing}.items`, data.items as never, 'Dress island'));
      rt.commands.execute(cmd.setParam(`${existing}.seed`, seed, 'Dress island'));
      rt.commands.execute(cmd.setParam(`${existing}.density`, density, 'Dress island'));
    } else {
      const id = `decor-${Date.now().toString(36)}`;
      rt.commands.execute(cmd.put({ id, kind: 'decor', name: 'Foliage', params: { seed, density, kinds: data.kinds as never, items: data.items as never }, tier: 'play' }, 'Dress island'));
      rt.commands.execute(cmd.addChild(sceneId, 'decor', id, undefined, 'Dress island'));
    }
  });
}

export function clearDress(rt: Runtime, sceneId: PresetId): boolean {
  const children = rt.store.get(sceneId)?.children['decor'] ?? [];
  if (!children.length) return false;
  rt.commands.execute(cmd.removeChild(sceneId, 'decor', 0, 'Clear foliage'));
  return true;
}
