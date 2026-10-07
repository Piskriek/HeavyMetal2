/**
 * @hm/plotgrid — deterministic hex plot placement for a shared terraforming planet.
 *
 * Pure functions only: no DOM, no Date, no Math.random, no imports.
 * Every client replays the same event list and reaches the same map.
 */

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export type GridEvent =
  | { readonly kind: 'claim'; readonly id: string; readonly at: number; readonly near: string | null }
  | { readonly kind: 'move'; readonly id: string; readonly at: number; readonly near: string }
  | { readonly kind: 'remove'; readonly id: string; readonly at: number };

/** Distance between neighbouring plot centres, in metres. */
export const CELL = 1000 as const;

/** The planet never shrinks below this radius, in metres. */
export const MIN_PLANET_RADIUS = 12000 as const;

/** The six axial directions, pointy-top, in canonical order. */
export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const SQRT3_2 = Math.sqrt(3) / 2;

const dir = (i: number): Hex => {
  const d = DIRS[i];
  return d === undefined ? { q: 0, r: 0 } : d;
};

/** World-space centre of a plot's gate. */
export function centreOf(h: Hex): { readonly x: number; readonly z: number } {
  return { x: CELL * (h.q + h.r / 2) + 0, z: CELL * SQRT3_2 * h.r + 0 };
}

/** Inverse of centreOf: which plot contains this world-space point. */
export function hexAt(x: number, z: number): Hex {
  const fr = z / (CELL * SQRT3_2);
  const fq = x / CELL - fr / 2;
  const fy = -fq - fr;

  let rq = Math.round(fq);
  let ry = Math.round(fy);
  let rr = Math.round(fr);

  const dq = Math.abs(rq - fq);
  const dy = Math.abs(ry - fy);
  const dr = Math.abs(rr - fr);

  if (dq > dy && dq > dr) {
    rq = -ry - rr;
  } else if (dy > dr) {
    ry = -rq - rr;
  } else {
    rr = -rq - ry;
  }

  return { q: rq + 0, r: rr + 0 };
}

/** Hex (axial) distance in plots. */
export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 + 0;
}

/** The six plots touching this one, in DIRS order. */
export function neighbours(h: Hex): readonly Hex[] {
  const out: Hex[] = [];
  for (let i = 0; i < 6; i++) {
    const d = dir(i);
    out.push({ q: h.q + d.q + 0, r: h.r + d.r + 0 });
  }
  return out;
}

/** The 6n cells exactly n steps from c, in canonical ring order. */
export function ring(c: Hex, n: number): readonly Hex[] {
  if (!Number.isFinite(n) || n < 1) return [];
  const steps = Math.floor(n);
  const start = dir(4);
  let q = c.q + start.q * steps;
  let r = c.r + start.r * steps;
  const out: Hex[] = [];
  for (let i = 0; i < 6; i++) {
    const d = dir(i);
    for (let s = 0; s < steps; s++) {
      out.push({ q: q + 0, r: r + 0 });
      q += d.q;
      r += d.r;
    }
  }
  return out;
}

/** c, then ring 1 .. ring R, each in ring order. */
export function spiral(c: Hex, R: number): readonly Hex[] {
  const out: Hex[] = [{ q: c.q + 0, r: c.r + 0 }];
  const max = Number.isFinite(R) ? Math.floor(R) : 0;
  for (let n = 1; n <= max; n++) {
    for (const h of ring(c, n)) out.push(h);
  }
  return out;
}

/** 32-bit FNV-1a over UTF-16 code units; returns an unsigned 32-bit integer. */
export function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) + 0;
}

/** Radius of the settled disc used to seed friendless plots. */
export function settledRadius(placed: number): number {
  const n = placed > 0 ? placed : 0;
  return Math.ceil(Math.sqrt(n / 3)) + 2 + 0;
}

const keyOf = (h: Hex): string => `${h.q + 0},${h.r + 0}`;

const kindRank = (k: GridEvent['kind']): number => (k === 'claim' ? 0 : k === 'move' ? 1 : 2);

function compare(a: GridEvent, b: GridEvent): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return kindRank(a.kind) - kindRank(b.kind);
}

function firstFreeAround(c: Hex, occupied: ReadonlySet<string>): Hex {
  for (let n = 1; n < 1 << 20; n++) {
    const cells = ring(c, n);
    for (const h of cells) {
      if (!occupied.has(keyOf(h))) return h;
    }
  }
  return { q: c.q + 0, r: c.r + 0 };
}

const ORIGIN: Hex = { q: 0, r: 0 };

/** Replay the events (in canonical order) and return every placed plot's cell. */
export function layout(events: readonly GridEvent[]): ReadonlyMap<string, Hex> {
  const sorted = [...events].sort(compare);
  const placed = new Map<string, Hex>();
  const occupied = new Set<string>();
  const discs = new Map<number, readonly Hex[]>();

  const disc = (R: number): readonly Hex[] => {
    const cached = discs.get(R);
    if (cached !== undefined) return cached;
    const made = spiral(ORIGIN, R);
    discs.set(R, made);
    return made;
  };

  for (const e of sorted) {
    if (e.kind === 'claim') {
      if (placed.has(e.id)) continue;
      const anchor = e.near !== null && e.near !== e.id ? placed.get(e.near) : undefined;
      let cell: Hex;
      if (anchor !== undefined) {
        cell = firstFreeAround(anchor, occupied);
      } else {
        const cells = disc(settledRadius(placed.size));
        const target = cells[fnv1a(e.id) % cells.length] ?? ORIGIN;
        cell = occupied.has(keyOf(target)) ? firstFreeAround(target, occupied) : target;
      }
      placed.set(e.id, cell);
      occupied.add(keyOf(cell));
    } else if (e.kind === 'move') {
      const self = placed.get(e.id);
      const anchor = e.id === e.near ? undefined : placed.get(e.near);
      if (self === undefined || anchor === undefined) continue;
      if (distance(self, anchor) <= 1) continue;
      occupied.delete(keyOf(self));
      const cell = firstFreeAround(anchor, occupied);
      placed.set(e.id, cell);
      occupied.add(keyOf(cell));
    } else {
      const self = placed.get(e.id);
      if (self === undefined) continue;
      occupied.delete(keyOf(self));
      placed.delete(e.id);
    }
  }

  return placed;
}

/** Planet radius (metres) big enough to hold `count` plots. */
export function planetRadiusFor(count: number): number {
  const need = Number.isFinite(count) ? count : 0;
  let rings = 0;
  while (1 + 3 * rings * (rings + 1) < need) rings++;
  return Math.max(MIN_PLANET_RADIUS, (CELL * (rings + 2)) / (0.85 * Math.PI)) + 0;
}
