/**
 * ISLAND BUDGETS (RELEASE_PLAN Milestone 0.5, critique Q8): how much an island may hold at each graphics tier, so a player cannot
 * build an island that sinks the minimum-spec laptop (i7-6700HQ, GTX 950M, Low) to 10 fps.
 *
 * The numbers are first guesses sized from the island's perf runs; Milestone 5 measures a full budget on Low and tunes them
 * (the target: a full island still holds 50+ fps on Low). Placing over budget is refused with a plain sentence; the meter shows
 * how full the fullest part is.
 */

export type Tier = 'potato' | 'low' | 'medium' | 'high' | 'ultra';
export type BudgetKind = 'things' | 'voxels' | 'lamps' | 'effects' | 'characters' | 'sounds' | 'imports';
export type Budget = Readonly<Record<BudgetKind, number>>;
export type BudgetCounts = Readonly<Partial<Record<BudgetKind, number>>>;

export const BUDGET_KINDS: readonly BudgetKind[] = ['things', 'voxels', 'lamps', 'effects', 'characters', 'sounds', 'imports'];

export const BUDGETS: Readonly<Record<Tier, Budget>> = {
  potato: { things: 150, voxels: 250_000, lamps: 40, effects: 10, characters: 6, sounds: 20, imports: 2 },
  low: { things: 300, voxels: 500_000, lamps: 100, effects: 20, characters: 12, sounds: 40, imports: 5 },
  medium: { things: 600, voxels: 1_500_000, lamps: 200, effects: 40, characters: 24, sounds: 80, imports: 10 },
  high: { things: 1200, voxels: 3_000_000, lamps: 400, effects: 80, characters: 48, sounds: 160, imports: 20 },
  ultra: { things: 2400, voxels: 6_000_000, lamps: 800, effects: 160, characters: 96, sounds: 320, imports: 40 },
};

/** What each kind is called in a sentence (one, many). */
const WORDS: Readonly<Record<BudgetKind, readonly [string, string]>> = {
  things: ['thing', 'things'], voxels: ['block', 'blocks'], lamps: ['lamp', 'lamps'], effects: ['effect', 'effects'],
  characters: ['character', 'characters'], sounds: ['placed sound', 'placed sounds'], imports: ['imported model', 'imported models'],
};
const TIER_NAME: Readonly<Record<Tier, string>> = { potato: 'Potato', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

/** May `adding` more of a kind go on? Null when it fits; otherwise the plain sentence to show. */
export function overBudget(tier: Tier, counts: BudgetCounts, kind: BudgetKind, adding = 1): string | null {
  const max = BUDGETS[tier][kind];
  const have = counts[kind] ?? 0;
  if (have + adding <= max) return null;
  const [, many] = WORDS[kind];
  return `This island is full of ${many} on ${TIER_NAME[tier]} graphics (${max.toLocaleString('en')} at most). Take some away first, or raise the graphics in Settings if your computer can take it.`;
}

/** How full the island is: the fullest kind and its share, 0..1 (more when a save from a higher tier is opened on a lower one). */
export function meter(tier: Tier, counts: BudgetCounts): { kind: BudgetKind; share: number; label: string } {
  let kind: BudgetKind = 'things', share = 0;
  for (const k of BUDGET_KINDS) {
    const s = (counts[k] ?? 0) / BUDGETS[tier][k];
    if (s > share) { share = s; kind = k; }
  }
  const [, many] = WORDS[kind];
  return { kind, share, label: `${Math.round(share * 100)}% full (${many})` };
}

/** Game Mode shows the meter only when the island is nearly full. */
export const NEARLY_FULL = 0.85;

/** The budget tier for a graphics quality ('auto' and unknown values count as Low, the minimum spec). */
export const tierOf = (quality: string): Tier => (quality === 'potato' || quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'ultra' ? quality : 'low');
