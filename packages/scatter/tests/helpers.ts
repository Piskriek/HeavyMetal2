import type { TerrainLike } from '../src';

export const near = (a: number, b: number, e = 1e-9): void => {
  if (!(Math.abs(a - b) < e)) throw new Error(`${a} !~ ${b}`);
};

/** Tiny LCG, independent of the package's own generator. */
export const seq = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

/** A dome 9 m high with sea level at the rim: sand below 0.8 m, grass above. Outside the rim: -3 m of sand. */
export function island(n = 65, cell = 2): TerrainLike {
  const size = n * n;
  const heights = new Float32Array(size);
  const a = new Uint8Array(size);
  const mid = (n - 1) / 2;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const d = Math.hypot(c - mid, r - mid) / mid;
      const i = r * n + c;
      const h = d >= 1 ? -3 : 9 * (1 - d * d);
      heights[i] = h;
      a[i] = h < 0.8 ? 2 : 4;
    }
  }
  return { spec: { cols: n, rows: n, cell, originX: -mid * cell, originZ: -mid * cell }, heights, surfaceA: a, surfaceB: a.slice(), blend: new Uint8Array(size) };
}

/** A flat n x n terrain with a single height and a single surface. */
export function flat(n: number, cell: number, height: number, surface: number): TerrainLike {
  const size = n * n;
  const mid = (n - 1) / 2;
  return {
    spec: { cols: n, rows: n, cell, originX: -mid * cell, originZ: -mid * cell },
    heights: new Float32Array(size).fill(height),
    surfaceA: new Uint8Array(size).fill(surface),
    surfaceB: new Uint8Array(size).fill(surface),
    blend: new Uint8Array(size),
  };
}
