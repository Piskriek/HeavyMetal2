// ============================================================================
// File: apps/web/src/rooms/outpost-convergence.test.ts
// Plan 36 Phase 1 acceptance, in node: two real clients (connectOutpost) and the real OutpostRoom, through the harness's wire.
//  - two clients send 50 random valid builds each, on the plot's real terrain with a sculpt field, and end with the same hashWorld
//    as the room;
//  - a disconnect followed by a reconnect within 60 s restores the same world;
//  - a visitor's build is refused on the server, and only the visitor hears about it;
//  - the Lead Architect's terrain change reaches the guests, and the worlds still agree after it.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyField, encodeField, type Field } from '@hm/terrainbrush';
import { createWorld, hashWorld, withBridgeStore, type BaseCommand, type BaseWorld } from '../base/world';
import { plotHeightAt } from '../base/plot-height';
import { STARTER } from '../base/catalog';
import { computeWorldHash } from '../net/protocol';
import { connectOutpost, type OutpostClient } from '../net/outpost-client';
import { OutpostHarness } from './outpost-harness';

const PAINT_CELLS = 256;
const PAINT_CELL = 320 / PAINT_CELLS;
const PAINT_ORIGIN = -160;

/** A sculpt field of the play screen's grid, with a raised block of cells near (x, z), as the beam save holds it. */
function sculptNear(x: number, z: number, height: number): string {
  const base = emptyField(PAINT_CELLS, PAINT_CELL);
  const delta = [...base.delta];
  const gx = Math.floor((x - PAINT_ORIGIN) / PAINT_CELL);
  const gz = Math.floor((z - PAINT_ORIGIN) / PAINT_CELL);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) delta[(gz + dz) * PAINT_CELLS + gx + dx] = height;
  const field: Field = { ...base, delta };
  return encodeField(field);
}

/** A small seeded generator, so the random builds are the same on every run. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** A new host base: a fresh world with the bridge store at the gate, as the play screen makes it. */
function hostWorld(): BaseWorld {
  return withBridgeStore(createWorld(1), { heightAt: plotHeightAt({ seed: 7 }), bridge: { x: 0, z: 0, range: 60 } });
}

/** Sends a build and says whether the client's own prediction took it. */
function tryBuild(client: OutpostClient, cmd: BaseCommand): boolean {
  return !client.send(cmd).events.some((e) => e.type === 'refused');
}

/** A random placement beside a piece that stands (or the shelter's structure, first), the kind of build a player makes. */
function randomPlacement(rand: () => number, world: BaseWorld, structure: number): BaseCommand {
  // the starter blueprint builds these four (a bin needs a bin blueprint)
  const kinds = ['foundation', 'floor', 'wall', 'bench'] as const;
  const kind = kinds[Math.floor(rand() * kinds.length)]!;
  const pieces = world.base.pieces;
  const near = pieces.length > 0 ? pieces[Math.floor(rand() * pieces.length)]! : null;
  // a 7 by 7 window round a piece that stands: most candidates are refused (occupied, unsupported), so the window stays wide
  const i = (near ? near.i : 0) + Math.floor(rand() * 7) - 3;
  const j = (near ? near.j : 0) + Math.floor(rand() * 7) - 3;
  const r = rand() < 0.5 ? 0 : 1;
  return { t: 'place', at: { x: 8, z: 8 }, blueprint: STARTER, piece: { s: near ? near.s : structure, kind, i, j, k: 0, r } as never };
}

async function startSession(sculpt: string) {
  const h = new OutpostHarness();
  const host = await connectOutpost('host', {
    room: h.transport('host-1', 'LeadGoblin'),
    initialWorld: hostWorld(),
    terrain: { seed: 7, sculpt },
  });
  const guest = await connectOutpost('FX9KWR', { room: h.transport('cb-1', 'BuilderBob') });
  return { h, host, guest };
}

test('two clients build 50 random valid builds each on the real terrain and end on the room\'s world hash', async () => {
  const sculpt = sculptNear(-20, 35, 1.2);
  const { h, host, guest } = await startSession(sculpt);

  assert.equal(host.state().terrain.sculpt, sculpt, 'the room took the host\'s terrain');
  assert.equal(guest.state().terrain.sculpt, sculpt, 'the guest got the room\'s terrain on join');
  assert.notEqual(plotHeightAt({ seed: 7, sculpt })(-20, 35), plotHeightAt({ seed: 7 })(-20, 35), 'the sculpt changes the ground the builds stand on');
  assert.equal(host.state().role, 'owner');
  assert.equal(guest.state().role, 'cobuilder');

  assert.ok(tryBuild(host, { t: 'grant', stock: [{ item: 'ore', n: 6000 }, { item: 'prim-cube', n: 400 }, { item: 'map-basalt', n: 400 }] }));
  assert.ok(tryBuild(host, { t: 'shelter', cx: 8, cz: 8, yaw: 0 }));
  const structure = host.state().confirmedWorld.base.structures[0]!.id;

  const rand = generator(20261017);
  let hostBuilds = 0;
  let guestBuilds = 0;
  for (let attempt = 0; attempt < 12000 && (hostBuilds < 50 || guestBuilds < 50); attempt++) {
    // the shared grid holds what fits, so the Lead Architect tops it up now and then, as a player's stock would be
    if (attempt % 10 === 0) assert.ok(tryBuild(host, { t: 'grant', stock: [{ item: 'ore', n: 400 }, { item: 'prim-cube', n: 40 }, { item: 'map-basalt', n: 40 }] }));
    if (hostBuilds < 50 && tryBuild(host, randomPlacement(rand, host.state().world, structure))) hostBuilds += 1;
    if (guestBuilds < 50 && tryBuild(guest, randomPlacement(rand, guest.state().world, structure))) guestBuilds += 1;
  }
  assert.equal(hostBuilds, 50, 'the host made 50 valid builds');
  assert.equal(guestBuilds, 50, 'the guest made 50 valid builds');

  const roomHash = hashWorld(h.room.getWorld());
  assert.equal(host.state().confirmedHash, roomHash, 'the host agrees with the room');
  assert.equal(guest.state().confirmedHash, roomHash, 'the guest agrees with the room');
  assert.equal(host.state().pendingCount, 0);
  assert.equal(guest.state().pendingCount, 0);
  assert.equal(host.state().version, h.room.getVersion());
  assert.equal(guest.state().version, h.room.getVersion());
  assert.equal(h.log.lines.filter((l) => l.level === 'ERROR').length, 0);
});

test('a disconnect followed by a reconnect within 60 s restores the same world', async () => {
  const { h, host, guest } = await startSession(sculptNear(-20, 35, 0.6));
  assert.ok(tryBuild(host, { t: 'grant', stock: [{ item: 'ore', n: 2000 }, { item: 'prim-cube', n: 100 }, { item: 'map-basalt', n: 100 }] }));
  assert.ok(tryBuild(host, { t: 'shelter', cx: 8, cz: 8, yaw: 0 }));
  const structure = host.state().confirmedWorld.base.structures[0]!.id;
  const rand = generator(7);
  for (let made = 0, attempt = 0; made < 5 && attempt < 500; attempt++) {
    if (tryBuild(guest, randomPlacement(rand, guest.state().world, structure))) made += 1;
  }
  const before = guest.state().confirmedHash;
  const versionBefore = h.room.getVersion();

  h.disconnect('cb-1');
  assert.equal(guest.state().connectionState, 'reconnecting');
  for (let made = 0, attempt = 0; made < 4 && attempt < 500; attempt++) {
    if (tryBuild(host, randomPlacement(rand, host.state().world, structure))) made += 1;
  }
  assert.ok(h.players.has('cb-1'), 'the room holds the guest\'s seat');
  assert.equal(h.players.get('cb-1')!.connected, false);

  h.reconnect('cb-1');
  assert.equal(guest.state().connectionState, 'connected');
  assert.equal(guest.state().playerId, 'cb-1', 'the same player');
  assert.equal(guest.state().role, 'cobuilder', 'the same role');
  assert.ok(h.room.getVersion() > versionBefore, 'the room kept building while the guest was away');
  assert.notEqual(before, guest.state().confirmedHash, 'the guest caught up on what it missed');
  assert.equal(guest.state().confirmedHash, computeWorldHash(h.room.getWorld()), 'and now holds the room\'s world');
  assert.equal(host.state().confirmedHash, computeWorldHash(h.room.getWorld()));
});

test('a visitor\'s build is refused on the server, and only the visitor hears about it', async () => {
  const { h, host, guest } = await startSession(sculptNear(-20, 35, 0.6));
  const visitor = await connectOutpost('FX9KWR', { room: h.transport('vis-1', 'ObserverEve') });
  host.setRole('vis-1', 'visitor');
  assert.equal(h.room.roleOf('vis-1'), 'visitor');
  assert.ok(tryBuild(host, { t: 'shelter', cx: 8, cz: 8, yaw: 0 }));

  h.deliveries.length = 0;
  visitor.send({ t: 'place', at: { x: 8, z: 8 }, blueprint: STARTER, piece: { s: 1, kind: 'floor', i: 0, j: 0, k: 0, r: 0 } as never });
  assert.equal(visitor.state().lastRefusal?.why, 'visitor-read-only');
  assert.deepEqual(h.deliveries.filter((d) => d.type === 'refused').map((d) => d.recipient), ['vis-1']);
  assert.equal(h.deliveries.filter((d) => d.type === 'events').length, 0, 'nothing is confirmed to anyone');
  assert.equal(host.state().lastRefusal, null);
  assert.equal(guest.state().lastRefusal, null);
});

test('the Lead Architect\'s terrain change reaches the guests, and the worlds still agree after it', async () => {
  const { h, host, guest } = await startSession(sculptNear(-20, 35, 0.6));
  assert.ok(tryBuild(host, { t: 'grant', stock: [{ item: 'ore', n: 1000 }, { item: 'prim-cube', n: 60 }, { item: 'map-basalt', n: 60 }] }));
  assert.ok(tryBuild(host, { t: 'shelter', cx: 8, cz: 8, yaw: 0 }));

  const next = sculptNear(40, -55, 2.0);
  assert.equal(host.setTerrain({ seed: 7, sculpt: next }), true);
  assert.equal(guest.setTerrain({ seed: 7, sculpt: next }), false, 'a co-builder cannot change the ground');
  assert.equal(guest.state().terrain.sculpt, next, 'the guest\'s ground follows the room');
  assert.equal(host.state().terrain.sculpt, next);

  const structure = host.state().confirmedWorld.base.structures[0]!.id;
  const rand = generator(99);
  let accepted = 0;
  for (let attempt = 0; attempt < 400 && accepted < 10; attempt++) {
    if (tryBuild(guest, randomPlacement(rand, guest.state().world, structure))) accepted += 1;
  }
  assert.equal(accepted, 10);
  assert.equal(guest.state().confirmedHash, computeWorldHash(h.room.getWorld()));
  assert.equal(host.state().confirmedHash, computeWorldHash(h.room.getWorld()));
});
