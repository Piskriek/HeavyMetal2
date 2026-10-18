// ============================================================================
// Shared chapter driver contract for apps/web/src/credits/ch/ch1..ch7.ts
// Drives the existing PlayScene and LabRoom camera & stage APIs without
// editing play-scene.ts.
// ============================================================================

import type { CreditsChapterId, CreditsPlaybackState } from '../timeline';

export interface CameraKeyframe {
  readonly pos: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly fov?: number;
  readonly worldTarget: 'lab' | 'moon' | 'diptych';
}

export interface CreditsSceneDriverTarget {
  setFidelityStage?(stage: number): void;
  raiseStage?(to: number, from: { readonly x: number; readonly z: number }): void;
  setLabActivity?(act: { readonly bench: number; readonly combiner: number; readonly rack: number }): void;
  setBeamHeld?(held: boolean, mode: 'extract' | 'sculpt' | 'apply'): void;
  setBeamFiring?(on: boolean): void;
  setBeamSealing?(on: boolean): void;
  setCameraView?(mode: 'first' | 'third'): void;
  readonly debug?: {
    teleport?(where: 'lab' | 'planet', x: number, z: number, yaw: number, pitch?: number): void;
    setAltCam?(
      eye: { readonly x: number; readonly y: number; readonly z: number },
      pitch: number,
      yaw: number,
      target?: { readonly x: number; readonly y: number; readonly z: number },
    ): void;
    clearAltCam?(): void;
    setWake?(t: number): void;
    setWindowView?(view: 'static' | 'lite' | 'full'): void;
    setWaterVisible?(v: boolean): void;
    setCoverageActive?(v: boolean): void;
  };
  readonly room?: {
    setStorm?(progress: number): void;
    setWindowView?(view: 'static' | 'lite' | 'full'): void;
  };
}

export interface ChapterDriver {
  readonly id: CreditsChapterId;
  readonly stage: number;
  readonly keyframes: Readonly<Record<string, { readonly start: CameraKeyframe; readonly end: CameraKeyframe }>>;
  apply(scene: CreditsSceneDriverTarget | null | undefined, state: CreditsPlaybackState, eye: readonly [number, number, number], lookAt: readonly [number, number, number]): void;
}

export function applyCameraToScene(
  scene: CreditsSceneDriverTarget | null | undefined,
  worldTarget: 'lab' | 'moon' | 'diptych',
  eye: readonly [number, number, number],
  lookAt: readonly [number, number, number],
): void {
  if (!scene?.debug) return;
  const where = worldTarget === 'moon' ? 'planet' : 'lab';
  const dx = lookAt[0] - eye[0];
  const dy = lookAt[1] - eye[1];
  const dz = lookAt[2] - eye[2];
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz) || 1);
  scene.debug.teleport?.(where, eye[0], eye[2], yaw, pitch);
  // pitch and yaw go in as they are, with no target: the scene rebuilds the camera from them in YXZ order every frame, so a
  // target (which the scene reads back as XYZ Euler angles) would turn the view away from the look-at point (a black frame)
  scene.debug.setAltCam?.({ x: eye[0], y: eye[1], z: eye[2] }, pitch, yaw);
}
