// ============================================================================
// File: apps/web/src/credits/ch/ch7-outro-loop.ts
// TICKET-14 (Brief 33 Chapter Driver: ch7-outro-loop)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch7OutroLoop: ChapterDriver = {
  id: 'ch7-outro-loop',
  stage: 6,
  keyframes: {
    'SHOT-7A': {
      start: { pos: [-0.4, 1.75, 3.8], lookAt: [0.2, 1.8, -4.5], fov: 60, worldTarget: 'diptych' },
      end:   { pos: [0.4, 1.78, 3.6], lookAt: [0.2, 1.8, -4.5], fov: 60, worldTarget: 'diptych' },
    },
  },
  apply(scene, _state, eye, lookAt) {
    if (!scene) return;
    scene.setFidelityStage?.(6);
    scene.debug?.setWindowView?.('full');
    scene.room?.setWindowView?.('full');
    scene.room?.setStorm?.(1);
    scene.setLabActivity?.({ bench: 1, combiner: 1, rack: 1 });
    applyCameraToScene(scene, 'diptych', eye, lookAt);
  },
};

export default ch7OutroLoop;
