import { clamp, clamp01, isFiniteNumber, lerp, map01, wrap } from './ease';
import { makeConstant, makeCurve, makeLfo, makeNoise, makeRandom, type Source } from './sources';
import type { Keyframe, ModContext, Modulator, ModulatorDef, Range } from './types';

export function makeTimeline(def: Extract<ModulatorDef, { kind: 'timeline' }>): Source {
  const durationMs = isFiniteNumber(def.durationMs) && def.durationMs > 0 ? def.durationMs : 0;
  const keys: Keyframe[] = [...def.keys]
    .filter((k) => isFiniteNumber(k.timeMs) && isFiniteNumber(k.value))
    .sort((a, b) => a.timeMs - b.timeMs);

  if (keys.length === 0) return { sample: () => 0 };

  // Local playback time for the chosen loop mode.
  const local = (timeMs: number): number => {
    if (durationMs <= 0) return 0;
    if (def.loop === 'none') return clamp(timeMs, 0, durationMs);
    if (def.loop === 'loop') return wrap(timeMs, durationMs);
    const p = wrap(timeMs, durationMs * 2);
    return p <= durationMs ? p : durationMs * 2 - p;
  };

  return {
    sample: (ctx) => {
      const t = local(ctx.timeMs);
      if (t <= keys[0]!.timeMs) return keys[0]!.value;
      const lastKey = keys[keys.length - 1]!;
      if (t >= lastKey.timeMs) return lastKey.value;
      let i = 0;
      while (i < keys.length - 2 && keys[i + 1]!.timeMs < t) i++;
      const a = keys[i]!;
      const b = keys[i + 1]!;
      const span = b.timeMs - a.timeMs;
      const f = span > 0 ? (t - a.timeMs) / span : 1;
      return lerp(a.value, b.value, f >= 1 ? 1 : applyEaseOf(b, f));
    },
  };
}

function applyEaseOf(key: Keyframe, f: number): number {
  // inlined ease to keep the hot path allocation free
  const x = f < 0 ? 0 : f > 1 ? 1 : f;
  switch (key.ease) {
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'inOut':
      return x * x * (3 - 2 * x);
    case 'hold':
      return x >= 1 ? 1 : 0;
    default:
      return x;
  }
}

export function makeSequence(def: Extract<ModulatorDef, { kind: 'sequence' }>): Source {
  const steps = def.steps.filter((v) => isFiniteNumber(v));
  if (steps.length === 0) return { sample: () => 0 };
  const rate = isFiniteNumber(def.rateHz) && def.rateHz > 0 ? def.rateHz : 0;
  const glideMs = isFiniteNumber(def.glideMs) && def.glideMs > 0 ? def.glideMs : 0;
  const out: Range | undefined = def.out;
  const stepMs = rate > 0 ? 1000 / rate : 0;

  const rawAt = (index: number): number => {
    const v = steps[wrap(index, steps.length)]!;
    return out ? map01(v, out) : v;
  };

  if (rate === 0) {
    const frozen = rawAt(0);
    return { sample: () => frozen };
  }

  return {
    sample: (ctx) => {
      const x = (ctx.timeMs / 1000) * rate;
      const index = Math.floor(x);
      const current = rawAt(index);
      if (glideMs === 0) return current;
      const intoMs = (x - index) * stepMs;
      if (intoMs >= glideMs) return current;
      return lerp(rawAt(index - 1), current, intoMs / glideMs);
    },
  };
}

/** Stateful: keeps the last good stream value and (optionally) an exponential smoother. */
export function makeStream(def: Extract<ModulatorDef, { kind: 'stream' }>): Source {
  const scale = isFiniteNumber(def.scale) ? def.scale : 1;
  const offset = isFiniteNumber(def.offset) ? def.offset : 0;
  const smoothMs = isFiniteNumber(def.smoothMs) && def.smoothMs > 0 ? def.smoothMs : 0;
  const clampRange = def.clamp;
  let lastGood = 0;
  let y = 0;
  let primed = false;

  return {
    sample: (ctx) => {
      const raw = ctx.read(def.path);
      if (isFiniteNumber(raw)) lastGood = raw;
      const v = lastGood * scale + offset;
      let value: number;
      if (smoothMs === 0) {
        value = v;
      } else if (!primed) {
        value = v;
      } else {
        value = y + (v - y) * (1 - Math.exp(-Math.max(0, ctx.dtMs) / smoothMs));
      }
      y = value;
      primed = true;
      return clampRange ? clamp(value, clampRange.min, clampRange.max) : value;
    },
    reset: () => {
      lastGood = 0;
      y = 0;
      primed = false;
    },
  };
}

export function makeTexture(def: Extract<ModulatorDef, { kind: 'texture' }>, seed: number): Source {
  const u = createModulator(def.u, seed);
  const v = createModulator(def.v, seed + 7919);
  const out: Range = def.out;
  return {
    sample: (ctx) => {
      const tu = clamp01(u.sample(ctx));
      const tv = clamp01(v.sample(ctx));
      const tex = ctx.sampleTexture?.(def.textureId, tu, tv);
      return map01(isFiniteNumber(tex) ? tex : 0, out);
    },
    reset: () => {
      u.reset();
      v.reset();
    },
  };
}

export function makeExpr(def: Extract<ModulatorDef, { kind: 'expr' }>): Source {
  const fallback = isFiniteNumber(def.fallback) ? def.fallback : 0;
  return {
    sample: (ctx: ModContext): number => {
      const evaluate = ctx.evaluate;
      if (!evaluate) return fallback;
      try {
        const v = evaluate(def.source, { t: ctx.timeMs / 1000, dt: ctx.dtMs / 1000, tick: ctx.tick });
        return isFiniteNumber(v) ? v : fallback;
      } catch {
        return fallback;
      }
    },
  };
}

export function makeCombine(def: Extract<ModulatorDef, { kind: 'combine' }>, seed: number): Source {
  const children = def.inputs.map((child, i) => createModulator(child, seed + i * 7919));
  const mix = isFiniteNumber(def.mix) ? clamp(def.mix, 0, 1) : 0.5;

  const fold = (ctx: ModContext): number => {
    const values = children.map((c) => c.sample(ctx));
    switch (def.op) {
      case 'multiply':
        return values.reduce((a, b) => a * b, 1);
      case 'min':
        return values.length === 0 ? 0 : Math.min(...values);
      case 'max':
        return values.length === 0 ? 0 : Math.max(...values);
      case 'mix':
        if (values.length === 0) return 0;
        if (values.length === 1) return values[0]!;
        return lerp(values[0]!, values[1]!, mix);
      case 'add':
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  };

  return {
    sample: fold,
    reset: () => children.forEach((c) => c.reset()),
  };
}

/** Factory for every modulator kind. Nested defs receive derived seeds (seed + i * 7919). */
export function createModulator(def: ModulatorDef, seed = 0): Modulator {
  const src = build(def, seed);
  return {
    def,
    sample: (ctx: ModContext): number => {
      try {
        const v = src.sample(ctx);
        return isFiniteNumber(v) ? v : 0;
      } catch {
        return 0;
      }
    },
    reset: () => src.reset?.(),
  };
}

function build(def: ModulatorDef, seed: number): Source {
  switch (def.kind) {
    case 'constant':
      return makeConstant(def);
    case 'random':
      return makeRandom(def, seed);
    case 'noise':
      return makeNoise(def, seed);
    case 'lfo':
      return makeLfo(def);
    case 'curve':
      return makeCurve(def);
    case 'timeline':
      return makeTimeline(def);
    case 'sequence':
      return makeSequence(def);
    case 'stream':
      return makeStream(def);
    case 'texture':
      return makeTexture(def, seed);
    case 'expr':
      return makeExpr(def);
    case 'combine':
      return makeCombine(def, seed);
    default:
      return makeConstant({ kind: 'constant', value: 0 });
  }
}
