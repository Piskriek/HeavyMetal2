import type { SfxId } from '@hm/audio';
import type { PlayerState } from '../player';

/** Where the player points: a spot on the ground or a thing. */
export interface WayAim { readonly point: readonly [number, number, number]; readonly normal: readonly [number, number, number] | null }

/**
 * Everything a hotbar way may do to the island, in one place (RELEASE_PLAN Milestone 0.5, the ways registry).
 * The island builds one of these per run; tests build a fake one. A way never reaches past it.
 */
export interface WayCtx {
  /** The player's hotbar state right now (tab, palette, sliders). */
  player(): PlayerState;
  /** Where the crosshair (or the cursor) points, or null when it points at the sky. */
  aim(): WayAim | null;
  say(text: string): void;
  fx(sound: SfxId, opts?: { volume?: number; minGapMs?: number }): void;
  /** A one-off particle burst of a sprite preset (e.g. 'stars', 'embers'). */
  burst(sprite: string, count: number, at: readonly [number, number, number]): void;
  /** Shake the camera with a shake preset (the island skips it when Reduce motion is on). */
  shake(preset: string): void;
  /** 0..1, the island's random (a test passes a fixed one). */
  random(): number;
  /** Set the time of day in hours (one undo step, labelled). */
  setTimeOfDay(hours: number, label: string): void;
  openLayers(): void;
  openWireGraph(): void;
  /** The tutorial's events ('used-sculpt', 'placed', ...). */
  tourEvent(event: string): void;
  /** Things and lamps near where you point. */
  modelAt(a: WayAim): { ref: string } | null;
  lampNear(a: WayAim, within: number): { ref: string } | null;
  /** Logic: put a zone (returns its id), a wire, or snip every cord at a spot (returns how many). */
  putZone(a: WayAim, half: number, label: string, when?: 'enter' | 'leave'): string;
  putWire(from: string, to: string, does: string, label: string, sound?: string): void;
  snipAt(a: WayAim): number;
  /** The zone whose box (plus a metre) holds the spot, nearest first; how many zones the island has. */
  zoneNear(a: WayAim): { ref: string } | null;
  zoneCount(): number;
  /** Take a zone away with every wire starting from it (one undo step). */
  removeZone(ref: string): void;
  /** Take away every wire ending at a thing or lamp (one undo step); how many. */
  removeWiresTo(ref: string): number;
  /** Rules: put one on the island (one undo step), take every rule off a thing (how many), open the Rules window. */
  addRule(name: string, params: Record<string, unknown>): void;
  removeRulesOn(thing: string): number;
  /** Open one of the island's windows (the Rules, the placed sounds). */
  openWindow(id: 'logic' | 'soundscape', title: string): void;
  /** Placed children (sound spots, effects, lamps): put one (one undo step, saved; returns its id), or take the nearest within `within` metres away (false when none). */
  placeChild(list: PlacedList, kind: string, idPrefix: string, name: string, params: Record<string, unknown>): string;
  removeNearest(list: PlacedList, a: WayAim, within: number, label: string): boolean;
  /** Sound: play a pick to hear it (an ambience fades in for 3 s), and a one-shot sound's name. */
  previewSound(what: string): void;
  soundName(what: string): string;
  /** Effects: play an effect once, where you point. */
  effectOnce(kind: string, at: readonly [number, number, number]): void;
  /** How many lamps the renderer lights (0 on Potato). */
  lampSlots(): number;
  /** Animate: drawing a walk for a thing (points are x, z), and stopping a thing's walks. */
  readonly walk: {
    drawing(): boolean;
    start(thing: string): void;
    push(p: readonly [number, number]): void;
    pop(): void;
    last(): readonly [number, number] | null;
    /** Lay the drawn walk as a path (one undo step). */
    lay(): void;
    /** Take a thing's walks away (one undo step); false when it has none. */
    stop(thing: string): boolean;
  };
  /** Camera: a photo on the next frame, slow motion (returns whether it is now on), an orbit shot round a thing (or round you). */
  readonly camera: {
    photo(): void;
    toggleSlowMo(): boolean;
    orbit(thing: string | null, seconds: number): void;
  };
  /** Physics: the push hammer (how many things fly), a thing's material, dropping a thing from a height (false when it cannot). */
  readonly physics: {
    swing(at: readonly [number, number, number], power: number): number;
    setMaterial(thing: string, material: string): void;
    drop(thing: string, height: number): boolean;
  };
  /** Characters: the one nearest a spot (where it walks now), take it away, change its behaviour, spawn one facing you. */
  readonly chars: {
    near(a: WayAim, within: number): CharRef | null;
    remove(c: CharRef): void;
    setBrain(c: CharRef, brain: string, label: string): void;
    spawn(a: WayAim, brain: string, label: string): void;
  };
  /** A placed thing's name ('it' when it has none). */
  thingName(ref: string): string;
  /** A V3 slider's value for the current tool, or null when it has none. */
  drive(name: string): number | null;
  /** Save the island now (after edits that do not save themselves). */
  save(): void;
  /** The zone a cord or wire starts from, while the player is laying one (Esc clears it). */
  wireFrom(): string | null;
  setWireFrom(id: string | null): void;
  /** Clay and carving: on the thing under the crosshair (false when there is none), or on the ground with the raise or lower tool. */
  carveUnder(add: boolean, size: number): boolean;
  sculptGround(add: boolean, now: number, first: boolean): boolean;
  /** The size of a tool on the hotbar (1 when it has none). */
  toolSize(toolId: string): number;
  /** Per-island scratch state for ways that remember something between calls (a stroke's target, a first click). */
  readonly memo: Map<string, unknown>;
}

/** A placed character: its place in the island's list and its id. */
export interface CharRef { readonly index: number; readonly ref: string }

/** The island's lists of placed children that ways add to and take from. */
export type PlacedList = 'soundscape' | 'effects' | 'lamps';

/** One use of a way: the button's way id, Alt (the other action), the time, and whether this is the first frame of the click. */
export interface WayUse { readonly id: string; readonly alt: boolean; readonly now: number; readonly first: boolean }

export type WayHandler = (ctx: WayCtx, use: WayUse) => void;

/** A tab's ways: way id to handler. */
export type WaySet = Readonly<Record<string, WayHandler>>;
