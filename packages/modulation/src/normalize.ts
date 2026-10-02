import type { Keyframe, ModulatorDef, Range } from './types';

/** Plain-JSON deep copy (modulator definitions carry no methods). */
function deepCopy<T>(v: T): T {
  if (Array.isArray(v)) return v.map((item) => deepCopy(item)) as unknown as T;
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = deepCopy(val);
    return out as unknown as T;
  }
  return v;
}

function sortedRange(r: Range | undefined): Range | undefined {
  if (!r) return r;
  return r.min <= r.max ? { min: r.min, max: r.max } : { min: r.max, max: r.min };
}

/**
 * Canonical form of a definition: a deep copy whose curve points are sorted by x,
 * whose keyframes are sorted by time and whose ranges all satisfy min <= max.
 * Idempotent: normalize(normalize(d)) deep-equals normalize(d).
 */
export function normalizeModulator(def: ModulatorDef): ModulatorDef {
  const d = deepCopy(def);
  switch (d.kind) {
    case 'curve': {
      const input =
        d.input.source === 'stream'
          ? { source: 'stream' as const, path: d.input.path, in: sortedRange(d.input.in) as Range }
          : { source: 'time' as const, loopMs: d.input.loopMs };
      return {
        kind: 'curve',
        points: [...d.points].sort((a, b) => a[0] - b[0]),
        interpolation: d.interpolation,
        input,
        out: sortedRange(d.out) as Range,
      };
    }
    case 'timeline': {
      const keys: Keyframe[] = [...d.keys]
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((k) => (k.ease !== undefined ? { timeMs: k.timeMs, value: k.value, ease: k.ease } : { timeMs: k.timeMs, value: k.value }));
      return { kind: 'timeline', durationMs: d.durationMs, loop: d.loop, keys };
    }
    case 'sequence': {
      const out = sortedRange(d.out);
      return out ? { ...d, out } : { ...d };
    }
    case 'stream': {
      const clamp = sortedRange(d.clamp);
      return clamp ? { ...d, clamp } : { ...d };
    }
    case 'random':
    case 'noise':
    case 'lfo':
    case 'texture':
      return { ...d, out: sortedRange(d.out) as Range };
    default:
      return d;
  }
}
