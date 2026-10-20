// ============================================================================
// File: apps/web/src/play/window-h-autotile-and-scout-hooks.ts
// TICKET-25 (Window H Hooks for `play-scene.ts` — POL-05, POL-50, POL-25, POL-52, POL-53, POL-60):
// Keeps `play-scene.ts` additions under 8 lines by housing the Modular Scout
// whip-aerial raycast & square [-u-] yoke mount, vista flash peak detector,
// and 47-tile Blob autotile sampler here.
// ============================================================================

import {
  BLOB_47_MASKS,
  blob47IndexForMask,
  computeSafeDomeGroundBand,
  computeScanRingHorizonFade,
  computeSuitCamEvOvershoot,
  evaluateBlob47SubtileBlend,
  HAULER_VEHICLE_FIT,
  MODULAR_SCOUT_SOCKETS,
  WATERMAKER_HARDPOINT_FIT,
} from '@hm/groundshader/blob47-autotile';

export {
  BLOB_47_MASKS,
  blob47IndexForMask,
  computeSafeDomeGroundBand,
  computeScanRingHorizonFade,
  computeSuitCamEvOvershoot,
  evaluateBlob47SubtileBlend,
  HAULER_VEHICLE_FIT,
  MODULAR_SCOUT_SOCKETS,
  WATERMAKER_HARDPOINT_FIT,
};

/**
 * POL-25: Detects the peak of a Lab window static flash (`flashLight >= 0.65`)
 * so the floor illumination capture triggers at the exact peak frame rather than
 * 0.3 s after the peak.
 */
export function isVistaFlashAtPeak(currentFlash01: number, previousFlash01: number): boolean {
  return currentFlash01 >= 0.65 && currentFlash01 >= previousFlash01;
}
