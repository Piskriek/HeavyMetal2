import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, check, remove, supports, type Env, type Kind } from '../src/index';
const m = { reg: { vKeep: 0.9, hKeep: 0.6 } }, F: Env = { heightAt: () => 0, materials: m };
const P = (kind: Kind, i: number, j: number, k: number, s: number, r: 0|1|2|3 = 0) => ({ s, kind, i, j, k, r, mat: 'reg' });
const near = (a: number | undefined, b: number) => assert.ok(Math.abs((a ?? NaN) - b) < 1e-9, `${a} vs ${b}`);
test('support, slots, collapse', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg'), s = f.base.structures[0]!.id;
  const a = place(f.base, F, P('floor', 1, 0, 0, s)), c = place(a.base, F, P('floor', 2, 0, 0, s)), d = place(c.base, F, P('bench', 2, 0, 0, s));
  const w = place(d.base, F, P('wall', 0, 0, 0, s)), p = place(w.base, F, P('pillar', 1, 1, 0, s)), u = place(p.base, F, P('floor', 0, 0, 1, s));
  const e = place(u.base, F, P('floor', 3, 0, 0, s)), sup = supports(e.base, F);
  [[f.id, 1], [a.id, 0.6], [c.id, 0.36], [d.id, 0.324], [w.id, 0.9], [p.id, 0.9], [u.id, 0.81], [e.id, 0.216]].forEach(([id, v]) => near(sup.get(id!), v!));
  const x = check(e.base, F, P('floor', 4, 0, 0, s)); assert.equal(x.why, 'unsupported'); near(x.support, 0.1296);
  assert.equal(place(e.base, F, P('floor', 4, 0, 0, s)).base, e.base);
  const why = (q: ReturnType<typeof P>) => check(e.base, F, q).why;
  assert.deepEqual([P('wall', 0, 0, 0, s), P('wall', 5, 0, 0, s, 2), P('bin', 0, 1, 0, s), P('hardpoint', 0, 0, 0, s)].map(why), ['occupied', 'bad-slot', 'needs-floor', 'needs-pad']);
  const copy = JSON.stringify(e.base), r = remove(e.base, F, a.id);
  assert.deepEqual(r.collapsed, [c.id, d.id, e.id]); assert.equal(JSON.stringify(e.base), copy);
});

import { CELL, LEVEL, toWorld } from '../src/index';

test('world transform, allocation, and rejected calls are immutable', () => {
  const initial = empty();
  const result = found(initial, F, 10, -3, Math.PI / 2, 'reg');
  assert.equal(result.ok, true);
  const structure = result.base.structures[0]!;
  const origin = toWorld(structure, 0, 0, 0);
  near(origin.x, 12);
  near(origin.z, -5);
  near(toWorld(structure, CELL, 0, 2).y, structure.y + 2 * LEVEL);
  assert.equal(result.id, result.base.pieces[0]!.id);
  assert.equal(initial.structures.length, 0);
  assert.equal(initial.pieces.length, 0);
  const refused = found(result.base, F, 10, -3, Math.PI / 2, 'missing');
  assert.equal(refused.ok, false);
  assert.equal(refused.why, 'material');
  assert.equal(refused.base, result.base);
  assert.equal(refused.id, -1);
});

test('terrain, slope, and rotated footprint overlap checks', () => {
  const rough: Env = {
    heightAt: (x) => (x < 0.001 ? 3.1 : 0),
    materials: m,
  };
  const steep = found(empty(), rough, 2, 2, 0, 'reg');
  assert.equal(steep.why, 'steep');
  assert.equal(steep.base.pieces.length, 0);

  const first = found(empty(), F, 2, 2, 0, 'reg');
  const highGround: Env = { heightAt: () => 5, materials: m };
  const s = first.base.structures[0]!.id;
  assert.equal(check(first.base, highGround, P('floor', 1, 0, 0, s)).why, 'ground');
  assert.equal(found(first.base, F, 2, 2, 0, 'reg').why, 'overlap');
  assert.equal(found(first.base, F, 5.94, 2, 0, 'reg').why, 'overlap');
  assert.equal(found(first.base, F, 5.96, 2, 0, 'reg').ok, true);
});

test('slot validation and hardpoint pad reservations', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg');
  const s = f.base.structures[0]!.id;
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), i: 0.5 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), k: -1 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), s: 999 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), mat: 'unknown' }).why, 'material');
  assert.equal(check(f.base, F, P('airlock', 0, 0, 0, s)).ok, true);
  const airlock = place(f.base, F, P('airlock', 0, 0, 0, s));
  assert.equal(check(airlock.base, F, P('wall', 0, 0, 0, s)).why, 'occupied');

  let base = f.base;
  for (const [i, j] of [[1, 0], [0, 1], [1, 1]]) {
    base = place(base, F, P('foundation', i!, j!, 0, s)).base;
  }
  const hardpoint = place(base, F, P('hardpoint', 0, 0, 0, s));
  assert.equal(hardpoint.ok, true);
  assert.equal(check(hardpoint.base, F, P('bench', 1, 1, 0, s)).why, 'occupied');
});

test('vertical foundation support and empty structure cleanup', () => {
  const slope: Env = { heightAt: (x) => (x < 0.001 ? 1 : 0), materials: m };
  const f = found(empty(), slope, 2, 2, 0, 'reg');
  const s = f.base.structures[0]!.id;
  const upper = place(f.base, slope, P('foundation', 0, 0, 1, s));
  assert.equal(upper.ok, true);
  near(supports(upper.base, slope).get(upper.id), 0.9);
  const removed = remove(upper.base, slope, f.id);
  assert.deepEqual(removed.collapsed, [upper.id]);
  assert.equal(removed.base.structures.length, 0);
  assert.equal(remove(upper.base, F, 999).base, upper.base);
});
