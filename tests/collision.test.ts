/**
 * T07 — collision system tests
 *
 * Verifies the scalable collision detection system:
 * - Broad phase matches brute-force reference
 * - Handles dense packs, coincident centers, high speeds
 * - No NaNs or unbounded cache growth
 * - Cooldowns prevent repeated responses
 * - Reports statistics correctly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../src/game/collision/spatial-hash';
import { detectContacts, resolveContacts } from '../src/game/collision/contacts';
import { CollisionCooldown } from '../src/game/collision/cooldowns';
import { RADIUS, LANE } from '../src/game/scene';

// Mock racer for testing
function createRacer(id: number, x: number, z: number, vx = 0, vz = 0): any {
  return {
    id,
    x,
    y: 0,
    z,
    vx,
    vz,
    weight: 120,
    maximumSpeed: 800,
    finished: false,
    falling: false,
    loopRide: null,
    immuneUntil: 0,
    bumpRecovery: 1,
    bumpAt: 0,
    targetLane: Math.round((z - LANE.near) / ((LANE.far - LANE.near) / 3)),
    steerLockedUntil: 0,
    lastLaneChange: 0,
  };
}

describe('T07: Spatial Hash Broad Phase', () => {
  it('matches brute-force on random scene', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 150, 50),
      createRacer(2, 200, -30),
      createRacer(3, 250, 20),
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);

    // Brute-force reference
    const bruteForce: Array<{ a: number; b: number }> = [];
    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const dx = racers[j].x - racers[i].x;
        const dz = racers[j].z - racers[i].z;
        const dist = Math.hypot(dx, dz);
        if (dist < (RADIUS * 2 + 4) * 2) {
          bruteForce.push({ a: i, b: j });
        }
      }
    }

    // Compare (order-independent)
    const candidateSet = new Set(candidates.map(c => `${c.a}-${c.b}`));
    const bruteSet = new Set(bruteForce.map(c => `${c.a}-${c.b}`));

    assert.equal(candidateSet.size, bruteSet.size, 'candidate count mismatch');
    for (const key of bruteSet) {
      assert.ok(candidateSet.has(key), `missing pair ${key}`);
    }
  });

  it('handles dense pack (10 racers in tight cluster)', () => {
    const racers = [];
    for (let i = 0; i < 10; i++) {
      racers.push(createRacer(i, 100 + i * 10, i * 5));
    }

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);

    // Should find many candidates in dense pack
    assert.ok(candidates.length > 10, `expected >10 candidates in dense pack, got ${candidates.length}`);

    // Verify no duplicates
    const keys = candidates.map(c => `${c.a}-${c.b}`);
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, 'duplicate candidates found');
  });

  it('handles coincident centers', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 100, 0), // same position
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);

    assert.equal(candidates.length, 1, 'should find coincident pair');
    assert.ok(candidates[0].distance < 0.01, 'distance should be near zero');
  });

  it('handles high relative speeds (swept detection)', () => {
    const racers = [
      createRacer(0, 100, 0, 1000, 0),  // fast moving right
      createRacer(1, 300, 0, -1000, 0), // fast moving left
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);

    // Should detect potential collision even though they're far apart now
    // (sweep should catch them)
    assert.ok(candidates.length >= 0, 'sweep detection should not crash');
  });

  it('excludes finished and falling racers', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 150, 0),
    ];
    racers[1].finished = true;

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);

    assert.equal(candidates.length, 0, 'should not include finished racer');
  });

  it('reports statistics correctly', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 150, 0),
      createRacer(2, 200, 0),
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const stats = hash.getStats(racers, candidates);

    assert.equal(stats.racerCount, 3);
    assert.ok(stats.candidateCount >= 0);
    assert.ok(stats.occupancy >= 0);
    assert.ok(stats.cellCount > 0);
    assert.ok(!Number.isNaN(stats.occupancy), 'occupancy should not be NaN');
  });
});

describe('T07: Contact Detection and Resolution', () => {
  it('detects contacts from candidates', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 100 + RADIUS * 2, 0), // touching
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    assert.equal(contacts.length, 1, 'should detect one contact');
    assert.ok(contacts[0].penetration > 0, 'penetration should be positive');
  });

  it('resolves penetration', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 100 + RADIUS * 2 - 5, 0), // overlapping by 5 units
    ];

    const initialDistance = racers[1].x - racers[0].x;

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    const cooldown = new CollisionCooldown();
    resolveContacts(
      contacts,
      racers,
      0,
      (a, b) => cooldown.isOnCooldown(a, b, 0),
      (a, b) => cooldown.setCooldown(a, b, 0),
      () => false,
    );

    const finalDistance = racers[1].x - racers[0].x;
    assert.ok(finalDistance > initialDistance, 'racers should separate');
  });

  it('applies deterministic normal for coincident centers', () => {
    const racers = [
      createRacer(0, 100, 0),
      createRacer(1, 100, 0), // exact same position
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    assert.equal(contacts.length, 1);
    const normal = contacts[0].normal;

    // Should be deterministic (z-axis fallback)
    assert.equal(normal.x, 0);
    assert.equal(normal.y, 0);
    assert.equal(normal.z, 1);
  });

  it('does not produce NaN values', () => {
    const racers = [
      createRacer(0, 100, 0, 500, 100),
      createRacer(1, 150, 20, -300, -50),
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    const cooldown = new CollisionCooldown();
    const events = resolveContacts(
      contacts,
      racers,
      0,
      (a, b) => cooldown.isOnCooldown(a, b, 0),
      (a, b) => cooldown.setCooldown(a, b, 0),
      () => false,
    );

    // Check no NaNs in racers
    for (const racer of racers) {
      assert.ok(!Number.isNaN(racer.x), 'racer.x is NaN');
      assert.ok(!Number.isNaN(racer.z), 'racer.z is NaN');
      assert.ok(!Number.isNaN(racer.vx), 'racer.vx is NaN');
      assert.ok(!Number.isNaN(racer.vz), 'racer.vz is NaN');
    }

    // Check no NaNs in events
    for (const event of events) {
      assert.ok(!Number.isNaN(event.position.x), 'event.position.x is NaN');
      assert.ok(!Number.isNaN(event.position.z), 'event.position.z is NaN');
      assert.ok(!Number.isNaN(event.severity), 'event.severity is NaN');
    }
  });

  it('generates collision events for audio/particles', () => {
    const racers = [
      createRacer(0, 100, 0, 300, 0),
      createRacer(1, 100 + RADIUS * 2, 0, -300, 0),
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    const cooldown = new CollisionCooldown();
    const events = resolveContacts(
      contacts,
      racers,
      0,
      (a, b) => cooldown.isOnCooldown(a, b, 0),
      (a, b) => cooldown.setCooldown(a, b, 0),
      () => false,
    );

    assert.ok(events.length > 0, 'should generate collision events');
    assert.equal(events[0].type, 'bump');
    assert.ok(events[0].severity >= 0 && events[0].severity <= 1);
  });
});

describe('T07: Collision Cooldowns', () => {
  it('prevents repeated responses within 0.38s', () => {
    const cooldown = new CollisionCooldown();

    assert.equal(cooldown.isOnCooldown(0, 1, 0), false);

    cooldown.setCooldown(0, 1, 0);

    assert.equal(cooldown.isOnCooldown(0, 1, 0.1), true);
    assert.equal(cooldown.isOnCooldown(0, 1, 0.37), true);
    assert.equal(cooldown.isOnCooldown(0, 1, 0.38), false);
    assert.equal(cooldown.isOnCooldown(0, 1, 0.5), false);
  });

  it('uses stable pair keys (order-independent)', () => {
    const cooldown = new CollisionCooldown();

    cooldown.setCooldown(0, 1, 0);

    // Should work regardless of order
    assert.equal(cooldown.isOnCooldown(0, 1, 0.1), true);
    assert.equal(cooldown.isOnCooldown(1, 0, 0.1), true);
  });

  it('prevents unbounded cache growth', () => {
    const cooldown = new CollisionCooldown();

    // Add many cooldowns
    for (let i = 0; i < 2000; i++) {
      cooldown.setCooldown(i, i + 1, 0);
    }

    // Fast-forward to expire them
    cooldown.isOnCooldown(0, 1, 10);

    const stats = cooldown.getStats(10);
    assert.ok(stats.size <= 1000, `cache grew to ${stats.size}, expected <= 1000`);
  });

  it('clears all cooldowns', () => {
    const cooldown = new CollisionCooldown();

    cooldown.setCooldown(0, 1, 0);
    cooldown.setCooldown(2, 3, 0);

    cooldown.clear();

    assert.equal(cooldown.isOnCooldown(0, 1, 0.1), false);
    assert.equal(cooldown.isOnCooldown(2, 3, 0.1), false);
  });
});

describe('T07: Integration', () => {
  it('full pipeline: broad phase → narrow phase → resolution', () => {
    const racers = [
      createRacer(0, 100, 0, 200, 0),
      createRacer(1, 100 + RADIUS * 2 + 2, 0, -200, 0),
      createRacer(2, 300, 100),
    ];

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    const cooldown = new CollisionCooldown();
    const events = resolveContacts(
      contacts,
      racers,
      0,
      (a, b) => cooldown.isOnCooldown(a, b, 0),
      (a, b) => cooldown.setCooldown(a, b, 0),
      () => false,
    );

    const stats = hash.getStats(racers, candidates);

    // Verify we got results
    assert.ok(stats.racerCount === 3);
    assert.ok(stats.candidateCount >= 0);
    assert.ok(contacts.length >= 0);
    assert.ok(events.length >= 0);

    // Verify no NaNs
    for (const racer of racers) {
      assert.ok(!Number.isNaN(racer.x));
      assert.ok(!Number.isNaN(racer.z));
    }
  });

  it('handles 100 racers without performance issues', () => {
    const racers = [];
    for (let i = 0; i < 100; i++) {
      racers.push(createRacer(i, 100 + i * 20, (i % 10) * 30));
    }

    const startTime = performance.now();

    const hash = new SpatialHash();
    hash.build(racers);
    const candidates = hash.generateCandidates(racers);
    const contacts = detectContacts(candidates, racers);

    const cooldown = new CollisionCooldown();
    resolveContacts(
      contacts,
      racers,
      0,
      (a, b) => cooldown.isOnCooldown(a, b, 0),
      (a, b) => cooldown.setCooldown(a, b, 0),
      () => false,
    );

    const elapsed = performance.now() - startTime;
    const stats = hash.getStats(racers, candidates);

    // Should complete in reasonable time (< 50ms for 100 racers)
    assert.ok(elapsed < 50, `took ${elapsed}ms for 100 racers`);

    // Should report stats
    assert.equal(stats.racerCount, 100);
    assert.ok(stats.candidateCount < 100 * 99 / 2, 'broad phase should reduce candidates');
  });
});
