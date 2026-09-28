/**
 * T05 — common GO clock for finish order, timeout, and finish settling.
 *
 * The GO clock is the single reference for race timing. Every racer's finish time is
 * measured from the same GO tick, so finish order is unambiguous and timeouts are fair.
 *
 * The clock does NOT start when the first racer is released — it starts at the GO tick,
 * which is the scheduled release tick of the front wave. This means:
 * - A racer released later has less "race time" on the clock when they finish, but they
 *   also started further back on the grid, so the advantage balances out.
 * - Finish order is by absolute finish tick, not by per-racer elapsed time.
 * - Timeouts are absolute: goTick + timeoutTicks.
 *
 * The clock is pure data — no mutation, no side effects. The engine drives it by calling
 * `recordFinish` and `tick` as the race progresses.
 */

import { FIXED_STEP, ticksForSeconds } from '../contracts/timing';
import { frozenArray, isFiniteNumber } from '../contracts/core';
import type { RacerId } from '../contracts/identity';

export interface FinishRecord {
  readonly racerId: RacerId;
  /** Tick on the GO clock when the racer crossed the finish line. */
  readonly finishTick: number;
  /** Race time in seconds: (finishTick - goTick) * FIXED_STEP. */
  readonly raceTimeSeconds: number;
  /** 1-based position, deterministic (ties broken by racerId). */
  readonly position: number;
}

export interface GoClockState {
  readonly goTick: number;
  readonly timeoutTick: number;
  readonly currentTick: number;
  readonly finishes: readonly FinishRecord[];
  readonly settled: boolean;
  /** Racers that timed out without finishing. */
  readonly timedOut: readonly RacerId[];
}

export interface GoClockOptions {
  readonly goTick: number;
  /** Race timeout in seconds. Defaults to 300 (five minutes). */
  readonly timeoutSeconds?: number;
  /** Racer IDs expected to finish. Used to detect timeouts. */
  readonly participants?: readonly RacerId[];
}

export class GoClock {
  private readonly goTick: number;
  private readonly timeoutTick: number;
  private currentTick: number;
  private readonly finishes: FinishRecord[] = [];
  private readonly participants: ReadonlySet<RacerId>;
  private settled = false;

  constructor(options: GoClockOptions) {
    if (!Number.isInteger(options.goTick) || options.goTick < 0) {
      throw new Error(`GO tick ${options.goTick} must be a non-negative integer.`);
    }
    this.goTick = options.goTick;
    const timeoutSeconds = isFiniteNumber(options.timeoutSeconds) && options.timeoutSeconds > 0
      ? options.timeoutSeconds : 300;
    this.timeoutTick = options.goTick + ticksForSeconds(timeoutSeconds);
    this.currentTick = options.goTick;
    this.participants = new Set(options.participants ?? []);
  }

  get state(): GoClockState {
    return Object.freeze({
      goTick: this.goTick,
      timeoutTick: this.timeoutTick,
      currentTick: this.currentTick,
      finishes: frozenArray(this.finishes),
      settled: this.settled,
      timedOut: frozenArray(this.timedOutRacers()),
    });
  }

  /** Advance the clock by one tick. Returns racers that just timed out (if any). */
  tick(): readonly RacerId[] {
    if (this.settled) return frozenArray([]);
    this.currentTick++;
    if (this.currentTick >= this.timeoutTick) {
      this.settle();
      return frozenArray(this.timedOutRacers());
    }
    return frozenArray([]);
  }

  /**
   * Record a racer crossing the finish line. Returns the finish record, or null if the
   * racer already finished or the clock is settled.
   */
  recordFinish(racerId: RacerId, finishTick: number): FinishRecord | null {
    if (this.settled) return null;
    if (this.finishes.some((f) => f.racerId === racerId)) return null;
    if (!Number.isInteger(finishTick) || finishTick < this.goTick) return null;

    // Position: count how many finished before this racer, plus one.
    const position = this.finishes.length + 1;
    const raceTimeSeconds = (finishTick - this.goTick) * FIXED_STEP;
    const record: FinishRecord = Object.freeze({
      racerId,
      finishTick,
      raceTimeSeconds: Math.round(raceTimeSeconds * 1000) / 1000,
      position,
    });
    this.finishes.push(record);

    // Auto-settle if all participants have finished.
    if (this.participants.size > 0 && this.finishes.length >= this.participants.size) {
      this.settle();
    }
    return record;
  }

  /** Force-settle the clock. Any participant who hasn't finished is timed out. */
  settle(): void {
    if (this.settled) return;
    this.settled = true;
  }

  /** True if the clock has reached the timeout or all participants have finished. */
  get isSettled(): boolean { return this.settled; }

  /** Current race time in seconds (from GO to now). */
  get elapsedSeconds(): number {
    return Math.max(0, (this.currentTick - this.goTick) * FIXED_STEP);
  }

  /** Time remaining before timeout, in seconds. Zero if already timed out. */
  get remainingSeconds(): number {
    return Math.max(0, (this.timeoutTick - this.currentTick) * FIXED_STEP);
  }

  private timedOutRacers(): RacerId[] {
    const finished = new Set(this.finishes.map((f) => f.racerId));
    return [...this.participants].filter((id) => !finished.has(id)).sort((a, b) => a - b);
  }

  /** Finish records sorted by position (which is already finish order). */
  get results(): readonly FinishRecord[] {
    return frozenArray([...this.finishes].sort((a, b) => a.position - b.position));
  }

  /**
   * Race time for a specific racer. Returns null if they haven't finished.
   * Useful for the HUD: "Racer 3: 42.3s".
   */
  raceTime(racerId: RacerId): number | null {
    const record = this.finishes.find((f) => f.racerId === racerId);
    return record ? record.raceTimeSeconds : null;
  }
}

/**
 * Computes finish order from a set of finish ticks. Pure function, no clock state needed.
 * Useful when you have all the data and just need to sort.
 */
export function computeFinishOrder(
  finishes: ReadonlyMap<RacerId, number>,
  goTick: number,
): readonly FinishRecord[] {
  const sorted = [...finishes.entries()]
    .filter(([, tick]) => Number.isInteger(tick) && tick >= goTick)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return frozenArray(sorted.map(([racerId, finishTick], index) => Object.freeze({
    racerId,
    finishTick,
    raceTimeSeconds: Math.round((finishTick - goTick) * FIXED_STEP * 1000) / 1000,
    position: index + 1,
  })));
}
