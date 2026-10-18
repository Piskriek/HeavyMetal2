// ============================================================================
// File: apps/web/src/play/window-c-hooks.ts
// TICKET-13 (Window C): the pure hooks the play scene reads for the perimeter turret, the blue-sky push, the peaceful
// drops and the vehicle bay. The rules live in @hm/plotsim (testable with no DOM); this file re-exports them for the
// scene and the tests, and keeps the rover drive plan (POL-51) as data.
// POL-76 (the 1.9x stand-in scale) is closed: no 1.9x branch is left in gen-props.ts, so resolveGenMachineScale is gone.
// ============================================================================

export {
  BLUE_SKY_STAGE_FLOOR,
  canOperateHeavyTerraformer,
  evaluateHeavyProjectorBlueSkyPush,
  FABRICATOR_PLUME_HEX,
  GATE_DOME_RADIUS_M,
  HEAVY_PROJECTOR_WAVE_BAND_HEX,
  MODULAR_SCOUT_SOCKETS,
  PYLON_SAFE_DOME_RADIUS_M,
  sampleGantryTimeline,
  snapAerialToShellY,
  stepTurretBrain,
  TURRET_POWER_DRAW_KW,
  TURRET_SOCKET_CONSTANTS,
  USE_MODULAR_SCOUT,
  VEHICLE_FIT,
  verifyPeacefulDropParity,
} from '@hm/plotsim';
export { SCATTER_SIDEARM_PRESET } from '../base/weapons';

// ----------------------------------------------------------------------------
// POL-51: Crater & Wall Rover Drive Check Test Plan
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
