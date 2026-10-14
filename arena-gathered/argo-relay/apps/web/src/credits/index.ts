// ============================================================================
// File: apps/web/src/credits/index.ts
// Brief: TASK-33 (In-Engine Credits Director & Lab Monitor Overclocked Replay)
// ============================================================================

import * as THREE from 'three';
import {
  DEFAULT_OUTRO_META,
  getCreditsStateAt,
  type CreditsChapterId,
  type CreditsPlaybackState,
  type MusicOutroMeta,
} from './timeline';
import {
  computeStagePostUniforms,
  type StagePostUniforms,
} from '../../../../packages/groundshader/src/stage-post.glsl';

export interface CameraKeyframe {
  pos: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
  worldTarget: 'lab' | 'moon' | 'diptych';
}

/**
 * Deterministic Camera Keyframes for all 16 shots across Chapters 1–7
 */
export const SHOT_CAMERA_KEYFRAMES: Record<string, { start: CameraKeyframe; end: CameraKeyframe }> = {
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
  'SHOT-3A': {
    start: { pos: [-14.0, 3.0, -8.0], lookAt: [0.0, 2.5, 14.0], fov: 60, worldTarget: 'moon' },
    end:   { pos: [14.0, 9.5, -4.0], lookAt: [0.0, 3.5, 16.0], fov: 64, worldTarget: 'moon' },
  },
  'SHOT-3B': {
    start: { pos: [8.0, 4.0, 18.0], lookAt: [-12.0, 1.5, 45.0], fov: 58, worldTarget: 'moon' },
    end:   { pos: [-6.0, 2.5, 26.0], lookAt: [10.0, 1.2, 55.0], fov: 58, worldTarget: 'moon' },
  },
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
  'SHOT-5A': {
    start: { pos: [38.0, 22.0, 25.0], lookAt: [55.0, -2.0, 58.0], fov: 64, worldTarget: 'moon' },
    end:   { pos: [24.0, 14.0, 48.0], lookAt: [58.0, -1.5, 62.0], fov: 60, worldTarget: 'moon' },
  },
  'SHOT-5B': {
    start: { pos: [-1.5, 1.7, 1.8], lookAt: [-3.5, 2.2, -5.8], fov: 58, worldTarget: 'lab' },
    end:   { pos: [-2.4, 1.7, -1.6], lookAt: [-3.8, 2.4, -6.0], fov: 62, worldTarget: 'lab' },
  },
  'SHOT-6A': {
    start: { pos: [3.0, 1.7, -0.5], lookAt: [3.0, 1.7, -6.0], fov: 68, worldTarget: 'lab' },
    end:   { pos: [0.0, 1.75, 18.0], lookAt: [12.0, 3.5, 52.0], fov: 70, worldTarget: 'moon' },
  },
  'SHOT-6B': {
    start: { pos: [0.0, 6.0, -6.0], lookAt: [0.0, 4.0, 120.0], fov: 64, worldTarget: 'moon' },
    end:   { pos: [0.0, 28.0, -18.0], lookAt: [0.0, 8.0, 420.0], fov: 68, worldTarget: 'moon' },
  },
  'SHOT-7A': {
    start: { pos: [-0.4, 1.75, 3.8], lookAt: [0.2, 1.8, -4.5], fov: 60, worldTarget: 'diptych' },
    end:   { pos: [0.4, 1.78, 3.6], lookAt: [0.2, 1.8, -4.5], fov: 60, worldTarget: 'diptych' },
  },
};

export interface CreditsDirectorCallbacks {
  onApplyWorldTarget: (target: 'lab' | 'moon' | 'diptych', chapterId: CreditsChapterId) => void;
  onApplyStageUniforms: (uniforms: StagePostUniforms) => void;
  onStateTick: (state: CreditsPlaybackState) => void;
}

export class CreditsDirector {
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private outroMeta: MusicOutroMeta = DEFAULT_OUTRO_META;

  private startWallMs = 0;
  private startAudioSec = 0;
  private isRunning = false;
  private isOverclocked = false;
  private irisEV = 1.0;

  private mouseParallaxX = 0;
  private mouseParallaxY = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly callbacks: CreditsDirectorCallbacks
  ) {}

  public async loadAssets(
    audioUrl = 'hd/audio/four-floats-v4b.mp3',
    outroJsonUrl = 'hd/audio/outro.json'
  ): Promise<void> {
    try {
      const res = await fetch(outroJsonUrl);
      if (res.ok) {
        const parsed = (await res.json()) as Partial<MusicOutroMeta>;
        this.outroMeta = {
          bpm: parsed.bpm ?? 144,
          outroStart: parsed.outroStart ?? DEFAULT_OUTRO_META.outroStart,
          loopStart: parsed.loopStart ?? DEFAULT_OUTRO_META.loopStart,
          loopEnd: parsed.loopEnd ?? DEFAULT_OUTRO_META.loopEnd,
        };
      }
    } catch {
      this.outroMeta = DEFAULT_OUTRO_META;
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx && AudioContextCtor) {
        this.audioCtx = new AudioContextCtor();
      }
      if (this.audioCtx) {
        const audioRes = await fetch(audioUrl);
        if (audioRes.ok) {
          const arr = await audioRes.arrayBuffer();
          this.audioBuffer = await this.audioCtx.decodeAudioData(arr);
        }
      }
    } catch {
      this.audioBuffer = null;
    }
  }

  public start(overclockedPitchUp = false): void {
    this.stop();
    this.isRunning = true;
    this.isOverclocked = overclockedPitchUp;
    this.startWallMs = performance.now();
    this.irisEV = 1.0;

    if (this.audioCtx && this.audioBuffer) {
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.audioBuffer;
      // If Overclocked mode is selected from the Lab old-monitor, apply 1.2x pitch-up playbackRate
      src.playbackRate.value = overclockedPitchUp ? 1.2 : 1.0;
      src.loop = true;
      src.loopStart = this.outroMeta.loopStart;
      src.loopEnd = this.outroMeta.loopEnd;
      src.connect(this.audioCtx.destination);
      src.start(0);
      this.sourceNode = src;
      this.startAudioSec = this.audioCtx.currentTime;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.sourceNode = null;
    }
  }

  public setMouseParallax(normX: number, normY: number): void {
    this.mouseParallaxX = Math.max(-1, Math.min(1, normX));
    this.mouseParallaxY = Math.max(-1, Math.min(1, normY));
  }

  public stepAtTime(explicitSec?: number, dt = 0.016): CreditsPlaybackState {
    const elapsedSec =
      explicitSec !== undefined
        ? explicitSec
        : this.audioCtx && this.sourceNode
        ? (this.audioCtx.currentTime - this.startAudioSec) * (this.isOverclocked ? 1.2 : 1.0)
        : (performance.now() - this.startWallMs) / 1000;

    const state = getCreditsStateAt(elapsedSec, this.outroMeta);
    const shotSpec = state.activeShot;
    const kfPair = SHOT_CAMERA_KEYFRAMES[shotSpec.id] ?? SHOT_CAMERA_KEYFRAMES['SHOT-7A'];

    const shotDuration = Number.isFinite(shotSpec.tEnd)
      ? Math.max(0.01, shotSpec.tEnd - shotSpec.tStart)
      : 12.0;
    const rawAlpha = Number.isFinite(shotSpec.tEnd)
      ? Math.min(1, Math.max(0, (elapsedSec - shotSpec.tStart) / shotDuration))
      : 0.5 + 0.5 * Math.sin((elapsedSec - shotSpec.tStart) * 0.35);

    // Smoothstep interpolation
    const u = rawAlpha * rawAlpha * (3 - 2 * rawAlpha);

    const px = THREE.MathUtils.lerp(kfPair.start.pos[0], kfPair.end.pos[0], u);
    const py = THREE.MathUtils.lerp(kfPair.start.pos[1], kfPair.end.pos[1], u);
    const pz = THREE.MathUtils.lerp(kfPair.start.pos[2], kfPair.end.pos[2], u);

    const lx = THREE.MathUtils.lerp(kfPair.start.lookAt[0], kfPair.end.lookAt[0], u) + this.mouseParallaxX * 0.85;
    const ly = THREE.MathUtils.lerp(kfPair.start.lookAt[1], kfPair.end.lookAt[1], u) + this.mouseParallaxY * 0.55;
    const lz = THREE.MathUtils.lerp(kfPair.start.lookAt[2], kfPair.end.lookAt[2], u);

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(lx, ly, lz);
    this.camera.fov = THREE.MathUtils.lerp(kfPair.start.fov ?? 60, kfPair.end.fov ?? 60, u);
    this.camera.updateProjectionMatrix();

    // Trigger +0.85 EV Suit-Cam iris blowout at the start of SHOT-6A when stepping out of the Gate
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
      wetLens
    );
    this.irisEV = postUniforms.uIrisExposure;

    this.callbacks.onApplyWorldTarget(kfPair.end.worldTarget, state.chapter.id);
    this.callbacks.onApplyStageUniforms(postUniforms);
    this.callbacks.onStateTick(state);

    return state;
  }
}
