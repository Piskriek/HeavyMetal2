import { IslandRegistry, TEMPLATES, type IslandMeta } from '@hm/islands';

/**
 * My Islands, stored. The registry (names, branches, last visited, undo) lives under one key; each island that has been edited has its map bundle under
 * its own key. A template instance that was never edited has NO bundle: it is rebuilt from its template on open, and the first edit forks it
 * (copy-on-write) into a new island of the player's own, which becomes the default.
 */
const REGISTRY_KEY = 'hm.islands.v1';
export const bundleKey = (id: string): string => `hm.island.${id}`;

let registry: IslandRegistry | null = null;
let activeId: string | null = null;
const listeners = new Set<() => void>();
const forkListeners = new Set<(meta: IslandMeta) => void>();

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string): boolean => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

function save(): void { if (registry) write(REGISTRY_KEY, JSON.stringify(registry.toJSON())); listeners.forEach((l) => l()); }

export function islands(): IslandRegistry {
  if (registry) return registry;
  const raw = read(REGISTRY_KEY);
  let r = IslandRegistry.fromJSON(raw ? safeParse(raw) : null);
  if (r.list().length === 0) r = r.create('My Island', 'blank-island', Date.now());
  registry = r;
  activeId = r.defaultId();
  return r;
}
function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

export const subscribe = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const onFork = (cb: (meta: IslandMeta) => void): (() => void) => { forkListeners.add(cb); return () => { forkListeners.delete(cb); }; };
export const activeIslandId = (): string | null => { islands(); return activeId; };
export const activeIsland = (): IslandMeta | null => { const r = islands(); return activeId ? r.get(activeId) ?? null : null; };
export const hasBundle = (id: string): boolean => read(bundleKey(id)) !== null;
export const readBundle = (id: string): string | null => read(bundleKey(id));

/** Make an island the one being played / edited; it moves to the top of the list. */
export function openIsland(id: string): IslandMeta | null {
  const r = islands();
  if (!r.get(id)) return null;
  registry = r.visit(id, Date.now());
  activeId = id;
  save();
  return registry.get(id) ?? null;
}

/** Called with the serialised map after every edit. Forks a template instance on the first edit. Returns where the bundle went. */
export function persistActive(json: string): { key: string; forked: IslandMeta | null; ok: boolean } {
  const r = islands();
  const id = activeId;
  if (!id) return { key: bundleKey('orphan'), forked: null, ok: write(bundleKey('orphan'), json) };
  try {
    const res = r.forkOnEdit(id, Date.now());
    registry = res.registry.recordEdit(res.id, Date.now(), json.length);
    activeId = res.id;
    const ok = write(bundleKey(res.id), json);
    save();
    const meta = registry.get(res.id) ?? null;
    if (res.forked && meta) forkListeners.forEach((l) => l(meta));
    return { key: bundleKey(res.id), forked: res.forked ? meta : null, ok };
  } catch {
    return { key: bundleKey(id), forked: null, ok: write(bundleKey(id), json) };
  }
}

function apply(f: (r: IslandRegistry) => IslandRegistry): string | null {
  try { registry = f(islands()); if (!activeId || !registry.get(activeId)) activeId = registry.defaultId(); save(); return null; } catch (e) { return (e as { message?: string }).message ?? 'That did not work'; }
}
export const createIsland = (name: string, template: string): string | null => apply((r) => r.create(name, template, Date.now()));
export const renameIsland = (id: string, name: string): string | null => apply((r) => r.rename(id, name));
export const removeIsland = (id: string): string | null => apply((r) => r.remove(id, Date.now()));
export const undoIslands = (): string | null => apply((r) => r.undo());
export const redoIslands = (): string | null => apply((r) => r.redo());
export function duplicateIsland(id: string): string | null {
  const err = apply((r) => r.duplicate(id, Date.now()));
  if (err) return err;
  const copy = islands().list().find((m) => m.forkOf === id && !hasBundle(m.id));
  const src = readBundle(id);
  if (copy && src) write(bundleKey(copy.id), src);
  return null;
}
export const templates = TEMPLATES;
/** For tests and the e2e tour: forget everything. */
export function resetIslands(): void { registry = null; activeId = null; }
