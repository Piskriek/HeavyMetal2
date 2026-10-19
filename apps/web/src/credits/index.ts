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
import { OLD_MONITOR_ACTIONS, playMonitorOverclocked, stopMonitorOverclocked } from './monitor-jukebox';

export * from './timeline';
export * from './credits-hud';
export * from './monitor-jukebox';
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
  private irisEV = 1.0;
  private lastElapsed = 0;
  private seekOffset = 0;
  private clockBasis: 'audio' | 'wall' = 'wall';
  private clockRaw = 0;

  private mouseParallaxX = 0;
  private mouseParallaxY = 0;
  private sceneTarget: CreditsSceneDriverTarget | null = null;

  constructor(
    private readonly camera?: THREE.PerspectiveCamera | null,
    private readonly callbacks: CreditsDirectorCallbacks = {},
    scene?: CreditsSceneDriverTarget | null,
  ) {
    this.sceneTarget = scene ?? null;
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
    this.seekOffset = 0;
    this.clockBasis = 'wall';
    this.clockRaw = 0;
    this.startWallMs = typeof performance !== 'undefined' ? performance.now() : 0;
    this.irisEV = 1.0;
    this.sceneTarget?.setViewModelVisible?.(false);

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
    this.sceneTarget?.setViewModelVisible?.(true);
    this.sceneTarget?.setWireframeLook?.(false);
    this.sceneTarget?.debug?.clearAltCam?.();
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  /** The clock as the audio (or, with no audio, the wall clock) says it is, from the start of the video. */
  private rawElapsed(): number {
    const useAudio = !!(this.audioCtx && this.songSource && this.audioCtx.state === 'running');
    const raw = useAudio && this.audioCtx
      ? Math.max(0, this.audioCtx.currentTime - this.startAudioSec)
      : ((typeof performance !== 'undefined' ? performance.now() : 0) - this.startWallMs) / 1000;
    const basis: 'audio' | 'wall' = useAudio ? 'audio' : 'wall';
    if (basis !== this.clockBasis) {
      // a switch between the two clocks must not jump the picture: re-anchor the offset to the value it had
      this.seekOffset += this.clockRaw - raw;
      this.clockBasis = basis;
    }
    this.clockRaw = raw;
    return raw;
  }

  /** The clock's state, for the checks: which clock drives the picture, its raw reading, and the seek offset. */
  public clockInfo(): { readonly basis: 'audio' | 'wall'; readonly raw: number; readonly offset: number; readonly audioState: string } {
    return { basis: this.clockBasis, raw: this.clockRaw, offset: this.seekOffset, audioState: this.audioCtx?.state ?? 'none' };
  }

  /** Fast-forward (or rewind) the video clock: the chapters and lyrics follow. Tests and the debug menu use it. */
  public seek(sec: number): void {
    const at = Math.max(0, sec);
    this.seekOffset = at - this.rawElapsed();
    this.lastElapsed = at;
  }

  /** The audio schedule as started: the song's length in seconds, and the loop's hand-off on the AudioContext clock. */
  public scheduleInfo(): { readonly songDuration: number; readonly handoffAt: number | null; readonly loopStart: number; readonly loopEnd: number; readonly running: boolean } {
    return {
      songDuration: this.songBuffer?.duration ?? 0,
      handoffAt: this.loopSource ? this.startAudioSec + (this.songBuffer?.duration ?? 0) : null,
      loopStart: this.outroMeta.loopStart,
      loopEnd: this.outroMeta.loopEnd,
      running: this.isRunning,
    };
  }

  /** The video clock as last stepped: what the HUD shows (the audio clock while the song plays). */
  public elapsedSec(): number {
    return this.lastElapsed;
  }

  public setMouseParallax(normX: number, normY: number): void {
    this.mouseParallaxX = Math.max(-1, Math.min(1, normX));
    this.mouseParallaxY = Math.max(-1, Math.min(1, normY));
  }

  public stepAtTime(explicitSec?: number, dt = 0.016): CreditsPlaybackState {
    const elapsedSec = explicitSec !== undefined ? explicitSec : Math.max(0, this.rawElapsed() + this.seekOffset);

    this.lastElapsed = Math.max(0, elapsedSec);
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

// POL-305: Expose `window.__credits` hook only under debug / e2e / localhost
if (typeof window !== 'undefined') {
  const isDebug =
    Boolean(import.meta.env?.DEV) ||
    (typeof location !== 'undefined' &&
      (new URLSearchParams(location.search).has('e2e') ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1'));
  if (isDebug) {
    (window as unknown as { __credits?: unknown }).__credits = {
      getStateAt: (t: number) => getCreditsStateAt(t, DEFAULT_OUTRO_META),
      actions: OLD_MONITOR_ACTIONS,
      playOverclocked: playMonitorOverclocked,
      stopOverclocked: stopMonitorOverclocked,
    };
  }
}

