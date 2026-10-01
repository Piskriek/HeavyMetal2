import type { Rng } from '@hm/contracts';

/** FNV-1a over a string, 32-bit. Used to turn a fork label into a number. */
export function hashLabel(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, the same generator the old game used, so seeds carry over. 32-bit state. */
export function createRng(seed: number): Rng {
  let a = seed | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: the list is empty');
      return items[Math.floor(next() * items.length)] as T;
    },
    // A fork reads the parent's state but does not advance it, so adding a fork never shifts anyone else's numbers.
    fork: (label) => createRng((a ^ hashLabel(label)) >>> 0),
    state: () => [a >>> 0],
    restore(state) {
      if (state.length !== 1) throw new Error('rng.restore: expected a state of one number');
      a = (state[0] as number) | 0;
    },
  };
  return rng;
}
