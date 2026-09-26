/**
 * P11 — reading a race from the split to the flag: how many places each rider gained or lost after
 * the first split, and who climbed the most. Pure.
 */
import type { RacerStanding } from './types';

/** Places gained after the split (positive = climbed), or null without a split place or a finish. */
export function placesGained(standing: Pick<RacerStanding, 'position' | 'finished' | 'splitPosition'>): number | null {
  if (standing.splitPosition === undefined || !standing.finished) return null;
  return standing.splitPosition - standing.position;
}

/** The finisher who gained the most places after the split, or null when nobody gained any. */
export function biggestClimber(standings: readonly RacerStanding[]): { standing: RacerStanding; gained: number } | null {
  let best: { standing: RacerStanding; gained: number } | null = null;
  for (const standing of standings) {
    const gained = placesGained(standing);
    if (gained === null || gained <= 0) continue;
    if (!best || gained > best.gained || (gained === best.gained && standing.position < best.standing.position)) best = { standing, gained };
  }
  return best;
}

/** "P14 ▲11", "P3 ▼2", "P7 =" — the split column's text. */
export function splitLabel(standing: Pick<RacerStanding, 'position' | 'finished' | 'splitPosition'>): string {
  if (standing.splitPosition === undefined) return '—';
  const gained = placesGained(standing);
  if (gained === null) return `P${standing.splitPosition}`;
  return `P${standing.splitPosition} ${gained > 0 ? `▲${gained}` : gained < 0 ? `▼${-gained}` : '='}`;
}
