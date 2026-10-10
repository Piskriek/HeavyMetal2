/**
 * What a weapon does, from the four parts fitted to its frame (owner, 2026-10-10: one frame, four part slots).
 * Pure: the combat code reads these numbers. The semi-auto core, scatter barrel, iron sight and compact cell make
 * exactly today's shotgun (7 pellets of 20 to 29, ±0.0275 rad, 60 m, 0.52 s), so nothing feels different until a
 * player swaps a part.
 */
import type { PartSlot } from './catalog';

export type FireMode = 'semi' | 'burst' | 'beam';
export interface WeaponStats {
  readonly mode: FireMode;
  /** Shots per trigger pull (burst), each `burstGap` seconds apart. */
  readonly burst: number;
  readonly burstGap: number;
  /** Seconds between trigger pulls; for a beam, between damage ticks while held. */
  readonly cooldown: number;
  readonly pellets: number;
  /** Damage per pellet (per tick for a beam): min and max, inclusive. */
  readonly damage: readonly [number, number];
  /** Half-angle of the pellet spread, radians, on each axis. */
  readonly spread: number;
  readonly range: number;
  readonly zoom: number;
  /** Shots (beam ticks) per full cell. */
  readonly magazine: number;
}

const CORE: Readonly<Record<string, Pick<WeaponStats, 'mode' | 'burst' | 'burstGap' | 'cooldown'> & { damage: readonly [number, number] }>> = {
  'core-semi': { mode: 'semi', burst: 1, burstGap: 0, cooldown: 0.52, damage: [20, 29] },
  'core-burst': { mode: 'burst', burst: 3, burstGap: 0.08, cooldown: 0.8, damage: [16, 22] },
  'core-beam': { mode: 'beam', burst: 1, burstGap: 0, cooldown: 0.1, damage: [6, 8] },
};
const BARREL: Readonly<Record<string, { pellets: number; spread: number; range: number; damageMul: number }>> = {
  'barrel-short': { pellets: 1, spread: 0.02, range: 40, damageMul: 1 },
  'barrel-long': { pellets: 1, spread: 0.006, range: 90, damageMul: 1.35 },
  'barrel-scatter': { pellets: 7, spread: 0.0275, range: 60, damageMul: 1 },
};
const SIGHT: Readonly<Record<string, { zoom: number; spreadMul: number }>> = {
  'sight-iron': { zoom: 1, spreadMul: 1 },
  'sight-scope': { zoom: 3, spreadMul: 0.6 },
  'sight-holo': { zoom: 1.5, spreadMul: 0.8 },
};
const CELL: Readonly<Record<string, number>> = { 'cell-compact': 8, 'cell-extended': 20 };

/** The weapon's stats, or null while any slot is empty (it will not fire). */
export function weaponStats(loadout: Readonly<Record<PartSlot, string | null>>): WeaponStats | null {
  const core = loadout.core ? CORE[loadout.core] : undefined, barrel = loadout.barrel ? BARREL[loadout.barrel] : undefined;
  const sight = loadout.sight ? SIGHT[loadout.sight] : undefined, cell = loadout.cell ? CELL[loadout.cell] : undefined;
  if (!core || !barrel || !sight || cell === undefined) return null;
  const beam = core.mode === 'beam';
  return {
    mode: core.mode,
    burst: core.burst,
    burstGap: core.burstGap,
    cooldown: core.cooldown,
    // a beam is one continuous ray whatever the barrel
    pellets: beam ? 1 : barrel.pellets,
    damage: [Math.round(core.damage[0] * barrel.damageMul), Math.round(core.damage[1] * barrel.damageMul)],
    spread: beam ? 0 : barrel.spread * sight.spreadMul,
    range: barrel.range,
    zoom: sight.zoom,
    magazine: beam ? cell * 5 : cell,
  };
}
