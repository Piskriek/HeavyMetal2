/**
 * T01 — typed gameplay events.
 *
 * The UI never mutates simulation state; it consumes these records (or a snapshot derived
 * from them). Every simulation-owned change that a renderer, the HUD, audio or the results
 * screen needs to react to has a named event here, and the events are plain frozen data so
 * they can be logged, replayed and compared between runs.
 */

import type { ContractErrorCode } from './core';
import type { GameplayEffect } from './effects';
import type { RacerId } from './identity';
import type { CrossingRejection, FallbackClass } from './qualifying';
import type { HeatPhase } from './heat';

export type RaceEvent =
  | { readonly type: 'heat-staged'; readonly heatIndex: number; readonly tick: number }
  | { readonly type: 'heat-aborted'; readonly heatIndex: number; readonly tick: number; readonly reason: string }
  | { readonly type: 'qualifying-begun'; readonly heatIndex: number; readonly tick: number; readonly racerId: RacerId; readonly attempt: number }
  | { readonly type: 'gate-crossed'; readonly tick: number; readonly racerId: RacerId; readonly attempt: number; readonly fraction: number; readonly speed: number }
  | { readonly type: 'attempt-rejected'; readonly tick: number; readonly racerId: RacerId; readonly attempt: number; readonly reason: CrossingRejection }
  | { readonly type: 'fallback-classified'; readonly tick: number; readonly racerId: RacerId; readonly fallback: FallbackClass }
  | { readonly type: 'qualifying-complete'; readonly tick: number; readonly order: readonly RacerId[] }
  | { readonly type: 'released'; readonly tick: number; readonly heatIndex: number }
  | { readonly type: 'race-started'; readonly tick: number; readonly heatIndex: number }
  | { readonly type: 'bumped'; readonly tick: number; readonly a: RacerId; readonly b: RacerId; readonly severity: number; readonly shielded: boolean }
  | { readonly type: 'pickup-claimed'; readonly tick: number; readonly pickupId: string; readonly racerId: RacerId; readonly effect: GameplayEffect; readonly fromMystery: boolean }
  | { readonly type: 'pickup-ignored'; readonly tick: number; readonly pickupId: string; readonly racerId: RacerId; readonly reason: 'already-claimed' | 'lost-arbitration' }
  | { readonly type: 'hop'; readonly tick: number; readonly racerId: RacerId }
  | { readonly type: 'bounce-used'; readonly tick: number; readonly racerId: RacerId; readonly charges: number }
  | { readonly type: 'boost-used'; readonly tick: number; readonly racerId: RacerId; readonly charges: number }
  | { readonly type: 'fell'; readonly tick: number; readonly racerId: RacerId }
  | { readonly type: 'recovered'; readonly tick: number; readonly racerId: RacerId }
  | { readonly type: 'dent-added'; readonly tick: number; readonly racerId: RacerId; readonly totalDepth: number }
  | { readonly type: 'dent-repaired'; readonly tick: number; readonly racerId: RacerId }
  | { readonly type: 'reservation-granted'; readonly tick: number; readonly resourceId: string; readonly racerId: RacerId }
  | { readonly type: 'reservation-denied'; readonly tick: number; readonly resourceId: string; readonly racerId: RacerId; readonly heldBy: RacerId }
  | { readonly type: 'finished'; readonly tick: number; readonly racerId: RacerId; readonly position: number; readonly time: number }
  | { readonly type: 'settled'; readonly tick: number; readonly heatIndex: number }
  | { readonly type: 'results-ready'; readonly tick: number; readonly heatIndex: number }
  | { readonly type: 'phase-changed'; readonly tick: number; readonly from: HeatPhase; readonly to: HeatPhase }
  | { readonly type: 'command-rejected'; readonly tick: number; readonly command: string; readonly code: ContractErrorCode; readonly reason: string };

export type RaceEventType = RaceEvent['type'];

export function isRaceEventType(value: unknown): value is RaceEventType {
  return typeof value === 'string' && [
    'heat-staged', 'heat-aborted', 'qualifying-begun', 'gate-crossed', 'attempt-rejected', 'fallback-classified',
    'qualifying-complete', 'released', 'race-started', 'bumped', 'pickup-claimed', 'pickup-ignored', 'hop',
    'bounce-used', 'boost-used', 'fell', 'recovered', 'dent-added', 'dent-repaired', 'reservation-granted',
    'reservation-denied', 'finished', 'settled', 'results-ready', 'phase-changed', 'command-rejected',
  ].includes(value);
}

/** Stable one-line rendering used by logs, the debug panel and test failure messages. */
export function describeEvent(event: RaceEvent): string {
  const parts = Object.entries(event as Record<string, unknown>)
    .filter(([key]) => key !== 'type')
    .map(([key, value]) => `${key}=${Array.isArray(value) ? `[${value.join(',')}]` : String(value)}`);
  return `${event.type}${parts.length ? ` ${parts.join(' ')}` : ''}`;
}

export function filterEvents<T extends RaceEventType>(events: readonly RaceEvent[], type: T): readonly Extract<RaceEvent, { type: T }>[] {
  return Object.freeze(events.filter((event): event is Extract<RaceEvent, { type: T }> => event.type === type));
}

export function countEvents(events: readonly RaceEvent[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return Object.freeze(counts);
}
