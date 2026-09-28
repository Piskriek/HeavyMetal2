/**
 * PLATFORM: where the game is running, and what that host gives it.
 *
 *  - **browser**: the game on its own (dev server, a static deploy). `localStorage`, a local guest
 *    player, the browser's own fullscreen. Online racing is not available here.
 *  - **run**: inside RUN.world (a build made with `VITE_RUN=1`, see docs/RUN_LAUNCH_PLAN.md). The SDK
 *    signs the player in and hands us their identity; `localStorage` does not exist in the game iframe,
 *    so a stand-in backed by the player's cloud `appStorage` takes its place before the game reads any
 *    save; fullscreen goes through the host.
 *
 * `bootPlatform()` runs once in main.tsx before the app module is even loaded, so no save is read
 * before its storage exists. The SDK is only imported in a RUN build: a plain build never loads it.
 */
import { CloudBackedStorage, installLocalStorage, type WriteFailure } from './storage-shim';

export type PlatformKind = 'browser' | 'run';

export interface PlayerIdentity {
  /** Stable id: RUN's profile id, or a generated local id kept on this device. */
  id: string;
  /** What to show: RUN's username, or the local name the player picked. */
  name: string;
  source: PlatformKind;
  /** RUN guest (not signed in), or any local player. Online play needs a signed-in RUN player. */
  anonymous: boolean;
  avatarUrl?: string | null;
}

/** The slice of the RUN SDK the game uses (typed loosely: the SDK is optional in a plain build). */
export interface RunApi {
  getProfile(): { id: string; username: string; avatarUrl?: string | null; isAnonymous?: boolean };
  appStorage: { getAllData(): Promise<Record<string, string>>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void>; clear(): Promise<void> };
  system: { requestFullscreen(): Promise<unknown>; exitFullscreen(): Promise<unknown> };
  realtime?: unknown;
  initializeAsync?: () => Promise<unknown>;
}

export const RUN_BUILD: boolean = (() => {
  try { return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RUN === '1'; } catch { return false; }
})();

export const LOCAL_PLAYER_KEY = 'hm2-local-player-v1';

interface PlatformState {
  kind: PlatformKind;
  api: RunApi | null;
  storageFailures: WriteFailure[];
  bootError: string | null;
}

const state: PlatformState = { kind: 'browser', api: null, storageFailures: [], bootError: null };

export const platformKind = (): PlatformKind => state.kind;
export const isRunHosted = (): boolean => state.kind === 'run';
/** The RUN SDK once booted (null in a plain browser build). */
export const runApi = (): RunApi | null => state.api;
/** Why a RUN build fell back to browser mode, if it did. */
export const platformBootError = (): string | null => state.bootError;
export const storageWriteFailures = (): readonly WriteFailure[] => state.storageFailures;

/** Waits for the SDK handshake: `getProfile()` throws until the host has answered. */
async function waitForProfile(api: RunApi, timeoutMs = 10000): Promise<void> {
  try { await api.initializeAsync?.(); } catch { /* deprecated on newer SDKs; the poll below decides */ }
  const t0 = Date.now();
  for (;;) {
    try { api.getProfile(); return; } catch { /* not yet */ }
    if (Date.now() - t0 > timeoutMs) throw new Error('RUN.world did not answer the SDK handshake');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Boots the host integration. Never throws: a failed RUN boot leaves the game in browser mode. */
export async function bootPlatform(): Promise<PlatformKind> {
  // Spelled out here (not via RUN_BUILD) so a plain build folds it to `return` and drops the SDK.
  if ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RUN !== '1' || typeof window === 'undefined') return state.kind;
  try {
    const mod = await import('@series-inc/rundot-game-sdk/api');
    const api = ((mod as { default?: unknown }).default ?? mod) as RunApi;
    await waitForProfile(api);
    const data = await api.appStorage.getAllData().catch(() => ({} as Record<string, string>));
    const cloud = new CloudBackedStorage(api.appStorage, data, (f) => {
      state.storageFailures.push(f);
      if (state.storageFailures.length > 50) state.storageFailures.shift();
      console.warn('[platform] cloud save failed', f.op, f.key, f.error);
    });
    if (!installLocalStorage(window, cloud)) throw new Error('could not install the cloud save store');
    state.api = api;
    state.kind = 'run';
  } catch (err) {
    state.bootError = err instanceof Error ? err.message : String(err);
    console.error('[platform] RUN.world boot failed; running as a plain browser game', err);
  }
  return state.kind;
}

/* ───────────── identity ───────────── */

interface LocalPlayer { id: string; name: string }

function readLocalPlayer(): LocalPlayer {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_PLAYER_KEY) ?? 'null') as Partial<LocalPlayer> | null;
    if (saved && typeof saved.id === 'string' && typeof saved.name === 'string') return { id: saved.id, name: saved.name };
  } catch { /* first run, or storage blocked */ }
  const id = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const player = { id, name: 'Guest Goblin' };
  try { localStorage.setItem(LOCAL_PLAYER_KEY, JSON.stringify(player)); } catch { /* this session only */ }
  return player;
}

/** Who is playing. On RUN the name is the platform username (players change it there). */
export function currentPlayer(): PlayerIdentity {
  const api = state.api;
  if (state.kind === 'run' && api) {
    try {
      const p = api.getProfile();
      return { id: p.id, name: p.username, source: 'run', anonymous: p.isAnonymous === true, avatarUrl: p.avatarUrl ?? null };
    } catch { /* fall through to the local player */ }
  }
  const local = readLocalPlayer();
  return { id: local.id, name: local.name, source: 'browser', anonymous: true };
}

/** Renames the local player (browser mode only: a RUN username belongs to the platform). */
export function renameLocalPlayer(name: string): boolean {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!clean || state.kind === 'run') return false;
  const player = { ...readLocalPlayer(), name: clean };
  try { localStorage.setItem(LOCAL_PLAYER_KEY, JSON.stringify(player)); return true; } catch { return false; }
}

/* ───────────── fullscreen ───────────── */

let hostFullscreen = false;

/** Toggles fullscreen the host's way: RUN's own (the iframe may not), else the element's. */
export async function toggleFullscreen(element: HTMLElement | null): Promise<boolean> {
  const api = state.api;
  if (state.kind === 'run' && api) {
    // The iframe never sees the host's fullscreen in document.fullscreenElement: keep our own flag.
    try {
      if (hostFullscreen) await api.system.exitFullscreen();
      else await api.system.requestFullscreen();
      hostFullscreen = !hostFullscreen;
      return true;
    } catch { return false; }
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (element?.requestFullscreen) await element.requestFullscreen();
    else return false;
    return true;
  } catch { return false; }
}
