import type { Ease } from './types';

/** Clamp t into [0, 1]. */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Clamp v into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Fractional part, always in [0, 1) (frac(1) === 0). */
export function frac(x: number): number {
  return x - Math.floor(x);
}

/** Positive modulo, always in [0, m). */
export function wrap(x: number, m: number): number {
  if (!(m > 0)) return 0;
  return ((x % m) + m) % m;
}

/** Map a 0..1 signal into a range. */
export function map01(v: number, out: { min: number; max: number }): number {
  return out.min + (out.max - out.min) * v;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** smoothstep easing curve, used by noise / random-smooth / curve 'smooth'. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Apply a named ease to a 0..1 progress value.
 * 'hold' is a step: 0 until the segment completes, then 1.
 */
export function applyEase(t: number, ease: Ease): number {
  if (!Number.isFinite(t)) return 0;
  const x = clamp01(t);
  switch (ease) {
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'inOut':
      return x * x * (3 - 2 * x);
    case 'hold':
      return x >= 1 ? 1 : 0;
    case 'linear':
    default:
      return x;
  }
}
