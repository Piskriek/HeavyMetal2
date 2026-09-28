/**
 * MP-T06: the player's goblin crew, saved on this device until the meta server (MP-T07) exists.
 * A profile is a name, a title and the goblin's DNA (the DNA is the whole look). Invalid or
 * tampered DNA is never stored. `legacyProfiles` gives the four built-in riders a profile each, so
 * old saves keep their identities.
 */
import { decodeGoblinDna, encodeGoblinDna, generateRandomGoblin } from './goblin-dna';

export const PROFILES_KEY = 'hm2-goblin-profiles-v1';
export const MAX_PROFILES = 24;

export interface GoblinProfile { id: string; name: string; title: string; dna: string; nudged: number; createdAt: number }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

const storage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function validDna(dna: string): boolean {
  try { decodeGoblinDna(dna); return true; } catch { return false; }
}

export function listProfiles(store: StorageLike | null = storage()): GoblinProfile[] {
  try {
    const raw = store?.getItem(PROFILES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p): p is GoblinProfile => p && typeof p.name === 'string' && typeof p.dna === 'string' && validDna(p.dna)) : [];
  } catch { return []; }
}

/** Saves a goblin; refuses an empty name or bad DNA with a reason. Newest first, capped. */
export function saveProfile(input: { name: string; title: string; dna: string; nudged?: number }, store: StorageLike | null = storage(), now = Date.now()):
  { ok: true; profile: GoblinProfile } | { ok: false; reason: string } {
  const name = input.name.trim().slice(0, 24);
  if (!name) return { ok: false, reason: 'Every goblin needs a name.' };
  if (!validDna(input.dna)) return { ok: false, reason: 'That DNA is smudged: it fails its checksum.' };
  const profile: GoblinProfile = { id: `${now.toString(36)}-${name.toLowerCase().replace(/\W+/g, '-')}`, name, title: input.title.slice(0, 32), dna: input.dna.toUpperCase(), nudged: input.nudged ?? 0, createdAt: now };
  const list = [profile, ...listProfiles(store).filter((p) => p.name !== name)].slice(0, MAX_PROFILES);
  try { store?.setItem(PROFILES_KEY, JSON.stringify(list)); } catch { return { ok: false, reason: 'This device would not save the goblin.' }; }
  return { ok: true, profile };
}

/** The four built-in riders as profiles, with stable DNA from their names (old saves keep them). */
export function legacyProfiles(riders: readonly { id: string; name: string }[]): GoblinProfile[] {
  return riders.map((rider) => ({ id: `legacy-${rider.id}`, name: rider.name, title: 'Founding Rider', dna: encodeGoblinDna(generateRandomGoblin(rider.id)), nudged: 0, createdAt: 0 }));
}

/* ───────────── the racing goblin (Profile) ───────────── */

export const ACTIVE_PROFILE_KEY = 'hm2-active-goblin-v1';

/** The goblin you race as: the one picked in Profile, else the newest in the crew, else null. */
export function activeProfile(store: StorageLike | null = storage()): GoblinProfile | null {
  const crew = listProfiles(store);
  let id: string | null = null;
  try { id = store?.getItem(ACTIVE_PROFILE_KEY) ?? null; } catch { id = null; }
  return crew.find((p) => p.id === id) ?? crew[0] ?? null;
}

export function setActiveProfile(id: string, store: StorageLike | null = storage()): boolean {
  if (!listProfiles(store).some((p) => p.id === id)) return false;
  try { store?.setItem(ACTIVE_PROFILE_KEY, id); return true; } catch { return false; }
}

/** Renames a crew goblin in place (same id, same DNA). Names stay unique in the crew. */
export function renameProfile(id: string, name: string, store: StorageLike | null = storage()): { ok: true } | { ok: false; reason: string } {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!clean) return { ok: false, reason: 'Every goblin needs a name.' };
  const crew = listProfiles(store);
  if (!crew.some((p) => p.id === id)) return { ok: false, reason: 'That goblin is not in your crew.' };
  if (crew.some((p) => p.id !== id && p.name.toLowerCase() === clean.toLowerCase())) return { ok: false, reason: `${clean} is already in your crew.` };
  try { store?.setItem(PROFILES_KEY, JSON.stringify(crew.map((p) => (p.id === id ? { ...p, name: clean } : p)))); return { ok: true }; } catch { return { ok: false, reason: 'This device would not save the name.' }; }
}
