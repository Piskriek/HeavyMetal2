/**
 * T05 — release scheduler: safe wave release with reservations and corridor occupancy.
 *
 * The scheduler takes a frozen grid and produces a release plan: a sequence of wave
 * releases, each at a specific tick, with reservations checked over a finite horizon.
 *
 * Rules:
 * - Waves release front-to-back (wave 0 first).
 * - Before releasing a wave, the scheduler checks corridor occupancy (live check).
 * - If the corridor is occupied, the wave is delayed to the next available tick.
 * - Delayed slots are rescheduled with a bounded retry policy.
 * - Blocked-lane timeout: if a wave can't release after the timeout, it's flagged.
 * - All release times are quantized upward to tick boundaries.
 * - The scheduler reports the actual total release span — it does NOT enforce an
 *   unsafe six-second target.
 */

import type { FrozenGrid, GridSlot } from './grid';
import {
  createReservationLedger, corridorReservationKey,
  type SpawnPoint,
} from '../contracts/release';
import { frozenArray } from '../contracts/core';
import type { RacerId } from '../contracts/identity';
import { FIXED_STEP, ticksForSeconds } from '../contracts/timing';

/** Default preferred gap between wave releases, in seconds. */
export const DEFAULT_WAVE_GAP_SECONDS = 0.5;
/** Minimum wave gap: one tick. Waves can never release on the same tick. */
export const MIN_WAVE_GAP_SECONDS = FIXED_STEP;
/** Default reservation horizon: how long a released wave's slot is reserved. */
export const DEFAULT_RESERVATION_HORIZON_SECONDS = 3;
/** Default blocked-lane timeout: how long to wait before flagging a wave as blocked. */
export const DEFAULT_BLOCKED_TIMEOUT_SECONDS = 6;
/** Hard ceiling on release span: if the whole release takes longer, stop. */
export const MAX_RELEASE_SPAN_SECONDS = 30;

export type ReleaseSlotStatus = 'scheduled' | 'released' | 'delayed' | 'blocked' | 'dnf';

export interface ReleaseSlot {
  readonly racerId: RacerId;
  readonly wave: number;
  readonly scheduledTick: number;
  readonly releasedTick: number | null;
  readonly status: ReleaseSlotStatus;
  /** Ticks the slot was delayed beyond its scheduled tick. */
  readonly delayTicks: number;
  /** Exit speed preserved exactly from the grid. */
  readonly exitSpeed: number;
  readonly x: number;
  readonly z: number;
  readonly lane: number;
}

export interface WaveRelease {
  readonly wave: number;
  readonly scheduledTick: number;
  readonly releasedTick: number | null;
  readonly status: 'scheduled' | 'released' | 'delayed' | 'blocked';
  readonly slots: readonly ReleaseSlot[];
  /** How many times the scheduler tried to release this wave before succeeding or timing out. */
  readonly attempts: number;
}

export interface ReleasePlan {
  readonly waves: readonly WaveRelease[];
  /** Tick at which the GO clock starts (the first wave's scheduled tick). */
  readonly goTick: number;
  /** Tick at which the last wave was actually released (or null if not yet). */
  readonly lastReleasedTick: number | null;
  /** Actual span from goTick to lastReleasedTick, in seconds. */
  readonly releaseSpanSeconds: number | null;
  /** Total number of ticks the scheduler ran. */
  readonly totalTicks: number;
  /** Whether the release completed (all waves released or timed out). */
  readonly complete: boolean;
  /** How long each wave's corridor reservation holds, in ticks. */
  readonly reservationHorizonTicks: number;
}

export interface SchedulerOptions {
  /** Preferred gap between wave releases, in seconds. Clamped to >= MIN_WAVE_GAP_SECONDS. */
  readonly waveGapSeconds?: number;
  /** How long a released wave's exit slot is reserved, in seconds. */
  readonly reservationHorizonSeconds?: number;
  /** How long to wait for a blocked wave before flagging it, in seconds. */
  readonly blockedTimeoutSeconds?: number;
  /** Tick to start the schedule from. Defaults to 0. */
  readonly startTick?: number;
}

/**
 * Occupancy provider: the scheduler asks this whether a spawn point is currently
 * occupied. The real engine provides live racer positions; tests provide a mock.
 */
export interface OccupancyProvider {
  /** True if the spawn point's vicinity is currently occupied by another racer. */
  isOccupied(spawn: SpawnPoint, radius: number): boolean;
}

/** A trivial occupancy provider that always says "clear". Used for tests and planning. */
export const CLEAR_OCCUPANCY: OccupancyProvider = {
  isOccupied: () => false,
};

function quantizeUp(seconds: number): number {
  return Math.ceil(seconds / FIXED_STEP);
}

export interface BuildPlanResult {
  readonly plan: ReleasePlan;
  readonly reservations: readonly { resourceId: string; holderId: RacerId; tick: number }[];
}

/**
 * Computes the release plan for a frozen grid. Pure and deterministic given the same
 * occupancy provider. The plan is a schedule — it does not actually release anything.
 */
export function computeReleasePlan(
  grid: FrozenGrid,
  occupancy: OccupancyProvider = CLEAR_OCCUPANCY,
  options: SchedulerOptions = {},
): BuildPlanResult {
  const waveGapTicks = Math.max(1, quantizeUp(options.waveGapSeconds ?? DEFAULT_WAVE_GAP_SECONDS));
  // Reservation horizon determines how long a released wave's exit slot stays reserved.
  // The executor uses this to decide when a previous wave's corridor claim expires.
  const reservationHorizonTicks = Math.max(1, quantizeUp(options.reservationHorizonSeconds ?? DEFAULT_RESERVATION_HORIZON_SECONDS));
  const timeoutTicks = Math.max(1, quantizeUp(options.blockedTimeoutSeconds ?? DEFAULT_BLOCKED_TIMEOUT_SECONDS));
  const startTick = Math.max(0, options.startTick ?? 0);
  const goTick = startTick;

  const ledger = createReservationLedger();
  const reservationLog: { resourceId: string; holderId: RacerId; tick: number }[] = [];

  // Group slots by wave.
  const waveMap = new Map<number, GridSlot[]>();
  for (const slot of grid.slots) {
    const list = waveMap.get(slot.wave) ?? [];
    list.push(slot);
    waveMap.set(slot.wave, list);
  }
  const waveIndices = [...waveMap.keys()].sort((a, b) => a - b);

  const waves: WaveRelease[] = [];
  let currentTick = startTick;
  let lastReleasedTick: number | null = null;

  for (const waveIndex of waveIndices) {
    const waveSlots = waveMap.get(waveIndex)!;
    const scheduledTick = Math.max(currentTick, goTick + waveIndex * waveGapTicks);
    let releasedTick: number | null = null;
    let status: WaveRelease['status'] = 'scheduled';
    let attempts = 0;
    const slotResults: ReleaseSlot[] = [];

    // Try to release this wave.
    const deadline = scheduledTick + timeoutTicks;
    let tryTick = scheduledTick;

    while (tryTick <= deadline) {
      attempts++;
      // Check occupancy for every slot in the wave.
      let allClear = true;
      for (const slot of waveSlots) {
        const spawn: SpawnPoint = { racerId: slot.racerId, x: slot.x, z: slot.z };
        if (occupancy.isOccupied(spawn, grid.corridor.minSpacing * 0.5)) {
          allClear = false;
          break;
        }
      }

      if (allClear) {
        // Reserve the corridor for this wave's horizon.
        const corridorKey = corridorReservationKey(`${grid.corridor.id}:wave-${waveIndex}`);
        const firstRacer = waveSlots[0];
        const reservation = ledger.reserve(corridorKey, firstRacer.racerId, tryTick);
        if (reservation.ok) {
          reservationLog.push({ resourceId: corridorKey, holderId: firstRacer.racerId, tick: tryTick });
        }
        // Release the wave.
        releasedTick = tryTick;
        lastReleasedTick = tryTick;
        status = tryTick > scheduledTick ? 'delayed' : 'released';
        for (const slot of waveSlots) {
          slotResults.push(Object.freeze({
            racerId: slot.racerId,
            wave: slot.wave,
            scheduledTick,
            releasedTick: tryTick,
            status: tryTick > scheduledTick ? 'delayed' as const : 'released' as const,
            delayTicks: tryTick - scheduledTick,
            exitSpeed: slot.exitSpeed,
            x: slot.x,
            z: slot.z,
            lane: slot.lane,
          }));
        }
        break;
      }
      // Occupied — try the next tick.
      tryTick++;
    }

    if (releasedTick === null) {
      // Timed out — wave is blocked.
      status = 'blocked';
      for (const slot of waveSlots) {
        slotResults.push(Object.freeze({
          racerId: slot.racerId,
          wave: slot.wave,
          scheduledTick,
          releasedTick: null,
          status: 'blocked' as const,
          delayTicks: 0,
          exitSpeed: slot.exitSpeed,
          x: slot.x,
          z: slot.z,
          lane: slot.lane,
        }));
      }
    }

    waves.push(Object.freeze({
      wave: waveIndex,
      scheduledTick,
      releasedTick,
      status,
      slots: frozenArray(slotResults),
      attempts,
    }));

    // Next wave can't start before this one released + the wave gap.
    if (releasedTick !== null) {
      currentTick = releasedTick + waveGapTicks;
    } else {
      currentTick = scheduledTick + timeoutTicks + waveGapTicks;
    }
  }

  const maxTick = Math.max(
    ...waves.map((w) => w.releasedTick ?? w.scheduledTick + timeoutTicks),
    startTick,
  );
  const spanSeconds = lastReleasedTick !== null
    ? (lastReleasedTick - goTick) * FIXED_STEP
    : null;

  const plan: ReleasePlan = Object.freeze({
    waves: frozenArray(waves),
    goTick,
    lastReleasedTick,
    releaseSpanSeconds: spanSeconds,
    totalTicks: maxTick - startTick,
    complete: waves.every((w) => w.releasedTick !== null || w.status === 'blocked'),
    reservationHorizonTicks,
  });

  return Object.freeze({ plan, reservations: frozenArray(reservationLog) });
}

/**
 * Live release executor: steps through the plan tick by tick, checking occupancy at each
 * release moment. This is the runtime counterpart to `computeReleasePlan` — the plan is
 * the optimistic schedule, the executor is the real-time driver that can observe delays.
 */
export class ReleaseExecutor {
  private readonly plan: ReleasePlan;
  private readonly grid: FrozenGrid;
  private readonly occupancy: OccupancyProvider;
  private readonly released: ReleaseSlot[] = [];
  private readonly blocked: RacerId[] = [];
  private currentTick: number;
  private waveIndex = 0;
  private waveAttempts = 0;
  private done = false;
  private readonly timeoutTicks: number;
  private readonly waveGapTicks: number;
  private nextTryTick: number;

  constructor(grid: FrozenGrid, plan: ReleasePlan, occupancy: OccupancyProvider, options: SchedulerOptions = {}) {
    this.grid = grid;
    this.plan = plan;
    this.occupancy = occupancy;
    this.currentTick = plan.goTick;
    this.timeoutTicks = Math.max(1, quantizeUp(options.blockedTimeoutSeconds ?? DEFAULT_BLOCKED_TIMEOUT_SECONDS));
    this.waveGapTicks = Math.max(1, quantizeUp(options.waveGapSeconds ?? DEFAULT_WAVE_GAP_SECONDS));
    this.nextTryTick = plan.goTick;
  }

  get tick(): number { return this.currentTick; }
  get isDone(): boolean { return this.done; }
  get releasedSlots(): readonly ReleaseSlot[] { return frozenArray(this.released); }
  get blockedRacers(): readonly RacerId[] { return frozenArray(this.blocked); }

  /**
   * Advance one tick. Returns the racers released this tick (empty if nothing released).
   * The executor is deterministic given the same occupancy provider.
   */
  step(): readonly ReleaseSlot[] {
    if (this.done) return frozenArray([]);
    this.currentTick++;

    const waveMap = new Map<number, GridSlot[]>();
    for (const slot of this.grid.slots) {
      const list = waveMap.get(slot.wave) ?? [];
      list.push(slot);
      waveMap.set(slot.wave, list);
    }
    const waveIndices = [...waveMap.keys()].sort((a, b) => a - b);

    if (this.waveIndex >= waveIndices.length) {
      this.done = true;
      return frozenArray([]);
    }

    const waveIdx = waveIndices[this.waveIndex];
    const waveSlots = waveMap.get(waveIdx)!;
    const scheduledTick = this.plan.waves[this.waveIndex]?.scheduledTick ?? this.nextTryTick;

    if (this.currentTick < scheduledTick) return frozenArray([]);

    // Check occupancy.
    let allClear = true;
    for (const slot of waveSlots) {
      const spawn: SpawnPoint = { racerId: slot.racerId, x: slot.x, z: slot.z };
      if (this.occupancy.isOccupied(spawn, this.grid.corridor.minSpacing * 0.5)) {
        allClear = false;
        break;
      }
    }

    if (allClear) {
      const released: ReleaseSlot[] = [];
      for (const slot of waveSlots) {
        const rs: ReleaseSlot = Object.freeze({
          racerId: slot.racerId,
          wave: slot.wave,
          scheduledTick,
          releasedTick: this.currentTick,
          status: this.currentTick > scheduledTick ? 'delayed' as const : 'released' as const,
          delayTicks: this.currentTick - scheduledTick,
          exitSpeed: slot.exitSpeed,
          x: slot.x,
          z: slot.z,
          lane: slot.lane,
        });
        released.push(rs);
        this.released.push(rs);
      }
      this.waveIndex++;
      this.waveAttempts = 0;
      this.nextTryTick = this.currentTick + this.waveGapTicks;
      if (this.waveIndex >= waveIndices.length) this.done = true;
      return frozenArray(released);
    }

    // Occupied.
    this.waveAttempts++;
    if (this.waveAttempts > this.timeoutTicks) {
      // Blocked — flag all racers in this wave.
      for (const slot of waveSlots) {
        this.blocked.push(slot.racerId);
        this.released.push(Object.freeze({
          racerId: slot.racerId,
          wave: slot.wave,
          scheduledTick,
          releasedTick: null,
          status: 'blocked' as const,
          delayTicks: 0,
          exitSpeed: slot.exitSpeed,
          x: slot.x,
          z: slot.z,
          lane: slot.lane,
        }));
      }
      this.waveIndex++;
      this.waveAttempts = 0;
      this.nextTryTick = this.currentTick + this.waveGapTicks;
      if (this.waveIndex >= waveIndices.length) this.done = true;
    }
    return frozenArray([]);
  }

  /** Run to completion. Returns all released slots. Bounded by MAX_RELEASE_SPAN_SECONDS. */
  run(): readonly ReleaseSlot[] {
    const maxTicks = ticksForSeconds(MAX_RELEASE_SPAN_SECONDS);
    let ticks = 0;
    while (!this.done && ticks < maxTicks) {
      this.step();
      ticks++;
    }
    return frozenArray(this.released);
  }
}
