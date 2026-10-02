import type { Preset, PresetBundle, PresetId, Value } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { MakerScene } from './scene';

const KEY = 'hm.map.v1';

const isRef = (v: Value | undefined): v is { ref: string } => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { ref?: unknown }).ref === 'string';

/** Save the map: the scene bundle plus everything its params reference (track, camera, materials). */
export function saveMap(rt: Runtime, sceneId: PresetId): boolean {
  try {
    const bundle = rt.store.exportBundle(sceneId);
    const have = new Set(bundle.presets.map((p) => `${p.id}@${p.revision}`));
    const extra: Preset[] = [];
    for (const p of bundle.presets) {
      for (const v of Object.values(p.params)) {
        if (!isRef(v)) continue;
        const target = rt.store.get(v.ref);
        if (target && !have.has(`${target.id}@${target.revision}`)) { have.add(`${target.id}@${target.revision}`); extra.push(target); }
      }
    }
    const merged: PresetBundle = { ...bundle, presets: [...bundle.presets, ...extra] };
    localStorage.setItem(KEY, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
}

export function hasSavedMap(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}

export function clearSavedMap(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Import the saved map into the runtime and bind its scene. Returns the scene description, or null when there is none. */
export function loadMap(rt: Runtime): MakerScene | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const bundle = JSON.parse(raw) as PresetBundle;
    rt.store.importBundle(bundle, { onConflict: 'keep' });
    const scene = rt.store.get(bundle.root);
    if (!scene) return null;
    rt.loadScene(scene.id);
    const terrain = scene.children['terrain']?.[0]?.ref;
    const tref = scene.params['track'];
    const track = isRef(tref) ? tref.ref : undefined;
    if (!terrain || !track) return null;
    const materialIds = new Map<string, PresetId>();
    for (const m of rt.store.list({ kind: 'material' })) materialIds.set(m.name, m.id);
    return { sceneId: scene.id, terrainId: terrain, trackId: track, materialIds };
  } catch {
    return null;
  }
}
