import type { DirtyRect, TerrainLike } from './types.js';

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/**
 * Thermal erosion simulation that conserves total height in the grid interior.
 * Border nodes (r=0, r=rows-1, c=0, c=cols-1) are never changed.
 * Processed from a copy so results are independent of iteration order.
 */
export function thermalErode(
  t: TerrainLike,
  iterations: number,
  talus: number,
  rate = 0.5
): DirtyRect | null {
  const { cols, rows, cell } = t.spec;
  if (cols < 3 || rows < 3 || iterations <= 0 || rate <= 0) return null;

  const talusHeight = talus * cell;
  const totalNodes = cols * rows;
  const current = new Float32Array(t.heights);
  const delta = new Float32Array(totalNodes);

  let anyChange = false;

  for (let iter = 0; iter < iterations; iter++) {
    delta.fill(0);
    let iterChanged = false;

    for (let r = 1; r < rows - 1; r++) {
      const rowOffset = r * cols;

      for (let c = 1; c < cols - 1; c++) {
        const idx = rowOffset + c;
        const h = current[idx] ?? 0;

        let eligibleCount = 0;
        for (let i = 0; i < 4; i++) {
          const dir = NEIGHBORS[i];
          if (!dir) continue;
          const nc = c + dir[0];
          const nr = r + dir[1];

          // Material is only transferred between interior nodes
          if (nc >= 1 && nc < cols - 1 && nr >= 1 && nr < rows - 1) {
            const nIdx = nr * cols + nc;
            const diff = h - (current[nIdx] ?? 0);
            if (diff > talusHeight) {
              eligibleCount++;
            }
          }
        }

        if (eligibleCount > 0) {
          for (let i = 0; i < 4; i++) {
            const dir = NEIGHBORS[i];
            if (!dir) continue;
            const nc = c + dir[0];
            const nr = r + dir[1];

            if (nc >= 1 && nc < cols - 1 && nr >= 1 && nr < rows - 1) {
              const nIdx = nr * cols + nc;
              const diff = h - (current[nIdx] ?? 0);
              if (diff > talusHeight) {
                const amount = (rate * 0.5 * (diff - talusHeight)) / eligibleCount;
                delta[idx] = (delta[idx] ?? 0) - amount;
                delta[nIdx] = (delta[nIdx] ?? 0) + amount;
                iterChanged = true;
              }
            }
          }
        }
      }
    }

    if (!iterChanged) break;
    anyChange = true;

    for (let i = 0; i < totalNodes; i++) {
      current[i] = (current[i] ?? 0) + (delta[i] ?? 0);
    }
  }

  if (!anyChange) return null;

  let dirtyC0 = cols;
  let dirtyR0 = rows;
  let dirtyC1 = -1;
  let dirtyR1 = -1;

  for (let r = 1; r < rows - 1; r++) {
    const rowOffset = r * cols;
    for (let c = 1; c < cols - 1; c++) {
      const idx = rowOffset + c;
      const original = t.heights[idx] ?? 0;
      const updated = current[idx] ?? 0;

      if (original !== updated) {
        t.heights[idx] = updated;
        if (c < dirtyC0) dirtyC0 = c;
        if (c > dirtyC1) dirtyC1 = c;
        if (r < dirtyR0) dirtyR0 = r;
        if (r > dirtyR1) dirtyR1 = r;
      }
    }
  }

  if (dirtyC1 < 0) return null;

  return {
    c0: dirtyC0,
    r0: dirtyR0,
    c1: dirtyC1,
    r1: dirtyR1,
  };
}
