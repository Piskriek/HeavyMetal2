/**
 * Clean drivable surfaces for Meshy pieces (ramps, bridges, decks, the half-pipe…).
 *
 * A generated mesh is too noisy to drive on: bolts, plank edges and railings make a marble chatter,
 * and a remesh only makes it coarser, not smoother. This builds the surface a ball actually rolls on
 * from the FULL model, seen from above:
 *   1. rasterize every upward-facing triangle into a top-down height grid (highest hit per cell);
 *   2. a median filter removes thin spikes (railings, posts, bolt heads) and fills pinholes;
 *   3. a smoothing pass evens the deck, never across an edge where the surface ends;
 *   4. write <id>.drive.glb: the grid as a plain triangle mesh (positions only), in the model's own
 *      space, so it lines up with every tier of the piece.
 *
 *   node scripts/drive-surface.mjs <in.glb> <out.drive.glb> [cellsAlongLongestSide=128]
 *
 * Prints coverage, the steepest step left between neighbouring cells, and the triangle count.
 * Walls, crates and caves do not need this: they keep their collision tier (they are bumped, not driven).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [input, output, cellsArg] = process.argv.slice(2);
if (!input || !output) { console.error('usage: drive-surface.mjs <in.glb> <out.drive.glb> [cells]'); process.exit(2); }
const CELLS = Number(cellsArg ?? 128);

// ── read the GLB (positions + indices of every primitive, node transforms applied) ──
const glb = readFileSync(input);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const bin = glb.subarray(20 + jsonLen + 8);
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readAccessor(index) {
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  const n = COMPONENTS[a.type];
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = view.byteStride ?? 0;
  const out = new Float64Array(a.count * n);
  const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
  const read = { 5126: (o) => bin.readFloatLE(o), 5125: (o) => bin.readUInt32LE(o), 5123: (o) => bin.readUInt16LE(o), 5121: (o) => bin.readUInt8(o) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = read(offset + i * (stride || n * size) + c * size);
  return out;
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (qy * qy + qz * qz)) * sx, 2 * (qx * qy + qz * qw) * sx, 2 * (qx * qz - qy * qw) * sx, 0,
    2 * (qx * qy - qz * qw) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, 2 * (qy * qz + qx * qw) * sy, 0,
    2 * (qx * qz + qy * qw) * sz, 2 * (qy * qz - qx * qw) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const tris = [];
(function walk(nodes, parent) {
  for (const ni of nodes ?? []) {
    const node = json.nodes[ni];
    const m = mul(parent, nodeMatrix(node));
    if (node.mesh != null) for (const prim of json.meshes[node.mesh].primitives) {
      const pos = readAccessor(prim.attributes.POSITION);
      const idx = prim.indices != null ? readAccessor(prim.indices) : Float64Array.from({ length: pos.length / 3 }, (_, i) => i);
      const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]].reduce((acc, v, c) => { for (let r = 0; r < 3; r++) acc[r] += m[c * 4 + r] * v; return acc; }, [m[12], m[13], m[14]]);
      for (let t = 0; t < idx.length; t += 3) tris.push([P(idx[t]), P(idx[t + 1]), P(idx[t + 2])]);
    }
    walk(node.children, m);
  }
})(json.scenes[json.scene ?? 0].nodes, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// ── 1. top-down rasterization of upward-facing triangles ──
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
for (const t of tris) for (const [x, y, z] of t) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); minY = Math.min(minY, y); }
const cell = Math.max(maxX - minX, maxZ - minZ) / CELLS;
const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
const H = new Float64Array(nx * nz).fill(NaN);
for (const [a, b, c] of tris) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const ny = uz * vx - ux * vz; // normal.y of (u × v) … sign by winding; use |n| to measure the slope
  const nxn = uy * vz - uz * vy, nzn = ux * vy - uy * vx;
  const len = Math.hypot(nxn, ny, nzn) || 1;
  if (Math.abs(ny) / len < 0.25) continue; // near-vertical: a wall, not a floor (the runtime marks walls)
  const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - minX) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - minX) / cell));
  const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - minZ) / cell)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - minZ) / cell));
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-12) continue;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = minX + i * cell, pz = minZ + j * cell;
    const w1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / det;
    const w2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / det;
    const w3 = 1 - w1 - w2;
    if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
    const y = w1 * a[1] + w2 * b[1] + w3 * c[1];
    const k = j * nx + i;
    if (!(H[k] >= y)) H[k] = y;
  }
}

// ── 2. median filter: thin spikes (railings, posts) and pinholes go ──
function filter(src, radius, fn) {
  const out = new Float64Array(src.length).fill(NaN);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const vals = [];
    for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const v = src[jj * nx + ii];
      if (!Number.isNaN(v)) vals.push(v);
    }
    out[j * nx + i] = fn(vals, src[j * nx + i]);
  }
  return out;
}
const window = (r) => (2 * r + 1) ** 2;
// A cell is kept when most of its neighbourhood is surface; its height is the neighbourhood median.
const med = filter(H, 2, (v) => (v.length >= window(2) * 0.55 ? v.sort((p, q) => p - q)[v.length >> 1] : NaN));
// ── 3. smoothing, only among surface cells (edges stay where the deck ends) ──
const smooth = filter(med, 2, (v, self) => (Number.isNaN(self) ? NaN : v.reduce((s, x) => s + x, 0) / v.length));

// ── 4. the grid as a mesh ──
const vIndex = new Int32Array(nx * nz).fill(-1);
const positions = [];
for (let k = 0; k < nx * nz; k++) if (!Number.isNaN(smooth[k])) { vIndex[k] = positions.length / 3; positions.push(minX + (k % nx) * cell, smooth[k], minZ + Math.floor(k / nx) * cell); }
const indices = [];
let steepest = 0;
for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
  const a = vIndex[j * nx + i], b = vIndex[j * nx + i + 1], c = vIndex[(j + 1) * nx + i], d = vIndex[(j + 1) * nx + i + 1];
  if (a < 0 || b < 0 || c < 0 || d < 0) continue;
  indices.push(a, c, b, b, c, d);
  for (const [p, q] of [[a, b], [a, c]]) steepest = Math.max(steepest, Math.abs(positions[p * 3 + 1] - positions[q * 3 + 1]) / cell);
}
const covered = positions.length / 3;
if (!indices.length) { console.error(`${input}: no drivable surface found`); process.exit(1); }

// Minimal GLB: one mesh, POSITION + indices (uint32), no material.
const posBuf = Buffer.from(new Float32Array(positions).buffer);
const idxBuf = Buffer.from(new Uint32Array(indices).buffer);
const mins = [0, 1, 2].map((c) => Math.min(...positions.filter((_, n) => n % 3 === c)));
const maxs = [0, 1, 2].map((c) => Math.max(...positions.filter((_, n) => n % 3 === c)));
const doc = {
  asset: { version: '2.0', generator: 'HM2 drive-surface' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'drive' }],
  meshes: [{ name: 'drive', primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
  buffers: [{ byteLength: posBuf.length + idxBuf.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 }, { buffer: 0, byteOffset: posBuf.length, byteLength: idxBuf.length, target: 34963 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: covered, type: 'VEC3', min: mins, max: maxs },
    { bufferView: 1, componentType: 5125, count: indices.length, type: 'SCALAR' },
  ],
};
let jsonBuf = Buffer.from(JSON.stringify(doc));
if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
const binBuf = Buffer.concat([posBuf, idxBuf]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonBuf.length + binBuf.length, 8);
const chunk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(binBuf.length, 0x004e4942), binBuf]));
console.log(`${output}: ${indices.length / 3} tris, ${(100 * covered / (nx * nz)).toFixed(0)}% of the footprint, steepest step ${(Math.atan(steepest) * 180 / Math.PI).toFixed(0)}°, ${(28 + jsonBuf.length + binBuf.length) / 1000 | 0} KB`);
