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
export const EARTH_UNLOCK_CARDINAL_LEVEL = 100;

/**
 * The four Cardinal Floats only (Constitution 1): Pxd, Vtx, Lx, Aq. Never a 5th global metric.
 * Capitalized (S = (Pxd, Vtx, Lx, Aq)); lowercase `pxd/vtx/lx/aq` shapes are accepted at runtime
 * (plotsim points, fidelity levels) and normalized here.
 */
export interface CardinalFloats {
  readonly Pxd: number;
  readonly Vtx: number;
  readonly Lx: number;
  readonly Aq: number;
}

/** Lowercase cardinal shape (`plotsim` points / levels, `fidelity` state): accepted wherever cardinals are read. */
export interface CardinalFloatsLower {
  readonly pxd: number;
  readonly vtx: number;
  readonly lx: number;
  readonly aq: number;
}

/** Anything `isEarthSandboxUnlocked` accepts as cardinals: capitalized, lowercase, or a mix. */
export type CardinalLike =
  | CardinalFloats
  | CardinalFloatsLower
  | (Partial<CardinalFloats> & Partial<CardinalFloatsLower>);

function cardinalValues(c: CardinalLike | null | undefined): readonly number[] | null {
  if (!c || typeof c !== 'object') return null;
  const r = c as Partial<CardinalFloats> & Partial<CardinalFloatsLower> & Record<string, unknown>;
  const pick = (upper: unknown, lower: unknown): number => {
    const v = typeof upper === 'number' ? upper : typeof lower === 'number' ? lower : Number.NaN;
    return v;
  };
  return [
    pick(r.Pxd, r.pxd),
    pick(r.Vtx, r.vtx),
    pick(r.Lx, r.lx),
    pick(r.Aq, r.aq),
  ];
}

/**
 * Plan 42: Unlocking all 6 fidelity stages (S1..S6) saves Earth and unlocks full sandbox
 * building on the player's Earth plot alongside their Moon plot.
 *
 * PLAN-42-GATE: `isEarthSandboxUnlocked(stage, cardinals)` returns true when Stage 6
 * (`stage >= 6`) thresholds are met. Cardinals are read leniently across the two scales
 * the sim uses: 0..100 levels (plotsim `STAGES[6] = 100`) require each >= 100; normalized
 * 0..1 floats require each >= 1. A missing `cardinals` argument preserves the original
 * stage-only check so existing single-argument callers keep working.
 */
export function isEarthSandboxUnlocked(stage: number, cardinals?: CardinalLike): boolean {
  if (!Number.isFinite(stage) || stage < EARTH_UNLOCK_FIDELITY_STAGE) return false;
  if (cardinals === undefined) return true;
  const values = cardinalValues(cardinals);
  if (!values) return false;
  for (const v of values) if (!Number.isFinite(v)) return false;
  const max = Math.max(values[0] as number, values[1] as number, values[2] as number, values[3] as number);
  // Normalized 0..1 cardinals top out at ~1; level/raw-point cardinals run far above 2.
  if (max <= 2) {
    return (values[0] as number) >= 1 && (values[1] as number) >= 1 && (values[2] as number) >= 1 && (values[3] as number) >= 1;
  }
  return (
    (values[0] as number) >= EARTH_UNLOCK_CARDINAL_LEVEL &&
    (values[1] as number) >= EARTH_UNLOCK_CARDINAL_LEVEL &&
    (values[2] as number) >= EARTH_UNLOCK_CARDINAL_LEVEL &&
    (values[3] as number) >= EARTH_UNLOCK_CARDINAL_LEVEL
  );
}

// ============================================================================
// PLAN-42-GATE (2026-10-23 — Movable, Lockable & Random-Dialable Stargate):
// GatePlacement, movePlotGate, setGateAccessMode, GateDirectoryEntry,
// dialRandomOpenGate, canDialGate. 100% deterministic pure functions: seeded
// integer hashing only, zero Math.random/Date.now/DOM/I-O. Four Cardinal Floats
// only (Pxd, Vtx, Lx, Aq) — no 5th global metric.
// ============================================================================

/** A plot's Stargate placement: grounded pose + iris access + 6-chevron share code. */
export interface GatePlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly access: GateAccessMode;
  readonly addressCode: string;
}

/** One entry in the Stargate network directory (SetMix directory / planetary grid). */
export interface GateDirectoryEntry {
  readonly plotId: string;
  readonly addressCode: string;
  readonly access: GateAccessMode;
  readonly ownerId?: string;
  readonly world?: PlotWorldKind;
  readonly stage?: number;
  readonly label?: string;
}

export interface GateDialSuccess {
  readonly ok: true;
  /** The selected directory entry, normalized to plotId/addressCode/code + access. */
  readonly target: GateDirectoryEntry & { readonly code: string };
  /** Normalized 6-chevron address (`A-Z0-9` x 6). */
  readonly code: string;
  /** The 6-chevron dial sequence, one glyph per chevron. */
  readonly dialSequence: readonly string[];
  /** Alias for `dialSequence` (per-chevron lock order). */
  readonly chevrons: readonly string[];
  /** The target's plot id (convenience over `target.plotId`). */
  readonly plotId: string;
}

export interface GateDialFailure {
  readonly ok: false;
  readonly reason: 'no-open-gates';
}

export type GateDialResult = GateDialSuccess | GateDialFailure;

type LooseEntry = {
  readonly access?: unknown;
  readonly plotId?: unknown;
  readonly addressCode?: unknown;
  readonly code?: unknown;
  readonly ownerId?: unknown;
  readonly world?: unknown;
  readonly stage?: unknown;
  readonly label?: unknown;
};

function looseAccess(entry: unknown): GateAccessMode | null {
  const access = (entry as LooseEntry | null)?.access;
  return access === 'open' || access === 'code-only' || access === 'closed' ? access : null;
}

function loosePlotId(entry: unknown): string {
  const e = (entry ?? {}) as LooseEntry;
  const raw = typeof e.plotId === 'string' ? e.plotId : typeof e.code === 'string' ? e.code : typeof e.ownerId === 'string' ? e.ownerId : '';
  return raw;
}

function looseAddressCode(entry: unknown): string {
  const e = (entry ?? {}) as LooseEntry;
  if (typeof e.addressCode === 'string' && e.addressCode.length > 0) return e.addressCode;
  return typeof e.code === 'string' ? e.code : '';
}

/**
 * PLAN-42-GATE access check for one directory entry:
 * - `'open'` allows any explorer (providedCode ignored).
 * - `'code-only'` requires an exact `addressCode` match.
 * - `'closed'` rejects all incoming dials.
 * Accepts both `GateDirectoryEntry` (`plotId`/`addressCode`) and legacy
 * `PublishedGateListing` (`code`) shapes.
 */
export function canDialGate(entry: unknown, providedCode?: string): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const access = looseAccess(entry);
  if (access === null || access === 'closed') return false;
  if (access === 'open') return true;
  if (typeof providedCode !== 'string') return false;
  return providedCode === looseAddressCode(entry);
}

/** Deterministic 32-bit hash of `seed` (mulberry-style avalanche; no Math.random). */
function hashSeed32(seed: number): number {
  let h = (Math.trunc(Number.isFinite(seed) ? seed : 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h >>> 0;
}

/**
 * PLAN-42-GATE deterministic random explorer dialer: filters `directory` to entries with
 * `access === 'open'` and `plotId !== callerPlotId` (plus a valid 6-chevron address),
 * selects one target deterministically from `seed`, and returns its 6-chevron dial
 * sequence with the target descriptor — or `{ ok: false, reason: 'no-open-gates' }`.
 * Identical seeds over the same directory always select the same target.
 */
export function dialRandomOpenGate(
  directory: readonly unknown[],
  callerPlotId: string,
  seed: number,
): GateDialResult {
  const caller = typeof callerPlotId === 'string' ? callerPlotId.trim() : '';
  const candidates: { readonly entry: unknown; readonly plotId: string; readonly code: string }[] = [];
  for (const entry of directory) {
    if (!entry || typeof entry !== 'object') continue;
    if (looseAccess(entry) !== 'open') continue;
    const plotId = loosePlotId(entry);
    if (!plotId || plotId.trim() === caller) continue;
    const code = normalizeGateDialCode(looseAddressCode(entry));
    if (!code) continue;
    candidates.push({ entry, plotId, code });
  }
  if (candidates.length === 0) return { ok: false, reason: 'no-open-gates' };
  const pick = candidates[hashSeed32(seed) % candidates.length] as { readonly entry: unknown; readonly plotId: string; readonly code: string };
  const src = (pick.entry ?? {}) as LooseEntry;
  const ownerId = typeof src.ownerId === 'string' ? src.ownerId : undefined;
  const world = src.world === 'moon' || src.world === 'earth' ? src.world : undefined;
  const stage = typeof src.stage === 'number' && Number.isFinite(src.stage) ? src.stage : undefined;
  const label = typeof src.label === 'string' ? src.label : undefined;
  const target: GateDirectoryEntry & { readonly code: string } = {
    plotId: pick.plotId,
    addressCode: pick.code,
    code: pick.code,
    access: 'open',
    ...(ownerId !== undefined ? { ownerId } : {}),
    ...(world !== undefined ? { world } : {}),
    ...(stage !== undefined ? { stage } : {}),
    ...(label !== undefined ? { label } : {}),
  };
  const dialSequence = Object.freeze(pick.code.split('')) as readonly string[];
  return { ok: true, target, code: pick.code, dialSequence, chevrons: dialSequence, plotId: pick.plotId };
}

// ----------------------------------------------------------------------------
// Movable gate placement (pure reducer/helpers over any plot shape).
// ----------------------------------------------------------------------------

/** Half of the gate's 2.68 m frame plus margin: footprint radius for overlap checks. */
export const GATE_FOOTPRINT_RADIUS_M = 2.5;

/** Machine footprint radii (mirrors plotsim KINDS so coopnet stays dependency-free). */
const MACHINE_RADIUS_BY_KIND: Readonly<Record<string, number>> = Object.freeze({
  drill: 2,
  mill: 1.5,
  pylon: 1,
  press: 2,
  power: 2.5,
  projector: 1.5,
  water: 2,
  'heavy-mill': 4,
  'heavy-press': 4,
  'heavy-projector': 4,
  'heavy-water': 4,
});

const DEFAULT_GATE_ADDRESS_CODE = '000000';

export const DEFAULT_GATE_PLACEMENT: GatePlacement = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  access: 'open',
  addressCode: DEFAULT_GATE_ADDRESS_CODE,
}) as GatePlacement;

function isValidAccessMode(v: unknown): v is GateAccessMode {
  return v === 'open' || v === 'code-only' || v === 'closed';
}

function machineRadius(m: unknown): number {
  const r = (m as { readonly radius?: unknown } | null)?.radius;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 0) return r;
  const kind = (m as { readonly kind?: unknown } | null)?.kind;
  if (typeof kind === 'string') {
    const known = MACHINE_RADIUS_BY_KIND[kind];
    if (typeof known === 'number') return known;
  }
  return 2;
}

function foundationRadius(f: unknown): number {
  const o = (f ?? {}) as {
    readonly radius?: unknown;
    readonly halfX?: unknown;
    readonly halfZ?: unknown;
    readonly w?: unknown;
    readonly d?: unknown;
  };
  if (typeof o.radius === 'number' && Number.isFinite(o.radius) && o.radius >= 0) return o.radius;
  const halves: number[] = [];
  if (typeof o.halfX === 'number' && Number.isFinite(o.halfX) && o.halfX >= 0) halves.push(o.halfX);
  if (typeof o.halfZ === 'number' && Number.isFinite(o.halfZ) && o.halfZ >= 0) halves.push(o.halfZ);
  if (typeof o.w === 'number' && Number.isFinite(o.w) && o.w >= 0) halves.push(o.w / 2);
  if (typeof o.d === 'number' && Number.isFinite(o.d) && o.d >= 0) halves.push(o.d / 2);
  if (halves.length > 0) return Math.max(...halves);
  return 4;
}

function plotRadiusOf(plot: unknown): number {
  const p = (plot ?? {}) as {
    readonly plotRadius?: unknown;
    readonly radius?: unknown;
    readonly bounds?: { readonly radius?: unknown } | null;
    readonly env?: { readonly plotRadius?: unknown } | null;
  };
  const raw =
    (typeof p.plotRadius === 'number' ? p.plotRadius : null) ??
    (typeof p.radius === 'number' ? p.radius : null) ??
    (typeof p.bounds?.radius === 'number' ? p.bounds.radius : null) ??
    (typeof p.env?.plotRadius === 'number' ? p.env.plotRadius : null);
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PLOT_RADIUS_M;
}

function gateOf(plot: unknown): GatePlacement {
  const g = (plot as { readonly gate?: unknown } | null)?.gate as Partial<GatePlacement> | null | undefined;
  const x = typeof g?.x === 'number' && Number.isFinite(g.x) ? g.x : 0;
  const y = typeof g?.y === 'number' && Number.isFinite(g.y) ? g.y : 0;
  const z = typeof g?.z === 'number' && Number.isFinite(g.z) ? g.z : 0;
  const yaw = typeof g?.yaw === 'number' && Number.isFinite(g.yaw) ? g.yaw : 0;
  const access = isValidAccessMode(g?.access) ? g.access : 'open';
  const addressCode = typeof g?.addressCode === 'string' && g.addressCode.length > 0 ? g.addressCode : DEFAULT_GATE_ADDRESS_CODE;
  return { x, y, z, yaw, access, addressCode };
}

function listOf(plot: unknown, key: 'machines' | 'foundations'): readonly unknown[] {
  const v = (plot as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? v : [];
}

/** Pose input for `movePlotGate`: grounded coordinates + facing (access/code optional overrides). */
export interface MovePlotGatePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly access?: GateAccessMode;
  readonly addressCode?: string;
}

export type MovePlotGateReason =
  | 'invalid-coords'
  | 'out-of-plot-bounds'
  | 'below-ground'
  | 'collides-machine'
  | 'collides-foundation';

/**
 * PLAN-42-GATE movable gate reducer result. The result is also the plot itself (hybrid):
 * every field of the input plot is spread onto the result, so callers can read either
 * `result.ok` / `result.plot.gate` (result style) or `result.gate` (reducer style).
 */
export type MovePlotGateResult<T> = T & {
  readonly ok: boolean;
  readonly reason?: MovePlotGateReason;
  readonly plot: T;
  readonly gate: GatePlacement;
  readonly gatePose: GatePose;
  readonly arrivalPad: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number };
};

function arrivalPadFor(pose: GatePose): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } {
  const padX = Number((pose.x + Math.sin(pose.yaw) * GATE_ARRIVAL_PAD_OFFSET_M).toFixed(3));
  const padZ = Number((pose.z + Math.cos(pose.yaw) * GATE_ARRIVAL_PAD_OFFSET_M).toFixed(3));
  return { x: padX, y: pose.y, z: padZ, yaw: pose.yaw };
}

/**
 * PLAN-42-GATE: validates `nextPose` (finite coords, `y >= 0` ground clearance,
 * inside plot bounds, no overlap with placed machines/foundations) before updating the
 * plot's gate pose. Pure: never mutates `plot`; returns a hybrid result that is both the
 * (next or unchanged) plot and `{ ok, reason?, plot, gate, gatePose, arrivalPad }`.
 */
export function movePlotGate<T extends object>(plot: T, nextPose: MovePlotGatePose): MovePlotGateResult<T> {
  const base = (plot ?? {}) as T & Record<string, unknown>;
  const current = gateOf(plot);
  const fail = (reason: MovePlotGateReason): MovePlotGateResult<T> => {
    const pose: GatePose = { x: current.x, y: current.y, z: current.z, yaw: current.yaw };
    return {
      ...(base as object),
      ok: false,
      reason,
      plot: plot as T,
      gate: current,
      gatePose: pose,
      arrivalPad: arrivalPadFor(pose),
    } as MovePlotGateResult<T>;
  };
  if (
    !nextPose ||
    typeof nextPose !== 'object' ||
    !Number.isFinite(nextPose.x) ||
    !Number.isFinite(nextPose.y) ||
    !Number.isFinite(nextPose.z) ||
    !Number.isFinite(nextPose.yaw)
  ) {
    return fail('invalid-coords');
  }
  if (nextPose.y < 0) return fail('below-ground');
  if (Math.hypot(nextPose.x, nextPose.z) > plotRadiusOf(plot)) return fail('out-of-plot-bounds');
  for (const m of listOf(plot, 'machines')) {
    const mx = (m as { readonly x?: unknown } | null)?.x;
    const mz = (m as { readonly z?: unknown } | null)?.z;
    if (typeof mx !== 'number' || typeof mz !== 'number' || !Number.isFinite(mx) || !Number.isFinite(mz)) continue;
    if (Math.hypot(nextPose.x - mx, nextPose.z - mz) < GATE_FOOTPRINT_RADIUS_M + machineRadius(m)) {
      return fail('collides-machine');
    }
  }
  for (const f of listOf(plot, 'foundations')) {
    const fx = (f as { readonly x?: unknown } | null)?.x;
    const fz = (f as { readonly z?: unknown } | null)?.z;
    if (typeof fx !== 'number' || typeof fz !== 'number' || !Number.isFinite(fx) || !Number.isFinite(fz)) continue;
    if (Math.hypot(nextPose.x - fx, nextPose.z - fz) < GATE_FOOTPRINT_RADIUS_M + foundationRadius(f)) {
      return fail('collides-foundation');
    }
  }
  const normYaw = Number((((nextPose.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(4));
  const next: GatePlacement = {
    x: Number(nextPose.x.toFixed(3)),
    y: Number(nextPose.y.toFixed(3)),
    z: Number(nextPose.z.toFixed(3)),
    yaw: normYaw,
    access: nextPose.access !== undefined && isValidAccessMode(nextPose.access) ? nextPose.access : current.access,
    addressCode:
      typeof nextPose.addressCode === 'string' && nextPose.addressCode.length > 0 ? nextPose.addressCode : current.addressCode,
  };
  const nextPlot = { ...(base as object), gate: next } as T;
  const pose: GatePose = { x: next.x, y: next.y, z: next.z, yaw: next.yaw };
  return {
    ...(nextPlot as object),
    ok: true,
    plot: nextPlot,
    gate: next,
    gatePose: pose,
    arrivalPad: arrivalPadFor(pose),
  } as MovePlotGateResult<T>;
}

export type SetGateAccessResult<T> = T & {
  readonly ok: boolean;
  readonly reason?: 'invalid-access';
  readonly plot: T;
  readonly gate: GatePlacement;
};

/**
 * PLAN-42-GATE: sets the plot gate's iris access (`'open' | 'code-only' | 'closed'`),
 * preserving pose and share code. Pure; returns a hybrid result that is both the next
 * plot and `{ ok, plot, gate }`.
 */
export function setGateAccessMode<T extends object>(plot: T, access: GateAccessMode): SetGateAccessResult<T> {
  const base = (plot ?? {}) as T & Record<string, unknown>;
  const current = gateOf(plot);
  if (!isValidAccessMode(access)) {
    return {
      ...(base as object),
      ok: false,
      reason: 'invalid-access',
      plot: plot as T,
      gate: current,
    } as SetGateAccessResult<T>;
  }
  const next: GatePlacement = { ...current, access };
  const nextPlot = { ...(base as object), gate: next } as T;
  return {
    ...(nextPlot as object),
    ok: true,
    plot: nextPlot,
    gate: next,
  } as SetGateAccessResult<T>;
}
