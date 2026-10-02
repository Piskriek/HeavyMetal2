import { sampleCurve } from './curve';
import { stepNoise } from './sequence';
import { keyRange } from './timeline';
import type { Keyframe, ModulatorDef, Range } from './types';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const frac = (v: number): number => v - Math.floor(v);
const norm = (v: number, out: Range): number => out.min + v * (out.max - out.min);
const hash3 = (seed: number, i: number): number => (stepNoise(seed, i) + stepNoise(seed, i + 101) + stepNoise(seed, i + 202)) / 3;

/** Evaluate a keyframe list (sorted) at an absolute time in ms, honouring each key's ease. */
export function sampleKeys(keys: readonly Keyframe[], range: Range, tMs: number): number {
  if (keys.length === 0) return range.min;
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (tMs <= first.timeMs) return first.value;
  if (tMs >= last.timeMs) return last.value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (tMs < a.timeMs || tMs > b.timeMs) continue;
    const span = b.timeMs - a.timeMs;
    const t = span > 0 ? clamp01((tMs - a.timeMs) / span) : 1;
    const e = a.ease ?? 'linear';
    const f = e === 'hold' ? 0 : e === 'in' ? t * t : e === 'out' ? 1 - (1 - t) * (1 - t) : e === 'inOut' ? smooth(t) : t;
    return lerp(a.value, b.value, f);
  }
  return last.value;
}

function sampleLoopTime(t: number, durationMs: number, loop: 'none' | 'loop' | 'pingpong'): number {
  const d = Math.max(1, durationMs);
  if (loop === 'pingpong') return (1 - Math.abs(1 - 2 * frac(t * (d / d)))) * d;
  return frac(t) * d;
}

/** Deterministic 0..1 sample of a modulator definition (pure, no clock). */
export function sampleModulator(def: ModulatorDef, t: number, depth = 0): number {
  const u = clamp01(t);
  if (depth > 6) return 0;
  switch (def.kind) {
    case 'constant':
      return def.value;
    case 'random': {
      const rate = Math.max(0, def.rateHz);
      const phase = u * rate;
      const i = Math.floor(phase);
      const a = stepNoise(def.seed ?? 1, i);
      if (def.mode === 'hold') return norm(def.distribution === 'gaussian' ? hash3(def.seed ?? 1, i) : a, def.out);
      const b = stepNoise(def.seed ?? 1, i + 1);
      return norm(lerp(def.distribution === 'gaussian' ? hash3(def.seed ?? 1, i) : a, def.distribution === 'gaussian' ? hash3(def.seed ?? 1, i + 1) : b, smooth(phase - i)), def.out);
    }
    case 'noise': {
      const octaves = Math.max(1, Math.round(def.octaves ?? 3));
      const gain = def.gain ?? 0.6;
      let sum = 0;
      let amp = 1;
      let total = 0;
      for (let o = 0; o < octaves; o++) {
        const freq = Math.max(0.0001, def.freqHz) * Math.pow(2, o);
        const phase = u * freq;
        const i = Math.floor(phase);
        sum += amp * lerp(stepNoise(def.seed ?? 1, i), stepNoise(def.seed ?? 1, i + 1), smooth(phase - i));
        total += amp;
        amp *= gain;
      }
      return norm(clamp01(sum / Math.max(0.0001, total)), def.out);
    }
    case 'lfo': {
      const p = frac(u * def.freqHz + (def.phase ?? 0));
      const w = def.width ?? 0.5;
      let v: number;
      if (def.wave === 'sine') v = 0.5 + 0.5 * Math.sin(p * Math.PI * 2 - Math.PI / 2);
      else if (def.wave === 'triangle') v = 1 - Math.abs(1 - 2 * p);
      else if (def.wave === 'saw') v = p;
      else v = p < w ? 1 : 0;
      return norm(v, def.out);
    }
    case 'curve': {
      const x = def.input.source === 'time' ? u : clamp01(stepNoise(u * 1000, 7) * 0.5 + u * 0.5);
      return norm(clamp01(sampleCurve(def.points, x, def.interpolation)), def.out);
    }
    case 'timeline':
      return sampleKeys(def.keys, keyRange(def.keys), sampleLoopTime(u, def.durationMs, def.loop));
    case 'sequence': {
      const n = Math.max(1, def.steps.length);
      const v = def.steps[Math.min(n - 1, Math.floor(u * n))] ?? 0;
      const out: Range = def.out ?? { min: 0, max: 1 };
      return norm(clamp01(v), out);
    }
    case 'stream': {
      const phase = u * 8;
      const i = Math.floor(phase);
      const raw = lerp(stepNoise(i * 31 + 5, i), stepNoise(i * 31 + 5, i + 1), smooth(phase - i));
      const v = (def.scale ?? 1) * raw + (def.offset ?? 0);
      const c = def.clamp;
      return c ? Math.min(c.max, Math.max(c.min, v)) : v;
    }
    case 'expr':
      return def.fallback ?? 0;
    case 'texture': {
      const a = sampleModulator(def.u, u, depth + 1);
      const b = sampleModulator(def.v, u, depth + 1);
      return norm((a + b) / 2, def.out);
    }
    case 'combine': {
      const vals = def.inputs.map((input) => sampleModulator(input, u, depth + 1));
      if (vals.length === 0) return 0;
      let acc = vals[0]!;
      for (let i = 1; i < vals.length; i++) {
        const v = vals[i]!;
        acc = def.op === 'add' ? acc + v : def.op === 'multiply' ? acc * v : def.op === 'min' ? Math.min(acc, v) : def.op === 'max' ? Math.max(acc, v) : lerp(acc, v, clamp01(def.mix ?? 0.5));
      }
      return acc;
    }
    default:
      return 0;
  }
}

/** A row of samples for the preview sparkline. */
export function previewValues(def: ModulatorDef, count = 96): number[] {
  const n = Math.max(2, Math.round(count));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(sampleModulator(def, i / (n - 1)));
  return out;
}
