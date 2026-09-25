/**
 * Slow motion for looking at things while test-driving.
 *
 * The physics step never changes (fixed 120 Hz, `FIXED_STEP`). Slow motion only feeds the fixed-step
 * accumulator less simulated time per real second, so a seeded run is tick-for-tick identical at any
 * scale — it just plays out slower. Pure: no DOM, no timers.
 */

/** The steps the − / + buttons move between, slowest first. */
export const TIME_SCALES = [0.05, 0.1, 0.25, 0.5, 1] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

/** Clamp any number to the nearest allowed scale (1 for garbage). */
export function snapTimeScale(value: number): TimeScale {
  if (!Number.isFinite(value) || value <= 0) return 1;
  let best: TimeScale = 1;
  for (const s of TIME_SCALES) if (Math.abs(s - value) < Math.abs(best - value)) best = s;
  return best;
}

/** One step slower (−1) or faster (+1), stopping at either end. */
export function stepTimeScale(current: number, direction: -1 | 1): TimeScale {
  const i = TIME_SCALES.indexOf(snapTimeScale(current));
  return TIME_SCALES[Math.max(0, Math.min(TIME_SCALES.length - 1, i + direction))];
}

/** Simulated seconds a real frame of `realDt` seconds feeds the accumulator. */
export const scaledDt = (realDt: number, scale: number): number => realDt * snapTimeScale(scale);

/** Label for the toolbar: ×1, ×0.5, ×0.25 … */
export const timeScaleLabel = (scale: number): string => `×${snapTimeScale(scale)}`;
