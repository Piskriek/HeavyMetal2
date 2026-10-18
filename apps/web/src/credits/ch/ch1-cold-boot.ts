// ============================================================================
// File: apps/web/src/credits/ch/ch1-cold-boot.ts
// TICKET-14 (Brief 33 Chapter Driver: ch1-cold-boot)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch1ColdBoot: ChapterDriver = {
  id: 'ch1-cold-boot',
  stage: 0,
  keyframes: {
    'SHOT-1A': {
      start: { pos: [0.0, 1.5, 2.2], lookAt: [0.0, 6.5, 0.0], fov: 65, worldTarget: 'lab' },
      end:   { pos: [2.8, 1.65, 1.4], lookAt: [5.5, 1.5, -2.5], fov: 58, worldTarget: 'lab' },
    },
    'SHOT-1B': {
      start: { pos: [1.8, 1.65, 1.2], lookAt: [3.2, 1.65, -2.8], fov: 58, worldTarget: 'lab' },
      end:   { pos: [0.0, 1.8, 6.5], lookAt: [0.0, 1.6, 28.0], fov: 62, worldTarget: 'moon' },
    },
    'SHOT-1C': {
      start: { pos: [-5.5, 1.4, 9.0], lookAt: [2.0, 1.5, 12.0], fov: 55, worldTarget: 'moon' },
      end:   { pos: [5.5, 2.2, 8.5], lookAt: [0.0, 1.8, 12.0], fov: 55, worldTarget: 'moon' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    scene.setFidelityStage?.(0);
    scene.setCameraView?.(state.activeShot.id === 'SHOT-1C' ? 'third' : 'first');
    scene.setBeamHeld?.(false, 'extract');
    scene.setLabActivity?.({ bench: 0, combiner: 0, rack: 0 });
    scene.room?.setStorm?.(0);
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'lab';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch1ColdBoot;
