// ============================================================================
// File: packages/plotsim/src/__tests__/coherence-and-power.test.ts
// Briefs: Brief 26 & Brief 27b Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  GATE_BASELINE_POWER_KW,
  PERIMETER_TURRET_DRAW_KW,
  computePowerGridSatisfaction,
  selectTurretTarget,
  stepSuitCoherence,
} from '../coherence-and-power';

describe('Suit Coherence Safe Dome & Zero-Loss Recall (DEC-03 / Brief 26)', () => {
  it('never drains and recharges at +20%/s within 25m of the Planet Twin Gate', () => {
    const res = stepSuitCoherence(
      50,
      { x: 12, z: 15 }, // dist = 19.2m <= 25m
      { x: 0, z: 0 },
      [],
      false,
      1.0
    );
    expect(res.inSafeDome).toBe(true);
    expect(res.coherencePct).toBeCloseTo(70, 2);
    expect(res.triggerZeroLossRecall).toBe(false);
  });

  it('recharges within 15m of any powered Relay Pylon', () => {
    const res = stepSuitCoherence(
      60,
      { x: 100, z: 100 },
      { x: 0, z: 0 },
      [{ x: 92, z: 95 }], // dist = 9.43m <= 15m
      false,
      1.0
    );
    expect(res.inSafeDome).toBe(true);
    expect(res.coherencePct).toBeCloseTo(80, 2);
  });

  it('drains in unpowered wasteland and triggers zero-loss recall at 0%', () => {
    const recall = stepSuitCoherence(
      0.5,
      { x: 200, z: 200 },
      { x: 0, z: 0 },
      [],
      false,
      2.0
    );
    expect(recall.triggerZeroLossRecall).toBe(true);
    expect(recall.coherencePct).toBe(100);
  });
});

describe('12 kW Gate Baseline Power Grid & Proportional Brownout (P0-LOOP-02)', () => {
  it('supplies 12 kW at the Gate and runs 3 starter machines at 100% satisfaction', () => {
    expect(GATE_BASELINE_POWER_KW).toBe(12.0);
    const grid = computePowerGridSatisfaction([3.0, 4.0, 3.5], 0, 0); // 10.5 kW <= 12 kW
    expect(grid.isBrownout).toBe(false);
    expect(grid.satisfactionRatio).toBe(1.0);
  });

  it('triggers proportional brownout (>= 0.25) when a 4th machine exceeds 12 kW without a Power Unit', () => {
    const brownout = computePowerGridSatisfaction([3.0, 4.0, 3.5, 6.0], 0, 0); // 16.5 kW > 12 kW
    expect(brownout.isBrownout).toBe(true);
    expect(brownout.satisfactionRatio).toBeCloseTo(12.0 / 16.5, 3);

    const restored = computePowerGridSatisfaction([3.0, 4.0, 3.5, 6.0], 1, 0); // +36 kW Power Unit
    expect(restored.isBrownout).toBe(false);
    expect(restored.satisfactionRatio).toBe(1.0);
  });
});

describe('2 kW Automated Perimeter Defense Turret Targeting (Brief 27b)', () => {
  it('draws 2 kW and prioritizes sappers over swarmers and chargers within 35m', () => {
    expect(PERIMETER_TURRET_DRAW_KW).toBe(2.0);
    const target = selectTurretTarget({ x: 0, z: 0 }, [
      { id: 'c1', archetype: 'charger', x: 5, z: 0, hp: 40 },
      { id: 's1', archetype: 'sapper', x: 22, z: 0, hp: 25 },
      { id: 'w1', archetype: 'swarmer', x: 8, z: 0, hp: 10 },
    ]);
    expect(target?.id).toBe('s1');
  });
});
