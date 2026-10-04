/**
 * Decal maths for a toy-world game.
 *
 * A decal is a square picture (one cell of an atlas sheet) pressed onto a
 * surface where the player clicked: either the ground (a height grid) or the
 * face of an axis-aligned box.  This module decides *where* and *how* the
 * decal lies -- position, outward normal, local up axis, quad corners, the
 * draped mesh over bumpy ground, the soft alpha edge and which older decals it
 * collides with.  Drawing the picture is the game's job.
 *
 * Conventions
 *  - the world is y-up, x/z is the ground plane;
 *  - a decal's frame is (right, up) with right = cross(normal, up); on flat
 *    ground up is the world z axis, so right is the world x axis;
 *  - `rotation` is degrees about the normal, right-hand rule (so a quarter
 *    turn moves each corner onto the spot of the corner before it in the
 *    bottom-left, bottom-right, top-right, top-left order);
 *  - decals are lifted 1 cm (0.01 units) off the surface along the normal so
 *    they never z-fight with it;
 *  - this module is deterministic: nothing here is random.  The caller's
 *    `seed` is only carried on the decal so the game can pick a deterministic
 *    variant (cell jitter, tint, ...) without breaking replays.
 *
 * Pure maths: no DOM, no clocks, no randomness, no imports.
 */

/** A 3D point or direction. */
export type Vec3 = [number, number, number];

/** A sticker sheet: cells numbered row by row from the top left. */
export interface Atlas {
  cols: number;
  rows: number;
}

/** Static description of a decal kind. */
export interface DecalDef {
  id: string;
  /** First atlas cell used. Animated kinds use cell .. cell + frames - 1. */
  cell: number;
  /** 1 for a still picture, more for a flip-book animation. */
  frames: number;
  /** Animation rate in frames per second. */
  fps: number;
  /** Full width and height of the decal in world units. */
  size: number;
  /** Soft edge width as a share of the size, 0..1 (0 = hard edge). */
  fade: number;
}

/** A decal actually placed in the world. */
export interface Decal {
  /** The `id` of the DecalDef this was placed from. */
  def: string;
  /** Centre of the quad, already lifted 1 cm off the surface. */
  pos: Vec3;
  /** Unit outward normal of the surface it sits on. */
  normal: Vec3;
  /** Unit "up" of the picture, perpendicular to the normal. */
  up: Vec3;
  size: number;
  /** Degrees about the normal. */
  rotation: number;
  /** Caller supplied, passed through untouched. */
  seed: number;
}

/** A height grid: vertex (c, r) sits at (originX + c*cell, heights[r*cols+c], originZ + r*cell). */
export interface Heights {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originZ: number;
  heights: Float32Array;
}

/* ------------------------------------------------------------------ *
 * small vector / number helpers
 * ------------------------------------------------------------------ */

const LIFT = 0.01; // 1 cm off the surface
const DEG = Math.PI / 180;
const FACE_EPS = 1e-6; // "the point lies on the face" tolerance
const NORM_EPS = 1e-9;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const lengthOf = (a: Vec3): number => Math.sqrt(dot(a, a));

const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** a / |a|, or `fallback` when a is degenerate (zero, NaN, infinite). */
function normalized(a: Vec3, fallback: Vec3): Vec3 {
  const len = lengthOf(a);
  if (!Number.isFinite(len) || len <= NORM_EPS) return fallback;
  return scale(a, 1 / len);
}

/** True when the finite components of a and b differ by at most `eps`. */
const nearEach = (a: number, b: number, eps = FACE_EPS): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

/* ------------------------------------------------------------------ *
 * height grid sampling
 * ------------------------------------------------------------------ */

/** Height of a grid vertex, 0 for out-of-range or corrupt data. */
function vertexHeight(h: Heights, col: number, row: number): number {
  if (h.cols < 1 || h.rows < 1) return 0;
  const c = clamp(col, 0, h.cols - 1);
  const r = clamp(row, 0, h.rows - 1);
  const v = h.heights[r * h.cols + c];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Bilinear height of the ground at an arbitrary world (x, z); clamped to the grid. */
function surfaceHeight(h: Heights, x: number, z: number): number {
  if (h.cols < 1 || h.rows < 1) return 0;
  const cell = h.cell > 0 ? h.cell : 1;
  const fx = clamp((x - h.originX) / cell, 0, h.cols - 1);
  const fz = clamp((z - h.originZ) / cell, 0, h.rows - 1);
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = Math.min(c0 + 1, h.cols - 1);
  const r1 = Math.min(r0 + 1, h.rows - 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const h00 = vertexHeight(h, c0, r0);
  const h10 = vertexHeight(h, c1, r0);
  const h01 = vertexHeight(h, c0, r1);
  const h11 = vertexHeight(h, c1, r1);
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

/**
 * Surface normal from the height grid's slope, using central differences one
 * cell out in x and z: n = normalize(-dh/dx, 1, -dh/dz).
 */
function groundNormal(h: Heights, x: number, z: number): Vec3 {
  const step = h.cell > 0 ? h.cell : 1;
  const dhdx = (surfaceHeight(h, x + step, z) - surfaceHeight(h, x - step, z)) / (2 * step);
  const dhdz = (surfaceHeight(h, x, z + step) - surfaceHeight(h, x, z - step)) / (2 * step);
  return normalized([-dhdx, 1, -dhdz], [0, 1, 0]);
}

/**
 * The world z axis projected onto the surface (the picture's "up" so that
 * decals lie the same way up wherever they land).  If the surface is parallel
 * to z, fall back to the world x axis.
 */
function surfaceUp(normal: Vec3): Vec3 {
  const alongZ = sub([0, 0, 1], scale(normal, dot([0, 0, 1], normal)));
  if (lengthOf(alongZ) > FACE_EPS) return normalized(alongZ, [0, 0, 1]);
  const alongX = sub([1, 0, 0], scale(normal, dot([1, 0, 0], normal)));
  return normalized(alongX, [0, 0, 1]);
}

/**
 * Orthonormal (right, up) frame for a decal, with `rotationDeg` applied about
 * the normal (right-hand rule).
 */
function frame(normal: Vec3, up: Vec3, rotationDeg: number): [Vec3, Vec3] {
  const n = normalized(normal, [0, 1, 0]);
  // up perpendicular to the normal
  let u = normalized(sub(up, scale(n, dot(up, n))), [0, 0, 0]);
  if (lengthOf(u) <= 1e-7) {
    // up was parallel to the normal: any perpendicular will do
    u = normalized(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]), [0, 1, 0]);
  }
  const r = normalized(cross(n, u), [1, 0, 0]);
  const a = (Number.isFinite(rotationDeg) ? rotationDeg : 0) * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [r[0] * c - u[0] * s, r[1] * c - u[1] * s, r[2] * c - u[2] * s],
    [u[0] * c + r[0] * s, u[1] * c + r[1] * s, u[2] * c + r[2] * s],
  ];
}

/* ------------------------------------------------------------------ *
 * atlas + animation
 * ------------------------------------------------------------------ */

/**
 * The UV rectangle [u0, v0, u1, v1] of a cell, v running down from the top of
 * the sheet.  Cells are numbered row by row from 0; out-of-range cells clamp
 * to the last cell.
 */
export function cellUv(atlas: Atlas, cell: number): [number, number, number, number] {
  const cols = Math.max(1, Math.floor(atlas.cols));
  const rows = Math.max(1, Math.floor(atlas.rows));
  const index = clamp(Math.floor(cell), 0, cols * rows - 1);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [col / cols, row / rows, (col + 1) / cols, (row + 1) / rows];
}

/** Which frame of an animated decal is showing at time `t` seconds (0 for frames <= 1). */
export function frameAt(def: DecalDef, t: number): number {
  const frames = Math.floor(def.frames);
  if (frames <= 1 || !(def.fps > 0)) return 0;
  const ticks = Math.floor(t * def.fps);
  return ((ticks % frames) + frames) % frames;
}

/* ------------------------------------------------------------------ *
 * placement
 * ------------------------------------------------------------------ */

/**
 * A decal on the ground at world (x, z).
 *
 * `pos` is the bilinear height under (x, z) lifted 1 cm along the normal, the
 * normal comes from the grid's slope (central differences) and `up` is the
 * world z axis projected onto the surface.
 */
export function onGround(
  h: Heights,
  x: number,
  z: number,
  def: DecalDef,
  rotation: number,
  seed: number,
): Decal {
  const normal = groundNormal(h, x, z);
  const pos: Vec3 = [x, surfaceHeight(h, x, z), z];
  return {
    def: def.id,
    pos: [pos[0] + normal[0] * LIFT, pos[1] + normal[1] * LIFT, pos[2] + normal[2] * LIFT],
    normal,
    up: surfaceUp(normal),
    size: def.size,
    rotation,
    seed,
  };
}

/**
 * A decal on the face of an axis-aligned box.
 *
 * The face is whichever side `point` lies on (within 1e-6); `null` if the
 * point is not on the surface.  Side faces get the world y axis as `up`, top
 * and bottom faces get the world z axis.
 */
export function onBox(
  min: Vec3,
  max: Vec3,
  point: Vec3,
  def: DecalDef,
  rotation: number,
  seed: number,
): Decal | null {
  const [px, py, pz] = point;
  const [ax, ay, az] = min;
  const [bx, by, bz] = max;
  const inside = (lo: number, v: number, hi: number): boolean => v >= lo - FACE_EPS && v <= hi + FACE_EPS;

  let normal: Vec3 | null = null;
  if (nearEach(px, ax) && inside(ay, py, by) && inside(az, pz, bz)) normal = [-1, 0, 0];
  else if (nearEach(px, bx) && inside(ay, py, by) && inside(az, pz, bz)) normal = [1, 0, 0];
  else if (nearEach(py, ay) && inside(ax, px, bx) && inside(az, pz, bz)) normal = [0, -1, 0];
  else if (nearEach(py, by) && inside(ax, px, bx) && inside(az, pz, bz)) normal = [0, 1, 0];
  else if (nearEach(pz, az) && inside(ax, px, bx) && inside(ay, py, by)) normal = [0, 0, -1];
  else if (nearEach(pz, bz) && inside(ax, px, bx) && inside(ay, py, by)) normal = [0, 0, 1];
  if (normal === null) return null;

  const n: Vec3 = normal;
  return {
    def: def.id,
    pos: [px + n[0] * LIFT, py + n[1] * LIFT, pz + n[2] * LIFT],
    normal: n,
    up: n[1] === 0 ? [0, 1, 0] : [0, 0, 1],
    size: def.size,
    rotation,
    seed,
  };
}

/* ------------------------------------------------------------------ *
 * geometry
 * ------------------------------------------------------------------ */

/**
 * The decal's quad corners, bottom-left, bottom-right, top-right, top-left,
 * rotated by `rotation` about the normal.  right = cross(normal, up), so on
 * flat ground with up = +z, right = +x and
 * bottom-left = pos - right*size/2 - up*size/2.
 */
export function corners(d: Decal): [Vec3, Vec3, Vec3, Vec3] {
  const [right, up] = frame(d.normal, d.up, d.rotation);
  const hx = (right[0] * d.size) / 2;
  const hy = (right[1] * d.size) / 2;
  const hz = (right[2] * d.size) / 2;
  const ux = (up[0] * d.size) / 2;
  const uy = (up[1] * d.size) / 2;
  const uz = (up[2] * d.size) / 2;
  const [px, py, pz] = d.pos;
  return [
    [px - hx - ux, py - hy - uy, pz - hz - uz],
    [px + hx - ux, py + hy - uy, pz + hz - uz],
    [px + hx + ux, py + hy + uy, pz + hz + uz],
    [px - hx + ux, py - hy + uy, pz - hz + uz],
  ];
}

/**
 * The ground decal draped over the height grid: an n x n grid of points
 * (n clamped to at least 2) spanning the quad, each lifted 1 cm above the
 * bilinear height under it so the sticker hugs bumps instead of cutting
 * through them.
 *
 * Returned row by row: index r*n + c, with r = 0 the bottom edge (towards
 * -up) and c = 0 the left edge (towards -right), so index 0 is the quad's
 * bottom-left corner and the last index its top-right one.
 */
export function drape(h: Heights, d: Decal, n: number): Vec3[] {
  const count = Math.max(2, Math.floor(n));
  const [right, up] = frame(d.normal, d.up, d.rotation);
  const out: Vec3[] = [];
  for (let row = 0; row < count; row++) {
    const v = (row / (count - 1) - 0.5) * d.size;
    for (let col = 0; col < count; col++) {
      const u = (col / (count - 1) - 0.5) * d.size;
      const x = d.pos[0] + right[0] * u + up[0] * v;
      const z = d.pos[2] + right[2] * u + up[2] * v;
      out.push([x, surfaceHeight(h, x, z) + LIFT, z]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * shading + layering
 * ------------------------------------------------------------------ */

/**
 * Opacity of a point at decal-local (u, v), both in 0..1: 1 inside, falling
 * smoothly to 0 across the fade band at the edges -- smoothstep(0, fade,
 * min(u, 1-u, v, 1-v)).  fade 0 is a hard edge; points outside the quad get 0.
 */
export function alphaAt(def: DecalDef, u: number, v: number): number {
  const edge = Math.min(u, 1 - u, v, 1 - v);
  const fade = def.fade;
  if (!(fade > 0)) return edge > 0 ? 1 : 0;
  const t = clamp(edge / fade, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Which existing decals a freshly placed one overlaps: the indices of decals
 * whose centres are nearer than half the new decal's size, in placement order.
 *
 * At most `max` indices come back.  When more than `max` overlap, the oldest
 * (lowest indices) are dropped from the answer -- they are the ones the game
 * should delete -- leaving the newest `max` in place.
 */
export function overlapping(all: readonly Decal[], d: Decal, max: number): number[] {
  const radius = d.size / 2;
  const limit = Math.max(0, Math.floor(max));
  const hit: number[] = [];
  for (let i = 0; i < all.length; i++) {
    const other = all[i];
    if (other === undefined) continue;
    const dx = other.pos[0] - d.pos[0];
    const dy = other.pos[1] - d.pos[1];
    const dz = other.pos[2] - d.pos[2];
    if (dx * dx + dy * dy + dz * dz < radius * radius) hit.push(i);
  }
  if (hit.length <= limit) return hit;
  if (limit === 0) return [];
  return hit.slice(hit.length - limit);
}