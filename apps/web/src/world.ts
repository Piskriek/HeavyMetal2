import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { DEFAULT_RULES, PLANTS, normalizePlant, paramsToRules, plantFor, plantToParams, rulesToParams, type PlantBehaviour, type WorldRules } from '@hm/worldrules';

/**
 * The island's world rules and plant behaviours, as presets in the scene (slots `world` and `plants`). With none in the scene the ready-made
 * ones apply; the first edit makes a copy of the island's own (same copy-on-write rule as lighting).
 */
export function rulesOf(rt: Runtime, sceneId: PresetId): WorldRules {
  const ref = rt.store.get(sceneId)?.children['world']?.[0]?.ref;
  return ref && rt.store.get(ref) ? paramsToRules(rt.store.resolve(ref).params) : DEFAULT_RULES;
}

export function plantsOf(rt: Runtime, sceneId: PresetId): PlantBehaviour[] {
  const own = new Map<string, PlantBehaviour>();
  for (const r of rt.store.get(sceneId)?.children['plants'] ?? []) {
    if (!rt.store.get(r.ref)) continue;
    const params = rt.store.resolve(r.ref).params;
    const p = normalizePlant({ ...params, kind: String(params['kind'] ?? '') });
    own.set(p.kind, p);
  }
  return PLANTS.map((p) => own.get(p.kind) ?? p).concat([...own.values()].filter((p) => !PLANTS.some((q) => q.kind === p.kind)));
}

/** The scene's own world-rules preset, made from the ready-made rules on first use. */
export function ensureRules(rt: Runtime, sceneId: PresetId): PresetId {
  const existing = rt.store.get(sceneId)?.children['world']?.[0]?.ref;
  if (existing && rt.store.get(existing)) return existing;
  const id = `world-${sceneId}`;
  rt.commands.transaction('World rules', () => {
    rt.commands.execute(cmd.put({ id, kind: 'world-rules', name: 'World rules', params: rulesToParams(DEFAULT_RULES), tier: 'build' }, 'World rules'));
    rt.commands.execute(cmd.addChild(sceneId, 'world', id, undefined, 'World rules'));
  });
  return id;
}

/** The scene's own behaviour preset for one plant kind, made from the ready-made one on first use. */
export function ensurePlant(rt: Runtime, sceneId: PresetId, kind: string): PresetId {
  for (const r of rt.store.get(sceneId)?.children['plants'] ?? []) {
    const p = rt.store.get(r.ref);
    if (p && rt.store.resolve(r.ref).params['kind'] === kind) return r.ref;
  }
  const base = plantFor(kind);
  const id = `plant-${kind}-${sceneId}`;
  rt.commands.transaction(`${base.name} behaviour`, () => {
    rt.commands.execute(cmd.put({ id, kind: 'plant', name: base.name, params: { kind, ...plantToParams(base) }, tier: 'build' }, `${base.name} behaviour`));
    rt.commands.execute(cmd.addChild(sceneId, 'plants', id, undefined, `${base.name} behaviour`));
  });
  return id;
}
