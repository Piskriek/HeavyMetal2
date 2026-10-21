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
  /** How it was built: 'lines' gives every triangle its own vertices; 'curvature' keeps the input's indexing. */
  readonly kind: 'lines' | 'curvature';
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

interface SharpEdge {
  readonly a: V3;
  readonly b: V3;
  /** The owning triangle's in-plane unit direction from the edge into the triangle. */
  readonly inward: V3;
  readonly concave: boolean;
}

/** A sharp edge with the triangle that owns it and its box grown by the band. */
interface Sharp extends SharpEdge {
  readonly owner: number;
  readonly lo: V3;
  readonly hi: V3;
}

/**
 * The lines way. Each triangle gets its own three vertices, carrying signed distances to the lines of up to
 * EDGE_LINES convex and EDGE_LINES concave sharp edges: its own first, then its coplanar group's within `band` that
 * neither cross the triangle nor end well before it, nearest first.
 */
export function edgeLines(m: MaskMeshInput, o: MaskMeshOptions = {}): MaskMesh {
  const band = o.band ?? EDGE_BAND;
  const cosSharp = Math.cos(((o.sharpDeg ?? 30) * Math.PI) / 180);
  const slots = slotsOf(m);
  const X = m.positions;
  // triangles: their corners, slot and unit face normal (zero-area ones draw nothing and are dropped)
  const triSrc: number[] = [], triSlot: number[] = [], triN: number[] = [];
  slots.forEach((sl, si) => {
    for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
      const a = m.indices[i]!, b = m.indices[i + 1]!, c = m.indices[i + 2]!;
      const ux = X[b * 3]! - X[a * 3]!, uy = X[b * 3 + 1]! - X[a * 3 + 1]!, uz = X[b * 3 + 2]! - X[a * 3 + 2]!;
      const vx = X[c * 3]! - X[a * 3]!, vy = X[c * 3 + 1]! - X[a * 3 + 1]!, vz = X[c * 3 + 2]! - X[a * 3 + 2]!;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-12)) continue;
      triSrc.push(a, b, c);
      triSlot.push(si);
      triN.push(nx / l, ny / l, nz / l);
    }
  });
  const T = triSlot.length;

  // welded vertices (positions at 0.01 mm), each keyed once, and the triangles around each welded edge
  const weld = new Int32Array(X.length / 3);
  const ids = new Map<string, number>();
  for (let i = 0; i < weld.length; i++) {
    const k = `${Math.round(X[i * 3]! * 1e5)},${Math.round(X[i * 3 + 1]! * 1e5)},${Math.round(X[i * 3 + 2]! * 1e5)}`;
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size));
    weld[i] = id;
  }
  const W = ids.size;
  const edgeKey = (a: number, b: number): number => {
    const wa = weld[a]!, wb = weld[b]!;
    return wa < wb ? wa * W + wb : wb * W + wa;
  };
  const byEdge = new Map<number, number[]>();
  for (let t = 0; t < T; t++) {
    for (let e = 0; e < 3; e++) {
      const k = edgeKey(triSrc[t * 3 + e]!, triSrc[t * 3 + ((e + 1) % 3)]!);
      const list = byEdge.get(k);
      if (list) list.push(t);
      else byEdge.set(k, [t]);
    }
  }

  // coplanar groups (union-find over shared edges with matching normals), and the sharp edges with their owners
  const parent = new Int32Array(T);
  for (let t = 0; t < T; t++) parent[t] = t;
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  const COPLANAR = Math.cos((0.5 * Math.PI) / 180);
  const ndot = (t: number, u: number): number =>
    triN[t * 3]! * triN[u * 3]! + triN[t * 3 + 1]! * triN[u * 3 + 1]! + triN[t * 3 + 2]! * triN[u * 3 + 2]!;
  const sharps: Sharp[] = [];
  const own: number[][] = Array.from({ length: T }, () => []);
  for (let t = 0; t < T; t++) {
    const n: V3 = [triN[t * 3]!, triN[t * 3 + 1]!, triN[t * 3 + 2]!];
    for (let e = 0; e < 3; e++) {
      const ia = triSrc[t * 3 + e]!, ib = triSrc[t * 3 + ((e + 1) % 3)]!, io = triSrc[t * 3 + ((e + 2) % 3)]!;
      const a: V3 = [X[ia * 3]!, X[ia * 3 + 1]!, X[ia * 3 + 2]!], b: V3 = [X[ib * 3]!, X[ib * 3 + 1]!, X[ib * 3 + 2]!];
      const others = byEdge.get(edgeKey(ia, ib))!;
      let sharp = others.length === 1, concave = false; // an open border wears like an edge
      for (const u of others) {
        if (u === t) continue;
        const d = ndot(t, u);
        if (d >= COPLANAR) parent[find(t)] = find(u);
        if (d >= cosSharp) continue;
        sharp = true;
        // the neighbour's far corner in front of this face: the faces fold up into a valley
        let far = triSrc[u * 3]!;
        for (let k = 0; k < 3; k++) {
          const q = triSrc[u * 3 + k]!;
          if (weld[q] !== weld[ia] && weld[q] !== weld[ib]) far = q;
        }
        if (n[0] * (X[far * 3]! - a[0]) + n[1] * (X[far * 3 + 1]! - a[1]) + n[2] * (X[far * 3 + 2]! - a[2]) > 1e-7) concave = true;
      }
      if (!sharp) continue;
      let inward = unit(cross(n, sub(b, a)));
      if (dot(inward, [X[io * 3]! - a[0], X[io * 3 + 1]! - a[1], X[io * 3 + 2]! - a[2]]) < 0) inward = scale(inward, -1);
      own[t]!.push(sharps.length);
      sharps.push({
        a, b, inward, concave, owner: t,
        lo: [Math.min(a[0], b[0]) - band, Math.min(a[1], b[1]) - band, Math.min(a[2], b[2]) - band],
        hi: [Math.max(a[0], b[0]) + band, Math.max(a[1], b[1]) + band, Math.max(a[2], b[2]) + band],
      });
    }
  }
  const groupEdges = new Map<number, number[]>();
  for (let t = 0; t < T; t++) {
    if (own[t]!.length === 0) continue;
    const g = find(t);
    const list = groupEdges.get(g);
    if (list) list.push(...own[t]!);
    else groupEdges.set(g, [...own[t]!]);
  }

  /** The distance from (px, py, pz) to an edge segment, without allocating. */
  const segDist = (px: number, py: number, pz: number, e: SharpEdge): number => {
    const abx = e.b[0] - e.a[0], aby = e.b[1] - e.a[1], abz = e.b[2] - e.a[2];
    const l2 = abx * abx + aby * aby + abz * abz;
    const s = l2 > 1e-18 ? Math.max(0, Math.min(1, ((px - e.a[0]) * abx + (py - e.a[1]) * aby + (pz - e.a[2]) * abz) / l2)) : 0;
    return Math.hypot(px - e.a[0] - abx * s, py - e.a[1] - aby * s, pz - e.a[2] - abz * s);
  };
  const signed = (px: number, py: number, pz: number, e: SharpEdge): number =>
    (px - e.a[0]) * e.inward[0] + (py - e.a[1]) * e.inward[1] + (pz - e.a[2]) * e.inward[2];

  const n = T * 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const edge = new Float32Array(n * EDGE_LINES).fill(FAR), cavity = new Float32Array(n * EDGE_LINES).fill(FAR);
  const idxBySlot: number[][] = slots.map(() => []);
  // probes: the corners, the edge midpoints and the centre
  const cx = new Float64Array(7), cy = new Float64Array(7), cz = new Float64Array(7);
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < 3; k++) {
      const q = triSrc[t * 3 + k]!, r = triSrc[t * 3 + ((k + 1) % 3)]!;
      cx[k] = X[q * 3]!; cy[k] = X[q * 3 + 1]!; cz[k] = X[q * 3 + 2]!;
      cx[k + 3] = (X[q * 3]! + X[r * 3]!) / 2; cy[k + 3] = (X[q * 3 + 1]! + X[r * 3 + 1]!) / 2; cz[k + 3] = (X[q * 3 + 2]! + X[r * 3 + 2]!) / 2;
    }
    cx[6] = (cx[0]! + cx[1]! + cx[2]!) / 3; cy[6] = (cy[0]! + cy[1]! + cy[2]!) / 3; cz[6] = (cz[0]! + cz[1]! + cz[2]!) / 3;
    const bx0 = Math.min(cx[0]!, cx[1]!, cx[2]!), bx1 = Math.max(cx[0]!, cx[1]!, cx[2]!);
    const by0 = Math.min(cy[0]!, cy[1]!, cy[2]!), by1 = Math.max(cy[0]!, cy[1]!, cy[2]!);
    const bz0 = Math.min(cz[0]!, cz[1]!, cz[2]!), bz1 = Math.max(cz[0]!, cz[1]!, cz[2]!);
    const reach = (e: SharpEdge): number => {
      let d = Infinity;
      for (let k = 0; k < 7; k++) d = Math.min(d, segDist(cx[k]!, cy[k]!, cz[k]!, e));
      return d;
    };
    const near: { readonly e: Sharp; readonly d: number }[] = [];
    for (const i of groupEdges.get(find(t)) ?? []) {
      const e = sharps[i]!;
      if (e.owner === t) continue;
      // boxes first: most of a group's edges are nowhere near this triangle
      if (bx1 < e.lo[0] || bx0 > e.hi[0] || by1 < e.lo[1] || by0 > e.hi[1] || bz1 < e.lo[2] || bz0 > e.hi[2]) continue;
      // a line through the triangle would draw a false stripe across it
      if (signed(cx[0]!, cy[0]!, cz[0]!, e) < -1e-6 || signed(cx[1]!, cy[1]!, cz[1]!, e) < -1e-6 || signed(cx[2]!, cy[2]!, cz[2]!, e) < -1e-6) continue;
      // past the edge's ends the line is not the edge: keep it only while the triangle's centre is beside the edge
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], dz = e.b[2] - e.a[2];
      const L = Math.hypot(dx, dy, dz) || 1;
      const along = ((cx[6]! - e.a[0]) * dx + (cy[6]! - e.a[1]) * dy + (cz[6]! - e.a[2]) * dz) / L;
      if (along < -band || along > L + band) continue;
      const d = reach(e);
      if (d < band) near.push({ e, d });
    }
    near.sort((x, y) => x.d - y.d);
    const convex: Sharp[] = [], concave: Sharp[] = [];
    for (const e of [...own[t]!.map((i) => sharps[i]!), ...near.map((r) => r.e)]) {
      if (e.concave) { if (concave.length < EDGE_LINES) concave.push(e); }
      else if (convex.length < EDGE_LINES) convex.push(e);
    }
    for (let c = 0; c < 3; c++) {
      const s = triSrc[t * 3 + c]!, vi = t * 3 + c;
      const px = X[s * 3]!, py = X[s * 3 + 1]!, pz = X[s * 3 + 2]!;
      pos[vi * 3] = px; pos[vi * 3 + 1] = py; pos[vi * 3 + 2] = pz;
      const N = m.normals ?? null;
      nor[vi * 3] = N ? N[s * 3]! : triN[t * 3]!;
      nor[vi * 3 + 1] = N ? N[s * 3 + 1]! : triN[t * 3 + 1]!;
      nor[vi * 3 + 2] = N ? N[s * 3 + 2]! : triN[t * 3 + 2]!;
      if (m.uvs) { uv[vi * 2] = m.uvs[s * 2]!; uv[vi * 2 + 1] = m.uvs[s * 2 + 1]!; }
      for (let k = 0; k < convex.length; k++) edge[vi * EDGE_LINES + k] = Math.max(0, signed(px, py, pz, convex[k]!));
      for (let k = 0; k < concave.length; k++) cavity[vi * EDGE_LINES + k] = Math.max(0, signed(px, py, pz, concave[k]!));
      idxBySlot[triSlot[t]!]!.push(vi);
    }
  }

  const indices: number[] = [];
  const outSlots = slots.map((sl, si) => {
    const start = indices.length;
    indices.push(...idxBySlot[si]!);
    return { name: sl.name, start, count: indices.length - start };
  });
  return { kind: 'lines', positions: pos, normals: nor, uvs: uv, indices: new Uint32Array(indices), slots: outSlots, edge, cavity };
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
    kind: 'curvature',
    positions: m.positions.slice(),
    normals,
    uvs,
    indices: m.indices.slice(),
    slots: slotsOf(m).map((s) => ({ ...s })),
    edge,
    cavity,
  };
}
