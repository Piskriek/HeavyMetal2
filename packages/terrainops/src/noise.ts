/**
 * Deterministic integer hash for 2D coordinates and seed using Math.imul.
 * Returns a uniform pseudo-random number in [0, 1).
 */
export function hash2D(ix: number, iz: number, seed: number): number {
  let h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (ix | 0), 0x85ebca6b);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h ^ (iz | 0), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0) / 4294967296.0;
}

/**
 * 2D Value Noise with smooth cubic interpolation.
 * Pure and deterministic, no Math.random, no Date.
 */
export function valueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;

  // Smoothstep interpolation weights
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);

  const n00 = hash2D(x0, z0, seed);
  const n10 = hash2D(x0 + 1, z0, seed);
  const n01 = hash2D(x0, z0 + 1, seed);
  const n11 = hash2D(x0 + 1, z0 + 1, seed);

  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sz * (nx1 - nx0);
}
