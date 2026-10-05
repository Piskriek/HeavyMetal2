// src/index.ts
// Voxel-to-triangle-mesh remesher.
//
// A `Volume` is a dense 3D grid of palette indices (0 = empty). Greedy meshing
// walks each of the six axis/direction combinations and merges every maximal
// run of same-colour exposed cell-faces into one rectangle (a `Quad`). The
// resulting quads are then converted to a welded triangle `Mesh`.
//
// Strict, no DOM, no Date, no Math.random, no imports.

export interface Volume {
  sx: number;
  sy: number;
  sz: number;
  cells: Uint8Array;
}

export interface Quad {
  axis: 0 | 1 | 2;
  dir: 1 | -1;
  plane: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  color: number;
}

export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Uint8Array;
  indices: Uint32Array;
}

// Flat index: x + y*sx + z*sx*sy.
function idx(v: Volume, x: number, y: number, z: number): number {
  return x + y * v.sx + z * v.sx * v.sy;
}

// Read a cell; out-of-volume returns 0 (treated as empty so volume edges
// are exposed faces).
function getCell(v: Volume, x: number, y: number, z: number): number {
  if (x < 0 || x >= v.sx || y < 0 || y >= v.sy || z < 0 || z >= v.sz) {
    return 0;
  }
  return v.cells[idx(v, x, y, z)] ?? 0;
}

// Count of exposed cell-faces a naive per-cell mesher would emit.
export function naiveFaces(v: Volume): number {
  const { sx, sy, sz } = v;
  let n = 0;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const c = v.cells[idx(v, x, y, z)] ?? 0;
        if (c === 0) continue;
        if (getCell(v, x + 1, y, z) === 0) n++;
        if (getCell(v, x - 1, y, z) === 0) n++;
        if (getCell(v, x, y + 1, z) === 0) n++;
        if (getCell(v, x, y - 1, z) === 0) n++;
        if (getCell(v, x, y, z + 1) === 0) n++;
        if (getCell(v, x, y, z - 1) === 0) n++;
      }
    }
  }
  return n;
}

// Greedy meshing.
//
// For each (axis, dir) we sweep every cell-boundary plane along `axis`. A
// 2D mask in the (u, v) tangent plane is filled with the solid cell's
// palette index where the cell face is exposed (neighbour empty or out of
// volume), and 0 elsewhere. We then merge contiguous runs of the same
// non-zero value: grow along `u` first, then along `v` (only if every
// column in the [u, u1) range matches), and emit one quad per rectangle.
//
// Iteration order is fixed (axis, dir, plane, u, v) so the quad list is
// deterministic.
export function greedy(v: Volume): Quad[] {
  const { sx, sy, sz } = v;
  const quads: Quad[] = [];

  for (let axis = 0 as 0 | 1 | 2; axis <= 2; axis = (axis + 1) as 0 | 1 | 2) {
    for (const dir of [1, -1] as const) {
      // Sizes of the tangent plane (u, v) for this axis.
      const sizeU = axis === 0 ? sy : sx;
      const sizeV = axis === 0 ? sz : axis === 1 ? sz : sy;
      // Range of the solid-cell coordinate along `axis`.
      const sizeA = axis === 0 ? sx : axis === 1 ? sy : sz;

      for (let c = 0; c < sizeA; c++) {
        const nc = c + dir;
        const mask = new Int32Array(sizeU * sizeV);
        let any = false;

        for (let u = 0; u < sizeU; u++) {
          for (let vi = 0; vi < sizeV; vi++) {
            const [sx2, sy2, sz2] = axisSolidCell(axis, c, u, vi);
            const cellVal = inVolume(sx2, sy2, sz2, sx, sy, sz)
              ? v.cells[idx(v, sx2, sy2, sz2)] ?? 0
              : 0;
            if (cellVal === 0) {
              mask[u * sizeV + vi] = 0;
              continue;
            }
            const [nx, ny, nz] = axisSolidCell(axis, nc, u, vi);
            const neighbor = inVolume(nx, ny, nz, sx, sy, sz)
              ? v.cells[idx(v, nx, ny, nz)] ?? 0
              : 0;
            if (neighbor === 0) {
              mask[u * sizeV + vi] = cellVal;
              any = true;
            } else {
              mask[u * sizeV + vi] = 0;
            }
          }
        }

        if (!any) continue;

        for (let u = 0; u < sizeU; u++) {
          for (let vi = 0; vi < sizeV; vi++) {
            const startIdx = u * sizeV + vi;
            const color = mask[startIdx] as number;
            if (color === 0) continue;

            // Grow along u: contiguous same-colour in this row.
            let u1 = u + 1;
            while (u1 < sizeU && mask[u1 * sizeV + vi] === color) u1++;

            // Grow along v: every column in [u, u1) must still hold `color`.
            let v1 = vi + 1;
            growV: while (v1 < sizeV) {
              for (let uu = u; uu < u1; uu++) {
                if (mask[uu * sizeV + v1] !== color) break growV;
              }
              v1++;
            }

            quads.push({
              axis,
              dir,
              plane: c,
              u0: u,
              v0: vi,
              u1: u1,
              v1: v1,
              color: color,
            });

            // Clear the rectangle so the scan skips it.
            for (let uu = u; uu < u1; uu++) {
              for (let vv = vi; vv < v1; vv++) {
                mask[uu * sizeV + vv] = 0;
              }
            }
          }
        }
      }
    }
  }
  return quads;
}

function axisSolidCell(
  axis: 0 | 1 | 2,
  c: number,
  u: number,
  vi: number,
): [number, number, number] {
  if (axis === 0) return [c, u, vi];
  if (axis === 1) return [u, c, vi];
  return [u, vi, c];
}

function inVolume(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): boolean {
  return x >= 0 && x < sx && y >= 0 && y < sy && z >= 0 && z < sz;
}

// Whether the (+u, +v) corner order gives an outward-facing normal for the
// given (axis, dir). The tangent basis (u, v) is right-handed with `axis` for
// axis 0 (y,z,x) and axis 2 (x,y,z), and left-handed for axis 1 (x,z,y), so
// the forward winding only matches an outward normal in some combinations.
function forwardOrder(axis: 0 | 1 | 2, dir: 1 | -1): boolean {
  if (axis === 0) return dir === 1;
  if (axis === 1) return dir === -1;
  return dir === 1;
}

// Build a triangle mesh from quads. Vertices are unshared across quads of
// different colours or normals, then welded by (position, normal, colour).
export function toMesh(quads: readonly Quad[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const weld = new Map<string, number>();

  for (const q of quads) {
    const axisCoord = q.dir === 1 ? q.plane + 1 : q.plane;
    const nx = q.axis === 0 ? q.dir : 0;
    const ny = q.axis === 1 ? q.dir : 0;
    const nz = q.axis === 2 ? q.dir : 0;

    // Corners built in (u, v) lex order: 0=(u0,v0), 1=(u0,v1),
    // 2=(u1,v0), 3=(u1,v1).
    const corners: [number, number, number][] = [
      corner(q.axis, axisCoord, q.u0, q.v0),
      corner(q.axis, axisCoord, q.u0, q.v1),
      corner(q.axis, axisCoord, q.u1, q.v0),
      corner(q.axis, axisCoord, q.u1, q.v1),
    ];

    // forward => indices 0, 2, 3, 1 ; reverse => 1, 3, 2, 0.
    const fwd = forwardOrder(q.axis, q.dir);
    const order: readonly number[] = fwd ? [0, 2, 3, 1] : [1, 3, 2, 0];

    const v: number[] = [];
    for (const oi of order) {
      const pos = corners[oi] as [number, number, number];
      const key =
        pos[0] + "," + pos[1] + "," + pos[2] + "," +
        nx + "," + ny + "," + nz + "," + q.color;
      let vi = weld.get(key);
      if (vi === undefined) {
        vi = positions.length / 3;
        positions.push(pos[0], pos[1], pos[2]);
        normals.push(nx, ny, nz);
        colors.push(q.color);
        weld.set(key, vi);
      }
      v.push(vi);
    }

    const a = v[0] as number;
    const b = v[1] as number;
    const d = v[2] as number;
    const c = v[3] as number;
    indices.push(a, b, d, a, d, c);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Uint8Array(colors),
    indices: new Uint32Array(indices),
  };
}

function corner(
  axis: 0 | 1 | 2,
  axisCoord: number,
  u: number,
  v: number,
): [number, number, number] {
  if (axis === 0) return [axisCoord, u, v];
  if (axis === 1) return [u, axisCoord, v];
  return [u, v, axisCoord];
}

export function triangles(m: Mesh): number {
  return m.indices.length / 3;
}