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

  return Math.atan(Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
}

function kindCode(k: ScatterKind): number {
  if (k === 'tuft') return 1;
  if (k === 'bush') return 2;
  if (k === 'pine') return 3;
  if (k === 'oak') return 4;
  return 5;
}

function tieHash(seed: number, x: number, z: number, kind: ScatterKind): number {
  const ix = Math.floor(x * 1024);
  const iz = Math.floor(z * 1024);
  let a = (seed | 0) ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(kindCode(kind), 1442695041);
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

function inKeepout(
  x: number,
  z: number,
  keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[],
): boolean {
  for (let i = 0; i < keepouts.length; i++) {
    const k = keepouts[i];
    if (!k) continue;
    const minx = k.x0 < k.x1 ? k.x0 : k.x1;
    const maxx = k.x0 < k.x1 ? k.x1 : k.x0;
    const minz = k.z0 < k.z1 ? k.z0 : k.z1;
    const maxz = k.z0 < k.z1 ? k.z1 : k.z0;
    if (x >= minx && x <= maxx && z >= minz && z <= maxz) return true;
  }
  return false;
}

function inMachine(x: number, z: number, machines: readonly { x: number; z: number; r: number }[]): boolean {
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    if (!m) continue;
    const dx = x - m.x;
    const dz = z - m.z;
    if (dx * dx + dz * dz <= m.r * m.r) return true;
  }
  return false;
}

function nearestMachine(x: number, z: number, machines: readonly { x: number; z: number; r: number }[]): number {
  let best = 1e12;
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    if (!m) continue;
    const dx = x - m.x;
    const dz = z - m.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

interface Cand {
  kind: ScatterKind;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  appear: number;
  tie: number;
}

function fillWet(
  water: Uint8Array,
  n: number,
  cellM: number,
  distW: Float32Array,
  cover: Uint8Array,
): void {
  const nn = n * n;
  distW.fill(1e12);
  let wc = 0;
  for (let i = 0; i < nn; i++) {
    if ((water[i] ?? 0) > 0) wc++;
  }
  const rc = Math.ceil(WET_REACH / cellM + 1e-9);
  const reach2 = WET_REACH * WET_REACH;

  if (wc === 0) {
    for (let i = 0; i < nn; i++) cover[i * 4 + 3] = 0;
    return;
  }

  if (wc < 48) {
    const wxs = new Int32Array(wc);
    const wzs = new Int32Array(wc);
    let k = 0;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if ((water[i] ?? 0) > 0) {
          wxs[k] = x;
          wzs[k] = z;
          distW[i] = 0;
          k++;
        }
      }
    }
    for (let z = 0; z < n; z++) {
      const cz = (z + 0.5) * cellM;
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if ((water[i] ?? 0) > 0) continue;
        const cx = (x + 0.5) * cellM;
        let best = 1e12;
        for (let j = 0; j < wc; j++) {
          const dx = cx - ((wxs[j] ?? 0) + 0.5) * cellM;
          const dz = cz - ((wzs[j] ?? 0) + 0.5) * cellM;
          const d2 = dx * dx + dz * dz;
          if (d2 < best) best = d2;
        }
        const d = Math.sqrt(best);
        distW[i] = d;
      }
    }
  } else {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if ((water[i] ?? 0) === 0) continue;
        distW[i] = 0;
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
            const cx = (xx + 0.5) * cellM;
            const ddx = cx - cx0;
            const d2 = ddx * ddx + ddz2;
            if (d2 > reach2) continue;
            const d = Math.sqrt(d2);
            const idx = row + xx;
            if (d < (distW[idx] ?? 1e12)) distW[idx] = d;
          }
        }
      }
    }
  }

  for (let i = 0; i < nn; i++) {
    if ((water[i] ?? 0) > 0) {
      cover[i * 4 + 3] = 255;
      continue;
    }
    const d = distW[i] ?? 1e12;
    const t = 1 - d / WET_REACH;
    cover[i * 4 + 3] = t <= 0 ? 0 : Math.round(255 * t);
  }
}

function mossGrass(
  t: number,
  vigour: number,
  wet01: number,
  dM: number,
  sl: number,
  out: number[],
): void {
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
  const distW = new Float32Array(nn);
  fillWet(i.water, n, cellM, distW, cover);

  const block = new Uint8Array(nn);
  const treeOk = new Uint8Array(nn);
  const height = i.height;
  const water = i.water;

  let minH = 1e12;
  let maxH = -1e12;
  const machines = i.machines;
  const mc = machines.length;
  const inv2c = 1 / (2 * cellM);
  const invc = 1 / cellM;

  const st = i.stage;
  const t = st < 2 ? 0 : ((st > 6 ? 6 : st) - 2) / 4;
  const lx = clamp01(i.s.lx);
  const aq = clamp01(i.s.aq);
  const vtx = clamp01(i.s.vtx);
  const pxd = clamp01(i.s.pxd);
  const vigour = (0.6 + 0.4 * lx) * (0.6 + 0.4 * aq) * (0.9 + 0.1 * vtx);
  const curMG = [0, 0];
  const fullMG = [0, 0];
  const dustK = (1 - 0.28 * t) * (0.92 + 0.08 * (1 - pxd));

  for (let z = 0; z < n; z++) {
    const cz = (z + 0.5) * cellM;
    const row = z * n;
    for (let x = 0; x < n; x++) {
      const idx = row + x;
      const hm = height[idx] ?? 0;
      const hx0 = x <= 0 ? hm : (height[idx - 1] ?? hm);
      const hx1 = x >= n - 1 ? hm : (height[idx + 1] ?? hm);
      const hz0 = z <= 0 ? hm : (height[idx - n] ?? hm);
      const hz1 = z >= n - 1 ? hm : (height[idx + n] ?? hm);
      const dx = x <= 0 || x >= n - 1 ? (hx1 - hx0) * invc : (hx1 - hx0) * inv2c;
      const dz = z <= 0 || z >= n - 1 ? (hz1 - hz0) * invc : (hz1 - hz0) * inv2c;
      const sl = Math.atan(Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
      const wetCell = (water[idx] ?? 0) > 0;
      if (!wetCell) {
        if (hm < minH) minH = hm;
        if (hm > maxH) maxH = hm;
      }
      if (wetCell || sl > 35) block[idx] = 1;
      const cx = (x + 0.5) * cellM;
      let best = 1e12;
      for (let m = 0; m < mc; m++) {
        const mac = machines[m];
        if (!mac) continue;
        const mdx = cx - mac.x;
        const mdz = cz - mac.z;
        const d2 = mdx * mdx + mdz * mdz;
        if (d2 < best) best = d2;
      }
      const dM = Math.sqrt(best);

      const base = idx * 4;
      if (wetCell) {
        cover[base] = 0;
        cover[base + 1] = 0;
        cover[base + 2] = 0;
        continue;
      }
      const wet01 = (cover[base + 3] ?? 0) / 255;
      mossGrass(t, vigour, wet01, dM, sl, curMG);
      const moss = curMG[0] ?? 0;
      const grass = curMG[1] ?? 0;
      cover[base + 1] = Math.round(255 * moss);
      cover[base + 2] = Math.round(255 * grass);
      const veg = moss > grass ? moss : grass;
      let dust = (1 - veg) * dustK;
      if (dust < 0) dust = 0;
      else if (dust > 1) dust = 1;
      cover[base] = Math.round(255 * dust);
      if (st >= 2) {
        if (t >= 1) {
          if ((cover[base + 1] ?? 0) >= 128 || (cover[base + 2] ?? 0) >= 128) treeOk[idx] = 1;
        } else {
          mossGrass(1, vigour, wet01, dM, sl, fullMG);
          if (Math.round(255 * (fullMG[0] ?? 0)) >= 128 || Math.round(255 * (fullMG[1] ?? 0)) >= 128) {
            treeOk[idx] = 1;
          }
        }
      }
    }
  }
  const hSpan = maxH > minH ? maxH - minH : 1;

  const scatter: Scatter[] = [];
  if (st < 2) return { cover, scatter };

  const rng = mulberry32(i.seed);
  const cands: Cand[] = [];
  const keepouts = i.keepouts;
  const TWO_PI = Math.PI * 2;

  const tryAdd = (
    kind: ScatterKind,
    x: number,
    z: number,
    rs: number,
    ry: number,
    ru: number,
  ): void => {
    if (x < 0 || z < 0 || x >= W || z >= W) return;
    const cx = Math.floor(x / cellM);
    const cz = Math.floor(z / cellM);
    if (cx < 0 || cz < 0 || cx >= n || cz >= n) return;
    const ci = cz * n + cx;
    if ((block[ci] ?? 0) !== 0) return;
    if (inKeepout(x, z, keepouts)) return;
    if (inMachine(x, z, machines)) return;
    const isTree = kind === 'pine' || kind === 'oak' || kind === 'birch';
    if (isTree && (treeOk[ci] ?? 0) === 0) return;

    const wet = (cover[ci * 4 + 3] ?? 0) / 255;
    const h = height[ci] ?? 0;
    const hN = (h - minH) / hSpan;
    const first = FIRST_STAGE[kind] ?? 2;
    const dMpt = kind === 'tuft' ? nearestMachine(x, z, machines) : 0;

    if (kind === 'tuft') {
      if (dMpt > tuftRad) return;
    } else if (kind === 'bush') {
      if (wet < 0.2) return;
    } else if (kind === 'pine') {
      if (wet > 0.3) return;
      if (hN < 0.22) return;
    } else if (kind === 'birch') {
      if (wet < 0.16) return;
    } else if (kind === 'oak') {
      if (wet < 0.05 || wet > 0.48) return;
      if (hN > 0.88) return;
    }

    let u: number;
    if (kind === 'tuft') {
      const inner = tuftRad * 0.45;
      u = dMpt <= inner ? 0 : dMpt >= tuftRad ? 1 : (dMpt - inner) / (tuftRad - inner);
      u = 0.9 * u + 0.1 * ru * u;
    } else if (kind === 'bush') {
      u = 0.82 * (1 - wet) + 0.18 * ru;
    } else if (kind === 'pine') {
      const suit = (1 - wet) * (0.35 + 0.65 * hN);
      u = 0.72 * (1 - suit) + 0.28 * ru;
    } else if (kind === 'birch') {
      u = 0.72 * (1 - wet) + 0.28 * ru;
    } else {
      const suit = 1 - Math.abs(wet - 0.3);
      u = 0.72 * (1 - suit) + 0.28 * ru;
    }
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    const appear = first + (6 - first) * u;
    cands.push({
      kind,
      x,
      z,
      scale: 0.7 + rs * 0.6,
      yaw: ry * TWO_PI,
      appear,
      tie: tieHash(i.seed, x, z, kind),
    });
  };

  const jitterGrid = (kind: ScatterKind, step: number): void => {
    const nx = Math.max(1, Math.floor(W / step));
    const cell = W / nx;
    for (let iz = 0; iz < nx; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const jx = rng();
        const jz = rng();
        const rs = rng();
        const ry = rng();
        const ru = rng();
        const x = (ix + 0.16 + 0.68 * jx) * cell;
        const z = (iz + 0.16 + 0.68 * jz) * cell;
        tryAdd(kind, x, z, rs, ry, ru);
      }
    }
  };

  const tuftStep = 1.55;
  const tuftRad = Math.min(16, Math.max(7, 0.12 * W));
  if (mc === 0) {
    jitterGrid('tuft', 2.4);
  } else {
    for (let m = 0; m < mc; m++) {
      const mac = machines[m];
      if (!mac) continue;
      const originX = mac.x - tuftRad;
      const originZ = mac.z - tuftRad;
      const ng = Math.ceil((2 * tuftRad) / tuftStep);
      for (let iz = 0; iz < ng; iz++) {
        for (let ix = 0; ix < ng; ix++) {
          const jx = rng();
          const jz = rng();
          const rs = rng();
          const ry = rng();
          const ru = rng();
          const x = originX + (ix + 0.16 + 0.68 * jx) * tuftStep;
          const z = originZ + (iz + 0.16 + 0.68 * jz) * tuftStep;
          tryAdd('tuft', x, z, rs, ry, ru);
        }
      }
    }
  }

  {
    const stride = Math.max(3, Math.round(5.2 / cellM));
    for (let z = 0; z < n; z += stride) {
      for (let x = 0; x < n; x += stride) {
        const jx = rng();
        const jz = rng();
        const rs = rng();
        const ry = rng();
        const ru = rng();
        const px = (x + 0.18 + 0.64 * jx) * cellM;
        const pz = (z + 0.18 + 0.64 * jz) * cellM;
        tryAdd('bush', px, pz, rs, ry, ru);
      }
    }
  }
  jitterGrid('pine', 4.2);
  jitterGrid('oak', 4.7);
  jitterGrid('birch', 3.7);

  cands.sort((a, b) => {
    if (a.appear !== b.appear) return a.appear - b.appear;
    if (a.tie !== b.tie) return a.tie - b.tie;
    if (a.x !== b.x) return a.x - b.x;
    return a.z - b.z;
  });

  const cap = CAPS[i.tier] ?? CAPS.mid;
  const minSp = 0.8;
  const invSp = 1 / minSp;
  const buckets = new Map<number, Cand[]>();
  const accepted: Cand[] = [];

  const fits = (c: Cand): boolean => {
    const sp = SPACING[c.kind] ?? minSp;
    const rad = sp > 4.5 ? sp : 4.5;
    const gx = Math.floor(c.x * invSp);
    const gz = Math.floor(c.z * invSp);
    const nb = Math.ceil(rad * invSp);
    for (let dz = -nb; dz <= nb; dz++) {
      for (let dx = -nb; dx <= nb; dx++) {
        const buck = buckets.get((gx + dx) * 100003 + (gz + dz));
        if (!buck) continue;
        for (let p = 0; p < buck.length; p++) {
          const o = buck[p];
          if (!o) continue;
          const need0 = SPACING[o.kind] ?? minSp;
          const need = sp > need0 ? sp : need0;
          const ddx = c.x - o.x;
          const ddz = c.z - o.z;
          if (ddx * ddx + ddz * ddz < need * need) return false;
        }
      }
    }
    return true;
  };

  for (let c = 0; c < cands.length; c++) {
    if (accepted.length >= cap) break;
    const cand = cands[c];
    if (!cand) continue;
    if (!fits(cand)) continue;
    accepted.push(cand);
    const gx = Math.floor(cand.x * invSp);
    const gz = Math.floor(cand.z * invSp);
    const key = gx * 100003 + gz;
    const buck = buckets.get(key);
    if (buck) buck.push(cand);
    else buckets.set(key, [cand]);
  }

  for (let c = 0; c < accepted.length; c++) {
    const a = accepted[c];
    if (!a) continue;
    if (a.appear <= st) {
      scatter.push({
        kind: a.kind,
        x: a.x,
        z: a.z,
        scale: a.scale,
        yaw: a.yaw,
        appear: a.appear,
      });
    }
  }

  return { cover, scatter };
}
