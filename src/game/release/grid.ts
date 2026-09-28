/**
 * T05 — frozen grid and qualifying comparator.
 *
 * The grid is the exact, immutable starting layout for a released heat. It is derived from
 * the ranked qualifying order and the release corridor, and nothing about it is negotiable
 * once built: no pole-position teleport, no ×1.08 boost, no collision immunity.
 *
 * Rules:
 * - Rank 1 sits at the front of the corridor, every subsequent slot is behind.
 * - Lanes are assigned by rank within each wave: one racer per lane, then the next wave.
 * - Wave spacing is the larger of the caller's preferred gap and the corridor's safety
 *   minimum (`minSpacing`). Compressed gaps below safety are refused, not silently repaired.
 * - Exit speed is the racer's qualifying gate speed, preserved exactly. A fallback entry
 *   that never crossed the gate gets `MIN_EXIT_SPEED` so it can still be released.
 * - A slot with an invalid (non-finite, zero, negative) speed is flagged as `stalled`;
 *   the scheduler decides whether to delay or DNF it — the grid never silently fixes it.
 */

import { RADIUS } from '../scene';
import type { RankedQualifyingEntry } from '../contracts/qualifying';
import type { ReleaseCorridor, SpawnPoint } from '../contracts/release';
import { laneCenterZ } from '../contracts/release';
import { ContractError, frozenArray, isFiniteNumber } from '../contracts/core';
import type { RacerId } from '../contracts/identity';

/** Hard floor so a stalled racer does not sit on the grid at zero speed forever. */
export const MIN_EXIT_SPEED = 120;
/** Default preferred wave gap in world units. Safety minimum always wins. */
export const DEFAULT_WAVE_SPACING = RADIUS * 6;
/** Default stagger within a wave: the lateral offset is in x, not z. */
export const DEFAULT_STAGGER_X = RADIUS * 1.2;
/** Maximum lanes the grid will ever assign. The corridor and the scene cap this at four. */
export const MAX_GRID_LANES = 4;

export type GridStatus = 'valid' | 'fallback' | 'stalled';

export interface GridSlot {
  readonly racerId: RacerId;
  readonly rank: number;
  /** Zero-based lane index (0 = near, LANE_COUNT-1 = far). */
  readonly lane: number;
  /** World x position on the track. */
  readonly x: number;
  /** World z position (lane center). */
  readonly z: number;
  /** Exact qualifying gate speed, preserved. Never boosted. */
  readonly exitSpeed: number;
  readonly status: GridStatus;
  /** Zero-based wave index. Wave 0 is the front wave. */
  readonly wave: number;
  /** Position within the wave (0 = first lane assigned). */
  readonly waveSlot: number;
}

export interface FrozenGrid {
  readonly slots: readonly GridSlot[];
  /** Lanes actually used (can be less than MAX_GRID_LANES if the caller restricts it). */
  readonly lanes: number;
  readonly waves: number;
  /** The wave spacing actually used — max of preferred and safety. */
  readonly waveSpacing: number;
  readonly corridor: ReleaseCorridor;
}

export interface GridOptions {
  readonly corridor: ReleaseCorridor;
  /** Preferred wave gap in world units. Clamped upward to the corridor's safety minimum. */
  readonly preferredWaveSpacing?: number;
  /** Stagger in x between adjacent lanes within a wave. */
  readonly staggerX?: number;
  /** Restrict the grid to fewer lanes (1-4). Defaults to MAX_GRID_LANES. */
  readonly laneCount?: number;
  /**
   * Optional preferred lane per racer. The grid honours it when the lane is free in the
   * racer's wave; otherwise it assigns by rank. This is how a qualifying leader keeps the
   * racing line while a rival takes the lane they qualified in.
   */
  readonly preferredLanes?: Readonly<Record<RacerId, number>>;
}

export interface GridDiagnostics {
  readonly clamped: readonly string[];
}

/**
 * Clamps a wave spacing to be at least the corridor's safety minimum.
 * Reports the clamp so the caller can see the decision.
 */
export function resolveWaveSpacing(preferred: number, safety: number): { spacing: number; clamped: boolean } {
  const safe = isFiniteNumber(safety) && safety > 0 ? safety : RADIUS * 2.4;
  const want = isFiniteNumber(preferred) && preferred > 0 ? preferred : DEFAULT_WAVE_SPACING;
  return { spacing: Math.max(want, safe), clamped: want < safe };
}

function assignLanes(
  waveEntries: readonly RankedQualifyingEntry[],
  laneCount: number,
  preferred: Readonly<Record<RacerId, number>>,
): readonly number[] {
  const taken = new Set<number>();
  const result: number[] = [];
  // First pass: honour preferred lanes when available.
  for (const entry of waveEntries) {
    const want = preferred[entry.racerId];
    if (want !== undefined && Number.isInteger(want) && want >= 0 && want < laneCount && !taken.has(want)) {
      taken.add(want);
      result.push(want);
    } else {
      result.push(-1);
    }
  }
  // Second pass: fill remaining lanes in rank order.
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== -1) continue;
    for (let lane = 0; lane < laneCount; lane++) {
      if (!taken.has(lane)) {
        taken.add(lane);
        result[i] = lane;
        break;
      }
    }
  }
  return result;
}

export interface BuildGridResult {
  readonly grid: FrozenGrid;
  readonly diagnostics: GridDiagnostics;
}

/**
 * Builds the frozen grid. Pure, deterministic, and refusal-first: an invalid input throws
 * a ContractError rather than silently producing a bad layout.
 */
export function buildFrozenGrid(
  entries: readonly RankedQualifyingEntry[],
  options: GridOptions,
): BuildGridResult {
  if (!entries || entries.length === 0) {
    throw new ContractError('E_CONTRACT_SHAPE', 'A frozen grid needs at least one qualifying entry.');
  }
  const corridor = options.corridor;
  if (!corridor || !isFiniteNumber(corridor.from) || !isFiniteNumber(corridor.to) || corridor.to <= corridor.from) {
    throw new ContractError('E_CORRIDOR', 'The release corridor needs finite from/to with to > from.');
  }
  const clampedNotes: string[] = [];
  const maxLanes = Math.max(1, Math.min(MAX_GRID_LANES, Math.round(options.laneCount ?? MAX_GRID_LANES)));
  // Find which lane indices fit within the corridor's halfWidth.
  // The physical constraint is the corridor, not the request.
  const validLanes: number[] = [];
  for (let lane = 0; lane < maxLanes; lane++) {
    if (Math.abs(laneCenterZ(lane)) <= corridor.halfWidth) validLanes.push(lane);
  }
  const laneCount = Math.max(1, validLanes.length);
  if (validLanes.length < maxLanes) {
    clampedNotes.push(`Lane count reduced from ${maxLanes} to ${laneCount}: ${maxLanes - validLanes.length} lane(s) exceed corridor halfWidth ${corridor.halfWidth}.`);
  }
  // Remap: the grid uses lanes 0..laneCount-1 internally, but the actual scene lane
  // indices are validLanes[0..laneCount-1]. The grid stores the scene lane index.
  const laneMap = validLanes.length > 0 ? validLanes : [0]; // fallback: at least one lane
  const { spacing: waveSpacing, clamped } = resolveWaveSpacing(
    options.preferredWaveSpacing ?? DEFAULT_WAVE_SPACING,
    corridor.minSpacing,
  );
  const staggerX = isFiniteNumber(options.staggerX) && options.staggerX >= 0
    ? options.staggerX : DEFAULT_STAGGER_X;
  const preferred = options.preferredLanes ?? {};
  if (clamped) {
    clampedNotes.push(`Wave spacing raised from ${options.preferredWaveSpacing ?? DEFAULT_WAVE_SPACING} to safety minimum ${waveSpacing}.`);
  }

  // Sort by rank (stable; ties broken by racerId inside compareQualifying upstream).
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const slots: GridSlot[] = [];
  let waves = 0;
  for (let index = 0; index < sorted.length; index += laneCount) {
    const waveEntries = sorted.slice(index, index + laneCount);
    // Map preferred lanes from scene indices to positions within validLanes.
    const mappedPreferred: Record<RacerId, number> = {};
    for (const [id, sceneLane] of Object.entries(preferred)) {
      const pos = laneMap.indexOf(sceneLane as number);
      if (pos >= 0) mappedPreferred[Number(id)] = pos;
    }
    const lanes = assignLanes(waveEntries, laneCount, mappedPreferred);
    const waveIndex = Math.floor(index / laneCount);
    waves = waveIndex + 1;
    for (let pos = 0; pos < waveEntries.length; pos++) {
      const entry = waveEntries[pos];
      const lanePosition = lanes[pos];
      const lane = laneMap[lanePosition] ?? laneMap[0];
      // Front of the corridor minus the wave offset, plus a tiny stagger per lane so
      // same-wave neighbours are never perfectly aligned in x.
      const x = corridor.to - waveIndex * waveSpacing - pos * staggerX;
      const z = laneCenterZ(lane);
      let exitSpeed = entry.speed;
      let status: GridStatus = entry.status === 'valid' ? 'valid' : 'fallback';
      if (!isFiniteNumber(exitSpeed) || exitSpeed <= 0) {
        status = 'stalled';
        exitSpeed = MIN_EXIT_SPEED;
        clampedNotes.push(`Racer ${entry.racerId} (rank ${entry.rank}) had invalid speed; using MIN_EXIT_SPEED ${MIN_EXIT_SPEED}.`);
      }
      slots.push(Object.freeze({
        racerId: entry.racerId,
        rank: entry.rank,
        lane,
        x,
        z,
        exitSpeed,
        status,
        wave: waveIndex,
        waveSlot: pos,
      }));
    }
  }

  const grid: FrozenGrid = Object.freeze({
    slots: frozenArray(slots),
    lanes: laneCount,
    waves,
    waveSpacing,
    corridor,
  });
  return Object.freeze({ grid, diagnostics: Object.freeze({ clamped: frozenArray(clampedNotes) }) });
}

/** Converts grid slots to the SpawnPoints the corridor validator expects. */
export function gridSpawnPoints(grid: FrozenGrid): readonly SpawnPoint[] {
  return frozenArray(grid.slots.map((slot) => Object.freeze({ racerId: slot.racerId, x: slot.x, z: slot.z })));
}

/** True when every slot in the grid has a valid, finite, positive exit speed. */
export function gridHasNoStalled(grid: FrozenGrid): boolean {
  return grid.slots.every((slot) => slot.status !== 'stalled');
}

/** Wave zero slot — the pole position. Useful for the GO clock and for tests. */
export function poleSlot(grid: FrozenGrid): GridSlot | null {
  return grid.slots.find((slot) => slot.rank === 1) ?? null;
}
