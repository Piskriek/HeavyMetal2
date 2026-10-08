import { useSyncExternalStore } from 'react';
import { ISLAND_STEPS, Tutorial, WALK_STEPS, type Effect, type Step } from '@hm/tutorial';

/**
 * The island tour: one `@hm/tutorial` run, kept between visits. The island reports what the player does (events), the tour answers with
 * effects (hand over a tool, say something, switch to PBR, the reveal, credits) that the island carries out. The player can skip a step,
 * close it until next time (it comes back next visit) or close it for good; "Show the tour" in the menu starts it again.
 */
export type TourMode = 'on' | 'never';
interface Saved { readonly mode: TourMode; readonly kind: 'build' | 'walk'; readonly progress: unknown }
const KEY = 'hm.tour.v1';
const LATER = 'hm.tour.later';

let tour: Tutorial | null = null;
let kind: 'build' | 'walk' = 'build';
let mode: TourMode = 'on';
let later = false;
let rev = 0;
let handler: ((e: Effect) => void) | null = null;
const listeners = new Set<() => void>();

import { kv } from '../storage/profile-storage';

const stepsFor = (k: 'build' | 'walk'): Step[] => (k === 'build' ? ISLAND_STEPS : WALK_STEPS);
function read(): Saved | null {
  try { const r = JSON.parse(kv.get(KEY) ?? 'null') as Saved | null; return r && typeof r === 'object' ? r : null; } catch { return null; }
}
function save(): void {
  try { kv.set(KEY, JSON.stringify({ mode, kind, progress: tour?.toJSON() ?? null } satisfies Saved)); } catch { /* storage blocked */ }
}
function changed(): void { rev++; save(); listeners.forEach((l) => l()); }
function deliver(effects: readonly Effect[]): void { for (const e of effects) handler?.(e); if (effects.length || tour) changed(); }
let lastStep = -1, lastWrite = 0;
/** A player event: redraw only when the tour moved on (looking round reports every 400 ms and most reports only count); the counts are written down at most every few seconds. */
function deliverIfMoved(t: Tutorial, effects: readonly Effect[]): void {
  const step = t.index(), now = performance.now();
  if (effects.length || step !== lastStep) { lastStep = step; lastWrite = now; deliver(effects); return; }
  if (now - lastWrite > 3000) { lastWrite = now; save(); }
}

/** Open the tour for this island visit (build tour for grown-ups, the short one otherwise). Effects queued on entering a step are delivered. */
export function startTour(k: 'build' | 'walk', onEffect: (e: Effect) => void): void {
  handler = onEffect;
  // the controls this tour points at, for the tests: each must exist on the island (data-ui names, B15)
  (window as unknown as { hmTourTargets?: string[] }).hmTourTargets = stepsFor(k).map((s) => s.highlight).filter((h): h is string => !!h);
  const saved = read();
  mode = saved?.mode === 'never' ? 'never' : 'on';
  try { later = sessionStorage.getItem(LATER) === '1'; } catch { later = false; }
  if (!tour || kind !== k) {
    kind = k;
    tour = new Tutorial(stepsFor(k), saved && saved.kind === k ? (saved.progress as never) : undefined);
  }
  if (visible()) deliver(tour.tick(performance.now()));
  else changed();
}
export function stopTour(): void { handler = null; }

const visible = (): boolean => !!tour && !tour.done() && mode === 'on' && !later;
const live = (fn: (t: Tutorial, now: number) => Effect[]): void => { if (tour && visible()) deliver(fn(tour, performance.now())); };
export const tourEvent = (name: string): void => { if (tour && visible()) deliverIfMoved(tour, tour.event(name, performance.now())); };
export const tourButton = (id: string): void => live((t, now) => t.button(id, now));
export const tourTick = (): void => { if (tour && visible()) { const fx = tour.tick(performance.now()); if (fx.length) deliver(fx); } };
export const tourSkip = (): void => live((t, now) => t.skip(now));
/** Close it until next time: it comes back on the next visit. */
export function tourLater(): void { later = true; try { sessionStorage.setItem(LATER, '1'); } catch { /* ignore */ } changed(); }
/** Close it for good (the menu can still start it again). */
export function tourNever(): void { mode = 'never'; changed(); }
/** Forget the tour (Settings: Replay the tour, Reset progress): the next island visit starts it from the first step. */
export function resetTour(): void {
  tour = null; mode = 'on'; later = false;
  try { kv.remove(KEY); sessionStorage.removeItem(LATER); } catch { /* ignore */ }
  rev++; listeners.forEach((l) => l());
}
/** Start the tour again from the first step. */
export function tourReplay(): void {
  mode = 'on'; later = false;
  try { sessionStorage.removeItem(LATER); } catch { /* ignore */ }
  tour = new Tutorial(stepsFor(kind));
  deliver(tour.tick(performance.now()));
}

export interface TourView { readonly step: Step | null; readonly index: number; readonly total: number; readonly visible: boolean; readonly finished: boolean }
let snap: { rev: number; view: TourView } = { rev: -1, view: { step: null, index: 0, total: 0, visible: false, finished: false } };
function view(): TourView {
  if (snap.rev !== rev) snap = { rev, view: { step: tour?.current() ?? null, index: tour?.index() ?? 0, total: tour?.total() ?? 0, visible: visible(), finished: !!tour?.done() } };
  return snap.view;
}
const subscribe = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useTour = (): TourView => useSyncExternalStore(subscribe, view, view);
