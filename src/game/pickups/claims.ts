/**
 * T09 — Pickup Claim Arbitration
 *
 * Unified pickup effect resolution for procedural, qualifying, and builder pickups.
 * Ensures exactly-once collection semantics:
 *
 * - Same-tick arbitration: crossing fraction (earliest wins), then racer ID (lowest wins)
 * - Per-attempt qualifying claims: each attempt has isolated pickup state
 * - Shared racing claims: all racers share one pickup pool
 * - Generation-based respawn: collected pickups get a new generation on respawn
 * - Exactly-once events: effect and visual events fire exactly once per collection
 */

export interface PickupClaimRecord {
  readonly pickupId: string;
  readonly racerId: number;
  readonly crossingFraction: number;  // [0, 1] position within the tick
  readonly generation: number;
  readonly timestamp: number;
}

export interface PickupState {
  readonly id: string;
  readonly generation: number;
  readonly collectedBy: number | null;
  readonly collectedAt: number | null;
  readonly respawnAt: number | null;
}

export type PickupArbitrationMode = 'racing' | 'qualifying';

export interface PickupArbiterConfig {
  readonly mode: PickupArbitrationMode;
  readonly respawnDelay: number;  // seconds until respawn (0 = no respawn)
}

export interface PickupEffectEvent {
  readonly type: 'collected';
  readonly pickupId: string;
  readonly racerId: number;
  readonly generation: number;
  readonly effect: PickupEffectPayload;
  readonly timestamp: number;
}

export type PickupEffectPayload =
  | { kind: 'fuel'; amount: number }
  | { kind: 'shield'; duration: number }
  | { kind: 'spring'; count: number }
  | { kind: 'repair'; amount: number }
  | { kind: 'speed'; multiplier: number; duration: number };

/**
 * Manages pickup claim arbitration with exactly-once semantics.
 */
export class PickupArbiter {
  private readonly states = new Map<string, PickupState>();
  private readonly pendingClaims = new Map<string, PickupClaimRecord[]>();
  private readonly resolvedEvents: PickupEffectEvent[] = [];
  private readonly config: PickupArbiterConfig;
  private currentTime = 0;

  constructor(config: PickupArbiterConfig) {
    this.config = config;
  }

  /**
   * Register a pickup with the arbiter.
   */
  register(id: string, generation: number): void {
    this.states.set(id, {
      id,
      generation,
      collectedBy: null,
      collectedAt: null,
      respawnAt: null,
    });
  }

  /**
   * Register multiple pickups.
   */
  registerAll(pickups: readonly { id: string; generation: number }[]): void {
    for (const p of pickups) {
      this.register(p.id, p.generation);
    }
  }

  /**
   * Advance the clock.
   */
  setTime(time: number): void {
    this.currentTime = time;
  }

  /**
   * Submit a claim for a pickup. Returns true if the claim was recorded.
   * Multiple racers can submit claims in the same tick; arbitration happens at resolve().
   */
  submitClaim(
    pickupId: string,
    racerId: number,
    crossingFraction: number,
  ): boolean {
    const state = this.states.get(pickupId);
    if (!state) return false;
    if (state.collectedBy !== null) return false; // Already collected

    // Check if pickup has respawned
    if (state.respawnAt !== null && this.currentTime < state.respawnAt) {
      return false; // Not yet available
    }

    const claim: PickupClaimRecord = {
      pickupId,
      racerId,
      crossingFraction,
      generation: state.generation,
      timestamp: this.currentTime,
    };

    const pending = this.pendingClaims.get(pickupId) ?? [];
    pending.push(claim);
    this.pendingClaims.set(pickupId, pending);
    return true;
  }

  /**
   * Resolve all pending claims for the current tick.
   * Arbitration: earliest crossing fraction wins; ties broken by lowest racer ID.
   * Returns the resolved events (exactly one per pickup per tick).
   */
  resolve(
    effectProvider: (pickupId: string) => PickupEffectPayload | null,
  ): readonly PickupEffectEvent[] {
    const events: PickupEffectEvent[] = [];

    for (const [pickupId, claims] of this.pendingClaims) {
      if (claims.length === 0) continue;

      // Arbitrate: sort by crossing fraction, then racer ID
      claims.sort((a, b) => {
        if (a.crossingFraction !== b.crossingFraction) {
          return a.crossingFraction - b.crossingFraction;
        }
        return a.racerId - b.racerId;
      });

      const winner = claims[0];
      const state = this.states.get(pickupId);
      if (!state) continue;

      // Mark as collected
      const newState: PickupState = {
        ...state,
        collectedBy: winner.racerId,
        collectedAt: this.currentTime,
        respawnAt: this.config.respawnDelay > 0
          ? this.currentTime + this.config.respawnDelay
          : null,
      };
      this.states.set(pickupId, newState);

      // Generate effect event
      const effect = effectProvider(pickupId);
      if (effect) {
        events.push({
          type: 'collected',
          pickupId,
          racerId: winner.racerId,
          generation: winner.generation,
          effect,
          timestamp: this.currentTime,
        });
      }
    }

    this.pendingClaims.clear();
    this.resolvedEvents.push(...events);
    return Object.freeze(events);
  }

  /**
   * Check and process respawns for the current time.
   * Returns the IDs of pickups that have respawned.
   */
  processRespawns(): readonly string[] {
    const respawned: string[] = [];

    for (const [id, state] of this.states) {
      if (state.collectedBy === null) continue;
      if (state.respawnAt === null) continue;
      if (this.currentTime < state.respawnAt) continue;

      // Respawn: increment generation, clear collection
      const newGeneration = state.generation + 1;
      this.states.set(id, {
        id,
        generation: newGeneration,
        collectedBy: null,
        collectedAt: null,
        respawnAt: null,
      });
      respawned.push(id);
    }

    return Object.freeze(respawned);
  }

  /**
   * Get the current state of a pickup.
   */
  getState(pickupId: string): PickupState | undefined {
    return this.states.get(pickupId);
  }

  /**
   * Check if a pickup is currently available for collection.
   */
  isAvailable(pickupId: string): boolean {
    const state = this.states.get(pickupId);
    if (!state) return false;
    if (state.collectedBy === null) {
      // Check respawn timer
      if (state.respawnAt !== null && this.currentTime < state.respawnAt) {
        return false;
      }
      return true;
    }
    // Collected: check if respawned
    if (state.respawnAt !== null && this.currentTime >= state.respawnAt) {
      return true;
    }
    return false;
  }

  /**
   * Get all resolved events (history).
   */
  getHistory(): readonly PickupEffectEvent[] {
    return Object.freeze(this.resolvedEvents.slice());
  }

  /**
   * Reset the arbiter (for new attempt/race).
   */
  reset(): void {
    this.states.clear();
    this.pendingClaims.clear();
    this.resolvedEvents.length = 0;
    this.currentTime = 0;
  }

  /**
   * Create an isolated snapshot for a qualifying attempt.
   * The snapshot has its own independent state.
   */
  snapshot(): PickupArbiter {
    const clone = new PickupArbiter(this.config);
    clone.currentTime = this.currentTime;
    for (const [id, state] of this.states) {
      clone.states.set(id, { ...state });
    }
    return clone;
  }
}

/**
 * Create a racing arbiter (shared claims, all racers compete).
 */
export function createRacingArbiter(respawnDelay = 0): PickupArbiter {
  return new PickupArbiter({ mode: 'racing', respawnDelay });
}

/**
 * Create a qualifying arbiter (per-attempt isolated claims).
 */
export function createQualifyingArbiter(): PickupArbiter {
  return new PickupArbiter({ mode: 'qualifying', respawnDelay: 0 });
}
