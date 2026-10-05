import test from 'node:test';
import assert from 'node:assert/strict';
import {
  build,
  findPath,
  smooth,
  reachable,
  cellOf,
  worldOf,
  type Heights,
} from '../src/index';

const flat = (cols: number, rows: number): Heights => ({
  cols,
  rows,
  cell: 1,
  originX: 0,
  originZ: 0,
  heights: new Float32Array(cols * rows).fill(1),
});

/* ─── Provided acceptance tests ─── */

test('a straight path on flat ground', () => {
  const g = build(flat(5, 5), [], { sea: 0, maxStep: 0.5 });
  const p = findPath(g, [0, 0], [4, 0])!;
  assert.deepEqual(p, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]);
  assert.deepEqual(smooth(g, p), [[0, 0], [4, 0]]);
});

test('a wall makes it go round', () => {
  const g = build(flat(5, 5), [{ minX: 1.5, minZ: -1, maxX: 2.5, maxZ: 3.5 }], {
    sea: 0,
    maxStep: 0.5,
  });
  const p = findPath(g, [0, 0], [4, 0])!;
  assert.ok(p.every(([c, r]) => !(c === 2 && r <= 3)));
  assert.deepEqual(p[p.length - 1], [4, 0]);
});

test('no way through returns null', () => {
  const g = build(flat(5, 5), [{ minX: 1.5, minZ: -1, maxX: 2.5, maxZ: 9 }], {
    sea: 0,
    maxStep: 0.5,
  });
  assert.equal(findPath(g, [0, 0], [4, 0]), null);
});

/* ─── Additional tests ─── */

test('water blocks movement', () => {
  const h = flat(5, 5);
  for (let c = 0; c < 5; c++) h.heights[2 * 5 + c]! = -1;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });
  const p = findPath(g, [0, 0], [0, 4]);
  assert.ok(p !== null);
  assert.ok(p!.every(([, r]) => r !== 2));
});

test('cliff blocks movement', () => {
  const h = flat(5, 5);
  for (let r = 0; r < 5; r++) h.heights[r * 5 + 2]! = 100;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });
  assert.equal(findPath(g, [0, 0], [4, 0]), null);
});

test('costly mud area applies cost multiplier', () => {
  const g = build(flat(7, 7), [], {
    sea: 0,
    maxStep: 0.5,
    costs: [{ x: 3, z: 3, radius: 0.5, cost: 100 }],
  });
  assert.ok(g.cost[3 * 7 + 3]! > 99);
  assert.equal(g.cost[0]!, 1);
});

test('A* respects maxNodes limit', () => {
  const g = build(flat(100, 100), [], { sea: 0, maxStep: 0.5 });
  assert.equal(findPath(g, [0, 0], [99, 99], 10), null);
});

test('start inside a box snaps to nearest free cell', () => {
  const g = build(
    flat(5, 5),
    [{ minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 0.5 }],
    { sea: 0, maxStep: 0.5 },
  );
  const p = findPath(g, [0, 0], [4, 0]);
  assert.ok(p !== null);
  assert.deepEqual(p![0], [1, 0]);
});

test('reachable returns correct set across water', () => {
  const h = flat(5, 5);
  for (let r = 0; r < 5; r++) h.heights[r * 5 + 2]! = -1;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });
  const r = reachable(g, [0, 0]);
  assert.ok(r.has(0 * 5 + 0));
  assert.ok(r.has(1 * 5 + 1));
  assert.ok(!r.has(2 * 5 + 0));
  assert.ok(!r.has(3 * 5 + 0));
  assert.ok(!r.has(4 * 5 + 4));
});

test('cellOf and worldOf', () => {
  const g = build(flat(5, 5), [], { sea: 0, maxStep: 0.5 });
  assert.deepEqual(cellOf(g, 0.3, 0.7), [0, 0]);
  assert.deepEqual(cellOf(g, 1.5, 2.5), [1, 2]);
  assert.deepEqual(worldOf(g, 0, 0), [0, 0]);
  assert.deepEqual(worldOf(g, 2, 3), [2, 3]);
});

test('smooth removes collinear interior points', () => {
  const g = build(flat(5, 5), [], { sea: 0, maxStep: 0.5 });
  const p: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
  assert.deepEqual(smooth(g, p), [[0, 0], [4, 0]]);
});

test('smooth keeps points needed to avoid obstacle', () => {
  const g = build(
    flat(5, 5),
    [{ minX: 1.5, minZ: -0.5, maxX: 2.5, maxZ: 0.5 }],
    { sea: 0, maxStep: 0.5 },
  );
  const p: [number, number][] = [
    [0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 0], [4, 0],
  ];
  const s = smooth(g, p);
  assert.ok(s.length >= 3);
  assert.notDeepEqual(s, [[0, 0], [4, 0]]);
});

test('reachable with cliff blocks steep neighbours', () => {
  const h = flat(5, 5);
  for (let r = 0; r < 5; r++) h.heights[r * 5 + 2]! = 100;
  const g = build(h, [], { sea: 0, maxStep: 0.5 });
  const r = reachable(g, [0, 0]);
  assert.ok(r.has(0));
  assert.ok(r.has(1));
  assert.ok(!r.has(2));
  assert.ok(!r.has(3));
});