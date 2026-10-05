/**
 * smoothvox2 — second pass for smooth voxel meshes.
 *
 * The first pass already turned a voxel model into a smooth triangle mesh
 * (positions, normals, one palette index per vertex, an index buffer).
 * This module makes that mesh ready for textured, lit drawing:
 *
 *   surfaceOf          palette entry  -> game surface (grass, rock, wood, ...)
 *   triplanarWeights   per-vertex triplanar blend weights from the normal
 *   tangents           per-vertex tangent + handedness for triplanar mapping
 *   groups             triangles re-ordered into one contiguous draw group per surface
 *   surfaceBlend       per-vertex share of up to 4 surfaces over the one-ring (soft borders)
 *
 * Rules honoured here: no imports, no DOM, no Date, no Math.random, no `any`,
 * strict + noUncheckedIndexedAccess safe, and inputs are never mutated —
 * every function returns freshly allocated data.
 */

/* ------------------------------------------------------------------ types */

export type Vec3 = [number, number, number];

/** A palette entry of the voxel model. Colour components are 0..1. */
export interface VMaterial {
  color: Vec3;
  alpha: number;
  roughness: number;
  metalness: number;
  emissive: number;
}

/** Smooth triangle mesh: 3 floats per position, 3 per normal, 1 palette index per vertex. */
export interface SmoothMesh {
  positions: Float32Array;
  normals: Float32Array;
  paletteIndex: Uint8Array;
  indices: Uint32Array;
}

/** One of the game's surfaces, each with a typical colour. */
export interface Surface {
  id: number;
  name: string;
  color: Vec3;
}

/** One contiguous run of indices that draws with a single surface. */
export interface DrawGroup {
  surface: number;
  start: number;
  count: number;
}

export interface GroupedIndices {
  indices: Uint32Array;
  groups: DrawGroup[];
}

export interface SurfaceBlendResult {
  /** 4 slots per vertex, unused slots hold NO_SURFACE. */
  ids: Uint8Array;
  /** 4 slots per vertex, unused slots hold 0, used slots sum to 1, largest first. */
  weights: Float32Array;
}

/* --------------------------------------------------------------- constants */

/** Sentinel surface id: "nothing here" (used for empty blend slots and unknown surfaces). */
export const NO_SURFACE = 255;

/** Number of blend slots per vertex. */
export const BLEND_SLOTS = 4;

/** Perceptual-ish weights on squared colour differences. */
const COLOR_WEIGHTS: Vec3 = [0.3, 0.59, 0.11];

/** Smallest squared length we still consider a usable vector. */
const EPS = 1e-12;

/* ---------------------------------------------------------------- helpers */

/** Index a numeric array without tripping noUncheckedIndexedAccess. */
function num(a: ArrayLike<number>, i: number): number {
  const v = a[i];
  return v === undefined ? 0 : v;
}

/** Vertices the mesh can actually describe (positions and normals must agree). */
function vertexCount(m: SmoothMesh): number {
  return Math.min(Math.floor(m.positions.length / 3), Math.floor(m.normals.length / 3));
}

function readNormal(m: SmoothMesh, v: number): Vec3 {
  return [num(m.normals, v * 3), num(m.normals, v * 3 + 1), num(m.normals, v * 3 + 2)];
}

function paletteEntry(m: SmoothMesh, v: number): number {
  return v < m.paletteIndex.length ? num(m.paletteIndex, v) : 0;
}

function surfaceOfVertex(m: SmoothMesh, surfaceByPalette: readonly number[], v: number): number {
  const s = surfaceByPalette[paletteEntry(m, v)];
  return s === undefined ? NO_SURFACE : s;
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function length3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

/**
 * Dominant projection axis of a normal: 0 = x, 1 = y, 2 = z.
 * Ties go to the earlier axis, so a zero normal resolves to x.
 */
function dominantAxis(n: Vec3): number {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  if (ax >= ay && ax >= az) return 0;
  if (ay >= az) return 1;
  return 2;
}

/**
 * U / V texture axes of a projection plane.
 *   x plane: U = z, V = y
 *   y plane: U = x, V = z
 *   z plane: U = x, V = y
 */
function planeAxes(axis: number): { u: Vec3; v: Vec3 } {
  switch (axis) {
    case 0:
      return { u: [0, 0, 1], v: [0, 1, 0] };
    case 1:
      return { u: [1, 0, 0], v: [0, 0, 1] };
    default:
      return { u: [1, 0, 0], v: [0, 1, 0] };
  }
}

/** Id of the surface with the given (lower-cased, trimmed) name, if the game has one. */
function findSurfaceNamed(surfaces: readonly Surface[], name: string): number | undefined {
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    if (s !== undefined && s.name.trim().toLowerCase() === name) return s.id;
  }
  return undefined;
}

/** Nearest surface colour in the weighted space, ties going to the earlier surface. */
function nearestSurface(color: Vec3, surfaces: readonly Surface[]): number {
  const [wr, wg, wb] = COLOR_WEIGHTS;
  let bestId = NO_SURFACE;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    if (s === undefined) continue;
    const [sr, sg, sb] = s.color;
    const dr = color[0] - sr;
    const dg = color[1] - sg;
    const db = color[2] - sb;
    const dist = wr * dr * dr + wg * dg * dg + wb * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = s.id;
    }
  }
  return bestId;
}

/* --------------------------------------------------------- palette -> surface */

/**
 * Map every palette entry onto a game surface id.
 *
 * Priority: an explicit palette->surface map wins; then metalness > 0.5 picks the
 * surface named 'metal'; then emissive > 0.5 picks 'glow'; otherwise the surface
 * with the nearest colour (weights 0.3 / 0.59 / 0.11 on squared differences).
 * With no surfaces at all every entry gets NO_SURFACE.
 */
export function surfaceOf(
  palette: readonly VMaterial[],
  surfaces: readonly Surface[],
  explicit?: Readonly<Record<number, number>>,
): number[] {
  const metalId = findSurfaceNamed(surfaces, 'metal');
  const glowId = findSurfaceNamed(surfaces, 'glow');
  const known = new Set<number>();
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    if (s !== undefined) known.add(s.id);
  }

  const out: number[] = [];
  for (let i = 0; i < palette.length; i++) {
    const m = palette[i];
    if (m === undefined) {
      out.push(NO_SURFACE);
      continue;
    }
    const forced = explicit === undefined ? undefined : explicit[i];
    if (forced !== undefined && Number.isFinite(forced) && known.has(forced)) {
      out.push(forced);
      continue;
    }
    if (m.metalness > 0.5 && metalId !== undefined) {
      out.push(metalId);
      continue;
    }
    if (m.emissive > 0.5 && glowId !== undefined) {
      out.push(glowId);
      continue;
    }
    out.push(nearestSurface(m.color, surfaces));
  }
  return out;
}

/* ---------------------------------------------------------- triplanar weights */

/**
 * Per-vertex triplanar weights from the normal: w_i = |n_i|^sharpness, normalised
 * to sum to 1. Sharpness is clamped to >= 1. 3 floats per vertex.
 * A degenerate (zero) normal gets an even 1/3 split.
 */
export function triplanarWeights(m: SmoothMesh, sharpness: number): Float32Array {
  const power = Number.isFinite(sharpness) && sharpness >= 1 ? sharpness : 1;
  const count = vertexCount(m);
  const out = new Float32Array(count * 3);

  for (let v = 0; v < count; v++) {
    const n = readNormal(m, v);
    let wx = Math.pow(Math.abs(n[0]), power);
    let wy = Math.pow(Math.abs(n[1]), power);
    let wz = Math.pow(Math.abs(n[2]), power);
    const sum = wx + wy + wz;
    if (sum > 0 && Number.isFinite(sum)) {
      wx /= sum;
      wy /= sum;
      wz /= sum;
    } else {
      wx = 1 / 3;
      wy = 1 / 3;
      wz = 1 / 3;
    }
    out[v * 3] = wx;
    out[v * 3 + 1] = wy;
    out[v * 3 + 2] = wz;
  }
  return out;
}

/* ------------------------------------------------------------------ tangents */

/**
 * Per-vertex tangents for triplanar mapping: 4 floats (xyz + handedness w = ±1).
 *
 * The tangent starts as the U axis of the vertex's dominant projection plane, is
 * made orthogonal to the normal by Gram-Schmidt and normalised. w is the sign of
 * dot(cross(n, t), the plane's V axis), so a shader can rebuild the bitangent.
 */
export function tangents(m: SmoothMesh): Float32Array {
  const count = vertexCount(m);
  const out = new Float32Array(count * 4);

  for (let v = 0; v < count; v++) {
    const raw = readNormal(m, v);
    const len = length3(raw);
    const n: Vec3 = len * len > EPS ? scale3(raw, 1 / len) : [0, 0, 0];
    const { u, v: vAxis } = planeAxes(dominantAxis(n));

    // Gram-Schmidt: drop the part of U that points along the normal.
    let t = sub3(u, scale3(n, dot3(n, u)));
    let tLen = length3(t);
    if (tLen * tLen <= EPS) {
      // U happened to be parallel to the normal: use the plane's V axis instead.
      t = sub3(vAxis, scale3(n, dot3(n, vAxis)));
      tLen = length3(t);
    }
    if (tLen * tLen <= EPS) {
      t = u;
      tLen = length3(t);
    }
    t = scale3(t, 1 / tLen);

    const handedness = dot3(cross3(n, t), vAxis) < 0 ? -1 : 1;

    out[v * 4] = t[0];
    out[v * 4 + 1] = t[1];
    out[v * 4 + 2] = t[2];
    out[v * 4 + 3] = handedness;
  }
  return out;
}

/* -------------------------------------------------------------- draw groups */

/**
 * Split the triangles into draw groups by surface.
 *
 * A triangle belongs to the surface of the majority of its three vertices; when
 * all three differ the first vertex decides. The returned index buffer keeps the
 * groups contiguous in ascending surface id order, and keeps the original
 * triangle order inside each group.
 */
export function groups(m: SmoothMesh, surfaceByPalette: readonly number[]): GroupedIndices {
  const triCount = Math.floor(m.indices.length / 3);
  const buckets = new Map<number, number[]>();

  for (let t = 0; t < triCount; t++) {
    const a = num(m.indices, t * 3);
    const b = num(m.indices, t * 3 + 1);
    const c = num(m.indices, t * 3 + 2);
    const sa = surfaceOfVertex(m, surfaceByPalette, a);
    const sb = surfaceOfVertex(m, surfaceByPalette, b);
    const sc = surfaceOfVertex(m, surfaceByPalette, c);
    // sb === sc -> that pair is the majority (or all three agree);
    // otherwise sa is either the majority or the first-vertex tie break.
    const surface = sb === sc ? sb : sa;

    const bucket = buckets.get(surface);
    if (bucket === undefined) buckets.set(surface, [t]);
    else bucket.push(t);
  }

  const order = [...buckets.keys()].sort((x, y) => x - y);
  const indices = new Uint32Array(triCount * 3);
  const out: DrawGroup[] = [];
  let cursor = 0;

  for (let i = 0; i < order.length; i++) {
    const surface = order[i];
    if (surface === undefined) continue;
    const tris = buckets.get(surface);
    if (tris === undefined) continue;
    const start = cursor;
    for (let j = 0; j < tris.length; j++) {
      const t = tris[j];
      if (t === undefined) continue;
      indices[cursor] = num(m.indices, t * 3);
      indices[cursor + 1] = num(m.indices, t * 3 + 1);
      indices[cursor + 2] = num(m.indices, t * 3 + 2);
      cursor += 3;
    }
    out.push({ surface, start, count: cursor - start });
  }

  return { indices, groups: out };
}

/* ------------------------------------------------------------ surface blend */

/** Link two vertices as one-ring neighbours (triangle adjacency). */
function link(adj: readonly (Set<number> | undefined)[], a: number, b: number): void {
  if (a === b) return;
  const sa = adj[a];
  if (sa !== undefined) sa.add(b);
  const sb = adj[b];
  if (sb !== undefined) sb.add(a);
}

/**
 * Vertex-weighted blend for soft surface borders.
 *
 * For every vertex the ring is the vertex itself plus its one-ring neighbours
 * (two vertices share a ring slot when a triangle uses both). Each surface in the
 * ring gets its share of the ring; the up-to-4 largest shares are returned,
 * largest first, weights summing to 1. Unused slots: id NO_SURFACE, weight 0.
 */
export function surfaceBlend(
  m: SmoothMesh,
  surfaceByPalette: readonly number[],
): SurfaceBlendResult {
  const count = vertexCount(m);
  const ids = new Uint8Array(count * BLEND_SLOTS);
  ids.fill(NO_SURFACE);
  const weights = new Float32Array(count * BLEND_SLOTS);
  if (count === 0) return { ids, weights };

  // One-ring adjacency from the triangles.
  const adj: Set<number>[] = [];
  for (let v = 0; v < count; v++) adj.push(new Set<number>());
  const triCount = Math.floor(m.indices.length / 3);
  for (let t = 0; t < triCount; t++) {
    const a = num(m.indices, t * 3);
    const b = num(m.indices, t * 3 + 1);
    const c = num(m.indices, t * 3 + 2);
    link(adj, a, b);
    link(adj, a, c);
    link(adj, b, c);
  }

  for (let v = 0; v < count; v++) {
    const tally = new Map<number, number>();
    let total = 0;
    const own = surfaceOfVertex(m, surfaceByPalette, v);
    tally.set(own, 1);
    total = 1;

    const ring = adj[v];
    if (ring !== undefined) {
      for (const n of ring) {
        if (n < 0 || n >= count) continue;
        const s = surfaceOfVertex(m, surfaceByPalette, n);
        tally.set(s, (tally.get(s) ?? 0) + 1);
        total += 1;
      }
    }

    const ranked = [...tally.entries()].sort((p, q) => (q[1] - p[1]) || (p[0] - q[0]));
    const slots = Math.min(BLEND_SLOTS, ranked.length);
    for (let i = 0; i < slots; i++) {
      const entry = ranked[i];
      if (entry === undefined) continue;
      const surface = entry[0];
      ids[v * BLEND_SLOTS + i] = surface >= 0 && surface <= 254 ? surface : NO_SURFACE;
      weights[v * BLEND_SLOTS + i] = entry[1] / total;
    }
  }

  return { ids, weights };
}