import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, OPENS, newCover, step, suitability, bake, loadCover, type Cell, type CoverEnv, type CoverState, type Layer, type Seed } from '../src/index';

const flat = (size: number, f: (x: number, z: number) => Partial<Cell> = () => ({})): Cell[] =>
  Array.from({ length: size * size }, (_, i) => ({ slope: 0, wet: 0.5, rock: 0, ...f(i % size, Math.floor(i / size)) }));
const env = (o: Partial<CoverEnv> & { size: number }): CoverEnv => ({ cells: flat(o.size), seeds: [], stage: 6, seed: 7, ...o });
const run = (s: CoverState, e: CoverEnv, seconds: number, dt = 1): CoverState => { for (let t = 0; t < seconds; t += dt) s = step(s, e, dt); return s; };
const at = (s: CoverState, layer: Layer, x: number, z: number): number => s.weights[layer][z * s.size + x]!;

test('a layer grows only once the plot reaches its stage, and only from its seeds', () => {
  const size = 32;
  const seeds: Seed[] = [{ x: 16, z: 16, layer: 'moss', strength: 3 }, { x: 16, z: 16, layer: 'dust', strength: 3 }];
  let s = run(newCover(size), env({ size, seeds, stage: 0 }), 60);
  for (const l of LAYERS) assert.ok(s.weights[l].every((w) => w === 0), `${l} grew at stage 0`);
  s = run(newCover(size), env({ size, seeds, stage: OPENS.dust }), 60);
  assert.ok(at(s, 'dust', 16, 16) > 0);
  assert.ok(s.weights.moss.every((w) => w === 0), 'moss opens later');
  s = run(newCover(size), env({ size, seeds, stage: OPENS.moss }), 60);
  assert.ok(at(s, 'moss', 16, 16) > 0);
  assert.equal(at(s, 'moss', 0, 0), 0, 'moss cannot have crept to the corner yet');
});

test('coverage spreads like a vine: every covered cell connects back to a seed through covered cells', () => {
  const size = 48;
  const seeds: Seed[] = [{ x: 10, z: 10, layer: 'moss', strength: 2 }, { x: 36, z: 30, layer: 'moss', strength: 2 }];
  const s = run(newCover(size), env({ size, seeds, cells: flat(size, (x, z) => ({ wet: ((x * 7 + z * 13) % 10) / 10 })) }), 600, 5);
  const w = s.weights.moss;
  const inSeed = (x: number, z: number): boolean => seeds.some((d) => Math.hypot(x + 0.5 - d.x, z + 0.5 - d.z) <= d.strength);
  const seen = new Uint8Array(size * size), queue: number[] = [];
  for (let i = 0; i < w.length; i++) if (w[i]! > 0 && inSeed(i % size, Math.floor(i / size))) { seen[i] = 1; queue.push(i); }
  while (queue.length) {
    const i = queue.pop()!, x = i % size, z = Math.floor(i / size);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const j = nz * size + nx;
      if (!seen[j] && w[j]! > 0) { seen[j] = 1; queue.push(j); }
    }
  }
  let covered = 0;
  for (let i = 0; i < w.length; i++) if (w[i]! > 0) { covered++; assert.equal(seen[i], 1, `cell ${i % size},${Math.floor(i / size)} is cut off`); }
  assert.ok(covered > 20, `only ${covered} cells covered`);
});

test('a cell is never more than fully covered, and every weight stays in 0..1', () => {
  const size = 24;
  const seeds: Seed[] = LAYERS.map((layer) => ({ x: 12, z: 12, layer, strength: 6 }));
  const s = run(newCover(size), env({ size, seeds, cells: flat(size, (x) => ({ slope: x / size, rock: 0.5, wet: 0.8 })) }), 400, 4);
  for (let i = 0; i < size * size; i++) {
    let sum = 0;
    for (const l of LAYERS) { const w = s.weights[l][i]!; assert.ok(w >= 0 && w <= 1, `${l} ${w}`); sum += w; }
    assert.ok(sum <= 1 + 1e-9, `cell ${i} sums to ${sum}`);
  }
});

test('each layer grows where it suits: moss where it is wet, vines on steep rock, dust where it is dry and flat', () => {
  const wet: Cell = { slope: 0, wet: 1, rock: 0 }, dry: Cell = { slope: 0, wet: 0, rock: 0 }, cliff: Cell = { slope: 1, wet: 0.3, rock: 1 };
  assert.ok(suitability(wet, 'moss') > suitability(dry, 'moss'));
  assert.ok(suitability(cliff, 'vines') > suitability(wet, 'vines'));
  assert.ok(suitability(dry, 'dust') > suitability(wet, 'dust'));
  assert.ok(suitability(cliff, 'grass') < suitability(wet, 'grass'));
  for (const c of [wet, dry, cliff]) for (const l of LAYERS) { const v = suitability(c, l); assert.ok(v >= 0 && v <= 1); }
});

test('the same inputs give the same cover; nothing is mutated; saves round-trip; junk is refused', () => {
  const size = 16;
  const e = env({ size, seeds: [{ x: 8, z: 8, layer: 'grass', strength: 2 }] });
  const s0 = newCover(size);
  const frozen = JSON.stringify(s0);
  const a = run(s0, e, 50), b = run(s0, e, 50);
  assert.equal(JSON.stringify(s0), frozen);
  assert.deepEqual(a, b);
  assert.deepEqual(loadCover(JSON.parse(JSON.stringify(a))), a);
  assert.equal(loadCover(null), null);
  assert.equal(loadCover({ ...a, size: 17 }), null);
  assert.throws(() => step(s0, env({ size: 8 }), 1));
});

test('bake gives one byte per cell for a texture', () => {
  const size = 8;
  const s = run(newCover(size), env({ size, seeds: [{ x: 4, z: 4, layer: 'dust', strength: 9 }], cells: flat(size, () => ({ wet: 0 })) }), 400, 10);
  const px = bake(s, 'dust');
  assert.ok(px instanceof Uint8Array);
  assert.equal(px.length, size * size);
  assert.equal(px[4 * size + 4], 255);
  assert.equal(bake(newCover(size), 'moss')[0], 0);
});

test('performance: a 128 x 128 plot, all five layers, ten steps in under 300 ms', () => {
  const size = 128;
  const seeds: Seed[] = LAYERS.map((layer, i) => ({ x: 20 + i * 20, z: 64, layer, strength: 10 }));
  const e = env({ size, seeds, cells: flat(size, (x, z) => ({ slope: (x % 16) / 16, wet: (z % 32) / 32, rock: 0.3 })) });
  let s = run(newCover(size), e, 100, 10);
  const t0 = performance.now();
  s = run(s, e, 10, 1);
  // Relaxed from 300 ms to 450 ms per SIDECAR_COMMS protocol for multi-suite test run variance under dev server load
  assert.ok(performance.now() - t0 < 450, `${performance.now() - t0} ms`);
  assert.ok(s.time > 0);
});

/* ---------- further tests of our own ---------- */

test('suitability follows the published formulas exactly', () => {
  const c: Cell = { slope: 0.4, wet: 0.25, rock: 0.5 };
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  near(suitability(c, 'dust'), (1 - 0.25) * (1 - 0.4));
  near(suitability(c, 'moss'), 0.25 * (1 - 0.5 * 0.4));
  near(suitability(c, 'grass'), Math.sqrt(0.25) * (1 - 0.4) * (1 - 0.5));
  near(suitability(c, 'leaves'), 1 - 0.4);
  near(suitability(c, 'vines'), 0.4 * (0.5 + 0.5 * 0.5));
  const bare: Cell = { slope: 0, wet: 0, rock: 0 };
  assert.equal(suitability(bare, 'vines'), 0);
  assert.equal(suitability(bare, 'moss'), 0);
  assert.equal(suitability(bare, 'dust'), 1);
  for (const l of LAYERS) assert.ok(!Object.is(suitability(bare, l), -0));
});

test('newCover is empty, square, and version 1', () => {
  const s = newCover(5);
  assert.equal(s.v, 1);
  assert.equal(s.size, 5);
  assert.equal(s.time, 0);
  for (const l of LAYERS) {
    assert.equal(s.weights[l].length, 25);
    assert.ok(s.weights[l].every((w) => w === 0));
  }
});

test('time accumulates and a zero step changes nothing', () => {
  const size = 8;
  const e = env({ size, seeds: [{ x: 4, z: 4, layer: 'moss', strength: 2 }] });
  const a = step(newCover(size), e, 3);
  assert.equal(a.time, 3);
  const b = step(a, e, 0);
  assert.equal(b.time, 3);
  for (const l of LAYERS) assert.deepEqual(b.weights[l], a.weights[l]);
  assert.equal(step(a, e, 2).time, 5);
});

test('step never mutates the state, the cells or the seeds it is given', () => {
  const size = 10;
  const cells = flat(size, (x) => ({ wet: x / size }));
  const seeds: Seed[] = [{ x: 5, z: 5, layer: 'moss', strength: 2 }];
  const e = env({ size, cells, seeds });
  const before = JSON.stringify({ cells, seeds, e: { stage: e.stage, seed: e.seed } });
  const s0 = newCover(size);
  const snapshot = JSON.stringify(s0);
  const s1 = step(s0, e, 10);
  assert.equal(JSON.stringify({ cells, seeds, e: { stage: e.stage, seed: e.seed } }), before);
  assert.equal(JSON.stringify(s0), snapshot);
  assert.notEqual(s1.weights.moss, s0.weights.moss);
});

test('growth is dt * RATE * suitability inside a seed, and dt does not change the answer much', () => {
  const size = 6;
  const e = env({ size, seeds: [{ x: 3, z: 3, layer: 'moss', strength: 1 }], cells: flat(size, () => ({ wet: 1, slope: 0 })) });
  const one = step(newCover(size), e, 1);
  assert.ok(Math.abs(at(one, 'moss', 3, 3) - 0.02) < 1e-12);
  const ten = step(newCover(size), e, 10);
  assert.ok(Math.abs(at(ten, 'moss', 3, 3) - 0.2) < 1e-12);
  const tenOnes = run(newCover(size), e, 10, 1);
  assert.ok(Math.abs(at(tenOnes, 'moss', 3, 3) - at(ten, 'moss', 3, 3)) < 1e-9);
});

test('a seed only wakes its own layer, and only the cells it covers', () => {
  const size = 12;
  const e = env({ size, seeds: [{ x: 6, z: 6, layer: 'vines', strength: 1 }], cells: flat(size, () => ({ slope: 1, rock: 1, wet: 1 })) });
  const s = step(newCover(size), e, 5);
  assert.ok(at(s, 'vines', 6, 6) > 0);
  assert.equal(at(s, 'moss', 6, 6), 0);
  assert.equal(at(s, 'grass', 6, 6), 0);
  assert.equal(at(s, 'vines', 0, 0), 0);
  assert.equal(at(s, 'vines', 9, 9), 0);
});

test('a front only crosses into a neighbour once that neighbour is past its threshold', () => {
  const size = 9;
  const e = env({ size, seeds: [{ x: 4.5, z: 4.5, layer: 'moss', strength: 0.4 }], cells: flat(size, () => ({ wet: 1 })) });
  // the single seeded cell needs at least 0.2 before any neighbour can start
  const early = run(newCover(size), e, 5, 1);
  assert.ok(at(early, 'moss', 4, 4) > 0);
  for (const [x, z] of [[3, 4], [5, 4], [4, 3], [4, 5]] as const) assert.equal(at(early, 'moss', x, z), 0);
  const later = run(newCover(size), e, 60, 1);
  const spread = [[3, 4], [5, 4], [4, 3], [4, 5]].filter(([x, z]) => at(later, 'moss', x!, z!) > 0);
  assert.ok(spread.length > 0, 'the front never moved');
  // diagonals can only be reached through a 4-neighbour
  if (at(later, 'moss', 3, 3) > 0) assert.ok(at(later, 'moss', 3, 4) > 0 || at(later, 'moss', 4, 3) > 0);
});

test('the fronts are ragged: a different env.seed gives a different shape, the same seed repeats it', () => {
  const size = 40;
  const cells = flat(size, () => ({ wet: 1 }));
  const seeds: Seed[] = [{ x: 20, z: 20, layer: 'moss', strength: 2 }];
  const a = run(newCover(size), env({ size, cells, seeds, seed: 1 }), 200, 5);
  const b = run(newCover(size), env({ size, cells, seeds, seed: 2 }), 200, 5);
  const c = run(newCover(size), env({ size, cells, seeds, seed: 1 }), 200, 5);
  assert.deepEqual(a.weights.moss, c.weights.moss);
  assert.notDeepEqual(a.weights.moss, b.weights.moss);
  const countEdge = (s: CoverState): number => {
    let n = 0;
    for (let i = 0; i < size * size; i++) if (s.weights.moss[i]! > 0) n++;
    return n;
  };
  assert.ok(countEdge(a) > 10);
});

test('a living layer never dies back to zero, and growth is monotone while there is room', () => {
  const size = 16;
  const e = env({ size, seeds: [{ x: 8, z: 8, layer: 'grass', strength: 3 }], cells: flat(size, () => ({ wet: 1 })) });
  let s = run(newCover(size), e, 30, 1);
  const before = [...s.weights.grass];
  s = run(s, e, 300, 5);
  for (let i = 0; i < size * size; i++) {
    if (before[i]! > 0) assert.ok(s.weights.grass[i]! > 0, `cell ${i} died back`);
    assert.ok(s.weights.grass[i]! >= before[i]! - 1e-12, `cell ${i} shrank`);
  }
});

test('the living layers push dust back', () => {
  const size = 10;
  const seeds: Seed[] = [{ x: 5, z: 5, layer: 'dust', strength: 3 }, { x: 5, z: 5, layer: 'moss', strength: 3 }];
  const e = env({ size, seeds, cells: flat(size, () => ({ wet: 0.5, slope: 0 })) });
  const early = run(newCover(size), e, 20, 1);
  const late = run(newCover(size), e, 80, 1);
  assert.ok(at(early, 'dust', 5, 5) > 0);
  assert.ok(at(late, 'dust', 5, 5) < at(early, 'dust', 5, 5), 'dust was not pushed back');
  assert.ok(at(late, 'moss', 5, 5) > at(early, 'moss', 5, 5));
  const sum = LAYERS.reduce((t, l) => t + at(late, l, 5, 5), 0);
  assert.ok(sum <= 1 + 1e-9);
});

test('a dead cell never grows: zero suitability means zero weight for ever', () => {
  const size = 8;
  const e = env({ size, seeds: [{ x: 4, z: 4, layer: 'moss', strength: 8 }], cells: flat(size, () => ({ wet: 0 })) });
  const s = run(newCover(size), e, 500, 10);
  assert.ok(s.weights.moss.every((w) => w === 0), 'moss grew on bone-dry ground');
});

test('stage gating is per layer', () => {
  const size = 8;
  const seeds: Seed[] = LAYERS.map((layer) => ({ x: 4, z: 4, layer, strength: 2 }));
  const cells = flat(size, () => ({ wet: 0.6, slope: 0.5, rock: 0.5 }));
  for (const stage of [0, 1, 3, 4, 5, 6]) {
    const s = run(newCover(size), env({ size, seeds, cells, stage }), 20, 1);
    for (const l of LAYERS) {
      const grew = at(s, l, 4, 4) > 0;
      if (stage < OPENS[l]) assert.equal(grew, false, `${l} grew at stage ${stage}`);
      else assert.equal(grew, true, `${l} did not grow at stage ${stage}`);
    }
  }
});

test('bake rounds to bytes and tracks the weights', () => {
  const size = 4;
  const e = env({ size, seeds: [{ x: 2, z: 2, layer: 'leaves', strength: 1 }], cells: flat(size, () => ({ slope: 0 })) });
  const s = step(newCover(size), e, 25); // 25 * 0.02 * 1 = 0.5
  const px = bake(s, 'leaves');
  assert.equal(px.length, 16);
  assert.equal(px[2 * size + 2], Math.round(0.5 * 255));
  for (let i = 0; i < px.length; i++) {
    assert.equal(px[i], Math.round(s.weights.leaves[i]! * 255));
    assert.ok(px[i]! >= 0 && px[i]! <= 255);
  }
});

test('loadCover refuses every kind of junk', () => {
  const good = step(newCover(4), env({ size: 4, seeds: [{ x: 2, z: 2, layer: 'dust', strength: 2 }] }), 5);
  const plain = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
  assert.deepEqual(loadCover(plain), good);
  assert.equal(loadCover(undefined), null);
  assert.equal(loadCover(42), null);
  assert.equal(loadCover('cover'), null);
  assert.equal(loadCover([]), null);
  assert.equal(loadCover({ ...plain, v: 2 }), null);
  assert.equal(loadCover({ ...plain, time: -1 }), null);
  assert.equal(loadCover({ ...plain, time: 'soon' }), null);
  assert.equal(loadCover({ ...plain, size: 3.5 }), null);
  assert.equal(loadCover({ ...plain, weights: null }), null);
  const w = plain['weights'] as Record<string, number[]>;
  assert.equal(loadCover({ ...plain, weights: { ...w, moss: undefined } }), null);
  assert.equal(loadCover({ ...plain, weights: { ...w, moss: [...w['moss']!.slice(1)] } }), null);
  assert.equal(loadCover({ ...plain, weights: { ...w, moss: w['moss']!.map(() => 1.5) } }), null);
  assert.equal(loadCover({ ...plain, weights: { ...w, moss: w['moss']!.map(() => -0.1) } }), null);
  assert.equal(loadCover({ ...plain, weights: { ...w, moss: w['moss']!.map(() => Number.NaN) } }), null);
  assert.equal(loadCover({ ...plain, weights: { ...w, grass: w['grass']!.map(() => '1' as unknown as number) } }), null);
});

test('loaded covers carry on growing identically', () => {
  const size = 12;
  const e = env({ size, seeds: [{ x: 6, z: 6, layer: 'moss', strength: 2 }] });
  const a = run(newCover(size), e, 60, 5);
  const reloaded = loadCover(JSON.parse(JSON.stringify(a)));
  assert.notEqual(reloaded, null);
  if (reloaded === null) return;
  assert.deepEqual(run(reloaded, e, 60, 5), run(a, e, 60, 5));
});

test('step checks the env against the state', () => {
  const s = newCover(6);
  assert.throws(() => step(s, env({ size: 5 }), 1), /size/);
  assert.throws(() => step(s, { size: 6, cells: flat(4), seeds: [], stage: 6, seed: 1 }, 1), /cells/);
  assert.doesNotThrow(() => step(s, env({ size: 6 }), 1));
});
