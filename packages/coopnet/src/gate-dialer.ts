// ============================================================================
// File: packages/coopnet/src/gate-dialer.ts
// TICKET-26 (POL-16, POL-84, POL-85 — Shared Planetary Grid & Friend Gate Dialing):
// Pure deterministic module for:
// 1. POL-84: Formatting claimed sunflower-spiral sector slots (`SECTOR #04 // 218 m NE`)
//    so `PlanetaryGridScreen` never displays `UNCLAIMED` once a plot is hosted/published.
// 2. POL-16 (OWNER_ASKS 2026-10-06 — "just dial the friends door, rearage friends
//    next to each other if they want"):
//    - 6-chevron Gate Address validation & normalization (matches 6-char RUN room codes
//      or `SECTOR-#NN` addresses).
//    - 6-coil progressive Gate Dialing state machine (`0.45 s` per coil = `2.70 s` lock).
//    - Friend adjacency rearranger (`rearrangeFriendSlotsAdjacent`) that assigns pinned
//      friends to the nearest contiguous sunflower-spiral slots around the player's slot.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

export const GATE_CHEVRON_COUNT = 6;
export const CHEVRON_LOCK_SECONDS = 0.45;
export const TOTAL_DIAL_LOCK_SECONDS = GATE_CHEVRON_COUNT * CHEVRON_LOCK_SECONDS; // 2.70 s

export interface SectorReadout {
  readonly slot: number;
  readonly label: string;
  readonly distanceM: number;
  readonly compassOctant: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'ORIGIN';
}

const OCTANTS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

/**
 * POL-84: Formats a resolved sunflower-spiral sector slot and its `(x, z)` coordinates
 * into a crisp Planetary Grid readout (`"SECTOR #04 // 229 m NE"`).
 */
export function formatClaimedSectorReadout(
  slot: number | null | undefined,
  coords: { readonly x: number; readonly z: number },
): SectorReadout | null {
  if (slot === null || slot === undefined || !Number.isInteger(slot) || slot < 0) {
    return null;
  }
  const dist = Math.round(Math.hypot(coords.x, coords.z));
  const padded = String(slot).padStart(2, '0');
  if (dist < 5) {
    return {
      slot,
      label: `SECTOR #${padded} // ORIGIN CRATER`,
      distanceM: 0,
      compassOctant: 'ORIGIN',
    };
  }
  const angle = Math.atan2(-coords.z, coords.x); // +X = E, -Z = N
  const octIdx = (((Math.round((angle * 4) / Math.PI) % 8) + 8) % 8);
  const oct = OCTANTS[octIdx] ?? 'N';
  return {
    slot,
    label: `SECTOR #${padded} // ${dist} m ${oct}`,
    distanceM: dist,
    compassOctant: oct,
  };
}

/**
 * Validates and normalizes a 6-chevron Gate Dial code (`A-Z0-9`, 6 characters).
 */
export function normalizeGateDialCode(raw: string): string | null {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== GATE_CHEVRON_COUNT) return null;
  return clean;
}

export interface GateDialState {
  readonly targetCode: string | null;
  readonly elapsedSec: number;
  readonly chevronsLocked: number;
  readonly status: 'idle' | 'dialing' | 'locked' | 'failed';
}

export function createGateDialState(): GateDialState {
  return {
    targetCode: null,
    elapsedSec: 0,
    chevronsLocked: 0,
    status: 'idle',
  };
}

export function beginGateDial(rawCode: string): GateDialState {
  const code = normalizeGateDialCode(rawCode);
  if (!code) {
    return { targetCode: null, elapsedSec: 0, chevronsLocked: 0, status: 'failed' };
  }
  return {
    targetCode: code,
    elapsedSec: 0,
    chevronsLocked: 0,
    status: 'dialing',
  };
}

/**
 * POL-16: Advances the 6-coil Quantum Gate dialing sequence by `dtSec` seconds.
 * Locks one copper field coil every `0.45 s` (bottom to top), transitioning to `'locked'`
 * at `2.70 s` so the portal opens onto the friend's OutpostRoom or published plot.
 */
export function stepGateDial(state: GateDialState, dtSec: number): GateDialState {
  if (state.status !== 'dialing' || !state.targetCode) return state;
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
  const elapsed = state.elapsedSec + dt;
  const chevrons = Math.min(GATE_CHEVRON_COUNT, Math.floor(elapsed / CHEVRON_LOCK_SECONDS));
  if (elapsed >= TOTAL_DIAL_LOCK_SECONDS) {
    return {
      ...state,
      elapsedSec: TOTAL_DIAL_LOCK_SECONDS,
      chevronsLocked: GATE_CHEVRON_COUNT,
      status: 'locked',
    };
  }
  return {
    ...state,
    elapsedSec: Number(elapsed.toFixed(4)),
    chevronsLocked: chevrons,
  };
}

/**
 * POL-16 (OWNER_ASKS 2026-10-06 — "rearage friends next to each other if they want"):
 * Given the player's claimed `hostSlot`, a list of candidate `neighbourSlots` sorted by
 * proximity to `hostSlot`, and a list of `friendIds`, assigns each friend deterministically
 * to the closest available neighbour slots around `hostSlot`.
 */
export function rearrangeFriendsAdjacentToSlot(
  hostSlot: number,
  nearestNeighbourSlots: readonly number[],
  friendIds: readonly string[],
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  const used = new Set<number>([hostSlot]);
  let fallbackSlot = hostSlot + 1;

  for (const rawId of friendIds) {
    const id = rawId.trim();
    if (!id || result.has(id)) continue;
    let picked: number | null = null;
    for (const candidate of nearestNeighbourSlots) {
      if (!used.has(candidate)) {
        picked = candidate;
        break;
      }
    }
    while (picked === null || used.has(picked)) {
      if (!used.has(fallbackSlot)) {
        picked = fallbackSlot;
      }
      fallbackSlot += 1;
    }
    used.add(picked);
    result.set(id, picked);
  }
  return result;
}

// ============================================================================
// PLAN 42 (OWNER_ASKS 2026-10-22):
// - Movable Gate placement on Moon & Earth plots (`resolveMovedGatePose`)
// - Gate Privacy / Iris Lock (`GateAccessMode = 'open' | 'code-only' | 'closed'`)
// - Deterministic Random Gate Dialing for Explorers (`selectRandomOpenGate`)
// - Stage-6 Earth Restoration Sandbox Unlock (`isEarthSandboxUnlocked`)
// ============================================================================

export type GateAccessMode = 'open' | 'code-only' | 'closed';

export type PlotWorldKind = 'moon' | 'earth';

export interface GatePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export interface GatePlacementResult {
  readonly ok: boolean;
  readonly reason?: 'invalid-coords' | 'out-of-plot-bounds';
  readonly gatePose: GatePose;
  readonly arrivalPad: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number };
}

export const DEFAULT_PLOT_RADIUS_M = 480; // 1 km plot diameter with 20 m perimeter margin
export const GATE_ARRIVAL_PAD_OFFSET_M = 3.5;

/**
 * Validates and resolves a moved Quantum Archway Gate pose on a player's 1 km Moon or Earth plot,
 * computing the corresponding arrival pad position 3.5 m in front of the gate along `yaw`.
 */
export function resolveMovedGatePose(
  target: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
  maxRadiusM: number = DEFAULT_PLOT_RADIUS_M,
): GatePlacementResult {
  if (
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y) ||
    !Number.isFinite(target.z) ||
    !Number.isFinite(target.yaw)
  ) {
    return {
      ok: false,
      reason: 'invalid-coords',
      gatePose: { x: 0, y: 0, z: 0, yaw: 0 },
      arrivalPad: { x: 0, y: 0, z: GATE_ARRIVAL_PAD_OFFSET_M, yaw: 0 },
    };
  }
  const distFromPlotCenter = Math.hypot(target.x, target.z);
  const limit = Number.isFinite(maxRadiusM) && maxRadiusM > 0 ? maxRadiusM : DEFAULT_PLOT_RADIUS_M;
  if (distFromPlotCenter > limit) {
    return {
      ok: false,
      reason: 'out-of-plot-bounds',
      gatePose: { x: 0, y: 0, z: 0, yaw: 0 },
      arrivalPad: { x: 0, y: 0, z: GATE_ARRIVAL_PAD_OFFSET_M, yaw: 0 },
    };
  }
  const normYaw = Number((((target.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(4));
  const pose: GatePose = {
    x: Number(target.x.toFixed(3)),
    y: Number(target.y.toFixed(3)),
    z: Number(target.z.toFixed(3)),
    yaw: normYaw,
  };
  const padX = Number((pose.x + Math.sin(normYaw) * GATE_ARRIVAL_PAD_OFFSET_M).toFixed(3));
  const padZ = Number((pose.z + Math.cos(normYaw) * GATE_ARRIVAL_PAD_OFFSET_M).toFixed(3));
  return {
    ok: true,
    gatePose: pose,
    arrivalPad: { x: padX, y: pose.y, z: padZ, yaw: normYaw },
  };
}

export interface PublishedGateListing {
  readonly code: string;
  readonly ownerId: string;
  readonly world: PlotWorldKind;
  readonly stage: number;
  readonly access: GateAccessMode;
}

/**
 * Checks whether a traveler can dial into `listing` via either direct code dialing (`byCode`)
 * or random explorer dialing (`random`).
 * - `'closed'` gates reject all incoming connections (unless the traveler is the plot owner).
 * - `'code-only'` gates allow direct code dialing (`byCode`), but are excluded from `'random'`.
 * - `'open'` gates allow both direct code dialing and random explorer dialing.
 */
export function canDialPlotGate(
  listing: PublishedGateListing,
  mode: 'byCode' | 'random',
  travelerId?: string,
): boolean {
  if (travelerId && travelerId === listing.ownerId) {
    return true;
  }
  if (listing.access === 'closed') {
    return false;
  }
  if (listing.access === 'code-only') {
    return mode === 'byCode';
  }
  return listing.access === 'open';
}

/**
 * Deterministic explorer dialer: selects an `'open'` gate from `directory`, excluding the
 * explorer's current gate (`currentCode`), their own plots (`explorerId`), and recently visited
 * codes (`recentlyVisited`). If all open gates have been visited, cycles cleanly through the open pool.
 */
export function selectRandomOpenGate(
  directory: readonly PublishedGateListing[],
  seed: number,
  options?: {
    readonly currentCode?: string | null;
    readonly explorerId?: string;
    readonly recentlyVisited?: readonly string[];
  },
): PublishedGateListing | null {
  const currentNorm = options?.currentCode ? normalizeGateDialCode(options.currentCode) : null;
  const explorerId = options?.explorerId?.trim();
  const openPool = directory.filter((entry) => {
    const code = normalizeGateDialCode(entry.code);
    if (!code) return false;
    if (currentNorm && code === currentNorm) return false;
    if (explorerId && entry.ownerId === explorerId) return false;
    return canDialPlotGate(entry, 'random', undefined);
  });

  if (openPool.length === 0) return null;

  const recentSet = new Set(
    (options?.recentlyVisited ?? [])
      .map((c) => normalizeGateDialCode(c))
      .filter((c): c is string => c !== null),
  );
  const unvisited = openPool.filter((entry) => {
    const code = normalizeGateDialCode(entry.code);
    return code !== null && !recentSet.has(code);
  });

  const candidates = unvisited.length > 0 ? unvisited : openPool;
  // Deterministic 32-bit integer hash from `seed`
  let h = (Math.trunc(Number.isFinite(seed) ? seed : 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const idx = h % candidates.length;
  return candidates[idx] ?? null;
}

export const EARTH_UNLOCK_FIDELITY_STAGE = 6;

/**
 * Plan 42: Unlocking all 6 fidelity stages (S1..S6) saves Earth and unlocks full sandbox
 * building on the player's Earth plot alongside their Moon plot.
 */
export function isEarthSandboxUnlocked(highestMoonStageReached: number): boolean {
  return Number.isFinite(highestMoonStageReached) && highestMoonStageReached >= EARTH_UNLOCK_FIDELITY_STAGE;
}
