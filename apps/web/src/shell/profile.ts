/**
 * The player profile that the shell keeps (credits, grown-up switch, tutorial progress, tournament sign-up, activities the player made).
 * Stored through localStorage, which the RUN platform shim backs with cloud storage. Never throws: a failed read gives the defaults.
 */
export interface ActivityRow { id: string; name: string; doc: string; builtin: boolean; hidden: boolean; hue: number; size: number; ring: boolean; forkOf: string | null }
export interface Profile {
  readonly name: string;
  readonly credits: number;
  /** Build mode is for adults: off by default, switched on in Settings. */
  readonly grownUp: boolean;
  readonly tutorialDone: boolean;
  readonly skin: 'flat' | 'pbr';
  readonly signedUp: boolean;
  readonly strikes: number;
  readonly activities: readonly ActivityRow[];
}

const KEY = 'hm.profile.v1';
export const GOBLIN_RACING: ActivityRow = { id: 'goblin-racing', name: 'Goblin Racing', doc: 'Goblin balls race round the island. Quick races, weekly tournaments, spectating, rankings and a bookie.', builtin: true, hidden: false, hue: 0.08, size: 1.25, ring: true, forkOf: null };
export const DEFAULT_PROFILE: Profile = { name: 'Goblin', credits: 500, grownUp: true, tutorialDone: false, skin: 'flat', signedUp: false, strikes: 0, activities: [GOBLIN_RACING] };

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE;
    const acts = Array.isArray(raw.activities) ? raw.activities.filter((a) => a && typeof a.id === 'string') : [];
    if (!acts.some((a) => a.id === GOBLIN_RACING.id)) acts.unshift(GOBLIN_RACING);
    return { ...DEFAULT_PROFILE, ...raw, activities: acts } as Profile;
  } catch { return DEFAULT_PROFILE; }
}
export function saveProfile(p: Profile): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

const hash = (s: string): number => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';

/** "Create new": a unique id, a planet look from the name. */
export function createActivity(p: Profile, name: string, doc = 'A new activity.'): Profile {
  let id = slug(name), n = 2;
  while (p.activities.some((a) => a.id === id)) id = `${slug(name)}-${n++}`;
  const row: ActivityRow = { id, name: name.trim() || 'New activity', doc, builtin: false, hidden: false, hue: hash(name), size: 0.8 + hash(name + 's') * 0.6, ring: hash(name + 'r') > 0.6, forkOf: null };
  return { ...p, activities: [...p.activities, row] };
}
export function duplicateActivity(p: Profile, id: string): Profile {
  const src = p.activities.find((a) => a.id === id);
  if (!src) return p;
  const copy = createActivity(p, `Copy of ${src.name}`, src.doc).activities.at(-1)!;
  return { ...p, activities: [...p.activities, { ...copy, hue: src.hue, size: src.size, ring: src.ring, forkOf: src.id }] };
}
/** Built-in activities are hidden, never deleted; the player's own are removed. */
export function removeActivity(p: Profile, id: string): Profile {
  const a = p.activities.find((x) => x.id === id);
  if (!a) return p;
  return a.builtin ? { ...p, activities: p.activities.map((x) => (x.id === id ? { ...x, hidden: true } : x)) } : { ...p, activities: p.activities.filter((x) => x.id !== id) };
}
export const unhideAll = (p: Profile): Profile => ({ ...p, activities: p.activities.map((a) => ({ ...a, hidden: false })) });
