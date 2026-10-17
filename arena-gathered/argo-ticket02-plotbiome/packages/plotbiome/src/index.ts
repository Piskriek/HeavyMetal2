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

const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;
const KIND_LIST: readonly ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];

const MAX_CELLS = 512 * 512;
const S_F = new Float64Array(MAX_CELLS);
const S_V = new Int32Array(513);
const S_ZENV = new Float64Array(514);
const S_G = new Float64Array(513);
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

function computeWaterDistMetres(water: Uint8Array, n: number, cellM: number): { distM: Float32Array; hasWater: boolean } {
  const total = n * n;
  const distM = new Float32Array(total);
  let hasWater = false;
  for (let i = 0; i < total; i++) {
    if ((water[i] ?? 0) > 0) {
      hasWater = true;
      break;
    }
  }
  if (!hasWater) {
    distM.fill(1e9);
    return { distM, hasWater: false };
  }

  const INF = 1e12;
  const f = total <= MAX_CELLS ? S_F : new Float64Array(total);

  // Pass 1: 1D squared distance along each row (X)
  for (let z = 0; z < n; z++) {
    const row = z * n;
    let last = -1e6;
    for (let x = 0; x < n; x++) {
      if ((water[row + x] ?? 0) > 0) last = x;
      const d = x - last;
      f[row + x] = last < 0 ? INF : d * d;
    }
    last = 1e6;
    for (let x = n - 1; x >= 0; x--) {
      if ((water[row + x] ?? 0) > 0) last = x;
      if (last < n) {
        const d = last - x;
        const d2 = d * d;
        if (d2 < (f[row + x] ?? INF)) {
          f[row + x] = d2;
        }
      }
    }
  }

  // Pass 2: 1D parabolic lower envelope along each column (Z)
  const v = n <= 512 ? S_V : new Int32Array(n);
  const zEnv = n <= 512 ? S_ZENV : new Float64Array(n + 1);
  const g = n <= 512 ? S_G : new Float64Array(n);

  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      g[z] = f[z * n + x] ?? INF;
    }
    let k = 0;
    v[0] = 0;
    zEnv[0] = -1e20;
    zEnv[1] = 1e20;

    for (let q = 1; q < n; q++) {
      const gq = g[q] ?? INF;
      let s = 0;
      while (k >= 0) {
        const vk = v[k] ?? 0;
        const gvk = g[vk] ?? INF;
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
      const d2 = dz * dz + (g[vk] ?? INF);
      distM[q * n + x] = d2 >= INF * 0.5 ? 1e9 : Math.sqrt(d2) * cellM;
    }
  }

  return { distM, hasWater: true };
}

function isPointExcluded(
  wx: number,
  wz: number,
  worldSize: number,
  machines: readonly { x: number; z: number; r: number }[],
  keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[]
): boolean {
  if (wx < 0 || wx >= worldSize || wz < 0 || wz >= worldSize) return true;
  for (let m = 0; m < machines.length; m++) {
    const mach = machines[m];
    if (!mach) continue;
    const dx = wx - mach.x;
    const dz = wz - mach.z;
    const r = mach.r + 1e-4;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  for (let k = 0; k < keepouts.length; k++) {
    const ko = keepouts[k];
    if (!ko) continue;
    const minX = (ko.x0 < ko.x1 ? ko.x0 : ko.x1) - 1e-4;
    const maxX = (ko.x0 > ko.x1 ? ko.x0 : ko.x1) + 1e-4;
    const minZ = (ko.z0 < ko.z1 ? ko.z0 : ko.z1) - 1e-4;
    const maxZ = (ko.z0 > ko.z1 ? ko.z0 : ko.z1) + 1e-4;
    if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) return true;
  }
  return false;
}

function nearestMachineDist(
  wx: number,
  wz: number,
  worldSize: number,
  machines: readonly { x: number; z: number; r: number }[]
): number {
  if (machines.length === 0) {
    const cx = worldSize * 0.5;
    const cz = worldSize * 0.5;
    return Math.sqrt((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz));
  }
  let bestSq = 1e18;
  for (let m = 0; m < machines.length; m++) {
    const mach = machines[m];
    if (!mach) continue;
    const dx = wx - mach.x;
    const dz = wz - mach.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
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

  const { distM: waterDistM, hasWater } = computeWaterDistMetres(i.water, n, cellM);

  // Monotone stage progression weights for [2..6]
  const isActiveStage = stage >= 2;
  const s2 = isActiveStage ? Math.min(1, Math.max(0, (stage - 1.99) / 4.01)) : 0;
  const s4 = isActiveStage ? Math.min(1, Math.max(0, (stage - 3.2) / 2.8)) : 0;
  const s5 = isActiveStage ? Math.min(1, Math.max(0, (stage - 4.2) / 1.8)) : 0;

  // Pre-bucket valid cells for fast scatter sampling
  const nearMachCells = total <= MAX_CELLS ? S_NEAR : new Int32Array(total);
  let nearMachCount = 0;
  const farMachCells = total <= MAX_CELLS ? S_FAR : new Int32Array(total);
  let farMachCount = 0;
  const wetBushCells = total <= MAX_CELLS ? S_WETB : new Int32Array(total);
  let wetBushCount = 0;
  const fallbackBushCells = total <= MAX_CELLS ? S_FALLB : new Int32Array(total);
  let fallbackBushCount = 0;
  const treeCells = total <= MAX_CELLS ? S_TREE : new Int32Array(total);
  let treeCellCount = 0;

  let hMin = 1e9;
  let hMax = -1e9;
  let dWMin = 1e9;
  let dWMax = -1e9;

  const machines = i.machines;
  const keepouts = i.keepouts;

  const gScale2 = 0.7 + 0.2 * aq + 0.1 * lx;
  const gTerm4Const = 0.2 * aq + 0.1 * lx;
  const gTerm5 = 0.82 + 0.22 * aq + 0.16 * lx + 0.05 * pxd;

  const bScale2 = 0.7 + 0.15 * aq + 0.15 * lx;
  const bTerm4Const = 0.15 * aq + 0.15 * lx;
  const bTerm5 = 0.86 + 0.18 * aq + 0.2 * lx + 0.05 * vtx;

  for (let z = 0; z < n; z++) {
    const row = z * n;
    const wz = (z + 0.5) * cellM;
    for (let x = 0; x < n; x++) {
      const idx = row + x;
      const p = idx * 4;
      const isWater = (i.water[idx] ?? 0) > 0;
      const dWater = waterDistM[idx] ?? 1e9;

      // Wetness channel A: independent of stage
      const wetA = isWater
        ? 255
        : dWater >= WET_REACH
          ? 0
          : Math.round(255 * Math.max(0, 1 - dWater / WET_REACH));

      if (isWater) {
        cover[p] = 80;
        cover[p + 1] = 0;
        cover[p + 2] = 0;
        cover[p + 3] = 255;
        continue;
      }

      const slope = slopeDeg(i.height, n, cellM, x, z);
      const wx = (x + 0.5) * cellM;
      const dMach = nearestMachineDist(wx, wz, worldSize, machines);
      const dm = dMach / 22;
      const machProx = 1 / (1 + dm + 0.48 * dm * dm);
      const dw = dWater / 16;
      const waterProx = hasWater ? 1 / (1 + dw + 0.48 * dw * dw) : 0.25;

      let gVal = 0;
      let bVal = 0;

      const gT2 = (0.3 * machProx + 0.45 * waterProx) * gScale2;
      const gT4 = 0.4 * waterProx + 0.25 * machProx + gTerm4Const;
      const bT2 = (0.65 * machProx + 0.2 * waterProx) * bScale2;
      const bT4 = 0.45 * waterProx + 0.3 * machProx + bTerm4Const;

      if (isActiveStage && slope <= 45) {
        const slopeFactorG = 1 - 0.38 * (slope / 45);
        const rawG = slopeFactorG * (s2 * gT2 + s4 * gT4 + s5 * gTerm5);
        gVal = Math.min(255, Math.max(0, Math.round(255 * rawG)));

        if (slope <= 35) {
          const slopeFactorB = 1 - 0.34 * (slope / 35);
          const rawB = slopeFactorB * (s2 * bT2 + s4 * bT4 + s5 * bTerm5);
          bVal = Math.min(255, Math.max(0, Math.round(255 * rawB)));
        }
      }

      const rVal = Math.max(0, 255 - Math.round(0.5 * gVal + 0.5 * bVal));
      cover[p] = rVal;
      cover[p + 1] = gVal;
      cover[p + 2] = bVal;
      cover[p + 3] = wetA;

      // Classify valid scatter cell (dry, slope <= 35)
      if (slope <= 35) {
        if (dMach <= 40) {
          nearMachCells[nearMachCount++] = idx;
        } else {
          farMachCells[farMachCount++] = idx;
        }

        if (wetA > 0) {
          wetBushCells[wetBushCount++] = idx;
        } else if (dWater <= WET_REACH * 3 || !hasWater) {
          fallbackBushCells[fallbackBushCount++] = idx;
        }

        const slopeFactorG6 = 1 - 0.38 * (slope / 45);
        const g6 = Math.min(255, Math.max(0, Math.round(255 * slopeFactorG6 * (gT2 + gT4 + gTerm5))));
        const slopeFactorB6 = 1 - 0.34 * (slope / 35);
        const b6 = Math.min(255, Math.max(0, Math.round(255 * slopeFactorB6 * (bT2 + bT4 + bTerm5))));

        if (g6 >= 128 || b6 >= 128) {
          const h = i.height[idx] ?? 0;
          if (h < hMin) hMin = h;
          if (h > hMax) hMax = h;
          if (hasWater) {
            if (dWater < dWMin) dWMin = dWater;
            if (dWater > dWMax) dWMax = dWater;
          }
          treeCells[treeCellCount++] = idx;
        }
      }
    }
  }

  if (stage < 2) {
    return { cover, scatter: [] };
  }

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

  // Partition treeCells into birch (wet/low), oak (in-between), pine (dry/high)
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
    const hNorm = ((i.height[cellIdx] ?? 0) - hMin) / hSpan;
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
      const hNorm = ((i.height[cellIdx] ?? 0) - hMin) / hSpan;
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

  const rng = mulberry32(i.seed);

  // Candidate storage using Structure of Arrays for speed
  const maxCandidates = 6400;
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

    if (isPointExcluded(wx, wz, worldSize, machines, keepouts)) return;

    let appear: number;
    if (useMachDistForAppear) {
      const dMach = nearestMachineDist(wx, wz, worldSize, machines);
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
      const kName = KIND_LIST[kindIdx] ?? 'tuft';
      const minSt = FIRST_STAGE[kName];
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
  const nearPool = nearMachCount > 0 ? nearMachCells : farMachCells;
  const nearPoolLen = nearMachCount > 0 ? nearMachCount : farMachCount;
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
      const d1 = nearestMachineDist(x1, z1, worldSize, machines);
      const d2 = nearestMachineDist(x2, z2, worldSize, machines);
      pushCandidate(0, d1 <= d2 ? c1 : c2, 2, 6, true);
    }
  }

  // 2. Tufts far from machines (dMach > 40m) across the rest of the grass
  const farPool = farMachCount > 0 ? farMachCells : nearMachCells;
  const farPoolLen = farMachCount > 0 ? farMachCount : nearMachCount;
  if (farPoolLen > 0) {
    for (let k = 0; k < 340; k++) {
      const idx = farPool[(rng() * farPoolLen) | 0] ?? 0;
      pushCandidate(0, idx, 2, 6, true);
    }
  }

  // 3. Bushes near water (favouring wet cells, stage 4..6)
  const bushPool = wetBushCount > 0 ? wetBushCells : fallbackBushCells;
  const bushPoolLen = wetBushCount > 0 ? wetBushCount : fallbackBushCount;
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
      const h1 = i.height[c1] ?? 0;
      const h2 = i.height[c2] ?? 0;
      const chosen = h1 >= h2 ? c1 : c2;
      pushCandidate(2, chosen, k < 160 ? 5.0 : 5.45, k < 160 ? 5.45 : 6.0, false);
    }
  }

  // Sort candidate indices by appear ascending, breaking ties by candTie
  const order = S_ORDER;
  const sortKey = S_SORTKEY;
  for (let c = 0; c < candCount; c++) {
    order[c] = c;
    sortKey[c] = (candAppear[c] ?? 0) + (candTie[c] ?? 0) * 1e-7;
  }
  // Fast in-place Shellsort (Ciura gaps) with zero callback overhead
  const gaps = [1750, 701, 301, 132, 57, 23, 10, 4, 1];
  for (let gIdx = 0; gIdx < gaps.length; gIdx++) {
    const gap = gaps[gIdx] ?? 1;
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

  // 2D spatial hash grid for O(1) spacing checks
  const cap = CAPS[i.tier];
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
    const kind = KIND_LIST[kIdx] ?? 'tuft';
    const spA = SPACING[kind];

    const gx = Math.min(gridDim - 1, Math.max(0, (wx / cellSize) | 0));
    const gz = Math.min(gridDim - 1, Math.max(0, (wz / cellSize) | 0));
    const z0 = gz > 0 ? gz - 1 : 0;
    const z1 = gz + 1 < gridDim ? gz + 1 : gridDim - 1;
    const x0 = gx > 0 ? gx - 1 : 0;
    const x1 = gx + 1 < gridDim ? gx + 1 : gridDim - 1;

    let conflict = false;
    for (let nz = z0; nz <= z1 && !conflict; nz++) {
      const rowOff = nz * gridDim;
      for (let nx = x0; nx <= x1; nx++) {
        let cur = head[rowOff + nx] ?? -1;
        while (cur !== -1) {
          const dx = wx - (accX[cur] ?? 0);
          const dz = wz - (accZ[cur] ?? 0);
          const spB = accSpacing[cur] ?? 0;
          const minDist = (spA > spB ? spA : spB) + 1e-4;
          if (dx * dx + dz * dz < minDist * minDist) {
            conflict = true;
            break;
          }
          cur = next[cur] ?? -1;
        }
        if (conflict) break;
      }
    }

    if (!conflict) {
      const cellSlot = gz * gridDim + gx;
      next[accCount] = head[cellSlot] ?? -1;
      head[cellSlot] = accCount;
      accX[accCount] = wx;
      accZ[accCount] = wz;
      accSpacing[accCount] = spA;
      accCount++;

      scatter.push({
        kind,
        x: wx,
        z: wz,
        scale: candScale[c] ?? 1,
        yaw: candYaw[c] ?? 0,
        appear: app,
      });
    }
  }

  return { cover, scatter };
}
