import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCenterline, isSimple, chaikin, resample, loopLength, nearestOnLoop, carveTrack, trackWalls, checkpointGates, startGrid, type Vec2 } from '../src';
import { makeTerrain } from './helpers';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const square: Vec2[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

test('isSimple: square yes, bow-tie no', () => {
  assert.equal(isSimple(square), true);
  assert.equal(isSimple([[0, 0], [100, 100], [100, 0], [0, 100]]), false);
});

test('makeCenterline: deterministic, rounded, simple for many seeds, within the radius band', () => {
  const a = makeCenterline({ seed: 7, radius: 80 }), b = makeCenterline({ seed: 7, radius: 80 }), c = makeCenterline({ seed: 8, radius: 80 });
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.equal(a.length, 48);
  for (const p of a) for (const v of p) assert.ok(Math.abs(v * 100 - Math.round(v * 100)) < 1e-6);
  for (let seed = 0; seed < 25; seed++) {
    const pts = makeCenterline({ seed, radius: 80, points: 64, wobble: 0.5 });
    assert.equal(isSimple(pts), true, `seed ${seed}`);
    for (const [x, z] of pts) { const d = Math.hypot(x / 1.3, z); assert.ok(d > 80 * 0.5 && d < 80 * 1.7, `d ${d}`); }
  }
});

test('chaikin doubles the points and stays in the hull; resample gives even spacing', () => {
  const k = chaikin(square, 3);
  assert.equal(k.length, 32);
  for (const [x, z] of k) assert.ok(x >= 0 && x <= 100 && z >= 0 && z <= 100);
  assert.ok(loopLength(k) < 400 && loopLength(k) > 300);
  const circle: Vec2[] = Array.from({ length: 64 }, (_, i) => [50 * Math.cos((i / 64) * Math.PI * 2), 50 * Math.sin((i / 64) * Math.PI * 2)] as Vec2);
  const r = resample(circle, 10);
  assert.equal(r.length, Math.round(loopLength(circle) / 10)); assert.deepEqual(r[0], circle[0]);
  for (let i = 0; i < r.length; i++) { const a = r[i]!, b = r[(i + 1) % r.length]!; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); assert.ok(d > 8 && d < 12, `gap ${d}`); }
});

test('nearestOnLoop', () => {
  const n = nearestOnLoop(square, [50, -5]);
  assert.equal(n.index, 0); near(n.t, 0.5); near(n.distance, 5); near(n.s, 50); assert.deepEqual(n.point, [50, 0]);
  near(nearestOnLoop(square, [-5, 50]).s, 350);
});

test('carveTrack: flattens and slope-limits the road, paints road and shoulder, reports the dirty rect', () => {
  const t = makeTerrain(101, 101, 2, -100, -100, (x) => 0.6 * x, 1);
  const before = t.heights.slice(), beforeA = t.surfaceA.slice();
  const track = { points: resample([[-50, -50], [50, -50], [50, 50], [-50, 50]], 5), width: 10 };
  const res = carveTrack(t, track, { shoulder: 6, roadSurface: 7, shoulderSurface: 8 });
  assert.equal(res.roadHeights.length, track.points.length);
  assert.ok(res.maxSlope <= 0.25 + 1e-6, `maxSlope ${res.maxSlope}`);
  const at = (x: number, z: number): number => t.heights[((z + 100) / 2) * 101 + (x + 100) / 2]!;
  const idx = (x: number, z: number): number => ((z + 100) / 2) * 101 + (x + 100) / 2;
  const n = nearestOnLoop(track.points, [0, -50]);
  const a = res.roadHeights[n.index]!, b = res.roadHeights[(n.index + 1) % res.roadHeights.length]!;
  near(at(0, -50), a + (b - a) * n.t, 0.3);
  assert.equal(t.surfaceA[idx(0, -50)], 7); assert.equal(t.surfaceB[idx(0, -50)], 7); assert.equal(t.blend[idx(0, -50)], 0);
  assert.equal(t.surfaceA[idx(0, -44)], 8); assert.equal(t.surfaceB[idx(0, -44)], 1); assert.ok(t.blend[idx(0, -44)]! > 0 && t.blend[idx(0, -44)]! < 255);
  assert.equal(t.surfaceA[idx(0, 0)], 1); assert.equal(t.heights[idx(0, 0)], before[idx(0, 0)]);
  assert.ok(res.dirty);
  const cols = 101;
  for (let i = 0; i < t.heights.length; i++) {
    if (t.heights[i] !== before[i] || t.surfaceA[i] !== beforeA[i]) { const c = i % cols, r = Math.floor(i / cols); assert.ok(c >= res.dirty!.c0 && c <= res.dirty!.c1 && r >= res.dirty!.r0 && r <= res.dirty!.r1, `node ${c},${r} outside the dirty rect`); }
  }
  const far = makeTerrain(21, 21, 2, 1000, 1000, () => 0);
  assert.equal(carveTrack(far, { points: square, width: 10 }, { shoulder: 4, roadSurface: 7, shoulderSurface: 8 }).dirty, null);
});

test('trackWalls: left is +z on the first edge of the square, pieces sit at the offset', () => {
  const left = trackWalls({ points: square, width: 10 }, { offset: 7, spacing: 10, side: 'left' });
  assert.equal(left.length, Math.max(3, Math.round(left.reduce((s, p) => s + p.length, 0) / 10)));
  assert.ok(Math.abs(left.reduce((s, p) => s + p.length, 0) - 4 * 86) < 8, 'offset loop is about 4 * 86 m long');
  const first = left.find((p) => Math.abs(p.x - 50) < 6 && Math.abs(p.z - 7) < 0.5);
  assert.ok(first, 'a left piece near (50, 7)'); near(Math.hypot(first!.dx, first!.dz), 1, 1e-9);
  const right = trackWalls({ points: square, width: 10 }, { offset: 7, spacing: 10, side: 'right' });
  assert.ok(right.some((p) => Math.abs(p.x - 50) < 6 && Math.abs(p.z + 7) < 0.5));
  const both = trackWalls({ points: square, width: 10 }, { offset: 7, spacing: 10, side: 'both' });
  assert.equal(both.length, left.length + right.length);
});

test('checkpoint gates and start grid', () => {
  const g = checkpointGates({ points: square, width: 10 }, 8);
  assert.equal(g.length, 8);
  near(g[1]!.x, 50); near(g[1]!.z, 0); near(g[1]!.dx, 1); near(g[1]!.dz, 0);
  near(g[3]!.x, 100); near(g[3]!.z, 50); near(g[3]!.dx, 0); near(g[3]!.dz, 1);
  const grid = startGrid({ points: square, width: 10 }, 8);
  assert.equal(grid.length, 8);
  assert.equal(new Set(grid.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`)).size, 8);
  for (const s of grid) { near(Math.hypot(s.hx, s.hz), 1, 1e-9); near(s.hx, 0); near(s.hz, -1); assert.ok(Math.abs(s.x) <= 3.0001); }
  near(grid[0]!.x, 3); near(grid[0]!.z, 6); near(grid[1]!.x, -3); near(grid[1]!.z, 6); near(grid[2]!.z, 10); near(grid[6]!.z, 18);
});