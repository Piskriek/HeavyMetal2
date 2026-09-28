/**
 * T01 — qualifying results, fallback classes, gate validation and the bounded schedule.
 *
 * Frozen rules:
 * - A valid crossing is a **swept** forward crossing of a named gate, validated for lane,
 *   altitude and segment. A 13-unit normal step is not evidence; the whole movement range
 *   between two ticks is tested.
 * - Results come in two classes. Fallback entries always rank behind every valid entry, no
 *   matter how good their numbers look.
 * - CPU staging is bounded by construction. The launch delay never grows linearly with the
 *   racer index (a 100-racer field must not create a 35-second wait).
 */

import { ContractError, frozenArray, isFiniteNumber } from './core';
import type { RacerId } from './identity';

export type FallbackClass = 'retry-exhausted' | 'deadline' | 'dnf' | 'invalid-crossing';

/** Ranking order for fallbacks: earlier means "less bad". Never outranks a valid result. */
export const FALLBACK_ORDER: readonly FallbackClass[] = frozenArray(['dnf', 'invalid-crossing', 'deadline', 'retry-exhausted']);

export type QualifyingStatus = 'valid' | 'fallback';

export interface QualifyingEntry {
  readonly racerId: RacerId;
  /** 1-based attempt number that produced this entry. */
  readonly attempt: number;
  readonly status: QualifyingStatus;
  /** Crossing time in seconds; `null` for a fallback. */
  readonly time: number | null;
  /** Speed at the gate, and the attempt's peak speed. Both are observations. */
  readonly speed: number;
  readonly peakSpeed: number;
  readonly fallback: FallbackClass | null;
  /**
   * True once the attempt's heat reward was rolled. A retry must never re-roll it, so the
   * flag travels with the entry rather than living in the resolver.
   */
  readonly rewardRolled: boolean;
}

export interface RankedQualifyingEntry extends QualifyingEntry {
  /** 1-based rank, deterministic including ties. */
  readonly rank: number;
  /** True when this entry takes a grid slot for the given capacity. */
  readonly advanced: boolean;
}

export function createQualifyingEntry(input: Omit<QualifyingEntry, 'fallback' | 'status'> & { status: QualifyingStatus; fallback?: FallbackClass | null }): QualifyingEntry {
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new ContractError('E_CONTRACT_SHAPE', `Attempt number ${String(input.attempt)} must be a positive integer.`);
  }
  if (input.status === 'valid') {
    if (!isFiniteNumber(input.time) || input.time < 0) {
      throw new ContractError('E_CONTRACT_SHAPE', 'A valid qualifying entry needs a non-negative crossing time.');
    }
  } else if (!input.fallback) {
    throw new ContractError('E_CONTRACT_SHAPE', 'A fallback qualifying entry needs a fallback class.');
  }
  return Object.freeze({
    racerId: input.racerId,
    attempt: input.attempt,
    status: input.status,
    time: input.status === 'valid' ? input.time : null,
    speed: isFiniteNumber(input.speed) ? input.speed : 0,
    peakSpeed: isFiniteNumber(input.peakSpeed) ? input.peakSpeed : 0,
    fallback: input.status === 'valid' ? null : input.fallback ?? 'dnf',
    rewardRolled: input.rewardRolled === true,
  });
}

/** Valid entries strictly before fallback entries, then a stable deterministic order. */
export function compareQualifying(a: QualifyingEntry, b: QualifyingEntry): number {
  if (a.status !== b.status) return a.status === 'valid' ? -1 : 1;
  if (a.status === 'valid' && b.status === 'valid') {
    const at = a.time ?? Number.POSITIVE_INFINITY;
    const bt = b.time ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    const speed = b.speed - a.speed;
    if (speed !== 0) return speed;
  } else {
    const order = FALLBACK_ORDER.indexOf(a.fallback ?? 'dnf') - FALLBACK_ORDER.indexOf(b.fallback ?? 'dnf');
    if (order !== 0) return order;
  }
  return a.racerId - b.racerId;
}

/**
 * Ranks entries and marks the first `capacity` as advanced. Fallbacks only advance when
 * there are not enough valid entries to fill the grid — they never displace a valid one.
 */
export function rankQualifying(entries: readonly QualifyingEntry[], capacity: number): readonly RankedQualifyingEntry[] {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new ContractError('E_CONTRACT_SHAPE', `Qualifying capacity ${String(capacity)} must be a positive integer.`);
  }
  const sorted = [...entries].sort(compareQualifying);
  return frozenArray(sorted.map((entry, index) => Object.freeze({
    ...entry, rank: index + 1, advanced: index < capacity,
  })));
}

export function qualifyingCounts(entries: readonly QualifyingEntry[]): Readonly<{ valid: number; fallback: number }> {
  let valid = 0;
  for (const entry of entries) if (entry.status === 'valid') valid++;
  return Object.freeze({ valid, fallback: entries.length - valid });
}

// ---------------------------------------------------------------------------
// Gate crossing validation
// ---------------------------------------------------------------------------

export interface QualifyingGate {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  /** Gate altitude (world units above ground) plus the tolerated deviation. */
  readonly altitude: number;
  readonly altitudeTolerance: number;
  /** Canonical segment the gate belongs to; a crossing from another segment is invalid. */
  readonly segment: string;
}

/** The named entry gate: the first loop on the course. */
export const QUALIFYING_GATE_ID = 'first-loop-entry';
export const QUALIFYING_GATE_ALTITUDE_TOLERANCE = 90;

export type CrossingRejection = 'wrong-lane' | 'reverse' | 'above-gate' | 'wrong-segment' | 'missed';

export interface CrossingInput {
  readonly from: { readonly x: number; readonly z: number; readonly altitude: number };
  readonly to: { readonly x: number; readonly z: number; readonly altitude: number };
  readonly gate: QualifyingGate;
  /** Segment the racer was in for the whole step, or `null` when it straddles a boundary. */
  readonly segment: string | null;
}

export type CrossingOutcome =
  | { readonly ok: true; readonly fraction: number; readonly distance: number }
  | { readonly ok: false; readonly reason: CrossingRejection; readonly fraction: number };

/**
 * Swept validation over the whole tick movement. Checks, in order: forward motion, gate
 * plane crossing inside the tick, lane containment at the crossing fraction, altitude, and
 * segment identity. Anything else is rejected with a named reason.
 */
export function validateGateCrossing(input: CrossingInput): CrossingOutcome {
  const { from, to, gate } = input;
  const dx = to.x - from.x;
  if (dx <= 0) return Object.freeze({ ok: false, reason: 'reverse' as const, fraction: 0 });
  const fraction = (gate.x - from.x) / dx;
  if (!(fraction >= 0 && fraction <= 1)) {
    return Object.freeze({ ok: false, reason: 'missed' as const, fraction: Math.max(0, Math.min(1, fraction)) });
  }
  const z = from.z + (to.z - from.z) * fraction;
  if (Math.abs(z - gate.z) > gate.halfWidth) {
    return Object.freeze({ ok: false, reason: 'wrong-lane' as const, fraction });
  }
  const altitude = from.altitude + (to.altitude - from.altitude) * fraction;
  const tolerance = gate.altitudeTolerance > 0 ? gate.altitudeTolerance : QUALIFYING_GATE_ALTITUDE_TOLERANCE;
  if (Math.abs(altitude - gate.altitude) > tolerance) {
    return Object.freeze({ ok: false, reason: 'above-gate' as const, fraction });
  }
  if (input.segment !== null && input.segment !== gate.segment) {
    return Object.freeze({ ok: false, reason: 'wrong-segment' as const, fraction });
  }
  return Object.freeze({ ok: true, fraction, distance: dx * fraction });
}

// ---------------------------------------------------------------------------
// Bounded staging schedule
// ---------------------------------------------------------------------------

/** The whole CPU staging window in seconds, regardless of field size. */
export const MAX_STAGING_DELAY = 2.5;
/** Extra deterministic spread so two racers never launch on the same tick. */
export const STAGING_TICK_SPREAD = 0.05;

/**
 * Deterministic, bounded delay before a CPU racer is released.
 *
 * `index` is the field-local grid slot, not the racer ID: the schedule is identity-independent
 * and monotonic, so slot 0 always deploys first. For the largest supported field the gap between
 * neighbouring slots is 0.025 s (three ticks at 120 Hz), so two racers never deploy on the same
 * tick, and the whole window is capped by `MAX_STAGING_DELAY`.
 */
export function cpuStagingDelay(index: number, fieldSize: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  const field = Number.isFinite(fieldSize) && fieldSize > 1 ? Math.min(fieldSize, 100) : 4;
  const slot = index % field;
  const spread = field > 1 ? MAX_STAGING_DELAY / (field - 1) : 0;
  return Math.min(MAX_STAGING_DELAY, slot * spread);
}

/** Upper bound the schedule can ever produce; asserted in tests for 4/20/50/100. */
export const STAGING_DELAY_CEILING = MAX_STAGING_DELAY;
