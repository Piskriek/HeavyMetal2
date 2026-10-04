/**
 * erosion.ts — terrain erosion for a toy-world heightfield editor.
 *
 * Everything here is pure: inputs are never mutated, every function returns a
 * fresh Float32Array, and all randomness comes from mulberry32 so runs are
 * reproducible. Soil is conserved by both erosion models — material only ever
 * moves between cells.
 *
 * Cell (c, r) lives at heights[c + r * cols]. "N" is row r - 1.
 */

export interface Heightfield {
  cols: number;
  rows: number;
  cell: number;
  heights: Float32Array;
}

export interface DropOptions {
  inertia: number;
  capacity: number;
  minSlope: number;
  deposit: number;
  erode: number;
  evaporation: number;
  gravity: number;
  maxSteps: number;
}

export const DROP_DEFAULTS: DropOptions = {
  inertia: 0.05,
  capacity: 4,
  minSlope: 0.01,
  deposit: 0.3,
  erode: 0.3,
  evaporation: 0.01,
  gravity: 4,
  maxSteps: 64,
};

/** Neighbour offsets in the tie-break order N, NE, E, SE, S, SW, W, NW. */
const FLOW_DC: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1];
const FLOW_DR: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1];

const TAU = Math.PI * 2;

function addTo(arr: Float32Array, index: number, value: number): void {
  arr[index] = arr[index]! + value;
}

/**
 * Small, fast, seedable PRNG. Returns floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Thermal (talus) erosion: material above the angle of repose slumps downhill
 * until every slope is at or below `talus * cell`.
 *
 * Each iteration reads the heights as they were at the start of the iteration
 * and applies every move at once, so results do not depend on cell order.
 */
export function thermal(
  h: Heightfield,
  iterations: number,
  talus: number,
  rate?: number,
): Float32Array {
  const cols = h.cols;
  const rows = h.rows;
  const cell = h.cell;
  const speed = rate === undefined ? 0.5 : rate;
  const threshold = talus * cell;

  let src = Float32Array.from(h.heights);
  let dst = new Float32Array(cols * rows);

  // Reused scratch buffers: up to 4 in-bounds neighbours per cell.
  const excess = new Float64Array(4);
  const target = new Int32Array(4);

  for (let iteration = 0; iteration < iterations; iteration++) {
    dst.set(src);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = c + r * cols;
        const height = src[i]!;

        let count = 0;
        let worst = 0;
        let totalExcess = 0;

        // N, E, S, W — off-map neighbours are ignored.
        if (r > 0) {
          const d = height - src[i - cols]!;
          if (d > threshold) {
            excess[count] = d - threshold;
            target[count] = i - cols;
            count++;
          }
        }
        if (c + 1 < cols) {
          const d = height - src[i + 1]!;
          if (d > threshold) {
            excess[count] = d - threshold;
            target[count] = i + 1;
            count++;
          }
        }
        if (r + 1 < rows) {
          const d = height - src[i + cols]!;
          if (d > threshold) {
            excess[count] = d - threshold;
            target[count] = i + cols;
            count++;
          }
        }
        if (c > 0) {
          const d = height - src[i - 1]!;
          if (d > threshold) {
            excess[count] = d - threshold;
            target[count] = i - 1;
            count++;
          }
        }

        if (count === 0) continue;

        for (let k = 0; k < count; k++) {
          const e = excess[k]!;
          if (e > worst) worst = e;
          totalExcess += e;
        }

        // `move` is the total this cell gives up, split between the low
        // neighbours in proportion to their individual excesses.
        const move = (speed * worst) / 2;
        for (let k = 0; k < count; k++) {
          addTo(dst, target[k]!, (move * excess[k]!) / totalExcess);
        }
        dst[i] = dst[i]! - move;
      }
    }

    const swap = src;
    src = dst;
    dst = swap;
  }

  return src;
}

/** Bilinear sample of the height at a continuous cell-space position. */
function sampleHeight(
  heights: Float32Array,
  cols: number,
  rows: number,
  x: number,
  z: number,
): number {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const x2 = cx + 1 < cols ? cx + 1 : cols - 1;
  const z2 = cz + 1 < rows ? cz + 1 : rows - 1;
  const u = x - cx;
  const v = z - cz;

  const h00 = heights[cx + cz * cols]!;
  const h10 = heights[x2 + cz * cols]!;
  const h01 = heights[cx + z2 * cols]!;
  const h11 = heights[x2 + z2 * cols]!;

  return (
    h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v
  );
}

/** Bilinear gradient (height per world unit) written into `out`. */
function sampleGradient(
  heights: Float32Array,
  cols: number,
  rows: number,
  cell: number,
  x: number,
  z: number,
  out: { x: number; z: number },
): void {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const x2 = cx + 1 < cols ? cx + 1 : cols - 1;
  const z2 = cz + 1 < rows ? cz + 1 : rows - 1;
  const u = x - cx;
  const v = z - cz;

  const h00 = heights[cx + cz * cols]!;
  const h10 = heights[x2 + cz * cols]!;
  const h01 = heights[cx + z2 * cols]!;
  const h11 = heights[x2 + z2 * cols]!;

  out.x = ((h10 - h00) * (1 - v) + (h11 - h01) * v) / cell;
  out.z = ((h01 - h00) * (1 - u) + (h11 - h10) * u) / cell;
}

/**
 * Hydraulic erosion: `drops` raindrops, each picking up soil while it flows
 * downhill and dropping it again where it slows down or leaves the map.
 * Deterministic for a given seed; total height is preserved.
 */
function spread(heights: Float32Array, cols: number, rows: number, x: number, z: number, amount: number): void {
  const cx = Math.floor(x), cz = Math.floor(z);
  const x2 = cx + 1 < cols ? cx + 1 : cols - 1, z2 = cz + 1 < rows ? cz + 1 : rows - 1;
  const u = x - cx, v = z - cz;
  heights[cx + cz * cols] = heights[cx + cz * cols]! + amount * (1 - u) * (1 - v);
  heights[x2 + cz * cols] = heights[x2 + cz * cols]! + amount * u * (1 - v);
  heights[cx + z2 * cols] = heights[cx + z2 * cols]! + amount * (1 - u) * v;
  heights[x2 + z2 * cols] = heights[x2 + z2 * cols]! + amount * u * v;
}

export function hydraulic(
  h: Heightfield,
  drops: number,
  seed: number,
  opts?: Partial<DropOptions>,
): Float32Array {
  const o: DropOptions = { ...DROP_DEFAULTS, ...opts };
  const cols = h.cols;
  const rows = h.rows;
  const cell = h.cell;
  const heights = Float32Array.from(h.heights);

  const limitX = cols - 1;
  const limitZ = rows - 1;
  const rand = mulberry32(seed);
  const gradient = { x: 0, z: 0 };
  const inertia = o.inertia;
  const keep = 1 - inertia;

  for (let d = 0; d < drops; d++) {
    let x = rand() * limitX;
    let z = rand() * limitZ;
    let dirX = 0;
    let dirZ = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;

    for (let step = 0; step < o.maxSteps; step++) {
      sampleGradient(heights, cols, rows, cell, x, z, gradient);
      dirX = dirX * inertia - gradient.x * keep;
      dirZ = dirZ * inertia - gradient.z * keep;
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (len === 0) {
        const angle = rand() * TAU;
        dirX = Math.cos(angle);
        dirZ = Math.sin(angle);
      } else {
        dirX /= len;
        dirZ /= len;
      }

      const nextX = x + dirX;
      const nextZ = z + dirZ;
      // Off the map: drop everything right here, then stop.
      if (!(nextX >= 0 && nextX < limitX && nextZ >= 0 && nextZ < limitZ)) break;

      const dh =
        sampleHeight(heights, cols, rows, nextX, nextZ) -
        sampleHeight(heights, cols, rows, x, z);

      const capacity = Math.max(-dh, o.minSlope) * speed * water * o.capacity;

      if (sediment > capacity || dh > 0) {
        const amount = dh > 0 ? Math.min(dh, sediment) : (sediment - capacity) * o.deposit;
        sediment -= amount;
        spread(heights, cols, rows, x, z, amount);
      } else {
        const amount = Math.min((capacity - sediment) * o.erode, -dh);
        sediment += amount;
        spread(heights, cols, rows, x, z, -amount);
      }

      speed = Math.sqrt(Math.max(0, speed * speed - dh * o.gravity));
      water *= 1 - o.evaporation;
      x = nextX;
      z = nextZ;
      if (water < 0.01) break;
    }

    // Out of steps, dried up, or fell off the edge: put down what is carried.
    spread(heights, cols, rows, x, z, sediment);
  }

  return heights;
}

/**
 * How much water drains through each cell. Every cell sends its water to the
 * steepest of its 8 neighbours (only if that is genuinely downhill), so the
 * result is a forest of drainage trees; each cell ends up with 1 plus the total
 * of every cell upstream of it.
 */
export function flowAccumulation(h: Heightfield): Float32Array {
  const cols = h.cols;
  const rows = h.rows;
  const cell = h.cell;
  const heights = h.heights;
  const n = cols * rows;

  const acc = new Float32Array(n);
  const receiver = new Int32Array(n);
  const inflow = new Int32Array(n);
  const diagonal = cell * Math.SQRT2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = c + r * cols;
      const height = heights[i]!;
      let bestSlope = 0;
      let bestTarget = -1;

      for (let k = 0; k < 8; k++) {
        const nc = c + FLOW_DC[k]!;
        const nr = r + FLOW_DR[k]!;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const drop = height - heights[nc + nr * cols]!;
        if (drop <= 0) continue;
        const slope = drop / (k & 1 ? diagonal : cell);
        if (slope > bestSlope) {
          bestSlope = slope;
          bestTarget = nc + nr * cols;
        }
      }

      receiver[i] = bestTarget;
      if (bestTarget >= 0) inflow[bestTarget] = inflow[bestTarget]! + 1;
      acc[i] = 1;
    }
  }

  // Drainage is a forest (water only ever flows strictly downhill), so walking
  // it from the cells with no upstream neighbours totals every cell exactly once.
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (inflow[i] === 0) queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++]!;
    const target = receiver[i]!;
    if (target < 0) continue;
    acc[target] = acc[target]! + acc[i]!;
    const remaining = inflow[target]! - 1;
    inflow[target] = remaining;
    if (remaining === 0) queue[tail++] = target;
  }

  return acc;
}