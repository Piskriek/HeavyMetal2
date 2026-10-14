// The monsters' rules as pure data and functions: the setting, the era a leak leaks by stage, the leak sites on the plot, the safe
// zones, the player's health, the drops and the seal reward. No DOM, no three.js, no clock, no randomness: the same plot gives the
// same sites. The runtime (play/monsters.ts) and the game screen (play.tsx) read these; policy.test.ts pins them.
import { ARCHETYPES, type Aggression, type Archetype, type Drop } from '@hm/leaksim';
import type { Era } from './roster';
import { hash32 } from './adapter';

// ---------------------------------------------------------------------------------------------------------- the setting
/** Monsters Off / Calm / Normal / Hard (the owner's setting; the same words as leaksim's aggression). */
export type MonstersSetting = Aggression;
export const MONSTER_SETTINGS: readonly MonstersSetting[] = ['off', 'calm', 'normal', 'hard'];
export const DEFAULT_MONSTERS: MonstersSetting = 'normal';

/** A saved setting, checked: anything odd is the default. */
export function parseMonsters(v: unknown): MonstersSetting {
  return v === 'off' || v === 'calm' || v === 'normal' || v === 'hard' ? v : DEFAULT_MONSTERS;
}

// ---------------------------------------------------------------------------------------------------------- eras and kinds
/** The era a leak leaks when it opens at `stage` (P1-MON-05): stages 0 and 1 sprite, 2 and 3 early 3D, 4 to 6 modern 3D. */
export function eraForStage(stage: number): Era {
  const s = Math.floor(stage);
  if (s <= 1) return 'sprite';
  if (s <= 3) return 'early3d';
  return 'modern3d';
}

/** The archetypes a leak of `era` leaks. The early-3D roster has no swarmer, so those leaks leave swarmers out. */
export function kindsForEra(era: Era): readonly Archetype[] {
  return era === 'early3d'
    ? ['charger', 'spitter', 'brute', 'flyer', 'sapper']
    : ['charger', 'spitter', 'swarmer', 'flyer', 'brute', 'sapper'];
}

// ---------------------------------------------------------------------------------------------------------- the budget
/** The most living monsters, by the graphics tier (the owner's budget): 8 on Low (and Potato), 16 on Medium, 24 on High and Ultra. */
export function monsterCap(quality: string): number {
  if (quality === 'high' || quality === 'ultra') return 24;
  if (quality === 'medium') return 16;
  return 8;
}

// ---------------------------------------------------------------------------------------------------------- the gate and the sites
/** The gate pad's sanctuary: a dome of this radius (m) around the Twin Gate pad (P0-MON-03, DEC-03). */
export const GATE_DOME_RADIUS = 25;
/** Nothing spawns, and no leak opens, closer than this to the gate pad (m). */
export const MIN_GATE_DISTANCE = 30;
/** A sealed room with life support is a sanctuary of this radius (m) around its life-support piece (B-07). */
export const LIFE_SUPPORT_RADIUS = 5;

export interface Point { readonly x: number; readonly z: number }
export interface SafeZone extends Point { readonly r: number }

/**
 * The junked models that leaks sit on, one per site, in the order the sites are laid out. They are wrecks already in the packed
 * art (the generated props), so a site reads as a dead machine that the containment has cracked.
 */
export const JUNK_MODELS: readonly string[] = ['wrecked-van-a', 'wrecked-truck-cab-c', 'container-crushed-a', 'old-monitor', 'terminal-old-a', 'workbench-old-a', 'wrecked-van-a', 'wrecked-truck-cab-c', 'container-crushed-a', 'old-monitor'];

/** The number of leak sites laid out on a plot. Site 0 is the Act IV dormant anomaly; the others are the live leaks. */
export const LEAK_SITE_COUNT = 10;
/**
 * The stage at which each live site opens (site 0 is dormant: it never opens, and the Act IV beat seals it). "A few per stage":
 * the first two at stage 1, two more at stage 2, then one or two a stage.
 */
export const OPEN_STAGE: readonly number[] = [0, 1, 1, 2, 2, 3, 4, 4, 5, 6];

export interface LeakSite extends Point {
  readonly index: number;
  /** Site 0 only: the dormant anomaly (zero spawns, sealed by the beam). */
  readonly dormant: boolean;
  /** The stage at which a live site opens (0 for the dormant one). */
  readonly openStage: number;
  /** The junked model the leak sits on (a generated prop id). */
  readonly junk: string;
}

/**
 * The leak sites of a plot: `LEAK_SITE_COUNT` points spread round the gate pad, deterministic in the plot's seed. Every site is at
 * least `MIN_GATE_DISTANCE` from the gate. The dormant site (0) sits near enough to reach on foot in Act IV.
 */
export function leakSites(seed: number, gate: Point): LeakSite[] {
  const out: LeakSite[] = [];
  for (let i = 0; i < LEAK_SITE_COUNT; i++) {
    const h = hash32((seed | 0) * 31 + i * 7919 + 17);
    const h2 = hash32(h ^ 0x9e3779b9);
    const jitter = ((h % 1000) / 1000 - 0.5) * 0.45;
    const angle = (i / LEAK_SITE_COUNT) * Math.PI * 2 + jitter;
    const radius = i === 0 ? 38 : MIN_GATE_DISTANCE + 6 + ((h2 % 1000) / 1000) * 70;
    const x = gate.x + Math.cos(angle) * radius;
    const z = gate.z + Math.sin(angle) * radius;
    out.push({
      index: i,
      x,
      z,
      dormant: i === 0,
      openStage: i === 0 ? 0 : (OPEN_STAGE[i] ?? 6),
      junk: JUNK_MODELS[i] ?? 'old-monitor',
    });
  }
  return out;
}

/** Whether a point is at least `MIN_GATE_DISTANCE` from the gate pad (the spawn and leak rule). */
export function clearOfGate(p: Point, gate: Point): boolean {
  return Math.hypot(p.x - gate.x, p.z - gate.z) >= MIN_GATE_DISTANCE;
}

/**
 * The sanctuaries: the gate's dome, and a circle round every sealed room's life-support piece (B-07). Pure in its inputs; the
 * caller reads the pieces from the base.
 */
export function safeZones(gate: Point, lifeSupport: readonly Point[]): SafeZone[] {
  return [{ x: gate.x, z: gate.z, r: GATE_DOME_RADIUS }, ...lifeSupport.map((p) => ({ x: p.x, z: p.z, r: LIFE_SUPPORT_RADIUS }))];
}

/** Whether a point is inside any sanctuary. */
export function inSafeZone(p: Point, zones: readonly SafeZone[]): boolean {
  return zones.some((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r);
}

// ---------------------------------------------------------------------------------------------------------- the player's health
/** The player's hit points at full health. */
export const PLAYER_MAX_HP = 100;
/** At or under this fraction of full health the player is low (M-03, the bark). */
export const LOW_HP_FRACTION = 0.3;
/** Seconds without a hit before health comes back. */
export const REGEN_DELAY = 6;
/** Hit points per second once it comes back. */
export const REGEN_PER_SECOND = 5;
/** Seconds between two low-health barks (the narrator's cooldown is the same). */
export const LOW_BARK_COOLDOWN = 60;

/** The hit points left after a hit (never below zero). */
export function hurt(hp: number, damage: number): number {
  return Math.max(0, hp - Math.max(0, damage));
}

/** Health after `dt` seconds: it comes back once the player has gone `REGEN_DELAY` seconds without a hit. */
export function regen(hp: number, secondsSinceHit: number, dt: number): number {
  if (hp <= 0 || secondsSinceHit < REGEN_DELAY) return hp;
  return Math.min(PLAYER_MAX_HP, hp + REGEN_PER_SECOND * dt);
}

/** Whether the player is low: alive, and at or under the low fraction. */
export function isLow(hp: number): boolean {
  return hp > 0 && hp <= PLAYER_MAX_HP * LOW_HP_FRACTION;
}

// ---------------------------------------------------------------------------------------------------------- the drops
/** Raw pixels (sprite monsters burst into these) and raw vertices (3D monsters): the substrate chain's first items. */
export const PIXEL_ITEM = 'pxd-mono';
export const VERTEX_ITEM = 'vtx-rough';
/** The first Anomaly Core: the dormant leak's seal gives it (the Act IV beat). */
export const CORE_ITEM = 'anomaly-core';

/** The item and count a monster's drop gives. */
export function dropStack(drop: Drop): { readonly item: string; readonly n: number } {
  return { item: drop.item === 'pixels' ? PIXEL_ITEM : VERTEX_ITEM, n: drop.n };
}

/** What sealing an ordinary leak gives: the same substrate as the fight, so a drop can be earned without fighting. */
export const SEAL_REWARD: readonly { readonly item: string; readonly n: number }[] = [
  { item: PIXEL_ITEM, n: 6 },
  { item: VERTEX_ITEM, n: 3 },
];

/** What sealing the dormant anomaly gives: one Anomaly Core. */
export const DORMANT_REWARD: readonly { readonly item: string; readonly n: number }[] = [{ item: CORE_ITEM, n: 1 }];

/** The drop of a kill, by archetype (from leaksim's table). */
export function killDrop(kind: Archetype): { readonly item: string; readonly n: number } {
  return dropStack(ARCHETYPES[kind].drop);
}

/** The bearing (radians) of a hit from the player's facing: 0 is straight ahead, positive is to the right. */
export function hitBearing(player: Point & { readonly yaw: number }, from: Point): number {
  const toHit = Math.atan2(from.x - player.x, from.z - player.z);
  let rel = toHit - player.yaw;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  return rel;
}
