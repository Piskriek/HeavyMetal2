import type { DirtyRect, TerrainLike, Vec2 } from './types.js';
import { heightAt } from './sample.js';

export interface RampOptions {
  width: number; /* metres, full road width */
  shoulder: number; /* metres of blended edge on each side */
  heightA?: number;
  heightB?: number; /* absolute heights at a and b; default = the terrain height at that point */
  strength?: number; /* 0..1, default 1 */
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Creates a ramp or flat pad between two points a and b.
 * Interpolates height linearly along the segment with rounded caps and shoulder blending.
 */
export function rampBetween(
  t: TerrainLike,
  a: Vec2,
  b: Vec2,
  o: RampOptions
): DirtyRect | null {
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cols <= 0 || rows <= 0) return null;

  const width = Math.max(0, o.width);
  const shoulder = Math.max(0, o.shoulder);
  const halfW = width * 0.5;
  const maxDist = halfW + shoulder;
  const strength = o.strength ?? 1;

  if (maxDist <= 0 || strength <= 0) return null;

  const ax = a[0];
  const az = a[1];
  const bx = b[0];
  const bz = b[1];

  const heightA = o.heightA !== undefined ? o.heightA : heightAt(t, ax, az);
  const heightB = o.heightB !== undefined ? o.heightB : heightAt(t, bx, bz);

  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;

  const minX = Math.min(ax, bx) - maxDist;
  const maxX = Math.max(ax, bx) + maxDist;
  const minZ = Math.min(az, bz) - maxDist;
  const maxZ = Math.max(az, bz) + maxDist;

  const cMin = Math.max(0, Math.floor((minX - originX) / cell));
  const cMax = Math.min(cols - 1, Math.ceil((maxX - originX) / cell));
  const rMin = Math.max(0, Math.floor((minZ - originZ) / cell));
  const rMax = Math.min(rows - 1, Math.ceil((maxZ - originZ) / cell));

  if (cMin > cMax || rMin > rMax) return null;

  let dirtyC0 = cols;
  let dirtyR0 = rows;
  let dirtyC1 = -1;
  let dirtyR1 = -1;
  let touched = false;

  for (let r = rMin; r <= rMax; r++) {
    const pz = originZ + r * cell;
    const rowOffset = r * cols;

    for (let c = cMin; c <= cMax; c++) {
      const px = originX + c * cell;

      let s = 0;
      let projX = ax;
      let projZ = az;

      if (lenSq > 0) {
        const rawS = ((px - ax) * dx + (pz - az) * dz) / lenSq;
        s = Math.max(0, Math.min(1, rawS));
        projX = ax + s * dx;
        projZ = az + s * dz;
      }

      const dist = Math.hypot(px - projX, pz - projZ);
      if (dist > maxDist) continue;

      let k = 0;
      if (dist <= halfW) {
        k = 1;
      } else if (shoulder > 0) {
        k = smoothstep(1 - (dist - halfW) / shoulder);
      }

      if (k <= 0) continue;

      const targetH = heightA + s * (heightB - heightA);
      const idx = rowOffset + c;
      const oldH = t.heights[idx] ?? 0;
      const newH = oldH + (targetH - oldH) * k * strength;

      t.heights[idx] = newH;
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
