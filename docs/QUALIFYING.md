# T04 — Isolated Qualifying Attempts and Canonical Gate Timing

Ticket: [#37](https://github.com/Piskriek/HeavyMetal2/issues/37) · PR:
[#50](https://github.com/Piskriek/HeavyMetal2/pull/50) · Owner: qualifying simulation agent ·
Depends on T01 (frozen contracts), T02 (dynamic roster), T03 (track space).

Everything here is **simulation**. Nothing in this ticket draws a staging screen or reserves a
release corridor — that is T05 and T06 — but everything they need is exported and tested.

## 1. The seam that makes an attempt runnable outside a browser

An attempt has to run the *real* physics, so the physics had to stop living inside a class that owns
a canvas. `src/game/sim/` is that extraction:

| Module | Owns | Was |
| :--- | :--- | :--- |
| `sim/world.ts` | `SimWorld`: bucketed obstacle/pickup index, `surfaceAt`, `inGap`, `y`, `slope`, `cloneLayout`, `altitudeAboveSurface` | `GameEngine.makeTrack` / `setTrackObstacles` / `nearby` / `inGap` / `surfaceAt` |
| `sim/racer-physics.ts` | `stepRacer`, `recoverRacer`, `hitObstacle`, `canHop`, `performHop/Bounce/Boost`, `RacerStepTrace`, the `RecoveryPolicy` split | `GameEngine.stepRacer` / `recover` / `hitObstacle` / `performHop` … |
| `sim/cpu-driver.ts` | `driveCpu` with an explicit `others` list, `paceTargetX` and `stagger` | `GameEngine.driveCPU`, which read `this.racers` and `this.player` |
| `sim/pickups.ts` | swept supply resolution + `collectPickup`, with an `onClaim` hook | `GameEngine.resolvePickups` / `collectPickup` |
| `sim/context.ts` | `SimFx` (the whole feedback surface), `RacerStepContext`, `LEGACY_RECOVERY`, `PROGRESS_RECOVERY`, `HEADLESS_SIM_FX`, `createRecordingFx` | new |
| `sim/obstacle-state.ts` | the scalable `hitBy` ledger that replaces `1 << racerId` | `GameEngine.hitObstacle`'s bit mask |

`GameEngine` keeps the renderer, input, particles, camera, bumps, the snapshot and the HUD, and now
delegates the rest. It kept its behaviour: **`tests/physics-parity.test.ts` (8 checks) drives the
engine's pre-refactor code and the shared modules through the same tick loop and compares every
physics field, HUD field, particle counter, obstacle mutation and supply claim after every tick** —
about 5,500 ticks of scripted racing across all three courses plus a synthetic layout holding one of
every obstacle kind. The legacy half is not a hand-copy: `scripts/build-parity-fixture.mjs` generates
`tests/fixtures/legacy-engine-sim.ts` verbatim from `src/game/engine.ts` at `f9ca189`, with three
mechanical transforms (modifier stripping, the media-query field, and stubbed browser objects).
`node scripts/build-parity-fixture.mjs --check` re-derives it and fails if the committed fixture has
drifted. The test is not decorative: pinning a 0.01 % change to rolling resistance makes six of the
eight checks fail.

Two deliberate changes came out of the extraction, and both are the ticket's own requirements:

1. **Side effects go through `SimFx`, and gameplay randomness through `ctx.random()`.** The race binds
   them to the renderer, the audio graph and `Math.random` — i.e. to exactly what it did before. An
   attempt binds them to a no-op or a recorder and to its own seeded stream.
2. **Recovery is decided *before* the falling branch's early return.** The old
   `if (racer.falling) { … if (fallingFor > 0.72) recover(); return; }` meant the depth and lava-lake
   checks further down the function were unreachable while airborne. The decision now runs inside the
   falling branch, driven by a policy: `LEGACY_RECOVERY` carries no depth triggers, so the race still
   ends a fall on the 0.72 s timer alone (bit for bit), while `PROGRESS_RECOVERY` also ends a fall at
   360 units below the surface or 260 below the lava lake, and respawns against progress.

## 2. The gate

`QUALIFYING_GATE_ID` is `'first-loop-entry'`, the name frozen in `contracts/qualifying.ts`. The gate
is derived from the course, never authored:

```
loop   = the lowest-x `kind === 'loop'` obstacle in the layout
gate.x = loop.x - (loopGeometry(loop).radius + RADIUS)     // the loop's outer reach
gate.z = obstacleZ(loop)                                    // the loop's own lane centre
gate.halfWidth = LANE_WIDTH / 2                             // 120: one lane wide
gate.altitude = 0, gate.altitudeTolerance = 90              // above the road surface
gate.segment = segmentAtX(gate.x)                           // 'approach' on every shipped course
```

The x choice is the load-bearing part. `stepRacer` engages a loop only when
`|racer.x - loop.x| <= radius + RADIUS`; the gate sits exactly on that boundary, so **no racer can be
riding the loop before crossing the plane**, which is what makes the capture pre-loop.
`tests/qualifying-gate.test.ts` proves it by scanning the whole engagement band (every dx in the
reach, dy from -420 to 420) and asserting no engaging position lies ahead of the plane.

* **Capture point.** The swept test compares the racer's position at the start of the tick with the
  trace's `preObstacle*` fields: the state *after* motion integration and *before* obstacle
  resolution. So the recorded speed and vector are the approach values — before the ride floors the
  speed at 650 and before the exit multiplies it by 1.08. A gate deliberately parked on the loop
  centre still records correctly (asserted in both suites).
* **Time** is `(tick + crossingFraction) × 1/120`, sub-tick, the same convention the race uses for
  finish times.
* **Validation** is `validateGateCrossing` from the contract, in its documented order: forward motion,
  the plane inside the tick, lane containment, altitude, segment. A rejected attempt gets the named
  reason (`wrong-lane`, `reverse`, `above-gate`, `wrong-segment`, plus `missed` when the plane was not
  in range at all, which is not a rejection). `missed` never ends an attempt; a rejection does not
  either — the racer can fix the line inside the same attempt.
* **Segments** come from a `SegmentProvider` (default: the course's five ground bands by x, plus a
  distinct `loop:<x>` segment while riding). This is the seam T03's `track-space.ts` should implement
  for authored multi-deck space, where "wrong segment" becomes a real hazard rather than a unit test.
* **Altitude** is `courseY(x) - RADIUS - y`, the same measure the camera and the airborne ground decal
  already use. 90 units admits a hop and rejects a spring-launched flight over the gate.
* **No loop, no heat.** A layout without a loop raises `QualifyingError('E_GATE_MISSING')`; the module
  never invents a fallback gate.

## 3. The attempt

`QualifyingAttempt` is one racer, one private copy of the course, one clock:

* `cloneLayout` gives every attempt its own obstacle and pickup records and clears `hit`, `hitAt`,
  `hitMask`, `hitBy`, `broken`, `collectedBy` and `collectedAt`. The template layout is never mutated,
  so a barrel a hidden bot blew up is standing in the next attempt, and a bridge nobody crossed is
  unbroken.
* `resolveBumps` is race-only. `driveCpu` receives `others: []` and `paceTargetX: null`, so no rival
  is scored and nobody is chased. `tests/qualifying-attempt.test.ts` asserts the strongest available
  form of this: the identical participant produces a byte-identical outcome in a heat of one and in a
  heat of twenty.
* Gameplay RNG is a fresh `createRng(attemptSeed(session seed, racer ID, attempt number))` per
  attempt. Cosmetic randomness does not exist headlessly, and the race keeps its own stream.
* Timers (`runTime`, decision schedule, steer locks), the visited set, the peak-speed observation and
  the pickup arbiter all belong to the attempt and start empty.
* Recovery is progress-anchored: respawn at the best *grounded* progress
  (`START_X + 2 × racer.distance`, the distance a fall never updates) minus 40 units, floor at
  `START_X + 440`, in the nearest gap-free lane — so a fall cannot be used to skip a hazard, and a
  racer stuck in a bottomless gap burns the recovery budget (`ATTEMPT_MAX_RECOVERIES = 3`) and the
  attempt ends as `dnf`.
* The attempt ends on the first valid crossing, on the recovery budget, or on the fixed deadline —
  `config.qualifying.deadlineSeconds`, 20 s by default, measured from the launch and never from
  staging, so a slow queue cannot eat anybody's attempt.
* Human input arrives as `GameCommand`s and is validated by `validateCommand` against the attempt's
  own gate (`aim` and `launch` on the sling, `steer`/`hop`/`bounce`/`boost` in the air). Commands are
  applied on the next tick, so a burst is order-stable; refusals are logged as `command-rejected`
  events. Bouncing on the sling launches, as in the race.
* The one qualifying-specific steering rule is `holdGateLane`: inside the last 3 s before the plane a
  CPU sets its target lane to the gate's lane, because a run that hunted boost pads into a missed
  gate is not a qualifying attempt. Outside that window the shared driver scores lanes on race terms.
  The human is never auto-steered.

## 4. The heat

`createQualifyingSession` (or `runQualifyingHeat` for one-call use) owns the schedule and nothing else:

* Every participant gets their own attempt; the session steps each live attempt exactly once per tick,
  in field order, on the contract's `FixedStepClock`.
* **Deployment** uses `cpuStagingDelay(gridSlot, fieldSize)`: monotone in slot, capped at 2.5 s for 4,
  20, 50 and 100 participants, never two launches on the same tick, and the local player is at 0. The
  ticket's warning about a schedule "growing to 35 seconds simply from racer index" is asserted
  directly, as is the bound on the retry gap (`CPU_RETRY_GAP = 0.35 s`, index-independent).
* **Retries**: `config.qualifying.retries + 1` attempts per participant (two retries = three
  attempts). A retry is a *new* attempt built from the frozen staged record, so charges, supplies,
  visited obstacles, banked distance and the attempt clock are all reset — while the aim and the
  pre-launch lane choice persist, because those are input, not an earned benefit.
* **Staging freeze**: `freezeStagedState` captures boosts, bounces, lane, target lane, distance,
  recoveries and shield the moment the heat is created. Until a participant's own start time arrives
  they are not simulated at all, and nothing that happens to anybody else touches that record.
* **A human re-aiming never freezes the bots.** An unfinished human attempt simply waits in
  `awaiting-launch` while the session clock keeps advancing and every other attempt keeps stepping.
* **Classification and ranking.** An attempt's cause is `valid`, `dnf` (recovery budget spent),
  `invalid-crossing` (only rejected crossings) or `deadline`. A participant's heat entry is their
  first valid crossing, or `retry-exhausted` once the budget is gone; when a heat is finalized
  mid-flight, `settle()` keeps the least-bad cause instead. Ranking is `rankQualifying` from the
  contract — fallbacks always behind valid entries, times ascending, then gate speed, then racer ID —
  and `capacity` decides who advances. No code in this ticket re-sorts that.
* **Determinism.** Two heats from the same config and seed produce the same table, the same event log
  and the same fingerprint (`runQualifyingHeat().fingerprint`, FNV-1a over the canonical ranking table).
* **Mystery route** (optional, off by default): `createMysteryLedger` resolves one detour supply per
  participant per heat from a heat-scoped seed. The resolved value is a real `fuel | shield | bounce`;
  the attempt files the trigger with `kind: 'mystery'` so `contracts/effects.ts` records the
  resolution once and marks `fromMystery`, and the retry reuses the memoised route instead of
  re-rolling it. `entry.rewardRolled` records that the roll already happened. Rolls per heat ==
  participants, even when everybody spends all three attempts (asserted).
* **Phase machine**: the session does not own heat phases. `qualifyingCompleteEvent()` returns the
  `HeatEvent` that `transitionHeat` expects, and `tests/qualifying-session.test.ts` feeds it in: a
  20-racer heat moves `qualifying → release`, a 4-racer heat is refused with
  `E_QUALIFYING_DISABLED` — while the simulation itself will still time a four-racer field, because
  that is what the acceptance criteria ask for.

## 5. Units

| Quantity | Space | Conversion |
| :--- | :--- | :--- |
| down-range `x` | engine units (190 at the start line, `distance = (x - 190) / 2` metres) | gate distance is reported in race metres |
| lateral `z` | engine units, `laneZ(lane) = 480 - 240 × (lane + 0.5)` | four lanes |
| altitude | world units above the road surface, `courseY(x) - RADIUS - y` | 0 = rolling |
| speed | engine units/s in `entry.speed` / `entry.peakSpeed` | HUD unit = `speed × 0.16` (`speedToDisplay`) |
| time | seconds, `tick + fraction` at 120 Hz | sub-tick, like race finish times |

## 6. Verification

`npm run check` runs `tsc --noEmit` over `src`, `tsc --noEmit -p tests` over the new suites and their
fixtures, and 113 tests in five-plus-four independent files. Per criterion:

| Acceptance criterion | Evidence |
| :--- | :--- |
| Hidden bots cannot steal pickups, break bridges, influence AI, or bump the human | `attempt: the shared layout is never mutated, and every clone starts clean`, `attempt: supplies are claimed once, in the attempt that touched them…`, `attempt: the same participant runs identically in a field of one and of twenty` |
| Wrong-lane, reverse, above-gate and wrong-segment crossings behave as specified | `crossing: wrong lane, reverse, above the gate and wrong segment are each refused by name`, `crossing: missing the plane is not a rejection`, `crossing: riding the loop is a different segment…`, `attempt: a rejected crossing is remembered but does not end the run` |
| Falling recovery is handled before the existing early return | `attempt: the depth rule ends a fall earlier than the timer does`, `attempt: falling recovery is anchored to progress…`, `physics-parity: a fall into a four-lane gap recovers on the same tick on both hosts` (the race keeps its 0.72 s timer) |
| Retry clears all attempt benefits and cannot reroll the heat reward | `attempt: a retry starts from the staged record, keeping the aim and dropping the benefits`, `heat: a failed human attempt returns to the sling with the aim kept and the benefits cleared`, `heat: the mystery route is optional, deterministic and rolled once per heat` |
| Fallback results always rank behind valid results | `heat: a fallback never outranks a valid time, whatever the field`, `heat: capacity decides who advances…`, `heat: the participant entry rule keeps the least-bad cause…` |
| Four and twenty actual attempts complete reproducibly | `heat: four and twenty actual attempts, complete and reproducible` (both fingerprints stable across reruns; 100 participants also covered by `heat: the snapshot is a bounded, readable summary…`) |
| Bounded CPU launch schedule (ticket note) | `heat: the deployment schedule is bounded, monotone and never index-linear`, `heat: a CPU retry waits a bounded moment…` |
| Gate is named and anchored to the first loop; capture is pre-loop | `gate: anchored to the first loop on every course…`, `gate: nothing can engage the loop before the crossing plane`, `capture: the recorded speed is the pre-obstacle velocity…`, `attempt: the trace exposes the canonical capture point…` |

Reproduce the numbers yourself:

```
node --import tsx scripts/qualifying-harness.ts --repeat            # 4, 20 and 100-racer heats
node --import tsx scripts/qualifying-harness.ts --course boomtown --mystery --seed 99
node scripts/build-parity-fixture.mjs --check                        # fixture is not stale
```

## 7. Not verified here, and why

* **No browser run.** The live game's physics path is covered by the parity suite, not by Playwright:
  the bundled headless Chromium in this workspace exposes no WebGL context, which is the same blocker
  T00 recorded for the four race-entering browser suites. `npm run build` and both typechecks are
  green; frame pacing in the browser was not re-measured (the extraction moves code, it does not add
  per-frame work — the trace is only allocated when a caller asks for it).
* **No staging UI.** `snapshot()`, `renderView()`, `send()` and `qualifyingCompleteEvent()` are the
  hooks T06 builds on; wiring them into `RaceScreen` before the release-corridor work (T05) lands
  would leave a heat that can qualify but cannot start.
* **Field sizes above four still have no roster owner.** `syntheticField` exists so the heat can be
  run and tested today; it is deterministic and uses the twelve real loadouts, but it is a stand-in
  for T02's roster, not a rival to it.
* **`hitMask` is still written** for IDs 0-30 for save and builder compatibility, on top of the
  scalable `hitBy` ledger. Dropping the mask is T02's call, not this ticket's.
* **Mystery supplies are heat-level.** Authoring `mystery` pickups in the track builder, and the
  prop/pickup plumbing around them, is T09's scope.
