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
