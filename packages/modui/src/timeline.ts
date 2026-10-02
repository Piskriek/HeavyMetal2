import type { Ease, Keyframe, Range } from './types';
import type { Box } from './types';

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
const copy = (keys: readonly Keyframe[]): Keyframe[] => keys.map((k) => ({ ...k }));

/** Time in ms -> x pixel inside the plotting box. */
export function timeToPx(box: Box, durationMs: number, t: number): number {
  const span = durationMs > 0 ? durationMs : 1;
  return box.x + (t / span) * box.w;
}

/** x pixel -> time in ms, clamped to 0..duration. */
export function pxToTime(box: Box, durationMs: number, px: number): number {
  const span = durationMs > 0 ? durationMs : 1;
  return clamp(((px - box.x) / box.w) * span, 0, Math.max(0, durationMs));
}

/** Value -> y pixel inside the plotting box (y flipped). */
export function valueToPx(box: Box, range: Range, v: number): number {
  const span = range.max - range.min;
  const t = span > 0 ? (v - range.min) / span : 0.5;
  return box.y + box.h - t * box.h;
}

/** y pixel -> value, clamped to the range. */
export function pxToValue(box: Box, range: Range, py: number): number {
  const span = range.max - range.min;
  if (!(span > 0)) return range.min;
  return clamp(range.min + ((box.y + box.h - py) / box.h) * span, range.min, range.max);
}

/** Min/max of the key values, widened to at least one unit, {0,1} when there are no keys. */
export function keyRange(keys: readonly Keyframe[]): Range {
  if (keys.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const k of keys) {
    min = Math.min(min, k.value);
    max = Math.max(max, k.value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1) max = min + 1;
  return { min, max };
}

/** Move one key: clamped to 0..duration, never crossing a neighbour (stays 1 ms inside), ease kept. */
export function moveKey(keys: readonly Keyframe[], index: number, timeMs: number, value: number, durationMs: number): Keyframe[] {
  const next = copy(keys);
  if (index < 0 || index >= next.length) return next;
  const max = Math.max(0, durationMs);
  let t = clamp(timeMs, 0, max);
  const prev = index > 0 ? next[index - 1]!.timeMs : undefined;
  const nxt = index < next.length - 1 ? next[index + 1]!.timeMs : undefined;
  if (prev !== undefined) t = Math.max(t, prev + 1);
  if (nxt !== undefined) t = Math.min(t, nxt - 1);
  t = clamp(t, 0, max);
  next[index] = { ...next[index]!, timeMs: t, value };
  return next.sort((a, b) => a.timeMs - b.timeMs);
}

/** Insert a key sorted by time; when a key already sits within 5 ms the array is returned unchanged. */
export function addKey(keys: readonly Keyframe[], timeMs: number, value: number, durationMs: number): Keyframe[] {
  const max = Math.max(0, durationMs);
  const t = clamp(timeMs, 0, max);
  for (const k of keys) if (Math.abs(k.timeMs - t) < 5) return copy(keys);
  return [...copy(keys), { timeMs: t, value }].sort((a, b) => a.timeMs - b.timeMs);
}

/** Remove a key by index (out of range returns a copy). */
export function removeKey(keys: readonly Keyframe[], index: number): Keyframe[] {
  if (index < 0 || index >= keys.length) return copy(keys);
  return keys.filter((_, i) => i !== index).map((k) => ({ ...k }));
}

/** Set the ease of one key, returning a new array. */
export function setEase(keys: readonly Keyframe[], index: number, ease: Ease): Keyframe[] {
  if (index < 0 || index >= keys.length) return copy(keys);
  return keys.map((k, i) => (i === index ? { ...k, ease } : { ...k }));
}

/** '0.00 s' style: seconds with two decimals, negatives clamped to 0. */
export function formatMs(ms: number): string {
  const s = Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000;
  return `${s.toFixed(2)} s`;
}

/** A pleasant ruler step (ms) for a given duration. */
export function niceStep(durationMs: number): number {
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000];
  for (const s of steps) if (durationMs / s <= 6) return s;
  return steps[steps.length - 1]!;
}
