// The shared SetMix planet (STATUS SM8 to SM10, docs/SETMIX_WORLD.md): where every player's plot is, how big the planet
// is, and which plots are your neighbours. There is no server of ours on RUN, so every player's game works this out
// for itself, from the same list of published plots, and gets the same answer. Pure: no platform, no DOM.

/** Metres between neighbouring slots on the spiral: the closest two plots stand 1.55 x this apart (162 m: two plots and a gap). */
export const SLOT_SPACING = 105;
/** The smallest the planet ever is (metres): the first players already see a far horizon. */
export const MIN_PLANET_RADIUS = 12000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Where slot `k` is on the planet's map (metres from the first plot). A sunflower spiral: slots fill outward evenly,
 * a new slot never moves an old one, and no two are ever closer than 1.55 x SLOT_SPACING.
 */
export function slotPosition(k: number): { readonly x: number; readonly z: number } {
  const r = SLOT_SPACING * Math.sqrt(k + 0.5), a = k * GOLDEN_ANGLE;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/**
 * The planet's radius for `count` plots: the map is laid on the sphere round the first plot, and every plot must stay
 * within 85% of the way to the far side. The planet grows as players join; the map itself never changes.
 */
export function planetRadiusFor(count: number): number {
  const reach = SLOT_SPACING * Math.sqrt(Math.max(1, count) + 0.5);
  return Math.max(MIN_PLANET_RADIUS, reach / (0.85 * Math.PI));
}

/** A published plot (one UGC item each): who, when, and the slot it asked for when it was made. */
export interface PlotClaim {
  readonly id: string;
  readonly createdAt: number;
  /** The slot this plot asked for: the number of plots its player could see when they claimed (the next one out). */
  readonly wants: number;
}

/**
 * Which slot each plot has. Everyone runs this on the same list and gets the same answer: plots are taken oldest first
 * (ties by id); each gets the slot it asked for if it is still free, else the next free slot after it. A plot that is
 * removed frees its slot and moves no one.
 */
export function resolveSlots(claims: readonly PlotClaim[]): ReadonlyMap<string, number> {
  const order = [...claims].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken = new Set<number>(), out = new Map<string, number>();
  for (const c of order) {
    let slot = Math.max(0, Math.floor(c.wants));
    while (taken.has(slot)) slot += 1;
    taken.add(slot);
    out.set(c.id, slot);
  }
  return out;
}

/**
 * The slots within `within` metres of slot `k`, nearest first (not `k` itself). Only slots whose ring of the spiral
 * can reach that far are tried, so this stays cheap however many players there are.
 */
export function neighbourSlots(k: number, within: number): number[] {
  const me = slotPosition(k), r = Math.hypot(me.x, me.z);
  const lo = Math.max(0, Math.floor(((Math.max(0, r - within) / SLOT_SPACING) ** 2) - 0.5));
  const hi = Math.ceil(((r + within) / SLOT_SPACING) ** 2 - 0.5);
  const found: { slot: number; d: number }[] = [];
  for (let j = lo; j <= hi; j++) {
    if (j === k) continue;
    const p = slotPosition(j), d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d <= within) found.push({ slot: j, d });
  }
  return found.sort((a, b) => a.d - b.d).map((f) => f.slot);
}

/** The UGC tag a plot item carries for its slot, so a neighbour's plot can be fetched without listing everyone's. */
export const slotTag = (slot: number): string => `setmix-slot-${slot}`;
/** The tag every plot item carries. */
export const PLOT_TAG = 'setmix-plot';

/**
 * Games orbit the SetMix planet (SM10): game `g` (0 is Goblin Racing) gets an orbit, eight to a star system; when a
 * system is full the next game starts the next system out. Nothing already placed ever moves.
 */
export function gameOrbit(g: number): { readonly system: number; readonly orbit: number } {
  return { system: Math.floor(g / 8), orbit: g % 8 };
}
