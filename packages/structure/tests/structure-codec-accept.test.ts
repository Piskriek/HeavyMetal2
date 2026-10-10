import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, decode, encode, LIMITS, type Base, type Env, type Kind } from '../src/index';
const F: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 }, basalt: { vKeep: 0.9, hKeep: 0.6 } } };
function sample(n: number): Base {
  let b = found(empty(), F, 12.3456, -7.891, 0.7, 'reg').base; const s = b.structures[0]!.id;
  for (let i = 0; b.pieces.length < n && i < 64; i++) for (let j = 0; b.pieces.length < n && j < 64; j++) {
    const kind: Kind = (i + j) % 3 ? 'foundation' : 'floor', r = place(b, F, { s, kind, i, j, k: 0, r: 0, mat: (i + j) % 2 ? 'reg' : 'basalt' });
    if (r.ok) b = r.base;
  }
  return b;
}
const valid = (b: Base) => {
  const ids = new Set<number>(), st = new Set(b.structures.map((s) => s.id));
  for (const s of b.structures) { assert.ok(!ids.has(s.id) && s.id < b.nextId && [s.x, s.y, s.z, s.yaw].every(Number.isFinite)); ids.add(s.id); }
  for (const p of b.pieces) { assert.ok(!ids.has(p.id) && p.id < b.nextId && st.has(p.s) && Number.isInteger(p.i) && p.k >= 0); ids.add(p.id); }
};
test('codec: round trip, canonical, small, hostile-safe', () => {
  const b = sample(1000), t = encode(b), d = decode(t);
  assert.ok(d); assert.equal(encode(d), t); assert.equal(d.pieces.length, 1000); assert.ok(t.length <= 12000, `${t.length}`);
  const s0 = b.structures[0]!, d0 = d.structures[0]!; // found() takes the slab centre; a structure keeps its corner
  assert.ok(Math.abs(d0.x - s0.x) <= 0.00051 && Math.abs(d0.z - s0.z) <= 0.00051 && Math.abs(d0.yaw - s0.yaw) <= 0.000051);
  assert.deepEqual(d.pieces.map((p) => [p.id, p.kind, p.i, p.j, p.k, p.r, p.mat, p.open ?? false]), b.pieces.map((p) => [p.id, p.kind, p.i, p.j, p.k, p.r, p.mat, p.open ?? false]));
  assert.equal(decode(encode(empty()))?.pieces.length, 0);
  for (const bad of ['', '!!', t + 'A', t.slice(0, -3), 'A'.repeat(LIMITS.maxChars + 1)]) assert.equal(decode(bad), null);
  assert.throws(() => encode({ ...b, pieces: [...b.pieces, { ...b.pieces[0]!, id: b.nextId + 5 }] }));
  let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let n = 0; n < 3000; n++) {
    const i = Math.floor(rnd() * t.length); let d2: Base | null = null;
    assert.doesNotThrow(() => { d2 = decode(t.slice(0, i) + abc[Math.floor(rnd() * 64)] + t.slice(i + 1)); });
    if (d2) valid(d2);
  }
});
