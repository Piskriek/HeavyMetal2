# P6: Continuous Wall-Scrape Sparks and Friction Audio

- **ID**: `P6`
- **Priority**: Polish
- **Component**: Visual FX / Particle System / Audio
- **Conflicts with**: `P9`
- **Needs art**: No

---

## Goal
When marbles are bumped or drift into the outer retaining walls and tree-line barriers, the physics clamps lateral position and applies frictional damping, but generates no sustained particle or audio feedback. Add a continuous shower of bright friction sparks and a grinding metal screech sound effect while a marble scrapes against the road boundary walls at speed ($|z| \ge \text{LANE\_Z\_LIMIT} - 10$ and $v_x > 120$).

---

## Evidence
- `src/game/sim/racer-physics.ts:411-414`: Clamps lateral position `racer.z = clamp(racer.z + racer.vz * dt, lane.zMin, lane.zMax)`. If the wall is struck, velocity is dampened, but no persistent contact event is dispatched.
- `src/game/effects/renderer-fx.ts:1-200`: Supports instantaneous `'sparks'` and `'impact'` bursts, but lacks a continuous wall-scraping emitter.

---

## Solution
1. **Wall Contact Detection**:
   - In `src/game/sim/racer-physics.ts`, detect when a racer's lateral coordinate contacts the road corridor limits:
     ```typescript
     const isScrapingWall = racer.grounded && (racer.z <= lane.zMin + 2 || racer.z >= lane.zMax - 2) && racer.vx > 120;
     ```
2. **Spark Emitter**:
   - In `src/game/effects/renderer-fx.ts`, spawn continuous tangential spark streams:
     - Tangent direction: backwards along track vector $(-v_x)$.
     - Color: bright orange/yellow embers (`#ffcc44`).
     - Lifetime: 0.15s – 0.3s with gravity drop.
3. **Friction Audio**:
   - In `src/game/audio.ts`, synthesize a looped grinding metal scrape modulated by $v_x$ and contact pressure, stopping immediately when the marble steers clear of the barrier.

### Files Allowed to Change
- `src/game/sim/racer-physics.ts`
- `src/game/effects/renderer-fx.ts`
- `src/game/audio.ts`
- `src/game/engine.ts`
- `tests/effects.test.ts`

### Must NOT Change
- Physical road corridor boundary limits

---

## Acceptance Criteria
- [ ] Riding along the edge barrier produces an immediate, continuous rooster tail of metal sparks.
- [ ] Audio plays a gritty metal friction scrape that scales with speed.
- [ ] Sparks cease instantly when steering away from the wall.
- [ ] `tests/effects.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/effects.test.ts`
- `node scripts/check.mjs`
