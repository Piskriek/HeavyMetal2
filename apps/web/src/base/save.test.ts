import test from 'node:test';
import assert from 'node:assert/strict';
import { hashValue } from '@hm/kernel';
import * as L from '@hm/lattice';
import { BRIDGE_STORE, apply, createWorld, hashWorld, withBridgeStore, type BaseCommand, type BaseWorld, type WorldEnv } from './world';
import { loadWorld, saveWorld } from './save';

const env: WorldEnv = { heightAt: () => 0, bridge: { x: 0, z: 0, range: 60 } };
const run = (w: BaseWorld, ...cmds: BaseCommand[]): BaseWorld => cmds.reduce((x, c) => {
  const r = apply(x, env, c);
  const bad = r.events.find((e) => e.type === 'refused');
  assert.equal(bad, undefined, `${c.t}: ${JSON.stringify(bad)}`);
  return r.world;
}, w);

/** A lived-in base: the shelter, a bin on a second foundation, a drafted blueprint, a saved layout, a part-built plan, a stage. */
function livedIn(): BaseWorld {
  const stock = [{ item: 'ore', n: 200 }, { item: 'prim-cube', n: 1 }, { item: 'map-basalt', n: 3 }];
  let w = run(withBridgeStore(createWorld(7), env, stock), { t: 'shelter', cx: 2, cz: 2, yaw: 0 });
  const s = w.base.structures[0]!.id, at = { x: 2, z: 2 };
  w = run(w,
    { t: 'draft', at, primitive: 'cube', map: 'basalt' },
    { t: 'place', at, blueprint: 'bp:starter', piece: { s, kind: 'foundation', i: 1, j: 0, k: 0, r: 0 } },
    { t: 'place', at, blueprint: 'bp:cube:basalt', piece: { s, kind: 'bin', i: 1, j: 0, k: 0, r: 1 } },
    { t: 'saveLayout', at, structure: s, name: 'Hut and bin' },
    { t: 'hotbar', index: 3 },
    { t: 'stage', stage: 2 });
  return run(w, { t: 'plan', layout: w.layouts[0]!.id, cx: 40, cz: 2, yaw: 0.3 }, { t: 'fill', at: { x: 38, z: 2 }, plan: 1 });
}

test('a saved base loads back to the same world (same hash)', () => {
  const w = livedIn();
  // the plan's copy has its own bin (and box); its airlock waits for a chassis blueprint
  assert.ok(w.plans.length === 1 && w.boxes.length === 3 && w.layouts.length === 1);
  const back = loadWorld(saveWorld(w), 7);
  assert.equal(hashWorld(back), hashWorld(w));
});

test('a missing or unreadable save starts a fresh base', () => {
  const fresh = hashWorld(createWorld(3));
  for (const text of [null, '', 'nonsense', '[]', '{"v":2}', JSON.stringify({ v: 3, base: 'not-a-base' })]) assert.equal(hashWorld(loadWorld(text, 3)), fresh, String(text));
});

test('an edited save is repaired, never trusted', () => {
  const w = livedIn(), raw = JSON.parse(saveWorld(w));
  const bin = w.base.pieces.find((p) => p.kind === 'bin')!, bins = w.base.pieces.filter((p) => p.kind === 'bin').map((p) => p.id);
  raw.player.maxKg = 99999;
  raw.player.slots[20] = { item: 'ore', n: 999 };
  raw.player.slots[21] = { item: 'gold-bar', n: 1 };
  raw.boxes = raw.boxes.filter((b: { id: number }) => b.id !== bin.id).concat([{ id: 4242, x: 0, z: 0, slots: [], maxKg: 1 }]);
  raw.plans[0].left = [-1, 999, 'x', ...raw.plans[0].left, raw.plans[0].left[0]];
  raw.field.nodes[0].reserve = -5;
  raw.hotbar = 12;
  const back = loadWorld(JSON.stringify(raw), 7);
  assert.equal(back.player.maxKg, 120);
  assert.equal(back.player.slots[20], null, 'over a stack');
  assert.equal(back.player.slots[21], null, 'unknown item');
  assert.deepEqual(back.boxes.map((b) => b.id).sort((a, b) => a - b), [BRIDGE_STORE, ...bins].sort((a, b) => a - b), 'orphan box dropped, the bin gets an empty box');
  assert.equal(L.totals(back.boxes, [bin.id])['ore'] ?? 0, 0);
  assert.deepEqual(back.plans[0]!.left, w.plans[0]!.left);
  assert.equal(back.field.nodes.every((n) => n.reserve >= 0), true, 'a broken field is regrown');
  assert.equal(back.hotbar, 0);
  assert.equal(hashValue(back.base), hashValue(w.base), 'the structures survive');
});
