import { ActivityRegistry, Tournament, isActivityError, type Activity, type TournamentState } from '@hm/activities';

/**
 * The player profile the shell keeps: credits, the grown-up switch, tutorial progress, the skin, the activities (an ActivityRegistry) and the
 * current tournament (a Tournament state machine). Stored through localStorage, which the RUN platform shim backs with cloud storage.
 * Never throws: a failed read gives the defaults.
 */
export interface Profile {
  readonly name: string;
  readonly credits: number;
  /** Build mode is for adults: switched on in Settings. */
  readonly grownUp: boolean;
  readonly tutorialDone: boolean;
  readonly skin: 'flat' | 'pbr';
  readonly activities: readonly Activity[];
  readonly tournament: TournamentState | null;
}

const KEY = 'hm.profile.v2';
export const DEFAULT_PROFILE: Profile = { name: 'Goblin', credits: 500, grownUp: true, tutorialDone: false, skin: 'flat', activities: ActivityRegistry.withDefaults().all(), tournament: null };

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE;
    const reg = new ActivityRegistry(Array.isArray(raw.activities) ? (raw.activities as Activity[]) : []);
    const acts = reg.get('goblin-racing') ? reg.all() : ActivityRegistry.withDefaults().all().concat(reg.all());
    const t = raw.tournament ? Tournament.fromJSON(raw.tournament) : null;
    return { ...DEFAULT_PROFILE, ...raw, activities: acts, tournament: t ? t.toJSON() : null } as Profile;
  } catch { return DEFAULT_PROFILE; }
}
export function saveProfile(p: Profile): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

const registry = (p: Profile): ActivityRegistry => new ActivityRegistry([...p.activities]);
const apply = (p: Profile, f: (r: ActivityRegistry) => ActivityRegistry): Profile => {
  try { return { ...p, activities: f(registry(p)).all() }; } catch (e) { return isActivityError(e) ? p : p; }
};

export const createActivity = (p: Profile, name: string, doc = 'A new activity.'): Profile => apply(p, (r) => r.create(name, doc, p.name, Date.now()));
export const duplicateActivity = (p: Profile, id: string): Profile => apply(p, (r) => r.duplicate(id, p.name));
/** Built-in activities are hidden, never deleted; the player's own are removed. */
export const removeActivity = (p: Profile, id: string): Profile => apply(p, (r) => { const a = r.get(id); return a?.builtin ? r.hide(id) : r.remove(id); });
export const unhideAll = (p: Profile): Profile => apply(p, (r) => r.all().reduce((acc, a) => (a.hidden ? acc.unhide(a.id) : acc), r));

const SIM = ['Snaggle', 'Mudwick', 'Grizzle', 'Pip', 'Bogra', 'Nettle'];
const DAY = 86_400_000;
/** The weekly cup. Until the platform has a backend it fills with a simulated field so sign-up and no-show rules can be tried. */
export function currentTournament(p: Profile, now: number): Tournament {
  if (p.tournament) { const t = Tournament.fromJSON(p.tournament); if (t) return t; }
  let t = Tournament.create({ id: `basalt-cup-${Math.floor(now / (7 * DAY))}`, capacity: 16, heatSize: 8, advanceCount: 3, closesAt: now + 2 * DAY });
  SIM.forEach((n, i) => { t = t.signUp(n, now, 900 + i * 40); });
  return t;
}
export function withTournament(p: Profile, t: Tournament): Profile { return { ...p, tournament: t.toJSON() }; }
