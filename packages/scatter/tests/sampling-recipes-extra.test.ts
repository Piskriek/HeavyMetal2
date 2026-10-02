import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPE_IDS, distanceToLoop, dominantSurface, heightAt, poissonDisc, recipeParts, slopeDeg, type TerrainLike } from '../src';
import { near, seq } from './helpers';

test('poissonDisc: degenerate input and tiny boxes', () => {
  assert.deepEqual(poissonDisc(seq(1), 50, 50, 0), []);
  assert.deepEqual(poissonDisc(seq(1), 50, 50, -3), []);
  assert.deepEqual(poissonDisc(seq(1), -1, 50, 5), []);
  assert.deepEqual(poissonDisc(seq(1), 50, 50, NaN), []);
  assert.equal(poissonDisc(seq(1), 3, 3, 10).length, 1); // nothing else fits inside a 3 x 3 box
  assert.deepEqual(poissonDisc(seq(1), 0, 0, 5), [[0, 0]]);
  const pts = poissonDisc(seq(5), 100, 100, 10, 1); // k = 1 is legal and still respects the spacing
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]) >= 10 - 1e-9);
});

test('sampling: bilinear and clamped heights, slope of a 45 degree ramp, blend threshold, odd loops', () => {
  const n = 4;
  const t: TerrainLike = {
    spec: { cols: n, rows: n, cell: 1, originX: 0, originZ: 0 },
    heights: Float32Array.from({ length: n * n }, (_, i) => i % n), // height = column index
    surfaceA: new Uint8Array(n * n).fill(4),
    surfaceB: new Uint8Array(n * n).fill(9),
    blend: new Uint8Array(n * n).fill(127),
  };
  near(heightAt(t, 1.5, 2), 1.5); near(heightAt(t, -9, 0), 0); near(heightAt(t, 99, 99), 3);
  near(slopeDeg(t, 1.5, 1.5), 45); near(slopeDeg(t, 1.5, 2.2), 45); // a ramp is 45 degrees everywhere inside
  assert.equal(dominantSurface(t, 1, 1), 4); // blend 127 -> A
  t.blend[5] = 128; // node (1, 1)
  assert.equal(dominantSurface(t, 1.2, 0.9), 9); // blend 128 -> B
  assert.equal(dominantSurface(t, 1.6, 1), 4); // nearest node is (2, 1), still A
  assert.equal(dominantSurface(t, -50, -50), 4); // clamped to the corner node
  assert.equal(distanceToLoop([], [1, 1]), Infinity);
  near(distanceToLoop([[3, 4]], [0, 0]), 5);
  near(distanceToLoop([[0, 0], [10, 0]], [5, 2]), 2);
});

test('recipes: part counts, shapes and rotations follow the brief for many seeds', () => {
  for (let seed = 0; seed < 40; seed++) {
    const count = (id: string, shape: string): number => recipeParts(id, 1, seed).filter((p) => p.shape === shape).length;
    const total = (id: string): number => recipeParts(id, 1, seed).length;
    assert.equal(count('palm', 'cylinder'), 1);
    assert.ok(total('palm') >= 8 && total('palm') <= 11);
    assert.ok(count('bush', 'sphere') >= 3 && count('bush', 'sphere') <= 4 && total('bush') === count('bush', 'sphere'));
    assert.ok(count('tuft', 'box') >= 5 && count('tuft', 'box') <= 7 && total('tuft') === count('tuft', 'box'));
    assert.ok(total('boulder') >= 1 && total('boulder') <= 3 && recipeParts('boulder', 1, seed).every((p) => p.shape === 'sphere' && p.roughness === 0.9));
    assert.deepEqual([count('tiki', 'cylinder'), count('tiki', 'box'), count('tiki', 'sphere')], [1, 1, 2]);
    assert.ok(count('reeds', 'cylinder') >= 6 && count('reeds', 'cylinder') <= 9 && total('reeds') === count('reeds', 'cylinder'));
    const trunk = recipeParts('log', 1, seed)[0]!;
    assert.equal(recipeParts('log', 1, seed).length, 3);
    near(trunk.rotation[0], 0); near(trunk.rotation[1], 0); near(trunk.rotation[2], Math.SQRT1_2); near(trunk.rotation[3], Math.SQRT1_2);
    for (const id of RECIPE_IDS) {
      for (const p of recipeParts(id, 1, seed)) {
        near(Math.hypot(...p.rotation), 1, 1e-12);
        assert.ok(p.scale.every((v) => v > 0) && /^#[0-9a-f]{6}$/.test(p.color));
        assert.ok(p.position[1] >= -0.01 && p.position[1] <= 6 && Math.hypot(p.position[0], p.position[2]) <= 3, `${id} seed ${seed}`);
      }
    }
  }
});

test('recipes: scales that are not finite and positive give no parts; geometry scales linearly', () => {
  for (const id of RECIPE_IDS) {
    for (const s of [0, -1, NaN, Infinity]) assert.deepEqual(recipeParts(id, s, 1), [], `${id} @ ${s}`);
    const one = recipeParts(id, 1, 5);
    const two = recipeParts(id, 2, 5);
    assert.equal(two.length, one.length);
    one.forEach((p, i) => {
      const q = two[i]!;
      for (let k = 0; k < 3; k++) { near(q.position[k]!, 2 * p.position[k]!); near(q.scale[k]!, 2 * p.scale[k]!); }
      assert.deepEqual([q.shape, q.size, q.color, q.rotation], [p.shape, p.size, p.color, p.rotation]);
    });
  }
  assert.deepEqual(recipeParts('constructor', 1, 1), []); // ids are looked up safely
});
