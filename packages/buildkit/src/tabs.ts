/**
 * The build HUD's tabs. Each tab is a kind of thing you can hold: F1 to F10 switch tabs (F11 and F12 belong to the browser), each tab has nine
 * slots (keys 1 to 9) holding presets of that tab, and E opens the preset window for the tab. Pure data and functions.
 */
export type TabId = 'select' | 'paint' | 'sculpt' | 'animate' | 'sound' | 'lights' | 'activities' | 'avatar' | 'things' | 'camera';

export interface TabDef {
  readonly id: TabId;
  readonly label: string;
  /** KeyboardEvent.key that opens it. */
  readonly key: string;
  /** A second key (Avatar also opens with P). */
  readonly alt?: string;
  /** lucide icon name */
  readonly icon: string;
  readonly doc: string;
}

export const TABS: readonly TabDef[] = [
  { id: 'select', label: 'Select', key: 'F1', icon: 'MousePointer2', doc: 'Select anything and change it (the ground, a plant, the sea, a thing); move, turn, size, copy and delete the things on your island; focus on one and hide the rest.' },
  { id: 'paint', label: 'Paint', key: 'F2', icon: 'Paintbrush', doc: 'Paint the ground with any surface.' },
  { id: 'sculpt', label: 'Sculpt', key: 'F3', icon: 'Mountain', doc: 'Raise, lower, smooth and shape the ground. The world rules decide what digging uncovers and what the plants do.' },
  { id: 'animate', label: 'Animate', key: 'F4', icon: 'Activity', doc: 'Moves for your goblin: play one, or change how it walks, runs and jumps.' },
  { id: 'sound', label: 'Sound', key: 'F5', icon: 'Volume2', doc: 'Every sound is a preset: play it, change it.' },
  { id: 'lights', label: 'Lights', key: 'F6', icon: 'Sun', doc: 'The light of your island: pick a look, change any knob, switch the ground between flat and PBR.' },
  { id: 'activities', label: 'Activities', key: 'F7', icon: 'Flag', doc: 'Games you can play and host, like Goblin Racing.' },
  { id: 'avatar', label: 'Avatar', key: 'F8', alt: 'p', icon: 'User', doc: 'Your goblin: how it looks and how it moves.' },
  { id: 'things', label: 'Things', key: 'F9', icon: 'Package', doc: 'Place palms, bushes, rocks, flowers, barrels and statues.' },
  { id: 'camera', label: 'Camera', key: 'F10', icon: 'Camera', doc: 'How you see the world: over the shoulder, first person, studio, from above.' },
];
export const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);
export const tabDef = (id: TabId): TabDef => TABS.find((t) => t.id === id) ?? TABS[0]!;

/** The tab a key opens (F1..F10, and P for the avatar), or null. Case-insensitive for letters. */
export function tabForKey(key: string): TabId | null {
  if (typeof key !== 'string' || !key) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  const t = TABS.find((d) => d.key === k || d.alt === k);
  return t ? t.id : null;
}

export const SLOTS = 9;
export type Hotbars = Record<TabId, (string | null)[]>;

const fit = (list: readonly (string | null)[]): (string | null)[] => Array.from({ length: SLOTS }, (_, i) => list[i] ?? null);

/**
 * Bring stored hotbars back into shape: every tab present, nine slots each, only ids the tab knows (`isValid`), anything else taken from the
 * defaults. Never throws.
 */
export function normalizeHotbars(raw: unknown, defaults: Hotbars, isValid: (tab: TabId, id: string) => boolean): Hotbars {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Hotbars;
  for (const tab of TAB_IDS) {
    const stored = r[tab];
    if (Array.isArray(stored)) out[tab] = fit(stored.map((x) => (typeof x === 'string' && isValid(tab, x) ? x : null)));
    else out[tab] = fit(defaults[tab] ?? []);
  }
  return out;
}

/** A copy with `id` in slot `slot` of `tab` (null empties it). If the id was already in another slot of the tab, the two swap. */
export function assignSlot(h: Hotbars, tab: TabId, slot: number, id: string | null): Hotbars {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return h;
  const row = fit(h[tab] ?? []);
  const was = id === null ? -1 : row.indexOf(id);
  if (was >= 0 && was !== slot) row[was] = row[slot] ?? null;
  row[slot] = id;
  return { ...h, [tab]: row };
}

/** Slot after scrolling by `dir` (wraps). */
export const stepSlot = (slot: number, dir: number): number => (((Math.trunc(slot) + (dir > 0 ? 1 : dir < 0 ? -1 : 0)) % SLOTS) + SLOTS) % SLOTS;
