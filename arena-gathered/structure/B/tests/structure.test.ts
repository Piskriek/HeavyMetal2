// tests/structure.test.ts
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, check, remove, supports, toWorld, CELL, type Env, type Kind } from '../src/index';
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

test('found centres cell (0,0) and sets y', () => {
  const env: Env = { heightAt: (x, z) => (x + z) * 0, materials: m };
  const f = found(empty(), env, 10, -4, 0, 'reg');
  assert.equal(f.ok, true);
  const s = f.base.structures[0]!;
  const w = toWorld(s, CELL / 2, CELL / 2, 0);
  near(w.x, 10); near(w.z, -4); near(s.y, 0);
  assert.equal(f.id, s.id + 1);
});

test('material + bad-slot + overlap', () => {
  const e0 = empty();
  assert.equal(found(e0, F, 0, 0, 0, 'nope').why, 'material');
  assert.equal(found(e0, F, 0, 0, 0, 'nope').base, e0);
  const f = found(e0, F, 0, 0, 0, 'reg'), s = f.base.structures[0]!.id;
  assert.equal(check(f.base, F, P('floor', 0.5, 0, 0, s)).why, 'bad-slot');
  assert.equal(check(f.base, F, P('floor', 0, 0, -1, s)).why, 'bad-slot');
  assert.equal(check(f.base, F, P('floor', 0, 0, 0, 999)).why, 'bad-slot');
  const g = found(f.base, F, 1, 1, 0, 'reg');
  assert.equal(g.why, 'overlap'); assert.equal(g.base, f.base); assert.equal(g.id, -1);
  const h = found(f.base, F, 40, 40, 0, 'reg');
  assert.equal(h.ok, true);
});

test('terrain: steep and ground', () => {
  const hill: Env = { heightAt: (x) => (x > 0 ? 20 : 0), materials: m };
  assert.equal(found(empty(), hill, 0, 0, 0, 'reg').why, 'steep');
  const wall: Env = { heightAt: (x) => (x > 6 ? 20 : 0), materials: m };
  const f = found(empty(), wall, 0, 0, 0, 'reg'), s = f.base.structures[0]!.id;
  assert.equal(f.ok, true);
  assert.equal(check(f.base, wall, P('floor', 1, 0, 0, s)).why, 'ground');
});

test('hardpoint on a 2x2 grounded pad', () => {
  let b = empty();
  const f = found(b, F, 0, 0, 0, 'reg'); b = f.base;
  const s = f.base.structures[0]!.id;
  for (const [i, j] of [[1, 0], [0, 1], [1, 1]] as const) {
    const r = place(b, F, P('foundation', i, j, 0, s)); assert.equal(r.ok, true); b = r.base;
  }
  const hp = place(b, F, P('hardpoint', 0, 0, 0, s));
  assert.equal(hp.ok, true);
  near(supports(hp.base, F).get(hp.id), 0.9);
  assert.equal(check(hp.base, F, P('bin', 1, 1, 0, s)).why, 'occupied');
});

test('remove of unknown id is a no-op', () => {
  const f = found(empty(), F, 0, 0, 0, 'reg');
  const r = remove(f.base, F, 12345);
  assert.equal(r.base, f.base); assert.deepEqual(r.collapsed, []);
  const r2 = remove(f.base, F, f.id);
  assert.deepEqual(r2.base.structures, []); assert.deepEqual(r2.base.pieces, []);
});

test('perf: 900 pieces x 50 supports()', () => {
  let b = empty();
  const f = found(b, F, 0, 0, 0, 'reg'); b = f.base;
  const s = f.base.structures[0]!.id;
  const flat: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.99, hKeep: 0.999 } } };
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
    if (i === 0 && j === 0) continue;
    const r = place(b, flat, P('foundation', i, j, 0, s));
    if (r.ok) b = r.base;
  }
  assert.ok(b.pieces.length > 800);
  for (let n = 0; n < 50; n++) supports(b, flat);
});
