import type { RaceResult } from './types.js';

export interface TableRow {
  id: string;
  points: number;
  wins: number;
  best: number; /* best finishing position, 0 if none */
}

export interface Championship {
  readonly raceIds: readonly string[];
  readonly index: number; /* next race to run, == raceIds.length when over */
  readonly finished: boolean;
  readonly winner: string | null;
  current(): { index: number; raceId: string } | null;
  record(results: readonly RaceResult[]): void;
  table(): TableRow[];
  history(): readonly (readonly RaceResult[])[];
  snapshot(): string;
}

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

function pointsFor(position: number, dnf: boolean | undefined): number {
  if (dnf === true) return 0;
  if (!Number.isInteger(position)) return 0;
  if (position < 1 || position > 10) return 0;
  const v = (POINTS as readonly number[])[position - 1];
  return typeof v === 'number' ? v : 0;
}

interface InternalSnapshot {
  v: number;
  raceIds: string[];
  racers: string[];
  history: RaceResult[][];
}

function validateRaceResultArray(arr: unknown): arr is RaceResult[] {
  if (!Array.isArray(arr)) return false;
  for (const r of arr) {
    if (typeof r !== 'object' || r === null) return false;
    const rec = r as Record<string, unknown>;
    if (typeof rec['id'] !== 'string') return false;
    if (typeof rec['position'] !== 'number' || !Number.isFinite(rec['position'])) return false;
    if ('dnf' in rec && typeof rec['dnf'] !== 'boolean' && typeof rec['dnf'] !== 'undefined') return false;
    if ('timeMs' in rec && rec['timeMs'] !== undefined && (typeof rec['timeMs'] !== 'number' || !Number.isFinite(rec['timeMs'] as number))) return false;
  }
  return true;
}

export function createChampionship(cfg: { raceIds: readonly string[]; racers: readonly string[] }): Championship {
  const raceIds: string[] = [...cfg.raceIds];
  const racers: string[] = [...cfg.racers];
  const racerSet = new Set<string>(racers);
  const hist: RaceResult[][] = [];

  function computeTable(): TableRow[] {
    const rows: TableRow[] = racers.map((id) => ({ id, points: 0, wins: 0, best: 0 }));
    const byId = new Map<string, TableRow>();
    for (const r of rows) byId.set(r.id, r);
    for (const race of hist) {
      // last-wins map for duplicates
      const map = new Map<string, RaceResult>();
      for (const res of race) {
        map.set(res.id, res);
      }
      for (const [id, res] of map) {
        const row = byId.get(id);
        if (!row) continue;
        const isDnf = res.dnf === true;
        row.points += pointsFor(res.position, res.dnf);
        if (!isDnf && res.position === 1) row.wins += 1;
        if (!isDnf && Number.isInteger(res.position) && res.position >= 1) {
          if (row.best === 0 || res.position < row.best) row.best = res.position;
        }
      }
    }
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const ab = a.best === 0 ? Number.POSITIVE_INFINITY : a.best;
      const bb = b.best === 0 ? Number.POSITIVE_INFINITY : b.best;
      if (ab !== bb) return ab - bb;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    return rows;
  }

  const champ: Championship = {
    get raceIds(): readonly string[] {
      return [...raceIds];
    },
    get index(): number {
      return hist.length;
    },
    get finished(): boolean {
      return hist.length >= raceIds.length;
    },
    get winner(): string | null {
      if (hist.length < raceIds.length) return null;
      const t = computeTable();
      const first = t[0];
      if (!first) return null;
      return first.id;
    },
    current(): { index: number; raceId: string } | null {
      if (hist.length >= raceIds.length) return null;
      const rid = raceIds[hist.length]!;
      return { index: hist.length, raceId: rid };
    },
    record(results: readonly RaceResult[]): void {
      if (hist.length >= raceIds.length) {
        throw new Error('championship is over: cannot record more results');
      }
      for (const r of results) {
        if (!racerSet.has(r.id)) {
          throw new Error(`unknown racer id: ${r.id}`);
        }
      }
      // store a defensive copy
      const copy: RaceResult[] = results.map((r) => {
        const out: RaceResult = { id: r.id, position: r.position };
        if (r.dnf !== undefined) out.dnf = r.dnf;
        if (r.timeMs !== undefined) out.timeMs = r.timeMs;
        return out;
      });
      hist.push(copy);
    },
    table(): TableRow[] {
      return computeTable();
    },
    history(): readonly (readonly RaceResult[])[] {
      return hist.map((h) => h.map((r) => ({ ...r })));
    },
    snapshot(): string {
      const snap: InternalSnapshot = {
        v: 1,
        raceIds: [...raceIds],
        racers: [...racers],
        history: hist.map((h) => h.map((r) => ({ ...r }))),
      };
      return JSON.stringify(snap);
    },
  };

  return champ;
}

export function restoreChampionship(json: string): Championship {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('restore: invalid JSON for championship snapshot');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('restore: invalid championship snapshot shape');
  }
  const obj = parsed as Partial<InternalSnapshot>;
  if (
    obj.v !== 1 ||
    !Array.isArray(obj.raceIds) ||
    !obj.raceIds.every((x) => typeof x === 'string') ||
    !Array.isArray(obj.racers) ||
    !obj.racers.every((x) => typeof x === 'string') ||
    !Array.isArray(obj.history)
  ) {
    throw new Error('restore: invalid championship snapshot shape');
  }
  for (const h of obj.history) {
    if (!validateRaceResultArray(h)) {
      throw new Error('restore: invalid championship snapshot shape (bad history entry)');
    }
  }
  if (obj.history.length > obj.raceIds.length) {
    throw new Error('restore: invalid championship snapshot shape (history longer than raceIds)');
  }
  // validate no unknown ids in history
  const racerSet = new Set<string>(obj.raceIds.length >= 0 ? (obj.racers as string[]) : []);
  for (const h of obj.history as RaceResult[][]) {
    for (const r of h) {
      if (!racerSet.has(r.id)) {
        throw new Error(`restore: invalid championship snapshot shape (unknown racer id: ${r.id})`);
      }
    }
  }

  const c = createChampionship({ raceIds: obj.raceIds as string[], racers: obj.racers as string[] });
  for (const h of obj.history as RaceResult[][]) {
    c.record(h);
  }
  return c;
}
