import { cmd, type PresetId, type PresetStore } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { applyTimeOfDay, paramsToSetup, setupById, setupToParams, SETUPS, type LightSetup } from '@hm/lighting';
import type { ThreeRenderer } from '@hm/render';

/** The ready-made looks, for the picker. */
export const LOOKS: readonly { readonly id: string; readonly name: string }[] = SETUPS.map((s) => ({ id: s.id, name: s.name }));

/**
 * The lighting a scene asks for. A `light-setup` preset in the scene's `lighting` slot wins (that is where an edited look lives); otherwise the
 * ready-made look named by the scene's `look` variable. When the scene has a time of day (or one is passed, for the live slider) the sun
 * and sky follow the clock.
 */
export function setupOf(store: PresetStore, sceneId: PresetId, hourOverride: number | null = null): LightSetup {
  const scene = store.get(sceneId);
  if (!scene) return setupById('noon-clear');
  const params = store.resolve(sceneId).params;
  const ref = scene.children['lighting']?.[0]?.ref;
  const own = ref ? store.get(ref) : undefined;
  const base = own && ref ? paramsToSetup(store.resolve(ref).params, ref, own.name) : setupById(String(params['look'] ?? 'noon-clear'));
  const hour = hourOverride ?? Number(params['timeOfDay'] ?? -1);
  return Number.isFinite(hour) && hour >= 0 ? applyTimeOfDay(base, hour) : base;
}

/** Light the renderer. `fogScale` thins the haze for high overview cameras (the editor looks down from far away). */
export function applyLighting(renderer: ThreeRenderer, setup: LightSetup, fogScale = 1, blendSeconds = 0.6): void {
  renderer.setLighting(fogScale === 1 ? setup : { ...setup, fog: { ...setup.fog, density: setup.fog.density * fogScale } }, blendSeconds);
}

/**
 * Keep the renderer lit with whatever the scene's lighting is now: picks a new look, edits to the light-setup preset and the time of day all
 * flow through here. Returns the stop function.
 */
export function followLighting(store: PresetStore, sceneId: PresetId, renderer: ThreeRenderer, fogScale = 1): () => void {
  let last = '';
  const refresh = (): void => {
    const setup = setupOf(store, sceneId);
    const sig = JSON.stringify(setup) + fogScale;
    if (sig === last) return;
    last = sig;
    applyLighting(renderer, setup, fogScale);
  };
  refresh();
  return store.subscribe(refresh);
}

/**
 * Lighting is a preset that forks on first edit. A scene starts on a ready-made look (its `look` variable). The first change to any knob makes a
 * `light-setup` preset from that look (all knobs, named after it) and hangs it in the scene's `lighting` slot; from then on it is yours to edit,
 * rename, drive and share. Returns the preset's id.
 */
export function ensureLightPreset(rt: Runtime, sceneId: PresetId): PresetId {
  const existing = rt.store.get(sceneId)?.children['lighting']?.[0]?.ref;
  if (existing && rt.store.get(existing)) return existing;
  const base = setupOf(rt.store, sceneId, Number.NaN); // the look as it is, without the clock
  const id = `light-${sceneId}`;
  rt.commands.transaction('Lighting', () => {
    rt.commands.execute(cmd.put({ id, kind: 'light-setup', name: base.name, params: setupToParams(base), tier: 'build' }, 'Lighting'));
    rt.commands.execute(cmd.addChild(sceneId, 'lighting', id, undefined, 'Lighting'));
  });
  return id;
}

/** Pick a ready-made look: drops any edited copy and points the scene at the look (one undo step). */
export function pickLook(rt: Runtime, sceneId: PresetId, lookId: string): void {
  const name = LOOKS.find((l) => l.id === lookId)?.name ?? lookId;
  rt.commands.transaction(`Look: ${name}`, () => {
    if (rt.store.get(sceneId)?.children['lighting']?.length) rt.commands.execute(cmd.removeChild(sceneId, 'lighting', 0, `Look: ${name}`));
    rt.commands.execute(cmd.setParam(`${sceneId}.look`, lookId, `Look: ${name}`));
  });
}
