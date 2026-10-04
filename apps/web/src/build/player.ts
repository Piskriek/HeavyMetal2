import { useSyncExternalStore } from 'react';
import { MOVE_SLOTS, animById, type MoveSlot } from '@hm/anim';
import { LOOKS, normalizeLook, type AvatarLook } from '@hm/avatarlook';
import { LOGIC_PRESETS, PAINTS, SLOTS, STAMP_SHAPES, THINGS, TAB_IDS, assignSlot, normalizeHotbars, type HotbarLevel, type Hotbars, type TabId } from '@hm/buildkit';
import { OLD_DEFAULT_ROWS, defaultHotbars, validFor, type ActivityInfo, type CatalogPlayer } from './catalog';

/**
 * The player's own presets and HUD state, saved on this device: the hotbar of every tab, the tools and animations they changed (stored as
 * changes over the ready-made ones, so a ready-made preset that improves still shows through), their goblin looks, which animation plays
 * for each way of moving, and the camera. One small store with subscribe, so every part of the HUD reads the same thing.
 */
export interface PlayerState extends CatalogPlayer {
  readonly tab: TabId;
  readonly slots: Readonly<Record<TabId, number>>;
  readonly hotbars: Hotbars;
  readonly moves: Readonly<Record<MoveSlot, string>>;
  /** The look your goblin wears (an id from `looks` or the ready-made ones). */
  readonly lookId: string;
  /** Whether the player has made their goblin yet (the Play flow asks first). */
  readonly created: boolean;
  readonly view: 'third' | 'first';
  readonly mode: 'walk' | 'studio';
  /** Changes to the ready-made sprite bursts, by sprite id. */
  readonly sprites: Readonly<Record<string, Record<string, unknown>>>;
  /** How deep the hotbar goes: Easy, Pro or Studio (docs/HOTBAR.md). */
  readonly level: HotbarLevel;
  /** What each tab's tools apply, picked in the palette strip (Paint: a surface id). */
  readonly palette: Readonly<Partial<Record<TabId | 'lamp', string>>>;
  /** Sculpt's toggles (Pro, beside the hotbar): mirror every stroke across the island's middle; smooth gently behind it. */
  readonly sculptToggles: { readonly mirror: boolean; readonly smoothAfter: boolean };
}

const KEY = 'hm.player.v1';
let activities: readonly ActivityInfo[] = [{ id: 'goblin-racing', name: 'Goblin Racing', doc: 'Race goblin balls round island tracks.', hue: 330, ring: true }];
const listeners = new Set<() => void>();

const blank = (): PlayerState => {
  const p: CatalogPlayer = { tools: {}, anims: {}, looks: [] };
  return {
    ...p, tab: 'sculpt', slots: Object.fromEntries(TAB_IDS.map((t) => [t, 0])) as Record<TabId, number>, hotbars: defaultHotbars(activities, p),
    moves: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', fall: 'fall' }, lookId: LOOKS[0]!.id, created: false, view: 'third', mode: 'walk', sprites: {},
    level: 'easy', palette: { paint: '4', sculpt: 'mound', things: 'palm' }, sculptToggles: { mirror: false, smoothAfter: false },
  };
};

function load(): PlayerState {
  const base = blank();
  let raw: Record<string, unknown> = {};
  try { const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown; if (r && typeof r === 'object') raw = r as Record<string, unknown>; } catch { /* first run */ }
  const obj = (v: unknown): Record<string, Record<string, unknown>> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Record<string, unknown>>) : {});
  const looks = Array.isArray(raw.looks) ? raw.looks.map(normalizeLook).filter((l, i, a) => a.findIndex((m) => m.id === l.id) === i) : [];
  const p: CatalogPlayer = { tools: obj(raw.tools), anims: obj(raw.anims), looks };
  const tab = TAB_IDS.includes(raw.tab as TabId) ? (raw.tab as TabId) : base.tab;
  const slotsRaw = raw.slots && typeof raw.slots === 'object' ? (raw.slots as Record<string, unknown>) : {};
  const slots = Object.fromEntries(TAB_IDS.map((t) => { const n = Number(slotsRaw[t]); return [t, Number.isInteger(n) && n >= 0 && n < SLOTS ? n : 0]; })) as Record<TabId, number>;
  const movesRaw = raw.moves && typeof raw.moves === 'object' ? (raw.moves as Record<string, unknown>) : {};
  const moves = Object.fromEntries(MOVE_SLOTS.map((m) => [m, typeof movesRaw[m] === 'string' && animById(movesRaw[m] as string).id === movesRaw[m] ? movesRaw[m] : base.moves[m]])) as Record<MoveSlot, string>;
  const allLooks = [...looks, ...LOOKS];
  return {
    ...p, tab, slots, moves,
    hotbars: freshTabs(normalizeHotbars(raw.hotbars, defaultHotbars(activities, p), (t, id) => validFor(t, id, p, activities)), defaultHotbars(activities, p)),
    lookId: typeof raw.lookId === 'string' && allLooks.some((l) => l.id === raw.lookId) ? raw.lookId : looks[0]?.id ?? base.lookId,
    created: raw.created === true,
    view: raw.view === 'first' ? 'first' : 'third',
    mode: raw.mode === 'studio' ? 'studio' : 'walk',
    sprites: obj(raw.sprites),
    level: raw.level === 'pro' || raw.level === 'studio' ? raw.level : 'easy',
    sculptToggles: { mirror: (raw.sculptToggles as { mirror?: unknown } | undefined)?.mirror === true, smoothAfter: (raw.sculptToggles as { smoothAfter?: unknown } | undefined)?.smoothAfter === true },
    palette: { ...base.palette, ...paletteOf(raw.palette) },
  };
}
/** A tab whose saved slots no longer name any tool (Paint's slots held surfaces before its tools became ways to paint) starts from the ready-made row. */
function freshTabs(h: Hotbars, defaults: Hotbars): Hotbars {
  const out = { ...h };
  for (const t of TAB_IDS) {
    if (out[t].every((id) => id === null) && defaults[t].some((id) => id !== null)) out[t] = [...defaults[t]];
    // an untouched old ready-made row becomes today's
    else if ((OLD_DEFAULT_ROWS[t] ?? []).some((old) => old.length === out[t].length && old.every((id, i) => out[t][i] === id))) out[t] = [...defaults[t]];
  }
  return out;
}
const paletteOf = (v: unknown): Partial<Record<TabId | 'lamp', string>> => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const paint = typeof o.paint === 'string' && PAINTS.some((s) => String(s.id) === o.paint) ? o.paint : undefined;
  const sculpt = typeof o.sculpt === 'string' && STAMP_SHAPES.some((s) => s.id === o.sculpt) ? o.sculpt : undefined;
  const things = typeof o.things === 'string' && THINGS.some((t) => t.id === o.things) ? o.things : undefined;
  const logic = typeof o.logic === 'string' && LOGIC_PRESETS.some((r) => r.id === o.logic) ? o.logic : undefined;
  const lights = typeof o.lights === 'string' && /^[a-z0-9-]{1,40}$/.test(o.lights) ? o.lights : undefined;
  // the rest are plain ids, checked again where they are used
  const plain = (k: string): Record<string, string> => (typeof o[k] === 'string' && /^[a-z0-9-]{1,40}$/.test(o[k] as string) ? { [k]: o[k] as string } : {});
  return { ...(paint ? { paint } : {}), ...(sculpt ? { sculpt } : {}), ...(things ? { things } : {}), ...(lights ? { lights } : {}), ...(logic ? { logic } : {}), ...plain('effects'), ...plain('sound'), ...plain('characters'), ...plain('lamp') };
};

let state: PlayerState | null = null;
const get = (): PlayerState => (state ??= load());
function set(next: PlayerState): void {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}
export const subscribePlayer = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const player = get;
export const usePlayer = (): PlayerState => useSyncExternalStore(subscribePlayer, get, get);

/** Tell the store which activities exist (the shell's registry). They are not on the hotbar any more (V3); the galaxy and the Esc menu open them. */
export function setActivities(list: readonly ActivityInfo[]): void {
  activities = list;
}
export const currentActivities = (): readonly ActivityInfo[] => activities;

export const setTab = (tab: TabId): void => { const s = get(); if (s.tab !== tab) set({ ...s, tab }); };
export const setSlot = (tab: TabId, slot: number): void => { const s = get(); set({ ...s, slots: { ...s.slots, [tab]: ((slot % SLOTS) + SLOTS) % SLOTS } }); };
/** Put a preset in a slot of a tab (and select that slot). */
export function putInSlot(tab: TabId, slot: number, id: string): void {
  const s = get();
  set({ ...s, hotbars: assignSlot(s.hotbars, tab, slot, id), slots: { ...s.slots, [tab]: slot } });
}
/** The preset id in the selected slot of a tab. */
export const held = (tab?: TabId): string | null => { const s = get(); const t = tab ?? s.tab; return s.hotbars[t]?.[s.slots[t]] ?? null; };

export function editTool(id: string, key: string, value: unknown): void {
  const s = get();
  set({ ...s, tools: { ...s.tools, [id]: { ...(s.tools[id] ?? {}), [key]: value } } });
}
export function resetTool(id: string): void { const s = get(); const { [id]: _drop, ...rest } = s.tools; set({ ...s, tools: rest }); }
export function editSprite(id: string, key: string, value: unknown): void {
  const s = get();
  set({ ...s, sprites: { ...s.sprites, [id]: { ...(s.sprites[id] ?? {}), [key]: value } } });
}
export function resetSprite(id: string): void { const s = get(); const { [id]: _drop, ...rest } = s.sprites; set({ ...s, sprites: rest }); }
export function editAnim(id: string, key: string, value: unknown): void {
  const s = get();
  set({ ...s, anims: { ...s.anims, [id]: { ...(s.anims[id] ?? {}), [key]: value } } });
}
export function resetAnim(id: string): void { const s = get(); const { [id]: _drop, ...rest } = s.anims; set({ ...s, anims: rest }); }
export function setMove(slot: MoveSlot, animId: string): void { const s = get(); set({ ...s, moves: { ...s.moves, [slot]: animId } }); }

/** Save a look as one of your avatars (new id for a ready-made look you changed, or a new avatar) and wear it. */
export function saveLook(look: AvatarLook): AvatarLook {
  const s = get();
  const mine = s.looks.some((l) => l.id === look.id);
  const l = normalizeLook({ ...look, id: mine ? look.id : `mine-${Date.now().toString(36)}` });
  set({ ...s, looks: mine ? s.looks.map((x) => (x.id === l.id ? l : x)) : [l, ...s.looks], lookId: l.id, created: true });
  return l;
}
export const wearLook = (id: string): void => { const s = get(); set({ ...s, lookId: id }); };
/** Remove one of your avatars. Your last one stays; removing the one you use switches to the next. Returns false when it cannot go. */
export function removeLook(id: string): boolean {
  const s = get();
  if (s.looks.length <= 1 || !s.looks.some((l) => l.id === id)) return false;
  const looks = s.looks.filter((l) => l.id !== id);
  set({ ...s, looks, lookId: s.lookId === id ? looks[0]!.id : s.lookId });
  return true;
}
export const setView = (view: 'third' | 'first'): void => { const s = get(); if (s.view !== view) set({ ...s, view }); };
export const setMode = (mode: 'walk' | 'studio'): void => { const s = get(); if (s.mode !== mode) set({ ...s, mode }); };
export const markCreated = (): void => { const s = get(); if (!s.created) set({ ...s, created: true }); };
/** For tests and "reset progress". */
export function resetPlayer(): void { state = blank(); try { localStorage.removeItem(KEY); } catch { /* ignore */ } listeners.forEach((l) => l()); }

/** Easy, Pro or Studio: how deep the hotbar goes. */
export const setLevel = (level: HotbarLevel): void => { const s = get(); if (s.level !== level) set({ ...s, level }); };
/** Pick what a tab's tools apply from the palette strip (Paint: a surface). */
/** Sculpt's toggles: switch one on or off. */
export const toggleSculpt = (key: 'mirror' | 'smoothAfter'): void => { const s = get(); set({ ...s, sculptToggles: { ...s.sculptToggles, [key]: !s.sculptToggles[key] } }); };
export const pickPalette = (tab: TabId | 'lamp', id: string): void => { const s = get(); if (s.palette[tab] !== id) set({ ...s, palette: { ...s.palette, [tab]: id } }); };
/** Set a tool to one of its presets: its values become your tool's (one change, kept like any edit). */
export function applyVariant(toolId: string, patch: Readonly<Record<string, unknown>>): void {
  const s = get();
  set({ ...s, tools: { ...s.tools, [toolId]: { ...(s.tools[toolId] ?? {}), ...patch } } });
}

/** Settings, Hotbar: replace a tab's row (up to nine slots; empty slots are null). */
export function setRow(tab: TabId, row: readonly (string | null)[]): void {
  const s = get();
  const next = Array.from({ length: SLOTS }, (_, i) => row[i] ?? null);
  set({ ...s, hotbars: { ...s.hotbars, [tab]: next } });
}
/** Settings, Hotbar: back to the ready-made row of a tab. */
export function resetRow(tab: TabId): void { const s = get(); set({ ...s, hotbars: { ...s.hotbars, [tab]: [...defaultHotbars(activities, s)[tab]] } }); }
