// ============================================================================
// File: packages/groundshader/src/blob47-and-polish.ts
// Closes: POL-05 (47-Tile Blob Transitions), POL-17 (Twin Gate Stage 2 Detail Swap),
//         POL-25 (Window Breach Static Floor Flash) & DEC-06 (15m Amber Gate Pool)
// Purity: 100% pure deterministic functions.
// ============================================================================

import type { FourFloats } from './stage-post.glsl';

// Bit flags for 8-neighbor Moore neighborhood:
// NW(1)   N(2)   NE(4)
//  W(8)   [C]     E(16)
// SW(32)  S(64)  SE(128)
export const BLOB_N  = 2;
export const BLOB_W  = 8;
export const BLOB_E  = 16;
export const BLOB_S  = 64;
export const BLOB_NW = 1;
export const BLOB_NE = 4;
export const BLOB_SW = 32;
export const BLOB_SE = 128;

const CANONICAL_47_MASKS: number[] = (() => {
  const set = new Set<number>();
  for (let mask = 0; mask < 256; mask++) {
    set.add(sanitize8NeighborMask(mask));
  }
  return Array.from(set).sort((a, b) => a - b);
})();

/**
 * Masks out diagonal corner bits unless BOTH adjacent cardinal bits are present.
 * This reduces 256 possible 8-neighbor combinations to the exact 47 canonical blob tiles (POL-05).
 */
export function sanitize8NeighborMask(rawMask0to255: number): number {
  let m = rawMask0to255 & 0xff;
  if ((m & (BLOB_N | BLOB_W)) !== (BLOB_N | BLOB_W)) m &= ~BLOB_NW;
  if ((m & (BLOB_N | BLOB_E)) !== (BLOB_N | BLOB_E)) m &= ~BLOB_NE;
  if ((m & (BLOB_S | BLOB_W)) !== (BLOB_S | BLOB_W)) m &= ~BLOB_SW;
  if ((m & (BLOB_S | BLOB_E)) !== (BLOB_S | BLOB_E)) m &= ~BLOB_SE;
  return m;
}

/**
 * Returns the canonical 0..46 tile index for any 8-neighbor bitmask (POL-05).
 */
export function getBlob47TileIndex(rawMask0to255: number): number {
  const clean = sanitize8NeighborMask(rawMask0to255);
  const idx = CANONICAL_47_MASKS.indexOf(clean);
  return idx >= 0 ? idx : 0;
}

/**
 * POL-17 & DEC-06:
 * Selects the Twin Gate LOD ('low' | 'mid' | 'high') and computes the 15m warm amber (#ffc13d)
 * coil dither light pool intensity at a given world distance from the Gate.
 */
export function evaluateTwinGatePresentation(
  s: FourFloats,
  distanceFromGateM: number
): {
  gateLod: 'low' | 'mid' | 'high';
  amberPoolMix0to1: number;
  amberHex: number;
} {
  const meanS = (s.Pxd + s.Vtx + s.Lx + s.Aq) * 0.25;
  const gateLod = meanS >= 0.70 ? 'high' : s.Pxd >= 0.45 && s.Lx >= 0.35 ? 'mid' : 'low';

  // DEC-06: 15m warm amber (#ffc13d) coil pool on the Stage 0/1 Moon
  const radiusM = 15.0;
  const falloff =
    distanceFromGateM >= radiusM
      ? 0.0
      : Math.pow(1.0 - distanceFromGateM / radiusM, 1.6);

  return {
    gateLod,
    amberPoolMix0to1: falloff,
    amberHex: 0xffc13d,
  };
}

/**
 * POL-25: Window Breach Static Burst Lab Floor Flash
 * Evaluates the cyan (#3dc8ff) bounce light intensity cast onto the Lab floor near the window
 * during deterministic static bursts (suppressed once the Window Breach heals in Act IX).
 */
export function evaluateWindowBreachFloorFlash(
  timeSec: number,
  breachWidthScale0to1: number
): {
  floorLightIntensity: number;
  floorLightHex: number;
} {
  if (breachWidthScale0to1 <= 0.01) {
    return { floorLightIntensity: 0.0, floorLightHex: 0x3dc8ff };
  }

  // Deterministic pseudo-random static burst envelope every ~3.2 seconds
  const cycle = (timeSec * 0.3125) % 1.0;
  const burst =
    cycle > 0.84
      ? Math.pow(Math.sin(((cycle - 0.84) / 0.16) * Math.PI * 3.0), 2.0)
      : 0.08;

  return {
    floorLightIntensity: burst * 1.45 * breachWidthScale0to1,
    floorLightHex: 0x3dc8ff,
  };
}
