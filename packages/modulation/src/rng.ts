/**
 * Deterministic integer hashing utilities.
 *
 * Nothing in this package uses Math.random() or Date: every "random" number is a
 * pure function of (seed, a, b) integers, so sampling is fully replayable.
 */

/** Split a (possibly fractional) number into a 32-bit mixing word. */
function bits(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const i = Math.floor(x);
  const f = Math.round((x - i) * 0x1000000);
  return Math.imul(i | 0, 0x85ebca6b) ^ Math.imul(f | 0, 0xc2b2ae35);
}

/** 32-bit integer hash of (seed, a, b). Murmur3-style final avalanche. */
export function hash32(seed: number, a: number, b = 0): number {
  let h = 0x9e3779b9;
  h = Math.imul(h ^ bits(seed), 0x85ebca6b);
  h = Math.imul(h ^ bits(a), 0xc2b2ae35);
  h = Math.imul(h ^ bits(b), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Uniform value in [0, 1) derived from an integer hash. */
export function hash01(seed: number, a: number, b = 0): number {
  return hash32(seed, a, b) / 4294967296;
}

/**
 * Bell-shaped value in [0, 1] with mean 0.5: the sum of four uniform hashes,
 * rescaled (sum of 4 uniforms -> mean 2, std ~0.577 -> /4 => mean 0.5, std 0.144).
 */
export function gaussian01(seed: number, a: number): number {
  const sum =
    hash01(seed, a, 0x1) +
    hash01(seed, a, 0x2) +
    hash01(seed, a, 0x3) +
    hash01(seed, a, 0x4);
  return Math.min(1, Math.max(0, sum / 4));
}
