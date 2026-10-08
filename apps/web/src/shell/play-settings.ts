import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '@hm/screens';
import { audio, setSoundEnabled } from '../maker/feedback';

/**
 * Sound and racing settings (volumes, touch controls, the minimap, steering, reduced motion): one copy for the whole game, edited in Settings
 * wherever it is opened (SetMix, Goblin Racing, the island, a paused race). Graphics live in the profile, not here.
 */
import { kv } from '../storage/profile-storage';

const KEY = 'hm.settings';
const listeners = new Set<() => void>();

function read(): Settings {
  try { const raw = JSON.parse(kv.get(KEY) ?? 'null') as Partial<Settings> | null; return { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) }; } catch { return DEFAULT_SETTINGS; }
}
let current: Settings = read();

/** Turn the volumes up or down in the sound engine (it only exists once the page has had a click). */
export function applySound(s: Settings = current): void {
  audio()?.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
  setSoundEnabled(s.master > 0);
}

// the sound engine starts on the first click anywhere: give it the saved volumes then, wherever that click is (home, island, race)
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => applySound(), { once: true, capture: true });

export const playSettings = (): Settings => current;
export function setPlaySettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try { kv.set(KEY, JSON.stringify(current)); } catch { /* storage blocked: still applies for this visit */ }
  applySound();
  listeners.forEach((l) => l());
}
export function resetPlaySettings(): void { setPlaySettings({ ...DEFAULT_SETTINGS }); }

const subscribe = (l: () => void): (() => void) => { listeners.add(l); return () => listeners.delete(l); };
export function usePlaySettings(): Settings { return useSyncExternalStore(subscribe, playSettings, playSettings); }
