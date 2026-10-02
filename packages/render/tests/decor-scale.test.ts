import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recipeParts, RECIPE_IDS } from '@hm/scatter';
import { partScale } from '../src/decor';

test('a palm trunk is as tall as its crown is high: it reaches the ground and carries the crown', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const parts = recipeParts('palm', 1, seed);
    const trunk = parts[0]!;
    assert.equal(trunk.shape, 'cylinder');
    const [, height] = partScale(trunk, 1);
    assert.ok(height >= 4.5 && height <= 5.5, `trunk ${height} m tall`);
    const bottom = trunk.position[1] - height / 2, top = trunk.position[1] + height / 2;
    assert.ok(Math.abs(bottom) < 0.35, `trunk bottom at ${bottom}`);
    const crown = Math.max(...parts.slice(1).map((p) => p.position[1]));
    assert.ok(Math.abs(crown - top) < 0.6, `crown at ${crown}, trunk top at ${top}`);
  }
});

test('cylinder radius comes from size and height from scale.y; box and sphere stretch from size', () => {
  assert.deepEqual(partScale({ shape: 'cylinder', size: 0.12, scale: [1, 4.6, 1] }, 1), [0.12, 4.6, 0.12]);
  assert.deepEqual(partScale({ shape: 'cylinder', size: 0.12, scale: [1, 4.6, 1] }, 2), [0.24, 9.2, 0.24]);
  assert.deepEqual(partScale({ shape: 'box', size: 1, scale: [0.05, 0.6, 0.015] }, 1), [0.05, 0.6, 0.015]);
  assert.deepEqual(partScale({ shape: 'sphere', size: 0.5, scale: [1.5, 0.16, 0.55] }, 1), [0.75, 0.08, 0.275]);
});

test('every prop stands on the ground: no part hangs more than a crown above its base', () => {
  for (const id of RECIPE_IDS) {
    for (let seed = 1; seed <= 6; seed++) {
      const parts = recipeParts(id, 1, seed);
      assert.ok(parts.length > 0, id);
      let lowest = Infinity;
      for (const p of parts) {
        const [, sy] = partScale(p, 1);
        const half = p.shape === 'cylinder' ? sy / 2 : p.shape === 'box' ? sy / 2 : sy;
        lowest = Math.min(lowest, p.position[1] - half);
      }
      assert.ok(lowest < 0.45, `${id} (seed ${seed}) floats: lowest point ${lowest.toFixed(2)} m above the ground`);
    }
  }
});
