function mulberry32(a:number){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

export type Tier='low'|'mid'|'high';
export type ScatterKind='tuft'|'bush'|'pine'|'oak'|'birch';
export const CAPS:Readonly<Record<Tier,number>>={low:600,mid:2000,high:6000};
export const SPACING:Readonly<Record<ScatterKind,number>>={tuft:0.8,bush:2,pine:4,oak:4.5,birch:3.5}; // metres
export const FIRST_STAGE:Readonly<Record<ScatterKind,number>>={tuft:2,bush:4,pine:5,oak:5,birch:5};
export const WET_REACH=6; // metres
export interface BiomeInput{
 n:number; cellM:number; // grid n x n cells (16..512), metres per cell
 height:Float32Array; // n*n metres, index z*n+x; cell (x,z) centre is at world ((x+0.5)*cellM,(z+0.5)*cellM)
 water:Uint8Array; // n*n, 0 = dry, >0 = water
 stage:number; // 0..6, may be fractional
 s:{pxd:number;vtx:number;lx:number;aq:number}; // each 0..1
 machines:readonly{x:number;z:number;r:number}[]; // world metres; r = keep-out radius
 keepouts:readonly{x0:number;z0:number;x1:number;z1:number}[]; // world-metre rectangles
 seed:number; tier:Tier;
}
export interface Scatter{kind:ScatterKind;x:number;z:number;scale:number;yaw:number;appear:number}
export interface BiomeBake{cover:Uint8Array;scatter:Scatter[]} // cover n*n*4: R dust, G moss, B grass, A wet

// Speed (20 October 2026): the bake runs as small functions, and every hot loop is either flat or calls a function
// for its inner loop (coverRow, edtRow, edtColumn per row; shellPass per gap; spacingConflict per candidate). As one
// big body, V8 optimised it on-stack while it was still in the cover loop, before the later phases had run, so each
// later phase deoptimised it back to the interpreter, and on-stack code for an inner loop deoptimises at every row end:
// a timed bake swung from 14 to 100 ms. A function called once per row tiers up at its entry instead. Every expression
// that feeds the output keeps its exact form and order (divisions stay divisions: x / 1.5 and x * (1 / 1.5) round
// differently), so the bake is bit-identical; the output-hash test in tests/plotbiome.test.ts holds it there.

const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;
const KIND_LIST: readonly ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];
const KIND_SPACING = Float64Array.from(KIND_LIST, (k) => SPACING[k]);
const KIND_FIRST_STAGE = Float64Array.from(KIND_LIST, (k) => FIRST_STAGE[k]);
const SHELL_GAPS = [1750, 701, 301, 132, 57, 23, 10, 4, 1]; // Ciura

const MAX_CELLS = 512 * 512;
const S_F = new Float64Array(MAX_CELLS);
const S_V = new Int32Array(513);
const S_ZENV = new Float64Array(514);
const S_G = new Float64Array(513);
const S_DIST = new Float32Array(MAX_CELLS);
const S_NEAR = new Int32Array(MAX_CELLS);
const S_FAR = new Int32Array(MAX_CELLS);
const S_WETB = new Int32Array(MAX_CELLS);
const S_FALLB = new Int32Array(MAX_CELLS);
const S_TREE = new Int32Array(MAX_CELLS);
const S_BIRCH = new Int32Array(MAX_CELLS);
const S_OAK = new Int32Array(MAX_CELLS);
const S_PINE = new Int32Array(MAX_CELLS);
const MAX_CAND = 6400;
const S_CKIND = new Uint8Array(MAX_CAND);
const S_CX = new Float64Array(MAX_CAND);
const S_CZ = new Float64Array(MAX_CAND);
const S_CSCALE = new Float64Array(MAX_CAND);
const S_CYAW = new Float64Array(MAX_CAND);
const S_CAPPEAR = new Float64Array(MAX_CAND);
const S_CTIE = new Float64Array(MAX_CAND);
const S_ORDER = new Int32Array(MAX_CAND);
const S_SORTKEY = new Float64Array(MAX_CAND);
const S_NEXT = new Int32Array(6005);
const S_ACCX = new Float64Array(6005);
const S_ACCZ = new Float64Array(6005);
const S_ACCSP = new Float64Array(6005);

/** What every phase of one bake reads: the grid, the water distances, and the machines and keep-outs packed flat. */
interface Plot {
  n: number;
  cellM: number;
  worldSize: number;
  height: Float32Array;
  water: Uint8Array;
  waterDistM: Float32Array;
  hasWater: boolean;
  noMachines: boolean; // machines.length === 0: distances are then taken to the plot centre
  mach: Float64Array; // x, z, (r + 1e-4)^2 per machine
  keep: Float64Array; // minX, maxX, minZ, maxZ per keep-out, each widened by 1e-4
}

/** The cells the scatter passes sample from, filled by the cover pass (all dry, slope <= 35). */
interface Buckets {
  near: Int32Array; // within 40 m of a machine
  far: Int32Array;
  wetBush: Int32Array; // wetness > 0
  fallbackBush: Int32Array; // dry but within 3 x WET_REACH of water, or anywhere when the plot has none
  tree: Int32Array; // fertile at stage 6: G or B >= 128
}

/** The cover pass's running counts (how far each bucket is filled) and ranges; coverRow adds each row's. */
interface CoverStats {
  near: number;
  far: number;
  wetBush: number;
  fallbackBush: number;
  tree: number;
  hMin: number; // height and water-distance range over the tree cells
  hMax: number;
  dWMin: number;
  dWMax: number;
}

/** The stage and S terms of the G (moss) and B (grass) blend, fixed for one bake. */
interface CoverTerms {
  bare: boolean; // stage < 2: nothing grows (no G or B) and the bake returns no scatter
  active: boolean; // stage >= 2
  s2: number;
  s4: number;
  s5: number;
  gScale2: number;
  gTerm4Const: number;
  gTerm5: number;
  bScale2: number;
  bTerm4Const: number;
  bTerm5: number;
}

interface TreeCells {
  birch: Int32Array;
  birchCount: number;
  oak: Int32Array;
  oakCount: number;
  pine: Int32Array;
  pineCount: number;
}

export function slopeDeg(height:Float32Array,n:number,cellM:number,x:number,z:number):number{
  if (n <= 1 || cellM <= 0) return 0;
  const cx = x < 0 ? 0 : x >= n ? n - 1 : x | 0;
  const cz = z < 0 ? 0 : z >= n ? n - 1 : z | 0;
  const row = cz * n;

  let dx: number;
  if (cx === 0) {
    dx = ((height[row + 1] ?? 0) - (height[row] ?? 0)) / cellM;
  } else if (cx === n - 1) {
    dx = ((height[row + n - 1] ?? 0) - (height[row + n - 2] ?? 0)) / cellM;
  } else {
    dx = ((height[row + cx + 1] ?? 0) - (height[row + cx - 1] ?? 0)) / (2 * cellM);
  }

  let dz: number;
  if (cz === 0) {
    dz = ((height[n + cx] ?? 0) - (height[cx] ?? 0)) / cellM;
  } else if (cz === n - 1) {
    dz = ((height[(n - 1) * n + cx] ?? 0) - (height[(n - 2) * n + cx] ?? 0)) / cellM;
  } else {
    dz = ((height[(cz + 1) * n + cx] ?? 0) - (height[(cz - 1) * n + cx] ?? 0)) / (2 * cellM);
  }

  return Math.atan(Math.sqrt(dx * dx + dz * dz)) * RAD_TO_DEG;
}

/** Writes each cell's distance to the nearest water cell (metres, 1e9 when the plot has none) into distM; true when it has water. */
function computeWaterDistMetres(water: Uint8Array, n: number, cellM: number, distM: Float32Array): boolean {
  const total = n * n;
  let hasWater = false;
  for (let i = 0; i < total; i++) {
    if ((water[i] ?? 0) > 0) {
      hasWater = true;
      break;
    }
  }
  if (!hasWater) {
    distM.fill(1e9, 0, total);
    return false;
  }

  const f = total <= MAX_CELLS ? S_F : new Float64Array(total);

  // Pass 1: 1D squared distance along each row (X)
  for (let z = 0; z < n; z++) edtRow(water, f, n, z * n);

  // Pass 2: 1D parabolic lower envelope along each column (Z)
  const v = n <= 512 ? S_V : new Int32Array(n);
  const zEnv = n <= 512 ? S_ZENV : new Float64Array(n + 1);
  const g = n <= 512 ? S_G : new Float64Array(n);
  for (let x = 0; x < n; x++) edtColumn(f, n, cellM, x, distM, v, zEnv, g);

  return true;
}

const EDT_INF = 1e12;

function edtRow(water: Uint8Array, f: Float64Array, n: number, row: number): void {
  let last = -1e6;
  for (let x = 0; x < n; x++) {
    if ((water[row + x] ?? 0) > 0) last = x;
    const d = x - last;
    f[row + x] = last < 0 ? EDT_INF : d * d;
  }
  last = 1e6;
  for (let x = n - 1; x >= 0; x--) {
    if ((water[row + x] ?? 0) > 0) last = x;
    if (last < n) {
      const d = last - x;
      const d2 = d * d;
      if (d2 < (f[row + x] ?? EDT_INF)) {
        f[row + x] = d2;
      }
    }
  }
}

function edtColumn(
  f: Float64Array,
  n: number,
  cellM: number,
  x: number,
  distM: Float32Array,
  v: Int32Array,
  zEnv: Float64Array,
  g: Float64Array
): void {
  for (let z = 0; z < n; z++) {
    g[z] = f[z * n + x] ?? EDT_INF;
  }
  let k = 0;
  v[0] = 0;
  zEnv[0] = -1e20;
  zEnv[1] = 1e20;

  for (let q = 1; q < n; q++) {
    const gq = g[q] ?? EDT_INF;
    let s = 0;
    while (k >= 0) {
      const vk = v[k] ?? 0;
      const gvk = g[vk] ?? EDT_INF;
      s = ((gq + q * q) - (gvk + vk * vk)) / (2 * q - 2 * vk);
      if (s > (zEnv[k] ?? -1e20)) break;
      k--;
    }
    k++;
    v[k] = q;
    zEnv[k] = s;
    zEnv[k + 1] = 1e20;
  }

  k = 0;
  for (let q = 0; q < n; q++) {
    while ((zEnv[k + 1] ?? 1e20) < q) k++;
    const vk = v[k] ?? 0;
    const dz = q - vk;
    const d2 = dz * dz + (g[vk] ?? EDT_INF);
    distM[q * n + x] = d2 >= EDT_INF * 0.5 ? 1e9 : Math.sqrt(d2) * cellM;
  }
}

function packMachines(machines: BiomeInput['machines']): Float64Array {
  let count = 0;
  for (let m = 0; m < machines.length; m++) if (machines[m]) count++;
  const out = new Float64Array(count * 3);
  let o = 0;
  for (let m = 0; m < machines.length; m++) {
    const mach = machines[m];
    if (!mach) continue;
    const r = mach.r + 1e-4;
    out[o++] = mach.x;
    out[o++] = mach.z;
    out[o++] = r * r;
  }
  return out;
}

function packKeepouts(keepouts: BiomeInput['keepouts']): Float64Array {
  let count = 0;
  for (let k = 0; k < keepouts.length; k++) if (keepouts[k]) count++;
  const out = new Float64Array(count * 4);
  let o = 0;
  for (let k = 0; k < keepouts.length; k++) {
    const ko = keepouts[k];
    if (!ko) continue;
    out[o++] = (ko.x0 < ko.x1 ? ko.x0 : ko.x1) - 1e-4;
    out[o++] = (ko.x0 > ko.x1 ? ko.x0 : ko.x1) + 1e-4;
    out[o++] = (ko.z0 < ko.z1 ? ko.z0 : ko.z1) - 1e-4;
    out[o++] = (ko.z0 > ko.z1 ? ko.z0 : ko.z1) + 1e-4;
  }
  return out;
}

function isPointExcluded(wx: number, wz: number, worldSize: number, mach: Float64Array, keep: Float64Array): boolean {
  if (wx < 0 || wx >= worldSize || wz < 0 || wz >= worldSize) return true;
  for (let m = 0; m < mach.length; m += 3) {
    const dx = wx - (mach[m] ?? 0);
    const dz = wz - (mach[m + 1] ?? 0);
    if (dx * dx + dz * dz <= (mach[m + 2] ?? 0)) return true;
  }
  for (let k = 0; k < keep.length; k += 4) {
    if (wx >= (keep[k] ?? 0) && wx <= (keep[k + 1] ?? 0) && wz >= (keep[k + 2] ?? 0) && wz <= (keep[k + 3] ?? 0)) return true;
  }
  return false;
}

function nearestMachineDist(wx: number, wz: number, worldSize: number, noMachines: boolean, mach: Float64Array): number {
  if (noMachines) {
    const cx = worldSize * 0.5;
    const cz = worldSize * 0.5;
    return Math.sqrt((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz));
  }
  let bestSq = 1e18;
  for (let m = 0; m < mach.length; m += 3) {
    const dx = wx - (mach[m] ?? 0);
    const dz = wz - (mach[m + 1] ?? 0);
    const dSq = dx * dx + dz * dz;
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

/** One row of the cover pass (the 65k-cell pass at n = 256): writes its cover texels and buckets its dry cells. */
function coverRow(p: Plot, t: CoverTerms, b: Buckets, s: CoverStats, cover: Uint8Array, z: number): void {
  const { n, cellM, worldSize, height, water, waterDistM, hasWater, noMachines, mach } = p;
  const { bare, active, s2, s4, s5, gScale2, gTerm4Const, gTerm5, bScale2, bTerm4Const, bTerm5 } = t;
  const { near: nearCells, far: farCells, wetBush: wetBushCells, fallbackBush: fallbackBushCells, tree: treeCells } = b;
  const flat = n <= 1 || cellM <= 0; // slopeDeg's guard
  const twoCellM = 2 * cellM;
  const last = n - 1;
  let nearCount = s.near;
  let farCount = s.far;
  let wetBushCount = s.wetBush;
  let fallbackBushCount = s.fallbackBush;
  let treeCount = s.tree;
  let hMin = s.hMin;
  let hMax = s.hMax;
  let dWMin = s.dWMin;
  let dWMax = s.dWMax;

  const row = z * n;
  const wz = (z + 0.5) * cellM;
  // slopeDeg's z difference for this row: one-sided on the first and last rows, central between
  const rowUp = z === 0 ? n : z === last ? row : row + n;
  const rowDown = z === 0 ? 0 : row - n;
  const zDiv = z === 0 || z === last ? cellM : twoCellM;

  for (let x = 0; x < n; x++) {
    const idx = row + x;
    const q = idx * 4;
    if ((water[idx] ?? 0) > 0) {
      cover[q] = 80;
      cover[q + 1] = 0;
      cover[q + 2] = 0;
      cover[q + 3] = 255;
      continue;
    }

    // Wetness channel A: independent of stage
    const dWater = waterDistM[idx] ?? 1e9;
    const wetA = dWater >= WET_REACH ? 0 : Math.round(255 * Math.max(0, 1 - dWater / WET_REACH));
    if (bare) {
      cover[q] = 255;
      cover[q + 1] = 0;
      cover[q + 2] = 0;
      cover[q + 3] = wetA;
      continue;
    }

    let slope = 0;
    if (!flat) {
      const dx =
        x === 0
          ? ((height[row + 1] ?? 0) - (height[row] ?? 0)) / cellM
          : x === last
            ? ((height[row + last] ?? 0) - (height[row + last - 1] ?? 0)) / cellM
            : ((height[idx + 1] ?? 0) - (height[idx - 1] ?? 0)) / twoCellM;
      const dz = ((height[rowUp + x] ?? 0) - (height[rowDown + x] ?? 0)) / zDiv;
      slope = Math.atan(Math.sqrt(dx * dx + dz * dz)) * RAD_TO_DEG;
    }

    const wx = (x + 0.5) * cellM;
    const dMach = nearestMachineDist(wx, wz, worldSize, noMachines, mach);
    const dm = dMach / 22;
    const machProx = 1 / (1 + dm + 0.48 * dm * dm);
    const dw = dWater / 16;
    const waterProx = hasWater ? 1 / (1 + dw + 0.48 * dw * dw) : 0.25;

    const gT2 = (0.3 * machProx + 0.45 * waterProx) * gScale2;
    const gT4 = 0.4 * waterProx + 0.25 * machProx + gTerm4Const;
    const bT2 = (0.65 * machProx + 0.2 * waterProx) * bScale2;
    const bT4 = 0.45 * waterProx + 0.3 * machProx + bTerm4Const;

    let gVal = 0;
    let bVal = 0;
    if (slope <= 45) {
      const slopeFactorG = 1 - 0.38 * (slope / 45);
      if (active) {
        const rawG = slopeFactorG * (s2 * gT2 + s4 * gT4 + s5 * gTerm5);
        gVal = Math.min(255, Math.max(0, Math.round(255 * rawG)));
      }

      if (slope <= 35) {
        const slopeFactorB = 1 - 0.34 * (slope / 35);
        if (active) {
          const rawB = slopeFactorB * (s2 * bT2 + s4 * bT4 + s5 * bTerm5);
          bVal = Math.min(255, Math.max(0, Math.round(255 * rawB)));
        }

        // Classify valid scatter cell (dry, slope <= 35)
        if (dMach <= 40) {
          nearCells[nearCount++] = idx;
        } else {
          farCells[farCount++] = idx;
        }

        if (wetA > 0) {
          wetBushCells[wetBushCount++] = idx;
        } else if (dWater <= WET_REACH * 3 || !hasWater) {
          fallbackBushCells[fallbackBushCount++] = idx;
        }

        // Fertile at stage 6 when G6 or B6 >= 128, G6 = min(255, max(0, round(v))): that is exactly v >= 127.5
        if (
          255 * slopeFactorG * (gT2 + gT4 + gTerm5) >= 127.5 ||
          255 * slopeFactorB * (bT2 + bT4 + bTerm5) >= 127.5
        ) {
          const h = height[idx] ?? 0;
          if (h < hMin) hMin = h;
          if (h > hMax) hMax = h;
          if (hasWater) {
            if (dWater < dWMin) dWMin = dWater;
            if (dWater > dWMax) dWMax = dWater;
          }
          treeCells[treeCount++] = idx;
        }
      }
    }

    cover[q] = Math.max(0, 255 - Math.round(0.5 * gVal + 0.5 * bVal));
    cover[q + 1] = gVal;
    cover[q + 2] = bVal;
    cover[q + 3] = wetA;
  }

  s.near = nearCount;
  s.far = farCount;
  s.wetBush = wetBushCount;
  s.fallbackBush = fallbackBushCount;
  s.tree = treeCount;
  s.hMin = hMin;
  s.hMax = hMax;
  s.dWMin = dWMin;
  s.dWMax = dWMax;
}

/** Partition the fertile cells into birch (wet/low), oak (in-between) and pine (dry/high). */
function partitionTrees(p: Plot, cover: Uint8Array, treeCells: Int32Array, c: CoverStats): TreeCells {
  const { height, waterDistM, hasWater } = p;
  const treeCellCount = c.tree;
  let { hMin, hMax, dWMin, dWMax } = c;
  if (hMin > hMax) {
    hMin = 0;
    hMax = 1;
  }
  const hSpan = hMax - hMin > 1e-4 ? hMax - hMin : 1;
  if (dWMin > dWMax) {
    dWMin = 0;
    dWMax = 1;
  }
  const dWSpan = dWMax - dWMin > 1e-4 ? dWMax - dWMin : 1;

  const birchCells = treeCellCount <= MAX_CELLS ? S_BIRCH : new Int32Array(treeCellCount);
  let birchCount = 0;
  const oakCells = treeCellCount <= MAX_CELLS ? S_OAK : new Int32Array(treeCellCount);
  let oakCount = 0;
  const pineCells = treeCellCount <= MAX_CELLS ? S_PINE : new Int32Array(treeCellCount);
  let pineCount = 0;

  for (let t = 0; t < treeCellCount; t++) {
    const cellIdx = treeCells[t] ?? 0;
    const wetA = cover[cellIdx * 4 + 3] ?? 0;
    const dW = waterDistM[cellIdx] ?? 1e9;
    const hNorm = ((height[cellIdx] ?? 0) - hMin) / hSpan;
    const wNorm = hasWater ? (dW - dWMin) / dWSpan : 0.5;

    if (hNorm <= 0.38 && (!hasWater || wNorm <= 0.35)) {
      birchCells[birchCount++] = cellIdx;
    } else if (hNorm >= 0.62 && wetA === 0 && (!hasWater || wNorm >= 0.62)) {
      pineCells[pineCount++] = cellIdx;
    } else if (hNorm > 0.38 && hNorm < 0.62 && (!hasWater || (wNorm > 0.35 && wNorm < 0.62))) {
      oakCells[oakCount++] = cellIdx;
    }
  }

  // Fallback if any tree bucket is small
  if (treeCellCount > 0 && (birchCount < 10 || oakCount < 10 || pineCount < 10)) {
    const needBirch = birchCount < 10;
    const needOak = oakCount < 10;
    const needPine = pineCount < 10;
    for (let t = 0; t < treeCellCount; t++) {
      const cellIdx = treeCells[t] ?? 0;
      const hNorm = ((height[cellIdx] ?? 0) - hMin) / hSpan;
      const dW = waterDistM[cellIdx] ?? 1e9;
      const wNorm = hasWater ? (dW - dWMin) / dWSpan : 0.5;
      const score = 0.5 * hNorm + 0.5 * wNorm;
      if (needBirch && score <= 0.36) birchCells[birchCount++] = cellIdx;
      if (needOak && score > 0.36 && score < 0.64) oakCells[oakCount++] = cellIdx;
      if (needPine && score >= 0.64) pineCells[pineCount++] = cellIdx;
    }
    if (birchCount === 0) birchCells[birchCount++] = treeCells[0] ?? 0;
    if (oakCount === 0) oakCells[oakCount++] = treeCells[treeCellCount >> 1] ?? 0;
    if (pineCount === 0) pineCells[pineCount++] = treeCells[treeCellCount - 1] ?? 0;
  }

  return { birch: birchCells, birchCount, oak: oakCells, oakCount, pine: pineCells, pineCount };
}

/** Draws the scatter candidates into the S_C* arrays, in rng order; returns how many. */
function scatterCandidates(p: Plot, seed: number, cover: Uint8Array, b: Buckets, c: CoverStats, trees: TreeCells): number {
  const { n, cellM, worldSize, height, waterDistM, noMachines, mach, keep } = p;
  const rng = mulberry32(seed);

  // Candidate storage using Structure of Arrays for speed
  const maxCandidates = MAX_CAND;
  const candKind = S_CKIND;
  const candX = S_CX;
  const candZ = S_CZ;
  const candScale = S_CSCALE;
  const candYaw = S_CYAW;
  const candAppear = S_CAPPEAR;
  const candTie = S_CTIE;
  let candCount = 0;

  const pushCandidate = (
    kindIdx: number,
    cellIdx: number,
    appearMin: number,
    appearMax: number,
    useMachDistForAppear: boolean
  ): void => {
    if (candCount >= maxCandidates) return;
    const cx = cellIdx % n;
    const cz = (cellIdx / n) | 0;
    const jx = 0.15 + 0.7 * rng();
    const jz = 0.15 + 0.7 * rng();
    const wx = (cx + jx) * cellM;
    const wz = (cz + jz) * cellM;
    const scale = 0.7 + 0.6 * rng();
    const yaw = rng() * TWO_PI;
    const tie = rng();
    const rApp = rng();

    if (isPointExcluded(wx, wz, worldSize, mach, keep)) return;

    let appear: number;
    if (useMachDistForAppear) {
      const dMach = nearestMachineDist(wx, wz, worldSize, noMachines, mach);
      // Strictly rising with distance from nearest machine:
      // 0..40m -> 2.0..4.75 (machine halo blooms first in stages 2..4.75)
      // >40m   -> 4.75..5.55 (creeps across distant grass in stages 4.75..6)
      if (dMach <= 40) {
        appear = 2 + 2.72 * (dMach / 40) + rApp * 0.03;
      } else {
        const ex = dMach - 40;
        appear = 4.75 + 0.77 * (ex / (ex + 50)) + rApp * 0.03;
      }
      if (appear < 2) appear = 2;
      if (appear > 6) appear = 6;
    } else {
      appear = appearMin + (appearMax - appearMin) * rApp;
      const minSt = KIND_FIRST_STAGE[kindIdx] ?? 0;
      if (appear < minSt) appear = minSt;
      if (appear > 6) appear = 6;
    }

    candKind[candCount] = kindIdx;
    candX[candCount] = wx;
    candZ[candCount] = wz;
    candScale[candCount] = scale;
    candYaw[candCount] = yaw;
    candAppear[candCount] = appear;
    candTie[candCount] = tie;
    candCount++;
  };

  // 1. Tufts near machines (dMach <= 40m): biased toward machine proximity
  const nearPool = c.near > 0 ? b.near : b.far;
  const nearPoolLen = c.near > 0 ? c.near : c.far;
  if (nearPoolLen > 0) {
    for (let k = 0; k < 140; k++) {
      const i1 = (rng() * nearPoolLen) | 0;
      const i2 = (rng() * nearPoolLen) | 0;
      const c1 = nearPool[i1] ?? 0;
      const c2 = nearPool[i2] ?? 0;
      const x1 = ((c1 % n) + 0.5) * cellM;
      const z1 = (((c1 / n) | 0) + 0.5) * cellM;
      const x2 = ((c2 % n) + 0.5) * cellM;
      const z2 = (((c2 / n) | 0) + 0.5) * cellM;
      const d1 = nearestMachineDist(x1, z1, worldSize, noMachines, mach);
      const d2 = nearestMachineDist(x2, z2, worldSize, noMachines, mach);
      pushCandidate(0, d1 <= d2 ? c1 : c2, 2, 6, true);
    }
  }

  // 2. Tufts far from machines (dMach > 40m) across the rest of the grass
  const farPool = c.far > 0 ? b.far : b.near;
  const farPoolLen = c.far > 0 ? c.far : c.near;
  if (farPoolLen > 0) {
    for (let k = 0; k < 340; k++) {
      const idx = farPool[(rng() * farPoolLen) | 0] ?? 0;
      pushCandidate(0, idx, 2, 6, true);
    }
  }

  // 3. Bushes near water (favouring wet cells, stage 4..6)
  const bushPool = c.wetBush > 0 ? b.wetBush : b.fallbackBush;
  const bushPoolLen = c.wetBush > 0 ? c.wetBush : c.fallbackBush;
  if (bushPoolLen > 0) {
    for (let k = 0; k < 500; k++) {
      const i1 = (rng() * bushPoolLen) | 0;
      const i2 = (rng() * bushPoolLen) | 0;
      const c1 = bushPool[i1] ?? 0;
      const c2 = bushPool[i2] ?? 0;
      const w1 = cover[c1 * 4 + 3] ?? 0;
      const w2 = cover[c2 * 4 + 3] ?? 0;
      const chosen = w1 >= w2 ? c1 : c2;
      if (k < 130) {
        pushCandidate(1, chosen, 4.0, 4.95, false);
      } else {
        pushCandidate(1, chosen, 5.0, 6.0, false);
      }
    }
  }

  // 4. Trees (pine=2, oak=3, birch=4) on stage-6 fertile cells, stage 5..6
  const { birch: birchCells, birchCount, oak: oakCells, oakCount, pine: pineCells, pineCount } = trees;
  if (birchCount > 0) {
    for (let k = 0; k < 1400; k++) {
      const i1 = (rng() * birchCount) | 0;
      const i2 = (rng() * birchCount) | 0;
      const c1 = birchCells[i1] ?? 0;
      const c2 = birchCells[i2] ?? 0;
      const d1 = waterDistM[c1] ?? 1e9;
      const d2 = waterDistM[c2] ?? 1e9;
      const chosen = d1 <= d2 ? c1 : c2;
      pushCandidate(4, chosen, k < 160 ? 5.0 : 5.45, k < 160 ? 5.45 : 6.0, false);
    }
  }
  if (oakCount > 0) {
    for (let k = 0; k < 1400; k++) {
      const chosen = oakCells[(rng() * oakCount) | 0] ?? 0;
      pushCandidate(3, chosen, k < 160 ? 5.0 : 5.45, k < 160 ? 5.45 : 6.0, false);
    }
  }
  if (pineCount > 0) {
    for (let k = 0; k < 1400; k++) {
      const i1 = (rng() * pineCount) | 0;
      const i2 = (rng() * pineCount) | 0;
      const c1 = pineCells[i1] ?? 0;
      const c2 = pineCells[i2] ?? 0;
      const h1 = height[c1] ?? 0;
      const h2 = height[c2] ?? 0;
      const chosen = h1 >= h2 ? c1 : c2;
      pushCandidate(2, chosen, k < 160 ? 5.0 : 5.45, k < 160 ? 5.45 : 6.0, false);
    }
  }

  return candCount;
}

/** Sorts S_ORDER (candidate indices) by appear ascending, breaking ties by the candidate's tie draw. */
function sortCandidates(candCount: number): void {
  const order = S_ORDER;
  const sortKey = S_SORTKEY;
  const candAppear = S_CAPPEAR;
  const candTie = S_CTIE;
  for (let c = 0; c < candCount; c++) {
    order[c] = c;
    sortKey[c] = (candAppear[c] ?? 0) + (candTie[c] ?? 0) * 1e-7;
  }
  // Fast in-place Shellsort (Ciura gaps) with zero callback overhead
  for (let gIdx = 0; gIdx < SHELL_GAPS.length; gIdx++) shellPass(SHELL_GAPS[gIdx] ?? 1, candCount);
}

function shellPass(gap: number, candCount: number): void {
  const order = S_ORDER;
  const sortKey = S_SORTKEY;
  const candTie = S_CTIE;
  for (let m = gap; m < candCount; m++) {
    const tempIdx = order[m] ?? 0;
    const tempKey = sortKey[tempIdx] ?? 0;
    let j = m;
    while (j >= gap) {
      const prevIdx = order[j - gap] ?? 0;
      const prevKey = sortKey[prevIdx] ?? 0;
      if (prevKey < tempKey || (prevKey === tempKey && (candTie[prevIdx] ?? 0) <= (candTie[tempIdx] ?? 0))) {
        break;
      }
      order[j] = prevIdx;
      j -= gap;
    }
    order[j] = tempIdx;
  }
}

/** Walks the sorted candidates and keeps each one that is spaced clear of those already kept, up to the tier cap. */
function acceptScatter(worldSize: number, stage: number, cap: number, candCount: number): Scatter[] {
  const order = S_ORDER;
  const candKind = S_CKIND;
  const candX = S_CX;
  const candZ = S_CZ;
  const candScale = S_CSCALE;
  const candYaw = S_CYAW;
  const candAppear = S_CAPPEAR;

  // 2D spatial hash grid for O(1) spacing checks
  const cellSize = 4.501; // max SPACING is 4.5 (oak)
  const gridDim = Math.max(1, Math.ceil(worldSize / cellSize));
  const head = new Int32Array(gridDim * gridDim).fill(-1);
  const next = S_NEXT;
  const accX = S_ACCX;
  const accZ = S_ACCZ;
  const accSpacing = S_ACCSP;

  const scatter: Scatter[] = [];
  let accCount = 0;

  for (let idx = 0; idx < candCount; idx++) {
    if (accCount >= cap) break;
    const c = order[idx] ?? 0;
    const app = candAppear[c] ?? 6;
    if (app > stage) break;

    const wx = candX[c] ?? 0;
    const wz = candZ[c] ?? 0;
    const kIdx = candKind[c] ?? 0;
    const spA = KIND_SPACING[kIdx] ?? 0;

    const gx = Math.min(gridDim - 1, Math.max(0, (wx / cellSize) | 0));
    const gz = Math.min(gridDim - 1, Math.max(0, (wz / cellSize) | 0));

    if (!spacingConflict(head, gridDim, gx, gz, wx, wz, spA)) {
      const cellSlot = gz * gridDim + gx;
      next[accCount] = head[cellSlot] ?? -1;
      head[cellSlot] = accCount;
      accX[accCount] = wx;
      accZ[accCount] = wz;
      accSpacing[accCount] = spA;
      accCount++;

      scatter.push({
        kind: KIND_LIST[kIdx] ?? 'tuft',
        x: wx,
        z: wz,
        scale: candScale[c] ?? 1,
        yaw: candYaw[c] ?? 0,
        appear: app,
      });
    }
  }

  return scatter;
}

/** True when a kept instance in the 3 x 3 grid cells around (gx, gz) is closer than the larger of the two spacings. */
function spacingConflict(head: Int32Array, gridDim: number, gx: number, gz: number, wx: number, wz: number, spA: number): boolean {
  const next = S_NEXT;
  const accX = S_ACCX;
  const accZ = S_ACCZ;
  const accSpacing = S_ACCSP;
  const z0 = gz > 0 ? gz - 1 : 0;
  const z1 = gz + 1 < gridDim ? gz + 1 : gridDim - 1;
  const x0 = gx > 0 ? gx - 1 : 0;
  const x1 = gx + 1 < gridDim ? gx + 1 : gridDim - 1;
  for (let nz = z0; nz <= z1; nz++) {
    const rowOff = nz * gridDim;
    for (let nx = x0; nx <= x1; nx++) {
      let cur = head[rowOff + nx] ?? -1;
      while (cur !== -1) {
        const dx = wx - (accX[cur] ?? 0);
        const dz = wz - (accZ[cur] ?? 0);
        const spB = accSpacing[cur] ?? 0;
        const minDist = (spA > spB ? spA : spB) + 1e-4;
        if (dx * dx + dz * dz < minDist * minDist) return true;
        cur = next[cur] ?? -1;
      }
    }
  }
  return false;
}

export function bakePlotBiome(i:BiomeInput):BiomeBake{
  const n = i.n | 0;
  const cellM = i.cellM;
  const total = n * n;
  const worldSize = n * cellM;
  const cover = new Uint8Array(total * 4);

  const stage = i.stage < 0 ? 0 : i.stage > 6 ? 6 : i.stage;
  const aq = i.s.aq < 0 ? 0 : i.s.aq > 1 ? 1 : i.s.aq;
  const lx = i.s.lx < 0 ? 0 : i.s.lx > 1 ? 1 : i.s.lx;
  const vtx = i.s.vtx < 0 ? 0 : i.s.vtx > 1 ? 1 : i.s.vtx;
  const pxd = i.s.pxd < 0 ? 0 : i.s.pxd > 1 ? 1 : i.s.pxd;

  const waterDistM = total <= MAX_CELLS ? S_DIST : new Float32Array(total);
  const hasWater = computeWaterDistMetres(i.water, n, cellM, waterDistM);
  const plot: Plot = {
    n,
    cellM,
    worldSize,
    height: i.height,
    water: i.water,
    waterDistM,
    hasWater,
    noMachines: i.machines.length === 0,
    mach: packMachines(i.machines),
    keep: packKeepouts(i.keepouts),
  };

  // Monotone stage progression weights for [2..6]
  const isActiveStage = stage >= 2;
  const terms: CoverTerms = {
    bare: stage < 2,
    active: isActiveStage,
    s2: isActiveStage ? Math.min(1, Math.max(0, (stage - 1.99) / 4.01)) : 0,
    s4: isActiveStage ? Math.min(1, Math.max(0, (stage - 3.2) / 2.8)) : 0,
    s5: isActiveStage ? Math.min(1, Math.max(0, (stage - 4.2) / 1.8)) : 0,
    gScale2: 0.7 + 0.2 * aq + 0.1 * lx,
    gTerm4Const: 0.2 * aq + 0.1 * lx,
    gTerm5: 0.82 + 0.22 * aq + 0.16 * lx + 0.05 * pxd,
    bScale2: 0.7 + 0.15 * aq + 0.15 * lx,
    bTerm4Const: 0.15 * aq + 0.15 * lx,
    bTerm5: 0.86 + 0.18 * aq + 0.2 * lx + 0.05 * vtx,
  };

  // Pre-bucket valid cells for fast scatter sampling
  const small = total <= MAX_CELLS;
  const buckets: Buckets = {
    near: small ? S_NEAR : new Int32Array(total),
    far: small ? S_FAR : new Int32Array(total),
    wetBush: small ? S_WETB : new Int32Array(total),
    fallbackBush: small ? S_FALLB : new Int32Array(total),
    tree: small ? S_TREE : new Int32Array(total),
  };

  const counts: CoverStats = { near: 0, far: 0, wetBush: 0, fallbackBush: 0, tree: 0, hMin: 1e9, hMax: -1e9, dWMin: 1e9, dWMax: -1e9 };
  for (let z = 0; z < n; z++) coverRow(plot, terms, buckets, counts, cover, z);
  if (stage < 2) {
    return { cover, scatter: [] };
  }

  const trees = partitionTrees(plot, cover, buckets.tree, counts);
  const candCount = scatterCandidates(plot, i.seed, cover, buckets, counts, trees);
  sortCandidates(candCount);
  return { cover, scatter: acceptScatter(worldSize, stage, CAPS[i.tier], candCount) };
}
