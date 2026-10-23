// ============================================================================
// File: packages/plotsim/src/vehicle-bay.ts
// TASK-32 / TICKET-13 (Item c & f — P1-VEH-04, P1-LOOP-04, POL-50):
// - Pure 3.0 s Vehicle Fabricator Gantry assembly timeline for Scout & Hauler
// - Rear modular sockets: Scout gets 1 ('linked-ore-bin' | 'sync-beacon');
//   Hauler gets 3 ('bulk-ore-pod' | 'linked-ore-bin' | 'sync-beacon' | 'perimeter-turret')
// - Heavy Terraformer 8 m (2x2 foundation) hardpoint & linked-bin feed check
// - POL-50 MODULAR_SCOUT_SOCKETS & VEHICLE_FIT constants
// - 100% pure & deterministic: no DOM, no Date.now(), no Math.random()
// ============================================================================

import type { HeavyKind } from './index';

export const GANTRY_PRINT_DURATION_S = 3.0;
export const GANTRY_LASER_HEX = '#7cff4d' as const;
/** Per ARGO_NOTE_16 Plume Ruling #4: Base/Vehicle Fabricator pours Synthesis Violet (#b46bff) while printing. */
export const FABRICATOR_PLUME_HEX = '#b46bff' as const;
export const FABRICATOR_LIVE_PIXELS = 128;

export type PrintableVehicleKind = 'scout' | 'hauler' | 'crawler';

export type GantryAssemblyPhase = 'idle' | 'chassis-lock' | 'suspension-and-cab' | 'socket-and-settle' | 'complete';

export interface GantryTimelineFrame {
  readonly vehicleKind: PrintableVehicleKind;
  readonly elapsedSec: number;
  readonly progress0to1: number;
  readonly phase: GantryAssemblyPhase;
  /** Longitudinal gantry bridge travel along the bay rails (-2.2 m rear to +2.2 m front). */
  readonly bridgeZ: number;
  /** Lateral print-head carriage sweep (-1.4 m to +1.4 m). */
  readonly headX: number;
  /** Vertical nozzle elevation above the pad (1.25 m to 3.40 m). */
  readonly headY: number;
  /** Bottom-to-top vehicle reveal clip height (0..1). */
  readonly clipHeight0to1: number;
  /** 4 cm damped settle spring vertical offset (m) after the 3.0 s print completes. */
  readonly settleOffsetM: number;
  readonly laserActive: boolean;
  readonly laserColour: typeof GANTRY_LASER_HEX;
  readonly plumeColour: typeof FABRICATOR_PLUME_HEX;
  readonly plumeCount: number;
  readonly complete: boolean;
}

/**
 * Pure 3.0-second gantry assembly timeline for printing a Scout Rover or Heavy Hauler.
 */
export function sampleGantryTimeline(
  elapsedSec: number,
  vehicleKind: PrintableVehicleKind = 'scout',
): GantryTimelineFrame {
  const t = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  const progress0to1 = Number(Math.min(1, t / GANTRY_PRINT_DURATION_S).toFixed(4));
  const complete = t >= GANTRY_PRINT_DURATION_S;

  let phase: GantryAssemblyPhase;
  let bridgeZ: number;
  let headX: number;
  let headY: number;
  let clipHeight0to1: number;

  if (t <= 0) {
    phase = 'idle';
    bridgeZ = -2.2;
    headX = 0;
    headY = 3.4;
    clipHeight0to1 = 0;
  } else if (t < 1.0) {
    // Phase 1 (0.0 .. 1.0 s): Chassis frame lock, bridge travels from -2.2 m to 0.0 m
    phase = 'chassis-lock';
    const u = t / 1.0;
    bridgeZ = -2.2 + 2.2 * u;
    headX = Math.sin(u * Math.PI * 4) * 1.1;
    headY = 1.35 + 0.45 * u;
    clipHeight0to1 = 0.4 * u;
  } else if (t < 2.2) {
    // Phase 2 (1.0 .. 2.2 s): Suspension & empty cab with [-u-] yoke, bridge travels 0.0 m to +2.2 m
    phase = 'suspension-and-cab';
    const u = (t - 1.0) / 1.2;
    bridgeZ = 2.2 * u;
    headX = Math.sin(u * Math.PI * 6) * 1.35;
    headY = 1.8 + 0.75 * u;
    clipHeight0to1 = 0.4 + 0.48 * u;
  } else if (!complete) {
    // Phase 3 (2.2 .. 3.0 s): Aerial & rear socket weld, gantry retracts to -2.2 m
    phase = 'socket-and-settle';
    const u = (t - 2.2) / 0.8;
    bridgeZ = 2.2 - 4.4 * u;
    headX = Math.sin((1 - u) * Math.PI * 2) * 0.6;
    headY = 2.55 + 0.85 * u;
    clipHeight0to1 = 0.88 + 0.12 * u;
  } else {
    phase = 'complete';
    bridgeZ = -2.2;
    headX = 0;
    headY = 3.4;
    clipHeight0to1 = 1.0;
  }

  // 4 cm damped settle spring after t >= 3.0 s (matches print-sweep.ts 5 Hz, zeta 0.5)
  let settleOffsetM = 0.04;
  if (complete) {
    const uS = t - GANTRY_PRINT_DURATION_S;
    const w = 2 * Math.PI * 5;
    const z = 0.5;
    const wd = w * Math.sqrt(1 - z * z);
    settleOffsetM = Number((0.04 * Math.exp(-z * w * uS) * (Math.cos(wd * uS) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * uS))).toFixed(5));
    if (Math.abs(settleOffsetM) < 0.0005) settleOffsetM = 0;
  }

  return {
    vehicleKind,
    elapsedSec: t,
    progress0to1,
    phase,
    bridgeZ: Number(bridgeZ.toFixed(3)),
    headX: Number(headX.toFixed(3)),
    headY: Number(headY.toFixed(3)),
    clipHeight0to1: Number(clipHeight0to1.toFixed(4)),
    settleOffsetM,
    laserActive: t > 0 && !complete,
    laserColour: GANTRY_LASER_HEX,
    plumeColour: FABRICATOR_PLUME_HEX,
    plumeCount: t > 0 && !complete ? FABRICATOR_LIVE_PIXELS : 0,
    complete,
  };
}

// ----------------------------------------------------------------------------
// Rear Cargo & Utility Sockets (Scout: 1 socket, Hauler: 3 sockets)
// ----------------------------------------------------------------------------

export const SCOUT_REAR_SOCKET_COUNT = 1;
export const HAULER_REAR_SOCKET_COUNT = 3;
export const BEACON_SAFE_DOME_RADIUS_M = 15.0;

export type VehicleSocketModule =
  | 'linked-ore-bin'
  | 'sync-beacon'
  | 'bulk-ore-pod'
  | 'perimeter-turret';

export interface VehicleSocketSpec {
  readonly index: number;
  readonly id: string;
  readonly offsetM: readonly [number, number, number];
  readonly allowedModules: readonly VehicleSocketModule[];
}

export const SCOUT_REAR_SOCKETS: readonly VehicleSocketSpec[] = Object.freeze([
  {
    index: 0,
    id: 'scout-rear-0',
    offsetM: [0.0, 0.92, -1.45],
    allowedModules: ['linked-ore-bin', 'sync-beacon'],
  },
]);

export const HAULER_REAR_SOCKETS: readonly VehicleSocketSpec[] = Object.freeze([
  {
    index: 0,
    id: 'hauler-rear-0',
    offsetM: [0.0, 1.15, -0.65],
    allowedModules: ['bulk-ore-pod', 'linked-ore-bin', 'sync-beacon', 'perimeter-turret'],
  },
  {
    index: 1,
    id: 'hauler-rear-1',
    offsetM: [0.0, 1.15, -1.55],
    allowedModules: ['bulk-ore-pod', 'linked-ore-bin', 'sync-beacon', 'perimeter-turret'],
  },
  {
    index: 2,
    id: 'hauler-rear-2',
    offsetM: [0.0, 1.15, -2.45],
    allowedModules: ['bulk-ore-pod', 'linked-ore-bin', 'sync-beacon', 'perimeter-turret'],
  },
]);

export interface VehicleLoadoutState {
  readonly kind: 'scout' | 'hauler';
  readonly slots: readonly (VehicleSocketModule | null)[];
}

export function createVehicleLoadout(kind: 'scout' | 'hauler'): VehicleLoadoutState {
  const count = kind === 'scout' ? SCOUT_REAR_SOCKET_COUNT : HAULER_REAR_SOCKET_COUNT;
  return {
    kind,
    slots: Array.from({ length: count }, () => null),
  };
}

export function attachVehicleSocketModule(
  state: VehicleLoadoutState,
  slotIndex: number,
  module: VehicleSocketModule,
): { readonly ok: boolean; readonly state: VehicleLoadoutState; readonly reason?: string } {
  const specs = state.kind === 'scout' ? SCOUT_REAR_SOCKETS : HAULER_REAR_SOCKETS;
  const spec = specs[slotIndex];
  if (!spec) {
    return { ok: false, state, reason: `Invalid socket index ${slotIndex} for ${state.kind}` };
  }
  if (!spec.allowedModules.includes(module)) {
    return { ok: false, state, reason: `Module ${module} is not supported on ${spec.id}` };
  }
  const nextSlots = [...state.slots];
  nextSlots[slotIndex] = module;
  return { ok: true, state: { ...state, slots: nextSlots } };
}

export function evaluateVehicleSocketEffects(state: VehicleLoadoutState): {
  readonly linkedBridgeBinActive: boolean;
  readonly safeDomeRadiusM: number;
  readonly extraOreCapacity: number;
  readonly mountedTurretCount: number;
} {
  let linkedBridgeBinActive = false;
  let safeDomeRadiusM = 0;
  let extraOreCapacity = 0;
  let mountedTurretCount = 0;

  for (const mod of state.slots) {
    if (mod === 'linked-ore-bin') {
      linkedBridgeBinActive = true;
      extraOreCapacity += 200;
    } else if (mod === 'sync-beacon') {
      safeDomeRadiusM = Math.max(safeDomeRadiusM, BEACON_SAFE_DOME_RADIUS_M);
    } else if (mod === 'bulk-ore-pod') {
      extraOreCapacity += 600;
    } else if (mod === 'perimeter-turret') {
      mountedTurretCount += 1;
    }
  }

  return {
    linkedBridgeBinActive,
    safeDomeRadiusM,
    extraOreCapacity,
    mountedTurretCount,
  };
}

// ----------------------------------------------------------------------------
// P1-LOOP-04: Heavy Terraformer 8 m (2x2 Foundation) Hardpoint & Bin Feed Check
// ----------------------------------------------------------------------------

export interface HeavyHardpointCheckInput {
  readonly kind: HeavyKind;
  readonly onSnapped2x2Hardpoint: boolean;
  readonly hardpointWidthM: number;
  readonly hasLinkedBinFeed: boolean;
  readonly availableOreInBin: number;
}

export function canOperateHeavyTerraformer(input: HeavyHardpointCheckInput): {
  readonly canPlace: boolean;
  readonly canRun: boolean;
  readonly hasFeedHopper: boolean;
  readonly livePlumeCount: number;
  readonly triggersBlueSkyWave: boolean;
  readonly reason: string | null;
} {
  if (!input.onSnapped2x2Hardpoint || input.hardpointWidthM < 8.0) {
    return {
      canPlace: false,
      canRun: false,
      hasFeedHopper: false,
      livePlumeCount: 0,
      triggersBlueSkyWave: false,
      reason: 'Requires an 8 m (2x2 foundation) Heavy Hardpoint.',
    };
  }

  // Per ARGO_NOTE_16 Plume Ruling #3: heavy-projector is a pure photon emitter (no feed hopper needed);
  // heavy-mill, heavy-press, and heavy-water require a linked bin feed.
  const hasFeedHopper = input.kind !== 'heavy-projector';
  const feedOk = !hasFeedHopper || (input.hasLinkedBinFeed && input.availableOreInBin > 0);
  const livePlumeCount = !feedOk
    ? 0
    : input.kind === 'heavy-projector'
      ? 200
      : 180;

  return {
    canPlace: true,
    canRun: feedOk,
    hasFeedHopper,
    livePlumeCount,
    triggersBlueSkyWave: input.kind === 'heavy-projector' && feedOk,
    reason: feedOk ? null : 'Waiting for Linked Bin substrate feed.',
  };
}

// ----------------------------------------------------------------------------
// POL-50: Modular Scout Sockets (Raycast Aerial, [-u-] Empty-Cab Yoke, VEHICLE_FIT)
// ----------------------------------------------------------------------------

export const USE_MODULAR_SCOUT = true;

export const MODULAR_SCOUT_SOCKETS = Object.freeze({
  /** Local (x, z) on the top rear shell where the whip aerial raycasts down (-Y) onto the mesh. */
  aerialRaycastOrigin: Object.freeze([-0.52, 2.5, -0.88] as const),
  aerialEmbedDepthM: 0.015,
  /** Square [-u-] steering yoke mounted inside the empty cab (Rule 12). */
  cabYokePose: Object.freeze({
    pos: Object.freeze([0.0, 0.78, 0.42] as const),
    pitchRad: -0.28,
    scale: 1.0,
  }),
  rearCargoSocket: SCOUT_REAR_SOCKETS[0]!,
});

export const VEHICLE_FIT = Object.freeze({
  scout: Object.freeze({
    lengthM: 3.4,
    widthM: 1.9,
    heightM: 1.65,
    wheelBaseM: 2.3,
    trackWidthM: 1.68,
    wheelRadiusM: 0.42,
    suspensionRestM: 0.32,
    suspensionTravelM: 0.22,
    cameraFloorClearanceM: 0.65,
  }),
  hauler: Object.freeze({
    lengthM: 6.2,
    widthM: 2.8,
    heightM: 2.45,
    wheelBaseM: 4.1,
    trackWidthM: 2.48,
    wheelRadiusM: 0.58,
    suspensionRestM: 0.44,
    suspensionTravelM: 0.28,
    cameraFloorClearanceM: 0.65,
  }),
});

/**
 * Pure helper for POL-50: snaps the Scout's aerial Y to the raycasted shell surface height
 * minus a 1.5 cm embed so the aerial base never floats (Rule 10).
 */
export function snapAerialToShellY(raycastHitY: number | null, fallbackShellY = 1.38): number {
  const surfaceY = raycastHitY !== null && Number.isFinite(raycastHitY) ? raycastHitY : fallbackShellY;
  return Number((surfaceY - MODULAR_SCOUT_SOCKETS.aerialEmbedDepthM).toFixed(4));
}
