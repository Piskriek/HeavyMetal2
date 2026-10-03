import type { Quality } from '@hm/lighting';

/**
 * The low tier renders at most about 1280x720 worth of pixels and lets the browser scale the picture up: on a 1080p laptop screen with
 * integrated graphics that halves the pixels the shaders run for (the owner's minimum spec, 2026-10-03).
 */
export const LOW_PIXEL_BUDGET = 1280 * 720;

/** Drawing-buffer pixels per CSS pixel for a tier, a canvas size (CSS pixels) and the screen's device pixel ratio. */
export function pixelRatioFor(q: Quality, cssWidth: number, cssHeight: number, deviceRatio: number): number {
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  // ultra supersamples on ordinary screens: it renders more pixels than the screen has and the picture comes out smoother
  if (q === 'ultra') return Math.min(2, Math.max(1.5, dpr));
  if (q === 'low') {
    const budget = Math.sqrt(LOW_PIXEL_BUDGET / Math.max(1, cssWidth * cssHeight));
    const r = Math.min(1, dpr, budget);
    // a small scale-down blurs the picture for little gain: stay sharp unless it saves a real share of the pixels
    return r > 0.9 ? Math.min(1, dpr) : Math.max(0.5, r);
  }
  return Math.min(q === 'medium' ? 1.5 : 2, Math.max(0.5, dpr));
}
