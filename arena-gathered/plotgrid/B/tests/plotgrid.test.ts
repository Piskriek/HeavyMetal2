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

test('constants, neighbour order, settled disc and spiral structure', () => {
  assert.equal(CELL, 1000);
  assert.equal(MIN_PLANET_RADIUS, 12000);
  assert.deepEqual(neighbours({ q: 0, r: 0 }), [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ]);
  assert.deepEqual(neighbours({ q: 2, r: -1 }), [
    { q: 3, r: -1 },
    { q: 3, r: -2 },
    { q: 2, r: -2 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ]);
  assert.equal(settledRadius(0), 2);
  assert.equal(settledRadius(1), 3);
  assert.equal(settledRadius(3), 3);
  assert.equal(settledRadius(12), 4);
  assert.equal(ring({ q: 0, r: 0 }, 0).length, 0);
  assert.equal(ring({ q: 4, r: -1 }, 5).length, 30);
  assert.deepEqual(ring({ q: 2, r: 3 }, 1)[0], { q: 1, r: 4 });
  const s = spiral({ q: 2, r: -3 }, 3);
  assert.equal(s.length, 1 + 3 * 3 * 4);
  assert.deepEqual(s[0], { q: 2, r: -3 });
  assert.deepEqual(s[1], ring({ q: 2, r: -3 }, 1)[0]);
  assert.deepEqual(s[7], ring({ q: 2, r: -3 }, 2)[0]);
  assert.deepEqual(spiral({ q: 5, r: -2 }, 0), [{ q: 5, r: -2 }]);
  assert.equal(distance({ q: 2, r: 2 }, { q: 2, r: 2 }), 0);
  assert.equal(planetRadiusFor(0), MIN_PLANET_RADIUS);
  assert.ok(planetRadiusFor(100000) > planetRadiusFor(1000));
});

test('already-placed claims, unknown moves/removes, and kind order at equal timestamps', () => {
  const once = layout([claim('ann', 1), claim('ann', 2, 'ghost')]);
  assert.equal(once.size, 1);
  const ghosted = layout([
    claim('ann', 1),
    { kind: 'remove', id: 'ghost', at: 3 },
    { kind: 'move', id: 'ann', at: 4, near: 'ghost' },
    { kind: 'move', id: 'missing', at: 4, near: 'ann' },
  ]);
  assert.deepEqual(ghosted.get('ann'), once.get('ann'));
  assert.equal(layout([claim('a', 1), { kind: 'remove', id: 'a', at: 2 }, claim('a', 2)]).size, 0);
  const movedThenGone = layout([
    claim('a', 1),
    claim('b', 2),
    { kind: 'remove', id: 'a', at: 3 },
    { kind: 'move', id: 'a', at: 3, near: 'b' },
  ]);
  assert.equal(movedThenGone.has('a'), false);
  assert.equal(movedThenGone.has('b'), true);
  const selfNear = layout([claim('solo', 1, 'solo')]);
  const cells = spiral({ q: 0, r: 0 }, settledRadius(0));
  assert.deepEqual(selfNear.get('solo'), cells[fnv1a('solo') % cells.length]);
  const stay = layout([claim('a', 1), { kind: 'move', id: 'a', at: 2, near: 'a' }]);
  assert.deepEqual(stay.get('a'), layout([claim('a', 1)]).get('a'));
});

test('hexAt inverts centreOf and coordinates are never -0', () => {
  const c0 = centreOf({ q: 0, r: 0 });
  assert.equal(Object.is(c0.x, -0), false);
  assert.equal(Object.is(c0.z, -0), false);
  const origin = hexAt(0, 0);
  assert.deepEqual(origin, { q: 0, r: 0 });
  assert.equal(Object.is(origin.q, -0), false);
  assert.equal(Object.is(origin.r, -0), false);
  for (const h of spiral({ q: 0, r: 0 }, 5)) {
    const c = centreOf(h);
    assert.deepEqual(hexAt(c.x, c.z), h);
    assert.equal(Object.is(h.q, -0), false);
    assert.equal(Object.is(h.r, -0), false);
    assert.equal(Object.is(c.x, -0), false);
    assert.equal(Object.is(c.z, -0), false);
  }
  for (const h of neighbours({ q: -3, r: 2 })) {
    assert.equal(Object.is(h.q, -0), false);
    assert.equal(Object.is(h.r, -0), false);
    assert.deepEqual(hexAt(centreOf(h).x, centreOf(h).z), h);
  }
  assert.deepEqual(hexAt(centreOf({ q: -1, r: 0 }).x, centreOf({ q: -1, r: 0 }).z), { q: -1, r: 0 });
});

test('hash collisions walk ring order; near is not applied retroactively', () => {
  const cells = spiral({ q: 0, r: 0 }, settledRadius(0));
  const len = cells.length;
  const originId = 'ann';
  const slot = fnv1a(originId) % len;
  let other = '';
  for (let i = 0; i < 20000; i++) {
    const id = `id${i}`;
    if (id !== originId && fnv1a(id) % len === slot) {
      other = id;
      break;
    }
  }
  assert.notEqual(other, '');
  const collided = layout([claim(originId, 1), claim(other, 2)]);
  const target = cells[slot];
  assert.ok(target);
  assert.deepEqual(collided.get(originId), target);
  assert.deepEqual(collided.get(other), ring(target, 1)[0]);
  const lateFriend = layout([claim('bob', 1, 'ann'), claim('ann', 2)]);
  assert.equal(lateFriend.size, 2);
  const bob = lateFriend.get('bob');
  const expectedBob = cells[fnv1a('bob') % cells.length];
  assert.deepEqual(bob, expectedBob);
  assert.deepEqual(layout([claim('eve', 1, null)]).get('eve'), layout([claim('eve', 1, 'nobody')]).get('eve'));
});

test('a later claim without a friend does not move anyone; remove leaves others still', () => {
  const evs: GridEvent[] = [claim('a', 1), claim('b', 2), claim('c', 3, 'a')];
  const before = layout(evs);
  const after = layout([...evs, { kind: 'remove', id: 'b', at: 4 }]);
  assert.equal(after.has('b'), false);
  assert.deepEqual(after.get('a'), before.get('a'));
  assert.deepEqual(after.get('c'), before.get('c'));
  const reclaimed = layout([...evs, { kind: 'remove', id: 'a', at: 4 }, claim('a', 5)]);
  assert.equal(reclaimed.size, 3);
  assert.deepEqual(reclaimed.get('b'), before.get('b'));
  assert.deepEqual(reclaimed.get('c'), before.get('c'));
});

test('layout does not mutate its input and sorts by at then id', () => {
  const evs: GridEvent[] = [claim('z', 5), claim('m', 5), claim('a', 5)];
  const snapshot = evs.map((e) => e);
  const L1 = layout(evs);
  assert.equal(evs.length, 3);
  assert.equal(evs[0], snapshot[0]);
  assert.equal(evs[1], snapshot[1]);
  assert.equal(evs[2], snapshot[2]);
  const L2 = layout([claim('a', 5), claim('z', 5), claim('m', 5)]);
  assert.equal(L1.size, 3);
  for (const [id, h] of L1) assert.deepEqual(L2.get(id), h);
  const keyed = layout([claim('late', 9), claim('early', 1)]);
  const cells0 = spiral({ q: 0, r: 0 }, settledRadius(0));
  assert.deepEqual(keyed.get('early'), cells0[fnv1a('early') % cells0.length]);
  const cells1 = spiral({ q: 0, r: 0 }, settledRadius(1));
  const t = cells1[fnv1a('late') % cells1.length];
  assert.ok(t);
  const late = keyed.get('late');
  assert.ok(late);
  const early = keyed.get('early');
  assert.ok(early);
  const occupiedEarly = `${early.q},${early.r}`;
  if (`${t.q},${t.r}` !== occupiedEarly) assert.deepEqual(late, t);
  else assert.deepEqual(late, ring(t, 1)[0]);
});
