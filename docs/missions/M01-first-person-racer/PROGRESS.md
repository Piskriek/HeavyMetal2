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

## Next

* **T2** — first-loop merge: gate → pool → ready-up → ordered ghost release (depends on T1, unblocked).
* **T6/T7** — the lane network and the builder lane tool.
* **In the browser now:** the goblin push at the top of the hill, the FPV cockpit, the tight chase
  camera, painted effects on every collision, and a gyro ball that stays level while it rolls.
