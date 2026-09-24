/**
 * M01 · T1b — the player's split, and the wait for it.
 *
 * The run from the grid to the sorting loop is the first split of the course, and it belongs to the
 * player: the clock starts at the shove and stops when they cross the gate plane, which is the
 * moment the pool takes the run over. Two small pure helpers keep the overlay honest about that:
 *
 *  - `poolIsWaiting` — true while the player has not queued, which is exactly when the ready-up
 *    panel must stay out of the way;
 *  - `formatSplit` — the split clock as a driver reads it, `m:ss.hh`.
 *
 * No DOM, no timers, nothing to mock.
 */
import type { MergeEntryView, MergeSnapshot } from '../types';

/**
 * True while the pool exists but the player is still on their way down the hill.
 *
 * The overlay uses this to show the split board instead of the ready-up panel: a rider who has not
 * reached the loop yet has no place in the queue to publish, no READY to offer, and no business
 * being told the field is waiting on them. It is derived from the entries rather than carried on
 * the snapshot because the entries are already the truth.
 */
export function poolIsWaiting(entries: readonly MergeEntryView[]): boolean {
  return !entries.some((entry) => entry.isPlayer);
}

/** The same question asked of a whole snapshot, for the callers that only have one. */
export function poolSnapshotIsWaiting(merge: MergeSnapshot | undefined): boolean {
  return merge !== undefined && poolIsWaiting(merge.entries);
}

/**
 * A split time as `m:ss.hh` (`1:03.42`), or `h:mm:ss.hh` past the hour.
 *
 * Ticks are 1/120 s and the pool's own ordering key is a sub-tick fraction, so hundredths are the
 * finest place a driver can read anyway. NaN and negatives clamp to zero rather than printing a
 * negative split: this is a display of the run clock, and the run clock cannot go backwards.
 */
export function formatSplit(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const hundredths = Math.round(safe * 100);
  const minutes = Math.floor(hundredths / 6000);
  const secs = Math.floor(hundredths / 100) % 60;
  const rest = hundredths % 100;
  const pad = (value: number) => String(value).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(secs)}.${pad(rest)}`
    : `${minutes}:${pad(secs)}.${pad(rest)}`;
}
