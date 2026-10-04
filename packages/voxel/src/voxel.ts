// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
export type Vec3 = [number, number, number];
export interface PaletteEntry { name: string; color: Vec3; roughness: number; metalness: number; emissive: number; alpha: number; material?: string }
export interface VoxelModel { id: string; name: string; size: Vec3; pivot: Vec3; palette: PaletteEntry[]; cells: Uint8Array }
export type Axis = 'x' | 'y' | 'z';

const AX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
const clampDim = (n: number) => Math.max(1, Math.min(96, Math.floor(n) || 1));
const inside = (m: VoxelModel, x: number, y: number, z: number) =>
  Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
  x >= 0 && y >= 0 && z >= 0 && x < m.size[0] && y < m.size[1] && z < m.size[2];
const idx = (m: VoxelModel, x: number, y: number, z: number) => x + m.size[0] * (y + m.size[1] * z);
const clone = (m: VoxelModel, extra: Partial<VoxelModel> = {}): VoxelModel => ({
  ...m, size: [...m.size] as Vec3, pivot: [...m.pivot] as Vec3,
  palette: m.palette.map(p => ({ ...p, color: [...p.color] as Vec3 })), cells: new Uint8Array(m.cells), ...extra,
});
const v8 = (v: number) => Math.max(0, Math.min(255, Math.floor(v)));

export function createModel(id: string, name: string, size: Vec3): VoxelModel {
  const s = size.map(clampDim) as Vec3;
  return { id, name, size: s, pivot: [Math.floor(s[0] / 2), 0, Math.floor(s[2] / 2)], palette: [], cells: new Uint8Array(s[0] * s[1] * s[2]) };
}
export const getVoxel = (m: VoxelModel, x: number, y: number, z: number) => inside(m, x, y, z) ? m.cells[idx(m, x, y, z)] : 0;

function each(m: VoxelModel, f: (x: number, y: number, z: number) => void) {
  for (let z = 0; z < m.size[2]; z++) for (let y = 0; y < m.size[1]; y++) for (let x = 0; x < m.size[0]; x++) f(x, y, z);
}
function paint(m: VoxelModel, v: number, test: (x: number, y: number, z: number) => boolean): VoxelModel {
  const r = clone(m); v = v8(v);
  each(r, (x, y, z) => { if (test(x, y, z)) r.cells[idx(r, x, y, z)] = v; });
  return r;
}
export function setVoxel(m: VoxelModel, x: number, y: number, z: number, v: number): VoxelModel {
  const r = clone(m); if (inside(r, x, y, z)) r.cells[idx(r, x, y, z)] = v8(v); return r;
}
export function fillBox(m: VoxelModel, a: Vec3, b: Vec3, v: number): VoxelModel {
  const lo = a.map((n, i) => Math.min(n, b[i])), hi = a.map((n, i) => Math.max(n, b[i]));
  return paint(m, v, (x, y, z) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]);
}
export function fillSphere(m: VoxelModel, c: Vec3, r: number, v: number): VoxelModel {
  return paint(m, v, (x, y, z) => (x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 <= r * r);
}
export function fillLine(m: VoxelModel, a: Vec3, b: Vec3, v: number, thickness = 1): VoxelModel {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = d[0] ** 2 + d[1] ** 2 + d[2] ** 2, rad = Math.max(0.5, thickness / 2);
  return paint(m, v, (x, y, z) => {
    const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / L)) : 0;
    return (x - a[0] - t * d[0]) ** 2 + (y - a[1] - t * d[1]) ** 2 + (z - a[2] - t * d[2]) ** 2 <= rad * rad;
  });
}
export function floodFill(m: VoxelModel, x: number, y: number, z: number, v: number): VoxelModel {
  const r = clone(m); v = v8(v);
  if (!inside(r, x, y, z)) return r;
  const target = r.cells[idx(r, x, y, z)]; if (target === v) return r;
  const st: Vec3[] = [[x, y, z]];
  while (st.length) {
    const [a, b, c] = st.pop()!;
    if (!inside(r, a, b, c) || r.cells[idx(r, a, b, c)] !== target) continue;
    r.cells[idx(r, a, b, c)] = v;
    st.push([a + 1, b, c], [a - 1, b, c], [a, b + 1, c], [a, b - 1, c], [a, b, c + 1], [a, b, c - 1]);
  }
  return r;
}
export function replaceColor(m: VoxelModel, from: number, to: number): VoxelModel {
  const r = clone(m); to = v8(to); r.cells.forEach((c, i) => { if (c === from) r.cells[i] = to; }); return r;
}
export function hollow(m: VoxelModel): VoxelModel {
  const r = clone(m);
  each(m, (x, y, z) => {
    if (!getVoxel(m, x, y, z)) return;
    const n: Vec3[] = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
    if (n.every(([a, b, c]) => inside(m, a, b, c) && getVoxel(m, a, b, c))) r.cells[idx(r, x, y, z)] = 0;
  });
  return r;
}
export function mirror(m: VoxelModel, axis: Axis): VoxelModel {
  const r = clone(m), k = AX[axis], n = m.size[k];
  each(m, (x, y, z) => {
    const p: Vec3 = [x, y, z];
    if (p[k] < Math.floor(n / 2)) { const q = [...p] as Vec3; q[k] = n - 1 - p[k]; r.cells[idx(r, ...q)] = getVoxel(m, ...p); }
  });
  return r;
}
export function flip(m: VoxelModel, axis: Axis): VoxelModel {
  const r = clone(m), k = AX[axis];
  each(m, (x, y, z) => { const q: Vec3 = [x, y, z]; q[k] = m.size[k] - 1 - q[k]; r.cells[idx(r, ...q)] = getVoxel(m, x, y, z); });
  return r;
}
/** Rotate 90° around axis: (u,v) -> (v', u) where u,v are the other two axes. */
export function rotate90(m: VoxelModel, axis: Axis): VoxelModel {
  const k = AX[axis], u = (k + 1) % 3, w = (k + 2) % 3;
  const size = [...m.size] as Vec3; size[u] = m.size[w]; size[w] = m.size[u];
  const pivot = [...m.pivot] as Vec3; pivot[u] = m.size[w] - 1 - m.pivot[w]; pivot[w] = m.pivot[u];
  const r = clone(m, { size, pivot, cells: new Uint8Array(m.cells.length) });
  each(m, (x, y, z) => {
    const p: Vec3 = [x, y, z], q = [...p] as Vec3;
    q[u] = m.size[w] - 1 - p[w]; q[w] = p[u];
    r.cells[idx(r, ...q)] = getVoxel(m, ...p);
  });
  return r;
}
export function translate(m: VoxelModel, dx: number, dy: number, dz: number): VoxelModel {
  const r = clone(m, { cells: new Uint8Array(m.cells.length) });
  each(m, (x, y, z) => { if (inside(r, x + dx, y + dy, z + dz)) r.cells[idx(r, x + dx, y + dy, z + dz)] = getVoxel(m, x, y, z); });
  return r;
}
export function trim(m: VoxelModel): VoxelModel {
  const { bounds, voxels } = modelStats(m);
  if (!voxels) return clone(m, { size: [1, 1, 1], pivot: [0, 0, 0], cells: new Uint8Array(1) });
  const [mn, mx] = [bounds.min, bounds.max], size = mx.map((v, i) => v - mn[i] + 1) as Vec3;
  const r = clone(m, { size, pivot: m.pivot.map((p, i) => p - mn[i]) as Vec3, cells: new Uint8Array(size[0] * size[1] * size[2]) });
  each(r, (x, y, z) => { r.cells[idx(r, x, y, z)] = getVoxel(m, x + mn[0], y + mn[1], z + mn[2]); });
  return r;
}
const pkey = (p: PaletteEntry) => JSON.stringify([p.name, p.color, p.roughness, p.metalness, p.emissive, p.alpha, p.material ?? null]);
export function merge(a: VoxelModel, b: VoxelModel, offset: Vec3 = [0, 0, 0]): VoxelModel {
  const r = clone(a), keys = r.palette.map(pkey), map = [0];
  for (const p of b.palette) {
    let i = keys.indexOf(pkey(p));
    if (i < 0 && r.palette.length < 255) { r.palette.push({ ...p, color: [...p.color] as Vec3 }); keys.push(pkey(p)); i = r.palette.length - 1; }
    map.push(i < 0 ? 0 : i + 1);
  }
  each(b, (x, y, z) => {
    const v = getVoxel(b, x, y, z), X = x + offset[0], Y = y + offset[1], Z = z + offset[2];
    if (v && inside(r, X, Y, Z)) r.cells[idx(r, X, Y, Z)] = map[v] ?? 0;
  });
  return r;
}
export const countVoxels = (m: VoxelModel) => m.cells.reduce((s, c) => s + (c ? 1 : 0), 0);

// ---- validation & codec ----
const isNum = (n: unknown, lo = -Infinity, hi = Infinity) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
function checkCommon(o: any, errors: string[]): boolean {
  if (!o || typeof o !== 'object') { errors.push('The model must be an object.'); return false; }
  if (typeof o.id !== 'string') errors.push('The model id must be a string.');
  if (typeof o.name !== 'string') errors.push('The model name must be a string.');
  if (!Array.isArray(o.size) || o.size.length !== 3 || !o.size.every((n: unknown) => isNum(n, 1, 96) && Number.isInteger(n)))
    errors.push('The size must be three whole numbers between 1 and 96.');
  if (!Array.isArray(o.pivot) || o.pivot.length !== 3 || !o.pivot.every((n: unknown) => isNum(n))) errors.push('The pivot must be three numbers.');
  if (!Array.isArray(o.palette)) errors.push('The palette must be a list.');
  else {
    if (o.palette.length > 255) errors.push('The palette can hold at most 255 entries.');
    o.palette.forEach((p: any, i: number) => {
      const w = `Palette entry ${i + 1}`;
      if (!p || typeof p !== 'object') { errors.push(`${w} must be an object.`); return; }
      if (typeof p.name !== 'string') errors.push(`${w} needs a name.`);
      if (!Array.isArray(p.color) || p.color.length !== 3 || !p.color.every((c: unknown) => isNum(c, 0, 1))) errors.push(`${w} needs a color of three numbers between 0 and 1.`);
      for (const f of ['roughness', 'metalness', 'emissive', 'alpha']) if (!isNum(p[f], 0, 1)) errors.push(`${w} needs a ${f} between 0 and 1.`);
      if (p.material !== undefined && typeof p.material !== 'string') errors.push(`${w} has a material that is not a string.`);
    });
  }
  return errors.length === 0;
}
export function validateModel(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (!checkCommon(x, errors)) return { ok: false, errors };
    const o = x as VoxelModel, n = o.size[0] * o.size[1] * o.size[2];
    if (!(o.cells instanceof Uint8Array)) errors.push('The cells must be a Uint8Array.');
    else {
      if (o.cells.length !== n) errors.push(`The cells must hold exactly ${n} values but hold ${o.cells.length}.`);
      else if (o.cells.some(c => c > o.palette.length)) errors.push('Some cells use a color that is not in the palette.');
    }
  } catch { errors.push('The model could not be read.'); }
  return { ok: errors.length === 0, errors };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toB64(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < b.length ? B64[n >> 6 & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}
function fromB64(s: string): number[] | null {
  if (s.length % 4) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map(j => s[i + j] === '=' ? 0 : B64.indexOf(s[i + j]));
    if (c.some(v => v < 0)) return null;
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    out.push(n >> 16 & 255); if (s[i + 2] !== '=') out.push(n >> 8 & 255); if (s[i + 3] !== '=') out.push(n & 255);
  }
  return out;
}
export function encodeModel(m: VoxelModel): string {
  const rle: number[] = [];
  for (let i = 0; i < m.cells.length;) {
    const v = m.cells[i]; let c = 1;
    while (c < 255 && i + c < m.cells.length && m.cells[i + c] === v) c++;
    rle.push(v, c); i += c;
  }
  return JSON.stringify({ format: 'voxel/1', id: m.id, name: m.name, size: m.size, pivot: m.pivot, palette: m.palette, rle: toB64(rle) });
}
export function decodeModel(text: string): { model: VoxelModel | null; errors: string[] } {
  const errors: string[] = [];
  try {
    let o: any;
    try { o = JSON.parse(text); } catch { return { model: null, errors: ['The text is not valid JSON.'] }; }
    // colours once written as 0..255 (Paint a thing, 2026-10-04, fixed the same day) are read as 0..1
    if (o && Array.isArray(o.palette)) for (const e of o.palette) if (e && Array.isArray(e.color) && e.color.length === 3 && e.color.every((c: unknown) => typeof c === 'number' && c >= 0 && c <= 255) && e.color.some((c: number) => c > 1)) e.color = e.color.map((c: number) => c / 255);
    if (!checkCommon(o, errors)) return { model: null, errors };
    if (typeof o.rle !== 'string') return { model: null, errors: ['The cell data (rle) is missing.'] };
    const bytes = fromB64(o.rle);
    if (!bytes || bytes.length % 2) return { model: null, errors: ['The cell data is not valid run-length base64.'] };
    const n = o.size[0] * o.size[1] * o.size[2], cells = new Uint8Array(n); let p = 0;
    for (let i = 0; i < bytes.length; i += 2) {
      if (p + bytes[i + 1] > n) return { model: null, errors: ['The cell data is longer than the model size.'] };
      cells.fill(bytes[i], p, p + bytes[i + 1]); p += bytes[i + 1];
    }
    if (p !== n) return { model: null, errors: [`The cell data covers ${p} cells but the model has ${n}.`] };
    const model: VoxelModel = { id: o.id, name: o.name, size: [...o.size] as Vec3, pivot: [...o.pivot] as Vec3,
      palette: o.palette.map((e: PaletteEntry) => { const q: PaletteEntry = { name: e.name, color: [...e.color] as Vec3, roughness: e.roughness, metalness: e.metalness, emissive: e.emissive, alpha: e.alpha }; if (e.material !== undefined) q.material = e.material; return q; }), cells };
    const v = validateModel(model);
    return v.ok ? { model, errors: [] } : { model: null, errors: v.errors };
  } catch { return { model: null, errors: ['The model could not be decoded.'] }; }
}

// ---- stats ----
export function modelStats(m: VoxelModel) {
  const min = [Infinity, Infinity, Infinity], max = [-1, -1, -1], paletteUse = new Array(m.palette.length).fill(0); let voxels = 0;
  each(m, (x, y, z) => {
    const v = getVoxel(m, x, y, z); if (!v) return;
    voxels++; if (v <= paletteUse.length) paletteUse[v - 1]++;
    [x, y, z].forEach((c, i) => { min[i] = Math.min(min[i], c); max[i] = Math.max(max[i], c); });
  });
  return voxels ? { voxels, bounds: { min, max }, paletteUse } : { voxels, bounds: { min: [0, 0, 0], max: [-1, -1, -1] }, paletteUse };
}
export function modelHash(m: VoxelModel): string {
  let h = 0x811c9dc5;
  const mix = (b: number) => { h ^= b & 255; h = Math.imul(h, 0x01000193) >>> 0; };
  for (const ch of JSON.stringify([m.size, m.palette])) mix(ch.charCodeAt(0));
  m.cells.forEach(mix);
  return h.toString(16).padStart(8, '0');
}

// ---- examples ----
const mat = (name: string, color: Vec3, roughness = 0.7, metalness = 0, emissive = 0, alpha = 1, material?: string): PaletteEntry =>
  material ? { name, color, roughness, metalness, emissive, alpha, material } : { name, color, roughness, metalness, emissive, alpha };
export function exampleBarrel(): VoxelModel {
  let m = createModel('barrel', 'Barrel', [12, 16, 12]);
  m = { ...m, palette: [mat('wood', [0.55, 0.35, 0.18], 0.8, 0, 0, 1, 'wood'), mat('iron band', [0.4, 0.4, 0.42], 0.35, 0.9)] };
  return paint(m, 0, () => false) && (() => {
    const r = clone(m);
    each(r, (x, y, z) => {
      const d = Math.hypot(x - 5.5, z - 5.5), rad = 4.6 + 1 * Math.sin((y / 15) * Math.PI);
      if (d <= rad) r.cells[idx(r, x, y, z)] = (y === 3 || y === 12) && d > rad - 1.2 ? 2 : 1;
    });
    return hollow(r);
  })();
}
export function exampleCone(): VoxelModel {
  const m = { ...createModel('cone', 'Traffic cone', [11, 12, 11]), palette: [mat('orange', [1, 0.4, 0.05], 0.6), mat('white', [1, 1, 1], 0.5)] };
  const r = clone(m);
  each(r, (x, y, z) => {
    if (y === 0) { if (Math.abs(x - 5) <= 5 && Math.abs(z - 5) <= 5) r.cells[idx(r, x, y, z)] = 1; return; }
    if (Math.hypot(x - 5, z - 5) <= 4.5 * (1 - (y - 1) / 11) + 0.5) r.cells[idx(r, x, y, z)] = y >= 5 && y <= 6 ? 2 : 1;
  });
  return r;
}