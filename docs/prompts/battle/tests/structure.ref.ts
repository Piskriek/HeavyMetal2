// Reference implementation for the @hm/structure battle (docs/prompts/battle/structure.txt): written for clarity, not speed.
// It exists to validate the brief's expected numbers and the hidden suite; it is never landed.
export type Kind = 'foundation' | 'floor' | 'ramp' | 'wall' | 'airlock' | 'pillar' | 'hardpoint' | 'bin' | 'bench' | 'repeater';
export interface Material { readonly vKeep: number; readonly hKeep: number }
export interface Structure { readonly id: number; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
export interface Piece { readonly id: number; readonly s: number; readonly kind: Kind; readonly i: number; readonly j: number; readonly k: number; readonly r: 0 | 1 | 2 | 3; readonly mat: string; readonly open?: boolean }
export interface Base { readonly v: 1; readonly structures: readonly Structure[]; readonly pieces: readonly Piece[]; readonly nextId: number }
export interface Env { heightAt(x: number, z: number): number; readonly materials: Readonly<Record<string, Material>> }
export interface Result { readonly ok: boolean; readonly why: string; readonly base: Base; readonly id: number }
export const CELL = 4, LEVEL = 3, SKIRT = 3, MIN_SUPPORT = 0.2;
type Spec = Omit<Piece, 'id'>;
const isCell = (k: Kind): boolean => k === 'foundation' || k === 'floor' || k === 'ramp';
const isEdge = (k: Kind): boolean => k === 'wall' || k === 'airlock';
const isFix = (k: Kind): boolean => k === 'bin' || k === 'bench' || k === 'repeater';

export const empty = (): Base => ({ v: 1, structures: [], pieces: [], nextId: 1 });

export function toWorld(s: Structure, u: number, v: number, k: number): { x: number; y: number; z: number } {
  const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return { x: s.x + u * c - v * n, y: s.y + k * LEVEL, z: s.z + u * n + v * c };
}

const ck = (s: number, i: number, j: number, k: number): string => ['c', s, i, j, k].join(',');
const ek = (s: number, i: number, j: number, k: number, r: number): string => ['e', s, i, j, k, r].join(',');
const pk = (s: number, i: number, j: number, k: number): string => ['p', s, i, j, k].join(',');
const fk = (s: number, i: number, j: number, k: number): string => ['f', s, i, j, k].join(',');

function slots(p: Spec): string[] {
  if (isCell(p.kind)) return [ck(p.s, p.i, p.j, p.k)];
  if (isEdge(p.kind)) return [ek(p.s, p.i, p.j, p.k, p.r)];
  if (p.kind === 'pillar') return [pk(p.s, p.i, p.j, p.k)];
  if (p.kind === 'hardpoint') return [fk(p.s, p.i, p.j, p.k), fk(p.s, p.i + 1, p.j, p.k), fk(p.s, p.i, p.j + 1, p.k), fk(p.s, p.i + 1, p.j + 1, p.k)];
  return [fk(p.s, p.i, p.j, p.k)];
}

function index(pieces: readonly Spec[]): Map<string, Spec> {
  const m = new Map<string, Spec>();
  for (const p of pieces) for (const key of slots(p)) m.set(key, p);
  return m;
}

function samples(st: Structure, i: number, j: number, env: Env): number[] {
  const at: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]];
  return at.map(([a, b]) => { const w = toWorld(st, (i + a) * CELL, (j + b) * CELL, 0); return env.heightAt(w.x, w.z); });
}

function grounded(st: Structure, p: Spec, env: Env): boolean {
  if (p.kind !== 'foundation') return false;
  return st.y + p.k * LEVEL - Math.min(...samples(st, p.i, p.j, env)) <= SKIRT;
}

function supporters(p: Spec, idx: Map<string, Spec>): { q: Spec; v: boolean }[] {
  const out: { q: Spec; v: boolean }[] = [];
  const s = p.s, i = p.i, j = p.j, k = p.k;
  const add = (key: string, v: boolean, ok: (q: Spec) => boolean): void => { const q = idx.get(key); if (q && q !== p && ok(q)) out.push({ q, v }); };
  const cell = (q: Spec): boolean => isCell(q.kind), edge = (q: Spec): boolean => isEdge(q.kind), pil = (q: Spec): boolean => q.kind === 'pillar';
  if (isCell(p.kind)) {
    for (const e of [ek(s, i, j, k - 1, 0), ek(s, i, j + 1, k - 1, 0), ek(s, i, j, k - 1, 1), ek(s, i + 1, j, k - 1, 1)]) add(e, true, edge);
    for (const c of [pk(s, i, j, k - 1), pk(s, i + 1, j, k - 1), pk(s, i, j + 1, k - 1), pk(s, i + 1, j + 1, k - 1)]) add(c, true, pil);
    if (p.kind === 'foundation') add(ck(s, i, j, k - 1), true, (q) => q.kind === 'foundation');
    for (const c of [ck(s, i + 1, j, k), ck(s, i - 1, j, k), ck(s, i, j + 1, k), ck(s, i, j - 1, k)]) add(c, false, cell);
  } else if (isEdge(p.kind)) {
    add(ck(s, i, j, k), true, cell);
    add(p.r === 0 ? ck(s, i, j - 1, k) : ck(s, i - 1, j, k), true, cell);
    add(ek(s, i, j, k - 1, p.r), true, edge);
    for (const c of p.r === 0 ? [pk(s, i, j, k), pk(s, i + 1, j, k)] : [pk(s, i, j, k), pk(s, i, j + 1, k)]) add(c, false, pil);
    for (const e of p.r === 0 ? [ek(s, i - 1, j, k, 0), ek(s, i + 1, j, k, 0)] : [ek(s, i, j - 1, k, 1), ek(s, i, j + 1, k, 1)]) add(e, false, edge);
  } else if (p.kind === 'pillar') {
    for (const c of [ck(s, i, j, k), ck(s, i - 1, j, k), ck(s, i, j - 1, k), ck(s, i - 1, j - 1, k)]) add(c, true, cell);
    add(pk(s, i, j, k - 1), true, pil);
  } else {
    const cells = p.kind === 'hardpoint' ? [ck(s, i, j, k), ck(s, i + 1, j, k), ck(s, i, j + 1, k), ck(s, i + 1, j + 1, k)] : [ck(s, i, j, k)];
    for (const c of cells) add(c, true, cell);
  }
  return out;
}

/** Fixed point of support = max(grounded, max over supporters of support * keep); keeps < 1 make it converge. */
function solve(structures: readonly Structure[], pieces: readonly Spec[], env: Env): Map<Spec, number> {
  const idx = index(pieces), byId = new Map(structures.map((s) => [s.id, s] as const));
  const sup = new Map<Spec, number>(), lists = new Map<Spec, { q: Spec; v: boolean }[]>();
  for (const p of pieces) { sup.set(p, grounded(byId.get(p.s)!, p, env) ? 1 : 0); lists.set(p, supporters(p, idx)); }
  for (let changed = true; changed;) {
    changed = false;
    for (const p of pieces) {
      const m = env.materials[p.mat]!;
      let best = sup.get(p)!;
      for (const { q, v } of lists.get(p)!) best = Math.max(best, sup.get(q)! * (v ? m.vKeep : m.hKeep));
      if (best > sup.get(p)! + 1e-15) { sup.set(p, best); changed = true; }
    }
  }
  return sup;
}

export function supports(b: Base, env: Env): ReadonlyMap<number, number> {
  const s = solve(b.structures, b.pieces, env), out = new Map<number, number>();
  for (const p of b.pieces) out.set(p.id, s.get(p)!);
  return out;
}

export function check(b: Base, env: Env, p: Spec): { ok: boolean; why: string; support: number } {
  const st = b.structures.find((s) => s.id === p.s);
  const no = (why: string, support = 0): { ok: boolean; why: string; support: number } => ({ ok: false, why, support });
  const int = Number.isInteger;
  if (!st || !int(p.i) || !int(p.j) || !int(p.k) || p.k < 0 || ![0, 1, 2, 3].includes(p.r) || (isEdge(p.kind) && p.r > 1)) return no('bad-slot');
  if (!env.materials[p.mat]) return no('material');
  const idx = index(b.pieces);
  if (slots(p).some((key) => idx.has(key))) return no('occupied');
  if (isCell(p.kind) && Math.max(...samples(st, p.i, p.j, env)) > st.y + p.k * LEVEL + 0.05) return no('ground');
  if (isCell(p.kind)) {
    const mine = square(st, p.i, p.j);
    for (const q of b.pieces) if (isCell(q.kind) && q.s !== p.s && overlaps(mine, square(b.structures.find((s) => s.id === q.s)!, q.i, q.j))) return no('overlap');
  }
  if (isFix(p.kind) && !idx.has(ck(p.s, p.i, p.j, p.k))) return no('needs-floor');
  if (p.kind === 'hardpoint') {
    for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const q = idx.get(ck(p.s, p.i + a, p.j + c, p.k));
      if (!q || !grounded(st, q, env)) return no('needs-pad');
    }
  }
  const s = solve(b.structures, [...b.pieces, p], env).get(p)!;
  if (s < MIN_SUPPORT) return no('unsupported', s);
  return { ok: true, why: '', support: s };
}

export function place(b: Base, env: Env, p: Spec): Result {
  const c = check(b, env, p);
  if (!c.ok) return { ok: false, why: c.why, base: b, id: -1 };
  const id = b.nextId;
  return { ok: true, why: '', id, base: { ...b, pieces: [...b.pieces, { ...p, id }], nextId: id + 1 } };
}

type V2 = readonly [number, number];
function square(st: Structure, i: number, j: number): V2[] {
  const at: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return at.map(([a, c]) => { const w = toWorld(st, (i + a) * CELL, (j + c) * CELL, 0); return [w.x, w.z] as const; });
}
function overlaps(A: V2[], B: V2[]): boolean {
  for (const poly of [A, B]) for (let e = 0; e < 4; e++) {
    const p = poly[e]!, q = poly[(e + 1) % 4]!, L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ax = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L] as const;
    const pr = (P: V2[]): number[] => P.map((v) => v[0] * ax[0] + v[1] * ax[1]);
    const a = pr(A), c = pr(B);
    if (Math.min(Math.max(...a), Math.max(...c)) - Math.max(Math.min(...a), Math.min(...c)) <= 0.05) return false;
  }
  return true;
}

export function found(b: Base, env: Env, cx: number, cz: number, yaw: number, mat: string): Result {
  const no = (why: string): Result => ({ ok: false, why, base: b, id: -1 });
  if (!env.materials[mat]) return no('material');
  const c = Math.cos(yaw), n = Math.sin(yaw);
  const probe: Structure = { id: b.nextId, x: cx - (2 * c - 2 * n), y: 0, z: cz - (2 * n + 2 * c), yaw };
  const hs = samples(probe, 0, 0, env), y = Math.max(...hs);
  if (y - Math.min(...hs) > SKIRT) return no('steep');
  const st: Structure = { ...probe, y }, mine = square(st, 0, 0);
  for (const p of b.pieces) {
    if (!isCell(p.kind)) continue;
    const other = b.structures.find((s) => s.id === p.s)!;
    if (overlaps(mine, square(other, p.i, p.j))) return no('overlap');
  }
  const id = b.nextId + 1;
  return { ok: true, why: '', id, base: { ...b, structures: [...b.structures, st], pieces: [...b.pieces, { s: st.id, kind: 'foundation', i: 0, j: 0, k: 0, r: 0, mat, id }], nextId: id + 1 } };
}

export function remove(b: Base, env: Env, id: number): { base: Base; collapsed: number[] } {
  if (!b.pieces.some((p) => p.id === id)) return { base: b, collapsed: [] };
  const rest = b.pieces.filter((p) => p.id !== id), sup = supports({ ...b, pieces: rest }, env);
  const collapsed = rest.filter((p) => sup.get(p.id)! < MIN_SUPPORT).map((p) => p.id).sort((a, c) => a - c);
  const pieces = rest.filter((p) => !collapsed.includes(p.id)), used = new Set(pieces.map((p) => p.s));
  return { base: { ...b, pieces, structures: b.structures.filter((s) => used.has(s.id)) }, collapsed };
}

// ---------------------------------------------------------------------------------------------- round 2
export function setOpen(b: Base, id: number, open: boolean): Base {
  const p = b.pieces.find((q) => q.id === id);
  if (!p || p.kind !== 'airlock' || (p.open ?? false) === open) return b;
  return { ...b, pieces: b.pieces.map((q) => (q.id === id ? { ...q, open } : q)) };
}

export interface Room { readonly s: number; readonly k: number; readonly cells: readonly (readonly [number, number])[]; readonly sealed: boolean; readonly airlocks: readonly number[] }

export function rooms(b: Base): Room[] {
  const idx = index(b.pieces), out: Room[] = [];
  const barrier = (key: string): boolean => { const q = idx.get(key) as Piece | undefined; return !!q && (q.kind === 'wall' || (q.kind === 'airlock' && !q.open)); };
  const sides = (s: number, i: number, j: number, k: number): { e: string; n: [number, number] }[] => [
    { e: ek(s, i, j, k, 0), n: [i, j - 1] }, { e: ek(s, i, j + 1, k, 0), n: [i, j + 1] },
    { e: ek(s, i, j, k, 1), n: [i - 1, j] }, { e: ek(s, i + 1, j, k, 1), n: [i + 1, j] },
  ];
  for (const st of [...b.structures].sort((a, c) => a.id - c.id)) {
    const levels = [...new Set(b.pieces.filter((p) => p.s === st.id).map((p) => p.k))].sort((a, c) => a - c);
    for (const k of levels) {
      const isRoom = (i: number, j: number): boolean => {
        const f = idx.get(ck(st.id, i, j, k));
        return !!f && (f.kind === 'foundation' || f.kind === 'floor') && idx.has(ck(st.id, i, j, k + 1));
      };
      const cells = b.pieces.filter((p) => p.s === st.id && p.k === k && isRoom(p.i, p.j)).map((p) => [p.i, p.j] as [number, number]).sort((a, c) => a[0] - c[0] || a[1] - c[1]);
      const seen = new Set<string>();
      for (const [ci, cj] of cells) {
        if (seen.has(`${ci},${cj}`)) continue;
        const comp: [number, number][] = [], stack: [number, number][] = [[ci, cj]];
        seen.add(`${ci},${cj}`);
        let sealed = true;
        const locks = new Set<number>();
        while (stack.length) {
          const [i, j] = stack.pop()!;
          comp.push([i, j]);
          for (const { e, n } of sides(st.id, i, j, k)) {
            const q = idx.get(e) as Piece | undefined;
            if (q && q.kind === 'airlock') locks.add(q.id);
            if (barrier(e)) continue;
            if (!isRoom(n[0], n[1])) { sealed = false; continue; }
            const key = `${n[0]},${n[1]}`;
            if (!seen.has(key)) { seen.add(key); stack.push(n); }
          }
        }
        comp.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
        out.push({ s: st.id, k, cells: comp, sealed, airlocks: [...locks].sort((a, c) => a - c) });
      }
    }
  }
  return out;
}

export type Snap =
  | { readonly mode: 'place'; readonly piece: Spec; readonly ok: boolean; readonly why: string; readonly support: number }
  | { readonly mode: 'found'; readonly cx: number; readonly cz: number; readonly yaw: number; readonly ok: boolean; readonly why: string };

export function snap(b: Base, env: Env, kind: Kind, aim: { x: number; y: number; z: number; yaw: number }, mat: string, reach = 3): Snap | null {
  type C = { piece: Spec; d: number };
  const cands: C[] = [];
  for (const st of [...b.structures].sort((a, c) => a.id - c.id)) {
    const c = Math.cos(st.yaw), n = Math.sin(st.yaw), dx = aim.x - st.x, dz = aim.z - st.z;
    const u = dx * c + dz * n, v = -dx * n + dz * c, k = Math.max(0, Math.round((aim.y - st.y) / LEVEL));
    const ci = Math.floor(u / CELL), cj = Math.floor(v / CELL);
    const near = b.pieces.some((p) => p.s === st.id && isCell(p.kind) && Math.hypot(Math.max(p.i * CELL - u, 0, u - (p.i + 1) * CELL), Math.max(p.j * CELL - v, 0, v - (p.j + 1) * CELL)) <= reach);
    if (!near) continue;
    const turn = ((Math.round((aim.yaw - st.yaw) / (Math.PI / 2)) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
    const push = (i: number, j: number, r: 0 | 1 | 2 | 3, au: number, av: number): void => {
      const d = Math.hypot(au - u, av - v);
      if (d <= reach) cands.push({ piece: { s: st.id, kind, i, j, k, r, mat }, d });
    };
    for (let a = -1; a <= 1; a++) for (let e = -1; e <= 1; e++) {
      const i = ci + a, j = cj + e;
      if (isCell(kind) || isFix(kind)) push(i, j, kind === 'ramp' || isFix(kind) ? turn : 0, (i + 0.5) * CELL, (j + 0.5) * CELL);
      else if (isEdge(kind)) { push(i, j, 0, (i + 0.5) * CELL, j * CELL); push(i, j, 1, i * CELL, (j + 0.5) * CELL); }
      else if (kind === 'pillar') push(i, j, 0, i * CELL, j * CELL);
      else if (kind === 'hardpoint') push(i, j, 0, (i + 1) * CELL, (j + 1) * CELL);
    }
  }
  const order = (p: C, q: C): number => p.d - q.d || p.piece.s - q.piece.s || p.piece.i - q.piece.i || p.piece.j - q.piece.j || p.piece.r - q.piece.r;
  const seen = new Set<string>(), uniq = cands.sort(order).filter((c) => { const key = slots(c.piece).join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
  const checked = uniq.map((c) => ({ c, r: check(b, env, c.piece) }));
  const best = checked.find((x) => x.r.ok) ?? checked[0];
  if (best) return { mode: 'place', piece: best.c.piece, ok: best.r.ok, why: best.r.why, support: best.r.support };
  if (kind !== 'foundation') return null;
  const f = found(b, env, aim.x, aim.z, aim.yaw, mat);
  return { mode: 'found', cx: aim.x, cz: aim.z, yaw: aim.yaw, ok: f.ok, why: f.why };
}
