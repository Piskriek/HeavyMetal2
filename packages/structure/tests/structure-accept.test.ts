import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, check, remove, supports, toWorld, type Env, type Kind } from '../src/index';
const mats = { reg: { vKeep: 0.9, hKeep: 0.6 } }, flat: Env = { heightAt: () => 0, materials: mats };
const P = (kind: Kind, i: number, j: number, k: number, s: number, r: 0|1|2|3 = 0) => ({ s, kind, i, j, k, r, mat: 'reg' });
const near = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
const start = (env = flat) => { const f = found(empty(), env, 2, 2, 0, 'reg'); assert.ok(f.ok, f.why); return { b: f.base, s: f.base.structures[0]!.id, id: f.id }; };
test('cantilever and walls', () => {
  let { b, s, id } = start(); near(supports(b, flat).get(id), 1); const ids: number[] = [];
  for (const i of [1, 2, 3]) { const r = place(b, flat, P('floor', i, 0, 0, s)); assert.ok(r.ok, r.why); b = r.base; ids.push(r.id); }
  const sup = supports(b, flat); near(sup.get(ids[0]!), 0.6); near(sup.get(ids[1]!), 0.36); near(sup.get(ids[2]!), 0.216);
  const c = check(b, flat, P('floor', 4, 0, 0, s)); assert.equal(c.why, 'unsupported'); near(c.support, 0.1296);
  assert.equal(place(b, flat, P('floor', 4, 0, 0, s)).base, b);
  const w = place(b, flat, P('wall', 0, 0, 0, s)); const p = place(w.base, flat, P('pillar', 1, 1, 0, s)); const f = place(p.base, flat, P('floor', 0, 0, 1, s));
  const s2 = supports(f.base, flat); near(s2.get(w.id), 0.9); near(s2.get(p.id), 0.9); near(s2.get(f.id), 0.81);
  assert.equal(check(b, flat, P('wall', 0, 0, 0, s, 2)).why, 'bad-slot'); assert.equal(check(w.base, flat, P('wall', 0, 0, 0, s)).why, 'occupied');
});
test('collapse', () => {
  let { b, s, id } = start(); const a = place(b, flat, P('floor', 1, 0, 0, s)), c = place(a.base, flat, P('floor', 2, 0, 0, s)), d = place(c.base, flat, P('bench', 2, 0, 0, s));
  b = d.base; near(supports(b, flat).get(d.id), 0.324); const copy = JSON.stringify(b);
  const r = remove(b, flat, a.id); assert.deepEqual(r.collapsed, [c.id, d.id]); assert.deepEqual(r.base.pieces.map((q) => q.id), [id]);
  assert.equal(JSON.stringify(b), copy); const g = remove(r.base, flat, id); assert.equal(g.base.structures.length, 0);
});
test('terrain, overlap, yaw', () => {
  const slope: Env = { heightAt: (x) => x * 0.5, materials: mats }; let { b, s } = start(slope); near(b.structures[0]!.y, 2);
  assert.equal(check(b, slope, P('foundation', 1, 0, 0, s)).why, 'ground');
  const up = place(b, slope, P('foundation', 1, 0, 1, s)), dn = place(up.base, slope, P('foundation', -1, 0, 0, s));
  near(supports(dn.base, slope).get(up.id), 1); near(supports(dn.base, slope).get(dn.id), 0.6);
  assert.equal(found(empty(), { heightAt: (x) => x, materials: mats }, 2, 2, 0, 'reg').why, 'steep');
  const one = start().b; assert.equal(found(one, flat, 5, 2, 0, 'reg').why, 'overlap'); assert.ok(found(one, flat, 6, 2, 0, 'reg').ok);
  assert.equal(found(one, flat, 2, 6.5, Math.PI / 4, 'reg').why, 'overlap');
  // poses sit on the codec grid (0.0001 rad), so a quarter turn lands within a millimetre, not 1e-9
  const t = found(empty(), flat, 0, 0, Math.PI / 2, 'reg').base.structures[0]!, w = toWorld(t, 4, 0, 1), mmNear = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-3, `${a} vs ${b}`); mmNear(w.x, 2); near(w.y, 3); mmNear(w.z, 2);
});
test('fixtures and pads', () => {
  let { b, s } = start(); assert.equal(check(b, flat, P('bin', 1, 0, 0, s)).why, 'needs-floor');
  b = place(place(b, flat, P('foundation', 1, 0, 0, s)).base, flat, P('foundation', 0, 1, 0, s)).base;
  const fl = place(b, flat, P('floor', 1, 1, 0, s)); assert.equal(check(fl.base, flat, P('hardpoint', 0, 0, 0, s)).why, 'needs-pad');
  const h = place(place(b, flat, P('foundation', 1, 1, 0, s)).base, flat, P('hardpoint', 0, 0, 0, s)); assert.ok(h.ok, h.why);
  assert.equal(check(h.base, flat, P('bin', 1, 1, 0, s)).why, 'occupied');
});
test('performance: 900 slabs one by one and 50 support passes under 5 s', () => {
  const t0 = performance.now(); let { b, s } = start();
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) if (i || j) { const r = place(b, flat, P('foundation', i, j, 0, s)); assert.ok(r.ok); b = r.base; }
  for (let n = 0; n < 50; n++) assert.equal(supports(b, flat).size, 900);
  // a guard against algorithmic blowups (seconds turning into minutes), not a tight bound: 3 s flaked on the busy laptop
  assert.ok(performance.now() - t0 < 5000, `${performance.now() - t0} ms`);
});
