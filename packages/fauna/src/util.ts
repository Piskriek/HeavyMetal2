// Shared helpers for @hm/fauna: clamps and the deterministic hash.
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

export function h2(x: number, y: number, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
