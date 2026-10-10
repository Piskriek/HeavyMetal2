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

test('hashing, cell bounds, ordering, and stage clamping', () => {
  const field = generate(19, 240, 3);
  assert.deepEqual(field, generate(19, 240, 3));
  assert.ok(field.nodes.every((node, index) => index === 0 || field.nodes[index - 1]!.id < node.id));
  assert.ok(field.nodes.every((node) => Math.hypot(node.x, node.z) <= 240));
  assert.deepEqual(generate(19, 240, -2), generate(19, 240, 0));
  assert.deepEqual(generate(19, 240, 9), generate(19, 240, 6));
  assert.deepEqual(generate(19, 9, 3).nodes, []);
});

test('regen preserves time, carry, and reserve fraction without changing its input', () => {
  const original = generate(7, 500, 0);
  const modified: Field = {
    ...original,
    time: 123.5,
    nodes: original.nodes.map((node) => ({ ...node, reserve: MAX[node.kind] / 4, carry: 0.37 })),
  };
  const before = { ...modified, nodes: modified.nodes.map((node) => ({ ...node })) };
  const regenerated = regen(modified, 500, 6);

  assert.deepEqual(modified, before);
  assert.equal(regenerated.time, 123.5);
  for (const node of regenerated.nodes) {
    const old = modified.nodes.find((candidate) => candidate.id === node.id);
    if (old !== undefined) {
      near(node.reserve, MAX[node.kind] / 4);
      assert.equal(node.carry, 0.37);
    }
  }
});

test('invalid advances are identity operations and missing beams allow regrowth', () => {
  const field = one('dither', 20);
  for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = advance(field, dt, 2, null);
    assert.equal(result.field, field);
    assert.deepEqual(result.items, []);
  }

  const result = advance(field, 600, 0, { id: 404, power: 1 });
  assert.equal(result.items.length, 0);
  near(result.field.nodes[0]?.reserve, 20 + (60 - 20) * (1 - Math.exp(-1)));
  assert.equal(result.field.time, 600);
});

test('beam power clamps and the selected node does not regrow', () => {
  const field = one('dither', 60);
  const capped = advance(field, 3, 2, { id: 5, power: 9 });
  const atCap = advance(field, 3, 2, { id: 5, power: 4 });
  assert.deepEqual(capped, atCap);
  const zeroPower = advance(field, 3, 2, { id: 5, power: -2 });
  assert.equal(zeroPower.field.nodes[0]?.reserve, 60);
  assert.equal(zeroPower.field.nodes[0]?.carry, 0);
  assert.deepEqual(zeroPower.items, []);
});

test('harvest and regrowth compose over split steps', () => {
  const start = one('chroma', 75);
  const single = advance(start, 17, 4, { id: 5, power: 1.7 });
  let split = start;
  let collected = 0;
  for (let i = 0; i < 17; i += 1) {
    const step = advance(split, 1, 4, { id: 5, power: 1.7 });
    split = step.field;
    collected += step.items[0]?.n ?? 0;
  }
  near(split.nodes[0]?.reserve, single.field.nodes[0]!.reserve, 1e-9);
  near(split.nodes[0]?.carry, single.field.nodes[0]!.carry, 1e-9);
  assert.equal(collected, single.items[0]?.n ?? 0);

  const recovering = one('dither', 15);
  const regrownOnce = advance(recovering, 1200, 5, null).field;
  let regrownSplit = recovering;
  for (let i = 0; i < 12; i += 1) regrownSplit = advance(regrownSplit, 100, 5, null).field;
  near(regrownSplit.nodes[0]?.reserve, regrownOnce.nodes[0]!.reserve, 1e-9);
});
