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
  assert.ok(performance.now() - t0 < 300, `${performance.now() - t0} ms`);
  assert.ok(s.time > 0);
});
