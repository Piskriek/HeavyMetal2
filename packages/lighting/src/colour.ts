/** Hex colour helpers. All total: junk in, a sensible colour out. Channels are 0..1 in sRGB space (no gamma conversion: mixing is done the way a painter would). */

const HEX = /^#([0-9a-f]{6})$/i;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

export function hexToRgb(hex: string): [number, number, number] {
  if (!isHex(hex)) return [0, 0, 0];
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = Number.isFinite(t) ? t : 0;
  return rgbToHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}

export function scaleHex(a: string, k: number): string {
  const A = hexToRgb(a);
  return rgbToHex(A[0] * k, A[1] * k, A[2] * k);
}

/** Relative luminance (Rec. 709 weights) of a hex colour, 0..1. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
