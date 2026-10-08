/**
 * Storage profiles (TASK-09): each profile is a storage namespace.
 * - Registry lives in global localStorage key `hm.profiles`: { v: 1, active, list: [{ id, name, createdAt, lastUsed }] }
 * - "Main" (id `main`) keeps legacy un-prefixed keys (e.g. `hm.profile.v2`, `hm.setmix.play`, `hm.settings`)
 *   and the legacy IndexedDB database `hm-store`.
 * - Other profiles prefix every key with `hm.p.<id>.` and use IndexedDB database `hm-store.<id>`.
 * - Replaces direct localStorage calls for game data across the app.
 */

export interface ProfileEntry {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly lastUsed: number;
}

export interface ProfileRegistry {
  readonly v: 1;
  readonly active: string;
  readonly list: readonly ProfileEntry[];
}

export const REGISTRY_KEY = 'hm.profiles';
export const MAIN_PROFILE_ID = 'main';
export const MAIN_PROFILE_NAME = 'Main';
export const MAIN_DB_NAME = 'hm-store';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/** Provides safe access to the underlying raw storage (for big-store init and migration). */
export function getRawStorage(): Storage | null {
  return getStorage();
}

function defaultRegistry(): ProfileRegistry {
  const now = Date.now();
  return {
    v: 1,
    active: MAIN_PROFILE_ID,
    list: [{
      id: MAIN_PROFILE_ID,
      name: MAIN_PROFILE_NAME,
      createdAt: now,
      lastUsed: now,
    }],
  };
}

export function readRegistry(): ProfileRegistry {
  const s = getStorage();
  if (!s) return defaultRegistry();
  try {
    const raw = s.getItem(REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfileRegistry>;
      if (parsed && parsed.v === 1 && Array.isArray(parsed.list) && parsed.list.length > 0) {
        let list = parsed.list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') as ProfileEntry[];
        if (!list.some((p) => p.id === MAIN_PROFILE_ID)) {
          list = [{ id: MAIN_PROFILE_ID, name: MAIN_PROFILE_NAME, createdAt: 0, lastUsed: 0 }, ...list];
        }
        const active = list.some((p) => p.id === parsed.active) ? (parsed.active as string) : MAIN_PROFILE_ID;
        return { v: 1, active, list };
      }
    }
  } catch {
    // corrupted or unavailable: fall back to default
  }
  const init = defaultRegistry();
  try { s.setItem(REGISTRY_KEY, JSON.stringify(init)); } catch { /* ignore */ }
  return init;
}

export function writeRegistry(r: ProfileRegistry): void {
  const s = getStorage();
  if (!s) return;
  try { s.setItem(REGISTRY_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

/** Returns the active profile entry. */
export function activeProfile(): ProfileEntry {
  const reg = readRegistry();
  return reg.list.find((p) => p.id === reg.active) ?? reg.list.find((p) => p.id === MAIN_PROFILE_ID) ?? {
    id: MAIN_PROFILE_ID,
    name: MAIN_PROFILE_NAME,
    createdAt: 0,
    lastUsed: 0,
  };
}

/** Returns the list of all profiles. */
export function listProfiles(): ProfileEntry[] {
  return [...readRegistry().list];
}

/**
 * Transforms a logical game key into its storage key based on the profile id.
 * - 'main' uses un-prefixed keys (e.g. 'hm.setmix.play')
 * - other profiles use 'hm.p.<id>.<key>'
 * - 'hm.profiles' registry itself is always global and never prefixed.
 */
export function toStorageKey(key: string, id: string = activeProfile().id): string {
  if (key === REGISTRY_KEY) return REGISTRY_KEY;
  return id === MAIN_PROFILE_ID ? key : `hm.p.${id}.${key}`;
}

/** Names the IndexedDB database for a profile ('hm-store' for main, 'hm-store.<id>' for others). */
export function bigStoreName(id: string = activeProfile().id): string {
  return id === MAIN_PROFILE_ID ? MAIN_DB_NAME : `${MAIN_DB_NAME}.${id}`;
}

/**
 * Creates a new profile.
 * Copies device settings (quality, fps target, graphics tuning, GPU choice, controls) from the currently active profile.
 */
export function createProfile(name: string): ProfileEntry {
  const reg = readRegistry();
  const trimmed = name.trim() || 'Profile';
  const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const entry: ProfileEntry = { id, name: trimmed, createdAt: now, lastUsed: now };

  const currentActive = reg.active;
  const s = getStorage();

  // Copy device settings from active profile to the new profile
  if (s) {
    try {
      const currentProfileRaw = s.getItem(toStorageKey('hm.profile.v2', currentActive));
      if (currentProfileRaw) {
        const p = JSON.parse(currentProfileRaw) as Record<string, unknown>;
        const deviceSettings: Record<string, unknown> = {
          quality: p.quality,
          fpsTarget: p.fpsTarget,
          graphics: p.graphics,
          gpu: p.gpu,
          controls: p.controls,
        };
        s.setItem(toStorageKey('hm.profile.v2', id), JSON.stringify(deviceSettings));
      }
    } catch { /* ignore */ }

    try {
      const currentSettingsRaw = s.getItem(toStorageKey('hm.settings', currentActive));
      if (currentSettingsRaw) {
        s.setItem(toStorageKey('hm.settings', id), currentSettingsRaw);
      }
    } catch { /* ignore */ }
  }

  writeRegistry({
    v: 1,
    active: reg.active,
    list: [...reg.list, entry],
  });

  return entry;
}

/** Renames a profile. Main can be renamed if desired, or any other profile. */
export function renameProfile(id: string, name: string): void {
  const reg = readRegistry();
  const trimmed = name.trim();
  if (!trimmed) return;
  const nextList = reg.list.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
  writeRegistry({ ...reg, list: nextList });
}

/**
 * Sets the active profile and reloads the page.
 */
export function switchProfile(id: string): void {
  const reg = readRegistry();
  if (!reg.list.some((p) => p.id === id)) return;
  const now = Date.now();
  const nextList = reg.list.map((p) => (p.id === id ? { ...p, lastUsed: now } : p));
  writeRegistry({ v: 1, active: id, list: nextList });
  if (typeof window !== 'undefined' && window.location?.reload) {
    window.location.reload();
  }
}

/**
 * Deletes a profile by id.
 * - Main cannot be deleted.
 * - Removes every localStorage key starting with `hm.p.<id>.`.
 * - Deletes the IndexedDB database `hm-store.<id>`.
 * - If deleting active profile, switches to Main first.
 */
export function deleteProfile(id: string): boolean {
  if (id === MAIN_PROFILE_ID) return false;
  const reg = readRegistry();
  if (!reg.list.some((p) => p.id === id)) return false;

  let nextActive = reg.active;
  const wasActive = reg.active === id;
  if (wasActive) {
    nextActive = MAIN_PROFILE_ID;
  }

  const nextList = reg.list
    .filter((p) => p.id !== id)
    .map((p) => (p.id === nextActive ? { ...p, lastUsed: Date.now() } : p));
  writeRegistry({ v: 1, active: nextActive, list: nextList });

  const s = getStorage();
  if (s) {
    const prefix = `hm.p.${id}.`;
    const toRemove: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) {
      try { s.removeItem(k); } catch { /* ignore */ }
    }
  }

  if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
    try {
      indexedDB.deleteDatabase(bigStoreName(id));
    } catch { /* ignore */ }
  }

  if (wasActive && typeof window !== 'undefined' && window.location?.reload) {
    window.location.reload();
  }

  return true;
}

/**
 * Key-value storage wrapper applying the active profile namespace.
 * Replaces direct `localStorage` calls across apps/web/src.
 */
export const kv = {
  get(key: string): string | null {
    const s = getStorage();
    if (!s) return null;
    try { return s.getItem(toStorageKey(key)); } catch { return null; }
  },
  set(key: string, value: string): void {
    const s = getStorage();
    if (!s) return;
    try { s.setItem(toStorageKey(key), value); } catch { /* storage full or blocked */ }
  },
  remove(key: string): void {
    const s = getStorage();
    if (!s) return;
    try { s.removeItem(toStorageKey(key)); } catch { /* ignore */ }
  },
  has(key: string): boolean {
    return this.get(key) !== null;
  },
};
