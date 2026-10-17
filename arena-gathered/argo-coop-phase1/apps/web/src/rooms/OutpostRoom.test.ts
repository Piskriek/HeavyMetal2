// ============================================================================
// File: apps/web/src/rooms/OutpostRoom.test.ts
// Unit tests for OutpostRoom (Plan 36 Phase 1 Deliverable 2).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import OutpostRoom, { PRESENCE_INTERVAL_MS } from './OutpostRoom';
import { PROTOCOL_VERSION, computeWorldHash, type OutpostMessage } from '../net/protocol';
import type { Player } from '@series-inc/rundot-game-sdk/mp-server';

function makePlayer(id: string, username = id): Player {
  return { id, username, connected: true };
}

test('OutpostRoom validates roles, broadcasts applied events with version, and sends refusals only to sender', () => {
  const room = new OutpostRoom();
  const sentTo: { playerId: string; msg: OutpostMessage }[] = [];
  const broadcasts: OutpostMessage[] = [];
  let intervalMs = 0;

  (room as unknown as { sendTo: (id: string, m: OutpostMessage) => void }).sendTo = (playerId, msg) => {
    sentTo.push({ playerId, msg });
  };
  (room as unknown as { broadcast: (m: OutpostMessage) => void }).broadcast = (msg) => {
    broadcasts.push(msg);
  };
  (room as unknown as { clock: { setInterval: (cb: () => void, ms: number) => void } }).clock = {
    setInterval(_cb: () => void, ms: number) {
      intervalMs = ms;
    },
  };

  room.onCreate();
  assert.equal(intervalMs, PRESENCE_INTERVAL_MS, 'Registers 10 Hz (100 ms) presence timer on this.clock');

  const host = makePlayer('host-1', 'LeadGoblin');
  const cobuilder = makePlayer('cb-1', 'BuilderBob');
  const visitor = makePlayer('vis-1', 'ObserverEve');

  room.onPlayerJoin(host);
  room.onPlayerJoin(cobuilder);
  room.onPlayerJoin(visitor);

  // Promote/demote visitor explicitly to 'visitor' (Field Observer)
  room.onGameMessage({
    sender: host,
    payload: { type: 'setRole', targetId: visitor.id, role: 'visitor' },
  });

  // 1. Host places starter shelter -> broadcast 'events' at version 1
  broadcasts.length = 0;
  room.onGameMessage({
    sender: host,
    payload: {
      type: 'cmd',
      proto: PROTOCOL_VERSION,
      seq: 1,
      baseVersion: 0,
      cmd: { t: 'shelter', cx: 8, cz: 8, yaw: 0 },
    },
  });
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0]!.type, 'events');
  if (broadcasts[0]!.type === 'events') {
    assert.equal(broadcasts[0]!.version, 1);
    assert.equal(broadcasts[0]!.worldHash, computeWorldHash(room.getWorld()));
  }

  // 2. Visitor tries to remove host's foundation -> refused sent ONLY to visitor, zero broadcast
  sentTo.length = 0;
  broadcasts.length = 0;
  const hostPieceId = room.getWorld().base.pieces[0]!.id;
  room.onGameMessage({
    sender: visitor,
    payload: {
      type: 'cmd',
      proto: PROTOCOL_VERSION,
      seq: 1,
      baseVersion: 1,
      cmd: { t: 'remove', at: { x: 8, z: 8 }, id: hostPieceId },
    },
  });
  assert.equal(broadcasts.length, 0, 'Refused command is never broadcast');
  assert.equal(sentTo.length, 1, 'Refusal sent only to the sender');
  assert.equal(sentTo[0]!.playerId, visitor.id);
  assert.equal(sentTo[0]!.msg.type, 'refused');

  // 3. Co-Builder tries to remove host's foundation -> refused ('owner-piece-protected')
  sentTo.length = 0;
  room.onGameMessage({
    sender: cobuilder,
    payload: {
      type: 'cmd',
      proto: PROTOCOL_VERSION,
      seq: 2,
      baseVersion: 1,
      cmd: { t: 'remove', at: { x: 8, z: 8 }, id: hostPieceId },
    },
  });
  assert.equal(sentTo.length, 1);
  assert.equal(sentTo[0]!.playerId, cobuilder.id);
  if (sentTo[0]!.msg.type === 'refused') {
    assert.equal(sentTo[0]!.msg.why, 'owner-piece-protected');
  }

  // 4. Persistence round-trip via getPersistState and onRestore
  const persisted = (room as unknown as { getPersistState(): Record<string, unknown> }).getPersistState();
  const restoredRoom = new OutpostRoom();
  restoredRoom.onRestore(persisted);
  assert.equal(restoredRoom.getVersion(), room.getVersion());
  assert.equal(computeWorldHash(restoredRoom.getWorld()), computeWorldHash(room.getWorld()));
  assert.equal(restoredRoom.roleOf(visitor.id), 'visitor');
});
