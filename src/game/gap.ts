/**
 * H9 — the gap to the rider ahead, as the cockpit chip shows it ("+0.8 s to P36"). Pure.
 */
import type { GapAhead } from './types';

/** Below this the player is practically stopped: the gap is measured at this speed instead. */
export const GAP_MIN_SPEED = 60;
/** A gap that moves less than this per second is "steady". */
export const GAP_TREND_DEADBAND = 0.05;

/**
 * Seconds to the rider ahead: the distance between them at the player's speed (engine x units per
 * second), or, when the rider ahead has finished, how long ago they did.
 */
export function gapSeconds(aheadX: number, playerX: number, playerVx: number, aheadFinishTime: number | null, runTime: number): number {
  if (aheadFinishTime !== null) return Math.max(0, runTime - aheadFinishTime);
  return Math.max(0, aheadX - playerX) / Math.max(GAP_MIN_SPEED, playerVx);
}

/** Closing, steady or falling back, from how the gap changed since the last reading. */
export function gapTrend(previous: GapAhead | null | undefined, place: number, seconds: number, dt: number): GapAhead['trend'] {
  if (!previous || previous.place !== place || !(dt > 0)) return 'steady';
  const rate = (seconds - previous.seconds) / dt;
  return rate < -GAP_TREND_DEADBAND ? 'closing' : rate > GAP_TREND_DEADBAND ? 'falling' : 'steady';
}

/** The chip's text: "+0.8 s to P36". */
export function gapLabel(gap: Pick<GapAhead, 'place' | 'seconds'>): string {
  return `+${gap.seconds < 10 ? gap.seconds.toFixed(1) : Math.round(gap.seconds)} s to P${gap.place}`;
}
