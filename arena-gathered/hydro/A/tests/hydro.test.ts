import test from 'node:test';
import assert from 'node:assert/strict';
import { WET_REACH, flood, type Terrain, type Source } from '../src/index';

const grid = (size: number, cell: number, h: (x: number, z: number) => number): Terrain => ({ size, cell, heights: Array.from({ length: size * size }, (_, i) => h(i % size, Math.floor(i / size))) });
const idx = (t: Terrain, x: number, z: number): number => z * t.size + x;
const bowl = (): { t: Terrain; V: number } => {
  const t = grid(33, 10, (x, z) => Math.hypot(x - 16, z - 16));
  let V = 0;
  for (const h of t.heights) if (h < 5.5) V += (5.5 - h) * t.cell * t.cell;
  return { t, V };
};

test('a bowl fills to one flat surface holding exactly the water given', () => {
  const { t, V } = bowl();
  const w = flood(t, [{ x: 20, z: 16, share: 1 }], V);
  for (let i = 0; i < t.heights.length; i++) {
    const h = t.heights[i]!;
    if (h < 5.5) {
      assert.ok(Math.abs(w.depth[i]! - (5.5 - h)) < 1e-6, `depth at cell ${i}`);
      assert.ok(Math.abs(w.level[i]! - 5.5) < 1e-6, `level at cell ${i}`);
    } else assert.equal(w.depth[i], 0);
  }
  assert.ok(Math.abs(w.volume - V) < V * 1e-9);
  assert.equal(w.drained, 0);
});

test('on a slope the water runs downhill off the plot: a stream, no lake, and nothing lost', () => {
  const t = grid(32, 10, (x) => x);
  const w = flood(t, [{ x: 20, z: 16, share: 1 }], 5000);
  assert.ok(w.depth.every((d) => d === 0));
  for (let x = 0; x <= 20; x++) assert.ok(w.stream[idx(t, x, 16)]! > 0, `no stream at x ${x}`);
  assert.equal(w.stream[idx(t, 25, 16)], 0);
  assert.equal(w.volume, 0);
  assert.ok(Math.abs(w.drained - 5000) < 1e-6);
});

test('a full hollow spills over its lowest rim into the next one, and stays level at the spill height', () => {
  const t = grid(33, 10, (x, z) => Math.min(Math.hypot(x - 8, z - 16), Math.hypot(x - 24, z - 16)) + 0.02 * ((x - 16) ** 2 + (z - 16) ** 2));
  let C = 0;
  for (let i = 0; i < t.heights.length; i++) { const h = t.heights[i]!; if (i % t.size < 16 && h < 8) C += (8 - h) * t.cell * t.cell; }
  const w = flood(t, [{ x: 8, z: 16, share: 1 }], C * 1.5);
  for (let i = 0; i < t.heights.length; i++) if (i % t.size < 16 && w.depth[i]! > 0) assert.ok(Math.abs(w.level[i]! - 8) < 1e-6, `left level ${w.level[i]}`);
  assert.ok(w.depth[idx(t, 8, 16)]! > 0);
  assert.ok(w.depth[idx(t, 24, 16)]! > 0, 'the right hollow got the overflow');
  assert.ok(w.level[idx(t, 24, 16)]! < 8);
  assert.ok(Math.abs(w.volume + w.drained - C * 1.5) < C * 1e-9);
  assert.equal(w.drained, 0);
});

test('more water never makes any cell shallower, and no water is lost', () => {
  const t = grid(48, 10, (x, z) => 10 * Math.sin(x / 5) * Math.cos(z / 7) + 0.1 * x + 0.05 * z);
  const src: Source[] = [{ x: 10, z: 10, share: 1 }, { x: 35, z: 30, share: 2 }];
  let prev = flood(t, src, 0);
  assert.ok(prev.depth.every((d) => d === 0));
  for (const V of [1e4, 5e4, 2e5, 1e6]) {
    const w = flood(t, src, V);
    for (let i = 0; i < w.depth.length; i++) assert.ok(w.depth[i]! >= prev.depth[i]! - 1e-9, `cell ${i} got shallower at ${V}`);
    assert.ok(Math.abs(w.volume + w.drained - V) < V * 1e-9);
    prev = w;
  }
});

test('ground is wet at the water and dries out over WET_REACH cells', () => {
  const { t, V } = bowl();
  const w = flood(t, [{ x: 20, z: 16, share: 1 }], V);
  assert.equal(WET_REACH, 6);
  assert.equal(w.wet[idx(t, 16, 16)], 1);
  assert.ok(Math.abs(w.wet[idx(t, 24, 16)]! - 0.5) < 1e-9, `wet ${w.wet[idx(t, 24, 16)]}`);
  assert.equal(w.wet[idx(t, 16, 28)], 0);
  for (const v of w.wet) assert.ok(v >= 0 && v <= 1);
});

test('the same inputs give the same water, the inputs are left alone, and bad inputs are refused', () => {
  const t = grid(40, 10, (x, z) => 5 * Math.sin(x / 4) + 5 * Math.cos(z / 6) + 0.2 * x);
  const src: Source[] = [{ x: 5, z: 5, share: 1 }, { x: 30, z: 20, share: 1 }];
  const frozen = JSON.stringify([t, src]);
  const a = flood(t, src, 3e5), b = flood(t, src, 3e5);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify([t, src]), frozen);
  assert.throws(() => flood({ ...t, heights: t.heights.slice(1) }, src, 1));
  assert.throws(() => flood(t, [{ x: 99, z: 0, share: 1 }], 1));
  assert.throws(() => flood(t, [{ x: 1, z: 1, share: 0 }], 1));
  assert.throws(() => flood(t, src, -1));
});

test('performance: a 128 x 128 plot with four sources floods in under 150 ms', () => {
  const t = grid(128, 7.8, (x, z) => 20 * Math.sin(x / 9) * Math.cos(z / 11) + 8 * Math.sin((x + z) / 5) + 0.15 * x);
  const src: Source[] = [{ x: 20, z: 20, share: 1 }, { x: 100, z: 30, share: 1 }, { x: 64, z: 64, share: 2 }, { x: 30, z: 110, share: 1 }];
  const t0 = performance.now();
  const w = flood(t, src, 5e6);
  assert.ok(performance.now() - t0 < 150, `${performance.now() - t0} ms`);
  assert.ok(Math.abs(w.volume + w.drained - 5e6) < 5e6 * 1e-9);
});

test('level is height plus depth; streams vanish under lakes; shares split the pour', () => {
  const t = grid(16, 4, (x) => x);
  const w = flood(t, [{ x: 10, z: 8, share: 1 }, { x: 10, z: 4, share: 3 }], 400);
  assert.equal(w.volume, 0);
  assert.ok(Math.abs(w.drained - 400) < 1e-9);
  assert.ok((w.stream[idx(t, 10, 8)] ?? 0) > 0);
  assert.ok((w.stream[idx(t, 10, 4)] ?? 0) > (w.stream[idx(t, 10, 8)] ?? 0));
  for (let i = 0; i < t.heights.length; i++) {
    assert.ok(Math.abs((w.level[i] ?? 0) - ((t.heights[i] ?? 0) + (w.depth[i] ?? 0))) < 1e-12);
    if ((w.depth[i] ?? 0) > 0) assert.equal(w.stream[i], 0);
    assert.equal(Object.is(w.depth[i], -0), false);
    assert.equal(Object.is(w.level[i], -0), false);
    assert.equal(Object.is(w.stream[i], -0), false);
    assert.equal(Object.is(w.wet[i], -0), false);
  }
  const { t: bowlT, V } = bowl();
  const lake = flood(bowlT, [{ x: 16, z: 16, share: 1 }], V);
  assert.equal(lake.stream[idx(bowlT, 16, 16)], 0);
  assert.ok((lake.depth[idx(bowlT, 16, 16)] ?? 0) > 0);
});

test('zero volume is dry; negative share, non-integer cell and negative volume throw', () => {
  const t = grid(8, 1, () => 1);
  const dry = flood(t, [{ x: 2, z: 2, share: 1 }], 0);
  assert.ok(dry.depth.every((d) => d === 0));
  assert.ok(dry.stream.every((s) => s === 0));
  assert.equal(dry.volume, 0);
  assert.equal(dry.drained, 0);
  assert.throws(() => flood(t, [{ x: -1, z: 0, share: 1 }], 1));
  assert.throws(() => flood(t, [{ x: 1.5, z: 1, share: 1 }], 1));
  assert.throws(() => flood(t, [{ x: 1, z: 1, share: -2 }], 1));
  const frozen = JSON.stringify(t);
  flood(t, [{ x: 1, z: 1, share: 1 }], 10);
  assert.equal(JSON.stringify(t), frozen);
});
