import type { TerrainLike, TerrainStats } from './types.js';

/**
 * Computes descriptive statistics for a terrain height grid.
 * Calculates min, max, mean, land fraction (nodes > 0), and steepest slope between 4-neighbours.
 */
export function terrainStats(t: TerrainLike): TerrainStats {
  const { cols, rows, cell } = t.spec;
  const total = cols * rows;

  if (total <= 0 || cell <= 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      landFraction: 0,
      steepest: 0,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let landCount = 0;

  for (let i = 0; i < total; i++) {
    const h = t.heights[i] ?? 0;
    if (h < min) min = h;
    if (h > max) max = h;
    sum += h;
    if (h > 0) landCount++;
  }

  const mean = sum / total;
  const landFraction = landCount / total;

  let steepest = 0;

  for (let r = 0; r < rows; r++) {
    const rowOffset = r * cols;
    for (let c = 0; c < cols; c++) {
      const h = t.heights[rowOffset + c] ?? 0;

      // Check horizontal neighbour (c + 1, r)
      if (c + 1 < cols) {
        const diffX = Math.abs(h - (t.heights[rowOffset + c + 1] ?? 0));
        const slopeX = diffX / cell;
        if (slopeX > steepest) steepest = slopeX;
      }

      // Check vertical neighbour (c, r + 1)
      if (r + 1 < rows) {
        const diffZ = Math.abs(h - (t.heights[(r + 1) * cols + c] ?? 0));
        const slopeZ = diffZ / cell;
        if (slopeZ > steepest) steepest = slopeZ;
      }
    }
  }

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean,
    landFraction,
    steepest,
  };
}
