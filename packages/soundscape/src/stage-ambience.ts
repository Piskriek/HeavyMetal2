// src/stage-ambience.ts
// The stage ambience (P1-SOUND-03, TASK-29 part A): a pure plan of procedural layers, from the four floats and the stage.
// The game turns each layer into a synth (an oscillator or shaped noise, with an LFO) on the ambience bus. Pure data:
// no DOM, no Date, no randomness. The noise and the reverb tail are deterministic (a seeded xorshift), so a plan and its
// buffers come out the same every time.

import type { Layer } from './index';

export interface AmbienceFloats {
  /** Pixel density, vertex density, light flux and aquatic level: each 0 to 1. */
  readonly pxd: number;
  readonly vtx: number;
  readonly lx: number;
  readonly aq: number;
}

export interface AmbienceQuery {
  /** The lab (the quantum-shielded white room) or the planet's surface. */
  readonly where: 'lab' | 'planet';
  /** The Fidelity stage, 0 to 6 (a fraction rounds down). */
  readonly stage: number;
  readonly floats: AmbienceFloats;
  /** The listener is close to standing water (the caller decides; the plan also needs Aq at least 0.40). */
  readonly nearWater: boolean;
}

/** A layer with a name, so the game can keep it between plans and fade it in and out. */
export interface AmbienceLayer extends Layer {
  readonly id: string;
}

export interface AmbiencePlan {
  readonly layers: readonly AmbienceLayer[];
  /** The lab's muffled storm: the approved storm sound, looped and low-passed, or null. */
  readonly storm: { readonly gain: number; readonly cutoffHz: number } | null;
  /** The warm reverb's wet level, 0 to 0.2 (from stage 4). */
  readonly reverbWet: number;
}

/** From stage 2 the helmet opens and the wind sweeps the rims, when Lx is at least this. */
export const OPEN_HELMET_LX = 0.35;
/** From stage 3 the water sounds play, near water, when Aq is at least this. */
export const WATER_AQ = 0.4;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * The layers that should be playing for this place, stage and floats. Gains are the base level of each layer; the LFO
 * then breathes it by `lfoDepth`. Noise layers are shaped by their filter at `cutoff` (their `freq` is the same number).
 */
export function ambiencePlan(q: AmbienceQuery): AmbiencePlan {
  const stage = Number.isFinite(q.stage) ? Math.floor(Math.min(6, Math.max(0, q.stage))) : 0;
  const f = { pxd: clamp01(q.floats.pxd), vtx: clamp01(q.floats.vtx), lx: clamp01(q.floats.lx), aq: clamp01(q.floats.aq) };

  if (q.where === 'lab') {
    return {
      layers: [
        { id: 'amb-lab-hum', wave: 'sine', freq: 50, gain: 0.07, lfoHz: 0.05, lfoDepth: 0.1, filter: 'lowpass', cutoff: 180 },
        { id: 'amb-lab-vent', wave: 'noise', freq: 700, gain: 0.05, lfoHz: 0.07, lfoDepth: 0.4, filter: 'bandpass', cutoff: 700 },
      ],
      storm: { gain: 0.16, cutoffHz: 900 },
      reverbWet: 0,
    };
  }

  const layers: AmbienceLayer[] = [];
  const opened = stage >= 2 && f.lx >= OPEN_HELMET_LX;
  // crunch: dry regolith under foot; the grain follows the pixel density, crisper once the helmet is open
  const crunchCut = (opened ? 2600 : 1500) * (0.8 + 0.4 * f.pxd);
  layers.push({ id: 'amb-crunch', wave: 'noise', freq: crunchCut, gain: opened ? 0.1 : 0.12, lfoHz: 2.2, lfoDepth: 0.8, filter: 'bandpass', cutoff: crunchCut });

  if (opened) {
    // the helmet is open: the breath gives way to the open air, and the wind sweeps the rims
    layers.push({ id: 'amb-air-open', wave: 'noise', freq: 1100, gain: 0.04, lfoHz: 0.12, lfoDepth: 0.3, filter: 'highpass', cutoff: 1100 });
    layers.push({ id: 'amb-wind-rims', wave: 'noise', freq: 900, gain: 0.16, lfoHz: 0.14, lfoDepth: 0.8, filter: 'bandpass', cutoff: 900 });
  } else {
    // helmet on: the breath, and a thin low-passed wind
    layers.push({ id: 'amb-breath', wave: 'noise', freq: 520, gain: 0.1, lfoHz: 0.22, lfoDepth: 0.6, filter: 'bandpass', cutoff: 520 });
    layers.push({ id: 'amb-wind-thin', wave: 'noise', freq: 260, gain: 0.09, lfoHz: 0.1, lfoDepth: 0.5, filter: 'lowpass', cutoff: 260 });
  }

  if (stage >= 3 && q.nearWater && f.aq >= WATER_AQ) {
    layers.push({ id: 'amb-lapping', wave: 'noise', freq: 420, gain: 0.16, lfoHz: 0.25, lfoDepth: 0.7, filter: 'lowpass', cutoff: 420 });
    layers.push({ id: 'amb-wet-steps', wave: 'noise', freq: 1100, gain: 0.07, lfoHz: 1.9, lfoDepth: 0.8, filter: 'lowpass', cutoff: 1100 });
  }

  if (stage >= 4) {
    // wind in the growth; more plants (vertex density) rustle more
    layers.push({ id: 'amb-growth-wind', wave: 'noise', freq: 650, gain: 0.1 * (0.6 + 0.8 * f.vtx), lfoHz: 0.09, lfoDepth: 0.6, filter: 'bandpass', cutoff: 650 });
  }

  const reverbWet = stage >= 4 ? 0.1 + 0.04 * (stage - 4) : 0;
  return { layers, storm: null, reverbWet };
}

/** A deterministic white-noise buffer (xorshift32 from `seed`), each value in -1 to 1. */
export function whiteNoise(length: number, seed = 0x9e3779b9): Float32Array {
  const out = new Float32Array(Math.max(0, Math.floor(length)));
  let x = seed >>> 0 || 1;
  for (let i = 0; i < out.length; i++) {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    out[i] = x / 2147483648 - 1;
  }
  return out;
}

/** A deterministic reverb tail: white noise that decays by 60 dB over `seconds`. */
export function reverbImpulse(seconds: number, sampleRate: number, seed = 0x2545f491): Float32Array {
  const n = Math.max(1, Math.floor(seconds * sampleRate));
  const noise = whiteNoise(n, seed);
  for (let i = 0; i < n; i++) noise[i] = (noise[i] ?? 0) * Math.exp((-6.9 * i) / n);
  return noise;
}
