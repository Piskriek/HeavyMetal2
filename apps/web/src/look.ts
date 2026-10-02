import type { PresetId, PresetStore } from '@hm/contracts';
import { applyTimeOfDay, paramsToSetup, setupById, SETUPS, type LightSetup } from '@hm/lighting';
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
