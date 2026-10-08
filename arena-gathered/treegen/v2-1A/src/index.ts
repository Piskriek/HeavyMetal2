import * as THREE from 'three';

/*
 * @hm/treegen: real trees for the terraforming game.
 *
 * A tree is grown in three steps, all pure and seeded:
 *  1. Skeleton: a straight leader is laid up the trunk, then space colonisation
 *     (attraction points sampled in the species' crown envelope, branches growing
 *     towards them) fills the crown. A limb keeps its own order and may turn only
 *     a little per segment and a bounded total, so limbs never curl into loops.
 *  2. Radii: the pipe model. Every tip carries one unit of cross-section and a
 *     node carries the sum of its subtree, so a parent always carries its children.
 *  3. Geometry: bark tubes (UVs: u around, v along the limb in metres) and leaf cards
 *     (quads with the whole leaf texture) clustered at the twig tips. The detail
 *     level only changes how the same skeleton is drawn, never where it is.
 */

export type Species = 'pine' | 'oak' | 'birch';

export interface TreeOptions {
  readonly species: Species;
  readonly seed: number;
  readonly height: number;
  readonly detail: 0 | 1 | 2 | 3;
}

export interface Branch {
  readonly id: number;
  readonly parent: number | null;
  readonly order: number;
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
  readonly r0: number;
  readonly r1: number;
}

export interface Tree {
  readonly species: Species;
  readonly branches: readonly Branch[];
  readonly bark: THREE.BufferGeometry;
  readonly leaves: THREE.BufferGeometry;
  readonly height: number;
  readonly radius: number;
  readonly triangles: number;
}

/** Triangle budget for detail 0..3. */
export const BUDGET: readonly [number, number, number, number] = [400, 2000, 8000, 24000];

type V3 = [number, number, number];

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const dist = (a: V3, b: V3): number => len(sub(a, b));

function unitOr(a: V3, fallback: V3): V3 {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : fallback;
}

function unit(a: V3): V3 {
  return unitOr(a, [0, 1, 0]);
}

function angleBetween(a: V3, b: V3): number {
  return Math.acos(clamp(dot(a, b), -1, 1));
}

/* ---------- seeded randomness (no Math.random, no Date) ---------- */

function mixSeed(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: a small, fast, seeded generator returning floats in [0, 1). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPECIES_ID: Record<Species, number> = { pine: 1, oak: 2, birch: 3 };

/* ---------- species ---------- */

type Envelope =
  | { readonly kind: 'cone'; readonly y0: number; readonly y1: number; readonly r: number }
  | { readonly kind: 'ellipsoid'; readonly cy: number; readonly rx: number; readonly ry: number };

interface Spec {
  readonly trunkBase: number; // trunk radius / height
  readonly leaderTop: number; // straight leader laid up before growth, / height
  readonly step: number; // segment length / height
  readonly attractors: number;
  readonly kill: number; // kill distance in steps
  readonly cluster: number; // leaf cluster radius / height
  readonly blobs: number; // detail-0 crown blobs
  readonly trunkSides: number; // side shoots allowed from each straight-leader node
  readonly inertia: number; // how strongly a limb keeps its heading
  readonly up: number; // upward pull on continuing segments
  readonly sideUp: number; // upward pull on side shoots
  readonly droop: number; // downward pull on twigs (order 2+)
  readonly pitch1: readonly [number, number]; // degrees: elevation range of order-1 shoots
  readonly pitch2: readonly [number, number]; // degrees: elevation range of order-2+ shoots
  readonly envelope: Envelope;
}

const SPEC: Record<Species, Spec> = {
  pine: {
    trunkBase: 0.02,
    leaderTop: 0.95,
    step: 0.065,
    attractors: 380,
    kill: 1.1,
    cluster: 0.065,
    trunkSides: 1,
    blobs: 4,
    inertia: 0.9,
    up: 0.12,
    sideUp: 0.2,
    droop: 0,
    pitch1: [-7, 12],
    pitch2: [-25, 30],
    envelope: { kind: 'cone', y0: 0.22, y1: 0.97, r: 0.3 },
  },
  oak: {
    trunkBase: 0.026,
    leaderTop: 0.3,
    step: 0.075,
    attractors: 450,
    kill: 1.4,
    cluster: 0.075,
    trunkSides: 6,
    blobs: 5,
    inertia: 0.9,
    up: 0.2,
    sideUp: 0.5,
    droop: 0,
    pitch1: [-20, 50],
    pitch2: [-35, 65],
    envelope: { kind: 'ellipsoid', cy: 0.64, rx: 0.44, ry: 0.34 },
  },
  birch: {
    trunkBase: 0.009,
    leaderTop: 0.9,
    step: 0.06,
    attractors: 380,
    kill: 1.2,
    cluster: 0.055,
    trunkSides: 1,
    blobs: 4,
    inertia: 0.9,
    up: 0.2,
    sideUp: 0.35,
    droop: 0.5,
    pitch1: [-12, 40],
    pitch2: [-80, 15],
    envelope: { kind: 'ellipsoid', cy: 0.6, rx: 0.2, ry: 0.38 },
  },
};

/* ---------- growth limits ---------- */

const MAX_TURN = rad(14); // radians a continuing segment may turn
const BEND_MAX = rad(90); // radians a whole limb may turn in total
const MAX_NODES = 420;
const MAX_NODES_OK = 340;
const MIN_NODES = 60;
const MAX_ITER = 90;
const SIDES: readonly [number, number, number, number] = [3, 5, 8, 12];
const MAX_ORDER: readonly [number, number, number, number] = [1, 2, 3, 1000];

/* ---------- skeleton (space colonisation) ---------- */

interface SNode {
  p: V3; // position in metres, before the final scale
  parent: number; // -1 for the root
  order: number;
  d: V3; // unit direction of the segment that ends here
  bend: number; // turning accumulated along this limb
  leader: boolean; // already has a continuing child
  sides: number; // side shoots already grown from this node
}

const SIDE_CAP = 3; // side shoots per node on a side limb

function rotateToward(from: V3, to: V3, ang: number): V3 {
  const c = clamp(dot(from, to), -1, 1);
  const p = sub(to, scale(from, c));
  const pl = len(p);
  if (pl < 1e-9) return from;
  const q = scale(p, 1 / pl);
  return unit(add(scale(from, Math.cos(ang)), scale(q, Math.sin(ang))));
}

function clampPitch(d: V3, range: readonly [number, number]): V3 {
  const lo = rad(range[0]);
  const hi = rad(range[1]);
  const e = Math.asin(clamp(d[1], -1, 1));
  const e2 = clamp(e, lo, hi);
  if (e2 === e) return d;
  const hl = Math.hypot(d[0], d[2]);
  const hx = hl > 1e-9 ? d[0] / hl : 1;
  const hz = hl > 1e-9 ? d[2] / hl : 0;
  return [hx * Math.cos(e2), Math.sin(e2), hz * Math.cos(e2)];
}

function sample(env: Envelope, h: number, rnd: () => number): V3 {
  if (env.kind === 'cone') {
    const base = env.y0 * h;
    const top = env.y1 * h;
    const y = base + (top - base) * rnd();
    const rMax = (env.r * h * (top - y)) / (top - base);
    const a = TAU * rnd();
    const r = rMax * Math.sqrt(rnd());
    return [r * Math.cos(a), y, r * Math.sin(a)];
  }
  for (;;) {
    const x = 2 * rnd() - 1;
    const y = 2 * rnd() - 1;
    const z = 2 * rnd() - 1;
    if (x * x + y * y + z * z <= 1) {
      return [x * env.rx * h, (env.cy + y * env.ry) * h, z * env.rx * h];
    }
  }
}

function grow(species: Species, h: number, seed: number, dkScale: number): SNode[] {
  const sp = SPEC[species];
  const rnd = prng(mixSeed(seed, 1));
  const L = sp.step * h;
  const dk = sp.kill * L * dkScale;
  const dk2 = dk * dk;
  const di = Math.max(3 * L, 0.4 * h);
  const di2 = di * di;
  const minY = 0.03 * h;
  const pitch1: readonly [number, number] = [rad(sp.pitch1[0]), rad(sp.pitch1[1])];
  const pitch2: readonly [number, number] = [rad(sp.pitch2[0]), rad(sp.pitch2[1])];

  // Node 0 is the ground; the straight leader is laid up to the leader height.
  const nodes: SNode[] = [{ p: [0, 0, 0], parent: -1, order: 0, d: [0, 1, 0], bend: 0, leader: true, sides: 0 }];
  const trunk = Math.max(1, Math.round((sp.leaderTop * h) / L));
  for (let k = 1; k <= trunk; k++) {
    nodes.push({ p: [0, k * L, 0], parent: k - 1, order: 0, d: [0, 1, 0], bend: 0, leader: k < trunk, sides: 0 });
  }

  let att: V3[] = [];
  for (let i = 0; i < sp.attractors; i++) att.push(sample(sp.envelope, h, rnd));

  for (let iter = 0; iter < MAX_ITER && att.length > 0 && nodes.length < MAX_NODES; iter++) {
    const n = nodes.length;
    const acc: V3[] = [];
    const cnt: number[] = [];
    for (let i = 0; i < n; i++) {
      acc.push([0, 0, 0]);
      cnt.push(0);
    }

    // Each attraction point pulls on its nearest node within the influence distance.
    let pulled = false;
    for (const a of att) {
      let best = -1;
      let bd = di2;
      for (let i = 1; i < n; i++) {
        const q = nodes[i]!.p;
        const dx = a[0] - q[0];
        const dy = a[1] - q[1];
        const dz = a[2] - q[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bd) {
          bd = d2;
          best = i;
        }
      }
      if (best < 0 || bd < 1e-12) continue;
      const q = nodes[best]!.p;
      const inv = 1 / Math.sqrt(bd);
      const s = acc[best]!;
      s[0] += (a[0] - q[0]) * inv;
      s[1] += (a[1] - q[1]) * inv;
      s[2] += (a[2] - q[2]) * inv;
      cnt[best] = (cnt[best] ?? 0) + 1;
      pulled = true;
    }
    if (!pulled) break;

    // Each pulled node grows one segment: the leader continues its limb (bounded turn),
    // every further child is a side shoot, one order higher, with a bounded elevation.
    let created = 0;
    for (let i = 1; i < n && nodes.length < MAX_NODES; i++) {
      if ((cnt[i] ?? 0) === 0) continue;
      const node = nodes[i]!;
      const pull = unitOr(acc[i]!, node.d);
      let dir: V3;
      let order: number;
      let bend: number;
      if (!node.leader) {
        const droop = node.order >= 2 ? sp.droop : 0;
        const want = unitOr(add(add(pull, scale(node.d, sp.inertia)), [0, sp.up - droop, 0]), node.d);
        const room = clamp(BEND_MAX - node.bend, 0, MAX_TURN);
        const ang = angleBetween(node.d, want);
        dir = ang > room ? rotateToward(node.d, want, room) : want;
        bend = node.bend + Math.min(ang, room);
        order = node.order;
      } else {
        // Few side shoots per node, so the straight trunk carries whorls, not a bottlebrush.
        if (node.sides >= (node.order === 0 ? sp.trunkSides : SIDE_CAP)) continue;
        order = node.order + 1;
        const want = unitOr(add(add(pull, scale(node.d, 0.3)), [0, sp.sideUp, 0]), node.d);
        dir = clampPitch(want, order === 1 ? pitch1 : pitch2);
        bend = 0;
      }
      const p = add(node.p, scale(dir, L));
      if (p[1] < minY) continue;
      if (node.leader && order === node.order + 1) node.sides += 1;
      node.leader = true;
      nodes.push({ p, parent: i, order, d: dir, bend, leader: false, sides: 0 });
      created += 1;
    }
    // Nothing grew, so nothing will change on the next pass either.
    if (created === 0) break;

    // Attraction points that a node has reached are used up.
    att = att.filter((a) => {
      for (const node of nodes) {
        const dx = a[0] - node.p[0];
        const dy = a[1] - node.p[1];
        const dz = a[2] - node.p[2];
        if (dx * dx + dy * dy + dz * dz < dk2) return false;
      }
      return true;
    });
  }
  return nodes;
}

/** Grows the skeleton, adjusting the kill distance until the node count is in range. */
function skeleton(species: Species, h: number, seed: number): SNode[] {
  let f = 1;
  let nodes = grow(species, h, seed, f);
  for (let k = 0; k < 3; k++) {
    if (nodes.length > MAX_NODES_OK) f *= 1.3;
    else if (nodes.length < MIN_NODES) f *= 0.8;
    else break;
    nodes = grow(species, h, seed, f);
  }
  return nodes;
}

/* ---------- geometry ---------- */

class Soup {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];

  get triangles(): number {
    return this.pos.length / 9;
  }

  vert(p: V3, n: V3, u: number, v: number): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
  }

  /** A triangle with one face normal on all three corners (flat shaded). */
  flat(a: V3, b: V3, c: V3, u0: number, v0: number, u1: number, v1: number, u2: number, v2: number): void {
    const n = unit(cross(sub(b, a), sub(c, a)));
    this.vert(a, n, u0, v0);
    this.vert(b, n, u1, v1);
    this.vert(c, n, u2, v2);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

interface RingPoint {
  readonly p: V3;
  readonly n: V3;
}

function ringPoint(c: V3, r: number, s1: V3, s2: V3, theta: number): RingPoint {
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const n: V3 = [s1[0] * cs + s2[0] * sn, s1[1] * cs + s2[1] * sn, s1[2] * cs + s2[2] * sn];
  return { p: [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r], n };
}

/** A tapered tube from A (radius rA) to B (radius rB). Front faces point outwards. */
function tube(
  soup: Soup,
  A: V3,
  B: V3,
  rA: number,
  rB: number,
  sides: number,
  vA: number,
  vB: number,
  flat: boolean,
  rep: number,
): void {
  const d = unit(sub(B, A));
  const ref: V3 = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const s1 = unit(cross(d, ref));
  const s2 = cross(s1, d);
  for (let j = 0; j < sides; j++) {
    const t0 = (TAU * j) / sides;
    const t1 = (TAU * (j + 1)) / sides;
    const a0 = ringPoint(A, rA, s1, s2, t0);
    const a1 = ringPoint(A, rA, s1, s2, t1);
    const b0 = ringPoint(B, rB, s1, s2, t0);
    const b1 = ringPoint(B, rB, s1, s2, t1);
    const u0 = (rep * j) / sides;
    const u1 = (rep * (j + 1)) / sides;
    if (flat) {
      soup.flat(a0.p, b0.p, b1.p, u0, vA, u0, vB, u1, vB);
      soup.flat(a0.p, b1.p, a1.p, u0, vA, u1, vB, u1, vA);
    } else {
      soup.vert(a0.p, a0.n, u0, vA);
      soup.vert(b0.p, b0.n, u0, vB);
      soup.vert(b1.p, b1.n, u1, vB);
      soup.vert(a0.p, a0.n, u0, vA);
      soup.vert(b1.p, b1.n, u1, vB);
      soup.vert(a1.p, a1.n, u1, vA);
    }
  }
}

/* Leaf cards: quads in clusters at the twig tips. */

interface Card {
  readonly c: V3; // centre
  readonly e1: V3; // half-extent along the card's first axis
  readonly e2: V3; // half-extent along the second axis
  readonly n: V3; // unit normal
}

function sphereDir(rnd: () => number): V3 {
  const z = 2 * rnd() - 1;
  const a = TAU * rnd();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), r * Math.sin(a), z];
}

function makeCard(rnd: () => number, centre: V3, R: number): Card {
  const c = add(centre, scale(sphereDir(rnd), R * 0.7 * Math.cbrt(rnd())));
  let n = sphereDir(rnd);
  if (n[1] < -0.2) n = scale(n, -1);
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const a = unit(cross(ref, n));
  const b = cross(n, a);
  const t = TAU * rnd();
  const e1 = add(scale(a, Math.cos(t)), scale(b, Math.sin(t)));
  const e2 = cross(n, e1);
  const hs = R * (0.42 + 0.2 * rnd());
  return { c, e1: scale(e1, hs), e2: scale(e2, hs), n };
}

function cardQuad(soup: Soup, k: Card): void {
  const a = sub(sub(k.c, k.e1), k.e2);
  const b = sub(add(k.c, k.e1), k.e2);
  const q = add(add(k.c, k.e1), k.e2);
  const d = add(sub(k.c, k.e1), k.e2);
  soup.vert(a, k.n, 0, 0);
  soup.vert(b, k.n, 1, 0);
  soup.vert(q, k.n, 1, 1);
  soup.vert(a, k.n, 0, 0);
  soup.vert(q, k.n, 1, 1);
  soup.vert(d, k.n, 0, 1);
}

/* Detail-0 crown blobs: faceted icosahedra. */

const ICO_RAW: V3[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const ICO_V: V3[] = ICO_RAW.map((v) => unit(v));
const ICO_F: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function addBlob(soup: Soup, c: V3, R: number, rnd: () => number): void {
  const v = ICO_V.map((u) => add(c, scale(u, R * (0.85 + 0.25 * rnd()))));
  for (const [i, j, k] of ICO_F) {
    const a = v[i]!;
    let b = v[j]!;
    let d = v[k]!;
    const mid = scale(add(add(a, b), d), 1 / 3);
    if (dot(cross(sub(b, a), sub(d, a)), sub(mid, c)) < 0) {
      const t = b;
      b = d;
      d = t;
    }
    soup.flat(a, b, d, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
  }
}

/** Groups the tips (already sorted by height) into bands, one blob per band. */
function addBlobs(
  soup: Soup,
  tipsByY: readonly number[],
  P: readonly V3[],
  cr: number,
  h: number,
  count: number,
  rnd: () => number,
): void {
  const T = tipsByY.length;
  for (let g = 0; g < count; g++) {
    const lo = Math.floor((g * T) / count);
    const hi = Math.floor(((g + 1) * T) / count);
    const group = tipsByY.slice(lo, hi);
    if (group.length === 0) continue;
    let c: V3 = [0, 0, 0];
    for (const t of group) c = add(c, P[t]!);
    c = scale(c, 1 / group.length);
    let reach = 0.5 * cr;
    for (const t of group) reach = Math.max(reach, dist(P[t]!, c));
    const R = Math.max(0.9 * cr, Math.min(reach + 0.8 * cr, h - c[1]));
    addBlob(soup, c, R, rnd);
  }
}

/* ---------- the tree ---------- */

export function growTree(o: TreeOptions): Tree {
  const h = o.height > 0 ? o.height : 1;
  const sp = SPEC[o.species];
  const seed = mixSeed(Math.floor(o.seed) | 0, SPECIES_ID[o.species]);
  const grown = skeleton(o.species, h, seed);
  const N = grown.length;

  // Children count and tips (the twig ends that carry leaf clusters).
  const kids: number[] = new Array<number>(N).fill(0);
  for (let i = 1; i < N; i++) {
    const par = grown[i]!.parent;
    kids[par] = (kids[par] ?? 0) + 1;
  }
  const tips: number[] = [];
  for (let i = 1; i < N; i++) if ((kids[i] ?? 0) === 0) tips.push(i);

  // Scale the skeleton so that the highest cluster tops out at h.
  const cr0 = sp.cluster * h;
  let top = 0;
  for (const n of grown) top = Math.max(top, n.p[1]);
  for (const t of tips) top = Math.max(top, grown[t]!.p[1] + 1.5 * cr0);
  const s = h / top;
  const P: V3[] = grown.map((n) => scale(n.p, s));
  const cr = cr0 * s;

  // Pipe model: area is the number of tips above a node; radius = sqrt(area) * k.
  const area: number[] = new Array<number>(N).fill(0);
  for (let i = N - 1; i >= 1; i--) {
    if ((kids[i] ?? 0) === 0) area[i] = 1;
    const par = grown[i]!.parent;
    area[par] = (area[par] ?? 0) + (area[i] ?? 0);
  }
  const k = (sp.trunkBase * h) / Math.sqrt(area[0] ?? 1);
  const radius: number[] = area.map((a) => Math.sqrt(a) * k);

  // Segment radii. A continuing segment starts at its parent's end radius, so limbs taper
  // smoothly. A side shoot starts at its own radius, inside the limb it leaves.
  const r0s: number[] = new Array<number>(N).fill(0);
  for (let i = 1; i < N; i++) {
    const g = grown[i]!;
    const continuing = g.order === grown[g.parent]!.order;
    r0s[i] = continuing ? (radius[g.parent] ?? 0) : (radius[i] ?? 0);
  }

  // Arc length from the ground along each limb, used as the bark's v coordinate.
  const depth: number[] = new Array<number>(N).fill(0);
  for (let i = 1; i < N; i++) {
    const par = grown[i]!.parent;
    depth[i] = (depth[par] ?? 0) + dist(P[i]!, P[par]!);
  }

  const branches: Branch[] = [];
  for (let i = 1; i < N; i++) {
    const g = grown[i]!;
    branches.push({
      id: i,
      parent: g.parent === 0 ? null : g.parent,
      order: g.order,
      start: P[g.parent]!,
      end: P[i]!,
      r0: r0s[i] ?? 0,
      r1: radius[i] ?? 0,
    });
  }

  // Level of detail: same skeleton, fewer and chunkier tubes, fewer cards.
  const det = o.detail;
  const B = BUDGET[det];
  const sides = SIDES[det];
  const maxOrder = MAX_ORDER[det];
  const blobCount = Math.min(sp.blobs, tips.length);
  const barkCap = det === 0 ? B - blobCount * 20 : Math.floor(0.6 * B);

  // Keep the thickest tubes first. A parent is always thicker than its children, so the
  // kept set stays a connected tree.
  const cand: number[] = [];
  for (let i = 1; i < N; i++) if (grown[i]!.order <= maxOrder) cand.push(i);
  cand.sort((a, b) => (radius[b] ?? 0) - (radius[a] ?? 0) || a - b);
  const keep = Math.min(cand.length, Math.floor(barkCap / (2 * sides)));
  const chosen = cand.slice(0, keep).sort((a, b) => a - b);

  const bark = new Soup();
  for (const i of chosen) {
    const g = grown[i]!;
    const rA = r0s[i] ?? 0;
    const rB = radius[i] ?? 0;
    const rep = Math.max(1, Math.round((TAU * (rA + rB)) / 2 / 0.5));
    tube(bark, P[g.parent]!, P[i]!, rA, rB, sides, depth[g.parent] ?? 0, depth[i] ?? 0, det === 0, rep);
  }

  const leaves = new Soup();
  if (det === 0) {
    const byY = [...tips].sort((a, b) => P[a]![1] - P[b]![1] || a - b);
    addBlobs(leaves, byY, P, cr, h, blobCount, prng(mixSeed(seed, 77)));
  } else {
    // About nine cards per segment: the leaves then outnumber a third of all triangles.
    const full = clamp(Math.round((9 * (N - 1)) / tips.length), 3, 80);
    const F = det === 3 ? full : det === 2 ? Math.round(0.6 * full) : Math.round(0.3 * full);
    const per = Math.max(1, Math.min(F, Math.floor((B - bark.triangles) / (2 * tips.length))));
    for (const t of tips) {
      const rnd = prng(mixSeed(seed, t + 1000));
      for (let j = 0; j < per; j++) cardQuad(leaves, makeCard(rnd, P[t]!, cr));
    }
  }

  // Measure in float32, the precision the geometry is stored at.
  const bf = Float32Array.from(bark.pos);
  const lf = Float32Array.from(leaves.pos);
  let height = 0;
  let width = 0;
  for (const arr of [bf, lf]) {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i]!;
      const y = arr[i + 1]!;
      const z = arr[i + 2]!;
      if (y > height) height = y;
      const rr = Math.sqrt(x * x + z * z);
      if (rr > width) width = rr;
    }
  }

  return {
    species: o.species,
    branches,
    bark: bark.geometry(),
    leaves: leaves.geometry(),
    height,
    radius: width,
    triangles: bark.triangles + leaves.triangles,
  };
}
