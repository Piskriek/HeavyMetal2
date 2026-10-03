import type { Preset, PresetBundle, PresetId, Value } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { MakerScene } from './scene';

import { activeIslandId, bundleKey, persistActive } from '../islands/island-store';

/**
 * Which map the editor, the island and the race read and write. By default it is the active island (see island-store: the first edit of a template
 * forks it). The racing activity pins its own key so the racetrack never mixes with your island.
 */
let pinned: string | null = null;
export function pinMapKey(key: string | null): void { pinned = key; }
const currentKey = (): string => pinned ?? bundleKey(activeIslandId() ?? 'orphan');

/**
 * The map each runtime was loaded from. A save goes back there, never to whatever is pinned or active at the moment of saving: with the
 * Goblin Racing island and your own island both reachable from SetMix, a late (debounced) save must not land in the other one.
 */
const homeOf = new WeakMap<Runtime, { readonly pinned: string | null; readonly island: string | null }>();

const isRef = (v: Value | undefined): v is { ref: string } => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { ref?: unknown }).ref === 'string';

/** The map as one bundle: the scene plus everything its params reference (track, camera, materials). */
export function mapBundle(rt: Runtime, sceneId: PresetId): PresetBundle {
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
  return { ...bundle, presets: [...bundle.presets, ...extra] };
}

/** Save the map to the player's storage (the cloud save in RUN, localStorage elsewhere). */
export function saveMap(rt: Runtime, sceneId: PresetId): boolean {
  try {
    const home = homeOf.get(rt) ?? { pinned, island: activeIslandId() };
    // the runtime's own island is no longer the active one: skip rather than write into another island
    if (home.pinned === null && home.island !== activeIslandId()) return false;
    const json = JSON.stringify(mapBundle(rt, sceneId));
    if (home.pinned === null) {
      const ok = persistActive(json).ok;
      // the first edit of a template forks it into an island of your own: this runtime belongs to that one from now on
      homeOf.set(rt, { pinned: null, island: activeIslandId() });
      return ok;
    }
    localStorage.setItem(home.pinned, json);
    return true;
  } catch {
    return false;
  }
}

/* ---- share codes: "HM1." + base64url(gzip(bundle JSON)); paste one in chat, load it on another device ---- */

const CODE_PREFIX = 'HM1.';
const toB64 = (bytes: Uint8Array): string => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (text: string): Uint8Array => { const b = atob(text.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

export async function mapToCode(rt: Runtime, sceneId: PresetId): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(mapBundle(rt, sceneId)));
  return CODE_PREFIX + toB64(await pipe(json, new CompressionStream('gzip')));
}

/** Check a share code and make it the saved map. The caller reloads the maker afterwards. Returns an error sentence, or null on success. */
export async function useMapCode(code: string): Promise<string | null> {
  const text = code.trim();
  if (!text.startsWith(CODE_PREFIX)) return 'That does not look like a map code (it should start with HM1.).';
  try {
    const raw = await pipe(fromB64(text.slice(CODE_PREFIX.length)), new DecompressionStream('gzip'));
    const bundle = JSON.parse(new TextDecoder().decode(raw)) as PresetBundle;
    if (!bundle || typeof bundle.root !== 'string' || !Array.isArray(bundle.presets) || !bundle.presets.some((p) => p.id === bundle.root && p.kind === 'scene')) return 'The code is readable but it is not a map.';
    localStorage.setItem(currentKey(), JSON.stringify(bundle));
    return null;
  } catch {
    return 'The code is damaged or incomplete. Copy the whole line, including the start.';
  }
}

export function hasSavedMap(): boolean {
  try { return localStorage.getItem(currentKey()) !== null; } catch { return false; }
}

export function clearSavedMap(): void {
  try { localStorage.removeItem(currentKey()); } catch { /* ignore */ }
}

/** Import the saved map into the runtime and bind its scene. Returns the scene description, or null when there is none. */
export function loadMap(rt: Runtime): MakerScene | null {
  homeOf.set(rt, { pinned, island: activeIslandId() });
  try {
    const raw = localStorage.getItem(currentKey());
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
