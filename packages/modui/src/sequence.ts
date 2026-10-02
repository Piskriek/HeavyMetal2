import type { Box, Pt } from './types';

const clamp01 = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c === 0 ? 0 : c;
};

/** Set one step to a 0..1 value (out of range index returns a copy). */
export function setStep(steps: readonly number[], index: number, value01: number): number[] {
  const next = [...steps];
  if (index < 0 || index >= next.length) return next;
  next[index] = clamp01(value01);
  return next;
}

/** Truncate or pad (repeating the last step, 0 when empty) to `count` steps, clamped to 1..64. */
export function resizeSteps(steps: readonly number[], count: number): number[] {
  const n = Math.round(Math.min(64, Math.max(1, Number.isFinite(count) ? count : 1)));
  const last = steps.length > 0 ? steps[steps.length - 1]! : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i < steps.length ? steps[i]! : last);
  return out;
}

/** Column index and 0..1 value for a pixel position inside the box. */
export function stepFromPx(box: Box, count: number, px: Pt): { index: number; value: number } {
  const n = Math.max(1, Math.round(count));
  const w = box.w > 0 ? box.w : 1;
  const index = Math.min(n - 1, Math.max(0, Math.floor(((px[0] - box.x) / w) * n)));
  return { index, value: clamp01((box.y + box.h - px[1]) / box.h) };
}

/** 32 bit integer hash of (seed, index) -> 0..1. Deterministic, no Math.random. */
export function stepNoise(seed: number, index: number): number {
  let h = Math.imul(seed | 0, 0x85eb_ca6b) ^ Math.imul((index | 0) + 0x1656_67b1, 0xc2b2_ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4_eb2f);
  h ^= h >>> 13;
  h = Math.imul(h, 0x1656_67b1);
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

/** Deterministic randomisation of a step row, same length, values in 0..1. */
export function randomizeSteps(steps: readonly number[], seed: number): number[] {
  const s = Math.round(Number.isFinite(seed) ? seed : 0);
  return steps.map((_, i) => stepNoise(s, i));
}
