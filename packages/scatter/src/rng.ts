/**
 * Seeded randomness. This is the only source of randomness in the package:
 * no Math.random, no Date. Seeds are treated as unsigned 32-bit integers.
 */

/** mulberry32: a small, fast, well-distributed PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent 32-bit stream seed from (seed, index), e.g. (user seed, rule index). */
export function mixSeed(seed: number, index: number): number {
  let h = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul((index + 1) >>> 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
