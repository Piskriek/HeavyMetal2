import test from 'node:test';
import assert from 'node:assert/strict';
import { carve, centreline, heightAt, type Heightfield, type Vec2 } from '../src/index';
const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const field = (f: (c: number, r: number) => number): Heightfield => { const cols = 21, rows = 21, heights = new Float32Array(cols * rows); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[c + r * cols] = f(c, r); return { cols, rows, cell: 1, originX: 0, originZ: 0, heights }; };
const at = (h: Float32Array, c: number, r: number): number => h[c + r * 21]!;

test('bilinear heights, clamped at the edges', () => {
  const h: Heightfield = { cols: 3, rows: 3, cell: 1, originX: 0, originZ: 0, heights: new Float32Array([0, 1, 2, 1, 2, 3, 2, 3, 4]) };
  near(heightAt(h, 0.5, 0.5), 1); near(heightAt(h, 1.5, 0.25), 1.75); near(heightAt(h, -5, 0), 0); near(heightAt(h, 10, 10), 4);
});
test('a road across a ramp: level in the middle, blended over its shoulders', () => {
  const ramp = field((c) => c);
  const out = carve(ramp, { points: [[10, 0], [10, 20]], width: 4, shoulder: 2, depth: 0, kind: 'road', smooth: false });
  near(at(out.heights, 8, 10), 10); near(at(out.heights, 12, 10), 10); near(at(out.heights, 7, 10), 8.5); near(at(out.heights, 13, 10), 11.5);
  near(at(out.heights, 6, 10), 6); near(at(out.heights, 14, 10), 14);
  assert.equal(out.changed, 126); assert.deepEqual(out.rect, { c0: 7, r0: 0, c1: 13, r1: 20 });
  near(at(ramp.heights, 8, 10), 8);
});
test('a river cuts a channel and never runs uphill', () => {
  const flat = carve(field(() => 5), { points: [[0, 10], [20, 10]], width: 2, shoulder: 2, depth: 1, kind: 'river', smooth: false });
  near(at(flat.heights, 5, 10), 4); near(at(flat.heights, 5, 8), 4.5); near(at(flat.heights, 5, 7), 5);
  const ramp = field((c) => c);
  near(at(carve(ramp, { points: [[0, 10], [20, 10]], width: 2, shoulder: 1, depth: 1, kind: 'river', smooth: false }).heights, 15, 10), -1);
  near(at(carve(ramp, { points: [[20, 10], [0, 10]], width: 2, shoulder: 1, depth: 1, kind: 'river', smooth: false }).heights, 15, 10), 14);
});
test('a road smooths a bump away instead of following it', () => {
  const out = carve(field((c, r) => (c === 10 && r === 10 ? 10 : 0)), { points: [[0, 10], [20, 10]], width: 2, shoulder: 1, depth: 0, kind: 'road', smooth: false });
  const v = at(out.heights, 10, 10);
  assert.ok(v > 0.5 && v < 9, String(v));
});
test('a smooth centre line goes through its ends in small steps and rounds the corner', () => {
  const line = centreline([[0, 0], [10, 0], [10, 10]], true, 0.5);
  assert.deepEqual(line[0], [0, 0]); near(line[line.length - 1]![0], 10); near(line[line.length - 1]![1], 10);
  for (let i = 1; i < line.length; i++) assert.ok(Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]) <= 0.5 + 1e-9, String(i));
  const off = (p: Vec2): number => Math.min(Math.abs(p[1]) + Math.max(0, p[0] - 10) + Math.max(0, -p[0]), Math.abs(p[0] - 10) + Math.max(0, p[1] - 10) + Math.max(0, -p[1]));
  assert.ok(Math.max(...line.map(off)) > 0.1);
  const straight = centreline([[0, 0], [3, 0]], false, 1);
  assert.deepEqual(straight, [[0, 0], [1, 0], [2, 0], [3, 0]]);
});

test('straight centre lines retain every supplied vertex', () => {
  const line = centreline([[0, 0], [0, 2], [2, 2]], false, 0.75);

  assert.ok(line.some((point) => point[0] === 0 && point[1] === 2));
  assert.deepEqual(line[line.length - 1], [2, 2]);
});