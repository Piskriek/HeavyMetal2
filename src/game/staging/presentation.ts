/**
 * T06 — staging presentation data: orbit bands, density capping, highlights.
 *
 * Pure, headless, no DOM. The React overlay reads these to render the staging view.
 * Nothing here mutates the qualifying session or the release grid.
 *
 * Rules:
 * - Orbit bands are translucent visual guides — they do NOT create physical occupancy.
 * - At 100 racers, visible density is bounded: only the first N rows of the leaderboard
 *   are rendered, and orbit bands are grouped into waves rather than drawn individually.
 * - The human and the top-3 racers are always highlighted.
 * - The presentation never mutates the authoritative distance or speed values.
 */

import type { RankedQualifyingEntry } from '../contracts/qualifying';
import type { FrozenGrid } from '../release/grid';
import { frozenArray, isFiniteNumber } from '../contracts/core';
import type { RacerId } from '../contracts/identity';

/** Maximum leaderboard rows rendered, regardless of field size. */
export const MAX_LEADERBOARD_ROWS = 100;
/** Maximum orbit bands drawn individually; beyond this, they're grouped by wave. */
export const MAX_INDIVIDUAL_ORBIT_BANDS = 20;

export type HighlightKind = 'human' | 'leader' | 'podium' | 'normal' | 'fallback' | 'stalled';

export interface OrbitBand {
  readonly racerId: RacerId;
  readonly name: string;
  readonly lane: number;
  readonly x: number;
  readonly z: number;
  /** Exit speed from the grid — display only, never mutated. */
  readonly exitSpeed: number;
  readonly highlight: HighlightKind;
  /** Wave index from the grid. */
  readonly wave: number;
  /** Opacity: 1.0 for highlighted, lower for background racers. */
  readonly opacity: number;
}

export interface LeaderboardRow {
  readonly rank: number;
  readonly racerId: RacerId;
  readonly name: string;
  readonly time: number | null;
  readonly speed: number;
  readonly status: 'valid' | 'fallback';
  readonly fallback: string | null;
  readonly highlight: HighlightKind;
  readonly advanced: boolean;
  readonly attempts: number;
  readonly retries: number;
  /** Release delay in seconds (from the plan), or null if not yet scheduled. */
  readonly releaseDelay: number | null;
}

export interface StagingPresentation {
  readonly orbitBands: readonly OrbitBand[];
  readonly leaderboard: readonly LeaderboardRow[];
  readonly totalRacers: number;
  readonly visibleRacers: number;
  readonly humanRacerId: RacerId | null;
  /** True when orbit bands are grouped by wave rather than drawn individually. */
  readonly groupedBands: boolean;
}

export interface PresentationOptions {
  readonly humanRacerId?: RacerId;
  /** Names for each racer, keyed by racerId. */
  readonly names?: Readonly<Record<RacerId, string>>;
  /** Per-racer attempt count and retry count. */
  readonly attemptCounts?: Readonly<Record<RacerId, { attempts: number; retries: number }>>;
  /** Release delay per racer from the scheduler, in seconds. */
  readonly releaseDelays?: Readonly<Record<RacerId, number>>;
}

function classifyHighlight(
  entry: RankedQualifyingEntry,
  humanId: RacerId | null,
): HighlightKind {
  if (entry.racerId === humanId) return 'human';
  if (entry.status === 'fallback') return entry.fallback === 'retry-exhausted' ? 'stalled' : 'fallback';
  if (entry.rank === 1) return 'leader';
  if (entry.rank <= 3) return 'podium';
  return 'normal';
}

function opacityFor(highlight: HighlightKind): number {
  switch (highlight) {
    case 'human': return 1.0;
    case 'leader': return 0.95;
    case 'podium': return 0.85;
    case 'normal': return 0.5;
    case 'fallback': return 0.4;
    case 'stalled': return 0.35;
  }
}

/**
 * Builds the staging presentation from qualifying results and the frozen grid.
 * Pure, deterministic, and never mutates the inputs.
 */
export function buildStagingPresentation(
  entries: readonly RankedQualifyingEntry[],
  grid: FrozenGrid | null,
  options: PresentationOptions = {},
): StagingPresentation {
  const humanId = options.humanRacerId ?? null;
  const names = options.names ?? {};
  const attemptCounts = options.attemptCounts ?? {};
  const releaseDelays = options.releaseDelays ?? {};
  const totalRacers = entries.length;

  // Leaderboard: sorted by rank, bounded to MAX_LEADERBOARD_ROWS.
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const visibleEntries = sorted.slice(0, MAX_LEADERBOARD_ROWS);
  const leaderboard: LeaderboardRow[] = visibleEntries.map((entry) => {
    const highlight = classifyHighlight(entry, humanId);
    const counts = attemptCounts[entry.racerId];
    return Object.freeze({
      rank: entry.rank,
      racerId: entry.racerId,
      name: names[entry.racerId] ?? `Racer ${entry.racerId}`,
      time: entry.time,
      speed: entry.speed,
      status: entry.status,
      fallback: entry.fallback,
      highlight,
      advanced: entry.advanced,
      attempts: counts?.attempts ?? entry.attempt,
      retries: counts?.retries ?? Math.max(0, entry.attempt - 1),
      releaseDelay: releaseDelays[entry.racerId] ?? null,
    });
  });

  // Orbit bands: from the grid if available, otherwise from entries.
  let orbitBands: OrbitBand[] = [];
  let groupedBands = false;

  if (grid) {
    const useGrouped = grid.slots.length > MAX_INDIVIDUAL_ORBIT_BANDS;
    groupedBands = useGrouped;
    for (const slot of grid.slots) {
      const entry = entries.find((e) => e.racerId === slot.racerId);
      const highlight = entry ? classifyHighlight(entry, humanId) : 'normal';
      orbitBands.push(Object.freeze({
        racerId: slot.racerId,
        name: names[slot.racerId] ?? `Racer ${slot.racerId}`,
        lane: slot.lane,
        x: slot.x,
        z: slot.z,
        exitSpeed: slot.exitSpeed,
        highlight,
        wave: slot.wave,
        opacity: opacityFor(highlight),
      }));
    }
  } else {
    // No grid yet — show entries as placeholder bands.
    for (const entry of visibleEntries) {
      const highlight = classifyHighlight(entry, humanId);
      orbitBands.push(Object.freeze({
        racerId: entry.racerId,
        name: names[entry.racerId] ?? `Racer ${entry.racerId}`,
        lane: entry.racerId % 4,
        x: 0,
        z: 0,
        exitSpeed: entry.speed,
        highlight,
        wave: Math.floor(entry.rank / 4),
        opacity: opacityFor(highlight),
      }));
    }
  }

  return Object.freeze({
    orbitBands: frozenArray(orbitBands),
    leaderboard: frozenArray(leaderboard),
    totalRacers,
    visibleRacers: visibleEntries.length,
    humanRacerId: humanId,
    groupedBands,
  });
}

/**
 * Returns the subset of orbit bands that should be visible in a "close-up" view
 * (e.g., the camera focuses on the human's wave). Bounded to keep rendering cheap.
 */
export function focusedBands(
  presentation: StagingPresentation,
  focusRacerId: RacerId,
  maxVisible = 12,
): readonly OrbitBand[] {
  const focus = presentation.orbitBands.find((b) => b.racerId === focusRacerId);
  if (!focus) return presentation.orbitBands.slice(0, maxVisible);
  // Show the focus wave ± 1 wave.
  const nearWave = presentation.orbitBands.filter(
    (b) => Math.abs(b.wave - focus.wave) <= 1,
  );
  return frozenArray(nearWave.slice(0, maxVisible));
}

/**
 * Format a qualifying time for display. Returns "--:--" for fallback entries.
 */
export function formatQualifyingTime(time: number | null): string {
  if (!isFiniteNumber(time) || time <= 0) return '--:--';
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
    : seconds.toFixed(2);
}

/**
 * Format a speed for the HUD. Engine units → display speed (×0.16, rounded).
 */
export function formatDisplaySpeed(engineSpeed: number): string {
  return String(Math.round(engineSpeed * 0.16));
}
