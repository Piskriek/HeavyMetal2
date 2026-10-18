// ============================================================================
// File: apps/web/src/net/outpost-client.test.ts
// Unit tests for connectOutpost (plan 36 Phase 1 & Phase 2 / TICKET-11),
// through the real OutpostRoom via OutpostHarness.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { OutpostHarness } from '../rooms/outpost-harness';
import { connectOutpost } from './outpost-client';
import { rosterOf } from './outpost-session';
import { computeWorldHash, PROTOCOL_VERSION } from './protocol';
import { createWorld, withBridgeStore } from '../base/world';
import { plotHeightAt, OUTPOST_PLOT_SEED } from '../base/plot-height';
import { STARTER } from '../base/catalog';

function hostWorld() {
  return withBridgeStore(createWorld(1), { heightAt: plotHeightAt({ seed: OUTPOST_PLOT_SEED }), bridge: { x: 0, z: 0, range: 60 } });
}

test('the host and a friend agree on roles, usernames (POL-117), builds, resync and reconnect states', async () => {
  const h = new OutpostHarness();
  const host = await connectOutpost('host', { room: h.transport('host-1', 'HostArchitect'), initialWorld: hostWorld() });
  const friend = await connectOutpost('FX9KWR', { room: h.transport('friend-2', 'CoBuilderFriend') });
  // the room tells everyone who joined, so the host's roster has the friend too
  assert.deepEqual(Object.keys(host.state().roles).sort(), ['friend-2', 'host-1']);

  // POL-117: rosterOf shows 'CoBuilderFriend' before friend-2 sends any pose
  const hostRoster = rosterOf(host);
  assert.equal(hostRoster.find((r) => r.id === 'friend-2')?.name, 'CoBuilderFriend');

  assert.equal(host.state().role, 'owner');
  assert.equal(host.state().roleLabel, 'Lead Architect');
  assert.equal(friend.state().role, 'cobuilder');
  assert.equal(friend.state().roleLabel, 'Co-Builder');
  assert.equal(host.state().confirmedHash, computeWorldHash(h.room.getWorld()), 'the host holds the seeded base');

  // the host's build reaches both, with the same version and hash
  host.send({ t: 'grant', stock: [{ item: 'ore', n: 400 }, { item: 'prim-cube', n: 40 }, { item: 'map-basalt', n: 40 }] });
  host.send({ t: 'shelter', cx: 8, cz: 8, yaw: 0 });
  assert.equal(host.state().version, 3);
  assert.equal(friend.state().version, 3);
  assert.equal(host.state().confirmedHash, friend.state().confirmedHash);
  assert.equal(host.state().pendingCount, 0);

  // a corrupted confirmation makes the friend ask for a snapshot, and the room answers it
  h.protocol.sendTo('friend-2', 'events', {
    type: 'events',
    proto: PROTOCOL_VERSION,
    version: 999,
    worldHash: 'deadbeef',
    actorId: 'host-1',
    seq: 999,
    cmd: { t: 'hotbar', index: 0 },
    events: [{ kind: 'hotbar', index: 0 }],
  });
  assert.equal(friend.state().resyncCount, 1, 'a version or hash mismatch triggers a resync');
  assert.equal(friend.state().confirmedHash, host.state().confirmedHash, 'the snapshot restores the room's world');

  // the socket drops and comes back: the reconnect states show, and the friend resyncs once more
  h.disconnect('friend-2');
  assert.equal(friend.state().connectionState, 'reconnecting');
  h.reconnect('friend-2');
  assert.equal(friend.state().connectionState, 'connected');
  assert.equal(friend.state().resyncCount, 2);

  friend.leave();
  assert.equal(friend.state().connectionState, 'disconnected');
  host.leave();
});

test('only the Lead Architect can set the terrain, and the ground follows the room's copy', async () => {
  const h = new OutpostHarness();
  const host = await connectOutpost('host', { room: h.transport('host-1', 'HostArchitect'), initialWorld: hostWorld(), terrain: { seed: OUTPOST_PLOT_SEED, sculpt: '' } });
  const friend = await connectOutpost('FX9KWR', { room: h.transport('friend-2', 'CoBuilderFriend') });
  assert.equal(friend.setTerrain({ seed: 7, sculpt: 'zz' }), false, 'nothing is sent for a co-builder');
  assert.equal(host.setTerrain({ seed: 7, sculpt: 'zz' }), true);
  assert.equal(host.state().terrain.sculpt, 'zz', 'the host's ground follows the room's echo');
  assert.equal(friend.state().terrain.sculpt, 'zz');
  assert.equal(h.log.lines.filter((l) => l.level === 'ERROR').length, 0);
});

test('Phase 2 client controls: Lead Architect undoAuthor, setDefaultRole, and kickPlayer keep client hashes converged', async () => {
  const h = new OutpostHarness();
  const host = await connectOutpost('host', { room: h.transport('host-1', 'HostArchitect'), initialWorld: hostWorld() });
  const friend = await connectOutpost('FX9KWR', { room: h.transport('friend-2', 'CoBuilderFriend') });

  host.send({ t: 'grant', stock: [{ item: 'ore', n: 500 }] });
  host.send({ t: 'shelter', cx: 8, cz: 8, yaw: 0 });
  const stId = host.state().confirmedWorld.base.structures[0]!.id;
  const piecesBefore = host.state().confirmedWorld.base.pieces.length;

  friend.send({
    t: 'place',
    at: { x: 8, z: 8 },
    blueprint: STARTER,
    piece: { s: stId, kind: 'foundation', i: 1, j: 0, k: 0, r: 0 },
  });
  assert.equal(host.state().confirmedWorld.base.pieces.length, piecesBefore + 1);
  assert.equal(host.state().confirmedHash, friend.state().confirmedHash);

  // Lead Architect undoes friend's build; both clients converge without resync
  assert.equal(friend.undoAuthor('host-1'), false);
  assert.equal(host.undoAuthor('friend-2'), true);
  assert.equal(host.state().confirmedWorld.base.pieces.length, piecesBefore);
  assert.equal(host.state().confirmedHash, friend.state().confirmedHash);
  assert.equal(friend.state().resyncCount, 0);

  // Default guest role toggle
  assert.equal(host.setDefaultRole('visitor'), true);
  assert.equal(host.state().defaultGuestRole, 'visitor');

  // Lead Architect kicks friend-2
  assert.equal(host.kickPlayer('friend-2', 'Session closed'), true);
  assert.equal(friend.state().connectionState, 'disconnected');
  assert.equal(friend.state().kickedReason, 'Session closed');
});
