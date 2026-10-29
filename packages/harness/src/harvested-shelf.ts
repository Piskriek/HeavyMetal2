/**
 * Plan 58 Wave 3 (Track 1): Lazy-Indexed Harvested Preset Shelf (`@hm/harness`).
 *
 * Indexes the 2,606 transduced presets across the 8 installed games (`Dwarf Fortress`, `Kerbal Space Program`,
 * `Factorio`, `Hades`, `Plasma`, `Space Engineers`, `Satisfactory`, `Transport Fever 2`) by Rung (1..5),
 * Category, and Source Game.
 *
 * Zero Startup Memory Bloat:
 * - Compact tuple rows (`CompactHarvestTuple`) are stored statically and only materialized into full
 *   `HarvestedShelfEntry` objects for the active page/slice requested by The Studio or the In-Play Assembler.
 * - Category and game counts are pre-tallied in O(1) lookup tables.
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O).
 */
import { HARVESTED_COMPACT_TUPLES, HARVESTED_TOTAL_COUNTS, type CompactHarvestTuple } from './harvested-catalog-data.js';

export type HarvestedSourceGame =
  | 'Dwarf Fortress'
  | 'Kerbal Space Program'
  | 'Factorio'
  | 'Hades'
  | 'Plasma'
  | 'Space Engineers'
  | 'Satisfactory'
  | 'Transport Fever 2';

export type HarvestedCategory =
  | 'element'
  | 'thruster-propulsion'
  | 'reactor-power'
  | 'gyro-control'
  | 'structural-hull'
  | 'synthesis-recipe'
  | 'combat-cadence'
  | 'wiregraph-contraption'
  | 'logistics-envelope';

export const HARVESTED_CATEGORIES: readonly HarvestedCategory[] = [
  'element',
  'thruster-propulsion',
  'reactor-power',
  'gyro-control',
  'structural-hull',
  'synthesis-recipe',
  'combat-cadence',
  'wiregraph-contraption',
  'logistics-envelope',
];

export const HARVESTED_SOURCE_GAMES: readonly HarvestedSourceGame[] = [
  'Dwarf Fortress',
  'Kerbal Space Program',
  'Factorio',
  'Hades',
  'Plasma',
  'Space Engineers',
  'Satisfactory',
  'Transport Fever 2',
];

export interface HarvestedShelfEntry {
  readonly id: string;
  readonly name: string;
  readonly sourceGame: HarvestedSourceGame;
  readonly category: HarvestedCategory;
  readonly rung: 1 | 2 | 3 | 4 | 5;
  /** Four-Float composition normalized to `0..100` for HUD/Studio meters. */
  readonly fourFloats: {
    readonly pxd: number;
    readonly vtx: number;
    readonly lx: number;
    readonly aq: number;
  };
  readonly metrics: {
    readonly massKg: number;
    readonly thrustKn: number;
    readonly powerMW: number;
    readonly throughputPerMin: number;
    readonly sockets: number;
  };
  readonly summary: string;
}

export interface HarvestedShelfQuery {
  readonly category?: HarvestedCategory | 'all';
  readonly sourceGame?: HarvestedSourceGame | 'all';
  readonly rung?: 1 | 2 | 3 | 4 | 5 | 'all';
  readonly search?: string;
  readonly offset?: number;
  readonly limit?: number;
}

export interface HarvestedShelfPage {
  readonly items: readonly HarvestedShelfEntry[];
  readonly matchedCount: number;
  readonly totalCatalogCount: number;
  readonly byCategory: Readonly<Record<HarvestedCategory, number>>;
  readonly byGame: Readonly<Record<HarvestedSourceGame, number>>;
}

const GAME_BY_CODE: Readonly<Record<string, HarvestedSourceGame>> = {
  df: 'Dwarf Fortress',
  ksp: 'Kerbal Space Program',
  fac: 'Factorio',
  had: 'Hades',
  pla: 'Plasma',
  se: 'Space Engineers',
  sat: 'Satisfactory',
  tf2: 'Transport Fever 2',
};

const CAT_BY_CODE: Readonly<Record<string, HarvestedCategory>> = {
  el: 'element',
  th: 'thruster-propulsion',
  re: 'reactor-power',
  gy: 'gyro-control',
  st: 'structural-hull',
  sy: 'synthesis-recipe',
  co: 'combat-cadence',
  wg: 'wiregraph-contraption',
  lo: 'logistics-envelope',
};

const RUNG_BY_CAT: Readonly<Record<HarvestedCategory, 1 | 2 | 3 | 4 | 5>> = {
  element: 1,
  'combat-cadence': 3,
  'logistics-envelope': 3,
  'thruster-propulsion': 4,
  'reactor-power': 4,
  'gyro-control': 4,
  'structural-hull': 4,
  'synthesis-recipe': 4,
  'wiregraph-contraption': 4,
};

/**
 * Lazily materializes a single `CompactHarvestTuple` into a full `HarvestedShelfEntry` on demand.
 */
export function materializeHarvestedTuple(t: CompactHarvestTuple): HarvestedShelfEntry {
  const [id, name, gameCode, catCode, pxd, vtx, lx, aq, massKg, thrustKn, powerMW, throughputPerMin, sockets] = t;
  const sourceGame = GAME_BY_CODE[gameCode] ?? 'Space Engineers';
  const category = CAT_BY_CODE[catCode] ?? 'structural-hull';
  const rung = RUNG_BY_CAT[category];

  let summary = `${sourceGame} · ${category}`;
  if (category === 'element') {
    summary = `Density ${massKg} kg/m³ · Pxd ${pxd} / Vtx ${vtx} / Lx ${lx} / Aq ${aq}`;
  } else if (category === 'thruster-propulsion') {
    summary = `Thrust ${thrustKn} kN · Power ${powerMW} MW · ${sockets} sockets`;
  } else if (category === 'reactor-power') {
    summary = `Output ${powerMW} MW · Mass ${massKg} kg · ${sockets} sockets`;
  } else if (category === 'synthesis-recipe') {
    summary = `Throughput ${throughputPerMin}/min · Power ${powerMW} MW`;
  } else if (category === 'wiregraph-contraption') {
    summary = `Wiregraph device · ${sockets} parts · Mass ${massKg}x`;
  } else if (category === 'logistics-envelope') {
    summary = `Top speed ${thrustKn} m/s · Mass ${massKg} kg`;
  } else if (category === 'combat-cadence') {
    summary = `Cadence ${throughputPerMin} cyc/min · Pre-wait ${powerMW}s`;
  } else {
    summary = `Mass ${massKg} kg · ${sockets} sockets`;
  }

  return {
    id,
    name,
    sourceGame,
    category,
    rung,
    fourFloats: { pxd, vtx, lx, aq },
    metrics: { massKg, thrustKn, powerMW, throughputPerMin, sockets },
    summary,
  };
}

/**
 * Queries the lazy-indexed harvested preset catalog without materializing unselected rows.
 */
export function queryHarvestedShelf(
  query: HarvestedShelfQuery = {},
  tuples: readonly CompactHarvestTuple[] = HARVESTED_COMPACT_TUPLES,
): HarvestedShelfPage {
  const catFilter = query.category && query.category !== 'all' ? query.category : null;
  const gameFilter = query.sourceGame && query.sourceGame !== 'all' ? query.sourceGame : null;
  const rungFilter = query.rung && query.rung !== 'all' ? query.rung : null;
  const searchLower = query.search ? query.search.trim().toLowerCase() : '';
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, Math.min(200, query.limit ?? 24));

  const matchedIndices: number[] = [];
  for (let i = 0; i < tuples.length; i++) {
    const t = tuples[i]!;
    const game = GAME_BY_CODE[t[2]] ?? 'Space Engineers';
    const cat = CAT_BY_CODE[t[3]] ?? 'structural-hull';
    const rung = RUNG_BY_CAT[cat];

    if (catFilter && cat !== catFilter) continue;
    if (gameFilter && game !== gameFilter) continue;
    if (rungFilter && rung !== rungFilter) continue;
    if (searchLower && !t[0].toLowerCase().includes(searchLower) && !t[1].toLowerCase().includes(searchLower)) {
      continue;
    }
    matchedIndices.push(i);
  }

  const slice = matchedIndices.slice(offset, offset + limit);
  const items = slice.map((idx) => materializeHarvestedTuple(tuples[idx]!));

  return {
    items,
    matchedCount: matchedIndices.length,
    totalCatalogCount: HARVESTED_TOTAL_COUNTS.total,
    byCategory: HARVESTED_TOTAL_COUNTS.byCategory,
    byGame: HARVESTED_TOTAL_COUNTS.byGame,
  };
}

/** Looks up a single harvested preset by its `id` (`elem:...`, `kit:...`, `logic:...`, `mot:...`, `loc:...`). */
export function findHarvestedPresetById(
  id: string,
  tuples: readonly CompactHarvestTuple[] = HARVESTED_COMPACT_TUPLES,
): HarvestedShelfEntry | null {
  for (let i = 0; i < tuples.length; i++) {
    if (tuples[i]![0] === id) return materializeHarvestedTuple(tuples[i]!);
  }
  return null;
}

