import test from 'node:test';
import assert from 'node:assert/strict';
import { components, countFilled, crop, emptyModel, floodFill, get, hollow, intersect, pieces, set, split, subtract, union, type Voxels } from '../src/index';
const box = (sx: number, sy: number, sz: number, mat = 1): Voxels => { const m = emptyModel(sx, sy, sz); m.cells.fill(mat); return m; };

test('union paints b into a and drops what falls outside', () => {
  const a = emptyModel(4, 4, 4);
  const u = union(a, box(2, 2, 2, 3), [1, 1, 1]);
  assert.equal(countFilled(u), 8); assert.equal(get(u, 1, 1, 1), 3); assert.equal(get(u, 2, 2, 2), 3);
  assert.equal(countFilled(union(a, box(2, 2, 2, 3), [3, 3, 3])), 1);
  assert.equal(countFilled(a), 0);
});
test('subtract carves, intersect keeps the overlap with a\'s colours', () => {
  const a = box(4, 4, 4, 2);
  assert.equal(countFilled(subtract(a, box(2, 2, 2), [1, 1, 1])), 56);
  const i = intersect(a, box(2, 2, 2, 9), [1, 1, 1]);
  assert.equal(countFilled(i), 8); assert.equal(get(i, 1, 1, 1), 2); assert.equal(get(i, 0, 0, 0), 0);
  assert.equal(countFilled(subtract(a, box(2, 2, 2), [-1, -1, -1])), 63);
});
test('split cuts along a plane', () => {
  const [lo, hi] = split(box(4, 4, 4), 'x', 1);
  assert.equal(countFilled(lo), 16); assert.equal(countFilled(hi), 48);
  assert.deepEqual(lo.size, [4, 4, 4]); assert.equal(get(lo, 0, 3, 3), 1); assert.equal(get(lo, 1, 0, 0), 0);
  const [below, above] = split(box(2, 3, 2), 'y', 2);
  assert.equal(countFilled(below), 8); assert.equal(countFilled(above), 4);
});
test('crop finds the contents and where they were', () => {
  const m = emptyModel(6, 6, 6); set(m, 2, 3, 4, 5); set(m, 3, 3, 5, 6);
  const c = crop(m)!;
  assert.deepEqual(c.model.size, [2, 1, 2]); assert.deepEqual(c.offset, [2, 3, 4]);
  assert.equal(countFilled(c.model), 2); assert.equal(get(c.model, 0, 0, 0), 5); assert.equal(get(c.model, 1, 0, 1), 6);
  assert.equal(crop(emptyModel(3, 3, 3)), null);
});
test('hollow keeps a shell', () => {
  assert.equal(countFilled(hollow(box(5, 5, 5), 1)), 98);
  assert.equal(countFilled(hollow(box(5, 5, 5), 2)), 124);
  assert.equal(countFilled(hollow(box(2, 2, 2), 1)), 8);
});
test('flood fill follows one colour', () => {
  const m = emptyModel(3, 1, 1); set(m, 0, 0, 0, 1); set(m, 1, 0, 0, 1); set(m, 2, 0, 0, 2);
  const f = floodFill(m, [0, 0, 0], 5);
  assert.deepEqual(Array.from(f.cells), [5, 5, 2]);
  assert.deepEqual(Array.from(floodFill(m, [9, 0, 0], 5).cells), [1, 1, 2]);
});
test('pieces: separate blobs are separate pieces, largest first', () => {
  const m = emptyModel(6, 1, 1); set(m, 0, 0, 0, 1); set(m, 2, 0, 0, 1); set(m, 3, 0, 0, 4); set(m, 4, 0, 0, 1);
  assert.equal(components(m), 2);
  const p = pieces(m);
  assert.equal(p.length, 2); assert.equal(countFilled(p[0]!), 3); assert.equal(countFilled(p[1]!), 1); assert.equal(get(p[0]!, 3, 0, 0), 4);
  assert.equal(components(emptyModel(2, 2, 2)), 0);
});

// ---- additional tests ----

test('inputs are never mutated', () => {
  const a = box(3, 3, 3, 2);
  const b = box(2, 2, 2, 7);
  const snapA = Array.from(a.cells);
  const snapB = Array.from(b.cells);
  union(a, b, [0, 0, 0]); subtract(a, b, [1, 1, 1]); intersect(a, b, [0, 0, 0]);
  split(a, 'z', 1); crop(a); hollow(a, 1); floodFill(a, [0, 0, 0], 9); pieces(a); components(a);
  assert.deepEqual(Array.from(a.cells), snapA);
  assert.deepEqual(Array.from(b.cells), snapB);
});
test('union overwrites overlapping cells with b\'s material', () => {
  const a = box(2, 1, 1, 1);
  const u = union(a, box(1, 1, 1, 9), [1, 0, 0]);
  assert.equal(get(u, 0, 0, 0), 1); assert.equal(get(u, 1, 0, 0), 9);
});
test('get/set are safe outside the box', () => {
  const m = emptyModel(2, 2, 2);
  assert.equal(get(m, -1, 0, 0), 0); assert.equal(get(m, 0, 0, 5), 0);
  set(m, -1, 0, 0, 7); set(m, 2, 2, 2, 7);
  assert.equal(countFilled(m), 0);
});
test('split at the extremes puts everything on one side', () => {
  const [lo1, hi1] = split(box(3, 3, 3), 'z', 0);
  assert.equal(countFilled(lo1), 0); assert.equal(countFilled(hi1), 27);
  const [lo2, hi2] = split(box(3, 3, 3), 'z', 3);
  assert.equal(countFilled(lo2), 27); assert.equal(countFilled(hi2), 0);
});
test('crop of a full box is the whole box at the origin', () => {
  const c = crop(box(2, 3, 4, 6))!;
  assert.deepEqual(c.model.size, [2, 3, 4]); assert.deepEqual(c.offset, [0, 0, 0]);
  assert.equal(countFilled(c.model), 24);
});
test('hollow with a huge wall keeps everything; wall 0 keeps nothing', () => {
  assert.equal(countFilled(hollow(box(4, 4, 4), 99)), 64);
  assert.equal(countFilled(hollow(box(4, 4, 4), 0)), 0);
});
test('hollow sees interior cavities as empty space too', () => {
  const m = box(5, 5, 5, 3);
  set(m, 2, 2, 2, 0); // cavity in the middle
  const h = hollow(m, 1);
  // outer shell (98) plus the six cells around the cavity
  assert.equal(countFilled(h), 104);
  assert.equal(get(h, 1, 2, 2), 3); assert.equal(get(h, 1, 1, 2), 0);
});
test('flood fill to the same material is a no-op copy that terminates', () => {
  const m = box(2, 2, 1, 4);
  const f = floodFill(m, [0, 0, 0], 4);
  assert.deepEqual(Array.from(f.cells), Array.from(m.cells));
  assert.notEqual(f.cells, m.cells);
});
test('flood fill does not cross diagonals or other colours', () => {
  const m = emptyModel(2, 2, 1);
  set(m, 0, 0, 0, 1); set(m, 1, 1, 0, 1); // diagonal only
  const f = floodFill(m, [0, 0, 0], 8);
  assert.equal(get(f, 0, 0, 0), 8); assert.equal(get(f, 1, 1, 0), 1);
});
test('pieces tie-break: equal sizes ordered by lowest cell index', () => {
  const m = emptyModel(5, 1, 1);
  set(m, 3, 0, 0, 2); set(m, 0, 0, 0, 7); // both single cells
  const p = pieces(m);
  assert.equal(p.length, 2);
  assert.equal(get(p[0]!, 0, 0, 0), 7); // index 0 before index 3
  assert.equal(get(p[1]!, 3, 0, 0), 2);
  assert.deepEqual(p[0]!.size, [5, 1, 1]);
});
test('components counts mixed-material blobs as one piece across z', () => {
  const m = emptyModel(1, 1, 3);
  set(m, 0, 0, 0, 1); set(m, 0, 0, 1, 2); set(m, 0, 0, 2, 3);
  assert.equal(components(m), 1);
});