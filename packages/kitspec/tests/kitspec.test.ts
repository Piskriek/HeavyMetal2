import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determinant3,
  draws,
  flatten,
  instanceBuckets,
  maxRank,
  mergeBuckets,
  multiply,
  presetBounds,
  rotation,
  transformPoint,
  validate,
  type Kit,
} from '../src/index';

/** A capacitor bank like the plan 38 pilot: one generated can, three times on a skid, caps and bolts as code. */
const bank: Kit = {
  parts: {
    can: {
      source: { kind: 'gen', asset: 'capacitor-can', bounds: { min: [-0.25, 0, -0.25], max: [0.25, 1.4, 0.25] } },
      material: 'gen:capacitor-can',
      rank: 0,
      sockets: { top: { at: [0, 1.4, 0] } },
    },
    skid: { source: { kind: 'box', size: [1.8, 0.15, 0.7] }, material: 'darkSteel', rank: 0, sockets: { deck: { at: [0, 0.15, 0] } } },
    cap: { source: { kind: 'box', size: [0.2, 0.08, 0.2] }, material: 'darkSteel', rank: 1, sockets: { stud: { at: [0, 0.08, 0] } } },
    bolt: { source: { kind: 'box', size: [0.03, 0.03, 0.03] }, material: 'steel', rank: 2 },
  },
  assemblies: {
    cell: {
      children: [
        { ref: 'can', key: 'can' },
        { ref: 'cap', key: 'cap', on: { child: 0, socket: 'top' } },
        { ref: 'bolt', key: 'bolt', on: { child: 1, socket: 'stud' } },
      ],
    },
    'capacitor-bank': {
      children: [
        { ref: 'skid', key: 'skid' },
        { ref: 'cell', key: 'cells', on: { child: 0, socket: 'deck' }, at: [-0.55, 0, 0], repeat: { count: 3, step: [0.55, 0, 0] } },
      ],
    },
  },
};

test('flatten places every part in a fixed order with paths', () => {
  const placed = flatten(bank, 'capacitor-bank');
  assert.deepEqual(
    placed.map((p) => p.path),
    ['skid', 'cells[0]/can', 'cells[0]/cap', 'cells[0]/bolt', 'cells[1]/can', 'cells[1]/cap', 'cells[1]/bolt', 'cells[2]/can', 'cells[2]/cap', 'cells[2]/bolt'],
  );
  assert.deepEqual(flatten(bank, 'capacitor-bank'), placed, 'deterministic');
});

test('sockets and repeats put each copy where it belongs', () => {
  const placed = flatten(bank, 'capacitor-bank');
  const origin = (path: string) => transformPoint(placed.find((p) => p.path === path)!.matrix, [0, 0, 0]);
  assert.deepEqual(origin('cells[0]/can'), [-0.55, 0.15, 0]);
  assert.deepEqual(origin('cells[2]/can'), [0.55, 0.15, 0]);
  const cap = origin('cells[1]/cap');
  assert.ok(Math.abs(cap[1] - 1.55) < 1e-9, `cap on the can top: ${cap[1]}`);
  const bolt = origin('cells[1]/bolt');
  assert.ok(Math.abs(bolt[1] - 1.63) < 1e-9, `bolt on the cap stud: ${bolt[1]}`);
});

test('ranks: a part keeps its own rank, and a placement can raise a subtree', () => {
  const placed = flatten(bank, 'capacitor-bank');
  assert.equal(placed.find((p) => p.path === 'cells[0]/can')!.rank, 0);
  assert.equal(placed.find((p) => p.path === 'cells[0]/cap')!.rank, 1);
  assert.equal(placed.find((p) => p.path === 'cells[0]/bolt')!.rank, 2);
  const raised: Kit = { ...bank, assemblies: { ...bank.assemblies, top: { children: [{ ref: 'cell', rank: 1 }] } } };
  assert.deepEqual(flatten(raised, 'top').map((p) => p.rank), [1, 1, 2]);
});

test('maxRank is the lower of the stage and the tier', () => {
  assert.equal(maxRank(0, 'high'), 0);
  assert.equal(maxRank(1, 'high'), 0);
  assert.equal(maxRank(2, 'high'), 1);
  assert.equal(maxRank(3, 'high'), 2);
  assert.equal(maxRank(6, 'low'), 1);
  assert.equal(maxRank(6, 'medium'), 2);
  assert.equal(maxRank(2, 'low'), 1);
});

test('draws hides ranks above the max, and small rank-2 parts by screen size', () => {
  assert.equal(draws(2, 1, 'high'), false);
  assert.equal(draws(1, 1, 'low'), true);
  assert.equal(draws(2, 2, 'medium', 0.002), false);
  assert.equal(draws(2, 2, 'high', 0.002), true);
  assert.equal(draws(1, 2, 'medium', 0.0001), true, 'only rank 2 hides by size');
});

test('merge buckets group by material and rank; instance buckets by repeated part', () => {
  const placed = flatten(bank, 'capacitor-bank');
  const merge = mergeBuckets(placed);
  assert.deepEqual([...merge.keys()], ['darkSteel|0', 'gen:capacitor-can|0', 'darkSteel|1', 'steel|2']);
  assert.equal(merge.get('darkSteel|1')!.length, 3);
  const inst = instanceBuckets(placed);
  assert.deepEqual([...inst.keys()], ['can', 'cap', 'bolt']);
  assert.equal(inst.get('can')!.length, 3);
});

test('mirroring flips handedness and is reported', () => {
  const kit: Kit = {
    parts: { post: { source: { kind: 'box', size: [0.2, 2, 0.2] }, material: 'steel', rank: 0 } },
    assemblies: { frame: { children: [{ ref: 'post', at: [-1, 0, 0] }, { ref: 'post', at: [1, 0, 0], mirror: 'x' }] } },
  };
  const placed = flatten(kit, 'frame');
  assert.equal(placed[0]!.mirrored, false);
  assert.equal(placed[1]!.mirrored, true);
  assert.ok(determinant3(placed[1]!.matrix) < 0);
});

test('rotation follows three.js XYZ order and is exact at right angles', () => {
  assert.deepEqual(transformPoint(rotation([0, 90, 0]), [1, 0, 0]), [0, 0, -1]);
  assert.deepEqual(transformPoint(rotation([90, 0, 0]), [0, 1, 0]), [0, 0, 1]);
  const xyz = rotation([30, 40, 50]);
  const chained = multiply(multiply(rotation([30, 0, 0]), rotation([0, 40, 0])), rotation([0, 0, 50]));
  xyz.forEach((v, i) => assert.ok(Math.abs(v - (chained[i] as number)) < 1e-12));
});

test('a clean preset validates, and its bounds cover the parts', () => {
  assert.deepEqual(validate(bank, 'capacitor-bank'), []);
  const b = presetBounds(bank, flatten(bank, 'capacitor-bank'))!;
  assert.deepEqual(b.min.map((v) => Math.round(v * 1000) / 1000), [-0.9, 0, -0.35]);
  assert.ok(Math.abs(b.max[1] - 1.66) < 1e-9);
});

test('validate reports unknown refs, cycles, bad parents, sockets and repeats', () => {
  const broken: Kit = {
    parts: bank.parts,
    assemblies: {
      a: {
        children: [
          { ref: 'nope' },
          { ref: 'cap', on: { child: 2, socket: 'stud' } },
          { ref: 'skid', on: { child: 0, socket: 'deck' } },
          { ref: 'can', key: 'c' },
          { ref: 'cap', on: { child: 3, socket: 'side' } },
          { ref: 'bolt', repeat: { count: 0, step: [1, 0, 0] } },
          { ref: 'b' },
        ],
      },
      b: { children: [{ ref: 'a' }] },
    },
  };
  const codes = validate(broken, 'a').map((i) => i.code);
  for (const c of ['unknown-ref', 'bad-parent', 'unknown-socket', 'bad-repeat', 'cycle'] as const) assert.ok(codes.includes(c), `${c} in ${codes.join(',')}`);
  assert.deepEqual(validate({ parts: {}, assemblies: { e: { children: [] } } }, 'e').map((i) => i.code), ['empty']);
});

test('nothing floats: a part with no path of contacts to the ground is flagged, and anchors count as support', () => {
  const kit: Kit = {
    parts: {
      base: { source: { kind: 'box', size: [1, 0.2, 1] }, material: 'steel', rank: 0 },
      lamp: { source: { kind: 'box', size: [0.1, 0.1, 0.1] }, material: 'lamp', rank: 1 },
    },
    assemblies: {
      ok: { children: [{ ref: 'base' }, { ref: 'lamp', at: [0, 0.2, 0] }] },
      hover: { children: [{ ref: 'base' }, { ref: 'lamp', at: [0, 0.5, 0] }] },
      sunk: { children: [{ ref: 'base', at: [0, -0.1, 0] }] },
      wall: { children: [{ ref: 'lamp', at: [0, 1.5, 0] }] },
    },
  };
  assert.deepEqual(validate(kit, 'ok'), []);
  assert.deepEqual(validate(kit, 'hover').map((i) => `${i.code} ${i.at}`), ['floating lamp#1']);
  assert.deepEqual(validate(kit, 'sunk').map((i) => i.code), ['below-ground']);
  assert.deepEqual(validate(kit, 'wall').map((i) => i.code), ['floating']);
  const wallPlane = { min: [-1, 0, -0.06] as const, max: [1, 3, -0.05] as const };
  assert.deepEqual(validate(kit, 'wall', { ground: null, anchors: [wallPlane] }), []);
});

test('param parts take their bounds from @hm/partgen, and overrides change one copy', () => {
  const kit: Kit = {
    parts: {
      base: { source: { kind: 'box', size: [1, 0.1, 1] }, material: 'steel', rank: 0 },
      bolt: { source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.04, headHeight: 0.02 } }, material: 'steel', rank: 2 },
    },
    assemblies: { p: { children: [{ ref: 'base' }, { ref: 'bolt', key: 'b', at: [0, 0.1, 0], repeat: { count: 2, step: [0.3, 0, 0] } }] } },
  };
  assert.deepEqual(validate(kit, 'p'), []);
  const placed = flatten(kit, 'p', { 'b[1]': { params: { headWidth: 0.1 }, material: 'green' } });
  const b0 = placed.find((p) => p.path === 'b[0]')!, b1 = placed.find((p) => p.path === 'b[1]')!;
  assert.equal(b0.material, 'steel');
  assert.equal(b1.material, 'green');
  assert.deepEqual(b1.source, { kind: 'param', gen: 'bolt', params: { headWidth: 0.1, headHeight: 0.02 } });
  const wide = presetBounds(kit, [b1])!;
  assert.ok(wide.max[0] - wide.min[0] >= 0.1 - 1e-9);
  // a bolt lifted off the plate by an override floats
  const lifted: Kit = { ...kit, assemblies: { p: { children: [{ ref: 'base' }, { ref: 'bolt', key: 'b', at: [0, 0.3, 0] }] } } };
  assert.deepEqual(validate(lifted, 'p').map((i) => i.code), ['floating']);
});

test('presetSockets gives the top assembly sockets and every placed part socket in the preset frame', async () => {
  const { presetSockets } = await import('../src/index');
  const kit: Kit = {
    ...bank,
    assemblies: { ...bank.assemblies, 'capacitor-bank': { ...bank.assemblies['capacitor-bank']!, sockets: { vent: { at: [0, 2, -0.4] } } } },
  };
  const s = presetSockets(kit, 'capacitor-bank');
  assert.deepEqual(s.vent?.at, [0, 2, -0.4]);
  const top = s['cells[2]/can.top']!.at;
  assert.ok(Math.abs(top[0] - 0.55) < 1e-9 && Math.abs(top[1] - 1.55) < 1e-9, JSON.stringify(top));
  assert.ok(s['skid.deck'], 'the skid deck socket is listed');
});
