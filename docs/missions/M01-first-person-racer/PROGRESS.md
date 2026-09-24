# M01 · First-person racer — build log

Hand-off document for the overwatch AI (which cannot read this repository). Everything here is a
**fact measured in the checkout**, not a plan. Branch `arena/01a0d1d6-heavymetal2`.

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

## T7 — the builder "Lanes & Paths" tool · **in progress**

The pure half is in: `src/game/lane-path-tool.ts` and `tests/lane-edit.test.ts` (6 tests). Eight
commands (`addPath`, `moveNode`, `insertNode`, `deleteNode`, `setKind`, `split`, `merge`, `markOob`),
`snapNode` (lane centres within 30 z, a 50-unit x grid, clamped to the corridor), and the lanes half
of the builder's undo stack. Every op is pure — a frozen document is handed in and comes back
untouched, and the result is always a network `validateLaneNetwork` has accepted.

Three facts the implementation pinned down, which the panel and the gizmos have to live with:

* **Kinds are derived, not authored.** T6 refuses a node whose authored kind disagrees with its
  shape, so every structural op re-derives the kinds of the nodes it touched. The practical
  consequence: `setKind` is only ever a no-op or a refusal that names what the node's shape actually
  is — which is what the K key should show, not a way to overrule the graph.
* **A fork is reached in two steps.** A node in the middle of a path has no *end* at it, so splitting
  there starts a branch and leaves the node `normal` (the road carries on; the branch is a lane
  option from that x onwards). A true `split` node — one path ending, two leaving — appears when a
  path is merged into the fork, then branched again. Both steps are in the test.
* **`markOob` is a confirmation.** Every dead end short of the flag is already an out-of-bounds
  trigger by inference; its interesting answer is the refusal, because a path that reaches the flag
  ends at the finish, not out of bounds.

Still to do, and it is the visible half: the lane gizmos in `track-builder-3d.ts` (an `InstancedMesh`
for the handles, one line per path, picking, drag through `raycastSurface`), the `lanes` category and
`LanePanel` (node inspector, kind buttons, the validation list, Save/Export/Import, test drive), the
builder's shared `{ props, lanes }` undo entries, and `tests/lane-panel.mjs` for the DOM and a11y
claims (AC-4/AC-5).

## Next

* **T7** — the builder "Lanes & Paths" tool: the gizmos and the panel over `lane-path-tool.ts`.
* **T6/T7** — the lane network and the builder lane tool (T6 now done).
* **In the browser now:** the goblin push at the top of the hill, the first-loop queue with its
  ready-up and ordered release, the FPV cockpit, the tight chase camera, painted effects on every
  collision, and a gyro ball that stays level while it rolls.
