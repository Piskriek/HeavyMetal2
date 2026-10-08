import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUDGET, growTree, type Species } from '../src/index';

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

test('performance: twenty full-detail trees grow in under two seconds', () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) growTree({ species: SPECIES[i % 3]!, seed: i, height: 8 + (i % 7), detail: 3 });
  assert.ok(performance.now() - t0 < 2000, `${performance.now() - t0} ms`);
});
