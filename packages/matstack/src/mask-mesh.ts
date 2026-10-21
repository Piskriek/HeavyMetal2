/**
 * Mask inputs per vertex (plan 41 section 4.5): how far a point is from the nearest sharp convex edge (`edge`) and the
 * nearest concave crease (`cavity`), in metres. The shader interpolates the attributes and reads them with the mask
 * formulas in index.ts, so wear lands on edges and dirt in creases with no bake, no unique UVs and no extra triangles.
 *
 * Each attribute is a vec4 per vertex: signed distances to up to four edge lines near the triangle (EDGE_LINES), FAR in
 * the unused slots. A signed distance to a line is a plane over the triangle, so it interpolates exactly, and the
 * fragment takes the smallest (`lineDistance`). On a convex face that smallest is exactly the distance to the face's
 * boundary, corners included.
 *
 * Two ways, picked by the mesh's largest triangle (`maskAttributes`):
 *  - **lines** (kit parts, anything with a face wider than twice the band): every triangle gets its own vertices and
 *    the lines of the sharp edges near it: its own, then those of the coplanar triangles around it (a beam face cut
 *    along its diagonal still wears along all four sides). A neighbour's line that crosses the triangle, or whose edge
 *    ends well before it, is left out, so no wear stripe runs past an edge's end. The triangle count does not change.
 *  - **curvature** (dense generated cores and small knobs: no face wider than twice the band): indexed as given; each
 *    vertex's sharpest bend becomes a distance-like value in the first slot, a rounded edge of radius `band` reading as
 *    on the edge.
 *
 * Pure and deterministic. Any indexed triangle mesh works; normals and UVs are carried over.
 */
import { EDGE_BAND } from './constants';

type V3 = readonly [number, number, number];

/** Edge lines per vertex and kind (one vec4). */
export const EDGE_LINES = 4;
/** An unused line slot: far from everything. */
export const FAR = 1000;

export interface MaskMeshInput {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array;
  readonly uvs?: Float32Array;
  /** Index ranges per material slot; one slot over everything when absent. */
  readonly slots?: readonly { readonly name: string; readonly start: number; readonly count: number }[];
}

export interface MaskMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly slots: readonly { readonly name: string; readonly start: number; readonly count: number }[];
  /** EDGE_LINES signed distances per vertex to sharp convex edge lines (metres), FAR when unused. */
  readonly edge: Float32Array;
  /** The same for concave creases. */
  readonly cavity: Float32Array;
}

export interface MaskMeshOptions {
  /** The widest band any mask will read, in metres (default EDGE_BAND). */
  readonly band?: number;
  /** Faces meeting at more than this many degrees make a sharp edge (default 30). */
  readonly sharpDeg?: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};

/** Distance from p to the segment a-b. */
export function segmentDistance(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 1e-18 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return len(sub(p, add(a, scale(ab, t))));
}

/**
 * What a vertex (or an interpolated fragment) reads from one vec4 attribute: the smallest of its signed distances,
 * a negative one counting as FAR. The shader does the same: min over the four of (d < 0 ? FAR : d).
 */
export function lineDistance(lines: ArrayLike<number>, at = 0): number {
  let d = FAR;
  for (let k = 0; k < EDGE_LINES; k++) {
    const v = lines[at * EDGE_LINES + k]!;
    if (v >= 0 && v < d) d = v;
  }
  return d;
}

const slotsOf = (m: MaskMeshInput) => (m.slots && m.slots.length > 0 ? m.slots : [{ name: 'all', start: 0, count: m.indices.length }]);

/** The longest triangle edge: a mesh with no face wider than twice the band is dense (or tiny) and takes curvature. */
function longestEdge(m: MaskMeshInput): number {
  let most = 0;
  const P = (i: number): V3 => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
  for (let i = 0; i + 2 < m.indices.length; i += 3) {
    const a = P(m.indices[i]!), b = P(m.indices[i + 1]!), c = P(m.indices[i + 2]!);
    most = Math.max(most, len(sub(b, a)), len(sub(c, b)), len(sub(a, c)));
  }
  return most;
}

/** The mask attributes for a mesh: edge lines when it has a face wider than twice the band, else curvature. */
export function maskAttributes(m: MaskMeshInput, o: MaskMeshOptions = {}): MaskMesh {
  const band = o.band ?? EDGE_BAND;
  return longestEdge(m) < band * 2 ? curvatureMasks(m, o) : edgeLines(m, o);
}

// ------------------------------------------------------------------ edge lines

interface Tri {
  readonly v: readonly [V3, V3, V3];
  /** Corner indices into the input, for its normals and UVs. */
  readonly src: readonly [number, number, number];
  readonly n: V3;
  readonly slot: number;
}

interface SharpEdge {
  readonly a: V3;
  readonly b: V3;
  /** The owning triangle's in-plane unit direction from the edge into the triangle. */
  readonly inward: V3;
  readonly concave: boolean;
}

/**
 * The lines way. Each triangle gets its own three vertices, carrying signed distances to the lines of up to
 * EDGE_LINES convex and EDGE_LINES concave sharp edges: its own first, then its coplanar group's within `band` that
 * neither cross the triangle nor end well before it, nearest first.
 */
export function edgeLines(m: MaskMeshInput, o: MaskMeshOptions = {}): MaskMesh {
  const band = o.band ?? EDGE_BAND;
  const cosSharp = Math.cos(((o.sharpDeg ?? 30) * Math.PI) / 180);
  const P = (i: number): V3 => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
  const slots = slotsOf(m);

  const tris: Tri[] = [];
  slots.forEach((sl, si) => {
    for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
      const src: [number, number, number] = [m.indices[i]!, m.indices[i + 1]!, m.indices[i + 2]!];
      const v: [V3, V3, V3] = [P(src[0]), P(src[1]), P(src[2])];
      const n = unit(cross(sub(v[1], v[0]), sub(v[2], v[0])));
      if (len(n) === 0) continue; // no area: draws nothing
      tris.push({ v, src, n, slot: si });
    }
  });

  // welded edges: which triangles share each
  const key = (p: V3): string => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
  const edgeKey = (a: V3, b: V3): string => {
    const ka = key(a), kb = key(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const byEdge = new Map<string, number[]>();
  tris.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const k = edgeKey(t.v[e]!, t.v[(e + 1) % 3]!);
      const list = byEdge.get(k);
      if (list) list.push(ti);
      else byEdge.set(k, [ti]);
    }
  });

  // coplanar groups (union-find over shared edges with matching normals), and each triangle's sharp edges
  const parent = tris.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  const COPLANAR = Math.cos((0.5 * Math.PI) / 180);
  const own: SharpEdge[][] = tris.map(() => []);
  tris.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const a = t.v[e]!, b = t.v[(e + 1) % 3]!, opposite = t.v[(e + 2) % 3]!;
      const others = (byEdge.get(edgeKey(a, b)) ?? []).filter((x) => x !== ti);
      let inward = unit(cross(t.n, sub(b, a)));
      if (dot(inward, sub(opposite, a)) < 0) inward = scale(inward, -1);
      if (others.length === 0) {
        own[ti]!.push({ a, b, inward, concave: false }); // an open border wears like an edge
        continue;
      }
      let sharp = false, concave = false;
      for (const x of others) {
        const u = tris[x]!;
        if (dot(t.n, u.n) >= COPLANAR) parent[find(ti)] = find(x);
        if (dot(t.n, u.n) >= cosSharp) continue;
        sharp = true;
        // the neighbour's far corner in front of this face: the faces fold up into a valley
        const far = u.v.find((q) => key(q) !== key(a) && key(q) !== key(b)) ?? u.v[0];
        if (dot(t.n, sub(far, a)) > 1e-7) concave = true;
      }
      if (sharp) own[ti]!.push({ a, b, inward, concave });
    }
  });
  const groupEdges = new Map<number, SharpEdge[]>();
  tris.forEach((_, ti) => {
    const g = find(ti);
    const list = groupEdges.get(g);
    if (list) list.push(...own[ti]!);
    else groupEdges.set(g, [...own[ti]!]);
  });

  const signed = (q: V3, e: SharpEdge): number => dot(sub(q, e.a), e.inward);
  /** How near a triangle comes to an edge segment: its corners, edge midpoints and centre. */
  const reach = (t: Tri, e: SharpEdge): number => {
    const [A, B, C] = t.v;
    const probes: V3[] = [A, B, C, scale(add(A, B), 0.5), scale(add(B, C), 0.5), scale(add(C, A), 0.5), scale(add(add(A, B), C), 1 / 3)];
    return Math.min(...probes.map((q) => segmentDistance(q, e.a, e.b)));
  };

  const n = tris.length * 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const edge = new Float32Array(n * EDGE_LINES).fill(FAR), cavity = new Float32Array(n * EDGE_LINES).fill(FAR);
  const idxBySlot: number[][] = slots.map(() => []);
  let vi = 0;
  tris.forEach((t, ti) => {
    const mine = own[ti]!;
    const neighbours = (groupEdges.get(find(ti)) ?? []).filter((e) => {
      if (mine.includes(e)) return false;
      // a line through the triangle would draw a false stripe across it
      if (t.v.some((q) => signed(q, e) < -1e-6)) return false;
      // past the edge's ends the line is not the edge: keep it only while the triangle's centre is beside the edge
      const dir = unit(sub(e.b, e.a));
      const c = scale(add(add(t.v[0], t.v[1]), t.v[2]), 1 / 3);
      const along = dot(sub(c, e.a), dir);
      if (along < -band || along > len(sub(e.b, e.a)) + band) return false;
      return reach(t, e) < band;
    });
    const ranked = [...mine.map((e) => ({ e, d: -1 })), ...neighbours.map((e) => ({ e, d: reach(t, e) })).sort((x, y) => x.d - y.d)];
    const convex = ranked.filter((r) => !r.e.concave).slice(0, EDGE_LINES).map((r) => r.e);
    const concave = ranked.filter((r) => r.e.concave).slice(0, EDGE_LINES).map((r) => r.e);
    for (let c = 0; c < 3; c++) {
      const q = t.v[c]!, s = t.src[c]!;
      pos.set(q, vi * 3);
      const sn: V3 = m.normals ? [m.normals[s * 3]!, m.normals[s * 3 + 1]!, m.normals[s * 3 + 2]!] : t.n;
      nor.set(sn, vi * 3);
      if (m.uvs) uv.set([m.uvs[s * 2]!, m.uvs[s * 2 + 1]!], vi * 2);
      convex.forEach((e, k) => { edge[vi * EDGE_LINES + k] = Math.max(0, signed(q, e)); });
      concave.forEach((e, k) => { cavity[vi * EDGE_LINES + k] = Math.max(0, signed(q, e)); });
      idxBySlot[t.slot]!.push(vi);
      vi += 1;
    }
  });

  const indices: number[] = [];
  const outSlots = slots.map((sl, si) => {
    const start = indices.length;
    indices.push(...idxBySlot[si]!);
    return { name: sl.name, start, count: indices.length - start };
  });
  return { positions: pos, normals: nor, uvs: uv, indices: new Uint32Array(indices), slots: outSlots, edge, cavity };
}

// ------------------------------------------------------------------ curvature

/**
 * The curvature way, for dense meshes: indexed as given. Vertices are welded by position; each gets an area-weighted
 * normal, and the normal curvature toward each neighbour q, k = 2 n.(p - q) / |p - q|^2 (1/m; positive bends away like
 * an edge). The largest and the smallest, each smoothed once over the neighbours, give the first slot of
 * edge = band * (1 - clamp(kmax * band)) and cavity = band * (1 - clamp(-kmin * band)): a rounded edge (or crease) of
 * radius r reads 1/r, so radius `band` or tighter reads as on the edge (in the crease), and flat reads as `band`.
 */
export function curvatureMasks(m: MaskMeshInput, o: MaskMeshOptions = {}): MaskMesh {
  const band = o.band ?? EDGE_BAND;
  const n = m.positions.length / 3;
  const P = (i: number): V3 => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
  const key = (p: V3): string => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
  const weld = new Map<string, number>();
  const id = new Int32Array(n);
  const points: V3[] = [];
  for (let i = 0; i < n; i++) {
    const p = P(i), k = key(p);
    let w = weld.get(k);
    if (w === undefined) {
      w = points.length;
      weld.set(k, w);
      points.push(p);
    }
    id[i] = w;
  }
  const W = points.length;
  const normal: V3[] = points.map(() => [0, 0, 0]);
  const neighbours: Set<number>[] = points.map(() => new Set<number>());
  for (let i = 0; i + 2 < m.indices.length; i += 3) {
    const a = id[m.indices[i]!]!, b = id[m.indices[i + 1]!]!, c = id[m.indices[i + 2]!]!;
    const fn = cross(sub(points[b]!, points[a]!), sub(points[c]!, points[a]!)); // area-weighted
    for (const v of [a, b, c]) normal[v] = add(normal[v]!, fn);
    neighbours[a]!.add(b).add(c);
    neighbours[b]!.add(a).add(c);
    neighbours[c]!.add(a).add(b);
  }
  const kMax = new Float64Array(W), kMin = new Float64Array(W);
  for (let v = 0; v < W; v++) {
    const nv = unit(normal[v]!);
    let hi = 0, lo = 0;
    for (const u of neighbours[v]!) {
      if (u === v) continue;
      const d = sub(points[v]!, points[u]!);
      const l2 = dot(d, d);
      if (l2 < 1e-18) continue;
      const k = (2 * dot(nv, d)) / l2;
      hi = Math.max(hi, k);
      lo = Math.min(lo, k);
    }
    kMax[v] = hi;
    kMin[v] = lo;
  }
  /** One pass of neighbour averaging, so single noisy vertices do not read as edges. */
  const smoothed = (k: Float64Array): Float64Array => {
    const out = new Float64Array(W);
    for (let v = 0; v < W; v++) {
      let s = k[v]!, c = 1;
      for (const u of neighbours[v]!) {
        if (u === v) continue;
        s += k[u]!;
        c += 1;
      }
      out[v] = s / c;
    }
    return out;
  };
  const hiS = smoothed(kMax), loS = smoothed(kMin);
  const c01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x);
  const edge = new Float32Array(n * EDGE_LINES).fill(FAR), cavity = new Float32Array(n * EDGE_LINES).fill(FAR);
  for (let i = 0; i < n; i++) {
    edge[i * EDGE_LINES] = band * (1 - c01(hiS[id[i]!]! * band));
    cavity[i * EDGE_LINES] = band * (1 - c01(-loS[id[i]!]! * band));
  }
  const uvs = m.uvs ? m.uvs.slice() : new Float32Array(n * 2);
  let normals: Float32Array;
  if (m.normals) normals = m.normals.slice();
  else {
    normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) normals.set(unit(normal[id[i]!]!), i * 3);
  }
  return {
    positions: m.positions.slice(),
    normals,
    uvs,
    indices: m.indices.slice(),
    slots: slotsOf(m).map((s) => ({ ...s })),
    edge,
    cavity,
  };
}
