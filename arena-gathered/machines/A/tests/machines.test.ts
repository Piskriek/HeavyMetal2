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

// ---- my own tests -------------------------------------------------------

import type { Machine, Wire } from '../src/index';

const mk = (id: string, kind: string, knobs: Record<string, number> = {}): Machine => ({ id, kind, knobs });
const wire = (from: string, fromPort: string, to: string, toPort: string): Wire => ({
  from: { machine: from, port: fromPort },
  to: { machine: to, port: toPort },
});

test('a cycle breaks order and recipe', () => {
  const looped: Chain = {
    machines: [
      mk('imp', 'importer'),
      mk('n', 'noise', { scale: 8, octaves: 3, seed: 5 }),
      mk('m', 'mix', { balance: 0.5 }),
      mk('b', 'blur', { radius: 3 }),
      mk('sl', 'mask-slope', { angle: 40 }),
      mk('out', 'output'),
    ],
    wires: [
      wire('imp', 'pixels', 'n', 'pixels'),
      wire('n', 'texture', 'm', 'a'),
      wire('b', 'texture', 'm', 'b'),
      wire('m', 'texture', 'b', 'texture'), // m -> b -> m
      wire('n', 'texture', 'sl', 'texture'),
      wire('sl', 'mask', 'm', 'mask'),
      wire('m', 'texture', 'out', 'texture'),
    ],
  };
  const problems = check(looped);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /cycle/);
  assert.match(problems[0]!, /m -> b -> m/);
  assert.equal(order(looped), null);
  assert.equal(recipe(looped), null);
});

test('two wires into one input is refused', () => {
  const c: Chain = {
    machines: [mk('a', 'importer'), mk('b', 'importer'), mk('n', 'noise', { scale: 4, octaves: 2, seed: 1 }), mk('out', 'output')],
    wires: [wire('a', 'pixels', 'n', 'pixels'), wire('b', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'out', 'texture')],
  };
  const doubles = check(c).filter((p) => p.includes('two wires'));
  assert.equal(doubles.length, 1);
  assert.match(doubles[0]!, /"n\.pixels"/);
});

test('ports of different types cannot be wired', () => {
  const c: Chain = {
    machines: [
      mk('n', 'noise', { scale: 4, octaves: 2, seed: 1 }),
      mk('sl', 'mask-slope', { angle: 20 }),
      mk('b', 'blur', { radius: 2 }),
      mk('out', 'output'),
    ],
    wires: [wire('n', 'texture', 'sl', 'texture'), wire('sl', 'mask', 'b', 'texture'), wire('b', 'texture', 'out', 'texture')],
  };
  const problems = check(c);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /type mismatch/);
  assert.match(problems[0]!, /mask/);
  // the same mask port is legal on mix
  const ok: Chain = {
    machines: [mk('n', 'noise', { scale: 4, octaves: 2, seed: 1 }), mk('sl', 'mask-slope', { angle: 20 }), mk('m', 'mix', { balance: 0.5 }), mk('out', 'output')],
    wires: [wire('n', 'texture', 'sl', 'texture'), wire('n', 'texture', 'm', 'a'), wire('n', 'texture', 'm', 'b'), wire('sl', 'mask', 'm', 'mask'), wire('m', 'texture', 'out', 'texture')],
  };
  assert.deepEqual(check(ok), []);
});

test('knobs outside their range are named', () => {
  const c: Chain = {
    machines: [mk('n', 'noise', { scale: 200, octaves: 0, seed: -3 }), mk('b', 'blur', { radius: 2 }), mk('out', 'output')],
    wires: [wire('n', 'texture', 'b', 'texture'), wire('b', 'texture', 'out', 'texture')],
  };
  const problems = check(c);
  assert.equal(problems.length, 3);
  assert.ok(problems.every((p) => p.includes('outside')));
  assert.ok(problems.some((p) => p.includes('n.scale') && p.includes('1..64')));
  assert.ok(problems.some((p) => p.includes('n.octaves') && p.includes('1..6')));
  assert.ok(problems.some((p) => p.includes('n.seed') && p.includes('0..9999')));
});

test('unknown kinds, machines and ports are named too', () => {
  const c: Chain = {
    machines: [mk('n', 'noise', { scale: 4, octaves: 2, seed: 1 }), mk('ghost', 'quantum-smelter'), mk('out', 'output')],
    wires: [wire('ghost', 'goo', 'n', 'pixels'), wire('n', 'texture', 'out', 'nope')],
  };
  const problems = check(c);
  assert.ok(problems.some((p) => p.includes('unknown kind "quantum-smelter"')));
  assert.ok(problems.some((p) => p.includes('unknown machine "ghost"')));
  assert.ok(problems.some((p) => p.includes('not an input port of "out"')));
});

test('unwritten knobs take the kind default', () => {
  const c: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise'), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'out', 'texture')],
  };
  assert.deepEqual(check(c), []);
  const r = recipe(c)!;
  assert.equal(r.inputs['texture']!.knobs['octaves'], 3);
  assert.equal(r.inputs['texture']!.knobs['scale'], 8);
  assert.equal(r.inputs['texture']!.inputs['pixels']!.kind, 'importer');
});

test('an output with nothing wired in', () => {
  const c: Chain = { machines: [mk('imp', 'importer'), mk('out', 'output')], wires: [] };
  assert.ok(check(c).some((p) => p.includes('nothing wired')));
  assert.deepEqual(order(c), ['imp', 'out']);
  assert.equal(recipe(c), null);
});

test('cost: noise follows octaves, blur follows radius, both follow area', () => {
  const base: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 8, octaves: 4, seed: 2 }), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'out', 'texture')],
  };
  assert.equal(cost(base, 256).ms, 2 + 6 * 2 + 1); // 15
  assert.equal(cost(base, 512).ms, (2 + 6 * 2 + 1) * 4);
  assert.equal(cost(base, 256).bytes, 256 * 256 * 4); // no normals: colour only

  const calm: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 8, octaves: 2, seed: 2 }), mk('out', 'output')],
    wires: base.wires,
  };
  assert.equal(cost(calm, 256).ms, 2 + 6 * 1 + 1); // 9
  assert.ok(cost(base, 256).ms > cost(calm, 256).ms);

  const blurry: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 8, octaves: 1, seed: 2 }), mk('b', 'blur', { radius: 4 }), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'b', 'texture'), wire('b', 'texture', 'out', 'texture')],
  };
  assert.equal(cost(blurry, 256).ms, 2 + 6 * 0.5 + 5 * 2 + 1); // 16
  assert.equal(cost(blurry, 128).ms, (2 + 6 * 0.5 + 5 * 2 + 1) * 0.25);
  assert.equal(cost(blurry, 128).bytes, 128 * 128 * 4);
});

test('only the machines that reach the output are baked', () => {
  const baked: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 8, octaves: 4, seed: 2 }), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'out', 'texture')],
  };
  const withIdle: Chain = { machines: [...baked.machines, mk('idle', 'blur', { radius: 8 })], wires: baked.wires };
  assert.deepEqual(check(withIdle), []);
  assert.equal(cost(withIdle, 256).ms, cost(baked, 256).ms);
  assert.ok(order(withIdle)!.length > order(baked)!.length);
});

test('a fan-out source is copied into every branch of the recipe', () => {
  const c: Chain = {
    machines: [
      mk('imp', 'importer'),
      mk('n', 'noise', { scale: 8, octaves: 3, seed: 4 }),
      mk('b1', 'blur', { radius: 2 }),
      mk('b2', 'blur', { radius: 2 }),
      mk('sl', 'mask-slope', { angle: 60 }),
      mk('m', 'mix', { balance: 0.5 }),
      mk('out', 'output'),
    ],
    wires: [
      wire('imp', 'pixels', 'n', 'pixels'),
      wire('n', 'texture', 'b1', 'texture'),
      wire('n', 'texture', 'b2', 'texture'),
      wire('n', 'texture', 'sl', 'texture'),
      wire('b1', 'texture', 'm', 'a'),
      wire('b2', 'texture', 'm', 'b'),
      wire('sl', 'mask', 'm', 'mask'),
      wire('m', 'texture', 'out', 'texture'),
    ],
  };
  assert.deepEqual(check(c), []);
  assert.deepEqual(order(c), ['imp', 'n', 'b1', 'b2', 'sl', 'm', 'out']);
  const r = recipe(c)!;
  const a = r.inputs['texture']!.inputs['a']!;
  const b = r.inputs['texture']!.inputs['b']!;
  assert.equal(a.kind, 'blur');
  assert.equal(fingerprint(a), fingerprint(b));
  assert.equal(cost(c, 256).ms, 2 + 6 * 1.5 + 5 + 5 + 3 + 4 + 1); // 29, both blurs baked
});

test('fingerprint ignores knob order, cares about values', () => {
  const one: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 8, octaves: 4, seed: 2 }), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'n', 'pixels'), wire('n', 'texture', 'out', 'texture')],
  };
  const shuffled: Chain = {
    machines: [mk('n', 'noise', { seed: 2, octaves: 4, scale: 8 }), mk('out', 'output'), mk('imp', 'importer')],
    wires: [wire('n', 'texture', 'out', 'texture'), wire('imp', 'pixels', 'n', 'pixels')],
  };
  const ra = recipe(one)!;
  const rb = recipe(shuffled)!;
  assert.match(fingerprint(ra), /^tx-[0-9a-f]{16}$/);
  assert.equal(fingerprint(ra), fingerprint(rb));

  const changed: Chain = {
    machines: [mk('imp', 'importer'), mk('n', 'noise', { scale: 9, octaves: 4, seed: 2 }), mk('out', 'output')],
    wires: one.wires,
  };
  assert.notEqual(fingerprint(recipe(changed)!), fingerprint(ra));

  const otherKind: Chain = {
    machines: [mk('imp', 'importer'), mk('b', 'blur', { radius: 2 }), mk('out', 'output')],
    wires: [wire('imp', 'pixels', 'b', 'pixels'), wire('b', 'texture', 'out', 'texture')],
  };
  assert.notEqual(fingerprint(recipe(otherKind)!), fingerprint(ra));
});