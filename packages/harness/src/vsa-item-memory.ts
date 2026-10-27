/**
 * @file vsa-item-memory.ts
 * @module @hm/harness
 * @description Similarity-preserving VSA-4096 item memory (Plan 51, the mechanic mimicry's associative match).
 *
 * The memory kernel's `computeVsaSignature4096` is an integrity signature: one flipped input bit flips about half the
 * output, by design, so two nearly equal records look unrelated to it. Matching an observed mechanic to the nearest
 * shelf preset needs the opposite property, so this is the classic hyperdimensional item memory (Kanerva 2009; Rahimi
 * et al. 2016) in the same 128-word / 4096-bit layout:
 *
 *  - every feature i has a random ROLE hypervector R_i;
 *  - a value is quantized to one of L levels; LEVEL hypervectors are correlated: level q is the base vector with the
 *    first q·(2048/(L−1)) positions of a fixed random permutation flipped, so Hamming(Lq, Lr) ∝ |q − r| and the ends are
 *    orthogonal (2048 of 4096 bits apart);
 *  - a record is the majority BUNDLE of the bound pairs R_i ⊕ L(q_i) (XOR binding; ties broken by a fixed seeded vector).
 *
 * Similarity is 1 − Hamming/4096: about 0.5 between unrelated records, 1 for identical ones, and it falls smoothly as one
 * feature's value moves. Pure and deterministic (keyed splitmix32), no Math.random, no allocation per comparison.
 */
import { VSA_WORDS } from './memory-kernel.js';

const BITS = VSA_WORDS * 32;

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** A seeded random hypervector. */
export function randomHypervector(seed: number): Uint32Array {
  const next = splitmix32(seed);
  const v = new Uint32Array(VSA_WORDS);
  for (let w = 0; w < VSA_WORDS; w++) v[w] = next();
  return v;
}

const popcount = (x: number): number => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
};

/** Similarity 1 − Hamming/4096 (0.5 for unrelated vectors, 1 for identical ones). */
export function hypervectorSimilarity(a: Uint32Array, b: Uint32Array): number {
  let d = 0;
  for (let w = 0; w < VSA_WORDS; w++) d += popcount((a[w]! ^ b[w]!) >>> 0);
  return 1 - d / BITS;
}

/** A feature's numeric range, for quantization into levels. */
export interface FeatureRange {
  readonly min: number;
  readonly max: number;
}

/** An item memory over a fixed feature layout: role and level vectors seeded once. */
export interface ItemMemory {
  readonly levels: number;
  readonly ranges: readonly FeatureRange[];
  /** Encodes a feature vector into a record hypervector. */
  encode(features: readonly number[]): Uint32Array;
}

/** Builds an item memory for `ranges.length` features with `levels` quantization levels (default 32). */
export function createItemMemory(ranges: readonly FeatureRange[], levels = 32, seed = 0x51ce5eed): ItemMemory {
  const roles = ranges.map((_, i) => randomHypervector(seed ^ Math.imul(i + 1, 0x9e3779b1)));
  // the level ladder: a base vector and a fixed permutation of bit positions, flipped progressively
  const base = randomHypervector(seed ^ 0x1e7e1);
  const order = new Uint32Array(BITS);
  for (let i = 0; i < BITS; i++) order[i] = i;
  const shuffle = splitmix32(seed ^ 0x5bd1e995);
  for (let i = BITS - 1; i > 0; i--) {
    const j = shuffle() % (i + 1);
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  const flipsPerLevel = Math.floor(BITS / 2 / Math.max(1, levels - 1));
  const levelVectors: Uint32Array[] = [];
  for (let q = 0; q < levels; q++) {
    const v = new Uint32Array(base);
    for (let k = 0; k < q * flipsPerLevel; k++) {
      const bit = order[k]!;
      v[bit >>> 5] = (v[bit >>> 5]! ^ (1 << (bit & 31))) >>> 0;
    }
    levelVectors.push(v);
  }
  const tieBreak = randomHypervector(seed ^ 0x7ea1);
  const quantize = (x: number, r: FeatureRange): number => {
    if (!Number.isFinite(x)) return 0;
    const u = (x - r.min) / Math.max(1e-12, r.max - r.min);
    return Math.max(0, Math.min(levels - 1, Math.round(u * (levels - 1))));
  };
  return {
    levels,
    ranges,
    encode(features: readonly number[]): Uint32Array {
      const n = ranges.length;
      const counts = new Uint16Array(BITS);
      for (let i = 0; i < n; i++) {
        const role = roles[i]!;
        const level = levelVectors[quantize(features[i] ?? 0, ranges[i]!)]!;
        for (let w = 0; w < VSA_WORDS; w++) {
          const bound = (role[w]! ^ level[w]!) >>> 0;
          for (let b = 0; b < 32; b++) if ((bound >>> b) & 1) counts[w * 32 + b]! += 1;
        }
      }
      // majority bundle; an even feature count is broken by a fixed vector, so the result never depends on order
      const out = new Uint32Array(VSA_WORDS);
      const half = n / 2;
      for (let bit = 0; bit < BITS; bit++) {
        const c = counts[bit]!;
        const w = bit >>> 5;
        const set = c > half || (c === half && ((tieBreak[w]! >>> (bit & 31)) & 1) === 1);
        if (set) out[w] = (out[w]! | (1 << (bit & 31))) >>> 0;
      }
      return out;
    },
  };
}

/** The stored record nearest a query, with its similarity; null for an empty memory. */
export function nearestRecord<T extends { readonly hv: Uint32Array }>(query: Uint32Array, records: readonly T[]): { readonly record: T; readonly similarity: number } | null {
  let best: { record: T; similarity: number } | null = null;
  for (const r of records) {
    const s = hypervectorSimilarity(query, r.hv);
    if (!best || s > best.similarity) best = { record: r, similarity: s };
  }
  return best;
}
