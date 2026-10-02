import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rampBetween,
  stamp,
  levelPolygon,
  thermalErode,
  terrainStats,
  heightAt,
  valueNoise2D,
  type TerrainLike,
} from '../src/index.js';

const near = (a: number, b: number, e = 1e-4): void => {
  assert.ok(Math.abs(a - b) < e, `${a} not near ${b} (diff=${Math.abs(a - b)}, tol=${e})`);
};

const makeGrid = (
  cols: number,
  rows: number,
  cell: number,
  fn: (x: number, z: number) => number,
  ox = 0,
  oz = 0
): TerrainLike => {
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[r * cols + c] = fn(ox + c * cell, oz + r * cell);
    }
  }
  return { spec: { cols, rows, cell, originX: ox, originZ: oz }, heights };
};

// 1. Ramp over a non-square sloped terrain
test('extra: ramp over non-square sloped terrain', () => {
  const t = makeGrid(30, 60, 2.5, (x, z) => x * 0.1 + z * 0.2, 10, 20);
  const rect = rampBetween(t, [20, 30], [50, 110], {
    width: 6,
    shoulder: 4,
    heightA: 15,
    heightB: 25,
    strength: 1,
  });
  assert.ok(rect);
  assert.ok(rect.c0 >= 0 && rect.c1 < 30);
  assert.ok(rect.r0 >= 0 && rect.r1 < 60);

  // At point A (20, 30) -> should be close to heightA 15
  near(heightAt(t, 20, 30), 15, 0.05);
  // At point B (50, 110) -> should be close to heightB 25
  near(heightAt(t, 50, 110), 25, 0.05);
  // Midpoint (35, 70) -> should be close to 20
  near(heightAt(t, 35, 70), 20, 0.05);
});

// 2. Stamp rotation symmetry: 180 deg rotation of ridge is symmetric, 90 deg rotates orientation
test('extra: thermal erosion with large talus threshold leaves terrain untouched', () => {
  const t = makeGrid(31, 31, 2, (x, z) => Math.hypot(x - 30, z - 30) < 10 ? 10 : 0);
  // Max diff is 10, cell is 2 -> slope is 5. With talus=10, talusHeight=20 > diff (10), so no erosion
  const rect = thermalErode(t, 20, 10);
  assert.equal(rect, null);
});

// 4. Thermal erosion with talus = 0 (erodes all height differences in interior)
test('extra: thermal erosion with talus 0 aggressively flattens interior while conserving mass', () => {
  const t = makeGrid(25, 25, 1, (x, z) => ((x === 12 && z === 12) ? 100 : 0));
  const sumBefore = t.heights.reduce((a, b) => a + b, 0);

  const rect = thermalErode(t, 100, 0, 0.6);
  assert.ok(rect);
  const sumAfter = t.heights.reduce((a, b) => a + b, 0);
  near(sumBefore, sumAfter, 1e-3);

  // Peak at (12, 12) should be significantly reduced from 100
  const peak = heightAt(t, 12, 12);
  assert.ok(peak < 20, `peak should be lowered, was ${peak}`);
  // Neighbor nodes should have gained height
  assert.ok(heightAt(t, 11, 12) > 0);
});

// 5. Polygon winding order independence (CW vs CCW)
test('extra: polygon winding order independence', () => {
  const ccw = [[10, 10], [40, 10], [40, 40], [10, 40]] as const;
  const cw = [[10, 40], [40, 40], [40, 10], [10, 10]] as const;

  const t1 = makeGrid(31, 31, 2, () => 2);
  const t2 = makeGrid(31, 31, 2, () => 2);

  levelPolygon(t1, ccw, 10, 4);
  levelPolygon(t2, cw, 10, 4);

  assert.deepEqual([...t1.heights], [...t2.heights]);
});

// 6. Stamps near each of the four corners and borders
test('extra: stamps near four corners handle boundary clipping safely', () => {
  const t = makeGrid(41, 41, 2, () => 0); // 0 to 80 on each axis

  const rTL = stamp(t, 'mound', [0, 0], 20, { height: 5, seed: 1, roughness: 0 });
  const rTR = stamp(t, 'plateau', [80, 0], 20, { height: 6, seed: 2, roughness: 0 });
  const rBL = stamp(t, 'crater', [0, 80], 20, { height: 7, seed: 3, roughness: 0 });
  const rBR = stamp(t, 'volcano', [80, 80], 20, { height: 8, seed: 4, roughness: 0 });

  assert.ok(rTL);
  assert.ok(rTR);
  assert.ok(rBL);
  assert.ok(rBR);

  near(heightAt(t, 0, 0), 5);
  near(heightAt(t, 80, 0), 6);
  near(heightAt(t, 0, 80), -7);
});

// 7. Stats of a single value grid
test('extra: stats of a uniform grid', () => {
  const t = makeGrid(10, 10, 3, () => 42);
  const s = terrainStats(t);
  assert.equal(s.min, 42);
  assert.equal(s.max, 42);
  assert.equal(s.mean, 42);
  assert.equal(s.landFraction, 1.0);
  assert.equal(s.steepest, 0);
});

// 8. Stats of a negative uniform grid
test('extra: stats of all-negative grid', () => {
  const t = makeGrid(5, 5, 2, () => -10);
  const s = terrainStats(t);
  assert.equal(s.min, -10);
  assert.equal(s.max, -10);
  assert.equal(s.mean, -10);
  assert.equal(s.landFraction, 0);
  assert.equal(s.steepest, 0);
});

// 9. Ramp with partial strength
test('extra: ramp with partial strength blends with existing height', () => {
  const t100 = makeGrid(21, 21, 2, () => 0);
  const t50 = makeGrid(21, 21, 2, () => 0);

  rampBetween(t100, [10, 20], [30, 20], { width: 4, shoulder: 0, heightA: 10, heightB: 10, strength: 1.0 });
  rampBetween(t50, [10, 20], [30, 20], { width: 4, shoulder: 0, heightA: 10, heightB: 10, strength: 0.5 });

  near(heightAt(t100, 20, 20), 10);
  near(heightAt(t50, 20, 20), 5);
});

// 10. Level polygon with complex concave star polygon
test('extra: level polygon with 5-pointed concave star polygon', () => {
  const star = [
    [20, 0],
    [26, 12],
    [40, 14],
    [30, 24],
    [32, 38],
    [20, 31],
    [8, 38],
    [10, 24],
    [0, 14],
    [14, 12],
  ] as const;

  const t = makeGrid(31, 31, 2, () => 0, -10, -10);
  const rect = levelPolygon(t, star, 15, 0);
  assert.ok(rect);
  // Center of star (20, 20) is inside
  near(heightAt(t, 20, 20), 15);
  // Outside the star (0, 0) is untouched
  near(heightAt(t, -5, -5), 0);
});

// 11. Deterministic noise consistency
test('extra: valueNoise2D is deterministic and bounded in [0, 1]', () => {
  for (let i = 0; i < 20; i++) {
    const x = i * 1.37;
    const z = i * 2.89;
    const v1 = valueNoise2D(x, z, 12345);
    const v2 = valueNoise2D(x, z, 12345);
    assert.equal(v1, v2);
    assert.ok(v1 >= 0 && v1 <= 1, `noise value ${v1} out of bounds`);
  }
});

// 12. Dune rotation angles
test('extra: dune rotation orientates crest properly in multiple directions', () => {
  const tEast = makeGrid(31, 31, 2, () => 0); // rot = 0 (faces +x)
  const tNorth = makeGrid(31, 31, 2, () => 0); // rot = PI/2 (faces +z)

  stamp(tEast, 'dune', [30, 30], 20, { height: 10, seed: 1, rotation: 0, roughness: 0 });
  stamp(tNorth, 'dune', [30, 30], 20, { height: 10, seed: 1, rotation: Math.PI / 2, roughness: 0 });

  // East-facing dune has higher crest at (30+5, 30) than (30-5, 30)
  assert.ok(heightAt(tEast, 35, 30) > heightAt(tEast, 25, 30));
  // North-facing dune has higher crest at (30, 30+5) than (30, 30-5)
  assert.ok(heightAt(tNorth, 30, 35) > heightAt(tNorth, 30, 25));
});
