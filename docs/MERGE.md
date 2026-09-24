# M01 · T2 — The First-Loop Merge Pool

> Interface `IF-MERGE` · Module `src/game/merge/pool.ts` · Overlay `src/components/MergePoolOverlay.tsx`

## Overview

T2 replaces the legacy checkpoint — a hard-coded x, a `setInterval` countdown, and four racers
teleported onto a line — with a **merge pool** at the first loop. The rule the game plays by is
one sentence: **you come out of the first loop in the order you went into it.**

Three modules carry it:

| Piece | Responsibility |
| --- | --- |
| `src/game/merge/pool.ts` | The pool itself: the queue, the ready window, the countdown, the ordered release, the refusals. Pure TypeScript — no DOM, no three.js, no React. |
| `src/game/sim/racer-physics.ts` | The **held** branch: a queued rider is pinned to the gate plane and glides laterally into their slot. |
| `src/game/engine.ts` | The wiring: gate crossing → `enter`, occupancy → `step`, release → the ring, ghosts, status, snapshot. |

What the player sees is the **merge-pool overlay**
(`src/components/MergePoolOverlay.tsx` + `src/merge-pool-overlay.css`, mounted by `RaceScreen` and
by the map editor's test run),
driven entirely by `snapshot.merge`.

## The ordering law

Entry order is the order the gate plane was crossed in, measured as `tick + fraction`, with exact
ties broken by racer id. That is the *only* input to the queue: pace, weight, loadout and who is
player do not enter into it.

The exit order is then forced by construction:

1. **`enter`** puts a rider in the queue and `reindex()` gives them a `rank` (their place in that
   sorted queue) and a `slotZ` (`laneZ(rank % 4)` — the four authored lanes, in order).
2. **Ready**: bots ready at `entryTick + BOT_READY_BASE_TICKS + BOT_READY_RANK_TICKS · rank`, so a
   later entry can never ready ahead of an earlier one. The player may ready at any time, and is
   readied for them at `PLAYER_AUTO_READY_TICKS` so a table that walks away cannot hold the field.
3. **The window** closes as soon as every expected rider is queued, or at
   `POOL_MAX_WAIT_TICKS` after **the player's own crossing** — whichever comes first. That starts
   `COUNTDOWN_TICKS` of countdown (`3`, `2`, `1`, then `GO!` for its own 60-tick window).
4. **The release** is one rider at a time, `RELEASE_GAP_TICKS` apart, always `pool.next` — the
   best-placed queued rider, which is the original entry order.
5. **The ghost**: a released rider is intangible until `MERGE_GHOST_TAIL_S` after they leave the
   ring, and the next rider is not released until the previous one has cleared the ring
   (`previousProgress` occupancy, retried every `RELEASE_RETRY_TICKS`, forced after
   `RELEASE_MAX_RETRIES`). Riders in the ring are excluded from contact anyway, so no two riders
   can ever be in the ring together.

`tests/merge-race.test.ts` drives exactly this — with the shipping physics and the shipping contact
pass — over **100 push seeds on `ridge` and 24 on each of `boomtown` and `sheep`**, and asserts
`exitOrder === entryOrder` every time, with riders leaving the ring at least 200 x-units apart.

## The player's split

The run from the grid to the first loop is the first **split** of the course, and it is the player's
own: it runs from the shove to the gate plane, and the number it produces is their queue time. Two
rules protect it (M01 · T1b, after the player asked for exactly this):

* **The window has no clock of its own while the player is on approach.** `step` closes the pool on
  `allHeld` or on `graceTick + POOL_MAX_WAIT_TICKS`, and `graceTick` is *the player's own crossing*
  — `null` until they arrive. So a field that queues early waits for a player still racing the first
  stretch, however long that takes, and the player is not flagged `late` for a gate they never had a
  race to reach. Once they are in the queue the grace is theirs: the field waits out the same 1200
  ticks for them that it always waited for a straggler.
* **The overlay does not offer a READY before they are in the pool.** `poolIsWaiting` (entries with
  no player entry) swaps the ready-up panel for a **split board**: the live clock
  (`formatSplit(raceTime)`), the field's queue as news, and no button. The READY panel appears on the
  tick the player's own entry exists — which, with the whole field held, is the same tick the window
  closes, so the panel's first frame is already telling them the truth about who is waiting on whom.

The backstop is deliberate: a player wrecked, out of bounds or stuck before the gate would otherwise
hold the race for ever. `POOL_PLAYER_GRACE_TICKS` (50 s, from the field's first arrival) closes the
window anyway, and a rider who crosses after that is `late` — flagged, never dropped, exactly as
before. `occupancy.expected` counts racers who are still in the race, so a rider who is genuinely out
does not even reach that deadline: the window closes as soon as the remaining field is held.

## Holding a rider

A queued rider is not parked in a static pose. `stepRacer`'s held branch keeps the ball rolling
(`advanceRoll`) and glides it laterally with the same PD form the wet-weather steering uses:

```
steering = (slotZ − z) · HELD_RESPONSE − vz · HELD_DAMPING
```

x is pinned to the gate plane (the crossing snap-back is at most one tick of motion), the lanes are
clamped, and a rider shoved past a lane limit bounces at `×−0.25`. A held rider takes no CPU
decisions and is skipped by `resolveBumps`, so nothing can bump a racer out of the place they
queued for — the queue is stable no matter what the released riders do. The rider who is next to go
is glided into the **loop's own lane** rather than their queue slot, because the ring is
lane-filtered: any other line and the loop simply would not take them.

`tests/merge-race.test.ts` proves that the hold is what it says it is: a held rider's z matches an
independently-computed glide to within `1e-9` on every tick of every run, no contact ever involves a
held or ghost rider, and — the other direction — with the filter switched off the same runs *do* bump
queued riders, so the check is not vacuous.

## Leaving the loop

All four go into the ring at the same speed (`MERGE_RELEASE_VX`, `vy = vz = 0`) and ride the same
arc, so the ring preserves the gap the release created instead of racing it away. The exit speed-up
is the existing `×1.08` on the ride's speed; there is no merge-specific boost and no handicap.

The clock is stopped for the whole field until the pool is `releasing` — nobody is racing while they
are queued, so nobody's run time should be running either. Once the last rider is released the pool
retires (`mergeDone`), the status returns to `flying`, and from there it is the survival race: contact
physics, lane changes and bumps, exactly as before the merge.

### While the field is held

The pool owns the `checkpoint` and `countdown` statuses, and `statusSimulates()` is the one answer to
"is the simulation stepping?" — the frame loop's accumulator, its interpolation, its camera follow and
its redraw pacing all ask it, so the world keeps moving behind the overlay while the queue fills. The
player is still in the seat: the cockpit stays live and the pause key works. A pause taken during the
pool records the status it came from (`pausedFrom`) and resumes into it, because a field resumed
straight into `flying` would sit held at the gate with nothing left to release it. The 0.4 s push is
not pausable, as before.

## The overlay

`snapshot.merge` is present from the first crossing until the last release, and the overlay reads it
and nothing else: the queue with each rider's place, entry time, ready tick and flags (`late`,
`autoReady`, `forced`, `delayed`, `alignForced`), the countdown label, whether the player is ready,
and how many ticks the field has been held. Space or Enter, or the overlay's own button, call
`engine.ready()`; under `reducedMotion` the countdown drops its pulsing. The overlay hides the moment
the player is released.

The pool also speaks: the first crossing, each held rider and each release go through the effect
queue and the notice line (`FIRST LOOP AHEAD. EVERYONE QUEUES. HOLD YOUR LINE.`), and the cockpit's
`countdownLabel` shows `POOL` while the field is still filling and the pool's own `3 / 2 / 1 / GO!`
while it counts down.

## The pool goblin

The queue has a face: a painted goblin in the lower-left corner of the overlay, driving the four
moments of the merge. `art-src/cockpit/pool-goblin-src.png` is cut by the same code that cuts the
starter goblin (`cutAnimSheet` in `scripts/cut-cockpit-art.mjs`), so both sheets share one scale law
and one foot baseline: normalised to the **median** frame's height, the tallest pose clipped to its
cell rather than shrinking every other pose to fit it.

| Cell | Pose | Shown while |
| --- | --- | --- |
| 0 | palm out — *hold* | the pool is open: riders are still arriving |
| 1 | pointing and calling | the window has closed, the field is all in |
| 2 | both hands cupped, shouting | the countdown: `3 · 2 · 1` |
| 3 | both arms swept forward | `GO!` — and this cell animates, all four poses at 12 fps |

`src/game/merge/goblin.ts` is that law as a pure function (`poolGoblinFrame`,
`poolGoblinSheetPosition`), asserted by `tests/merge-race.test.ts`; `tests/cockpit.test.ts` checks the
finished sheet is the square the manifest promises. Reduced motion holds the first sweep pose instead
of cycling it, like everything else in the project.

The cutting code finds **figures**, not a grid: a generator answering a "four panels" prompt may
return four to seven goblins in any arrangement, so a sheet is separated into connected blobs of
non-matte pixels (`findFigures`) and the caller picks the ones it wants in reading order. Each sheet
declares how many figures it must contain, so a different answer is caught at build time rather than
shipping a half-goblin into a cell. The pool sheet came back with seven (four gestures in the top
row, three in the bottom); the four that were picked are 0, 1, 2 and 4.

## Refusals

Every command answers with a typed result rather than a silent no-op, so the overlay can tell "not
yet" from "already done":

| Refusal | When |
| --- | --- |
| `not_open` | The pool has already retired. |
| `duplicate_entry` | This racer is already in the queue. |
| `unknown_racer` | A racer id that is not in this field. |
| `not_held` | A ready from someone who is not queued (or has been released). |
| `already_ready` | A second ready from someone who has already readied. |

`ready` is a real command too: `GameCommand` gains `{ type: 'ready' }`, legal while the status is
`checkpoint` or `countdown` and refused everywhere else with the usual typed verdict
(`tests/contracts.test.ts`), and it collapses under `dedupeCommands` like every other repeated
command.

## Constants

| Constant | Value | Meaning |
| --- | --- | --- |
| `BOT_READY_BASE_TICKS` / `BOT_READY_RANK_TICKS` | `90` / `30` | A bot's ready, by rank. |
| `POOL_MAX_WAIT_TICKS` | `1200` | The window closes on its own this long after the player's own crossing (see *The player's split*). |
| `POOL_PLAYER_GRACE_TICKS` | `6000` | The backstop: after the field's first arrival, a player who never reaches the loop cannot hang the race for more than this. |
| `PLAYER_AUTO_READY_TICKS` | `1800` | The player is readied for them after this. |
| `COUNTDOWN_TICKS` | `360` | `3 · 2 · 1`, then `GO!` for 60 more. |
| `RELEASE_GAP_TICKS` | `42` | Minimum spacing between two releases. |
| `RELEASE_RETRY_TICKS` / `RELEASE_MAX_RETRIES` | `6` / `8` | Wait for the ring, then force it. |
| `MERGE_RELEASE_VX` | `700` | The common release speed. |
| `MERGE_GHOST_TAIL_S` | `0.75` | Intangibility after leaving the ring. |
| `MERGE_GATE_HALF_WIDTH` | `443` | Containment: the whole corridor queues, not just the loop's lane. |
| `HELD_RESPONSE` / `HELD_DAMPING` | `20` / `6.2` | The held glide (the wet-steering pair). |
| `ALIGN_MAX_TICKS` / `ALIGN_Z_TOLERANCE` / `ALIGN_VZ_TOLERANCE` | `150` / `6` / `30` | When a rider counts as lined up. |

## Files

- `src/game/merge/pool.ts` — the pool (IF-MERGE).
- `src/game/sim/racer-physics.ts` — the held branch, the loop exit stamp.
- `src/game/engine.ts` — `mergeGateFor`, `ready`, `stepMerge`, `hold`, `release`, the ghost tail,
  the status and the snapshot.
- `src/components/MergePoolOverlay.tsx`, `src/merge-pool-overlay.css` — the overlay, including the
  pool goblin.
- `src/game/merge/goblin.ts` — which goblin pose is on screen, and when (pure).
- `art-src/cockpit/pool-goblin-src.png`, `public/art/cockpit/pool-goblin.png` — the painted sheet and
  its four runtime cells, measured into `src/game/cockpit-art.json`.
  (`src/components/StagingOverlay.tsx` is T06's staging presentation component and is left alone.)
- `src/game/types.ts` — `MergeSnapshot` / `MergeEntryView`.
- `src/game/contracts/commands.ts` — the `ready` command.
- `tests/merge-pool.test.ts` — the pool's own contracts (11 tests).
- `tests/merge-race.test.ts` — the ordering law under contact, the simulation predicate, and the
  engine's wiring (8 tests).

## What was removed

The legacy checkpoint is gone, not shadowed: its fields, `triggerCheckpoint`, `readyUp`,
`releaseFromCheckpoint`, its detection block, its `setInterval` and its `clearInterval`. The
`checkpoint` and `countdown` statuses remain, because the pool drives them — the overlay and the
cockpit key off `snapshot.merge` instead of `snapshot.checkpointStandings`, and the
`CheckpointStanding` type is gone with them.

## Verification

| Gate | Result |
| --- | --- |
| `npm run check` | **547 tests / 47 suites, 0 failures** |
| `./node_modules/.bin/tsc --noEmit` | clean |
| `npm run build` | 1,581.20 kB (433.80 kB gzip) |
| `npm run check:edges` | 0 failures |

No WebGL exists in this sandbox, so nothing here has been *seen*: the overlay, the hold, the ring
entry and the releases are proven as data and arithmetic. `tests/merge-race.test.ts` cannot construct
`GameEngine` (three.js needs a context), so it mirrors the engine's merge drive the way
`tests/start-zone.test.ts` mirrors `stepPush` — and asserts, structurally, that the engine still
drives the pool that way.

## Three bugs the verification caught

1. **Same-tick crossings.** Two riders can cross the plane in the same physics tick, and their order
   is then decided by the fraction of the tick they crossed at. The pool keys the queue on
   `tick + fraction` with racer-id ties; a harness that recorded "the order the loop visited them in"
   disagreed with it on one seed in a hundred. The law is measured against the crossing time — the
   only quantity either side should use.
2. **The release aimed nowhere.** `release()` carried a no-op placeholder where the lane pin belonged
   (`world.course === undefined ? racer.targetLane : racer.targetLane`). The ring is lane-filtered, so
   a rider released on any other line runs straight past it and the merge never finishes — the harness
   fails outright with the pin removed. It is now `closestLane(obstacleZ(this.mergeGateFor().loop))`.
3. **The pool would have frozen the game.** `frame()` stepped the simulation only for `flying` and
   `pushing`, and the pool's clock is driven from `stepRace` — so the field would have been held at the
   gate permanently, with nothing able to advance the window, the countdown or a single release. The
   statuses are now one exported predicate (`statusSimulates`) with a test of its own, and the frame
   loop's use of it is asserted structurally so the mistake cannot come back unnoticed.
