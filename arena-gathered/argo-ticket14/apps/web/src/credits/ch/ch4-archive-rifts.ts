// ============================================================================
// File: apps/web/src/credits/ch/ch4-archive-rifts.ts
// TICKET-14 (Brief 33 Chapter Driver: ch4-archive-rifts)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch4ArchiveRifts: ChapterDriver = {
  id: 'ch4-archive-rifts',
  stage: 3,
  keyframes: {
    'SHOT-4A': {
      start: { pos: [-24.0, 3.2, 65.0], lookAt: [-35.0, 2.2, 85.0], fov: 58, worldTarget: 'moon' },
      end:   { pos: [-16.0, 2.4, 72.0], lookAt: [-32.0, 2.0, 88.0], fov: 54, worldTarget: 'moon' },
    },
    'SHOT-4B': {
      start: { pos: [-45.0, 6.5, 78.0], lookAt: [-62.0, 8.2, 96.0], fov: 62, worldTarget: 'moon' },
      end:   { pos: [-52.0, 9.0, 84.0], lookAt: [-70.0, 6.5, 110.0], fov: 64, worldTarget: 'moon' },
    },
    'SHOT-4C': {
      start: { pos: [3.2, 1.6, 0.5], lookAt: [6.5, 1.5, 0.2], fov: 48, worldTarget: 'lab' },
      end:   { pos: [4.2, 1.7, 0.3], lookAt: [6.5, 1.55, 0.2], fov: 44, worldTarget: 'lab' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    scene.setFidelityStage?.(3);
    const sealing = state.activeShot.id === 'SHOT-4A';
    scene.setBeamHeld?.(sealing, 'extract');
    scene.setBeamSealing?.(sealing);
    scene.setLabActivity?.({ bench: 0, combiner: state.activeShot.id === 'SHOT-4C' ? 1 : 0, rack: 0 });
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'moon';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch4ArchiveRifts;
