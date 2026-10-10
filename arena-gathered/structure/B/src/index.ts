// src/index.ts
/**
 * @hm/structure — a pure base-building kernel (Valheim / Dune style).
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
  readonly id: number; readonly s: number; readonly kind: Kind;
  readonly i: number; readonly j: number; readonly k: number;
  readonly r: 0 | 1 | 2 | 3; readonly mat: string;
}

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
  const piece: Piece = {
    id: b.nextId, s: p.s, kind: p.kind, i: p.i, j: p.j, k: p.k, r: p.r, mat: p.mat,
  };
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
