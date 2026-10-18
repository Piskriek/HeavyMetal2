// ============================================================================
// File: apps/web/src/net/coop-guardrails.test.ts
// Unit tests for coop-guardrails.ts (TICKET-11: role matrix, token-bucket rate limiter,
// per-author undo log, and POL-84 / POL-85 slot claim & sync-mode persistence).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, createWorld, withBridgeStore, type WorldEnv } from '../base/world';
import { STARTER } from '../base/catalog';
import {
  canRun,
  claimAndStoreSlot,
  claimPlotSlot,
  readPlaySyncMode,
  readStoredSlot,
  recordAuthorBuild,
  TokenBucketLimiter,
  undoLastByAuthor,
  writePlaySyncMode,
  type StorageLike,
  type UndoLogEntry,
} from './coop-guardrails';

const TEST_ENV: WorldEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: 60 },
};

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

test('TokenBucketLimiter allows bursts up to capacity, rate-limits excess, refills over time, and exempts owner', () => {
  const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSec: 2 });

  // Owner is never rate-limited
  for (let i = 0; i < 10; i++) {
    assert.equal(limiter.tryConsume('host-1', 'owner', 0).ok, true);
  }

  // Co-Builder gets 3 burst tokens at t=0
  assert.equal(limiter.tryConsume('cb-1', 'cobuilder', 0).ok, true);
  assert.equal(limiter.tryConsume('cb-1', 'cobuilder', 0).ok, true);
  assert.equal(limiter.tryConsume('cb-1', 'cobuilder', 0).ok, true);

  // 4th command at t=0 is rate-limited
  const fourth = limiter.tryConsume('cb-1', 'cobuilder', 0);
  assert.equal(fourth.ok, false);
  if (!fourth.ok) {
    assert.equal(fourth.why, 'rate-limited');
    assert.equal(fourth.retryAfterMs, 500);
  }

  // Advancing clock by 500 ms refills 1 token (2 tokens/sec)
  assert.equal(limiter.tryConsume('cb-1', 'cobuilder', 500).ok, true);
  assert.equal(limiter.tryConsume('cb-1', 'cobuilder', 500).ok, false);
});

test('undoLastByAuthor reverts only the target Co-Builder last build and preserves Lead Architect pieces', () => {
  let w = withBridgeStore(createWorld(1), TEST_ENV, [
    { item: 'ore', n: 1000 },
    { item: 'prim-cube', n: 50 },
    { item: 'map-basalt', n: 50 },
  ]);
  const shelterRes = apply(w, TEST_ENV, { t: 'shelter', cx: 8, cz: 8, yaw: 0 });
  w = shelterRes.world;
  const placedBy: Record<number, string> = {};
  for (const p of w.base.pieces) placedBy[p.id] = 'host-1';

  const stId = w.base.structures[0]!.id;
  const cbPlace = apply(w, TEST_ENV, {
    t: 'place',
    at: { x: 8, z: 8 },
    blueprint: STARTER,
    piece: { s: stId, kind: 'foundation', i: 1, j: 0, k: 0, r: 0 },
  });
  assert.equal(cbPlace.events[0]?.type, 'placed');
  const cbPieceId = (cbPlace.events[0] as { type: 'placed'; id: number }).id;
  w = cbPlace.world;
  placedBy[cbPieceId] = 'cb-1';

  let undoLog: UndoLogEntry[] = [];
  undoLog = recordAuthorBuild(undoLog, {
    actorId: 'cb-1',
    username: 'BuilderBob',
    role: 'cobuilder',
    version: 2,
    cmdKind: 'place',
    pieceIds: [cbPieceId],
    at: 100,
  });

  // Co-Builder cannot remove host's foundation
  const hostPieceId = shelterRes.world.base.pieces[0]!.id;
  assert.equal(
    canRun('cobuilder', { t: 'remove', at: { x: 8, z: 8 }, id: hostPieceId }, w, 'cb-1', placedBy).ok,
    false
  );

  // Lead Architect undoes cb-1's last build
  const undone = undoLastByAuthor(w, TEST_ENV, placedBy, undoLog, 'cb-1');
  assert.equal(undone.ok, true);
  assert.equal(undone.world.base.pieces.some((p) => p.id === cbPieceId), false);
  assert.equal(undone.world.base.pieces.some((p) => p.id === hostPieceId), true);
  assert.equal(undone.undoLog.length, 0);
});

test('POL-84 & POL-85: claimPlotSlot, claimAndStoreSlot, and readPlaySyncMode / writePlaySyncMode persist deterministically', () => {
  const storage = new MemoryStorage();
  assert.equal(readPlaySyncMode(storage), 'synced');
  writePlaySyncMode('desynced', storage);
  assert.equal(readPlaySyncMode(storage), 'desynced');

  const slotA = claimAndStoreSlot('PLOT_CODE_ALPHA', storage);
  assert.ok(slotA >= 0);
  assert.equal(readStoredSlot(storage), slotA);
  assert.equal(claimPlotSlot('PLOT_CODE_ALPHA', [slotA]), slotA);

  const slotB = claimPlotSlot('PLOT_CODE_BETA', [slotA]);
  assert.notEqual(slotB, slotA);
});
