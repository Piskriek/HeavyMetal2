import type { GraphicsSettings } from './graphics';

/**
 * Drawing-buffer pixels per CSS pixel for a canvas size (CSS pixels) and the screen's device pixel ratio. A picture size (the low tier
 * draws at most 720 lines on the short side: on a 1080p laptop screen with integrated graphics that halves the pixels the shaders run for)
 * lets the browser stretch the picture up; supersampling draws more pixels than the screen has.
 */
export function pixelRatioFor(g: Pick<GraphicsSettings, 'pictureSize' | 'sharpness' | 'supersample'>, cssWidth: number, cssHeight: number, deviceRatio: number): number {
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const cap = Math.max(0.25, g.sharpness);
  if (g.supersample) return Math.min(Math.max(cap, 1.5), Math.max(1.5, dpr));
  const base = Math.min(cap, Math.max(0.5, dpr));
  if (!(g.pictureSize > 0)) return base;
  const r = Math.min(base, g.pictureSize / Math.max(1, Math.min(cssWidth, cssHeight)));
  // a small scale-down blurs the picture for little gain: stay sharp unless it saves a real share of the pixels
  return r > base * 0.9 ? base : Math.max(0.5, r);
}
