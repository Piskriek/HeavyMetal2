export type Tier = 'low' | 'mid' | 'high';
export type ScatterKind = 'tuft' | 'bush' | 'pine' | 'oak' | 'birch';

export const CAPS: Readonly<Record<Tier, number>> = { low: 600, mid: 2000, high: 6000 };
export const SPACING: Readonly<Record<ScatterKind, number>> = {
  tuft: 0.8,
  bush: 2,
  pine: 4,
  oak: 4.5,
  birch: 3.5,
};
export const FIRST_STAGE: Readonly<Record<ScatterKind, number>> = {
  tuft: 2,
  bush: 4,
  pine: 5,
  oak: 5,
  birch: 5,
};
export const WET_REACH = 6;

export interface BiomeInput {
  n: number;
  cellM: number;
  height: Float32Array;
  water: Uint8Array;
  stage: number;
  s: { pxd: number; vtx: number; lx: number; aq: number };
  machines: readonly { x: number; z: number; r: number }[];
  keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[];
  seed: number;
  tier: Tier;
}

export interface Scatter {
  kind: ScatterKind;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  appear: number;
}

export interface BiomeBake {
  cover: Uint8Array;
  scatter: Scatter[];
}

const KIND_NAME: ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];
const SP_N = [0.8, 2, 4, 4.5, 3.5];
const FIRST_N = [2, 4, 5, 5, 5];
const DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;
const MAXC = 24576;
const CK = new Uint8Array(MAXC);
const CX = new Float32Array(MAXC);
const CZ = new Float32Array(MAXC);
const CS = new Float32Array(MAXC);
const CY = new Float32Array(MAXC);
const CA = new Float32Array(MAXC);
const CT = new Uint32Array(MAXC);
const LINK = new Int32Array(6000);
const AX = new Float32Array(6000);
const AZ = new Float32Array(6000);
const ASP = new Float32Array(6000);
const ACC = new Int32Array(6000);
let HEADS = new Int32Array(4096);
let HEAD_GEN = new Int32Array(4096);
const ORD: number[] = new Array(MAXC);
let HASH_EPOCH = 1;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function heightAt(height: Float32Array, n: number, x: number, z: number): number {
  const v = height[z * n + x];
  return v === undefined ? 0 : v;
}

export function slopeDeg(height: Float32Array, n: number, cellM: number, x: number, z: number): number {
  let dx: number;
  if (x <= 0) dx = (heightAt(height, n, x + 1, z) - heightAt(height, n, x, z)) / cellM;
  else if (x >= n - 1) dx = (heightAt(height, n, x, z) - heightAt(height, n, x - 1, z)) / cellM;
  else dx = (heightAt(height, n, x + 1, z) - heightAt(height, n, x - 1, z)) / (2 * cellM);

  let dz: number;
  if (z <= 0) dz = (heightAt(height, n, x, z + 1) - heightAt(height, n, x, z)) / cellM;
  else if (z >= n - 1) dz = (heightAt(height, n, x, z) - heightAt(height, n, x, z - 1)) / cellM;
  else dz = (heightAt(height, n, x, z + 1) - heightAt(height, n, x, z - 1)) / (2 * cellM);

  return Math.atan(Math.sqrt(dx * dx + dz * dz)) * DEG;
}

function kindCode(k: number): number {
  return k + 1;
}

function tieHash(seed: number, x: number, z: number, kind: number): number {
  const ix = Math.floor(x * 1024);
  const iz = Math.floor(z * 1024);
  let a = (seed | 0) ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(kindCode(kind), 1442695041);
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

function fillWet(water: Uint8Array, n: number, cellM: number, cover: Uint8Array): void {
  const nn = n * n;
  const d2min = new Float32Array(nn);
  d2min.fill(1e20);
  const rc = Math.ceil(WET_REACH / cellM + 1e-9);
  const reach2 = WET_REACH * WET_REACH;

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if ((water[i] ?? 0) === 0) continue;
      d2min[i] = 0;
      const cx0 = (x + 0.5) * cellM;
      const cz0 = (z + 0.5) * cellM;
      const xa = x - rc < 0 ? 0 : x - rc;
      const xb = x + rc >= n ? n - 1 : x + rc;
      const za = z - rc < 0 ? 0 : z - rc;
      const zb = z + rc >= n ? n - 1 : z + rc;
      for (let zz = za; zz <= zb; zz++) {
        const cz = (zz + 0.5) * cellM;
        const ddz = cz - cz0;
        const ddz2 = ddz * ddz;
        const row = zz * n;
        for (let xx = xa; xx <= xb; xx++) {
          const ddx = (xx + 0.5) * cellM - cx0;
          const d2 = ddx * ddx + ddz2;
          if (d2 > reach2) continue;
          const idx = row + xx;
          if (d2 < (d2min[idx] ?? 1e20)) d2min[idx] = d2;
        }
      }
    }
  }

  for (let i = 0; i < nn; i++) {
    if ((water[i] ?? 0) > 0) {
      cover[i * 4 + 3] = 255;
      continue;
    }
    const d2 = d2min[i] ?? 1e20;
    if (d2 >= 1e19) {
      cover[i * 4 + 3] = 0;
      continue;
    }
    const t = 1 - Math.sqrt(d2) / WET_REACH;
    cover[i * 4 + 3] = t <= 0 ? 0 : Math.round(255 * t);
  }
}

function veg(t: number, vigour: number, wet01: number, dM: number, sl: number, out: Float64Array): void {
  if (t <= 0) {
    out[0] = 0;
    out[1] = 0;
    return;
  }
  const mReach = 10 + 40 * t;
  const mInf = dM >= mReach ? 0 : 1 - dM / mReach;
  const ambient = t * t;
  const spread = 1 - (1 - wet01) * (1 - mInf) * (1 - 0.88 * ambient);
  const gain = t * vigour * spread;
  const src = wet01 > mInf ? wet01 : mInf;
  const srcA = src > ambient ? src : ambient;
  let moss = gain * (0.58 + 0.42 * srcA);
  let grass = gain * (0.66 + 0.34 * srcA);
  if (sl > 45) moss = 0;
  else moss *= 1 - 0.22 * (sl / 45);
  if (sl > 35) grass = 0;
  else grass *= 1 - 0.16 * (sl / 35);
  if (moss < 0) moss = 0;
  else if (moss > 1) moss = 1;
  if (grass < 0) grass = 0;
  else if (grass > 1) grass = 1;
  out[0] = moss;
  out[1] = grass;
}

export function bakePlotBiome(i: BiomeInput): BiomeBake {
  const n = i.n;
  const cellM = i.cellM;
  const nn = n * n;
  const W = n * cellM;
  const cover = new Uint8Array(nn * 4);
  fillWet(i.water, n, cellM, cover);

  const block = new Uint8Array(nn);
  const treeOk = new Uint8Array(nn);
  const grassOk = new Uint8Array(nn);
  const height = i.height;
  const water = i.water;
  const machines = i.machines;
  const mc = machines.length;
  const mx = new Float64Array(mc);
  const mz = new Float64Array(mc);
  const mr2 = new Float64Array(mc);
  for (let m = 0; m < mc; m++) {
    const mac = machines[m];
    if (!mac) continue;
    mx[m] = mac.x;
    mz[m] = mac.z;
    mr2[m] = mac.r * mac.r;
  }

  const keepouts = i.keepouts;
  const kc = keepouts.length;
  const k0 = new Float64Array(kc);
  const k1 = new Float64Array(kc);
  const k2 = new Float64Array(kc);
  const k3 = new Float64Array(kc);
  for (let k = 0; k < kc; k++) {
    const box = keepouts[k];
    if (!box) continue;
    k0[k] = box.x0 < box.x1 ? box.x0 : box.x1;
    k1[k] = box.x0 < box.x1 ? box.x1 : box.x0;
    k2[k] = box.z0 < box.z1 ? box.z0 : box.z1;
    k3[k] = box.z0 < box.z1 ? box.z1 : box.z0;
  }

  let minH = 1e12;
  let maxH = -1e12;
  const inv2c = 1 / (2 * cellM);
  const invc = 1 / cellM;
  const st = i.stage;
  const t = st < 2 ? 0 : ((st > 6 ? 6 : st) - 2) / 4;
  const lx = clamp01(i.s.lx);
  const aq = clamp01(i.s.aq);
  const vtx = clamp01(i.s.vtx);
  const pxd = clamp01(i.s.pxd);
  const vigour = (0.6 + 0.4 * lx) * (0.6 + 0.4 * aq) * (0.9 + 0.1 * vtx);
  const curMG = new Float64Array(2);
  const fullMG = new Float64Array(2);
  const dustK = (1 - 0.28 * t) * (0.92 + 0.08 * (1 - pxd));

  for (let z = 0; z < n; z++) {
    const cz = (z + 0.5) * cellM;
    const row = z * n;
    for (let x = 0; x < n; x++) {
      const idx = row + x;
      const wetCell = (water[idx] ?? 0) > 0;
      const hm = height[idx] ?? 0;
      if (wetCell) {
        block[idx] = 1;
        const base = idx * 4;
        cover[base] = 0;
        cover[base + 1] = 0;
        cover[base + 2] = 0;
        continue;
      }
      if (hm < minH) minH = hm;
      if (hm > maxH) maxH = hm;
      const hx0 = x <= 0 ? hm : (height[idx - 1] ?? hm);
      const hx1 = x >= n - 1 ? hm : (height[idx + 1] ?? hm);
      const hz0 = z <= 0 ? hm : (height[idx - n] ?? hm);
      const hz1 = z >= n - 1 ? hm : (height[idx + n] ?? hm);
      const dx = x <= 0 || x >= n - 1 ? (hx1 - hx0) * invc : (hx1 - hx0) * inv2c;
      const dz = z <= 0 || z >= n - 1 ? (hz1 - hz0) * invc : (hz1 - hz0) * inv2c;
      const sl = Math.atan(Math.sqrt(dx * dx + dz * dz)) * DEG;
      if (sl > 35) block[idx] = 1;
      const cx = (x + 0.5) * cellM;
      let best = 1e12;
      for (let m = 0; m < mc; m++) {
        const mdx = cx - (mx[m] ?? 0);
        const mdz = cz - (mz[m] ?? 0);
        const d2 = mdx * mdx + mdz * mdz;
        if (d2 < best) best = d2;
      }
      const dM = Math.sqrt(best);
      const base = idx * 4;
      const wet01 = (cover[base + 3] ?? 0) / 255;
      veg(t, vigour, wet01, dM, sl, curMG);
      const moss = curMG[0] ?? 0;
      const grass = curMG[1] ?? 0;
      cover[base + 1] = Math.round(255 * moss);
      cover[base + 2] = Math.round(255 * grass);
      const vg = moss > grass ? moss : grass;
      let dust = (1 - vg) * dustK;
      if (dust < 0) dust = 0;
      else if (dust > 1) dust = 1;
      cover[base] = Math.round(255 * dust);
      if (st >= 2) {
        if (t >= 1) {
          const G = cover[base + 1] ?? 0;
          const B = cover[base + 2] ?? 0;
          if (G >= 128 || B >= 128) treeOk[idx] = 1;
          if (B > 0) grassOk[idx] = 1;
        } else {
          veg(1, vigour, wet01, dM, sl, fullMG);
          const fm = fullMG[0] ?? 0;
          const fg = fullMG[1] ?? 0;
          if (Math.round(255 * fm) >= 128 || Math.round(255 * fg) >= 128) treeOk[idx] = 1;
          if (fg > 0) grassOk[idx] = 1;
        }
      }
    }
  }
  const hSpan = maxH > minH ? maxH - minH : 1;

  const scatter: Scatter[] = [];
  if (st < 2) return { cover, scatter };

  const rng = mulberry32(i.seed);
  const ck = CK;
  const cxA = CX;
  const czA = CZ;
  const csA = CS;
  const cyA = CY;
  const caA = CA;
  const ctA = CT;
  let nc = 0;
  const seed = i.seed;

  const blockedPt = (x: number, z: number): boolean => {
    for (let m = 0; m < mc; m++) {
      const dx = x - (mx[m] ?? 0);
      const dz = z - (mz[m] ?? 0);
      if (dx * dx + dz * dz <= (mr2[m] ?? 0)) return true;
    }
    for (let k = 0; k < kc; k++) {
      if (x >= (k0[k] ?? 0) && x <= (k1[k] ?? 0) && z >= (k2[k] ?? 0) && z <= (k3[k] ?? 0)) return true;
    }
    return false;
  };

  const nearestM = (x: number, z: number): number => {
    let best = 1e12;
    for (let m = 0; m < mc; m++) {
      const dx = x - (mx[m] ?? 0);
      const dz = z - (mz[m] ?? 0);
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  };

  const push = (kind: number, x: number, z: number, rs: number, ry: number, minD: number): void => {
    if (nc >= MAXC) return;
    if (x < 0 || z < 0 || x >= W || z >= W) return;
    const ix = Math.floor(x / cellM);
    const iz = Math.floor(z / cellM);
    if (ix < 0 || iz < 0 || ix >= n || iz >= n) return;
    const ci = iz * n + ix;
    if ((block[ci] ?? 0) !== 0) return;
    if (blockedPt(x, z)) return;
    if (kind >= 2 && (treeOk[ci] ?? 0) === 0) return;

    const wet = (cover[ci * 4 + 3] ?? 0) / 255;
    const h = height[ci] ?? 0;
    const hN = (h - minH) / hSpan;
    const dMpt = kind === 0 ? nearestM(x, z) : 0;
    if (kind === 0 && dMpt < minD) return;

    if (kind === 0) {
      if ((grassOk[ci] ?? 0) === 0) return;
    } else if (kind === 1) {
      if (wet < 0.2) return;
    } else if (kind === 2) {
      if (wet > 0.3) return;
      if (hN < 0.22) return;
    } else if (kind === 3) {
      if (wet < 0.03 || wet > 0.72) return;
    } else if (kind === 4) {
      if (wet < 0.12) return;
    }

    const first = FIRST_N[kind] ?? 2;
    let u: number;
    if (kind === 0) {
      u = dMpt * 0.025;
      if (u > 1) u = 1;
    } else if (kind === 1) {
      u = 0.82 * (1 - wet) + 0.18 * rs;
    } else if (kind === 2) {
      const suit = (1 - wet) * (0.35 + 0.65 * hN);
      u = 0.72 * (1 - suit) + 0.28 * ry;
    } else if (kind === 4) {
      u = 0.72 * (1 - wet) + 0.28 * ry;
    } else {
      const suit = 1 - Math.abs(wet - 0.3);
      u = 0.72 * (1 - suit) + 0.28 * ry;
    }
    if (u < 0) u = 0;
    else if (u > 1) u = 1;

    ck[nc] = kind;
    cxA[nc] = x;
    czA[nc] = z;
    csA[nc] = 0.7 + rs * 0.6;
    cyA[nc] = ry * TWO_PI;
    caA[nc] = first + (6 - first) * u;
    ctA[nc] = tieHash(seed, x, z, kind);
    nc++;
  };

  const grid = (kind: number, step: number, minD: number): void => {
    const nx = Math.max(1, Math.floor(W / step));
    const cell = W / nx;
    for (let iz = 0; iz < nx; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        if (minD > 0) {
          const x0 = (ix + 0.5) * cell;
          const z0 = (iz + 0.5) * cell;
          if (nearestM(x0, z0) < minD - 2) continue;
        }
        const jx = rng();
        const jz = rng();
        const rs = rng();
        const ry = rng();
        push(kind, (ix + 0.16 + 0.68 * jx) * cell, (iz + 0.16 + 0.68 * jz) * cell, rs, ry, minD);
      }
    }
  };

  const halo = 14;
  const tuftStep = 1.5;
  if (mc === 0) {
    grid(0, 2.2, 0);
  } else {
    for (let m = 0; m < mc; m++) {
      const ox = (mx[m] ?? 0) - halo;
      const oz = (mz[m] ?? 0) - halo;
      const ng = Math.ceil((2 * halo) / tuftStep);
      for (let iz = 0; iz < ng; iz++) {
        for (let ix = 0; ix < ng; ix++) {
          const jx = rng();
          const jz = rng();
          const rs = rng();
          const ry = rng();
          push(0, ox + (ix + 0.16 + 0.68 * jx) * tuftStep, oz + (iz + 0.16 + 0.68 * jz) * tuftStep, rs, ry, 0);
        }
      }
    }
    grid(0, 2.45, 40);
  }

  {
    const stride = Math.max(3, Math.round(5.2 / cellM));
    for (let z = 0; z < n; z += stride) {
      for (let x = 0; x < n; x += stride) {
        const jx = rng();
        const jz = rng();
        const rs = rng();
        const ry = rng();
        push(1, (x + 0.18 + 0.64 * jx) * cellM, (z + 0.18 + 0.64 * jz) * cellM, rs, ry, 0);
      }
    }
  }
  grid(2, 4.25, 0);
  grid(3, 4.5, 0);
  grid(4, 3.6, 0);
  {
    const stride = Math.max(2, Math.round(3.6 / cellM));
    for (let z = 0; z < n; z += stride) {
      for (let x = 0; x < n; x += stride) {
        const ci = z * n + x;
        if ((treeOk[ci] ?? 0) === 0) continue;
        const wet = (cover[ci * 4 + 3] ?? 0) / 255;
        if (wet >= 0.03 && wet <= 0.72) {
          push(3, (x + 0.18 + 0.64 * rng()) * cellM, (z + 0.18 + 0.64 * rng()) * cellM, rng(), rng(), 0);
        }
        if (wet >= 0.12) {
          push(4, (x + 0.18 + 0.64 * rng()) * cellM, (z + 0.18 + 0.64 * rng()) * cellM, rng(), rng(), 0);
        }
      }
    }
  }

  const ord = ORD;
  ord.length = nc;
  for (let p = 0; p < nc; p++) ord[p] = p;
  ord.sort((a, b) => {
    const da = (caA[a] ?? 0) - (caA[b] ?? 0);
    if (da !== 0) return da;
    const dt = (ctA[a] ?? 0) - (ctA[b] ?? 0);
    if (dt !== 0) return dt;
    const dx = (cxA[a] ?? 0) - (cxA[b] ?? 0);
    if (dx !== 0) return dx;
    return (czA[a] ?? 0) - (czA[b] ?? 0);
  });

  const cap = CAPS[i.tier] ?? CAPS.mid;
  const hashCell = 0.8;
  const invHash = 1 / hashCell;
  const gw = ((W * invHash) | 0) + 4;
  const needH = gw * gw;
  if (HEADS.length < needH) {
    HEADS = new Int32Array(needH);
    HEAD_GEN = new Int32Array(needH);
  }
  const heads = HEADS;
  const headGen = HEAD_GEN;
  HASH_EPOCH++;
  if (HASH_EPOCH >= 0x7fffffff) {
    HEAD_GEN.fill(0);
    HASH_EPOCH = 1;
  }
  const epoch = HASH_EPOCH;
  const link = LINK;
  const ax = AX;
  const az = AZ;
  const asp = ASP;
  const acc = ACC;
  let nAcc = 0;
  let maxSp = 0.8;

  for (let oi = 0; oi < nc; oi++) {
    if (nAcc >= cap) break;
    const ci = ord[oi] ?? 0;
    const kind = ck[ci] ?? 0;
    const x = cxA[ci] ?? 0;
    const z = czA[ci] ?? 0;
    const sp = SP_N[kind] ?? 0.8;
    const rad = sp > maxSp ? sp : maxSp;
    const gx = (x * invHash) | 0;
    const gz = (z * invHash) | 0;
    const nb = (rad * invHash + 1) | 0;
    let ok = 1;
    const z0 = gz - nb < 0 ? 0 : gz - nb;
    const z1 = gz + nb >= gw ? gw - 1 : gz + nb;
    const x0 = gx - nb < 0 ? 0 : gx - nb;
    const x1 = gx + nb >= gw ? gw - 1 : gx + nb;
    outer: for (let zz = z0; zz <= z1; zz++) {
      const row = zz * gw;
      for (let xx = x0; xx <= x1; xx++) {
        if ((headGen[row + xx] ?? 0) !== epoch) continue;
        let p = heads[row + xx] ?? -1;
        while (p >= 0) {
          const need0 = asp[p] ?? 0.8;
          const need = sp > need0 ? sp : need0;
          const ddx = x - (ax[p] ?? 0);
          const ddz = z - (az[p] ?? 0);
          if (ddx * ddx + ddz * ddz < need * need) {
            ok = 0;
            break outer;
          }
          p = link[p] ?? -1;
        }
      }
    }
    if (ok === 0) continue;
    const id = nAcc;
    acc[id] = ci;
    ax[id] = x;
    az[id] = z;
    asp[id] = sp;
    if (sp > maxSp) maxSp = sp;
    const b = gz * gw + gx;
    if (b >= 0 && b < heads.length) {
      link[id] = (headGen[b] ?? 0) === epoch ? (heads[b] ?? -1) : -1;
      heads[b] = id;
      headGen[b] = epoch;
    }
    nAcc++;
  }

  for (let a = 0; a < nAcc; a++) {
    const ci = acc[a] ?? 0;
    const appear = caA[ci] ?? 0;
    if (appear > st) continue;
    const kind = ck[ci] ?? 0;
    const name = KIND_NAME[kind];
    if (!name) continue;
    scatter.push({
      kind: name,
      x: cxA[ci] ?? 0,
      z: czA[ci] ?? 0,
      scale: csA[ci] ?? 1,
      yaw: cyA[ci] ?? 0,
      appear,
    });
  }

  return { cover, scatter };
}
