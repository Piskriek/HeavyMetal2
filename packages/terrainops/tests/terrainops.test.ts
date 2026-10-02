import test from 'node:test';
import assert from 'node:assert/strict';
import { rampBetween, stamp, levelPolygon, thermalErode, terrainStats, heightAt, type TerrainLike } from '../src/index.js';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const grid = (n: number, cell: number, fn: (x: number, z: number) => number, origin = 0): TerrainLike => {
  const heights = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) heights[r * n + c] = fn(origin + c * cell, origin + r * cell);
  return { spec: { cols: n, rows: n, cell, originX: origin, originZ: origin }, heights };
};
const at = (t: TerrainLike, x: number, z: number): number => t.heights[Math.round((z - t.spec.originZ) / t.spec.cell) * t.spec.cols + Math.round((x - t.spec.originX) / t.spec.cell)]!;

test('heightAt is bilinear and clamped', () => {
  const t = grid(5, 10, (x) => x);
  near(heightAt(t, 15, 20), 15); near(heightAt(t, -100, 0), 0); near(heightAt(t, 999, 0), 40);
});
test('rampBetween: linear slope along the road, rounded ends, shoulder blend, untouched elsewhere', () => {
  const t = grid(41, 2, () => 5);
  const before = t.heights.slice();
  const rect = rampBetween(t, [10, 40], [70, 40], { width: 8, shoulder: 6, heightA: 0, heightB: 12 });
  assert.ok(rect);
  near(at(t, 10, 40), 0, 1e-4); near(at(t, 40, 40), 6, 1e-4); near(at(t, 70, 40), 12, 1e-4); near(at(t, 40, 42), 6, 1e-4);
  const edge = at(t, 40, 40 + 4 + 3); assert.ok(edge > 5 && edge < 6, `shoulder ${edge}`);
  near(at(t, 40, 60), 5, 1e-9);
  for (let i = 0; i < t.heights.length; i++) if (t.heights[i] !== before[i]) { const c = i % 41, r = Math.floor(i / 41); assert.ok(c >= rect!.c0 && c <= rect!.c1 && r >= rect!.r0 && r <= rect!.r1); }
  const flat = grid(21, 2, (x) => x * 0.5); const e2 = rampBetween(flat, [20, 20], [20, 20], { width: 6, shoulder: 0, heightA: 3 });
  assert.ok(e2); near(at(flat, 20, 20), 3, 1e-4); near(at(flat, 21, 20) - 0, 3, 1e-4);
  const none = grid(21, 2, () => 0); assert.equal(rampBetween(none, [500, 500], [600, 500], { width: 4, shoulder: 2, heightA: 1, heightB: 1 }), null);
  const d = grid(41, 2, (x) => x * 0.1); rampBetween(d, [10, 40], [70, 40], { width: 4, shoulder: 0 }); near(at(d, 10, 40), 1, 1e-4); near(at(d, 70, 40), 7, 1e-4);
});
test('stamp: profiles, additive, deterministic, clipped at the grid', () => {
  const mk = () => grid(81, 2, () => 0);
  const m = mk(); const r = stamp(m, 'mound', [80, 80], 30, { height: 10, seed: 1, roughness: 0 });
  assert.ok(r); near(at(m, 80, 80), 10, 1e-4); near(at(m, 80 + 30, 80), 0, 1e-4); near(at(m, 80 + 60, 80), 0, 1e-9); assert.ok(at(m, 80 + 15, 80) > 0 && at(m, 80 + 15, 80) < 10);
  stamp(m, 'mound', [80, 80], 30, { height: 10, seed: 1, roughness: 0 }); near(at(m, 80, 80), 20, 1e-3);
  const c = mk(); stamp(c, 'crater', [80, 80], 30, { height: 10, seed: 2, roughness: 0 });
  near(at(c, 80, 80), -10, 1e-3); assert.ok(at(c, 80 + 24, 80) > 2, `rim ${at(c, 80 + 24, 80)}`); near(at(c, 80 + 30, 80), 0, 1e-3);
  const p = mk(); stamp(p, 'plateau', [80, 80], 30, { height: 8, seed: 3, roughness: 0 });
  near(at(p, 80, 80), 8, 1e-3); near(at(p, 80 + 10, 80), 8, 1e-3); assert.ok(at(p, 80 + 24, 80) < 8 && at(p, 80 + 24, 80) > 0);
  const v = mk(); stamp(v, 'volcano', [80, 80], 40, { height: 20, seed: 4, roughness: 0 });
  assert.ok(at(v, 80 + 10, 80) > at(v, 80, 80), 'a crater dip in the middle'); assert.ok(at(v, 80 + 10, 80) > at(v, 80 + 30, 80));
  const rg = mk(); stamp(rg, 'ridge', [80, 80], 20, { height: 6, seed: 5, roughness: 0, rotation: 0 });
  assert.ok(at(rg, 80 + 20, 80) > at(rg, 80, 80 + 14), 'crest runs along x'); assert.ok(at(rg, 80, 80 + 30) === 0);
  const d = mk(); stamp(d, 'dune', [80, 80], 30, { height: 5, seed: 6, roughness: 0, rotation: 0 });
  assert.ok(at(d, 80 + 8, 80) > at(d, 80 - 8, 80), 'the crest faces the rotation direction');
  const a = mk(), b = mk(); stamp(a, 'mound', [50, 50], 30, { height: 5, seed: 9 }); stamp(b, 'mound', [50, 50], 30, { height: 5, seed: 9 }); assert.deepEqual([...a.heights], [...b.heights]);
  const b2 = mk(); stamp(b2, 'mound', [50, 50], 30, { height: 5, seed: 10 }); assert.notDeepEqual([...a.heights], [...b2.heights]);
  assert.equal(stamp(mk(), 'mound', [900, 900], 10, { height: 5, seed: 1 }), null);
  const edge = mk(); assert.ok(stamp(edge, 'mound', [0, 0], 30, { height: 5, seed: 1, roughness: 0 })); near(at(edge, 0, 0), 5, 1e-4);
});
test('levelPolygon: inside is flat, falloff blends, concave polygons and degenerate input', () => {
  const t = grid(41, 2, (x, z) => x * 0.3 + z * 0.2);
  const rect = levelPolygon(t, [[20, 20], [60, 20], [60, 60], [20, 60]], 7, 8);
  assert.ok(rect); near(at(t, 40, 40), 7, 1e-4); near(at(t, 22, 58), 7, 1e-4);
  const outside = at(t, 64, 40), orig = 64 * 0.3 + 40 * 0.2; assert.ok(Math.abs(outside - 7) < Math.abs(orig - 7) && outside !== orig);
  near(at(t, 76, 40), 76 * 0.3 + 40 * 0.2, 1e-4);
  const l = grid(41, 2, () => 0); levelPolygon(l, [[10, 10], [70, 10], [70, 70], [40, 40], [10, 70]], 3, 0);
  near(at(l, 20, 20), 3, 1e-4); assert.equal(at(l, 40, 60), 0); near(at(l, 60, 30), 3, 1e-4);
  assert.equal(levelPolygon(grid(5, 2, () => 0), [[0, 0], [2, 2]], 1, 1), null);
});
test('thermalErode conserves height in the interior, lowers steep slopes, leaves the border alone, is deterministic', () => {
  const mk = () => grid(41, 2, (x, z) => (Math.hypot(x - 40, z - 40) < 12 ? 30 : 0));
  const t = mk(); const sum0 = t.heights.reduce((s, h) => s + h, 0);
  const rect = thermalErode(t, 40, 0.6);
  assert.ok(rect); const sum1 = t.heights.reduce((s, h) => s + h, 0); near(sum1, sum0, 0.5);
  assert.ok(terrainStats(t).steepest < terrainStats(mk()).steepest);
  for (let i = 0; i < 41; i++) { assert.equal(t.heights[i], 0); assert.equal(t.heights[40 * 41 + i], 0); assert.equal(t.heights[i * 41], 0); assert.equal(t.heights[i * 41 + 40], 0); }
  const u = mk(); thermalErode(u, 40, 0.6); assert.deepEqual([...u.heights], [...t.heights]);
  const flat = grid(21, 2, () => 4); assert.equal(thermalErode(flat, 10, 0.6), null);
});
test('terrainStats', () => {
  const t = grid(11, 2, (x) => x - 4);
  const s = terrainStats(t); near(s.min, -4); near(s.max, 16); near(s.mean, 6, 1e-6); near(s.steepest, 1, 1e-6); near(s.landFraction, 8 / 11 + 0, 0.2);
  const zero = grid(3, 1, () => 0); assert.equal(terrainStats(zero).landFraction, 0); assert.equal(terrainStats(zero).steepest, 0);
});
