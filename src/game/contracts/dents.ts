/**
 * T01 — dent state and the immutable/read-only render contract around it.
 *
 * Frozen rules for T09–T11:
 * - The simulation owns dents. The renderer only ever *reads* them and must never write a
 *   dent direction back or keep a competing roll state.
 * - Exactly three dent slots. A new impact either merges into a slot facing the same way,
 *   fills a free slot, or displaces the weakest slot — deterministically.
 * - There is an aggregate displacement cap; overlapping impacts cannot exceed it.
 * - Recovery is exponential and the 50% repair notice fires exactly once per peak.
 *
 * Every function here is pure and returns new objects; the previous state is untouched.
 */

import { clamp, frozenArray, isFiniteNumber } from './core';
import type { RacerId } from './identity';

export const DENT_SLOTS = 3;
/** Aggregate displacement cap in world units, shared by every slot on one racer. */
export const DENT_MAX_TOTAL_DEPTH = 18;
/** Impacts below this severity are cosmetic and do not create or grow a dent. */
export const DENT_MIN_IMPACT = 0.12;
/** Above this cosine, an impact merges into an existing slot instead of opening a new one. */
export const DENT_MERGE_COSINE = 0.82;
/** Per-slot ceiling so one direction can never consume the whole budget. */
export const DENT_MAX_SLOT_DEPTH = DENT_MAX_TOTAL_DEPTH * 0.6;
/** Fraction of the peak displacement that counts as repaired. */
export const DENT_REPAIR_FRACTION = 0.5;
/** Exponential recovery rate per second. */
export const DENT_RECOVERY_RATE = 0.35;

export type DentMergePolicy = 'merge-nearest' | 'append-weakest';

export interface DentDirection {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DentImpulse {
  readonly direction: DentDirection;
  /** Closing speed / specific impulse, in the documented severity units. */
  readonly severity: number;
  readonly tick: number;
  readonly sourceId?: RacerId;
}

export interface DentSlot {
  readonly direction: DentDirection;
  readonly depth: number;
  readonly severity: number;
  readonly tick: number;
  /** How many impacts merged into this slot. */
  readonly count: number;
}

export interface DentState {
  readonly slots: readonly DentSlot[];
  /** Largest aggregate depth this racer has reached; the repair threshold is relative to it. */
  readonly peak: number;
  /** True once the exactly-once repair notice has been emitted for the current damage. */
  readonly repaired: boolean;
}

export function createDentState(): DentState {
  return Object.freeze({ slots: frozenArray<DentSlot>([]), peak: 0, repaired: false });
}

export function normalizeDirection(direction: DentDirection): DentDirection {
  const x = isFiniteNumber(direction.x) ? direction.x : 0;
  const y = isFiniteNumber(direction.y) ? direction.y : 0;
  const z = isFiniteNumber(direction.z) ? direction.z : 0;
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return Object.freeze({ x: 0, y: -1, z: 0 });
  return Object.freeze({ x: x / length, y: y / length, z: z / length });
}

export const dentDot = (a: DentDirection, b: DentDirection) => a.x * b.x + a.y * b.y + a.z * b.z;

export function dentTotalDepth(state: DentState): number {
  let total = 0;
  for (const slot of state.slots) total += slot.depth;
  return total;
}

/**
 * Applies one impact. `policy` may only pick between the documented behaviours; the
 * aggregate cap is enforced afterwards by scaling every slot proportionally, so a second
 * overlapping impact can never push the total above `DENT_MAX_TOTAL_DEPTH`.
 */
export function applyDent(state: DentState, impulse: DentImpulse, policy: DentMergePolicy = 'merge-nearest'): DentState {
  if (!isFiniteNumber(impulse.severity) || impulse.severity < DENT_MIN_IMPACT) return state;
  const direction = normalizeDirection(impulse.direction);
  const depth = Math.min(impulse.severity, DENT_MAX_SLOT_DEPTH);
  const slots: DentSlot[] = state.slots.map((slot) => ({ ...slot, direction: { ...slot.direction } }));

  let merged = false;
  if (policy === 'merge-nearest') {
    let bestIndex = -1;
    let bestDot = DENT_MERGE_COSINE;
    for (let index = 0; index < slots.length; index++) {
      const dot = dentDot(slots[index].direction, direction);
      if (dot >= bestDot) { bestDot = dot; bestIndex = index; }
    }
    if (bestIndex >= 0) {
      const current = slots[bestIndex];
      const nextDepth = Math.min(DENT_MAX_SLOT_DEPTH, current.depth + depth);
      slots[bestIndex] = Object.freeze({
        direction: normalizeDirection({
          x: current.direction.x + direction.x * 0.25,
          y: current.direction.y + direction.y * 0.25,
          z: current.direction.z + direction.z * 0.25,
        }),
        depth: nextDepth,
        severity: Math.max(current.severity, impulse.severity),
        tick: impulse.tick,
        count: current.count + 1,
      });
      merged = true;
    }
  }

  if (!merged) {
    const fresh: DentSlot = Object.freeze({
      direction, depth, severity: impulse.severity, tick: impulse.tick, count: 1,
    });
    if (slots.length < DENT_SLOTS) slots.push(fresh);
    else {
      // Replace the weakest slot; an exact tie always replaces the lowest index.
      let weakest = 0;
      for (let index = 1; index < slots.length; index++) if (slots[index].depth < slots[weakest].depth) weakest = index;
      slots[weakest] = fresh;
    }
  }

  // Aggregate cap: scale everything down proportionally so the relative shape is preserved.
  let total = 0;
  for (const slot of slots) total += slot.depth;
  if (total > DENT_MAX_TOTAL_DEPTH && total > 0) {
    const scale = DENT_MAX_TOTAL_DEPTH / total;
    for (let index = 0; index < slots.length; index++) {
      slots[index] = Object.freeze({ ...slots[index], depth: slots[index].depth * scale });
    }
    total = DENT_MAX_TOTAL_DEPTH;
  }

  return Object.freeze({
    slots: frozenArray(slots.map((slot) => Object.freeze({ ...slot }))),
    peak: Math.max(state.peak, total),
    repaired: total === 0 ? state.repaired : false,
  });
}

export interface DentRecovery {
  readonly state: DentState;
  /** True only on the tick the repair notice must fire. */
  readonly repaired: boolean;
  /** True when the state changed at all; lets the simulation skip pointless snapshots. */
  readonly changed: boolean;
}

/** Exponential recovery. The repair notice fires exactly once per damage peak. */
export function recoverDents(state: DentState, seconds: number): DentRecovery {
  if (!isFiniteNumber(seconds) || seconds <= 0 || state.slots.length === 0) {
    return Object.freeze({ state, repaired: false, changed: false });
  }
  const decay = Math.exp(-DENT_RECOVERY_RATE * seconds);
  const slots = state.slots
    .map((slot) => Object.freeze({ ...slot, depth: slot.depth * decay }))
    .filter((slot) => slot.depth > 0.05);
  const total = slots.reduce((sum, slot) => sum + slot.depth, 0);
  const threshold = state.peak * DENT_REPAIR_FRACTION;
  const repaired = !state.repaired && state.peak > 0 && total <= threshold;
  return Object.freeze({
    state: Object.freeze({ slots: frozenArray(slots), peak: slots.length ? state.peak : 0, repaired: state.repaired || repaired }),
    repaired,
    changed: slots.length !== state.slots.length || total !== dentTotalDepth(state) || repaired,
  });
}

/** Immutable copy used by snapshot/reset paths: never shares slot arrays with `state`. */
export function cloneDentState(state: DentState): DentState {
  return Object.freeze({
    slots: frozenArray(state.slots.map((slot) => Object.freeze({ ...slot, direction: { ...slot.direction } }))),
    peak: state.peak,
    repaired: state.repaired,
  });
}

/** Read-only view for the renderer. Writing to it is a programming error, not a feature. */
export interface DentRenderView {
  readonly slots: readonly Readonly<DentSlot>[];
  readonly totalDepth: number;
  readonly clamped: number;
}

export function dentRenderView(state: DentState): DentRenderView {
  const total = dentTotalDepth(state);
  return Object.freeze({
    slots: frozenArray(state.slots.map((slot) => Object.freeze({ ...slot, direction: Object.freeze({ ...slot.direction }) }))),
    totalDepth: total,
    clamped: clamp(total / DENT_MAX_TOTAL_DEPTH, 0, 1),
  });
}
