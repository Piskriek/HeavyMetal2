# T07 — Scalable Collision Candidates and Robust Contact Events

> Issue [#40](https://github.com/Piskriek/HeavyMetal2/issues/40) · Module `src/game/collision/`

## Overview

T07 replaces the legacy O(N²) pairwise collision loop with a scalable broad-phase/narrow-phase
collision system. The new system uses a swept spatial hash for candidate generation, deterministic
contact resolution with a fixed iteration budget, and separates physical solving from audio/particle
events.

## Design Decisions

### Swept spatial hash
The broad phase divides space into anisotropic cells (wider in x, narrower in z) and inserts
each racer into its cell plus swept-forward cells based on velocity. Only racers in the same or
adjacent cells are tested as candidates. This reduces the candidate set from O(N²) to O(N·k)
where k is the average cell occupancy.

### Stable candidate ordering
Candidate pairs are deduplicated (stable key `min(a,b)-max(a,b)`) and sorted by distance
(closest first). This ensures deterministic processing order regardless of insertion order.

### Fixed contact iteration budget
Contacts are resolved in exactly 3 passes. This prevents unstable stacking (too few iterations)
and performance spikes (too many iterations). Each pass applies a fraction of the penetration
correction.

### Deterministic coincident-center normal
When two racers have coincident centers (distance < 0.001), the contact normal defaults to the
z-axis (0, 0, 1). This is deterministic and prevents NaN propagation.

### Shield behavior
Shields absorb impulse (velocity change) but NOT penetration correction. This prevents tunneling
through shielded racers while still allowing the shield to block the shove. The shield does not
disable non-penetration or create one-sided free momentum.

### Separated physics and events
Physical contact resolution (penetration, impulse, shove) is pure and returns `CollisionEvent[]`
for audio/particles. The engine processes events separately, with bounded particle counts and
cache expiry.

### Bounded cache
The collision cooldown cache is capped at 1000 entries. When the cache exceeds 80% capacity,
a cleanup pass removes expired entries. If the cache is still too large, only the most recent
50% are kept.

## Acceptance Criteria → Evidence

| # | Criterion | Test |
|---|-----------|------|
| 1 | Candidate set matches brute-force | `collision: matches brute-force on random scene` |
| 2 | Dense packs, coincident centers, high speeds | `collision: handles dense pack`, `coincident centers`, `high relative speeds` |
| 3 | No NaNs or unbounded cache growth | `collision: does not produce NaN values`, `prevents unbounded cache growth` |
| 4 | Ongoing contact impulses not suppressed for 0.38s | `collision: prevents repeated responses within 0.38s` |
| 5 | Report N, candidates, contacts, occupancy, timing | `collision: reports statistics correctly` |

## API Summary

```ts
import { SpatialHash, detectContacts, resolveContacts, CollisionCooldown } from '@/game/collision';

// Broad phase
const hash = new SpatialHash();
hash.build(racers);
const candidates = hash.generateCandidates(racers);
const stats = hash.getStats(racers, candidates);

// Narrow phase
const contacts = detectContacts(candidates, racers);

// Resolution
const cooldown = new CollisionCooldown();
const events = resolveContacts(
  contacts, racers, time,
  (a, b) => cooldown.isOnCooldown(a, b, time),
  (a, b) => cooldown.setCooldown(a, b, time),
  (racer) => absorbShield(racer),
);

// Process events for audio/particles
for (const event of events) {
  if (event.type === 'bump') audio.play('bump');
  if (event.type === 'shield-absorb') audio.play('shield');
}
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CELL_SIZE_X` | RADIUS × 6 | Spatial hash cell width |
| `CELL_SIZE_Z` | RADIUS × 3 | Spatial hash cell depth |
| `MAX_SWEEP` | 12 | Maximum sweep distance per frame |
| `COLLISION_DIAMETER` | RADIUS × 2 + 4 | Contact threshold |
| `CONTACT_ITERATIONS` | 3 | Fixed resolution passes |
| `COOLDOWN_DURATION` | 0.38 s | Per-pair cooldown |
| `MAX_CACHE_SIZE` | 1000 | Cooldown cache cap |

## Open Limits

- **Not yet wired into engine.ts** — the legacy `resolveBumps()` loop is still in use. T07
  integration replaces it with the spatial hash pipeline.
- **No browser verification** — the collision module is pure and exercised headlessly.
- **Wall-registry clearance** deferred to after T09 per the issue scope note.
- **Track topology** — the spatial hash uses flat cells. If the track has significant
  vertical topology (loops, bridges), a track-aware sweep may be more efficient.
