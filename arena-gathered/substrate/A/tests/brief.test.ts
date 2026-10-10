import test from 'node:test'; import assert from 'node:assert/strict';
import { generate, regen, advance, MAX, type Field } from '../src/index';
const near = (a: number | undefined, b: number, e = 1e-6) => assert.ok(Math.abs((a ?? NaN) - b) < e, `${a} vs ${b}`);
const one = (kind: 'dither' | 'chroma', reserve: number): Field => ({ v: 1, seed: 1, time: 0, nodes: [{ id: 5, kind, x: 0, z: 0, reserve, carry: 0 }] });
test('field, harvest, regrowth', () => {
  const a = generate(7, 500, 0), b = generate(7, 500, 4);
  assert.deepEqual(a, generate(7, 500, 0)); assert.notDeepEqual(a, generate(8, 500, 0));
  assert.ok(a.nodes.length > 50 && b.nodes.length > a.nodes.length);
  assert.ok(a.nodes.every((n) => n.kind === 'dither' || n.kind === 'fold')); assert.ok(b.nodes.some((n) => n.kind === 'chroma'));
  for (const n of a.nodes) { const m = b.nodes.find((q) => q.id === n.id); assert.ok(m); near(m.x, n.x); near(m.z, n.z); }
  for (const n of b.nodes) assert.ok(Math.hypot(n.x, n.z) <= 500);
  const f = one('chroma', 120);
  const big = advance(f, 10, 0, { id: 5, power: 2 });
  near(big.field.nodes[0]!.reserve, 240 * Math.exp(-10 / 120) - 120); assert.deepEqual(big.items, [{ item: 'pxd-chroma', n: 19 }]);
  let g = f, got = 0; for (let i = 0; i < 10; i++) { const r = advance(g, 1, 0, { id: 5, power: 2 }); g = r.field; got += r.items[0]?.n ?? 0; }
  near(g.nodes[0]!.reserve, big.field.nodes[0]!.reserve, 1e-9); assert.equal(got, 19);
  const all = advance(one('dither', 60), 1e6, 0, { id: 5, power: 1 }); assert.equal(all.field.nodes[0]!.reserve, 0); assert.equal(all.items[0]?.n, 60);
  near(advance(one('dither', 0), 600, 0, null).field.nodes[0]!.reserve, 60 * (1 - Math.exp(-1)));
  near(advance(one('dither', 0), 600, 2, null).field.nodes[0]!.reserve, 60 * (1 - Math.exp(-2)));
  const half = regen({ ...a, nodes: a.nodes.map((n) => ({ ...n, reserve: MAX[n.kind] / 2 })) }, 500, 4);
  for (const n of half.nodes) if (a.nodes.some((q) => q.id === n.id)) near(n.reserve, MAX[n.kind] / 2);
});
