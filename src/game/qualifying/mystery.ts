/**
 * T04 — the optional mystery route, deterministic and rolled once.
 *
 * A mystery route is an *optional detour* through the qualifying section: a supply that is not on the
 * line to the gate, placed in somebody else's lane, high enough that reaching it costs you the clean
 * run. It is the qualifying-level use of the T01 rule that mystery is a **resolver, not an effect**:
 * the route resolves to exactly one of `fuel | shield | bounce` when it is created, and what a
 * participant stores is that resolved effect — never a lasting "mystery".
 *
 * Two memos make the guarantee real:
 *
 * - the route is resolved from a **heat-scoped** seed `(session seed, racer ID, heat index)`, so a
 *   participant's retry (same heat, different attempt) gets the *same* route — the heat reward cannot
 *   be re-rolled by crashing on purpose;
 * - the attempt hands `createPickupArbiter.resolve()` a resolver that returns the already-recorded
 *   effect, so even a bug that re-entered the resolver could not change the outcome.
 */
import { LANE_COUNT, courseY, laneZ } from '../scene';
import type { AirPickup } from '../powerups';
import type { GameplayEffect, MysteryResolver } from '../contracts/effects';
import type { RacerId } from '../contracts/identity';
import { createRng } from '../rng';
import { heatSeed } from './field';
import type { QualifyingGateSpec } from './gate';

/** The three real effects, in the order the weighted resolver walks them. */
export const MYSTERY_EFFECTS: readonly GameplayEffect[] = Object.freeze(['fuel', 'shield', 'bounce']);

/** How far before the gate the detour supply sits, and how high off the dirt. */
export const MYSTERY_APPROACH_UNITS = 340;
export const MYSTERY_ALTITUDE_BAND: readonly [number, number] = Object.freeze([158, 236]);

export interface MysteryRoute {
  /** Stable arbiter key: `mystery:<racerId>:<heatIndex>`. */
  readonly id: string;
  readonly racerId: RacerId;
  readonly heatIndex: number;
  /** A lane other than the gate's: taking the supply means leaving the clean line. */
  readonly lane: number;
  readonly x: number;
  readonly altitude: number;
  /** The resolved effect. Resolved once, here, from the heat-scoped roll. */
  readonly effect: GameplayEffect;
  /** The `[0, 1)` gameplay roll that produced it, kept so a replay can show its work. */
  readonly roll: number;
  readonly weights: Readonly<Record<GameplayEffect, number>>;
}

export interface MysteryOptions {
  readonly enabled: boolean;
  readonly seed: number;
  readonly heatIndex?: number;
  readonly weights?: Partial<Record<GameplayEffect, number>>;
}

export interface MysteryLedger {
  readonly enabled: boolean;
  readonly weights: Readonly<Record<GameplayEffect, number>>;
  /** Memoised: the first call resolves, every later call returns the same route. */
  routeFor(racerId: RacerId): MysteryRoute | null;
  /** Every route resolved so far, in racer-ID order. */
  resolved(): readonly MysteryRoute[];
  /** How many times the resolver actually ran — must be once per participant per heat. */
  readonly rolls: number;
}

const DEFAULT_WEIGHTS: Readonly<Record<GameplayEffect, number>> = Object.freeze({ fuel: 1, shield: 1, bounce: 1 });

export function createMysteryLedger(options: MysteryOptions, gate: QualifyingGateSpec): MysteryLedger {
  const weights = Object.freeze({ ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) });
  const heatIndex = options.heatIndex ?? 0;
  const routes = new Map<RacerId, MysteryRoute>();
  let rolls = 0;

  const resolve = (racerId: RacerId): MysteryRoute => {
    const rng = createRng(heatSeed(options.seed, racerId, heatIndex));
    // The lane is chosen before the roll so a supply never lands in the gate lane by accident.
    const lanePick = Math.floor(rng.next() * (LANE_COUNT - 1));
    const lane = (gate.loopLane + 1 + lanePick) % LANE_COUNT;
    const roll = rng.next();
    const total = MYSTERY_EFFECTS.reduce((sum, effect) => sum + Math.max(0, weights[effect] ?? 0), 0);
    let cursor = 0;
    let effect: GameplayEffect = 'fuel';
    for (const candidate of MYSTERY_EFFECTS) {
      cursor += Math.max(0, weights[candidate] ?? 0);
      if (roll * total < cursor) { effect = candidate; break; }
    }
    rolls++;
    return Object.freeze({
      id: `mystery:${racerId}:${heatIndex}`,
      racerId,
      heatIndex,
      lane,
      x: Math.max(60, gate.x - MYSTERY_APPROACH_UNITS),
      altitude: MYSTERY_ALTITUDE_BAND[0] + rng.next() * (MYSTERY_ALTITUDE_BAND[1] - MYSTERY_ALTITUDE_BAND[0]),
      effect,
      roll,
      weights,
    });
  };

  return {
    enabled: options.enabled,
    weights,
    get rolls() { return rolls; },
    routeFor: (racerId) => {
      if (!options.enabled) return null;
      const existing = routes.get(racerId);
      if (existing) return existing;
      const created = resolve(racerId);
      routes.set(racerId, created);
      return created;
    },
    resolved: () => Object.freeze([...routes.values()].sort((a, b) => a.racerId - b.racerId)),
  };
}

/**
 * The supply the attempt actually places. Its `kind` is the resolved effect — the unresolved mystery
 * never exists as a gameplay effect — while the arbiter trigger is filed as `'mystery'` so the
 * resolution is recorded exactly once and marked `fromMystery`.
 */
export function mysteryPickup(route: MysteryRoute, course: Parameters<typeof courseY>[1], nextId: number): AirPickup {
  const x = route.x;
  return {
    id: nextId,
    kind: route.effect,
    x,
    y: courseY(x, course) - route.altitude,
    z: laneZ(route.lane),
    lane: route.lane,
    collectedBy: null,
    collectedAt: -100,
  };
}

/** A resolver that can only ever return the recorded effect. */
export function recordedResolver(route: MysteryRoute): MysteryResolver {
  return () => route.effect;
}
