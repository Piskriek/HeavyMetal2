export const CHAMPIONSHIP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export function pointsFor(position: number): number {
  if (!Number.isInteger(position) || position < 1 || position > CHAMPIONSHIP_POINTS.length) return 0;
  return CHAMPIONSHIP_POINTS[position - 1] ?? 0;
}

export interface RaceResult {
  id: string;
  position: number;
  dnf?: boolean;
}

export function scoreRace(results: readonly RaceResult[]): Record<string, number> {
  const scores = new Map<string, number>();
  for (const result of results) {
    scores.set(result.id, result.dnf ? 0 : pointsFor(result.position));
  }
  return Object.fromEntries(scores);
}

export function addPoints(
  table: Readonly<Record<string, number>>,
  race: readonly RaceResult[],
): Record<string, number> {
  const totals = new Map<string, number>(Object.entries(table));
  for (const [id, score] of Object.entries(scoreRace(race))) {
    totals.set(id, (totals.get(id) ?? 0) + score);
  }
  return Object.fromEntries(totals);
}

export interface TableRow {
  id: string;
  points: number;
  wins: number;
}

function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function rankTable(
  table: Readonly<Record<string, number>>,
  history: readonly (readonly RaceResult[])[],
): TableRow[] {
  const wins = new Map<string, number>();
  for (const race of history) {
    for (const result of race) {
      if (result.position === 1 && !result.dnf) {
        wins.set(result.id, (wins.get(result.id) ?? 0) + 1);
      }
    }
  }

  return Object.entries(table)
    .map(([id, points]) => ({ id, points, wins: wins.get(id) ?? 0 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || compareIds(a.id, b.id));
}