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

function cloneGrid(g: Grid): Grid {
  return {
    cols: g.cols,
    rows: g.rows,
    cell: g.cell,
    heights: new Float32Array(g.heights),
    surface: new Uint8Array(g.surface),
    floor: new Float32Array(g.floor),
  };
}

function cloneStore(s: Store): Store {
  return { pixels: { ...s.pixels } };
}

function gridCellCount(g: Grid): number {
  if (
    !Number.isInteger(g.cols) ||
    !Number.isInteger(g.rows) ||
    g.cols <= 0 ||
    g.rows <= 0
  ) {
    return 0;
  }

  const count = g.cols * g.rows;
  return Number.isSafeInteger(count) ? count : 0;
}

function bowlWeight(
  g: Grid,
  index: number,
  x: number,
  z: number,
  radius: number,
): number {
  if (
    !Number.isFinite(g.cell) ||
    g.cell <= 0 ||
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Number.isNaN(radius) ||
    radius < 0
  ) {
    return 0;
  }

  const row = Math.floor(index / g.cols);
  const col = index % g.cols;
  const dx = col * g.cell - x;
  const dz = row * g.cell - z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance > radius) return 0;
  if (radius === 0) return distance === 0 ? 1 : 0;

  return Math.max(0, 1 - distance / radius);
}

// Round upward so Float32 storage cannot exceed a budget-limited cut.
function float32Ceiling(value: number): number {
  const rounded = Math.fround(value);
  if (rounded >= value || !Number.isFinite(value)) return rounded;

  const buffer = new ArrayBuffer(4);
  const floats = new Float32Array(buffer);
  const bits = new Uint32Array(buffer);

  floats[0] = rounded;
  const word = bits[0];
  if (word === undefined) return rounded;

  bits[0] = rounded < 0 ? word - 1 : word + 1;
  const next = floats[0];
  return next === undefined ? rounded : next;
}

/** Dig a soft, round hole, subject to the island's pixel budget. */
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
  const grid = cloneGrid(g);
  const store = cloneStore(s);
  const budget: Budget = { maxDug: b.maxDug, dug: b.dug };
  const remainder: Record<number, number> = {};
  const extracted: Record<number, number> = {};
  const cells = gridCellCount(g);
  const area = g.cell * g.cell;
  const budgetRoom = b.maxDug - b.dug;
  let removedPixels = 0;

  if (
    cells > 0 &&
    Number.isFinite(g.cell) &&
    g.cell > 0 &&
    Number.isFinite(area) &&
    area > 0 &&
    budgetRoom > 0
  ) {
    for (let index = 0; index < cells; index += 1) {
      const weight = bowlWeight(g, index, x, z, radius);
      if (!(weight > 0)) continue;

      const height = g.heights[index];
      const floor = g.floor[index];
      const surfaceId = g.surface[index];
      if (
        height === undefined ||
        floor === undefined ||
        surfaceId === undefined
      ) {
        continue;
      }

      const availableDrop = Math.max(0, height - floor);
      const desiredDrop = Math.min(
        availableDrop,
        Math.max(0, depth) * weight,
      );
      if (!(desiredDrop > 0)) continue;

      const pixelsLeft = budgetRoom - removedPixels;
      if (!(pixelsLeft > 0)) break;

      const budgetDrop = (pixelsLeft * PIXEL) / area;
      const budgetLimited = desiredDrop >= budgetDrop;
      const drop = Math.min(desiredDrop, budgetDrop);
      if (!(drop > 0)) continue;

      let targetHeight = Math.max(floor, height - drop);
      if (budgetLimited) {
        targetHeight = Math.max(
          targetHeight,
          float32Ceiling(height - budgetDrop),
        );
      }

      grid.heights[index] = targetHeight;
      let after = grid.heights[index];
      if (after === undefined) continue;

      let actualDrop = height - after;
      if (!(actualDrop > 0)) continue;

      let units = (actualDrop * area) / PIXEL;
      if (units > pixelsLeft) {
        grid.heights[index] = Math.max(
          floor,
          float32Ceiling(height - budgetDrop),
        );
        after = grid.heights[index];
        if (after === undefined) continue;

        actualDrop = height - after;
        units = (actualDrop * area) / PIXEL;
        if (!(actualDrop > 0) || units > pixelsLeft) {
          grid.heights[index] = height;
          continue;
        }
      }

      removedPixels += units;
      extracted[surfaceId] = (extracted[surfaceId] ?? 0) + units;
    }
  }

  for (const key of Object.keys(extracted)) {
    const surfaceId = Number(key);
    const amount = extracted[surfaceId];
    if (amount === undefined) continue;

    const wholePixels = Math.floor(amount);
    const fraction = amount - wholePixels;
    if (wholePixels > 0) {
      store.pixels[surfaceId] =
        (store.pixels[surfaceId] ?? 0) + wholePixels;
    }
    if (fraction > 0) remainder[surfaceId] = fraction;
  }

  if (removedPixels > 0) {
    const updated = b.dug + removedPixels;
    budget.dug = updated > b.maxDug ? b.maxDug : updated;
  }

  return { grid, store, budget, remainder };
}

/** Place as many requested pixels as the store contains. */
export function place(
  g: Grid,
  s: Store,
  id: number,
  count: number,
  x: number,
  z: number,
  radius: number,
): { grid: Grid; store: Store; placed: number } {
  const grid = cloneGrid(g);
  const store = cloneStore(s);
  const stored = s.pixels[id] ?? 0;
  const safeStored = Number.isFinite(stored) ? stored : 0;
  const requested = Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
  let placed = Math.min(requested, Math.max(0, Math.floor(safeStored)));
  const cells = gridCellCount(g);
  const area = g.cell * g.cell;
  let weightSum = 0;

  if (
    placed > 0 &&
    cells > 0 &&
    Number.isFinite(g.cell) &&
    g.cell > 0 &&
    Number.isFinite(area) &&
    area > 0
  ) {
    for (let index = 0; index < cells; index += 1) {
      if (g.heights[index] === undefined || g.surface[index] === undefined) {
        continue;
      }
      weightSum += bowlWeight(g, index, x, z, radius);
    }
  }

  if (!(weightSum > 0) || !Number.isFinite(weightSum)) placed = 0;

  if (placed > 0) {
    const volume = placed * PIXEL;

    for (let index = 0; index < cells; index += 1) {
      const height = g.heights[index];
      if (height === undefined || g.surface[index] === undefined) continue;

      const weight = bowlWeight(g, index, x, z, radius);
      if (!(weight > 0)) continue;

      const rise = (volume * weight) / weightSum / area;
      grid.heights[index] = height + rise;

      const raisedHeight = grid.heights[index];
      if (
        raisedHeight !== undefined &&
        raisedHeight - height > 0.05
      ) {
        grid.surface[index] = id;
      }
    }

    store.pixels[id] = safeStored - placed;
  }

  return { grid, store, placed };
}

/** Regrow cells toward their original heights. */
export function regrow(
  g: Grid,
  original: Float32Array,
  rate: number,
  dt: number,
): Grid {
  const grid = cloneGrid(g);
  const increase = rate * dt;
  if (!(increase > 0)) return grid;

  const cells = Math.min(
    gridCellCount(g),
    grid.heights.length,
    original.length,
  );

  for (let index = 0; index < cells; index += 1) {
    const height = grid.heights[index];
    const originalHeight = original[index];
    if (
      height !== undefined &&
      originalHeight !== undefined &&
      height < originalHeight
    ) {
      grid.heights[index] = Math.min(originalHeight, height + increase);
    }
  }

  return grid;
}

/** Return the store's credit value. */
export function worth(
  s: Store,
  prices: Record<number, number>,
): number {
  let pricedCredits = 0;
  let unpricedPixels = 0;

  for (const key of Object.keys(s.pixels)) {
    const id = Number(key);
    const count = s.pixels[id];
    if (count === undefined) continue;

    const price = prices[id];
    if (price === undefined) {
      unpricedPixels += count;
    } else {
      pricedCredits += count * price;
    }
  }

  return pricedCredits + Math.floor(unpricedPixels / 10);
}

/** Return the total number of pixels in the store. */
export function total(s: Store): number {
  let sum = 0;

  for (const key of Object.keys(s.pixels)) {
    const count = s.pixels[Number(key)];
    if (count !== undefined) sum += count;
  }

  return sum;
}