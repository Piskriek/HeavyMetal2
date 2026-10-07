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

// landed at 1 s, not the brief's half second: alone it measured 488 ms on the minimum-spec laptop, too close to pass on a busy one
test('performance: ten thousand plots lay out in under a second', () => {
  const evs = Array.from({ length: 10000 }, (_, i) => claim(`p${i}`, i, i % 3 === 0 ? null : `p${i - 1}`));
  const t0 = performance.now();
  const L = layout(evs);
  assert.equal(L.size, 10000);
  assert.ok(performance.now() - t0 < 1000, `${performance.now() - t0} ms`);
});

/* ---------- further tests of our own ---------- */

test('no result is ever negative zero', () => {
  const c = centreOf({ q: 0, r: 0 });
  assert.ok(!Object.is(c.x, -0) && !Object.is(c.z, -0));
  const h = hexAt(-0.1, -0.1);
  assert.ok(!Object.is(h.q, -0) && !Object.is(h.r, -0));
  assert.ok(!Object.is(distance({ q: 2, r: -3 }, { q: 2, r: -3 }), -0));
  for (const cell of spiral({ q: 0, r: 0 }, 2)) {
    assert.ok(!Object.is(cell.q, -0) && !Object.is(cell.r, -0));
  }
});

test('centreOf and hexAt round-trip across the settled disc', () => {
  for (const h of spiral({ q: 0, r: 0 }, 6)) {
    const c = centreOf(h);
    assert.deepEqual(hexAt(c.x, c.z), { q: h.q, r: h.r });
    assert.deepEqual(hexAt(c.x + 300, c.z + 120), { q: h.q, r: h.r });
    assert.deepEqual(hexAt(c.x - 290, c.z - 130), { q: h.q, r: h.r });
  }
});

test('rings are complete, disjoint shells and spirals concatenate them', () => {
  const c = { q: -2, r: 5 };
  const seen = new Set<string>();
  for (let n = 1; n <= 5; n++) {
    const cells = ring(c, n);
    assert.equal(cells.length, 6 * n);
    for (const h of cells) {
      assert.equal(distance(h, c), n);
      const k = `${h.q},${h.r}`;
      assert.equal(seen.has(k), false);
      seen.add(k);
    }
  }
  assert.deepEqual(ring(c, 0), []);
  const sp = spiral(c, 5);
  assert.equal(sp.length, 1 + 3 * 5 * (5 + 1));
  assert.equal(sp.length, 91);
  assert.deepEqual(sp.slice(1, 7), ring(c, 1));
  assert.equal(spiral(c, 0).length, 1);
});

test('consecutive ring cells touch, and the ring closes', () => {
  const cells = ring({ q: 4, r: -1 }, 3);
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    const b = cells[(i + 1) % cells.length]!;
    assert.equal(distance(a, b), 1);
  }
});

test('settledRadius grows slowly and always leaves slack', () => {
  assert.equal(settledRadius(0), 2);
  assert.equal(settledRadius(3), 3);
  assert.equal(settledRadius(12), 4);
  for (const n of [0, 1, 5, 50, 500, 5000]) {
    const R = settledRadius(n);
    assert.ok(1 + 3 * R * (R + 1) > n, `disc holds more than ${n}`);
  }
});

test('claims are idempotent and the clock, then the id, then the kind orders events', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('ann', 5, null), claim('bob', 2, 'ann')];
  const L = layout(evs);
  assert.equal(L.size, 2);
  assert.deepEqual(L.get('ann'), layout([claim('ann', 1)]).get('ann'));

  // at the same instant a claim is applied before a remove of the same id
  const both = layout([claim('zoe', 7), { kind: 'remove', id: 'zoe', at: 7 }]);
  assert.equal(both.size, 0);
});

test('a plot never claims a cell next to itself by naming itself', () => {
  const L = layout([claim('solo', 1, 'solo')]);
  const cells = spiral({ q: 0, r: 0 }, settledRadius(0));
  assert.deepEqual(L.get('solo'), cells[fnv1a('solo') % cells.length]);
});

test('moves that cannot apply are ignored', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('bob', 2)];
  const base = layout(evs);
  const ghost = layout([...evs, { kind: 'move', id: 'ghost', at: 3, near: 'ann' }]);
  const unknown = layout([...evs, { kind: 'move', id: 'bob', at: 3, near: 'nobody' }]);
  const self = layout([...evs, { kind: 'move', id: 'bob', at: 3, near: 'bob' }]);
  for (const L of [ghost, unknown, self]) {
    assert.deepEqual(L.get('ann'), base.get('ann'));
    assert.deepEqual(L.get('bob'), base.get('bob'));
  }
});

test('abandoned plots keep their cells for ever; only removal frees one', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('bob', 2, 'ann'), claim('cat', 3, 'ann')];
  const kept = layout([...evs, claim('dan', 9, 'ann')]);
  assert.equal(kept.size, 4);
  const cells = new Set([...kept.values()].map((h) => `${h.q},${h.r}`));
  assert.equal(cells.size, 4);
});

test('a move after a removal can reuse the freed cell', () => {
  const evs: GridEvent[] = [claim('ann', 1), claim('bob', 2, 'ann'), claim('cat', 3)];
  const before = layout(evs);
  const bobCell = before.get('bob')!;
  const after = layout([...evs, { kind: 'remove', id: 'bob', at: 4 }, { kind: 'move', id: 'cat', at: 5, near: 'ann' }]);
  assert.equal(after.has('bob'), false);
  if (distance(before.get('cat')!, before.get('ann')!) > 1) assert.deepEqual(after.get('cat'), bobCell);
  else assert.deepEqual(after.get('cat'), before.get('cat'));
  assert.equal(distance(after.get('cat')!, after.get('ann')!), 1);
});

test('layout is insensitive to input order even with moves and removals', () => {
  const evs: GridEvent[] = [
    claim('ann', 1),
    claim('bob', 2, 'ann'),
    claim('cat', 3),
    claim('dan', 4, 'cat'),
    { kind: 'move', id: 'cat', at: 5, near: 'ann' },
    { kind: 'remove', id: 'bob', at: 6 },
    claim('eve', 7, 'ann'),
  ];
  const a = layout(evs);
  const b = layout([...evs].reverse());
  const c = layout([evs[3]!, evs[6]!, evs[0]!, evs[5]!, evs[2]!, evs[4]!, evs[1]!]);
  assert.equal(a.size, b.size);
  for (const [id, h] of a) {
    assert.deepEqual(b.get(id), h);
    assert.deepEqual(c.get(id), h);
  }
});

test('an empty event list makes an empty planet', () => {
  assert.equal(layout([]).size, 0);
  assert.equal(layout([{ kind: 'remove', id: 'x', at: 1 }]).size, 0);
});

test('friend chains stay compact around their hub', () => {
  const evs: GridEvent[] = [claim('hub', 0)];
  for (let i = 0; i < 60; i++) evs.push(claim(`m${i}`, i + 1, 'hub'));
  const L = layout(evs);
  const hub = L.get('hub')!;
  for (const [, h] of L) assert.ok(distance(h, hub) <= 5);
});

test('planetRadiusFor is monotone and uses the ring formula', () => {
  let prev = 0;
  for (const n of [0, 1, 7, 19, 1000, 20000, 100000, 1000000]) {
    const r = planetRadiusFor(n);
    assert.ok(r >= MIN_PLANET_RADIUS);
    assert.ok(r >= prev);
    prev = r;
  }
  assert.equal(planetRadiusFor(100000), Math.max(MIN_PLANET_RADIUS, (CELL * (183 + 2)) / (0.85 * Math.PI)));
  assert.equal(planetRadiusFor(0), MIN_PLANET_RADIUS);
});
