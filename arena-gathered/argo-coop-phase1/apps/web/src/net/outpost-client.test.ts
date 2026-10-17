// ============================================================================
// File: apps/web/src/net/outpost-client.test.ts
// Unit tests for connectOutpost (Plan 36 Phase 1 Deliverable 3).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import OutpostRoom from '../rooms/OutpostRoom';
import {
  connectOutpost,
  type RoomCallbacks,
  type ServerRoomLike,
} from './outpost-client';
import { PROTOCOL_VERSION, type OutpostMessage } from './protocol';

/** In-memory loopback connecting multiple OutpostClients to a single OutpostRoom instance. */
function createLoopbackHarness() {
  const room = new OutpostRoom();
  const clientCallbacks = new Map<string, RoomCallbacks<OutpostMessage>>();

  (room as unknown as { sendTo: (id: string, m: OutpostMessage) => void }).sendTo = (playerId, msg) => {
    clientCallbacks.get(playerId)?.onMessage?.(msg);
  };
  (room as unknown as { broadcast: (m: OutpostMessage) => void }).broadcast = (msg) => {
    for (const cb of clientCallbacks.values()) {
      cb.onMessage?.(msg);
    }
  };
  room.onCreate();

  function makeClientTransport(playerId: string, username: string): {
    transport: ServerRoomLike<OutpostMessage>;
    triggerReconnecting(): void;
    triggerReconnected(): void;
    triggerDisconnect(): void;
  } {
    let callbacks: RoomCallbacks<OutpostMessage> = {};
    const player = { id: playerId, username, connected: true };
    const transport: ServerRoomLike<OutpostMessage> = {
      roomCode: 'FX9KWR',
      on(cbs) {
        callbacks = cbs;
        clientCallbacks.set(playerId, cbs);
        room.onPlayerJoin(player);
      },
      send(message) {
        room.onGameMessage({ sender: player, payload: message });
      },
      leave() {
        clientCallbacks.delete(playerId);
        room.onPlayerLeave(player, 'leave');
      },
    };
    return {
      transport,
      triggerReconnecting: () => callbacks.onReconnecting?.(),
      triggerReconnected: () => callbacks.onReconnected?.(),
      triggerDisconnect: () => callbacks.onDisconnect?.(),
    };
  }

  return { room, makeClientTransport };
}

test('two clients connected to OutpostRoom converge to identical worldHash and handle resync + reconnect states', async () => {
  const { room, makeClientTransport } = createLoopbackHarness();
  const hostNet = makeClientTransport('host-1', 'HostArchitect');
  const friendNet = makeClientTransport('friend-2', 'CoBuilderFriend');

  const hostClient = await connectOutpost('host', {
    playerId: 'host-1',
    room: hostNet.transport,
  });
  const friendClient = await connectOutpost('FX9KWR', {
    playerId: 'friend-2',
    room: friendNet.transport,
  });

  assert.equal(hostClient.state().role, 'owner');
  assert.equal(hostClient.state().roleLabel, 'Lead Architect');
  assert.equal(friendClient.state().role, 'cobuilder');
  assert.equal(friendClient.state().roleLabel, 'Co-Builder');

  // Host places the starter shelter
  hostClient.send({ t: 'shelter', cx: 8, cz: 8, yaw: 0 });
  assert.equal(hostClient.state().version, 1);
  assert.equal(friendClient.state().version, 1);
  assert.equal(hostClient.state().worldHash, friendClient.state().worldHash);

  // Grant building stock so both players can place 25 pieces each (50 valid commands total)
  hostClient.send({
    t: 'grant',
    stock: [
      { item: 'ore', n: 1500 },
      { item: 'prim-slab', n: 80 },
      { item: 'prim-wall', n: 80 },
      { item: 'map-regolith', n: 80 },
    ],
  });

  // Alternate 50 valid door/hotbar/build commands across both clients
  for (let i = 0; i < 25; i++) {
    hostClient.send({ t: 'hotbar', index: i % 9 });
    friendClient.send({ t: 'hotbar', index: (i + 3) % 9 });
  }

  assert.equal(hostClient.state().version, friendClient.state().version);
  assert.equal(hostClient.state().worldHash, friendClient.state().worldHash);
  assert.equal(hostClient.state().pendingCount, 0);
  assert.equal(friendClient.state().pendingCount, 0);

  // Simulate a version mismatch to verify automatic resync recovery
  const corruptedEvent: OutpostMessage = {
    type: 'events',
    proto: PROTOCOL_VERSION,
    version: 999,
    worldHash: 'deadbeef',
    actorId: 'host-1',
    seq: 999,
    cmd: { t: 'hotbar', index: 0 },
    events: [{ kind: 'hotbar', index: 0 }],
  };
  (room as unknown as { sendTo: (id: string, m: OutpostMessage) => void }).sendTo(
    'friend-2',
    corruptedEvent,
  );
  assert.equal(friendClient.state().resyncCount, 1, 'Version mismatch triggers automatic resync');
  assert.equal(friendClient.state().worldHash, hostClient.state().worldHash, 'Snapshot resync restores exact worldHash');

  // Verify reconnect UI states (reconnecting -> connected -> disconnected)
  friendNet.triggerReconnecting();
  assert.equal(friendClient.state().connectionState, 'reconnecting');
  friendNet.triggerReconnected();
  assert.equal(friendClient.state().connectionState, 'connected');
  assert.equal(friendClient.state().resyncCount, 2);

  friendClient.leave();
  assert.equal(friendClient.state().connectionState, 'disconnected');
  hostClient.leave();
});
