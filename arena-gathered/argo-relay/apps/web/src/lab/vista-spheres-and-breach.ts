// ============================================================================
// File: apps/web/src/lab/vista-spheres-and-breach.ts
// Plan: Plan 13 (P0-LAYOUT-03 / TASK-19 Review 1 Completion for 3D Window Vista)
// Budget: <= 1.5 ms on GTX 950M (6 packed props + 3 analytical sphere pockets)
// ============================================================================

export interface VistaPropPlacement {
  assetId:
    | 'datacentre-hall'
    | 'chiller-block'
    | 'shipping-container'
    | 'pylon-tower'
    | 'overpass-segment'
    | 'rubble-slab';
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  scale: number;
  straddlesPocketIndex?: number;
}

export interface SphericalFidelityPocket {
  id: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  radiusM: number;
}

export const CANONICAL_BREACH_COLUMN_PLACEMENT = {
  // Left one-third rule (-35% of 14.8m window span -> x = -18.5m at z = -85m)
  x: -18.5,
  y: 0.0,
  z: -85.0,
  radiusM: 4.2,
  heightM: 64.0, // Towers well above the top of the 3.1m letterbox glass
  primaryHex: 0x3dc8ff,
};

export const CANONICAL_VISTA_SPHERE_POCKETS: SphericalFidelityPocket[] = [
  { id: 'pocket-alpha', centerX: -8.0, centerY: 4.5, centerZ: -42.0, radiusM: 5.5 },
  { id: 'pocket-beta', centerX: 14.0, centerY: 7.0, centerZ: -64.0, radiusM: 7.5 },
  { id: 'pocket-gamma', centerX: -24.0, centerY: 9.5, centerZ: -72.0, radiusM: 6.0 },
];

/**
 * Mid-ground (45–120m) vista layout solving Review 1 foreground crowding.
 */
export const CANONICAL_VISTA_PROP_PLACEMENTS: VistaPropPlacement[] = [
  // Straddles pocket-alpha boundary: half 1-bit dither outside, half lush PBR inside!
  {
    assetId: 'shipping-container',
    x: -3.2,
    y: 1.2,
    z: -42.0,
    yawDeg: 28,
    scale: 1.0,
    straddlesPocketIndex: 0,
  },
  {
    assetId: 'rubble-slab',
    x: -11.5,
    y: 0.0,
    z: -38.0,
    yawDeg: -15,
    scale: 1.1,
    straddlesPocketIndex: 0,
  },
  // Mid-ground industrial silhouettes (48m..110m setback)
  { assetId: 'chiller-block', x: 18.0, y: 0.0, z: -54.0, yawDeg: 12, scale: 1.0 },
  { assetId: 'overpass-segment', x: -6.0, y: 0.0, z: -68.0, yawDeg: -32, scale: 1.15 },
  { assetId: 'pylon-tower', x: -14.0, y: 0.0, z: -76.0, yawDeg: 8, scale: 1.0 },
  { assetId: 'datacentre-hall', x: 26.0, y: 0.0, z: -105.0, yawDeg: -18, scale: 1.2 },
];

/**
 * Pure helper evaluating whether a world-space point (wx, wy, wz) lies inside
 * any of the 3 spherical S-Space Fidelity Pockets (for straddling prop shaders).
 */
export function isPointInsideVistaFidelityPocket(
  wx: number,
  wy: number,
  wz: number,
  pockets: SphericalFidelityPocket[] = CANONICAL_VISTA_SPHERE_POCKETS
): { inside: boolean; pocketId: string | null; edgeDistanceM: number } {
  let minEdgeDist = 999.0;
  for (const p of pockets) {
    const d = Math.hypot(wx - p.centerX, wy - p.centerY, wz - p.centerZ);
    const edgeDist = d - p.radiusM;
    if (edgeDist <= 0.0) {
      return { inside: true, pocketId: p.id, edgeDistanceM: edgeDist };
    }
    if (edgeDist < minEdgeDist) {
      minEdgeDist = edgeDist;
    }
  }
  return { inside: false, pocketId: null, edgeDistanceM: minEdgeDist };
}
