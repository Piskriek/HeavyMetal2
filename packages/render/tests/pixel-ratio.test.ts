import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_TIERS, pixelRatioFor } from '../src';

const { low, medium, high, ultra } = GRAPHICS_TIERS;

test('low renders a 1080p screen at about 1280x720 worth of pixels', () => {
  const r = pixelRatioFor(low, 1920, 1080, 1);
  assert.ok(Math.abs(1920 * r * 1080 * r - 921_600) < 1000);
  assert.ok(r > 0.6 && r < 0.7);
});

test('low stays sharp when the saving would be small, and never goes above the screen', () => {
  assert.equal(pixelRatioFor(low, 1366, 768, 1), 1);
  assert.equal(pixelRatioFor(low, 1280, 720, 1), 1);
  assert.equal(pixelRatioFor(low, 390, 844, 3), 1);
  assert.ok(pixelRatioFor(low, 3840, 2160, 1) >= 0.5);
});

test('the other tiers keep their caps', () => {
  assert.equal(pixelRatioFor(medium, 1920, 1080, 1), 1);
  assert.equal(pixelRatioFor(medium, 1440, 900, 2), 1.5);
  assert.equal(pixelRatioFor(high, 1440, 900, 2), 2);
  assert.equal(pixelRatioFor(ultra, 1920, 1080, 1), 1.5);
  assert.equal(pixelRatioFor(high, 1920, 1080, Number.NaN), 1);
});

test('a picture size works on any tier, counts the short side (phones held upright stay sharp), and 0 means all the screen has', () => {
  assert.ok(pixelRatioFor({ ...high, pictureSize: 720 }, 1920, 1080, 1) < 0.7);
  assert.equal(pixelRatioFor({ ...low, pictureSize: 0 }, 1920, 1080, 1), 1);
  assert.equal(pixelRatioFor(low, 844, 390, 1), 1);
});
