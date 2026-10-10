// Hidden landing suite for the @hm/lattice battle (docs/prompts/battle/lattice.txt). Run against each answer before landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { box, deposit, withdraw, kg, count, links, totals, pull, store, type Box } from '../src/index';

const defs = { ore: { stack: 50, kg: 1 }, map: { stack: 10, kg: 0.5 } };
const B = (id: number, x: number, slots: Box['slots'], maxKg = 1e6): Box => ({ id, x, z: 0, slots, maxKg });

test('deposit: unknown items, bad counts, weight', () => {
  assert.equal(deposit(box(3, 0, 0, 2, 99), defs, 'gold', 5).left, 5);
  assert.deepEqual(deposit(box(3, 0, 0, 2, 99), defs, 'ore', -4).box.slots, [null, null]);
  assert.deepEqual(deposit(box(3, 0, 0, 2, 99), defs, 'ore', Number.NaN).box.slots, [null, null]);
  assert.equal(deposit(box(3, 0, 0, 2, 99), defs, 'ore', 7.9).box.slots[0]?.n, 7);
  // weight counts what is already there
  const half = deposit(box(4, 0, 0, 10, 30), defs, 'map', 20).box; // 10 kg
  assert.equal(deposit(half, defs, 'ore', 40).left, 20);
  // tops up an existing partial stack before an earlier empty slot
  const mixed = B(5, 0, [null, { item: 'ore', n: 45 }]);
  assert.deepEqual(deposit(mixed, defs, 'ore', 10).box.slots, [{ item: 'ore', n: 5 }, { item: 'ore', n: 50 }]);
});

test('withdraw more than there is; input untouched', () => {
  const b = B(1, 0, [{ item: 'ore', n: 50 }, { item: 'ore', n: 20 }, { item: 'map', n: 5 }, { item: 'ore', n: 50 }]);
  const all = withdraw(b, 'ore', 500);
  assert.equal(all.got, 120);
  assert.deepEqual(all.box.slots, [null, null, { item: 'map', n: 5 }, null]);
  assert.equal(count(b, 'ore'), 120);
  assert.equal(withdraw(b, 'gold', 3).got, 0);
});

test('links: a box bridging two relay fields joins them', () => {
  const bs = [B(1, 0, []), B(2, 25, []), B(3, 50, [])];
  const ra = { id: 1, x: 0, z: 0, range: 26 }, rb = { id: 2, x: 50, z: 0, range: 26 };
  // the relays are 50 apart (not linked) but box 2 sits inside both fields
  assert.deepEqual(links(bs, [ra, rb]), [[1, 2, 3]]);
  assert.deepEqual(links(bs, []), [[1], [2], [3]]);
  // relay ids colliding with box ids must not merge anything
  assert.deepEqual(links([B(1, 0, []), B(2, 500, [])], [{ id: 2, x: 0, z: 0, range: 5 }]), [[1], [2]]);
});

test('pull: ties by id, restricted ids, merged taken', () => {
  const bs = [B(2, 10, [{ item: 'ore', n: 5 }, { item: 'ore', n: 5 }]), B(1, -10, [{ item: 'ore', n: 5 }])];
  const p = pull(bs, [1, 2], { x: 0, z: 0 }, [{ item: 'ore', n: 8 }]);
  assert.ok(p.ok);
  // equal distance: box 1 first; box 2's two withdrawals merge into one entry
  assert.deepEqual(p.taken, [{ box: 1, item: 'ore', n: 5 }, { box: 2, item: 'ore', n: 3 }]);
  assert.equal(p.boxes[0]!.id, 2);
  assert.equal(pull(bs, [1], { x: 0, z: 0 }, [{ item: 'ore', n: 6 }]).ok, false);
  const none = pull(bs, [1, 2], { x: 0, z: 0 }, []);
  assert.ok(none.ok);
  assert.deepEqual(none.taken, []);
});

test('store: leftovers in order, only positive', () => {
  const s = store([B(1, 0, [null, null])], [1], { x: 0, z: 0 }, defs, [{ item: 'ore', n: 101 }, { item: 'gold', n: 2 }, { item: 'map', n: 0 }]);
  assert.deepEqual(s.left, [{ item: 'ore', n: 1 }, { item: 'gold', n: 2 }]);
  assert.equal(totals(s.boxes, [1]).ore, 100);
  assert.deepEqual(totals([B(1, 0, [])], [1]), {});
});

test('performance: 200 boxes, 50 relays, links plus 2000 pulls under 1 s', () => {
  const boxes: Box[] = [];
  for (let i = 0; i < 200; i++) boxes.push(deposit(box(i + 1, (i % 20) * 10, Math.floor(i / 20) * 10, 30, 1e6), defs, 'ore', 1000).box);
  const relays = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, x: (i % 10) * 20, z: Math.floor(i / 10) * 20, range: 25 }));
  const t0 = performance.now();
  const g = links(boxes, relays);
  assert.equal(g.length, 1);
  let bs = boxes;
  for (let n = 0; n < 2000; n++) {
    const p = pull(bs, g[0]!, { x: 95, z: 45 }, [{ item: 'ore', n: 7 }]);
    assert.ok(p.ok);
    bs = p.boxes;
  }
  assert.ok(performance.now() - t0 < 1000, `${performance.now() - t0} ms`);
  assert.equal(totals(bs, g[0]!).ore, 200000 - 14000);
});
