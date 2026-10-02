export type Vec2 = readonly [number, number];

export interface TerrainLike {
  readonly spec: {
    readonly cols: number;
    readonly rows: number;
    readonly cell: number;
    readonly originX: number;
    readonly originZ: number;
  };
  readonly heights: Float32Array; /* index r*cols+c; node (c,r) at x = originX + c*cell, z = originZ + r*cell */
}

export interface DirtyRect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
} /* inclusive node ranges, clamped to the grid */

export interface TerrainStats {
  min: number;
  max: number;
  mean: number;
  landFraction: number; /* nodes with height > 0 */
  steepest: number; /* largest rise/run between 4-neighbour nodes */
}
