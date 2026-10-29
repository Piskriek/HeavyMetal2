/**
 * Plan 58 Wave 3 (Track 3) & Plan 58 §18: Somatic Voice Filter & Expressive Prosody Synthesizer (`@hm/soundlab`).
 *
 * Bridges `deriveEmotionalEnvelope` (`@hm/harness`) into `@hm/soundlab` so a speaker's somatic state (`timbreFilter`:
 * `'clear' | 'starved-throat' | 'resonant-eureka' | 'warm-anchor'`), paralinguistic `breathCue` (`'sigh' | 'laugh' | 'gasp' | 'steady'`),
 * `pitchShiftSemitones`, `tempoScale`, and archetypical `polarity` produce genuinely distinct, audible acoustic
 * waveforms and validated `SfxRecipe` presets.
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O in recipe/PCM synthesis).
 */
import { normalizeRecipe, type SfxLayer, type SfxRecipe } from './recipe';
import { peakOf, renderRecipe, rmsOf } from './render';

export type VoiceTimbreFilter = 'clear' | 'starved-throat' | 'resonant-eureka' | 'warm-anchor';
export type VoiceBreathCue = 'sigh' | 'laugh' | 'gasp' | 'steady';
export type VoiceArchetypePolarity = 'masculine' | 'feminine' | 'balanced';

export interface SomaticVoiceSynthInput {
  readonly id?: string;
  readonly timbreFilter: VoiceTimbreFilter;
  readonly pitchShiftSemitones?: number;
  readonly tempoScale?: number;
  readonly breathCue?: VoiceBreathCue;
  readonly polarity?: VoiceArchetypePolarity;
}

export interface SomaticVoiceRenderResult {
  readonly recipe: SfxRecipe;
  readonly samples: Float32Array;
  readonly rms: number;
  readonly peak: number;
  /** Estimated acoustic zero-crossing frequency in Hz (measures spectral brightness/constriction). */
  readonly zeroCrossingHz: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/**
 * Builds a validated `@hm/soundlab` `SfxRecipe` shaped by the speaker's `timbreFilter`, `breathCue`,
 * `pitchShiftSemitones`, `tempoScale`, and `polarity`.
 */
export function buildSomaticVoiceRecipe(input: SomaticVoiceSynthInput): SfxRecipe {
  const semitones = clamp(input.pitchShiftSemitones ?? 0, -12, 12);
  const tempo = clamp(input.tempoScale ?? 1, 0.6, 1.6);
  const polarity = input.polarity ?? 'balanced';
  const breathCue = input.breathCue ?? 'steady';

  // Base vocal fundamental: masculine ~165 Hz, balanced ~220 Hz, feminine ~265 Hz
  const polarityBaseHz = polarity === 'masculine' ? 165 : polarity === 'feminine' ? 265 : 220;
  const f0 = Math.round(polarityBaseHz * Math.pow(2, semitones / 12));
  const durScale = 1 / tempo;
  const durationMs = Math.round(clamp(420 * durScale, 180, 1200));

  const layers: SfxLayer[] = [];

  if (input.timbreFilter === 'starved-throat') {
    // Ray 5 (Throat) starved or somatic strain: pinched sawtooth through a narrow high-Q bandpass constriction + raspy noise
    layers.push({
      wave: 'sawtooth',
      freq: [f0, Math.round(f0 * 0.92)],
      gain: 0.55,
      attackMs: Math.round(25 * durScale),
      decayMs: Math.round(260 * durScale),
      filter: {
        type: 'bandpass',
        freq: [520, 440],
        q: 6.5,
      },
    });
    layers.push({
      wave: 'noise',
      freq: [1200, 900],
      gain: 0.28,
      attackMs: Math.round(15 * durScale),
      decayMs: Math.round(220 * durScale),
      filter: {
        type: 'bandpass',
        freq: [1450, 1100],
        q: 4.5,
      },
    });
  } else if (input.timbreFilter === 'resonant-eureka') {
    // Distortion released & flow restored: open fundamental + fifth harmonic + high crystalline shimmer overtone
    layers.push({
      wave: 'triangle',
      freq: [f0, Math.round(f0 * 1.25)],
      gain: 0.6,
      attackMs: Math.round(18 * durScale),
      decayMs: Math.round(320 * durScale),
      filter: {
        type: 'lowpass',
        freq: [2400, 3200],
        q: 2.2,
      },
    });
    layers.push({
      wave: 'sine',
      freq: [Math.round(f0 * 1.5), Math.round(f0 * 2.0)],
      gain: 0.45,
      attackMs: Math.round(24 * durScale),
      decayMs: Math.round(340 * durScale),
      delayMs: Math.round(20 * durScale),
    });
    layers.push({
      wave: 'sine',
      freq: [Math.round(f0 * 2.5), Math.round(f0 * 3.0)],
      gain: 0.35,
      attackMs: Math.round(15 * durScale),
      decayMs: Math.round(300 * durScale),
      delayMs: Math.round(35 * durScale),
      filter: {
        type: 'highpass',
        freq: [900, 1200],
        q: 3.2,
      },
    });
  } else if (input.timbreFilter === 'warm-anchor') {
    // Balanced Wanderer anchor calm: warm low-passed sine + sub-harmonic chest resonance
    layers.push({
      wave: 'sine',
      freq: [f0, Math.round(f0 * 0.98)],
      gain: 0.65,
      attackMs: Math.round(35 * durScale),
      decayMs: Math.round(310 * durScale),
      filter: {
        type: 'lowpass',
        freq: [680, 560],
        q: 1.4,
      },
    });
    layers.push({
      wave: 'triangle',
      freq: [Math.round(f0 * 0.5), Math.round(f0 * 0.5)],
      gain: 0.32,
      attackMs: Math.round(40 * durScale),
      decayMs: Math.round(290 * durScale),
      filter: {
        type: 'lowpass',
        freq: [420, 380],
        q: 1.2,
      },
    });
  } else {
    // 'clear' default balanced voice formant
    layers.push({
      wave: 'triangle',
      freq: [f0, Math.round(f0 * 1.05)],
      gain: 0.58,
      attackMs: Math.round(20 * durScale),
      decayMs: Math.round(270 * durScale),
      filter: {
        type: 'lowpass',
        freq: [1450, 1300],
        q: 2.0,
      },
    });
  }

  // Paralinguistic breath cue layer (inspired by Block's Dessa full-duplex vocalizations)
  if (breathCue === 'sigh') {
    layers.push({
      wave: 'noise',
      freq: [600, 280],
      gain: 0.22,
      attackMs: 30,
      decayMs: Math.min(durationMs - 35, 240),
      filter: { type: 'lowpass', freq: [900, 380], q: 1.5 },
    });
  } else if (breathCue === 'gasp') {
    layers.push({
      wave: 'noise',
      freq: [1800, 2600],
      gain: 0.3,
      attackMs: 8,
      decayMs: Math.min(durationMs - 15, 110),
      filter: { type: 'highpass', freq: [1200, 1800], q: 3.0 },
    });
  } else if (breathCue === 'laugh') {
    layers.push({
      wave: 'sine',
      freq: [Math.round(f0 * 1.35), Math.round(f0 * 1.15)],
      gain: 0.3,
      attackMs: 10,
      decayMs: Math.min(durationMs - 25, 130),
      delayMs: 12,
    });
  }

  return normalizeRecipe({
    id: input.id ?? `voice-${input.timbreFilter}-${breathCue}`,
    category: 'ui',
    durationMs,
    layers,
  });
}

/**
 * Renders deterministic PCM audio samples for a somatic voice envelope and measures its RMS, peak, and
 * zero-crossing frequency (spectral brightness).
 */
export function synthesizeSomaticVoice(
  input: SomaticVoiceSynthInput,
  sampleRate = 22050,
  seed = 1,
): SomaticVoiceRenderResult {
  const recipe = buildSomaticVoiceRecipe(input);
  const samples = renderRecipe(recipe, sampleRate, seed);
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1]! >= 0 && samples[i]! < 0) || (samples[i - 1]! < 0 && samples[i]! >= 0)) {
      crossings++;
    }
  }
  const durationSec = Math.max(0.001, samples.length / sampleRate);
  const zeroCrossingHz = Math.round((crossings / (2 * durationSec)) * 10) / 10;

  return {
    recipe,
    samples,
    rms: Math.round(rmsOf(samples) * 10000) / 10000,
    peak: Math.round(peakOf(samples) * 10000) / 10000,
    zeroCrossingHz,
  };
}

