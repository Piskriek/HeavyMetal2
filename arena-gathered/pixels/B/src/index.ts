export interface Grid {
  cols: number;
  rows: number;
  cell: number;
  heights: Float32Array;
  surface: Uint8Array;
  floor: Float32Array;
}

export interface Store {
  pixels: Record<number, number>;
}

/** One pixel = PIXEL cubic metres of ground. */
export const PIXEL = 0.125;

export interface Budget {
  maxDug: number;
  dug: number;
}

function copyPixels(source: Record<number, number>): Record<number, number> {
  const result: Record<number, number> = {};
  for (const key of Object.keys(source)) {
    const value = source[Number(key)];
    if (value !== undefined) {
      result[Number(key)] = value;
    }
  }
  return result;
}

function copyGrid(g: Grid, heights = new Float32Array(g.heights)): Grid {
  return {
    cols: g.cols,
    rows: g.rows,
    cell: g.cell,
    heights,
    surface: new Uint8Array(g.surface),
    floor: new Float32Array(g.floor),
  };
}

export function dig(
  g: Grid,
  s: Store,
  b: Budget,
  x: number,
  z: number,
  radius: number,
  depth: number,
): {
  grid: Grid;
  store: Store;
  budget: Budget;
  remainder: Record<number, number>;
} {
  const heights = new Float32Array(g.heights);
  const resultGrid = copyGrid(g, heights);
  const pixels = copyPixels(s.pixels);
  const removedBySurface: Record<number, number> = {};
  const remainder: Record<number, number> = {};

  if (radius <= 0 || depth <= 0 || g.cell <= 0) {
    return {
      grid: resultGrid,
      store: { pixels },
      budget: { maxDug: b.maxDug, dug: b.dug },
      remainder,
    };
  }

  const cellArea = g.cell * g.cell;
  let availableVolume = Math.max(0, b.maxDug - b.dug) * PIXEL;
  let removedVolume = 0;

  for (let row = 0; row < g.rows && availableVolume > 0; row += 1) {
    for (let col = 0; col < g.cols && availableVolume > 0; col += 1) {
      const dx = col * g.cell - x;
      const dz = row * g.cell - z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > radius) {
        continue;
      }

      const weight = 1 - distance / radius;
      if (weight <= 0) {
        continue;
      }

      const index = row * g.cols + col;
      const current = g.heights[index];
      const bedrock = g.floor[index];
      const surfaceId = g.surface[index];

      if (current === undefined || bedrock === undefined || surfaceId === undefined) {
        continue;
      }

      const possibleLoss = Math.min(depth * weight, Math.max(0, current - bedrock));
      const possibleVolume = possibleLoss * cellArea;
      const cellVolume = Math.min(possibleVolume, availableVolume);

      if (cellVolume <= 0) {
        continue;
      }

      heights[index] = current - cellVolume / cellArea;
      removedVolume += cellVolume;
      availableVolume -= cellVolume;

      const previous = removedBySurface[surfaceId] ?? 0;
      removedBySurface[surfaceId] = previous + cellVolume / PIXEL;
    }
  }

  for (const key of Object.keys(removedBySurface)) {
    const id = Number(key);
    const pixelAmount = removedBySurface[id] ?? 0;
    const wholePixels = Math.floor(pixelAmount);
    const fraction = pixelAmount - wholePixels;

    if (wholePixels > 0) {
      pixels[id] = (pixels[id] ?? 0) + wholePixels;
    }
    if (fraction > 0) {
      remainder[id] = fraction;
    }
  }

  return {
    grid: resultGrid,
    store: { pixels },
    budget: {
      maxDug: b.maxDug,
      dug: b.dug + removedVolume / PIXEL,
    },
    remainder,
  };
}

export function place(
  g: Grid,
  s: Store,
  id: number,
  count: number,
  x: number,
  z: number,
  radius: number,
): {
  grid: Grid;
  store: Store;
  placed: number;
} {
  const heights = new Float32Array(g.heights);
  const surfaces = new Uint8Array(g.surface);
  const pixels = copyPixels(s.pixels);
  const held = Math.max(0, Math.floor(pixels[id] ?? 0));
  const requested = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const available = Math.min(held, requested);

  const resultGrid: Grid = {
    cols: g.cols,
    rows: g.rows,
    cell: g.cell,
    heights,
    surface: surfaces,
    floor: new Float32Array(g.floor),
  };

  if (available === 0 || radius <= 0 || g.cell <= 0) {
    return { grid: resultGrid, store: { pixels }, placed: 0 };
  }

  let weightTotal = 0;

  for (let row = 0; row < g.rows; row += 1) {
    for (let col = 0; col < g.cols; col += 1) {
      const dx = col * g.cell - x;
      const dz = row * g.cell - z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance <= radius) {
        weightTotal += Math.max(0, 1 - distance / radius);
      }
    }
  }

  if (weightTotal <= 0) {
    return { grid: resultGrid, store: { pixels }, placed: 0 };
  }

  const cellArea = g.cell * g.cell;
  const volume = available * PIXEL;

  for (let row = 0; row < g.rows; row += 1) {
    for (let col = 0; col < g.cols; col += 1) {
      const dx = col * g.cell - x;
      const dz = row * g.cell - z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > radius) {
        continue;
      }

      const weight = Math.max(0, 1 - distance / radius);
      if (weight === 0) {
        continue;
      }

      const index = row * g.cols + col;
      const current = g.heights[index];
      if (current === undefined) {
        continue;
      }

      const rise = (volume * weight) / (weightTotal * cellArea);
      heights[index] = current + rise;

      if (rise > 0.05) {
        surfaces[index] = id;
      }
    }
  }

  pixels[id] = held - available;
  return {
    grid: resultGrid,
    store: { pixels },
    placed: available,
  };
}

export function regrow(
  g: Grid,
  original: Float32Array,
  rate: number,
  dt: number,
): Grid {
  const heights = new Float32Array(g.heights);
  const growth = Math.max(0, rate * dt);

  for (let index = 0; index < heights.length; index += 1) {
    const current = g.heights[index];
    const target = original[index];

    if (current !== undefined && target !== undefined && current < target) {
      heights[index] = Math.min(target, current + growth);
    }
  }

  return copyGrid(g, heights);
}

export function worth(
  s: Store,
  prices: Record<number, number>,
): number {
  let credits = 0;

  for (const key of Object.keys(s.pixels)) {
    const id = Number(key);
    const count = s.pixels[id] ?? 0;
    const price = prices[id];

    credits += price === undefined ? Math.floor(count / 10) : count * price;
  }

  return credits;
}

export function total(s: Store): number {
  let count = 0;

  for (const key of Object.keys(s.pixels)) {
    count += s.pixels[Number(key)] ?? 0;
  }

  return count;
}