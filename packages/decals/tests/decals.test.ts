import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaAt, cellUv, corners, drape, frameAt, onBox, onGround, overlapping, type Decal, type DecalDef, type Heights } from '../src/index';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const def: DecalDef = { id: 'smile', cell: 5, frames: 4, fps: 8, size: 2, fade: 0.1 };
const flat: Heights = { cols: 3, rows: 3, cell: 1, originX: 0, originZ: 0, heights: new Float32Array(9).fill(1) };

test('atlas cells and frames', () => {
  assert.deepEqual(cellUv({ cols: 4, rows: 2 }, 5), [0.25, 0.5, 0.5, 1]);
  assert.equal(frameAt(def, 0), 0);
  assert.equal(frameAt(def, 0.25), 2);
  assert.equal(frameAt(def, 0.5), 0);
});

test('on flat ground it lies flat, 1 cm up', () => {
  const d = onGround(flat, 1, 1, def, 0, 1);
  near(d.pos[1], 1.01); near(d.normal[1], 1); near(d.up[2], 1);
  const c = corners(d);
  near(c[0][0], 0); near(c[0][2], 0); near(c[2][0], 2); near(c[2][2], 2);
});

test('on a box face', () => {
  const d = onBox([0, 0, 0], [2, 2, 2], [2, 1, 1], def, 0, 1)!;
  assert.deepEqual(d.normal, [1, 0, 0]);
  near(d.pos[0], 2.01); near(d.up[1], 1);
  assert.equal(onBox([0, 0, 0], [2, 2, 2], [1, 1, 1], def, 0, 1), null);
});

test('soft edges', () => {
  near(alphaAt(def, 0.5, 0.5), 1);
  near(alphaAt(def, 0, 0.5), 0);
  assert.ok(alphaAt(def, 0.05, 0.5) > 0 && alphaAt(def, 0.05, 0.5) < 1);
});

test('rotation 90 swaps corners', () => {
  const c0 = corners(onGround(flat, 1, 1, def, 0, 7));
  const c90 = corners(onGround(flat, 1, 1, def, 90, 7));
  // a quarter turn puts every corner where the previous one in the list was,
  // so the pairs (bottom-left, top-left) and (bottom-right, top-right) trade places
  const prev = (i: number): number => (i + 3) % 4;
  for (let i = 0; i < 4; i++) {
    near(c90[i]![0], c0[prev(i)]![0]);
    near(c90[i]![1], c0[prev(i)]![1]);
    near(c90[i]![2], c0[prev(i)]![2]);
  }
  // ... and the footprint is exactly the same square, so nothing slides about
  const xs = c0.map((p) => p[0]).sort((a, b) => a - b);
  const zs = c90.map((p) => p[2]).sort((a, b) => a - b);
  for (let i = 0; i < 4; i++) {
    near(xs[i]!, [0, 0, 2, 2][i]!);
    near(zs[i]!, [0, 0, 2, 2][i]!);
  }
  // a full turn is the identity, half a turn is a point reflection
  const c360 = corners(onGround(flat, 1, 1, def, 360, 7));
  const c180 = corners(onGround(flat, 1, 1, def, 180, 7));
  for (let i = 0; i < 4; i++) {
    near(c360[i]![0], c0[i]![0]); near(c360[i]![2], c0[i]![2]);
    near(c180[i]![0], 2 - c0[i]![0]); near(c180[i]![2], 2 - c0[i]![2]);
  }
});

test("a sloped ground's normal", () => {
  // ramp rising one unit per cell along +x, flat along z
  const ramp: Heights = { cols: 3, rows: 3, cell: 1, originX: 0, originZ: 0, heights: new Float32Array([0, 1, 2, 0, 1, 2, 0, 1, 2]) };
  const d = onGround(ramp, 1, 1, def, 0, 3);
  const s = Math.SQRT1_2;
  near(d.normal[0], -s); near(d.normal[1], s); near(d.normal[2], 0);
  near(d.pos[0], 1 - 0.01 * s); near(d.pos[2], 1);
  near(d.pos[1], 1 + 0.01 * s); // lifted along the tilted normal, so a hair higher than 1.01
  near(d.up[2], 1); near(d.up[0], 0);
  const c = corners(d);
  // right = cross(normal, up) points up the slope as well as along +x
  near(c[2][0] - c[0][0], 2 * s); near(c[2][1] - c[0][1], 2 * s);
  near(c[0][2], 0); near(c[2][2], 2);
});

test('onBox on each face', () => {
  const box: [number, number, number] = [0, 0, 0];
  const hit = (p: [number, number, number]): Decal => onBox([0, 0, 0], [2, 2, 2], p, def, 0, 1)!;
  const cases: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [
    [[2, 1, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 1, 1], [-1, 0, 0], [0, 1, 0]],
    [[1, 2, 1], [0, 1, 0], [0, 0, 1]],
    [[1, 0, 1], [0, -1, 0], [0, 0, 1]],
    [[1, 1, 2], [0, 0, 1], [0, 1, 0]],
    [[1, 1, 0], [0, 0, -1], [0, 1, 0]],
  ];
  for (const [point, normal, up] of cases) {
    const d = hit(point);
    assert.deepEqual(d.normal, normal, `normal at ${point.join()}`);
    assert.deepEqual(d.up, up, `up at ${point.join()}`);
    assert.equal(d.def, 'smile');
    for (let k = 0; k < 3; k++) near(d.pos[k]!, point[k]! + 0.01 * normal[k]!);
  }
  // a corner point still lands on a face; the interior and the far outside do not
  assert.ok(hit([2, 2, 1]));
  assert.equal(onBox(box, [2, 2, 2], [1, 1, 1], def, 0, 1), null);
  assert.equal(onBox(box, [2, 2, 2], [1, 3, 1], def, 0, 1), null);
  // side faces stand up: their corners keep the face coordinate
  const side = corners(hit([2, 1, 1]));
  for (const p of side) near(p[0], 2.01);
  near(side[2][1] - side[0][1], 2); near(side[2][2] - side[0][2], 2);
});

test('alpha at the corner', () => {
  near(alphaAt(def, 0, 0), 0);
  near(alphaAt(def, 1, 1), 0);
  near(alphaAt(def, 0.95, 0.9), 0.5); // half way through the fade band
  near(alphaAt(def, 0.9, 0.9), 1); // the band ends at 0.1 from the edge
  near(alphaAt(def, -0.5, 0.5), 0);
  const hard: DecalDef = { id: 'hard', cell: 0, frames: 1, fps: 0, size: 1, fade: 0 };
  near(alphaAt(hard, 0, 0.5), 0);
  near(alphaAt(hard, 0.5, 0.5), 1);
  near(alphaAt(hard, 1e-9, 0.5), 1);
});

test('drape hugs bumps', () => {
  const bump: Heights = { cols: 3, rows: 3, cell: 1, originX: 0, originZ: 0, heights: new Float32Array([1, 1, 1, 1, 2, 1, 1, 1, 1]) };
  const d = onGround(bump, 1, 1, def, 0, 5);
  const pts = drape(bump, d, 3);
  assert.equal(pts.length, 9);
  near(pts[0]![0], 0); near(pts[0]![2], 0); near(pts[0]![1], 1.01);
  near(pts[4]![0], 1); near(pts[4]![2], 1); near(pts[4]![1], 2.01); // lifted over the bump
  near(pts[2]![1], 1.01);
  const two = drape(bump, d, 2);
  assert.equal(two.length, 4);
  near(two[0]![0], 0); near(two[3]![2], 2);
  // every point floats exactly 1 cm above the ground under it: 1.01 everywhere
  // but over the bump itself, where the bilinear height is 2
  let high = 0;
  for (const p of pts) {
    const low = Math.abs(p[1] - 1.01) < 1e-9;
    const top = Math.abs(p[1] - 2.01) < 1e-9;
    assert.ok(low || top, `point at ${p[0]},${p[2]} is ${p[1]} up`);
    if (top) high++;
  }
  assert.equal(high, 1);
});

test('overlapping neighbours', () => {
  const at = (id: string, x: number, z: number): Decal => ({ def: id, pos: [x, 1.01, z], normal: [0, 1, 0], up: [0, 0, 1], size: 2, rotation: 0, seed: 0 });
  const all = [at('a', 0, 0), at('b', 5, 5), at('c', 0.5, 0)];
  const fresh = at('new', 0, 0);
  assert.deepEqual(overlapping(all, fresh, 8), [0, 2]);
  assert.deepEqual(overlapping(all, fresh, 1), [2]); // keep the newest, drop the oldest
  assert.deepEqual(overlapping(all, fresh, 0), []);
  assert.deepEqual(overlapping([all[1]!], fresh, 4), []);
  assert.deepEqual(overlapping([], fresh, 4), []);
});

test('cells and frames at the edges', () => {
  assert.deepEqual(cellUv({ cols: 2, rows: 1 }, 1), [0.5, 0, 1, 1]);
  assert.deepEqual(cellUv({ cols: 4, rows: 2 }, 99), [0.75, 0.5, 1, 1]); // clamped to the last cell
  const still: DecalDef = { id: 'still', cell: 3, frames: 1, fps: 12, size: 1, fade: 0 };
  assert.equal(frameAt(still, 100), 0);
  const loop: DecalDef = { id: 'loop', cell: 0, frames: 4, fps: 4, size: 1, fade: 0 };
  assert.equal(frameAt(loop, 0.249), 0);
  assert.equal(frameAt(loop, 0.25), 1);
  assert.equal(frameAt(loop, 1), 0);
  assert.equal(frameAt(loop, -0.25), 3); // runs backwards cleanly too
});