/**
 * @hm/treegen — grown trees for a terraforming game.
 *
 * One tree = one skeleton. The skeleton comes from space colonisation: attraction
 * points are scattered through the species' crown envelope and tips grow towards
 * them, with inertia, tropisms and a hard turn budget so limbs go *out* instead of
 * curling round into springs. Radii follow the pipe model (a parent's cross-section
 * carries its children's). The four detail levels are four meshes of that same
 * skeleton, so swapping levels never moves a branch.
 *
 * Pure: the same options always give the same tree. No DOM, no Date, no Math.random.
 */

import * as THREE from 'three';

/* ───────────────────────────────── public API ──────────────────────────────── */

export type Species = 'pine' | 'oak' | 'birch';

export interface TreeOptions {
  readonly species: Species;
  readonly seed: number;
  readonly height: number;
  readonly detail: 0 | 1 | 2 | 3;
}

/** A segment of a limb; r0 at the start, r1 at the end. */
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

/** Triangles allowed per detail level. */
export const BUDGET: readonly [number, number, number, number] = [400, 2000, 8000, 24000];

/* ──────────────────────────────── seeded PRNG ──────────────────────────────── */

/** mulberry32 — small, fast, and entirely our own. */
class Rng {
  private s: number;

  constructor(seed: number) {
    const i = Math.floor(Math.abs(seed)) >>> 0;
    this.s = (Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
    this.unit();
    this.unit();
  }

  unit(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.unit();
  }

  /** uniform in [-a, a] */
  sym(a: number): number {
    return (this.unit() * 2 - 1) * a;
  }

  int(n: number): number {
    const v = Math.floor(this.unit() * n);
    return v < 0 ? 0 : v >= n ? n - 1 : v;
  }
}

/* ───────────────────────────────── vector bits ─────────────────────────────── */

type Vec = readonly [number, number, number];

const UP: Vec = [0, 1, 0];
const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const norm = (x: number, y: number, z: number, fallback: Vec = UP): Vec => {
  const l = Math.sqrt(x * x + y * y + z * z);
  return l > 1e-12 ? [x / l, y / l, z / l] : fallback;
};

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Any unit vector perpendicular to `d`. */
const perpOf = (d: Vec): Vec => {
  const ax: Vec = Math.abs(d[1]) < 0.9 ? UP : [1, 0, 0];
  const c = cross(d, ax);
  return norm(c[0], c[1], c[2], [1, 0, 0]);
};

/** Rodrigues rotation of `v` about unit `k` by `a` radians. */
const rotAxis = (v: Vec, k: Vec, a: number): Vec => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const d = dot(k, v) * (1 - c);
  const cr = cross(k, v);
  return [v[0] * c + cr[0] * s + k[0] * d, v[1] * c + cr[1] * s + k[1] * d, v[2] * c + cr[2] * s + k[2] * d];
};

/**
 * Turn `from` towards unit `to`, by at most `maxAng`.
 * Returns the new unit direction and the angle actually turned — the single place
 * where "no spirals, no loops" is enforced.
 */
const turnTo = (from: Vec, to: Vec, maxAng: number): { dir: Vec; turn: number } => {
  const d = clamp(dot(from, to), -1, 1);
  const ang = Math.acos(d);
  if (!(ang > 1e-7) || !(maxAng > 1e-7)) return { dir: from, turn: 0 };
  if (ang <= maxAng) return { dir: to, turn: ang };
  const px = to[0] - from[0] * d;
  const py = to[1] - from[1] * d;
  const pz = to[2] - from[2] * d;
  const pl = Math.sqrt(px * px + py * py + pz * pz);
  if (pl < 1e-9) return { dir: from, turn: 0 };
  const c = Math.cos(maxAng);
  const s = Math.sin(maxAng) / pl;
  return { dir: norm(from[0] * c + px * s, from[1] * c + py * s, from[2] * c + pz * s, from), turn: maxAng };
};

/* ─────────────────────────────── species recipes ───────────────────────────── */

/** All lengths are nominal: the tree is grown about 1 unit tall, then scaled. */
interface Spec {
  readonly step: number;
  readonly trunkTop: number;
  readonly trunkLean: number;
  readonly trunkWave: number;
  readonly crownBase: number;
  readonly crownTop: number;
  readonly crownMid: number;
  readonly crownR: number;
  readonly attractors: number;
  readonly maxOrder: number;
  readonly maxNodes: number;
  readonly tipR: number;
  readonly pipe: number;
  readonly taper: number;
  readonly influence: number;
  readonly kill: number;
  readonly branchAngle: number;
  readonly splitP: number;
  readonly splitGap: number;
  readonly segs: readonly number[];
  readonly lenK: readonly number[];
  readonly leafMinOrder: number;
  readonly leafSize: number;
  readonly leafRadMax: number;
  readonly maxTurn: number;
  readonly turnBudget: number;
  readonly lumps: number;
}

const PINE: Spec = {
  step: 0.055,
  trunkTop: 0.88,
  trunkLean: 0.015,
  trunkWave: 2.1,
  crownBase: 0.15,
  crownTop: 1.0,
  crownMid: 0.45,
  crownR: 0.22,
  attractors: 340,
  maxOrder: 3,
  maxNodes: 380,
  tipR: 0.0015,
  pipe: 2.4,
  taper: 0.03,
  influence: 4.5,
  kill: 1.25,
  branchAngle: 1.15,
  splitP: 0.55,
  splitGap: 2,
  segs: [24, 9, 4, 2],
  lenK: [1, 0.92, 0.7, 0.55],
  leafMinOrder: 1,
  leafSize: 0.062,
  leafRadMax: 0.006,
  maxTurn: 0.28,
  turnBudget: 1.6,
  lumps: 0.09,
};

const OAK: Spec = {
  step: 0.058,
  trunkTop: 0.27,
  trunkLean: 0.16,
  trunkWave: 1.4,
  crownBase: 0.2,
  crownTop: 1.0,
  crownMid: 0.62,
  crownR: 0.4,
  attractors: 420,
  maxOrder: 4,
  maxNodes: 390,
  tipR: 0.0019,
  pipe: 2.2,
  taper: 0.028,
  influence: 4.0,
  kill: 1.45,
  branchAngle: 0.95,
  splitP: 0.7,
  splitGap: 2,
  segs: [15, 11, 7, 4, 3],
  lenK: [1, 0.95, 0.8, 0.62, 0.5],
  leafMinOrder: 2,
  leafSize: 0.075,
  leafRadMax: 0.007,
  maxTurn: 0.29,
  turnBudget: 1.7,
  lumps: 0.2,
};

const BIRCH: Spec = {
  step: 0.055,
  trunkTop: 0.76,
  trunkLean: 0.06,
  trunkWave: 2.6,
  crownBase: 0.26,
  crownTop: 1.0,
  crownMid: 0.63,
  crownR: 0.16,
  attractors: 360,
  maxOrder: 3,
  maxNodes: 370,
  tipR: 0.0012,
  pipe: 2.6,
  taper: 0.026,
  influence: 4.0,
  kill: 1.4,
  branchAngle: 0.8,
  splitP: 0.7,
  splitGap: 2,
  segs: [22, 9, 6, 3],
  lenK: [1, 0.9, 0.72, 0.55],
  leafMinOrder: 2,
  leafSize: 0.048,
  leafRadMax: 0.0042,
  maxTurn: 0.28,
  turnBudget: 1.65,
  lumps: 0.1,
};

const SPEC: Readonly<Record<Species, Spec>> = { pine: PINE, oak: OAK, birch: BIRCH };
const SALT: Readonly<Record<Species, number>> = { pine: 10427, oak: 52711, birch: 90863 };

/** Per-step growth weights: inertia, attraction, up-pull, outward-pull, wobble. */
interface Bias {
  readonly prev: number;
  readonly att: number;
  readonly up: number;
  readonly out: number;
  readonly wob: number;
}

/** `t` is how far along its own limb the tip has got, 0..1. */
const biasOf = (species: Species, order: number, t: number): Bias => {
  if (species === 'pine') {
    if (order === 0) return { prev: 0.8, att: 0.16, up: 0.9, out: 0, wob: 0.01 };
    return { prev: 0.82, att: 0.32, up: 0.03 + 0.2 * t * t, out: 0.3, wob: 0.03 };
  }
  if (species === 'birch') {
    if (order === 0) return { prev: 0.86, att: 0.14, up: 0.95, out: 0.02, wob: 0.02 };
    if (order === 1) return { prev: 0.76, att: 0.38, up: 0.5 - 0.42 * t, out: 0.2, wob: 0.035 };
    return { prev: 0.78, att: 0.34, up: 0.08 - 0.5 * t, out: 0.16, wob: 0.045 };
  }
  if (order === 0) return { prev: 0.76, att: 0.36, up: 0.4 - 0.24 * t, out: 0.16, wob: 0.045 };
  if (order === 1) return { prev: 0.72, att: 0.44, up: 0.3 - 0.33 * t, out: 0.26, wob: 0.055 };
  return { prev: 0.74, att: 0.48, up: 0.18 - 0.26 * t, out: 0.18, wob: 0.06 };
};

/* ───────────────────────────── the crown envelope ──────────────────────────── */

interface Lump {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly amp: number;
}

/** Radius of the species' crown envelope at height y and azimuth th (nominal units). */
const envRadius = (species: Species, S: Spec, y: number, th: number, lump: Lump): number => {
  if (y < S.crownBase || y > S.crownTop) return 0;
  let r: number;
  if (species === 'pine') {
    const t = clamp((y - S.crownBase) / (S.crownTop - S.crownBase), 0, 1);
    r = S.crownR * Math.pow(1 - t, 0.78) * (0.35 + 0.65 * Math.pow(Math.min(1, t * 7), 0.6));
  } else {
    const span = y > S.crownMid ? S.crownTop - S.crownMid : S.crownMid - S.crownBase;
    const u = clamp(Math.abs(y - S.crownMid) / Math.max(1e-6, span), 0, 1);
    r = S.crownR * Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.52);
  }
  const w =
    1 +
    S.lumps * (Math.sin(2 * th + lump.a) + 0.8 * Math.sin(3 * th + lump.b + 2.5 * y) + 0.6 * Math.sin(5 * th + lump.c));
  return r * clamp(w, 0.68, 1.32);
};

/* ──────────────────────────────── the skeleton ─────────────────────────────── */

interface GNode {
  readonly id: number;
  readonly parent: number;
  readonly order: number;
  p: Vec;
  d: Vec;
  len: number;
  kids: number;
  cont: number;
  rad: number;
  startRad: number;
  v: number;
}

interface Cluster {
  p: Vec;
  size: number;
  readonly seed: number;
}

interface Skel {
  readonly species: Species;
  readonly S: Spec;
  readonly nodes: readonly GNode[];
  readonly clusters: readonly Cluster[];
  readonly order: readonly number[];
  crownCentre: Vec;
  nominalTop: number;
}

interface Tip {
  node: number;
  prev: Vec;
  side: Vec;
  order: number;
  turn: number;
  segs: number;
  maxSegs: number;
  sinceSplit: number;
  starve: number;
  phase: number;
  alive: boolean;
}

const growSkeleton = (species: Species, seed: number): Skel => {
  const S = SPEC[species];
  const rng = new Rng(Math.floor(seed) * 1013 + SALT[species]);
  const lump: Lump = { a: rng.range(0, 6.283), b: rng.range(0, 6.283), c: rng.range(0, 6.283), amp: S.lumps };

  /* ---- attraction points in the crown envelope ---- */
  const ax: number[] = [];
  const ay: number[] = [];
  const az: number[] = [];
  const pushAttractor = (x: number, y: number, z: number): void => {
    ax.push(x);
    ay.push(y);
    az.push(z);
  };

  if (species === 'pine') {
    const whorls = 12;
    for (let k = 0; k < whorls; k++) {
      const y = S.crownBase + ((k + 0.45) / whorls) * (S.crownTop - S.crownBase) + rng.sym(0.012);
      const re = envRadius(species, S, y, 0, lump);
      const m = clamp(Math.round(115 * re), 8, 34);
      const base = rng.range(0, 6.283);
      for (let j = 0; j < m; j++) {
        const th = base + (j / m) * 6.283 + rng.sym(0.35);
        const rr = envRadius(species, S, y, th, lump) * (0.42 + 0.58 * Math.sqrt(rng.unit()));
        pushAttractor(Math.cos(th) * rr, y + rng.sym(0.028), Math.sin(th) * rr);
      }
    }
    for (let k = 0; k < 26; k++) {
      const y = S.crownTop - 0.22 * rng.unit() * rng.unit();
      const th = rng.range(0, 6.283);
      const rr = envRadius(species, S, y, th, lump) * rng.unit();
      pushAttractor(Math.cos(th) * rr, y, Math.sin(th) * rr);
    }
  } else {
    for (let k = 0; k < S.attractors; k++) {
      const y = S.crownBase + (S.crownTop - S.crownBase) * (0.08 + 0.92 * rng.unit());
      const th = rng.range(0, 6.283);
      const re = envRadius(species, S, y, th, lump);
      const rr = re * (0.22 + 0.78 * Math.pow(rng.unit(), 0.38));
      pushAttractor(Math.cos(th) * rr, y, Math.sin(th) * rr);
    }
  }
  const na = ax.length;
  const alive = new Uint8Array(na).fill(1);

  /* ---- nodes ---- */
  const nodes: GNode[] = [
    { id: 0, parent: -1, order: 0, p: [0, 0, 0], d: UP, len: 0, kids: 0, cont: -1, rad: 0, startRad: 0, v: 0 },
  ];

  const addNode = (parent: number, dir: Vec, len: number, order: number): number => {
    const par = nodes[parent] as GNode;
    const id = nodes.length;
    nodes.push({
      id,
      parent,
      order,
      p: [par.p[0] + dir[0] * len, par.p[1] + dir[1] * len, par.p[2] + dir[2] * len],
      d: dir,
      len,
      kids: 0,
      cont: -1,
      rad: 0,
      startRad: 0,
      v: 0,
    });
    par.kids += 1;
    if (order === par.order || par.id === 0) par.cont = id;
    return id;
  };

  const killNear = (p: Vec, dk: number): void => {
    const d2 = dk * dk;
    for (let i = 0; i < na; i++) {
      if (alive[i] === 0) continue;
      const dx = (ax[i] as number) - p[0];
      const dy = (ay[i] as number) - p[1];
      const dz = (az[i] as number) - p[2];
      if (dx * dx + dy * dy + dz * dz < d2) alive[i] = 0;
    }
  };

  /* ---- the trunk, grown first so the architecture is the species', not the cloud's ---- */
  const trunkNodes: number[] = [];
  let cur = 0;
  let dir: Vec = UP;
  let trunkTurn = 0;
  const leanTh = rng.range(0, 6.283);
  const nTrunk = Math.max(2, Math.round(S.trunkTop / S.step));
  for (let i = 0; i < nTrunk; i++) {
    if (i > 0) {
      const ph = leanTh + (i / nTrunk) * S.trunkWave;
      const want = norm(
        dir[0] + S.trunkLean * Math.cos(ph),
        dir[1] + 0.45,
        dir[2] + S.trunkLean * Math.sin(ph),
        dir,
      );
      const r = turnTo(dir, want, Math.min(S.maxTurn, S.turnBudget - trunkTurn));
      dir = r.dir;
      trunkTurn += r.turn;
    }
    cur = addNode(cur, dir, S.step, 0);
    trunkNodes.push(cur);
    killNear((nodes[cur] as GNode).p, S.kill * S.step * 0.8);
  }

  /* ---- buds: where limbs leave the trunk ---- */
  const tips: Tip[] = [];
  const newTip = (node: number, d0: Vec, order: number, maxSegs: number): void => {
    tips.push({
      node,
      prev: d0,
      side: perpOf(d0),
      order,
      turn: 0,
      segs: 0,
      maxSegs,
      sinceSplit: 0,
      starve: 0,
      phase: rng.range(0, 6.283),
      alive: true,
    });
  };

  /* the leader carries on where the trunk stopped */
  tips.push({
    node: cur,
    prev: dir,
    side: perpOf(dir),
    order: 0,
    turn: trunkTurn,
    segs: nTrunk,
    maxSegs: (S.segs[0] as number) + nTrunk,
    sinceSplit: 0,
    starve: 0,
    phase: rng.range(0, 6.283),
    alive: true,
  });

  const budDir = (th: number, tilt: number): Vec => {
    const h = Math.cos(tilt);
    return norm(Math.cos(th) * h, Math.sin(tilt), Math.sin(th) * h, UP);
  };

  if (species === 'pine') {
    let th = rng.range(0, 6.283);
    for (let i = 1; i < trunkNodes.length; i += 2) {
      const id = trunkNodes[i] as number;
      const y = (nodes[id] as GNode).p[1];
      if (y < S.crownBase - 0.02) continue;
      const u = clamp((y - S.crownBase) / (S.crownTop - S.crownBase), 0, 1);
      const m = u > 0.75 ? 3 : u > 0.45 ? 4 : 5;
      const tilt = 0.04 + 0.95 * u * u;
      const reach = envRadius(species, S, y, 0, lump);
      const maxSegs = clamp(Math.round((reach / (S.step * 0.9)) * 1.45) + 1, 2, S.segs[1] as number);
      for (let j = 0; j < m; j++) {
        th += 2.3999 + rng.sym(0.3);
        newTip(id, budDir(th, tilt + rng.sym(0.1)), 1, maxSegs);
      }
    }
  } else if (species === 'oak') {
    let th = rng.range(0, 6.283);
    for (let i = Math.max(1, trunkNodes.length - 3); i < trunkNodes.length; i++) {
      const id = trunkNodes[i] as number;
      const m = i === trunkNodes.length - 1 ? 2 : 1;
      for (let j = 0; j < m; j++) {
        th += 2.3999 + rng.sym(0.45);
        newTip(id, budDir(th, rng.range(0.55, 0.95)), 1, S.segs[1] as number);
      }
    }
  } else {
    let th = rng.range(0, 6.283);
    for (let i = 1; i < trunkNodes.length; i++) {
      const id = trunkNodes[i] as number;
      const y = (nodes[id] as GNode).p[1];
      if (y < S.crownBase - 0.04) continue;
      if (rng.unit() > 0.8) continue;
      th += 2.3999 + rng.sym(0.4);
      const u = clamp((y - S.crownBase) / (S.crownTop - S.crownBase), 0, 1);
      newTip(id, budDir(th, 0.75 + 0.35 * u + rng.sym(0.12)), 1, Math.max(3, Math.round((S.segs[1] as number) * (1 - 0.4 * u))));
    }
  }

  /* ---- space colonisation ---- */
  const di = S.influence * S.step;
  const dk = S.kill * S.step;
  const di2 = di * di;

  for (let iter = 0; iter < 60; iter++) {
    let living = 0;
    const born: number[] = [];
    const pass = tips.length; // tips born this pass wait their turn, so limbs grow in step

    for (let ti = 0; ti < pass; ti++) {
      const tip = tips[ti] as Tip;
      if (!tip.alive) continue;
      if (nodes.length >= S.maxNodes || tip.segs >= tip.maxSegs) {
        tip.alive = false;
        continue;
      }
      living++;
      const n = nodes[tip.node] as GNode;
      const prev = tip.prev;

      /* attraction: only points ahead of the tip, so it never swings back on itself */
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let found = 0;
      for (let i = 0; i < na; i++) {
        if (alive[i] === 0) continue;
        const dx = (ax[i] as number) - n.p[0];
        const dy = (ay[i] as number) - n.p[1];
        const dz = (az[i] as number) - n.p[2];
        const q = dx * dx + dy * dy + dz * dz;
        if (q > di2 || q < 1e-10) continue;
        const l = Math.sqrt(q);
        const ux = dx / l;
        const uy = dy / l;
        const uz = dz / l;
        if (ux * prev[0] + uy * prev[1] + uz * prev[2] < 0.15) continue;
        const w = 1 - l / di + 0.25;
        sx += ux * w;
        sy += uy * w;
        sz += uz * w;
        found++;
      }

      let want: Vec;
      if (found > 0) {
        tip.starve = 0;
        want = norm(sx, sy, sz, prev);
      } else {
        tip.starve += 1;
        if (tip.starve > 2) {
          tip.alive = false;
          continue;
        }
        want = prev;
      }

      const t = clamp(tip.segs / Math.max(1, tip.maxSegs), 0, 1);
      const b = biasOf(species, tip.order, t);

      /* keep the wobble in one plane per limb: crooked, never a corkscrew */
      let side = tip.side;
      const sd = dot(side, prev);
      side = norm(side[0] - prev[0] * sd, side[1] - prev[1] * sd, side[2] - prev[2] * sd, perpOf(prev));
      tip.side = side;
      const wob = b.wob * Math.cos(tip.phase + tip.segs * 1.9);

      const rl = Math.sqrt(n.p[0] * n.p[0] + n.p[2] * n.p[2]);
      const ox = rl > 1e-6 ? n.p[0] / rl : Math.cos(tip.phase);
      const oz = rl > 1e-6 ? n.p[2] / rl : Math.sin(tip.phase);

      let wx = prev[0] * b.prev + want[0] * b.att + ox * b.out + side[0] * wob;
      let wy = prev[1] * b.prev + want[1] * b.att + b.up * 0.35 + side[1] * wob;
      let wz = prev[2] * b.prev + want[2] * b.att + oz * b.out + side[2] * wob;

      /* nothing dives at the ground */
      const floor = S.crownBase * 0.55;
      if (n.p[1] < floor && wy < 0) wy = -wy * 0.3 + 0.2;

      const desired = norm(wx, wy, wz, prev);
      const allow = Math.min(S.maxTurn, Math.max(0, S.turnBudget - tip.turn));
      const step = turnTo(prev, desired, allow);
      const nd = step.dir;
      const len = S.step * (S.lenK[Math.min(tip.order, S.lenK.length - 1)] as number) * (0.88 + 0.24 * ((tip.segs * 7919) % 5) / 5);

      const child = addNode(tip.node, nd, len, tip.order);
      born.push(child);
      tip.node = child;
      tip.prev = nd;
      tip.turn += step.turn;
      tip.segs += 1;
      tip.sinceSplit += 1;

      /* a fork: one child carries the limb on, the other starts a new order */
      const cp = nodes[child] as GNode;
      const canSplit =
        tip.order < S.maxOrder &&
        tip.sinceSplit >= S.splitGap &&
        tip.segs + 1 < tip.maxSegs &&
        nodes.length + 1 < S.maxNodes &&
        rng.unit() < S.splitP;
      if (canSplit) {
        /* side shoots leave in a cone about the limb, stepped round by the golden
           angle: a spiral of buds, never a spiral of wood */
        const spin = rotAxis(perpOf(nd), nd, tip.phase + tip.segs * 2.3999);
        const ang = S.branchAngle * (0.78 + 0.44 * rng.unit());
        let sdir = rotAxis(nd, spin, ang);
        const childOrder = tip.order + 1;
        const lift = species === 'birch' && childOrder >= 2 ? -0.05 : species === 'pine' ? 0.06 : 0.16;
        sdir = norm(sdir[0] * 1.0 + ox * 0.18, sdir[1] + lift, sdir[2] * 1.0 + oz * 0.18, sdir);
        if (sdir[1] < -0.55) sdir = norm(sdir[0], -0.55, sdir[2], sdir);
        const k = Math.min(childOrder, S.segs.length - 1);
        const ms = Math.max(2, Math.round((S.segs[k] as number) * (0.6 + 0.5 * rng.unit())));
        newTip(cp.id, sdir, childOrder, ms);
        tip.sinceSplit = 0;
      }

      /* leaving the envelope means the limb has finished */
      const th = Math.atan2(cp.p[2], cp.p[0]);
      const re = envRadius(species, S, cp.p[1], th, lump);
      const rr = Math.sqrt(cp.p[0] * cp.p[0] + cp.p[2] * cp.p[2]);
      if (cp.p[1] > S.crownTop || (cp.p[1] > S.crownBase && rr > re * 1.18 + 0.02)) tip.alive = false;
    }

    for (const id of born) killNear((nodes[id] as GNode).p, dk);
    if (living === 0) break;
  }

  /* ---- pipe model: a parent's cross-section carries its children's ---- */
  const e = S.pipe;
  const sum = new Float64Array(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i] as GNode;
    const acc = sum[i] as number;
    n.rad = acc > 0 ? Math.max(S.tipR, Math.pow(acc, 1 / e)) : S.tipR;
    if (i > 0) {
      n.startRad = n.rad * (1 + S.taper * (n.len / S.step));
      sum[n.parent] = (sum[n.parent] as number) + Math.pow(n.startRad, e);
    }
  }

  /* ---- leaf clusters: clouds of cards hung on the thin wood, all the way down ---- */
  const clusters: Cluster[] = [];
  const addCluster = (p: Vec, size: number): void => {
    clusters.push({ p, size, seed: rng.int(1 << 29) });
  };
  const ls = S.leafSize;
  for (const n of nodes) {
    if (n.id === 0 || n.order < S.leafMinOrder || n.rad > S.leafRadMax) continue;
    const tipNode = n.kids === 0;
    const copies = tipNode ? (species === 'pine' ? 2 : 3) : rng.unit() < (species === 'pine' ? 0.95 : 0.7) ? 1 : 0;
    for (let c = 0; c < copies; c++) {
      const j = ls * 0.42;
      const back = c === 0 ? 0 : rng.range(0.1, 0.75);
      const px = n.p[0] - n.d[0] * n.len * back + rng.sym(j);
      const py = n.p[1] - n.d[1] * n.len * back + rng.sym(j) * 0.8;
      const pz = n.p[2] - n.d[2] * n.len * back + rng.sym(j);
      addCluster([px, py, pz], ls * (0.72 + 0.56 * rng.unit()));
    }
  }
  /* a crown is never allowed to be thin */
  let guard = 0;
  while (clusters.length < 360 && clusters.length > 0 && guard < 2000) {
    const src = clusters[rng.int(clusters.length)] as Cluster;
    const j = ls * 0.6;
    addCluster([src.p[0] + rng.sym(j), src.p[1] + rng.sym(j * 0.7), src.p[2] + rng.sym(j)], src.size * rng.range(0.8, 1.1));
    guard++;
  }

  /* draw order for the detail ladder: a fixed shuffle, so every level thins the
     whole crown evenly instead of lopping a side off */
  const order: number[] = clusters.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = order[i] as number;
    order[i] = order[j] as number;
    order[j] = a;
  }

  let top = 0;
  for (const n of nodes) top = Math.max(top, n.p[1] + n.rad);
  /* 1.7 size is the furthest a card corner can sit above its cluster centre */
  for (const c of clusters) top = Math.max(top, c.p[1] + c.size * 1.7);

  return {
    species,
    S,
    nodes,
    clusters,
    order,
    crownCentre: [0, S.crownMid, 0],
    nominalTop: Math.max(0.2, top),
  };
};

/** Nominal units → metres. Uniform, so taper, pipe model and connections survive. */
const scaleSkel = (sk: Skel, s: number): void => {
  for (const n of sk.nodes) {
    n.p = [n.p[0] * s, n.p[1] * s, n.p[2] * s];
    n.len *= s;
    n.rad *= s;
    n.startRad *= s;
  }
  for (const n of sk.nodes) n.v = n.id === 0 ? 0 : (sk.nodes[n.parent] as GNode).v + n.len;
  for (const c of sk.clusters) {
    c.p = [c.p[0] * s, c.p[1] * s, c.p[2] * s];
    c.size *= s;
  }
  sk.crownCentre = [0, sk.crownCentre[1] * s, 0];
  sk.nominalTop *= s;
};

/* ──────────────────────────── limbs → tubes of rings ───────────────────────── */

interface Ring {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  readonly t: Vec;
  readonly v: number;
}

interface Chain {
  readonly order: number;
  readonly rings: readonly Ring[];
}

/** r0 of the segment ending at node `n`: a limb carries on at full width, a side shoot starts at its own. */
const segR0 = (sk: Skel, n: GNode): number => {
  const par = sk.nodes[n.parent] as GNode;
  return par.cont === n.id ? par.rad : n.startRad;
};

const buildChains = (sk: Skel): Chain[] => {
  const chains: Chain[] = [];
  for (const n of sk.nodes) {
    if (n.id === 0) continue;
    const par = sk.nodes[n.parent] as GNode;
    if (par.id !== 0 && par.order === n.order) continue; // mid-limb, not a start

    const seq: GNode[] = [];
    let curId: number = n.id;
    while (curId >= 0) {
      const cur: GNode = sk.nodes[curId] as GNode;
      seq.push(cur);
      curId = cur.cont;
    }

    const rings: Ring[] = [];
    const first = seq[0] as GNode;
    rings.push({ x: par.p[0], y: par.p[1], z: par.p[2], r: segR0(sk, first), t: first.d, v: par.v });
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i] as GNode;
      const nx = seq[i + 1];
      const t = nx ? norm(s.d[0] + nx.d[0], s.d[1] + nx.d[1], s.d[2] + nx.d[2], s.d) : s.d;
      rings.push({ x: s.p[0], y: s.p[1], z: s.p[2], r: s.rad, t, v: s.v });
    }
    chains.push({ order: n.order, rings });
  }
  return chains;
};

/* ───────────────────────────────── LOD planning ────────────────────────────── */

const SIDES: readonly [number, number, number, number] = [3, 5, 8, 12];
const ORDER_CAP: readonly [number, number, number, number] = [1, 2, 3, 99];
const STRIDE: readonly [number, number, number, number] = [4, 2, 1, 1];
const MAX_RINGS: readonly [number, number, number, number] = [4, 99, 99, 99];
const BARK_SHARE: readonly [number, number, number, number] = [0.5, 0.55, 0.62, 0.5];
const CARDS: readonly [number, number, number, number] = [0, 2, 3, 6];
const CLUSTER_FRAC: readonly [number, number, number, number] = [0, 0.3, 0.55, 1];
const CARD_SCALE: readonly [number, number, number, number] = [1, 1.35, 1.15, 1];
const BLOBS = 9;
const BLOB_TRIS = 20;

interface Plan {
  readonly sides: number;
  readonly picks: readonly (readonly number[])[]; // ring indices per chain ([] = chain dropped)
  readonly barkTris: number;
  readonly clusters: number;
  readonly cards: number;
  readonly cardScale: number;
  readonly blobs: number;
  readonly leafTris: number;
  readonly total: number;
}

/** Evenly spaced ring indices, always keeping the first and the last. */
const pickRings = (n: number, stride: number, maxRings: number): number[] => {
  const out: number[] = [0];
  for (let i = stride; i < n - 1; i += stride) out.push(i);
  if (n > 1) out.push(n - 1);
  if (out.length <= maxRings) return out;
  const res: number[] = [];
  const m = Math.max(2, maxRings);
  for (let k = 0; k < m; k++) {
    const i = Math.round((k * (n - 1)) / (m - 1));
    if (res.length === 0 || i > (res[res.length - 1] as number)) res.push(i);
  }
  return res;
};

const planLevel = (sk: Skel, chains: readonly Chain[], detail: 0 | 1 | 2 | 3): Plan => {
  const sides = SIDES[detail];
  const cap = ORDER_CAP[detail];
  const budget = BUDGET[detail];
  const barkCap = Math.floor(budget * BARK_SHARE[detail]);

  let stride = STRIDE[detail];
  let maxRings = MAX_RINGS[detail];
  let picks: number[][] = [];
  let barkTris = 0;

  const lay = (): void => {
    picks = [];
    barkTris = 0;
    for (const c of chains) {
      if (c.order > cap) {
        picks.push([]);
        continue;
      }
      const sel = pickRings(c.rings.length, stride, maxRings);
      picks.push(sel);
      barkTris += (sel.length - 1) * sides * 2;
    }
  };

  lay();
  let tries = 0;
  while (barkTris > barkCap && tries < 12) {
    if (detail === 0) {
      if (maxRings > 2) maxRings -= 1;
      else stride += 1;
    } else if (stride < 4) stride += 1;
    else if (maxRings >= 90) maxRings = 8;
    else if (maxRings > 2) maxRings -= 1;
    else stride += 1;
    lay();
    tries++;
  }
  if (barkTris > barkCap) {
    /* last resort: drop the thinnest wood, highest order first */
    const idx = chains.map((c, i) => [c.order, i] as const).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    for (const [, i] of idx) {
      if (barkTris <= barkCap) break;
      const sel = picks[i] as number[];
      if (sel.length < 2) continue;
      barkTris -= (sel.length - 1) * sides * 2;
      picks[i] = [];
    }
  }

  let blobs = 0;
  let clusters = 0;
  let cards = CARDS[detail];
  let leafTris = 0;

  if (detail === 0) {
    blobs = Math.max(0, Math.min(BLOBS, Math.floor((budget - barkTris - 2) / BLOB_TRIS)));
    if (sk.clusters.length === 0) blobs = 0;
    leafTris = blobs * BLOB_TRIS;
  } else {
    const want = Math.max(1, Math.round(sk.clusters.length * CLUSTER_FRAC[detail]));
    const afford = Math.floor((budget - barkTris - 2) / (cards * 2));
    clusters = Math.max(0, Math.min(sk.clusters.length, want, afford));
    /* a full crown: foliage must outweigh the wood it hangs on */
    while (
      clusters * cards * 2 < barkTris * 0.62 &&
      cards < 14 &&
      barkTris + clusters * (cards + 1) * 2 <= budget - 2
    ) {
      cards += 1;
    }
    leafTris = clusters * cards * 2;
  }

  return {
    sides,
    picks,
    barkTris,
    clusters,
    cards,
    cardScale: CARD_SCALE[detail],
    blobs,
    leafTris,
    total: barkTris + leafTris,
  };
};

/** Plan a level, then make sure it is strictly richer than the level below it. */
const planFor = (sk: Skel, chains: readonly Chain[], detail: 0 | 1 | 2 | 3): Plan => {
  const plan = planLevel(sk, chains, detail);
  if (detail === 0) return plan;
  const below = planLevel(sk, chains, (detail - 1) as 0 | 1 | 2);
  if (plan.total > below.total) return plan;

  let cards = plan.cards;
  let clusters = plan.clusters;
  const budget = BUDGET[detail];
  for (let i = 0; i < 64; i++) {
    if (plan.barkTris + clusters * cards * 2 > below.total) break;
    if (clusters < sk.clusters.length && plan.barkTris + (clusters + 1) * cards * 2 <= budget - 2) clusters += 1;
    else if (cards < 16 && plan.barkTris + clusters * (cards + 1) * 2 <= budget - 2) cards += 1;
    else break;
  }
  const leafTris = clusters * cards * 2;
  return { ...plan, clusters, cards, leafTris, total: plan.barkTris + leafTris };
};

/* ─────────────────────────────── mesh assembly ─────────────────────────────── */

class Mesh {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];

  vertex(p: Vec, n: Vec, u: number, v: number): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
  }

  /** One triangle with one normal for all three corners. */
  flat(a: Vec, b: Vec, c: Vec, ua: Vec, ub: Vec, uc: Vec): void {
    const n = norm(
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      UP,
    );
    this.vertex(a, n, ua[0], ua[1]);
    this.vertex(b, n, ub[0], ub[1]);
    this.vertex(c, n, uc[0], uc[1]);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    if (this.pos.length > 0) g.computeBoundingSphere();
    return g;
  }
}

const buildBark = (chains: readonly Chain[], plan: Plan, flat: boolean): THREE.BufferGeometry => {
  const m = new Mesh();
  const sides = plan.sides;

  for (let ci = 0; ci < chains.length; ci++) {
    const chain = chains[ci] as Chain;
    const sel = plan.picks[ci] as readonly number[] | undefined;
    if (!sel || sel.length < 2) continue;

    /* rotation-minimising frame, so the tube never twists or kinks */
    let u = perpOf((chain.rings[sel[0] as number] as Ring).t);
    let prevT = (chain.rings[sel[0] as number] as Ring).t;
    const px: Vec[][] = [];
    const nrm: Vec[][] = [];
    const vs: number[] = [];

    for (let k = 0; k < sel.length; k++) {
      const ring = chain.rings[sel[k] as number] as Ring;
      const t = ring.t;
      const c = cross(prevT, t);
      const cl = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
      if (cl > 1e-7) {
        const a = Math.atan2(cl, clamp(dot(prevT, t), -1, 1));
        u = rotAxis(u, [c[0] / cl, c[1] / cl, c[2] / cl], a);
      }
      const ud = dot(u, t);
      u = norm(u[0] - t[0] * ud, u[1] - t[1] * ud, u[2] - t[2] * ud, perpOf(t));
      const w = cross(t, u);
      prevT = t;

      /* taper slope so the lighting follows the cone, not a cylinder */
      const prevRing = k > 0 ? (chain.rings[sel[k - 1] as number] as Ring) : ring;
      const nextRing = k + 1 < sel.length ? (chain.rings[sel[k + 1] as number] as Ring) : ring;
      const dv = Math.max(1e-5, nextRing.v - prevRing.v);
      const slope = (nextRing.r - prevRing.r) / dv;

      const rp: Vec[] = [];
      const rn: Vec[] = [];
      for (let j = 0; j <= sides; j++) {
        const a = (j % sides) * ((Math.PI * 2) / sides);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const rx = u[0] * ca + w[0] * sa;
        const ry = u[1] * ca + w[1] * sa;
        const rz = u[2] * ca + w[2] * sa;
        rp.push([ring.x + rx * ring.r, ring.y + ry * ring.r, ring.z + rz * ring.r]);
        rn.push(norm(rx - t[0] * slope, ry - t[1] * slope, rz - t[2] * slope, [rx, ry, rz]));
      }
      px.push(rp);
      nrm.push(rn);
      vs.push(ring.v);
    }

    for (let k = 0; k + 1 < px.length; k++) {
      const a0 = px[k] as Vec[];
      const a1 = px[k + 1] as Vec[];
      const n0 = nrm[k] as Vec[];
      const n1 = nrm[k + 1] as Vec[];
      const v0 = vs[k] as number;
      const v1 = vs[k + 1] as number;
      for (let j = 0; j < sides; j++) {
        const A = a0[j] as Vec;
        const B = a0[j + 1] as Vec;
        const C = a1[j + 1] as Vec;
        const D = a1[j] as Vec;
        const u0 = j / sides;
        const u1 = (j + 1) / sides;
        if (flat) {
          m.flat(A, B, C, [u0, v0, 0], [u1, v0, 0], [u1, v1, 0]);
          m.flat(A, C, D, [u0, v0, 0], [u1, v1, 0], [u0, v1, 0]);
        } else {
          m.vertex(A, n0[j] as Vec, u0, v0);
          m.vertex(B, n0[j + 1] as Vec, u1, v0);
          m.vertex(C, n1[j + 1] as Vec, u1, v1);
          m.vertex(A, n0[j] as Vec, u0, v0);
          m.vertex(C, n1[j + 1] as Vec, u1, v1);
          m.vertex(D, n1[j] as Vec, u0, v1);
        }
      }
    }
  }
  return m.geometry();
};

const buildCards = (sk: Skel, plan: Plan): THREE.BufferGeometry => {
  const m = new Mesh();
  const cen = sk.crownCentre;

  for (let i = 0; i < plan.clusters; i++) {
    const cl = sk.clusters[sk.order[i] as number] as Cluster;
    const r = new Rng(cl.seed);
    const size = cl.size * plan.cardScale;
    for (let c = 0; c < plan.cards; c++) {
      /* a fixed number of draws per card, so a shorter level is always a prefix
         of a longer one: the same cards, just fewer of them */
      const th = r.range(0, 6.283);
      const ph = Math.acos(clamp(1 - 2 * r.unit(), -1, 1));
      const off = Math.pow(r.unit(), 0.45) * 0.3;
      const wj = r.range(0.78, 1.25);
      const hj = r.range(0.72, 1.1);
      const roll = r.sym(0.9);

      const sp = Math.sin(ph);
      const face = norm(sp * Math.cos(th), Math.cos(ph) * 0.75, sp * Math.sin(th), [1, 0, 0]);
      let u = cross(UP, face);
      let uu = norm(u[0], u[1], u[2], perpOf(face));
      uu = rotAxis(uu, face, roll);
      const vv = cross(face, uu);
      const hw = size * 0.6 * wj;
      const hh = size * 0.6 * hj;

      const j1 = r.sym(off * size);
      const j2 = r.sym(off * size);
      const ox = cl.p[0] + face[0] * off * size * 0.8 + uu[0] * j1 + vv[0] * j2;
      const oy = cl.p[1] + face[1] * off * size * 0.8 + uu[1] * j1 + vv[1] * j2;
      const oz = cl.p[2] + face[2] * off * size * 0.8 + uu[2] * j1 + vv[2] * j2;

      const p00: Vec = [ox - uu[0] * hw - vv[0] * hh, oy - uu[1] * hw - vv[1] * hh, oz - uu[2] * hw - vv[2] * hh];
      const p10: Vec = [ox + uu[0] * hw - vv[0] * hh, oy + uu[1] * hw - vv[1] * hh, oz + uu[2] * hw - vv[2] * hh];
      const p11: Vec = [ox + uu[0] * hw + vv[0] * hh, oy + uu[1] * hw + vv[1] * hh, oz + uu[2] * hw + vv[2] * hh];
      const p01: Vec = [ox - uu[0] * hw + vv[0] * hh, oy - uu[1] * hw + vv[1] * hh, oz - uu[2] * hw + vv[2] * hh];

      /* shade the card as if it were part of a soft blob of foliage */
      const out = norm(ox - cen[0], oy - cen[1], oz - cen[2], face);
      const n = norm(face[0] * 0.3 + out[0], face[1] * 0.3 + out[1], face[2] * 0.3 + out[2], face);

      m.vertex(p00, n, 0, 0);
      m.vertex(p10, n, 1, 0);
      m.vertex(p11, n, 1, 1);
      m.vertex(p00, n, 0, 0);
      m.vertex(p11, n, 1, 1);
      m.vertex(p01, n, 0, 1);
    }
  }
  return m.geometry();
};

/* icosahedron, for the chunky stage-1 crown */
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V: readonly Vec[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map((v) => norm(v[0] as number, v[1] as number, v[2] as number));
const ICO_F: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

const buildBlobs = (sk: Skel, plan: Plan): THREE.BufferGeometry => {
  const m = new Mesh();
  const n = plan.blobs;
  const cls = sk.clusters;
  if (n === 0 || cls.length === 0) return m.geometry();

  /* farthest-point sampling gives blobs that cover the whole crown */
  const seeds: number[] = [sk.order[0] as number];
  const best = new Float64Array(cls.length).fill(Infinity);
  for (let k = 1; k < n; k++) {
    const s = cls[seeds[k - 1] as number] as Cluster;
    let far = 0;
    let fi = 0;
    for (let i = 0; i < cls.length; i++) {
      const c = cls[i] as Cluster;
      const dx = c.p[0] - s.p[0];
      const dy = c.p[1] - s.p[1];
      const dz = c.p[2] - s.p[2];
      const d = Math.min(best[i] as number, dx * dx + dy * dy + dz * dz);
      best[i] = d;
      if (d > far) {
        far = d;
        fi = i;
      }
    }
    seeds.push(fi);
  }

  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const sz = new Float64Array(n);
  const qx = new Float64Array(n);
  const qy = new Float64Array(n);
  const qz = new Float64Array(n);
  const ss = new Float64Array(n);
  const cnt = new Float64Array(n);
  for (const c of cls) {
    let bi = 0;
    let bd = Infinity;
    for (let k = 0; k < n; k++) {
      const s = cls[seeds[k] as number] as Cluster;
      const dx = c.p[0] - s.p[0];
      const dy = c.p[1] - s.p[1];
      const dz = c.p[2] - s.p[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        bd = d;
        bi = k;
      }
    }
    sx[bi] = (sx[bi] as number) + c.p[0];
    sy[bi] = (sy[bi] as number) + c.p[1];
    sz[bi] = (sz[bi] as number) + c.p[2];
    qx[bi] = (qx[bi] as number) + c.p[0] * c.p[0];
    qy[bi] = (qy[bi] as number) + c.p[1] * c.p[1];
    qz[bi] = (qz[bi] as number) + c.p[2] * c.p[2];
    ss[bi] = (ss[bi] as number) + c.size;
    cnt[bi] = (cnt[bi] as number) + 1;
  }

  for (let k = 0; k < n; k++) {
    const c = cnt[k] as number;
    if (c < 1) continue;
    const cx = (sx[k] as number) / c;
    const cy = (sy[k] as number) / c;
    const cz = (sz[k] as number) / c;
    const avg = (ss[k] as number) / c;
    const dev = (q: number, mean: number): number => Math.sqrt(Math.max(0, q / c - mean * mean));
    const rx = dev(qx[k] as number, cx) * 1.5 + avg * 1.5;
    const ry = dev(qy[k] as number, cy) * 1.5 + avg * 1.5;
    const rz = dev(qz[k] as number, cz) * 1.5 + avg * 1.5;
    const r = new Rng((sk.clusters[seeds[k] as number] as Cluster).seed + 7);
    const jit: number[] = [];
    for (let i = 0; i < ICO_V.length; i++) jit.push(r.range(0.78, 1.22));
    const pts: Vec[] = ICO_V.map((v, i) => {
      const j = jit[i] as number;
      return [cx + v[0] * rx * j, cy + v[1] * ry * j, cz + v[2] * rz * j] as Vec;
    });
    for (const f of ICO_F) {
      m.flat(pts[f[0]] as Vec, pts[f[1]] as Vec, pts[f[2]] as Vec, [0.18, 0.2, 0], [0.82, 0.24, 0], [0.5, 0.84, 0]);
    }
  }
  return m.geometry();
};

/* ──────────────────────────────────── grow ─────────────────────────────────── */

const measure = (g: THREE.BufferGeometry): { top: number; rad: number; tris: number } => {
  const a = g.getAttribute('position');
  let top = -Infinity;
  let rad = 0;
  for (let i = 0; i < a.count; i++) {
    const y = a.getY(i);
    if (y > top) top = y;
    const x = a.getX(i);
    const z = a.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    if (r > rad) rad = r;
  }
  return { top, rad, tris: a.count / 3 };
};

export function growTree(o: TreeOptions): Tree {
  const height = o.height > 0 ? o.height : 1;
  const sk = growSkeleton(o.species, o.seed);
  scaleSkel(sk, height / sk.nominalTop);

  const chains = buildChains(sk);
  const plan = planFor(sk, chains, o.detail);
  const bark = buildBark(chains, plan, o.detail === 0);
  const leaves = o.detail === 0 ? buildBlobs(sk, plan) : buildCards(sk, plan);

  const branches: Branch[] = [];
  for (const n of sk.nodes) {
    if (n.id === 0) continue;
    const par = sk.nodes[n.parent] as GNode;
    branches.push({
      id: n.id,
      parent: n.parent === 0 ? null : n.parent,
      order: n.order,
      start: [par.p[0], par.p[1], par.p[2]],
      end: [n.p[0], n.p[1], n.p[2]],
      r0: Math.max(segR0(sk, n), n.rad),
      r1: n.rad,
    });
  }

  const mb = measure(bark);
  const ml = measure(leaves);
  return {
    species: o.species,
    branches,
    bark,
    leaves,
    height: Math.max(mb.top, ml.top),
    radius: Math.max(mb.rad, ml.rad),
    triangles: mb.tris + ml.tris,
  };
}
