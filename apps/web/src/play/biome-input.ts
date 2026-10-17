// apps/web/src/play/biome-input.ts
// Builds BiomeInput for @hm/plotbiome from terrain, water sources, machines, and keep-outs.

import { flood, type Source, type Terrain } from '@hm/hydro';

// Local types mirroring @hm/plotbiome until that package lands.
export type Tier = 'low' | 'mid' | 'high';

export interface BiomeInput {
  n: number;
  cellM: number; // grid n x n cells (16..512), metres per cell
  height: Float32Array; // n*n metres, index z*n+x; cell (x,z) centre is at world ((x+0.5)*cellM,(z+0.5)*cellM)
  water: Uint8Array; // n*n, 0 = dry, >0 = water
  stage: number; // 0..6, may be fractional
  s: { pxd: number; vtx: number; lx: number; aq: number }; // each 0..1
  machines: readonly { x: number; z: number; r: number }[]; // world metres relative to grid origin; r = keep-out radius
  keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[]; // world-metre rectangles relative to grid origin
  seed: number;
  tier: Tier;
}

export interface BuildBiomeInputOptions {
  heightAt(x: number, z: number): number;
  x0: number;
  z0: number;
  n: number;
  cellM: number;
  machines: readonly { x: number; z: number; r: number }[];
  keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[];
  waterSources: readonly { x: number; z: number }[];
  waterVolume: number;
  stage: number;
  s: { pxd: number; vtx: number; lx: number; aq: number };
  seed: number;
  tier: Tier;
}

/**
 * Builds BiomeInput from world terrain samples, simulated hydro water, and keep-out geometry.
 *
 * Cell (x, z) centres are sampled at:
 *   worldX = x0 + (x + 0.5) * cellM
 *   worldZ = z0 + (z + 0.5) * cellM
 * in row-major order: index = z * n + x.
 */
export function buildBiomeInput(o: BuildBiomeInputOptions): BiomeInput {
  const { n, cellM, x0, z0 } = o;
  const count = n * n;

  // 1. Sample heightfield at cell centres
  const height = new Float32Array(count);
  for (let z = 0; z < n; z++) {
    const worldZ = z0 + (z + 0.5) * cellM;
    const rowOffset = z * n;
    for (let x = 0; x < n; x++) {
      const worldX = x0 + (x + 0.5) * cellM;
      height[rowOffset + x] = o.heightAt(worldX, worldZ);
    }
  }

  // 2. Compute water via @hm/hydro's flood and rasterise into n x n mask
  const water = new Uint8Array(count);
  if (o.waterVolume > 0 && o.waterSources.length > 0) {
    const sources: Source[] = [];
    for (const ws of o.waterSources) {
      const gx = Math.floor((ws.x - x0) / cellM);
      const gz = Math.floor((ws.z - z0) / cellM);
      if (gx >= 0 && gx < n && gz >= 0 && gz < n) {
        sources.push({ x: gx, z: gz, share: 1 });
      }
    }

    if (sources.length > 0) {
      const terrainHeights: number[] = new Array<number>(count);
      for (let i = 0; i < count; i++) {
        terrainHeights[i] = height[i] ?? 0;
      }
      const terrain: Terrain = {
        size: n,
        cell: cellM,
        heights: terrainHeights,
      };

      const w = flood(terrain, sources, o.waterVolume);
      for (let i = 0; i < count; i++) {
        if ((w.depth[i] ?? 0) > 0 || (w.stream[i] ?? 0) > 0) {
          water[i] = 1;
        }
      }
    }
  }

  // 3. Convert machines and keep-outs from world metres into grid origin frame
  const machines = o.machines.map((m) => ({
    x: m.x - x0,
    z: m.z - z0,
    r: m.r,
  }));

  const keepouts = o.keepouts.map((k) => ({
    x0: k.x0 - x0,
    z0: k.z0 - z0,
    x1: k.x1 - x0,
    z1: k.z1 - z0,
  }));

  return {
    n,
    cellM,
    height,
    water,
    stage: o.stage,
    s: { ...o.s },
    machines,
    keepouts,
    seed: o.seed,
    tier: o.tier,
  };
}
