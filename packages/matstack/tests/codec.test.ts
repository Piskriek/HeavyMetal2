import test from 'node:test';
import assert from 'node:assert/strict';
import {
  materialAt,
  materialCode,
  materialName,
  quantiseMaterial,
  readMaterialCode,
  specOfName,
  CUSTOM_PREFIX,
  FLAT_TILE,
  MATERIAL_SHELF,
  type MaterialSpec,
  type SamplePoint,
} from '../src/index';

const tiles = { sample: () => FLAT_TILE };
const noise = { sample: (_k: string, u: number, v: number) => (Math.sin(u * 9.1 + v * 4.3) + 1) / 2 };
const points: SamplePoint[] = [
  { uv: [0.3, 0.7], pos: [0.3, 1.2, 0], normal: [0, 0, 1], edge: 0.004, cavity: 0.05 },
  { uv: [0.6, 0.1], pos: [0.6, 0.1, 0], normal: [0, 0, 1], edge: 0.05, cavity: 0.003 },
  { uv: [0.5, 0.5], pos: [0.5, 2, 0.5], normal: [0, 1, 0], edge: 0.05, cavity: 0.05 },
];

test('every shelf material survives a code exactly as quantised, and quantising twice changes nothing', () => {
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    const q = quantiseMaterial(m);
    assert.deepEqual(quantiseMaterial(q), q, `${id} quantises stably`);
    const back = readMaterialCode(materialCode(m));
    assert.deepEqual(back, q, `${id} round trip`);
  }
});

test('quantising barely moves the look: every channel within 0.01 at an edge, a crease and a top', () => {
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    const q = quantiseMaterial(m);
    for (const p of points) {
      const a = materialAt(m, p, tiles, noise), b = materialAt(q, p, tiles, noise);
      for (const [x, y] of [[a.colour[0], b.colour[0]], [a.colour[1], b.colour[1]], [a.colour[2], b.colour[2]], [a.metal, b.metal], [a.rough, b.rough]] as const) {
        assert.ok(Math.abs(x - y) < 0.01, `${id}: ${x} vs ${y}`);
      }
    }
  }
});

test('codes are short enough for a plot save and a share code', () => {
  const lengths = Object.values(MATERIAL_SHELF).map((m) => materialCode(m).length);
  assert.ok(Math.max(...lengths) < 1600, `longest ${Math.max(...lengths)} characters`);
});

test('a damaged or foreign code reads as nothing, never a throw', () => {
  const code = materialCode(MATERIAL_SHELF['mat:rust-bucket']!);
  assert.equal(readMaterialCode(code.slice(0, -3) + 'AAA'), null);
  assert.equal(readMaterialCode('not a code'), null);
  assert.equal(readMaterialCode(''), null);
  assert.equal(readMaterialCode('x'.repeat(100000)), null);
});

test('names: a shelf preset keeps its id; a changed one becomes a player code that reads back', () => {
  const m = MATERIAL_SHELF['mat:field-worn-hazard']!;
  assert.equal(materialName(m), 'mat:field-worn-hazard');
  const mine: MaterialSpec = { ...m, name: 'Mine', paint: ['#3c9a5a', m.paint[1]], age: 0.9 };
  const name = materialName(mine);
  assert.ok(name.startsWith(CUSTOM_PREFIX), name.slice(0, 20));
  const back = specOfName(name)!;
  assert.equal(back.paint[0], '#3c9a5a');
  assert.equal(back.age, 0.9);
  assert.deepEqual(specOfName('mat:rust-bucket'), MATERIAL_SHELF['mat:rust-bucket']);
  assert.equal(specOfName('matc:junk'), null);
  assert.equal(specOfName('darkSteel'), null);
});

test('out-of-range values clamp instead of failing', () => {
  const m = MATERIAL_SHELF['mat:lab-fresh']!;
  const wild: MaterialSpec = { ...m, age: 7, base: { ...m.base, metal: -3, rough: Number.NaN, colour: 'red' } };
  const q = readMaterialCode(materialCode(wild))!;
  assert.equal(q.age, 1);
  assert.equal(q.base.metal, 0);
  assert.equal(q.base.rough, 0);
  assert.equal(q.base.colour, '#808080');
});
