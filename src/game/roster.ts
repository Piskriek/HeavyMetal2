/**
 * T02 — dynamic roster construction and scale-safe runtime helpers.
 *
 * Everything here is pure (no DOM, no three.js, no React) so the roster rules can be
 * tested headlessly. The frozen identity contract (`contracts/identity`) is the source
 * of truth for IDs: dense, stable, never derived from bit tricks.
 *
 * Compatibility rule (issue #35): a four-racer field must reproduce the legacy game
 * exactly — same lanes `[2, 0, 1, 3]`, same paces, same `opponentLoadouts()` mapping,
 * same stagger, launch spread, finish bonus and cup points. Larger fields (20/50/100)
 * get deterministic, bounded replacements for every formula that used to assume four.
 */

import { MAX_RACERS } from './contracts/config';
import { createRacerRegistry, type RacerId, type RacerRegistry } from './contracts/identity';
import { CAPSULES, RIDERS, opponentLoadouts, type Loadout } from './loadouts';
// Type-only import: erased at runtime, so there is no session ↔ roster import cycle.
import type { Difficulty } from './session';
import { RACER_DEFINITIONS, type RacerStanding } from './types';

/** The local player always owns racer ID 0. Stable across every supported field size. */
export const PLAYER_ID: RacerId = 0;

export interface RosterEntry {
  readonly id: RacerId;
  readonly name: string;
  readonly color: string;
  readonly homeLane: number;
  readonly pace: number;
  readonly loadout: Loadout;
  readonly isPlayer: boolean;
}

const LEGACY_LANES: readonly number[] = RACER_DEFINITIONS.map((definition) => definition.homeLane);
const LEGACY_COLORS: readonly string[] = RACER_DEFINITIONS.map((definition) => definition.color);

/** Rim/standing colours cycle for large fields; the player keeps the legacy orange. */
const FIELD_COLORS: readonly string[] = [
  '#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77',
  '#e88f8f', '#7fb2e5', '#a9c18a', '#db9374',
];

/** Canonical colour for a racer ID (legacy definitions first, then the field palette). */
export function rosterColor(id: number): string {
  if (id >= 0 && id < RACER_DEFINITIONS.length) return RACER_DEFINITIONS[id].color;
  return FIELD_COLORS[id % FIELD_COLORS.length];
}

/** Deterministic [0,1) hash of a racer ID — identity-based, never array-order-based. */
export function hash01(id: number): number {
  const value = Math.sin(id * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Loadouts for a field of `fieldSize`. Four reproduces `opponentLoadouts` exactly
 * (player first, then the three remaining riders on their signature capsules). Larger
 * fields cycle the twelve rider/capsule combinations deterministically.
 */
export function buildRosterLoadouts(fieldSize: number, playerLoadout: Loadout): Loadout[] {
  if (fieldSize <= 4) return opponentLoadouts(playerLoadout);
  const out: Loadout[] = [{ ...playerLoadout }];
  for (let id = 1; id < fieldSize; id++) {
    const rider = RIDERS[id % RIDERS.length];
    const capsule = CAPSULES[Math.floor(id / RIDERS.length) % CAPSULES.length];
    out.push({ rider: rider.id, capsule: capsule.id });
  }
  return out;
}

/**
 * Full participant list for a field. IDs are dense from 0 with the player at
 * `PLAYER_ID`; the registry build at the end proves uniqueness.
 */
export function buildRoster(fieldSize: number, playerLoadout: Loadout): RosterEntry[] {
  const size = clampFieldSize(fieldSize);
  const loadouts = buildRosterLoadouts(size, playerLoadout);
  const entries: RosterEntry[] = loadouts.map((loadout, id) => {
    if (id < RACER_DEFINITIONS.length && size <= 4) {
      // Legacy field: the original four definitions, untouched.
      const definition = RACER_DEFINITIONS[id];
      return {
        id, name: definition.name, color: definition.color, homeLane: definition.homeLane,
        pace: definition.pace, loadout, isPlayer: id === PLAYER_ID,
      };
    }
    const riderName = RIDERS[id % RIDERS.length].name.toUpperCase();
    return {
      id,
      name: id === PLAYER_ID ? 'YOU' : `${riderName} ${String(id).padStart(2, '0')}`,
      color: id === PLAYER_ID ? LEGACY_COLORS[0] : FIELD_COLORS[id % FIELD_COLORS.length],
      homeLane: LEGACY_LANES[id % LEGACY_LANES.length],
      // Bounded ±2.5% pace spread, deterministic per identity — never grows with the count.
      pace: id === PLAYER_ID ? 1 : 0.975 + hash01(id) * 0.05,
      loadout,
      isPlayer: id === PLAYER_ID,
    };
  });
  createRacerRegistry(entries.map((entry) => entry.id));
  return entries;
}

/** Registry for a built roster — the engine's stable-identity lookup table. */
export function rosterRegistry(roster: readonly RosterEntry[]): RacerRegistry {
  return createRacerRegistry(roster.map((entry) => entry.id));
}

export function clampFieldSize(fieldSize: number): number {
  if (!Number.isFinite(fieldSize) || fieldSize < 2) return 4;
  return Math.min(MAX_RACERS, Math.floor(fieldSize));
}

/* -------------------------------------------------------------------------- */
/* Scale-safe replacements for four-racer assumptions                          */
/* -------------------------------------------------------------------------- */

/**
 * Unique key for an unordered racer pair. The legacy engine used `i * 4 + j` into a
 * 16-slot table — that aliases for any field above four. This is a plain integer mix
 * (no bit shifts), collision-free for any two distinct safe-integer IDs below 2^20.
 */
export function pairKey(idA: RacerId, idB: RacerId): number {
  const lo = Math.min(idA, idB);
  const hi = Math.max(idA, idB);
  return lo * 1048576 + hi;
}

/**
 * AI decision phase offset. Four racers keep the legacy linear ramp (`id * 0.023`);
 * larger fields hash the identity into a fixed window, so a 100-racer field staggers
 * inside the same 0.3 s band instead of waiting 2.3 s for the last CPU. The physics
 * tick rate is untouched either way.
 */
export function cpuDecisionStagger(id: RacerId, fieldSize: number, span = 0.3): number {
  if (id === PLAYER_ID) return 0;
  if (fieldSize <= 4) return id * 0.023;
  return hash01(id + 0.5) * span;
}

/**
 * Launch-angle spread in degrees. Legacy: player 0, CPUs `(id - 2) * 1.2`. Larger
 * fields fold the ID into the same ±2.4° envelope instead of fanning out unbounded.
 */
export function launchAngleOffset(id: RacerId, fieldSize: number): number {
  if (id === PLAYER_ID) return 0;
  if (fieldSize <= 4) return (id - 2) * 1.2;
  return ((id % 5) - 2) * 1.2;
}

/**
 * Finish bonus on top of the 3000 completion award. The legacy formula is
 * `(4 - position) * 500` → 1500/1000/500/0; the general form below reproduces those
 * four values exactly and scales to any field size.
 */
export function finishPositionBonus(position: number, fieldSize: number): number {
  const size = Math.max(2, fieldSize);
  const rank = Math.min(Math.max(1, position), size);
  return Math.round(((size - rank) / (size - 1)) * 1500);
}

/* -------------------------------------------------------------------------- */
/* Bounded HUD / results selection                                             */
/* -------------------------------------------------------------------------- */

/** Trackbar pip budget: the player, the leaders, and the closest rivals. */
export const HUD_MAX_PIPS = 12;
/** Results tables show at most this many rows plus an explicit "of N" note. */
export const RESULTS_MAX_ROWS = 24;

/**
 * Bounded pip selection for the race trackbar. Always includes the local player;
 * fills the remaining budget with the top-ranked racers, then the nearest rivals by
 * distance. Deterministic: sorted by race position on the way out.
 */
export function trackbarRacers(standings: readonly RacerStanding[], playerId: RacerId, max = HUD_MAX_PIPS): RacerStanding[] {
  if (standings.length <= max) return [...standings].sort((a, b) => a.position - b.position);
  const player = standings.find((entry) => entry.id === playerId) ?? null;
  const chosen = new Map<RacerId, RacerStanding>();
  if (player) chosen.set(player.id, player);
  const leaders = [...standings].sort((a, b) => a.position - b.position);
  const leaderBudget = Math.max(1, Math.ceil((max - 1) / 2));
  for (const entry of leaders.slice(0, leaderBudget)) chosen.set(entry.id, entry);
  if (player) {
    const rivals = standings
      .filter((entry) => !chosen.has(entry.id))
      .sort((a, b) => Math.abs(a.distance - player.distance) - Math.abs(b.distance - player.distance) || a.position - b.position);
    for (const entry of rivals) {
      if (chosen.size >= max) break;
      chosen.set(entry.id, entry);
    }
  }
  return [...chosen.values()].sort((a, b) => a.position - b.position).slice(0, max);
}

/**
 * Bounded rows for a results table. The player is always kept; when the field is
 * larger than the budget the caller must show `total` so nothing is silently dropped.
 */
export function resultRows(
  standings: readonly RacerStanding[],
  playerId: RacerId,
  max = RESULTS_MAX_ROWS,
): { rows: RacerStanding[]; total: number; capped: boolean } {
  const sorted = [...standings].sort((a, b) => a.position - b.position);
  if (sorted.length <= max) return { rows: sorted, total: sorted.length, capped: false };
  const rows = sorted.slice(0, max - 1);
  const player = standings.find((entry) => entry.id === playerId);
  if (player && !rows.some((entry) => entry.id === playerId)) rows.push(player);
  rows.sort((a, b) => a.position - b.position);
  return { rows, total: sorted.length, capped: true };
}

/* -------------------------------------------------------------------------- */
/* Obstacle hit ledger — scalable replacement for `hitMask |= 1 << racerId`    */
/* -------------------------------------------------------------------------- */

export interface ObstacleHitLedger {
  /** Racer IDs that have already triggered this obstacle. Replaces the 32-bit mask. */
  hitBy?: Set<RacerId>;
}

/** Records a hit once per racer. Safe for IDs far beyond 31 — there are no bit tricks. */
export function recordObstacleHit(obstacle: ObstacleHitLedger, id: RacerId): void {
  (obstacle.hitBy ??= new Set<RacerId>()).add(id);
}

export function obstacleHitBy(obstacle: ObstacleHitLedger, id: RacerId): boolean {
  return obstacle.hitBy?.has(id) ?? false;
}

export function obstacleHitCount(obstacle: ObstacleHitLedger): number {
  return obstacle.hitBy?.size ?? 0;
}

/** CPU difficulty reaction times (seconds), shared by the engine and the tests. */
export function cpuReactionSeconds(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 0.43 : difficulty === 'veteran' ? 0.13 : 0.19;
}
