// src/index.ts
export type Material = 'rock' | 'scree' | 'gravel' | 'dust' | 'cracked' | 'redsoil';
export const MATERIALS: readonly Material[] = ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil'];
export type Weights = [number, number, number, number, number, number];
export interface Crater { x: number; z: number; r: number; depth: number }
export interface Boulder { x: number; z: number; size: number; yaw: number }

export interface Terrain {
  readonly radius: number;
  readonly padRadius: number;
  height(x: number, z: number): number;
  normal(x: number, z: number): [number, number, number];
  slope(x: number, z: number): number;
  materials(x: number, z: number): Weights;
  readonly craters: readonly Crater[];
  boulders(x0: number, z0: number, size: number): Boulder[];
}

interface Ridge { ax: number; az: number; dx: number; dz: number; len: number; h: number; wGentle: number; wSteep: number }

function hash3(i: number, j: number, s: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function noise(x: number, z: number, s: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash3(xi, zi, s), b = hash3(xi + 1, zi, s), c = hash3(xi, zi + 1, s), d = hash3(xi + 1, zi + 1, s);
  const v = a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  return v * 2 - 1;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
function sstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function qstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function createTerrain(o: { seed: number; radius?: number; padRadius?: number }): Terrain {
  const seed = o.seed | 0;
  const radius = o.radius ?? 500;
  const padRadius = o.padRadius ?? 9;
  let rc = 0;
  const rnd = () => hash3(rc++, 9173, seed);

  const craters: Crater[] = [];
  const nc = 6 + Math.floor(rnd() * 4);
  for (let k = 0; k < 200 && craters.length < nc; k++) {
    const r = 4 + Math.pow(rnd(), 1.6) * 31;
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z) - r < 48) continue;
    if (craters.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 1.1)) continue;
    craters.push({ x, z, r, depth: Math.min(6, r * (0.1 + rnd() * 0.08)) });
  }
  const ridges: Ridge[] = [];
  const nr = 2 + Math.floor(rnd() * 2);
  const a0 = rnd() * Math.PI * 2;
  for (let k = 0; k < nr; k++) {
    const a = a0 + (k / nr) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
    const d = 230 + rnd() * 150;
    const len = 70 + rnd() * 80;
    const o2 = rnd() * Math.PI;
    const dx = Math.cos(o2), dz = Math.sin(o2);
    const mx = Math.cos(a) * d, mz = Math.sin(a) * d;
    const wG = 45 + rnd() * 25;
    ridges.push({ ax: mx - dx * len / 2, az: mz - dz * len / 2, dx, dz, len, h: 13 + rnd() * 8, wGentle: wG, wSteep: wG * (0.4 + rnd() * 0.1) });
  }
  const rippleA = rnd() * Math.PI;
  const rcx = Math.cos(rippleA), rcz = Math.sin(rippleA);

  function ridgeAt(x: number, z: number, out: { crest: number; foot: number } | null): number {
    let h = 0;
    for (const r of ridges) {
      const px = x - r.ax, pz = z - r.az;
      let u = px * r.dx + pz * r.dz;
      const v = -px * r.dz + pz * r.dx;
      u = u < 0 ? -u : u > r.len ? u - r.len : 0;
      const w = v > 0 ? r.wSteep : r.wGentle;
      const dd = Math.sqrt(u * u + v * v) / w;
      if (dd >= 1.5) continue;
      if (out) {
        out.crest = Math.max(out.crest, sstep(0.3, 0.05, dd));
        if (v > 0) out.foot = Math.max(out.foot, sstep(0.6, 0.95, dd) * sstep(1.5, 1.05, dd));
      }
      if (dd >= 1) continue;
      const t = 1 - dd;
      h += r.h * t * t * (3 - 2 * t);
    }
    return h;
  }
  function craterAt(x: number, z: number, out: { rim: number; floor: number } | null): number {
    let h = 0;
    for (const c of craters) {
      const dx = x - c.x, dz = z - c.z;
      const d2 = dx * dx + dz * dz, lim = c.r * 2.5;
      if (d2 > lim * lim) continue;
      const d = Math.sqrt(d2) / c.r, rim = c.depth * 0.35;
      if (d < 1) h += c.depth * (d * d - 1) + rim * d * d * d * d;
      else h += rim * Math.exp(-(d - 1) * (d - 1) * 5);
      if (out) {
        out.rim = Math.max(out.rim, Math.exp(-((d - 1) * (d - 1)) / 0.03));
        out.floor = Math.max(out.floor, sstep(0.8, 0.4, d));
      }
    }
    return h;
  }

  function land(x: number, z: number, detail: number): number {
    const wx = x + 45 * noise(x * 0.004, z * 0.004, seed + 1);
    const wz = z + 45 * noise(x * 0.004 + 31.7, z * 0.004 - 12.1, seed + 2);
    let h = 3.2 * noise(wx / 230, wz / 230, seed + 3) + 1.6 * noise(wx / 95, wz / 95, seed + 4) + 0.6 * noise(wx / 40, wz / 40, seed + 5);
    const g = 1 - Math.abs(noise(wx / 75, wz / 75, seed + 6));
    const g2 = g * g * g;
    h -= 2.2 * g2 * g2;
    h += 3 * Math.exp(-(x * x + z * z) / 19600);
    h += ridgeAt(wx * 0.3 + x * 0.7, wz * 0.3 + z * 0.7, null) * (0.85 + 0.15 * noise(x / 12, z / 12, seed + 7));
    h += craterAt(x, z, null);
    const rip = 0.3 * Math.sin((wx * rcx + wz * rcz) / 6 + 2.5 * noise(wx / 50, wz / 50, seed + 8));
    h += detail * (rip + 0.15 * noise(x / 3, z / 3, seed + 9) + 0.3 * noise(x / 11, z / 11, seed + 10));
    return h;
  }
  const padH = land(0, 0, 0);

  function height(x: number, z: number): number {
    const r = Math.sqrt(x * x + z * z);
    if (r <= padRadius) return padH;
    const t = qstep(padRadius, padRadius + 15, r);
    const det = qstep(padRadius, padRadius + 40, r);
    return padH + (land(x, z, det) - padH) * t;
  }
  function normal(x: number, z: number): [number, number, number] {
    const e = 0.5;
    const gx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const gz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    const l = Math.sqrt(gx * gx + gz * gz + 1);
    return [-gx / l, 1 / l, -gz / l];
  }
  function slope(x: number, z: number): number {
    return (Math.acos(Math.min(1, normal(x, z)[1])) * 180) / Math.PI;
  }

  function matsAt(x: number, z: number, h: number, ny: number): Weights {
    const s = (Math.acos(Math.min(1, ny)) * 180) / Math.PI;
    const R = 10;
    const avg = (height(x + R, z) + height(x - R, z) + height(x, z + R) + height(x, z - R)) / 4;
    const hollow = avg - h;
    const rf = { crest: 0, foot: 0 }, cf = { rim: 0, floor: 0 };
    ridgeAt(x, z, rf);
    craterAt(x, z, cf);
    const rock = clamp01(Math.max(sstep(24, 34, s), cf.rim * 0.7 * sstep(5, 15, s), rf.crest * 0.85));
    const flat = 1 - sstep(3, 9, s);
    const scree = 1.6 * rf.foot + 1.2 * sstep(14, 28, s) * (1 - sstep(30, 38, s));
    const dust = 1.4 * sstep(0.2, 1.5, hollow) + 1.2 * cf.floor + 0.3 * sstep(0.2, 0.8, noise(x / 30, z / 30, seed + 11));
    const cracked = 2 * flat * sstep(2, 6, padH - h) * (0.6 + 0.4 * noise(x / 25, z / 25, seed + 12));
    const red = 2.2 * sstep(0.2, 0.45, noise(x / 70 + 3.3, z / 70, seed + 13) + 0.25 * noise(x / 17, z / 17, seed + 14)) * (1 - sstep(10, 22, s));
    const gravel = 0.5 + 0.5 * sstep(3, 12, s);
    let w: number[] = [0, scree, gravel, dust, cracked, red * (1 - rock)];
    let sum = 0;
    for (let i = 1; i < 6; i++) sum += w[i] as number;
    w = w.map((v, i) => (i === 0 ? rock : ((v / sum) * (1 - rock))));
    const r = Math.sqrt(x * x + z * z);
    const p = 1 - sstep(padRadius, padRadius + 8, r);
    if (p > 0) {
      const padW = [0, 0, 0.6, 0.4, 0, 0];
      w = w.map((v, i) => v * (1 - p) + (padW[i] as number) * p);
    }
    let t = 0;
    for (const v of w) t += Math.max(0, v);
    const out = w.map((v) => Math.max(0, v) / t);
    return [out[0] ?? 0, out[1] ?? 0, out[2] ?? 0, out[3] ?? 0, out[4] ?? 0, out[5] ?? 0];
  }

  const CELL = 8;
  function boulders(x0: number, z0: number, size: number): Boulder[] {
    const res: Boulder[] = [];
    const i0 = Math.floor(x0 / CELL), i1 = Math.floor((x0 + size) / CELL);
    const j0 = Math.floor(z0 / CELL), j1 = Math.floor((z0 + size) / CELL);
    const rf = { crest: 0, foot: 0 }, cf = { rim: 0, floor: 0 };
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      for (let k = 0; k < 2; k++) {
        const s = seed * 7 + 101 + k * 13;
        const x = (i + hash3(i, j, s)) * CELL, z = (j + hash3(i, j, s + 1)) * CELL;
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
        if (Math.hypot(x, z) <= padRadius + 2.5) continue;
        rf.crest = 0; rf.foot = 0; cf.rim = 0; cf.floor = 0;
        ridgeAt(x, z, rf); craterAt(x, z, cf);
        const p = 0.03 + 0.7 * rf.foot + 0.5 * cf.rim + 0.2 * rf.crest;
        if (hash3(i, j, s + 2) >= p * (k === 0 ? 1 : 0.5)) continue;
        res.push({ x, z, size: 0.3 + Math.pow(hash3(i, j, s + 3), 2) * (1 + 2 * Math.max(rf.foot, cf.rim)), yaw: hash3(i, j, s + 4) * Math.PI * 2 });
      }
    }
    return res;
  }

  return {
    radius, padRadius, height, normal, slope, craters, boulders,
    materials(x: number, z: number) { return matsAt(x, z, height(x, z), normal(x, z)[1]); },
  };
}

export interface ChunkMesh { positions: Float32Array; normals: Float32Array; matA: Float32Array; matB: Float32Array; indices: Uint32Array }

export function chunkMesh(t: Terrain, cx: number, cz: number, size: number, cells: number, o?: { flat?: boolean; skirt?: number }): ChunkMesh {
  const n = cells + 1, step = size / cells, x0 = cx - size / 2, z0 = cz - size / 2;
  const skirt = o?.skirt ?? 0;
  const g = n + 2;
  const hg = new Float64Array(g * g);
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) hg[j * g + i] = t.height(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const ring = skirt > 0 ? 4 * cells : 0;
  const nv = n * n + ring;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), ma = new Float32Array(nv * 3), mb = new Float32Array(nv * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = j * n + i, gi = (j + 1) * g + i + 1;
    const h = hg[gi] ?? 0;
    const gx = ((hg[gi + 1] ?? 0) - (hg[gi - 1] ?? 0)) / (2 * step);
    const gz = ((hg[gi + g] ?? 0) - (hg[gi - g] ?? 0)) / (2 * step);
    const l = Math.sqrt(gx * gx + gz * gz + 1);
    const x = x0 + i * step, z = z0 + j * step;
    pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
    nor[v * 3] = -gx / l; nor[v * 3 + 1] = 1 / l; nor[v * 3 + 2] = -gz / l;
    const w = t.materials(x, z);
    ma[v * 3] = w[0]; ma[v * 3 + 1] = w[1]; ma[v * 3 + 2] = w[2];
    mb[v * 3] = w[3]; mb[v * 3 + 1] = w[4]; mb[v * 3 + 2] = w[5];
  }
  const idx: number[] = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const a = j * n + i, b = a + n, c = a + 1, d = b + 1;
    idx.push(a, b, c, c, b, d);
  }
  if (ring > 0) {
    const loop: number[] = [];
    for (let i = 0; i < cells; i++) loop.push(i);
    for (let j = 0; j < cells; j++) loop.push(j * n + cells);
    for (let i = cells; i > 0; i--) loop.push(cells * n + i);
    for (let j = cells; j > 0; j--) loop.push(j * n);
    loop.forEach((src, k) => {
      const v = n * n + k;
      for (let c = 0; c < 3; c++) { pos[v * 3 + c] = pos[src * 3 + c] ?? 0; nor[v * 3 + c] = nor[src * 3 + c] ?? 0; ma[v * 3 + c] = ma[src * 3 + c] ?? 0; mb[v * 3 + c] = mb[src * 3 + c] ?? 0; }
      pos[v * 3 + 1] = (pos[v * 3 + 1] ?? 0) - skirt;
    });
    for (let k = 0; k < ring; k++) {
      const a = loop[k] ?? 0, b = loop[(k + 1) % ring] ?? 0, la = n * n + k, lb = n * n + ((k + 1) % ring);
      idx.push(a, la, b, b, la, lb);
    }
  }
  if (!o?.flat) return { positions: pos, normals: nor, matA: ma, matB: mb, indices: Uint32Array.from(idx) };
  const T = idx.length;
  const P = new Float32Array(T * 3), N = new Float32Array(T * 3), A = new Float32Array(T * 3), B = new Float32Array(T * 3);
  for (let f = 0; f < T; f += 3) {
    const v0 = idx[f] ?? 0, v1 = idx[f + 1] ?? 0, v2 = idx[f + 2] ?? 0;
    const p = (v: number, c: number) => pos[v * 3 + c] ?? 0;
    const ux = p(v1, 0) - p(v0, 0), uy = p(v1, 1) - p(v0, 1), uz = p(v1, 2) - p(v0, 2);
    const wx = p(v2, 0) - p(v0, 0), wy = p(v2, 1) - p(v0, 1), wz = p(v2, 2) - p(v0, 2);
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    [v0, v1, v2].forEach((v, k) => {
      const d = (f + k) * 3;
      for (let c = 0; c < 3; c++) { P[d + c] = pos[v * 3 + c] ?? 0; A[d + c] = ma[v * 3 + c] ?? 0; B[d + c] = mb[v * 3 + c] ?? 0; }
      N[d] = nx; N[d + 1] = ny; N[d + 2] = nz;
    });
  }
  const I = new Uint32Array(T);
  for (let k = 0; k < T; k++) I[k] = k;
  return { positions: P, normals: N, matA: A, matB: B, indices: I };
}

interface QNode { x: number; z: number; size: number; kids: QNode[] | null }

export function chunksAround(eyeX: number, eyeZ: number, o: { extent: number; cells: number; minSize: number; budget: number }): { cx: number; cz: number; size: number; cells: number }[] {
  const per = 2 * o.cells * o.cells;
  const split = (q: QNode) => {
    const h = q.size / 2;
    q.kids = [
      { x: q.x, z: q.z, size: h, kids: null }, { x: q.x + h, z: q.z, size: h, kids: null },
      { x: q.x, z: q.z + h, size: h, kids: null }, { x: q.x + h, z: q.z + h, size: h, kids: null },
    ];
  };
  const canSplit = (q: QNode) => q.size / 2 >= o.minSize;
  let last: QNode[] = [];
  for (const k of [3, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.4, 0.2, 0]) {
    const root: QNode = { x: -o.extent, z: -o.extent, size: o.extent * 2, kids: null };
    const build = (q: QNode) => {
      const dx = Math.max(q.x - eyeX, 0, eyeX - (q.x + q.size));
      const dz = Math.max(q.z - eyeZ, 0, eyeZ - (q.z + q.size));
      if (canSplit(q) && Math.hypot(dx, dz) <= k * q.size) { split(q); for (const c of q.kids ?? []) build(c); }
    };
    build(root);
    const find = (x: number, z: number): QNode | null => {
      if (x < root.x || z < root.z || x >= root.x + root.size || z >= root.z + root.size) return null;
      let q = root;
      while (q.kids) { const h = q.size / 2; q = q.kids[(x >= q.x + h ? 1 : 0) + (z >= q.z + h ? 2 : 0)] as QNode; }
      return q;
    };
    let changed = true;
    let leaves: QNode[] = [];
    while (changed) {
      changed = false;
      leaves = [];
      const col = (q: QNode) => { if (q.kids) q.kids.forEach(col); else leaves.push(q); };
      col(root);
      for (const l of leaves) {
        const e = 1e-6 * o.extent, m = l.size / 2;
        for (const [px, pz] of [[l.x - e, l.z + m], [l.x + l.size + e, l.z + m], [l.x + m, l.z - e], [l.x + m, l.z + l.size + e]] as const) {
          const nb = find(px, pz);
          if (nb && !nb.kids && nb.size > l.size * 2.01) { split(nb); changed = true; }
        }
      }
    }
    last = leaves;
    if (leaves.length * per <= o.budget) break;
  }
  return last.map((q) => ({ cx: q.x + q.size / 2, cz: q.z + q.size / 2, size: q.size, cells: o.cells }));
}
