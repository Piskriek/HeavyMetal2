/**
 * T07 — narrow-phase contact detection and resolution
 *
 * Takes candidate pairs from the broad phase and performs precise collision
 * tests. Resolves contacts with proper impulse exchange, penetration correction,
 * and lateral shove.
 *
 * Key design decisions:
 * - Fixed iteration budget (3 passes) for stable stacking
 * - Deterministic normal calculation (coincident centers use z-axis)
 * - Shield absorbs impulse but NOT penetration (prevents tunneling)
 * - Separate physical response from audio/particle events
 */

import type { Racer } from '../racers';
import { RADIUS, LANE, closestLane } from '../scene';
import type { CandidatePair, Contact, CollisionEvent } from './types';

const COLLISION_DIAMETER = RADIUS * 2 + 4;
const CONTACT_ITERATIONS = 3;

/**
 * Detect contacts from candidate pairs.
 * Returns only pairs that are actually colliding.
 */
export function detectContacts(
  candidates: readonly CandidatePair[],
  racers: readonly Racer[],
): Contact[] {
  const contacts: Contact[] = [];

  for (const pair of candidates) {
    const { a, b, dx, dy, dz, distance } = pair;

    if (distance >= COLLISION_DIAMETER) continue;
    if (Math.abs(dy) > RADIUS * 1.55) continue;

    // Compute contact normal
    let nx: number, ny: number, nz: number;

    if (distance < 0.001) {
      // Coincident centers: use z-axis as deterministic fallback
      nx = 0;
      ny = 0;
      nz = 1;
    } else {
      const planar = Math.hypot(dx, dz) || 1;
      nx = dx / planar;
      ny = 0;
      nz = dz / planar;
    }

    // Relative velocity along normal
    const racerA = racers[a];
    const racerB = racers[b];
    const relVel = (racerB.vx - racerA.vx) * nx + (racerB.vz - racerA.vz) * nz;

    const penetration = COLLISION_DIAMETER - distance;

    contacts.push({
      pair,
      normal: { x: nx, y: ny, z: nz },
      penetration,
      relativeVelocity: relVel,
    });
  }

  return contacts;
}

/**
 * Resolve contacts with impulse exchange and penetration correction.
 * Returns collision events for audio/particles (separate from physics).
 *
 * @param contacts - detected contacts
 * @param racers - mutable racer array
 * @param time - current simulation time
 * @param cooldownCheck - function to check if a pair is on cooldown
 * @param cooldownSet - function to set cooldown for a pair
 * @param absorbShield - function to absorb a racer's shield (returns true if absorbed)
 */
export function resolveContacts(
  contacts: readonly Contact[],
  racers: Racer[],
  time: number,
  cooldownCheck: (a: number, b: number) => boolean,
  cooldownSet: (a: number, b: number) => void,
  absorbShield: (racer: Racer) => boolean,
): CollisionEvent[] {
  const events: CollisionEvent[] = [];

  // Fixed iteration budget for stable resolution
  for (let iter = 0; iter < CONTACT_ITERATIONS; iter++) {
    for (const contact of contacts) {
      const { pair, normal, penetration } = contact;
      const { a, b } = pair;
      const racerA = racers[a];
      const racerB = racers[b];

      // Check immunity
      if (time < racerA.immuneUntil || time < racerB.immuneUntil) continue;

      // Penetration correction (always applied, even with shield)
      const sum = racerA.weight + racerB.weight;
      const correction = penetration * 0.55 / CONTACT_ITERATIONS;

      racerA.x -= normal.x * correction * racerB.weight / sum;
      racerB.x += normal.x * correction * racerA.weight / sum;
      racerA.z -= normal.z * correction * racerB.weight / sum;
      racerB.z += normal.z * correction * racerA.weight / sum;

      // Clamp z to lane bounds
      racerA.z = Math.max(LANE.near + RADIUS + 6, Math.min(LANE.far - RADIUS - 6, racerA.z));
      racerB.z = Math.max(LANE.near + RADIUS + 6, Math.min(LANE.far - RADIUS - 6, racerB.z));
    }
  }

  // Impulse exchange (once per contact, respects cooldown)
  for (const contact of contacts) {
    const { pair, normal, relativeVelocity } = contact;
    const { a, b } = pair;

    if (cooldownCheck(a, b)) continue;

    const racerA = racers[a];
    const racerB = racers[b];

    // Absorb shields
    const shieldA = absorbShield(racerA);
    const shieldB = absorbShield(racerB);

    // Impulse exchange (only if approaching)
    if (relativeVelocity < 0) {
      const impulse = -(1.38 * relativeVelocity) / (1 / racerA.weight + 1 / racerB.weight);

      if (!shieldA) {
        racerA.vx = Math.max(100, Math.min(racerA.maximumSpeed, racerA.vx - impulse * normal.x / racerA.weight));
      }
      if (!shieldB) {
        racerB.vx = Math.max(100, Math.min(racerB.maximumSpeed, racerB.vx + impulse * normal.x / racerB.weight));
      }
    }

    // Lateral shove
    let side = Math.abs(pair.dz) > 8
      ? Math.sign(pair.dz)
      : (closestLane(racerB.z) === 0 ? -1 : closestLane(racerB.z) === 3 ? 1 : ((a + b) % 2 ? 1 : -1));
    if (!side) side = 1;

    const closing = Math.min(380, Math.abs(racerA.vx - racerB.vx) + Math.abs(racerA.vz - racerB.vz));
    const kick = 270 + closing * 0.22;

    if (!shieldA) {
      applyShove(racerA, -side, kick * Math.min(1.65, racerB.weight / racerA.weight), time);
    }
    if (!shieldB) {
      applyShove(racerB, side, kick * Math.min(1.65, racerA.weight / racerB.weight), time);
    }

    // Set cooldown
    cooldownSet(a, b);

    // Generate collision event for audio/particles
    const midX = (racerA.x + racerB.x) / 2;
    const midY = (racerA.y + racerB.y) / 2;
    const midZ = (racerA.z + racerB.z) / 2;
    const severity = Math.min(1, closing / 400);

    if (shieldA || shieldB) {
      events.push({
        type: 'shield-absorb',
        racerA: a,
        racerB: b,
        position: { x: midX, y: midY, z: midZ },
        severity,
        timestamp: time,
      });
    } else {
      events.push({
        type: 'bump',
        racerA: a,
        racerB: b,
        position: { x: midX, y: midY, z: midZ },
        severity,
        timestamp: time,
      });
    }
  }

  return events;
}

function applyShove(racer: Racer, direction: number, speed: number, time: number): void {
  const lane = closestLane(racer.z);
  racer.targetLane = Math.max(0, Math.min(3, lane - Math.sign(direction)));
  racer.vz = Math.max(-650, Math.min(650, racer.vz + direction * speed));
  racer.z = Math.max(LANE.near + RADIUS + 6, Math.min(LANE.far - RADIUS - 6, racer.z + direction * 5));
  racer.steerLockedUntil = time + 0.28 * racer.bumpRecovery;
  racer.bumpAt = time;
  racer.lastLaneChange = time;
}
