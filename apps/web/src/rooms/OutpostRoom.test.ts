// ============================================================================
// File: apps/web/src/rooms/OutpostRoom.test.ts
// Unit tests for OutpostRoom (plan 36 Phase 1, Deliverable 2), driven through the real GameRoom base class by the harness.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, hashWorld, withBridgeStore, apply, type BaseWorld } from '../base/world';
import { OUTPOST_PLOT_SEED, plotHeightAt } from '../base/plot-height';
import { computeWorldHash, frameMessage, FrameAssembler, PROTOCOL_VERSION, type OutpostMessage } from '../net/protocol';
import { OutpostHarness } from './outpost-harness';
import { PRESENCE_INTERVAL_MS, PRESENCE_TIMER } from './OutpostRoom';

/** Sends a message the way the client does: in as many frames as it needs. */
function sendFramed(t: { send(m: OutpostMessage): void }, msg: OutpostMessage, id = 1): void {
  for (const frame of frameMessage(msg, id)) t.send(frame);
}

/** A world with a few hundred pieces' worth of JSON: the seed of a host's base. */
function hostBase(): BaseWorld {
  const env = { heightAt: plotHeightAt({ seed: OUTPOST_PLOT_SEED }), bridge: { x: 0, z: 0, range: 60 } };
  return withBridgeStore(createWorld(1), env);
}

test('the room is a real GameRoom: the platform joins players and the first joiner is the Lead Architect', () => {
  const h = new OutpostHarness();
  assert.equal(typeof h.protocol.handleJoin, 'function', 'the base class wired the protocol');
  assert.equal(h.log.lines.filter((l) => l.level === 'ERROR').length, 0);

  void h.transport('host-1', 'LeadGoblin').on({});
  void h.transport('cb-1', 'BuilderBob').on({});
  assert.equal(h.room.roleOf('host-1'), 'owner');
  assert.equal(h.room.roleOf('cb-1'), 'cobuilder');
  // a fresh world is too big for one frame, so the welcome is chunked; the terrain follows it in one frame
  assert.ok(h.sentTo('cb-1', 'chunk').length > 1);
  assert.equal(h.sentTo('cb-1', 'terrain').length, 1);
  assert.equal(h.sentTo('host-1', 'terrain').length, 1);
  assert.ok(h.clock.has(PRESENCE_TIMER), 'the presence relay runs on the room clock');
});

test('a command runs on the server, is confirmed to everyone, and a visitor refusal reaches only the visitor', () => {
  const h = new OutpostHarness();
  const host = h.transport('host-1', 'LeadGoblin');
  const cobuilder = h.transport('cb-1', 'BuilderBob');
  const visitor = h.transport('vis-1', 'ObserverEve');
  host.on({});
  cobuilder.on({});
  visitor.on({});
  host.send({ type: 'setRole', targetId: 'vis-1', role: 'visitor' } as OutpostMessage);

  h.deliveries.length = 0;
  host.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 1, baseVersion: 0, cmd: { t: 'shelter', cx: 8, cz: 8, yaw: 0 } } as OutpostMessage);
  const events = h.deliveries.filter((d) => d.type === 'events');
  assert.deepEqual(events.map((d) => d.recipient).sort(), ['cb-1', 'host-1', 'vis-1']);
  assert.equal(h.room.getVersion(), 1);
  assert.equal(events[0]!.data.worldHash, computeWorldHash(h.room.getWorld()));

  h.deliveries.length = 0;
  const hostFoundation = h.room.getWorld().base.pieces[0]!.id;
  visitor.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 1, baseVersion: 1, cmd: { t: 'remove', at: { x: 8, z: 8 }, id: hostFoundation } } as OutpostMessage);
  assert.equal(h.deliveries.filter((d) => d.type === 'events').length, 0, 'a refused command is never broadcast');
  const refusals = h.deliveries.filter((d) => d.type === 'refused');
  assert.deepEqual(refusals.map((d) => d.recipient), ['vis-1'], 'the refusal goes to the visitor only');
  assert.equal(refusals[0]!.data.why, 'visitor-read-only');

  h.deliveries.length = 0;
  cobuilder.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 2, baseVersion: 1, cmd: { t: 'remove', at: { x: 8, z: 8 }, id: hostFoundation } } as OutpostMessage);
  const cbRefusal = h.deliveries.filter((d) => d.type === 'refused');
  assert.deepEqual(cbRefusal.map((d) => d.recipient), ['cb-1']);
  assert.equal(cbRefusal[0]!.data.why, 'owner-piece-protected');
});

test('only the Lead Architect sets the terrain; the room keeps it, relays it, and builds its ground on it', () => {
  const h = new OutpostHarness();
  const host = h.transport('host-1', 'LeadGoblin');
  const cobuilder = h.transport('cb-1', 'BuilderBob');
  host.on({});
  cobuilder.on({});

  h.deliveries.length = 0;
  cobuilder.send({ type: 'terrain', seed: 7, sculpt: 'x' } as OutpostMessage);
  assert.equal(h.sentTo('cb-1', 'notice')[0]!.data.why, 'owner-only');
  assert.equal(h.room.getTerrain().sculpt, '', 'a co-builder cannot change the ground');

  h.deliveries.length = 0;
  host.send({ type: 'terrain', seed: 7, sculpt: 'abc' } as OutpostMessage);
  assert.deepEqual(h.deliveries.filter((d) => d.type === 'terrain').map((d) => d.recipient).sort(), ['cb-1', 'host-1']);
  assert.deepEqual(h.room.getTerrain(), { seed: 7, sculpt: 'abc' });

  h.deliveries.length = 0;
  host.send({ type: 'terrain', seed: 7, sculpt: 'abc' } as OutpostMessage);
  assert.equal(h.deliveries.length, 0, 'the same terrain is not sent again');

  host.send({ type: 'terrain', seed: 7, sculpt: 'a'.repeat(200_001) } as OutpostMessage);
  assert.equal(h.sentTo('host-1', 'notice').at(-1)!.data.why, 'terrain-too-large');
});

test('a malformed command is refused with a notice and does not break the room', () => {
  const h = new OutpostHarness();
  const host = h.transport('host-1', 'LeadGoblin');
  host.on({});
  // an unknown command kind is a refusal the rules give; a command that is not even an object is a notice
  host.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 1, baseVersion: 0, cmd: { t: 'no-such-command' } } as unknown as OutpostMessage);
  assert.equal(h.sentTo('host-1', 'refused')[0]!.data.why, 'unknown-cmd');
  host.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 2, baseVersion: 0, cmd: null } as unknown as OutpostMessage);
  assert.equal(h.sentTo('host-1', 'notice')[0]!.data.why, 'bad-command');
  assert.equal(h.log.lines.filter((l) => l.level === 'ERROR').length, 0);
  host.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 3, baseVersion: 0, cmd: { t: 'shelter', cx: 8, cz: 8, yaw: 0 } } as OutpostMessage);
  assert.equal(h.room.getVersion(), 1, 'the room still applies valid commands');
});

test('a big world travels in frames, joins back to the same hash, and the presence relay sends poses at 10 Hz', () => {
  const h = new OutpostHarness();
  const host = h.transport('host-1', 'LeadGoblin');
  host.on({});
  const seeded = hostBase();
  sendFramed(host, { type: 'seedWorld', proto: PROTOCOL_VERSION, world: seeded }, 7);
  assert.equal(h.room.getVersion(), 1);
  assert.equal(computeWorldHash(h.room.getWorld()), hashWorld(seeded));

  const guest = h.transport('cb-1', 'BuilderBob');
  h.deliveries.length = 0;
  guest.on({});
  const welcomeFrames = h.sentTo('cb-1', 'chunk');
  assert.ok(welcomeFrames.length > 1, 'a fresh world is too big for one frame');
  const assembler = new FrameAssembler();
  let whole: OutpostMessage | null = null;
  for (const frame of welcomeFrames) {
    const got = assembler.push({ type: 'chunk', ...frame.data } as OutpostMessage);
    if (got) whole = got;
  }
  assert.ok(whole && whole.type === 'welcome');
  if (whole && whole.type === 'welcome') {
    assert.equal(computeWorldHash(whole.world), computeWorldHash(h.room.getWorld()));
  }

  guest.send({ type: 'pose', x: 1, y: 0, z: 2, yaw: 0.5, look: 'scientist' } as OutpostMessage);
  h.deliveries.length = 0;
  h.clock.fire(PRESENCE_TIMER);
  const presence = h.deliveries.filter((d) => d.type === 'presence');
  assert.equal(presence.length, 2, 'the presence goes to every connected player');
  assert.equal((presence[0]!.data.peers as unknown[]).length, 1);
  assert.equal(PRESENCE_INTERVAL_MS, 100);
});

test('the room restores its world, roles and terrain after a restart', () => {
  const h = new OutpostHarness();
  const host = h.transport('host-1', 'LeadGoblin');
  host.on({});
  host.send({ type: 'terrain', seed: 7, sculpt: 'abc' } as OutpostMessage);
  host.send({ type: 'cmd', proto: PROTOCOL_VERSION, seq: 1, baseVersion: 0, cmd: { t: 'shelter', cx: 8, cz: 8, yaw: 0 } } as OutpostMessage);
  assert.ok(h.persisted, 'the room persisted its state');

  const again = h.restoredRoom();
  assert.equal(again.room.getVersion(), 1);
  assert.equal(hashWorld(again.room.getWorld()), hashWorld(h.room.getWorld()));
  assert.equal(again.room.roleOf('host-1'), 'owner');
  assert.deepEqual(again.room.getTerrain(), { seed: 7, sculpt: 'abc' });
  const next = apply(again.room.getWorld(), { heightAt: () => 0, bridge: { x: 0, z: 0, range: 60 } }, { t: 'hotbar', index: 3 });
  assert.equal(next.events[0]!.type, 'hotbar');
});
