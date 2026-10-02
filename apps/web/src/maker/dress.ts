import { cmd, type PresetId } from '@hm/contracts';
import type { DecorPlacement, Runtime } from '@hm/engine';
import type { DecorInstance } from '@hm/render';
import { recipeParts, scatter, TROPICAL_RULES } from '@hm/scatter';
import type { Terrain } from '@hm/terrain';
import { toCenterline, type TrackDraft } from '@hm/trackedit';

/** Placements -> instanced parts for the renderer (each prop is a few primitives). */
export function decorInstances(placements: readonly DecorPlacement[]): DecorInstance[] {
  return placements.map((p, i) => ({ parts: recipeParts(p.kind, 1, i + 1), x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.scale }));
}

/** Scatter foliage over the island with the tropical rules, keeping clear of the track. Returns the flat arrays the decor preset stores. */
export function dress(terrain: Terrain, draft: TrackDraft, seed: number, density: number): { kinds: string[]; items: number[]; count: number } {
  const rules = TROPICAL_RULES.map((r) => ({ ...r, density: r.density * density }));
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
