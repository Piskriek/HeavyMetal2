# M01 · First-person racer — build log

Hand-off document for the overwatch AI (which cannot read this repository). Everything here is a
**fact measured in the checkout**, not a plan. Branch `arena/01a0d1d6-heavymetal2`.

**Pull request: <https://github.com/Piskriek/HeavyMetal2/pull/58>** (base `main`, head this branch).
The PR body carries the ticket table and the gate numbers, and is updated whenever a ticket lands.

## If the session dies

This build sandbox resets itself mid-session, and when it does the checkout comes back at
`2d1088a` — the branch base, with an empty `node_modules` and **`scratch/` gone**. Nothing that was
pushed is lost; recovery is four commands:

```sh
git fetch origin arena/01a0d1d6-heavymetal2 && git reset --hard FETCH_HEAD
npm ci
npm run check          # ends with "# pass N / # fail 0"
npm run dev -- --port 5173 --host 0.0.0.0
```

Do **not** `git clean -fdx` (it would take `node_modules` and the protected `backups/` with it), and
never push with `--force`: if a push is rejected, fetch and compare first — the remote is the truth.

---

## T0 — First-person spike + eye-level audit · **done, committed `0d755df`**

| Item | Result |
| --- | --- |
| `?fp=1` | Camera on the player's ball at eye height, FOV 74, near 4, far 60000, flag off by default (`firstPersonFlag` reads `location.search`) |
| Modules | `src/game/first-person.ts` (pure, `firstPersonFrame()`), `src/game/eye-level-audit.ts` (pure), `scripts/eye-level-audit.mjs`, `tests/{first-person,eye-level-audit}.test.ts` |
| Audit output | `docs/FP_SPIKE.md` — 787 samples every 200 spline units, 535 props (299 fixed planes, 91 camera-facing, 141 decals, 4 meshes); 200 fixed planes are seen edge-on within 3000 units; worst road-edge distance 271 (canyon 38500), decals within 400: 79 |
| Determinism / runtime | same report twice, ~1.4 s headless |
| Regression | `npm run check` 459 tests / 47 suites green, `tsc` clean, build 1,538.03 kB |
| **Open** | The human decision block at the bottom of `docs/FP_SPIKE.md` is still blank. **T3 is gated on it.** |

Preview: `npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173`, open the printed URL
with `?fp=1` appended, start a Quick Race.

## T1 — Start pad, goblin push, slingshot retired · **done, committed `6b1d992`**

### What a run does now

1. `ready` — the field stands on the pad in grid lanes `[2, 0, 1, 3]` (`createRacers` unchanged).
2. `Enter` / `Space` / the on-screen button issue one `start` command → status `pushing`.
3. 48 fixed ticks (0.4 s): every racer gets `target_i = startPushVelocity(pace, seed, id)`,
   `vx = target·k/48`, `vy = vz = 0`, `z` locked, `grounded = true`. No obstacle is scanned.
4. Tick 48 → status `flying`; normal `stepRacer` continues and the hill does the rest.

### Measured (headless, every legacy loadout, seed `0x5eed`)

| Racer | Gate tick (x = 1184.44) | vx at gate |
| --- | --- | --- |
| RIVET | 226 | 832 |
| NIX | 225 | 1054 |
| GRUB | 234 | 727 |
| SPROCKET | 222 | 937 |

Budget was ≤ 600 ticks and 700–1100 u/s. No racer drops under 60 u/s for more than 12 ticks on the
run-in; `minVx > 40`. The first loop engages on every run.

### Numbers the next ticket needs

* `PUSH_TICKS 48`, `PUSH_BASE_VX 360`, `PUSH_SPREAD 0.04` (±2 %), `DEFAULT_PUSH_SEED 0x5eed`.
* `pushRampVx(target, 48) === target` exactly; `k` outside `1…48` throws `ContractError('E_PUSH_TICK')`.
* `START_DROP 240`, `START_PAD_END_X 430`, `START_DESCENT_END_X 1060`, `START_RUNIN_END_X 1370`,
  `START_Y = GROUND − START_DROP − RADIUS = 207`, max descent grade 0.570, `courseY(1370) = 478`
  (unchanged), `TRACK_DISTANCE 36000`, `FINISH 72190`.
* The landscape *dressing* still follows the ribbon, which was not re-sculpted: the first loop is
  3D at s ≈ 8 376 while the physics gate is engine x = 1 184.44. Closing that 163.5-unit visual gap
  is T3 dressing work, not T1.
* In push mode the 11 start-zone pieces (4 ramps, 4 boosts, sign, blimp, sheep) below the gate are
  removed from the layout; the remaining obstacles are byte-identical on all three courses
  (228 → 217 ridge, 241 → 230 boomtown/sheep).
* The slingshot code is intact: `startMode: 'sling'` restores the legacy envelope (that is the
  physics-parity fixture's path) and `aim`/`launch` are refused with `reason: 'sling_disabled'` in
  push mode. `CONTRACTS_VERSION = 2`.

### Verification

`npm run check` → **467 tests / 47 suites green** · `npx tsc --noEmit` clean · `npm run build` →
1,541.30 kB (420.71 kB gzip). New suites: `tests/start-push.test.ts` (4),
`tests/start-zone.test.ts` (4), `tests/contracts.test.ts` +1, all registered in `scripts/check.mjs`.

### Known gaps, deliberately left

* The starter goblin is **invisible**: `start()` is a real shove, but no pusher sprite/mesh appears
  yet (T4/T5 own the art). The player currently just starts rolling.
* No cockpit: `?fp=1` is the only first-person view, and it is the T0 spike (no yoke, no HUD frame).
* `stepRace` still has the legacy checkpoint at engine x ≥ 17000; T2 deletes it.
* The slingshot's 3D launcher prop is still dressed onto the pad.

## The chase camera (user request, done with T3)

The old rig sat 430 up and 950 back (plus stage bonuses that pushed it further out through the
canyon, the loops and the stadium). It is now the tight rig the user asked for:

| | before | now |
| --- | --- | --- |
| behind the ball | 950 (+ up to 1500 canyon / 1400 loop / 500 arena) | **329** (`RADIUS · 10.6`) |
| above the ball | 430 (+ 900 / 650 / 450) | **177** (`RADIUS · 5.7`) + 50 % of the ball's altitude |
| aim point | 1500 ahead, +140 up | 820 ahead, +150 up |

One number to tune: `CHASE_RIG.height` in `src/game/renderer-3d.ts` (a `RADIUS` multiple, so a
radius change cannot silently ruin the framing). The wide stage-reactive rig is still there behind
`cameraMode: 'fixed'` — the classic broadcast view.

## T3/T4 — cockpit, yoke, goblin arms, live gauges · **done, committed `9db21eb` + `082bf06`**

The game opens in the driver's seat: `cameraMode: 'first_person'` is the new default (stored
settings keep whatever they already had; an unknown stored mode still degrades to the default).

| Piece | What it is now |
| --- | --- |
| Window | painted armoured bezel, aperture **x 7.03 %, y 6.02 %, 86 % × 56 %** of the viewport — the frozen D3 rectangle, because the pipeline *warps* the painted opening onto it and asserts the result (±2 px: measured 135,65 1649×604 at 1920×1080) |
| Yoke | aeroplane-style T-bar with grips; rotates ±38° about its measured hub; the rAF loop writes `rotate()` from `steer = clamp(−vz / (650·handling))`, the same `vz` the physics integrates |
| Arms | one painted arm, mirrored in CSS for the left; the sprite is anchored and rotated **about its own fist**, which is placed on the yoke grip, and scaled until the sleeve reaches a shoulder that sits below the viewport — so the hands stay on the grips at every angle and the arms always leave through the bottom edge |
| Dials | two painted plates, each with the generator's own keyed dial openings measured by a flood fill (left 509,198 r129 / 834,204 r91; right 666,235 r140 / 249,251 r98 in plate pixels); the painted bone-ivory faces drop into those holes, one SVG needle each |
| Gauges live | speed 0–360 km/h over 240° (the face prints 0…360), grade ±30 % over 220° on the big left dial, boost 0–2 and bounce 0–3 on the small dials |
| Starter goblin | the 4-frame painted shove, 12 fps, in the lower left of the window — but only during the 48 push ticks |
| Bob | ≤ 6 px, speed-driven, grounded-only, 0 under reduced motion |
| Text chips | P#, race time, shield, boosts, bounces and speed, in real DOM text, so the numbers are readable (and screen-readable) rather than only painted |

**Nothing decodes mid-race:** all nine images are in the preload promise with the rest of the race
art. **No per-frame allocation:** the engine fills one reused `CockpitState`.

### Verification

`npm run check` → **475 tests / 47 suites green** · `tsc` clean · build 1,554.74 kB (424.68 kB gzip)
· `npm run check:edges` → **0 failures** (the art pipeline now runs the project's edge-repair pass
itself, so a regeneration cannot ship a sprite the audit rejects).

`tests/cockpit.test.ts` (8 tests): needle ends + clamping, the steer/yoke law and its sign, the
hand-on-grip and shoulder-off-screen invariants at three viewports × nine yoke angles, the bob
rules, the channel's shape, that every image exists at the size the manifest promises, and that the
painted aperture really is the frozen rectangle.

### UNVERIFIED

* **The live render.** This sandbox has no WebGL, so the cockpit has only been proven as arithmetic
  plus pixels. `scratch/mock-cockpit.mjs` composites the finished art with the real layout maths
  over a painted backdrop (`scratch/art-review/bezel.png`) — that is the closest thing to a
  screenshot that exists here. The browser is the real test.
* The arm art is asymmetrical (the forearm leaves the fist down-left), so the mirrored left arm
  reaches in from a slightly different angle than a hand-drawn left arm would. Deliberate: one
  image instead of two, per D14.
* The left plate has a third painted boss ring with no keyed opening (the generator painted only two
  magenta discs per plate). It reads as a decorative blank boss. Regenerating the plates for two
  consistent openings is on the polish list.
* ~~The gyro-ball work is not in yet~~ — **T3's gyro is now in** (below). The cockpit section above was
  written before it; the cockpit itself did not change.
* Frame pacing with the two extra DOM layers (nine PNGs, 4 SVGs, 6 text nodes) is unmeasured.

## T5 — the effect runtime (explosions, collisions, dust, smoke, sparks)

The sim already knew *what happened*; it had no way to say it in paint. Now it does, in three
modules and one render pass:

| Piece | What it does |
| --- | --- |
| `src/game/effects/events.ts` | `EffectQueue`: a 128-slot ring of typed `EffectEvent`s (seq, tick, kind, engine-space x/y/z, scale, racerId). `readSince(cursor, out)` copies what is new into the reader's own array — zero allocation after construction, and an overflow **drops** the oldest effect and counts it, because an effect that could not be drawn in time is gone. An unknown kind throws `ContractError('E_EFFECT_KIND')`. |
| `src/game/effects/pool.ts` | `EFFECT_SPECS` for the five kinds, a fixed **64-slot** `BillboardPool` (spawn/update/size/position, drop counting, exact `spawn + life` despawn, reduced-motion rules) and a fixed 160-particle `SparkField`. |
| `src/game/effects/renderer-fx.ts` | `EffectRenderer`: 64 billboards + one `Points` object, built once. Sheets are **sliced into four frame textures at load**, because three.js applies a texture's offset as one shared uniform — 64 per-slot texture copies of a 972² sheet would be a quarter of a gigabyte of VRAM. Each frame, the queue is drained, engine → world via `placementFromEngine`, culled at 6000 units, billboards face the camera, sparks compact into their buffers. |
| `sim/*` + `engine.ts` | `SimFx.effect(kind, x, y, z, scale, racerId)`: 22 sites in `sim/racer-physics.ts` and 1 in `sim/pickups.ts`, mapped per IF-FX (tnt/cauldron/blimp/lava → explosion + smoke; heavy bumps → impact + sparks + smoke; light bumps, shoves, shields, loop exits → sparks; landings, hops, springs, recoveries, broken bridges → dust; boost pads → smoke). The engine adds the ball-to-ball contact effects and the dust of the starting shove. |

| Kind | Sheet | Size | Life | Spawn |
| --- | --- | --- | --- | --- |
| explosion | anim-43 16 fps | 480 u | 0.25 s | 1 billboard, grows 1.25× |
| impact | anim-44 14 fps | 220 u | 0.29 s | 1 billboard |
| dust | anim-49 10 fps | 180 u | 0.6 s | 3 billboards, rise 26 u/s, grows 1.6× |
| smoke | anim-45 10 fps | 260 u | 1.1 s | 2 billboards, rise 40 u/s, grows 1.9× |
| sparks | procedural | 26 u | 0.45 s | ≤160 particles in one additive `Points` |

All four sheets are in the race preloader, so the first explosion does not hitch on a decode.

**Verification.** `npm run check` → **487 tests / 47 suites green** · `tsc` clean · build
1,571.56 kB (430.39 kB gzip) · `check:edges` **0 failures**.

`tests/effects.test.ts` (7 tests) = the ticket's six names plus a cost test: the ring recycles its
own records and drops the oldest on overflow; the pool is bounded, counts a refused spawn and
despawns exactly at `spawn + life`; the frame index is `floor((t − t0)·fps) mod 4`, advances and plays
all four frames; reduced motion holds frame 1 at half opacity without leaking; an invented kind is
refused and nothing enters the queue; the mapping is proven on the *real* sim (one `hitObstacle` call
per authored contact kind, then a full headless drive from the grid through the first loop) and
checked against the four shipped sheets on disk; and 3 000 frames of a four-event pile-up stay under
1 ms/frame with the pool never exceeding 64.

**UNVERIFIED.** No WebGL in this sandbox, so the *look* is untested: frame sizes in world units,
billboard blend order against the painted props, and — the one to watch — what an explosion looks like
**in first person**, where the camera sits inside the ball and a 480-unit billboard can cross the whole
aperture for a quarter of a second. The browser decides that.

## T3 remainder — the gyro ball

The goblin now rides the way the mission asked: a shell that rolls between two caps that do not.

* `src/game/gyro-ball.ts` (IF-GYRO, pure): `CAP_THETA = 0.62`, `CAP_RADIUS_SCALE = 1.04`,
  `AIR_ROLL_DECAY = 0.6`; `advanceRoll` (grounded Δphase = `hypot(vx,vz)·dt/31`, exponential air
  decay, wrapped into [0, TAU), NaN-safe, mutates so a 120 Hz step never allocates); the quaternion
  helpers; `gyroPose(rollPhase, frame)` → `core` = basis ∘ rotation(−rollPhase) about the frame's
  right, `gyro` = the level basis; `gyroFrameFor(sample, loop, ballCentre, falling, lastGrounded)`.
* **The physics owns the roll.** `Racer.rollPhase/rollRate` advance once per tick at the end of
  `stepRacer`, so the renderer integrates nothing; the recovery resets them. Deliberately outside the
  parity fingerprint: roll is presentation, not outcome.
* **The renderer wears the pose.** Every racer is now `core + capLeft + capRight`, the caps sharing one
  brass material and two mirrored cap geometries — three geometries per grid however big the field,
  and no new geometry, material or quaternion inside `render()`. The old renderer-side spin line is
  gone.
* **The camera rides the gyro frame too**: riding a loop the up points at the ring's centre (so the
  view goes head-over-heels with the track), and while falling it freezes at the last grounded frame.

`tests/gyro-ball.test.ts` (5 tests): the no-slip law and its wrap over 20 000 ticks; air decay;
caps level at 72 phases × 2 frames (and world up unchanged by any roll); the core turning about the
frame's right axis by exactly −rollPhase; and the loop/fall/plain frame, 360 samples of a full ride
with no NaN and no degenerate dot. `tests/racer-pool.test.ts` updated for the three-mesh tree, the
shared cap resources and the "three geometries total" law.

**UNVERIFIED.** The caps' brass shading and the cap/ball seam are unrendered here (no WebGL); the
roll rate is proven in numbers, not on screen. The camera's loop up-vector is built from the loop's
engine-space centre — an approximation of the ring's true centre within the road's own rise.

## T2 — the first-loop merge pool · **done, this commit**

The legacy checkpoint is deleted, not shadowed: its fields, `triggerCheckpoint`, `readyUp`,
`releaseFromCheckpoint`, its detection block, its `setInterval` and its `clearInterval`, and its
snapshot fields (`checkpointStandings`, `countdownNumber`, `CheckpointStanding`). What replaces it
is a pool at the first loop that makes one promise — **you come out of the loop in the order you
went into it** — and then hands the field back to contact racing.

| Piece | What it does |
| --- | --- |
| `src/game/merge/pool.ts` (IF-MERGE, new) | The queue: `enter` (order key = the crossing's `tick + fraction`, ties by racer id), `ready`, the window, the countdown, the ordered release, the ring-occupancy wait, the ghost tail, and typed refusals (`not_open`, `duplicate_entry`, `unknown_racer`, `not_held`, `already_ready`). Pure — no DOM, no three.js. |
| `sim/racer-physics.ts` | The **held** branch: x pinned to the gate plane, the ball still rolling, and a lateral PD glide (the wet-steering pair `20 / 6.2`) into the slot; the rider who is next goes to the **ring's own lane**, because the loop is lane-filtered. `loopExitTime` is stamped on exit. |
| `engine.ts` | `mergeGateFor()` (the first loop's gate, containment widened to the whole corridor at `halfWidth 443`), `ready()` (Space/Enter/overlay), `stepMerge()` (crossing → hold → window → countdown → release → ghosts → status → snapshot), `hold`, `release`, `applyMergeStatus`, `refreshMergeSnapshot`, `pauseForMerge`; the race clock is stopped for the whole field until the pool is `releasing`; the contact pass skips held and ghost riders. |
| `components/MergePoolOverlay.tsx` + `merge-pool-overlay.css` (new) | The queue as the player sees it: place, name, entry time, ready tick, flags, the countdown, the READY button. Mounted by `RaceScreen` and by the map editor's test run; hidden once the player is released. (The old `components/StagingOverlay.tsx` — T06's staging presentation component, dead code at HEAD — is left exactly as it was; this is a different component with a different name.) |
| `contracts/commands.ts` | `{ type: 'ready' }` — legal while `checkpoint`/`countdown`, refused elsewhere with the usual typed verdict, collapses under `dedupeCommands`. |
| `game/merge/goblin.ts` + `art-src/cockpit/pool-goblin-src.png` (new) | The queue's face: a painted goblin cut into four cells — *hold* while riders arrive, *calling* once the field is in, *shouting the count* on `3 · 2 · 1`, and a four-pose sweep at 12 fps under `GO!`. The pose law is a pure function with its own test. |

Numbers: bots ready at `entryTick + 90 + 30·rank`, the player is readied for them at `+1800`, the
window closes at the expected count or after `1200` ticks, the countdown is `360` ticks (`3 · 2 · 1`
then `GO!` for 60), releases are `42` ticks apart and wait for the previous rider to clear the ring
(retry `6`, forced after `8`), everyone leaves at `vx 700` with a `0.75 s` ghost tail.

**Verification.** `npm run check` → **547 tests / 47 suites green** · `tsc` clean · build
1,581.20 kB (433.80 kB gzip) · `check:edges` **0 failures**.

`tests/merge-pool.test.ts` (11 tests) is the pool's own contract. `tests/merge-race.test.ts`
(8 tests) is the law, driven end to end with the shipping physics **and the shipping contact pass**
(mirroring `GameEngine.stepRace`/`stepMerge`/`resolveBumps`, the way `tests/start-zone.test.ts`
mirrors `stepPush`: the engine cannot be constructed here — three.js needs a WebGL context):

* `exitOrder === entryOrder` over **100 push seeds on `ridge` and 24 on each of `boomtown` and
  `sheep`**, with riders leaving the ring ≥ 200 x-units apart;
* no contact ever involves a held or ghost rider — a held rider's z matches an independently
  computed glide to `1e-9` on every tick, and with the filter switched off the same runs *do* bump
  queued riders, so the check is not vacuous;
* contact resumes after the ghost tail (the field's own post-merge riders, overlapped, get
  separated again);
* no teleport: the merge machinery never moves a rider more than one tick of their own speed, and
  the gate snap-back is strictly less than the tick that caused it;
* a run is reproducible from its seed, and the seed really does change who arrives first;
* the simulation predicate itself (`statusSimulates`: flying, pushing, checkpoint, countdown);
* and a structural check that the engine still drives the pool this way, so the mirror cannot
  silently drift.

Also registered: `tests/contracts.test.ts` was green but **not in `scripts/check.mjs`** — it is now,
with the `ready`-command test (41 tests).

**Three bugs the verification caught, all fixed:**

1. *The pool would have frozen the game.* `frame()` only stepped the physics for `flying` and
   `pushing`, and the pool's clock is driven from `stepRace` — so the field would have been held at
   the gate for ever, with nothing able to advance the window, the countdown or a single release. The
   statuses are now one exported predicate (`statusSimulates`), tested directly and asserted
   structurally where the frame loop uses it. Related: pausing is now pool-aware. A pause taken while
   the field is queued records the status it came from and resumes into it — resuming straight into
   `flying` would have left four riders frozen at the gate — and the pause key works during the pool
   (the player is still in the seat). The 0.4 s push stays unpausable, as it was.
2. *Two racers crossing on the same tick.* At seed 3 the third racer crossed the plane in a later
   sub-tick fraction than a racer who queued after them, so the pool ordered them correctly while a
   naive "insertion order" reading said otherwise. The law is now measured against the pool's own
   quantity — the crossing time — and exact ties break by racer id.
3. *The release was aiming nowhere.* `release()` carried a no-op placeholder where the lane pin
   belonged (`world.course === undefined ? racer.targetLane : racer.targetLane`). Without it a
   released rider drifts off the ring's lane, the lane-filtered loop never takes them, and the merge
   never finishes — the harness fails outright with the pin removed. It now reads
   `closestLane(obstacleZ(this.mergeGateFor().loop))`.

### Art, this turn

One painted asset: **the pool goblin** (`art-src/cockpit/pool-goblin-src.png`, four poses cut into a
2x2 runtime sheet), plus one real change to the cutter that produced it.

The cutter used to ask the generator for a grid. A "four panels" prompt comes back with anything from
four to seven goblins in whatever arrangement it likes — the starter sheet answered 3x2, the pool
sheet answered seven (four gestures in the top row, three in the bottom). So a sheet is now separated
into **figures**: connected blobs of non-matte pixels (`findFigures`), with the matte test tolerant
rather than exact, because a generator's magenta comes back shaded and the soft shadow under a pair of
boots is dark magenta rather than `#FF00FF` — an exact-key blob test would glue the figures together
through their shadows. The caller then picks figures in reading order, and each sheet declares the
figure count it must contain, so a different answer fails the build instead of shipping a half-goblin
into a cell.

Measured off the finished pixels, both sheets: 1024x1024, 2x2 of 512x512; every cell shares one
baseline (row 497) and one painted form height (340 px); the pool goblin's per-cell subject area
spreads 1.19x (the starter's 1.13x). `npm run check:edges` is clean on both.

The starter sheet was checked cell by cell against HEAD: three of its four cells are **pixel-identical**,
and the shove cell moved because it is now cropped to the figure (459x332, the shove's own outline
without its ground shadow) instead of to a panel-and-shadow box. The scale law itself did not change —
the same `[1, 1, 1.024, 0.994]` — so no other animated asset was touched.

**UNVERIFIED.** No WebGL here, so the overlay has only been proven as data plus markup (the
`snapshot.merge` contract, the markup and the CSS are all that can be checked headlessly): the
*look* of the queue card, the countdown's pulse and the hold note are the browser's call. The
browser is also the only place the release rhythm can be *felt* (4 riders × 42 ticks = 1.4 s of
staggered releases) — the tick maths is verified, the pacing judgement is not.

`scratch/art-review/pool-overlay.png` is the closest thing to a screenshot that can be made here: the
real panel art, the real goblin cells and the real grid, composed with ImageMagick. It shows the
composition — and its own text placement is the mock's arithmetic, not a browser's layout engine, so
it proves the art and the shape of the panel and nothing about the CSS.

## T6 — the lane network · **done, committed `2876c9a`**

Four fixed lane centres become a **network of authored paths** — nodes in engine space (`x`, lateral
`z`), paths as ordered runs of nodes with strictly increasing `x`, and three kinds that say what
happens where paths meet: `merge`, `split`, `oob`. `docs/LANE_NETWORK.md` is the page; the shape of it:

| Piece | What it does |
| --- | --- |
| `src/game/lane-network.ts` | Schema, seven refusal codes, kind inference from topology, sampling, the corridor union, adjacency, successors, the swept OOB test, `resolveLaneTarget`, and the sample ridge network (29 nodes / 8 paths). |
| `src/game/lane-storage.ts` | `hm2-lane-paths-v1` + backup: validate, back up, write; unknown fields survive; quota reported; one bad course does not take the others with it. |
| Runtime (`sim/context`, `racer-physics`, `cpu-driver`, `engine`, `racers`) | Steering target and clamp, the OOB recovery, path centres for the bots, path-aware `changeLane`/`shove`, per-course load, adoption each tick, and the builder's API. |
| `vite.config.ts` | `POST /api/backup-lane-paths` in its own directory, refusing to shrink a save. |

**The law that makes it safe to land before the builder exists:** a null network is exactly the old
game. `tests/lane-parity.test.ts` holds it with **50 seeded full races** — each driven twice, once with
`laneNetwork` absent and once `null`, comparing every racer's position, lane and speed at the end of
every second *plus each ball's finish tick*. All 50 pairs identical, including the four finish ticks
(e.g. seed 1: `5354, 5095, 4542, 5064`). Two controls keep that from being vacuous: 50 different
seeds all fingerprint differently, and a deliberately narrow authored line (one path, half width 40)
finishes the same field at different ticks with only 3 lane changes instead of 105 and every ball
ending pinned inside the authored corridor.

**One real bug, caught by probing rather than by reading.** `successorPath` sampled each branch of a
split *at the junction*, where every branch shares the same point — so both biases picked the same
branch. It now probes ~400 px past the junction (`min(junction.x + 400, branchEnd.x)`) and scores
against `z − bias · 900`: `bias +1` → the smaller-z branch, `bias −1` → the larger-z one.

**The probe also found the adoption case.** The narrow-network control initially changed nothing,
because the harness (like `stepRace` before this ticket) never gave a racer a `pathId` — a racer with
no path is deliberately a legacy racer, so the network had nothing to steer. `adoptNearestPaths` /
`assignNearestPaths` now live in `lane-network.ts`, the engine calls the first once per tick before
anything is driven, and adoption is idempotent (asserted).

Gates: `npm run check` **566 pass / 47 suites / 0 fail** (was 548 — the three new suites add 18),
`npm run build` **1,589.69 kB / 436.71 kB gzip**, `tsc` clean, `check:edges` 0 failures.

**UNVERIFIED.** No WebGL and no browser here, so nothing about how lanes *look* is proven: the
builder draws nothing yet (that is T7), and `environment.ts` still paints the legacy four-lane
corridor — a network is physics and logic until the dressing ticket catches up. What is proven is the
model, the storage and the runtime integration, headlessly.

## T1d — the checkpoint is the giant loop's mouth · **committed `1d61db0`**

The user's correction to T1c, verbatim: *"there is a 'Loop' decoration at the start of the course, you
guys have set that as the first split time location, but the loop i was refering to is a giant loop in
the actual 3d geometry of the track where the lanes doe a 360 deg loop, at the mouth of the loop is a
decoration called public/art/props/prop-26-granite-tunnel-portal.png it sits at the mouth of the loop and
should serve as the first checkpoint for the first split time."*

Right on both counts, and the codebase had two different kinds of "loop" to confuse:

* a **ring obstacle** (`add('loop', x, …)`) — a 322-unit decoration standing on the road, lane-filtered,
  rideable if you are in its lane. T1b/T1c anchored the sort to one of these;
* the **geometry loop** (`LOOP_DEFINITIONS` in `track-space.ts`) — a real 360° circle in the centreline
  spline, radius 1400 on the alpine stage. That is "the giant loop where the lanes do a 360".

**The sort plane is now derived geometry.** New `src/game/qualifying/passage.ts` reads the alpine loop out
of the compiled `TrackSpaceMap` (arc → engine x through the module's own monotone map): mouth at engine
**x 8304**, far side at **x 12358**. Re-author the loop in `track-space.ts` and the checkpoint follows;
no course carries its own number. The portal prop is named once (`PASSAGE_PORTAL_PROP_TYPE`) as the
visual marker, never as a dependency — it is not in `DEFAULT_TRACK_PROPS`, and the plane must not need
the user's document to exist. `MERGE_SORTING_LOOP_INDEX` and the ring-derived gate are gone from the
merge; the qualifying gate, its id and the `'first-loop-entry'` contract keep their own meaning.

**The barrel carries the field.** The sim is 2.5D and cannot model a tube, so the merge models the tube's
rule instead. Inside the loop a released rider runs at exactly the release speed on the ribbon (grounded,
not falling), which is what makes "exiting in entry-time order" true by construction. Measured without it:
a recovery inside the barrel pulled a rider **198 units back** and a later rider passed them — the exact
collision-with-the-law the spec forbids. Riders are intangible in there (two racers at one engine x inside
a barrel are not touching in the world), and the tail ends when they are clear of the far side, capped at
20 s so a stopped rider cannot stay a ghost for ever. A rider riding one of the course's own rings inside
that span keeps their ride; the carry resumes when they come off it.

**The descent.** Measured times to the mouth: **6.13–6.58 s (ridge)**, **5.82–7.06 s (boomtown)**,
**6.58–7.04 s (sheep)** — against 1.93 s for the ring the pad hangs over. The run-up still trims to the
plane and keeps the rings below it (T1c's `keepLoopsFromX`): keeping the jump line means all four riders
arrive at ridge's second ring 155–823 units up, outside the gate's altitude band, and the field flies
over the plane without queueing.

**Evidence.** `tests/merge-runup.test.ts` (4) is rewritten around the passage: the plane is the geometry
loop's mouth (radius, 4054-unit span, the portal identity, deeper than the first ring on every course);
the run-up keeps exactly the rings between the start zone and the plane and drops the jump line; all four
riders queue on every course, first arrival ≥ 4 s, spread ≤ 3 s; two `readFileSync` guards on the engine's
plane, run-up and barrel carry. `tests/merge-race.test.ts` (9) — the ordering proof — now measures the
exit as leaving the geometry loop, mirrors the barrel carry, measures exit spacing in time at the released
speed, excludes recovery ticks from the merge's own displacement law (a recovery is the course's policy:
`LEGACY_RECOVERY` respawns 200 units back by design), and its held/ghost filter control is a real
both-ways one. `npm run check`: **580 pass / 47 suites / 0 fail**; build **1,593.56 kB (437.60 kB gzip)**;
edges 0.

**UNVERIFIED.** Headless. Whether the arch reads as "the checkpoint" on screen, what the split board says
while the field goes through it, and how the barrel carry feels to drive are browser calls.

## T1c — the split is a run, not a fall off the pad · **committed `b5f8b43`**

The user's clarification of T1b: *"the split time should be measured from the start to the first loop,
currently its 2 sec split times cos the ready up shows 2 sec after you start."* They were exactly
right, and the number was structural.

**Why it was 2 s.** `createQualifyingGate` anchors its plane to a loop's own outer reach, and the pool
anchored at the course's **first** loop. The start pad is a flat crest 240 above the ground and its
lip sits directly above that ring, so the plane was crossed **1.93 s after the shove — on every
course**, i.e. the ready-up arrived before the opening stint had happened. The first honest run to a
loop is the one at the bottom of the opening descent, so the sort moved there:
`MERGE_SORTING_LOOP_INDEX = 2` (the third loop), gated through the `loopIndex` option added to
`createQualifyingGate` — the qualifying path, the gate id and the `'first-loop-entry'` contract keep
their default index 0 and are untouched.

**Why it could not just be an index.** Measured with the shipping push and CPU drivers, the descent's
rings are the only ground you can *cross*: keeping the jump line below the sorting plane means all
four riders arrive at ridge's second loop 155–823 units up, outside the gate's own altitude band, so
the whole field flies over the sort plane and the pool waits out its 50 s backstop instead of sorting.
`TrackLayoutOptions.keepLoopsFromX` (T1c) is the answer: the push run-up is trimmed to the sorting
plane but retains the **loops** below it. The field rides the descent's rings down on the ground; the
jumps under the plane are gone. Measured sorting times become **7.45–7.79 s (ridge)**,
**8.57–9.78 s (boomtown)**, **11.15–12.30 s (sheep)** — a real opening stint on every course, with the
one-number knob (`1` = ~4–7 s, `3` = ~9–13 s) documented on the constant.

**Two test-harness laws had to grow up with it.** `tests/merge-race.test.ts` now starts its own run at
the sort plane, counts only rides *after* a rider has queued (the field rides run-up loops now, and a
run-up ride is not a turn in the ring), and measures the pool's own window (first entry → last exit)
against the 50 s backstop instead of a tick budget that included the run-up. Its "no teleport" cap
gained the slope allowance the law always needed: `stepRacer` clamps `vx` *after* integrating, so a
tick spent on a slope legitimately moves a little more than `maximumSpeed · dt` (the pad was flat, and
no earlier harness ever met a slope at speed).

Evidence: `tests/merge-runup.test.ts` (new, 3) — the run-up keeps exactly the loops between the start
zone and the sorting plane and drops the jump line; driven as the engine drives it, all four riders
queue on all three courses, the first arrival is ≥ 4 s, the field's spread ≤ 3 s and the last arrival
< 20 s; and two `readFileSync` guards pin the engine's run-up and gate. `tests/merge-race.test.ts` 9/9,
`npm run check`: **579 pass / 47 suites / 0 fail**; build **1,593.12 kB (437.45 kB gzip)**; edges 0.

**UNVERIFIED.** Headless. What the split board reads at ~9 s and how the descent feels without its
jump line are browser calls.

## T1b — the player's split, and the retired slingshot off the view · **committed `d0d7087`**

Two things the user asked for after seeing the FPV view in the browser, both fixed at the place the
problem actually lives rather than by moving a camera.

**The slingshot stood exactly where the driver now sits.** It is a *builder prop*
(`slingshot_3d_launcher`, `isSlingshot: true`) — it is in `DEFAULT_TRACK_PROPS` and in the user's own
saved document (`prop_1790054945777_rvtx`, `x −7, z −1268`, 521 props in total) — so the fix is a
rendering decision, not a document one: `TrackBuilder3D.setSlingshotsVisible()` hides those models
(and the placement ghost) without touching `placedProps`, the undo stack, storage or validation. The
race render path sets it once per frame — visible only for a legacy `startMode: 'sling'`, hidden for
the push mode the game actually ships. The model is still authorable and still in everyone's saved
file; it simply is not built into the view of a run that has no sling.

**The ready-up panel was appearing before the player had set their split.** The pool's closing wait
measured from the *field's* first crossing, so ten seconds after the leaders queued the window closed
and the READY panel (and then the countdown) was in front of a player still racing the first stretch
— and a slow enough player was flagged `late` for their own gate. Now:

* `step` measures the closing grace from **the player's own crossing** (`graceTick`, `null` until
  they arrive), so while they are on approach nothing but the deadline can close the window;
* `POOL_PLAYER_GRACE_TICKS` (`6000` = 50 s from the field's first arrival) is the backstop for a
  player who cannot reach the loop at all — a wrecked run cannot hang the race, and a crossing after
  it is `late`, flagged and never dropped;
* `poolIsWaiting` swaps the ready-up panel for a **split board** — the live clock
  (`formatSplit(raceTime)`, `m:ss.hh`), the field's queue shown as news, no READY button — until the
  player's own entry exists. With the full field held the window then closes on that same tick, so
  the panel's first frame is already true.

Evidence: `tests/merge-pool.test.ts` (12) covers the player-centred grace, the arrival that is not
late, the all-held close the moment they queue, the player's own timeout with the field short, and
the deadline backstop; `tests/merge-split.test.ts` (2) covers the waiting predicate, the clock
formatting (including NaN and negatives clamping) and the screen/overlay wiring; `tests/start-zone.test.ts`
(5) gained a structural guard that the render path calls `setSlingshotsVisible` exactly once, keyed
on the start mode, and that the prop is *still* authored (hiding it must never mean deleting it).
`npm run check`: **576 pass / 47 suites / 0 fail**; build **1,592.89 kB (437.36 kB gzip)**.

**UNVERIFIED.** Both changes are view-side and the sandbox has no WebGL, so what is proven is the
rule and the wiring, not the pixels: that the ready panel is absent while `poolIsWaiting` is true and
that the slingshot models are `visible = false` in push mode. The framing — whether the window is
clear of *other* start-zone clutter, and whether the split board reads well over the road — is the
browser's call.

## T7 — the builder "Lanes & Paths" tool · **done, committed `d8d971d`**

The tool exists end to end: a lane document the builder loads, edits, undoes and saves; handles drawn
on the track; and a panel that shows the document, its refusals, and where to click next.

**Part 2a, committed `ca5435d` — the gizmos and the builder's lane document.** `lane-gizmos.ts` draws
every node as one instance of a single `InstancedMesh` (capacity 512, coloured by kind: normal blue,
merge green, split amber, out of bounds red) and every path as one `Line`. Its own statistics are the
test's evidence: `handleWrites`, `pathRebuilds`, `materialsCreated`. Two habits it keeps:

* **A move is one write.** AC-4's hundred-frame drag writes the instance matrix a hundred times, adds
  no material, and rebuilds only the paths that contain the node — not the world.
* **A refusal is invisible.** `applyLaneEdit` refusing an edit leaves the document, the handles and
  the statistics byte-identical, which `tests/lane-gizmo.test.ts` (5 tests) asserts directly.

The builder's undo stack now carries **both documents** in one entry (`LaneUndoEntry { props, lanes }`),
so Ctrl+Z steps over a props edit and a lane edit the same way, in the order they happened.

**Part 2b, this commit — the panel, its keys and its commands.** `lane-panel-model.ts` is the panel's
brain, pure and testable: `lanePanelModel` (nodes, paths, the validator's own refusal sentences,
`canSave`), `laneKeyIntent` (N/I/Del/K/S/M/O, Ctrl+Z/Y, and *nothing* while a text field has focus) and
`laneEditForCommand`, which turns a command with no coordinates in it into one concrete edit. The
defaults are decisions, so they are written down where they can be read:

* **New path** runs to the flag — `[x, x+6000, FINISH]` — in the lane centre carrying the fewest nodes.
  A path that stops short of the flag is an out-of-bounds trigger by T6's law, and that is not what
  "new path" means.
* **Insert** lands in the middle of the segment after the selected node (else the longest segment, so
  a two-node path has somewhere to grow), with `z` read off the straight line between its neighbours.
* **Split** branches 4000 down-range, or to the flag, onto the nearest other lane centre.
* **Merge** needs both halves of the selection — the path to fold in, and the node it folds into;
  **Mark OOB** marks the selected path's tail, which is usually a confirmation rather than a change.

`LanePanel.tsx` renders that model and nothing else: a live (`aria-live="polite"`) list of the
validator's refusals where each entry is a button that focuses the offending node, node and path lists,
a selected-node inspector (x/z boxes that commit on blur or Enter, so typing `4200` does not drag the
node to `4` on the way), kind buttons labelled by shape rather than authored label, and
Save/Export/Import/Test drive. **Save is disabled on exactly `model.canSave`**, which is
`validateLaneNetwork`'s verdict, so the button cannot be enabled over a document the runtime would
refuse. `TrackBuilderUI.tsx` gained the `lanes` tab, the canvas pick-and-drag (pointer → track surface
→ `snapNode` → the tool's own `moveNode`, one undo entry per drag, refusals toasted at pointer-up rather
than once per frame) and the key bindings.

**One law the merge command taught us, pinned in the test.** Folding a path *through* the split node it
leaves is refused — `kind_mismatch: node grid is a normal node by its shape` — because that node would
stop being an end and T6 requires the authored kind to equal the shape's. The command does not try to
paper over it; the refusal is the answer, and the panel shows it.

**Tests and gates.** `tests/lane-panel.test.tsx` (9 tests) covers the model, the command mapping (every
command either produces an edit the tool accepts or a reason, checked by actually running
`applyLaneEdit`), the key map, and — for AC-5 — the **rendered markup**: React renders to real HTML in
node, so the live error list, the disabled Save on an invalid document, the enabled one on a valid
document, and every control's label are asserted without a browser. The ticket named
`tests/lane-panel.mjs`; the repo's `.mjs` DOM checks need chromium, and a `.tsx` suite that renders the
shipping component is the executable form of the same claim, so the file is `tests/lane-panel.test.tsx`.
`tests/lane-gizmo.test.ts` (5) and `tests/lane-builder.test.ts` (8) cover the handles and the builder
document. All three suites are registered in `scripts/check.mjs`.

`npm run check`: **602 pass / 47 suites / 0 fail**. Build **1,630.05 kB (448.39 kB gzip)** — 10.8 kB of
gzip over part 2a, inside the ticket's 40 kB budget. `npm run check:edges`: 0 failures.

**UNVERIFIED.** The sandbox has no browser, so the pixel half is the browser's call: the handles sitting
on the road at the right lift, the grab-and-drag feel, the panel in the builder's dock next to the prop
grid, the `Test drive` hand-off into a race, and whether Export's download lands. What is proven is the
markup, the accounting (AC-1..AC-4 as counts) and the refusals.

## Dressing — the lanes you authored, painted on the road you drive · **this commit**

T6 was physics and logic: `sampleLane` steered the balls, the OOB nodes recovered them, and the only
thing that ever *drew* a network was the builder's own gizmos. So an authored track drove like one
shape and looked like another — the legacy four-lane corridor. `src/game/lane-paint.ts` closes that.

**The paint is the physics' own spine.** One ribbon per path, sampled by `lanePaintSamples` — which
calls the same `sampleLane` the steering calls — stroked to `LANE_PAINT_HALF_STROKE` (15) either side
of the centre, lifted `LANE_PAINT_LIFT` (8) above the surface point that sample maps to. The test does
not trust the inverse mapping to check this: `engineFromWorld` is *not single-valued* where the track
doubles back through a giant loop (the same engine x meets two ribbons at different heights), so the
law is written against the sample — every vertex is exactly the sample's edge point, lifted, to within
float32's grain (~0.016 units at a world coordinate of 2·10⁵).

**The end of a lane reads as what happens there.** Colour is per-vertex, so the neutral road paint and
the kind tint are one draw call: a path that ends in a `merge` warms green over its last 900 units, a
`split` amber, an `oob` dead end red — and the ribbon simply *stops* where the path does, because a
painted lane that carried on past its last node would be a lie about where you can drive.

**It is cheap by construction.** One material for the whole layer, ever (`materialsCreated` cannot
exceed 1 — an empty document builds none at all), one mesh per path, and `setNetwork` decides by
**identity**: the render loop hands it `engine.lanePaths` every frame and pays one reference comparison
unless the document object itself changed — which is exactly what saving, undoing, importing or
switching course does. 120 frames in the test, zero rebuilds.

**Wiring.** `SceneFrame` gained `laneNetwork?: LaneNetwork | null` (optional, so the builder, the audit
and every headless preview keep working), the engine passes `this.laneNetwork` with each frame, and the
renderer builds `LanePaint` lazily on the first frame that carries a document and disposes it with the
rest. Default play is untouched: with no authored network there is no paint, and the legacy corridor
looks exactly as it did.

**And the button that did nothing now does something.** T7 part 2b's panel has a **Test drive**, and its
handler called `onTestRace?.()` — which `RaceScreen` never passed, so the button only saved. It now
hands the engine the document the author is holding (`engine.setLaneNetwork(builder.getLaneNetwork())`),
closes the builder, and requests a frame, so the lanes you just authored are the lanes the next race
drives *and* the ones painted on the road under you.

**Tests.** `tests/lane-paint.test.ts` (9): the accounting above, the geometry laws (coverage, step,
stroke, lift), the kind tints on a network that exercises merge, split and oob, per-path repaint, the
foreign-document refusal, disposal, and a structural guard for the wiring (each pattern is a claim
about the join, which cannot be constructed headlessly because `Renderer3D` makes a WebGLRenderer).

`npm run check`: **611 pass / 47 suites / 0 fail**. Build **1,633.34 kB (449.46 kB gzip)** — +1.07 kB
of gzip. `npm run check:edges`: 0 failures.

**UNVERIFIED.** Whether the painted line reads well at speed, whether the amber/green/red tints are
legible against the road art in each sky preset, and whether 15 units of stroke is the right width from
the FPV cockpit: those are the browser's call. The one deliberate limitation to note: while the builder
is open, its **gizmos** show the document being edited, while the painted road keeps showing the
document the run is driving until you press Test drive — the paint follows the physics, not the text
buffer.

## The merge law — an authored network is drivable end to end · **this commit**

T6 shipped `successorPath`, documented it, tested it — and never called it. The consequence only showed
up once the lanes were painted: a racer who crossed the end of their own path **silently fell back to
the legacy lane corridor**. The four lanes never merged into the spine, the fork never opened, and the
authored road stopped existing at x 36000. `advancePaths` (in `lane-network.ts`, called from
`stepRacer`) is the missing line:

* past an end node that is a **merge**, the racer adopts the single path that starts there;
* past a **split**, they take the branch on their **own side** of the junction (`bias` from which flank
  they are on, so a racer steering down the left does not get yanked across the fork);
* past an **OOB** end, the flag, or a path nothing continues from, they are **left exactly as they
  are**. That is deliberate and load-bearing: an OOB node *is* the trigger `oobCrossed` fires on, and it
  can only fire while the racer is still on the path that ends there. Clearing the path would make the
  recovery law silently unfireable.

`tests/lane-successor.test.ts` (6) proves the rule unit by unit, then the law on a real run: the
shipping physics, the goblin push and the sample network, 9000 ticks. The field rides
**`ridge-start` → a lane → `ridge-spine` → `ridge-main`** and reaches the flag at x 72202, with the
invariant that **no racer is ever off their path with nowhere to go** — and the legal lag (one tick at
each junction: the second ring, the loop's mouth, the fork) bounded at 12 for four racers. A control
run with `laneNetwork` absent asserts the sim is untouched without a network: no path is ever assigned,
and the field still goes down the hill. That control is why this could be added to `stepRacer` at all:
with no network `advancePaths` returns on its first line, which is what keeps the parity fingerprints
and every tuned handling number intact.

`npm run check`: **617 pass / 47 suites / 0 fail**. Build **1,634.16 kB (449.71 kB gzip)**. Edges 0.

**UNVERIFIED.** How a lane change *feels* through a merge at speed — whether the handover tick is
noticeable, and whether the split bias matches what a player steering toward a branch expects — is the
browser's call.

## The cockpit channel — the gauges are wired to the race · **this commit**

The same class of gap the merge law had: `tests/cockpit.test.ts` proves the HUD's *laws* (needle sweep,
the yoke's ±38° lock, the painted aperture, where the goblin's hands sit, the bob), but the thirteen
assignments that **fill the channel** were a method on `GameEngine` — which cannot exist without WebGL,
so nothing checked them. A gauge reading a constant, the wrong field, or a snapshot from an earlier tick
would have looked exactly like a working gauge.

`fillCockpitState(state, telemetry, steer)` is that mapping, extracted pure into `cockpit.ts`:
`CockpitTelemetry` names the minimum a gauge needs, `GameSnapshot` satisfies it structurally, and the
engine's method is now one line (`fillCockpitState(state, this.snapshot, steerFrom(player.vz,
player.handling))`). `tests/cockpit-channel.test.ts` (6) feeds it literals — one per phase a race
actually has — and asserts what each gauge would read, plus the two properties beyond correctness:

* **the same object comes back**, mutated and returned, because a fresh record per frame is a per-frame
  allocation in the render path and this project forbids those;
* **the engine cannot drift back**: a structural guard asserts the one call, and that the engine
  assigns **no** gauge field itself (`state.* = ` finds zero matches).

Two laws the extraction made explicit, both of which the tests now pin rather than assume: the POOL
fallback belongs to the **queued** phase alone (during the countdown the pool speaks for itself, and a
pool with no label reads blank, not "POOL" forever), and the yoke's sign is `−vz / (VZ_MAX · handling)`
clamped — so full lock is `steerFrom(∓VZ_MAX · handling, handling) = ±1` at *every* handling, and a
nonsense handling is a centred yoke rather than a NaN one.

`npm run check`: **623 pass / 47 suites / 0 fail**. Build **1,634.05 kB (449.68 kB gzip)**.

**UNVERIFIED.** Whether the gauges *read* well at a glance from the FPV seat — needle legibility, the
centre read-out's size during the pool, and whether the shield ring is noticeable when it is ticking —
is the browser's call.

## The powerups — drawn where the physics collects them · **this commit**

Two holes in one place, both found the same way as the merge law (grep for what exists and is never
used):

**Nothing ever drew a pickup.** `assets.pickupSprites` have been painted and loaded since the sprites
existed; the engine asks `resolvePickups` whether a ball touched a pickup — so they are collectible and
the HUD shows the charges they grant — and it hands `frame.pickups` to the renderer, which ignored the
list. A player could gain a shield from something they never saw. `src/game/pickup-view.ts` draws them:
a pooled `THREE.Sprite` per pickup, placed by `placementFromEngine` — the same mapping the racers use —
fed with `pickupY`, the very function the collection solve reads for the bob, so the sprite and the
collision point cannot drift apart. One texture and one material per kind, ever; the pool grows to the
field's own size and then only hides and reuses (`spritesBuilt` is a high-water mark); a pickup inside
its collected window is not drawn, so nobody chases a ghost.

**The pickups were laid out on the legacy lanes.** `createAirPickups` builds the field at `laneZ(0..3)`,
which under an authored network may be mid-air beside the road — collectable in principle, unreachable
in practice. `layoutPickupsForNetwork` now moves each pickup onto the nearest point of the network at
its own x, keeping its altitude (the network says nothing about heights), dropping any pickup with **no
road under it** (the test's stranded pickup sits 1640 units off the only path at its x: "nearest path"
is not the same as "on the road", so the rule is the path's own half width), and re-numbering ids so
they stay dense for the sprite pool and the saves. With no network it returns the same values it was
handed — the legacy layout, to the hair. The engine lays a fresh field out on the network when a race
starts, and **re-lays it when Test drive hands a new document over**, because the document may have
moved every lane.

`tests/pickup-view.test.ts` (9): every sprite at its collection point, the bob (and its stillness under
reduced motion), the collected window, the pool's reuse, a kind with no art skipped rather than drawn
wrong, disposal, the layout laws, the legacy control, and a structural guard for the wiring.

`npm run check`: **632 pass / 47 suites / 0 fail**. Build **1,636.32 kB (450.66 kB gzip)**.

**CORRECTION to the T7d section above:** it claims `environment.ts` "still paints the legacy four-lane
corridor". That is wrong — `environment.ts` exports `ArenaEnvironment`, which **no file imports**; the
legacy corridor painter is dead code, not the thing on screen. The road the player sees is the 3D track's
own geometry (`track-3d-data` / `renderer-3d`), and with no authored network that is what you drive.

**UNVERIFIED.** Whether the sprites read at the size the FPV camera sees them (150 units, against a
62-unit ball), and whether their painted look lands against each sky preset, is the browser's call.

## The effect events that were invisible · **this commit**

The same sweep, one lens further out. The painted effect runtime (T5) is **generic over its kind** —
five kinds, each with art, a spawn spec and a pool, and the renderer looks the kind up in a table rather
than switching on it. That means a kind nobody emits is **not an error anywhere**: it is a thing the user
asked for that never appears. Likewise, the engine still carries the **legacy particle list**
(`this.emit(...)`, the 2D renderer's sparks), which the 3D renderer does not read at all — so an event
that only emits particles is invisible.

Three were:

* **the launch kick-off** — the sling path (push mode routes to `start`), 7 particles, nothing drawn;
* **a shield eating a bump** — nine particles in the shield's colour, and no visual at all;
* **the finish burst** — 42 particles over the flag. *The one moment of a run that must never be
  invisible* was the one nobody could see.

Each now has a painted sibling: dust for the launch, an `impact` for the shield hold (a hit that did not
land is the impact read), and an explosion-sized `explosion` plus `smoke` over the flag for the finish.
The legacy `emit` calls stay — the ambient frame-scheduling flag and the counters read them, and hiding a
painted effect must never mean deleting the record of the event.

`tests/effect-coverage.test.ts` (3) guards both halves: **every one of the five kinds has an emitter
somewhere in `src/`** (the reachability rule, with the reason written down), the three repaired events are
asserted by their exact call, and the sim's fx channel is checked to be wired into the same painted queue
the renderer drains.

**Tried and failed, so it is not tried again:** standing up a real browser in this sandbox.
`@sparticuz/chromium` and `playwright-core` are both installed and the binary downloads and starts — but it
needs `libnspr4`/`libnss3`, the image does not have them, there is no root for `apt-get`, and the mirrors
are not reachable for a local `dpkg -x`. So the pixel verdicts stay the browser's, as the PR says.

`npm run check`: **635 pass / 47 suites / 0 fail**. Build **1,636.6 kB (450.7 kB gzip)**.

## The impact shake, finally applied · **this commit**

The engine has always computed a shake: a heavy bump sets it from the closing speed (up to 15), a shield
hold 2, a nudge 4, decaying as `exp(-9t)` every tick. It rides the frame as `frame.shake` — and the 3D
renderer, the only renderer left, read it **nowhere**. So the collision feedback the shake was written
for did not exist in the first-person game: heavy impacts were silent apart from the painted effects.

`src/game/camera-shake.ts` is the offset, pure:

* **Deterministic** — sinusoids of the race clock, never a random number generator: the render path must
  not roll dice, and a test can name the exact frame.
* **Bounded as a distance** — the offset is a vector of *constant length* `strength × SHAKE_MAX_OFFSET`
  (30 world units at the ceiling; a ball is 62 across) whose **direction rotates**, so the eye is never
  further from where the camera was placed than the impact is allowed to move it, whichever way the axes
  line up. My first version scaled each axis independently and the vector sum could reach √(1 + 1 + 0.35²)
  ≈ 1.46× the ceiling — the test caught it, and the fix is the safety law in the cockpit.
* **The axes are deliberately incommensurate** (31 / 24 / 17 rad/s, with phase offsets), so the shake
  reads as a knock rather than a wobble on a loop; the view axis carries 35 % of the travel.
* **Silent under reduced motion**, at every amount and every time, like every other motion effect here.

`Renderer3D.applyImpactShake` applies it **after** both cameras are placed and aimed (the cockpit and the
chase rig), along the camera's own axes, so a shake can never change where the camera is looking — only
where the eye sits for that one frame. Three preallocated vectors, like every other vector in the render
loop: no per-frame allocation.

`tests/camera-shake.test.ts` (6): the strength scale (including a NaN/infinity amount being *no* shake
rather than a poisoned camera), the constant-magnitude law swept over amounts and times, determinism and
the direction rotating through many angles, the forward axis moving least, reduced motion, and a wiring
guard that reads the source order — applied after both camera placements, along the camera's own axes,
with preallocated vectors.

`npm run check`: **641 pass / 47 suites / 0 fail**. Build **1,637.75 kB (451.05 kB gzip)**.

**UNVERIFIED.** Whether 30 units at the heaviest impact is the right amount *in the cockpit* — too much
and the tank window feels loose, too little and a heavy bump still feels soft — is the browser's call,
and `SHAKE_MAX_OFFSET` is the one number to turn.

## Next

* **T7 is the last ticket in M01** — with it, T0..T7 are all in. What is left is the browser's word on
  the view (see the UNVERIFIED notes in each section) and the tuning that only the user can call:
  the chase-cam height, the cockpit framing, and how the lane tool feels under the hand.
* **The lane tool's honest limits**, for whoever drives it next: a merge is impossible through a node
  whose kind the merge would break (see above), and a branch is authored as an out-of-bounds spur when
  it stops short of the flag — both are T6's laws showing through, not bugs.
* **In the browser now:** the goblin push at the top of the hill, the first-loop queue with its
  ready-up and ordered release, the FPV cockpit, the tight chase camera, painted effects on every
  collision, and a gyro ball that stays level while it rolls.
