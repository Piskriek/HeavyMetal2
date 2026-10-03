import { ActivityRegistry, Tournament, isActivityError, type Activity, type TournamentState } from '@hm/activities';
import { parseFpsTarget, type FpsTarget, type Quality } from '@hm/game';
import type { Params } from '@hm/contracts';
import { resolveGraphics, type ThreeRenderer } from '@hm/render';

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
  /** Graphics tier for the island and the editor; auto starts at the best the device can probably do and drops a tier if frames run slow. */
  readonly quality: 'auto' | 'low' | 'medium' | 'high' | 'ultra';
  /** What auto aims for: 15 fps (as pretty as the machine allows), 30, or 60 (as smooth as it can be). */
  readonly fpsTarget: FpsTarget;
  /** Your own changes to the graphics preset (`graphics` kind), used on top of whichever tier draws. Empty = the tiers as made. */
  readonly graphics: Params;
  /**
   * Which graphics chip to ask for on a machine with two (a laptop's built-in one and a faster one). Only a request: the browser and
   * Windows decide (Settings, System, Display, Graphics can set the browser to High performance for good). Read when a view opens.
   */
  readonly gpu: GpuChoice;
  readonly activities: readonly Activity[];
  readonly tournament: TournamentState | null;
  /** How the mouse and the view feel (Settings, Controls). */
  readonly controls: Controls;
}

/** Mouse and view settings: a preset like everything else (Settings shows it in the inspector). */
export interface Controls {
  /** 1 = as made; 2 turns twice as fast. */
  readonly sensitivity: number;
  readonly invertY: boolean;
  /** Field of view in first person, in degrees (third person and studio sit a little narrower). */
  readonly fov: number;
}
export const DEFAULT_CONTROLS: Controls = { sensitivity: 1, invertY: false, fov: 75 };
export function normalizeControls(v: unknown): Controls {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const n = (x: unknown, d: number, lo: number, hi: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
  return { sensitivity: n(o.sensitivity, 1, 0.05, 20), invertY: o.invertY === true, fov: n(o.fov, 75, 30, 120) };
}

export type GpuChoice = 'fast' | 'saver' | 'browser';
/** The WebGL request for a choice: the fast chip, the battery-saving one, or whatever the browser picks. */
export function powerPreferenceOf(choice: GpuChoice | undefined): 'high-performance' | 'low-power' | 'default' {
  return choice === 'saver' ? 'low-power' : choice === 'browser' ? 'default' : 'high-performance';
}

let gpuSeen: string | null = null;
/** Views note which chip the browser gave them, so Settings can say what is in use. */
export function noteGpu(name: string | null): void { if (name) gpuSeen = name; }
export const gpuInUse = (): string | null => gpuSeen;

let tierSeen: Quality | null = null;
/** Draw a tier with the player's own graphics changes on top, and note it so Settings can show what is drawing. */
export function showTier(renderer: ThreeRenderer, tier: Quality, own: Params): void {
  tierSeen = tier;
  renderer.setGraphics(resolveGraphics(tier, own));
}
export const tierInUse = (): Quality | null => tierSeen;

const KEY = 'hm.profile.v2';
export const DEFAULT_PROFILE: Profile = { name: 'Goblin', credits: 500, grownUp: true, tutorialDone: false, skin: 'flat', quality: 'auto', fpsTarget: 60, graphics: {}, gpu: 'fast', activities: ActivityRegistry.withDefaults().all(), tournament: null, controls: DEFAULT_CONTROLS };

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE;
    const reg = new ActivityRegistry(Array.isArray(raw.activities) ? (raw.activities as Activity[]) : []);
    const acts = reg.get('goblin-racing') ? reg.all() : ActivityRegistry.withDefaults().all().concat(reg.all());
    const t = raw.tournament ? Tournament.fromJSON(raw.tournament) : null;
    const gpu: GpuChoice = raw.gpu === 'saver' || raw.gpu === 'browser' ? raw.gpu : 'fast';
    const graphics = raw.graphics && typeof raw.graphics === 'object' && !Array.isArray(raw.graphics) ? raw.graphics : {};
    return { ...DEFAULT_PROFILE, ...raw, gpu, fpsTarget: parseFpsTarget(raw.fpsTarget), graphics, activities: acts, tournament: t ? t.toJSON() : null, controls: normalizeControls(raw.controls) } as Profile;
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
