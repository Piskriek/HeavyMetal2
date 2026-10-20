// The shared SetMix planet (STATUS SM8 to SM10, docs/SETMIX_WORLD.md): where every player's plot is, how big the planet
// is, and which plots are your neighbours. There is no server of ours on RUN, so every player's game works this out
// for itself, from the same list of published plots, and gets the same answer. Pure: no platform, no DOM.

import { kv } from '../storage/profile-storage';

/** Metres between neighbouring slots on the spiral: the closest two plots stand 1.55 x this apart (162 m: two plots and a gap). */
export const SLOT_SPACING = 105;
/** The smallest the planet ever is (metres): the first players already see a far horizon. */
export const MIN_PLANET_RADIUS = 12000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Storage keys shared between Main Menu, Planetary Grid, and Play Screen (POL-84, POL-85). */
export const SLOT_STORAGE_KEY = 'hm.setmix.planet.slot';
export const CLAIMS_STORAGE_KEY = 'hm.setmix.planet.claims';
export const PLAY_SYNC_STORAGE_KEY = 'hm.setmix.play.sync';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The Synced (shared Planetary Grid) or Desynced (solo branch) mode of the play screen (POL-85). */
export type PlaySyncMode = 'synced' | 'desynced';

/** The player's own key-value storage, namespaced by the active profile (profile-storage's kv, the only place that touches localStorage). */
function defaultStorage(): StorageLike {
  return { getItem: (key) => kv.get(key), setItem: (key, value) => kv.set(key, value) };
}

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
 * Claims and resolves a deterministic sector slot for `plotId` against `existingClaims` (POL-84).
 * If `plotId` is already in `existingClaims`, preserves its claim; otherwise appends a new claim asking
 * for a deterministic starting index derived from `plotId` (or `existingClaims.length`).
 */
export function claimPlotSlot(
  plotId: string,
  existingClaims: readonly PlotClaim[] = [],
  createdAt = 1,
  preferredSlot?: number,
): {
  readonly slot: number;
  readonly coords: { readonly x: number; readonly z: number };
  readonly claims: readonly PlotClaim[];
} {
  const cleanId = plotId.trim() || 'local-outpost';
  let claims = [...existingClaims];
  if (!claims.some((c) => c.id === cleanId)) {
    let defaultWants = claims.length;
    if (preferredSlot !== undefined && Number.isFinite(preferredSlot) && preferredSlot >= 0) {
      defaultWants = Math.floor(preferredSlot);
    } else if (claims.length === 0) {
      // Derive a stable non-negative sector index (1..24) from the plot code hash when no prior claims exist
      let h = 2166136261;
      for (let i = 0; i < cleanId.length; i++) {
        h = Math.imul(h ^ cleanId.charCodeAt(i), 16777619) >>> 0;
      }
      defaultWants = (h % 24) + 1;
    }
    claims = [...claims, { id: cleanId, createdAt, wants: defaultWants }];
  }
  const resolved = resolveSlots(claims);
  const slot = resolved.get(cleanId) ?? 0;
  return {
    slot,
    coords: slotPosition(slot),
    claims,
  };
}

/** Reads the player's claimed planetary sector slot from storage, or null if unclaimed (POL-84). */
export function readStoredSlot(storage: StorageLike | null = defaultStorage()): number | null {
  if (!storage) return null;
  const raw = storage.getItem(SLOT_STORAGE_KEY);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Claims a sector slot via `resolveSlots` when a plot publishes and stores it in `hm.setmix.planet.slot` (POL-84). */
export function claimAndStoreSlot(
  plotId: string,
  storage: StorageLike | null = defaultStorage(),
  createdAt = 1,
): number {
  const existingSlot = readStoredSlot(storage);
  let existingClaims: PlotClaim[] = [];
  if (storage) {
    try {
      const rawClaims = storage.getItem(CLAIMS_STORAGE_KEY);
      if (rawClaims) {
        const parsed = JSON.parse(rawClaims) as unknown;
        if (Array.isArray(parsed)) existingClaims = parsed as PlotClaim[];
      }
    } catch {
      existingClaims = [];
    }
  }
  const result = claimPlotSlot(
    plotId,
    existingClaims,
    createdAt,
    existingSlot !== null ? existingSlot : undefined,
  );
  if (storage) {
    try {
      storage.setItem(SLOT_STORAGE_KEY, String(result.slot));
      storage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(result.claims));
    } catch {
      // ignore quota errors
    }
  }
  return result.slot;
}

/** Reads the remembered Synced/Desynced mode from `hm.setmix.play.sync` (POL-85). */
export function readPlaySyncMode(storage: StorageLike | null = defaultStorage()): PlaySyncMode {
  if (!storage) return 'desynced';
  return storage.getItem(PLAY_SYNC_STORAGE_KEY) === 'synced' ? 'synced' : 'desynced';
}

/** Writes the remembered Synced/Desynced mode to `hm.setmix.play.sync` from either the Grid or the Play HUD (POL-85). */
export function writePlaySyncMode(
  mode: PlaySyncMode,
  storage: StorageLike | null = defaultStorage(),
): PlaySyncMode {
  if (storage) {
    try {
      storage.setItem(PLAY_SYNC_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }
  return mode;
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

// ---- TICKET-26 (POL-16 & POL-84): Sector Readout & Friend Adjacency Rearrangement
import {
  formatClaimedSectorReadout,
  rearrangeFriendsAdjacentToSlot,
  type SectorReadout,
} from '@hm/coopnet/gate-dialer';

export { formatClaimedSectorReadout, rearrangeFriendsAdjacentToSlot, type SectorReadout };

/**
 * POL-84: Returns the formatted `SECTOR #NN // <dist> m <octant>` readout for the active profile's
 * claimed slot (or claims one automatically when `autoClaimPlotId` is provided).
 */
export function getActiveSectorReadout(
  storage: StorageLike | null = defaultStorage(),
  autoClaimPlotId?: string,
): SectorReadout | null {
  let slot = readStoredSlot(storage);
  if (slot === null && autoClaimPlotId) {
    slot = claimAndStoreSlot(autoClaimPlotId, storage);
  }
  if (slot === null) return null;
  return formatClaimedSectorReadout(slot, slotPosition(slot));
}

/**
 * POL-16: Rearranges the given friend plot IDs onto the nearest sunflower-spiral neighbour slots
 * within `350 m` of `hostSlot`.
 */
export function arrangeFriendsNearHost(
  hostSlot: number,
  friendIds: readonly string[],
): ReadonlyMap<string, number> {
  const near = neighbourSlots(hostSlot, 350);
  return rearrangeFriendsAdjacentToSlot(hostSlot, near, friendIds);
}
