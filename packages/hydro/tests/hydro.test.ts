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

/* ---------- further tests of our own ---------- */

const cone = (size: number, cell: number): Terrain => grid(size, cell, (x, z) => Math.hypot(x - (size - 1) / 2, z - (size - 1) / 2));

/** the terrain of the acceptance performance test, at any size */
const ridges = (size: number, cell: number): Terrain =>
  grid(size, cell, (x, z) => 20 * Math.sin(x / 9) * Math.cos(z / 11) + 8 * Math.sin((x + z) / 5) + 0.15 * x);

test('regression: overflow between hollows always settles — 48 x 48, four sources, in under 100 ms', () => {
  const t = ridges(48, 7.8);
  const src: Source[] = [{ x: 7, z: 7, share: 1 }, { x: 37, z: 11, share: 1 }, { x: 24, z: 24, share: 2 }, { x: 11, z: 41, share: 1 }];
  const t0 = performance.now();
  const w = flood(t, src, 3e5);
  const ms = performance.now() - t0;
  assert.ok(ms < 100, `${ms} ms`);
  assert.ok(Math.abs(w.volume + w.drained - 3e5) < 3e5 * 1e-9, `volume ${w.volume} + drained ${w.drained}`);
  assert.ok(w.volume > 0, 'some water should be lying in the hollows');
  for (let i = 0; i < w.depth.length; i++) {
    assert.ok(w.depth[i]! >= 0);
    assert.ok(Math.abs(w.level[i]! - (t.heights[i]! + w.depth[i]!)) < 1e-9);
  }
});

test('regression: the same ridges at several sizes and volumes all settle quickly', () => {
  for (const size of [16, 32, 48, 64]) {
    for (const V of [1e4, 1e5, 3e5, 2e6]) {
      const t = ridges(size, 7.8);
      const src: Source[] = [
        { x: Math.floor(size / 6), z: Math.floor(size / 6), share: 1 },
        { x: Math.floor(size / 2), z: Math.floor(size / 2), share: 2 },
        { x: size - 3, z: Math.floor(size / 4), share: 1 },
      ];
      const t0 = performance.now();
      const w = flood(t, src, V);
      const ms = performance.now() - t0;
      assert.ok(ms < 150, `${size} at ${V}: ${ms} ms`);
      assert.ok(Math.abs(w.volume + w.drained - V) < V * 1e-9, `${size} at ${V}: ${w.volume} + ${w.drained}`);
    }
  }
});

test('a lake never stands above its lowest rim, so no water hangs on a hillside', () => {
  const t = ridges(40, 7.8);
  const w = flood(t, [{ x: 20, z: 20, share: 1 }, { x: 6, z: 32, share: 1 }], 4e5);
  const size = t.size;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = z * size + x;
      if (w.depth[i]! <= 0) continue;
      const lvl = w.level[i]!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const j = nz * size + nx;
        if (w.depth[j]! > 0) continue;
        assert.ok(t.heights[j]! >= lvl - 1e-6, `dry cell ${nx},${nz} at ${t.heights[j]} is under the surface ${lvl}`);
      }
    }
  }
});

test('two hollows joined by a pass end up as one lake with one surface', () => {
  // a double bowl whose rim around the pair sits well above the pass at 10
  const t = grid(41, 5, (x, z) => Math.min(Math.hypot(x - 10, z - 20), Math.hypot(x - 30, z - 20)) + 0.01 * ((x - 20) ** 2 + (z - 20) ** 2));
  const target = 11;
  let V = 0;
  for (const h of t.heights) if (h < target) V += (target - h) * t.cell * t.cell;
  const w = flood(t, [{ x: 10, z: 20, share: 1 }, { x: 30, z: 20, share: 1 }], V);
  const left = w.level[idx(t, 10, 20)]!;
  const right = w.level[idx(t, 30, 20)]!;
  assert.ok(w.depth[idx(t, 10, 20)]! > 0 && w.depth[idx(t, 30, 20)]! > 0);
  assert.ok(Math.abs(left - right) < 1e-6, `one surface: ${left} vs ${right}`);
  assert.ok(Math.abs(left - target) < 1e-6, `settled at ${left}`);
  assert.ok(w.depth[idx(t, 20, 20)]! > 0, 'the pass between them is under water');
  assert.equal(w.drained, 0);
  assert.ok(Math.abs(w.volume + w.drained - V) < V * 1e-9);
});

test('a flat plateau: the water creeps out and leaves over the edge', () => {
  const t = grid(21, 4, () => 3);
  const t0 = performance.now();
  const w = flood(t, [{ x: 10, z: 10, share: 1 }], 5000);
  assert.ok(performance.now() - t0 < 100, 'a flat plot must still settle');
  assert.ok(Math.abs(w.volume + w.drained - 5000) < 1e-6);
  assert.ok(w.drained > 0, 'a flat plot at the edge of the plot lets water off');
});

test('a bowl inside a bowl: filling the inner one spills into the outer one', () => {
  const t = grid(31, 5, (x, z) => {
    const d = Math.hypot(x - 15, z - 15);
    return d < 4 ? 10 + d : d < 8 ? 18 - d : 10 + (d - 8) * 0.5;
  });
  for (const V of [1e3, 1e4, 1e5, 1e6]) {
    const t0 = performance.now();
    const w = flood(t, [{ x: 15, z: 15, share: 1 }], V);
    assert.ok(performance.now() - t0 < 100, `${V} took too long`);
    assert.ok(Math.abs(w.volume + w.drained - V) < V * 1e-9);
  }
});

test('pouring into a lake that is already full passes the water on, it does not loop', () => {
  const t = ridges(32, 7.8);
  const src: Source[] = [{ x: 16, z: 16, share: 1 }];
  const first = flood(t, src, 5e4);
  const many: Source[] = Array.from({ length: 8 }, () => ({ x: 16, z: 16, share: 1 }));
  const t0 = performance.now();
  const second = flood(t, many, 5e4);
  assert.ok(performance.now() - t0 < 100, 'eight pours into the same pit must settle');
  assert.ok(Math.abs(second.volume + second.drained - 5e4) < 5e4 * 1e-9);
  assert.ok(Math.abs(first.volume - second.volume) < 1e-6, `${first.volume} vs ${second.volume}`);
});

test('no water means a dry plot', () => {
  const t = cone(11, 2);
  const w = flood(t, [{ x: 5, z: 5, share: 1 }], 0);
  assert.equal(w.volume, 0);
  assert.equal(w.drained, 0);
  assert.ok(w.depth.every((d) => d === 0));
  assert.ok(w.stream.every((s) => s === 0));
  assert.ok(w.wet.every((v) => v === 0));
  for (let i = 0; i < t.heights.length; i++) assert.equal(w.level[i], t.heights[i]);
});

test('every output has one value per cell and level is height plus depth', () => {
  const t = grid(16, 5, (x, z) => 3 * Math.sin(x / 3) + 2 * Math.cos(z / 2) + 0.4 * x);
  const w = flood(t, [{ x: 8, z: 8, share: 1 }], 4000);
  const n = 16 * 16;
  assert.equal(w.depth.length, n);
  assert.equal(w.level.length, n);
  assert.equal(w.stream.length, n);
  assert.equal(w.wet.length, n);
  for (let i = 0; i < n; i++) {
    assert.ok(w.depth[i]! >= 0);
    assert.ok(Math.abs(w.level[i]! - (t.heights[i]! + w.depth[i]!)) < 1e-12);
    assert.ok(w.stream[i]! >= 0 && w.stream[i]! <= 1);
    assert.ok(!Object.is(w.depth[i], -0));
  }
});

test('a small pour stays in the lowest cell of the pit', () => {
  const t = cone(11, 2); // cells of 4 square metres, pit at (5, 5)
  const w = flood(t, [{ x: 5, z: 5, share: 1 }], 2);
  assert.ok(Math.abs(w.depth[idx(t, 5, 5)]! - 0.5) < 1e-12);
  assert.ok(Math.abs(w.volume - 2) < 1e-12);
  assert.equal(w.drained, 0);
  let wetCells = 0;
  for (const d of w.depth) if (d > 0) wetCells++;
  assert.equal(wetCells, 1);
});

test('the lake surface is one flat level across every cell it covers', () => {
  const t = cone(11, 2);
  const w = flood(t, [{ x: 5, z: 5, share: 1 }], 8);
  const covered: number[] = [];
  for (let i = 0; i < t.heights.length; i++) if (w.depth[i]! > 0) covered.push(i);
  assert.equal(covered.length, 5, 'the pit and its four neighbours');
  for (const i of covered) assert.ok(Math.abs(w.level[i]! - 1.2) < 1e-12, `level ${w.level[i]}`);
  assert.ok(Math.abs(w.volume - 8) < 1e-9);
  assert.equal(w.drained, 0);
});

test('a hollow that reaches the edge of the plot spills off it', () => {
  const t = cone(9, 1); // the lowest border cells sit at height 4
  let cap = 0;
  for (const h of t.heights) if (h < 4) cap += 4 - h;
  const w = flood(t, [{ x: 4, z: 4, share: 1 }], cap + 100);
  assert.ok(Math.abs(w.volume - cap) < 1e-6, `volume ${w.volume} vs ${cap}`);
  assert.ok(Math.abs(w.drained - 100) < 1e-6, `drained ${w.drained}`);
  assert.ok(Math.abs(w.volume + w.drained - (cap + 100)) < 1e-6);
  for (let i = 0; i < t.heights.length; i++) {
    if (t.heights[i]! < 4) assert.ok(Math.abs(w.level[i]! - 4) < 1e-9);
  }
});

test('water that runs over a cell and is then drowned shows no stream', () => {
  const t = cone(11, 2);
  const w = flood(t, [{ x: 3, z: 5, share: 1 }], 60);
  assert.ok(w.depth[idx(t, 3, 5)]! > 0, 'the source cell is under the lake');
  assert.equal(w.stream[idx(t, 3, 5)], 0);
  assert.equal(w.drained, 0);
  assert.ok(Math.abs(w.volume - 60) < 1e-9);
});

test('sources split the water by share, and the streams add up where they meet', () => {
  const t = grid(16, 1, (x) => x);
  const src: Source[] = [{ x: 10, z: 8, share: 1 }, { x: 5, z: 8, share: 3 }];
  const w = flood(t, src, 100);
  assert.ok(Math.abs(w.stream[idx(t, 7, 8)]! - 0.25) < 1e-12, 'only the far source runs here');
  assert.ok(Math.abs(w.stream[idx(t, 4, 8)]! - 1) < 1e-12, 'both sources run here');
  assert.equal(w.stream[idx(t, 11, 8)], 0);
  assert.ok(Math.abs(w.drained - 100) < 1e-9);
  assert.equal(w.volume, 0);
});

test('wetness falls off one sixth per cell from a stream', () => {
  const t = grid(20, 1, (x) => x);
  const w = flood(t, [{ x: 10, z: 10, share: 1 }], 100);
  assert.equal(w.wet[idx(t, 10, 10)], 1);
  for (let k = 1; k <= WET_REACH; k++) {
    assert.ok(Math.abs(w.wet[idx(t, 10, 10 + k)]! - (1 - k / WET_REACH)) < 1e-12, `k ${k}`);
  }
  assert.equal(w.wet[idx(t, 10, 17)], 0);
  assert.equal(w.wet[idx(t, 17, 10)], 0, 'nothing runs uphill');
});

test('a lake keeps its water between sources', () => {
  const t = cone(11, 2);
  const one = flood(t, [{ x: 5, z: 5, share: 1 }], 8);
  const two = flood(t, [{ x: 5, z: 5, share: 1 }, { x: 3, z: 5, share: 1 }], 8);
  for (let i = 0; i < t.heights.length; i++) {
    assert.ok(Math.abs(one.depth[i]! - two.depth[i]!) < 1e-9, `cell ${i}: ${one.depth[i]} vs ${two.depth[i]}`);
  }
  assert.ok(Math.abs(two.volume - 8) < 1e-9);
  assert.equal(two.drained, 0);
});

test('the order of the sources does not lose or make water', () => {
  const t = grid(40, 10, (x, z) => 6 * Math.sin(x / 5) + 4 * Math.cos(z / 4) + 0.25 * x);
  const a: Source[] = [{ x: 8, z: 8, share: 2 }, { x: 30, z: 25, share: 1 }];
  const b: Source[] = [a[1]!, a[0]!];
  const wa = flood(t, a, 2e5);
  const wb = flood(t, b, 2e5);
  assert.ok(Math.abs(wa.volume + wa.drained - 2e5) < 1e-4);
  assert.ok(Math.abs(wb.volume + wb.drained - 2e5) < 1e-4);
  assert.ok(wa.volume > 0 && wb.volume > 0);
});

test('every source is poured, even several into the same pit', () => {
  const t = cone(21, 1);
  const src: Source[] = [
    { x: 10, z: 10, share: 1 },
    { x: 12, z: 10, share: 1 },
    { x: 10, z: 13, share: 2 },
  ];
  const w = flood(t, src, 300);
  assert.ok(Math.abs(w.volume + w.drained - 300) < 1e-6);
  assert.ok(w.depth[idx(t, 10, 10)]! > 0);
  let lo = Number.POSITIVE_INFINITY, hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < t.heights.length; i++) {
    if (w.depth[i]! > 0) { lo = Math.min(lo, w.level[i]!); hi = Math.max(hi, w.level[i]!); }
  }
  assert.ok(hi - lo < 1e-9, `one lake, one surface: ${lo} .. ${hi}`);
});

test('bad terrain, bad sources and bad volumes are all refused', () => {
  const t = cone(8, 1);
  assert.throws(() => flood({ ...t, size: 0 }, [], 1), /size/);
  assert.throws(() => flood({ ...t, heights: [...t.heights, 1] }, [], 1), /heights/);
  assert.throws(() => flood({ ...t, cell: 0 }, [], 1), /cell/);
  assert.throws(() => flood(t, [{ x: -1, z: 0, share: 1 }], 1), /outside/);
  assert.throws(() => flood(t, [{ x: 0, z: 8, share: 1 }], 1), /outside/);
  assert.throws(() => flood(t, [{ x: 1.5, z: 1, share: 1 }], 1), /outside/);
  assert.throws(() => flood(t, [{ x: 1, z: 1, share: -2 }], 1), /share/);
  assert.throws(() => flood(t, [{ x: 1, z: 1, share: Number.NaN }], 1), /share/);
  assert.throws(() => flood(t, [], Number.NaN), /volume/);
  assert.throws(() => flood(t, [], -0.5), /volume/);
  assert.doesNotThrow(() => flood(t, [], 0));
});

test('no sources means no water anywhere', () => {
  const t = cone(10, 1);
  const w = flood(t, [], 500);
  assert.equal(w.volume, 0);
  assert.equal(w.drained, 0);
  assert.ok(w.depth.every((d) => d === 0));
  assert.ok(w.wet.every((v) => v === 0));
});

test('a long run of pours settles to the same place as one big pour on a sealed bowl', () => {
  const { t, V } = bowl();
  const src: Source[] = [{ x: 20, z: 16, share: 1 }];
  const half = flood(t, [{ x: 20, z: 16, share: 1 }, { x: 12, z: 16, share: 1 }], V);
  const whole = flood(t, src, V);
  for (let i = 0; i < t.heights.length; i++) {
    assert.ok(Math.abs(half.depth[i]! - whole.depth[i]!) < 1e-6, `cell ${i}`);
  }
});
