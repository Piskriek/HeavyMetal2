# P7: Loop Merge Pool Staging — Queue Waiting Racers up the Incline

- **ID**: `P7`
- **Priority**: Polish
- **Component**: Merge Pool Staging / Visual Staging / Immersion
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
In `src/game/merge/pool.ts:200`, when up to 25 waiting AI racers are assigned to each of the four staging lanes at the loop merge gate, all racers assigned to a given lane share the exact same longitudinal coordinate (`slotZ = laneZ(index % 4)` with identical $X$). As a result, 25 balls clip and stack into a single overlapping clump while waiting for the release gate to fire. Space waiting racers up the approach hill with realistic bumper spacing (one ball diameter plus padding), creating an orderly, impressive four-column queue of revving marbles waiting their turn.

---

## Evidence
- `src/game/merge/pool.ts:200`:
  `entry.slotZ = laneZ(index % 4);`
  Sets lateral coordinate by lane rank, but longitudinal position sits on a static line across all queue members.
- `src/game/merge/pool.ts:233`: All staged entrants in a lane collapse onto the same $X$ coordinate on the pad.
- In 100-racer heats, arriving at the pool gate reveals four dense, flickering balls made of 25 intersecting 3D spheres.

---

## Solution
1. **Longitudinal Queue Offset**:
   - In `src/game/merge/pool.ts`, calculate each racer's row in their lane:
     ```typescript
     const laneRank = Math.floor(index / LANE_COUNT);
     const BALL_SPACING = (RADIUS * 2.5) * 2 + 16; // One 2.5x ball diameter plus safety gap
     entry.slotX = poolPadX - laneRank * BALL_SPACING;
     entry.slotZ = laneZ(index % LANE_COUNT);
     ```
2. **Surface Snapping**:
   - In `engine.ts` and `racer-physics.ts`, position queued racers resting on the road surface:
     `racer.y = world.surfaceAt(entry.slotX, entry.slotZ).y - RADIUS * 2.5;`
3. **Queue Advance**:
   - As the front row launches through the gate, advance subsequent rows forward along their lane path toward the starting line.

### Files Allowed to Change
- `src/game/merge/pool.ts`
- `src/game/engine.ts`
- `tests/merge-pool.test.ts`
- `tests/merge-race.test.ts`

### Must NOT Change
- Release scheduling intervals (`release-scheduler.ts`)
- Merge gate admission order

---

## Acceptance Criteria
- [ ] Waiting racers queue in four tidy, legible columns up the hill behind the gate.
- [ ] No two waiting marbles clip through or overlap each other.
- [ ] Rows advance forward smoothly as leading racers are released onto the track.
- [ ] `tests/merge-pool.test.ts` and `tests/merge-race.test.ts` pass cleanly.

---

## Tests to Run
- `node --import tsx --test tests/merge-pool.test.ts`
- `node --import tsx --test tests/merge-race.test.ts`
- `node scripts/check.mjs`
