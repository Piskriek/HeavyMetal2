import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, arch, ball, bounds, countFilled, cube, cylinder, emptyModel, get, hollowBox, mirrorX, rotateY90, set, stairs, stamp, wedge } from '../src/index';

test('cube, ball and cylinder fill the right number of cells', () => {
  assert.equal(countFilled(cube(3, 2, 4)), 24);
  assert.equal(countFilled(ball(2)), 32);
  assert.equal(countFilled(cylinder(2, 3)), 36);
});
test('wedge, stairs, hollow box and arch', () => {
  assert.equal(countFilled(wedge(4, 4, 1)), 10);
  assert.equal(countFilled(stairs(4, 4, 2, 4)), 20);
  assert.equal(countFilled(hollowBox(5, 5, 5, 1)), 98);
  assert.equal(countFilled(arch(5, 4, 1, 1)), 11);
});
test('get and set stay inside the model', () => {
  const m = emptyModel(2, 2, 2);
  set(m, 1, 1, 1, 7); set(m, 5, 0, 0, 3);
  assert.equal(get(m, 1, 1, 1), 7); assert.equal(get(m, 5, 0, 0), 0); assert.equal(countFilled(m), 1);
});
test('a quarter turn and a mirror move cells where they should', () => {
  const m = emptyModel(3, 1, 2); set(m, 0, 0, 0, 1);
  const r = rotateY90(m);
  assert.deepEqual(r.size, [2, 1, 3]); assert.equal(get(r, 1, 0, 0), 1);
  const f = mirrorX(m);
  assert.equal(get(f, 2, 0, 0), 1); assert.equal(get(f, 0, 0, 0), 0);
});
test('stamp and bounds', () => {
  const a = emptyModel(6, 6, 6);
  stamp(a, cube(2, 2, 2, 5), 1, 0, 3);
  assert.equal(countFilled(a), 8); assert.equal(get(a, 2, 1, 4), 5);
  assert.deepEqual(bounds(a), [1, 0, 3, 2, 1, 4]);
  assert.equal(bounds(emptyModel(2, 2, 2)), null);
});
test('every ready-made block is non-empty at scale 1 and 2', () => {
  for (const id of ['cube', 'ball', 'cylinder', 'wedge', 'stairs', 'hollow-box', 'arch', 'plank', 'pillar']) {
    const b = BLOCKS.find((x) => x.id === id);
    assert.ok(b, id);
    assert.ok(countFilled(b!.make(1)) > 0 && countFilled(b!.make(2)) > countFilled(b!.make(1)), id);
  }
});

/* ------------------------- extra tests ------------------------- */

test('indexing order is x + y*sx + z*sx*sy', () => {
  const m = emptyModel(2, 3, 4);
  assert.equal(m.cells.length, 24);
  set(m, 1, 2, 3, 9);
  assert.equal(m.cells[1 + 2 * 2 + 3 * 2 * 3], 9);
});

test('materials are kept by every maker', () => {
  assert.equal(get(cube(2, 2, 2, 42), 1, 1, 1), 42);
  assert.equal(get(cylinder(1, 2, 17), 0, 1, 0), 17);
  assert.equal(get(wedge(2, 2, 2, 33), 1, 1, 1), 33);
  assert.equal(get(hollowBox(3, 3, 3, 1, 8), 0, 0, 0), 8);
  assert.equal(get(hollowBox(3, 3, 3, 1, 8), 1, 1, 1), 0);
});

test('ball and cylinder are symmetric', () => {
  const b = ball(3);
  for (let z = 0; z < 6; z++) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    assert.equal(get(b, x, y, z), get(b, 5 - x, 5 - y, 5 - z));
  }
  const c = cylinder(3, 2);
  assert.equal(countFilled(c) % 2, 0);
  assert.deepEqual(c.size, [6, 2, 6]);
});

test('wedge is a ramp and its top is at the far +x end', () => {
  const w = wedge(4, 4, 1);
  assert.equal(get(w, 0, 0, 0), 1);
  assert.equal(get(w, 0, 1, 0), 0);
  assert.equal(get(w, 3, 3, 0), 1);
  assert.deepEqual(bounds(w), [0, 0, 0, 3, 3, 0]);
});

test('stairs have flat treads', () => {
  const s = stairs(6, 3, 1, 3);
  const heights: number[] = [];
  for (let x = 0; x < 6; x++) {
    let h = 0;
    for (let y = 0; y < 3; y++) if (get(s, x, y, 0) !== 0) h++;
    heights.push(h);
  }
  assert.deepEqual(heights, [1, 1, 2, 2, 3, 3]);
});

test('hollow box with thick walls can be solid', () => {
  assert.equal(countFilled(hollowBox(4, 4, 4, 2)), 64);
  assert.equal(countFilled(hollowBox(6, 6, 6, 2)), 216 - 8);
});

test('arch keeps legs, lintel and both skins', () => {
  const a = arch(5, 4, 2, 1);
  assert.equal(get(a, 0, 0, 0), 1);
  assert.equal(get(a, 2, 0, 0), 0);
  assert.equal(get(a, 2, 3, 1), 1);
  assert.equal(countFilled(a), 22);
});

test('four quarter turns come back to the start', () => {
  const m = cube(3, 2, 1, 4);
  set(m, 0, 0, 0, 7);
  const back = rotateY90(rotateY90(rotateY90(rotateY90(m))));
  assert.deepEqual(back.size, m.size);
  assert.deepEqual(Array.from(back.cells), Array.from(m.cells));
});

test('mirroring twice is the identity', () => {
  const m = wedge(4, 3, 2, 6);
  const back = mirrorX(mirrorX(m));
  assert.deepEqual(Array.from(back.cells), Array.from(m.cells));
  assert.equal(countFilled(mirrorX(m)), countFilled(m));
});

test('stamp clips at the edges and returns the target', () => {
  const a = emptyModel(3, 3, 3);
  const r = stamp(a, cube(2, 2, 2, 4), 2, 2, 2);
  assert.equal(r, a);
  assert.equal(countFilled(a), 1);
  assert.equal(get(a, 2, 2, 2), 4);
  stamp(a, cube(2, 2, 2, 5), -1, -1, -1);
  assert.equal(get(a, 0, 0, 0), 5);
  assert.equal(countFilled(a), 2);
});

test('stamp does not alias the source model', () => {
  const a = emptyModel(4, 4, 4);
  const b = cube(2, 2, 2, 3);
  stamp(a, b, 0, 0, 0);
  set(a, 0, 0, 0, 9);
  assert.equal(get(b, 0, 0, 0), 3);
});

test('bounds of a stamped ball match the ball itself', () => {
  const a = emptyModel(10, 10, 10);
  stamp(a, ball(2), 3, 4, 5);
  assert.deepEqual(bounds(a), [3, 4, 5, 6, 7, 8]);
});

test('bad sizes and materials are rejected', () => {
  assert.throws(() => emptyModel(0, 1, 1), RangeError);
  assert.throws(() => emptyModel(1.5, 1, 1), RangeError);
  assert.throws(() => cube(1, 1, 1, 0), RangeError);
  assert.throws(() => cube(1, 1, 1, 256), RangeError);
  assert.throws(() => hollowBox(3, 3, 3, 0), RangeError);
  assert.throws(() => stairs(3, 3, 3, 0), RangeError);
});

test('palette ids are unique and models are well formed', () => {
  const ids = BLOCKS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BLOCKS) {
    const m = b.make(1);
    assert.equal(m.cells.length, m.size[0] * m.size[1] * m.size[2]);
    assert.ok(b.name.length > 0, b.id);
    assert.notEqual(bounds(m), null);
  }
});

test('plank is long and thin, pillar is tall and thin', () => {
  const plank = BLOCKS.find((b) => b.id === 'plank')!.make(1);
  assert.ok(plank.size[0] > plank.size[1]);
  const pillar = BLOCKS.find((b) => b.id === 'pillar')!.make(1);
  assert.ok(pillar.size[1] > pillar.size[0]);
});

test('a small house can be built from the palette', () => {
  const world = emptyModel(16, 16, 16);
  stamp(world, hollowBox(8, 6, 8, 1, 2), 0, 0, 0);
  stamp(world, arch(4, 4, 1, 1, 3), 2, 0, 0);
  stamp(world, wedge(8, 4, 8, 4), 0, 6, 0);
  stamp(world, rotateY90(BLOCKS.find((b) => b.id === 'stairs')!.make(1)), 9, 0, 0);
  assert.ok(countFilled(world) > 100);
  const bb = bounds(world);
  assert.notEqual(bb, null);
  assert.equal(bb![0], 0);
  assert.ok(bb![3] >= 8);
});