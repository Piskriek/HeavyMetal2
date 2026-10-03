import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchAt, scatter, type ScatterRule, type TerrainLike } from '../src';

function flat(size = 200, cell = 2): TerrainLike {
  const cols = Math.floor(size / cell) + 1;
  return { spec: { cols, rows: cols, cell, originX: -size / 2, originZ: -size / 2 }, heights: new Float32Array(cols * cols).fill(2), surfaceA: new Uint8Array(cols * cols).fill(4), surfaceB: new Uint8Array(cols * cols).fill(4), blend: new Uint8Array(cols * cols) };
}
const rule = (clump?: ScatterRule['clump']): ScatterRule => ({ id: 'bush', surfaces: [4], minHeight: 0, maxHeight: 10, maxSlopeDeg: 40, density: 12, minSpacing: 3, scale: [0.7, 1.4], ...(clump ? { clump } : {}) });

test('patches: about the asked share of the ground is inside a patch', () => {
  for (const cover of [0.25, 0.5]) {
    let inside = 0, n = 0;
    for (let x = -300; x < 300; x += 3) for (let z = -300; z < 300; z += 3) { n++; if (patchAt(rule({ size: 30, cover }), 7, 0, x, z) > 0.5) inside++; }
    const share = inside / n;
    assert.ok(Math.abs(share - cover) < 0.15, `cover ${cover} gave ${share.toFixed(2)}`);
  }
  assert.equal(patchAt(rule(), 7, 0, 10, 10), 1, 'no clump: thick everywhere');
});

test('a clumped rule grows in groves with clearings, and is still deterministic', () => {
  const t = flat();
  const even = scatter(t, [rule()], { seed: 3 });
  const clumped = scatter(t, [rule({ size: 35, cover: 0.35 })], { seed: 3 });
  assert.ok(clumped.length > 0 && clumped.length < even.length);
  // most plants stand inside a patch although patches cover about a third of the ground
  const inside = clumped.filter((p) => patchAt(rule({ size: 35, cover: 0.35 }), 3, 0, p.x, p.z) > 0.5).length / clumped.length;
  assert.ok(inside > 0.7, `inside ${inside.toFixed(2)}`);
  // and they come out bigger in the thick middle
  const mean = (ps: readonly { scale: number }[]): number => ps.reduce((a, p) => a + p.scale, 0) / Math.max(1, ps.length);
  const deep = clumped.filter((p) => patchAt(rule({ size: 35, cover: 0.35 }), 3, 0, p.x, p.z) > 0.9), thin = clumped.filter((p) => patchAt(rule({ size: 35, cover: 0.35 }), 3, 0, p.x, p.z) < 0.3);
  if (deep.length > 3 && thin.length > 3) assert.ok(mean(deep) > mean(thin));
  assert.deepEqual(scatter(t, [rule({ size: 35, cover: 0.35 })], { seed: 3 }), clumped);
});
