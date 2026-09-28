/**
 * T07 — collision types
 *
 * Shared type definitions for the collision system.
 */

/** A candidate pair for collision testing */
export interface CandidatePair {
  readonly a: number;  // racer index
  readonly b: number;  // racer index
  readonly dx: number; // b.x - a.x
  readonly dy: number; // b.y - a.y
  readonly dz: number; // b.z - a.z
  readonly distance: number;
}

/** A contact between two racers */
export interface Contact {
  readonly pair: CandidatePair;
  readonly normal: { x: number; y: number; z: number };
  readonly penetration: number;
  readonly relativeVelocity: number;
}

/** Collision event for audio/particles (separate from physics) */
export interface CollisionEvent {
  readonly type: 'bump' | 'shield-absorb' | 'shield-block';
  readonly racerA: number;
  readonly racerB: number;
  readonly position: { x: number; y: number; z: number };
  readonly severity: number; // 0-1, for audio volume / particle count
  readonly timestamp: number;
}

/** Spatial hash cell */
export interface HashCell {
  readonly key: string;
  readonly racers: number[];
}

/** Broad phase statistics */
export interface BroadPhaseStats {
  readonly racerCount: number;
  readonly candidateCount: number;
  readonly contactCount: number;
  readonly occupancy: number; // avg racers per occupied cell
  readonly timingMs: number;
}
