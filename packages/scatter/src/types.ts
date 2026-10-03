export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export interface TerrainLike {
  readonly spec: {
    readonly cols: number;
    readonly rows: number;
    readonly cell: number;
    readonly originX: number;
    readonly originZ: number;
  };
  readonly heights: Float32Array; /* index r*cols+c */
  readonly surfaceA: Uint8Array;
  readonly surfaceB: Uint8Array;
  readonly blend: Uint8Array; /* weight of surface B, 0..255 */
}

export interface ScatterRule {
  id: string; /* a prop recipe id, e.g. 'palm' */
  surfaces: readonly number[]; /* the node's dominant surface (A when blend < 128, else B) must be one of these; empty = any */
  minHeight: number;
  maxHeight: number;
  maxSlopeDeg: number;
  density: number; /* instances per 1000 m^2 at best, 0..50 */
  minSpacing: number; /* metres between instances of this rule */
  scale: readonly [number, number]; /* min and max uniform scale */
  clusterRadius?: number; /* when set, instances prefer to sit within this distance of earlier seeds of the same rule (groves); optional */
  /**
   * Patches: a smooth noise field decides where this rule grows thick (groves, drifts of flowers) and where it leaves clearings. `size` is
   * about how wide one patch is in metres, `cover` the share of the ground inside patches (0..1); outside them only a few stragglers grow.
   * Plants in the thick middle of a patch come out bigger. Optional.
   */
  clump?: { readonly size: number; readonly cover: number };
}

export interface AvoidPath {
  points: readonly Vec2[]; /* closed loop */
  halfWidth: number;
}

export interface ScatterOptions {
  seed: number;
  area?: { minX: number; minZ: number; maxX: number; maxZ: number };
  avoid?: readonly AvoidPath[];
  margin?: number; /* extra clearance around avoided paths, default 2 */
  maxCount?: number; /* hard cap over all rules, default 5000 */
  edgeMargin?: number; /* stay this many metres inside the grid edge, default 1 */
}

export interface Placement {
  rule: string;
  x: number;
  y: number;
  z: number;
  yaw: number; /* radians */
  scale: number;
}
