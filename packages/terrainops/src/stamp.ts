import type { DirtyRect, TerrainLike, Vec2 } from './types.js';
import { valueNoise2D } from './noise.js';

export type StampKind = 'mound' | 'crater' | 'plateau' | 'ridge' | 'volcano' | 'dune';

export interface StampOptions {
  height: number; /* metres, positive */
  seed: number;
  rotation?: number; /* radians, for ridge and dune, default 0 */
  roughness?: number; /* 0..1, default 0.15 */
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Adds a height profile stamp to the terrain.
 * Additive: stamping twice doubles the effect.
 * Pure and deterministic, integer-hash noise based.
 */
export function stamp(
  t: TerrainLike,
  kind: StampKind,
  center: Vec2,
  radius: number,
  o: StampOptions
): DirtyRect | null {
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0 || radius <= 0) return null;

  const maxR = kind === 'ridge' ? 1.6 * radius : radius;
  const cx = center[0];
  const cz = center[1];

  const minX = cx - maxR;
  const maxX = cx + maxR;
  const minZ = cz - maxR;
  const maxZ = cz + maxR;

  const cMin = Math.max(0, Math.floor((minX - originX) / cell));
  const cMax = Math.min(cols - 1, Math.ceil((maxX - originX) / cell));
  const rMin = Math.max(0, Math.floor((minZ - originZ) / cell));
  const rMax = Math.min(rows - 1, Math.ceil((maxZ - originZ) / cell));

  if (cMin > cMax || rMin > rMax) return null;

  const rotation = o.rotation ?? 0;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const roughness = o.roughness ?? 0.15;
  const height = o.height;
  const noiseScale = radius / 3;

  let dirtyC0 = cols;
  let dirtyR0 = rows;
  let dirtyC1 = -1;
  let dirtyR1 = -1;
  let touched = false;

  for (let r = rMin; r <= rMax; r++) {
    const z = originZ + r * cell;
    const dz = z - cz;
    const rowOffset = r * cols;

    for (let c = cMin; c <= cMax; c++) {
      const x = originX + c * cell;
      const dx = x - cx;

      let profile = 0;
      let u = 0;
      let inside = false;

      if (kind === 'ridge') {
        const along = dx * cosR + dz * sinR;
        const across = -dx * sinR + dz * cosR;
        const factorAcross = Math.max(0, 1 - Math.abs(across) / radius);
        const factorAlong = Math.max(0, 1 - Math.abs(along) / (1.6 * radius));

        if (factorAcross > 0 && factorAlong > 0) {
          profile = height * (factorAcross * factorAcross) * factorAlong;
          u = Math.min(1, Math.hypot(across / radius, along / (1.6 * radius)));
          inside = true;
        }
      } else {
        const d = Math.hypot(dx, dz);
        u = d / radius;

        if (u < 1) {
          inside = true;
          switch (kind) {
            case 'mound': {
              const f = 1 - u * u;
              profile = height * f * f;
              break;
            }
            case 'crater': {
              const bowl = u < 0.7 ? -height * (1 - (u / 0.7) * (u / 0.7)) : 0;
              let rim = 0;
              if (u >= 0.6 && u < 1.0) {
                const ru = (u - 0.8) / 0.2;
                rim = 0.35 * height * Math.max(0, 1 - ru * ru);
              }
              profile = bowl + rim;
              break;
            }
            case 'plateau': {
              if (u <= 0.55) {
                profile = height;
              } else {
                profile = height * smoothstep((1 - u) / (1 - 0.55));
              }
              break;
            }
            case 'volcano': {
              const cone = height * Math.pow(1 - u, 1.4);
              const dip = u < 0.18 ? 0.35 * height * (1 - Math.pow(u / 0.18, 2)) : 0;
              profile = cone - dip;
              break;
            }
            case 'dune': {
              const angle = Math.atan2(dz, dx) - rotation;
              const f = 1 - u * u;
              profile = height * f * f * (0.55 + 0.45 * Math.cos(angle));
              break;
            }
          }
        }
      }

      if (!inside) continue;

      if (roughness > 0 && height !== 0) {
        const nVal = valueNoise2D(x / noiseScale, z / noiseScale, o.seed);
        profile += roughness * height * 0.25 * (nVal - 0.5) * (1 - u);
      }

      if (profile === 0) continue;

      const idx = rowOffset + c;
      t.heights[idx] = (t.heights[idx] ?? 0) + profile;
      touched = true;

      if (c < dirtyC0) dirtyC0 = c;
      if (c > dirtyC1) dirtyC1 = c;
      if (r < dirtyR0) dirtyR0 = r;
      if (r > dirtyR1) dirtyR1 = r;
    }
  }

  if (!touched) return null;

  return {
    c0: dirtyC0,
    r0: dirtyR0,
    c1: dirtyC1,
    r1: dirtyR1,
  };
}
