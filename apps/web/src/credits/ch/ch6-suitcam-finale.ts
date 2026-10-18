// ============================================================================
// File: apps/web/src/credits/ch/ch6-suitcam-finale.ts
// TICKET-14 (Brief 33 Chapter Driver: ch6-suitcam-finale)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch6SuitcamFinale: ChapterDriver = {
  id: 'ch6-suitcam-finale',
  stage: 6,
  keyframes: {
    'SHOT-6A': {
      start: { pos: [3.0, 1.7, -0.5], lookAt: [3.0, 1.7, -6.0], fov: 68, worldTarget: 'lab' },
      end:   { pos: [0.0, 1.75, 18.0], lookAt: [12.0, 3.5, 52.0], fov: 70, worldTarget: 'moon' },
    },
    'SHOT-6B': {
      start: { pos: [0.0, 6.0, -6.0], lookAt: [0.0, 4.0, 120.0], fov: 64, worldTarget: 'moon' },
      end:   { pos: [0.0, 28.0, -18.0], lookAt: [0.0, 8.0, 420.0], fov: 68, worldTarget: 'moon' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    scene.setFidelityStage?.(6);
    scene.setCameraView?.(state.activeShot.id === 'SHOT-6B' ? 'third' : 'first');
    scene.debug?.setWaterVisible?.(true);
    scene.debug?.setCoverageActive?.(true);
    scene.room?.setStorm?.(1);
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'moon';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch6SuitcamFinale;
