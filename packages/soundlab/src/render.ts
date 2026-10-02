import type { SfxFilter, SfxRecipe } from './recipe';

/** Small deterministic generator (the sound lab never touches Math.random). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ cookbook coefficients. */
function biquad(type: SfxFilter['type'], cutoff: number, q: number, sampleRate: number): Biquad {
  const w = (2 * Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

const wave = (kind: string, phase: number): number => {
  switch (kind) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * phase - 1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    default: return Math.sin(2 * Math.PI * phase);
  }
};

/**
 * A deterministic offline synth of a recipe, for previews and tests. Each layer follows the same rules as the live player:
 * a delay, a linear attack to its gain, then an exponential decay towards silence, a frequency glide, and an optional filter.
 * The same inputs always give bit-identical samples.
 */
export function renderRecipe(r: SfxRecipe, sampleRate = 22050, seed = 1): Float32Array {
  const total = Math.max(1, Math.ceil((r.durationMs / 1000) * sampleRate));
  const out = new Float32Array(total);
  r.layers.forEach((l, li) => {
    if (!(l.gain > 0)) return;
    const start = Math.floor(((l.delayMs ?? 0) / 1000) * sampleRate);
    const attack = Math.max(0, Math.round((l.attackMs / 1000) * sampleRate));
    const decay = Math.max(1, Math.round((l.decayMs / 1000) * sampleRate));
    const active = attack + decay;
    const noise = l.wave === 'noise' ? mulberry32(seed * 7919 + li * 104729 + 1) : null;
    const f0 = Math.max(1, l.freq[0]), f1 = Math.max(1, l.freq[1]);
    const detune = Math.pow(2, (l.detune ?? 0) / 1200);
    const floor = 0.0001;
    let phase = 0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let c: Biquad | null = null;
    for (let n = 0; n < active && start + n < total; n++) {
      const t = n / active;
      const env = n < attack ? (l.gain * n) / Math.max(1, attack) : l.gain * Math.pow(floor / l.gain, (n - attack) / decay);
      let s: number;
      if (noise) s = (noise() * 2 - 1) * 0.5;
      else {
        const f = f0 * Math.pow(f1 / f0, t) * detune;
        phase += f / sampleRate;
        phase -= Math.floor(phase);
        s = wave(l.wave, phase);
      }
      if (l.filter) {
        if (n % 32 === 0 || !c) c = biquad(l.filter.type, l.filter.freq[0] * Math.pow(l.filter.freq[1] / l.filter.freq[0], t), l.filter.q, sampleRate);
        const y = c.b0 * s + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = s; y2 = y1; y1 = y;
        s = y;
      }
      out[start + n] = out[start + n]! + s * env;
    }
  });
  const peak = peakOf(out);
  if (peak > 1) for (let i = 0; i < out.length; i++) out[i] = out[i]! / peak;
  return out;
}

export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]!); if (a > p) p = a; }
  return p;
}

export function rmsOf(samples: Float32Array): number {
  if (!samples.length) return 0;
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return Math.sqrt(s / samples.length);
}

/** Min and max per bin, for drawing a waveform. */
export function waveformBins(samples: Float32Array, bins: number): { min: number; max: number }[] {
  const n = Math.max(1, Math.floor(bins));
  const out: { min: number; max: number }[] = [];
  for (let b = 0; b < n; b++) {
    const a = Math.floor((b * samples.length) / n), z = Math.max(a + 1, Math.floor(((b + 1) * samples.length) / n));
    let min = 0, max = 0;
    for (let i = a; i < z && i < samples.length; i++) { const v = samples[i]!; if (v < min) min = v; if (v > max) max = v; }
    out.push({ min, max });
  }
  return out;
}
