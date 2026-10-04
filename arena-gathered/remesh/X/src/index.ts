/**
 * Voxel -> light triangle mesh.
 *
 * A toy-world model is a dense grid of palette indices. A naive mesher emits one
 * quad per exposed cell face, which explodes (a solid 32^3 block = 6144 quads =
 * 12288 triangles). `greedy` merges neighbouring faces that share a plane, a
 * normal and a colour into maximal rectangles, and `toMesh` turns those into a
 * welded, indexed triangle mesh. Same silhouette, one or two orders of magnitude
 * fewer triangles.
 *
 * No imports, no globals beyond pure Math helpers: deterministic in, deterministic out.
 */

export interface Volume {
  sx: number;
  sy: number;
  sz: number;
  /** 0 = empty, else a palette index; index x + y*sx + z*sx*sy */
  cells: Uint8Array;
}

export interface Quad {
  /** 0 = x, 1 = y, 2 = z */
  axis: 0 | 1 | 2;
  /** which way the face looks along `axis` */
  dir: 1 | -1;
  /** the cell boundary along `axis` (0 .. size) */
  plane: number;
  /** [u0,u1) x [v0,v1); u,v are the other two axes in order (x->y,z; y->x,z; z->x,y) */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  color: number;
}

export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  /** one palette index per vertex */
  colors: Uint8Array;
  indices: Uint32Array;
}

type Axis = 0 | 1 | 2;
type Vec3 = [number, number, number];

const AXES = [0, 1, 2] as const;
/** -1 before +1 so the output order never depends on object key order. */
const DIRS = [-1, 1] as const;

/** The two in-plane axes of a face, in the documented order. */
function uvAxes(axis: Axis): readonly [Axis, Axis] {
  if (axis === 0) return [1, 2];
  if (axis === 1) return [0, 2];
  return [0, 1];
}

function sizeOf(v: Volume, axis: Axis): number {
  if (axis === 0) return v.sx;
  if (axis === 1) return v.sy;
  return v.sz;
}

function isSize(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

function check(v: Volume): void {
  if (!isSize(v.sx) || !isSize(v.sy) || !isSize(v.sz)) {
    throw new RangeError('volume dimensions must be non-negative integers');
  }
  if (v.cells.length !== v.sx * v.sy * v.sz) {
    throw new RangeError('cells.length must equal sx*sy*sz');
  }
}

/** Palette index at a cell; anything outside the volume reads as empty. */
function cellAt(v: Volume, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= v.sx || y >= v.sy || z >= v.sz) return 0;
  return v.cells[x + y * v.sx + z * v.sx * v.sy] ?? 0;
}

/** Cell at coordinate `a` along `axis`, `u`/`w` along the two in-plane axes. */
function cellOnPlane(v: Volume, axis: Axis, a: number, u: number, w: number): number {
  if (axis === 0) return cellAt(v, a, u, w);
  if (axis === 1) return cellAt(v, u, a, w);
  return cellAt(v, u, w, a);
}

/** A quad corner (u,w) in the plane `plane` of `axis`, as a world position. */
function cornerOf(axis: Axis, plane: number, u: number, w: number): Vec3 {
  if (axis === 0) return [plane, u, w];
  if (axis === 1) return [u, plane, w];
  return [u, w, plane];
}

/**
 * Greedy meshing: only faces between a solid cell and an empty (or outside) cell;
 * per axis, direction and plane, merge same-colour faces into maximal rectangles
 * (grow along u first, then v).
 *
 * Output order is fixed: axis 0,1,2; then dir -1 then +1; then plane ascending;
 * then the scan order of the plane (v ascending, u ascending).
 */
export function greedy(v: Volume): Quad[] {
  check(v);
  const out: Quad[] = [];

  for (const axis of AXES) {
    const [ua, va] = uvAxes(axis);
    const n = sizeOf(v, axis);
    const un = sizeOf(v, ua);
    const vn = sizeOf(v, va);
    if (n === 0 || un === 0 || vn === 0) continue;

    const mask = new Uint8Array(un * vn);

    for (const dir of DIRS) {
      for (let plane = 0; plane <= n; plane++) {
        // Build the mask of exposed faces on this boundary plane.
        let any = false;
        for (let w = 0; w < vn; w++) {
          const row = w * un;
          for (let u = 0; u < un; u++) {
            const lo = cellOnPlane(v, axis, plane - 1, u, w); // cell below the boundary
            const hi = cellOnPlane(v, axis, plane, u, w); // cell above the boundary
            const color = dir === 1 ? (lo !== 0 && hi === 0 ? lo : 0) : hi !== 0 && lo === 0 ? hi : 0;
            mask[row + u] = color;
            if (color !== 0) any = true;
          }
        }
        if (!any) continue;

        // Merge into maximal rectangles: grow along u first, then along v.
        for (let w = 0; w < vn; w++) {
          for (let u = 0; u < un; u++) {
            const color = mask[w * un + u] ?? 0;
            if (color === 0) continue;

            let width = 1;
            while (u + width < un && (mask[w * un + u + width] ?? 0) === color) width++;

            let height = 1;
            grow: while (w + height < vn) {
              const row = (w + height) * un;
              for (let k = 0; k < width; k++) {
                if ((mask[row + u + k] ?? 0) !== color) break grow;
              }
              height++;
            }

            for (let dv = 0; dv < height; dv++) {
              const row = (w + dv) * un;
              for (let du = 0; du < width; du++) mask[row + u + du] = 0;
            }

            out.push({
              axis,
              dir,
              plane,
              u0: u,
              v0: w,
              u1: u + width,
              v1: w + height,
              color,
            });
          }
        }
      }
    }
  }

  return out;
}

/**
 * Two triangles per quad, counter-clockwise seen from outside; vertices are never
 * shared between quads of different colours or normals, and vertices of the same
 * position, normal and colour are welded into one.
 */
export function toMesh(quads: readonly Quad[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const welded = new Map<string, number>();

  for (const q of quads) {
    if (q.u1 <= q.u0 || q.v1 <= q.v0) continue; // degenerate, nothing to draw

    const nx = q.axis === 0 ? q.dir : 0;
    const ny = q.axis === 1 ? q.dir : 0;
    const nz = q.axis === 2 ? q.dir : 0;

    // u x v points along +axis for x and z, but along -y for axis 1, so that one flips.
    const flip = (q.axis === 1 ? -q.dir : q.dir) < 0;

    const vertex = (u: number, w: number): number => {
      const [x, y, z] = cornerOf(q.axis, q.plane, u, w);
      const key = `${x},${y},${z},${nx},${ny},${nz},${q.color}`;
      const hit = welded.get(key);
      if (hit !== undefined) return hit;
      const id = colors.length;
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      colors.push(q.color);
      welded.set(key, id);
      return id;
    };

    const a = vertex(q.u0, q.v0);
    const b = vertex(q.u1, q.v0);
    const c = vertex(q.u1, q.v1);
    const d = vertex(q.u0, q.v1);

    if (flip) indices.push(a, d, c, a, c, b);
    else indices.push(a, b, c, a, c, d);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Uint8Array(colors),
    indices: new Uint32Array(indices),
  };
}

/** Triangles in the mesh. */
export function triangles(m: Mesh): number {
  return (m.indices.length / 3) | 0;
}

/** Faces a naive mesher would make (one quad per exposed cell face), for the before/after number. */
export function naiveFaces(v: Volume): number {
  check(v);
  let faces = 0;
  for (let z = 0; z < v.sz; z++) {
    for (let y = 0; y < v.sy; y++) {
      for (let x = 0; x < v.sx; x++) {
        if (cellAt(v, x, y, z) === 0) continue;
        if (cellAt(v, x - 1, y, z) === 0) faces++;
        if (cellAt(v, x + 1, y, z) === 0) faces++;
        if (cellAt(v, x, y - 1, z) === 0) faces++;
        if (cellAt(v, x, y + 1, z) === 0) faces++;
        if (cellAt(v, x, y, z - 1) === 0) faces++;
        if (cellAt(v, x, y, z + 1) === 0) faces++;
      }
    }
  }
  return faces;
}