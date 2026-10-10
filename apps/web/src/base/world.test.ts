import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '@hm/lattice';
import { ITEMS, STARTER } from './catalog';
import { apply, createWorld, hashWorld, networkAt, preview, replay, type BaseCommand, type BaseWorld, type WorldEnv } from './world';

const env: WorldEnv = { heightAt: () => 0, bridge: { x: 0, z: 0, range: 60 } };
const at = { x: 2, z: 2 };
const give = (w: BaseWorld, item: string, n: number): BaseWorld => ({ ...w, player: L.deposit(w.player, ITEMS, item, n).box });
const run = (w: BaseWorld, ...cmds: BaseCommand[]): BaseWorld => cmds.reduce((x, c) => {
  const r = apply(x, env, c);
  const bad = r.events.find((e) => e.type === 'refused');
  assert.equal(bad, undefined, `${c.t}: ${JSON.stringify(bad)}`);
  return r.world;
}, w);
const found: BaseCommand = { t: 'found', at, blueprint: STARTER, cx: 2, cz: 2, yaw: 0 };
const piece = (kind: 'foundation' | 'floor' | 'wall' | 'bench' | 'bin', i: number, j: number, s: number, r: 0 | 1 = 0) => ({ s, kind, i, j, k: 0, r });

test('building pays ore from the player and refuses when short', () => {
  const w0 = createWorld();
  const short = apply(w0, env, found);
  assert.deepEqual(short.events, [{ type: 'refused', cmd: 'found', why: 'short', short: [{ item: 'ore', n: 20 }] }]);
  assert.equal(short.world, w0);
  const w1 = run(give(w0, 'ore', 50), found);
  assert.equal(L.count(w1.player, 'ore'), 30);
  assert.equal(w1.base.pieces.length, 1);
  assert.equal(w1.tick, 1);
  const s = w1.base.structures[0]!.id;
  assert.equal(apply(w1, env, { t: 'place', at, blueprint: STARTER, piece: piece('bin', 0, 0, s) }).events[0]!.type === 'refused', true);
  assert.equal(apply(w1, env, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('floor', 1, 0, s) }).events[0]!.type, 'refused');
});

test('drafting at a bench, a bin joins the bridge network, building pulls from it after the player', () => {
  let w = run(give(createWorld(), 'ore', 120), found);
  const s = w.base.structures[0]!.id;
  w = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('bench', 0, 0, s) });
  const kit = give(give(give(w, 'prim-cube', 1), 'map-basalt', 3), 'ore', 0);
  const drafted = run(kit, { t: 'draft', at, primitive: 'cube', map: 'basalt' });
  assert.equal(L.count(drafted.player, 'bp:cube:basalt'), 1);
  assert.equal(apply(drafted, env, { t: 'draft', at, primitive: 'cube', map: 'basalt' }).events[0]!.type, 'refused');
  assert.equal(apply(kit, env, { t: 'draft', at: { x: 30, z: 30 }, primitive: 'cube', map: 'basalt' }).events[0]!.type, 'refused');
  // a basalt bin: 15 ore + 1 map; it stands in the bridge's field, so the player in reach shares it
  w = run(drafted, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('foundation', 1, 0, s) }, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('bin', 1, 0, s) });
  assert.equal(w.boxes.length, 1);
  const bin = w.boxes[0]!.id;
  assert.deepEqual(networkAt(w, env, at), [bin]);
  assert.deepEqual(networkAt(w, env, { x: 500, z: 500 }), []);
  // put the player's ore in the bin, then build: the wall's 12 ore come out of the bin
  const ore = L.count(w.player, 'ore');
  const idx = w.player.slots.findIndex((q) => q?.item === 'ore');
  w = run(w, { t: 'move', at, from: { at: 'inventory', index: idx }, to: { at: 'box', box: bin, index: 0 }, n: ore });
  assert.equal(L.count(w.player, 'ore'), 0);
  w = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('wall', 0, 0, s) });
  assert.equal(L.count(w.boxes[0]!, 'ore'), ore - 12);
  // out of the network's reach the same wall is short
  assert.equal(apply(w, env, { t: 'place', at: { x: 500, z: 500 }, blueprint: STARTER, piece: piece('wall', 1, 0, s) }).events[0]!.type, 'refused');
});

test('taking pieces down refunds them; storage is never dropped', () => {
  let w = run(give(createWorld(), 'ore', 120), found);
  const s = w.base.structures[0]!.id;
  w = run(give(give(w, 'prim-cube', 1), 'map-basalt', 2), { t: 'place', at, blueprint: STARTER, piece: piece('bench', 0, 0, s) }, { t: 'draft', at, primitive: 'cube', map: 'basalt' });
  w = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('floor', 1, 0, s) }, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('bin', 1, 0, s) });
  const floorId = w.base.pieces.find((p) => p.kind === 'floor')!.id, binId = w.boxes[0]!.id;
  const wall = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('wall', 0, 0, s) });
  const back = run(wall, { t: 'remove', at, id: wall.base.pieces.find((p) => p.kind === 'wall')!.id });
  assert.equal(L.count(back.player, 'ore'), L.count(w.player, 'ore'));
  // fill the bin, then neither it nor the floor it stands on may go
  const full = run(w, { t: 'move', at, from: { at: 'inventory', index: w.player.slots.findIndex((q) => q?.item === 'ore') }, to: { at: 'box', box: binId, index: 0 }, n: 5 });
  assert.deepEqual(apply(full, env, { t: 'remove', at, id: binId }).events, [{ type: 'refused', cmd: 'remove', why: 'not-empty' }]);
  assert.deepEqual(apply(full, env, { t: 'remove', at, id: floorId }).events, [{ type: 'refused', cmd: 'remove', why: 'would-spill' }]);
  // an empty bin falls with its floor and its box goes too; the floor's ore comes back, the bin's is lost in the fall
  const fell = apply(w, env, { t: 'remove', at, id: floorId });
  assert.deepEqual(fell.events, [{ type: 'removed', id: floorId, collapsed: [binId], lost: [] }]);
  assert.equal(fell.world.boxes.length, 0);
  assert.equal(L.count(fell.world.player, 'ore'), L.count(w.player, 'ore') + 10);
});

test('moves: equipment slots, stacking, weight; quick stack', () => {
  let w = give(createWorld(), 'eq-shield', 1);
  const i = w.player.slots.findIndex((q) => q?.item === 'eq-shield');
  assert.equal(apply(w, env, { t: 'move', at, from: { at: 'inventory', index: i }, to: { at: 'equipment', slot: 'visor' }, n: 1 }).events[0]!.type, 'refused');
  w = run(w, { t: 'move', at, from: { at: 'inventory', index: i }, to: { at: 'equipment', slot: 'shield' }, n: 1 });
  assert.deepEqual(w.equipment.shield, { item: 'eq-shield', n: 1 });
  // split, then merge back
  w = give(w, 'ore', 40);
  const o = w.player.slots.findIndex((q) => q?.item === 'ore');
  w = run(w, { t: 'move', at, from: { at: 'inventory', index: o }, to: { at: 'inventory', index: 20 }, n: 15 });
  assert.deepEqual([w.player.slots[o]?.n, w.player.slots[20]?.n], [25, 15]);
  w = run(w, { t: 'move', at, from: { at: 'inventory', index: 20 }, to: { at: 'inventory', index: o }, n: 15 });
  assert.equal(w.player.slots[o]?.n, 40);
  assert.equal(apply(w, env, { t: 'move', at, from: { at: 'inventory', index: o }, to: { at: 'inventory', index: o }, n: 5 }).events[0]!.type, 'refused');
  // quick stack: ore in rows 2..4 goes to the network that holds ore, the hotbar row stays
  let b = run(give(createWorld(), 'ore', 150), found);
  const s = b.base.structures[0]!.id;
  b = run(give(give(b, 'prim-cube', 1), 'map-basalt', 3), { t: 'place', at, blueprint: STARTER, piece: piece('bench', 0, 0, s) }, { t: 'draft', at, primitive: 'cube', map: 'basalt' });
  b = run(b, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('foundation', 1, 0, s) }, { t: 'place', at, blueprint: 'bp:cube:basalt', piece: piece('bin', 1, 0, s) });
  const binId = b.boxes[0]!.id;
  const first = b.player.slots.findIndex((q) => q?.item === 'ore');
  b = run(b, { t: 'move', at, from: { at: 'inventory', index: first }, to: { at: 'box', box: binId, index: 0 }, n: 1 });
  b = run(b, { t: 'move', at, from: { at: 'inventory', index: b.player.slots.findIndex((q) => q?.item === 'ore') }, to: { at: 'inventory', index: 30 }, n: 10 });
  const before = L.count(b.player, 'ore'), inBin = L.count(b.boxes[0]!, 'ore');
  const stacked = apply(b, env, { t: 'quickStack', at });
  const moved = before - L.count(stacked.world.player, 'ore');
  assert.ok(moved >= 10);
  assert.equal(L.count(stacked.world.boxes[0]!, 'ore'), inBin + moved);
  assert.equal(L.count({ ...stacked.world.player, slots: stacked.world.player.slots.slice(0, 9) }, 'ore'), L.count({ ...b.player, slots: b.player.slots.slice(0, 9) }, 'ore'));
});

test('a command log replays to the same hash', () => {
  const log: BaseCommand[] = [found, { t: 'hotbar', index: 3 }, { t: 'remove', at, id: 999 }];
  const start = give(createWorld(), 'ore', 100);
  const a = replay(start, env, log), b = replay(start, env, log);
  assert.equal(hashWorld(a.world), hashWorld(b.world));
  assert.notEqual(hashWorld(a.world), hashWorld(start));
  assert.equal(a.world.hotbar, 3);
});

test('airlock doors open and close; the ghost preview says where and whether you can pay', () => {
  let w = run(give(createWorld(), 'ore', 120), found);
  const s = w.base.structures[0]!.id;
  w = run(give(give(w, 'prim-chassis', 1), 'map-basalt', 2), { t: 'place', at, blueprint: STARTER, piece: piece('bench', 0, 0, s) }, { t: 'draft', at, primitive: 'chassis', map: 'basalt' });
  w = run(w, { t: 'place', at, blueprint: 'bp:chassis:basalt', piece: { s, kind: 'airlock', i: 0, j: 0, k: 0, r: 0 } });
  const lock = w.base.pieces.find((p) => p.kind === 'airlock')!.id;
  const open = apply(w, env, { t: 'door', id: lock, open: true });
  assert.deepEqual(open.events, [{ type: 'door', id: lock, open: true }]);
  assert.equal(open.world.base.pieces.find((p) => p.id === lock)!.open, true);
  assert.equal(apply(w, env, { t: 'door', id: w.base.pieces[0]!.id, open: true }).events[0]!.type, 'refused');
  const ghost = preview(w, env, at, STARTER, 'floor', { x: 6, y: 0, z: 2, yaw: 0 });
  assert.ok(ghost.snap && ghost.snap.mode === 'place' && ghost.snap.ok);
  assert.deepEqual(ghost.short, []);
  const broke = preview({ ...w, player: { ...w.player, slots: w.player.slots.map((q) => (q?.item === 'ore' ? null : q)) } }, env, at, STARTER, 'floor', { x: 6, y: 0, z: 2, yaw: 0 });
  assert.deepEqual(broke.short, [{ item: 'ore', n: 10 }]);
  assert.equal(preview(w, env, at, STARTER, 'bin', { x: 6, y: 0, z: 2, yaw: 0 }).snap, null);
});
