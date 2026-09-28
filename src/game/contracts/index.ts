/**
 * T01 — public contract surface.
 *
 * Import everything frozen by this ticket from here:
 *
 * ```ts
 * import { normalizeRaceConfig, createHeatState, createPropRegistry } from '@/game/contracts';
 * ```
 *
 * Rules that hold for the whole namespace (see docs/CONTRACTS.md):
 * 1. Pure data and pure functions only. No DOM, no canvas, no three.js, no React, no I/O.
 * 2. Gameplay effects are `fuel | shield | bounce`; mystery is resolved once, never stored.
 * 3. Racer identity is a stable ID; array indices are lookup only and never identity.
 * 4. The renderer reads frozen plain data and writes nothing back.
 * 5. Illegal anything returns a typed refusal (`ContractError` or a discriminated result),
 *    never a silent repair.
 */

export * from './core';
export * from './identity';
export * from './config';
export * from './timing';
export * from './effects';
export * from './events';
export * from './qualifying';
export * from './heat';
export * from './props';
export * from './release';
export * from './dents';
export * from './render';
export * from './commands';
export * from './stepping';
