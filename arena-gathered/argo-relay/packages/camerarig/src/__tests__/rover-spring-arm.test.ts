// ============================================================================
// File: packages/camerarig/src/__tests__/rover-spring-arm.test.ts
// Brief: Brief 27 Unit Tests for Rover Spring Arm & Hang-Time Detector
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROVER_CAMERA_CONFIG,
  createRoverSpringArmState,
  stepRoverSpringArm,
} from '../rover-spring-arm';

describe('Rover Sphere-Cast Spring Arm & Terrain Floor Clamp (Brief 27 / P0-VEH-01)', () => {
  it('never allows camera.y to dip below sampleTerrainHeight(x, z) + 0.65m on steep slopes', () => {
    const state = createRoverSpringArmState();
    // Simulate a steep hill rising to y = 25m behind the rover at (0, 2, 0)
    const sampleTerrain = (_x: number, z: number) => (z < 0 ? 25.0 : 2.0);

    const step = stepRoverSpringArm(
      state,
      { x: 0, y: 2, z: 0 },
      0,
      0,
      false,
      0.016,
      sampleTerrain
    );

    expect(step.cameraPos.y).toBeGreaterThanOrEqual(
      25.0 + DEFAULT_ROVER_CAMERA_CONFIG.minGroundClearance
    );
  });

  it('pulls the camera forward when an obstacle raycast hits closer than targetDistance', () => {
    const state = createRoverSpringArmState();
    const step = stepRoverSpringArm(
      state,
      { x: 0, y: 0, z: 0 },
      0,
      0,
      false,
      0.2,
      () => 0,
      () => 2.5 // Boulder hit at 2.5m behind pivot
    );
    expect(state.currentDistance).toBeLessThan(DEFAULT_ROVER_CAMERA_CONFIG.targetDistance);
    expect(Math.abs(step.cameraPos.z)).toBeLessThan(DEFAULT_ROVER_CAMERA_CONFIG.targetDistance);
  });

  it('triggers CHARM-AIRTIME exactly once when all wheels stay airborne >= 1.8s', () => {
    const state = createRoverSpringArmState();
    const t1 = stepRoverSpringArm(state, { x: 0, y: 10, z: 0 }, 0, 0, true, 1.0, () => 0);
    expect(t1.triggeredAirtimeBark).toBe(false);

    const t2 = stepRoverSpringArm(state, { x: 0, y: 12, z: 5 }, 0, 0, true, 0.9, () => 0);
    expect(t2.triggeredAirtimeBark).toBe(true);

    const t3 = stepRoverSpringArm(state, { x: 0, y: 11, z: 8 }, 0, 0, true, 0.5, () => 0);
    expect(t3.triggeredAirtimeBark).toBe(false);
  });
});
