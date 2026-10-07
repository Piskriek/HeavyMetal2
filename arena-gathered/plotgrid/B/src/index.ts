/**
 * @hm/plotgrid
 *
 * Deterministic axial-hex plot layout for a shared-planet terraforming game.
 * Every client replays the same published events and must get the same map.
 */

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export type GridEvent =
  | {
      readonly kind: "claim";
      readonly id: string;
      readonly at: number;
      readonly near: string | null;
    }
  | {
      readonly kind: "move";
      readonly id: string;
      readonly at: number;
      readonly near: string;
    }
  | {
      readonly kind: "remove";
      readonly id: string;
      readonly at: number;
    };

export const CELL: 1000 = 1000;
export const MIN_PLANET_RADIUS: 12000 = 12000;

const DIR_E: Hex = { q: 1, r: 0 };
const DIR_NE: Hex = { q: 1, r: -1 };
const DIR_NW: Hex = { q: 0, r: -1 };
const DIR_W: Hex = { q: -1, r: 0 };
const DIR_SW: Hex = { q: -1, r: 1 };
const DIR_SE: Hex = { q: 0, r: 1 };

/** Pointy-top axial directions, east first, then counter-clockwise. */
export const DIRS: readonly Hex[] = [DIR_E, DIR_NE, DIR_NW, DIR_W, DIR_SW, DIR_SE];

const ORIGIN: Hex = { q: 0, r: 0 };

function n0(n: number): number {
  return n + 0;
}

function hex(q: number, r: number): Hex {
  return { q: n0(q), r: n0(r) };
}

function add(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

function mul(h: Hex, n: number): Hex {
  return hex(h.q * n, h.r * n);
}

function keyOf(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function centreOf(h: Hex): { readonly x: number; readonly z: number } {
  return {
    x: n0(CELL * (h.q + h.r / 2)),
    z: n0(CELL * (Math.sqrt(3) / 2) * h.r),
  };
}

export function hexAt(x: number, z: number): Hex {
  const rf = (2 * z) / (CELL * Math.sqrt(3));
  const qf = x / CELL - rf / 2;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) {
    q = -r - s;
  } else if (dr > ds) {
    r = -q - s;
  }
  return hex(q, r);
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return n0((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

export function neighbours(h: Hex): readonly Hex[] {
  const out: Hex[] = [];
  for (const d of DIRS) {
    out.push(add(h, d));
  }
  return out;
}

export function ring(c: Hex, n: number): readonly Hex[] {
  if (n < 1) return [];
  const out: Hex[] = [];
  // Start at c + DIRS[4] * n, then walk n steps along each DIRS[i].
  let cur = add(c, mul(DIR_SW, n));
  for (const d of DIRS) {
    for (let step = 0; step < n; step++) {
      out.push(cur);
      cur = add(cur, d);
    }
  }
  return out;
}

export function spiral(c: Hex, R: number): readonly Hex[] {
  const out: Hex[] = [hex(c.q, c.r)];
  for (let n = 1; n <= R; n++) {
    const cells = ring(c, n);
    for (const h of cells) {
      out.push(h);
    }
  }
  return out;
}

export function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function settledRadius(placed: number): number {
  return Math.ceil(Math.sqrt(placed / 3)) + 2;
}

function firstFreeAround(c: Hex, occupied: Set<string>): Hex {
  let n = 1;
  while (n < 2147483647) {
    const cells = ring(c, n);
    for (const h of cells) {
      if (!occupied.has(keyOf(h))) return h;
    }
    n += 1;
  }
  return hex(c.q, c.r);
}

function kindRank(kind: GridEvent["kind"]): number {
  if (kind === "claim") return 0;
  if (kind === "move") return 1;
  return 2;
}

function compareEvents(a: GridEvent, b: GridEvent): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return kindRank(a.kind) - kindRank(b.kind);
}

export function layout(events: readonly GridEvent[]): ReadonlyMap<string, Hex> {
  const ordered = events.slice();
  ordered.sort(compareEvents);

  const byId = new Map<string, Hex>();
  const occupied = new Set<string>();
  const discCache: (readonly Hex[] | undefined)[] = [];

  const disc = (R: number): readonly Hex[] => {
    const hit = discCache[R];
    if (hit !== undefined) return hit;
    const cells = spiral(ORIGIN, R);
    discCache[R] = cells;
    return cells;
  };

  const occupy = (id: string, h: Hex): void => {
    byId.set(id, h);
    occupied.add(keyOf(h));
  };

  const vacate = (id: string): void => {
    const h = byId.get(id);
    if (h === undefined) return;
    byId.delete(id);
    occupied.delete(keyOf(h));
  };

  const placeFree = (id: string, placed: number): Hex => {
    const cells = disc(settledRadius(placed));
    const len = cells.length;
    if (len === 0) {
      if (!occupied.has(keyOf(ORIGIN))) return hex(0, 0);
      return firstFreeAround(ORIGIN, occupied);
    }
    const target = cells[fnv1a(id) % len];
    if (target === undefined) {
      if (!occupied.has(keyOf(ORIGIN))) return hex(0, 0);
      return firstFreeAround(ORIGIN, occupied);
    }
    if (!occupied.has(keyOf(target))) return target;
    return firstFreeAround(target, occupied);
  };

  for (const ev of ordered) {
    if (ev.kind === "claim") {
      if (byId.has(ev.id)) continue;
      const nearId = ev.near;
      const friend =
        nearId !== null && nearId !== ev.id ? byId.get(nearId) : undefined;
      const cell =
        friend !== undefined ? firstFreeAround(friend, occupied) : placeFree(ev.id, byId.size);
      occupy(ev.id, cell);
    } else if (ev.kind === "move") {
      const self = byId.get(ev.id);
      const friend = byId.get(ev.near);
      if (self === undefined || friend === undefined) continue;
      if (ev.id === ev.near) continue;
      if (distance(self, friend) === 1) continue;
      vacate(ev.id);
      occupy(ev.id, firstFreeAround(friend, occupied));
    } else {
      vacate(ev.id);
    }
  }

  return byId;
}

export function planetRadiusFor(count: number): number {
  let rings = 0;
  while (1 + 3 * rings * (rings + 1) < count) {
    rings += 1;
  }
  const grown = (CELL * (rings + 2)) / (0.85 * Math.PI);
  return n0(grown > MIN_PLANET_RADIUS ? grown : MIN_PLANET_RADIUS);
}
