import test from 'node:test';
import assert from 'node:assert/strict';
import { CELL, MIN_PLANET_RADIUS, centreOf, hexAt, distance, neighbours, ring, spiral, fnv1a, settledRadius, layout, planetRadiusFor, type GridEvent } from '../src/index';

const claim = (id: string, at: number, near: string | null = null): GridEvent => ({ kind: 'claim', id, at, near });
const same = (a: { q: number; r: number }, b: { q: number; r: number }) => a.q === b.q && a.r === b.r;

test('hex maths: centres, distance, neighbours, rings, the hash', () => {
  assert.deepEqual(centreOf({ q: 0, r: 0 }), { x: 0, z: 0 });
  const n = neighbours({ q: 0, r: 0 });
  assert.equal(n.length, 6);
  for (const h of n) {
    const c = centreOf(h);
    assert.ok(Math.abs(Math.hypot(c.x, c.z) - CELL) < 1e-6);
    assert.equal(distance(h, { q: 0, r: 0 }), 1);
  }
  const c = centreOf({ q: 3, r: -2 });
  assert.deepEqual(hexAt(c.x + 120, c.z - 90), { q: 3, r: -2 });
  assert.equal(ring({ q: 0, r: 0 }, 1).length, 6);
  assert.equal(ring({ q: 0, r: 0 }, 3).length, 18);
  assert.deepEqual(ring({ q: 0, r: 0 }, 1)[0], { q: -1, r: 1 });
  assert.equal(spiral({ q: 0, r: 0 }, 2).length, 19);
  assert.deepEqual(spiral({ q: 0, r: 0 }, 2)[0], { q: 0, r: 0 });
  assert.equal(distance({ q: 0, r: 0 }, { q: 3, r: -1 }), 3);
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('foobar'), 0xbf9cf968);
});

test('a new plot goes next to the friend it names, in ring order; ties go by id', () => {
  const L = layout([claim('ann', 1), claim('bob', 2, 'ann'), claim('dan', 3, 'ann'), claim('cat', 3, 'ann')]);
  const r1 = ring(L.get('ann')!, 1);
  assert.deepEqual(L.get('bob'), r1[0]);
  assert.deepEqual(L.get('cat'), r1[1]);
  assert.deepEqual(L.get('dan'), r1[2]);
});

test('when every neighbour is taken, the next ring out', () => {
  const evs = [claim('hub', 0)];
  for (let i = 0; i < 7; i++) evs.push(claim(`f${i}`, 1 + i, 'hub'));
  const L = layout(evs);
  const h = L.get('hub')!;
  for (let i = 0; i < 6; i++) assert.equal(distance(L.get(`f${i}`)!, h), 1);
  assert.deepEqual(L.get('f6'), ring(h, 2)[0]);
});

test('with no friend: a free cell from the plot id inside the settled disc; the same list gives the same map', () => {
  const one = layout([claim('p0', 0)]);
  const cells = spiral({ q: 0, r: 0 }, settledRadius(0));
  assert.deepEqual(one.get('p0'), cells[fnv1a('p0') % cells.length]);
  const evs = Array.from({ length: 200 }, (_, i) => claim(`p${i}`, i));
  const L1 = layout(evs), L2 = layout([...evs].reverse());
  assert.equal(L1.size, 200);
  assert.equal(new Set([...L1.values()].map((h) => `${h.q},${h.r}`)).size, 200);
  for (const [id, h] of L1) assert.deepEqual(L2.get(id), h);
  const far = Math.max(...[...L1.values()].map((h) => distance(h, { q: 0, r: 0 })));
  assert.ok(far <= 19, `farthest ring ${far}`);
});

test('a plot moves next to a friend and frees its old cell; a plot already beside the friend stays', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('bob', 2), claim('cat', 3, 'ann')];
  const before = layout(evs);
  const bobOld = before.get('bob')!;
  const after = layout([...evs, { kind: 'move', id: 'bob', at: 4, near: 'ann' }]);
  assert.equal(distance(after.get('bob')!, after.get('ann')!), 1);
  if (distance(bobOld, before.get('ann')!) > 1) assert.ok(![...after.values()].some((h) => same(h, bobOld)), 'the old cell is free');
  else assert.deepEqual(after.get('bob'), bobOld);
  const still = layout([...evs, { kind: 'move', id: 'cat', at: 4, near: 'ann' }]);
  assert.deepEqual(still.get('cat'), before.get('cat'));
});

test('a removed plot frees its cell and moves no one; naming an unknown plot falls back to a free place', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('bob', 2, 'ann'), claim('cat', 3, 'ann')];
  const before = layout(evs);
  const after = layout([...evs, { kind: 'remove', id: 'bob', at: 4 }, claim('dan', 5, 'ann')]);
  assert.equal(after.has('bob'), false);
  assert.deepEqual(after.get('ann'), before.get('ann'));
  assert.deepEqual(after.get('cat'), before.get('cat'));
  assert.deepEqual(after.get('dan'), before.get('bob'));
  assert.equal(layout([claim('eve', 1, 'nobody')]).size, 1);
});

test('the planet grows with its plots, never below MIN_PLANET_RADIUS', () => {
  assert.equal(planetRadiusFor(1), MIN_PLANET_RADIUS);
  assert.equal(planetRadiusFor(1000), MIN_PLANET_RADIUS);
  assert.ok(planetRadiusFor(100000) > MIN_PLANET_RADIUS);
});

test('performance: ten thousand plots lay out in under half a second', () => {
  const evs = Array.from({ length: 10000 }, (_, i) => claim(`p${i}`, i, i % 3 === 0 ? null : `p${i - 1}`));
  const t0 = performance.now();
  const L = layout(evs);
  assert.equal(L.size, 10000);
  assert.ok(performance.now() - t0 < 500, `${performance.now() - t0} ms`);
});
