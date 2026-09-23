/**
 * T04 — airborne supply resolution, lifted out of `GameEngine` unchanged.
 *
 * Swept sphere collection over the tick's whole movement range, earliest contact wins, one claim
 * per supply. In a race the candidate set spans every racer; in an isolated qualifying attempt it
 * spans exactly one, and the supplies are the attempt's own clones — so a hidden participant can
 * never take a supply, and a supply taken in one attempt is brand new in the next.
 *
 * `onClaim` is the seam the T01 pickup arbiter plugs into: the crossing fraction the swept solve
 * already produces is the arbiter's `crossingFraction`, and a mystery supply is resolved there,
 * once, before anything is stored.
 */
import { POWERUPS, SHIELD_DURATION, pickupIntercept, pickupY, type AirPickup } from '../powerups';
import { weightImpulse } from '../scene';
import type { Racer } from '../racers';
import type { RacerStepContext } from './context';

const NO_CLAIMS: readonly PickupClaim[] = Object.freeze([]);

export interface PickupClaim {
  readonly racer: Racer;
  readonly pickup: AirPickup;
  /** Position within the tick: the swept solve's crossing fraction in `[0, 1]`. */
  readonly crossingFraction: number;
}

export interface PickupResolutionOptions {
  readonly reducedMotion: boolean;
  /** Reusable candidate set; cleared on every call. The engine passes its own. */
  readonly candidates?: Set<AirPickup>;
  /**
   * Called with the winning contact before the effect is applied. Return `false` to veto the
   * claim (lost arbitration); the supply then stays uncollected for everybody else too.
   */
  readonly onClaim?: (claim: PickupClaim) => boolean | void;
}

export function collectPickup(racer: Racer, pickup: AirPickup, ctx: RacerStepContext): void {
  pickup.collectedBy = racer.id;
  pickup.collectedAt = ctx.runTime;
  racer.pickupAt = ctx.runTime;
  let notice = '';
  if (pickup.kind === 'fuel') {
    const full = racer.boosts >= 2;
    racer.boosts = Math.min(2, racer.boosts + 1);
    racer.vx = Math.min(racer.maximumSpeed, racer.vx + 115 * weightImpulse(racer.weight) * racer.boostFactor);
    if (racer.grounded) racer.vy = ctx.world.surfaceAt(racer.x, racer.z).slope * racer.vx;
    notice = full ? 'FUEL SURGE. BOOST TANK ALREADY FULL.' : 'ROCKET FUEL! +1 BOOST';
  } else if (pickup.kind === 'shield') {
    racer.shieldUntil = ctx.runTime + SHIELD_DURATION;
    notice = 'SKYWARD SHIELD! ONE SHOVE. SIX SECONDS.';
  } else {
    const full = racer.bounces >= 3;
    racer.bounces = Math.min(3, racer.bounces + 1);
    notice = full ? 'AIR BOUNCES FULL. +75 CHAOS.' : 'AIR SPRING! +1 AIR BOUNCE';
  }
  ctx.fx.emit(pickup.x, pickup.y, pickup.z, 13, POWERUPS[pickup.kind].color, 120);
  if (!racer.id) {
    ctx.fx.score(75);
    ctx.fx.pickupCollected(pickup.kind);
    ctx.fx.audio('pickup');
    ctx.fx.say(notice);
  }
}

/**
 * Resolves every supply the given racers swept through this tick. `racers` is the whole field in
 * a race and a single participant in a qualifying attempt.
 */
export function resolvePickups(
  racers: readonly Racer[],
  ctx: RacerStepContext,
  options: PickupResolutionOptions,
): readonly PickupClaim[] {
  const world = ctx.world;
  const candidates = options.candidates ?? new Set<AirPickup>();
  candidates.clear();
  for (const racer of racers) {
    if (racer.falling || racer.finished || racer.loopRide) continue;
    for (const pickup of world.pickupsInSpan(racer.previous.x, racer.x)) {
      if (pickup.collectedBy === null) candidates.add(pickup);
    }
  }
  // Allocated lazily: an ordinary tick claims nothing and the race must not churn arrays.
  let claims: PickupClaim[] | null = null;
  for (const pickup of candidates) {
    let winner: Racer | null = null;
    let earliest = Infinity;
    const y = pickupY(pickup, ctx.runTime, options.reducedMotion);
    for (const racer of racers) {
      if (racer.falling || racer.finished || racer.loopRide || Math.abs(racer.z - pickup.z) > 110 || Math.abs(racer.x - pickup.x) > 160) continue;
      const time = pickupIntercept(racer.previous, racer, pickup, y);
      if (time !== null && time < earliest) { earliest = time; winner = racer; }
    }
    if (!winner) continue;
    if (options.onClaim && options.onClaim({ racer: winner, pickup, crossingFraction: earliest }) === false) continue;
    (claims ??= []).push({ racer: winner, pickup, crossingFraction: earliest });
    collectPickup(winner, pickup, ctx);
  }
  return claims ?? NO_CLAIMS;
}
