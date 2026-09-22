/**
 * T01 — stable racer identity and dense-index lookup.
 *
 * Rules frozen here for every later ticket:
 * - A racer ID is a stable, non-negative safe integer. It is **never** re-used inside a
 *   run and never derived from array position.
 * - Dense indices (0..size-1) are a lookup convenience only. They are recomputed from the
 *   ID list, so adding or removing participants never renumbers an existing racer.
 * - No bit shifts, bit masks or `1 << id` anywhere: T02 has to support 100 participants and
 *   `1 << 32` wraps in JavaScript.
 */

import { ContractError, frozenArray, isSafeRacerId } from './core';

export type RacerId = number;

export interface RacerRegistry {
  readonly size: number;
  /** Insertion (stable) order; index `i` always corresponds to `idAt(i)`. */
  readonly ids: readonly RacerId[];
  indexOf(id: RacerId): number;
  idAt(index: number): RacerId | undefined;
  has(id: RacerId): boolean;
  /** Dense index or a typed failure — for call sites that treat a miss as a bug. */
  requireIndex(id: RacerId): number;
  /** 0..size-1. Useful for capacity assertions; never a racer identity. */
  denseIndices(): readonly number[];
}

export function createRacerRegistry(ids: readonly RacerId[]): RacerRegistry {
  const order: RacerId[] = [];
  const index = new Map<RacerId, number>();
  for (const id of ids) {
    if (!isSafeRacerId(id)) {
      throw new ContractError('E_RACER_ID', `Racer ID ${String(id)} is not a non-negative safe integer.`, { id });
    }
    if (index.has(id)) {
      throw new ContractError('E_DUPLICATE_RACER', `Racer ID ${id} appears more than once; identity must be unique.`, { id });
    }
    index.set(id, order.length);
    order.push(id);
  }

  const indexOf = (id: RacerId) => (isSafeRacerId(id) ? index.get(id) ?? -1 : -1);
  const frozenIds = frozenArray(order);

  return {
    size: frozenIds.length,
    ids: frozenIds,
    indexOf,
    idAt: (position: number) => (Number.isInteger(position) && position >= 0 ? frozenIds[position] : undefined),
    has: (id: RacerId) => indexOf(id) !== -1,
    requireIndex: (id: RacerId) => {
      const position = indexOf(id);
      if (position === -1) {
        throw new ContractError('E_UNKNOWN_RACER', `Racer ID ${id} is not part of this field.`, { id, known: frozenIds });
      }
      return position;
    },
    denseIndices: () => frozenArray(frozenIds.map((_, position) => position)),
  };
}

/** Racer IDs of a dense-index-keyed structure, in the registry's stable order. */
export function orderedIds(registry: RacerRegistry): readonly RacerId[] {
  return registry.ids;
}

/**
 * A participant slot for the current heat: identity plus the field-local index the
 * simulation may use for array storage. `index` is assignment metadata, never identity.
 */
export interface ParticipantSlot {
  readonly id: RacerId;
  readonly index: number;
}

export function participantSlots(registry: RacerRegistry): readonly ParticipantSlot[] {
  return frozenArray(registry.ids.map((id, index) => Object.freeze({ id, index })));
}
