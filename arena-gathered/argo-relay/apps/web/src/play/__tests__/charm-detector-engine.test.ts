// ============================================================================
// File: apps/web/src/play/__tests__/charm-detector-engine.test.ts
// Plan: Plan 29 Unit Tests for Runtime Charm Detector Engine
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  createCharmDetectorState,
  notifyBeamPaintNearTwinGate,
  notifyFirst3DPolygonMonsterSpawned,
  notifyHudSkinTransition,
  notifyPlayerOrbiting2DSprite,
  notifyRedEmergencyButtonPressed,
  notifyStudioDirtRenamed,
} from '../charm-detector-engine';

describe('Runtime Charm Detector Engine (Plan 29)', () => {
  it('fires CHARM-WIREFRAME-FILL on 0a -> 0b and CHARM-BOUNDARY on 3 crossings within 6s', () => {
    const state = createCharmDetectorState('0a');
    expect(notifyHudSkinTransition(state, '0b', 1.0)).toBe('CHARM-WIREFRAME-FILL');
    expect(notifyHudSkinTransition(state, '1', 2.0)).toBeNull();
    expect(notifyHudSkinTransition(state, '0b', 3.5)).toBe('CHARM-BOUNDARY');
    // Never repeats once fired
    expect(notifyHudSkinTransition(state, '1', 4.0)).toBeNull();
  });

  it('fires CHARM-BUTTON on the 3rd press of the red button and locks the tooltip', () => {
    const state = createCharmDetectorState();
    expect(notifyRedEmergencyButtonPressed(state).bark).toBeNull();
    expect(notifyRedEmergencyButtonPressed(state).bark).toBeNull();
    const third = notifyRedEmergencyButtonPressed(state);
    expect(third.bark).toBe('CHARM-BUTTON');
    expect(third.tooltipOverride).toBe('BUTTON DISCONNECTED BY DR. HADDY');
    expect(state.redButtonLockedOut).toBe(true);
  });

  it('fires CHARM-2D-SPRITE when circling >= 170 degrees around a 2D billboard sprite within 8m', () => {
    const state = createCharmDetectorState();
    const r = 4.0;
    const anglesDeg = [0, 45, 90, 135, 175];
    let triggered = null;
    for (const deg of anglesDeg) {
      const rad = (deg * Math.PI) / 180;
      triggered = notifyPlayerOrbiting2DSprite(
        state,
        'imp-1',
        Math.cos(rad) * r,
        Math.sin(rad) * r,
        0,
        0
      );
    }
    expect(triggered).toBe('CHARM-2D-SPRITE');
  });

  it('fires CHARM-3D-MOB, CHARM-RENAME, and CHARM-PAINT once when conditions are met', () => {
    const state = createCharmDetectorState();
    expect(notifyFirst3DPolygonMonsterSpawned(state)).toBe('CHARM-3D-MOB');
    expect(notifyFirst3DPolygonMonsterSpawned(state)).toBeNull();

    expect(notifyStudioDirtRenamed(state, 'Pizza')).toBe('CHARM-RENAME');
    expect(notifyBeamPaintNearTwinGate(state, 3.0, 2.0, 0, 0)).toBe('CHARM-PAINT');
  });
});
