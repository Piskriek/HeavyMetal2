import test from 'node:test';
import assert from 'node:assert/strict';
import {
  postFxMemory,
  fitToBudget,
  MAX_VRAM_BUDGET_BYTES,
} from '../src/game/postfx/budget';

test('T7 PostFxBudget: zero-cost for medium and low quality', () => {
  assert.equal(postFxMemory(1920, 1080, 'low'), 0);
  assert.equal(postFxMemory(1920, 1080, 'medium'), 0);
  assert.equal(postFxMemory(3840, 2160, 'medium'), 0);
});

test('T7 PostFxBudget: high quality closed-form memory calculation', () => {
  const w = 1920;
  const h = 1080;
  const bytes = postFxMemory(w, h, 'high', 1);

  // Main HDR target: 1920 * 1080 * 8 bytes ≈ 16.58 MB
  const mainTarget = w * h * 8;
  assert.ok(bytes > mainTarget);
  // Full target + bloom pyramid should be less than 32 MB at 1080p
  assert.ok(bytes < 32 * 1024 * 1024);
});

test('T7 PostFxBudget: dynamic downgrade ladder stays under cap', () => {
  // At 4K (3840x2160), with tight 30MB cap
  const scaled = fitToBudget(3840, 2160, 'high', 30 * 1024 * 1024);
  assert.ok(scaled.quality === 'high' || scaled.quality === 'medium');

  // With impossible 1MB cap, should drop down to zero-cost Medium
  const lowBudget = fitToBudget(1920, 1080, 'high', 1024 * 1024);
  assert.equal(lowBudget.quality, 'medium');
  assert.equal(lowBudget.levels, 0);
});
