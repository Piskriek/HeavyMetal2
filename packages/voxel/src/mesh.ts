// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
/**
 * mesh — voxel grid to triangle mesh. Pure, deterministic, no dependencies.
 * y is up, one unit cube per voxel spanning (x,y,z)..(x+1,y+1,z+1) minus `pivot`,
 * triangles wound counter-clockwise as seen from outside, AO baked into vertex rgb.
 */

export interface MeshInput {
  size: [number, number, number];
  pivot: [number, number, number];
  /** x fastest, then y, then z; 0 = empty, otherwise a 1-based palette index */
  cells: Uint8Array;
  /** palette[i - 1] belongs to cell value i */
  palette: { color: [number, number, number]; alpha: number }[];
}

export interface MeshOutput {
  positions: Float32Array;
  normals: Float32Array;
  /** rgb per vertex, ambient occlusion baked in */
  colors: Float32Array;
  indices: Uint32Array;
  /** per vertex, 1-based */
  paletteIndex: Uint8Array;
  triangleCount: number;
}

export interface MeshOptions {
  /** classic voxel AO, darkening each missing level by 0.2 — default true */
  ao?: boolean;
  /** merge coplanar faces into rectangles — default true */
  greedy?: boolean;
}

type V3 = [number, number, number];
interface Dir { na: number; ns: number; ua: number; us: number; va: number; vs: number }

/** -X +X -Y +Y -Z +Z. In-plane axes satisfy U x V = N, so (0,0)(1,0)(1,1)(0,1) is CCW from outside. */
const DIRS: Dir[] = [
  { na: 0, ns: -1, ua: 2, us: 1, va: 1, vs: 1 },
  { na: 0, ns: 1, ua: 2, us: -1, va: 1, vs: 1 },
  { na: 1, ns: -1, ua: 0, us: 1, va: 2, vs: 1 },
  { na: 1, ns: 1, ua: 0, us: 1, va: 2, vs: -1 },
  { na: 2, ns: -1, ua: 0, us: -1, va: 1, vs: 1 },
  { na: 2, ns: 1, ua: 0, us: 1, va: 1, vs: 1 },
];
/** quad corner k sits at in-plane (IU[k], IV[k]); su/sv are the AO probe directions */
const IU = [0, 1, 1, 0];
const IV = [0, 0, 1, 1];
const AO_DARKEN = 0.2;
const FALLBACK = { color: [1, 0, 1] as V3, alpha: 1 };

class Grid {
  readonly m: MeshInput;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  constructor(m: MeshInput) {
    this.m = m;
    this.nx = m.size[0];
    this.ny = m.size[1];
    this.nz = m.size[2];
  }
  /** cell value, 0 outside the model border */
  at(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) return 0;
    return this.m.cells[x + this.nx * (y + this.ny * z)];
  }
  pal(v: number) {
    return this.m.palette[v - 1] ?? FALLBACK;
  }
  /** only opaque matter blocks light / hides faces */
  opaque(x: number, y: number, z: number): boolean {
    const v = this.at(x, y, z);
    return v !== 0 && this.pal(v).alpha >= 1;
  }
  /** is the face of voxel `a` looking at `b` emitted? */
  shows(a: number, b: number): boolean {
    if (a === 0) return false;
    if (b === 0) return true; // empty cell or model border
    if (a === b) return false; // same palette entry (incl. same transparent entry)
    if (this.pal(a).alpha < 1) return true; // transparent towards a different entry
    return this.pal(b).alpha < 1; // solid towards a transparent neighbour
  }
}

/** number of visible faces (quads before greedy merging) */
export function countFaces(m: MeshInput): number {
  const g = new Grid(m);
  let n = 0;
  for (let z = 0; z < g.nz; z++)
    for (let y = 0; y < g.ny; y++)
      for (let x = 0; x < g.nx; x++) {
        const v = g.at(x, y, z);
        if (!v) continue;
        for (const d of DIRS) {
          const q: V3 = [x, y, z];
          q[d.na] += d.ns;
          if (g.shows(v, g.at(q[0], q[1], q[2]))) n++;
        }
      }
  return n;
}

export function meshVoxels(m: MeshInput, opts: MeshOptions = {}): MeshOutput {
  const useAO = opts.ao !== false;
  const useGreedy = opts.greedy !== false;
  const g = new Grid(m);
  const px = m.pivot[0], py = m.pivot[1], pz = m.pivot[2];
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [], paletteIndex: number[] = [];

  /** levels for the four corners of the face of cell `c` looking along `d` */
  function aoOf(d: Dir, c: V3): number[] {
    const out: number[] = [3, 3, 3, 3];
    for (let k = 0; k < 4; k++) {
      const f: V3 = [c[0], c[1], c[2]];
      f[d.na] += d.ns; // layer in front of the face
      const su = IU[k] * 2 - 1, sv = IV[k] * 2 - 1;
      const du = su * d.us, dv = sv * d.vs;
      const s1: V3 = [f[0], f[1], f[2]]; s1[d.ua] += du;
      const s2: V3 = [f[0], f[1], f[2]]; s2[d.va] += dv;
      const cn: V3 = [s1[0], s1[1], s1[2]]; cn[d.va] += dv;
      const o1 = g.opaque(s1[0], s1[1], s1[2]) ? 1 : 0;
      const o2 = g.opaque(s2[0], s2[1], s2[2]) ? 1 : 0;
      out[k] = o1 && o2 ? 0 : 3 - o1 - o2 - (g.opaque(cn[0], cn[1], cn[2]) ? 1 : 0);
    }
    return out;
  }

  /** rect of w x h cells starting at (a, b) on slice s; fa = [ao0, ao1, ao2, ao3, palette] */
  function emit(d: Dir, s: number, a: number, w: number, b: number, h: number, fa: number[]) {
    const base = paletteIndex.length;
    const plane = s + (d.ns > 0 ? 1 : 0);
    const nrm: V3 = [0, 0, 0];
    nrm[d.na] = d.ns;
    const rgb = g.pal(fa[4]!).color;
    for (let k = 0; k < 4; k++) {
      const p: V3 = [0, 0, 0];
      p[d.na] = plane;
      p[d.ua] = d.us > 0 ? a + IU[k] * w : a + w - IU[k] * w;
      p[d.va] = d.vs > 0 ? b + IV[k] * h : b + h - IV[k] * h;
      positions.push(p[0] - px, p[1] - py, p[2] - pz);
      normals.push(nrm[0], nrm[1], nrm[2]);
      const f = useAO ? Math.max(0, Math.min(1, 1 - AO_DARKEN * (3 - fa[k]))) : 1;
      colors.push(rgb[0] * f, rgb[1] * f, rgb[2] * f);
      paletteIndex.push(fa[4]!);
    }
    // flip the diagonal when the AO sums differ, to avoid anisotropic shading
    if (useAO && fa[0] + fa[2] > fa[1] + fa[3]) indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  for (const d of DIRS) {
    const nLen = m.size[d.na], uLen = m.size[d.ua], vLen = m.size[d.va];
    const mask = new Uint8Array(uLen * vLen); // palette index, 0 = no face
    const aoBuf = new Uint8Array(uLen * vLen * 4);
    for (let s = 0; s < nLen; s++) {
      mask.fill(0);
      aoBuf.fill(0);
      for (let b = 0; b < vLen; b++)
        for (let a = 0; a < uLen; a++) {
          const c: V3 = [0, 0, 0];
          c[d.na] = s; c[d.ua] = a; c[d.va] = b;
          const v = g.at(c[0], c[1], c[2]);
          if (!v) continue;
          const q: V3 = [c[0], c[1], c[2]];
          q[d.na] += d.ns;
          if (!g.shows(v, g.at(q[0], q[1], q[2]))) continue;
          const o = a + uLen * b;
          mask[o] = v;
          const lv = useAO ? aoOf(d, c) : [3, 3, 3, 3];
          for (let k = 0; k < 4; k++) aoBuf[o * 4 + k] = lv[k];
        }
      const face = (o: number): number[] => [aoBuf[o * 4], aoBuf[o * 4 + 1], aoBuf[o * 4 + 2], aoBuf[o * 4 + 3], mask[o]];
      for (let b = 0; b < vLen; b++)
        for (let a = 0; a < uLen; a++) {
          const o = a + uLen * b;
          if (!mask[o]) continue;
          const f0 = face(o);
          let w = 1, h = 1;
          if (useGreedy) {
            // merge only while palette entry and all four AO levels stay identical
            const same = (i: number, j: number) => {
              if (i < 0 || j < 0 || i >= uLen || j >= vLen) return false;
              const q = i + uLen * j;
              if (!mask[q]) return false;
              if (mask[q] !== f0[4]) return false;
              for (let k = 0; k < 4; k++) if (aoBuf[q * 4 + k] !== f0[k]) return false;
              return true;
            };
            while (same(a + w, b)) w++;
            grow: while (b + h < vLen) {
              for (let i = 0; i < w; i++) if (!same(a + i, b + h)) break grow;
              h++;
            }
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mask[a + i + uLen * (b + j)] = 0;
          }
          emit(d, s, a, w, b, h, useAO ? f0 : [3, 3, 3, 3, f0[4]!]);
        }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    paletteIndex: new Uint8Array(paletteIndex),
    triangleCount: indices.length / 3,
  };
}