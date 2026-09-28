# M01 — RETRIEVAL ANSWERS (RQ-1 … RQ-11) + VERIFICATION OF THE RED TEAM

**From:** the Hands · **To:** the Overwatch planner
**Branch:** `arena/01a0d1d6-heavymetal2` · **Base:** `main` @ `2d1088a`
**Method:** every answer below was read from the working tree or executed against the real modules in
this session. Numbers marked *measured* came out of a script run with `node --import tsx` against
`src/game/*` — not estimated. Where the plan is wrong, it is marked **CORRECTION** or
**CONFIRMED**.

> **Sandbox note for future turns.** The sandbox reset between sessions and `node_modules` was
> removed; `npm ci` (≈10 s) restores it and `npm run check` (451 tests, ≈30 s) / `npm run build`
> (≈8 s) both run green afterwards. Git history and all working files survive a reset. WebGL is
> still unavailable (`node scripts/probe-webgl.mjs`: 8 configurations, all "no gl").

---

## ANSWERS

### RQ-1 — Spline source, `D_START`, and the `courseY ⇄ spline` relationship ⚠️ **most important answer**

**The spline does not use `courseY` at all.** `buildTrackSpace()` expands the hard-coded
`CENTERLINE_WAYPOINTS` (`track-space.ts:97-183` — ~70 literal world points with explicit `y` values
like `y: 18000` at the start) through `expandCenterline()` → `catmullRomPointAt()` →
`buildSplineArcTable(points, 6000)`. Courses do **not** change it: all three share one spline.

`D_START = 1100` anchors *engine distance 0* at 1100 spline units in:
`s = D_START + clamp(distance / TRACK_DISTANCE, 0, 1) · (D_END − D_START)` (and the documented
inverse `trackDistFromEngineDistance`). It is a reparameterization only — no course dependence.

**`courseY` is used inside track-space in exactly two places, and both hard-code `'ridge'`:**

| Line | Function | Expression |
|---|---|---|
| `track-space.ts:964` | `canonicalFromEngine` | `engineAlt = Math.max(0, courseY(engineX, 'ridge') - st.y)` |
| `track-space.ts:1041` | `engineSlopeApprox` | `(courseY(x + 4, 'ridge') - courseY(x - 4, 'ridge')) / 8` |

That is a **pre-existing latent bug** (rendered elevation composition ignores the selected course),
and it is directly load-bearing for T1: see `C-NEW-1` below.

**RQ-1 answer to the K3 worry:** changing `courseY` does **not** desync the spline (the spline is a
fixed literal table; nothing rebuilds it from the profile). But it does not move the *visible* road
either — which is worse. See `C-NEW-1`.

*(Measured baseline for T0's eye-level audit, worth recording before any terrain edit: engine
`START_Y = 325`, `courseY(190, 'ridge') = 478.0`, so a grounded ball's `y = 447.0`;
`worldY = 18065.3` at the grid.)*

---

### RQ-2 — Grid, rows, and the loadout table

`createRacers(config)` (`racers.ts:55-98`): `row = Math.floor(entry.id / 4)`;
`startX = fieldSize > 4 ? START_X - row * GRID_ROW_SPACING : START_X`, `GRID_ROW_SPACING = 90`.
For the supported 4-racer field every racer is at **`x = 190`**, `y = 325`, lanes
`homeLane = [2, 0, 1, 3]` (`types.ts:10-15`), and `pace = 1` for all four (the roster pace spread
only exists above 4 racers — relevant to C7, see below).

*Measured grid:*

```
id0 RIVET    lane2 z=-120 x=190 pace=1 vmax=2100   ← the player starts already in the loop's lane
id1 NIX      lane0 z=+360 x=190 pace=1 vmax=2030
id2 GRUB     lane1 z=+120 x=190 pace=1 vmax=2205
id3 SPROCKET lane3 z=-360 x=190 pace=1 vmax=2135
```

*Measured `loadoutStats` across all 12 rider/capsule combinations:*

| stat | range |
|---|---|
| `launchSpeed` | 152 … 172 |
| `weight` | 64 … 162 |
| `handling` | 0.76 … 1.24 |
| `boostFactor` | 0.805 … 1.26 |
| `hopFactor` | 0.925 … 1.075 |
| `bumpRecovery` | 0.865 … 1.18 |
| `maximumSpeed` | **2030 … 2205** |
| `pace` | 1 (legacy four) — not part of `loadoutStats` |

Derived limits T1/T2 must respect: the steering clamp is `±650 · handling` = **±494 … ±806 z-units/s**,
and `vx > 245` gates loop engagement, so every loadout clears it at any push/release speed in the
planned range.

---

### RQ-3 — Inverse world → engine mapping: **yes, it exists**

```ts
export function engineFromWorld(map: TrackSpaceMap, world: CPoint):
  { readonly distance: number; readonly s: number; readonly laneZ: number;
    readonly altitude: number; readonly ambiguous: boolean; readonly residual: number }
```
`track-space.ts:1051`. It scans the compiled knots, refines inside the best cell, and reports
`ambiguous: true` when a second topologically distinct ribbon sheet is comparably close (loop /
stacked-deck crossovers). It throws `TrackSpaceError('non-finite-input')` on a non-finite point.
Exactly what T7 needs; the only caution is cost — the scan is linear in sample count
(`length / 50` ≈ 6 600), which is fine once per drag frame but should be seeded from the previous
hit rather than run per pointer-move at 60 Hz on a 3204-line file's hot path.

---

### RQ-4 — The parity "fingerprint" is an **allow-list**, not a field sweep

`tests/fixtures/parity-harness.ts` → `observe(host)` (`:109-146`) builds an explicit object:
engine-level `runTime, time, counts, shake, topSpeed, pickupCount, shieldBlocks, noticeUntil,
audio.cues, particles.length, particleSum, airSheep[], trail[], collisionTimes` (`Array.from`,
length 16), `standings()`, `snapshot` restricted to

```ts
export const SNAPSHOT_FIELDS = [
  'status','distance','speed','power','angle','bounces','boosts','inLoop','falling','hopReady',
  'grounded','grade','sector','score','notice','progress','position','lane','targetLane','laneLocked',
  'bumps','raceTime','settling','finishWait','pickups','shieldSeconds','lastPickup','pickupNoticeUntil',
] as const;
```

and per racer: `x,y,z,vx,vy,vz,rotation,lane,targetLane,distance,grounded,falling,fallingFor,
stoppedFor,finished,finishTime,bounces,boosts,shieldUntil,immuneUntil,recoveryUntil,
steerLockedUntil,lastHopAt,lastGroundedAt,lastBoostAt,lastLaneChange,nextDecision,bumpAt,
shieldHitAt,pickupAt,visited.size,loopRide{angle,speed,entryProgress,obstacle.x},previous`.

Consequences:
- **Additive fields are invisible to parity.** `rollPhase`, `rollRate`, `pathId`, `mergeHeld`,
  `mergeGhost`, `loopExitTime`, `runUpSeconds`, `snapshot.merge`, `RecoveryReason 'oob'` — none are
  compared unless someone adds them to `observe()`. **K8 is a non-issue**; do not add them.
- **One real constraint:** `collisionTimes: Array.from(host.collisionTimes)` is compared whole. Its
  length is 16 because `pair = i * 4 + j`. Resizing it to `n · n` is safe **only if** the index
  formula stays `i · n + j` — for `n = 4` that reproduces the same 16 values in the same order. Say
  this explicitly in T2 or the resize will trip parity.
- Obstacles are compared as `[kind, x, hit, hitAt, hitMask, broken]` **in array order**, so T1's
  layout filter is visible to any parity scenario that runs the new layout. T1 AC-8 ("parity runs
  with `startMode: 'sling'` and the legacy layout") is the correct design; the filter must be
  flagged, not unconditional.

---

### RQ-5 — Layout RNG: **there is none.** ✅ K2 is dead

`src/game/track-layout.ts` is a pure literal sequence of `add(kind, x, width, height, lane, laneSpan,
extra)` calls. **No `Math.random`, no RNG, no hash, no seed** — grep confirms it. Consequence:
filtering any obstacle out after generation **cannot shift any other obstacle**, on any course.
`K2` (medium) downgrades to *none*; the post-gate fingerprint test becomes a formality worth keeping
(it catches accidental authoring edits).

The ridge first loop is a literal: `{ kind: 'loop', x: 1370, width: 375, height: 322, lane: 2,
laneSpan: 1 }` → `loopGeometry` = `{ x: 1370, y: 315.44, radius: 154.56, ballRadius: 114.56,
halfWidth: 58 }` → T04's gate formula puts the merge plane at **x = 1184.44** *(measured)*.

---

### RQ-6 — Preferences validation and the storage keys

There is no validator module; `readOptions()` (`preferences.ts:21-38`) is a whitelist over a flat
`GameOptions` object read from `goblin-rally-options-v1`:

- booleans: `sound, screenShake, downrange, parallax, aimAssist, menuMotion, reducedMotion, highContrast`
- `course`: must be in `COURSES`
- `graphics`: one of three strings
- `cameraMode`: **`'third_person' | 'follow_ball' | 'fixed'`** — anything else is silently ignored and
  the default survives (so D2's "unknown → default, logged not thrown" is already the behaviour;
  adding `'first_person'` means one more OR clause here)
- numbers clamped: `launchSpeed 80-240`, `ballWeight 40-240`, `masterVolume 0-100`

**The document has no `version` field.** So D2's `cockpitDefaultApplied` one-time migration has two
clean options: (a) add the flag to the stored JSON and read it in `readOptions` without adding it to
`GameOptions`; or (b) bump the key to `goblin-rally-options-v2` and migrate. The planner should pick
one and freeze it; (a) is smaller and keeps the current key.

Storage keys in use:

| key | contents | versioned? |
|---|---|---|
| `goblin-rally-options-v1` | flat `GameOptions` | no |
| `goblin-rally-records-v1` | `RunRecord[]`, max 20, deduped by `runRecordKey` | no |
| `goblin-rally-setup-v2` | last setup draft | key name only |
| `goblin-rally-session-v1` (+ `-backup`) | `save.ts`, `SAVE_VERSION = 1`, refuses unknown versions | yes |
| `hm2-track-props-v1` (+ `-backup`) | builder props, `TRACK_STORAGE_VERSION = 1` | yes |
| `goblin-rally-keybindings-v1` | `KeyBindings` | no |
| `hm2-3d-track-sky`, `hm2-3d-track-props` | legacy builder state | no |

For UQ9: `RaceSession` is `{ id, setup, rounds, round, roster, results, seed }` — **no `startMode`**,
and `SAVE_VERSION` is 1, so persisting a per-cup `startMode` is a save-schema change: bump
`SAVE_VERSION`, extend the validator at `save.ts:445` (`raw.version !== SAVE_VERSION → 'unsupported'`),
and make `commitRound` refuse a mismatched round. `RunRecord` already carries `mode` and `round`, so
tagging records `legacy-sling` reuses `mode`; no new field is strictly required if the planner is
happy to overload it — otherwise add `startMode?: 'push' | 'sling'` and default it to `'sling'` on read.

---

### RQ-7 — Are loops lane-filtered? **YES.** ⚠️ C2 **CONFIRMED**, and the band is tighter than assumed

The spatial index is **x-only**: `obstaclesNear(x) = obstacleBuckets.get(Math.floor(x / 512))`
(`SPATIAL_BUCKET = 512`, `sim/world.ts:24,104`). The z filter is in the scan loop itself
(`sim/racer-physics.ts:394-395`):

```ts
for (const obstacle of world.obstaclesNear(racer.x)) {
  if (racer.visited.has(obstacle) || obstacle.kind === 'gap' || obstacle.kind === 'ramp'
      || !occupiesLane(obstacle, racer.z)) continue;
```

and `occupiesLane` gives a `loop` a half-width of `66 + RADIUS · 0.7 = 66 + 21.7 = 87.7`
(`scene.ts`). *Measured:* the first ridge loop engages only for

```
obstacleZ(loop) = laneZ(2) = −120        engage band:  z ∈ [−207.7, −32.4]   (width 175.3)
```

Lanes 0 (+360), 1 (+120) and 3 (−360) are **all outside** that band. So C1 and C2 are correct, C2 is
strictly worse than the plan assumed (175 of 886 usable z-units), and the ALIGN fix is mandatory.

Two further geometry facts that make the fix work cleanly:
- `gate.x = loop.x − (loop.radius + RADIUS) = 1370 − 185.56 = 1184.44` is **exactly** the loop's
  engagement boundary (`|racer.x − loop.x| ≤ radius + RADIUS`), so a held rider sits precisely where
  the loop becomes reachable and the release impulse alone engages it — provided the rider is inside
  the z band first. Since held riders have `vx = 0`, they cannot engage while held (the `vx > 245`
  clause guards it), so the ALIGN order (align → then release) is safe.
- T2's plan text should say the loop band is `obstacleZ ± 87.7`, not `±120`.

---

### RQ-8 — The legacy solo branch (`engine.ts:299-330`)

```ts
if (this.soloMode && this.racers.length === 1) {
  const player = this.racers[0];
  const allRacers = createRacers(this.config);
  for (let i = 0; i < allRacers.length; i++) {
    const racer = allRacers[i];
    if (racer.isPlayer) { /* copy player x,y,z,vx,vy,vz,lane,targetLane,distance */
    } else {
      const offset = (i + 1) * 50;           // 50 units apart behind the player
      racer.x = player.x - offset; racer.y = player.y; racer.z = player.z;
      racer.vx = player.vx * 0.9; racer.vy = 0; racer.vz = 0;
      racer.lane = i % 4; racer.targetLane = racer.lane; racer.distance = racer.x - START_X;
    }
  }
  this.racers = allRacers; this.renderRacers = allRacers.map(r => ({ ...r }));
  this.renderer.setRacerCount(allRacers.length);
}
```

Note `racer.distance = racer.x - START_X` — **wrong by a factor of two** against the canonical
`distance = (x − START_X) / 2` (that line is pre-existing and only reachable in solo mode). UQ10's
replacement should use a pre-held spawn (no teleport, correct `distance`) and not copy this.

`setSoloMode(true)` has exactly one caller: `MapEditorScreen.tsx:87`.

---

### RQ-9 — Touch / on-screen controls: **the reusable component exists but is unmounted**

- `src/components/RaceControls.tsx` — a control deck with **lane arrows, Jump, Bounce, Boost**, live
  binding pills (`formatKey(bindings.steerLeft[0] ?? 'KeyA')`), and a `BallTuning` panel. **It is
  imported by nothing.** Dead but complete; UQ16 can revive it rather than build new UI.
- `RaceScreen.tsx` today: the only in-race pointers are `.stage-actions` (pause / restart /
  fullscreen), the gear menu, and the canvas pointer-drag for the sling launch. There is no lane
  button, no jump/boost button, no `touchstart` handler.
- The help modal still tells phone players to *"Drag your orange ball, then use the lane arrows,
  Jump, Bounce, and Boost"* (`RaceScreen.tsx:503`) — stale copy that R7 makes worse.
- CSS has responsive breakpoints at 354 / 385 / 430 px and `.game-shell:fullscreen` / `.theater-mode`
  overrides (`index.css:217,354,385,430`), so small screens are a supported target.

---

### RQ-10 — Records / cup storage: see RQ-6's table

Key facts: `RECORDS_KEY = 'goblin-rally-records-v1'`, `MAX_RECORDS = 20`, dedupe via
`runRecordKey(record)` (`session.ts`), records are **not** schema-versioned (the validator filters by
required numeric fields and keeps unknown-shaped entries out), `SAVE_VERSION = 1` on the event save
with `SUMMARY_POLICY_VERSION = 1` for the opponents truncation policy. `readRecords()` sorts by
`distance desc, score desc`, so a `startMode` tag must not disturb that ordering logic.

---

### RQ-11 — Player grid row and row offsets

Answered in RQ-2. For the four-racer field there are **no rows** (all at `x = 190`); rows only exist
above four racers (`row = floor(id/4)`, 90 x-units apart, behind the launch line). The player is
`id 0`, lane 2, `z = −120`, and is already in the first loop's lane — so **the player needs no ALIGN
glide; the three bots do** (Δz up to 480 from lane 3, 360 from lane 0, 240 from lane 1).

---

## RED-TEAM VERIFICATION

| # | Verdict | Evidence |
|---|---|---|
| **C1** | **CONFIRMED** | `qualifying/gate.ts:135` → `halfWidth: LANE_WIDTH / 2`; the gate is centred on `obstacleZ(loop) = −120`. Lanes 0/1/3 would be refused. The full-corridor gate centred on `z = 0` (`|z| ≤ 443`) is the right fix. |
| **C2** | **CONFIRMED, worse than stated** | Measured engage band `z ∈ [−207.7, −32.4]` (175.3 wide, half-width 87.7), not ±120. `obstaclesNear` is x-only, `occupiesLane` filters z in the scan. ALIGN is mandatory. |
| **C3** | **CONFIRMED** | `docs/QUALIFYING.md` and the demo/site are reference material; the repo modules are the authority. Agreed and already the working rule. |
| **C4** | **VALID concern, needs the user** | Purely a design call. The plan's own answer (lattice cage) is the only one that satisfies both R1 and R5 simultaneously. Note the extra cost: an alpha-lattice texture for the third-person core must be baked at preload (law 4). |
| **C5** | **VALID, and cheap to satisfy** | Measured: obstacles before the gate are `ramp@510 ×4 | boost@770 ×4 | sign@980 | blimp@1045 | sheep@1160`. Since the layout has no RNG (RQ-5), keeping `boost@770` in lanes 0 and 3 only is a trivial literal edit, and bumps/steering need no new code — `resolveBumps` and the steering spring are already live whenever `status === 'flying'`. |
| **C6** | **VALID — and now measurable** | See `C-NEW-1`: the world drops 163.5 world units from grid to gate while physics calls it flat. The spike will see a hill. Good for the plan; also the reason T1 must move both tables. |
| **C7** | **CORRECTION — the fix is inert here** | `pace` is 1 for all four racers in the only field size T2 supports (measured). `releaseVx = 700 · clamp(pace, 0.94, 1.06)` is therefore a no-op. If loadout individuality should survive the merge, the term must come from something that actually varies at four racers — e.g. `maximumSpeed` (2030…2205, a ±4 % band) or `boostFactor`. Keep the inequality proof either way; the *inputs* are what need changing. |
| **C8** | **VALID** | `RaceTiming { runUpSeconds, raceSeconds, holdSeconds }` is compatible with the existing tick-derived convention (sub-tick times `(tick + fraction)/120` are already used by the gate and the finish). `GoClock` exists and is tested. |
| **C9** | **CONFIRMED, and see RQ-6/RQ-10** | The options/records documents have no version field, so a records migration is a small, explicit change; the *event* save does have `SAVE_VERSION`, so persisting `startMode` is a schema bump. Prop re-seating: `PlacedProp` stores **world** `x/y/z` (`track-builder-3d.ts:236-260`), so a `courseY` change does not move a prop's stored coordinates — the report should compute the delta through `placementFromEngine` before/after, not from stored y alone. |
| **C10** | **CONFIRMED** | `NewGameSetup.tsx:182` offers `FIELD_SIZES = [4, 20, 50, 100]`; `ui-frame-check.mjs` asserts the selection works. `clampFieldSize`, `QUALIFYING_REQUIRED_ABOVE = 4` and `normalizeRaceConfig` refusals already exist to hang a typed `merge_field_unsupported` on. |
| **C11** | **CONFIRMED** (self-contradiction is real) | The audit in `docs/EXPANSION_PROGRESS.md` says only anim-43, anim-46 and anim-50 are trustworthy; anim-46 is red gore. Dropping it unless Q12 opts in is right, and it frees a regeneration slot. |
| **C12** | **VALID** | One rigid rotated PNG reads as a stick. Two-bone IK is cheap arithmetic and testable (`twoBoneIK(shoulder, grip, l1, l2, bend)` → angles), so it is the right shape for this repo. |
| **C13** | **CONFIRMED, with the exact numbers** | Loops are lane-restricted (RQ-7). `validateAgainstCourse(net, layout)` should therefore test the **87.7-unit band around `obstacleZ(loop)`**, not `obstacle.lane ± halfWidth`, or a network can pass validation and still delete the loop from the race. |
| **C14** | **VALID** | Full-race sweeps at 120 Hz inside `npm run check` would be minutes. `npm run soak:m01` is the right home; keep the in-check budget to merge/countdown windows + fingerprint comparisons. |
| **C15** | **CONFIRMED, and broader than stated** | `Renderer3D` never reads `frame.shake` either — the engine's shake (`Math.min(15, closing * 0.05)`) has been computed and ignored in the 3D build, so R11's "feel" is missing on *both* cameras. Fixing it in the cockpit layer is the cheap path; a world-camera shake is a separate small win. |
| **C16** | **REJECT — the premise does not hold** | `resolveBumps` uses `diameter = RADIUS * 2 + 4 = 66` and contacts only below that, so the engine already permits **2.0 world units of visual overlap per side** before it resolves. A cap at `CAP_RADIUS_SCALE = 1.04` protrudes `0.04 × 31 = 1.24` units — inside that existing slack, so the caps can never visibly interpenetrate. `1.04` is safe as specified; the 1.5-unit inset is unnecessary (harmless, but it should not be sold as a bug fix). |
| **UQ1** | **CONFIRMED + detail** | Corridor gate at `z = 0`, `|z| ≤ 443`, ALIGN to the loop band `[−207.7, −32.4]` (use the band, not `gate.z ± 6`, or the alignment is 87.7 units wide and the tolerance of 6 units is fine — but state the band explicitly). |
| **UQ10** | **CONFIRMED + measurement** | Only the player starts in the loop lane; bots must glide up to 480 z-units. With `handling` 0.76…1.24 the clamp is ±494…±806 z-units/s, so 480 units is reachable well inside `ALIGN_MAX_TICKS = 150` (1.25 s) — but the PD spring (response 33, damping 9.5) is *critically damped*, so the last few units are slow. Test the ALIGN step per loadout, not just for the player. |
| **UQ13** | **VALID** | Two-bone IK; art splits into upper arm + forearm/hand. |

---

## NEW FINDINGS THE PLAN DOES NOT KNOW (please fold into T0/T1/T3)

### `C-NEW-1` ⚠️ **There are two independent height models, and the start is flat in one, a hill in the other**

- **Physics** reads `courseY(x, course)` → the profile tables in `courses.ts`. All three profiles
  begin identically: `[0, 0], [1400, 0], [5400, …]`. Profile x is offset by `START_X`, so the flat
  span is profile x `0…1400` = engine x `190…1590` — i.e. **the entire run-up and the first loop sit
  on a dead-flat physics road**. (That is what my packet measured as `slope = 0.0000`.)
- **Rendering** draws the spline ribbon from `CENTERLINE_WAYPOINTS`, whose `y` values descend
  throughout the alpine stage. *Measured* through the real `placementFromEngine`:

```
x=190      courseY=478.0   splineY=18003.3   worldY=18065.3   alt=31.00 src=engine
x=430      courseY=478.0   splineY=17997.2   worldY=18061.3   alt=31.00 src=engine
x=700      courseY=478.0   splineY=17987.2   worldY=18047.2   alt=31.00 src=engine
x=1060     courseY=478.0   splineY=17929.9   worldY=17986.9   alt=31.00 src=engine
x=1184.44  courseY=478.0   splineY=17900.5   worldY=17955.9   alt=31.00 src=engine
x=1370     courseY=478.0   splineY=17839.6   worldY=17901.8   alt=31.00 src=engine
world drop over x 190…1370 = 163.5        engine (courseY) drop = 0.0
```

  So the **visible** road already falls 163.5 units into the first loop while the physics road is
  flat, and `altSource` is `engine` with `altitude ≡ RADIUS = 31` at every sample (the documented
  grounded quirk — every ball is rendered exactly `RADIUS + 31 = 62` units above the ribbon).

**What this means for the plan:**

1. **T1's start zone must edit both tables** — the profile knots *and* the matching
   `CENTERLINE_WAYPOINTS` y values — or the pad will be physically higher while the ribbon stays
   where it was, and the ball will visibly sink into (or float above) its own road. The plan
   currently only mentions `scene.ts`.
2. **The descent R8 asks for already exists visually.** The push is there to beat the *flat physics
   start*, and the run-in only needs the physics profile to acquire a slope.
3. **There is a clean net-zero edit that satisfies T1's AC ("`courseY(1370)` stays 478" and every
   downstream obstacle untouched):** raise the pad *above* the original line and rejoin it, rather
   than adding drop below it. In profile x (remember `profile x = engine x − 190`):

```
original:   [0, 0], [1400, 0], [5400, 600], …
proposed:   [0, −DROP], [240, −DROP], [870, 0], [1400, 0], [5400, 600], …
            └ pad, flat ┘  └── descent ──┘   └ run-in ┘   └─ untouched from here ─┘
```

   Engine x: pad `190…430`, descent `430…1060`, run-in `1060…1590`. Every knot from profile x 870
   onward keeps its original value, so nothing downstream moves, `courseY(1370) = 478` exactly, and
   the same three inserted knots plus one leading pair are applied to **all three** course profiles
   (they are identical in that span today). The spline waypoints need the mirrored edit so the ribbon
   follows. **The planner must choose whether to accept this "pad above, rejoin" shape or accept a
   global shift.** The former is far safer for the 39 builder props, the records' `distance`
   semantics and the milestone `TRACK_DISTANCE`.
4. **Nobody has ever asserted that the two tables agree.** A cheap, high-value test for T1:
   walk the spline at `SAMPLE_SPACING` and assert `|spline y-delta − profile y-delta| < ε` over the
   start section. That is the regression guard for this class of bug, and T0's audit should print the
   same table so the human can see the two hills.
5. **`CENTERLINE_WAYPOINTS` carries a `stage` tag per point** and `track-space` derives
   `stageStart`/`stageEnd` from labels like `'canyonStart'`, `'caveEnter'`, `'stadiumStart'`. Editing
   the first waypoints' `y` will not move those labelled boundaries (they are separate points), but
   it **will** change the spline's arc length slightly, which shifts `s → distance` by a hair
   (`ARC_PER_ENGINE_DISTANCE = (D_END − D_START)/TRACK_DISTANCE`). Expect sub-metre drift in
   `trackDistFromEngineDistance` near the start; if any test asserts exact milestone distances, it
   will notice. Worth checking with `tests/track-space.test.ts` after the edit.

### `C-NEW-2` — There is a **second, mounted editor screen** the plan doesn't mention

`src/screens/MapEditorScreen.tsx` (244 LOC) is live: `App.tsx:141` renders it for `screen === 'editor'`,
reached from the main menu item **"3D Map Editor — Design custom tracks, place props, and test drive."**
(`MainMenu.tsx:59`). It:

- builds a real `GameEngine` with `customPhysics: true` and `cameraMode: 'follow_ball'`;
- calls `engine.setSoloMode(true)` then `engine.reset()`;
- starts in `setBuildPaused(true)` with `trackBuilder.freeFly.active = true` (free-fly editing);
- has a **Test drive** toggle that un-pauses, disables free-fly, and calls `engine.reset()` to return
  to `'ready'`;
- and mounts **`CheckpointOverlay`** driven by `snapshot.checkpointStandings` / `countdownNumber`
  with `onReadyUp={() => engineRef.current?.readyUp()}`.

**Consequences for the tickets:**
- **T2 must handle two consumers.** Deleting the legacy checkpoint/`readyUp` breaks the Map Editor's
  checkpoint overlay. Either give the merge pool a build-mode equivalent, or replace this overlay
  with the new one and keep the "test drive" flow coherent. R14 ("easy to use in builder mode") lands
  in **this** screen as well as `TrackBuilderUI`, so T7 should name `MapEditorScreen.tsx` explicitly.
- There are now **three** ready-up/overlay surfaces in the tree: `CheckpointOverlay.tsx` (mounted only
  here, Tailwind-styled, hard-coded header "Granite Tunnel Portal"), `StagingOverlay.tsx` (mounted
  nowhere, project-CSS classes with no rules written), and the plan's new pool UI. Consolidating to
  one is worth an explicit decision.

### `C-NEW-3` — other facts worth having

- `Renderer3D.render()` reads only `frame.ball`, `frame.racers`, `frame.runTime`, `frame.time`,
  `frame.reducedMotion`. It ignores `frame.shake`, `frame.particles`, `frame.sheep`, `frame.trail`,
  `frame.camera`, `frame.cameraY`, `frame.snapshot`, `frame.options` — so T5's rewiring is additive,
  and `C15`'s shake gap is real.
- `RecoveryReason` is a 4-member union (`'fall-timer' | 'depth' | 'lava' | 'stopped'`) and
  `RecoveryPolicy` is `{ id, maxFallSeconds, fallDepth, lavaDepth, respawnSpeed, respawnX(request) }`
  with `RECOVERY_FLOOR_X = START_X + 440 = 630` and `RECOVERY_RESPAWN_SPEED = 390`. Adding `'oob'`
  means touching the union, both policies' `respawnX` (or a third policy) and `recoverRacer`'s lane
  search, which today iterates `laneZ(candidate)` for `candidate in 0..3` — T6 replaces that with the
  nearest gap-free **path** centre.
- `closestLane` clamps to `0..3` and `laneZ` is used in 163 places across 13 files (72 in
  `environment.ts`), which is why D12's "layer it on, null network = legacy" is the only affordable
  shape.
- Audio cues available: `'launch' | 'hop' | 'bounce' | 'bump' | 'boost' | 'boom' | 'sheep' | 'loop' |
  'finish' | 'land' | 'pickup' | 'shield'`. Adding `'push'` is a one-line union change.
- Effect sheets are registered as builder props (`track-builder-3d.ts:477-486`) with `.goblin`/`.png`
  paths under `/art/animated/alpha/`, 2×2 grids, and per-sheet nominal world sizes 400…480 and fps
  10…16; `animFrameUV(frame, cols, rows)` already implements the UV math T5's pool needs.
- The Vite dev server already answers `POST /api/backup-props` with a "refuse to overwrite a ≥25 %
  smaller set" guard (`vite.config.ts`), which is the exact pattern T6's `POST /api/backup-lane-paths`
  should copy.
- `tests/racer-pool.test.ts` constructs a `Renderer3D` **without a WebGL context** via
  `Object.assign(Object.create(Renderer3D.prototype), { scene, storedAssets, racers3D, racerResources,
  racerTextures, destroyed: false })` and asserts real `dispose` events. That is the ready-made harness
  for T3's "mesh tree = 1 core + 2 caps, only 3 geometries, no allocation in `render()`" acceptance.
- Dead-but-present code the plan can reuse or delete: `RaceControls.tsx` (unmounted control deck),
  `CollisionOverlay`→`CheckpointOverlay` (MapEditor only), `StagingOverlay` (nowhere),
  `src/game/collision/*`, `cube-sphere*.ts`, `dent-state.ts`, `rolling-*.ts`, `gameplay-props.ts`,
  `physics/wall-ccd.ts`, `pickups/claims.ts` (all implemented and tested, none wired into a race).

---

## HANDS: WHAT I CAN AND CANNOT PROVE (so no ticket asks for the impossible)

| Can prove | Cannot prove |
|---|---|
| `npm run check` — tsc ×2 + 22 suites / **451 tests** | Anything that needs a rendered WebGL frame |
| `npm run build` — currently **1,522.93 kB / 416.61 kB gzip** | Frame pacing, motion-sickness comfort, art fit |
| New pure suites via `node --import tsx --test tests/<x>.test.ts` | Screenshot-based acceptance of the cockpit view |
| Headless DOM geometry/ARIA (pattern `tests/ui-frame-check.mjs`, which passes here) | Real-device touch ergonomics |
| Headless `Renderer3D` pool/geometry assertions (pattern `tests/racer-pool.test.ts`) | — |
| A live preview URL via `npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173` | — |

**Image generation:** I can generate art. The project convention caps it at ~10 images per turn and
the quota only resets when the human says so — so **T4's 9 images + T5's regeneration must be one
batch, after Q8**, exactly as D14 states. If the plan wants a T0 spike that needs no art, that is
compatible: the spike's bezel can be a CSS gradient placeholder.

---

## WHAT I NEED FROM THE PLAN TO START

1. **Q8 answered** (art direction + the 10-image list) — nothing in T4/T5 can be finished without it.
2. **The `C-NEW-1` decision**: "pad above and rejoin" (recommended, net-zero downstream) or a global
   terrain shift. Either way, whether the spline `CENTERLINE_WAYPOINTS` move with it.
3. **T0 or not**: if T0 runs, I need its exact output format (`docs/FP_SPIKE.md` sections) and the
   `?fp=1` flag contract — otherwise I will start at T1 and tell the user the eye-level question is
   unanswered.
4. Confirmation that **T1 AC-8's legacy path** is `startMode: 'sling'` **plus an unfiltered layout**,
   so `tests/physics-parity.test.ts` keeps comparing the legacy fixture against the shared sim.
5. Q1–Q7, Q9–Q13 answers (or your defaults) so I do not invent constants.
