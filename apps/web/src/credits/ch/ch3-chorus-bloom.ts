// ============================================================================
// File: apps/web/src/credits/ch/ch3-chorus-bloom.ts
// TICKET-14 (Brief 33 Chapter Driver: ch3-chorus-bloom)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch3ChorusBloom: ChapterDriver = {
  id: 'ch3-chorus-bloom',
  stage: 2,
  keyframes: {
    'SHOT-3A': {
      start: { pos: [-14.0, 3.0, -8.0], lookAt: [0.0, 2.5, 14.0], fov: 60, worldTarget: 'moon' },
      end:   { pos: [14.0, 9.5, -4.0], lookAt: [0.0, 3.5, 16.0], fov: 64, worldTarget: 'moon' },
    },
    'SHOT-3B': {
      start: { pos: [8.0, 4.0, 18.0], lookAt: [-12.0, 1.5, 45.0], fov: 58, worldTarget: 'moon' },
      end:   { pos: [-6.0, 2.5, 26.0], lookAt: [10.0, 1.2, 55.0], fov: 58, worldTarget: 'moon' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    scene.setFidelityStage?.(2);
    scene.setBeamHeld?.(false, 'extract');
    scene.setBeamFiring?.(false);
    scene.debug?.setCoverageActive?.(true);
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'moon';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch3ChorusBloom;
