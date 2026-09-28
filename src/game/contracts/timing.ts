/**
 * T01 — tick timing contract.
 *
 * The simulation is a fixed 120 Hz stepped system: identical inputs and an identical
 * frame-delta sequence must produce an identical tick count, on every machine. The engine
 * keeps its own accumulator for now; `FIXED_STEP` is the single source of truth so the
 * engine's `STEP` and every future headless stepper cannot drift apart.
 */

import { ContractError, clamp } from './core';

export const TICK_RATE = 120;
export const FIXED_STEP = 1 / TICK_RATE;
/** Largest frame delta consumed in one frame; longer stalls are dropped, not caught up. */
export const MAX_FRAME_DELTA = 0.25;
/** Hard ceiling on ticks per frame so a slow frame cannot spiral into a death loop. */
export const MAX_TICKS_PER_FRAME = 30;

/** Float-tolerant tick count: 0.05 s must be exactly 6 ticks, not 5. */
export function ticksForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds / FIXED_STEP);
}

export interface AdvanceResult {
  /** Ticks the caller must step this frame. */
  readonly ticks: number;
  /** Seconds of simulated time those ticks represent. */
  readonly simulated: number;
  /** Frame time discarded because it exceeded `MAX_FRAME_DELTA` or the tick ceiling. */
  readonly droppedSeconds: number;
  /** Left-over accumulator after stepping, always in `[0, FIXED_STEP)`. */
  readonly remainder: number;
}

/**
 * Pure fixed-step accumulator. `advance` is the only mutating call and it is
 * deterministic: the same sequence of deltas always yields the same tick counts.
 */
export class FixedStepClock {
  private accumulator = 0;
  private tickCount = 0;

  constructor(
    private readonly rate: number = TICK_RATE,
    private readonly maxFrameDelta: number = MAX_FRAME_DELTA,
    private readonly maxTicksPerFrame: number = MAX_TICKS_PER_FRAME,
  ) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ContractError('E_TICK', `Tick rate ${String(rate)} must be a positive number.`, { rate });
    }
    if (!Number.isInteger(maxTicksPerFrame) || maxTicksPerFrame <= 0) {
      throw new ContractError('E_TICK', `maxTicksPerFrame ${String(maxTicksPerFrame)} must be a positive integer.`);
    }
  }

  get step(): number { return 1 / this.rate; }
  get elapsedTicks(): number { return this.tickCount; }
  get pending(): number { return this.accumulator; }

  advance(deltaSeconds: number): AdvanceResult {
    const requested = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const capped = clamp(requested, 0, this.maxFrameDelta);
    let droppedSeconds = requested - capped;

    this.accumulator += capped;
    const step = this.step;
    let ticks = Math.floor(this.accumulator / step + 1e-9);
    if (ticks > this.maxTicksPerFrame) {
      droppedSeconds += (ticks - this.maxTicksPerFrame) * step;
      ticks = this.maxTicksPerFrame;
    }
    this.accumulator = Math.max(0, this.accumulator - ticks * step);
    if (this.accumulator >= step - 1e-9) {
      // Guard the float dust case: never leave a full step unspent.
      this.accumulator = 0;
      ticks += 1;
    }
    this.tickCount += ticks;
    return Object.freeze({
      ticks, simulated: ticks * step, droppedSeconds: Math.max(0, droppedSeconds), remainder: this.accumulator,
    });
  }

  reset(): void {
    this.accumulator = 0;
    this.tickCount = 0;
  }

  /** Tick index a timestamp falls on; the inverse of `tick * FIXED_STEP`. */
  tickAt(seconds: number): number {
    return ticksForSeconds(seconds);
  }

  /** Timestamp of a tick index. */
  timeAt(tick: number): number {
    return tick * this.step;
  }
}
