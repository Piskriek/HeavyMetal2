/**
 * T01 — read-only render contracts.
 *
 * The renderer consumes a frozen, plain-data view of the simulation. It cannot reach live
 * simulation objects, so it cannot write back a dent direction, advance a roll state or
 * mutate a racer. The type-level `DeepReadonly` makes that a compile error; `deepFreeze`
 * makes it a runtime error too.
 */

import { frozenArray, isPlainObject } from './core';
import type { DentRenderView } from './dents';
import type { HeatPhase } from './heat';
import type { RacerId } from './identity';

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends Map<unknown, unknown>
    ? ReadonlyMap<unknown, unknown>
    : T extends Set<unknown>
      ? ReadonlySet<unknown>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/** Deep-freezes plain objects, arrays, maps and sets; cycles are handled. */
export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): DeepReadonly<T> {
  if (value === null || typeof value !== 'object') return value as DeepReadonly<T>;
  const object = value as unknown as object;
  if (seen.has(object)) return value as DeepReadonly<T>;
  seen.add(object);
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry, seen);
  } else if (value instanceof Map) {
    for (const [key, entry] of value) { deepFreeze(key, seen); deepFreeze(entry, seen); }
  } else if (value instanceof Set) {
    for (const entry of value) deepFreeze(entry, seen);
  } else if (isPlainObject(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry, seen);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export interface RenderRacer {
  readonly id: RacerId;
  readonly name: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly lane: number;
  readonly speed: number;
  readonly falling: boolean;
  readonly grounded: boolean;
  readonly finished: boolean;
  readonly shieldActive: boolean;
  readonly dent: DentRenderView;
}

export interface RenderFrame {
  readonly tick: number;
  readonly time: number;
  readonly phase: HeatPhase;
  readonly camera: { readonly x: number; readonly y: number };
  readonly racers: readonly RenderRacer[];
  /** Player index into `racers`, or -1 when there is no local player in this heat. */
  readonly playerIndex: number;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
}

export interface RenderRacerSource {
  readonly id: RacerId;
  readonly name: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly lane: number;
  readonly speed: number;
  readonly falling: boolean;
  readonly grounded: boolean;
  readonly finished: boolean;
  readonly shieldUntil?: number;
  readonly dent?: DentRenderView;
}

export interface RenderFrameSource {
  readonly tick: number;
  readonly time: number;
  readonly phase: HeatPhase;
  readonly camera: { readonly x: number; readonly y: number };
  readonly racers: readonly RenderRacerSource[];
  readonly playerId?: RacerId | null;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
}

const EMPTY_DENT: DentRenderView = Object.freeze({ slots: frozenArray([]), totalDepth: 0, clamped: 0 });

/**
 * Builds a frozen render frame as **fresh plain data**. The simulation keeps its own
 * objects, so a renderer that tries to write into this frame throws in strict mode and
 * changes nothing either way.
 */
export function createRenderView(source: RenderFrameSource, time = 0): DeepReadonly<RenderFrame> {
  const racers = source.racers.map((racer) => Object.freeze({
    id: racer.id,
    name: racer.name,
    color: racer.color,
    x: racer.x,
    y: racer.y,
    z: racer.z,
    rotation: racer.rotation,
    lane: racer.lane,
    speed: racer.speed,
    falling: racer.falling,
    grounded: racer.grounded,
    finished: racer.finished,
    shieldActive: (racer.shieldUntil ?? -1) > time,
    dent: racer.dent ?? EMPTY_DENT,
  }));
  const playerIndex = source.playerId === undefined || source.playerId === null
    ? -1
    : racers.findIndex((racer) => racer.id === source.playerId);
  return deepFreeze({
    tick: source.tick,
    time: source.time,
    phase: source.phase,
    camera: Object.freeze({ ...source.camera }),
    racers: frozenArray(racers),
    playerIndex,
    reducedMotion: source.reducedMotion,
    paused: source.paused,
  } satisfies RenderFrame) as DeepReadonly<RenderFrame>;
}

/** Throws when a view somehow escaped unfrozen; used by tests and by the debug panel. */
export function assertFrozen(view: unknown, label = 'render view'): void {
  if (view === null || typeof view !== 'object') return;
  if (!Object.isFrozen(view)) throw new Error(`${label} is not frozen.`);
  for (const entry of Object.values(view as Record<string, unknown>)) assertFrozen(entry, label);
  for (const entry of Array.isArray(view) ? view : []) assertFrozen(entry, label);
}

/** The renderer receives exactly this interface; it has no setter by design. */
export interface ReadOnlyFrameConsumer {
  render(frame: DeepReadonly<RenderFrame>): void;
}
