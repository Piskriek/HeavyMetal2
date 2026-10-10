// src/index.ts
/**
 * @hm/structure — a pure base-building kernel (Valheim / Dune style).
 *
 * No imports, no DOM, no Date, no Math.random, no `any`.
 * Every exported function is pure: inputs are never mutated and a refused
 * call returns the *same* base object it was given.
 */

export type Kind =
  | 'foundation' | 'floor' | 'ramp' | 'wall' | 'airlock'
  | 'pillar' | 'hardpoint' | 'bin' | 'bench' | 'repeater';

export interface Material { readonly vKeep: number; readonly hKeep: number }

export interface Structure {
  readonly id: number; readonly x: number; readonly y: number;
  readonly z: number; readonly yaw: number;
}

export interface Piece {
  readonly id: number;
  readonly s: number;
  readonly kind: Kind;
  readonly i: number;
  readonly j: number;
  readonly k: number;
  readonly r: 0 | 1 | 2 | 3;
  readonly mat: string;
  /** airlocks only; absent means closed. */
  readonly open?: boolean;
}

export interface Room {
  readonly s: number;
  readonly k: number;
  readonly cells: readonly (readonly [number, number])[];
  readonly sealed: boolean;
  readonly airlocks: readonly number[];
}

export type Snap =
  | {
      readonly mode: 'place';
      readonly piece: Omit<Piece, 'id'>;
      readonly ok: boolean;
      readonly why: string;
      readonly support: number;
    }
  | {
      readonly mode: 'found';
      readonly cx: number;
      readonly cz: number;
      readonly yaw: number;
      readonly ok: boolean;
      readonly why: string;
    };

export interface Base {
  readonly v: 1;
  readonly structures: readonly Structure[];
  readonly pieces: readonly Piece[];
  readonly nextId: number;
}

export interface Env {
  heightAt(x: number, z: number): number;
  readonly materials: Readonly<Record<string, Material>>;
}

export interface Result {
  readonly ok: boolean; readonly why: string;
  readonly base: Base; readonly id: number;
}

export const CELL = 4;
export const LEVEL = 3;
export const SKIRT = 3;
export const MIN_SUPPORT = 0.2;

export const LIMITS = {
  maxStructures: 64,
  maxPieces: 4096,
  maxChars: 65536,
  maxMats: 16,
  coord: 100000,
  cell: 1023,
  maxLevel: 63,
} as const;

const EPS = 0.05;

export type NewPiece = Omit<Piece, 'id'>;

/* ------------------------------------------------------------------ *
 * kind groups
 * ------------------------------------------------------------------ */

const isCellKind = (k: Kind): boolean =>
  k === 'foundation' || k === 'floor' || k === 'ramp';
const isEdgeKind = (k: Kind): boolean => k === 'wall' || k === 'airlock';
const isFixtureKind = (k: Kind): boolean =>
  k === 'bin' || k === 'bench' || k === 'repeater' || k === 'hardpoint';

const KINDS: readonly Kind[] = [
  'foundation', 'floor', 'ramp', 'wall', 'airlock',
  'pillar', 'hardpoint', 'bin', 'bench', 'repeater',
];

/* ------------------------------------------------------------------ *
 * slot keys
 * ------------------------------------------------------------------ */

const ck = (s: number, i: number, j: number, k: number): string => `c|${s}|${i}|${j}|${k}`;
const ek = (s: number, i: number, j: number, k: number, r: number): string => `e|${s}|${i}|${j}|${k}|${r}`;
const pk = (s: number, i: number, j: number, k: number): string => `p|${s}|${i}|${j}|${k}`;
const fk = (s: number, i: number, j: number, k: number): string => `f|${s}|${i}|${j}|${k}`;

interface Index {
  readonly cells: ReadonlyMap<string, Piece>;
  readonly edges: ReadonlyMap<string, Piece>;
  readonly pillars: ReadonlyMap<string, Piece>;
  readonly fixtures: ReadonlyMap<string, Piece>;
  readonly structs: ReadonlyMap<number, Structure>;
}

/** fixture spots occupied by a fixture piece. */
const fixtureSpots = (p: NewPiece): readonly string[] => {
  if (p.kind === 'hardpoint') {
    return [
      fk(p.s, p.i, p.j, p.k),
      fk(p.s, p.i + 1, p.j, p.k),
      fk(p.s, p.i, p.j + 1, p.k),
      fk(p.s, p.i + 1, p.j + 1, p.k),
    ];
  }
  return [fk(p.s, p.i, p.j, p.k)];
};

const buildIndex = (b: Base): Index => {
  const cells = new Map<string, Piece>();
  const edges = new Map<string, Piece>();
  const pillars = new Map<string, Piece>();
  const fixtures = new Map<string, Piece>();
  const structs = new Map<number, Structure>();
  for (const s of b.structures) structs.set(s.id, s);
  for (const p of b.pieces) {
    if (isCellKind(p.kind)) cells.set(ck(p.s, p.i, p.j, p.k), p);
    else if (isEdgeKind(p.kind)) edges.set(ek(p.s, p.i, p.j, p.k, p.r), p);
    else if (p.kind === 'pillar') pillars.set(pk(p.s, p.i, p.j, p.k), p);
    else for (const key of fixtureSpots(p)) fixtures.set(key, p);
  }
  return { cells, edges, pillars, fixtures, structs };
};

/* ------------------------------------------------------------------ *
 * geometry
 * ------------------------------------------------------------------ */

export const empty = (): Base => ({ v: 1, structures: [], pieces: [], nextId: 1 });

/** local metric coords (u,v) + level k -> world point. */
export const toWorld = (
  s: Structure, u: number, v: number, k: number,
): { readonly x: number; readonly y: number; readonly z: number } => {
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  return {
    x: s.x + u * c - v * sn,
    y: s.y + k * LEVEL,
    z: s.z + u * sn + v * c,
  };
};

/** the 5 terrain samples (4 corners + centre) of cell (i,j). */
const samples = (env: Env, s: Structure, i: number, j: number): number[] => {
  const u0 = i * CELL;
  const v0 = j * CELL;
  const pts: readonly (readonly [number, number])[] = [
    [u0, v0], [u0 + CELL, v0], [u0, v0 + CELL],
    [u0 + CELL, v0 + CELL], [u0 + CELL / 2, v0 + CELL / 2],
  ];
  const out: number[] = [];
  for (const pt of pts) {
    const w = toWorld(s, pt[0], pt[1], 0);
    out.push(env.heightAt(w.x, w.z));
  }
  return out;
};

const lowOf = (xs: readonly number[]): number => {
  let m = Infinity;
  for (const x of xs) if (x < m) m = x;
  return m;
};
const highOf = (xs: readonly number[]): number => {
  let m = -Infinity;
  for (const x of xs) if (x > m) m = x;
  return m;
};

const cellCentre = (s: Structure, i: number, j: number): { readonly x: number; readonly z: number } => {
  const w = toWorld(s, (i + 0.5) * CELL, (j + 0.5) * CELL, 0);
  return { x: w.x, z: w.z };
};

/** penetration depth (metres) of two CELL-sided squares (SAT). */
const squareOverlap = (
  ax: number, az: number, yawA: number,
  bx: number, bz: number, yawB: number,
): number => {
  const h = CELL / 2;
  const ua: readonly [number, number] = [Math.cos(yawA), Math.sin(yawA)];
  const va: readonly [number, number] = [-Math.sin(yawA), Math.cos(yawA)];
  const ub: readonly [number, number] = [Math.cos(yawB), Math.sin(yawB)];
  const vb: readonly [number, number] = [-Math.sin(yawB), Math.cos(yawB)];
  const axes: readonly (readonly [number, number])[] = [ua, va, ub, vb];
  const dx = bx - ax;
  const dz = bz - az;
  let best = Infinity;
  for (const n of axes) {
    const ra = h * (Math.abs(n[0] * ua[0] + n[1] * ua[1]) + Math.abs(n[0] * va[0] + n[1] * va[1]));
    const rb = h * (Math.abs(n[0] * ub[0] + n[1] * ub[1]) + Math.abs(n[0] * vb[0] + n[1] * vb[1]));
    const d = Math.abs(dx * n[0] + dz * n[1]);
    const ov = ra + rb - d;
    if (ov <= 0) return 0;
    if (ov < best) best = ov;
  }
  return best === Infinity ? 0 : best;
};

/* ------------------------------------------------------------------ *
 * supporters
 * ------------------------------------------------------------------ */

type Dir = 'V' | 'H';
interface Link { readonly id: number; readonly dir: Dir }

const push = (out: Link[], p: Piece | undefined, dir: Dir): void => {
  if (p === undefined) return;
  if (isFixtureKind(p.kind)) return; // fixtures support nothing
  out.push({ id: p.id, dir });
};

const supportersOf = (p: NewPiece, idx: Index): readonly Link[] => {
  const out: Link[] = [];
  const s = p.s;
  const { i, j, k } = p;
  const cell = (a: number, b: number, c: number): Piece | undefined => idx.cells.get(ck(s, a, b, c));
  const edge = (a: number, b: number, c: number, r: number): Piece | undefined => idx.edges.get(ek(s, a, b, c, r));
  const pil = (a: number, b: number, c: number): Piece | undefined => idx.pillars.get(pk(s, a, b, c));

  if (isCellKind(p.kind)) {
    push(out, edge(i, j, k - 1, 0), 'V');
    push(out, edge(i, j + 1, k - 1, 0), 'V');
    push(out, edge(i, j, k - 1, 1), 'V');
    push(out, edge(i + 1, j, k - 1, 1), 'V');
    push(out, pil(i, j, k - 1), 'V');
    push(out, pil(i + 1, j, k - 1), 'V');
    push(out, pil(i, j + 1, k - 1), 'V');
    push(out, pil(i + 1, j + 1, k - 1), 'V');
    if (p.kind === 'foundation') {
      const below = cell(i, j, k - 1);
      if (below !== undefined && below.kind === 'foundation') push(out, below, 'V');
    }
    push(out, cell(i - 1, j, k), 'H');
    push(out, cell(i + 1, j, k), 'H');
    push(out, cell(i, j - 1, k), 'H');
    push(out, cell(i, j + 1, k), 'H');
    return out;
  }

  if (isEdgeKind(p.kind)) {
    if (p.r === 0) {
      push(out, cell(i, j, k), 'V');
      push(out, cell(i, j - 1, k), 'V');
      push(out, edge(i, j, k - 1, 0), 'V');
      push(out, pil(i, j, k), 'H');
      push(out, pil(i + 1, j, k), 'H');
      push(out, edge(i - 1, j, k, 0), 'H');
      push(out, edge(i + 1, j, k, 0), 'H');
    } else {
      push(out, cell(i, j, k), 'V');
      push(out, cell(i - 1, j, k), 'V');
      push(out, edge(i, j, k - 1, 1), 'V');
      push(out, pil(i, j, k), 'H');
      push(out, pil(i, j + 1, k), 'H');
      push(out, edge(i, j - 1, k, 1), 'H');
      push(out, edge(i, j + 1, k, 1), 'H');
    }
    return out;
  }

  if (p.kind === 'pillar') {
    push(out, cell(i, j, k), 'V');
    push(out, cell(i - 1, j, k), 'V');
    push(out, cell(i, j - 1, k), 'V');
    push(out, cell(i - 1, j - 1, k), 'V');
    push(out, pil(i, j, k - 1), 'V');
    return out;
  }

  if (p.kind === 'hardpoint') {
    push(out, cell(i, j, k), 'V');
    push(out, cell(i + 1, j, k), 'V');
    push(out, cell(i, j + 1, k), 'V');
    push(out, cell(i + 1, j + 1, k), 'V');
  } else {
    push(out, cell(i, j, k), 'V');
  }
  return out;
};

const keepOf = (env: Env, mat: string, dir: Dir): number => {
  const m = env.materials[mat];
  if (m === undefined) return 0;
  return dir === 'V' ? m.vKeep : m.hKeep;
};

const isGrounded = (env: Env, idx: Index, p: NewPiece): boolean => {
  if (p.kind !== 'foundation') return false;
  const s = idx.structs.get(p.s);
  if (s === undefined) return false;
  const floorTop = s.y + p.k * LEVEL;
  return floorTop - lowOf(samples(env, s, p.i, p.j)) <= SKIRT;
};

/* ------------------------------------------------------------------ *
 * support solver (max-product Dijkstra)
 * ------------------------------------------------------------------ */

class Heap {
  private readonly v: number[] = [];
  private readonly k: number[] = [];
  get size(): number { return this.v.length; }
  push(key: number, val: number): void {
    this.k.push(key);
    this.v.push(val);
    let c = this.v.length - 1;
    while (c > 0) {
      const par = (c - 1) >> 1;
      if ((this.v[par] ?? 0) >= (this.v[c] ?? 0)) break;
      this.swap(par, c);
      c = par;
    }
  }
  pop(): { readonly key: number; readonly val: number } | undefined {
    const n = this.v.length;
    if (n === 0) return undefined;
    const key = this.k[0] ?? 0;
    const val = this.v[0] ?? 0;
    const lk = this.k.pop();
    const lv = this.v.pop();
    if (n > 1 && lk !== undefined && lv !== undefined) {
      this.k[0] = lk;
      this.v[0] = lv;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let b = c;
        if (l < this.v.length && (this.v[l] ?? 0) > (this.v[b] ?? 0)) b = l;
        if (r < this.v.length && (this.v[r] ?? 0) > (this.v[b] ?? 0)) b = r;
        if (b === c) break;
        this.swap(b, c);
        c = b;
      }
    }
    return { key, val };
  }
  private swap(a: number, b: number): void {
    const ka = this.k[a] ?? 0; const kb = this.k[b] ?? 0;
    const va = this.v[a] ?? 0; const vb = this.v[b] ?? 0;
    this.k[a] = kb; this.k[b] = ka;
    this.v[a] = vb; this.v[b] = va;
  }
}

const solve = (b: Base, env: Env, idx: Index): Map<number, number> => {
  const dist = new Map<number, number>();
  const deps = new Map<number, Array<readonly [number, number]>>();
  const heap = new Heap();
  for (const p of b.pieces) {
    dist.set(p.id, 0);
    if (isGrounded(env, idx, p)) {
      dist.set(p.id, 1);
      heap.push(p.id, 1);
      continue;
    }
    for (const link of supportersOf(p, idx)) {
      const f = keepOf(env, p.mat, link.dir);
      if (f <= 0) continue;
      const list = deps.get(link.id);
      if (list === undefined) deps.set(link.id, [[p.id, f]]);
      else list.push([p.id, f]);
    }
  }
  while (heap.size > 0) {
    const top = heap.pop();
    if (top === undefined) break;
    if (top.val < (dist.get(top.key) ?? 0) - 1e-15) continue;
    const list = deps.get(top.key);
    if (list === undefined) continue;
    for (const [to, f] of list) {
      const cand = top.val * f;
      if (cand <= 1e-12) continue;
      if (cand > (dist.get(to) ?? 0) + 1e-15) {
        dist.set(to, cand);
        heap.push(to, cand);
      }
    }
  }
  return dist;
};

export const supports = (b: Base, env: Env): ReadonlyMap<number, number> =>
  solve(b, env, buildIndex(b));

/* ------------------------------------------------------------------ *
 * validation
 * ------------------------------------------------------------------ */

const intOk = (n: number): boolean => Number.isInteger(n);

const overlapsOther = (
  b: Base, idx: Index, s: Structure, i: number, j: number, k: number,
): boolean => {
  const a = cellCentre(s, i, j);
  const ay = s.y + k * LEVEL;
  for (const q of b.pieces) {
    if (!isCellKind(q.kind)) continue;
    if (q.s === s.id) continue;
    const qs = idx.structs.get(q.s);
    if (qs === undefined) continue;
    const qy = qs.y + q.k * LEVEL;
    if (Math.abs(qy - ay) >= LEVEL) continue;
    const c = cellCentre(qs, q.i, q.j);
    if (squareOverlap(a.x, a.z, s.yaw, c.x, c.z, qs.yaw) > EPS) return true;
  }
  return false;
};

const occupied = (idx: Index, p: NewPiece): boolean => {
  if (isCellKind(p.kind)) return idx.cells.has(ck(p.s, p.i, p.j, p.k));
  if (isEdgeKind(p.kind)) return idx.edges.has(ek(p.s, p.i, p.j, p.k, p.r));
  if (p.kind === 'pillar') return idx.pillars.has(pk(p.s, p.i, p.j, p.k));
  for (const key of fixtureSpots(p)) if (idx.fixtures.has(key)) return true;
  return false;
};

const evaluate = (
  b: Base, env: Env, p: NewPiece, idx: Index, dist: Map<number, number>,
): { readonly ok: boolean; readonly why: string; readonly support: number } => {
  if (
    !KINDS.includes(p.kind) || !intOk(p.i) || !intOk(p.j) || !intOk(p.k) ||
    p.k < 0 || !intOk(p.r) || p.r < 0 || p.r > 3 ||
    (isEdgeKind(p.kind) && p.r > 1)
  ) {
    return { ok: false, why: 'bad-slot', support: 0 };
  }
  const s = idx.structs.get(p.s);
  if (s === undefined) return { ok: false, why: 'bad-slot', support: 0 };

  if (env.materials[p.mat] === undefined) return { ok: false, why: 'material', support: 0 };

  if (occupied(idx, p)) return { ok: false, why: 'occupied', support: 0 };

  if (isCellKind(p.kind)) {
    const sm = samples(env, s, p.i, p.j);
    const floorTop = s.y + p.k * LEVEL;
    if (highOf(sm) > floorTop + EPS) return { ok: false, why: 'ground', support: 0 };
    if (p.k === 0 && p.kind === 'foundation' && s.y - lowOf(sm) > SKIRT) {
      return { ok: false, why: 'steep', support: 0 };
    }
    if (overlapsOther(b, idx, s, p.i, p.j, p.k)) return { ok: false, why: 'overlap', support: 0 };
  }

  if (isFixtureKind(p.kind)) {
    if (p.kind === 'hardpoint') {
      const quad: readonly (readonly [number, number])[] = [
        [p.i, p.j], [p.i + 1, p.j], [p.i, p.j + 1], [p.i + 1, p.j + 1],
      ];
      for (const q of quad) {
        const c = idx.cells.get(ck(p.s, q[0], q[1], p.k));
        if (c === undefined || c.kind !== 'foundation' || !isGrounded(env, idx, c))
          return { ok: false, why: 'needs-pad', support: 0 };
      }
    } else if (!idx.cells.has(ck(p.s, p.i, p.j, p.k))) {
      return { ok: false, why: 'needs-floor', support: 0 };
    }
  }

  let sup = 0;
  if (isGrounded(env, idx, p)) sup = 1;
  else {
    for (const link of supportersOf(p, idx)) {
      const v = (dist.get(link.id) ?? 0) * keepOf(env, p.mat, link.dir);
      if (v > sup) sup = v;
    }
  }
  if (sup < MIN_SUPPORT) return { ok: false, why: 'unsupported', support: sup };
  return { ok: true, why: '', support: sup };
};

export const check = (
  b: Base, env: Env, p: NewPiece,
): { readonly ok: boolean; readonly why: string; readonly support: number } => {
  const idx = buildIndex(b);
  return evaluate(b, env, p, idx, solve(b, env, idx));
};

/* ------------------------------------------------------------------ *
 * mutators (pure)
 * ------------------------------------------------------------------ */

export const place = (b: Base, env: Env, p: NewPiece): Result => {
  const res = check(b, env, p);
  if (!res.ok) return { ok: false, why: res.why, base: b, id: -1 };
  const core = {
    id: b.nextId, s: p.s, kind: p.kind, i: p.i, j: p.j, k: p.k, r: p.r, mat: p.mat,
  };
  const piece: Piece =
    p.kind === 'airlock' && p.open === true ? { ...core, open: true } : core;
  return {
    ok: true, why: '',
    base: { v: 1, structures: b.structures, pieces: [...b.pieces, piece], nextId: b.nextId + 1 },
    id: piece.id,
  };
};

export const found = (
  b: Base, env: Env, cx: number, cz: number, yaw: number, mat: string,
): Result => {
  if (env.materials[mat] === undefined) return { ok: false, why: 'material', base: b, id: -1 };
  if (!Number.isFinite(cx) || !Number.isFinite(cz) || !Number.isFinite(yaw))
    return { ok: false, why: 'bad-slot', base: b, id: -1 };

  const sid = b.nextId;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const half = CELL / 2;
  const ox = cx - (half * c - half * sn);
  const oz = cz - (half * sn + half * c);

  const probe: Structure = { id: sid, x: ox, y: 0, z: oz, yaw };
  const sm = samples(env, probe, 0, 0);
  const hi = highOf(sm);
  const lo = lowOf(sm);
  if (hi - lo > SKIRT) return { ok: false, why: 'steep', base: b, id: -1 };

  const st: Structure = { id: sid, x: ox, y: hi, z: oz, yaw };
  const idx = buildIndex(b);
  if (overlapsOther(b, idx, st, 0, 0, 0)) return { ok: false, why: 'overlap', base: b, id: -1 };

  const piece: Piece = { id: sid + 1, s: sid, kind: 'foundation', i: 0, j: 0, k: 0, r: 0, mat };
  return {
    ok: true, why: '',
    base: {
      v: 1,
      structures: [...b.structures, st],
      pieces: [...b.pieces, piece],
      nextId: sid + 2,
    },
    id: piece.id,
  };
};

export const remove = (
  b: Base, env: Env, id: number,
): { readonly base: Base; readonly collapsed: readonly number[] } => {
  const isPiece = b.pieces.some((p) => p.id === id);
  const isStruct = b.structures.some((s) => s.id === id);
  if (!isPiece && !isStruct) return { base: b, collapsed: [] };

  const kept = isPiece ? b.pieces.filter((p) => p.id !== id) : b.pieces.filter((p) => p.s !== id);
  const structs = isStruct ? b.structures.filter((s) => s.id !== id) : b.structures;

  const stage: Base = { v: 1, structures: structs, pieces: kept, nextId: b.nextId };
  const dist = supports(stage, env);
  const collapsed: number[] = [];
  const alive: Piece[] = [];
  for (const p of kept) {
    if ((dist.get(p.id) ?? 0) < MIN_SUPPORT) collapsed.push(p.id);
    else alive.push(p);
  }
  collapsed.sort((a, c) => a - c);
  const used = new Set<number>();
  for (const p of alive) used.add(p.s);
  const finalStructs = structs.filter((s) => used.has(s.id));
  return {
    base: { v: 1, structures: finalStructs, pieces: alive, nextId: b.nextId },
    collapsed,
  };
};

/* ------------------------------------------------------------------ *
 * doors
 * ------------------------------------------------------------------ */

export const setOpen = (b: Base, id: number, open: boolean): Base => {
  let target: Piece | undefined;
  for (const p of b.pieces) if (p.id === id) target = p;
  if (target === undefined || target.kind !== 'airlock') return b;
  if ((target.open === true) === open) return b;
  const pieces = b.pieces.map((p): Piece => {
    if (p.id !== id) return p;
    const core = {
      id: p.id, s: p.s, kind: p.kind, i: p.i, j: p.j, k: p.k, r: p.r, mat: p.mat,
    };
    return open ? { ...core, open: true } : core;
  });
  return { v: 1, structures: b.structures, pieces, nextId: b.nextId };
};

/* ------------------------------------------------------------------ *
 * rooms
 * ------------------------------------------------------------------ */

const isBarrier = (p: Piece | undefined): boolean => {
  if (p === undefined) return false;
  if (p.kind === 'wall') return true;
  return p.kind === 'airlock' && p.open !== true;
};

export const rooms = (b: Base): readonly Room[] => {
  const idx = buildIndex(b);
  const roomCells = new Set<string>();
  for (const p of b.pieces) {
    if (p.kind !== 'foundation' && p.kind !== 'floor') continue;
    if (!idx.cells.has(ck(p.s, p.i, p.j, p.k + 1))) continue;
    roomCells.add(`${p.s}|${p.i}|${p.j}|${p.k}`);
  }
  const parse = (key: string): readonly [number, number, number, number] => {
    const parts = key.split('|');
    return [
      Number(parts[0] ?? 0), Number(parts[1] ?? 0),
      Number(parts[2] ?? 0), Number(parts[3] ?? 0),
    ];
  };
  /** edge piece between (i,j,k) and the neighbour in direction d. */
  const edgeOf = (
    s: number, i: number, j: number, k: number, d: number,
  ): { readonly p: Piece | undefined; readonly ni: number; readonly nj: number } => {
    if (d === 0) return { p: idx.edges.get(ek(s, i, j, k, 0)), ni: i, nj: j - 1 };
    if (d === 1) return { p: idx.edges.get(ek(s, i, j + 1, k, 0)), ni: i, nj: j + 1 };
    if (d === 2) return { p: idx.edges.get(ek(s, i, j, k, 1)), ni: i - 1, nj: j };
    return { p: idx.edges.get(ek(s, i + 1, j, k, 1)), ni: i + 1, nj: j };
  };

  const seen = new Set<string>();
  const out: Room[] = [];
  for (const key of roomCells) {
    if (seen.has(key)) continue;
    const [s, si, sj, k] = parse(key);
    const group: Array<readonly [number, number]> = [];
    const stack: Array<readonly [number, number]> = [[si, sj]];
    seen.add(key);
    while (stack.length > 0) {
      const cur = stack.pop();
      if (cur === undefined) break;
      group.push(cur);
      for (let d = 0; d < 4; d++) {
        const e = edgeOf(s, cur[0], cur[1], k, d);
        if (isBarrier(e.p)) continue;
        const nk = `${s}|${e.ni}|${e.nj}|${k}`;
        if (!roomCells.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        stack.push([e.ni, e.nj]);
      }
    }
    const inGroup = new Set<string>(group.map((c) => `${c[0]}|${c[1]}`));
    let sealed = true;
    const locks = new Set<number>();
    for (const c of group) {
      for (let d = 0; d < 4; d++) {
        const e = edgeOf(s, c[0], c[1], k, d);
        if (e.p !== undefined && e.p.kind === 'airlock') locks.add(e.p.id);
        if (isBarrier(e.p)) continue;
        if (!inGroup.has(`${e.ni}|${e.nj}`)) sealed = false;
      }
    }
    const cells = group
      .slice()
      .sort((a, c) => (a[0] - c[0]) || (a[1] - c[1]))
      .map((c): [number, number] => [c[0], c[1]]);
    out.push({ s, k, cells, sealed, airlocks: [...locks].sort((a, c) => a - c) });
  }
  out.sort((a, c) => {
    if (a.s !== c.s) return a.s - c.s;
    if (a.k !== c.k) return a.k - c.k;
    const ai = a.cells[0] ?? [0, 0];
    const ci = c.cells[0] ?? [0, 0];
    return (ai[0] - ci[0]) || (ai[1] - ci[1]);
  });
  return out;
};

/* ------------------------------------------------------------------ *
 * snapping
 * ------------------------------------------------------------------ */

const pointSquareDist = (u: number, v: number, i: number, j: number): number => {
  const x0 = i * CELL;
  const z0 = j * CELL;
  const dx = u < x0 ? x0 - u : u > x0 + CELL ? u - (x0 + CELL) : 0;
  const dz = v < z0 ? z0 - v : v > z0 + CELL ? v - (z0 + CELL) : 0;
  return Math.sqrt(dx * dx + dz * dz);
};

interface Cand { readonly d: number; readonly piece: NewPiece }

export const snap = (
  b: Base,
  env: Env,
  kind: Kind,
  aim: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
  mat: string,
  reach = 3,
): Snap | null => {
  const structs = b.structures.slice().sort((a, c) => a.id - c.id);
  const cands: Cand[] = [];

  for (const s of structs) {
    const co = Math.cos(s.yaw);
    const sn = Math.sin(s.yaw);
    const dx = aim.x - s.x;
    const dz = aim.z - s.z;
    const u = dx * co + dz * sn;
    const v = -dx * sn + dz * co;

    let inReach = false;
    for (const p of b.pieces) {
      if (p.s !== s.id || !isCellKind(p.kind)) continue;
      if (pointSquareDist(u, v, p.i, p.j) <= reach) { inReach = true; break; }
    }
    if (!inReach) continue;

    const k = Math.max(0, Math.round((aim.y - s.y) / LEVEL));
    const ci = Math.floor(u / CELL);
    const cj = Math.floor(v / CELL);
    const rawR = Math.round((aim.yaw - s.yaw) / (Math.PI / 2));
    const yr = (((rawR % 4) + 4) % 4) as 0 | 1 | 2 | 3;

    const add = (i: number, j: number, r: 0 | 1 | 2 | 3, ax: number, az: number): void => {
      const d = Math.sqrt((u - ax) * (u - ax) + (v - az) * (v - az));
      if (d > reach) return;
      cands.push({ d, piece: { s: s.id, kind, i, j, k, r, mat } });
    };

    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (isCellKind(kind)) {
          add(i, j, kind === 'ramp' ? yr : 0, (i + 0.5) * CELL, (j + 0.5) * CELL);
        } else if (isEdgeKind(kind)) {
          add(i, j, 0, (i + 0.5) * CELL, j * CELL);
          add(i, j, 1, i * CELL, (j + 0.5) * CELL);
        } else if (kind === 'pillar') {
          add(i, j, 0, i * CELL, j * CELL);
        } else if (kind === 'hardpoint') {
          add(i, j, yr, (i + 1) * CELL, (j + 1) * CELL);
        } else {
          add(i, j, yr, (i + 0.5) * CELL, (j + 0.5) * CELL);
        }
      }
    }
  }

  cands.sort((a, c) => {
    if (Math.abs(a.d - c.d) > 1e-12) return a.d - c.d;
    if (a.piece.s !== c.piece.s) return a.piece.s - c.piece.s;
    if (a.piece.i !== c.piece.i) return a.piece.i - c.piece.i;
    if (a.piece.j !== c.piece.j) return a.piece.j - c.piece.j;
    return a.piece.r - c.piece.r;
  });

  const uniq: Cand[] = [];
  const seen = new Set<string>();
  for (const c of cands) {
    const p = c.piece;
    const key = `${p.s}|${p.kind}|${p.i}|${p.j}|${p.k}|${isEdgeKind(p.kind) ? p.r : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }

  if (uniq.length === 0) {
    if (kind === 'foundation') {
      const f = found(b, env, aim.x, aim.z, aim.yaw, mat);
      return { mode: 'found', cx: aim.x, cz: aim.z, yaw: aim.yaw, ok: f.ok, why: f.why };
    }
    return null;
  }

  let first: Snap | null = null;
  for (const c of uniq) {
    const res = check(b, env, c.piece);
    const snapRes: Snap = {
      mode: 'place', piece: c.piece, ok: res.ok, why: res.why, support: res.support,
    };
    if (res.ok) return snapRes;
    if (first === null) first = snapRes;
  }
  return first;
};

/* ================================================================== *
 * codec
 * ================================================================== */

const MAGIC0 = 0x68; // 'h'
const MAGIC1 = 0x53; // 'S'
const FORMAT = 1;

const MATRE = /^[a-z0-9-]{1,24}$/;
const YAW_TOL = 1e-4;
const MM = 1000;
const RAD = 10000;

const kindCode = (k: Kind): number => KINDS.indexOf(k);

/** '' when the base obeys every codec rule, else the reason. */
const validateBase = (b: Base): string => {
  if (b === null || typeof b !== 'object') return 'bad-base';
  if (b.v !== 1) return 'bad-version';
  if (!Array.isArray(b.structures) || !Array.isArray(b.pieces)) return 'bad-base';
  if (b.structures.length > LIMITS.maxStructures) return 'too-many-structures';
  if (b.pieces.length > LIMITS.maxPieces) return 'too-many-pieces';
  if (!Number.isInteger(b.nextId) || b.nextId < 0 || b.nextId > 2147483648)
    return 'bad-nextId';

  const ids = new Set<number>();
  const structIds = new Set<number>();
  for (const s of b.structures) {
    if (!Number.isInteger(s.id) || s.id < 0 || s.id >= b.nextId) return 'bad-id';
    if (ids.has(s.id)) return 'duplicate-id';
    ids.add(s.id);
    structIds.add(s.id);
    for (const v of [s.x, s.y, s.z]) {
      if (!Number.isFinite(v) || Math.abs(v) > LIMITS.coord) return 'bad-coord';
    }
    if (!Number.isFinite(s.yaw) || Math.abs(s.yaw) > Math.PI + YAW_TOL) return 'bad-yaw';
  }

  const mats = new Set<string>();
  const slots = new Set<string>();
  for (const p of b.pieces) {
    if (!Number.isInteger(p.id) || p.id < 0 || p.id >= b.nextId) return 'bad-id';
    if (ids.has(p.id)) return 'duplicate-id';
    ids.add(p.id);
    if (!structIds.has(p.s)) return 'bad-structure';
    if (kindCode(p.kind) < 0) return 'bad-kind';
    if (!Number.isInteger(p.i) || Math.abs(p.i) > LIMITS.cell) return 'bad-cell';
    if (!Number.isInteger(p.j) || Math.abs(p.j) > LIMITS.cell) return 'bad-cell';
    if (!Number.isInteger(p.k) || p.k < 0 || p.k > LIMITS.maxLevel) return 'bad-level';
    if (!Number.isInteger(p.r) || p.r < 0 || p.r > 3) return 'bad-rotation';
    if (isEdgeKind(p.kind) && p.r > 1) return 'bad-rotation';
    if (typeof p.mat !== 'string' || !MATRE.test(p.mat)) return 'bad-material';
    mats.add(p.mat);
    if (p.open !== undefined) {
      if (typeof p.open !== 'boolean') return 'bad-open';
      if (p.open === true && p.kind !== 'airlock') return 'bad-open';
    }
    const keys = isCellKind(p.kind)
      ? [ck(p.s, p.i, p.j, p.k)]
      : isEdgeKind(p.kind)
        ? [ek(p.s, p.i, p.j, p.k, p.r)]
        : p.kind === 'pillar'
          ? [pk(p.s, p.i, p.j, p.k)]
          : fixtureSpots(p);
    for (const key of keys) {
      if (slots.has(key)) return 'occupied';
      slots.add(key);
    }
  }
  if (mats.size > LIMITS.maxMats) return 'too-many-materials';
  return '';
};

/* ------------------------- base64url ------------------------------ */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const b64encode = (bytes: readonly number[]): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2] ?? '';
    if (b1 === undefined) {
      out += B64[(b0 & 3) << 4] ?? '';
      break;
    }
    out += B64[((b0 & 3) << 4) | (b1 >> 4)] ?? '';
    if (b2 === undefined) {
      out += B64[(b1 & 15) << 2] ?? '';
      break;
    }
    out += B64[((b1 & 15) << 2) | (b2 >> 6)] ?? '';
    out += B64[b2 & 63] ?? '';
  }
  return out;
};

const b64value = (ch: string): number => {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90) return c - 65;
  if (c >= 97 && c <= 122) return c - 97 + 26;
  if (c >= 48 && c <= 57) return c - 48 + 52;
  if (c === 45) return 62;
  if (c === 95) return 63;
  return -1;
};

const b64decode = (text: string): number[] | null => {
  const n = text.length;
  if (n % 4 === 1) return null;
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const v = b64value(text.charAt(i));
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return out;
};

/* --------------------------- varints ------------------------------ */

const putVarint = (out: number[], value: number): void => {
  let n = value;
  while (n >= 128) {
    out.push((n % 128) + 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
};

const zig = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzig = (n: number): number => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

interface Cursor { readonly bytes: readonly number[]; at: number; bad: boolean }

const getVarint = (c: Cursor): number => {
  let result = 0;
  let mul = 1;
  for (let step = 0; step < 7; step++) {
    if (c.at >= c.bytes.length) { c.bad = true; return 0; }
    const byte = c.bytes[c.at] ?? 0;
    c.at++;
    result += (byte & 0x7f) * mul;
    if ((byte & 0x80) === 0) {
      if (result > 4294967296) { c.bad = true; return 0; }
      return result;
    }
    mul *= 128;
  }
  c.bad = true;
  return 0;
};

/* --------------------------- encode ------------------------------- */

export function encode(b: Base): string {
  const why = validateBase(b);
  if (why !== '') throw new Error(why);

  const matList: string[] = [];
  for (const p of b.pieces) if (!matList.includes(p.mat)) matList.push(p.mat);
  matList.sort((a, c) => (a < c ? -1 : a > c ? 1 : 0));
  const matIdx = new Map<string, number>();
  matList.forEach((mt, n) => matIdx.set(mt, n));

  const sIdx = new Map<number, number>();
  b.structures.forEach((s, n) => sIdx.set(s.id, n));

  const out: number[] = [MAGIC0, MAGIC1, FORMAT];
  putVarint(out, b.nextId);

  putVarint(out, b.structures.length);
  for (const s of b.structures) {
    putVarint(out, s.id);
    putVarint(out, zig(Math.round(s.x * MM)));
    putVarint(out, zig(Math.round(s.y * MM)));
    putVarint(out, zig(Math.round(s.z * MM)));
    putVarint(out, zig(Math.round(s.yaw * RAD)));
  }

  putVarint(out, matList.length);
  for (const mt of matList) {
    putVarint(out, mt.length);
    for (let n = 0; n < mt.length; n++) out.push(mt.charCodeAt(n) & 0xff);
  }

  putVarint(out, b.pieces.length);
  let prev = 0;
  for (const p of b.pieces) {
    putVarint(out, zig(p.id - prev));
    prev = p.id;
    const flags =
      kindCode(p.kind) | (p.r << 4) | (p.kind === 'airlock' && p.open === true ? 64 : 0);
    out.push(flags);
    putVarint(out, sIdx.get(p.s) ?? 0);
    putVarint(out, zig(p.i));
    putVarint(out, zig(p.j));
    putVarint(out, p.k);
    putVarint(out, matIdx.get(p.mat) ?? 0);
  }
  return b64encode(out);
}

/* --------------------------- decode ------------------------------- */

export function decode(text: string): Base | null {
  if (typeof text !== 'string') return null;
  if (text.length === 0 || text.length > LIMITS.maxChars) return null;
  const bytes = b64decode(text);
  if (bytes === null) return null;
  if (b64encode(bytes) !== text) return null; // canonical
  if (bytes.length < 4) return null;
  if (bytes[0] !== MAGIC0 || bytes[1] !== MAGIC1 || bytes[2] !== FORMAT) return null;

  const c: Cursor = { bytes, at: 3, bad: false };
  const nextId = getVarint(c);
  if (c.bad || nextId > 2147483648) return null;

  const sCount = getVarint(c);
  if (c.bad || sCount > LIMITS.maxStructures) return null;
  const structures: Structure[] = [];
  for (let n = 0; n < sCount; n++) {
    const id = getVarint(c);
    const x = unzig(getVarint(c)) / MM;
    const y = unzig(getVarint(c)) / MM;
    const z = unzig(getVarint(c)) / MM;
    const yaw = unzig(getVarint(c)) / RAD;
    if (c.bad) return null;
    structures.push({ id, x, y, z, yaw });
  }

  const mCount = getVarint(c);
  if (c.bad || mCount > LIMITS.maxMats) return null;
  const mats: string[] = [];
  for (let n = 0; n < mCount; n++) {
    const len = getVarint(c);
    if (c.bad || len === 0 || len > 24) return null;
    if (c.at + len > bytes.length) return null;
    let mt = '';
    for (let q = 0; q < len; q++) {
      mt += String.fromCharCode(bytes[c.at + q] ?? 0);
    }
    c.at += len;
    if (!MATRE.test(mt)) return null;
    mats.push(mt);
  }

  const pCount = getVarint(c);
  if (c.bad || pCount > LIMITS.maxPieces) return null;
  const pieces: Piece[] = [];
  let prev = 0;
  for (let n = 0; n < pCount; n++) {
    const id = prev + unzig(getVarint(c));
    prev = id;
    if (c.at >= bytes.length) return null;
    const flags = bytes[c.at] ?? 0;
    c.at++;
    if ((flags & 0x80) !== 0) return null;
    const kind = KINDS[flags & 15];
    if (kind === undefined) return null;
    const r = ((flags >> 4) & 3) as 0 | 1 | 2 | 3;
    const open = (flags & 64) !== 0;
    const si = getVarint(c);
    const i = unzig(getVarint(c));
    const j = unzig(getVarint(c));
    const k = getVarint(c);
    const mi = getVarint(c);
    if (c.bad) return null;
    const st = structures[si];
    const mt = mats[mi];
    if (st === undefined || mt === undefined) return null;
    const core = { id, s: st.id, kind, i, j, k, r, mat: mt };
    pieces.push(open ? { ...core, open: true } : core);
  }
  if (c.at !== bytes.length) return null; // trailing bytes

  const base: Base = { v: 1, structures, pieces, nextId };
  if (validateBase(base) !== '') return null;
  return base;
}
