// ============================================================================
// File: packages/particles/src/footstep-and-tire-roost.ts
// Fix: Seeded mulberry32 RNG (100% pure, zero Math.random) + noUncheckedIndexedAccess guards
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export type SurfaceRoostStyle =
  | 'stage0-1bit-pixels'
  | 'stage12-regolith-dust'
  | 'stage3-hydro-splash'
  | 'stage46-meadow-flecks';

export interface RoostParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scaleM: number;
  colorHex: number;
  lifetimeSec: number;
  style: SurfaceRoostStyle;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function classifyRoostStyle(
  s: FourFloats,
  isInWaterBasin: boolean
): SurfaceRoostStyle {
  if (isInWaterBasin && s.Aq >= 0.35) {
    return 'stage3-hydro-splash';
  }
  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx);
  if (minFloat < 0.18) {
    return 'stage0-1bit-pixels';
  }
  if (minFloat >= 0.75 && s.Aq >= 0.65) {
    return 'stage46-meadow-flecks';
  }
  return 'stage12-regolith-dust';
}

export function spawnSurfaceRoostBurst(
  originX: number,
  originY: number,
  originZ: number,
  travelDirX: number,
  travelDirZ: number,
  speedMps: number,
  s: FourFloats,
  isInWaterBasin: boolean,
  isRoverTire: boolean,
  seed = 1337
): RoostParticleSpawn[] {
  if (speedMps < 0.5) return [];

  const rng = mulberry32(seed);
  const style = classifyRoostStyle(s, isInWaterBasin);
  const count = isRoverTire ? 6 : 3;
  const spawns: RoostParticleSpawn[] = [];

  const paletteByStyle: Record<SurfaceRoostStyle, readonly [number, number]> = {
    'stage0-1bit-pixels': [0xe8eef5, 0xffc13d],
    'stage12-regolith-dust': [0x7a746b, 0x9c8e7b],
    'stage3-hydro-splash': [0x3dc8ff, 0xb8ecff],
    'stage46-meadow-flecks': [0x4ca64c, 0x7cff4d],
  };

  const palette = paletteByStyle[style];

  for (let i = 0; i < count; i++) {
    const spreadAngle = (i / count - 0.5) * 0.9;
    const cos = Math.cos(spreadAngle);
    const sin = Math.sin(spreadAngle);
    const kickX = -(travelDirX * cos - travelDirZ * sin);
    const kickZ = -(travelDirX * sin + travelDirZ * cos);
    const speedScale = isRoverTire ? 0.45 * speedMps : 1.4;

    const colorHex = i % 2 === 0 ? palette[0] : palette[1];

    spawns.push({
      x: originX + (rng() - 0.5) * 0.25,
      y: originY + 0.08,
      z: originZ + (rng() - 0.5) * 0.25,
      vx: Number((kickX * speedScale).toFixed(3)),
      vy: Number((isRoverTire ? 1.8 + (i % 3) * 0.45 : 1.1).toFixed(3)),
      vz: Number((kickZ * speedScale).toFixed(3)),
      scaleM: isRoverTire ? 0.09 : 0.05,
      colorHex,
      lifetimeSec: isRoverTire ? 0.55 : 0.38,
      style,
    });
  }

  return spawns;
}
