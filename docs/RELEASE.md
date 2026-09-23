# T05 — Safe Release Reservations and Common-Start Race Timing

> Issue [#38](https://github.com/Piskriek/HeavyMetal2/issues/38) · Module `src/game/release/`

## Overview

T05 replaces the legacy simultaneous slingshot launch with a **wave-based release system**
that safely staggers racers from a frozen grid onto the track. The release is driven by
three pure modules:

| Module | Responsibility |
| --- | --- |
| `grid.ts` | Frozen grid: qualifying order → starting positions, lanes, exit speeds |
| `scheduler.ts` | Release plan: wave scheduling, corridor occupancy checks, reservations |
| `go-clock.ts` | Common GO clock: finish order, timeout, settling |

Everything is **pure TypeScript** — no DOM, no canvas, no three.js, no React. The engine
integrates these modules; the test suites exercise them headlessly.

## Design Decisions

### No pole-position teleport
Rank 1 sits at the front of the corridor, not ahead of it. The corridor's `to` boundary
is the hard limit. A racer cannot start beyond where the track physically begins.

### No ×1.08 boost
Every racer exits the grid at their exact qualifying gate speed. A fallback entry that
never crossed the gate gets `MIN_EXIT_SPEED` (120 engine units/s) so it can still be
released, but no racer gets an artificial speed advantage.

### No collision immunity for clearance
Spacing between released racers is real physical spacing, measured in world units. The
corridor's `minSpacing` is the safety floor; the preferred wave gap can be larger but
never smaller. A racer released 200 units behind another is 200 units behind, not
"immune to collision for 2 seconds."

### Wave spacing: preferred vs safety
The grid clamps the preferred wave spacing up to the corridor's safety minimum. This
decision is reported in diagnostics — the caller sees the clamp, not a silent repair.

### Lane count adapts to the corridor
If the corridor's `halfWidth` is too narrow for all four lanes, the grid reduces the
lane count and reports the reduction. A 200-unit corridor fits 2 lanes (at z=±120), not 4
(at z=±360).

### Stalled entries are flagged, not fixed
A racer with zero, negative, or NaN qualifying speed is flagged as `stalled` on the grid.
The scheduler decides whether to delay or DNF — the grid never silently assigns a speed.

## Units

| Quantity | Unit | Notes |
| --- | --- | --- |
| x, z | World units | Same as `scene.ts` |
| Speed | Engine units/s | HUD = speed × 0.16 |
| Time | Seconds | Ticks = seconds × 120 |
| Tick | 1/120 s | `FIXED_STEP` from timing contract |
| Spacing | World units | Corridor `minSpacing` |

## Acceptance Criteria → Evidence

| # | Criterion | Test Suite | Test Name |
| --- | --- | --- | --- |
| 1 | Slow leader/fast follower | `release-scheduler` | `a slow leader is never rear-ended by a fast follower during release` |
| 2 | Stopped leader and invalid speed | `release-scheduler` | `a stalled racer is flagged but the release continues` |
| 3 | One to four valid lanes | `release-scheduler` | `releases correctly with N lane(s)` (1-4) |
| 4 | Narrowing mapped track | `release-scheduler` | `wave spacing adapts to a corridor with large minSpacing` |
| 5 | Blocked exit | `release-scheduler` | `flags a wave as blocked when the corridor is permanently occupied` |
| 6 | Delayed earlier pole entries | `release-scheduler` | `delays a wave when occupancy is temporary, then releases it` |
| 7 | Acceleration during reserved horizon | `release-scheduler` | `reservations hold the slot for the declared horizon` |
| 8 | Clearance at actual emergence | `release-scheduler` | `the executor checks occupancy at each release tick` |
| 9 | Common-start finish accounting | `release-scheduler` | `finish order is by absolute finish tick` |
| 10 | Report actual total release span | `release-scheduler` | `reports the actual total release span without enforcing a target` |

## API Summary

### Grid

```ts
import { buildFrozenGrid, gridSpawnPoints, poleSlot } from '@/game/release';

const { grid, diagnostics } = buildFrozenGrid(rankedEntries, {
  corridor: defaultReleaseCorridor(),
  preferredWaveSpacing: 200,
  laneCount: 4,
  preferredLanes: { 0: 3 },  // racer 0 wants lane 3
});
```

### Scheduler

```ts
import { computeReleasePlan, ReleaseExecutor, CLEAR_OCCUPANCY } from '@/game/release';

const { plan } = computeReleasePlan(grid, occupancyProvider, {
  waveGapSeconds: 0.5,
  blockedTimeoutSeconds: 6,
});

// Runtime: step through the plan with live occupancy checks.
const executor = new ReleaseExecutor(grid, plan, liveOccupancy);
const released = executor.run();
```

### GO Clock

```ts
import { GoClock, computeFinishOrder } from '@/game/release';

const clock = new GoClock({ goTick: plan.goTick, timeoutSeconds: 300, participants });
// Each tick:
clock.tick();
// When a racer finishes:
clock.recordFinish(racerId, finishTick);
// When settled:
const results = clock.results; // sorted by position
```

## Constants

| Constant | Value | Purpose |
| --- | --- | --- |
| `MIN_EXIT_SPEED` | 120 | Floor for stalled racers |
| `DEFAULT_WAVE_SPACING` | RADIUS × 6 | Default preferred wave gap |
| `DEFAULT_STAGGER_X` | RADIUS × 1.2 | Lateral stagger within a wave |
| `MAX_GRID_LANES` | 4 | Maximum lanes the grid assigns |
| `DEFAULT_WAVE_GAP_SECONDS` | 0.5 | Default time gap between waves |
| `DEFAULT_RESERVATION_HORIZON_SECONDS` | 3 | Reservation hold time |
| `DEFAULT_BLOCKED_TIMEOUT_SECONDS` | 6 | Blocked-lane timeout |
| `MAX_RELEASE_SPAN_SECONDS` | 30 | Hard ceiling on release duration |

## Open Limits

- **No browser verification**: headless Chromium in this workspace has no WebGL context
  (same blocker T00/T04 recorded). The release module is pure and exercised headlessly,
  but integration with the visual engine is not yet tested in a browser.
- **No UI wiring**: T06's scope. The hooks are `grid.slots`, `plan.waves`,
  `executor.releasedSlots`, and `clock.results`.
- **syntheticField stands in for T02's roster**: grids above four use the synthetic
  field generator; replace with the real roster when T02 lands.
