// ============================================================================
// File: packages/credits/src/index.ts
// Fix: Driven strictly from AudioContext.currentTime (zero performance.now()),
// removed unused isRunning, guarded all index reads for noUncheckedIndexedAccess,
// wired public/audio/music-ending.mp3 -> music-ending-loop.mp3 (middle copy 13.329..26.658s)
// at 2:40.73 (160.73s) and public/audio/music-ending-overclocked.mp3.
// ============================================================================

import {
  FOUR_FLOATS_BPM,
  LAST_LYRIC_END_SEC,
  LOOP_MIDDLE_COPY_END_SEC,
  LOOP_MIDDLE_COPY_START_SEC,
  SONG_SWITCH_TO_LOOP_SEC,
  evaluateCreditsTimelineAt,
  type CreditRollCard,
  type LyricCue,
} from './timeline';

export * from './timeline';

export const ENDING_AUDIO_FILES = {
  mainSong: 'public/audio/music-ending.mp3',
  chorusLoop: 'public/audio/music-ending-loop.mp3',
  overclocked: 'public/audio/music-ending-overclocked.mp3',
} as const;

export type EndingTrackMode = 'main-song' | 'chorus-loop' | 'overclocked';

export interface CreditsFrameSnapshot {
  elapsedSec: number;
  bpm: number;
  trackMode: EndingTrackMode;
  activeAudioFile: string;
  loopStartSec: number;
  loopEndSec: number;
  activeLyric: LyricCue | null;
  activeCard: CreditRollCard | null;
  progress0to1: number;
  isComplete: boolean;
  spectrumBins32: Float32Array;
}

export class CreditsRollController {
  private startAudioTimeSec = 0;
  private overclockedMode = false;

  public start(audioContextCurrentTimeSec: number, overclocked = false): void {
    this.startAudioTimeSec = audioContextCurrentTimeSec;
    this.overclockedMode = overclocked;
  }

  public setOverclockedMode(enabled: boolean): void {
    this.overclockedMode = enabled;
  }

  public sampleFrame(
    audioContextCurrentTimeSec: number,
    analyserByteFreqData?: Uint8Array
  ): CreditsFrameSnapshot {
    const elapsedSec = Math.max(0, audioContextCurrentTimeSec - this.startAudioTimeSec);
    const timeline = evaluateCreditsTimelineAt(elapsedSec);

    const trackMode: EndingTrackMode = this.overclockedMode
      ? 'overclocked'
      : timeline.isChorusLoopPhase
      ? 'chorus-loop'
      : 'main-song';

    const activeAudioFile =
      trackMode === 'overclocked'
        ? ENDING_AUDIO_FILES.overclocked
        : trackMode === 'chorus-loop'
        ? ENDING_AUDIO_FILES.chorusLoop
        : ENDING_AUDIO_FILES.mainSong;

    const bins = new Float32Array(32);
    if (analyserByteFreqData && analyserByteFreqData.length >= 32) {
      for (let i = 0; i < 32; i++) {
        const raw = analyserByteFreqData[i] ?? 0;
        bins[i] = Number((raw / 255.0).toFixed(3));
      }
    } else {
      const beatHz = FOUR_FLOATS_BPM / 60.0;
      for (let i = 0; i < 32; i++) {
        const wave =
          0.45 +
          0.35 * Math.sin(elapsedSec * beatHz * Math.PI * 2.0 + i * 0.35) +
          0.15 * Math.cos(elapsedSec * 1.7 - i * 0.2);
        bins[i] = Number(Math.max(0.05, Math.min(1.0, wave)).toFixed(3));
      }
    }

    return {
      elapsedSec: Number(elapsedSec.toFixed(3)),
      bpm: FOUR_FLOATS_BPM,
      trackMode,
      activeAudioFile,
      loopStartSec: LOOP_MIDDLE_COPY_START_SEC,
      loopEndSec: LOOP_MIDDLE_COPY_END_SEC,
      activeLyric: timeline.activeLyric,
      activeCard: timeline.activeCard,
      progress0to1: timeline.progress0to1,
      isComplete: elapsedSec >= LAST_LYRIC_END_SEC,
      spectrumBins32: bins,
    };
  }
}
