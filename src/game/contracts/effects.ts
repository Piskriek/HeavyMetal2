/**
 * T01 — gameplay effects, pickup *triggers* versus *resolved effects*.
 *
 * Two rules are frozen here:
 * 1. A lasting gameplay effect is exactly `fuel | shield | bounce`. Nothing else may be
 *    stored as an effect.
 * 2. "Mystery" is a **resolver**, not an effect. It is resolved once, at trigger time, and
 *    the resolved gameplay effect is what gets stored and persisted. A retry, a reload or a
 *    second `resolve()` call must never re-roll it.
 *
 * The trigger record is the physical observation (which racer's swept sphere crossed which
 * pickup, and how far into the tick). Arbitration for the same tick is by crossing fraction
 * and then by racer ID, which is also the racing-claim rule T09 must implement.
 */

import type { PowerupKind } from '../powerups';
import { ContractError, frozenArray, isFiniteNumber, isSafeRacerId, type ContractErrorCode } from './core';
import type { RacerId } from './identity';

export const GAMEPLAY_EFFECTS = ['fuel', 'shield', 'bounce'] as const;
export type GameplayEffect = (typeof GAMEPLAY_EFFECTS)[number];

/**
 * Compile-time proof that the runtime pickup kinds and the contract effects are the same
 * set. If either side gains a value, this alias stops being `true` and the build fails.
 */
export type GameplayEffectMatchesPowerupKind =
  [PowerupKind] extends [GameplayEffect] ? ([GameplayEffect] extends [PowerupKind] ? true : false) : false;

export function isGameplayEffect(value: unknown): value is GameplayEffect {
  return typeof value === 'string' && (GAMEPLAY_EFFECTS as readonly string[]).includes(value);
}

/** Throws for `'mystery'` and any other non-effect, so it cannot be persisted by mistake. */
export function assertGameplayEffect(value: unknown): GameplayEffect {
  if (!isGameplayEffect(value)) {
    throw new ContractError('E_EFFECT', `"${String(value)}" is not a lasting gameplay effect (${GAMEPLAY_EFFECTS.join(' | ')}).`, { value });
  }
  return value;
}

export interface MysteryContext {
  readonly pickupId: string;
  readonly racerId: RacerId;
  readonly tick: number;
  /** Gameplay RNG value in `[0, 1)`, supplied by the simulation's gameplay stream. */
  readonly roll: number;
  /** Optional weights; the resolver decides, and the caller may not guess the outcome. */
  readonly weights?: Readonly<Record<GameplayEffect, number>>;
}

/** Mystery is a function from context to a concrete effect. It is never a stored effect. */
export type MysteryResolver = (context: MysteryContext) => GameplayEffect;

/** Default resolver: weighted by the supplied weights, defaulting to an even split. */
export function createWeightedMysteryResolver(): MysteryResolver {
  return (context) => {
    const weights = context.weights ?? { fuel: 1, shield: 1, bounce: 1 };
    const total = GAMEPLAY_EFFECTS.reduce((sum, effect) => sum + Math.max(0, weights[effect] ?? 0), 0);
    if (total <= 0) return 'fuel';
    const roll = Math.min(0.999999, Math.max(0, context.roll)) * total;
    let cursor = 0;
    for (const effect of GAMEPLAY_EFFECTS) {
      cursor += Math.max(0, weights[effect] ?? 0);
      if (roll < cursor) return effect;
    }
    return GAMEPLAY_EFFECTS[GAMEPLAY_EFFECTS.length - 1];
  };
}

export type PickupKind = GameplayEffect | 'mystery';

export interface PickupTrigger {
  readonly pickupId: string;
  readonly racerId: RacerId;
  /** Tick the crossing happened on; claims are only arbitrated within one tick. */
  readonly tick: number;
  /** Position within the tick: the swept solve's crossing fraction in `[0, 1]`. */
  readonly crossingFraction: number;
  /** What the pickup is. `'mystery'` must be resolved before anything is stored. */
  readonly kind: PickupKind;
}

export function createPickupTrigger(input: {
  pickupId: string; racerId: RacerId; tick: number; crossingFraction: number; kind: PickupKind;
}): PickupTrigger {
  if (typeof input.pickupId !== 'string' || input.pickupId === '') {
    throw new ContractError('E_PICKUP_CLAIM', 'A pickup trigger needs a non-empty pickup ID.', { pickupId: input.pickupId });
  }
  if (!isSafeRacerId(input.racerId)) {
    throw new ContractError('E_RACER_ID', `Pickup trigger racer ID ${String(input.racerId)} is invalid.`);
  }
  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new ContractError('E_TICK', `Pickup trigger tick ${String(input.tick)} must be a non-negative integer.`);
  }
  if (!isFiniteNumber(input.crossingFraction) || input.crossingFraction < 0 || input.crossingFraction > 1) {
    throw new ContractError('E_PICKUP_CLAIM', `Crossing fraction ${String(input.crossingFraction)} must be within [0, 1].`);
  }
  if (input.kind !== 'mystery' && !isGameplayEffect(input.kind)) {
    throw new ContractError('E_EFFECT', `Pickup kind "${String(input.kind)}" is not a known supply.`);
  }
  return Object.freeze({ ...input });
}

export interface ResolvedPickupEffect {
  readonly pickupId: string;
  readonly racerId: RacerId;
  readonly tick: number;
  readonly effect: GameplayEffect;
  /** True when a mystery resolver produced this effect. */
  readonly fromMystery: boolean;
}

export type ClaimStatus = 'claimed' | 'already-claimed' | 'lost-arbitration';

export interface ClaimResult {
  readonly status: ClaimStatus;
  readonly pickupId: string;
  readonly racerId: RacerId;
  readonly winner: RacerId | null;
  readonly requiresMysteryRoll: boolean;
}

export interface PickupArbiter {
  readonly size: number;
  /**
   * Registers a trigger and arbitrates the pickup. The winner is the best trigger seen so
   * far for that pickup: earliest tick, then earliest crossing fraction, then lower racer ID.
   * A better trigger from the same tick displaces the incumbent; a trigger from a later tick
   * never can.
   */
  claim(trigger: PickupTrigger): ClaimResult;
  /** True when the pickup has a winning claim already. */
  isClaimed(pickupId: string): boolean;
  /** The racer currently holding the pickup, or `null` when nobody has claimed it. */
  winnerOf(pickupId: string): RacerId | null;
  /** Idempotent: resolving twice returns the recorded effect and never re-rolls a mystery. */
  resolve(pickupId: string, resolver?: MysteryResolver, roll?: number): ResolvedPickupEffect | null;
  /** Every resolved effect, in pickup-ID order, for tests and replay comparisons. */
  resolved(): readonly ResolvedPickupEffect[];
  clear(): void;
}

/**
 * Same-tick arbitration: earliest crossing fraction wins; an exact tie goes to the lower
 * racer ID. A later trigger for the same pickup — same tick or not — never wins.
 */
export function createPickupArbiter(): PickupArbiter {
  const claims = new Map<string, PickupTrigger>();
  const effects = new Map<string, ResolvedPickupEffect>();

  const better = (candidate: PickupTrigger, incumbent: PickupTrigger) => {
    if (candidate.tick !== incumbent.tick) return candidate.tick < incumbent.tick;
    if (candidate.crossingFraction !== incumbent.crossingFraction) return candidate.crossingFraction < incumbent.crossingFraction;
    return candidate.racerId < incumbent.racerId;
  };

  return {
    get size() { return claims.size; },
    claim: (trigger) => {
      const existing = claims.get(trigger.pickupId);
      if (!existing) {
        claims.set(trigger.pickupId, trigger);
        return Object.freeze({
          status: 'claimed' as const, pickupId: trigger.pickupId, racerId: trigger.racerId, winner: trigger.racerId,
          requiresMysteryRoll: trigger.kind === 'mystery',
        });
      }
      const identical = existing.racerId === trigger.racerId && existing.tick === trigger.tick
        && existing.crossingFraction === trigger.crossingFraction;
      if (identical) {
        return Object.freeze({
          status: 'already-claimed' as const, pickupId: trigger.pickupId, racerId: trigger.racerId, winner: existing.racerId,
          requiresMysteryRoll: trigger.kind === 'mystery',
        });
      }
      if (better(trigger, existing)) {
        // Same-tick arbitration can still be won outright by an earlier or lower-ID crossing.
        claims.set(trigger.pickupId, trigger);
        return Object.freeze({
          status: 'claimed' as const, pickupId: trigger.pickupId, racerId: trigger.racerId, winner: trigger.racerId,
          requiresMysteryRoll: trigger.kind === 'mystery',
        });
      }
      return Object.freeze({
        status: 'lost-arbitration' as const, pickupId: trigger.pickupId, racerId: trigger.racerId, winner: existing.racerId,
        requiresMysteryRoll: existing.kind === 'mystery',
      });
    },
    winnerOf: (pickupId) => claims.get(pickupId)?.racerId ?? null,
    isClaimed: (pickupId) => claims.has(pickupId),
    resolve: (pickupId, resolver = createWeightedMysteryResolver(), roll = 0) => {
      const recorded = effects.get(pickupId);
      if (recorded) return recorded;
      const claim = claims.get(pickupId);
      if (!claim) return null;
      let effect: GameplayEffect;
      let fromMystery = false;
      if (claim.kind === 'mystery') {
        effect = assertGameplayEffect(resolver({ pickupId, racerId: claim.racerId, tick: claim.tick, roll }));
        fromMystery = true;
      } else {
        effect = assertGameplayEffect(claim.kind);
      }
      const resolved: ResolvedPickupEffect = Object.freeze({
        pickupId, racerId: claim.racerId, tick: claim.tick, effect, fromMystery,
      });
      effects.set(pickupId, resolved);
      return resolved;
    },
    resolved: () => frozenArray([...effects.values()].sort((a, b) => a.pickupId.localeCompare(b.pickupId))),
    clear: () => { claims.clear(); effects.clear(); },
  };
}

/** Convenience for callers that only need the typed failure code. */
export function effectFailureCode(): ContractErrorCode {
  return 'E_EFFECT';
}
