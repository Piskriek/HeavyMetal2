import { clamp, clamp01, frac, isFiniteNumber, lerp, map01, smoothstep } from './ease';
import { gaussian01, hash01 } from './rng';
import type { ModContext, ModulatorDef, Range } from './types';

/** A stateless (or self-managed) sample source. `reset` exists only for stateful ones. */
export interface Source {
  sample(ctx: ModContext): number;
  reset?(): void;
}

export function makeConstant(def: Extract<ModulatorDef, { kind: 'constant' }>): Source {
  const value = isFiniteNumber(def.value) ? def.value : 0;
  return { sample: () => value };
}

/** valueAt(slot) is a pure hash of the slot index -> replayable, order independent. */
export function makeRandom(def: Extract<ModulatorDef, { kind: 'random' }>, seed: number): Source {
  const s = isFiniteNumber(def.seed) ? def.seed : seed;
  const rate = isFiniteNumber(def.rateHz) && def.rateHz > 0 ? def.rateHz : 0;
  const out: Range = def.out;
  const gaussian = def.distribution === 'gaussian';
  const valueAt = (slot: number): number => {
    const h = gaussian ? gaussian01(s, slot) : hash01(s, slot);
    return map01(h, out);
  };

  if (rate === 0) {
    const frozen = valueAt(0);
    return { sample: () => frozen };
  }

  if (def.mode === 'smooth') {
    return {
      sample: (ctx) => {
        const x = (ctx.timeMs / 1000) * rate;
        const slot = Math.floor(x);
        const f = x - slot;
        return lerp(valueAt(slot), valueAt(slot + 1), smoothstep(f));
      },
    };
  }

  return { sample: (ctx) => valueAt(Math.floor((ctx.timeMs / 1000) * rate)) };
}

/** 1-D value noise with smoothstep interpolation between lattice hashes. */
function valueNoise(x: number, s: number): number {
  const i = Math.floor(x);
  return lerp(hash01(s, i), hash01(s, i + 1), smoothstep(x - i));
}

export function makeNoise(def: Extract<ModulatorDef, { kind: 'noise' }>, seed: number): Source {
  const s = isFiniteNumber(def.seed) ? def.seed : seed;
  const octaves = Math.max(1, Math.min(8, Math.floor(isFiniteNumber(def.octaves) ? def.octaves : 3)));
  const gain = isFiniteNumber(def.gain) ? clamp(def.gain, 0, 1) : 0.5;
  const freqHz = isFiniteNumber(def.freqHz) && def.freqHz > 0 ? def.freqHz : 0;
  const amps: number[] = [];
  let total = 0;
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    amps.push(amp);
    total += amp;
    amp *= gain;
  }
  const out: Range = def.out;

  return {
    sample: (ctx) => {
      const tSec = ctx.timeMs / 1000;
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amps[o]! * valueNoise(tSec * freqHz * Math.pow(2, o), s + o * 1013);
      }
      return map01(total > 0 ? sum / total : 0, out);
    },
  };
}

export function makeLfo(def: Extract<ModulatorDef, { kind: 'lfo' }>): Source {
  const freqHz = isFiniteNumber(def.freqHz) && def.freqHz > 0 ? def.freqHz : 0;
  const phase = isFiniteNumber(def.phase) ? frac(def.phase) : 0;
  const width = isFiniteNumber(def.width) ? clamp01(def.width) : 0.5;
  const out: Range = def.out;
  const twoPi = Math.PI * 2;

  const shape = (p: number): number => {
    switch (def.wave) {
      case 'sine':
        return 0.5 - 0.5 * Math.cos(twoPi * p);
      case 'triangle':
        return 1 - Math.abs(2 * p - 1);
      case 'saw':
        return p;
      case 'square':
      default:
        return p < width ? 1 : 0;
    }
  };

  return {
    sample: (ctx) => map01(shape(frac((ctx.timeMs / 1000) * freqHz + phase)), out),
  };
}

/** Curve lookup: normalised x from time (looping) or from a live stream. */
export function makeCurve(def: Extract<ModulatorDef, { kind: 'curve' }>): Source {
  const out: Range = def.out;
  if (def.points.length === 0) {
    const min = out.min;
    return { sample: () => min };
  }
  const points = def.points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const input = def.input;
  const streamPath = input.source === 'stream' ? input.path : null;
  const inMin = input.source === 'stream' ? input.in.min : 0;
  const inSpan = input.source === 'stream' ? input.in.max - input.in.min : 1;
  const loopMs = input.source === 'time' ? input.loopMs : 0;
  const interpolation = def.interpolation;

  const yAt = (x: number): number => {
    if (x <= first[0]) return first[1];
    if (x >= last[0]) return last[1];
    let i = 0;
    while (i < points.length - 2 && points[i + 1]![0] < x) i++;
    const a = points[i]!;
    const b = points[i + 1]!;
    const span = b[0] - a[0];
    const f = span > 0 ? (x - a[0]) / span : 0;
    if (interpolation === 'step') return a[1];
    return lerp(a[1], b[1], interpolation === 'smooth' ? smoothstep(f) : f);
  };

  return {
    sample: (ctx) => {
      let x: number;
      if (streamPath === null) {
        x = loopMs > 0 ? frac(ctx.timeMs / loopMs) : 0;
      } else {
        const raw = ctx.read(streamPath);
        const v = isFiniteNumber(raw) ? raw : inMin;
        x = inSpan !== 0 ? clamp01((v - inMin) / inSpan) : v >= inMin ? 1 : 0;
      }
      return map01(yAt(clamp01(x)), out);
    },
  };
}


