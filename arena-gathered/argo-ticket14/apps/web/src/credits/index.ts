// ============================================================================
// File: apps/web/src/credits/index.ts
// Brief: TASK-33 / TICKET-14 (In-Engine Credits Director & Lab Monitor Jukebox)
// - Syncs to `AudioContext.currentTime` via `gameAudio` (`music-ending` ->
//   `music-ending-loop` scheduled on the exact same AudioContext clock at 160.73 s)
// - Drives all 7 chapter modules (`ch1` .. `ch7`) against `PlayScene` & `LabRoom`
// - Provides `createMonitorEqualizer3D` & `playMonitorOverclocked` for `lab-room.ts` / `play.tsx`
// ============================================================================

import * as THREE from 'three';
import { gameAudio } from '../audio/game-audio';
import {
  computeStagePostUniforms,
  DEFAULT_OUTRO_META,
  getCreditsStateAt,
  parseOutroMeta,
  type CreditsChapterId,
  type CreditsPlaybackState,
  type MusicOutroMeta,
  type StagePostUniforms,
} from './timeline';
import { ch1ColdBoot } from './ch/ch1-cold-boot';
import { ch2OneBitFacets } from './ch/ch2-one-bit-facets';
import { ch3ChorusBloom } from './ch/ch3-chorus-bloom';
import { ch4ArchiveRifts } from './ch/ch4-archive-rifts';
import { ch5WindowHeal } from './ch/ch5-window-heal';
import { ch6SuitcamFinale } from './ch/ch6-suitcam-finale';
import { ch7OutroLoop } from './ch/ch7-outro-loop';
import type { CameraKeyframe, ChapterDriver, CreditsSceneDriverTarget } from './ch/types';
import { MONITOR_EQ_COLOURS, monitorEqualizerHeights, OLD_MONITOR_ACTIONS } from './monitor-jukebox';
import { injectRetroPixelFontStyles } from './pixel-font-ofl';

export * from './timeline';
export * from './credits-hud';
export * from './monitor-jukebox';
export * from './pixel-font-ofl';
export type { CameraKeyframe, ChapterDriver, CreditsSceneDriverTarget };

export const CHAPTER_DRIVERS: Readonly<Record<CreditsChapterId, ChapterDriver>> = {
  'ch1-cold-boot': ch1ColdBoot,
  'ch2-one-bit-facets': ch2OneBitFacets,
  'ch3-chorus-bloom': ch3ChorusBloom,
  'ch4-archive-rifts': ch4ArchiveRifts,
  'ch5-window-heal': ch5WindowHeal,
  'ch6-suitcam-finale': ch6SuitcamFinale,
  'ch7-outro-loop': ch7OutroLoop,
};

/**
 * Deterministic Camera Keyframes for all 16 shots across Chapters 1–7,
 * merged from the 7 modular chapter drivers.
 */
export const SHOT_CAMERA_KEYFRAMES: Readonly<Record<string, { readonly start: CameraKeyframe; readonly end: CameraKeyframe }>> = {
  ...ch1ColdBoot.keyframes,
  ...ch2OneBitFacets.keyframes,
  ...ch3ChorusBloom.keyframes,
  ...ch4ArchiveRifts.keyframes,
  ...ch5WindowHeal.keyframes,
  ...ch6SuitcamFinale.keyframes,
  ...ch7OutroLoop.keyframes,
};

export interface CreditsDirectorCallbacks {
  onApplyWorldTarget?: (target: 'lab' | 'moon' | 'diptych', chapterId: CreditsChapterId) => void;
  onApplyStageUniforms?: (uniforms: StagePostUniforms) => void;
  onStateTick?: (state: CreditsPlaybackState) => void;
}

export class CreditsDirector {
  private audioCtx: AudioContext | null = null;
  private songSource: AudioBufferSourceNode | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private songBuffer: AudioBuffer | null = null;
  private loopBuffer: AudioBuffer | null = null;
  private overclockedBuffer: AudioBuffer | null = null;
  private outroMeta: MusicOutroMeta = DEFAULT_OUTRO_META;

  private startWallMs = 0;
  private startAudioSec = 0;
  private isRunning = false;
  private isOverclocked = false;
  private irisEV = 1.0;

  private mouseParallaxX = 0;
  private mouseParallaxY = 0;
  private sceneTarget: CreditsSceneDriverTarget | null = null;

  constructor(
    private readonly camera?: THREE.PerspectiveCamera | null,
    private readonly callbacks: CreditsDirectorCallbacks = {},
    scene?: CreditsSceneDriverTarget | null,
  ) {
    this.sceneTarget = scene ?? null;
    injectRetroPixelFontStyles();
  }

  public setSceneTarget(scene: CreditsSceneDriverTarget | null): void {
    this.sceneTarget = scene;
  }

  public async loadAssets(levelsUrl = 'audio/levels.json'): Promise<void> {
    try {
      await gameAudio.fetchMetadata();
      if (typeof fetch !== 'undefined') {
        const res = await fetch(levelsUrl);
        if (res.ok) {
          this.outroMeta = parseOutroMeta(await res.json());
        }
      }
    } catch {
      this.outroMeta = DEFAULT_OUTRO_META;
    }

    try {
      const [endingBuf, loopBuf, overBuf] = await Promise.all([
        gameAudio.loadBuffer('music-ending'),
        gameAudio.loadBuffer('music-ending-loop'),
        gameAudio.loadBuffer('music-ending-overclocked'),
      ]);
      this.songBuffer = endingBuf;
      this.loopBuffer = loopBuf;
      this.overclockedBuffer = overBuf;
      this.audioCtx = gameAudio.getContext();
    } catch {
      this.songBuffer = null;
      this.loopBuffer = null;
    }
  }

  public start(overclockedPitchUp = false): void {
    this.stop();
    this.isRunning = true;
    this.isOverclocked = overclockedPitchUp;
    this.startWallMs = typeof performance !== 'undefined' ? performance.now() : 0;
    this.irisEV = 1.0;

    try {
      const ctx = this.audioCtx ?? gameAudio.getContext();
      this.audioCtx = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const bus = gameAudio.getMusicBus();
      const now = ctx.currentTime;
      this.startAudioSec = now;

      if (overclockedPitchUp && this.overclockedBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.overclockedBuffer;
        src.connect(bus);
        src.start(now);
        this.songSource = src;
      } else if (this.songBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.songBuffer;
        src.connect(bus);
        src.start(now);
        this.songSource = src;

        // Schedule music-ending-loop on the exact same AudioContext clock when music-ending finishes (2:40.73)
        if (this.loopBuffer) {
          const loopSrc = ctx.createBufferSource();
          loopSrc.buffer = this.loopBuffer;
          loopSrc.loop = true;
          loopSrc.loopStart = this.outroMeta.loopStart;
          loopSrc.loopEnd = this.outroMeta.loopEnd;
          gameAudio.applyLoopRegion(loopSrc, 'music-ending-loop');
          loopSrc.connect(bus);
          const handoffAt = now + (this.songBuffer.duration || this.outroMeta.outroStart);
          loopSrc.start(handoffAt, 0);
          this.loopSource = loopSrc;
        }
      }
    } catch {
      // Headless / no-audio fallback uses performance.now() seamlessly
    }
  }

  public stop(): void {
    this.isRunning = false;
    for (const node of [this.songSource, this.loopSource]) {
      if (node) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Ignore if already stopped
        }
      }
    }
    this.songSource = null;
    this.loopSource = null;
    this.sceneTarget?.debug?.clearAltCam?.();
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public setMouseParallax(normX: number, normY: number): void {
    this.mouseParallaxX = Math.max(-1, Math.min(1, normX));
    this.mouseParallaxY = Math.max(-1, Math.min(1, normY));
  }

  public stepAtTime(explicitSec?: number, dt = 0.016): CreditsPlaybackState {
    const elapsedSec =
      explicitSec !== undefined
        ? explicitSec
        : this.audioCtx && this.songSource && this.audioCtx.state === 'running'
          ? Math.max(0, this.audioCtx.currentTime - this.startAudioSec)
          : ((typeof performance !== 'undefined' ? performance.now() : 0) - this.startWallMs) / 1000;

    const state = getCreditsStateAt(elapsedSec, this.outroMeta);
    const shotSpec = state.activeShot;
    const kfPair = SHOT_CAMERA_KEYFRAMES[shotSpec.id] ?? SHOT_CAMERA_KEYFRAMES['SHOT-7A']!;

    const shotDuration = Number.isFinite(shotSpec.tEnd)
      ? Math.max(0.01, shotSpec.tEnd - shotSpec.tStart)
      : 12.0;
    const rawAlpha = Number.isFinite(shotSpec.tEnd)
      ? Math.min(1, Math.max(0, (elapsedSec - shotSpec.tStart) / shotDuration))
      : 0.5 + 0.5 * Math.sin((elapsedSec - shotSpec.tStart) * 0.35);

    const u = rawAlpha * rawAlpha * (3 - 2 * rawAlpha);

    const px = THREE.MathUtils.lerp(kfPair.start.pos[0], kfPair.end.pos[0], u);
    const py = THREE.MathUtils.lerp(kfPair.start.pos[1], kfPair.end.pos[1], u);
    const pz = THREE.MathUtils.lerp(kfPair.start.pos[2], kfPair.end.pos[2], u);

    const lx = THREE.MathUtils.lerp(kfPair.start.lookAt[0], kfPair.end.lookAt[0], u) + this.mouseParallaxX * 0.85;
    const ly = THREE.MathUtils.lerp(kfPair.start.lookAt[1], kfPair.end.lookAt[1], u) + this.mouseParallaxY * 0.55;
    const lz = THREE.MathUtils.lerp(kfPair.start.lookAt[2], kfPair.end.lookAt[2], u);

    if (this.camera) {
      this.camera.position.set(px, py, pz);
      this.camera.lookAt(lx, ly, lz);
      this.camera.fov = THREE.MathUtils.lerp(kfPair.start.fov ?? 60, kfPair.end.fov ?? 60, u);
      this.camera.updateProjectionMatrix();
    }

    const driver = CHAPTER_DRIVERS[state.chapter.id];
    driver.apply(this.sceneTarget, state, [px, py, pz], [lx, ly, lz]);

    const targetIrisEV =
      shotSpec.id === 'SHOT-6A' && elapsedSec - shotSpec.tStart < 0.65 ? 1.85 : 1.0;

    const hasActiveMachine = state.chapter.index >= 2;
    const wetLens = state.chapter.id === 'ch5-window-heal' ? 0.45 : 0.0;
    const postUniforms = computeStagePostUniforms(
      state.chapter.floats,
      hasActiveMachine,
      this.irisEV,
      targetIrisEV,
      dt,
      wetLens,
    );
    this.irisEV = postUniforms.uIrisExposure;

    this.callbacks.onApplyWorldTarget?.(kfPair.end.worldTarget, state.chapter.id);
    this.callbacks.onApplyStageUniforms?.(postUniforms);
    this.callbacks.onStateTick?.(state);

    return state;
  }
}

// ============================================================================
// Lab `old-monitor` 3D Four-Colour Equaliser & Jukebox Speaker Hook
// ============================================================================

export interface MonitorEqualizer3D {
  readonly group: THREE.Group;
  setActive(active: boolean): void;
  update(nowSec: number): void;
  dispose(): void;
}

/**
 * Small self-contained 3D 4-colour equaliser bar group for `old-monitor` in `lab-room.ts`.
 * Mount onto the monitor prop group (`createMonitorEqualizer3D(monitorGroup)`).
 */
export function createMonitorEqualizer3D(parent?: THREE.Object3D): MonitorEqualizer3D {
  const group = new THREE.Group();
  group.name = 'old-monitor-equalizer';
  group.visible = false;
  if (parent) parent.add(group);

  const barGeo = new THREE.BoxGeometry(0.032, 0.16, 0.008);
  barGeo.translate(0, 0.08, 0);
  const bars: THREE.Mesh[] = [];
  const mats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: MONITOR_EQ_COLOURS[i] });
    const mesh = new THREE.Mesh(barGeo, mat);
    mesh.position.set((i - 1.5) * 0.045, -0.07, 0.01);
    group.add(mesh);
    bars.push(mesh);
    mats.push(mat);
  }

  let isActive = false;
  let startSec = -1;

  return {
    group,
    setActive(on: boolean) {
      isActive = on;
      group.visible = on;
      if (!on) startSec = -1;
    },
    update(nowSec: number) {
      if (!isActive) return;
      if (startSec < 0) startSec = nowSec;
      const heights = monitorEqualizerHeights(nowSec - startSec);
      for (let i = 0; i < 4; i++) {
        bars[i]!.scale.y = heights[i]!;
      }
    },
    dispose() {
      barGeo.dispose();
      for (const m of mats) m.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

const MONITOR_LOOP_KEY = 'old-monitor-overclocked';

/**
 * Starts or toggles `"Four Floats (Overclocked)"` (`music-ending-overclocked`) through the
 * Lab `old-monitor` speaker on `World_SFX_Bus` (`bus: 'world'`).
 */
export function playMonitorOverclocked(
  monitorPos: { readonly x: number; readonly y: number; readonly z: number } = { x: -1.65, y: 1.15, z: 2.35 },
): void {
  gameAudio.unlockWorldAudio();
  gameAudio.play3d('music-ending-overclocked', monitorPos, {
    key: MONITOR_LOOP_KEY,
    volume: 0.9,
    refDistance: 2.5,
    maxDistance: 18,
    bus: 'world',
  });
}

export function stopMonitorOverclocked(): void {
  gameAudio.stopLoop3d(MONITOR_LOOP_KEY, 0.1);
}

// Expose `window.__credits` hook for headless verification (`scripts/test-credits-video.mjs`)
if (typeof window !== 'undefined') {
  (window as unknown as { __credits?: unknown }).__credits = {
    getStateAt: (t: number) => getCreditsStateAt(t, DEFAULT_OUTRO_META),
    actions: OLD_MONITOR_ACTIONS,
    playOverclocked: playMonitorOverclocked,
    stopOverclocked: stopMonitorOverclocked,
  };
}
