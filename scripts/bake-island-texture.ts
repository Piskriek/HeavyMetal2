/**
 * Bakes a texture from one model onto another model's UVs (what xNormal does for a "base texture" bake).
 *
 *   npx tsx scripts/bake-island-texture.ts <source.obj> <source-texture.png> <target.obj> <out.png> [size]
 *
 * Both models must sit in the same space (the owner's re-exports of Serpentine Isle do). For every texel
 * of the target's UV map: the point it covers on the target surface, the nearest point on the source
 * surface (preferring faces that point the same way), that point's source UV, and the source texture's
 * colour there. Texels outside the target's UV islands are filled from their neighbours afterwards
 * (edge padding), so mipmaps never bleed a background colour into the seams.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

interface Tris { pos: Float32Array; uv: Float32Array; normal: Float32Array; count: number }

function loadTris(file: string): Tris {
  const group = new OBJLoader().parse(readFileSync(file, 'utf8'));
  const pos: number[] = []; const uv: number[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = g.getAttribute('position'); const t = g.getAttribute('uv');
    if (!t) throw new Error(`${file}: a mesh has no UVs`);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(t.getX(i), t.getY(i)); }
  });
  const count = pos.length / 9;
  const normal = new Float32Array(count * 3);
  for (let f = 0; f < count; f++) {
    const o = f * 9;
    const ax = pos[o + 3] - pos[o], ay = pos[o + 4] - pos[o + 1], az = pos[o + 5] - pos[o + 2];
    const bx = pos[o + 6] - pos[o], by = pos[o + 7] - pos[o + 1], bz = pos[o + 8] - pos[o + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    normal[f * 3] = nx; normal[f * 3 + 1] = ny; normal[f * 3 + 2] = nz;
  }
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), normal, count };
}

/** A uniform grid of the source triangles' bounding boxes. */
class Grid {
  readonly cells = new Map<number, number[]>();
  constructor(readonly t: Tris, readonly min: THREE.Vector3, readonly cell: number, readonly n: [number, number, number]) {
    for (let f = 0; f < t.count; f++) {
      const [x0, y0, z0, x1, y1, z1] = this.box(f, 0);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = this.key(x, y, z);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, list = []);
        list.push(f);
      }
    }
  }
  key(x: number, y: number, z: number) { return (x * this.n[1] + y) * this.n[2] + z; }
  idx(v: number, axis: 0 | 1 | 2) { return Math.max(0, Math.min(this.n[axis] - 1, Math.floor((v - this.min.getComponent(axis)) / this.cell))); }
  box(f: number, margin: number): number[] {
    const p = this.t.pos; const o = f * 9;
    const lo = [0, 1, 2].map((a) => Math.min(p[o + a], p[o + 3 + a], p[o + 6 + a]) - margin);
    const hi = [0, 1, 2].map((a) => Math.max(p[o + a], p[o + 3 + a], p[o + 6 + a]) + margin);
    return [this.idx(lo[0], 0), this.idx(lo[1], 1), this.idx(lo[2], 2), this.idx(hi[0], 0), this.idx(hi[1], 1), this.idx(hi[2], 2)];
  }
  /** Source triangles whose cells overlap a box. */
  near(lo: number[], hi: number[]): number[] {
    const out = new Set<number>();
    const [x0, y0, z0] = [this.idx(lo[0], 0), this.idx(lo[1], 1), this.idx(lo[2], 2)];
    const [x1, y1, z1] = [this.idx(hi[0], 0), this.idx(hi[1], 1), this.idx(hi[2], 2)];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const list = this.cells.get(this.key(x, y, z));
      if (list) for (const f of list) out.add(f);
    }
    return [...out];
  }
}

/** Closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5): returns squared distance and barycentrics. */
function closest(p: Float32Array, o: number, px: number, py: number, pz: number, out: number[]): number {
  const ax = p[o], ay = p[o + 1], az = p[o + 2];
  const abx = p[o + 3] - ax, aby = p[o + 4] - ay, abz = p[o + 5] - az;
  const acx = p[o + 6] - ax, acy = p[o + 7] - ay, acz = p[o + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u: number, v: number, w: number;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
    const bpx = px - p[o + 3], bpy = py - p[o + 4], bpz = pz - p[o + 5];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); u = 1 - t; v = t; w = 0; } else {
        const cpx = px - p[o + 6], cpy = py - p[o + 7], cpz = pz - p[o + 8];
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); u = 1 - t; v = 0; w = t; } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - t; w = t; } else {
              const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  const qx = ax + abx * v + acx * w, qy = ay + aby * v + acy * w, qz = az + abz * v + acz * w;
  out[0] = u; out[1] = v; out[2] = w;
  return (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
}

const [srcObj, srcTex, dstObj, outPng, sizeArg] = process.argv.slice(2);
if (!outPng) { console.log('usage: bake-island-texture.ts <source.obj> <source-texture.png> <target.obj> <out.png> [size]'); process.exit(1); }
const SIZE = Number(sizeArg ?? 8192);

console.time('bake');
const src = loadTris(srcObj); const dst = loadTris(dstObj);
console.log(`source ${src.count} triangles, target ${dst.count} triangles`);
const box = new THREE.Box3();
for (let i = 0; i < src.pos.length; i += 3) box.expandByPoint(new THREE.Vector3(src.pos[i], src.pos[i + 1], src.pos[i + 2]));
const extent = box.getSize(new THREE.Vector3());
const CELL = Math.max(extent.x, extent.y, extent.z) / 160;
const grid = new Grid(src, box.min, CELL, [0, 1, 2].map((a) => Math.max(1, Math.ceil(extent.getComponent(a) / CELL) + 1)) as [number, number, number]);
console.log(`grid ${grid.n.join('x')}, ${grid.cells.size} cells used`);

const tex = decodePng(srcTex);
const ch = tex.data.length / (tex.w * tex.h);
console.log(`source texture ${tex.w}x${tex.h}, ${ch} channels`);
const sample = (u: number, v: number, out: number[]) => {
  // three.js flips textures: v = 0 is the bottom row of the image.
  const x = u * tex.w - 0.5, y = (1 - v) * tex.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 3; c++) out[c] = 0;
  for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
    const px = Math.min(tex.w - 1, Math.max(0, x0 + dx)), py = Math.min(tex.h - 1, Math.max(0, y0 + dy));
    const i = (py * tex.w + px) * ch;
    for (let c = 0; c < 3; c++) out[c] += tex.data[i + c] * wgt;
  }
};

const out = Buffer.alloc(SIZE * SIZE * 4);
const filled = new Uint8Array(SIZE * SIZE);
const bary = [0, 0, 0]; const best = [0, 0, 0]; const rgb = [0, 0, 0];
let texels = 0, far = 0;
for (let f = 0; f < dst.count; f++) {
  const o = f * 9, t = f * 6;
  const P = dst.pos, U = dst.uv;
  const nx = dst.normal[f * 3], ny = dst.normal[f * 3 + 1], nz = dst.normal[f * 3 + 2];
  // Candidate source faces: around this target face, widened until something is found.
  let cands: number[] = [];
  for (let margin = CELL; margin <= CELL * 16 && !cands.length; margin *= 2) {
    const lo = [0, 1, 2].map((a) => Math.min(P[o + a], P[o + 3 + a], P[o + 6 + a]) - margin);
    const hi = [0, 1, 2].map((a) => Math.max(P[o + a], P[o + 3 + a], P[o + 6 + a]) + margin);
    cands = grid.near(lo, hi);
  }
  if (!cands.length) continue;
  const u0 = U[t] * SIZE, v0 = (1 - U[t + 1]) * SIZE;
  const u1 = U[t + 2] * SIZE, v1 = (1 - U[t + 3]) * SIZE;
  const u2 = U[t + 4] * SIZE, v2 = (1 - U[t + 5]) * SIZE;
  const den = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
  if (Math.abs(den) < 1e-12) continue;
  const xa = Math.max(0, Math.floor(Math.min(u0, u1, u2))), xb = Math.min(SIZE - 1, Math.ceil(Math.max(u0, u1, u2)));
  const ya = Math.max(0, Math.floor(Math.min(v0, v1, v2))), yb = Math.min(SIZE - 1, Math.ceil(Math.max(v0, v1, v2)));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5, py = y + 0.5;
    const a = ((v1 - v2) * (px - u2) + (u2 - u1) * (py - v2)) / den;
    const b = ((v2 - v0) * (px - u2) + (u0 - u2) * (py - v2)) / den;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    const qx = P[o] * a + P[o + 3] * b + P[o + 6] * c;
    const qy = P[o + 1] * a + P[o + 4] * b + P[o + 7] * c;
    const qz = P[o + 2] * a + P[o + 5] * b + P[o + 8] * c;
    let bestScore = Infinity, bestFace = -1;
    for (const s of cands) {
      const d = closest(src.pos, s * 9, qx, qy, qz, bary);
      // A face turned away (the other side of a thin ridge) only wins when nothing else is near.
      const facing = src.normal[s * 3] * nx + src.normal[s * 3 + 1] * ny + src.normal[s * 3 + 2] * nz;
      const score = facing < 0.2 ? d + CELL * CELL * 4 : d;
      if (score < bestScore) { bestScore = score; bestFace = s; best[0] = bary[0]; best[1] = bary[1]; best[2] = bary[2]; }
    }
    if (bestFace < 0) continue;
    if (bestScore > CELL * CELL) far++;
    const so = bestFace * 6, S = src.uv;
    const su = S[so] * best[0] + S[so + 2] * best[1] + S[so + 4] * best[2];
    const sv = S[so + 1] * best[0] + S[so + 3] * best[1] + S[so + 5] * best[2];
    sample(su, sv, rgb);
    const i = y * SIZE + x;
    out[i * 4] = Math.round(rgb[0]); out[i * 4 + 1] = Math.round(rgb[1]); out[i * 4 + 2] = Math.round(rgb[2]); out[i * 4 + 3] = 255;
    if (!filled[i]) { filled[i] = 1; texels++; }
  }
  if (f % 2000 === 0) console.log(`  ${f} / ${dst.count} faces, ${texels} texels`);
}
console.log(`${texels} texels baked (${(texels / SIZE / SIZE * 100).toFixed(1)}% of the map), ${far} matched from more than one grid cell away`);

// Edge padding: grow every island outward so filtering never reaches an empty texel.
const PAD = Math.max(4, Math.round(SIZE / 256));
for (let pass = 0; pass < PAD; pass++) {
  const grow: number[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x;
    if (filled[i]) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
      const j = yy * SIZE + xx;
      if (filled[j] !== 1) continue;
      r += out[j * 4]; g += out[j * 4 + 1]; b += out[j * 4 + 2]; n++;
    }
    if (n) { out[i * 4] = r / n; out[i * 4 + 1] = g / n; out[i * 4 + 2] = b / n; out[i * 4 + 3] = 255; grow.push(i); }
  }
  for (const i of grow) filled[i] = 1;
  if (!grow.length) break;
}
// Whatever is still empty: the average colour (never black), fully opaque.
for (let i = 0; i < SIZE * SIZE; i++) if (!out[i * 4 + 3]) { out[i * 4] = 110; out[i * 4 + 1] = 100; out[i * 4 + 2] = 88; out[i * 4 + 3] = 255; }
encodePng(outPng, SIZE, SIZE, out);
console.timeEnd('bake');
console.log(`→ ${outPng}`);
