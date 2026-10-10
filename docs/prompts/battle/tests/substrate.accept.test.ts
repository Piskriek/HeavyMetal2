// Hidden landing suite for the @hm/substrate battle (docs/prompts/battle/substrate.txt). Copy next to an answer's tests and run.
// substrate.ref.ts (same folder in docs) is my reference implementation; the differential test compares an answer with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, regen, advance, hash, MAX, type Field } from '../src/index';
import * as ref from './substrate.ref';

const one = (kind: 'dither' | 'fold' | 'chroma' | 'spire', reserve: number, carry = 0): Field => ({ v: 1, seed: 1, time: 0, nodes: [{ id: 5, kind, x: 0, z: 0, reserve, carry }] });

test('bad dt and bad beams change nothing', () => {
  const f = one('fold', 30);
  for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(advance(f, dt, 0, { id: 5, power: 1 }).field, f);
  // unknown id: the node regrows as if not beamed, no items
  const u = advance(f, 600, 0, { id: 999, power: 1 });
  assert.deepEqual(u.items, []);
  assert.ok(Math.abs(u.field.nodes[0]!.reserve - (60 - 30 * Math.exp(-1))) < 1e-9);
  // power 0 or negative: no harvest and no regrowth for the beamed node
  assert.equal(advance(f, 10, 0, { id: 5, power: -3 }).field.nodes[0]!.reserve, 30);
  // power clamps at 4
  const p9 = advance(one('chroma', 120), 5, 0, { id: 5, power: 9 }).field.nodes[0]!.reserve;
  const p4 = advance(one('chroma', 120), 5, 0, { id: 5, power: 4 }).field.nodes[0]!.reserve;
  assert.ok(Math.abs(p9 - p4) < 1e-12);
});

test('carry stays in [0, 1) and adds up', () => {
  let f = one('spire', 120, 0.9), total = 0;
  for (let i = 0; i < 200; i++) { const r = advance(f, 0.05, 3, { id: 5, power: 0.3 }); f = r.field; total += r.items[0]?.n ?? 0; const c = f.nodes[0]!.carry; assert.ok(c >= 0 && c < 1, `carry ${c}`); }
  const harvested = 120 - f.nodes[0]!.reserve;
  assert.equal(total, Math.floor(0.9 + harvested + 1e-9));
});

test('generation: ids sorted, spacing, stage clamp, regen keeps time', () => {
  const g = generate(11, 300, 9);
  assert.deepEqual(g, generate(11, 300, 6));
  for (let i = 1; i < g.nodes.length; i++) assert.ok(g.nodes[i]!.id > g.nodes[i - 1]!.id);
  for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) {
    const a = g.nodes[i]!, b = g.nodes[j]!;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 8 - 1e-9);
  }
  const t = regen({ ...generate(11, 300, 0), time: 1234 }, 300, 2);
  assert.equal(t.time, 1234);
  assert.equal(hash(1, 2, 3, 4), ref.hash(1, 2, 3, 4));
});

test('differential: matches the reference over a long random session', () => {
  let a: Field = generate(42, 400, 1), b: ref.Field = ref.generate(42, 400, 1);
  assert.deepEqual(a, b);
  let s = 99;
  const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let k = 0; k < 300; k++) {
    const stage = Math.floor(rnd() * 7), dt = rnd() * 30, pick = a.nodes[Math.floor(rnd() * a.nodes.length)]!;
    const beam = rnd() < 0.7 ? { id: pick.id, power: rnd() * 4 } : null;
    if (rnd() < 0.05) { a = regen(a, 400, stage); b = ref.regen(b, 400, stage); }
    const ra = advance(a, dt, stage, beam), rb = ref.advance(b, dt, stage, beam);
    assert.deepEqual(ra.items, rb.items);
    a = ra.field; b = rb.field;
  }
  for (let i = 0; i < a.nodes.length; i++) assert.ok(Math.abs(a.nodes[i]!.reserve - b.nodes[i]!.reserve) < 1e-6);
  assert.ok(Math.abs(MAX.spire - ref.MAX.spire) === 0);
});
