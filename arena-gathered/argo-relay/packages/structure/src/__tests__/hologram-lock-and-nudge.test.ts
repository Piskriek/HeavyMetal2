// ============================================================================
// File: packages/structure/src/__tests__/hologram-lock-and-nudge.test.ts
// Plan: Plan 16 (P2-UI-06 Unit Tests for Hologram Lock & Arrow-Key Nudge)
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  computeDemolishRefund,
  createBuildHologramState,
  getFinalHologramWorldTransform,
  nudgeLockedHologram,
  rotateHologram45,
  toggleHologramLock,
  updateHologramRaycast,
} from '../hologram-lock-and-nudge';

describe('Hologram Lock [H] & Arrow-Key Precision Nudge (P2-UI-06)', () => {
  it('freezes raycast updates when locked with [H] and nudges in 0.5m / 0.25m steps', () => {
    let h = createBuildHologramState('foundation-frame', 10, 0, -5);
    h = toggleHologramLock(h);
    expect(h.isLocked).toBe(true);

    // Raycast movement is ignored while locked
    h = updateHologramRaycast(h, 99, 0, 99);
    expect(getFinalHologramWorldTransform(h).x).toBe(10);

    // Nudge +0.5m X and -0.25m fine Z
    h = nudgeLockedHologram(h, 1, 0, 0, false);
    h = nudgeLockedHologram(h, 0, -1, 0, true);
    const xf = getFinalHologramWorldTransform(h);
    expect(xf.x).toBeCloseTo(10.5, 3);
    expect(xf.z).toBeCloseTo(-5.25, 3);
  });

  it('rotates in 45-degree increments and refunds 100% of ore on demolish (Rule 23)', () => {
    let h = createBuildHologramState('texture-mill');
    h = rotateHologram45(rotateHologram45(h));
    expect(h.yawDeg).toBe(90);
    expect(computeDemolishRefund(45)).toBe(45);
  });
});
