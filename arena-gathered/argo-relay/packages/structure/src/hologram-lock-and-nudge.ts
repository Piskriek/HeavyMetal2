// ============================================================================
// File: packages/structure/src/hologram-lock-and-nudge.ts
// Plan: Plan 16 (P2-UI-06 Hologram Lock [H], Arrow-Key Nudge & 100% Refund Demolish)
// Purity: 100% pure deterministic state machine for @hm/structure.
// ============================================================================

export interface BuildHologramState {
  pieceId: string;
  isLocked: boolean;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  nudgeX: number;
  nudgeY: number;
  nudgeZ: number;
  yawDeg: number; // 0, 45, 90, 135, 180, 225, 270, 315
}

export const MAX_NUDGE_RADIUS_M = 8.0;

export function createBuildHologramState(
  pieceId: string,
  raycastX = 0,
  raycastY = 0,
  raycastZ = 0
): BuildHologramState {
  return {
    pieceId,
    isLocked: false,
    anchorX: raycastX,
    anchorY: raycastY,
    anchorZ: raycastZ,
    nudgeX: 0,
    nudgeY: 0,
    nudgeZ: 0,
    yawDeg: 0,
  };
}

/**
 * Toggles [H] Hologram Lock. Locking freezes the current anchor and resets nudge offset.
 */
export function toggleHologramLock(state: BuildHologramState): BuildHologramState {
  if (!state.isLocked) {
    return { ...state, isLocked: true, nudgeX: 0, nudgeY: 0, nudgeZ: 0 };
  }
  return {
    ...state,
    isLocked: false,
    anchorX: state.anchorX + state.nudgeX,
    anchorY: state.anchorY + state.nudgeY,
    anchorZ: state.anchorZ + state.nudgeZ,
    nudgeX: 0,
    nudgeY: 0,
    nudgeZ: 0,
  };
}

/**
 * Updates unlocked hologram anchor from crosshair raycast; no-op when locked with [H].
 */
export function updateHologramRaycast(
  state: BuildHologramState,
  hitX: number,
  hitY: number,
  hitZ: number
): BuildHologramState {
  if (state.isLocked) return state;
  return { ...state, anchorX: hitX, anchorY: hitY, anchorZ: hitZ };
}

/**
 * Nudges a locked hologram by 0.5m (or 0.25m fine step when fineStep = true),
 * clamped to MAX_NUDGE_RADIUS_M (8.0m).
 */
export function nudgeLockedHologram(
  state: BuildHologramState,
  dirX: -1 | 0 | 1,
  dirZ: -1 | 0 | 1,
  dirY: -1 | 0 | 1 = 0,
  fineStep = false
): BuildHologramState {
  if (!state.isLocked) return state;
  const step = fineStep ? 0.25 : 0.5;
  const nextX = state.nudgeX + dirX * step;
  const nextY = state.nudgeY + dirY * step;
  const nextZ = state.nudgeZ + dirZ * step;

  if (Math.hypot(nextX, nextY, nextZ) > MAX_NUDGE_RADIUS_M) {
    return state;
  }
  return { ...state, nudgeX: nextX, nudgeY: nextY, nudgeZ: nextZ };
}

/**
 * Rotates hologram by 45 degrees ([R] key).
 */
export function rotateHologram45(state: BuildHologramState): BuildHologramState {
  return { ...state, yawDeg: (state.yawDeg + 45) % 360 };
}

export function getFinalHologramWorldTransform(state: BuildHologramState): {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
} {
  return {
    x: state.anchorX + state.nudgeX,
    y: state.anchorY + state.nudgeY,
    z: state.anchorZ + state.nudgeZ,
    yawDeg: state.yawDeg,
  };
}

/**
 * Rule 23: Demolishing any player-placed structure or machine with [F] returns 100% of its ore cost.
 */
export function computeDemolishRefund(originalOreCost: number): number {
  return Math.max(0, Math.round(originalOreCost));
}
