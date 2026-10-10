// Hidden landing suite for @hm/navpath (scout battle, not sent). An exact oracle: the shortest path among the blocked
// cells bends only at convex corners, so Dijkstra over the visibility graph of {from, to, convex corners} is optimal.
import test from 'node:test'; import assert from 'node:assert/strict';
import { shortestPath, type Grid } from '../src/index';

type P = readonly [number, number];
const EPS = 1e-9;
const isBlocked = (g: Grid, x: number, y: number): boolean => x < 0 || y < 0 || x >= g.w || y >= g.h || g.blocked(x, y);

/** Whether segment a-b crosses the open interior of cell (x, y). */
function crossesOpen(a: P, b: P, x: number, y: number): boolean {
  let t0 = 0, t1 = 1;
  for (const [s, e, lo, hi] of [[a[0], b[0], x, x + 1], [a[1], b[1], y, y + 1]] as const) {
    const d = e - s;
    if (Math.abs(d) < EPS) { if (!(s > lo + EPS && s < hi - EPS)) return false; continue; }
    const u = (lo - s) / d, v = (hi - s) / d;
    t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
  }
  return t1 - t0 > EPS;
}

/** The brief's rule: no crossing a blocked cell's interior, no running along an edge with blocked cells on both sides. */
export function segOk(g: Grid, a: P, b: P): boolean {
  for (const axis of [0, 1] as const) {
    const o = 1 - axis;
    if (Math.abs(a[o] - b[o]) < EPS && Math.abs(a[o] - Math.round(a[o])) < EPS) {
      const line = Math.round(a[o]), lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
      for (let c = Math.floor(lo); c < Math.ceil(hi); c++) {
        if (Math.min(hi, c + 1) - Math.max(lo, c) <= EPS) continue;
        const side1 = axis === 0 ? isBlocked(g, c, line) : isBlocked(g, line, c), side2 = axis === 0 ? isBlocked(g, c, line - 1) : isBlocked(g, line - 1, c);
        if (side1 && side2) return false;
      }
      return true;
    }
  }
  for (let x = Math.floor(Math.min(a[0], b[0])); x < Math.ceil(Math.max(a[0], b[0])); x++)
    for (let y = Math.floor(Math.min(a[1], b[1])); y < Math.ceil(Math.max(a[1], b[1])); y++)
      if (isBlocked(g, x, y) && crossesOpen(a, b, x, y)) return false;
  return true;
}

function oracle(g: Grid, from: P, to: P): number {
  const nodes: P[] = [from, to];
  for (let x = 0; x <= g.w; x++) for (let y = 0; y <= g.h; y++) {
    const n = [isBlocked(g, x - 1, y - 1), isBlocked(g, x, y - 1), isBlocked(g, x - 1, y), isBlocked(g, x, y)].filter(Boolean).length;
    if (n === 1) nodes.push([x, y]);
  }
  const dist = nodes.map(() => Infinity), done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0) return Infinity;
    if (u === 1) return dist[1]!;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v]) continue;
      const a = nodes[u]!, b = nodes[v]!, d = dist[u]! + Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < dist[v]! - 1e-12 && segOk(g, a, b)) dist[v] = d;
    }
  }
}

/** A seeded grid with no diagonal pinches (the brief promises none). */
function grid(seed: number, w: number, h: number, fill: number): Grid {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cells = Array.from({ length: w * h }, () => rnd() < fill);
  const at = (x: number, y: number) => cells[y * w + x]!;
  for (let changed = true; changed;) {
    changed = false;
    for (let x = 0; x + 1 < w; x++) for (let y = 0; y + 1 < h; y++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      if ((a && d && !b && !c) || (b && c && !a && !d)) { cells[y * w + x + (a ? 1 : 0)] = true; changed = true; }
    }
  }
  return { w, h, blocked: (x, y) => cells[y * w + x] === true };
}

test('optimal against the visibility-graph oracle on 40 random grids, every path valid', () => {
  let checked = 0, unreachable = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = grid(seed * 7919, 16, 16, 0.3);
    const free: P[] = [];
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (!g.blocked(x, y)) free.push([x + 0.5, y + 0.5]);
    for (let q = 0; q < 3; q++) {
      const from = free[(seed * 31 + q * 97) % free.length]!, to = free[(seed * 53 + q * 61 + 7) % free.length]!;
      const best = oracle(g, from, to), got = shortestPath(g, from, to);
      if (best === Infinity) { assert.equal(got, null, `seed ${seed} q ${q}: unreachable`); unreachable++; continue; }
      assert.ok(got, `seed ${seed} q ${q}: no path, oracle ${best}`);
      assert.ok(Math.abs(got.length - best) < 1e-6, `seed ${seed} q ${q}: ${got.length} vs optimal ${best}`);
      const pts = got.points; let sum = 0;
      assert.ok(Math.hypot(pts[0]![0] - from[0], pts[0]![1] - from[1]) < 1e-9 && Math.hypot(pts[pts.length - 1]![0] - to[0], pts[pts.length - 1]![1] - to[1]) < 1e-9);
      for (let i = 1; i < pts.length; i++) { assert.ok(segOk(g, pts[i - 1]!, pts[i]!), `seed ${seed} q ${q}: segment ${i} cuts a wall`); sum += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]); }
      assert.ok(Math.abs(sum - got.length) < 1e-6, 'length is the sum of its segments');
      checked++;
    }
  }
  assert.ok(checked > 60 && unreachable >= 0);
});

test('same answer every time (deterministic)', () => {
  const g = grid(4242, 24, 24, 0.28);
  const a = shortestPath(g, [0.5, 0.5], [23.5, 23.5]), b = shortestPath(g, [0.5, 0.5], [23.5, 23.5]);
  assert.deepEqual(a, b);
});
