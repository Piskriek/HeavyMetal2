import test from 'node:test'; import assert from 'node:assert/strict';
import { navigator, shortestPath, type Grid } from '../src/index';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
test('open ground is a straight line', () => {
  const p = shortestPath({ w: 10, h: 10, blocked: () => false }, [0.5, 0.5], [9.5, 9.5]);
  assert.ok(p); near(p.length, 9 * Math.SQRT2); assert.equal(p.points.length, 2);
});
test('around the end of a wall, touching its corners', () => {
  const wall: Grid = { w: 10, h: 10, blocked: (x, y) => x === 5 && y <= 8 };
  const p = shortestPath(wall, [2.5, 0.5], [7.5, 0.5]);
  assert.ok(p); near(p.length, Math.sqrt(78.5) + 1 + Math.sqrt(74.5));
  assert.deepEqual(p.points.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]), [[2.5, 0.5], [5, 9], [6, 9], [7.5, 0.5]]);
});
test('sealed off, or starting in a wall: null', () => {
  const sealed: Grid = { w: 10, h: 10, blocked: (x) => x === 5 };
  assert.equal(shortestPath(sealed, [2.5, 0.5], [7.5, 0.5]), null);
  assert.equal(shortestPath(sealed, [5.5, 0.5], [7.5, 0.5]), null);
});
test('no running along the seam inside a two-row wall', () => {
  const thick: Grid = { w: 10, h: 10, blocked: (x, y) => (y === 4 || y === 5) && x >= 1 && x <= 8 };
  const p = shortestPath(thick, [0.5, 5], [9.5, 5]);
  assert.ok(p); near(p.length, 8 + 2 * Math.hypot(0.5, 1));
});
test('fast: a 64 x 64 maze, 100 queries, under 3 s including precompute', () => {
  let s = 12345; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cells = Array.from({ length: 64 * 64 }, () => rnd() < 0.25);
  for (let ch = true; ch;) { ch = false; for (let x = 0; x < 63; x++) for (let y = 0; y < 63; y++) {
    const a = cells[y * 64 + x], b = cells[y * 64 + x + 1], c = cells[(y + 1) * 64 + x], d = cells[(y + 1) * 64 + x + 1];
    if ((a && d && !b && !c) || (b && c && !a && !d)) { cells[y * 64 + x + (a ? 1 : 0)] = true; ch = true; } } }
  const g: Grid = { w: 64, h: 64, blocked: (x, y) => cells[y * 64 + x] === true };
  const free: [number, number][] = []; for (let i = 0; i < 64 * 64; i++) if (!cells[i]) free.push([(i % 64) + 0.5, Math.floor(i / 64) + 0.5]);
  const t0 = performance.now(), nav = navigator(g); let found = 0;
  for (let q = 0; q < 100; q++) { const p = nav.path(free[(q * 37) % free.length]!, free[(q * 91 + 13) % free.length]!); if (p) found++; }
  assert.ok(performance.now() - t0 < 3000, `${performance.now() - t0} ms`); assert.ok(found > 50);
});

// ---------------------------------------------------------------------------
// Additional tests (own). Given tests above are kept unchanged.
// ---------------------------------------------------------------------------

const mkGrid = (w: number, h: number, cells: Array<readonly [number, number]>): Grid => {
  const set = new Set(cells.map(([x, y]) => y * w + x));
  return { w, h, blocked: (x, y) => set.has(y * w + x) };
};
const rounded = (pts: [number, number][]) =>
  pts.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);

/** Independent re-check: does the segment respect the movement rules? */
function segOk(g: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  const inFree = (x: number, y: number) => x >= 0 && x < g.w && y >= 0 && y < g.h && !g.blocked(x, y);
  const dx = x1 - x0, dy = y1 - y0;
  const ts: number[] = [0, 1];
  if (dx !== 0) {
    for (let i = Math.ceil(Math.min(x0, x1)); i <= Math.floor(Math.max(x0, x1)); i++) {
      const t = (i - x0) / dx;
      if (t > 1e-12 && t < 1 - 1e-12) ts.push(t);
    }
  }
  if (dy !== 0) {
    for (let j = Math.ceil(Math.min(y0, y1)); j <= Math.floor(Math.max(y0, y1)); j++) {
      const t = (j - y0) / dy;
      if (t > 1e-12 && t < 1 - 1e-12) ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  for (let k = 0; k + 1 < ts.length; k++) {
    const a = ts[k]!, b = ts[k + 1]!;
    if (b - a <= 1e-9) continue; // zero-width slab at a vertex touch
    const tm = (a + b) / 2;
    const mx = x0 + tm * dx, my = y0 + tm * dy;
    if (dx === 0) {
      const r = Math.floor(my);
      if (Number.isInteger(x0)) { if (!inFree(x0 - 1, r) && !inFree(x0, r)) return false; }
      else if (!inFree(Math.floor(mx), r)) return false;
    } else if (dy === 0) {
      const c = Math.floor(mx);
      if (Number.isInteger(y0)) { if (!inFree(c, y0 - 1) && !inFree(c, y0)) return false; }
      else if (!inFree(c, Math.floor(my))) return false;
    } else if (!inFree(Math.floor(mx), Math.floor(my))) return false;
  }
  return true;
}
function checkPathOk(g: Grid, from: readonly [number, number], to: readonly [number, number], p: { points: [number, number][]; length: number }) {
  assert.deepEqual(p.points[0], [from[0], from[1]], 'starts at from');
  assert.deepEqual(p.points[p.points.length - 1], [to[0], to[1]], 'ends at to');
  let sum = 0;
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1]!, b = p.points[i]!;
    assert.ok(segOk(g, a[0], a[1], b[0], b[1]), `illegal segment ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  assert.ok(Math.abs(sum - p.length) < 1e-9, 'length is the sum of segments');
  assert.ok(p.length + 1e-9 >= Math.hypot(to[0] - from[0], to[1] - from[1]), 'shorter than straight?');
}

test('detour around a single blocked cell', () => {
  const g = mkGrid(3, 3, [[1, 1]]);
  const p = shortestPath(g, [0.5, 1.5], [2.5, 1.5]); // straight line hits cell (1,1)
  assert.ok(p);
  near(p.length, 1 + Math.SQRT2);
  assert.equal(p.points.length, 4);
  assert.deepEqual(rounded(p.points), [[0.5, 1.5], [1, 1], [2, 1], [2.5, 1.5]]);
  checkPathOk(g, [0.5, 1.5], [2.5, 1.5], p);
  const straight = shortestPath(g, [0.5, 0.5], [2.5, 0.5]); // row 0 is untouched
  assert.ok(straight);
  near(straight.length, 2);
  assert.equal(straight.points.length, 2);
});

test('a solid 2x2 block: around its rim, never across', () => {
  const g = mkGrid(4, 4, [[1, 1], [2, 1], [1, 2], [2, 2]]);
  const p = shortestPath(g, [0.5, 1.5], [3.5, 1.5]);
  assert.ok(p);
  near(p.length, 2 + Math.SQRT2);
  assert.deepEqual(rounded(p.points), [[0.5, 1.5], [1, 1], [3, 1], [3.5, 1.5]]);
  checkPathOk(g, [0.5, 1.5], [3.5, 1.5], p);
});

test('gliding along a wall is legal when one side is open', () => {
  const g = mkGrid(4, 4, [[1, 1], [2, 1]]);
  const p = shortestPath(g, [0.5, 1], [3.5, 1]); // straight, hugging the wall top
  assert.ok(p);
  near(p.length, 3);
  assert.equal(p.points.length, 2);
  checkPathOk(g, [0.5, 1], [3.5, 1], p);
});

test('the outside counts as blocked, yet outer boundary edges are walkable', () => {
  const g = mkGrid(4, 4, [[0, 1]]);
  const p = shortestPath(g, [0, 0.5], [0, 3.5]); // on the boundary line x = 0
  assert.ok(p);
  near(p.length, Math.hypot(1, 0.5) + 1 + Math.hypot(1, 1.5));
  assert.deepEqual(rounded(p.points), [[0, 0.5], [1, 1], [1, 2], [0, 3.5]]);
  checkPathOk(g, [0, 0.5], [0, 3.5], p);
});

test('endpoints on grid lines and vertices work', () => {
  const open: Grid = { w: 6, h: 4, blocked: () => false };
  const p = shortestPath(open, [2, 0.5], [5.5, 3]);
  assert.ok(p); near(p.length, Math.hypot(3.5, 2.5)); assert.equal(p.points.length, 2);
  const q = shortestPath(open, [1, 1], [5.5, 3]);
  assert.ok(q); near(q.length, Math.hypot(4.5, 2)); assert.equal(q.points.length, 2);
});

test('null: pockets, walls, and points outside the grid', () => {
  const pockets: Grid = { w: 5, h: 5, blocked: (x, y) => !(x === 0 && y === 0) && !(x === 4 && y === 4) };
  assert.equal(shortestPath(pockets, [0.5, 0.5], [4.5, 4.5]), null);
  assert.equal(shortestPath(pockets, [0.5, 0.5], [2.5, 2.5]), null); // target in a wall
  const open: Grid = { w: 4, h: 4, blocked: () => false };
  assert.equal(shortestPath(open, [-0.5, 1], [2, 2]), null); // outside
  assert.equal(shortestPath(open, [4.5, 1], [2, 2]), null); // outside
});

test('degenerate: from === to is a zero-length path', () => {
  const open: Grid = { w: 3, h: 3, blocked: () => false };
  const p = shortestPath(open, [1.5, 1.5], [1.5, 1.5]);
  assert.ok(p);
  assert.equal(p.length, 0);
  assert.deepEqual(p.points, [[1.5, 1.5]]);
  const blockedGrid: Grid = { w: 3, h: 3, blocked: (x, y) => x === 1 && y === 1 };
  assert.equal(shortestPath(blockedGrid, [1.5, 1.5], [1.5, 1.5]), null);
});

test('zigzag between two wall tips, touching four corners', () => {
  // Wall A: [3,4] x [0,4]; wall B: [6,7] x [2,6]. Pass over A, then under B.
  const cells: Array<readonly [number, number]> = [];
  for (let y = 0; y <= 3; y++) cells.push([3, y]);
  for (let y = 2; y <= 5; y++) cells.push([6, y]);
  const g = mkGrid(10, 6, cells);
  const p = shortestPath(g, [0.5, 3], [9.5, 3]);
  assert.ok(p);
  near(p.length, 2 * Math.hypot(2.5, 1) + Math.hypot(2, 2) + 2);
  assert.deepEqual(rounded(p.points), [[0.5, 3], [3, 4], [4, 4], [6, 2], [7, 2], [9.5, 3]]);
  checkPathOk(g, [0.5, 3], [9.5, 3], p);
});

test('a vertical two-column wall denies its middle seam', () => {
  const g: Grid = { w: 10, h: 10, blocked: (x, y) => (x === 4 || x === 5) && y >= 1 && y <= 8 };
  const p = shortestPath(g, [4.5, 0.5], [4.5, 9.5]);
  assert.ok(p);
  near(p.length, 8 + Math.SQRT2);
  assert.equal(p.points.length, 4);
  checkPathOk(g, [4.5, 0.5], [4.5, 9.5], p);
});

test('a path may start exactly at a blocked cell corner', () => {
  const thick: Grid = { w: 10, h: 10, blocked: (x, y) => (y === 4 || y === 5) && x >= 1 && x <= 8 };
  const p = shortestPath(thick, [1, 4], [9.5, 5]);
  assert.ok(p);
  near(p.length, 8 + Math.hypot(0.5, 1));
  assert.deepEqual(rounded(p.points), [[1, 4], [9, 4], [9.5, 5]]);
  checkPathOk(thick, [1, 4], [9.5, 5], p);
});

test('navigator precomputes: repeated queries share the graph', () => {
  const wall: Grid = { w: 10, h: 10, blocked: (x, y) => x === 5 && y <= 8 };
  const nav = navigator(wall);
  const a = nav.path([2.5, 0.5], [7.5, 0.5]);
  const b = shortestPath(wall, [2.5, 0.5], [7.5, 0.5]);
  const open = nav.path([0.5, 0.5], [4.5, 0.5]);
  assert.ok(a && b && open);
  assert.equal(a.length, b.length);
  assert.deepEqual(a.points, b.points);
  near(open.length, 4); // straight line, no detour
  assert.equal(open.points.length, 2);
});

test('random 16x16 mazes: deterministic, consistent, and every segment legal', () => {
  for (const seed of [7, 99, 2024]) {
    let s = seed;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const W = 16, H = 16;
    const cells = Array.from({ length: W * H }, () => rnd() < 0.3);
    for (let ch = true; ch;) { ch = false; for (let x = 0; x < W - 1; x++) for (let y = 0; y < H - 1; y++) {
      const a = cells[y * W + x], b = cells[y * W + x + 1], c = cells[(y + 1) * W + x], d = cells[(y + 1) * W + x + 1];
      if ((a && d && !b && !c) || (b && c && !a && !d)) { cells[y * W + x + (a ? 1 : 0)] = true; ch = true; } } }
    const g: Grid = { w: W, h: H, blocked: (x, y) => cells[y * W + x] === true };
    const free: [number, number][] = [];
    for (let i = 0; i < W * H; i++) if (!cells[i]) free.push([(i % W) + 0.5, Math.floor(i / W) + 0.5]);
    const nav1 = navigator(g), nav2 = navigator(g);
    for (let q = 0; q < 12; q++) {
      const from = free[(q * 5 + seed) % free.length]!;
      const to = free[(q * 11 + 3 * seed) % free.length]!;
      const p1 = nav1.path(from, to);
      const p2 = nav2.path(from, to);
      const p3 = shortestPath(g, from, to);
      if (p1 === null) {
        assert.equal(p2, null); assert.equal(p3, null);
        continue;
      }
      assert.ok(p2 && p3, 'all engines agree on reachability');
      assert.equal(p1.length, p2.length, 'same grid + same input => same length');
      assert.equal(p1.length, p3.length);
      assert.deepEqual(p1.points, p2.points, 'deterministic polyline');
      assert.deepEqual(p1.points, p3.points, 'navigator and shortestPath agree');
      checkPathOk(g, from, to, p1);
    }
  }
});
