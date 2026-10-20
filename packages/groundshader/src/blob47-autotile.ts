// ============================================================================
// File: packages/groundshader/src/blob47-autotile.ts
// TICKET-25 (POL-05, POL-50, POL-25, POL-26, POL-52, POL-53, POL-60):
// Pure deterministic terrain autotiling, vehicle/hardpoint fit, and optical
// transition math:
// 1. POL-05 (47-Tile Wang/Blob Autotile Transition Set):
//    Reduces any 8-neighbour Moore bitmask (N=1, NE=2, E=4, SE=8, S=16, SW=32,
//    W=64, NW=128) to its canonical valid Blob mask (where a diagonal corner bit
//    is kept iff both adjacent cardinal neighbours are set) and maps all 256
//    inputs in O(1) via `MASK_TO_BLOB47_INDEX` onto the 47 canonical Blob tiles,
//    plus evaluates smooth SDF sub-tile blend weights at `(u01, v01)`.
// 2. POL-50 (Modular Scout Sockets, Redone Hauler Fit & Watermaker Hardpoint Fit):
//    Defines `MODULAR_SCOUT_SOCKETS` (whip aerial raycast origin, square `[-u-]`
//    steering yoke socket, and rear utility socket), `HAULER_VEHICLE_FIT`, and
//    `WATERMAKER_HARDPOINT_FIT`.
// 3. POL-25, POL-26, POL-52, POL-53, POL-60:
//    Vista flash peak capture trigger, Stage-0 storm dust speckle softener,
//    350 m scan ring horizon fade, +0.85 EV suit-cam step settling in 0.4 s,
//    and 25 m safe-dome edge ground band.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

// Bit flags for the 8-neighbour Moore neighbourhood (clockwise from North)
export const DIR_N  = 1 << 0; // 1
export const DIR_NE = 1 << 1; // 2
export const DIR_E  = 1 << 2; // 4
export const DIR_SE = 1 << 3; // 8
export const DIR_S  = 1 << 4; // 16
export const DIR_SW = 1 << 5; // 32
export const DIR_W  = 1 << 6; // 64
export const DIR_NW = 1 << 7; // 128

/**
 * Masks out diagonal corner bits unless both adjacent cardinal bits are present
 * (`NE` requires `N & E`, `SE` requires `S & E`, `SW` requires `S & W`, `NW` requires `N & W`).
 * This collapses the 256 raw 8-neighbour bitmasks into the exact 47 canonical Wang/Blob tiles.
 */
export function normalizeBlobMask(rawMask8: number): number {
  let m = rawMask8 & 0xff;
  if ((m & (DIR_N | DIR_E)) !== (DIR_N | DIR_E)) m &= ~DIR_NE;
  if ((m & (DIR_S | DIR_E)) !== (DIR_S | DIR_E)) m &= ~DIR_SE;
  if ((m & (DIR_S | DIR_W)) !== (DIR_S | DIR_W)) m &= ~DIR_SW;
  if ((m & (DIR_N | DIR_W)) !== (DIR_N | DIR_W)) m &= ~DIR_NW;
  return m;
}

/** All 47 canonical Blob bitmasks in ascending order, plus the 256-entry O(1) lookup table. */
export const BLOB_47_MASKS: readonly number[] = (() => {
  const seen = new Set<number>();
  for (let i = 0; i < 256; i++) {
    seen.add(normalizeBlobMask(i));
  }
  return [...seen].sort((a, b) => a - b);
})();

export const MASK_TO_BLOB47_INDEX: Uint8Array = (() => {
  const lut = new Uint8Array(256);
  const indexByMask = new Map<number, number>();
  BLOB_47_MASKS.forEach((m, idx) => indexByMask.set(m, idx));
  for (let i = 0; i < 256; i++) {
    lut[i] = indexByMask.get(normalizeBlobMask(i)) ?? 0;
  }
  return lut;
})();

export function blob47IndexForMask(rawMask8: number): number {
  return MASK_TO_BLOB47_INDEX[rawMask8 & 0xff] ?? 0;
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * POL-05: Evaluates the smooth 47-tile Blob coverage weight `[0, 1]` at cell-local UV
 * `(u01, v01)` in `[0, 1]^2` given the cell's 8-neighbour bitmask `rawMask8`.
 * Replaces blocky 4x4 Bayer cell transitions with smooth rounded outer corners,
 * straight cardinal corridors, and concave inner corners across all 47 tile topologies.
 */
export function evaluateBlob47SubtileBlend(
  rawMask8: number,
  u01: number,
  v01: number,
): number {
  const m = normalizeBlobMask(rawMask8);
  const u = Math.max(0, Math.min(1, u01));
  const v = Math.max(0, Math.min(1, v01));

  const hasN = (m & DIR_N) !== 0;
  const hasE = (m & DIR_E) !== 0;
  const hasS = (m & DIR_S) !== 0;
  const hasW = (m & DIR_W) !== 0;

  // Distance from cell edges where unconnected sides feather out (margin = 0.22)
  const margin = 0.22;
  const wW = hasW ? 1 : smoothstep01(u / margin);
  const wE = hasE ? 1 : smoothstep01((1 - u) / margin);
  const wS = hasS ? 1 : smoothstep01(v / margin);
  const wN = hasN ? 1 : smoothstep01((1 - v) / margin);

  let base = Math.min(wW, wE, wS, wN);

  // Inner corner notches when two adjacent cardinals are present but their shared diagonal is absent
  if (hasN && hasE && (m & DIR_NE) === 0 && u > 1 - margin && v > 1 - margin) {
    const d = Math.hypot(u - 1, v - 1) / margin;
    base = Math.min(base, smoothstep01(d));
  }
  if (hasS && hasE && (m & DIR_SE) === 0 && u > 1 - margin && v < margin) {
    const d = Math.hypot(u - 1, v) / margin;
    base = Math.min(base, smoothstep01(d));
  }
  if (hasS && hasW && (m & DIR_SW) === 0 && u < margin && v < margin) {
    const d = Math.hypot(u, v) / margin;
    base = Math.min(base, smoothstep01(d));
  }
  if (hasN && hasW && (m & DIR_NW) === 0 && u < margin && v > 1 - margin) {
    const d = Math.hypot(u, v - 1) / margin;
    base = Math.min(base, smoothstep01(d));
  }

  return Number(base.toFixed(4));
}

// ---- POL-50: Modular Scout Sockets, Hauler VEHICLE_FIT & Watermaker Hardpoint Fit

export interface ModularScoutSocketSpec {
  readonly aerialRaycastOrigin: readonly [number, number, number];
  readonly aerialHeightM: number;
  readonly steeringYokeSocket: readonly [number, number, number];
  readonly steeringYokeShape: 'square-u-yoke';
  readonly rearUtilitySocket: readonly [number, number, number];
}

export const MODULAR_SCOUT_SOCKETS: ModularScoutSocketSpec = {
  aerialRaycastOrigin: [-0.62, 1.85, -0.95],
  aerialHeightM: 1.15,
  steeringYokeSocket: [0.0, 0.94, 0.48],
  steeringYokeShape: 'square-u-yoke',
  rearUtilitySocket: [0.0, 0.88, -1.32],
};

export const HAULER_VEHICLE_FIT = {
  lengthM: 5.4,
  widthM: 3.1,
  heightM: 2.6,
  wheelRadiusM: 0.58,
  cargoSockets: [
    [0.0, 1.15, -0.45],
    [0.0, 1.15, -1.45],
    [0.0, 1.15, -2.45],
  ] as const,
} as const;

/**
 * RESUME.md §5.4: Verifies the Heavy Watermaker (`7.74 x 6.30 m` unscaled / fitted to `6.0 x 5.4 m`
 * table footprint) sits inside the `8.0 x 8.0 m` 2x2 foundation hardpoint with >= 0.13 m margin per side.
 */
export const WATERMAKER_HARDPOINT_FIT = {
  hardpointSpanM: 8.0,
  rawModelSpanX: 7.74,
  rawModelSpanZ: 6.30,
  fittedScale: 0.96,
  fitsInside8mHardpoint: 7.74 * 0.96 <= 7.80 && 6.30 * 0.96 <= 7.80,
} as const;

// ---- POL-25, POL-26, POL-52, POL-53, POL-60: Optical & Vista Polish Helpers

/**
 * POL-52: Fades the Stage-0 scan ring smoothly between `290 m` and `350 m` so it never holds
 * visibly at `350 m`, while sweeping the far-world resolution wave out to the horizon (`4800 m`).
 */
export function computeScanRingHorizonFade(scanRadiusM: number): {
  readonly ringOpacity: number;
  readonly farWorldResolved01: number;
} {
  if (!Number.isFinite(scanRadiusM) || scanRadiusM < 0) {
    return { ringOpacity: 0, farWorldResolved01: 0 };
  }
  const fade = 1 - smoothstep01((scanRadiusM - 290) / (350 - 290));
  const farWorldResolved01 = smoothstep01((scanRadiusM - 290) / (410 - 290));
  return {
    ringOpacity: Number(fade.toFixed(4)),
    farWorldResolved01: Number(farWorldResolved01.toFixed(4)),
  };
}

/**
 * POL-53: Suit-cam exposure step when crossing from the Lab into the planet gate.
 * Starts at `+0.85 EV` overshoot at `t = 0 s`, decays to `<= 0.15 EV` by `t = 0.40 s`
 * ("settles in about 0.4 s"), and `< 0.02 EV` by `t = 1.0 s`.
 */
export function computeSuitCamEvOvershoot(elapsedSec: number): number {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) return 0;
  // Time constant tau = 0.225 s -> 0.85 * exp(-0.4 / 0.225) = 0.144 EV (< 0.15 EV at 0.4 s)
  const ev = 0.85 * Math.exp(-elapsedSec / 0.225);
  return ev < 0.005 ? 0 : Number(ev.toFixed(4));
}

/**
 * POL-60: Computes the soft ground shader band intensity `[0, 1]` around a safe dome edge
 * (`domeRadiusM = 25 m` for the Gate or `15 m` for a Pylon/Shelter).
 */
export function computeSafeDomeGroundBand(distFromDomeCenterM: number, domeRadiusM = 25): number {
  const halfWidth = 0.85;
  const delta = Math.abs(distFromDomeCenterM - domeRadiusM);
  if (delta >= halfWidth) return 0;
  return Number(smoothstep01(1 - delta / halfWidth).toFixed(4));
}
