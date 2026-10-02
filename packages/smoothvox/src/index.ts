export type Vec3 = [number, number, number];

export interface VMaterial {
  color: Vec3;
  alpha: number;
  roughness: number;
  metalness: number;
  emissive: number;
}

export interface VModel {
  size: Vec3;
  pivot: Vec3;
  palette: VMaterial[];
  cells: Uint8Array;
}

export interface MeshOptions {
  scale?: 1 | 2 | 4;
  blur?: number;
  iso?: number;
  preserveThin?: boolean;
  smoothIterations?: number;
  lambda?: number;
  creaseAngle?: number;
  colorBlend?: number;
  ao?: number;
}

export interface MeshStats { vertices: number; triangles: number; ms: number }
export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  paletteIndex: Uint8Array;
  indices: Uint32Array;
  triangleCount: number;
  stats: MeshStats;
}

export interface DensityField {
  width: number;
  height: number;
  depth: number;
  dimensions: Vec3;
  values: Float32Array;
  data: Float32Array;
  scale: 1 | 2 | 4;
  spacing: number;
  origin: Vec3;
  pivot: Vec3;
  sourceSize: Vec3;
  sourceCells: Uint8Array;
  palette: VMaterial[];
  iso: number;
}

interface ModelData { size: Vec3; pivot: Vec3; cells: Uint8Array; palette: VMaterial[] }

const MAX_CELLS = 8_000_000;
const MAX_FIELD = 12_000_000;
const DETERMINISTIC_MS = 0; // Clock-free output preserves deterministic meshing.
const CX = new Int8Array([0, 1, 1, 0, 0, 1, 1, 0]);
const CY = new Int8Array([0, 0, 1, 1, 0, 0, 1, 1]);
const CZ = new Int8Array([0, 0, 0, 0, 1, 1, 1, 1]);
const EA = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]);
const EB = new Uint8Array([1, 2, 3, 0, 5, 6, 7, 4, 4, 5, 6, 7]);
const QOFF = new Int8Array([
  0, -1, -1, 0, 0, -1, 0, 0, 0, 0, -1, 0,
  -1, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, -1,
  -1, -1, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0,
]);
const DEFAULT_MATERIAL: VMaterial = { color: [0.72, 0.76, 0.8], alpha: 1, roughness: 0.8, metalness: 0, emissive: 0 };

function obj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function clamp(value: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, value)); }
function option(options: unknown, key: string, fallback: number): number { return num(obj(options)[key], fallback); }
function component(value: unknown, index: number, fallback: number): number {
  return Array.isArray(value) ? num(value[index], fallback) : fallback;
}

function readModel(input: unknown): ModelData {
  try {
    const raw = obj(input);
    const size: Vec3 = [0, 0, 0];
    for (let a = 0; a < 3; a += 1) {
      const n = Math.floor(component(raw.size, a, 0));
      if (n < 0 || n > 2048) return { size: [0, 0, 0], pivot: [0, 0, 0], cells: new Uint8Array(0), palette: [] };
      size[a] = n;
    }
    const volume = size[0] * size[1] * size[2];
    if (!Number.isSafeInteger(volume) || volume > MAX_CELLS) return { size: [0, 0, 0], pivot: [0, 0, 0], cells: new Uint8Array(0), palette: [] };
    const pivot: Vec3 = [component(raw.pivot, 0, 0), component(raw.pivot, 1, 0), component(raw.pivot, 2, 0)];
    const cells = raw.cells instanceof Uint8Array ? raw.cells : new Uint8Array(0);
    const palette: VMaterial[] = [];
    if (Array.isArray(raw.palette)) for (let i = 0; i < Math.min(255, raw.palette.length); i += 1) {
      const item = obj(raw.palette[i]);
      palette.push({
        color: [
          clamp(component(item.color, 0, DEFAULT_MATERIAL.color[0]), 0, 1),
          clamp(component(item.color, 1, DEFAULT_MATERIAL.color[1]), 0, 1),
          clamp(component(item.color, 2, DEFAULT_MATERIAL.color[2]), 0, 1),
        ],
        alpha: clamp(num(item.alpha, 1), 0, 1),
        roughness: clamp(num(item.roughness, 0.8), 0, 1),
        metalness: clamp(num(item.metalness, 0), 0, 1),
        emissive: Math.max(0, num(item.emissive, 0)),
      });
    }
    return { size, pivot, cells, palette };
  } catch {
    return { size: [0, 0, 0], pivot: [0, 0, 0], cells: new Uint8Array(0), palette: [] };
  }
}

function blankField(model: ModelData, scale: 1 | 2 | 4, iso: number): DensityField {
  const values = new Float32Array(0);
  return {
    width: 0, height: 0, depth: 0, dimensions: [0, 0, 0], values, data: values, scale,
    spacing: 1 / scale, origin: [0, 0, 0], pivot: model.pivot, sourceSize: model.size,
    sourceCells: model.cells, palette: model.palette, iso,
  };
}

function trilinear(data: Float32Array, w: number, h: number, d: number, x: number, y: number, z: number): number {
  const fx = clamp(x, 0, w - 1), fy = clamp(y, 0, h - 1), fz = clamp(z, 0, d - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), z1 = Math.min(d - 1, z0 + 1);
  const tx = fx - x0, ty = fy - y0, tz = fz - z0, plane = w * h;
  const at = (ix: number, iy: number, iz: number): number => data[ix + w * iy + plane * iz] ?? 0;
  const a = at(x0, y0, z0) * (1 - tx) + at(x1, y0, z0) * tx;
  const b = at(x0, y1, z0) * (1 - tx) + at(x1, y1, z0) * tx;
  const c = at(x0, y0, z1) * (1 - tx) + at(x1, y0, z1) * tx;
  const e = at(x0, y1, z1) * (1 - tx) + at(x1, y1, z1) * tx;
  return (a * (1 - ty) + b * ty) * (1 - tz) + (c * (1 - ty) + e * ty) * tz;
}

function kernel(sigma: number): Float32Array {
  if (sigma <= 1e-6) return new Float32Array([1]);
  const radius = Math.ceil(3 * sigma), weights = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); weights[i + radius] = v; sum += v; }
  for (let i = 0; i < weights.length; i += 1) weights[i] = (weights[i] ?? 0) / sum;
  return weights;
}

function blurAxis(src: Float32Array, dst: Float32Array, w: number, h: number, d: number, weights: Float32Array, axis: number): void {
  const radius = (weights.length - 1) >> 1, plane = w * h;
  for (let z = 0; z < d; z += 1) for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let total = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const sx = x + (axis === 0 ? k : 0), sy = y + (axis === 1 ? k : 0), sz = z + (axis === 2 ? k : 0);
      if (sx >= 0 && sx < w && sy >= 0 && sy < h && sz >= 0 && sz < d) total += (src[sx + w * sy + plane * sz] ?? 0) * (weights[k + radius] ?? 0);
    }
    dst[x + w * y + plane * z] = total;
  }
}

export function buildField(input: VModel, options: MeshOptions = {}): DensityField {
  const model = readModel(input), rawOptions = obj(options);
  const rawScale = option(options, "scale", 2), scale: 1 | 2 | 4 = rawScale >= 3 ? 4 : rawScale >= 1.5 ? 2 : 1;
  const iso = clamp(option(options, "iso", 0.5), 0, 1), blur = clamp(option(options, "blur", 0.8), 0, 16);
  if (model.size[0] === 0 || model.size[1] === 0 || model.size[2] === 0) return blankField(model, scale, iso);
  const pad = Math.ceil(3 * blur) + 1, bw = model.size[0] + pad * 2, bh = model.size[1] + pad * 2, bd = model.size[2] + pad * 2;
  const width = (bw - 1) * scale + 1, height = (bh - 1) * scale + 1, depth = (bd - 1) * scale + 1;
  const count = width * height * depth, baseCount = bw * bh * bd;
  if (!Number.isSafeInteger(count) || count > MAX_FIELD || baseCount > MAX_FIELD) return blankField(model, scale, iso);
  try {
    const base = new Float32Array(baseCount), preserve = rawOptions.preserveThin === true;
    const thin = preserve ? new Float32Array(baseCount) : null;
    const [nx, ny, nz] = model.size, sourcePlane = nx * ny, basePlane = bw * bh;
    let solid = false;
    for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) {
      const source = x + nx * y + sourcePlane * z;
      if ((model.cells[source] ?? 0) === 0) continue;
      solid = true;
      const at = x + pad + bw * (y + pad) + basePlane * (z + pad);
      base[at] = 1;
      if (thin === null) continue;
      const oppositeX = (x === 0 || (model.cells[source - 1] ?? 0) === 0) && (x === nx - 1 || (model.cells[source + 1] ?? 0) === 0);
      const oppositeY = (y === 0 || (model.cells[source - nx] ?? 0) === 0) && (y === ny - 1 || (model.cells[source + nx] ?? 0) === 0);
      const oppositeZ = (z === 0 || (model.cells[source - sourcePlane] ?? 0) === 0) && (z === nz - 1 || (model.cells[source + sourcePlane] ?? 0) === 0);
      if (oppositeX || oppositeY || oppositeZ) thin[at] = 1;
    }
    const values = new Float32Array(count), thinSamples = thin === null ? null : new Float32Array(count);
    if (solid) for (let z = 0; z < depth; z += 1) for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const at = x + width * y + width * height * z, bx = x / scale, by = y / scale, bz = z / scale;
      values[at] = trilinear(base, bw, bh, bd, bx, by, bz);
      if (thin !== null && thinSamples !== null) thinSamples[at] = trilinear(thin, bw, bh, bd, bx, by, bz);
    }
    if (solid && blur > 0) {
      const weights = kernel(blur * scale), temp = new Float32Array(count), temp2 = new Float32Array(count);
      blurAxis(values, temp, width, height, depth, weights, 0);
      blurAxis(temp, temp2, width, height, depth, weights, 1);
      blurAxis(temp2, values, width, height, depth, weights, 2);
    }
    if (thinSamples !== null) for (let i = 0; i < count; i += 1) values[i] = Math.max(values[i] ?? 0, thinSamples[i] ?? 0);
    return {
      width, height, depth, dimensions: [width, height, depth], values, data: values, scale, spacing: 1 / scale,
      origin: [0.5 - pad, 0.5 - pad, 0.5 - pad], pivot: model.pivot, sourceSize: model.size,
      sourceCells: model.cells, palette: model.palette, iso,
    };
  } catch {
    return blankField(model, scale, iso);
  }
}

function emptyMesh(): Mesh {
  return {
    positions: new Float32Array(0), normals: new Float32Array(0), colors: new Float32Array(0),
    paletteIndex: new Uint8Array(0), indices: new Uint32Array(0), triangleCount: 0,
    stats: { vertices: 0, triangles: 0, ms: DETERMINISTIC_MS },
  };
}
function crossing(a: number, b: number, iso: number): boolean { return (a >= iso) !== (b >= iso); }
function ci(x: number, y: number, z: number, w: number, h: number): number { return x + w * (y + h * z); }

function fieldAt(field: DensityField, x: number, y: number, z: number): number {
  return trilinear(field.values, field.width, field.height, field.depth,
    (x - field.origin[0]) * field.scale, (y - field.origin[1]) * field.scale, (z - field.origin[2]) * field.scale);
}

function normalsFromField(field: DensityField, positions: Float32Array): Float32Array {
  const out = new Float32Array(positions.length), step = field.spacing;
  for (let i = 0; i < positions.length; i += 3) {
    const x = (positions[i] ?? 0) + field.pivot[0], y = (positions[i + 1] ?? 0) + field.pivot[1], z = (positions[i + 2] ?? 0) + field.pivot[2];
    let nx = fieldAt(field, x - step, y, z) - fieldAt(field, x + step, y, z);
    let ny = fieldAt(field, x, y - step, z) - fieldAt(field, x, y + step, z);
    let nz = fieldAt(field, x, y, z - step) - fieldAt(field, x, y, z + step);
    const length = Math.hypot(nx, ny, nz);
    if (length > 1e-12) { nx /= length; ny /= length; nz /= length; } else { nx = 0; ny = 1; nz = 0; }
    out[i] = nx; out[i + 1] = ny; out[i + 2] = nz;
  }
  return out;
}

function putQuad(out: Uint32Array, at: number, a: number, b: number, c: number, d: number, reverse: boolean): number {
  if (reverse) { out[at] = a; out[at + 1] = d; out[at + 2] = c; out[at + 3] = a; out[at + 4] = c; out[at + 5] = b; }
  else { out[at] = a; out[at + 1] = b; out[at + 2] = c; out[at + 3] = a; out[at + 4] = c; out[at + 5] = d; }
  return at + 6;
}

function walkEdges(field: DensityField, map: Int32Array, iso: number, out: Uint32Array | null): number {
  const cw = field.width - 1, ch = field.height - 1, plane = field.width * field.height, offsets = QOFF;
  let used = 0;
  for (let z = 0; z < field.depth; z += 1) for (let y = 0; y < field.height; y += 1) for (let x = 0; x < field.width; x += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const ex = x + (axis === 0 ? 1 : 0), ey = y + (axis === 1 ? 1 : 0), ez = z + (axis === 2 ? 1 : 0);
      if (ex >= field.width || ey >= field.height || ez >= field.depth) continue;
      const offset = axis * 12;
      const ax = x + (offsets[offset] ?? 0), ay = y + (offsets[offset + 1] ?? 0), az = z + (offsets[offset + 2] ?? 0);
      const bx = x + (offsets[offset + 3] ?? 0), by = y + (offsets[offset + 4] ?? 0), bz = z + (offsets[offset + 5] ?? 0);
      const cx = x + (offsets[offset + 6] ?? 0), cy = y + (offsets[offset + 7] ?? 0), cz = z + (offsets[offset + 8] ?? 0);
      const dx = x + (offsets[offset + 9] ?? 0), dy = y + (offsets[offset + 10] ?? 0), dz = z + (offsets[offset + 11] ?? 0);
      if (ax < 0 || ay < 0 || az < 0 || ax >= cw || ay >= ch || az >= field.depth - 1
        || bx < 0 || by < 0 || bz < 0 || bx >= cw || by >= ch || bz >= field.depth - 1
        || cx < 0 || cy < 0 || cz < 0 || cx >= cw || cy >= ch || cz >= field.depth - 1
        || dx < 0 || dy < 0 || dz < 0 || dx >= cw || dy >= ch || dz >= field.depth - 1) continue;
      const planeIndex = x + field.width * y + plane * z;
      const v0 = field.values[planeIndex] ?? 0;
      const v1 = field.values[planeIndex + (axis === 0 ? 1 : axis === 1 ? field.width : plane)] ?? 0;
      if (!crossing(v0, v1, iso)) continue;
      const a = map[ci(ax, ay, az, cw, ch)] ?? -1, b = map[ci(bx, by, bz, cw, ch)] ?? -1;
      const c = map[ci(cx, cy, cz, cw, ch)] ?? -1, d = map[ci(dx, dy, dz, cw, ch)] ?? -1;
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      if (out === null) used += 6;
      else used = putQuad(out, used, a, b, c, d, v0 < iso);
    }
  }
  return used;
}

export function surfaceNets(input: DensityField, options: { iso?: number } = {}): Mesh {
  try {
    const field = obj(input), values = field.values;
    const w = Math.floor(num(field.width, 0)), h = Math.floor(num(field.height, 0)), d = Math.floor(num(field.depth, 0));
    if (!(values instanceof Float32Array) || w < 2 || h < 2 || d < 2 || values.length !== w * h * d || values.length > MAX_FIELD) return emptyMesh();
    const f = input as DensityField, iso = clamp(option(options, "iso", num(field.iso, 0.5)), 0, 1);
    const cw = w - 1, ch = h - 1, cd = d - 1, cellCount = cw * ch * cd;
    if (!Number.isSafeInteger(cellCount) || cellCount > MAX_FIELD) return emptyMesh();
    const map = new Int32Array(cellCount); map.fill(-1);
    const positions = new Float32Array(cellCount * 3), cube = new Float32Array(8);
    const plane = w * h, spacing = num(field.spacing, 1 / num(field.scale, 1));
    let vertices = 0;
    for (let z = 0; z < cd; z += 1) for (let y = 0; y < ch; y += 1) for (let x = 0; x < cw; x += 1) {
      let inside = 0;
      for (let c = 0; c < 8; c += 1) {
        const gx = x + (CX[c] ?? 0), gy = y + (CY[c] ?? 0), gz = z + (CZ[c] ?? 0), i = gx + w * gy + plane * gz;
        cube[c] = values[i] ?? 0;
        if ((cube[c] ?? 0) >= iso) inside += 1;
      }
      if (inside === 0 || inside === 8) continue;
      let sx = 0, sy = 0, sz = 0, crossings = 0;
      for (let e = 0; e < 12; e += 1) {
        const a = EA[e] ?? 0, b = EB[e] ?? 0, va = cube[a] ?? 0, vb = cube[b] ?? 0;
        if (!crossing(va, vb, iso)) continue;
        const t = clamp((iso - va) / (vb - va), 0, 1);
        sx += (CX[a] ?? 0) + ((CX[b] ?? 0) - (CX[a] ?? 0)) * t;
        sy += (CY[a] ?? 0) + ((CY[b] ?? 0) - (CY[a] ?? 0)) * t;
        sz += (CZ[a] ?? 0) + ((CZ[b] ?? 0) - (CZ[a] ?? 0)) * t;
        crossings += 1;
      }
      if (crossings === 0) continue;
      const v = vertices++, o = v * 3;
      positions[o] = num(field.origin instanceof Array ? field.origin[0] : 0, 0) + (x + sx / crossings) * spacing - num(obj(field).pivot instanceof Array ? (obj(field).pivot as number[])[0] : 0, 0);
      positions[o + 1] = num(field.origin instanceof Array ? field.origin[1] : 0, 0) + (y + sy / crossings) * spacing - num(obj(field).pivot instanceof Array ? (obj(field).pivot as number[])[1] : 0, 0);
      positions[o + 2] = num(field.origin instanceof Array ? field.origin[2] : 0, 0) + (z + sz / crossings) * spacing - num(obj(field).pivot instanceof Array ? (obj(field).pivot as number[])[2] : 0, 0);
      map[x + cw * (y + ch * z)] = v;
    }
    if (vertices === 0) return emptyMesh();
    const indexCount = walkEdges(f, map, iso, null), indices = new Uint32Array(indexCount);
    const written = walkEdges(f, map, iso, indices), finalPositions = positions.slice(0, vertices * 3), finalIndices = indices.slice(0, written);
    const normals = normalsFromField(f, finalPositions), triangles = written / 3;
    return { positions: finalPositions, normals, colors: new Float32Array(0), paletteIndex: new Uint8Array(0), indices: finalIndices,
      triangleCount: triangles, stats: { vertices, triangles, ms: DETERMINISTIC_MS } };
  } catch { return emptyMesh(); }
}

function volume(positions: Float32Array, indices: Uint32Array): number {
  let sum = 0;
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = (indices[i] ?? 0) * 3, b = (indices[i + 1] ?? 0) * 3, c = (indices[i + 2] ?? 0) * 3;
    const ax = positions[a] ?? 0, ay = positions[a + 1] ?? 0, az = positions[a + 2] ?? 0;
    const bx = positions[b] ?? 0, by = positions[b + 1] ?? 0, bz = positions[b + 2] ?? 0;
    const cx = positions[c] ?? 0, cy = positions[c + 1] ?? 0, cz = positions[c + 2] ?? 0;
    sum += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return sum / 6;
}

function edgeSlot(a: number, b: number, n: number, keys: Float64Array, mask: number): number {
  const lo = Math.min(a, b), hi = Math.max(a, b), key = lo * n + hi + 1;
  let slot = (Math.imul(lo, 73856093) ^ Math.imul(hi, 19349663)) & mask;
  while ((keys[slot] ?? 0) !== 0 && (keys[slot] ?? 0) !== key) slot = (slot + 1) & mask;
  return slot;
}

function volumeCorrection(before: Float32Array, after: Float32Array, indices: Uint32Array): void {
  const v0 = volume(before, indices), v1 = volume(after, indices);
  if (!Number.isFinite(v0) || !Number.isFinite(v1) || Math.abs(v0) < 1e-12 || Math.abs(v1) < 1e-12) return;
  const scale = Math.cbrt(Math.abs(v0 / v1));
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 2) return;
  const n = after.length / 3; let x = 0, y = 0, z = 0;
  for (let i = 0; i < after.length; i += 3) { x += after[i] ?? 0; y += after[i + 1] ?? 0; z += after[i + 2] ?? 0; }
  x /= n || 1; y /= n || 1; z /= n || 1;
  for (let i = 0; i < after.length; i += 3) {
    after[i] = x + ((after[i] ?? 0) - x) * scale;
    after[i + 1] = y + ((after[i + 1] ?? 0) - y) * scale;
    after[i + 2] = z + ((after[i + 2] ?? 0) - z) * scale;
  }
}

export function smoothMesh(positions: Float32Array, indices: Uint32Array, iterations: number, lambda: number, creaseAngle: number): Float32Array {
  if (!(positions instanceof Float32Array) || !(indices instanceof Uint32Array) || positions.length % 3 !== 0) return new Float32Array(0);
  const n = positions.length / 3, passes = Math.floor(clamp(num(iterations, 0), 0, 20));
  if (n === 0 || passes === 0 || indices.length < 3) return positions.slice();
  try {
    const faces = Math.floor(indices.length / 3), faceNormals = new Float32Array(faces * 3), valid = new Uint8Array(faces);
    let edgeCount = 0;
    for (let f = 0; f < faces; f += 1) {
      const a = indices[f * 3] ?? n, b = indices[f * 3 + 1] ?? n, c = indices[f * 3 + 2] ?? n;
      if (a >= n || b >= n || c >= n || a === b || b === c || c === a) continue;
      valid[f] = 1; edgeCount += 3;
      const u = a * 3, v = b * 3, w = c * 3;
      const ux = (positions[v] ?? 0) - (positions[u] ?? 0), uy = (positions[v + 1] ?? 0) - (positions[u + 1] ?? 0), uz = (positions[v + 2] ?? 0) - (positions[u + 2] ?? 0);
      const vx = (positions[w] ?? 0) - (positions[u] ?? 0), vy = (positions[w + 1] ?? 0) - (positions[u + 1] ?? 0), vz = (positions[w + 2] ?? 0) - (positions[u + 2] ?? 0);
      let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      const length = Math.hypot(x, y, z); if (length > 1e-12) { x /= length; y /= length; z /= length; }
      faceNormals[f * 3] = x; faceNormals[f * 3 + 1] = y; faceNormals[f * 3 + 2] = z;
    }
    if (edgeCount === 0) return positions.slice();
    let size = 8; while (size < edgeCount * 2 && size < 1 << 25) size *= 2;
    if (size < edgeCount * 2) return positions.slice();
    const keys = new Float64Array(size), first = new Int32Array(size), second = new Int32Array(size), mask = size - 1;
    first.fill(-1); second.fill(-1);
    for (let f = 0; f < faces; f += 1) if ((valid[f] ?? 0) !== 0) {
      const a = indices[f * 3] ?? 0, b = indices[f * 3 + 1] ?? 0, c = indices[f * 3 + 2] ?? 0;
      for (let e = 0; e < 3; e += 1) {
        const u = e === 0 ? a : e === 1 ? b : c, v = e === 0 ? b : e === 1 ? c : a, slot = edgeSlot(u, v, n, keys, mask);
        const key = Math.min(u, v) * n + Math.max(u, v) + 1;
        if ((keys[slot] ?? 0) === 0) { keys[slot] = key; first[slot] = f; }
        else if ((first[slot] ?? -1) !== f && (second[slot] ?? -1) < 0) second[slot] = f;
      }
    }
    const threshold = Math.cos(clamp(num(creaseAngle, 45), 0, 180) * Math.PI / 180);
    const sharp = (a: number, b: number, face: number): boolean => {
      const slot = edgeSlot(a, b, n, keys, mask), other = (first[slot] ?? -1) === face ? second[slot] ?? -1 : first[slot] ?? -1;
      if (other < 0) return false;
      const o = face * 3, q = other * 3;
      return (faceNormals[o] ?? 0) * (faceNormals[q] ?? 0) + (faceNormals[o + 1] ?? 0) * (faceNormals[q + 1] ?? 0)
        + (faceNormals[o + 2] ?? 0) * (faceNormals[q + 2] ?? 0) < threshold;
    };
    const degree = new Uint32Array(n);
    for (let f = 0; f < faces; f += 1) if ((valid[f] ?? 0) !== 0) {
      const a = indices[f * 3] ?? 0, b = indices[f * 3 + 1] ?? 0, c = indices[f * 3 + 2] ?? 0;
      if (!sharp(a, b, f)) degree[a] = (degree[a] ?? 0) + 1;
      if (!sharp(b, c, f)) degree[b] = (degree[b] ?? 0) + 1;
      if (!sharp(c, a, f)) degree[c] = (degree[c] ?? 0) + 1;
    }
    const offsets = new Uint32Array(n + 1);
    for (let i = 0; i < n; i += 1) offsets[i + 1] = (offsets[i] ?? 0) + (degree[i] ?? 0);
    const neighbors = new Uint32Array(offsets[n] ?? 0), cursor = offsets.slice(0, n);
    for (let f = 0; f < faces; f += 1) if ((valid[f] ?? 0) !== 0) {
      const a = indices[f * 3] ?? 0, b = indices[f * 3 + 1] ?? 0, c = indices[f * 3 + 2] ?? 0;
      if (!sharp(a, b, f)) { const i = cursor[a] ?? 0; neighbors[i] = b; cursor[a] = i + 1; }
      if (!sharp(b, c, f)) { const i = cursor[b] ?? 0; neighbors[i] = c; cursor[b] = i + 1; }
      if (!sharp(c, a, f)) { const i = cursor[c] ?? 0; neighbors[i] = a; cursor[c] = i + 1; }
    }
    let current = positions.slice(), next = new Float32Array(positions.length);
    const lambdaValue = clamp(num(lambda, 0.45), 0, 1), mu = -lambdaValue / (1 + lambdaValue);
    const step = (factor: number): void => {
      for (let v = 0; v < n; v += 1) {
        const start = offsets[v] ?? 0, end = offsets[v + 1] ?? start, degreeCount = end - start, o = v * 3;
        if (degreeCount === 0) { next[o] = current[o] ?? 0; next[o + 1] = current[o + 1] ?? 0; next[o + 2] = current[o + 2] ?? 0; continue; }
        let x = 0, y = 0, z = 0;
        for (let i = start; i < end; i += 1) { const p = (neighbors[i] ?? 0) * 3; x += current[p] ?? 0; y += current[p + 1] ?? 0; z += current[p + 2] ?? 0; }
        const px = current[o] ?? 0, py = current[o + 1] ?? 0, pz = current[o + 2] ?? 0;
        next[o] = px + factor * (x / degreeCount - px); next[o + 1] = py + factor * (y / degreeCount - py); next[o + 2] = pz + factor * (z / degreeCount - pz);
      }
      const swap = current; current = next; next = swap;
    };
    for (let i = 0; i < passes; i += 1) { step(lambdaValue); step(mu); }
    volumeCorrection(positions, current, indices);
    return current;
  } catch { return positions.slice(); }
}

function material(field: DensityField, index: number): VMaterial { return field.palette[index - 1] ?? DEFAULT_MATERIAL; }

function transfer(field: DensityField, x: number, y: number, z: number, blendWidth: number, ao: number,
  colors: Float32Array, paletteIndex: Uint8Array, vertex: number): void {
  const [nx, ny, nz] = field.sourceSize, plane = nx * ny, cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
  let best = Infinity, second = Infinity, firstIndex = 0, secondIndex = 0;
  for (let iz = Math.max(0, cz - 2); iz <= Math.min(nz - 1, cz + 2); iz += 1) for (let iy = Math.max(0, cy - 2); iy <= Math.min(ny - 1, cy + 2); iy += 1) for (let ix = Math.max(0, cx - 2); ix <= Math.min(nx - 1, cx + 2); ix += 1) {
    const value = field.sourceCells[ix + nx * iy + plane * iz] ?? 0;
    if (value === 0) continue;
    const dx = ix + 0.5 - x, dy = iy + 0.5 - y, dz = iz + 0.5 - z, distance = dx * dx + dy * dy + dz * dz;
    if (value === firstIndex) { if (distance < best) best = distance; }
    else if (distance < best) {
      if (value === secondIndex) { second = best; secondIndex = firstIndex; best = distance; firstIndex = value; }
      else { if (second < best) { second = best; secondIndex = firstIndex; } best = distance; firstIndex = value; }
    } else if (value === secondIndex) { if (distance < second) second = distance; }
    else if (distance < second) { second = distance; secondIndex = value; }
  }
  const a = material(field, firstIndex), b = material(field, secondIndex);
  const separation = Math.max(0, Math.sqrt(second) - Math.sqrt(best));
  const mix = blendWidth > 0 && secondIndex !== 0 && secondIndex !== firstIndex ? clamp((blendWidth - separation) / (2 * blendWidth), 0, 0.5) : 0;
  let density = 0, samples = 0;
  for (let oz = -1; oz <= 1; oz += 1) for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
    if (ox * ox + oy * oy + oz * oz > 2) continue;
    density += fieldAt(field, x + ox, y + oy, z + oz); samples += 1;
  }
  const light = 1 - ao * clamp((density / (samples || 1) - 0.44) * 2.2, 0, 1), out = vertex * 4;
  colors[out] = ((a.color[0] ?? 0.72) * (1 - mix) + (b.color[0] ?? 0.72) * mix) * light;
  colors[out + 1] = ((a.color[1] ?? 0.76) * (1 - mix) + (b.color[1] ?? 0.76) * mix) * light;
  colors[out + 2] = ((a.color[2] ?? 0.8) * (1 - mix) + (b.color[2] ?? 0.8) * mix) * light;
  colors[out + 3] = a.alpha * (1 - mix) + b.alpha * mix; paletteIndex[vertex] = firstIndex;
}

export function meshModel(input: VModel, options: MeshOptions = {}): Mesh {
  try {
    const field = buildField(input, options), mesh = surfaceNets(field, { iso: option(options, "iso", field.iso) });
    if (mesh.positions.length === 0) return mesh;
    const iterations = Math.floor(clamp(option(options, "smoothIterations", 1), 0, 20));
    const positions = iterations > 0 ? smoothMesh(mesh.positions, mesh.indices, iterations,
      option(options, "lambda", 0.45), option(options, "creaseAngle", 45)) : mesh.positions;
    const normals = normalsFromField(field, positions), count = positions.length / 3;
    const colors = new Float32Array(count * 4), paletteIndex = new Uint8Array(count);
    const blendWidth = clamp(option(options, "colorBlend", 0.2), 0, 1), ao = clamp(option(options, "ao", 0.35), 0, 1);
    for (let v = 0; v < count; v += 1) {
      const i = v * 3;
      transfer(field, (positions[i] ?? 0) + field.pivot[0], (positions[i + 1] ?? 0) + field.pivot[1],
        (positions[i + 2] ?? 0) + field.pivot[2], blendWidth, ao, colors, paletteIndex, v);
    }
    const triangles = mesh.indices.length / 3;
    return { positions, normals, colors, paletteIndex, indices: mesh.indices, triangleCount: triangles,
      stats: { vertices: count, triangles, ms: DETERMINISTIC_MS } };
  } catch { return emptyMesh(); }
}

function cloneMesh(input: unknown): Mesh {
  const raw = obj(input), p = raw.positions instanceof Float32Array ? raw.positions : new Float32Array(0);
  const n = raw.normals instanceof Float32Array ? raw.normals : new Float32Array(0);
  const c = raw.colors instanceof Float32Array ? raw.colors : new Float32Array(0);
  const pi = raw.paletteIndex instanceof Uint8Array ? raw.paletteIndex : new Uint8Array(0);
  const ix = raw.indices instanceof Uint32Array ? raw.indices : new Uint32Array(0), triangles = Math.floor(ix.length / 3);
  return { positions: p.slice(), normals: n.slice(), colors: c.slice(), paletteIndex: pi.slice(), indices: ix.slice(), triangleCount: triangles,
    stats: { vertices: Math.floor(p.length / 3), triangles, ms: DETERMINISTIC_MS } };
}

export function decimate(input: Mesh, targetInput: number): Mesh {
  const source = cloneMesh(input), n = source.positions.length / 3, target = Math.floor(num(targetInput, source.triangleCount));
  if (source.triangleCount === 0 || target >= source.triangleCount) return source;
  if (target <= 0 || n < 4) return emptyMesh();
  try {
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity, edgeSum = 0, edges = 0;
    for (let v = 0; v < n; v += 1) { const i = v * 3, x = source.positions[i] ?? 0, y = source.positions[i + 1] ?? 0, z = source.positions[i + 2] ?? 0;
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z); }
    for (let i = 0; i + 2 < source.indices.length; i += 3) {
      const a = source.indices[i] ?? n, b = source.indices[i + 1] ?? n, c = source.indices[i + 2] ?? n;
      for (let e = 0; e < 3; e += 1) {
        const u = e === 0 ? a : e === 1 ? b : c, v = e === 0 ? b : e === 1 ? c : a;
        if (u >= n || v >= n) continue;
        const p = u * 3, q = v * 3, dx = (source.positions[p] ?? 0) - (source.positions[q] ?? 0);
        const dy = (source.positions[p + 1] ?? 0) - (source.positions[q + 1] ?? 0), dz = (source.positions[p + 2] ?? 0) - (source.positions[q + 2] ?? 0);
        edgeSum += Math.hypot(dx, dy, dz); edges += 1;
      }
    }
    if (edges === 0) return source;
    const size = edgeSum / edges * Math.sqrt(n / Math.max(4, target / 2));
    if (!Number.isFinite(size) || size <= 1e-8) return source;
    const gxN = Math.max(2, Math.ceil((maxX - minX) / size) + 2), gyN = Math.max(2, Math.ceil((maxY - minY) / size) + 2);
    const gzN = Math.max(2, Math.ceil((maxZ - minZ) / size) + 2), stride = n + 1, records = new Float64Array(n);
    if (gxN * gyN * gzN * stride > Number.MAX_SAFE_INTEGER) return source;
    for (let v = 0; v < n; v += 1) {
      const i = v * 3, x = Math.floor(((source.positions[i] ?? 0) - minX) / size), y = Math.floor(((source.positions[i + 1] ?? 0) - minY) / size);
      const z = Math.floor(((source.positions[i + 2] ?? 0) - minZ) / size), key = (x * gyN + y) * gzN + z;
      records[v] = key * stride + v;
    }
    records.sort();
    const remap = new Uint32Array(n), posSum = new Float64Array(n * 3), normalSum = new Float64Array(n * 3), colorSum = new Float64Array(n * 4);
    const material = new Uint8Array(n), members = new Uint32Array(n), hasNormals = source.normals.length >= n * 3;
    const hasColors = source.colors.length >= n * 4, hasMaterials = source.paletteIndex.length >= n, limit = Math.cos(Math.PI / 4);
    let groups = 0, active = -1, groupStart = 0;
    for (let order = 0; order < n; order += 1) {
      const record = records[order] ?? 0, key = Math.floor(record / stride), vertex = record - key * stride;
      if (key !== active) { active = key; groupStart = groups; }
      const palette = hasMaterials ? source.paletteIndex[vertex] ?? 0 : 0, v3 = vertex * 3;
      const nx = hasNormals ? source.normals[v3] ?? 0 : 0, ny = hasNormals ? source.normals[v3 + 1] ?? 0 : 0, nz = hasNormals ? source.normals[v3 + 2] ?? 0 : 0;
      let group = -1;
      for (let g = groupStart; g < groups; g += 1) {
        const at = g * 3, length = Math.hypot(normalSum[at] ?? 0, normalSum[at + 1] ?? 0, normalSum[at + 2] ?? 0);
        const dot = nx * (normalSum[at] ?? 0) + ny * (normalSum[at + 1] ?? 0) + nz * (normalSum[at + 2] ?? 0);
        if ((material[g] ?? 0) === palette && (!hasNormals || length < 1e-8 || dot / length >= limit)) { group = g; break; }
      }
      if (group < 0) { group = groups++; material[group] = palette; }
      remap[vertex] = group; members[group] = (members[group] ?? 0) + 1;
      const g3 = group * 3;
      for (let k = 0; k < 3; k += 1) { posSum[g3 + k] = (posSum[g3 + k] ?? 0) + (source.positions[v3 + k] ?? 0); if (hasNormals) normalSum[g3 + k] = (normalSum[g3 + k] ?? 0) + (source.normals[v3 + k] ?? 0); }
      if (hasColors) for (let k = 0; k < 4; k += 1) colorSum[group * 4 + k] = (colorSum[group * 4 + k] ?? 0) + (source.colors[vertex * 4 + k] ?? 0);
    }
    if (groups >= n) return source;
    const positions = new Float32Array(groups * 3), normals = new Float32Array(groups * 3), colors = hasColors ? new Float32Array(groups * 4) : new Float32Array(0);
    const paletteIndex = hasMaterials ? material.slice(0, groups) : new Uint8Array(0);
    for (let g = 0; g < groups; g += 1) {
      const count = members[g] ?? 1, at = g * 3;
      for (let k = 0; k < 3; k += 1) positions[at + k] = (posSum[at + k] ?? 0) / count;
      let x = normalSum[at] ?? 0, y = normalSum[at + 1] ?? 0, z = normalSum[at + 2] ?? 0, length = Math.hypot(x, y, z);
      if (length > 1e-12) { x /= length; y /= length; z /= length; }
      normals[at] = x; normals[at + 1] = y; normals[at + 2] = z;
      if (hasColors) for (let k = 0; k < 4; k += 1) colors[g * 4 + k] = (colorSum[g * 4 + k] ?? 0) / count;
    }
    const indices = new Uint32Array(source.indices.length); let used = 0;
    for (let i = 0; i + 2 < source.indices.length; i += 3) {
      const a = remap[source.indices[i] ?? n] ?? groups, b = remap[source.indices[i + 1] ?? n] ?? groups, c = remap[source.indices[i + 2] ?? n] ?? groups;
      if (a >= groups || b >= groups || c >= groups || a === b || b === c || c === a) continue;
      indices[used] = a; indices[used + 1] = b; indices[used + 2] = c; used += 3;
    }
    if (used === 0) return source;
    const resultIndices = indices.slice(0, used), triangles = used / 3;
    return { positions, normals, colors, paletteIndex, indices: resultIndices, triangleCount: triangles,
      stats: { vertices: groups, triangles, ms: DETERMINISTIC_MS } };
  } catch { return source; }
}

export function compareBlocky(input: VModel): { blockyTriangles: number; smoothTriangles: number } {
  const model = readModel(input), [nx, ny, nz] = model.size;
  if (nx === 0 || ny === 0 || nz === 0) return { blockyTriangles: 0, smoothTriangles: 0 };
  const plane = nx * ny, solid = (x: number, y: number, z: number): boolean => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz
    && (model.cells[x + nx * y + plane * z] ?? 0) !== 0;
  let blockyTriangles = 0;
  for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) if (solid(x, y, z)) {
    if (!solid(x - 1, y, z)) blockyTriangles += 2; if (!solid(x + 1, y, z)) blockyTriangles += 2;
    if (!solid(x, y - 1, z)) blockyTriangles += 2; if (!solid(x, y + 1, z)) blockyTriangles += 2;
    if (!solid(x, y, z - 1)) blockyTriangles += 2; if (!solid(x, y, z + 1)) blockyTriangles += 2;
  }
  const field = buildField(input, { scale: 2, blur: 0.8, preserveThin: true });
  return { blockyTriangles, smoothTriangles: surfaceNets(field).triangleCount };
}

export function lodChain(model: VModel): [Mesh, Mesh, Mesh] {
  const near = meshModel(model, { scale: 4, blur: 0.8, preserveThin: true, smoothIterations: 1 });
  let mid = meshModel(model, { scale: 2, blur: 0.8, preserveThin: true, smoothIterations: 1 });
  let far = meshModel(model, { scale: 1, blur: 0.8, preserveThin: true, smoothIterations: 1 });
  if (near.triangleCount > 1 && mid.triangleCount >= near.triangleCount) mid = decimate(mid, near.triangleCount - 1);
  if (mid.triangleCount > 1 && far.triangleCount >= mid.triangleCount) far = decimate(far, mid.triangleCount - 1);
  return [near, mid, far];
}