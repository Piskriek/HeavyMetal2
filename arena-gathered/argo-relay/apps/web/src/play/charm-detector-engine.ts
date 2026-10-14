// ============================================================================
// File: apps/web/src/play/charm-detector-engine.ts
// Plan: Plan 29 (Runtime Trigger Engine for All 8 Dr. Haddy Charm Barks)
// Purity: 100% pure deterministic state machine with zero DOM/Three.js coupling.
// ============================================================================

import { isJokeDirtRename } from '../../../../packages/content/src/charm-and-act789';

export type CharmBarkId =
  | 'CHARM-WIREFRAME-FILL'
  | 'CHARM-BUTTON'
  | 'CHARM-2D-SPRITE'
  | 'CHARM-3D-MOB'
  | 'CHARM-BOUNDARY'
  | 'CHARM-RENAME'
  | 'CHARM-AIRTIME'
  | 'CHARM-PAINT';

export interface CharmDetectorState {
  firedBarks: Set<CharmBarkId>;
  redButtonPressCount: number;
  redButtonLockedOut: boolean;
  boundaryCrossTimestampsSec: number[];
  lastHudSkin: string;
  trackedSpriteId: string | null;
  spriteStartAngleRad: number;
  spriteCumulativeOrbitRad: number;
  lastSpriteAngleRad: number;
}

export function createCharmDetectorState(initialHudSkin = '0a'): CharmDetectorState {
  return {
    firedBarks: new Set<CharmBarkId>(),
    redButtonPressCount: 0,
    redButtonLockedOut: false,
    boundaryCrossTimestampsSec: [],
    lastHudSkin: initialHudSkin,
    trackedSpriteId: null,
    spriteStartAngleRad: 0,
    spriteCumulativeOrbitRad: 0,
    lastSpriteAngleRad: 0,
  };
}

/**
 * 1. CHARM-WIREFRAME-FILL & 5. CHARM-BOUNDARY
 * Evaluates HUD skin / stage transitions.
 */
export function notifyHudSkinTransition(
  state: CharmDetectorState,
  newSkin: string,
  nowSec: number
): CharmBarkId | null {
  if (newSkin === state.lastHudSkin) return null;

  const prevSkin = state.lastHudSkin;
  state.lastHudSkin = newSkin;

  // CHARM-WIREFRAME-FILL: First transition out of Stage 0a Wireframe into 0b 1-Bit Facets
  if (prevSkin === '0a' && newSkin === '0b' && !state.firedBarks.has('CHARM-WIREFRAME-FILL')) {
    state.firedBarks.add('CHARM-WIREFRAME-FILL');
    return 'CHARM-WIREFRAME-FILL';
  }

  // CHARM-BOUNDARY: Crossing a stage/HUD skin boundary 3 times within 6.0 seconds
  state.boundaryCrossTimestampsSec.push(nowSec);
  state.boundaryCrossTimestampsSec = state.boundaryCrossTimestampsSec.filter(
    (t) => nowSec - t <= 6.0
  );

  if (
    state.boundaryCrossTimestampsSec.length >= 3 &&
    !state.firedBarks.has('CHARM-BOUNDARY')
  ) {
    state.firedBarks.add('CHARM-BOUNDARY');
    return 'CHARM-BOUNDARY';
  }

  return null;
}

/**
 * 2. CHARM-BUTTON: Pressing the locked red emergency button 3 times after Act I wake.
 */
export function notifyRedEmergencyButtonPressed(
  state: CharmDetectorState
): { bark: CharmBarkId | null; tooltipOverride: string | null } {
  state.redButtonPressCount += 1;
  if (state.redButtonPressCount >= 3) {
    state.redButtonLockedOut = true;
    if (!state.firedBarks.has('CHARM-BUTTON')) {
      state.firedBarks.add('CHARM-BUTTON');
      return {
        bark: 'CHARM-BUTTON',
        tooltipOverride: 'BUTTON DISCONNECTED BY DR. HADDY',
      };
    }
    return { bark: null, tooltipOverride: 'BUTTON DISCONNECTED BY DR. HADDY' };
  }
  return { bark: null, tooltipOverride: null };
}

/**
 * 3. CHARM-2D-SPRITE: Circling >= 170 degrees around a 2D billboard sprite within 8m.
 */
export function notifyPlayerOrbiting2DSprite(
  state: CharmDetectorState,
  spriteId: string,
  playerX: number,
  playerZ: number,
  spriteX: number,
  spriteZ: number
): CharmBarkId | null {
  if (state.firedBarks.has('CHARM-2D-SPRITE')) return null;

  const dist = Math.hypot(playerX - spriteX, playerZ - spriteZ);
  if (dist > 8.0 || dist < 0.2) {
    state.trackedSpriteId = null;
    state.spriteCumulativeOrbitRad = 0;
    return null;
  }

  const angle = Math.atan2(playerZ - spriteZ, playerX - spriteX);
  if (state.trackedSpriteId !== spriteId) {
    state.trackedSpriteId = spriteId;
    state.spriteStartAngleRad = angle;
    state.lastSpriteAngleRad = angle;
    state.spriteCumulativeOrbitRad = 0;
    return null;
  }

  let delta = angle - state.lastSpriteAngleRad;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  state.spriteCumulativeOrbitRad += Math.abs(delta);
  state.lastSpriteAngleRad = angle;

  // 170 degrees = 2.967 radians
  if (state.spriteCumulativeOrbitRad >= (170 * Math.PI) / 180) {
    state.firedBarks.add('CHARM-2D-SPRITE');
    return 'CHARM-2D-SPRITE';
  }

  return null;
}

/**
 * 4. CHARM-3D-MOB: First Stage 2 .md1/.md2 3D polygon monster spawns.
 */
export function notifyFirst3DPolygonMonsterSpawned(
  state: CharmDetectorState
): CharmBarkId | null {
  if (state.firedBarks.has('CHARM-3D-MOB')) return null;
  state.firedBarks.add('CHARM-3D-MOB');
  return 'CHARM-3D-MOB';
}

/**
 * 6. CHARM-RENAME: Renaming "dirt" to a food or joke word in the Act V Studio schema.
 */
export function notifyStudioDirtRenamed(
  state: CharmDetectorState,
  newLabel: string
): CharmBarkId | null {
  if (state.firedBarks.has('CHARM-RENAME')) return null;
  if (isJokeDirtRename(newLabel)) {
    state.firedBarks.add('CHARM-RENAME');
    return 'CHARM-RENAME';
  }
  return null;
}

/**
 * 8. CHARM-PAINT: Painting with Beam Tool (Apply mode) within 6m of the Planet Twin Gate.
 */
export function notifyBeamPaintNearTwinGate(
  state: CharmDetectorState,
  hitX: number,
  hitZ: number,
  gateX: number,
  gateZ: number
): CharmBarkId | null {
  if (state.firedBarks.has('CHARM-PAINT')) return null;
  const dist = Math.hypot(hitX - gateX, hitZ - gateZ);
  if (dist <= 6.0) {
    state.firedBarks.add('CHARM-PAINT');
    return 'CHARM-PAINT';
  }
  return null;
}
