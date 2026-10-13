// The pure adapter: a leaksim archetype and a leak's era give a skin. Deterministic in the seed (the mob's id, for a leak), so one
// leak's monsters vary but the same leak always spawns the same ones. No Math.random, no clock.
import type { Archetype, Era, SkinInfo } from './roster';
import { FALLBACK_SKIN, SKINS, skinById } from './roster';

/** A 32-bit integer hash (xorshift-multiply mix), stable across runs. */
export function hash32(seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The skin a monster of `archetype` wears in `era`. The candidates are the era's skins for that archetype, in id order; the seed
 * picks one. With none in that era, the archetype's skins from any era (the same shape, another look); with none at all, the
 * era's fallback.
 */
export function skinFor(archetype: Archetype, era: Era, seed: number, roster: readonly SkinInfo[] = SKINS): string {
  const sameEra = roster.filter((s) => s.archetype === archetype && s.era === era).sort(byId);
  const pool = sameEra.length > 0 ? sameEra : roster.filter((s) => s.archetype === archetype).sort(byId);
  if (pool.length === 0) return FALLBACK_SKIN[era];
  return pool[hash32(seed) % pool.length]!.id;
}

/** The skin to draw while `id` is not loaded (or failed): the core skin of the same kind, so something always stands there. */
export function fallbackFor(id: string, roster: readonly SkinInfo[] = SKINS): string {
  const s = roster.find((r) => r.id === id) ?? skinById(id);
  return s ? FALLBACK_SKIN[s.era] : FALLBACK_SKIN.sprite;
}

const byId = (a: SkinInfo, b: SkinInfo): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
