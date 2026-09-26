/**
 * Art wave 2 in the creator: every goblin is painted (vector items draw as their painted twins),
 * wrap-around parts are drawn in two passes around the head, and war paint stays on the skin.
 * Run with: node --import tsx --test tests/painted-goblin.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { AVATAR_CATALOG, generateRandomGoblin, isDuplicateItem } from '../src/game/meta/goblin-dna';
import { composeGoblinSvg, depthUrl } from '../src/game/meta/goblin-compositor';
import { PAINTED_PARTS, drawnItem } from '../src/game/meta/painted-parts';
import { PART_DEPTH } from '../src/game/meta/painted-depth.generated';
import type { AvatarLayerId, GoblinAvatarConfig } from '../src/game/meta/interfaces';

const LAYERS = Object.keys(AVATAR_CATALOG) as AvatarLayerId[];
const VECTOR = /<(path|ellipse|circle|line|polygon|polyline)\b/;
const wearing = (layer: AvatarLayerId, item: string, base = generateRandomGoblin(7, 3)): GoblinAvatarConfig =>
  ({ ...base, layers: { ...base.layers, [layer]: AVATAR_CATALOG[layer].indexOf(item) } });

test('no vector art: every catalog item on every layer draws as a painted part', () => {
  for (const layer of LAYERS) {
    AVATAR_CATALOG[layer].forEach((item, i) => {
      if (item === 'none') return;
      assert.match(drawnItem(layer, item), /^painted:/, `${layer} "${item}" has no painted twin`);
      const base = generateRandomGoblin(11, 3);
      const svg = composeGoblinSvg({ ...base, layers: { ...base.layers, [layer]: i } });
      assert.doesNotMatch(svg, VECTOR, `${layer} "${item}" still draws vector shapes`);
    });
  }
});

test('no vector art: old v1 and v2 goblins draw painted too', () => {
  for (let seed = 0; seed < 120; seed++) {
    for (const gen of [1, 2] as const) assert.doesNotMatch(composeGoblinSvg(generateRandomGoblin(seed, gen)), VECTOR, `seed ${seed} generator ${gen}`);
  }
});

test('depth: a wrap-around part draws its hidden half behind the head, its front in its own layer', () => {
  assert.ok(PART_DEPTH.size >= 20, 'the depth masks are listed');
  for (const id of PART_DEPTH) assert.ok(existsSync(`public${depthUrl(id)}`), `${id} depth mask missing`);
  const svg = composeGoblinSvg(wearing('neck', 'painted:neck-wool-scarf'));
  const backAt = svg.indexOf('data-layer="neck-back"'), headAt = svg.indexOf('data-layer="head"'), frontAt = svg.indexOf('data-layer="neck"');
  assert.ok(backAt > 0 && backAt < headAt && headAt < frontAt, 'back pass → head → front pass');
  assert.match(svg, /feColorMatrix/, 'the back pass inverts the depth mask');
  const plain = composeGoblinSvg(wearing('neck', 'none', { ...generateRandomGoblin(7, 3), layers: { ...generateRandomGoblin(7, 3).layers, headgear: 0, eyewear: 0 } }));
  assert.doesNotMatch(plain, /-back"/, 'no depth parts, no back pass');
});

test('depth: a vector item whose twin has a depth mask gets the two passes too (old codes)', () => {
  const svg = composeGoblinSvg(wearing('headgear', 'grease-bowler'));
  assert.match(svg, /data-layer="headgear-back"/);
});

test('war paint is drawn through the painted head, so it never lands off the skin', () => {
  const svg = composeGoblinSvg(wearing('warpaint', 'painted:warpaint-bone-skull'));
  assert.match(svg, /id="gob-skin-clip"[^>]*style="mask-type:alpha"/);
  const paint = svg.slice(svg.indexOf('data-layer="warpaint"'));
  assert.match(paint, /mask="url\(#gob-skin-clip\)"/);
});

test('duplicates: the randomizer and the creator never offer a vector item whose twin is in the catalog', () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = generateRandomGoblin(seed, 3);
    for (const layer of LAYERS) assert.ok(!isDuplicateItem(layer, g.layers[layer]), `seed ${seed} picked a duplicate ${layer}`);
  }
  // Every painted part can still be picked: through its own catalog item or through the item it replaces.
  for (const def of PAINTED_PARTS) {
    const items = AVATAR_CATALOG[def.layer];
    const pickable = items.some((item, i) => !isDuplicateItem(def.layer, i) && drawnItem(def.layer, item) === `painted:${def.id}`);
    assert.ok(pickable, `${def.id} cannot be picked`);
  }
});
