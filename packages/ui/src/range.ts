/**
 * The maths of a slider that never stops anybody short. The schema gives a comfortable range; the slider shows it, and when a value lies outside
 * it (typed, pushed past the end, set by a driver) the shown range grows to hold it with some headroom and shrinks back when the value returns.
 * Holding the thumb against an end makes the range grow like a scrollbar that keeps extending. Pure functions; no DOM.
 */
export interface Range { readonly lo: number; readonly hi: number }

const TIDY = [1, 2, 2.5, 5, 10] as const;

/** The smallest tidy number (1, 2, 2.5, 5 or 10 times a power of ten) that is at least x. Works for negatives and zero. */
export function niceUp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x === 0) return 0;
  if (x < 0) return -niceDown(-x);
  const mag = 10 ** Math.floor(Math.log10(x));
  for (const t of TIDY) { const c = t * mag; if (c >= x * (1 - 1e-12)) return round(c); }
  return round(10 * mag);
}

/** The largest tidy number that is at most x. */
export function niceDown(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x === 0) return 0;
  if (x < 0) return -niceUp(-x);
  const mag = 10 ** Math.floor(Math.log10(x));
  let best = mag;
  for (const t of TIDY) { const c = t * mag; if (c <= x * (1 + 1e-12)) best = c; }
  return round(best);
}

/** Strip float noise (0.30000000000000004 -> 0.3). */
export function round(x: number): number {
  return Number.isFinite(x) ? Number(x.toPrecision(12)) : x;
}

const HEADROOM = 0.25;

/**
 * The range a slider shows for a value. Inside the comfortable range it is that range. Outside, the end that was passed moves out to a tidy
 * number with 25% of the span as headroom, so the thumb sits comfortably inside rather than on the edge. `hard` keeps the range inside what the
 * value may ever be. Always returns lo < hi and a range that contains the value.
 */
export function fitRange(base: Range, value: number, hard: Range = { lo: -Infinity, hi: Infinity }): Range {
  let lo = Number.isFinite(base.lo) ? base.lo : 0;
  let hi = Number.isFinite(base.hi) ? base.hi : lo + 1;
  if (hi <= lo) hi = lo + 1;
  if (!Number.isFinite(value)) return { lo, hi };
  const span = hi - lo;
  if (value > hi) hi = niceUp(value + span * HEADROOM);
  if (value < lo) lo = niceDown(value - span * HEADROOM);
  lo = Math.max(lo, hard.lo);
  hi = Math.min(hi, hard.hi);
  // the value is always inside, and the range is never empty
  if (value > hi) hi = value;
  if (value < lo) lo = value;
  if (hi <= lo) hi = lo + 1;
  return { lo: round(lo), hi: round(hi) };
}

/** Where a value sits on the track, 0..1 (clamped). */
export function toFraction(range: Range, v: number): number {
  const span = range.hi - range.lo;
  return span > 0 ? Math.min(1, Math.max(0, (v - range.lo) / span)) : 0;
}

export function fromFraction(range: Range, f: number): number {
  return range.lo + (range.hi - range.lo) * Math.min(1, Math.max(0, f));
}

/** Snap to the setting's step, if it has one (steps count from zero, so 0.05 gives 0.05, 0.1, 0.15 ...). */
export function quantise(v: number, step: number | undefined): number {
  if (step === undefined || !(step > 0)) return round(v);
  return round(Math.round(v / step) * step);
}

export function clampTo(v: number, hard: Range): number {
  return Math.min(hard.hi, Math.max(hard.lo, v));
}

/**
 * Holding the thumb against an end with the pointer pushed `overshootPx` beyond it: the range grows on that side. The harder the push, the
 * faster (150 px beyond the end grows the span by about 4.5x per second at most). The result never passes `hard` and the pushed end is where the value is.
 */
export function growRange(range: Range, side: 'hi' | 'lo', overshootPx: number, dtSeconds: number, hard: Range = { lo: -Infinity, hi: Infinity }): Range {
  const span = Math.max(1e-9, range.hi - range.lo);
  const rate = Math.min(1.5, Math.max(0, overshootPx) / 150);
  const add = span * rate * Math.max(0, Math.min(0.1, dtSeconds));
  if (side === 'hi') return { lo: range.lo, hi: round(Math.min(hard.hi, range.hi + add)) };
  return { lo: round(Math.max(hard.lo, range.lo - add)), hi: range.hi };
}

/** A step to snap typed-in or dragged values to when the schema gives none: about 1/200 of the span, tidied. */
export function defaultStep(range: Range): number {
  const raw = (range.hi - range.lo) / 200;
  return raw > 0 ? niceDown(raw) || raw : 0.01;
}

/** The number as shown in the box: no float noise, at most 6 significant digits. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Number(n.toPrecision(6)));
}
