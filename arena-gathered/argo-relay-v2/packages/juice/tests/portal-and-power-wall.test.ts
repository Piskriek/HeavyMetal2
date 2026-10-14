import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePortalCrossingFrame,
  generatePortalThresholdSparks,
  MOON_GRAVITY_MPS2,
  PORTAL_SPARK_COUNT,
} from '../src/portal-threshold-shimmer';

test('applies Moon gravity camera pop and spawns 24 amber coil sparks', () => {
  const toMoon = evaluatePortalCrossingFrame('lab-to-moon', 0.08);
  assert.equal(toMoon.targetGravityMps2, MOON_GRAVITY_MPS2);
  assert.equal(generatePortalThresholdSparks('lab-to-moon').length, PORTAL_SPARK_COUNT);
});
