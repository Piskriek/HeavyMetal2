import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { SFX, SFX_IDS, type PlayableRecipe, type SfxId, type SfxRecipe } from '@hm/audio';
import { RACE_SOUNDS, UI_SOUNDS } from '@hm/soundpack';

const PACK = [...RACE_SOUNDS, ...UI_SOUNDS];
import { DEFAULT_ENGINE_SPEC, DEFAULT_MUSIC_SPEC, normalizeMusicSpec, type EngineSpec, type MusicSpec } from '@hm/soundlab';

/**
 * Sounds are presets. The built-in recipes are the defaults; editing one in the Sound Lab makes an override preset
 * (id `sfx-<slot>`) in the scene's `sounds` slot, so it saves with the map, undoes, and can be driven by modulators
 * (volume, pitch). `resolve` is what the player asks on every play; it costs a lookup and a cached JSON parse.
 */

export interface Resolved { readonly recipe: PlayableRecipe; readonly volume: number; readonly pitch: number }

const parsed = new Map<string, { hash: string; recipe: PlayableRecipe | null }>();

/** The designed recipe for a slot: the sound pack when it has one, else the audio package's built-in. */
export function builtInRecipe(slot: string): PlayableRecipe | undefined {
  return (PACK.find((s) => s.id === slot) as PlayableRecipe | undefined) ?? (SFX as Record<string, PlayableRecipe>)[slot];
}

/** What plays when the map has no override for a slot (null = let the audio engine use its own built-in). */
export function packSound(slot: string): Resolved | null {
  const r = PACK.find((s) => s.id === slot);
  return r ? { recipe: r as PlayableRecipe, volume: 1, pitch: 1 } : null;
}

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
  const base = builtInRecipe(slot) ?? SFX[slot];
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

export interface SoundSlot { readonly id: SfxId; readonly label: string; readonly category: SfxRecipe['category']; readonly edited: boolean }

export function listSlots(rt: Runtime): SoundSlot[] {
  return SFX_IDS.map((id) => ({ id, label: id.replace(/-/g, ' '), category: SFX[id].category, edited: hasOverride(rt, id) }));
}

/* ---- the engine hum and the music are presets too (one of each per scene) ---- */

export const ENGINE_ID: PresetId = 'engine-hum';
export const MUSIC_ID: PresetId = 'music-race';

const numberParams = (rt: Runtime, id: PresetId): Record<string, number> => {
  const out: Record<string, number> = {};
  const p = rt.store.get(id);
  if (!p) return out;
  const resolved = rt.store.resolve(id).params;
  for (const [k, v] of Object.entries(resolved)) if (typeof v === 'number') out[k] = v;
  return out;
};

/** The scene's engine hum settings, or the built-in ones. Read every frame by the race, so a driver can move them live. */
export function engineSpecOf(rt: Runtime): { spec: EngineSpec; volume: number } {
  const scene = rt.binder.sceneId;
  const has = scene && (rt.store.get(scene)?.children['sounds'] ?? []).some((r) => r.ref === ENGINE_ID);
  if (!has) return { spec: DEFAULT_ENGINE_SPEC, volume: 1 };
  const n = numberParams(rt, ENGINE_ID);
  const spec = { ...DEFAULT_ENGINE_SPEC };
  for (const k of Object.keys(spec) as (keyof EngineSpec)[]) if (typeof n[k] === 'number') spec[k] = n[k]!;
  return { spec, volume: n['volume'] ?? 1 };
}

export function musicSpecOf(rt: Runtime): { spec: MusicSpec; volume: number; enabled: boolean } {
  const scene = rt.binder.sceneId;
  const has = scene && (rt.store.get(scene)?.children['sounds'] ?? []).some((r) => r.ref === MUSIC_ID);
  if (!has) return { spec: DEFAULT_MUSIC_SPEC, volume: 1, enabled: true };
  const p = rt.store.resolve(MUSIC_ID).params;
  const spec = normalizeMusicSpec({
    seed: Number(p['seed'] ?? DEFAULT_MUSIC_SPEC.seed), bars: Number(p['bars'] ?? DEFAULT_MUSIC_SPEC.bars),
    mood: String(p['mood'] ?? DEFAULT_MUSIC_SPEC.mood) as MusicSpec['mood'], bpm: Number(p['bpm'] ?? DEFAULT_MUSIC_SPEC.bpm),
  });
  return { spec, volume: Number(p['volume'] ?? 1), enabled: p['enabled'] !== false };
}

/** Make (or find) the scene's engine hum or music preset, with the built-in values. One undo step. */
export function ensureScenePreset(rt: Runtime, which: 'engine' | 'music'): PresetId {
  const id = which === 'engine' ? ENGINE_ID : MUSIC_ID;
  const scene = rt.binder.sceneId;
  if (!scene) throw new Error('no scene loaded');
  if (soundsOf(rt).includes(id)) return id;
  const label = which === 'engine' ? 'Edit engine hum' : 'Edit music';
  rt.commands.transaction(label, () => {
    if (!rt.store.get(id)) {
      const params = which === 'engine' ? { ...DEFAULT_ENGINE_SPEC, volume: 1 } : { ...DEFAULT_MUSIC_SPEC, volume: 1, enabled: true };
      rt.commands.execute(cmd.put({ id, kind: which === 'engine' ? 'engine-sound' : 'music', name: which === 'engine' ? 'Engine hum' : 'Race music', params: params as never, tier: 'play' }, label));
    }
    rt.commands.execute(cmd.addChild(scene, 'sounds', id, undefined, label));
  });
  return id;
}

export function removeScenePreset(rt: Runtime, which: 'engine' | 'music'): boolean {
  const scene = rt.binder.sceneId;
  if (!scene) return false;
  const idx = soundsOf(rt).indexOf(which === 'engine' ? ENGINE_ID : MUSIC_ID);
  if (idx < 0) return false;
  rt.commands.execute(cmd.removeChild(scene, 'sounds', idx, which === 'engine' ? 'Reset engine hum' : 'Reset music'));
  return true;
}
