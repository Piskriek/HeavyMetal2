/**
 * Parametric voxel building blocks for a toy-building game.
 * Pure TypeScript: no imports, no DOM, no Date, no randomness.
 */

export interface Voxels {
  /** cells along x, y, z (y is up) */
  size: [number, number, number];
  /** index = x + y*sx + z*sx*sy; 0 = empty, otherwise a material number 1..255 */
  cells: Uint8Array;
}

/* ------------------------------------------------------------------ */
/* small internal helpers                                              */
/* ------------------------------------------------------------------ */

function dim(n: number, what: string): number {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${what} must be a whole number of cells >= 1, got ${String(n)}`);
  }
  return n;
}

function matOf(mat: number | undefined): number {
  const v = mat ?? 1;
  if (!Number.isInteger(v) || v < 1 || v > 255) {
    throw new RangeError(`material must be a whole number 1..255, got ${String(v)}`);
  }
  return v;
}

function index(sx: number, sy: number, x: number, y: number, z: number): number {
  return x + y * sx + z * sx * sy;
}

/** scale -> a whole number >= 1 (1 = a 4-cell-wide toy brick) */
function unit(scale: number): number {
  if (!Number.isFinite(scale)) throw new RangeError(`scale must be finite, got ${String(scale)}`);
  const s = Math.round(scale);
  return s < 1 ? 1 : s;
}

/* ------------------------------------------------------------------ */
/* core model                                                          */
/* ------------------------------------------------------------------ */

export function emptyModel(sx: number, sy: number, sz: number): Voxels {
  const x = dim(sx, 'sx');
  const y = dim(sy, 'sy');
  const z = dim(sz, 'sz');
  return { size: [x, y, z], cells: new Uint8Array(x * y * z) };
}

export function get(m: Voxels, x: number, y: number, z: number): number {
  const sx = m.size[0];
  const sy = m.size[1];
  const sz = m.size[2];
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return 0;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
  return m.cells[index(sx, sy, x, y, z)] ?? 0;
}

export function set(m: Voxels, x: number, y: number, z: number, v: number): void {
  const sx = m.size[0];
  const sy = m.size[1];
  const sz = m.size[2];
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
  m.cells[index(sx, sy, x, y, z)] = v & 0xff;
}

export function countFilled(m: Voxels): number {
  let n = 0;
  for (let i = 0; i < m.cells.length; i++) if ((m.cells[i] ?? 0) !== 0) n++;
  return n;
}

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

export function cube(w: number, h: number, d: number, mat?: number): Voxels {
  const m = emptyModel(w, h, d);
  m.cells.fill(matOf(mat));
  return m;
}

/** Diameter 2r cells each way; filled when the cell centre (i + 0.5) is within r of (r, r, r). */
export function ball(r: number, mat?: number): Voxels {
  const rr = dim(r, 'r');
  const v = matOf(mat);
  const n = 2 * rr;
  const m = emptyModel(n, n, n);
  const r2 = rr * rr;
  for (let z = 0; z < n; z++) {
    const dz = z + 0.5 - rr;
    for (let y = 0; y < n; y++) {
      const dy = y + 0.5 - rr;
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - rr;
        if (dx * dx + dy * dy + dz * dz <= r2) set(m, x, y, z, v);
      }
    }
  }
  return m;
}

/** 2r by h by 2r; filled when the cell centre is within r of the vertical axis through (r, *, r). */
export function cylinder(r: number, h: number, mat?: number): Voxels {
  const rr = dim(r, 'r');
  const hh = dim(h, 'h');
  const v = matOf(mat);
  const n = 2 * rr;
  const m = emptyModel(n, hh, n);
  const r2 = rr * rr;
  for (let z = 0; z < n; z++) {
    const dz = z + 0.5 - rr;
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - rr;
      if (dx * dx + dz * dz > r2) continue;
      for (let y = 0; y < hh; y++) set(m, x, y, z, v);
    }
  }
  return m;
}

/** A ramp rising along +x: column x is filled up to height round(h * (x + 1) / w), the whole depth d. */
export function wedge(w: number, h: number, d: number, mat?: number): Voxels {
  const ww = dim(w, 'w');
  const hh = dim(h, 'h');
  const dd = dim(d, 'd');
  const v = matOf(mat);
  const m = emptyModel(ww, hh, dd);
  for (let x = 0; x < ww; x++) {
    const top = Math.round((hh * (x + 1)) / ww);
    for (let y = 0; y < top; y++) for (let z = 0; z < dd; z++) set(m, x, y, z, v);
  }
  return m;
}

/** `steps` equal steps along +x: column x rises to round(h * (floor(x * steps / w) + 1) / steps). */
export function stairs(w: number, h: number, d: number, steps: number, mat?: number): Voxels {
  const ww = dim(w, 'w');
  const hh = dim(h, 'h');
  const dd = dim(d, 'd');
  const st = dim(steps, 'steps');
  const v = matOf(mat);
  const m = emptyModel(ww, hh, dd);
  for (let x = 0; x < ww; x++) {
    const step = Math.floor((x * st) / ww);
    const top = Math.round((hh * (step + 1)) / st);
    for (let y = 0; y < top && y < hh; y++) for (let z = 0; z < dd; z++) set(m, x, y, z, v);
  }
  return m;
}

/** A box with walls `wall` cells thick on all six sides and an empty inside. */
export function hollowBox(w: number, h: number, d: number, wall: number, mat?: number): Voxels {
  const ww = dim(w, 'w');
  const hh = dim(h, 'h');
  const dd = dim(d, 'd');
  const t = dim(wall, 'wall');
  const v = matOf(mat);
  const m = emptyModel(ww, hh, dd);
  for (let z = 0; z < dd; z++) {
    const inZ = z >= t && z < dd - t;
    for (let y = 0; y < hh; y++) {
      const inY = y >= t && y < hh - t;
      for (let x = 0; x < ww; x++) {
        const inX = x >= t && x < ww - t;
        if (inX && inY && inZ) continue;
        set(m, x, y, z, v);
      }
    }
  }
  return m;
}

/** A w by h by d block whose cells with x in [wall, w - wall) and y < h - wall are empty. */
export function arch(w: number, h: number, d: number, wall: number, mat?: number): Voxels {
  const ww = dim(w, 'w');
  const hh = dim(h, 'h');
  const dd = dim(d, 'd');
  const t = dim(wall, 'wall');
  const v = matOf(mat);
  const m = emptyModel(ww, hh, dd);
  for (let z = 0; z < dd; z++) {
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < ww; x++) {
        const hole = x >= t && x < ww - t && y < hh - t;
        if (!hole) set(m, x, y, z, v);
      }
    }
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* edit helpers                                                        */
/* ------------------------------------------------------------------ */

/** A copy turned a quarter round the y axis: (x, z) -> (sz - 1 - z, x); size becomes [sz, sy, sx]. */
export function rotateY90(m: Voxels): Voxels {
  const sx = m.size[0];
  const sy = m.size[1];
  const sz = m.size[2];
  const out = emptyModel(sz, sy, sx);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const v = get(m, x, y, z);
        if (v !== 0) set(out, sz - 1 - z, y, x, v);
      }
    }
  }
  return out;
}

/** A copy mirrored along x. */
export function mirrorX(m: Voxels): Voxels {
  const sx = m.size[0];
  const sy = m.size[1];
  const sz = m.size[2];
  const out = emptyModel(sx, sy, sz);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const v = get(m, x, y, z);
        if (v !== 0) set(out, sx - 1 - x, y, z, v);
      }
    }
  }
  return out;
}

/** Paint every filled cell of `b` into `a` at offset (ox, oy, oz); cells outside `a` are dropped. */
export function stamp(a: Voxels, b: Voxels, ox: number, oy: number, oz: number): Voxels {
  const sx = b.size[0];
  const sy = b.size[1];
  const sz = b.size[2];
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const v = get(b, x, y, z);
        if (v !== 0) set(a, ox + x, oy + y, oz + z, v);
      }
    }
  }
  return a;
}

/** The smallest box holding every filled cell, inclusive, or null when the model is empty. */
export function bounds(m: Voxels): [number, number, number, number, number, number] | null {
  const sx = m.size[0];
  const sy = m.size[1];
  const sz = m.size[2];
  let minX = sx;
  let minY = sy;
  let minZ = sz;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        if ((m.cells[index(sx, sy, x, y, z)] ?? 0) === 0) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
  }
  if (maxX < 0) return null;
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/* ------------------------------------------------------------------ */
/* palette                                                             */
/* ------------------------------------------------------------------ */

export interface BlockDef {
  id: string;
  name: string;
  make: (scale: number) => Voxels;
}

export const BLOCKS: readonly BlockDef[] = [
  { id: 'cube', name: 'Cube', make: (s) => { const u = unit(s); return cube(4 * u, 4 * u, 4 * u, 1); } },
  { id: 'ball', name: 'Ball', make: (s) => ball(2 * unit(s), 2) },
  { id: 'cylinder', name: 'Cylinder', make: (s) => { const u = unit(s); return cylinder(2 * u, 4 * u, 3); } },
  { id: 'wedge', name: 'Wedge', make: (s) => { const u = unit(s); return wedge(4 * u, 4 * u, 4 * u, 4); } },
  { id: 'stairs', name: 'Stairs', make: (s) => { const u = unit(s); return stairs(4 * u, 4 * u, 4 * u, 4, 5); } },
  { id: 'hollow-box', name: 'Hollow box', make: (s) => { const u = unit(s); return hollowBox(4 * u, 4 * u, 4 * u, u, 6); } },
  { id: 'arch', name: 'Arch', make: (s) => { const u = unit(s); return arch(4 * u, 4 * u, 2 * u, u, 7); } },
  { id: 'plank', name: 'Plank', make: (s) => { const u = unit(s); return cube(8 * u, u, 2 * u, 8); } },
  { id: 'pillar', name: 'Pillar', make: (s) => { const u = unit(s); return cylinder(u, 8 * u, 9); } },
];