// ============================================================================
// File: packages/camerarig/src/rover-spring-arm.ts
// Brief: Brief 27 (P0-VEH-01 Rover Camera Clipping Fix & Hang-Time Tracker)
// ============================================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RoverCameraConfig {
  pivotHeightOffset: number;   // +1.4m above chassis center
  targetDistance: number;      // 5.5m behind pivot
  targetHeightOffset: number;  // +2.1m above pivot
  sphereRadius: number;        // 0.35m collision margin
  minGroundClearance: number;  // +0.65m hard floor clamp above sampleTerrainHeight(x, z)
  snapInTauSec: number;        // 0.025s fast pull-in on obstruction
  easeOutTauSec: number;       // 0.250s smooth ease-out when clear
  pitchFollowTauSec: number;   // 0.120s damped pitch horizon leveling
}

export const DEFAULT_ROVER_CAMERA_CONFIG: RoverCameraConfig = {
  pivotHeightOffset: 1.4,
  targetDistance: 5.5,
  targetHeightOffset: 2.1,
  sphereRadius: 0.35,
  minGroundClearance: 0.65,
  snapInTauSec: 0.025,
  easeOutTauSec: 0.25,
  pitchFollowTauSec: 0.12,
};

export interface RoverSpringArmState {
  currentDistance: number;
  dampedPitchRad: number;
  airborneSec: number;
  hasTriggeredAirtimeCharm: boolean;
}

export function createRoverSpringArmState(): RoverSpringArmState {
  return {
    currentDistance: DEFAULT_ROVER_CAMERA_CONFIG.targetDistance,
    dampedPitchRad: 0,
    airborneSec: 0,
    hasTriggeredAirtimeCharm: false,
  };
}

/**
 * Pure deterministic step for the Rover camera spring arm.
 * Guarantees camera.y >= sampleTerrainHeight(camera.x, camera.z) + minGroundClearance.
 */
export function stepRoverSpringArm(
  state: RoverSpringArmState,
  chassisPos: Vec3,
  chassisYawRad: number,
  chassisPitchRad: number,
  allWheelsAirborne: boolean,
  dt: number,
  sampleTerrainHeight: (x: number, z: number) => number,
  raycastObstacleDistance?: (origin: Vec3, dir: Vec3, maxDist: number) => number | null,
  cfg: RoverCameraConfig = DEFAULT_ROVER_CAMERA_CONFIG
): {
  cameraPos: Vec3;
  lookAtPos: Vec3;
  triggeredAirtimeBark: boolean;
} {
  // 1. Track airborne hang-time for CHARM-AIRTIME (>= 1.8s)
  let triggeredAirtimeBark = false;
  if (allWheelsAirborne) {
    state.airborneSec += dt;
    if (state.airborneSec >= 1.8 && !state.hasTriggeredAirtimeCharm) {
      state.hasTriggeredAirtimeCharm = true;
      triggeredAirtimeBark = true;
    }
  } else {
    state.airborneSec = 0;
  }

  // 2. Damp pitch follow (roll is strictly 0)
  const pitchAlpha = Math.min(1, dt / cfg.pitchFollowTauSec);
  state.dampedPitchRad += (chassisPitchRad - state.dampedPitchRad) * pitchAlpha;

  const pivot: Vec3 = {
    x: chassisPos.x,
    y: chassisPos.y + cfg.pivotHeightOffset,
    z: chassisPos.z,
  };

  // Backward unit vector from yaw and damped pitch
  const cosPitch = Math.cos(state.dampedPitchRad * 0.35);
  const backDir: Vec3 = {
    x: -Math.sin(chassisYawRad) * cosPitch,
    y: Math.sin(state.dampedPitchRad * 0.35),
    z: -Math.cos(chassisYawRad) * cosPitch,
  };

  // 3. Sphere-cast / raycast obstruction check
  let desiredDist = cfg.targetDistance;
  if (raycastObstacleDistance) {
    const hitDist = raycastObstacleDistance(pivot, backDir, cfg.targetDistance);
    if (hitDist !== null && hitDist < cfg.targetDistance) {
      desiredDist = Math.max(1.1, hitDist - cfg.sphereRadius);
    }
  }

  const distTau = desiredDist < state.currentDistance ? cfg.snapInTauSec : cfg.easeOutTauSec;
  const distAlpha = Math.min(1, dt / distTau);
  state.currentDistance += (desiredDist - state.currentDistance) * distAlpha;

  const rawCamX = pivot.x + backDir.x * state.currentDistance;
  const rawCamZ = pivot.z + backDir.z * state.currentDistance;
  const rawCamY = pivot.y + cfg.targetHeightOffset + backDir.y * state.currentDistance;

  // 4. Hard Heightfield Floor Clamp (fixes 12-rover-driving.jpg underground camera clipping)
  const groundY = sampleTerrainHeight(rawCamX, rawCamZ);
  const clampedCamY = Math.max(rawCamY, groundY + cfg.minGroundClearance);

  return {
    cameraPos: { x: rawCamX, y: clampedCamY, z: rawCamZ },
    lookAtPos: {
      x: pivot.x + Math.sin(chassisYawRad) * 2.5,
      y: pivot.y + 0.25,
      z: pivot.z + Math.cos(chassisYawRad) * 2.5,
    },
    triggeredAirtimeBark,
  };
}
