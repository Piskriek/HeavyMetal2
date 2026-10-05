// tests/machines.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, cost, fingerprint, order, recipe, type Chain } from '../src/index';
const chain: Chain = {
  machines: [
    { id: 'out', kind: 'output', knobs: {} },
    { id: 'imp', kind: 'importer', knobs: {} },
    { id: 'n', kind: 'noise', knobs: { scale: 8, octaves: 4, seed: 1 } },
    { id: 's', kind: 'stamp-normals', knobs: { strength: 1 } },
  ],
  wires: [
    { from: { machine: 'imp', port: 'pixels' }, to: { machine: 'n', port: 'pixels' } },
    { from: { machine: 'n', port: 'texture' }, to: { machine: 's', port: 'texture' } },
    { from: { machine: 's', port: 'texture' }, to: { machine: 'out', port: 'texture' } },
  ],
};
test('a good chain checks, orders and makes a recipe', () => {
  assert.deepEqual(check(chain), []);
  assert.deepEqual(order(chain), ['imp', 'n', 's', 'out']);
  const r = recipe(chain)!;
  assert.equal(r.kind, 'output');
  assert.equal(r.inputs['texture']!.kind, 'stamp-normals');
  assert.equal(r.inputs['texture']!.inputs['texture']!.knobs['octaves'], 4);
});
test('cost and fingerprint', () => {
  assert.equal(cost(chain, 256).bytes, 256 * 256 * 8);
  assert.equal(cost(chain, 512).bytes, 512 * 512 * 8);
  assert.ok(cost(chain, 512).ms > cost(chain, 256).ms);
  assert.equal(fingerprint(recipe(chain)!), fingerprint(recipe(chain)!));
});
test('problems are found', () => {
  const bad: Chain = { ...chain, wires: [...chain.wires, { from: { machine: 'out', port: 'x' }, to: { machine: 'n', port: 'pixels' } }] };
  assert.ok(check(bad).length > 0);
  assert.ok(check({ machines: [], wires: [] }).length > 0);
});

// ---- extra tests ----

const has = (problems: string[], re: RegExp): boolean => problems.some((p) => re.test(p));

test('cycles are detected', () => {
  const cyc: Chain = {
    machines: [...chain.machines, { id: 'b1', kind: 'blur', knobs: {} }, { id: 'b2', kind: 'blur', knobs: {} }],
    wires: [
      ...chain.wires,
      { from: { machine: 'b1', port: 'texture' }, to: { machine: 'b2', port: 'texture' } },
      { from: { machine: 'b2', port: 'texture' }, to: { machine: 'b1', port: 'texture' } },
    ],
  };
  assert.equal(order(cyc), null);
  assert.equal(recipe(cyc), null);
  assert.ok(has(check(cyc), /cycle/));
});

test('order is stable for ties', () => {
  const c: Chain = {
    machines: [
      { id: 'z', kind: 'importer', knobs: {} },
      { id: 'a', kind: 'importer', knobs: {} },
      { id: 'm', kind: 'noise', knobs: {} },
    ],
    wires: [{ from: { machine: 'a', port: 'pixels' }, to: { machine: 'm', port: 'pixels' } }],
  };
  assert.deepEqual(order(c), ['z', 'a', 'm']);
});

test('two wires into one input', () => {
  const c: Chain = { ...chain, wires: [...chain.wires, { from: { machine: 'imp', port: 'pixels' }, to: { machine: 'n', port: 'pixels' } }] };
  assert.ok(has(check(c), /n\.pixels has 2 wires/));
});

test('type mismatch', () => {
  const c: Chain = {
    machines: [
      { id: 'imp', kind: 'importer', knobs: {} },
      { id: 'n', kind: 'noise', knobs: {} },
      { id: 'ms', kind: 'mask-slope', knobs: { angle: 30 } },
      { id: 'out', kind: 'output', knobs: {} },
    ],
    wires: [
      { from: { machine: 'imp', port: 'pixels' }, to: { machine: 'n', port: 'pixels' } },
      { from: { machine: 'n', port: 'texture' }, to: { machine: 'ms', port: 'texture' } },
      { from: { machine: 'ms', port: 'mask' }, to: { machine: 'out', port: 'texture' } },
    ],
  };
  assert.ok(has(check(c), /type mismatch, mask into texture/));
});

test('knob range and unknown kinds', () => {
  const c: Chain = {
    ...chain,
    machines: chain.machines.map((m) => (m.id === 'n' ? { ...m, knobs: { scale: 8, octaves: 7, seed: -1 } } : m)),
  };
  const problems = check(c);
  assert.ok(has(problems, /'octaves' = 7 is out of range/));
  assert.ok(has(problems, /'seed' = -1 is out of range/));
  const u: Chain = { ...chain, machines: [...chain.machines, { id: 'q', kind: 'teleporter', knobs: {} }] };
  assert.ok(has(check(u), /unknown kind 'teleporter'/));
});

test('missing output and unwired output', () => {
  assert.ok(has(check({ machines: [{ id: 'imp', kind: 'importer', knobs: {} }], wires: [] }), /no output machine/));
  assert.ok(has(check({ machines: [{ id: 'out', kind: 'output', knobs: {} }], wires: [] }), /nothing wired/));
});

test('cost of noise and blur', () => {
  // importer 2 + noise 40*4/2 + stamp 15 + output 1
  assert.equal(cost(chain, 256).ms, 98);
  assert.equal(cost(chain, 512).ms, 392);
  const c: Chain = {
    machines: [
      { id: 'imp', kind: 'importer', knobs: {} },
      { id: 'n', kind: 'noise', knobs: { octaves: 2 } },
      { id: 'b', kind: 'blur', knobs: { radius: 4 } },
      { id: 'out', kind: 'output', knobs: {} },
    ],
    wires: [
      { from: { machine: 'imp', port: 'pixels' }, to: { machine: 'n', port: 'pixels' } },
      { from: { machine: 'n', port: 'texture' }, to: { machine: 'b', port: 'texture' } },
      { from: { machine: 'b', port: 'texture' }, to: { machine: 'out', port: 'texture' } },
    ],
  };
  assert.deepEqual(check(c), []);
  // importer 2 + noise 40*2/2 + blur 20*(1+4/4) + output 1
  assert.equal(cost(c, 256).ms, 83);
  assert.equal(cost(c, 512).ms, 332);
  assert.equal(cost(c, 256).bytes, 256 * 256 * 4);
});

test('fingerprint ignores knob order but sees knob values', () => {
  const a = { kind: 'noise', knobs: { scale: 8, octaves: 4, seed: 1 }, inputs: {} };
  const b = { kind: 'noise', knobs: { seed: 1, octaves: 4, scale: 8 }, inputs: {} };
  const d = { kind: 'noise', knobs: { seed: 2, octaves: 4, scale: 8 }, inputs: {} };
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(d));
  const reordered: Chain = {
    ...chain,
    machines: chain.machines.map((m) => (m.id === 'n' ? { ...m, knobs: { seed: 1, octaves: 4, scale: 8 } } : m)),
  };
  assert.equal(fingerprint(recipe(reordered)!), fingerprint(recipe(chain)!));
  assert.match(fingerprint(a), /^[0-9a-f]{16}$/);
});