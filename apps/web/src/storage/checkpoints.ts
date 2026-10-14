/**
 * Checkpoints (TASK-24): what the game saved for one profile at an act's start, so the owner reaches each act without
 * replaying the hours before it. `?checkpoint=<name>` loads one into the separate "Checkpoint" profile (made when it is
 * missing, then made the active one). The player's own profile is never written by a checkpoint.
 *
 * The files are `apps/web/public/checkpoints/<name>.json`, listed in `index.json`. `scripts/test-campaign.mjs` writes them
 * at each act's start; `scripts/test-checkpoints.mjs` loads each one and checks that it lands in its act.
 */
import { MAIN_PROFILE_ID, MAIN_PROFILE_NAME, REGISTRY_KEY, getRawStorage, type ProfileEntry, type ProfileRegistry } from './profile-storage';

export const CHECKPOINT_PROFILE_ID = 'checkpoint';
export const CHECKPOINT_PROFILE_NAME = 'Checkpoint';
export const CHECKPOINT_FORMAT = 'hm-checkpoint';
/** The container's version: a file from a newer build is refused with the reason; an older one is read as it is. */
export const CHECKPOINT_VERSION = 1;

/**
 * The save keys a checkpoint carries: the play state (the chain, the plot and the lab), the base world (the pack, the
 * bridge store and the machines), the beam, the props, and the radio logs. Device settings are not progress and are not carried.
 */
export const CHECKPOINT_KEYS: readonly string[] = ['hm.setmix.play', 'hm-base-v1', 'hm.setmix.beam', 'hm.setmix.props', 'hm.player.v1'];
const LOG_PREFIX = 'fidelity.radio-log.';

/** Whether a (un-prefixed) save key belongs in a checkpoint. */
export const isCheckpointKey = (key: string): boolean => CHECKPOINT_KEYS.includes(key) || key.startsWith(LOG_PREFIX);

export interface CheckpointExpect {
  /** The screen the game is on when the checkpoint is taken ('lab', 'planet', ...), or null when the file does not say. */
  readonly where: string | null;
  /** The chain's current step when the checkpoint is taken (null after the last step). */
  readonly step: string | null;
}

export interface Checkpoint {
  readonly format: typeof CHECKPOINT_FORMAT;
  readonly v: number;
  readonly name: string;
  readonly title: string;
  readonly act: string;
  readonly expect: CheckpointExpect;
  readonly keys: Readonly<Record<string, string>>;
}

export interface CheckpointEntry {
  readonly name: string;
  readonly title: string;
  readonly act: string;
}

export type ParsedCheckpoint = { readonly ok: true; readonly checkpoint: Checkpoint } | { readonly ok: false; readonly why: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Reads a checkpoint file. A file that is not one, is from a newer build, or holds an unknown key is refused with the reason. */
export function parseCheckpoint(text: string): ParsedCheckpoint {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, why: 'the file is not JSON, so it cannot be read' };
  }
  if (!isObj(raw) || raw['format'] !== CHECKPOINT_FORMAT) return { ok: false, why: 'the file is not a FIDELITY checkpoint' };
  const v = raw['v'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, why: 'the checkpoint has no format version' };
  if (v > CHECKPOINT_VERSION) return { ok: false, why: `it was saved by a newer build (format ${v}); this build reads format ${CHECKPOINT_VERSION}` };
  const keys = raw['keys'];
  if (!isObj(keys)) return { ok: false, why: 'the checkpoint holds no save keys' };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(keys)) {
    if (!isCheckpointKey(key)) return { ok: false, why: `it holds an unknown save key (${key})` };
    if (typeof value !== 'string') return { ok: false, why: `the save key ${key} is not text` };
    out[key] = value;
  }
  if (out['hm.setmix.play'] === undefined) return { ok: false, why: 'it holds no play state (hm.setmix.play)' };
  const ex = isObj(raw['expect']) ? raw['expect'] : {};
  const expect: CheckpointExpect = {
    where: typeof ex['where'] === 'string' ? ex['where'] : null,
    step: typeof ex['step'] === 'string' ? ex['step'] : null,
  };
  return {
    ok: true,
    checkpoint: {
      format: CHECKPOINT_FORMAT,
      v,
      name: typeof raw['name'] === 'string' ? raw['name'] : '',
      title: typeof raw['title'] === 'string' ? raw['title'] : '',
      act: typeof raw['act'] === 'string' ? raw['act'] : '',
      expect,
      keys: out,
    },
  };
}

/** The registry as the storage holds it (the same shape profile-storage reads), or the default with Main alone. */
function registryIn(storage: Storage): ProfileRegistry {
  const fallback: ProfileRegistry = { v: 1, active: MAIN_PROFILE_ID, list: [{ id: MAIN_PROFILE_ID, name: MAIN_PROFILE_NAME, createdAt: 0, lastUsed: 0 }] };
  try {
    const parsed = JSON.parse(storage.getItem(REGISTRY_KEY) ?? 'null') as Partial<ProfileRegistry> | null;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.list)) {
      const list = parsed.list.filter((p): p is ProfileEntry => !!p && typeof p.id === 'string' && typeof p.name === 'string');
      const withMain = list.some((p) => p.id === MAIN_PROFILE_ID) ? list : [fallback.list[0]!, ...list];
      const active = withMain.some((p) => p.id === parsed.active) ? (parsed.active as string) : MAIN_PROFILE_ID;
      return { v: 1, active, list: withMain };
    }
  } catch {
    // a damaged registry: the default
  }
  return fallback;
}

/**
 * Loads a checkpoint into the Checkpoint profile: its save keys are replaced (its device settings are kept), the profile is
 * created when missing, and it becomes the active one. Nothing under another profile is written.
 */
export function applyCheckpoint(storage: Storage, cp: Checkpoint, now: number): void {
  const prefix = `hm.p.${CHECKPOINT_PROFILE_ID}.`;
  const stale: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(prefix) && isCheckpointKey(k.slice(prefix.length))) stale.push(k);
  }
  for (const k of stale) storage.removeItem(k);
  for (const [key, value] of Object.entries(cp.keys)) storage.setItem(prefix + key, value);
  const reg = registryIn(storage);
  const has = reg.list.some((p) => p.id === CHECKPOINT_PROFILE_ID);
  const list = has
    ? reg.list.map((p) => (p.id === CHECKPOINT_PROFILE_ID ? { ...p, lastUsed: now } : p))
    : [...reg.list, { id: CHECKPOINT_PROFILE_ID, name: CHECKPOINT_PROFILE_NAME, createdAt: now, lastUsed: now }];
  storage.setItem(REGISTRY_KEY, JSON.stringify({ v: 1, active: CHECKPOINT_PROFILE_ID, list }));
}

/** The loading overlay: the shell's own "switching profile" box with its bar, drawn before React mounts. */
function showBar(title: string, line: string): { readonly done: () => void; readonly say: (text: string) => void; readonly button: (label: string, onClick: () => void) => void } {
  const overlay = document.createElement('div');
  overlay.className = 'shell-layer profile-switching-overlay';
  overlay.style.zIndex = '10000';
  overlay.innerHTML = `<div class="profile-switching-box"><h3></h3><p class="hint"></p><div class="profile-loading-bar"><div class="profile-loading-fill"></div></div></div>`;
  overlay.querySelector('h3')!.textContent = title;
  overlay.querySelector('p')!.textContent = line;
  document.body.appendChild(overlay);
  return {
    done: () => overlay.remove(),
    say: (text) => { overlay.querySelector('p')!.textContent = text; },
    button: (label, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => { overlay.remove(); onClick(); });
      overlay.querySelector('.profile-switching-box')!.appendChild(b);
    },
  };
}

const APPLIED_KEY = 'hm.checkpoint.applied';

/**
 * Boot step (before the game mounts): applies `?checkpoint=<name>` to the Checkpoint profile, behind the loading bar. The
 * same name is applied once per tab (a reload keeps the progress made in the checkpoint). A file that cannot be read says
 * why, and its button carries on with the player's own profile (which is not touched).
 */
export async function loadCheckpointFromUrl(win: Window = window): Promise<'none' | 'loaded' | 'kept' | 'refused'> {
  const name = new URLSearchParams(win.location.search).get('checkpoint');
  if (name === null) return 'none';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return 'none';
  let applied: string | null = null;
  try { applied = win.sessionStorage.getItem(APPLIED_KEY); } catch { /* sessionStorage blocked: apply every time */ }
  const storage = getRawStorage();
  if (!storage) return 'none';
  if (applied === name && registryIn(storage).active === CHECKPOINT_PROFILE_ID) return 'kept';
  const bar = showBar(`Loading checkpoint ${name}`, 'Reading the save');
  try {
    const res = await win.fetch(new URL(`checkpoints/${name}.json`, win.document.baseURI));
    if (!res.ok) throw new Error(`no checkpoint named ${name} (HTTP ${res.status})`);
    const parsed = parseCheckpoint(await res.text());
    if (!parsed.ok) throw new Error(parsed.why);
    bar.say(`Writing ${parsed.checkpoint.title || name} to the Checkpoint profile`);
    applyCheckpoint(storage, parsed.checkpoint, Date.now());
    try { win.sessionStorage.setItem(APPLIED_KEY, name); } catch { /* ignore */ }
    bar.done();
    return 'loaded';
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    bar.say(`The checkpoint did not load: ${why}. Your own profile was not touched.`);
    return await new Promise((resolve) => {
      bar.button('Carry on with my profile', () => resolve('refused'));
    });
  }
}
