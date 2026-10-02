import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerrain, heightAt, type Terrain } from '@hm/terrain';
import {
  DEFAULT_RULES, PLANTS, RULE_VARIABLES, SURFACE_IDS as S, canGrowOn, normalizePlant, normalizeRules, packDecor, paramsToRules, plantFor, rectToArea,
  respondToSculpt, rulesToParams, settlePlants, surfaceAt, unpackDecor, type PlantPlacement,
} from '../src';

const spec = { cols: 21, rows: 21, cell: 1, originX: -10, originZ: -10 };
const flat = (h: number, surface: number): Terrain => createTerrain(spec, { height: h, surface });
const all = { c0: 0, r0: 0, c1: 20, r1: 20 };
const lowerCentre = (t: Terrain, by: number): void => { const i = 10 * 21 + 10; t.heights[i] = (t.heights[i] ?? 0) - by; };

test('digging grass exposes soil, digging deeper exposes rock, and a shallow scrape changes nothing', () => {
  const t = flat(6, S.grass);
  const before = t.heights.slice();
  lowerCentre(t, 0.1);
  assert.equal(respondToSculpt(t, before, all), 0, 'below the threshold');
  lowerCentre(t, 0.4);
  assert.equal(respondToSculpt(t, before, all), 1);
  assert.equal(surfaceAt(t, 0, 0), S.soil);
  lowerCentre(t, 3);
  respondToSculpt(t, before, all);
  assert.equal(surfaceAt(t, 0, 0), S.rock);
  assert.equal(surfaceAt(t, 3, 3), S.grass, 'untouched ground keeps its grass');
});

test('digging sand exposes wet sand; sinking under the sea turns ground to sea bed; raising keeps the surface', () => {
  const sand = flat(1, S.sand);
  const b1 = sand.heights.slice();
  lowerCentre(sand, 0.5);
  respondToSculpt(sand, b1, all);
  assert.equal(surfaceAt(sand, 0, 0), S.wetSand);
  const low = flat(0.3, S.grass);
  const b2 = low.heights.slice();
  lowerCentre(low, 0.5);
  respondToSculpt(low, b2, all);
  assert.equal(surfaceAt(low, 0, 0), S.seabed);
  const up = flat(1, S.grass);
  const b3 = up.heights.slice();
  up.heights[10 * 21 + 10] = 5;
  assert.equal(respondToSculpt(up, b3, all), 0);
  assert.equal(surfaceAt(up, 0, 0), S.grass);
});

test('only nodes inside the stroke rectangle respond', () => {
  const t = flat(3, S.grass);
  const before = t.heights.slice();
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = 2;
  assert.equal(respondToSculpt(t, before, { c0: 0, r0: 0, c1: 1, r1: 1 }), 4);
});

test('plants follow the ground up and down', () => {
  const t = flat(2, S.grass);
  const palms: PlantPlacement[] = [{ kind: 'palm', x: 0, y: 2, z: 0, yaw: 0, scale: 1 }];
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = 4;
  const r = settlePlants(palms, t, null);
  assert.equal(r.moved, 1);
  assert.equal(r.items[0]!.y, 4);
  const off = settlePlants(palms, t, null, { ...DEFAULT_RULES, plantsFollowGround: false });
  assert.equal(off.items[0]!.y, 2, 'with the switch off they stay where they were');
});

test('flowers stay on dug soil (still green ground) but go when the dig reaches rock', () => {
  const t = flat(6, S.grass);
  const before = t.heights.slice();
  lowerCentre(t, 0.5);
  respondToSculpt(t, before, all);
  const flowers: PlantPlacement[] = [{ kind: 'flowers', x: 0, y: 6, z: 0, yaw: 0, scale: 1 }];
  assert.equal(settlePlants(flowers, t, null).removed, 0, 'soil still grows flowers');
  lowerCentre(t, 3);
  respondToSculpt(t, before, all);
  assert.equal(settlePlants(flowers, t, null).removed, 1, 'rock does not');
});

test('palms drown, boulders do not; plants outside the changed area are left alone', () => {
  const t = flat(-1, S.seabed);
  const things: PlantPlacement[] = [{ kind: 'palm', x: 0, y: 1, z: 0, yaw: 0, scale: 1 }, { kind: 'boulder', x: 1, y: 1, z: 1, yaw: 0, scale: 1 }];
  const r = settlePlants(things, t, null);
  assert.equal(r.removed, 1);
  assert.equal(r.items[0]!.kind, 'boulder');
  assert.equal(r.items[0]!.y, heightAt(t, 1, 1));
  const away = settlePlants(things, t, { x0: 5, z0: 5, x1: 9, z1: 9 });
  assert.equal(away.removed, 0);
  assert.equal(away.moved, 0);
});

test('plants go away on ground that gets too steep, with the react switch respected', () => {
  const t = flat(0, S.grass);
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) t.heights[r * 21 + c] = c * 2 + 5;
  const bush: PlantPlacement[] = [{ kind: 'bush', x: 0, y: 25, z: 0, yaw: 0, scale: 1 }];
  assert.equal(settlePlants(bush, t, null).removed, 1);
  assert.equal(settlePlants(bush, t, null, { ...DEFAULT_RULES, plantsReact: false }).removed, 0);
});

test('digging under a plant digs it up; raising never does', () => {
  const t = flat(6, S.grass);
  const before = t.heights.slice();
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = 5.7;
  const things: PlantPlacement[] = [{ kind: 'tuft', x: 0, y: 6, z: 0, yaw: 0, scale: 1 }, { kind: 'palm', x: 1, y: 6, z: 1, yaw: 0, scale: 1 }, { kind: 'boulder', x: 2, y: 6, z: 2, yaw: 0, scale: 1 }];
  const r = settlePlants(things, t, null, DEFAULT_RULES, PLANTS, before);
  assert.deepEqual(r.items.map((p) => p.kind), ['palm', 'boulder'], 'the grass tuft was dug up, the palm and the boulder sink with the ground');
  assert.ok(r.items.every((p) => Math.abs(p.y - 5.7) < 1e-6));
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = 9;
  assert.equal(settlePlants(things, t, null, DEFAULT_RULES, PLANTS, before).removed, 0);
});

test('growing rules and behaviour presets', () => {
  assert.ok(canGrowOn('anywhere', S.lava));
  assert.ok(canGrowOn('green ground', S.moss));
  assert.ok(!canGrowOn('green ground', S.sand));
  assert.ok(canGrowOn('sand and green ground', S.sand));
  assert.equal(plantFor('palm').grows, 'sand and green ground');
  assert.equal(plantFor('mystery').disappears, false, 'unknown things are left alone');
  assert.equal(new Set(PLANTS.map((p) => p.kind)).size, PLANTS.length);
  const p = normalizePlant({ kind: 'palm', grows: 'nonsense', maxSlopeDeg: 400, followGround: 'x' });
  assert.equal(p.grows, 'sand and green ground');
  assert.equal(p.maxSlopeDeg, 90);
  assert.equal(p.followGround, true);
});

test('world rules normalise junk, round-trip through their params, and every variable has a legal default', () => {
  assert.deepEqual(normalizeRules(null), DEFAULT_RULES);
  assert.deepEqual(normalizeRules({ digThreshold: -4, greenDugBecomes: 'lava', deepLayer: 99 }).greenDugBecomes, S.lava);
  assert.equal(normalizeRules({ digThreshold: -4 }).digThreshold, 0);
  assert.deepEqual(paramsToRules(rulesToParams(DEFAULT_RULES)), DEFAULT_RULES);
  for (const v of RULE_VARIABLES) if (v.type === 'enum') assert.ok(v.options?.includes(String(v.default)), v.key);
});

test('decor packing round-trips', () => {
  const list: PlantPlacement[] = [{ kind: 'palm', x: 1.234, y: 2, z: 3, yaw: 0.5, scale: 1.1 }, { kind: 'bush', x: 4, y: 5, z: 6, yaw: 1, scale: 0.9 }, { kind: 'palm', x: 7, y: 8, z: 9, yaw: 2, scale: 1 }];
  const packed = packDecor(list);
  assert.deepEqual(packed.kinds, ['palm', 'bush']);
  const back = unpackDecor(packed.kinds, packed.items);
  assert.equal(back.length, 3);
  assert.equal(back[0]!.x, 1.23);
  assert.equal(back[2]!.kind, 'palm');
});

test('rectToArea covers the nodes of the rectangle', () => {
  const t = flat(0, S.grass);
  assert.deepEqual(rectToArea(t, { c0: 2, r0: 3, c1: 4, r1: 5 }, 1), { x0: -9, z0: -8, x1: -5, z1: -4 });
});
