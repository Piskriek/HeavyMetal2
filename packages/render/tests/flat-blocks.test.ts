import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeFlatBlocks, blockGridFor, gatherSurfaces, type TerrainLike } from '../src';

const terrain = (cols: number, rows: number, paint: (c: number, r: number) => [number, number, number]): TerrainLike => {
  const n = cols * rows;
  const t = { spec: { cols, rows, cell: 2, originX: -(cols - 1), originZ: -(rows - 1) }, heights: new Float32Array(n), surfaceA: new Uint8Array(n), surfaceB: new Uint8Array(n), blend: new Uint8Array(n) };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const [a, b, w] = paint(c, r); const i = r * cols + c; t.surfaceA[i] = a; t.surfaceB[i] = b; t.blend[i] = w; }
  return t;
};
const bake = (t: TerrainLike): Uint8Array => { const g = blockGridFor(t.spec); const out = new Uint8Array(g.w * g.h * 4); bakeFlatBlocks(t, g, out, null); return out; };

test('the block grid covers the terrain in half-metre blocks', () => {
  const g = blockGridFor({ cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 });
  assert.deepEqual(g, { x0: -256, z0: -256, w: 513, h: 513 });
});

test('one surface everywhere bakes to that surface alone', () => {
  const out = bake(terrain(9, 9, () => [4, 4, 0]));
  for (let i = 0; i < out.length; i += 4) assert.deepEqual([out[i], out[i + 1], out[i + 2]], [4, 4, 0]);
});

test('a node blended between two surfaces gives both, with the second one\'s share', () => {
  const t = terrain(5, 5, () => [2, 5, 64]);
  const g = new Float64Array(3);
  gatherSurfaces(t, 2, 2, g);
  assert.deepEqual([g[0], g[1]], [2, 5]);
  assert.ok(Math.abs(g[2]! - 64 / 255) < 1e-9);
});

test('two halves: the far sides are pure, the border in between mixes', () => {
  const t = terrain(17, 9, (c) => (c < 8 ? [3, 3, 0] : [7, 7, 0]));
  const grid = blockGridFor(t.spec);
  const out = bake(t);
  const at = (u: number, v: number): number[] => { const o = (v * grid.w + u) * 4; return [out[o]!, out[o + 1]!, out[o + 2]!]; };
  assert.deepEqual(at(0, 8), [3, 3, 0]);
  assert.deepEqual(at(grid.w - 1, 8), [7, 7, 0]);
  const mid = Array.from({ length: grid.w }, (_, u) => at(u, 8));
  assert.ok(mid.some((m) => m[1] !== m[0] && m[2]! > 0), 'some blocks near the border mix the two');
});

test('a brush stroke re-bakes only its area, and the result equals a full bake', () => {
  const t = terrain(33, 33, (c, r) => [(c + r) % 3 === 0 ? 1 : 2, 6, (c * 7 + r * 3) % 200]);
  const grid = blockGridFor(t.spec);
  const out = bake(t);
  // paint a patch
  for (let r = 10; r <= 13; r++) for (let c = 20; c <= 22; c++) { const i = r * 33 + c; t.surfaceA[i] = 9; t.surfaceB[i] = 9; t.blend[i] = 0; }
  const rows = bakeFlatBlocks(t, grid, out, { c0: 20, r0: 10, c1: 22, r1: 13 });
  assert.deepEqual(Buffer.from(out), Buffer.from(bake(t)));
  assert.ok(rows.v0 > 0 && rows.v1 < grid.h - 1, 'only the rows near the stroke are touched');
});
