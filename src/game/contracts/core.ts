/**
 * T01 — shared contract primitives.
 *
 * Everything under `src/game/contracts/` is **pure**: no DOM, no canvas, no three.js and
 * no React. These modules may only import each other plus the DOM-free data modules
 * (`types.ts`, `loadouts.ts`, `session.ts`). That restriction is what lets tests, the
 * headless stepping seam and the T02+ migration run outside a browser.
 *
 * The contracts are additive: nothing here rewrites `engine.ts`. Downstream tickets
 * migrate onto these interfaces one area at a time (see docs/CONTRACTS.md).
 */

/** Bumped whenever a contract changes shape in a way downstream code must notice. */
export const CONTRACTS_VERSION = 1;

export type ContractErrorCode =
  | 'E_CONTRACT_SHAPE'
  | 'E_RACER_ID'
  | 'E_DUPLICATE_RACER'
  | 'E_UNKNOWN_RACER'
  | 'E_FIELD_SIZE'
  | 'E_QUALIFYING_DISABLED'
  | 'E_PHASE_TRANSITION'
  | 'E_PARTICIPANTS'
  | 'E_EFFECT'
  | 'E_PICKUP_CLAIM'
  | 'E_PROP_DEFINITION'
  | 'E_DUPLICATE_PROP'
  | 'E_DOUBLE_SCALE'
  | 'E_CORRIDOR'
  | 'E_RESERVATION'
  | 'E_COMMAND'
  | 'E_TICK';

/** Typed failure so callers and tests branch on a stable code instead of a message. */
export class ContractError extends Error {
  readonly code: ContractErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(code: ContractErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.detail = Object.freeze({ ...detail });
  }
}

export const isContractError = (value: unknown): value is ContractError => value instanceof ContractError;

/** Narrows to a non-null plain object (not an array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isSafeRacerId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Freezes an array and returns it as a readonly array. */
export function frozenArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

/** Non-null plain-object clone that drops prototype pollution keys. */
export function safeRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = entry;
  }
  return out;
}
