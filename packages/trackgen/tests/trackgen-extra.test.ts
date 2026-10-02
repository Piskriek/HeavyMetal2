import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCenterline, isSimple, chaikin, carveTrack, trackWalls, checkpointGates, startGrid, loopLength, type Vec2 } from '../src';
import { makeTerrain } from './helpers';

const square: Vec2[] = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

test('flat carving preserves every height while changing road and shoulder surfaces', () => {
  const terrain = makeTerrain(61, 61, 1, -30, -30, () => 12);
  const before = terrain.heights.slice();
  const result = carveTrack(terrain, { points: square, width: 4 }, { shoulder: 3, roadSurface: 7, shoulderSurface: 8, smoothing: 0 });
  assert.deepEqual(terrain.heights, before);
  assert.ok(result.dirty);
  assert.ok(result.roadHeights.every((height) => height === 12));
  assert.ok(terrain.surfaceA.some((surface) => surface === 7));
  assert.ok(terrain.surfaceA.some((surface) => surface === 8));
});

test('repeated flat carving settles to a stable height and surface state', () => {
  const terrain = makeTerrain(61, 61, 1, -30, -30, () => 0);
  const track = { points: square, width: 4 };
  const options = { shoulder: 3, roadSurface: 7, shoulderSurface: 8, smoothing: 0 };
  carveTrack(terrain, track, options);
  carveTrack(terrain, track, options);
  const settledHeights = terrain.heights.slice();
  const settledA = terrain.surfaceA.slice();
  const settledB = terrain.surfaceB.slice();
  const settledBlend = terrain.blend.slice();
  carveTrack(terrain, track, options);
  assert.deepEqual(terrain.heights, settledHeights);
  assert.deepEqual(terrain.surfaceA, settledA);
  assert.deepEqual(terrain.surfaceB, settledB);
  assert.deepEqual(terrain.blend, settledBlend);
});

test('slope limiting enforces the closed-loop edge between the last and first samples', () => {
  const terrain = makeTerrain(41, 41, 1, -10, -10, (x, z) => 2 * x - z);
  const points: Vec2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const result = carveTrack(terrain, { points, width: 0 }, { shoulder: 0, roadSurface: 2, shoulderSurface: 3, smoothing: 0, maxSlope: 0.1 });
  const last = result.roadHeights.length - 1;
  const wrapDistance = Math.hypot(points[0]![0] - points[last]![0], points[0]![1] - points[last]![1]);
  assert.ok(Math.abs(result.roadHeights[0]! - result.roadHeights[last]!) / wrapDistance <= 0.1 + 1e-9);
  assert.ok(result.maxSlope <= 0.1 + 1e-9);
});

test('start grid supports one and twenty racers without duplicate slots', () => {
  const track = { points: square, width: 8 };
  assert.equal(startGrid(track, 1).length, 1);
  const grid = startGrid(track, 20);
  assert.equal(grid.length, 20);
  assert.equal(new Set(grid.map((slot) => `${slot.x.toFixed(4)}:${slot.z.toFixed(4)}`)).size, 20);
});

test('one checkpoint is placed at the start with the starting segment tangent', () => {
  const gates = checkpointGates({ points: square, width: 8 }, 1);
  assert.equal(gates.length, 1);
  assert.deepEqual(gates[0], { x: -10, z: -10, dx: 1, dz: 0 });
});

test('walls still contain three pieces when spacing exceeds the whole loop', () => {
  const walls = trackWalls({ points: square, width: 8 }, { offset: 2, spacing: loopLength(square) * 4, side: 'left' });
  assert.equal(walls.length, 3);
  assert.ok(walls.every((piece) => Number.isFinite(piece.x) && Number.isFinite(piece.length)));
});

test('Chaikin with zero iterations returns an unchanged copy', () => {
  const smooth = chaikin(square, 0);
  assert.deepEqual(smooth, square);
  assert.notEqual(smooth, square);
});

test('zero wobble creates a rounded ellipse with the requested squash', () => {
  const points = makeCenterline({ seed: 4, radius: 40, points: 16, wobble: 0, squash: 1.5 });
  assert.equal(isSimple(points), true);
  assert.deepEqual(points[0], [60, 0]);
  assert.deepEqual(points[4], [0, 40]);
  assert.deepEqual(points[8], [-60, 0]);
  for (const [x, z] of points) assert.ok(Math.abs(Math.hypot(x / 1.5, z) - 40) < 0.02);
});

test('a gate on a corner uses the segment that starts at that vertex', () => {
  const gates = checkpointGates({ points: square, width: 8 }, 4);
  assert.deepEqual(gates[1], { x: 10, z: -10, dx: 0, dz: 1 });
});

test('terrain outside the track bounds is left completely untouched', () => {
  const terrain = makeTerrain(12, 12, 1, 100, 100, (x, z) => x + z, 5);
  const heights = terrain.heights.slice();
  const surfaces = terrain.surfaceA.slice();
  const result = carveTrack(terrain, { points: square, width: 6 }, { shoulder: 5, roadSurface: 7, shoulderSurface: 8 });
  assert.equal(result.dirty, null);
  assert.deepEqual(terrain.heights, heights);
  assert.deepEqual(terrain.surfaceA, surfaces);
});

test('simple-loop validation rejects repeated adjacent vertices', () => {
  assert.equal(isSimple([[0, 0], [10, 0], [10, 0], [0, 10]]), false);
});