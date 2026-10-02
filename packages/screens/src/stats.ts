import { STAT_BUDGET, type RacerCard } from './types';

type Stats = Pick<RacerCard, 'weight' | 'speed' | 'bounce'>;
export type StatKey = 'weight' | 'speed' | 'bounce';

export function statBars(c: Stats): { label: string; value: number; fraction: number }[] {
  return [
    { label: 'Weight', value: c.weight, fraction: c.weight / 10 },
    { label: 'Speed', value: c.speed, fraction: c.speed / 10 },
    { label: 'Bounce', value: c.bounce, fraction: c.bounce / 10 },
  ];
}

/** Points still free to spend. Negative when a card is over budget. */
export function budgetLeft(c: Stats): number {
  return STAT_BUDGET - (c.weight + c.speed + c.bounce);
}

/** Change one stat by `delta`, clamped to 1..10. Spending more than the budget allows is refused (the card comes back unchanged). */
export function adjustStat<T extends Stats>(c: T, key: StatKey, delta: number): T {
  const next = Math.min(10, Math.max(1, Math.round(c[key] + delta)));
  if (next === c[key]) return c;
  const candidate = { ...c, [key]: next };
  return next > c[key] && budgetLeft(candidate) < 0 ? c : candidate;
}

/** One friendly sentence about what this goblin is good at. */
export function tradeoffText(c: Stats): string {
  const max = Math.max(c.weight, c.speed, c.bounce), min = Math.min(c.weight, c.speed, c.bounce);
  if (max - min <= 1) return 'Balanced: no weak spot, no showy strength';
  if (c.weight === max) return 'Heavy and grippy, slower off the line';
  if (c.speed === max) return 'Quick and nimble, easy to shove around';
  return 'Springy: bounces off trouble, loses some grip';
}
