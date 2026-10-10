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
