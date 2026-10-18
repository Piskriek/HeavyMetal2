// ============================================================================
// File: apps/web/src/net/coop-guardrails.ts
// TICKET-11 (Plan 36 Phase 2 — Roles, Guardrails, Rate Limiting & Per-Author Undo):
// - Role permission matrix for Lead Architect ('owner'), Co-Builder ('cobuilder'),
//   and Field Observer ('visitor')
// - Token-bucket command rate limiter (default 60 burst, 20 cmd/s refill; owner exempt)
// - Per-author build log and Lead Architect one-click Undo (undoLastByAuthor)
// - Re-exports POL-84 / POL-85 sector claim and sync-mode storage helpers
// Pure TypeScript: zero DOM, zero timers, zero network I/O.
// ============================================================================

import { apply, pieceAt, type Applied, type BaseCommand, type BaseWorld, type WorldEnv } from '../base/world';
import {
  canRun,
  ROLE_LABELS,
  ROLE_TABLE,
  roleName,
  type OutpostRole,
  type PlacedBySource,
  type RoleVerdict,
} from './protocol';
import {
  claimAndStoreSlot,
  claimPlotSlot,
  readPlaySyncMode,
  readStoredSlot,
  writePlaySyncMode,
  type PlaySyncMode,
  type StorageLike,
} from '../crafter/shared-planet';

export {
  canRun,
  ROLE_LABELS,
  ROLE_TABLE,
  roleName,
  claimPlotSlot,
  readStoredSlot,
  claimAndStoreSlot,
  readPlaySyncMode,
  writePlaySyncMode,
  type OutpostRole,
  type PlacedBySource,
  type RoleVerdict,
  type PlaySyncMode,
  type StorageLike,
};

export interface CoopPolicy {
  readonly defaultGuestRole: OutpostRole;
  readonly allowCobuilderRemoveAll: boolean;
  readonly allowCobuilderHardpoints: boolean;
}

export const DEFAULT_COOP_POLICY: CoopPolicy = {
  defaultGuestRole: 'cobuilder',
  allowCobuilderRemoveAll: false,
  allowCobuilderHardpoints: false,
};

export interface RateLimitConfig {
  readonly capacity: number;
  readonly refillPerSec: number;
}

/**
 * Default non-owner command rate limit:
 * - 60-token burst so a Co-Builder placing 50 structures in rapid succession or blueprint fills never trips false positives
 * - 20 tokens/sec sustained refill
 * - Lead Architect ('owner') is exempt
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 60,
  refillPerSec: 20,
};

export type RateLimitVerdict =
  | { readonly ok: true; readonly remaining: number }
  | { readonly ok: false; readonly why: 'rate-limited'; readonly retryAfterMs: number };

interface BucketState {
  tokens: number;
  lastMs: number;
}

/**
 * Deterministic token-bucket command rate limiter keyed by playerId and driven by the room's clock (`nowMs`).
 */
export class TokenBucketLimiter {
  private config: RateLimitConfig;
  private readonly buckets = new Map<string, BucketState>();

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = {
      capacity: Math.max(1, config.capacity),
      refillPerSec: Math.max(0.1, config.refillPerSec),
    };
  }

  public setConfig(config: RateLimitConfig): void {
    this.config = {
      capacity: Math.max(1, config.capacity),
      refillPerSec: Math.max(0.1, config.refillPerSec),
    };
    this.buckets.clear();
  }

  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  public tryConsume(
    playerId: string,
    role: OutpostRole,
    nowMs: number,
    cost = 1,
  ): RateLimitVerdict {
    if (role === 'owner') {
      return { ok: true, remaining: Number.POSITIVE_INFINITY };
    }
    const safeNow = Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0;
    let bucket = this.buckets.get(playerId);
    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastMs: safeNow };
      this.buckets.set(playerId, bucket);
    } else if (safeNow > bucket.lastMs) {
      const elapsedSec = (safeNow - bucket.lastMs) / 1000;
      bucket.tokens = Math.min(
        this.config.capacity,
        bucket.tokens + elapsedSec * this.config.refillPerSec,
      );
      bucket.lastMs = safeNow;
    }

    if (bucket.tokens + 1e-9 >= cost) {
      bucket.tokens = Math.max(0, bucket.tokens - cost);
      return { ok: true, remaining: bucket.tokens };
    }

    const deficit = Math.max(0, cost - bucket.tokens);
    const retryAfterMs = Math.ceil((deficit / this.config.refillPerSec) * 1000);
    return { ok: false, why: 'rate-limited', retryAfterMs };
  }

  public clearPlayer(playerId: string): void {
    this.buckets.delete(playerId);
  }
}

// ============================================================================
// Per-Author Build History & One-Click Lead Architect Undo
// ============================================================================

export const MAX_UNDO_LOG = 64;

export interface UndoLogEntry {
  readonly actorId: string;
  readonly username: string;
  readonly role: OutpostRole;
  readonly version: number;
  readonly cmdKind: BaseCommand['t'];
  readonly pieceIds: readonly number[];
  readonly at: number;
}

/**
 * Appends a build action that placed one or more pieces to the bounded undo log.
 */
export function recordAuthorBuild(
  log: readonly UndoLogEntry[],
  entry: UndoLogEntry,
  maxEntries = MAX_UNDO_LOG,
): UndoLogEntry[] {
  if (entry.pieceIds.length === 0) return [...log];
  const next = [...log, entry];
  if (next.length > maxEntries) {
    next.splice(0, next.length - maxEntries);
  }
  return next;
}

/**
 * Finds the most recent undoable piece(s) placed by `targetActorId` that still stand in `world.base.pieces`.
 * Checks `undoLog` newest-first, falling back to `placedBy` (highest piece ID placed by `targetActorId`).
 */
export function findNextUndoCommandsForAuthor(
  world: BaseWorld,
  placedBy: Readonly<Record<number, string>>,
  undoLog: readonly UndoLogEntry[],
  targetActorId: string,
): {
  readonly commands: readonly Extract<BaseCommand, { t: 'remove' }>[];
  readonly remainingLog: UndoLogEntry[];
  readonly undonePieceIds: readonly number[];
} | null {
  const standingById = new Map(world.base.pieces.map((p) => [p.id, p]));

  // 1. Search undoLog newest-first for an entry by targetActorId with at least one standing piece
  for (let idx = undoLog.length - 1; idx >= 0; idx--) {
    const entry = undoLog[idx]!;
    if (entry.actorId !== targetActorId) continue;
    const standingIds = [...entry.pieceIds]
      .filter((id) => standingById.has(id))
      .sort((a, b) => b - a);
    if (standingIds.length === 0) continue;

    const commands: Extract<BaseCommand, { t: 'remove' }>[] = [];
    for (const id of standingIds) {
      const p = standingById.get(id)!;
      const pos = pieceAt(world.base, p) ?? { x: 0, z: 0 };
      commands.push({ t: 'remove', at: { x: pos.x, z: pos.z }, id });
    }
    const remainingLog = undoLog.filter((_, i) => i !== idx);
    return { commands, remainingLog, undonePieceIds: standingIds };
  }

  // 2. Fallback: highest piece ID in placedBy attributed to targetActorId
  const fallbackIds = Object.entries(placedBy)
    .filter(([, owner]) => owner === targetActorId)
    .map(([idStr]) => Number(idStr))
    .filter((id) => standingById.has(id))
    .sort((a, b) => b - a);

  if (fallbackIds.length === 0) return null;
  const topId = fallbackIds[0]!;
  const piece = standingById.get(topId)!;
  const pos = pieceAt(world.base, piece) ?? { x: 0, z: 0 };
  return {
    commands: [{ t: 'remove', at: { x: pos.x, z: pos.z }, id: topId }],
    remainingLog: [...undoLog],
    undonePieceIds: [topId],
  };
}

/**
 * Pure helper executing Lead Architect's one-click Undo for `targetActorId` against `world`.
 */
export function undoLastByAuthor(
  world: BaseWorld,
  env: WorldEnv,
  placedBy: Readonly<Record<number, string>>,
  undoLog: readonly UndoLogEntry[],
  targetActorId: string,
): {
  readonly ok: boolean;
  readonly world: BaseWorld;
  readonly placedBy: Record<number, string>;
  readonly undoLog: UndoLogEntry[];
  readonly appliedCommands: readonly Extract<BaseCommand, { t: 'remove' }>[];
  readonly results: readonly Applied[];
  readonly why?: string;
} {
  const plan = findNextUndoCommandsForAuthor(world, placedBy, undoLog, targetActorId);
  if (!plan) {
    return {
      ok: false,
      world,
      placedBy: { ...placedBy },
      undoLog: [...undoLog],
      appliedCommands: [],
      results: [],
      why: 'nothing-to-undo',
    };
  }

  let curWorld = world;
  const nextPlacedBy: Record<number, string> = { ...placedBy };
  const appliedCommands: Extract<BaseCommand, { t: 'remove' }>[] = [];
  const results: Applied[] = [];

  for (const cmd of plan.commands) {
    if (!curWorld.base.pieces.some((p) => p.id === cmd.id)) continue;
    const res = apply(curWorld, env, cmd);
    if (res.events.some((e) => e.type === 'refused')) continue;
    curWorld = res.world;
    appliedCommands.push(cmd);
    results.push(res);
  }

  if (appliedCommands.length === 0) {
    return {
      ok: false,
      world,
      placedBy: { ...placedBy },
      undoLog: [...undoLog],
      appliedCommands: [],
      results: [],
      why: 'undo-refused',
    };
  }

  const afterIds = new Set(curWorld.base.pieces.map((p) => p.id));
  for (const key of Object.keys(nextPlacedBy)) {
    const numId = Number(key);
    if (!afterIds.has(numId)) delete nextPlacedBy[numId];
  }

  return {
    ok: true,
    world: curWorld,
    placedBy: nextPlacedBy,
    undoLog: plan.remainingLog,
    appliedCommands,
    results,
  };
}
