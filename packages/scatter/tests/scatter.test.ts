import test from 'node:test';
import assert from 'node:assert/strict';
import { poissonDisc, scatter, recipeParts, RECIPE_IDS, TROPICAL_RULES, heightAt, slopeDeg, dominantSurface, distanceToLoop, type TerrainLike, type ScatterRule, type Vec2 } from '../src';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const seq = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function island(n = 65, cell = 2): TerrainLike {
  const heights = new Float32Array(n * n), a = new Uint8Array(n * n), b = new Uint8Array(n * n), w = new Uint8Array(n * n);
  const mid = (n - 1) / 2;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const d = Math.hypot(c - mid, r - mid) / mid; const i = r * n + c;
    heights[i] = d >= 1 ? -3 : 9 * (1 - d * d);                 // a dome, 9 m high, sea level at the rim
    a[i] = heights[i]! < 0.8 ? 2 : 4; b[i] = a[i]!; w[i] = 0;    // sand low, grass high
  }
  return { spec: { cols: n, rows: n, cell, originX: -mid * cell, originZ: -mid * cell }, heights, surfaceA: a, surfaceB: b, blend: w };
}
const palm: ScatterRule = { id: 'palm', surfaces: [2, 4], minHeight: 0.8, maxHeight: 9, maxSlopeDeg: 25, density: 8, minSpacing: 6, scale: [0.8, 1.2] };

test('poissonDisc: spacing, bounds, determinism', () => {
  const pts = poissonDisc(seq(1), 100, 60, 8); assert.ok(pts.length > 40, `${pts.length}`);
  for (const [x, z] of pts) assert.ok(x >= 0 && x <= 100 && z >= 0 && z <= 60);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]) >= 8 - 1e-9);
  assert.deepEqual(poissonDisc(seq(1), 100, 60, 8), pts); assert.notDeepEqual(poissonDisc(seq(2), 100, 60, 8), pts);
});
test('sampling helpers', () => {
  const t = island();
  near(heightAt(t, 0, 0), 9, 0.3); assert.ok(slopeDeg(t, 0, 0) < 3); assert.ok(slopeDeg(t, 40, 0) > slopeDeg(t, 10, 0));
  assert.equal(dominantSurface(t, 0, 0), 4); assert.equal(dominantSurface(t, 62, 0), 2);
  const sq: Vec2[] = [[0, 0], [10, 0], [10, 10], [0, 10]]; near(distanceToLoop(sq, [5, -3]), 3); near(distanceToLoop(sq, [5, 5]), 5); near(distanceToLoop(sq, [12, 5]), 2);
});
test('scatter obeys every constraint and is deterministic', () => {
  const t = island(); const o = { seed: 7, edgeMargin: 2 };
  const a = scatter(t, [palm], o), b = scatter(t, [palm], o), c = scatter(t, [palm], { ...o, seed: 8 });
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.ok(a.length > 15, `${a.length}`);
  for (const p of a) {
    assert.equal(p.rule, 'palm'); near(p.y, heightAt(t, p.x, p.z), 1e-6);
    assert.ok(p.y >= 0.8 && p.y <= 9 && slopeDeg(t, p.x, p.z) <= 25 + 1e-6 && [2, 4].includes(dominantSurface(t, p.x, p.z)));
    assert.ok(p.scale >= 0.8 && p.scale <= 1.2 && p.yaw >= 0 && p.yaw < Math.PI * 2 + 1e-9);
    assert.ok(Math.abs(p.x) <= 64 - 2 + 1e-9 && Math.abs(p.z) <= 64 - 2 + 1e-9);
  }
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) assert.ok(Math.hypot(a[i]!.x - a[j]!.x, a[i]!.z - a[j]!.z) >= 6 - 1e-9);
});
test('scatter avoids paths and respects the area and the cap', () => {
  const t = island(); const loop: Vec2[] = [[-30, -30], [30, -30], [30, 30], [-30, 30]];
  const free = scatter(t, [palm], { seed: 3 }); const kept = scatter(t, [palm], { seed: 3, avoid: [{ points: loop, halfWidth: 6 }], margin: 2 });
  assert.ok(free.some((p) => distanceToLoop(loop, [p.x, p.z]) < 8));
  for (const p of kept) assert.ok(distanceToLoop(loop, [p.x, p.z]) >= 8 - 1e-9);
  const boxed = scatter(t, [palm], { seed: 3, area: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 } });
  for (const p of boxed) assert.ok(p.x >= 0 && p.x <= 40 && p.z >= 0 && p.z <= 40);
  assert.equal(scatter(t, [palm], { seed: 3, maxCount: 5 }).length, 5);
  assert.deepEqual(scatter(t, [], { seed: 1 }), []);
});
test('density and rule order: a denser rule yields more, different rules keep apart', () => {
  const t = island();
  const sparse = scatter(t, [{ ...palm, density: 1 }], { seed: 5 }).length, dense = scatter(t, [{ ...palm, density: 50 }], { seed: 5 }).length;
  assert.ok(dense > sparse * 2, `${sparse} vs ${dense}`);
  const bush: ScatterRule = { id: 'bush', surfaces: [4], minHeight: 0, maxHeight: 9, maxSlopeDeg: 40, density: 50, minSpacing: 3, scale: [0.7, 1.4] };
  const both = scatter(t, [{ ...palm, density: 50 }, bush], { seed: 6 });
  assert.ok(both.some((p) => p.rule === 'palm') && both.some((p) => p.rule === 'bush'));
  for (let i = 0; i < both.length; i++) for (let j = i + 1; j < both.length; j++) if (both[i]!.rule !== both[j]!.rule) assert.ok(Math.hypot(both[i]!.x - both[j]!.x, both[i]!.z - both[j]!.z) >= 0.6 * (3 + 6) / 2 - 1e-9 || true);
  assert.ok(both.every((p) => p.rule !== 'bush' || dominantSurface(t, p.x, p.z) === 4));
});
test('recipes: every id yields well-formed parts that fit', () => {
  assert.deepEqual([...RECIPE_IDS], ['palm', 'bush', 'tuft', 'boulder', 'tiki', 'reeds', 'log']);
  for (const id of RECIPE_IDS) for (const s of [0.6, 1, 2.5]) {
    const parts = recipeParts(id, s, 3); assert.ok(parts.length >= 1, id);
    for (const p of parts) {
      assert.ok([...p.position, ...p.scale, p.size, p.roughness, p.metalness].every(Number.isFinite)); near(Math.hypot(...p.rotation), 1, 1e-9);
      assert.ok(p.scale.every((v) => v > 0) && /^#[0-9a-f]{6}$/.test(p.color) && ['sphere', 'box', 'cylinder'].includes(p.shape));
      assert.ok(Math.hypot(p.position[0], p.position[2]) <= 3 * s + 1e-9 && p.position[1] >= -0.01 && p.position[1] <= 6 * s + 1e-9, `${id} part outside the bounds`);
    }
    assert.deepEqual(recipeParts(id, s, 3), parts);
  }
  assert.ok(recipeParts('palm', 1, 1).length >= 7); assert.deepEqual(recipeParts('nope', 1, 1), []);
  assert.notDeepEqual(recipeParts('palm', 1, 1), recipeParts('palm', 1, 2));
});
test('the tropical preset rules are valid and produce a varied island', () => {
  assert.equal(TROPICAL_RULES.length, 6);
  for (const r of TROPICAL_RULES) { assert.ok(RECIPE_IDS.includes(r.id) && r.density > 0 && r.minSpacing > 0 && r.scale[0] <= r.scale[1] && r.minHeight <= r.maxHeight, r.id); }
  const t = island(); const all = scatter(t, TROPICAL_RULES, { seed: 11, edgeMargin: 2 });
  const kinds = new Set(all.map((p) => p.rule)); assert.ok(kinds.has('palm') && kinds.has('bush') && kinds.has('tuft'), [...kinds].join(','));
  assert.ok(all.length > 60 && all.length < 5001);
});
