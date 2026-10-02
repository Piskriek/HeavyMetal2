import { CloudBackedStorage, installLocalStorage } from './storage-shim';

/**
 * Where the game runs. In a plain browser nothing changes. Inside RUN.world there is no `localStorage` in the game iframe,
 * so a stand-in backed by the player's cloud `appStorage` is installed BEFORE anything reads a save: the maps, settings and
 * "seen help" flags then keep working unchanged (and follow the player across devices).
 * The SDK is only imported in a RUN build (`vite build --mode run`); a plain build never carries it.
 */

export type PlatformKind = 'browser' | 'run';

interface RunApi {
  getProfile(): { id: string; username: string; avatarUrl?: string | null; isAnonymous?: boolean };
  appStorage: { getAllData(): Promise<Record<string, string>>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void>; clear(): Promise<void> };
  initializeAsync?: () => Promise<unknown>;
}

let kind: PlatformKind = 'browser';
let bootError: string | null = null;
let api: RunApi | null = null;

export const platformKind = (): PlatformKind => kind;
export const platformBootError = (): string | null => bootError;
export const playerName = (): string => { try { return api?.getProfile().username ?? 'Guest Goblin'; } catch { return 'Guest Goblin'; } };

async function waitForProfile(sdk: RunApi, timeoutMs = 10000): Promise<void> {
  try { await sdk.initializeAsync?.(); } catch { /* deprecated on newer SDKs; the poll below decides */ }
  const t0 = Date.now();
  for (;;) {
    try { sdk.getProfile(); return; } catch { /* the host has not answered yet */ }
    if (Date.now() - t0 > timeoutMs) throw new Error('RUN.world did not answer the SDK handshake');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Never throws: a failed RUN boot leaves the game running as a plain browser game. */
export async function bootPlatform(): Promise<PlatformKind> {
  if ((import.meta as unknown as { env?: Record<string, string> }).env?.['VITE_RUN'] !== '1' || typeof window === 'undefined') return kind;
  try {
    const mod = await import('@series-inc/rundot-game-sdk/api');
    const sdk = ((mod as { default?: unknown }).default ?? mod) as RunApi;
    await waitForProfile(sdk);
    const data = await sdk.appStorage.getAllData().catch(() => ({} as Record<string, string>));
    const cloud = new CloudBackedStorage(sdk.appStorage, data, (f) => console.warn('[platform] cloud save failed', f.op, f.key, f.error));
    if (!installLocalStorage(window, cloud)) throw new Error('could not install the cloud save store');
    api = sdk;
    kind = 'run';
  } catch (err) {
    bootError = err instanceof Error ? err.message : String(err);
    console.error('[platform] RUN.world boot failed; running as a plain browser game', err);
  }
  return kind;
}
