import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '@hm/lattice';
import { ITEMS, STARTER } from './catalog';
import * as S from '@hm/structure';
import { BRIDGE_STORE, SHELTER, apply, createWorld, hashWorld, layoutPieces, networkAt, planGhosts, preview, replay, roomAt, withBridgeStore, type BaseCommand, type BaseWorld, type WorldEnv } from './world';

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

test('the beam harvests nodes in reach; a heavy mill on a hardpoint refines at its power share', () => {
  const big = (w: BaseWorld): BaseWorld => ({ ...w, player: { ...w.player, maxKg: 1e6 } });
  let w = big(createWorld(7));
  const n0 = w.field.nodes[0]!, near = { x: n0.x, z: n0.z };
  const item = n0.kind === 'dither' ? 'pxd-mono' : 'vtx-rough';
  const h = apply(w, env, { t: 'tick', at: near, dt: 10, beam: { node: n0.id, power: 1 }, power: {} });
  assert.deepEqual(h.events, [{ type: 'harvested', items: [{ item, n: 14 }], lost: [] }]);
  assert.equal(L.count(h.world.player, item), 14);
  assert.deepEqual(apply(w, env, { t: 'tick', at: { x: n0.x + 50, z: n0.z }, dt: 10, beam: { node: n0.id, power: 1 }, power: {} }).events, []);
  const bare = { ...w, equipment: { ...w.equipment, beam: null } };
  assert.deepEqual(apply(bare, env, { t: 'tick', at: near, dt: 10, beam: { node: n0.id, power: 1 }, power: {} }).events, []);
  // a pad, a mill, a basalt map job: 30 s of work
  w = ['ore:900', 'prim-chassis:5', 'prim-beam:4', 'prim-cube:6', 'map-basalt:5', 'pxd-mono:40'].reduce((x, s) => { const [k, n] = s.split(':'); return give(x, k!, Number(n)); }, w);
  w = run(w, found);
  const s = w.base.structures[0]!.id;
  w = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('bench', 0, 0, s) }, { t: 'draft', at, primitive: 'chassis', map: 'basalt' });
  // the pad needs every fixture spot of its four cells, so the bench comes down once the blueprint is drafted
  w = run(w, { t: 'remove', at, id: w.base.pieces.find((p) => p.kind === 'bench')!.id });
  for (const [i, j] of [[1, 0], [0, 1], [1, 1]] as const) w = run(w, { t: 'place', at, blueprint: STARTER, piece: piece('foundation', i, j, s) });
  w = run(w, { t: 'place', at, blueprint: 'bp:chassis:basalt', piece: { s, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 } });
  const pad = w.base.pieces.find((p) => p.kind === 'hardpoint')!.id;
  assert.equal(apply(w, env, { t: 'craft', at, machine: pad, recipe: 'map-basalt' }).events[0]!.type, 'refused');
  w = run(w, { t: 'install', at, hardpoint: pad, kind: 'mill' });
  assert.equal(apply(w, env, { t: 'install', at, hardpoint: pad, kind: 'press' }).events[0]!.type, 'refused');
  assert.equal(apply(w, env, { t: 'craft', at, machine: pad, recipe: 'prim-cube' }).events[0]!.type, 'refused');
  w = run(w, { t: 'craft', at, machine: pad, recipe: 'map-basalt' }, { t: 'craft', at, machine: pad, recipe: 'map-basalt' });
  const maps = L.count(w.player, 'map-basalt');
  // half power for 20 s is 10 s of work; then 50 s at full power finishes both jobs (20 + 30)
  w = run(w, { t: 'tick', at, dt: 20, beam: null, power: { [pad]: 0.5 } });
  assert.deepEqual(w.machines[0]!.jobs, [{ recipe: 'map-basalt', done: 10 }, { recipe: 'map-basalt', done: 0 }]);
  const done = apply(w, env, { t: 'tick', at, dt: 50, beam: null, power: { [pad]: 1 } });
  assert.deepEqual(done.events.filter((e) => e.type === 'finished').length, 2);
  // no bin in the network: the maps wait in the machine until collected
  assert.deepEqual(done.world.machines[0]!.out, [{ item: 'map-basalt', n: 2 }]);
  const got = run(done.world, { t: 'collect', machine: pad });
  assert.equal(L.count(got.player, 'map-basalt'), maps + 2);
  assert.deepEqual(apply(got, env, { t: 'remove', at, id: pad }).events, [{ type: 'refused', cmd: 'remove', why: 'has-machine' }]);
});

test('the bridge store stands at the gate on the network, and building pulls from it with an empty pack', () => {
  const w0 = withBridgeStore(createWorld(), env, [{ item: 'ore', n: 50 }]);
  assert.equal(withBridgeStore(w0, env, [{ item: 'ore', n: 50 }]), w0);
  assert.deepEqual(networkAt(w0, env, at), [BRIDGE_STORE]);
  const w1 = run(w0, found);
  assert.equal(L.count(w1.player, 'ore'), 0);
  assert.equal(L.totals(w1.boxes, [BRIDGE_STORE])['ore'] ?? 0, 30);
});

test('the starter shelter: free, sealed, once per world; it saves as a layout that rebuilds elsewhere as you pay', () => {
  const stock = [{ item: 'ore', n: 200 }, { item: 'prim-chassis', n: 1 }, { item: 'map-basalt', n: 3 }];
  let w = run(withBridgeStore(createWorld(), env, stock), { t: 'shelter', cx: 2, cz: 2, yaw: 0 });
  assert.equal(w.shelter, true);
  assert.deepEqual(S.rooms(w.base).map((r) => [r.k, r.sealed]), [[0, true]]);
  assert.equal(roomAt(w, env, { x: 2, y: 0, z: 2 }).pressurized, true, 'its life-support unit runs off the bridge');
  assert.equal(apply(w, env, { t: 'shelter', cx: 30, cz: 30, yaw: 0 }).events[0]!.type, 'refused');
  assert.equal(L.totals(w.boxes, [BRIDGE_STORE])['ore'], 200, 'the shelter is free');

  const s = w.base.structures[0]!.id;
  assert.deepEqual(apply(w, env, { t: 'saveLayout', at: { x: 40, z: 40 }, structure: s, name: 'Hut' }).events, [{ type: 'refused', cmd: 'saveLayout', why: 'no-bench' }]);
  w = run(w, { t: 'saveLayout', at: { x: 2, z: 2 }, structure: s, name: '  Hut ' });
  const layout = w.layouts[0]!;
  assert.equal(layout.name, 'Hut');
  assert.equal(layoutPieces(layout.code)!.length, SHELTER.length);
  assert.equal(apply(w, env, { t: 'saveLayout', at: { x: 2, z: 2 }, structure: s, name: 'Hut 2' }).events[0]!.type, 'refused', 'same layout twice');

  w = run(w, { t: 'plan', layout: layout.id, cx: 40, cz: 2, yaw: 0.5 });
  const ghosts = planGhosts(w, env, 1);
  assert.equal(ghosts.length, SHELTER.length);
  assert.ok(Math.abs(ghosts[0]!.at.x - 40) < 1e-9 && Math.abs(ghosts[0]!.at.z - 2) < 1e-9);

  // the starter kit builds everything but the airlock and the life-support unit: six pieces go up, paid from the bridge store
  const at = { x: 38, z: 2 };
  const first = apply(w, env, { t: 'fill', at, plan: 1 });
  const filled = first.events.find((e) => e.type === 'filled');
  assert.deepEqual(filled && { ...filled, built: filled.built.length }, { type: 'filled', plan: 1, built: 6, left: 2, blocked: 2 });
  w = first.world;
  assert.equal(L.totals(w.boxes, [BRIDGE_STORE])['ore'], 200 - (20 + 3 * 12 + 10 + 25));
  assert.equal(planGhosts(w, env, 1).length, 2);
  assert.equal(apply(w, env, { t: 'fill', at, plan: 1 }).events[0]!.type, 'refused', 'nothing new to build');

  // a basalt chassis blueprint builds the airlock and the life-support unit (they take basalt): the plan completes and the copy seals
  w = run(w, { t: 'draft', at: { x: 2, z: 2 }, primitive: 'chassis', map: 'basalt' }, { t: 'fill', at, plan: 1 });
  assert.deepEqual(w.plans, []);
  assert.equal(w.base.pieces.filter((p) => p.kind === 'airlock' && p.mat === 'basalt').length, 1);
  assert.deepEqual(S.rooms(w.base).map((r) => r.sealed), [true, true]);

  // shared layouts come back to the same id; garbage is refused
  const other = run(createWorld(2), { t: 'importLayout', code: layout.code, name: 'From a friend' });
  assert.equal(other.layouts[0]!.id, layout.id);
  assert.equal(apply(createWorld(), env, { t: 'importLayout', code: 'not-a-layout', name: 'x' }).events[0]!.type, 'refused');
  assert.equal(apply(createWorld(), env, { t: 'importLayout', code: layout.code, name: '' }).events[0]!.type, 'refused');
});

test('pressure (D14): a sealed room with a powered life-support unit inside; an open airlock or no power breaks it', () => {
  const senv = { heightAt: () => 0, materials: { regolith: { vKeep: 0.85, hKeep: 0.5 } } };
  let base = S.found(S.empty(), senv, 2, 2, 0, 'regolith').base; const s = base.structures[0]!.id;
  const put = (p: Omit<S.Piece, 'id' | 's' | 'mat'>) => { const r = S.place(base, senv, { ...p, s, mat: 'regolith' }); assert.ok(r.ok, `${p.kind}: ${r.why}`); base = r.base; };
  put({ kind: 'wall', i: 0, j: 0, k: 0, r: 0 }); put({ kind: 'wall', i: 0, j: 0, k: 0, r: 1 }); put({ kind: 'wall', i: 1, j: 0, k: 0, r: 1 });
  put({ kind: 'airlock', i: 0, j: 1, k: 0, r: 0 }); put({ kind: 'lowRoof', i: 0, j: 0, k: 1, r: 2 });
  const bare: BaseWorld = { ...createWorld(), base };
  assert.deepEqual(roomAt(bare, env, { x: 2, y: 0, z: 2 }).pressurized, false, 'no life support yet');
  put({ kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0 });
  const w: BaseWorld = { ...createWorld(), base };
  const inside = roomAt(w, env, { x: 2, y: 0, z: 2 });
  assert.ok(inside.room && inside.room.sealed); assert.equal(inside.pressurized, true);
  assert.equal(roomAt(w, env, { x: 9, y: 0, z: 2 }).room, null, 'outside');
  assert.equal(roomAt(w, env, { x: 2, y: 3, z: 2 }).room, null, 'on the roof');
  assert.equal(roomAt(w, { ...env, bridge: { x: 500, z: 500, range: 60 } }, { x: 2, y: 0, z: 2 }).pressurized, false, 'no relay reaches it');
  const lock = w.base.pieces.find((p) => p.kind === 'airlock')!;
  assert.equal(roomAt(run(w, { t: 'door', id: lock.id, open: true }), env, { x: 2, y: 0, z: 2 }).pressurized, false, 'the airlock is open');
});
