import test from 'node:test';
import assert from 'node:assert/strict';
import { boxSelect, combine, expandGroups, lassoSelect, pickAt, pointInPolygon, selectSimilar, type Item, type Pt } from '../src/index';
const it = (id: string, x: number, y: number, kind = 'prop', extra: Partial<Item> = {}): Item =>
  ({ id, centre: [x, y], bounds: [x - 5, y - 5, x + 5, y + 5], depth: 10, kind, ...extra });
const items: Item[] = [
  it('a', 20, 20), it('b', 60, 20, 'light'), it('c', 20, 60, 'prop', { group: 'g1' }),
  it('d', 100, 100, 'prop', { group: 'g1' }), it('e', 40, 40, 'prop', { locked: true }), it('f', 68, 58, 'character', { depth: 50 }),
];

test('box: enclosed and touching', () => {
  assert.deepEqual(boxSelect(items, [0, 0], [70, 70], 'enclosed'), ['a', 'b', 'c']);
  assert.deepEqual(boxSelect(items, [70, 70], [0, 0], 'touch'), ['a', 'b', 'c', 'f']);
  assert.deepEqual(boxSelect(items, [0, 0], [70, 70], 'touch', { filter: 'light' }), ['b']);
  assert.deepEqual(boxSelect(items, [0, 0], [70, 70], 'touch', { maxDepth: 20 }), ['a', 'b', 'c']);
});
test('lasso by the centre, even-odd', () => {
  assert.equal(pointInPolygon([5, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]), true);
  assert.equal(pointInPolygon([15, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]), false);
  assert.deepEqual(lassoSelect(items, [[0, 0], [90, 0], [0, 90]]), ['a', 'b', 'c']);
});
test('pick the nearest under the pointer, never a locked one', () => {
  const stacked = [...items, it('near', 60, 20, 'prop', { depth: 2 })];
  assert.equal(pickAt(stacked, [61, 21]), 'near');
  assert.equal(pickAt(items, [40, 40]), null);
});
test('groups come together; locks stay out', () => {
  assert.deepEqual(expandGroups(['c'], items), ['c', 'd']);
  assert.deepEqual(expandGroups(['e', 'a'], items), ['a']);
});
test('combining selections', () => {
  assert.deepEqual(combine(['a', 'b'], ['c'], 'replace'), ['c']);
  assert.deepEqual(combine(['a', 'b'], ['b', 'c'], 'add'), ['a', 'b', 'c']);
  assert.deepEqual(combine(['a', 'b'], ['b'], 'subtract'), ['a']);
  assert.deepEqual(combine(['a', 'b'], ['b', 'c'], 'toggle'), ['a', 'c']);
});
test('select similar', () => {
  assert.deepEqual(selectSimilar(items, 'a', 'kind'), ['a', 'c', 'd']);
  assert.deepEqual(selectSimilar(items, 'c', 'group'), ['c', 'd']);
});

// --- my own tests below ---



test('box: empty scene / nothing under the rect', () => {
  assert.deepEqual(boxSelect([], [0, 0], [10, 10], 'touch'), []);
  assert.deepEqual(boxSelect(items, [0, 0], [10, 10], 'touch'), []);
});

test('pointInPolygon: concave (even-odd notch) and degenerate polys', () => {
  const notch: Pt[] = [[0, 0], [10, 0], [10, 10], [5, 5], [0, 10]];
  assert.equal(pointInPolygon([1, 8], notch), true);
  assert.equal(pointInPolygon([2.5, 8], notch), false);
  assert.equal(pointInPolygon([2.5, 5], [[0, 0], [10, 10], [10, 0], [0, 10]]), true);
  assert.equal(pointInPolygon([0, 0], []), false);
  assert.equal(pointInPolygon([0, 0], [[0, 0]]), false);
  assert.equal(pointInPolygon([0, 0], [[0, 0], [10, 10]]), false);
});

test('lasso: needs three points, queries apply, only centres count', () => {
  assert.deepEqual(lassoSelect(items, [[0, 0], [10, 10]]), []);
  assert.deepEqual(lassoSelect(items, [[0, 0], [90, 0], [0, 90]], { filter: 'character' }), []);
  assert.deepEqual(lassoSelect(items, [[0, 0], [90, 0], [0, 90]], { maxDepth: 40 }), ['a', 'b', 'c']);
  assert.deepEqual(lassoSelect([], [[0, 0], [9, 0], [9, 9], [0, 9]]), []);
});

test('lasso: bounds poking into the polygon still counts as out', () => {
  // 'f' overlaps the triangle but its centre (68, 58) is outside it.
  assert.deepEqual(lassoSelect(items, [[0, 0], [90, 0], [0, 90]], { filter: 'all' }), ['a', 'b', 'c']);
});

test('pick: ties go to the earlier item; bounds edges count', () => {
  const stack = [it('p1', 0, 0), it('p2', 0, 0, 'light')];
  assert.equal(pickAt(stack, [0, 0]), 'p1');
  assert.equal(pickAt(stack, [5, 0]), 'p1');
  assert.equal(pickAt(stack, [5.0001, 0]), null);
  assert.equal(pickAt([it('frozen', 0, 0, 'prop', { locked: true })], [0, 0]), null);
  assert.equal(pickAt(items, [21, 21], { filter: 'light' }), null);
  assert.equal(pickAt(items, [61, 21], { filter: 'light' }), 'b');
});


test('expandGroups: order follows items whatever the id order', () => {
  assert.deepEqual(expandGroups(['d', 'a'], items), ['a', 'c', 'd']);
  assert.deepEqual(expandGroups(['d', 'c'], items), ['c', 'd']);
  assert.deepEqual(expandGroups([], items), []);
  assert.deepEqual(expandGroups(['zz'], items), []);
  assert.deepEqual(expandGroups(['b', 'f'], items), ['b', 'f']);
  assert.deepEqual(expandGroups(['e', 'e'], items), []);
});

test('expandGroups: a locked member contributes nothing', () => {
  const g = [
    it('x', 0, 0, 'prop', { group: 'k' }),
    it('y', 5, 5, 'prop', { group: 'k', locked: true }),
  ];
  assert.deepEqual(expandGroups(['x'], g), ['x']);
  assert.deepEqual(expandGroups(['y'], g), []);
});

test('combine: dedupes, keeps order, survives empty sides', () => {
  assert.deepEqual(combine(['a', 'a'], ['b', 'b', 'a'], 'add'), ['a', 'b']);
  assert.deepEqual(combine(['a', 'b', 'c'], ['c', 'a'], 'subtract'), ['b']);
  assert.deepEqual(combine(['a', 'b'], [], 'toggle'), ['a', 'b']);
  assert.deepEqual(combine([], ['b', 'a'], 'replace'), ['b', 'a']);
  assert.deepEqual(combine(['c', 'a'], ['a', 'b'], 'toggle'), ['c', 'b']);
  assert.deepEqual(combine([], [], 'replace'), []);
  assert.deepEqual(combine(['a'], ['a'], 'add'), ['a']);
  assert.deepEqual(combine(['a'], ['a'], 'subtract'), []);
});

test('select similar: unknown id, ungrouped target, locked target', () => {
  assert.deepEqual(selectSimilar(items, 'zz', 'kind'), []);
  assert.deepEqual(selectSimilar(items, 'a', 'group'), []);
  assert.deepEqual(selectSimilar(items, 'e', 'kind'), ['a', 'c', 'd']);
  assert.deepEqual(selectSimilar(items, 'b', 'kind'), ['b']);
  assert.deepEqual(selectSimilar(items, 'zz', 'group'), []);
});
