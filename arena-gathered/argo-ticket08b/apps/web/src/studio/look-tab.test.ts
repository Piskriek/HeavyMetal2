// ============================================================================
// File: apps/web/src/studio/look-tab.test.ts
// Unit tests for lookFrame and bakeLookTestCoverage (TICKET-08b Item A).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeLookTestCoverage, lookFrame, stageAssetLevel } from './look-tab';

test('lookFrame returns ground, sky, and assetLevel across stages 0..6 and sun elevations', () => {
  const s1 = lookFrame(1, 25);
  assert.equal(s1.stage, 1);
  assert.equal(s1.assetLevel, 'low');
  assert.equal(s1.level, 'low');
  assert.equal(s1.ground.nearest, true);
  assert.equal(s1.ground.triplanar, false);
  assert.equal(s1.sky.density, 0);
  assert.deepEqual(s1.sky.zenith, [0, 0, 0]);
  assert.deepEqual(s1.sky.sunColour, [1, 1, 1]);

  const s3 = lookFrame(3, 35);
  assert.equal(s3.assetLevel, 'mid');
  assert.equal(s3.ground.nearest, false);
  assert.equal(s3.ground.triplanar, true);
  assert.ok(s3.sky.density > 0 && s3.sky.density < 1);
  assert.ok(s3.sky.zenith[2] > s3.sky.zenith[0], 'Rayleigh sky zenith is bluer than red at stage 3');

  const s6 = lookFrame(6, 45);
  assert.equal(s6.assetLevel, 'high');
  assert.equal(s6.sky.density, 1);
  assert.ok(s6.ground.texelsPerMetre > s1.ground.texelsPerMetre);
  assert.ok(s6.ground.normalStrength > s1.ground.normalStrength);

  // Low sun vs high sun tints sunColour warmer at low elevation when atmosphere is active
  const lowSun = lookFrame(5, 4);
  const highSun = lookFrame(5, 75);
  assert.ok(lowSun.sky.sunColour[2] < highSun.sky.sunColour[2], 'Low sun has less blue transmittance than high sun');
});

test('stageAssetLevel and bakeLookTestCoverage produce deterministic coverage masks across stages', () => {
  assert.equal(stageAssetLevel(0), 'low');
  assert.equal(stageAssetLevel(1.9), 'low');
  assert.equal(stageAssetLevel(2.0), 'mid');
  assert.equal(stageAssetLevel(3.9), 'mid');
  assert.equal(stageAssetLevel(4.0), 'high');
  assert.equal(stageAssetLevel(6.0), 'high');

  const b1 = bakeLookTestCoverage(1, 42);
  const b4 = bakeLookTestCoverage(4, 42);
  assert.equal(b1.bake.cover.length, b1.n * b1.n * 4);
  assert.equal(b4.bake.cover.length, b4.n * b4.n * 4);

  // Stage 4 has living moss/grass coverage (G or B > 0) and wet cells (A > 0) near the water feature
  let greenSum1 = 0;
  let greenSum4 = 0;
  let wetSum4 = 0;
  for (let i = 0; i < b4.bake.cover.length; i += 4) {
    greenSum1 += (b1.bake.cover[i + 1] ?? 0) + (b1.bake.cover[i + 2] ?? 0);
    greenSum4 += (b4.bake.cover[i + 1] ?? 0) + (b4.bake.cover[i + 2] ?? 0);
    wetSum4 += b4.bake.cover[i + 3] ?? 0;
  }
  assert.equal(greenSum1, 0, 'Stage 1 has zero moss/grass coverage');
  assert.ok(greenSum4 > 0, 'Stage 4 bakes non-zero moss/grass coverage');
  assert.ok(wetSum4 > 0, 'Stage 4 bakes non-zero wet channel near water');
});
