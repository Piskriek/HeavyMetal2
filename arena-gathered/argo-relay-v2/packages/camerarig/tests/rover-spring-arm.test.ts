import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialRoverSpringArmState,
  stepRoverSpringArm,
  TERRAIN_FLOOR_CLEARANCE_M,
} from '../src/rover-spring-arm';
import { computeStage0DitherLuminance } from '../../groundshader/src/stage0-dither.glsl';

test('clamps camera Y >= terrainHeight + 0.65m and applies DEC-06 15m amber Gate pool', () => {
  const state = createInitialRoverSpringArmState();
  const res = stepRoverSpringArm(state, {
    chassisX: 0,
    chassisY: 2.0,
    chassisZ: 0,
    chassisYawRad: 0,
    chassisPitchRad: -0.4,
    dtSec: 0.016,
    sphereCastHitDistanceM: null,
    sampleTerrainHeightAt: () => 12.0,
  });

  assert.equal(res.wasFloorClamped, true);
  assert.ok(res.camY >= 12.0 + TERRAIN_FLOOR_CLEARANCE_M);
  assert.ok(computeStage0DitherLuminance(0.7, 5.0, 4.0).amberWeight > 0.6);
});
