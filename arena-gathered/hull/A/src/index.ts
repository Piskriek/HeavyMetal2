export type V3 = [number, number, number];
export interface Hull { vertices: V3[]; faces: [number, number, number][] }
export interface Box { centre: V3; half: V3; axes: [V3, V3, V3] }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3): number => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => { const l = len(a); return l > 0 ? scale(a, 1 / l) : [0, 0, 0]; };

function cloudSize(points: readonly V3[]): number {
  let s = 0;
  const first = points[0];
  if (!first) return 0;
  for (const p of points) for (let i = 0; i < 3; i++) s = Math.max(s, Math.abs((p[i] as number) - (first[i] as number)));
  return s;
}

function dedupe(points: readonly V3[]): V3[] {
  const seen = new Set<string>();
  const out: V3[] = [];
  for (const p of points) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) continue;
    const k = `${p[0]},${p[1]},${p[2]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([p[0], p[1], p[2]]);
  }
  return out;
}

interface Face { a: number; b: number; c: number; n: V3; d: number; outside: number[]; alive: boolean }

function makeFace(pts: V3[], a: number, b: number, c: number): Face {
  const pa = pts[a] as V3, pb = pts[b] as V3, pc = pts[c] as V3;
  const n = norm(cross(sub(pb, pa), sub(pc, pa)));
  return { a, b, c, n, d: dot(n, pa), outside: [], alive: true };
}
const faceDist = (f: Face, p: V3): number => dot(f.n, p) - f.d;

/** 2D hull (monotone chain) of coplanar points; returns indices in CCW order about normal `nrm`. */
function planarHull(pts: V3[], origin: V3, nrm: V3): number[] {
  let u = cross(nrm, Math.abs(nrm[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  u = norm(u);
  const v = cross(nrm, u);
  const proj = pts.map((p, i) => ({ i, x: dot(sub(p, origin), u), y: dot(sub(p, origin), v) }));
  proj.sort((p, q) => p.x - q.x || p.y - q.y);
  const cr = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof proj = [], upper: typeof proj = [];
  for (const p of proj) {
    while (lower.length >= 2 && cr(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = proj.length - 1; i >= 0; i--) {
    const p = proj[i]!;
    while (upper.length >= 2 && cr(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return [...lower, ...upper].map((p) => p.i);
}

export function hull(points: readonly V3[]): Hull {
  const pts = dedupe(points);
  const n = pts.length;
  if (n === 0) return { vertices: [], faces: [] };
  const eps = 1e-9 * Math.max(cloudSize(pts), 1e-300);
  // extreme points along x (tie-break by y, z)
  let i0 = 0, i1 = 0;
  for (let i = 1; i < n; i++) {
    const p = pts[i]!, lo = pts[i0]!, hi = pts[i1]!;
    if (p[0] < lo[0] || (p[0] === lo[0] && (p[1] < lo[1] || (p[1] === lo[1] && p[2] < lo[2])))) i0 = i;
    if (p[0] > hi[0] || (p[0] === hi[0] && (p[1] > hi[1] || (p[1] === hi[1] && p[2] > hi[2])))) i1 = i;
  }
  // make sure i0,i1 are the farthest apart pair among extremes per axis
  let best = len(sub(pts[i1]!, pts[i0]!));
  for (let ax = 0; ax < 3; ax++) {
    let lo = 0, hi = 0;
    for (let i = 1; i < n; i++) {
      if ((pts[i]![ax] as number) < (pts[lo]![ax] as number)) lo = i;
      if ((pts[i]![ax] as number) > (pts[hi]![ax] as number)) hi = i;
    }
    const d = len(sub(pts[hi]!, pts[lo]!));
    if (d > best) { best = d; i0 = lo; i1 = hi; }
  }
  if (best <= eps) return { vertices: [pts[i0]!], faces: [] };
  const p0 = pts[i0]!, p1 = pts[i1]!;
  const dir = norm(sub(p1, p0));
  // farthest from the line
  let i2 = -1, dmax = eps;
  for (let i = 0; i < n; i++) {
    const d = len(cross(dir, sub(pts[i]!, p0)));
    if (d > dmax) { dmax = d; i2 = i; }
  }
  if (i2 < 0) {
    // collinear: the two endpoints
    let lo = i0, hi = i0, tlo = 0, thi = 0;
    for (let i = 0; i < n; i++) {
      const t = dot(sub(pts[i]!, p0), dir);
      if (t < tlo) { tlo = t; lo = i; }
      if (t > thi) { thi = t; hi = i; }
    }
    return { vertices: [pts[lo]!, pts[hi]!], faces: [] };
  }
  const nrm = norm(cross(sub(p1, p0), sub(pts[i2]!, p0)));
  // farthest from the plane
  let i3 = -1; dmax = eps;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(dot(nrm, sub(pts[i]!, p0)));
    if (d > dmax) { dmax = d; i3 = i; }
  }
  if (i3 < 0) {
    const idx = planarHull(pts, p0, nrm);
    return { vertices: idx.map((i) => pts[i]!), faces: [] };
  }
  // initial tetrahedron
  const faces: Face[] = [];
  const edges = new Map<number, number>(); // directed edge a*n+b -> face index
  const addFace = (a: number, b: number, c: number): number => {
    const f = makeFace(pts, a, b, c);
    const id = faces.length;
    faces.push(f);
    edges.set(a * n + b, id); edges.set(b * n + c, id); edges.set(c * n + a, id);
    return id;
  };
  const killFace = (id: number) => {
    const f = faces[id]!;
    f.alive = false;
    edges.delete(f.a * n + f.b); edges.delete(f.b * n + f.c); edges.delete(f.c * n + f.a);
  };
  const centroid = scale(add(add(p0, p1), add(pts[i2]!, pts[i3]!)), 0.25);
  const tet: [number, number, number][] = [[i0, i1, i2], [i0, i2, i3], [i0, i3, i1], [i1, i3, i2]];
  for (const [a, b, c] of tet) {
    const f = makeFace(pts, a, b, c);
    if (faceDist(f, centroid) > 0) addFace(a, c, b); else addFace(a, b, c);
  }
  const assign = (idx: number, candidates: number[]) => {
    for (const fi of candidates) {
      const f = faces[fi]!;
      if (f.alive && faceDist(f, pts[idx]!) > eps) { f.outside.push(idx); return; }
    }
  };
  const used = new Set<number>([i0, i1, i2, i3]);
  const all = [0, 1, 2, 3];
  for (let i = 0; i < n; i++) if (!used.has(i)) assign(i, all);

  let guard = 0;
  for (;;) {
    if (++guard > 100000) break;
    let fi = -1;
    for (let i = 0; i < faces.length; i++) if (faces[i]!.alive && faces[i]!.outside.length > 0) { fi = i; break; }
    if (fi < 0) break;
    const f = faces[fi]!;
    let pi = f.outside[0]!, pd = -Infinity;
    for (const idx of f.outside) { const d = faceDist(f, pts[idx]!); if (d > pd) { pd = d; pi = idx; } }
    const p = pts[pi]!;
    // visible faces by BFS
    const visible: number[] = [fi];
    const visSet = new Set<number>([fi]);
    for (let k = 0; k < visible.length; k++) {
      const g = faces[visible[k]!]!;
      for (const [a, b] of [[g.a, g.b], [g.b, g.c], [g.c, g.a]] as [number, number][]) {
        const nb = edges.get(b * n + a);
        if (nb === undefined || visSet.has(nb)) continue;
        if (faceDist(faces[nb]!, p) > eps) { visSet.add(nb); visible.push(nb); }
      }
    }
    // horizon edges
    const horizon: [number, number][] = [];
    const orphans: number[] = [];
    for (const vi of visible) {
      const g = faces[vi]!;
      for (const [a, b] of [[g.a, g.b], [g.b, g.c], [g.c, g.a]] as [number, number][]) {
        const nb = edges.get(b * n + a);
        if (nb === undefined || !visSet.has(nb)) horizon.push([a, b]);
      }
      for (const o of g.outside) if (o !== pi) orphans.push(o);
    }
    for (const vi of visible) killFace(vi);
    const fresh: number[] = [];
    for (const [a, b] of horizon) fresh.push(addFace(a, b, pi));
    for (const o of orphans) assign(o, fresh);
  }
  // compact
  const remap = new Map<number, number>();
  const vertices: V3[] = [];
  const outFaces: [number, number, number][] = [];
  const id = (i: number): number => {
    let r = remap.get(i);
    if (r === undefined) { r = vertices.length; remap.set(i, r); vertices.push(pts[i]!); }
    return r;
  };
  for (const f of faces) if (f.alive) outFaces.push([id(f.a), id(f.b), id(f.c)]);
  return { vertices, faces: outFaces };
}

export function simplify(h: Hull, maxVerts: number): Hull {
  const vs = h.vertices;
  if (vs.length <= maxVerts) return { vertices: vs.map((v) => [v[0], v[1], v[2]]), faces: h.faces.map((f) => [f[0], f[1], f[2]]) };
  if (maxVerts <= 0) return { vertices: [], faces: [] };
  let c: V3 = [0, 0, 0];
  for (const v of vs) c = add(c, v);
  c = scale(c, 1 / vs.length);
  let start = 0, bd = -1;
  for (let i = 0; i < vs.length; i++) { const d = len(sub(vs[i]!, c)); if (d > bd) { bd = d; start = i; } }
  const chosen = [start];
  const minD = vs.map((v) => len(sub(v, vs[start]!)));
  while (chosen.length < maxVerts) {
    let bi = -1; bd = -1;
    for (let i = 0; i < vs.length; i++) if (minD[i]! > bd) { bd = minD[i]!; bi = i; }
    if (bi < 0 || bd <= 0) break;
    chosen.push(bi);
    for (let i = 0; i < vs.length; i++) minD[i] = Math.min(minD[i]!, len(sub(vs[i]!, vs[bi]!)));
  }
  return hull(chosen.map((i) => vs[i]!));
}

export function volume(h: Hull): number {
  let v = 0;
  for (const [a, b, c] of h.faces) {
    const pa = h.vertices[a], pb = h.vertices[b], pc = h.vertices[c];
    if (!pa || !pb || !pc) continue;
    v += dot(pa, cross(pb, pc));
  }
  return Math.abs(v) / 6;
}

export function contains(h: Hull, p: V3, eps?: number): boolean {
  const vs = h.vertices;
  if (vs.length === 0) return false;
  const e = eps ?? 1e-9 * Math.max(cloudSize(vs), 1e-300);
  if (h.faces.length > 0) {
    for (const [a, b, c] of h.faces) {
      const pa = vs[a], pb = vs[b], pc = vs[c];
      if (!pa || !pb || !pc) continue;
      const nrm = norm(cross(sub(pb, pa), sub(pc, pa)));
      if (dot(nrm, sub(p, pa)) > e) return false;
    }
    return true;
  }
  if (vs.length === 1) return len(sub(p, vs[0]!)) <= e;
  if (vs.length === 2) {
    const a = vs[0]!, b = vs[1]!, ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-300)));
    return len(sub(p, add(a, scale(ab, t)))) <= e;
  }
  // planar polygon (CCW about its normal)
  let nrm: V3 = [0, 0, 0];
  for (let i = 0; i < vs.length; i++) nrm = add(nrm, cross(vs[i]!, vs[(i + 1) % vs.length]!));
  nrm = norm(nrm);
  if (Math.abs(dot(nrm, sub(p, vs[0]!))) > e) return false;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!, b = vs[(i + 1) % vs.length]!;
    const inward = cross(nrm, sub(b, a));
    if (dot(norm(inward), sub(p, a)) < -e) return false;
  }
  return true;
}

export function aabb(points: readonly V3[]): Box {
  const axes: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (points.length === 0) return { centre: [0, 0, 0], half: [0, 0, 0], axes };
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i] as number, p[i] as number);
    hi[i] = Math.max(hi[i] as number, p[i] as number);
  }
  return { centre: scale(add(lo, hi), 0.5), half: scale(sub(hi, lo), 0.5), axes };
}

/** Eigenvectors of a symmetric 3x3 matrix by Jacobi rotations (columns of the result). */
function eigenvectors(m: number[][]): [V3, V3, V3] {
  const a = m.map((r) => r.slice());
  const v: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p]![q]! * a[p]![q]!;
    if (off < 1e-30) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      const apq = a[p]![q]!;
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k]![p]!, akq = a[k]![q]!;
        a[k]![p] = c * akp - s * akq; a[k]![q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p]![k]!, aqk = a[q]![k]!;
        a[p]![k] = c * apk - s * aqk; a[q]![k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k]![p]!, vkq = v[k]![q]!;
        v[k]![p] = c * vkp - s * vkq; v[k]![q] = s * vkp + c * vkq;
      }
    }
  }
  const col = (j: number): V3 => norm([v[0]![j]!, v[1]![j]!, v[2]![j]!]);
  const order = [0, 1, 2].sort((i, j) => a[j]![j]! - a[i]![i]!);
  const e0 = col(order[0]!), e1 = col(order[1]!);
  return [e0, e1, cross(e0, e1)];
}

export function obb(points: readonly V3[]): Box {
  if (points.length === 0) return aabb(points);
  let c: V3 = [0, 0, 0];
  for (const p of points) c = add(c, p);
  c = scale(c, 1 / points.length);
  const cov: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i]![j] = cov[i]![j]! + (d[i] as number) * (d[j] as number);
  }
  const axes = eigenvectors(cov);
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) {
    const t = dot(p, axes[i] as V3);
    lo[i] = Math.min(lo[i] as number, t); hi[i] = Math.max(hi[i] as number, t);
  }
  let centre: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) centre = add(centre, scale(axes[i] as V3, ((lo[i] as number) + (hi[i] as number)) / 2));
  return { centre, half: scale(sub(hi, lo), 0.5), axes };
}

interface IBox { min: V3; max: V3 }
const boxVol = (b: IBox): number => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);

export function voxelBoxes(cells: Uint8Array, sx: number, sy: number, sz: number, maxBoxes: number): IBox[] {
  const at = (x: number, y: number, z: number): boolean => (cells[x + y * sx + z * sx * sy] ?? 0) !== 0;
  const covered = new Uint8Array(sx * sy * sz);
  const free = (x: number, y: number, z: number): boolean => at(x, y, z) && covered[x + y * sx + z * sx * sy] === 0;
  const grow = (x0: number, y0: number, z0: number): IBox => {
    let x1 = x0 + 1;
    while (x1 < sx && free(x1, y0, z0)) x1++;
    let y1 = y0 + 1;
    outerY: while (y1 < sy) {
      for (let x = x0; x < x1; x++) if (!free(x, y1, z0)) break outerY;
      y1++;
    }
    let z1 = z0 + 1;
    outerZ: while (z1 < sz) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!free(x, y, z1)) break outerZ;
      z1++;
    }
    return { min: [x0, y0, z0], max: [x1, y1, z1] };
  };
  const boxes: IBox[] = [];
  for (;;) {
    let best: IBox | null = null;
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      if (!free(x, y, z)) continue;
      const b = grow(x, y, z);
      if (!best || boxVol(b) > boxVol(best)) best = b;
    }
    if (!best) break;
    boxes.push(best);
    for (let z = best.min[2]; z < best.max[2]; z++) for (let y = best.min[1]; y < best.max[1]; y++)
      for (let x = best.min[0]; x < best.max[0]; x++) covered[x + y * sx + z * sx * sy] = 1;
  }
  const limit = Math.max(1, Math.floor(maxBoxes));
  while (boxes.length > limit) {
    let si = 0;
    for (let i = 1; i < boxes.length; i++) if (boxVol(boxes[i]!) < boxVol(boxes[si]!)) si = i;
    const s = boxes[si]!;
    let bj = -1, bv = Infinity;
    for (let j = 0; j < boxes.length; j++) {
      if (j === si) continue;
      const o = boxes[j]!;
      const u: IBox = {
        min: [Math.min(s.min[0], o.min[0]), Math.min(s.min[1], o.min[1]), Math.min(s.min[2], o.min[2])],
        max: [Math.max(s.max[0], o.max[0]), Math.max(s.max[1], o.max[1]), Math.max(s.max[2], o.max[2])],
      };
      const cost = boxVol(u) - boxVol(s) - boxVol(o);
      if (cost < bv) { bv = cost; bj = j; }
    }
    const o = boxes[bj]!;
    const merged: IBox = {
      min: [Math.min(s.min[0], o.min[0]), Math.min(s.min[1], o.min[1]), Math.min(s.min[2], o.min[2])],
      max: [Math.max(s.max[0], o.max[0]), Math.max(s.max[1], o.max[1]), Math.max(s.max[2], o.max[2])],
    };
    const hiIdx = Math.max(si, bj), loIdx = Math.min(si, bj);
    boxes.splice(hiIdx, 1); boxes.splice(loIdx, 1);
    boxes.push(merged);
  }
  return boxes;
}