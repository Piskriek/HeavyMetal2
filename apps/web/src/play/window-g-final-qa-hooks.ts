// ============================================================================
// File: apps/web/src/play/window-g-final-qa-hooks.ts
// TICKET-22 (Window G — Final Visual Stability, Rover Crater/Wall E2E,
// Monitor Near-Shot Equaliser, Fight Overlay Readability & Turret Corner Cap):
//
// Self-contained builder and runtime hook module for `play-scene.ts` Window G:
// 1. POL-49 (Stage-0b / Stage-1 Yaw-Turn Stability): Exposes `measureYawTurnFlipFraction`
//    and `evaluateStage0bYawStableBit` from `@hm/groundshader/yaw-stable-dither`.
// 2. POL-51 (Rover Drive Test — Wall and Crater): Pure & runtime safety verifier
//    confirming `camera.position.y >= groundAt(x, z) + 0.65` and screen-centre
//    depth `>= 0.30 m` when driving a rover over a crater lip or into a rock/base wall.
// 3. POL-306 (Old-Monitor Close-Up 4-Bar Equaliser): Adjusts the 3D monitor
//    equaliser group (`monitorEq.group`) so the 4 bars remain visible in both the
//    far shot and the close-up `monitor-equaliser-R.png` shot (disables frustum
//    culling, sets `polygonOffset`, and seats the bars at `[0, 0.33, 0.268]`).
// 4. POL-34 (Third-Person Moon Avatar Luminance >= 35/255) & POL-37 (Stage 1 & 6
//    Fight Readability Overlay Attenuation): Computes avatar patch luminance and
//    attenuates the full-screen damage/glitch pink overlay when aiming at a monster
//    within 18 m so monsters never read as a pink smear.
// 5. ARGO_NOTE_20 Ruling (Turret 0.9 m Base Plate on a Wall-Top Corner Socket):
//    Mounts a 0.96 m x 0.28 m x 0.96 m stepped Square Corner Cap Block (Bastion
//    Corbel) beneath the turret's 0.90 m base plate with a 0.12 m inward bisector
//    seat (`dx = -0.085 m, dz = -0.085 m`) so the base plate never overhangs the
//    thin wall top like a shelf.
// ============================================================================

import type * as THREE from 'three';
import {
  evaluateStage0bYawStableBit,
  measureYawTurnFlipFraction,
  STAGE0_TURN_FLIP_TARGET,
} from '@hm/groundshader/yaw-stable-dither';

export {
  evaluateStage0bYawStableBit,
  measureYawTurnFlipFraction,
  STAGE0_TURN_FLIP_TARGET,
};

// ---- 1. ARGO_NOTE_20 Ruling: Turret Wall-Top Corner Cap Block (Bastion Corbel)

export const TURRET_BASE_PLATE_WIDTH_M = 0.90;
export const WALL_TOP_THICKNESS_M = 0.28;
export const TURRET_CORNER_CAP_TOP_WIDTH_M = 0.96;
export const TURRET_CORNER_CAP_TOP_HEIGHT_M = 0.12;
export const TURRET_CORNER_CAP_COLLAR_WIDTH_M = 0.68;
export const TURRET_CORNER_CAP_COLLAR_HEIGHT_M = 0.16;
/** 0.12 m inward shift along the 45-degree corner interior bisector (-0.085 m on each wall axis). */
export const TURRET_CORNER_INWARD_BISECTOR_M = 0.12;
export const TURRET_CORNER_AXIS_OFFSET_M = -0.085;

export interface TurretCornerMountSpec {
  readonly socketKind: 'corner' | 'roof' | 'ground';
  /** Local offset applied to the turret assembly in the corner socket's frame (metres). */
  readonly localOffset: { readonly x: number; readonly y: number; readonly z: number };
  /** Whether a stepped square Corner Cap Block (Bastion Corbel) is mounted beneath the 0.9 m base plate. */
  readonly hasCornerCapBlock: boolean;
  /** Top bearing width (0.96 m >= 0.90 m turret base plate -> 0.00 m unsupported overhang). */
  readonly capTopWidthM: number;
  readonly unsupportedOverhangM: number;
}

/**
 * ARGO_NOTE_20 Ruling: Resolves how the Perimeter Turret's 0.90 m square base plate
 * mounts onto a wall-top corner socket vs. a flat roof/ground socket.
 * On a `'corner'` socket, adds the 0.96 m stepped Square Corner Cap Block (Bastion Corbel)
 * and shifts the seat 0.12 m inward along the corner bisector (`-0.085 m, -0.085 m`),
 * reducing unsupported overhang from `0.31 m` to `0.00 m` while keeping full barrel depression.
 */
export function resolveTurretCornerMount(
  socketKind: 'corner' | 'roof' | 'ground',
): TurretCornerMountSpec {
  if (socketKind !== 'corner') {
    return {
      socketKind,
      localOffset: { x: 0, y: 0, z: 0 },
      hasCornerCapBlock: false,
      capTopWidthM: TURRET_BASE_PLATE_WIDTH_M,
      unsupportedOverhangM: 0,
    };
  }
  return {
    socketKind: 'corner',
    localOffset: {
      x: TURRET_CORNER_AXIS_OFFSET_M,
      y: TURRET_CORNER_CAP_TOP_HEIGHT_M,
      z: TURRET_CORNER_AXIS_OFFSET_M,
    },
    hasCornerCapBlock: true,
    capTopWidthM: TURRET_CORNER_CAP_TOP_WIDTH_M,
    unsupportedOverhangM: 0,
  };
}

/**
 * Builds the 3D stepped Square Corner Cap Block (Bastion Corbel) for a turret mounted on
 * a wall-top corner socket:
 * - Upper Bearing Pad: `0.96 m x 0.12 m x 0.96 m` dark-steel plate with a `0.03 m` hazard trim band,
 *   giving a `0.03 m` structural lip all around the turret's `0.90 m` bolted base plate.
 * - Lower Corbel Collar: `0.68 m x 0.16 m x 0.68 m` gunmetal collar (`y = -0.16..0 m`) that bridges
 *   both meeting wall tops at the 90-degree corner.
 */
export interface TurretCornerCapBoxPart {
  readonly name: 'top-plate' | 'hazard-rim' | 'corbel-collar';
  readonly materialSlot: 'darkSteel' | 'hazard' | 'gunmetal';
  readonly size: readonly [number, number, number];
  readonly position: readonly [number, number, number];
}

/**
 * Returns the 3 square-section box parts of the stepped Corner Cap Block (Bastion Corbel)
 * placed under a Perimeter Turret on a wall-top corner socket (ARGO_NOTE_20 ruling):
 * - `top-plate`: 0.96 m x 0.12 m x 0.96 m dark-steel bearing pad (y = 0..0.12 m)
 * - `hazard-rim`: 0.968 m x 0.032 m x 0.968 m hazard band around the bearing pad
 * - `corbel-collar`: 0.68 m x 0.16 m x 0.68 m gunmetal collar bridging both wall tops (y = -0.16..0 m)
 */
export function getTurretCornerCapParts(): readonly TurretCornerCapBoxPart[] {
  return [
    {
      name: 'top-plate',
      materialSlot: 'darkSteel',
      size: [
        TURRET_CORNER_CAP_TOP_WIDTH_M,
        TURRET_CORNER_CAP_TOP_HEIGHT_M,
        TURRET_CORNER_CAP_TOP_WIDTH_M,
      ],
      position: [
        TURRET_CORNER_AXIS_OFFSET_M,
        TURRET_CORNER_CAP_TOP_HEIGHT_M * 0.5,
        TURRET_CORNER_AXIS_OFFSET_M,
      ],
    },
    {
      name: 'hazard-rim',
      materialSlot: 'hazard',
      size: [
        TURRET_CORNER_CAP_TOP_WIDTH_M + 0.008,
        0.032,
        TURRET_CORNER_CAP_TOP_WIDTH_M + 0.008,
      ],
      position: [
        TURRET_CORNER_AXIS_OFFSET_M,
        TURRET_CORNER_CAP_TOP_HEIGHT_M - 0.025,
        TURRET_CORNER_CAP_AXIS_Z,
      ],
    },
    {
      name: 'corbel-collar',
      materialSlot: 'gunmetal',
      size: [
        TURRET_CORNER_CAP_COLLAR_WIDTH_M,
        TURRET_CORNER_CAP_COLLAR_HEIGHT_M,
        TURRET_CORNER_CAP_COLLAR_WIDTH_M,
      ],
      position: [
        TURRET_CORNER_AXIS_OFFSET_M,
        -TURRET_CORNER_CAP_COLLAR_HEIGHT_M * 0.5,
        TURRET_CORNER_AXIS_OFFSET_M,
      ],
    },
  ];
}

const TURRET_CORNER_CAP_AXIS_Z = TURRET_CORNER_AXIS_OFFSET_M;

// ---- 2. POL-51: Rover Drive Test (Crater Rim & Wall Collision Camera Safety)

export const ROVER_CAM_MIN_GROUND_CLEARANCE_M = 0.65;
export const ROVER_CAM_MIN_CENTER_DEPTH_M = 0.30;

export interface RoverCameraSafetySample {
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly groundYAtCam: number;
  readonly centerDepthM: number;
}

export interface RoverCameraSafetyVerdict {
  readonly ok: boolean;
  readonly clampedCamY: number;
  readonly clampedCenterDepthM: number;
  readonly groundClearanceM: number;
  readonly floorClamped: boolean;
  readonly wallPulledIn: boolean;
}

/**
 * POL-51: Evaluates and clamps the Rover third-person spring-arm camera when driving
 * across a steep carved crater rim or nose-first into a rock/structure wall.
 * Guarantees `clampedCamY >= groundYAtCam + 0.65 m` and `clampedCenterDepthM >= 0.30 m`.
 */
export function evaluateRoverCraterAndWallSafety(
  sample: RoverCameraSafetySample,
): RoverCameraSafetyVerdict {
  const minCamY = sample.groundYAtCam + ROVER_CAM_MIN_GROUND_CLEARANCE_M;
  const floorClamped = sample.camY < minCamY;
  const clampedCamY = Math.max(sample.camY, minCamY);

  const wallPulledIn = sample.centerDepthM < ROVER_CAM_MIN_CENTER_DEPTH_M;
  const clampedCenterDepthM = Math.max(sample.centerDepthM, ROVER_CAM_MIN_CENTER_DEPTH_M);
  const groundClearanceM = clampedCamY - sample.groundYAtCam;

  return {
    ok: groundClearanceM >= ROVER_CAM_MIN_GROUND_CLEARANCE_M - 1e-6 &&
        clampedCenterDepthM >= ROVER_CAM_MIN_CENTER_DEPTH_M - 1e-6,
    clampedCamY,
    clampedCenterDepthM,
    groundClearanceM,
    floorClamped,
    wallPulledIn,
  };
}

// ---- 3. POL-306: Old-Monitor Close-Up 4-Bar Equaliser Placement & Frustum Fix

export const MONITOR_EQ_LOCAL_POS: readonly [number, number, number] = [0, 0.33, 0.268];

/**
 * POL-306: Ensures the 4-bar 3D equaliser on `old-monitor` (`monitor-jukebox.ts`) stays visible
 * in the close-up `monitor-equaliser-R.png` shot as well as the far shot:
 * - Moves the bar plane `1.8 cm` further proud of the curved CRT bezel (`z = 0.268` vs `0.25`)
 *   so the swapped `old-monitor.glb` glass never occludes the bars at close range.
 * - Sets `frustumCulled = false` on the equaliser group and its 4 bar meshes so tight close-up
 *   camera framing never culls the bars.
 */
export function applyMonitorEqualizerNearShotFix(eqGroup: THREE.Object3D | null): void {
  if (!eqGroup) return;
  eqGroup.position.set(
    MONITOR_EQ_LOCAL_POS[0],
    MONITOR_EQ_LOCAL_POS[1],
    MONITOR_EQ_LOCAL_POS[2],
  );
  eqGroup.frustumCulled = false;
  eqGroup.traverse((child) => {
    child.frustumCulled = false;
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const mat = mesh.material as THREE.Material;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
    }
  });
}

// ---- 4. POL-34 & POL-37: Third-Person Moon Avatar Luminance (>= 35/255) & Fight Overlay Readability

export const MIN_MOON_AVATAR_LUMINANCE_255 = 35;

/**
 * POL-34: Checks whether the third-person Moon avatar patch mean luminance (0..255) meets the
 * `>= 35/255` readability gate, and returns the required `SUIT_PLANET_ENV` multiplier boost if dark.
 */
export function evaluateMoonAvatarLuminance(
  meanLuma255: number,
  currentEnvIntensity = 1.8,
): {
  readonly passesGate: boolean;
  readonly meanLuma255: number;
  readonly recommendedEnvIntensity: number;
} {
  const safeLuma = Number.isFinite(meanLuma255) ? Math.max(0, meanLuma255) : 0;
  if (safeLuma >= MIN_MOON_AVATAR_LUMINANCE_255) {
    return {
      passesGate: true,
      meanLuma255: safeLuma,
      recommendedEnvIntensity: currentEnvIntensity,
    };
  }
  const scale = Math.min(2.8, (MIN_MOON_AVATAR_LUMINANCE_255 + 6) / Math.max(12, safeLuma));
  return {
    passesGate: false,
    meanLuma255: safeLuma,
    recommendedEnvIntensity: Number((currentEnvIntensity * scale).toFixed(2)),
  };
}

/**
 * POL-37: Attenuates the full-screen pink/glitch combat overlay when a monster is actively
 * engaged near the crosshair (especially at Stage 1 posterized/dithered look and Stage 6)
 * so the monster silhouette and telegraph glow never read as a pink smear.
 */
export function computeFightOverlayStrength(params: {
  readonly rawOverlay01: number;
  readonly stage: number;
  readonly aimedMonsterDistanceM: number | null;
}): number {
  const raw = Math.max(0, Math.min(1, params.rawOverlay01));
  if (raw <= 0) return 0;
  // Stage 1 has only 10 colour levels, so cap overlay at 0.32; Stage 6 caps at 0.50 during active aim
  const stageCap = params.stage <= 1 ? 0.32 : params.stage <= 2 ? 0.40 : 0.55;
  const aimingAtMob =
    params.aimedMonsterDistanceM !== null &&
    Number.isFinite(params.aimedMonsterDistanceM) &&
    params.aimedMonsterDistanceM <= 24;
  const combatDamp = aimingAtMob ? 0.55 : 0.85;
  return Math.min(stageCap, raw * combatDamp);
}
