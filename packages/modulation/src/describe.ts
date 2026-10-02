import type { ModulatorDef, Range } from './types';

/** Compact number: up to 3 decimals, no trailing zeros (2.5 -> "2.5", 0.05 -> "0.05"). */
function n(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '-∞' : 'NaN';
  const r = Math.round(v * 1000) / 1000;
  return String(r);
}

function seconds(ms: number): string {
  return `${n(ms / 1000)} s`;
}

function rangeText(r: Range): string {
  return `${n(r.min)} to ${n(r.max)}`;
}

function between(r: Range): string {
  return `between ${n(r.min)} and ${n(r.max)}`;
}

const LOOP_LABEL: Record<string, string> = { none: 'one-shot', loop: 'looping', 'pingpong': 'ping-pong' };

/** One-line English summary of what a modulator does. */
export function describeModulator(def: ModulatorDef): string {
  switch (def.kind) {
    case 'constant':
      return `Constant ${n(def.value)}`;
    case 'random': {
      const cadence = def.rateHz > 0 ? `every ${seconds(1000 / def.rateHz)}` : '(frozen)';
      const dist = def.distribution === 'gaussian' ? ' gaussian' : '';
      return `Random${dist} ${cadence} (${def.mode}) ${between(def.out)}`;
    }
    case 'noise':
      return `Noise ${n(def.freqHz)} Hz, ${def.octaves ?? 3} octave${(def.octaves ?? 3) === 1 ? '' : 's'} ${between(def.out)}`;
    case 'lfo': {
      const detail = def.wave === 'square' ? `, ${Math.round((def.width ?? 0.5) * 100)}% duty` : '';
      return `${cap(def.wave)} wave ${n(def.freqHz)} Hz from ${n(def.out.min)} to ${n(def.out.max)}${detail}`;
    }
    case 'curve': {
      const src =
        def.input.source === 'time'
          ? `a ${n(def.input.loopMs)} ms loop`
          : `"${def.input.path}" (${n(def.input.in.min)}..${n(def.input.in.max)})`;
      return `${cap(def.interpolation)} curve of ${src} with ${def.points.length} point${def.points.length === 1 ? '' : 's'} -> ${rangeText(def.out)}`;
    }
    case 'timeline':
      return `Timeline ${seconds(def.durationMs)} ${LOOP_LABEL[def.loop] ?? def.loop}, ${def.keys.length} key${def.keys.length === 1 ? '' : 's'}`;
    case 'sequence':
      return `Sequence of ${def.steps.length} step${def.steps.length === 1 ? '' : 's'} at ${n(def.rateHz)} Hz${def.glideMs ? ` gliding ${n(def.glideMs)} ms` : ''}${def.out ? ` -> ${rangeText(def.out)}` : ''}`;
    case 'stream': {
      const parts = [`Stream ${def.path}`];
      if (def.scale !== undefined || def.offset !== undefined) parts.push(`x${n(def.scale ?? 1)}`);
      if (def.offset !== undefined) parts.push(`+${n(def.offset)}`);
      if (def.smoothMs) parts.push(`smoothed ${n(def.smoothMs)} ms`);
      if (def.clamp) parts.push(`clamped ${n(def.clamp.min)}..${n(def.clamp.max)}`);
      return parts.join(' ');
    }
    case 'texture':
      return `Texture "${def.textureId}" sampled at u=${describeModulator(def.u)}, v=${describeModulator(def.v)} -> ${rangeText(def.out)}`;
    case 'expr':
      return `Expression "${def.source}"${def.fallback !== undefined ? ` (fallback ${n(def.fallback)})` : ''}`;
    case 'combine': {
      const label = def.op === 'mix' ? `mix ${Math.round((def.mix ?? 0.5) * 100)}%` : def.op;
      return `Combine (${label}) of ${def.inputs.length} source${def.inputs.length === 1 ? '' : 's'}`;
    }
    default:
      return 'Unknown modulator';
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WIDE: Readonly<Range> = { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY };

function combineIntervals(op: 'add' | 'multiply' | 'min' | 'max' | 'mix', parts: readonly Range[], mix: number): Range {
  if (parts.length === 0) return { min: 0, max: 0 };
  if (op === 'add') {
    return parts.reduce<Range>((acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }), { min: 0, max: 0 });
  }
  if (op === 'min' || op === 'max') {
    const pick = op === 'min' ? Math.min : Math.max;
    let acc = parts[0]!;
    for (let i = 1; i < parts.length; i++) {
      const r = parts[i]!;
      acc = { min: pick(acc.min, r.min), max: pick(acc.max, r.max) };
    }
    return acc;
  }
  if (op === 'mix') {
    if (parts.length === 1) return parts[0]!;
    const [a, b] = parts;
    return { min: a!.min * (1 - mix) + b!.min * mix, max: a!.max * (1 - mix) + b!.max * mix };
  }
  // multiply: interval arithmetic over the corner combinations
  let acc: Range = { min: 1, max: 1 };
  for (const r of parts) {
    const corners = [acc.min * r.min, acc.min * r.max, acc.max * r.min, acc.max * r.max];
    acc = { min: Math.min(...corners), max: Math.max(...corners) };
  }
  return acc;
}

/** The output range a definition can produce (interval arithmetic for combine). */
export function rangeOf(def: ModulatorDef): Range {
  switch (def.kind) {
    case 'constant':
      return { min: def.value, max: def.value };
    case 'random':
    case 'noise':
    case 'lfo':
    case 'curve':
    case 'texture':
      return { min: def.out.min, max: def.out.max };
    case 'timeline': {
      if (def.keys.length === 0) return { min: 0, max: 0 };
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const k of def.keys) {
        min = Math.min(min, k.value);
        max = Math.max(max, k.value);
      }
      return { min, max };
    }
    case 'sequence': {
      if (def.out) return { min: def.out.min, max: def.out.max };
      if (def.steps.length === 0) return { min: 0, max: 0 };
      return { min: Math.min(...def.steps), max: Math.max(...def.steps) };
    }
    case 'stream':
      return def.clamp ? { min: def.clamp.min, max: def.clamp.max } : { ...WIDE };
    case 'expr':
      return { ...WIDE };
    case 'combine': {
      const parts = def.inputs.map(rangeOf);
      const mix = Math.min(1, Math.max(0, def.mix ?? 0.5));
      return combineIntervals(def.op, parts, mix);
    }
    default:
      return { min: 0, max: 0 };
  }
}
