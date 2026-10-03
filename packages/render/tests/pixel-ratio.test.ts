import test from 'node:test';
import assert from 'node:assert/strict';
import { LOW_PIXEL_BUDGET, pixelRatioFor } from '../src';

test('low renders a 1080p screen at about 1280x720 worth of pixels', () => {
  const r = pixelRatioFor('low', 1920, 1080, 1);
  assert.ok(Math.abs(1920 * r * 1080 * r - LOW_PIXEL_BUDGET) < 1000);
  assert.ok(r > 0.6 && r < 0.7);
});

test('low stays sharp when the saving would be small, and never goes above the screen', () => {
  assert.equal(pixelRatioFor('low', 1366, 768, 1), 1);
  assert.equal(pixelRatioFor('low', 1280, 720, 1), 1);
  assert.equal(pixelRatioFor('low', 390, 844, 3), 1);
  assert.ok(pixelRatioFor('low', 3840, 2160, 1) >= 0.5);
});

test('the other tiers keep their caps', () => {
  assert.equal(pixelRatioFor('medium', 1920, 1080, 1), 1);
  assert.equal(pixelRatioFor('medium', 1440, 900, 2), 1.5);
  assert.equal(pixelRatioFor('high', 1440, 900, 2), 2);
  assert.equal(pixelRatioFor('ultra', 1920, 1080, 1), 1.5);
  assert.equal(pixelRatioFor('high', 1920, 1080, Number.NaN), 1);
});
