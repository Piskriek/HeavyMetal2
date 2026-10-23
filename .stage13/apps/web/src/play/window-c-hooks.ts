// ============================================================================
// File: apps/web/src/play/window-c-hooks.ts
// TASK-32 / TICKET-13:
// 1. Scatter Sidearm configuration (`SCATTER_SIDEARM_PRESET`: `weapon-frame` +
//    `core-burst` + `barrel-scatter`) for `weapons.ts`
// 2. First Heavy Light Projector "Blue Sky" Stage Wave trigger (`Ruling 06`)
// 3. POL-76 `createGenMachineProp` 1:1 normalized scale helper (removes 1.9x stand-in scaling)
// 4. POL-51 Crater & Wall Rover Drive Check automated test plan
// ============================================================================

import {
  canOperateHeavyTerraformer,
  FABRICATOR_PLUME_HEX,
  MODULAR_SCOUT_SOCKETS,
  sampleGantryTimeline,
  snapAerialToShellY,
  USE_MODULAR_SCOUT,
  VEHICLE_FIT,
} from '../../../../packages/plotsim/src/vehicle-bay';
import {
  stepTurretBrain,
  TURRET_POWER_DRAW_KW,
  TURRET_SOCKET_CONSTANTS,
} from '../../../../packages/plotsim/src/turret-brain';

export {
  canOperateHeavyTerraformer,
  FABRICATOR_PLUME_HEX,
  MODULAR_SCOUT_SOCKETS,
  sampleGantryTimeline,
  snapAerialToShellY,
  stepTurretBrain,
  TURRET_POWER_DRAW_KW,
  TURRET_SOCKET_CONSTANTS,
  USE_MODULAR_SCOUT,
  VEHICLE_FIT,
};

// ----------------------------------------------------------------------------
// Item (d): Scatter Sidearm Configuration (`weapons.ts` confirmation / preset)
// Square receiver (`weapon-frame`) + `core-burst` + round barrel (`barrel-scatter`)
// ----------------------------------------------------------------------------

export interface ScatterSidearmSpec {
  readonly id: 'sidearm-scatter';
  readonly name: 'Scatter Sidearm';
  readonly parts: {
    readonly frame: 'weapon-frame';
    readonly core: 'core-burst';
    readonly barrel: 'barrel-scatter';
  };
  readonly pellets: number;
  readonly spreadRad: number;
  readonly damagePerPellet: number;
  readonly burst: number;
  readonly burstGap: number;
  readonly cooldown: number;
  readonly magazine: number;
  readonly range: number;
}

export const SCATTER_SIDEARM_PRESET: ScatterSidearmSpec = Object.freeze({
  id: 'sidearm-scatter',
  name: 'Scatter Sidearm',
  parts: Object.freeze({
    frame: 'weapon-frame',
    core: 'core-burst',
    barrel: 'barrel-scatter',
  }),
  pellets: 7,
  spreadRad: 0.14,
  damagePerPellet: 6,
  burst: 2,
  burstGap: 0.09,
  cooldown: 0.55,
  magazine: 12,
  range: 18,
});

// ----------------------------------------------------------------------------
// Item (e): Ruling 06 — First Heavy Light Projector "Blue Sky" Stage Wave Push
// ----------------------------------------------------------------------------

export const HEAVY_PROJECTOR_WAVE_BAND_HEX = '#ffc13d' as const;
export const BLUE_SKY_STAGE_FLOOR = 4;

export function evaluateHeavyProjectorBlueSkyPush(input: {
  readonly heavyProjectorsRunning: number;
  readonly hadHeavyProjectorBefore: boolean;
  readonly currentStage: number;
  readonly projectorPos: { readonly x: number; readonly z: number };
}): {
  readonly shouldTriggerBlueSkyWave: boolean;
  readonly targetStage: number;
  readonly waveOrigin: { readonly x: number; readonly z: number };
  readonly waveBandColourHex: typeof HEAVY_PROJECTOR_WAVE_BAND_HEX;
} {
  const trigger = input.heavyProjectorsRunning >= 1 && !input.hadHeavyProjectorBefore;
  return {
    shouldTriggerBlueSkyWave: trigger,
    targetStage: trigger ? Math.max(BLUE_SKY_STAGE_FLOOR, input.currentStage) : input.currentStage,
    waveOrigin: input.projectorPos,
    waveBandColourHex: HEAVY_PROJECTOR_WAVE_BAND_HEX,
  };
}

// ----------------------------------------------------------------------------
// Item (f) POL-76: Clean up `createGenMachineProp` (1:1 registry.json scale, no 1.9x)
// ----------------------------------------------------------------------------

export const GEN_MACHINE_NORMALIZED_SCALE = 1.0;

/**
 * POL-76 Ruling: Delete the legacy 1.9x stand-in scale branch in `createGenMachineProp`.
 * Every generated model in `registry.json` (`heavy-press`, `heavy-projector`, `heavy-water`,
 * `heavy-mill`, `vehicle-fabricator-gantry`, and field machines) is already baked to its
 * exact metric bounding box, so generated props always mount at 1.0 scale.
 */
export function resolveGenMachineScale(_kind: string): number {
  return GEN_MACHINE_NORMALIZED_SCALE;
}

// ----------------------------------------------------------------------------
// Item (f) POL-51: Crater & Wall Rover Drive Check Test Plan
// ----------------------------------------------------------------------------

export interface RoverDriveCheckStep {
  readonly stepId: string;
  readonly action: string;
  readonly assertion: string;
}

export const POL51_ROVER_DRIVE_TEST_PLAN: readonly RoverDriveCheckStep[] = Object.freeze([
  {
    stepId: 'POL51-01-FABRICATE-SCOUT',
    action: 'Place 2x2 hardpoint + Vehicle Fabricator Gantry, print Scout Rover (3.0 s gantry timeline), and press E to enter cab.',
    assertion: 'USE_MODULAR_SCOUT === true; [-u-] yoke present in empty cab; aerial snapped to shell with 0 floating gap.',
  },
  {
    stepId: 'POL51-02-CRATER-RIM-JUMP',
    action: 'Carve a 3.5 m deep crater with Beam Sculpt mode, drive Scout at full throttle (14 m/s) down into and over the crater lip.',
    assertion: 'camera.position.y >= sampleTerrainHeight(camX, camZ) + 0.65 on every frame; 0 frames with underground camera clipping.',
  },
  {
    stepId: 'POL51-03-WALL-COLLISION-REBOUND',
    action: 'Place a snapped Foundation + Wall piece ahead of the Scout and drive into the wall at 45 deg and 90 deg.',
    assertion: 'Rover chassis rebounds cleanly off the wall collider without tunnelling or pitching camera below floor.',
  },
]);
