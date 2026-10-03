import test from 'node:test';
import assert from 'node:assert/strict';
import { TROPICAL_RULES, distanceToLoop, dominantSurface, scatter, type Placement, type ScatterRule, type Vec2 } from '../src';
import { flat, island } from './helpers';

const palm: ScatterRule = { id: 'palm', surfaces: [2, 4], minHeight: 0.8, maxHeight: 9, maxSlopeDeg: 25, density: 8, minSpacing: 6, scale: [0.8, 1.2] };
const bush: ScatterRule = { id: 'bush', surfaces: [4], minHeight: 0, maxHeight: 9, maxSlopeDeg: 40, density: 50, minSpacing: 3, scale: [0.7, 1.4] };
const dist = (a: Placement, b: Placement): number => Math.hypot(a.x - b.x, a.z - b.z);

test('maxCount of 0 (or negative) returns nothing; Infinity removes the cap', () => {
  const t = island();
  assert.deepEqual(scatter(t, [palm], { seed: 1, maxCount: 0 }), []);
  assert.deepEqual(scatter(t, [palm], { seed: 1, maxCount: -4 }), []);
  assert.ok(scatter(t, [palm], { seed: 1, maxCount: Infinity }).length > 15);
});

test('an all-water terrain gets nothing, whatever the rules', () => {
  const sea = flat(33, 2, -5, 1);
  assert.deepEqual(scatter(sea, [palm, bush], { seed: 1 }), []);
  assert.deepEqual(scatter(sea, TROPICAL_RULES, { seed: 1 }), []);
});

test('a slope limit of 0 rejects a dome; tightening a filter only removes instances', () => {
  const t = island();
  assert.deepEqual(scatter(t, [{ ...palm, maxSlopeDeg: 0, density: 50 }], { seed: 2 }), []);
  const wide = scatter(t, [palm], { seed: 4 });
  const narrow = scatter(t, [{ ...palm, minHeight: 3 }], { seed: 4 });
  assert.ok(narrow.length > 0 && narrow.length < wide.length, `${narrow.length} vs ${wide.length}`);
  for (const p of narrow) assert.ok(wide.some((q) => q.x === p.x && q.z === p.z && q.yaw === p.yaw && q.scale === p.scale));
});

test('a rule with empty surfaces accepts every surface', () => {
  const t = island();
  const any: ScatterRule = { id: 'tuft', surfaces: [], minHeight: -10, maxHeight: 100, maxSlopeDeg: 90, density: 50, minSpacing: 6, scale: [1, 1] };
  const out = scatter(t, [any], { seed: 9 });
  const seen = [...new Set(out.map((p) => dominantSurface(t, p.x, p.z)))].sort();
  assert.deepEqual(seen, [2, 4]);
  assert.ok(out.every((p) => p.scale === 1)); // a degenerate scale range is allowed
  assert.ok(scatter(t, [{ ...any, surfaces: [4] }], { seed: 9 }).length < out.length);
});

test('reproducible across many seeds, and every seed gives a different layout', () => {
  const t = island();
  const layouts = new Set<string>();
  for (let seed = 0; seed < 20; seed++) {
    const a = scatter(t, TROPICAL_RULES, { seed, edgeMargin: 2 });
    assert.deepEqual(scatter(t, TROPICAL_RULES, { seed, edgeMargin: 2 }), a);
    assert.ok(a.length > 0 && a.every((p) => Number.isFinite(p.x + p.y + p.z + p.yaw + p.scale)));
    layouts.add(JSON.stringify(a));
  }
  assert.equal(layouts.size, 20);
});

test('clusterRadius makes groves tighter than the same rule without it', () => {
  const nearestSum = (ps: readonly Placement[]): number => {
    let sum = 0;
    for (const p of ps) {
      let best = Infinity;
      for (const q of ps) if (q !== p) best = Math.min(best, dist(p, q));
      if (best < Infinity) sum += best;
    }
    return sum;
  };
  const t = island();
  const plain: ScatterRule = { ...palm, density: 4 };
  const grove: ScatterRule = { ...plain, clusterRadius: 15 };
  let plainSum = 0, plainN = 0, groveSum = 0, groveN = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const a = scatter(t, [plain], { seed });
    const b = scatter(t, [grove], { seed });
    plainSum += nearestSum(a); plainN += a.length;
    groveSum += nearestSum(b); groveN += b.length;
  }
  assert.ok(plainN > 100 && groveN > 100, `${plainN} / ${groveN}`);
  assert.ok(groveSum / groveN < plainSum / plainN, `grove ${groveSum / groveN} vs plain ${plainSum / plainN}`);
});

test('spacing: same rule keeps its own spacing, different rules keep 0.6 x the mean spacing (strict)', () => {
  const t = island();
  const spacing: Record<string, number> = { palm: 6, bush: 3 };
  const out = scatter(t, [{ ...palm, density: 50 }, bush], { seed: 6 });
  assert.ok(out.some((p) => p.rule === 'palm') && out.some((p) => p.rule === 'bush'));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      const need = a.rule === b.rule ? spacing[a.rule]! : (0.6 * (spacing[a.rule]! + spacing[b.rule]!)) / 2;
      assert.ok(dist(a, b) >= need - 1e-9, `${a.rule}/${b.rule} ${dist(a, b)} < ${need}`);
    }
  }
});

test('earlier rules are unaffected by later ones', () => {
  const t = island();
  const alone = scatter(t, [palm], { seed: 6 });
  const mixed = scatter(t, [palm, bush], { seed: 6 }).filter((p) => p.rule === 'palm');
  assert.deepEqual(mixed, alone);
});

test('edge margin and area clipping, including empty and inverted areas', () => {
  const t = island();
  const dense = { ...palm, density: 50 };
  const inset = scatter(t, [dense], { seed: 1, edgeMargin: 20 });
  assert.ok(inset.length > 5 && inset.every((p) => Math.abs(p.x) <= 44 + 1e-9 && Math.abs(p.z) <= 44 + 1e-9));
  assert.deepEqual(scatter(t, [palm], { seed: 1, edgeMargin: 100 }), []);
  assert.deepEqual(scatter(t, [palm], { seed: 1, area: { minX: 500, minZ: 500, maxX: 600, maxZ: 600 } }), []);
  assert.deepEqual(scatter(t, [palm], { seed: 1, area: { minX: 10, minZ: 0, maxX: -10, maxZ: 40 } }), []);
});

test('avoid: default margin is 2, margin 0 is honoured, empty paths are ignored', () => {
  const t = island();
  const loop: Vec2[] = [[-30, -30], [30, -30], [30, 30], [-30, 30]];
  const rule = { ...palm, density: 50 };
  const avoid = [{ points: loop, halfWidth: 3 }];
  const byDefault = scatter(t, [rule], { seed: 2, avoid });
  const tight = scatter(t, [rule], { seed: 2, avoid, margin: 0 });
  assert.ok(byDefault.length > 0 && byDefault.every((p) => distanceToLoop(loop, [p.x, p.z]) >= 5 - 1e-9));
  assert.ok(tight.every((p) => distanceToLoop(loop, [p.x, p.z]) >= 3 - 1e-9));
  assert.ok(tight.some((p) => distanceToLoop(loop, [p.x, p.z]) < 5));
  assert.deepEqual(scatter(t, [rule], { seed: 2, avoid: [{ points: [], halfWidth: 50 }] }), scatter(t, [rule], { seed: 2 }));
});

test('tropical preset: spec values, valid surface ids, and reeds find a wet shore', () => {
  assert.deepEqual(TROPICAL_RULES.map((r) => r.id), ['palm', 'bush', 'tuft', 'boulder', 'reeds', 'tiki']);
  const palmRule = TROPICAL_RULES[0]!;
  assert.deepEqual([...palmRule.surfaces].sort((a, b) => a - b), [2, 4, 8]);
  assert.deepEqual([palmRule.density, palmRule.minSpacing, palmRule.clump, palmRule.minHeight, palmRule.maxHeight], [34, 4.2, { size: 38, cover: 0.25 }, 0.8, 9]);
  for (const r of TROPICAL_RULES) assert.ok(r.surfaces.every((s) => s >= 1 && s <= 16), r.id);
  const shore = scatter(flat(65, 2, 0.5, 3), TROPICAL_RULES, { seed: 3 }); // wet sand, 0.5 m, flat: only reeds fit
  assert.ok(shore.length > 10 && shore.every((p) => p.rule === 'reeds'), `${shore.length}`);
});
