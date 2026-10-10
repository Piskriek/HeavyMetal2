/**
 * @hm/lattice
 *
 * Storage boxes that are linked into shared networks by relays, so a base has
 * one inventory. Every function here is pure: inputs are never mutated, all
 * fields are readonly, and results are freshly built values.
 */

export interface ItemDef {
  readonly stack: number;
  readonly kg: number;
}

export type Defs = Record<string, ItemDef>;

export interface Stack {
  readonly item: string;
  readonly n: number;
}

export interface Box {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly slots: readonly (Stack | null)[];
  readonly maxKg: number;
}

export interface Relay {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly range: number;
}

export type Taken = { readonly box: number; readonly item: string; readonly n: number };

export interface Point {
  readonly x: number;
  readonly z: number;
}

export interface DepositResult {
  readonly box: Box;
  readonly left: number;
}

export interface WithdrawResult {
  readonly box: Box;
  readonly got: number;
}

export interface PullOk {
  readonly ok: true;
  readonly boxes: Box[];
  readonly taken: Taken[];
}

export interface PullShort {
  readonly ok: false;
  readonly short: Stack[];
}

export type PullResult = PullOk | PullShort;

export interface StoreResult {
  readonly boxes: Box[];
  readonly left: Stack[];
}

/* ------------------------------------------------------------------ helpers */

/** A count: an integer >= 0. Fractions round down, negatives and NaN act as 0. */
function cnt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const floored = Math.floor(value);
  return floored > 0 ? floored : 0;
}

/** A magnitude (weight, range): NaN and negatives act as 0. */
function mag(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value > 0 ? value : 0;
}

/** Look up an item definition without ever seeing inherited keys. */
function defOf(defs: Defs, item: string): ItemDef | undefined {
  return Object.prototype.hasOwnProperty.call(defs, item) ? defs[item] : undefined;
}

/** Fresh, dense copy of a slot list. */
function copySlots(slots: readonly (Stack | null)[]): (Stack | null)[] {
  const out: (Stack | null)[] = new Array(slots.length);
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    out[i] = s === null || s === undefined ? null : s;
  }
  return out;
}

/**
 * How many units of an item weighing `per` kg each still fit in a box that is
 * already carrying `weight` kg and may carry at most `maxKg` kg. A hair of
 * tolerance keeps float noise from losing a whole unit.
 */
function unitRoom(weight: number, per: number, maxKg: number): number {
  if (per <= 0) return Number.MAX_SAFE_INTEGER;
  const cap = mag(maxKg);
  if (!Number.isFinite(cap)) return Number.MAX_SAFE_INTEGER;
  const room = cap + Math.max(1e-9, cap * 1e-9) - weight;
  if (!(room > 0)) return 0;
  const units = Math.floor(room / per);
  return units > 0 ? units : 0;
}

function holds(b: Box, item: string): boolean {
  const slots = b.slots;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s !== null && s !== undefined && s.item === item) return true;
  }
  return false;
}

/* -------------------------------------------------------------- constructors */

export function box(id: number, x: number, z: number, slotCount: number, maxKg: number): Box {
  const n = cnt(slotCount);
  const slots: (Stack | null)[] = new Array(n);
  for (let i = 0; i < n; i += 1) slots[i] = null;
  return { id, x, z, slots, maxKg };
}

/* -------------------------------------------------------------- box level ops */

export function kg(b: Box, defs: Defs): number {
  let total = 0;
  const slots = b.slots;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s === null || s === undefined) continue;
    const def = defOf(defs, s.item);
    if (def === undefined) continue;
    total += cnt(s.n) * mag(def.kg);
  }
  return total;
}

export function count(b: Box, item: string): number {
  let total = 0;
  const slots = b.slots;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s === null || s === undefined || s.item !== item) continue;
    total += cnt(s.n);
  }
  return total;
}

export function deposit(b: Box, defs: Defs, item: string, n: number): DepositResult {
  const want = cnt(n);
  const def = defOf(defs, item);
  if (def === undefined || want <= 0) return { box: b, left: want };
  const stack = cnt(def.stack);
  const per = mag(def.kg);
  if (stack <= 0) return { box: b, left: want };

  const slots = copySlots(b.slots);
  let left = want;
  let weight = kg(b, defs);

  // Phase 0 tops up stacks of this item in slot order, phase 1 fills empty slots.
  search: for (let phase = 0; phase < 2; phase += 1) {
    for (let i = 0; i < slots.length && left > 0; i += 1) {
      const s = slots[i];
      if (phase === 0) {
        if (s === null || s.item !== item) continue;
        const have = cnt(s.n);
        if (have >= stack) continue;
        const room = unitRoom(weight, per, b.maxKg);
        if (room <= 0) break search;
        const take = Math.min(stack - have, left, room);
        slots[i] = { item, n: have + take };
        left -= take;
        weight += take * per;
      } else {
        if (s !== null) continue;
        const room = unitRoom(weight, per, b.maxKg);
        if (room <= 0) break search;
        const take = Math.min(stack, left, room);
        slots[i] = { item, n: take };
        left -= take;
        weight += take * per;
      }
    }
  }

  if (left === want) return { box: b, left };
  return { box: { ...b, slots }, left };
}

/**
 * Removes up to `want` units of `item`, always draining the smallest stack of
 * that item first (ties go to the lower slot). Emptied slots become null.
 */
function takeFrom(b: Box, item: string, want: number): WithdrawResult {
  if (want <= 0) return { box: b, got: 0 };
  const slots = b.slots;
  const where: number[] = [];
  const have: number[] = [];
  let total = 0;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s === null || s === undefined || s.item !== item) continue;
    const units = cnt(s.n);
    where.push(i);
    have.push(units);
    total += units;
  }
  if (total <= 0) return { box: b, got: 0 };

  const out = copySlots(slots);
  if (total <= want) {
    for (let k = 0; k < where.length; k += 1) out[where[k]!] = null;
    return { box: { ...b, slots: out }, got: total };
  }

  const order: number[] = [];
  for (let k = 0; k < where.length; k += 1) order.push(k);
  order.sort((p, q) => have[p]! - have[q]! || where[p]! - where[q]!);

  let remaining = want;
  for (let k = 0; k < order.length && remaining > 0; k += 1) {
    const hit = order[k]!;
    const units = have[hit]!;
    const take = units <= remaining ? units : remaining;
    out[where[hit]!] = take >= units ? null : { item, n: units - take };
    remaining -= take;
  }
  return { box: { ...b, slots: out }, got: want };
}

export function withdraw(b: Box, item: string, n: number): WithdrawResult {
  return takeFrom(b, item, cnt(n));
}

/* ------------------------------------------------------------------ networks */

export function links(boxes: readonly Box[], relays: readonly Relay[]): number[][] {
  const nb = boxes.length;
  const nr = relays.length;
  const parent: number[] = new Array(nb + nr);
  for (let i = 0; i < parent.length; i += 1) parent[i] = i;

  const find = (node: number): number => {
    let root = node;
    while (parent[root]! !== root) root = parent[root]!;
    while (parent[node]! !== node) {
      const next = parent[node]!;
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const join = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const reach = (ax: number, az: number, bx: number, bz: number, range: number): boolean => {
    const dx = ax - bx;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz) <= mag(range) + 1e-9;
  };

  // A box joins every relay whose field covers it.
  for (let i = 0; i < nb; i += 1) {
    const b = boxes[i]!;
    for (let j = 0; j < nr; j += 1) {
      const r = relays[j]!;
      if (reach(b.x, b.z, r.x, r.z, r.range)) join(i, nb + j);
    }
  }
  // Two relays link when they are no further apart than the larger range.
  for (let j = 0; j < nr; j += 1) {
    const a = relays[j]!;
    for (let k = j + 1; k < nr; k += 1) {
      const c = relays[k]!;
      const span = Math.max(mag(a.range), mag(c.range));
      if (reach(a.x, a.z, c.x, c.z, span)) join(nb + j, nb + k);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < nb; i += 1) {
    const root = find(i);
    const list = groups.get(root);
    if (list === undefined) groups.set(root, [boxes[i]!.id]);
    else list.push(boxes[i]!.id);
  }
  const out: number[][] = [];
  groups.forEach((group) => {
    group.sort((p, q) => p - q);
    out.push(group);
  });
  out.sort((p, q) => p[0]! - q[0]!);
  return out;
}

export function totals(boxes: readonly Box[], ids: readonly number[]): Record<string, number> {
  const allow = new Set<number>();
  for (const id of ids) allow.add(id);

  const acc = new Map<string, number>();
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]!;
    if (!allow.has(b.id)) continue;
    const slots = b.slots;
    for (let j = 0; j < slots.length; j += 1) {
      const s = slots[j];
      if (s === null || s === undefined) continue;
      const prev = acc.get(s.item);
      acc.set(s.item, prev === undefined ? cnt(s.n) : prev + cnt(s.n));
    }
  }
  const out: Record<string, number> = {};
  acc.forEach((n, item) => {
    out[item] = n;
  });
  return out;
}

/* ------------------------------------------------------------------ network ops */

interface Stop {
  readonly i: number;
  readonly d: number;
  readonly id: number;
}

function byDistance(boxes: readonly Box[], ids: readonly number[], at: Point): Stop[] {
  const allow = new Set<number>();
  for (const id of ids) allow.add(id);
  const stops: Stop[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]!;
    if (!allow.has(b.id)) continue;
    const dx = b.x - at.x;
    const dz = b.z - at.z;
    stops.push({ i, d: dx * dx + dz * dz, id: b.id });
  }
  // Nearest first, ties broken by the lower box id.
  stops.sort((p, q) => (p.d < q.d ? -1 : p.d > q.d ? 1 : p.id - q.id));
  return stops;
}

export function pull(
  boxes: readonly Box[],
  ids: readonly number[],
  at: Point,
  need: readonly Stack[],
): PullResult {
  const stops = byDistance(boxes, ids, at);

  // Which boxes hold which item, in visiting order (a box appears once).
  const holders = new Map<string, number[]>();
  for (let k = 0; k < stops.length; k += 1) {
    const stop = stops[k]!;
    const slots = boxes[stop.i]!.slots;
    for (let j = 0; j < slots.length; j += 1) {
      const s = slots[j];
      if (s === null || s === undefined || !(s.n > 0)) continue;
      const list = holders.get(s.item);
      if (list === undefined) holders.set(s.item, [stop.i]);
      else if (list[list.length - 1] !== stop.i) list.push(stop.i);
    }
  }

  // Merge duplicate needs, keeping first-seen order.
  const needs: { readonly item: string; n: number }[] = [];
  const seat = new Map<string, number>();
  for (let i = 0; i < need.length; i += 1) {
    const s = need[i];
    if (s === null || s === undefined) continue;
    const n = cnt(s.n);
    if (n <= 0) continue;
    const at2 = seat.get(s.item);
    if (at2 === undefined) {
      seat.set(s.item, needs.length);
      needs.push({ item: s.item, n });
    } else {
      const cur = needs[at2]!;
      needs[at2] = { item: cur.item, n: cur.n + n };
    }
  }

  const live: Box[] = boxes.slice();
  const taken: Taken[] = [];
  const takenAt = new Map<string, number>();
  const short: Stack[] = [];

  for (let k = 0; k < needs.length; k += 1) {
    const nd = needs[k]!;
    let remaining = nd.n;
    const list = holders.get(nd.item);
    if (list !== undefined) {
      for (let j = 0; j < list.length && remaining > 0; j += 1) {
        const bi = list[j]!;
        const src = live[bi]!;
        const res = takeFrom(src, nd.item, remaining);
        if (res.got <= 0) continue;
        live[bi] = res.box;
        remaining -= res.got;
        const key = `${src.id}\u0000${nd.item}`;
        const at3 = takenAt.get(key);
        if (at3 === undefined) {
          takenAt.set(key, taken.length);
          taken.push({ box: src.id, item: nd.item, n: res.got });
        } else {
          const cur = taken[at3]!;
          taken[at3] = { box: cur.box, item: cur.item, n: cur.n + res.got };
        }
      }
    }
    if (remaining > 0) short.push({ item: nd.item, n: remaining });
  }

  if (short.length > 0) return { ok: false, short };
  return { ok: true, boxes: live, taken };
}

export function store(
  boxes: readonly Box[],
  ids: readonly number[],
  at: Point,
  defs: Defs,
  items: readonly Stack[],
): StoreResult {
  const stops = byDistance(boxes, ids, at);
  const live: Box[] = boxes.slice();
  const left: Stack[] = [];

  for (let k = 0; k < items.length; k += 1) {
    const it = items[k];
    if (it === null || it === undefined) continue;
    const want = cnt(it.n);
    if (want <= 0) continue;
    let remaining = want;
    for (let pass = 0; pass < 2 && remaining > 0; pass += 1) {
      for (let j = 0; j < stops.length && remaining > 0; j += 1) {
        const stop = stops[j]!;
        const target = live[stop.i]!;
        const already = holds(target, it.item);
        if (pass === 0 ? !already : already) continue;
        const res = deposit(target, defs, it.item, remaining);
        if (res.left >= remaining) continue;
        live[stop.i] = res.box;
        remaining = res.left;
      }
    }
    if (remaining > 0) left.push({ item: it.item, n: remaining });
  }

  return { boxes: live, left };
}
