// ============================================================================
// File: apps/web/src/credits/ch/ch5-window-heal.ts
// TICKET-14 (Brief 33 Chapter Driver: ch5-window-heal)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch5WindowHeal: ChapterDriver = {
  id: 'ch5-window-heal',
  stage: 5,
  keyframes: {
    'SHOT-5A': {
      start: { pos: [38.0, 22.0, 25.0], lookAt: [55.0, -2.0, 58.0], fov: 64, worldTarget: 'moon' },
      end:   { pos: [24.0, 14.0, 48.0], lookAt: [58.0, -1.5, 62.0], fov: 60, worldTarget: 'moon' },
    },
    'SHOT-5B': {
      start: { pos: [-1.5, 1.7, 1.8], lookAt: [-3.5, 2.2, -5.8], fov: 58, worldTarget: 'lab' },
      end:   { pos: [-2.4, 1.7, -1.6], lookAt: [-3.8, 2.4, -6.0], fov: 62, worldTarget: 'lab' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    const isWindowShot = state.activeShot.id === 'SHOT-5B';
    scene.setFidelityStage?.(isWindowShot ? 5 : 4);
    scene.setBeamSealing?.(false);
    scene.setBeamHeld?.(false, 'extract');
    scene.debug?.setWaterVisible?.(true);
    scene.debug?.setCoverageActive?.(true);
    if (isWindowShot) {
      const p = Math.max(0, Math.min(1, (state.elapsedSec - state.activeShot.tStart) / Math.max(1, state.activeShot.tEnd - state.activeShot.tStart)));
      scene.debug?.setWindowView?.('full');
      scene.room?.setWindowView?.('full');
      scene.room?.setStorm?.(p);
    }
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'moon';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch5WindowHeal;
