import type { Vec2 } from './types';

/** Refuse grids that would need absurd memory (e.g. a 0.001 m spacing over a whole island). */
const MAX_GRID_CELLS = 1 << 24;

/**
 * Bridson's Poisson-disc sampling in the box [0, width] x [0, height].
 * Every pair of returned points is at least `minDist` apart; points come back in generation order.
 * The result depends only on the sequence of numbers `rng` yields (expected in [0, 1)).
 * Invalid input (non-positive or non-finite minDist, negative or non-finite box) yields [].
 */
export function poissonDisc(rng: () => number, width: number, height: number, minDist: number, k = 20): Vec2[] {
  if (!(minDist > 0) || !Number.isFinite(minDist)) return [];
  if (!(width >= 0) || !(height >= 0) || !Number.isFinite(width) || !Number.isFinite(height)) return [];

  const tries = Math.max(1, Math.floor(k));
  const cellSize = minDist / Math.SQRT2; // at most one point per cell
  const gw = Math.floor(width / cellSize) + 1;
  const gh = Math.floor(height / cellSize) + 1;
  if (gw * gh > MAX_GRID_CELLS) throw new RangeError('poissonDisc: minDist is too small for this area');

  const grid = new Int32Array(gw * gh).fill(-1);
  const points: Vec2[] = [];
  const active: number[] = [];
  const minDist2 = minDist * minDist;
  const gx = (x: number): number => Math.min(gw - 1, Math.floor(x / cellSize));
  const gz = (z: number): number => Math.min(gh - 1, Math.floor(z / cellSize));

  const fits = (x: number, z: number): boolean => {
    const cx = gx(x);
    const cz = gz(z);
    for (let j = Math.max(0, cz - 2); j <= Math.min(gh - 1, cz + 2); j++) {
      for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i++) {
        const idx = grid[j * gw + i] ?? -1;
        if (idx < 0) continue;
        const q = points[idx]!;
        const dx = q[0] - x;
        const dz = q[1] - z;
        if (dx * dx + dz * dz < minDist2) return false;
      }
    }
    return true;
  };

  const add = (x: number, z: number): void => {
    const idx = points.length;
    points.push([x, z]);
    active.push(idx);
    grid[gz(z) * gw + gx(x)] = idx;
  };

  add(rng() * width, rng() * height);
  while (active.length > 0) {
    const slot = Math.min(active.length - 1, Math.floor(rng() * active.length));
    const origin = points[active[slot]!]!;
    let placed = false;
    for (let n = 0; n < tries && !placed; n++) {
      const angle = rng() * Math.PI * 2;
      const radius = minDist * Math.sqrt(1 + 3 * rng()); // uniform over the annulus [minDist, 2*minDist]
      const x = origin[0] + Math.cos(angle) * radius;
      const z = origin[1] + Math.sin(angle) * radius;
      if (x >= 0 && x <= width && z >= 0 && z <= height && fits(x, z)) {
        add(x, z);
        placed = true;
      }
    }
    if (!placed) {
      const last = active.pop()!;
      if (slot < active.length) active[slot] = last;
    }
  }
  return points;
}
