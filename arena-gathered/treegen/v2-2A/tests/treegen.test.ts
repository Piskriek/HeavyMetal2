import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUDGET, growTree, type Branch, type Species } from '../src/index';

const SPECIES: Species[] = ['pine', 'oak', 'birch'];
const tris = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const ys = (g: THREE.BufferGeometry): number[] => { const p = g.getAttribute('position'); return Array.from({ length: p.count }, (_, i) => p.getY(i)); };
const max = (a: number[]): number => a.reduce((m, v) => Math.max(m, v), -Infinity);
const min = (a: number[]): number => a.reduce((m, v) => Math.min(m, v), Infinity);

test('the same seed grows the same tree; another seed grows another', () => {
  const a = growTree({ species: 'oak', seed: 7, height: 12, detail: 2 });
  const b = growTree({ species: 'oak', seed: 7, height: 12, detail: 2 });
  const c = growTree({ species: 'oak', seed: 8, height: 12, detail: 2 });
  const pos = (g: THREE.BufferGeometry): number[] => { const p = g.getAttribute('position'); return Array.from({ length: p.count * 3 }, (_, i) => p.getComponent(Math.floor(i / 3), i % 3)); };
  assert.deepEqual(pos(a.bark), pos(b.bark));
  assert.deepEqual(a.branches, b.branches);
  assert.notDeepEqual(a.branches, c.branches);
});

test('one trunk on the ground, and every branch grows from the end of its parent', () => {
  for (const species of SPECIES) {
    const t = growTree({ species, seed: 3, height: 10, detail: 3 });
    const byId = new Map(t.branches.map((b) => [b.id, b] as const));
    assert.equal(byId.size, t.branches.length);
    const roots = t.branches.filter((b) => b.parent === null);
    assert.equal(roots.length, 1);
    assert.ok(roots[0]!.start.every((v) => Math.abs(v) < 1e-9));
    const seen = new Set<number>();
    for (const b of t.branches) {
      if (b.parent !== null) {
        assert.ok(seen.has(b.parent), `branch ${b.id} comes before its parent`);
        const p = byId.get(b.parent)!;
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(b.start[k]! - p.end[k]!) < 1e-9, `branch ${b.id} floats`);
        assert.ok(b.r0 <= p.r0 + 1e-9, `branch ${b.id} is thicker than its parent`);
      }
      assert.ok(b.r0 >= b.r1 && b.r1 > 0, `branch ${b.id} does not taper`);
      seen.add(b.id);
    }
    assert.ok(t.branches.length >= 20, `${species}: only ${t.branches.length} branches`);
  }
});

test('the detail levels draw the same skeleton, so swapping them never moves a branch', () => {
  const ladder = ([0, 1, 2, 3] as const).map((detail) => growTree({ species: 'birch', seed: 11, height: 14, detail }));
  for (const t of ladder) assert.deepEqual(t.branches, ladder[0]!.branches);
});

test('every detail level keeps to its triangle budget, and each level is richer than the one before', () => {
  for (const species of SPECIES) {
    let before = 0;
    for (const detail of [0, 1, 2, 3] as const) {
      const t = growTree({ species, seed: 5, height: 12, detail });
      const n = tris(t.bark) + tris(t.leaves);
      assert.equal(t.triangles, n);
      assert.ok(n <= BUDGET[detail], `${species} detail ${detail}: ${n} triangles`);
      assert.ok(n > before, `${species} detail ${detail} is not richer`);
      before = n;
    }
  }
});

test('detail 0 is chunky and flat shaded, as stage 1 draws it', () => {
  const t = growTree({ species: 'oak', seed: 1, height: 10, detail: 0 });
  for (const g of [t.bark, t.leaves]) {
    assert.equal(g.index, null);
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i += 3) for (const k of [1, 2]) {
      assert.ok(Math.abs(n.getX(i) - n.getX(i + k)) + Math.abs(n.getY(i) - n.getY(i + k)) + Math.abs(n.getZ(i) - n.getZ(i + k)) < 1e-6, `triangle ${i / 3} is smooth`);
    }
  }
});

test('trees stand on the ground and reach the height asked for', () => {
  for (const species of SPECIES) for (const height of [6, 15]) {
    const t = growTree({ species, seed: 2, height, detail: 2 });
    const top = max([...ys(t.bark), ...ys(t.leaves)]), bottom = min(ys(t.bark));
    assert.ok(top >= height * 0.85 && top <= height * 1.15, `${species} asked ${height} m, grew ${top}`);
    assert.ok(bottom >= -0.05 && bottom <= 0.05, `${species} trunk base at ${bottom}`);
    assert.ok(t.radius > 0 && Math.abs(t.height - top) < 1e-6);
  }
});

test('bark and leaves carry positions, unit normals and UVs, with no NaN', () => {
  const t = growTree({ species: 'oak', seed: 9, height: 11, detail: 3 });
  for (const g of [t.bark, t.leaves]) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv');
    assert.ok(p && n && uv);
    assert.equal(n.count, p.count);
    assert.equal(uv.count, p.count);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-3);
      assert.ok(Number.isFinite(uv.getX(i) + uv.getY(i)));
    }
  }
  const uv = t.leaves.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1);
});

test('species keep their shape: pines and birches are narrow, oaks are wide', () => {
  const shape = (species: Species): number => { const t = growTree({ species, seed: 4, height: 12, detail: 2 }); return t.radius / t.height; };
  assert.ok(shape('pine') < shape('oak'));
  assert.ok(shape('birch') < shape('oak'));
});

test('limbs grow, they do not curl: along one limb each segment turns under 35 degrees, the whole limb under 120', () => {
  const dir = (b: Branch): readonly [number, number, number] => {
    const d = [b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]] as const;
    const n = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / n, d[1] / n, d[2] / n];
  };
  for (const species of SPECIES) {
    const t = growTree({ species, seed: 6, height: 12, detail: 3 });
    const byId = new Map(t.branches.map((b) => [b.id, b] as const));
    const turned = new Map<number, number>();
    for (const b of t.branches) {
      const p = b.parent === null ? undefined : byId.get(b.parent);
      if (!p || p.order !== b.order) { turned.set(b.id, 0); continue; }
      const a = dir(p), c = dir(b);
      const angle = Math.acos(Math.min(1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
      assert.ok(angle < (35 * Math.PI) / 180, `${species}: segment ${b.id} turns ${((angle * 180) / Math.PI).toFixed(0)} degrees`);
      const total = (turned.get(p.id) ?? 0) + angle;
      assert.ok(total < (120 * Math.PI) / 180, `${species}: the limb through ${b.id} has turned ${((total * 180) / Math.PI).toFixed(0)} degrees`);
      turned.set(b.id, total);
    }
    assert.ok(t.branches.some((b) => b.order >= 2), `${species}: no branches of order 2`);
  }
});

test('crowns are full and come down the tree: leaves are a third of the triangles and start below 60% of the height', () => {
  for (const species of SPECIES) {
    const t = growTree({ species, seed: 8, height: 12, detail: 3 });
    assert.ok(tris(t.leaves) >= t.triangles / 3, `${species}: ${tris(t.leaves)} of ${t.triangles} triangles are leaves`);
    assert.ok(min(ys(t.leaves)) <= t.height * 0.6, `${species}: the crown starts at ${min(ys(t.leaves)).toFixed(1)} of ${t.height.toFixed(1)} m`);
  }
});

test('performance: twenty full-detail trees grow in under two seconds', () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) growTree({ species: SPECIES[i % 3]!, seed: i, height: 8 + (i % 7), detail: 3 });
  assert.ok(performance.now() - t0 < 2000, `${performance.now() - t0} ms`);
});

/* ──────────────────────────── our own tests below ──────────────────────────── */

const xs = (g: THREE.BufferGeometry): number[] => { const p = g.getAttribute('position'); return Array.from({ length: p.count }, (_, i) => Math.hypot(p.getX(i), p.getZ(i))); };
const DETAILS = [0, 1, 2, 3] as const;

test('the budget ladder is the one the game ships with', () => {
  assert.deepEqual([...BUDGET], [400, 2000, 8000, 24000]);
});

test('nothing is indexed: every level hands the game plain triangle soup', () => {
  for (const species of SPECIES) for (const detail of DETAILS) {
    const t = growTree({ species, seed: 12, height: 9, detail });
    for (const g of [t.bark, t.leaves]) {
      assert.equal(g.index, null);
      assert.equal(g.getAttribute('position').count % 3, 0, `${species}/${detail}: dangling vertices`);
    }
  }
});

test('the skeleton is the species and the seed, never the detail level', () => {
  for (const species of SPECIES) {
    const ladder = DETAILS.map((detail) => growTree({ species, seed: 21, height: 13, detail }));
    for (const t of ladder) assert.deepEqual(t.branches, ladder[0]!.branches);
    /* and the wood really is drawn at every level, coarse to fine */
    const barks = ladder.map((t) => tris(t.bark));
    for (const n of barks) assert.ok(n > 0);
    assert.ok(barks[0]! < barks[3]!, `${species}: detail 0 bark is not chunkier`);
  }
});

test('the pipe model holds: wood only ever thickens on the way down', () => {
  for (const species of SPECIES) {
    const t = growTree({ species, seed: 13, height: 12, detail: 3 });
    const byId = new Map(t.branches.map((b) => [b.id, b] as const));
    const root = t.branches.find((b) => b.parent === null)!;
    let thickest = 0;
    const kids = new Map<number, number>();
    for (const b of t.branches) {
      thickest = Math.max(thickest, b.r0);
      if (b.parent === null) continue;
      const p = byId.get(b.parent)!;
      assert.ok(b.r1 <= p.r1 + 1e-12, `branch ${b.id} is fatter at its tip than its parent is`);
      assert.ok(b.r0 <= p.r0 + 1e-12);
      kids.set(b.parent, (kids.get(b.parent) ?? 0) + 1);
    }
    assert.ok(Math.abs(root.r0 - thickest) < 1e-12, `${species}: the trunk base is not the thickest wood`);
    assert.ok(root.r0 > t.height * 0.002 && root.r0 < t.height * 0.1, `${species}: trunk radius ${root.r0} for ${t.height} m`);
    /* a fork always thins the wood that carries it */
    for (const [id, n] of kids) if (n > 1) {
      const parent = byId.get(id)!;
      for (const c of t.branches) if (c.parent === id) assert.ok(c.r1 < parent.r1, `fork at ${id} does not thin`);
    }
    assert.ok([...kids.values()].some((n) => n > 1), `${species}: nothing forks`);
  }
});

test('orders are grown, not invented: a segment either carries its limb on or starts a new one', () => {
  for (const species of SPECIES) {
    const t = growTree({ species, seed: 14, height: 10, detail: 3 });
    const byId = new Map(t.branches.map((b) => [b.id, b] as const));
    const orders = new Set<number>();
    for (const b of t.branches) {
      orders.add(b.order);
      if (b.parent === null) { assert.equal(b.order, 0); continue; }
      const p = byId.get(b.parent)!;
      assert.ok(b.order === p.order || b.order === p.order + 1, `branch ${b.id} jumps order`);
    }
    assert.ok(orders.has(0) && orders.has(1) && orders.has(2), `${species}: orders ${[...orders].join()}`);
    /* one limb, one continuation: no node sprouts two segments of its own order */
    const carried = new Set<number>();
    for (const b of t.branches) {
      if (b.parent === null) continue;
      const p = byId.get(b.parent)!;
      if (b.order !== p.order) continue;
      assert.ok(!carried.has(p.id), `branch ${p.id} carries on twice`);
      carried.add(p.id);
    }
  }
});

test('bark UVs wrap around in u and run along the limb in metres', () => {
  const t = growTree({ species: 'oak', seed: 15, height: 12, detail: 3 });
  const uv = t.bark.getAttribute('uv');
  let maxV = 0;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    assert.ok(u >= -1e-6 && u <= 1 + 1e-6, `u out of range: ${u}`);
    assert.ok(v >= -1e-6 && v <= t.height * 8, `v out of range: ${v}`);
    maxV = Math.max(maxV, v);
  }
  assert.ok(maxV > t.height * 0.5, 'v does not run up the tree');
});

test('every leaf card is a quad that maps the whole leaf texture', () => {
  const t = growTree({ species: 'birch', seed: 16, height: 11, detail: 3 });
  const p = t.leaves.getAttribute('position'), uv = t.leaves.getAttribute('uv');
  assert.equal(p.count % 6, 0, 'leaves are not whole quads');
  assert.ok(p.count > 0);
  const want = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
  for (let i = 0; i < p.count; i += 6) {
    for (let k = 0; k < 6; k++) {
      assert.equal(uv.getX(i + k), want[k]![0]);
      assert.equal(uv.getY(i + k), want[k]![1]);
    }
    /* the two triangles of a card share a plane and a size */
    const area = (a: number, b: number, c: number): number => {
      const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a);
      const vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a);
      return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    };
    const a0 = area(i, i + 1, i + 2), a1 = area(i + 3, i + 4, i + 5);
    assert.ok(a0 > 0 && Math.abs(a0 - a1) < a0 * 1e-2, 'card halves do not match');
  }
});

test('only stage 1 is faceted: finer tubes are smooth around the ring', () => {
  const t = growTree({ species: 'pine', seed: 17, height: 12, detail: 3 });
  const n = t.bark.getAttribute('normal');
  let smooth = 0;
  for (let i = 0; i < n.count; i += 3) {
    const d = Math.abs(n.getX(i) - n.getX(i + 1)) + Math.abs(n.getY(i) - n.getY(i + 1)) + Math.abs(n.getZ(i) - n.getZ(i + 1));
    if (d > 1e-5) smooth++;
  }
  assert.ok(smooth > n.count / 6, 'detail 3 bark is flat shaded');
});

test('a tree is the same tree at any size: height only scales it', () => {
  for (const species of SPECIES) {
    const a = growTree({ species, seed: 18, height: 6, detail: 3 });
    const b = growTree({ species, seed: 18, height: 18, detail: 3 });
    assert.equal(a.branches.length, b.branches.length);
    assert.ok(Math.abs(a.radius / a.height - b.radius / b.height) < 1e-3, `${species}: shape drifts with height`);
    assert.ok(Math.abs(b.height / a.height - 3) < 0.02, `${species}: ${a.height} m vs ${b.height} m`);
    assert.equal(a.triangles, b.triangles);
  }
});

test('the trunk stands exactly on the ground at every level', () => {
  for (const species of SPECIES) for (const detail of DETAILS) {
    const t = growTree({ species, seed: 19, height: 10, detail });
    assert.ok(Math.abs(min(ys(t.bark))) < 1e-6, `${species}/${detail}: base at ${min(ys(t.bark))}`);
  }
});

test('crowns are clouds, not balls on poles, at every level that has cards', () => {
  for (const species of SPECIES) for (const detail of [1, 2, 3] as const) {
    const t = growTree({ species, seed: 20, height: 12, detail });
    const low = min(ys(t.leaves));
    assert.ok(low <= t.height * 0.7, `${species}/${detail}: crown starts at ${low.toFixed(1)} m`);
    assert.ok(tris(t.leaves) > 0);
  }
});

test('a pine is a cone: it is widest low down and narrows to the apex', () => {
  const t = growTree({ species: 'pine', seed: 22, height: 12, detail: 3 });
  const p = t.leaves.getAttribute('position');
  const r = xs(t.leaves), y = ys(t.leaves);
  let lowWide = 0, highWide = 0;
  for (let i = 0; i < p.count; i++) {
    const yi = y[i]!, ri = r[i]!;
    if (yi < t.height * 0.5) lowWide = Math.max(lowWide, ri);
    if (yi > t.height * 0.85) highWide = Math.max(highWide, ri);
  }
  assert.ok(highWide < lowWide * 0.8, `pine apex ${highWide.toFixed(2)} m against skirt ${lowWide.toFixed(2)} m`);
});

test('an oak spreads wider than it is tall is not required, but it is wide and domed', () => {
  const oak = growTree({ species: 'oak', seed: 23, height: 12, detail: 3 });
  assert.ok(oak.radius > oak.height * 0.25, `oak crown radius ${oak.radius.toFixed(1)} m`);
  const birch = growTree({ species: 'birch', seed: 23, height: 12, detail: 3 });
  assert.ok(birch.radius < birch.height * 0.5, `birch crown radius ${birch.radius.toFixed(1)} m`);
});

test('growing a whole stage of forest stays inside a frame budget', () => {
  const t0 = performance.now();
  let tr = 0;
  for (let i = 0; i < 60; i++) {
    const t = growTree({ species: SPECIES[i % 3]!, seed: i * 3 + 1, height: 5 + (i % 11), detail: (i % 4) as 0 | 1 | 2 | 3 });
    tr += t.triangles;
  }
  const ms = performance.now() - t0;
  assert.ok(tr > 0);
  assert.ok(ms < 4000, `${ms} ms for sixty trees`);
});
