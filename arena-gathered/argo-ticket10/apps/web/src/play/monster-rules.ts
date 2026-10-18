// ============================================================================
// File: apps/web/src/play/monster-rules.ts
// The pure spawn and beam rules of the monsters (TICKET-07 Items B and C), split out of monsters.ts so the node tests can run them
// without the renderer (its loader uses the Vite-only import.meta.glob). Deterministic: no DOM, no I/O, no clock, no randomness.
// ============================================================================

import type { Archetype } from '@hm/leaksim';
import type { BeamMode } from '@hm/beamkit';

/** How far the beam reaches a leak to seal it (leaksim seals within this distance of the player, m). */
export const SEAL_REACH = 25;
/** Proximity radius (m) within which an open leak spawns active defenders (TICKET-07 Item B). */
export const PROXIMITY_SPAWN_RADIUS = 40;
/** Cooldown (s) between proximity spawn pulses on an open leak. */
export const PROXIMITY_SPAWN_INTERVAL = 10;

export function maxMobsPerLeak(stage: number): number {
  const s = Number.isFinite(stage) ? Math.max(0, Math.min(6, Math.floor(stage))) : 0;
  return Math.min(6, 2 + Math.floor(s / 2));
}

/**
 * Pure proximity spawn policy (TICKET-07 Item B — MC-01):
 * Open, non-dormant leaks within ~40 m of the player spawn their archetype up to
 * the per-leak cap (`maxMobsPerLeak(stage)`). Sealed leaks, dormant leaks, or leaks
 * beyond 40 m return 0.
 */
export function spawnPolicy(
  leak: { readonly sealed: boolean; readonly dormant?: boolean; readonly kinds?: readonly Archetype[] },
  playerDist: number,
  stage: number,
  active: number
): number {
  if (!leak || leak.sealed || leak.dormant) return 0;
  if (leak.kinds && leak.kinds.length === 0) return 0;
  if (!Number.isFinite(playerDist) || playerDist < 0 || playerDist > PROXIMITY_SPAWN_RADIUS) return 0;
  const cap = maxMobsPerLeak(stage);
  const cur = Number.isFinite(active) ? Math.max(0, Math.floor(active)) : 0;
  if (cur >= cap) return 0;
  const batch = stage >= 3 ? 2 : 1;
  return Math.min(batch, cap - cur);
}

/**
 * Pure beam chip-damage calculator (TICKET-07 Item C — MC-03):
 * - `'extract'` deals continuous chip damage (~18 HP/s at 0 m, tapering to 60% at 25 m).
 * - `'seal'` (or while sealing a leak), `'apply'`, and `'sculpt'` deal 0 damage.
 */
export function beamDamage(
  mode: BeamMode | 'seal',
  dt: number,
  distM: number,
  sealing = false
): number {
  if (sealing || mode !== 'extract') return 0;
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  if (!Number.isFinite(distM) || distM < 0 || distM > SEAL_REACH) return 0;
  const falloff = 1 - 0.4 * (distM / SEAL_REACH);
  const dps = 18 * falloff;
  return dps * dt;
}

export interface FightOverlayTuning {
  /** Stage-look colour remap strength (tuned down at Stage 1 so monsters never smear pink; 0.20 at Stage 6). */
  readonly remapStrength: number;
  /** Maximum opacity of the wind-up telegraph ring under the monster (POL-37). */
  readonly ringMaxOpacity: number;
  /** Inner and outer radii (m) of the wind-up telegraph ring. */
  readonly ringInnerR: number;
  readonly ringOuterR: number;
  /** Death particle count scaled by stage so low-res Stage 1 silhouettes stay crisp. */
  readonly burstCount: number;
}

/**
 * Pure stage-dependent fight-overlay tuning (POL-37):
 * - At Stage 0–1 (coarse 240p / 10-level posterisation), `remapStrength` is lowered to `0.12`
 *   and telegraph ring opacity is capped at `0.55` so sprites and early-3D monsters never read as a pink smear.
 * - At Stage 4–6 (high-res 24-bit colour), `remapStrength` uses Brief 30's canonical `0.20` and full particle bursts.
 */
export function fightOverlayParamsForStage(stage: number): FightOverlayTuning {
  const s = Number.isFinite(stage) ? Math.max(0, Math.min(6, Math.floor(stage))) : 1;
  if (s <= 1) {
    return {
      remapStrength: 0.12,
      ringMaxOpacity: 0.55,
      ringInnerR: 0.62,
      ringOuterR: 0.78,
      burstCount: 8,
    };
  }
  if (s <= 3) {
    return {
      remapStrength: 0.16,
      ringMaxOpacity: 0.68,
      ringInnerR: 0.58,
      ringOuterR: 0.79,
      burstCount: 11,
    };
  }
  return {
    remapStrength: 0.20,
    ringMaxOpacity: 0.78,
    ringInnerR: 0.55,
    ringOuterR: 0.80,
    burstCount: 14,
  };
}
