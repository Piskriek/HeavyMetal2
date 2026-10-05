import test from 'node:test';
import assert from 'node:assert/strict';
import { build, findPath, smooth, type Heights } from '../src/index';
import { reachable } from '../src/index';

const flat = (cols: number, rows: number): Heights => ({ cols, rows, cell: 1, originX: 0, originZ: 0, heights: new Float32Array(cols * rows).fill(1) });

test('a straight path on flat ground', () => {
  const g = build(flat(5, 5), [], { sea: 0, maxStep: 0.5 });
  const p = findPath(g, [0, 0], [4, 0])!;
  assert.deepEqual(p, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]);
  assert.deepEqual(smooth(g, p), [[0, 0], [4, 0]]);
});
test('a wall makes it go round', () => {
  const g = build(flat(5, 5), [{ minX: 1.5, minZ: -1, maxX: 2.5, maxZ: 3.5 }], { sea: 0, maxStep: 0.5 });
  const p = findPath(g, [0, 0], [4, 0])!;
  assert.ok(p.every(([c, r]) => !(c === 2 && r <= 3)));
  assert.deepEqual(p[p.length - 1], [4, 0]);
});
test('no way through returns null', () => {
  const g = build(flat(5, 5), [{ minX: 1.5, minZ: -1, maxX: 2.5, maxZ: 9 }], { sea: 0, maxStep: 0.5 });
  assert.equal(findPath(g, [0, 0], [4, 0]), null);
});

test('water blocks cells below sea level', () => {
  const h = flat(3, 3);
  for (let r = 0; r < 3; r += 1) h.heights[1 + r * 3] = -1;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });

  assert.equal(g.walkable[4], 0);
  assert.equal(findPath(g, [0, 1], [2, 1]), null);
});

test('a steep cliff blocks movement', () => {
  const h = flat(3, 1);
  h.heights[2] = 2;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });

  assert.equal(g.walkable[2], 1);
  assert.equal(findPath(g, [0, 0], [2, 0]), null);
});

test('the path avoids costly mud when a cheaper route exists', () => {
  const g = build(flat(5, 3), [], {
    sea: 0,
    maxStep: 0.5,
    costs: [{ x: 2, z: 1, radius: 0.4, cost: 20 }],
  });
  const p = findPath(g, [0, 1], [4, 1]);

  assert.ok(p !== null);
  assert.ok(p.every(([c, r]) => c !== 2 || r !== 1));
});

test('the node limit stops the search', () => {
  const g = build(flat(10, 10), [], { sea: 0, maxStep: 0.5 });
  assert.equal(findPath(g, [0, 0], [9, 9], 1), null);
});

test('a start inside a box snaps to a free cell', () => {
  const g = build(
    flat(5, 5),
    [{ minX: 1.5, minZ: 1.5, maxX: 2.5, maxZ: 2.5 }],
    { sea: 0, maxStep: 0.5 },
  );
  const p = findPath(g, [2, 2], [4, 2])!;

  assert.ok(p.length > 0);
  const first = p[0]!;
  assert.notDeepEqual(first, [2, 2]);
  assert.equal(g.walkable[first[0] + first[1] * g.cols], 1);
  assert.deepEqual(p[p.length - 1], [4, 2]);
});

test('reachable returns only cells on the start island', () => {
  const g = build(
    flat(5, 3),
    [{ minX: 1.5, minZ: -1, maxX: 2.5, maxZ: 3 }],
    { sea: 0, maxStep: 0.5 },
  );
  const cells = [...reachable(g, [0, 1])].sort((a, b) => a - b);

  assert.deepEqual(cells, [0, 1, 5, 6, 10, 11]);
});