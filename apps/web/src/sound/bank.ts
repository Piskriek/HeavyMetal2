import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { SFX, SFX_IDS, type PlayableRecipe, type SfxId } from '@hm/audio';

/**
 * Sounds are presets. The built-in recipes are the defaults; editing one in the Sound Lab makes an override preset
 * (id `sfx-<slot>`) in the scene's `sounds` slot, so it saves with the map, undoes, and can be driven by modulators
 * (volume, pitch). `resolve` is what the player asks on every play; it costs a lookup and a cached JSON parse.
 */

export interface Resolved { readonly recipe: PlayableRecipe; readonly volume: number; readonly pitch: number }

const parsed = new Map<string, { hash: string; recipe: PlayableRecipe | null }>();

export const overrideId = (slot: string): PresetId => `sfx-${slot}`;

function soundsOf(rt: Runtime): readonly PresetId[] {
  const scene = rt.binder.sceneId;
  return scene ? (rt.store.get(scene)?.children['sounds'] ?? []).map((r) => r.ref) : [];
}

export function hasOverride(rt: Runtime, slot: string): boolean {
  return soundsOf(rt).includes(overrideId(slot));
}

/** The override for a slot, or null when the built-in sound is used. A muted override resolves to volume 0. */
export function resolveSound(rt: Runtime, slot: string): Resolved | null {
  const id = overrideId(slot);
  if (!soundsOf(rt).includes(id)) return null;
  const p = rt.store.get(id);
  if (!p) return null;
  let entry = parsed.get(id);
  if (!entry || entry.hash !== p.hash) {
    let recipe: PlayableRecipe | null = null;
    try { const j = JSON.parse(String(p.params['recipe'] ?? '')) as PlayableRecipe; if (Array.isArray(j.layers)) recipe = j; } catch { /* falls back to the built-in */ }
    entry = { hash: p.hash, recipe };
    parsed.set(id, entry);
  }
  if (!entry.recipe) return null;
  const enabled = p.params['enabled'] !== false;
  return { recipe: entry.recipe, volume: enabled ? Number(p.params['volume'] ?? 1) : 0, pitch: Number(p.params['pitch'] ?? 1) };
}

/** Make (or find) the override preset for a slot, starting from the built-in recipe. One undo step. */
export function ensureOverride(rt: Runtime, slot: SfxId): PresetId {
  const id = overrideId(slot);
  const scene = rt.binder.sceneId;
  if (!scene) throw new Error('no scene loaded');
  if (soundsOf(rt).includes(id)) return id;
  const base = SFX[slot];
  rt.commands.transaction(`Edit sound: ${slot}`, () => {
    if (!rt.store.get(id)) {
      rt.commands.execute(cmd.put({ id, kind: 'sound', name: slot.replace(/-/g, ' '), params: { slot, volume: 1, pitch: 1, enabled: true, recipe: JSON.stringify(base) }, tier: 'play' }, `Edit sound: ${slot}`));
    }
    rt.commands.execute(cmd.addChild(scene, 'sounds', id, undefined, `Edit sound: ${slot}`));
  });
  return id;
}

export function removeOverride(rt: Runtime, slot: string): boolean {
  const scene = rt.binder.sceneId;
  if (!scene) return false;
  const idx = soundsOf(rt).indexOf(overrideId(slot));
  if (idx < 0) return false;
  rt.commands.execute(cmd.removeChild(scene, 'sounds', idx, `Reset sound: ${slot}`));
  return true;
}

export interface SoundSlot { readonly id: SfxId; readonly label: string; readonly category: 'race' | 'editor' | 'ui'; readonly edited: boolean }

export function listSlots(rt: Runtime): SoundSlot[] {
  return SFX_IDS.map((id) => ({ id, label: id.replace(/-/g, ' '), category: SFX[id].category, edited: hasOverride(rt, id) }));
}
