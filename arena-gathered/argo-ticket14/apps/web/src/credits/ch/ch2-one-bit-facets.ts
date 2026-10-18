// ============================================================================
// File: apps/web/src/credits/ch/ch2-one-bit-facets.ts
// TICKET-14 (Brief 33 Chapter Driver: ch2-one-bit-facets)
// ============================================================================

import { applyCameraToScene, type ChapterDriver } from './types';

export const ch2OneBitFacets: ChapterDriver = {
  id: 'ch2-one-bit-facets',
  stage: 1,
  keyframes: {
    'SHOT-2A': {
      start: { pos: [0.0, 3.2, 14.0], lookAt: [0.0, 1.2, 34.0], fov: 60, worldTarget: 'moon' },
      end:   { pos: [-4.2, 1.8, 22.0], lookAt: [2.5, 1.0, 32.0], fov: 56, worldTarget: 'moon' },
    },
    'SHOT-2B': {
      start: { pos: [3.5, 1.6, 4.0], lookAt: [0.0, 1.4, 0.0], fov: 54, worldTarget: 'moon' },
      end:   { pos: [7.0, 2.8, 10.0], lookAt: [0.0, 1.5, 6.0], fov: 58, worldTarget: 'moon' },
    },
    'SHOT-2C': {
      start: { pos: [-2.2, 1.6, -1.0], lookAt: [-5.5, 1.5, -2.2], fov: 50, worldTarget: 'lab' },
      end:   { pos: [-3.4, 1.6, -1.4], lookAt: [-5.5, 1.5, -2.2], fov: 46, worldTarget: 'lab' },
    },
  },
  apply(scene, state, eye, lookAt) {
    if (!scene) return;
    const isEga = state.activeShot.id !== 'SHOT-2A';
    scene.setFidelityStage?.(isEga ? 1 : 0);
    const firingBeam = state.activeShot.id === 'SHOT-2A';
    scene.setBeamHeld?.(firingBeam, 'extract');
    scene.setBeamFiring?.(firingBeam);
    scene.setLabActivity?.({ bench: state.activeShot.id === 'SHOT-2C' ? 1 : 0, combiner: 0, rack: 1 });
    const target = this.keyframes[state.activeShot.id]?.end.worldTarget ?? 'moon';
    applyCameraToScene(scene, target, eye, lookAt);
  },
};

export default ch2OneBitFacets;
