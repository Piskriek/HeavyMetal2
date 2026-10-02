import type { TerrainLike } from '../src/types';
export function makeTerrain(cols: number, rows: number, cell: number, originX: number, originZ: number, fn: (x: number, z: number) => number, surface = 1): TerrainLike & { heights: Float32Array } {
  const n = cols * rows;
  const t = { spec: { cols, rows, cell, originX, originZ }, heights: new Float32Array(n), surfaceA: new Uint8Array(n).fill(surface), surfaceB: new Uint8Array(n).fill(surface), blend: new Uint8Array(n) };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) t.heights[r * cols + c] = fn(originX + c * cell, originZ + r * cell);
  return t;
}