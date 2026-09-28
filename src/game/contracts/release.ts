/**
 * T01 — release corridor and reservation interfaces.
 *
 * The corridor describes the physical space a released field must be able to leave through.
 * `validateReleaseCorridor` is the check T09 and T12 call before a heat is released: every
 * spawn inside the corridor, spaced apart, nothing solid blocking the exit lanes.
 *
 * The reservation ledger is the shared-resource claim interface (release slots, pickup
 * objects, corridors). It is deliberately idempotent: reserving something the same holder
 * already owns is harmless, while a second holder gets a typed denial carrying the current
 * owner, so the UI can explain itself instead of failing silently.
 */

import { LANE, LANE_COUNT, LANE_WIDTH, RADIUS, START_X } from '../scene';
import { ContractError, frozenArray, isFiniteNumber, isSafeRacerId } from './core';
import type { RuntimePropDefinition } from './props';
import type { RacerId } from './identity';

export interface ReleaseCorridor {
  readonly id: string;
  /** Track-space x range the corridor spans. */
  readonly from: number;
  readonly to: number;
  /** Half-width in world z units; defaults to the full racing surface. */
  readonly halfWidth: number;
  /** Minimum forward spacing between two released racers, in world units. */
  readonly minSpacing: number;
  /** Seconds the corridor must stay clear after release. */
  readonly clearanceSeconds: number;
}

export const DEFAULT_CORRIDOR_HALF_WIDTH = (LANE.far - LANE.near) / 2 + LANE_WIDTH / 2;

export function defaultReleaseCorridor(overrides: Partial<ReleaseCorridor> = {}): ReleaseCorridor {
  return Object.freeze({
    id: 'grid-release',
    from: START_X - 120,
    to: START_X + 900,
    halfWidth: DEFAULT_CORRIDOR_HALF_WIDTH,
    minSpacing: RADIUS * 2.4,
    clearanceSeconds: 6,
    ...overrides,
  });
}

export interface SpawnPoint {
  readonly racerId: RacerId;
  readonly x: number;
  readonly z: number;
}

export interface CorridorViolation {
  readonly code: 'outside-corridor' | 'spacing' | 'lane-collision' | 'blocked' | 'duplicate-racer' | 'no-spawns';
  readonly message: string;
  readonly racerIds?: readonly RacerId[];
}

export interface CorridorReport {
  readonly ok: boolean;
  readonly violations: readonly CorridorViolation[];
}

/** Internal z for a lane index, mirroring the renderer's lane mapping. */
export function laneCenterZ(lane: number): number {
  const clamped = Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane)));
  return LANE.far - LANE_WIDTH * (clamped + 0.5);
}

export function validateReleaseCorridor(
  corridor: ReleaseCorridor,
  spawns: readonly SpawnPoint[],
  solids: readonly RuntimePropDefinition[] = [],
): CorridorReport {
  const violations: CorridorViolation[] = [];
  if (spawns.length === 0) violations.push(Object.freeze({ code: 'no-spawns', message: 'The corridor has no spawns to release.' }));

  const seen = new Set<RacerId>();
  for (const spawn of spawns) {
    if (seen.has(spawn.racerId)) {
      violations.push(Object.freeze({ code: 'duplicate-racer', message: `Racer ${spawn.racerId} spawns more than once.`, racerIds: frozenArray([spawn.racerId]) }));
    }
    seen.add(spawn.racerId);
    if (spawn.x < corridor.from || spawn.x > corridor.to) {
      violations.push(Object.freeze({
        code: 'outside-corridor',
        message: `Racer ${spawn.racerId} spawns at x=${spawn.x}, outside the corridor ${corridor.from}..${corridor.to}.`,
        racerIds: frozenArray([spawn.racerId]),
      }));
    }
    if (Math.abs(spawn.z) > corridor.halfWidth) {
      violations.push(Object.freeze({
        code: 'outside-corridor',
        message: `Racer ${spawn.racerId} spawns at z=${spawn.z}, outside the corridor half-width ${corridor.halfWidth}.`,
        racerIds: frozenArray([spawn.racerId]),
      }));
    }
  }

  const ordered = [...spawns].sort((a, b) => a.x - b.x || a.z - b.z);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const gapX = current.x - previous.x;
    const gapZ = Math.abs(current.z - previous.z);
    if (gapX * gapX + gapZ * gapZ < corridor.minSpacing * corridor.minSpacing) {
      violations.push(Object.freeze({
        code: 'spacing',
        message: `Racers ${previous.racerId} and ${current.racerId} are closer than ${corridor.minSpacing} units (dx=${gapX.toFixed(1)}, dz=${gapZ.toFixed(1)}).`,
        racerIds: frozenArray([previous.racerId, current.racerId]),
      }));
    }
  }

  for (const prop of solids) {
    const overlapsX = prop.transform.x + prop.extents.width / 2 >= corridor.from && prop.transform.x - prop.extents.width / 2 <= corridor.to;
    const overlapsZ = Math.abs(prop.transform.z) - prop.extents.depth / 2 <= corridor.halfWidth;
    if (overlapsX && overlapsZ) {
      violations.push(Object.freeze({
        code: 'blocked',
        message: `Solid prop "${prop.id}" (${prop.kind}) intrudes into the release corridor.`,
      }));
    }
  }

  return Object.freeze({ ok: violations.length === 0, violations: frozenArray(violations) });
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export interface ReservationRecord {
  readonly resourceId: string;
  readonly holderId: RacerId;
  readonly tick: number;
}

export type ReservationOutcome =
  | { readonly ok: true; readonly status: 'created' | 'already-held'; readonly record: ReservationRecord }
  | { readonly ok: false; readonly status: 'conflict'; readonly resourceId: string; readonly holderId: RacerId; readonly heldBy: RacerId; readonly heldSinceTick: number };

export interface ReservationLedger {
  readonly size: number;
  reserve(resourceId: string, holderId: RacerId, tick: number): ReservationOutcome;
  release(resourceId: string, holderId: RacerId): boolean;
  releaseAllFor(holderId: RacerId): readonly string[];
  holderOf(resourceId: string): RacerId | null;
  isReservedBy(resourceId: string, holderId: RacerId): boolean;
  snapshot(): readonly ReservationRecord[];
  clear(): void;
}

export function createReservationLedger(): ReservationLedger {
  const held = new Map<string, ReservationRecord>();
  return {
    get size() { return held.size; },
    reserve: (resourceId, holderId, tick) => {
      if (typeof resourceId !== 'string' || resourceId === '') {
        throw new ContractError('E_RESERVATION', 'A reservation needs a non-empty resource ID.');
      }
      if (!isSafeRacerId(holderId)) {
        throw new ContractError('E_RACER_ID', `Reservation holder ${String(holderId)} is not a valid racer ID.`);
      }
      if (!Number.isInteger(tick) || tick < 0) {
        throw new ContractError('E_TICK', `Reservation tick ${String(tick)} must be a non-negative integer.`);
      }
      const existing = held.get(resourceId);
      if (existing && existing.holderId === holderId) {
        // Repeating your own reservation is harmless and must not move its timestamp.
        return Object.freeze({ ok: true as const, status: 'already-held' as const, record: existing });
      }
      if (existing) {
        return Object.freeze({
          ok: false as const, status: 'conflict' as const, resourceId, holderId,
          heldBy: existing.holderId, heldSinceTick: existing.tick,
        });
      }
      const record: ReservationRecord = Object.freeze({ resourceId, holderId, tick });
      held.set(resourceId, record);
      return Object.freeze({ ok: true as const, status: 'created' as const, record });
    },
    release: (resourceId, holderId) => {
      const existing = held.get(resourceId);
      if (!existing || existing.holderId !== holderId) return false;
      held.delete(resourceId);
      return true;
    },
    releaseAllFor: (holderId) => {
      const released: string[] = [];
      for (const [resourceId, record] of held) if (record.holderId === holderId) released.push(resourceId);
      for (const resourceId of released) held.delete(resourceId);
      return frozenArray(released.sort());
    },
    holderOf: (resourceId) => held.get(resourceId)?.holderId ?? null,
    isReservedBy: (resourceId, holderId) => held.get(resourceId)?.holderId === holderId,
    snapshot: () => frozenArray([...held.values()].sort((a, b) => a.resourceId.localeCompare(b.resourceId))),
    clear: () => held.clear(),
  };
}

/** Corridors are reserved like any other resource; this keeps the key format in one place. */
export const corridorReservationKey = (corridorId: string) => `corridor:${corridorId}`;

export function isReleaseCorridor(value: unknown): value is ReleaseCorridor {
  if (typeof value !== 'object' || value === null) return false;
  const corridor = value as ReleaseCorridor;
  return typeof corridor.id === 'string' && isFiniteNumber(corridor.from) && isFiniteNumber(corridor.to)
    && corridor.to > corridor.from && isFiniteNumber(corridor.halfWidth) && isFiniteNumber(corridor.minSpacing)
    && isFiniteNumber(corridor.clearanceSeconds);
}
