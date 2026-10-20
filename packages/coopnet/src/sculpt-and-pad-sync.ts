// ============================================================================
// File: packages/coopnet/src/sculpt-and-pad-sync.ts
// TICKET-19 (Window F — POL-111, POL-112, POL-171, POL-172, POL-173):
// Pure co-op terrain, Moon Twin Gate footing pad, Lab presence hiding, and
// Co-Builder sculpt authorization helpers.
// Zero DOM, zero Three.js, deterministic across client and OutpostRoom server.
// ============================================================================

export type OutpostRole = 'owner' | 'cobuilder' | 'visitor';

export interface GatePoseSpec {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

export interface TerrainSyncPacket {
  readonly type: 'terrain';
  readonly seed: number;
  readonly sculpt: string;
  readonly gate?: GatePoseSpec;
}

export interface PeerPoseWire {
  readonly id: string;
  readonly username: string;
  readonly role: OutpostRole;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly look?: string;
  readonly at?: number;
  /** POL-172: true when the peer has stepped through the Gate into the Earth Lab or left the plot. */
  readonly inLab?: boolean;
  readonly leftPlot?: boolean;
}

/** POL-111: Single source of truth for plot terrain constants shared by plot-height.ts and plot-ground.ts. */
export const OUTPOST_PLOT_SEED = 7;
export const BOULDER_SPAN = 320;
export const PAINT_CELLS = 256;
export const PAINT_CELL = BOULDER_SPAN / PAINT_CELLS; // 1.25 m
export const PAINT_ORIGIN = -BOULDER_SPAN / 2; // -160 m

/** POL-112: Moon Twin Gate footing pad dimensions in metres (matches play-scene.ts groundAt). */
export const GATE_PAD_HALF_X = 1.9;
export const GATE_PAD_HALF_Z = 1.25;
export const GATE_PAD_LIFT = 0.25;

/** Validates a finite GatePoseSpec on the wire. */
export function isValidGatePose(v: unknown): v is GatePoseSpec {
  if (!v || typeof v !== 'object') return false;
  const g = v as Record<string, unknown>;
  return (
    typeof g.x === 'number' &&
    Number.isFinite(g.x) &&
    typeof g.z === 'number' &&
    Number.isFinite(g.z) &&
    typeof g.yaw === 'number' &&
    Number.isFinite(g.yaw)
  );
}

/**
 * POL-112: Returns true when world point `(x, z)` lies strictly inside the Moon Twin Gate's
 * rectangular footing pad (`|localX| < 1.9` and `|localZ| < 1.25`) after rotating into the
 * gate's local frame by `gate.yaw`.
 */
export function isPointOnGatePad(
  x: number,
  z: number,
  gate?: { readonly x?: number; readonly z?: number; readonly yaw?: number } | null,
): boolean {
  const gx = gate?.x ?? 0;
  const gz = gate?.z ?? 0;
  const yaw = gate?.yaw ?? 0;
  const dx = x - gx;
  const dz = z - gz;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < GATE_PAD_HALF_X && Math.abs(lz) < GATE_PAD_HALF_Z;
}

/**
 * POL-112: Evaluates the ground height at `(x, z)` including the Moon Twin Gate footing pad
 * (`rawHeight(gate.x, gate.z) + 0.25` inside `|lx| < 1.9, |lz| < 1.25`).
 */
export function evaluatePlotOrPadHeight(
  x: number,
  z: number,
  rawHeightAt: (px: number, pz: number) => number,
  gate?: { readonly x?: number; readonly z?: number; readonly yaw?: number; readonly enabled?: boolean } | false,
): number {
  if (gate === false || (gate && gate.enabled === false)) {
    return rawHeightAt(x, z);
  }
  const gx = gate?.x ?? 0;
  const gz = gate?.z ?? 0;
  const gyaw = gate?.yaw ?? 0;
  if (isPointOnGatePad(x, z, { x: gx, z: gz, yaw: gyaw })) {
    return rawHeightAt(gx, gz) + GATE_PAD_LIFT;
  }
  return rawHeightAt(x, z);
}

/**
 * POL-171: Builds the initial host seed + terrain synchronization payload when a room is opened.
 * Sends the Moon Twin Gate's pose (`gate`) alongside the initial seed so the room's `plotHeightAt`
 * places the footing pad at the true Gate coordinates from version 1, before any sculpt stroke happens.
 */
export function buildInitialHostSeedFrames<TWorld>(
  world: TWorld,
  gate: GatePoseSpec,
  seed = OUTPOST_PLOT_SEED,
  sculpt = '',
): {
  readonly seedMessage: {
    readonly type: 'seedWorld';
    readonly world: TWorld;
    readonly gate: GatePoseSpec;
    readonly seed: number;
    readonly sculpt: string;
  };
  readonly terrainMessage: TerrainSyncPacket;
} {
  const cleanGate: GatePoseSpec = {
    x: Number.isFinite(gate.x) ? gate.x : 0,
    z: Number.isFinite(gate.z) ? gate.z : 0,
    yaw: Number.isFinite(gate.yaw) ? gate.yaw : 0,
  };
  return {
    seedMessage: {
      type: 'seedWorld',
      world,
      gate: cleanGate,
      seed,
      sculpt,
    },
    terrainMessage: {
      type: 'terrain',
      seed,
      sculpt,
      gate: cleanGate,
    },
  };
}

/**
 * POL-172: Produces the outbound pose / presence message for the local player.
 * When `where !== 'planet'` (e.g. the player is in the Earth Lab) or `pose === null`,
 * returns a `leftPlot: true, inLab: true` marker packet once so `OutpostRoom` immediately
 * clears the player's stale avatar from the Moon plot.
 */
export function buildOutboundPresencePacket(
  where: 'lab' | 'planet' | string,
  pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } | null,
  look = 'default',
): {
  readonly type: 'pose';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly look: string;
  readonly inLab: boolean;
  readonly leftPlot: boolean;
} {
  if (where !== 'planet' || pose === null) {
    return {
      type: 'pose',
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      look,
      inLab: true,
      leftPlot: true,
    };
  }
  return {
    type: 'pose',
    x: pose.x,
    y: pose.y,
    z: pose.z,
    yaw: pose.yaw,
    look,
    inLab: false,
    leftPlot: false,
  };
}

/**
 * POL-172: Filters the peer pose list to only peers currently standing on the Moon plot.
 * Any peer with `inLab: true`, `leftPlot: true`, or non-finite coordinates is excluded
 * so their avatar is immediately hidden on the plot and other pages.
 */
export function filterActivePlotPeers<T extends PeerPoseWire>(peers: readonly T[]): T[] {
  return peers.filter(
    (p) =>
      Boolean(p && p.id) &&
      !p.inLab &&
      !p.leftPlot &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      Number.isFinite(p.z) &&
      Number.isFinite(p.yaw),
  );
}

/**
 * POL-173: Ruling — Both the Lead Architect ('owner') and Co-Builders ('cobuilder') may
 * sculpt and paint the shared Outpost plot; Field Observers ('visitor') are read-only.
 */
export function canRoleSculptTerrain(role: OutpostRole): boolean {
  return role === 'owner' || role === 'cobuilder';
}

/**
 * POL-173: Validates an incoming `terrain` message on the server (`OutpostRoom`).
 */
export function validateTerrainUpdate(
  role: OutpostRole,
  msg: { readonly seed?: unknown; readonly sculpt?: unknown; readonly gate?: unknown },
  maxTerrainChars = 200_000,
):
  | { readonly ok: true; readonly next: { readonly seed: number; readonly sculpt: string; readonly gate?: GatePoseSpec } }
  | { readonly ok: false; readonly reason: 'forbidden-role' | 'bad-payload' | 'terrain-too-large' } {
  if (!canRoleSculptTerrain(role)) {
    return { ok: false, reason: 'forbidden-role' };
  }
  if (!Number.isInteger(msg.seed) || typeof msg.sculpt !== 'string') {
    return { ok: false, reason: 'bad-payload' };
  }
  if (msg.gate !== undefined && !isValidGatePose(msg.gate)) {
    return { ok: false, reason: 'bad-payload' };
  }
  if (msg.sculpt.length > maxTerrainChars) {
    return { ok: false, reason: 'terrain-too-large' };
  }
  const seed = msg.seed as number;
  const sculpt = msg.sculpt;
  const gate = msg.gate as GatePoseSpec | undefined;
  return {
    ok: true,
    next: {
      seed,
      sculpt,
      ...(gate ? { gate: { x: gate.x, z: gate.z, yaw: gate.yaw } } : {}),
    },
  };
}
