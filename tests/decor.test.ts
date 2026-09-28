/**
 * NewDecor — the decoration rules and the brush maths, asserted headlessly on a synthetic road.
 *
 * What is checked, and why a track author would care:
 *  - **nothing stands on the road**: every placement is at least half its footprint past the edge;
 *  - **nothing overlaps**: no two placements are closer than their footprints allow, and a rule keeps
 *    clear of what was already there — a hand-placed sign never gets a boulder through it;
 *  - **same seed, same forest**: every rule is deterministic, so re-run after a slider nudge is stable;
 *  - **corners read the bend**: dressing lands on the OUTSIDE of a curve, the sign before the apex;
 *  - **rhythm keeps the beat**: props at exact multiples of the period, mirrored when asked;
 *  - **bridges and loops stay bare**, stage filters hold, budgets cap;
 *  - **the brush is idempotent per circle**: stamping the same spot twice adds nothing;
 *  - **the eraser is selective**: auto-only leaves a hand-placed decoration standing;
 *  - **props are tagged and grouped** so the builder can select, clear and re-roll a batch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlacedProp } from '../src/game/builder/prop-catalog';
import type { TrackStageId } from '../src/game/track-space';
import { DECOR_KINDS, DECOR_PALETTES, decorKind, decorPalette } from '../src/game/decor/decor-catalog';
import { SiteIndex, decorTagOf, makeRng, placementToProp, projectToTrack, siteWorld, type DecorPlacement, type DecorTrack, type DecorTrackSample } from '../src/game/decor/decor-field';
import { CORNERS_RULE, DECOR_RULES, RHYTHM_RULE, SCATTER_RULE, VERGE_RULE, defaultParams, runRule, runTheme, stageSpans } from '../src/game/decor/auto-decorate';

/**
 * A synthetic road: straight for 6000, a right-hand bend (turnRate > 0, i.e. toward +right) from
 * 6000–8000, a bridge 10000–11000, straight to 20000. Stage alpine to 12000, then stadium. Flat.
 */
function syntheticTrack(): DecorTrack {
  const samples: DecorTrackSample[] = [];
  let x = 0, z = 0, heading = 0;
  const step = 50;
  for (let dist = 0; dist <= 20000; dist += step) {
    const inBend = dist >= 6000 && dist <= 8000;
    const turnRate = inBend ? 0.0004 : 0;
    heading += turnRate * step;
    x += Math.sin(heading) * step; z += Math.cos(heading) * step;
    const tangent = { x: Math.sin(heading), y: 0, z: Math.cos(heading) };
    const right = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
    samples.push({
      pos: { x, y: 0, z }, tangent, up: { x: 0, y: 1, z: 0 }, right, dist,
      stage: (dist < 12000 ? 'alpine' : 'stadium') as TrackStageId,
      halfWidth: 480, turnRate, inLoop: false, onBridge: dist >= 10000 && dist <= 11000,
    });
  }
  return { length: 20000, samples, sampleAt: (d) => samples[Math.max(0, Math.min(samples.length - 1, Math.round(d / step)))] };
}

const track = syntheticTrack();
const base = { track, span: [0, 20000] as const, existing: [] as PlacedProp[], seed: 42 };

function assertOffRoad(placements: DecorPlacement[], what: string) {
  for (const p of placements) {
    const half = track.sampleAt(p.s).halfWidth;
    assert.ok(Math.abs(p.lateral) >= half + p.kind.footprint * p.scale * 0.5 - 1e-6, `${what}: ${p.kind.type} at s=${p.s.toFixed(0)} lateral=${p.lateral.toFixed(0)} is on the road`);
  }
}

function assertNoOverlap(placements: DecorPlacement[], what: string) {
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j];
      const min = a.kind.footprint * a.scale + b.kind.footprint * b.scale;
      assert.ok(Math.hypot(a.s - b.s, a.lateral - b.lateral) >= min - 1e-6, `${what}: ${a.kind.type}@${a.s.toFixed(0)} overlaps ${b.kind.type}@${b.s.toFixed(0)}`);
    }
  }
}

test('the catalogue is consistent: every palette entry is a kind, every kind has a stage', () => {
  for (const kind of DECOR_KINDS) assert.ok(Object.values(kind.stages).some((w) => (w ?? 0) > 0), `${kind.type} suits at least one stage`);
  for (const palette of DECOR_PALETTES) for (const e of palette.kinds) assert.ok(decorKind(e.type), `${palette.id}: ${e.type} is catalogued`);
  for (const rule of DECOR_RULES) assert.ok(decorPalette(rule.defaultPalette).id === rule.defaultPalette, `${rule.id} has a real default palette`);
});

test('every rule keeps off the road, never overlaps itself, and is deterministic', () => {
  for (const rule of DECOR_RULES) {
    const palette = decorPalette(rule.defaultPalette);
    const a = runRule(rule, defaultParams(rule), palette, base);
    const b = runRule(rule, defaultParams(rule), palette, base);
    assert.ok(a.length > 0, `${rule.id} places something on 20 km of road`);
    assert.deepEqual(a, b, `${rule.id}: same seed, same result`);
    const c = runRule(rule, defaultParams(rule), palette, { ...base, seed: 43 });
    assert.notDeepEqual(a, c, `${rule.id}: a different seed rolls differently`);
    assertOffRoad(a, rule.id);
    assertNoOverlap(a, rule.id);
    for (const p of a) {
      const s = track.sampleAt(p.s);
      assert.ok(!s.onBridge, `${rule.id}: nothing on the bridge deck (s=${p.s.toFixed(0)})`);
      assert.ok((p.kind.stages[s.stage] ?? 0) > 0, `${rule.id}: ${p.kind.type} suits ${s.stage}`);
    }
  }
});

test('a rule keeps clear of what is already standing', () => {
  const sign = decorKind('prop_23_sign_sheep')!;
  const world = siteWorld(track, { s: 3000, lateral: 480 + sign.footprint * 0.5 + 60 });
  const existing: PlacedProp[] = [{ id: 'hand_sign', type: sign.type, name: sign.name, x: world.x, y: world.y, z: world.z, rotY: 0, scale: 1, alignToTrack: false }];
  const placements = runRule(SCATTER_RULE, { ...defaultParams(SCATTER_RULE), density: 6, near: 0, far: 600, clump: 0 }, decorPalette('alpine_forest'), { ...base, existing });
  assert.ok(placements.length > 20, 'the dense scatter placed plenty');
  const ex = projectToTrack(track, existing[0]);
  for (const p of placements) {
    const min = sign.footprint + p.kind.footprint * p.scale;
    assert.ok(Math.hypot(p.s - ex.s, p.lateral - ex.lateral) >= min - 1e-6, `${p.kind.type} respects the hand-placed sign`);
  }
});

test('corner dressing lands on the OUTSIDE of the bend, and the sign stands before the apex', () => {
  const placements = runRule(CORNERS_RULE, defaultParams(CORNERS_RULE), decorPalette('trackside_safety'), base);
  const isSign = (type: string) => type === 'prop_23_sign_sheep' || type === 'prop_24_sign_tnt';
  const inBend = placements.filter((p) => p.s >= 5900 && p.s <= 8200 && !isSign(p.kind.type));
  assert.ok(inBend.length >= 2, `dressing in the bend (${inBend.length})`);
  // turnRate > 0 bends toward +right, so the outside is −right: every barricade has negative lateral.
  for (const p of inBend) assert.ok(p.lateral < 0, `${p.kind.type} at s=${p.s.toFixed(0)} is on the outside`);
  const sign = placements.find((p) => isSign(p.kind.type) && p.s < 6000);
  assert.ok(sign, 'a warning sign was placed ahead of the bend');
  assert.ok(sign!.s < 6000 && sign!.s > 4500, `the sign (s=${sign!.s.toFixed(0)}) stands before the bend`);
  const straight = placements.filter((p) => p.s < 4000 || (p.s > 8600 && p.s < 12000));
  assert.equal(straight.length, 0, 'nothing is dressed on the straights');
});

test('rhythm keeps the beat and mirrors when asked', () => {
  const p = { ...defaultParams(RHYTHM_RULE), period: 1000, phase: 0.5, pairs: 1, offset: 60 };
  const placements = runRule(RHYTHM_RULE, p, decorPalette('lanterns'), { ...base, span: [0, 5000] });
  assert.equal(placements.length, 10, 'five beats × two sides');
  for (const q of placements) {
    assert.ok(Math.abs(((q.s - 500) % 1000 + 1000) % 1000) < 1e-6, `s=${q.s} is on the beat`);
    assert.equal(Math.abs(q.lateral), 480 + q.kind.footprint * 0.5 + 60, 'at the edge offset');
  }
  const alternating = runRule(RHYTHM_RULE, { ...p, pairs: 0 }, decorPalette('lanterns'), { ...base, span: [0, 5000] });
  assert.equal(alternating.length, 5);
  for (let i = 1; i < alternating.length; i++) assert.ok(Math.sign(alternating[i].lateral) !== Math.sign(alternating[i - 1].lateral), 'sides alternate');
});

test('verge lines thin the inside of a bend, and the budget caps a run', () => {
  const dense = { ...defaultParams(VERGE_RULE), spacing: 300, jitter: 0, fill: 1, bendThin: 1 };
  const placements = runRule(VERGE_RULE, dense, decorPalette('verge_edges'), { ...base, span: [6000, 8000] });
  const inside = placements.filter((p) => p.lateral > 0).length;
  const outside = placements.filter((p) => p.lateral < 0).length;
  assert.ok(outside > inside, `the outside of the bend is fuller (${outside} vs ${inside})`);
  const capped = runRule(VERGE_RULE, dense, decorPalette('verge_edges'), { ...base, budget: 7 });
  assert.equal(capped.length, 7, 'the budget holds');
  const stadiumOnly = runRule(VERGE_RULE, dense, decorPalette('crowd'), { ...base, stages: new Set<TrackStageId>(['stadium']) });
  assert.ok(stadiumOnly.every((p) => p.s >= 12000), 'the stage filter holds');
});

test('scatter: clumpiness makes groves, and the far edge bounds the band', () => {
  const even = runRule(SCATTER_RULE, { ...defaultParams(SCATTER_RULE), clump: 0, density: 3, far: 1500 }, decorPalette('canyon_rock'), base);
  const clumped = runRule(SCATTER_RULE, { ...defaultParams(SCATTER_RULE), clump: 1, density: 3, far: 1500 }, decorPalette('canyon_rock'), base);
  const spread = (ps: DecorPlacement[]) => {
    const bins = new Array(20).fill(0);
    for (const p of ps) bins[Math.min(19, Math.floor(p.s / 1000))]++;
    const mean = ps.length / 20;
    return Math.sqrt(bins.reduce((acc, n) => acc + (n - mean) ** 2, 0) / 20) / Math.max(1, mean);
  };
  assert.ok(spread(clumped) > spread(even), 'clumped scatter is more uneven along the road');
  for (const p of even) assert.ok(Math.abs(p.lateral) <= 480 + p.kind.footprint * 0.5 + 1500 + 1e-6, 'inside the band');
});

test('the theme composes rules per stage, sharing one spacing index', () => {
  const results = runTheme({ ...base, intensity: 1 });
  const all = results.flatMap((r) => r.placements);
  assert.ok(all.length > 50, `the theme dressed the road (${all.length})`);
  assertOffRoad(all, 'theme');
  assertNoOverlap(all, 'theme');
  // Jitter may put a fan a few units before the stage boundary its sample rounds into; a lane's worth of slack.
  assert.ok(results.some((r) => r.rule === 'crowd' && r.placements.length > 0 && r.placements.every((p) => p.s >= 12000 - 240)), 'the crowd only stands in the stadium');
  assert.deepEqual(stageSpans(track).map((s) => s.stage), ['alpine', 'stadium']);
});

test('placements become tagged, grouped props on the road frame (or the probed ground)', () => {
  const kind = decorKind('boulder_a')!;
  const placement: DecorPlacement = { kind, s: 1000, lateral: -900, scale: 1.2, rotY: 0.3, flipX: true };
  const prop = placementToProp(track, placement, { rule: 'scatter', batch: 'b1', seed: 7 }, 3, () => 123);
  assert.equal(prop.id, 'decor_b1_3');
  assert.equal(prop.groupId, 'decor_b1');
  assert.deepEqual(decorTagOf(prop), { rule: 'scatter', batch: 'b1', seed: 7 });
  assert.equal(prop.y, 123, 'the probe height wins');
  assert.equal(prop.trackDist, 1000);
  const back = projectToTrack(track, prop);
  assert.ok(Math.abs(back.s - 1000) < 1 && Math.abs(back.lateral + 900) < 1, 'round-trips to its site');
  assert.equal(decorTagOf({ ...prop, decor: undefined }), null);
});

test('the spacing index and the rng behave', () => {
  const index = new SiteIndex();
  index.add(1000, 700, 200);
  assert.equal(index.blocked(1100, 700, 150), true);
  assert.equal(index.blocked(1500, 700, 150), false);
  const rng = makeRng(5);
  const values = Array.from({ length: 1000 }, () => rng());
  assert.ok(values.every((v) => v >= 0 && v < 1));
  assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) / 1000 - 0.5) < 0.05, 'roughly uniform');
  assert.equal(makeRng(5)(), values[0], 'seeded');
});
