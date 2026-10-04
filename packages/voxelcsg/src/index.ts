export interface Voxels {
  size: [number, number, number]; // cells along x, y, z (y is up)
  cells: Uint8Array;              // index = x + y*sx + z*sx*sy; 0 = empty
}
export type Vec3i = [number, number, number];
export type Axis = 'x' | 'y' | 'z';

const index = (m: Voxels, x: number, y: number, z: number): number =>
  x + y * m.size[0] + z * m.size[0] * m.size[1];

const inBounds = (m: Voxels, x: number, y: number, z: number): boolean =>
  x >= 0 && y >= 0 && z >= 0 && x < m.size[0] && y < m.size[1] && z < m.size[2];

const clone = (m: Voxels): Voxels => ({
  size: [m.size[0], m.size[1], m.size[2]],
  cells: new Uint8Array(m.cells),
});

export function emptyModel(sx: number, sy: number, sz: number): Voxels {
  return { size: [sx, sy, sz], cells: new Uint8Array(sx * sy * sz) };
}

export function get(m: Voxels, x: number, y: number, z: number): number {
  if (!inBounds(m, x, y, z)) return 0;
  return m.cells[index(m, x, y, z)] ?? 0;
}

export function set(m: Voxels, x: number, y: number, z: number, v: number): void {
  if (!inBounds(m, x, y, z)) return;
  m.cells[index(m, x, y, z)] = v;
}

export function countFilled(m: Voxels): number {
  let n = 0;
  for (let i = 0; i < m.cells.length; i++) if ((m.cells[i] ?? 0) !== 0) n++;
  return n;
}

function forEachFilled(b: Voxels, fn: (x: number, y: number, z: number, v: number) => void): void {
  const [sx, sy, sz] = b.size;
  let i = 0;
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++, i++) {
        const v = b.cells[i] ?? 0;
        if (v !== 0) fn(x, y, z, v);
      }
}

export function union(a: Voxels, b: Voxels, offset: Vec3i): Voxels {
  const out = clone(a);
  forEachFilled(b, (x, y, z, v) => set(out, x + offset[0], y + offset[1], z + offset[2], v));
  return out;
}

export function subtract(a: Voxels, b: Voxels, offset: Vec3i): Voxels {
  const out = clone(a);
  forEachFilled(b, (x, y, z) => set(out, x + offset[0], y + offset[1], z + offset[2], 0));
  return out;
}

export function intersect(a: Voxels, b: Voxels, offset: Vec3i): Voxels {
  const out = emptyModel(a.size[0], a.size[1], a.size[2]);
  forEachFilled(b, (x, y, z) => {
    const ax = x + offset[0], ay = y + offset[1], az = z + offset[2];
    const v = get(a, ax, ay, az);
    if (v !== 0) set(out, ax, ay, az, v);
  });
  return out;
}

export function split(m: Voxels, axis: Axis, at: number): [Voxels, Voxels] {
  const lo = emptyModel(m.size[0], m.size[1], m.size[2]);
  const hi = emptyModel(m.size[0], m.size[1], m.size[2]);
  forEachFilled(m, (x, y, z, v) => {
    const c = axis === 'x' ? x : axis === 'y' ? y : z;
    set(c < at ? lo : hi, x, y, z, v);
  });
  return [lo, hi];
}

export function crop(m: Voxels): { model: Voxels; offset: Vec3i } | null {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  forEachFilled(m, (x, y, z) => {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  });
  if (x0 === Infinity) return null;
  const model = emptyModel(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
  forEachFilled(m, (x, y, z, v) => set(model, x - x0, y - y0, z - z0, v));
  return { model, offset: [x0, y0, z0] };
}

export function hollow(m: Voxels, wall: number): Voxels {
  const [sx, sy, sz] = m.size;
  const n = m.cells.length;
  const out = emptyModel(sx, sy, sz);
  if (n === 0) return out;
  const dist = new Int32Array(n).fill(2147483647);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  // Seed: empty cells are distance 0; filled cells touching the box faces are 1 step from outside.
  let i = 0;
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++, i++) {
        if ((m.cells[i] ?? 0) === 0) {
          dist[i] = 0;
          queue[tail++] = i;
        } else if (x === 0 || y === 0 || z === 0 || x === sx - 1 || y === sy - 1 || z === sz - 1) {
          dist[i] = 1;
          queue[tail++] = i;
        }
      }
  const relax = (j: number, d: number): void => {
    if (d < (dist[j] ?? 0)) {
      dist[j] = d;
      queue[tail++] = j;
    }
  };
  while (head < tail) {
    const cur = queue[head++] ?? 0;
    const d = (dist[cur] ?? 0) + 1;
    const x = cur % sx;
    const y = ((cur - x) / sx) % sy;
    const z = (cur - x - y * sx) / (sx * sy);
    if (x > 0) relax(cur - 1, d);
    if (x < sx - 1) relax(cur + 1, d);
    if (y > 0) relax(cur - sx, d);
    if (y < sy - 1) relax(cur + sx, d);
    if (z > 0) relax(cur - sx * sy, d);
    if (z < sz - 1) relax(cur + sx * sy, d);
  }
  for (let j = 0; j < n; j++) {
    const v = m.cells[j] ?? 0;
    if (v !== 0 && (dist[j] ?? 0) <= wall) out.cells[j] = v;
  }
  return out;
}

export function floodFill(m: Voxels, start: Vec3i, mat: number): Voxels {
  const out = clone(m);
  const src = get(m, start[0], start[1], start[2]);
  if (src === 0 || src === mat) return out;
  const [sx, sy] = out.size;
  const stack: number[] = [index(out, start[0], start[1], start[2])];
  out.cells[stack[0] ?? 0] = mat;
  while (stack.length > 0) {
    const cur = stack.pop() ?? 0;
    const x = cur % sx;
    const y = ((cur - x) / sx) % sy;
    const z = (cur - x - y * sx) / (sx * sy);
    const neighbours: Vec3i[] = [
      [x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1],
    ];
    for (const [nx, ny, nz] of neighbours) {
      if (!inBounds(out, nx, ny, nz)) continue;
      const j = index(out, nx, ny, nz);
      if ((out.cells[j] ?? 0) === src) {
        out.cells[j] = mat;
        stack.push(j);
      }
    }
  }
  return out;
}

/** Internal: label each filled cell; returns component cell lists in scan order (seed index ascending). */
function collectComponents(m: Voxels): number[][] {
  const [sx, sy, sz] = m.size;
  const seen = new Uint8Array(m.cells.length);
  const result: number[][] = [];
  for (let i = 0; i < m.cells.length; i++) {
    if ((m.cells[i] ?? 0) === 0 || seen[i] === 1) continue;
    const cells: number[] = [];
    const stack: number[] = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const cur = stack.pop() ?? 0;
      cells.push(cur);
      const x = cur % sx;
      const y = ((cur - x) / sx) % sy;
      const z = (cur - x - y * sx) / (sx * sy);
      const step = (j: number): void => {
        if (seen[j] === 0 && (m.cells[j] ?? 0) !== 0) {
          seen[j] = 1;
          stack.push(j);
        }
      };
      if (x > 0) step(cur - 1);
      if (x < sx - 1) step(cur + 1);
      if (y > 0) step(cur - sx);
      if (y < sy - 1) step(cur + sx);
      if (z > 0) step(cur - sx * sy);
      if (z < sz - 1) step(cur + sx * sy);
    }
    result.push(cells);
  }
  return result;
}

export function components(m: Voxels): number {
  return collectComponents(m).length;
}

export function pieces(m: Voxels): Voxels[] {
  const comps = collectComponents(m); // already ordered by lowest cell index
  comps.sort((a, b) => b.length - a.length); // stable: ties keep lowest-index-first order
  return comps.map((cells) => {
    const p = emptyModel(m.size[0], m.size[1], m.size[2]);
    for (const j of cells) p.cells[j] = m.cells[j] ?? 0;
    return p;
  });
}