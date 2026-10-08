import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_TIERS, graphicsSchema, plantsCulled, qualitySpecOf, resolveGraphics, shadowMapSize } from '../src';

test('every tier sets every variable of the graphics preset, with legal values', () => {
  const keys = graphicsSchema.variables.map((v) => v.key).sort();
  for (const [tier, g] of Object.entries(GRAPHICS_TIERS)) {
    assert.deepEqual(Object.keys(g).sort(), keys, tier);
    assert.deepEqual(resolveGraphics(tier as keyof typeof GRAPHICS_TIERS, {}), g, `${tier} survives its own checks`);
  }
});

test('the tiers step up: shadows, effects and plant detail grow from low to ultra', () => {
  assert.deepEqual(['low', 'medium', 'high', 'ultra'].map((t) => shadowMapSize(GRAPHICS_TIERS[t as 'low'])), [0, 1024, 2048, 4096]);
  assert.equal(GRAPHICS_TIERS.low.effects, false);
  assert.equal(plantsCulled(GRAPHICS_TIERS.low), true);
  assert.equal(plantsCulled(GRAPHICS_TIERS.high), false);
  assert.deepEqual(qualitySpecOf(GRAPHICS_TIERS.high), { label: 'Custom', pixelRatio: 2, shadowMap: 2048, ssao: true, bloom: true, aoSamples: 12 });
});

test('your own changes sit on top of whichever tier draws, and junk is ignored', () => {
  const own = { shadows: 'on', plantDetail: 40, glow: 'yes', sharpness: -3, contactShadowSamples: 9.6, nonsense: 1 };
  const low = resolveGraphics('low', own);
  assert.equal(low.shadows, 'on');
  assert.equal(low.plantDetail, 40);
  assert.equal(low.glow, false, 'a word is not a switch');
  assert.equal(low.sharpness, 1, 'below the hard limit is refused');
  assert.equal(low.contactShadowSamples, 10, 'whole numbers stay whole');
  assert.equal(plantsCulled(low), false, 'with shadows on, plants out of view are drawn (their shadows can show)');
  assert.equal(resolveGraphics('ultra', own).shadows, 'on');
  assert.equal(resolveGraphics('high', { shadows: 'blinding' }).shadows, 'detailed');
});

test('the dither distance: each tier has one, ultra blends everywhere (0), your own wins, below 0 is refused', () => {
  assert.deepEqual(['potato', 'low', 'medium', 'high', 'ultra'].map((x) => GRAPHICS_TIERS[x as 'low'].ditherDistance), [20, 30, 45, 60, 0]);
  assert.equal(resolveGraphics('low', { ditherDistance: 0 }).ditherDistance, 0, 'unlimited');
  assert.equal(resolveGraphics('potato', { ditherDistance: 150 }).ditherDistance, 150);
  assert.equal(resolveGraphics('low', { ditherDistance: -5 }).ditherDistance, 30, 'a negative distance is junk');
});

test('the pixel plumes: dither sprites on potato, cubes from low up, never off by a tier, denser as the tiers rise; your own wins', () => {
  assert.deepEqual(['potato', 'low', 'medium', 'high', 'ultra'].map((x) => GRAPHICS_TIERS[x as 'low'].pixelPlumes), ['dither', 'cubes', 'cubes', 'cubes', 'cubes']);
  assert.deepEqual(['potato', 'low', 'medium', 'high', 'ultra'].map((x) => GRAPHICS_TIERS[x as 'low'].plumeDensity), [0.5, 0.75, 1, 1.5, 2]);
  assert.equal(resolveGraphics('ultra', { pixelPlumes: 'off' }).pixelPlumes, 'off');
  assert.equal(resolveGraphics('low', { pixelPlumes: 'splats' }).pixelPlumes, 'splats');
  assert.equal(resolveGraphics('low', { pixelPlumes: 'sparkles' }).pixelPlumes, 'cubes', 'an unknown way is junk');
  assert.equal(resolveGraphics('low', { plumeDensity: 2 }).plumeDensity, 2);
  assert.equal(resolveGraphics('low', { plumeDensity: 0 }).plumeDensity, 0.75, 'below the hard limit is refused');
});

test('the plume ground glow: off on potato, low and medium, on on high and ultra; your own wins', () => {
  assert.deepEqual(['potato', 'low', 'medium', 'high', 'ultra'].map((x) => GRAPHICS_TIERS[x as 'low'].plumeGlow), [false, false, false, true, true]);
  assert.equal(resolveGraphics('low', { plumeGlow: true }).plumeGlow, true);
  assert.equal(resolveGraphics('ultra', { plumeGlow: false }).plumeGlow, false);
});
