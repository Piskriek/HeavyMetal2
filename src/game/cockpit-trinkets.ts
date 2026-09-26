/**
 * WIRE-3 / X12 — Cockpit dashboard trinkets (pure).
 *
 * Up to two trinkets on the dashboard ledge that sway with steering and bounce on landings
 * via a small damped spring-damper.
 *
 * Presentation only: never affects race physics or sim state.
 * Held still under reduced motion.
 */
import type { RunRecord } from './types';
import { roundPointsFor } from './session';

export type TrinketId =
  | 'none'
  | 'sheep'
  | 'dice'
  | 'horseshoe'
  | 'rocket'
  | 'hula'
  | 'cup_gold'
  | 'cup_silver'
  | 'cup_bronze';

export type TrinketMotionType = 'bobblehead' | 'hanging' | 'rocking';

export interface TrinketDef {
  readonly id: TrinketId;
  readonly name: string;
  readonly type: TrinketMotionType;
  readonly file: string;
  readonly bodyFile?: string;
  readonly headFile?: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  /** Anchor point for transform-origin: top for hanging, bottom for rocking. */
  readonly anchorFraction: { readonly x: number; readonly y: number };
}

export const TRINKET_DEFS: Record<TrinketId, TrinketDef> = {
  none: {
    id: 'none',
    name: 'Empty Slot',
    type: 'rocking',
    file: '',
    description: 'A clean patch of dashboard.',
    width: 64,
    height: 64,
    anchorFraction: { x: 0.5, y: 1.0 },
  },
  sheep: {
    id: 'sheep',
    name: 'Sheep Bobblehead',
    type: 'bobblehead',
    file: '/art/cockpit/trinkets/trinket-sheep-bobble-head.png',
    bodyFile: '/art/cockpit/trinkets/trinket-sheep-bobble-body.png',
    headFile: '/art/cockpit/trinkets/trinket-sheep-bobble-head.png',
    description: 'Spring-mounted noggin. Mildly perturbed expression.',
    width: 80,
    height: 96,
    anchorFraction: { x: 0.5, y: 0.85 },
  },
  dice: {
    id: 'dice',
    name: 'Fuzzy Dice',
    type: 'hanging',
    file: '/art/cockpit/trinkets/trinket-fuzzy-dice.png',
    description: 'Felt pair dangling from an iron bracket.',
    width: 72,
    height: 85,
    anchorFraction: { x: 0.5, y: 0.05 },
  },
  horseshoe: {
    id: 'horseshoe',
    name: 'Lucky Horseshoe',
    type: 'hanging',
    file: '/art/cockpit/trinkets/trinket-lucky-horseshoe.png',
    description: 'Forged scrap iron to ward off premature detonation.',
    width: 60,
    height: 90,
    anchorFraction: { x: 0.5, y: 0.05 },
  },
  rocket: {
    id: 'rocket',
    name: 'Mini Rocket',
    type: 'rocking',
    file: '/art/cockpit/trinkets/trinket-mini-rocket.png',
    description: 'Solid tin booster. Does not actually ignite.',
    width: 44,
    height: 96,
    anchorFraction: { x: 0.5, y: 0.95 },
  },
  hula: {
    id: 'hula',
    name: 'Hula Goblin',
    type: 'rocking',
    file: '/art/cockpit/trinkets/trinket-hula-goblin.png',
    description: 'Grass skirt and relentless hip motion.',
    width: 65,
    height: 96,
    anchorFraction: { x: 0.5, y: 0.95 },
  },
  cup_gold: {
    id: 'cup_gold',
    name: 'Gold Scrap Cup',
    type: 'rocking',
    file: '/art/cockpit/trinkets/trinket-cup-gold.png',
    description: '1st Place in the Scrapdome Cup tournament.',
    width: 90,
    height: 74,
    anchorFraction: { x: 0.5, y: 0.95 },
  },
  cup_silver: {
    id: 'cup_silver',
    name: 'Silver Scrap Cup',
    type: 'rocking',
    file: '/art/cockpit/trinkets/trinket-cup-silver.png',
    description: '2nd Place or better in the Scrapdome Cup tournament.',
    width: 90,
    height: 74,
    anchorFraction: { x: 0.5, y: 0.95 },
  },
  cup_bronze: {
    id: 'cup_bronze',
    name: 'Bronze Scrap Cup',
    type: 'rocking',
    file: '/art/cockpit/trinkets/trinket-cup-bronze.png',
    description: '3rd Place or better in the Scrapdome Cup tournament.',
    width: 90,
    height: 74,
    anchorFraction: { x: 0.5, y: 0.95 },
  },
};

export const ALL_TRINKET_IDS: readonly TrinketId[] = [
  'none',
  'sheep',
  'dice',
  'horseshoe',
  'rocket',
  'hula',
  'cup_gold',
  'cup_silver',
  'cup_bronze',
] as const;

export const ALL_TRINKET_FILES: readonly string[] = [
  '/art/cockpit/trinkets/trinket-sheep-bobble-body.png',
  '/art/cockpit/trinkets/trinket-sheep-bobble-head.png',
  '/art/cockpit/trinkets/trinket-fuzzy-dice.png',
  '/art/cockpit/trinkets/trinket-lucky-horseshoe.png',
  '/art/cockpit/trinkets/trinket-mini-rocket.png',
  '/art/cockpit/trinkets/trinket-hula-goblin.png',
  '/art/cockpit/trinkets/trinket-cup-gold.png',
  '/art/cockpit/trinkets/trinket-cup-silver.png',
  '/art/cockpit/trinkets/trinket-cup-bronze.png',
];

/**
 * Determine best tournament placement from stored records.
 * Returns best place (1 = 1st, 2 = 2nd, 3 = 3rd, Infinity = none).
 */
export function bestTournamentRank(records: readonly RunRecord[]): number {
  if (!records || records.length === 0) return Infinity;

  let best = Infinity;

  // Group tournament records by session to calculate cumulative points
  const bySession = new Map<string, RunRecord[]>();
  for (const record of records) {
    if (record.mode !== 'tournament') continue;

    const sid = record.sessionId || record.id;
    const list = bySession.get(sid) ?? [];
    list.push(record);
    bySession.set(sid, list);
  }

  // Calculate cumulative points across sessions with multiple rounds
  for (const sessionRecords of bySession.values()) {
    const hasOpponents = sessionRecords.some((r) => r.opponents && r.opponents.length > 0);
    if (hasOpponents) {
      const pointsMap = new Map<number, number>();
      for (const rec of sessionRecords) {
        const fieldSize = rec.fieldSize ?? 4;
        if (typeof rec.position === 'number' && rec.completed) {
          // Player id is 0
          pointsMap.set(0, (pointsMap.get(0) ?? 0) + roundPointsFor(rec.position, true, fieldSize));
        }
        if (rec.opponents) {
          for (const opp of rec.opponents) {
            pointsMap.set(opp.id, (pointsMap.get(opp.id) ?? 0) + roundPointsFor(opp.position, opp.finished, fieldSize));
          }
        }
      }

      if (pointsMap.has(0)) {
        const sorted = [...pointsMap.entries()].sort((a, b) => b[1] - a[1]);
        const playerRank = sorted.findIndex(([id]) => id === 0) + 1;
        if (playerRank > 0 && playerRank < best) {
          best = playerRank;
        }
      }
    } else {
      // Without opponent records, check recorded finish position
      for (const rec of sessionRecords) {
        if (typeof rec.position === 'number' && rec.position > 0 && rec.position < best) {
          best = rec.position;
        }
      }
    }
  }

  return best;
}

/** Check if a trinket is unlocked based on existing race records. Never writes records. */
export function isTrinketUnlocked(id: TrinketId, records: readonly RunRecord[] = []): boolean {
  switch (id) {
    case 'none':
    case 'sheep':
    case 'dice':
    case 'horseshoe':
    case 'rocket':
    case 'hula':
      return true;
    case 'cup_bronze':
      return bestTournamentRank(records) <= 3;
    case 'cup_silver':
      return bestTournamentRank(records) <= 2;
    case 'cup_gold':
      return bestTournamentRank(records) <= 1;
    default:
      return false;
  }
}

export interface DashboardTrinkets {
  readonly slot1: TrinketId;
  readonly slot2: TrinketId;
}

export const DEFAULT_TRINKETS: DashboardTrinkets = {
  slot1: 'sheep',
  slot2: 'dice',
};

export const TRINKETS_STORAGE_KEY = 'goblin-rally-trinkets-v1';

export function readDashboardTrinkets(records: readonly RunRecord[] = []): DashboardTrinkets {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_TRINKETS;
    const raw = localStorage.getItem(TRINKETS_STORAGE_KEY);
    if (!raw) return DEFAULT_TRINKETS;
    const parsed = JSON.parse(raw) as Partial<DashboardTrinkets>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TRINKETS;

    const s1 = parsed.slot1 && ALL_TRINKET_IDS.includes(parsed.slot1) ? parsed.slot1 : DEFAULT_TRINKETS.slot1;
    const s2 = parsed.slot2 && ALL_TRINKET_IDS.includes(parsed.slot2) ? parsed.slot2 : DEFAULT_TRINKETS.slot2;

    return {
      slot1: isTrinketUnlocked(s1, records) ? s1 : 'none',
      slot2: isTrinketUnlocked(s2, records) ? s2 : 'none',
    };
  } catch {
    return DEFAULT_TRINKETS;
  }
}

export function saveDashboardTrinkets(trinkets: DashboardTrinkets): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(TRINKETS_STORAGE_KEY, JSON.stringify(trinkets));
    window.dispatchEvent(new CustomEvent('goblin-trinkets-changed', { detail: trinkets }));
    return true;
  } catch {
    return false;
  }
}

/* -----------------------------------------------------------------------------
   SPRING-DAMPER SIMULATION (presentation only)
   -------------------------------------------------------------------------- */

export interface TrinketSpringState {
  angleDeg: number;
  angleVel: number;
  yPx: number;
  yVel: number;
}

export function createTrinketSpringState(): TrinketSpringState {
  return { angleDeg: 0, angleVel: 0, yPx: 0, yVel: 0 };
}

export interface TrinketMotionInput {
  readonly steer: number;
  readonly bob: number;
  readonly impact: number;
  readonly impactSide: -1 | 0 | 1;
  readonly reducedMotion: boolean;
  readonly dt: number;
}

/**
 * Steps the trinket spring-damper for one frame.
 * Pure function: deterministic, operates on numbers.
 */
export function stepTrinketSpring(state: TrinketSpringState, input: TrinketMotionInput): TrinketSpringState {
  if (input.reducedMotion) {
    state.angleDeg = 0;
    state.angleVel = 0;
    state.yPx = 0;
    state.yVel = 0;
    return state;
  }

  const dt = Math.max(0.001, Math.min(0.05, input.dt));

  // Lateral forces:
  // Turning left (steer < 0) pushes objects to the right (+angle)
  const targetAngle = -input.steer * 14;

  // Impact adds an impulse kicking the trinket opposite to the hit side
  if (input.impact > 0.05) {
    const kickDir = input.impactSide === 0 ? 1 : -input.impactSide;
    state.angleVel += kickDir * input.impact * 60 * dt * 60;
    state.yVel += input.impact * 40 * dt * 60;
  }

  // Angular oscillator: k = 160, c = 12
  const kAngle = 160;
  const cAngle = 12;
  const accelAngle = -kAngle * (state.angleDeg - targetAngle) - cAngle * state.angleVel;
  state.angleVel += accelAngle * dt;
  state.angleDeg += state.angleVel * dt;

  // Clamp angle to reasonable visual bounds (-35 to +35 degrees)
  if (state.angleDeg > 35) {
    state.angleDeg = 35;
    state.angleVel = 0;
  } else if (state.angleDeg < -35) {
    state.angleDeg = -35;
    state.angleVel = 0;
  }

  // Vertical oscillator: target driven by cockpit bob
  const targetY = input.bob * 0.7;
  const kY = 200;
  const cY = 15;
  const accelY = -kY * (state.yPx - targetY) - cY * state.yVel;
  state.yVel += accelY * dt;
  state.yPx += state.yVel * dt;

  // Clamp vertical displacement (-15 to +15 px)
  if (state.yPx > 15) {
    state.yPx = 15;
    state.yVel = 0;
  } else if (state.yPx < -15) {
    state.yPx = -15;
    state.yVel = 0;
  }

  return state;
}
