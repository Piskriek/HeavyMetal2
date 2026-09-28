# M01 — FIRST-PERSON GOBLIN RACER: CODEBASE PACKET + PLANNING REQUEST

**To:** the Overwatch planner AI
**From:** the Hands (implementation agent working in the repo)
**Repo:** `Piskriek/HeavyMetal2` ("Goblin Rally" / Heavy Metal GP 2) — React 19 + TypeScript + Vite 7 + three.js 0.186
**Branch:** `arena/01a0d1d6-heavymetal2`, based on `main` @ `2d1088a3b3bf3811b093a7f6315ed744cc868e2d`
**Document status:** self-contained reconnaissance. Every code reference below was read out of the working tree in this session, not recalled. Line numbers are for the commit above.

---

## 0. HOW TO USE THIS DOCUMENT

You are the planner. The Hands (a coding agent with file/bash/browser tools inside the checkout) will implement exactly what you specify. You do **not** have the repository; this document is your ground truth, and §5 carries the verbatim code you need. Where you need more than §5 shows, ask the Hands for a specific file/line range by number — faster than guessing.

**Answer with** (§13 has the exact schema):

1. A decision record for every item in §8 (accept / amend / reject, with the reason).
2. An ordered ticket list (T1..Tn) where each ticket has: goal, exact files to create/modify, the API signatures you are freezing, the pure functions that must exist for headless tests, acceptance criteria, and the verification command that proves each one.
3. An explicit list of what you are NOT asking for yet.

**Hard rules you must plan inside** (the repo's own laws, §9):
- Simulation is pure and headless-testable; rendering reads frozen plain data and writes nothing back.
- Physics runs at a fixed **120 Hz**; nothing gameplay-relevant may be driven by `setInterval`, `setTimeout`, or wall-clock time.
- No per-frame mesh construction, no image decoding or SVG parsing inside a render tick. Art is decoded before a race starts and reused.
- Illegal input returns a typed refusal (`ContractError` or a discriminated result) — never a silent repair.
- Frozen contract shapes in `src/game/contracts/` change only with a version bump and cross-suite updates.

---

## 1. MISSION REQUIREMENTS (the user's words, decomposed)

Convert the game from a third-person four-lane slingshot descent into a **first-person cockpit racer**, with a reworked start and a reworked first-loop merge, plus an authorable lane-path system. Verbatim intent split into testable requirements:

| # | Requirement | Notes from the user |
|---|---|---|
| **R1** | First-person camera, seen **through a tank-like window** (armoured viewport, not a bare windscreen) | The 3D world is viewed through an aperture in the cockpit art |
| **R2** | **PNG HUD with gauges that work** | Painted panels; gauges must actually reflect live state |
| **R3** | **Steampunk steering wheel** — "airplane version makes more sense" (i.e. a yoke, not a car rim) | Left/right as the player steers |
| **R4** | **Goblin arms** holding the yoke, cropped by the bottom of the screen, **moving as you turn** | Arms must vanish below the screen limit, not float |
| **R5** | The ball is a **middle full sphere** (the goblin's ball) with a **half-sphere cap on either side**, and the caps **rotate independently of the middle sphere** so the goblin stays **level like a gyro** while the ball rolls | Rolling must remain visible; only the middle sphere rolls; the goblin's frame stays upright |
| **R6** | Hook up **new animations: explosions, collisions, dust, smoke, sparks** | Effect sheets already exist in the tree (§5.8) |
| **R7** | A normal run starts at the **top of the hill in a starting zone**; a **goblin pushes you to start**; the **slingshot is removed** | Push replaces the drag-and-release launch |
| **R8** | You **roll down the hill to the first loop** | The merge gate is the first loop |
| **R9** | **Rider sorting triggers on entry to the first loop**: all riders join a **pool**, **ready up**, then their balls are **unfrozen** | A gate + lobby, not a mid-race freeze anywhere on the track |
| **R10** | Riders **exit the first loop in order of their time in** (entry time), **without collisions** | Ordered, collision-free release |
| **R11** | From there it is **a race to survive**: you collide with other balls while passing / changing lanes | Contact racing resumes after the merge |
| **R12** | **Lanes become authored vector paths** with **nodes you can move** | "vector lines/pathing that represent the lanes" |
| **R13** | Builder must support **merge and split** of paths, and **nodes that trigger out-of-bounds** when reached | Node types: normal / merge / split / OOB |
| **R14** | All of R12–R13 must be **easy to use in builder mode** | Node dragging, snapping, undo, save — inside the existing 3D builder |

R7–R11 change the *shape of a run*. R1–R6 change the *presentation and physical model*. R12–R14 add an *authoring system plus a runtime lane model*. They interact: the first-person view must survive loops, and the lane-path model must be what the cockpit steering steers along.

---

## 2. VERIFIED ENVIRONMENT (measured in this session — trust these numbers)

| Fact | Value | How measured |
|---|---|---|
| Dependencies | `npm ci` → 131 packages, ~7 s | ran |
| Type-check + unit tests | `npm run check` → `tsc --noEmit` (src), `tsc --noEmit -p tests`, then **22 suites / 451 tests / 0 fail** | ran |
| Production build | `npm run build` → `dist/index.html` **1,522.93 kB / 416.61 kB gzip**, 7.7 s | ran |
| Browser suites that need WebGL | **Cannot run here.** `node scripts/probe-webgl.mjs` tried 7 Chromium/GL configurations → *"No configuration exposes WebGL"* | ran |
| DOM-only browser suite | `tests/ui-frame-check.mjs` **passes** headless (menu/setup frame geometry, field-size selection, overflow at 1920×1080 and 3840×2160) | ran |
| Live preview command | `npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173` (that wrapper allowlists all hosts/CORS and pins HMR to `wss:443`; `vite.config.ts` itself is untouched) | file read |
| Test runner style | `node --import tsx --test tests/<name>.test.ts`; suites are enumerated in `scripts/check.mjs` | file read |
| Suites present but **not** in `check.mjs` | `tests/accessibility.test.ts`, `contracts.test.ts`, `integration-benchmarks.test.ts`, `protect-baseline.test.ts`, `racer-pool.test.ts`, `roster-scale.test.ts`, `soak.test.ts` (T12 soak = 2-minute leak run) | dir list |

**Consequence for planning — state this in your plan:** the WebGL scene cannot be screenshotted in the Hands' sandbox. Anything you want *proven* must be provable as (a) pure math in a `node --test` suite, (b) DOM/canvas-2D geometry in a headless browser, or (c) a live URL the human opens in a real browser. Design the first-person camera and the gyro ball so their composition math is a pure function that returns world→view numbers, then test the numbers, not the pixels.

---

## 3. ARCHITECTURE IN ONE PAGE

```
RaceScreen.tsx (React, DOM HUD)
   │  new GameEngine(canvas, assets, options, onUpdate, onFinish, config)
   ▼
GameEngine (src/game/engine.ts, 789 LOC)  ── owns: input, pointer drag, bumps, particles,
   │   fixed 120 Hz accumulator, snapshot (GameSnapshot), audio, checkpoint/ready-up
   │
   ├── sim/ (src/game/sim/*.ts)  ── pure headless simulation, shared with qualifying attempts
   │      world.ts (bucketed obstacle/pickup index, surfaceAt/inGap/y/slope, cloneLayout)
   │      racer-physics.ts (stepRacer, recoverRacer, hitObstacle, hop/bounce/boost, trace)
   │      cpu-driver.ts (driveCpu, setLane, reaction/lane-commit timings)
   │      pickups.ts, obstacle-state.ts, context.ts (SimFx + RecoveryPolicy)
   │
   ├── RangeRenderer (src/game/renderer.ts) ── thin delegate +
   │      │  RangeCamera (src/game/projection.ts): the 2D/legacy projection used ONLY for
   │      │     pointer unprojection and viewport width/zoom, NOT for drawing
   │      └── Renderer3D (src/game/renderer-3d.ts, 1796 LOC) ── the real WebGL renderer
   │             TrackData built from TrackSpaceMap; camera rig; racer meshes; atmosphere
   │             TrackBuilder3D (src/game/track-builder-3d.ts, 3204 LOC) — in-scene editor
   │
   ├── track-space.ts (1330 LOC) ── SINGLE SOURCE OF TRUTH for engine↔world mapping
   ├── scene.ts ── START_X/START_Y/RADIUS/LANE/laneZ()/closestLane()/courseY()/Obstacle types/
   │              RacerFrame/SceneFrame (the render frame contract)
   ├── track-layout.ts ── deterministic obstacle placement per course (228–241 obstacles)
   ├── courses.ts ── 3 course identities, elevation profiles, sectors
   └── contracts/ ── frozen pure data+functions (T01): core, identity, config, timing, effects,
                      events, qualifying, heat, props, release, dents, render, commands, stepping
```

React side: `src/App.tsx` (routing/session) → `src/screens/RaceScreen.tsx` (550 LOC, engine lifetime, HUD, modals, builder mount) → components. HUD is **DOM + inline SVG**, styled by `src/hud.css` / `src/index.css`, not drawn on the canvas.

**Renderer3D's render loop consumes only five things from the frame** (`renderer-3d.ts:1736-1790`): `frame.ball`, `frame.racers`, `frame.runTime`, `frame.time`, `frame.reducedMotion`. `frame.particles`, `frame.sheep`, `frame.trail`, `frame.camera`, `frame.cameraY`, `frame.shake`, `frame.snapshot` and `frame.options` are **ignored** — see §5.8, this is the single biggest existing gap for R6.

---

## 4. THE FIVE COORDINATE SPACES (get this wrong and everything desyncs)

| Space | Symbol | Units | Source |
|---|---|---|---|
| **Engine x** | `x` | x-units, down-track | `START_X = 190`; `raceOrder` sorts on `x` |
| **Engine distance** | `distance` | engine-distance | `distance = (x − START_X) / 2`; `TRACK_DISTANCE = 36000`; `FINISH = START_X + 72000 = 72 190` |
| **Lateral (engine z)** | `z` | lane units, `±480` | `LANE = { near: −480, far: 480 }`; `laneZ(lane) = 480 − 240·(lane + 0.5)` → lane 0..3 = **360, 120, −120, −360**; `closestLane(z)` = inverse. **Lane 0 is the far/left lane, lane 3 is the near/right lane.** Physics `vz` is z-units/s. |
| **Spline distance** | `s` | world units, arc-length | `TrackSpaceMap`; `trackDistFromEngineDistance(distance)`; `D_START = 1100` |
| **World (three.js)** | `(x, y, z)` | world units | placement law below |

**Placement law** (`track-space.ts` `placementFromEngine`, documented in `docs/TRACK_SPACE.md`):

```
world = frame.pos
      + frame.right × (z / 480) × (halfWidth(s) − 1.2 × RADIUS)
      + frame.up    × (RADIUS + altitude)
```

`RADIUS = 31`. `halfWidth(s)` is 480 on the alpine flats, **400** in the canyon band, **420** on bridges, **660** in the stadium (`track-space.ts:212-214, 629-647`). Engine x and spline `s` are **not** proportional: it is a monotone piecewise-affine reparameterization that preserves exit speed.

**Speed unit:** every displayed km/h is `hypot(vx, vy) × 0.16` (`engine.ts:699`). Acceleration, gravity, and impulses are all in x-units/s.

**Engine-to-world vertical quirk (documented, load-bearing):** when grounded, the engine sets `y = surfaceAt(x,z).y − RADIUS`, so *engine elevation ≡ RADIUS* on any terrain; `placementFromEngine` therefore treats grounded altitude as ball-*bottom* height. `docs/TRACK_SPACE.md` marks this "preserved, fixing is out of scope". Do not plan a change there without a migration ticket.

---

## 5. RETRIEVAL INDEX — THE CODE YOUR PLAN MUST RESPECT

### 5.1 Run lifecycle, launch, and the start of a race `[A]`

**Status machine** (`src/game/types.ts:6`):

```ts
export type GameStatus = 'loading' | 'ready' | 'flying' | 'paused' | 'finished' | 'checkpoint' | 'countdown';
```

`'checkpoint'` and `'countdown'` already exist for a mid-race freeze — see §5.7.

**Launch today** (`engine.ts:232-250`) — this is what R7 deletes/replaces:

```ts
launch = () => {
  if (this.status !== 'ready') return;
  for (const racer of this.racers) {
    const velocity = launchVelocity(this.snapshot.power, racer.launchSpeed);
    const angle = clamp(this.snapshot.angle + (racer.id ? (racer.id - 2) * 1.2 : 0), 12, 68) * Math.PI / 180;
    racer.launchOrigin = { x: racer.x, y: racer.y };
    racer.vx = Math.cos(angle) * velocity * racer.pace;
    racer.vy = -Math.sin(angle) * velocity * racer.pace;
    ...
```

`launchVelocity(power, speed) = speed / 0.16 * (0.45 + power * 0.55)` (`scene.ts`). Drag-to-aim lives on the canvas: `pointerDown/pointerMove/pointerUp` (`engine.ts:465-499`) push `snapshot.power` (0.18..1) and `snapshot.angle` (12..68°) while moving `player.x/y` around `AIM_ANCHOR` (`scene.ts`: `AIM_ANCHOR = { x: LAUNCHER.x + 4, y: LAUNCHER.tipY - 7, maxDraw: 220, fullPowerDraw: 200 }`).

`RaceScreen` binds: **Enter** → `engine.launch()`, **R** → restart, **A/D + ArrowLeft/Right** → `changeLane(∓1)`, **Space** → `bounce()` (which also launches while `ready`), **Shift** → `boost()`, **P/Esc** → pause, **F** → fullscreen, **M** → mute (`RaceScreen.tsx:346-395`). Arrow keys during `ready` call `engine.adjustAim()`.

A loading cover sits over the stage until dismissed; it swallows all keys while shown (`RaceScreen.tsx:357`), and the "drag your ball" affordance is `snapshot.status === 'ready'` → `.aim-hint` (`RaceScreen.tsx:457`).

### 5.2 The physics step `[B]` — `src/game/sim/racer-physics.ts` (453 LOC)

`stepRacer(racer, ctx, dt, trace?)` in order: falling branch → **lane steering** → loop ride **or** ground/air motion → obstacle scan → gap/landing resolution → rotation → clamps → finish/recovery.

**Lane steering (the only lateral control; R12 must generalise this)** — `racer-physics.ts:320-333`:

```ts
if (!racer.loopRide) {
  const isWet = racer.x >= STAGE_GRAVITY_START && racer.x <= STAGE_GRAVITY_END;   // wet/mine band
  const response = (ctx.runTime < racer.steerLockedUntil ? 7 : (isWet ? 20 : 33)) * racer.handling;
  const steering = (laneZ(racer.targetLane) - racer.z) * response
                 - racer.vz * (isWet ? 6.2 : 9.5) * Math.sqrt(racer.handling);
  racer.vz = clamp(racer.vz + steering * dt, -650 * racer.handling, 650 * racer.handling);
  const previousZ = racer.z;
  racer.z = clamp(racer.z + racer.vz * dt, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
  if (racer.z === previousZ && Math.abs(racer.vz) > 1) racer.vz *= -0.25;
  racer.lane = closestLane(racer.z);
}
```

So: `targetLane` is a **discrete lane index**, steering is a proportional-derivative spring toward `laneZ(targetLane)`, laterally clamped to the fixed `±(480 − 37)` corridor. A lane-path system replaces `laneZ(targetLane)` with `pathCenterAt(targetPathParam)` and replaces the hard clamp with the path's own left/right bounds — **but must keep the spring shape and the `steerLockedUntil` response cut**, or every tuned handling value changes.

**Loop engagement and exit** (`racer-physics.ts:427-443`, and exit at `:345-357`):

```ts
if (obstacle.kind === 'loop') {
  const loop = loopGeometry(obstacle, world.course); const dx = racer.x - loop.x;
  const dy = racer.y - (world.y(racer.x) - world.y(loop.x)) - loop.y;
  if (Math.abs(dx) <= loop.radius + RADIUS
      && Math.abs(Math.hypot(dx, dy) - loop.ballRadius) < RADIUS * 1.12
      && racer.vx > 245) {
    const angle = (Math.atan2(dx, dy) + TAU) % TAU;
    racer.visited.add(obstacle); racer.grounded = false;
    racer.targetLane = obstacle.lane ?? PLAYER_LANE;
    racer.loopRide = { obstacle, angle, entryAngle: angle,
      exitAngle: Math.ceil((angle + TAU * 0.65) / TAU) * TAU,
      speed: Math.max(650, racer.vx), entry: { x: racer.x, y: racer.y }, entryProgress: 0 };
    ...
```

Loop exit hands back `min(maximumSpeed, ride.speed * 1.08)` at `loop.x + 3` — **and every racer on a loop is forced to `obstacle.lane`**, which is why the first loop is the natural merge point (all riders already funnel to one lateral target). `resolveBumps()` explicitly skips pairs where either rider is in `loopRide`.

**Recovery** (`recoverRacer`, `:127-155`) respawns at `respawnX(...)` from a `RecoveryPolicy`, picks the nearest gap-free lane by `laneZ(candidate)`, and hands back `RECOVERY_RESPAWN_SPEED = 390` with 1.0 s of `recoveryUntil` and 1.5 s of `immuneUntil`. The race uses `LEGACY_RECOVERY` (0.72 s fall timer only); qualifying uses `PROGRESS_RECOVERY` (also depth 360 / lava 260) — `docs/QUALIFYING.md` §1 explains why this split exists and that it is tested bit-for-bit against the pre-refactor engine by `tests/physics-parity.test.ts`.

`docs/COLLISION.md`, `docs/COLLISION.md`-adjacent modules `src/game/collision/{spatial-hash,contacts,cooldowns}.ts` exist and are **test-only** — `engine.ts` still runs the legacy O(n²) loop (§5.3). Likewise `src/game/cube-sphere.ts`, `cube-sphere-atlas.ts`, `dent-state.ts`, `rolling-state.ts`, `rolling-resistance.ts`, `pickups/claims.ts`, `physics/wall-ccd.ts`, `gameplay-props.ts` are implemented + tested but **not wired into a race**. They are candidate building blocks (see §8-D4, D8, D10).

### 5.3 Collisions `[C]` — `engine.ts:599-695` `resolveBumps()`

```ts
private resolveBumps() {
  for (let i = 0; i < this.racers.length - 1; i++) for (let j = i + 1; j < this.racers.length; j++) {
    const a = this.racers[i]; const b = this.racers[j];
    if (a.finished || b.finished || a.falling || b.falling || a.loopRide || b.loopRide
      || this.runTime < a.immuneUntil || this.runTime < b.immuneUntil) continue;
    const dx = b.x - a.x; const dz = b.z - a.z; const dy = b.y - a.y;
    const diameter = RADIUS * 2 + 4;
    const distance = Math.hypot(dx, dz, dy);
    if (distance >= diameter || Math.abs(dy) > RADIUS * 1.55) continue;
    ... // mass-weighted separation, 0.38 s per-pair cooldown, shield absorption,
    ... // then a lateral "shove" kick = 270 + closing*0.22 (×2.5 on heavy impacts)
    this.emit(x, y, z, particleCount, particleColor, particleSpeed);   // ← never drawn (§5.8)
    if (isHeavyImpact) this.shake = Math.min(15, closing * 0.05); this.audio.play('bump');
  }
}
```

`shove(racer, direction, speed)` (`:676-683`) writes `targetLane = clamp(lane − sign(direction), 0, 3)`, `vz`, and `steerLockedUntil = runTime + 0.28 * bumpRecovery`. **That `0..3` clamp is a hard assumption R12 must replace** with "nearest path / stay inside the authored corridor".

Per-pair cooldowns live in a `Float64Array(16)` indexed `i*4 + j` — already too small for a 20/50/100 field (T02/T07 flagged it).

### 5.4 Camera and 3D rendering `[D]` — `src/game/renderer-3d.ts` (1796 LOC)

**The rig today** (`:1408-1443`), third-person chase, expressed in spline distance:

```ts
function cameraRigAt(track: TrackData, d: number) {
  const rig = { back: 950, height: 430, side: 0, lookAhead: 1500 };
  const canyon = bump(d, track.stageStart.canyon - 1800, track.stageEnd.canyon + 300, 1400);
  rig.back += 1500 * canyon; rig.height += 900 * canyon; rig.side -= 1500 * canyon;
  track.loops.forEach((l) => {
    const w = bump(d, l.start - 2600, l.end, 1600) * (l.def.stage === 'mine' ? 1 : 0.7);
    rig.back += 1400 * w; rig.height += 650 * w; rig.side += 1400 * w;
  });
  const arena = smoothstep(track.stageStart.stadium, track.stageStart.stadium + 1800, d);
  rig.back += 500 * arena; rig.height += 450 * arena;
  return rig;
}

private placeCamera(d: number, dt: number) {
  const rig = cameraRigAt(this.track, d);
  const at   = this.track.sampleAt(clamp(d - rig.back, 0, this.track.length));
  const look = this.track.sampleAt(clamp(d + rig.lookAhead, 0, this.track.length));
  this.camera.position.copy(at.pos).addScaledVector(at.up, rig.height).addScaledVector(at.right, rig.side);
  const target = look.pos.clone().addScaledVector(look.up, 140);
  this.camUp.lerp(at.up, 1 - Math.exp(-dt * 5)).normalize();
  this.camera.up.copy(this.camUp);
  this.camera.lookAt(target);
}
```

Camera: `new THREE.PerspectiveCamera(62, aspect, 30, 200000)`; renderer uses `ACESFilmicToneMapping`, `setPixelRatio(min(dpr, 2))`, and fog that lerps to cave fog inside the mountain (`updateAtmosphere`, `:1626-1653`). **Free-fly overrides the rig** — `if (!this.trackBuilder.freeFly.active) { this.placeCamera(...); this.updateAtmosphere(...); }` (`:1769-1775`). Any first-person mode must live inside that same conditional chain.

`TrackData` (`:189-198`): `{ length, samples, distOf(label), stageStart, stageEnd, loops[{start,end,def}], bridges, sampleAt(dist) }`; `TrackSample` = `{ pos, tangent, up, right, dist, stage, halfWidth, turnRate, inLoop, onBridge }`. `sampleAt(d)` rounds `d * space.samplesPerArc`.

**Racer meshes** (`:1670-1735`): one shared `SphereGeometry(RADIUS, 24, 16)`, one `MeshStandardMaterial` per racer textured by a `CanvasTexture` made from `assets.raceBalls[i]` (cached by canvas identity with refcounts, released by `releaseRacerMesh`), plus a shared shadow plane and a wireframe shield sphere. Spin is `mesh.sphere.rotation.x += (racer.vx * dt) / RADIUS;` (`:1760`) — that single line is R5's insertion point. Placement is `placementFromEngine(...)` (`:1752-1756`), the shared function physics also uses.

### 5.5 The HUD `[E]`

Markup today (`RaceScreen.tsx:425-470`):

```tsx
<div className={`game-hud ${gearOpen ? 'hud-menu-open' : ''}`}>
  <div className={`hud-gear ${gearHidden ? 'gear-hidden' : ''}`}> … gear button + menu … </div>
  <div className="hud-right">
    <div className="stage-actions"> pause / restart / fullscreen buttons </div>
    <div className="hud-telemetry">
      <PositionMedallion position={snapshot.position} />
      <BlizzardGauge variant="dial" value={snapshot.speed} max={360} unit="km/h" label="SPEED"
                     title={`Speed: ${snapshot.speed} km/h`} />
    </div>
  </div>
</div>
<AirSupplies snapshot={snapshot} />
<div className="mini-trackbar" …>            // sector name, progress rail, racer pips
```

`BlizzardGauge` (`src/components/ui/BlizzardGauge.tsx`) is a pure SVG component with `variant: 'arc' | 'dial' | 'meter'`, `value/max/label/unit/size/readout/title`; its CSS (`.blizzard-gauge`, `.gauge-*`, `.dial-*`) lives in `src/hud.css` — engraved gold/molten palette, animated via CSS transitions on stroke-dashoffset/rotation. `PositionMedallion` is a 64 px tiered disc (gold/silver/bronze/iron).

**Everything a gauge may bind to** is `GameSnapshot` (`types.ts:93-127`):

```ts
status, distance, speed, power, angle, bounces, boosts, inLoop, falling, hopReady, grounded,
grade, sector, score, notice, progress, position, lane, targetLane, laneLocked, bumps, raceTime,
racers: RacerStanding[], settling, finishWait, pickups, shieldSeconds,
lastPickup: PowerupKind | null, pickupNoticeUntil, checkpointStandings?, countdownNumber?
```

`GameSnapshot` is refreshed by `refreshSnapshot()` (`engine.ts:695-714`) and pushed to React only when a field actually changes (`notify()`, `:772-780`, ≤1 update/100 ms). Snake-case of gauges available now: speed, position, boost charges, bounce charges, shield seconds, grade %, distance/remaining, race time, sector, lane, bumps.

HUD CSS lives in `src/hud.css` (gauges/medallions/drawers), `src/index.css` (`.game-stage`, `.game-canvas`, `.game-hud`, `.mini-trackbar`), with responsive blocks at 354/385/430 and `.game-shell:fullscreen`/`.theater-mode` overrides at `index.css:217`.

### 5.6 The builder and authoring storage `[F]`

**`TrackBuilder3D`** (`src/game/track-builder-3d.ts`, 3204 LOC) — an in-scene editor that shares the live `THREE.Scene` and `PerspectiveCamera` with the race renderer. Public surface (line numbers from the file):

- Props: `getProps`, `getSelectedProp(s)`, `selectProp(id, multi)`, `selectMultipleProps`, `groupSelected`/`ungroupSelected`/`isSelectionGrouped`/`getGroupCentroid`, `moveSelectedProps`, `rotateSelectedProps`, `scaleSelectedProps`, `tiltSelectedProps`, `flipSelectedProps`, `duplicateSelected`, `deleteSelected`/`deleteProp`, `focusProp`, `updatePropTransform(id, updates, autoSync)`
- Authoring: `setActivePropType`, `getActivePropType`, `placeActiveProp(clientX, clientY, canvas)`, `updateGhostPosition`, `raycastProp`, **`raycastSurface(clientX, clientY, canvas)`** → `{ point: Vector3, normal: Vector3, sample?: TrackSample }` (returns `sample` when within 1800 units), `nudgeDecalSide`, `alignDecalToTerrain`, `rotateDecal`, `resetDecalFlat`
- Visibility/dimensions/animation: `toggleVisibility`, `setVisibility`, `getEffectiveDimensions`, `setSelectedDimensions`, `clearSelectedDimensions`, `setPropAnimation`, `setSelectedPropsAnimated`, `setAllPropsAnimated`, `nudgeSelectedAnimSpeed`
- Lifetime: `pushUndo()` / `undo()` / `redo()` (JSON snapshots, depth 30), `saveToStorage()`, `loadFromStorage()`, `exportJson()`, `importJson()`, `clearAll()`, `destroy()`, `onChange(cb)`, `startPeriodicBackupTimer(30 s)`, `onBackupStatus`
- Camera: `readonly freeFly = { active, x, y, z, yaw, pitch, speed }`, `updateFlyCamera(dt, keys)`, `rotateCamera(dx, dy)`, `jumpToStage(name)`
- Snapping flags: `builder.snapping = { alignToTrack, snapToCenterline, gridSnap, cameraFacingDefault, decalDefault, decalLightingDefault }`

**`PlacedProp`** (`:236-265`) — the authoring record; note the deliberate forward-compatibility tail:

```ts
export interface PlacedProp {
  id: string; type: string; name: string; x: number; y: number; z: number;
  rotY: number; rotZ?: number; rotX?: number; quaternion?: [number, number, number, number];
  scale: number;
  width?: number; height?: number; depth?: number;      // explicit overrides, NOT scaled again
  alignToTrack: boolean; trackDist?: number;
  cameraFacing?: boolean; flipX?: boolean; isDecal?: boolean; groupId?: string; lit?: boolean;
  visible?: boolean; animate?: boolean; animated?: boolean;
  animSpeed?: number; animFrames?: boolean[]; animFrameDelays?: number[];
  authoringNotes?: string;
  [key: string]: unknown;                                // unknown fields survive a round trip
}
```

**`PropDefinition`** (`:20-42`) drives everything: `{ type, name, category, url, defaultWidth, defaultHeight, defaultDepth?, alignBottom?, isRamp?, isDecal?, is3DModel?, isSlingshot?, isPowerup?, isBarrier?, isAnimated?, animCols?, animRows?, animFps?, stillType?, animatedTwin? }`. Categories (`:18`): `foliage | trackside | cavern_mine | stadium | decals | goblins | powerup | barrier | animated`.

**Animation plumbing that already exists and should be reused for effects** (`:2697-2830` `createPropSprite`): sprite/plane gets `userData.anim = { cols, rows, fps, phase }`, `animFrameUV(frame, cols, rows)` maps a frame to the sheet's UV origin, `animPhaseFor(propId, total)` desyncs twins, `updateAnimations(timeSec, reducedMotion)` (`:2661-2686`) advances frames and freezes on frame 0 for reduced motion. Sheet playback settings are per-prop (`animate`, `animSpeed` 0.25–4, `animFrames[]`, `animFrameDelays[]`).

**Builder UI** (`src/components/TrackBuilderUI.tsx`, 2902 LOC): one React panel; category strip at `:36-46`; state for category, active prop type, selection, click-move, nudge axis, snapping toggles, sky menu, backup modal, per-frame delay editor. It renders inside `.game-stage` over the canvas (`RaceScreen.tsx:417-424`) and receives `{ builder, canvas, onClose, onRequestRender }`. Builder mode pauses the race (`engine.setBuildPaused(true)`).

**Authoring storage** (`src/game/track-storage.ts`): `TRACK_STORAGE_VERSION = 1`, keys `hm2-track-props-v1` + `-backup`, plus the legacy `hm2-3d-track-props` read as a migration source. API: `validateProps`, `buildStorageDocument`, `readStorage`, `writeStorage`, `restoreFromBackup`, `exportProps`, `importProps`, `clearStorage`. Validation rejects duplicate IDs and non-finite/non-positive dimensions, reports `quotaExceeded`, and preserves unknown fields. The Vite dev server also exposes `POST /api/backup-props` (`vite.config.ts`) which mirrors props to `backups/props/track-props-latest.json` + history, with a guard refusing to overwrite a larger set with a ≥25 % smaller one. **A new lane-path document needs the same treatment (own key, version, backup, validation, and — ideally — the dev-server backup route) rather than being stuffed into the props document.**

### 5.7 The sorting machinery that already exists — and is **not wired in** `[G]`

This is the most important finding for R9/R10. Two independent implementations exist:

**(a) The legacy in-engine checkpoint** (`engine.ts:299-432`) — crude, wall-clock, and currently fires at a hard-coded `checkpointX = 17000` (the *fourth* ridge loop, not the first):

```ts
private triggerCheckpoint() {                       // :299
  if (this.checkpointTriggered) return;
  this.checkpointTriggered = true;
  this.snapshot.status = 'checkpoint';
  ... // solo mode rebuilds the field behind the player
  this.frozenVelocities = this.racers.map(r => ({ vx: r.vx, vy: r.vy, vz: r.vz }));
  for (const racer of this.racers) { racer.vx = 0; racer.vy = 0; racer.vz = 0; }
  const standings = [...this.racers].sort((a, b) => b.x - a.x).map(…);   // snapshot.checkpointStandings
}

readyUp() {                                          // :377  (UI button)
  if (this.snapshot.status !== 'checkpoint') return;
  this.snapshot.status = 'countdown';
  this.countdownInterval = setInterval(() => { … }, 1000);   // ← wall-clock, not ticks
}

private releaseFromCheckpoint() {                    // :401
  const sorted = [...this.racers].sort((a, b) => b.x - a.x);
  ... racer.x = sorted[0].x - index * RADIUS * 3;          // ← teleports racers to make room
  sorted.forEach((racer, index) => {
    const saved = this.frozenVelocities[racer.id];
    setTimeout(() => { racer.vx = saved.vx; … }, index * 300);   // ← wall-clock stagger
  });
}
```

Triggered from `stepRace` (`:571-578`) on `player.x >= this.checkpointX`. Problems a plan must name: wall-clock timers (violates the tick law), teleporting racers (violates "do not teleport opponents invisibly"), `checkpointStandings` computed but no runtime consumer, and `setInterval` cleanup only on `reset()`/`destroy()`.

**(b) The tested T04/T05/T06 stack — built for exactly this feature, currently dead code at runtime:**

| Module | What it already does | Evidence |
|---|---|---|
| `src/game/qualifying/gate.ts` | `QUALIFYING_GATE_ID = 'first-loop-entry'`; derives the gate **from the course**, not from authoring: `loop = the lowest-x kind==='loop'` obstacle; `gate.x = loop.x − (loopGeometry(loop).radius + RADIUS)`; `gate.z = obstacleZ(loop)`; `gate.halfWidth = LANE_WIDTH/2 = 120`; `gate.altitudeTolerance = 90`; segment from `segmentAtX`. Sub-tick crossing time `(tick + crossingFraction)/120`. Validation order: forward motion → plane inside tick → lane → altitude → segment, each with a named refusal. | `docs/QUALIFYING.md` §2 |
| `src/game/qualifying/session.ts` | Heat scheduler: staging, **bounded CPU deployment** so 100 bots don't all step at once, retries without freezing bots, contract ranking. | 22 checks in `tests/qualifying-session.test.ts` |
| `src/game/qualifying/attempt.ts` | One racer, one private clone of the course (`cloneLayout` clears `hit/hitAt/hitMask/hitBy/broken/collectedBy/collectedAt`), own seeded RNG, own recovery budget (`PROGRESS_RECOVERY`, respawn at best grounded progress − 40, floor `START_X + 440`), deadline `config.qualifying.deadlineSeconds` (20 s). | `docs/QUALIFYING.md` §3 |
| `src/game/release/grid.ts` | `buildFrozenGrid(rankedEntries, corridor)` — pole at the front of the corridor without teleporting, wave spacing clamped to the corridor minimum, lane count auto-reduced, exit speed preserved exactly (no ×1.08), stalls flagged not repaired. | 22 checks |
| `src/game/release/scheduler.ts` | `computeReleasePlan` + `ReleaseExecutor`: waves front-to-back, **live occupancy re-checked at every release tick**, delayed slots reschedule with bounded retries, blocked waves flagged, all release times quantised up to tick boundaries, actual span reported. | 27 checks |
| `src/game/release/go-clock.ts` | `GoClock` — one absolute finish clock from the GO tick, ties broken by racerId, auto-settle at timeout, `recordFinish()` for finishers. | 16 checks |
| `src/game/staging/lifecycle.ts` | Refusal-first state machine `qualifying → results → staging → countdown → released` (+ `paused`, `retry`); countdown **derived from ticks** (`COUNTDOWN_SECONDS = 3` = 360 ticks), label `3/2/1/GO!`; `pause` freezes `currentTick`. | `tests/staging-lifecycle.test.ts` |
| `src/game/staging/presentation.ts` | Orbit bands, leaderboard bounded at 100 rows, highlights, grouped by wave above 20. | 19 checks |
| `src/components/StagingOverlay.tsx` | Presentation-only React overlay: focus handling, `aria-live` countdown, reduced-motion path, full leaderboard toggle. **CSS classes exist but styles are not written** (`docs/STAGING.md` says "wire it into RaceScreen") | file read |
| `src/game/contracts/qualifying.ts`, `commands.ts`, `config.ts` | Frozen: gate/ranking/crossing types, `validateCommand` (`aim`, `launch`, `steer`, `hop`, `bounce`, `boost` gates), `FIELD_SIZES = [4,20,50,100]`, `QUALIFYING_REQUIRED_ABOVE = 4`, `normalizeRaceConfig` + refusals. | 451-test suite includes them |

Nothing in `src/game/qualifying/**`, `src/game/release/**` (except `docs`), or `src/game/staging/**` is imported by a runtime component. `NewGameSetup.tsx:183-185` still tells the user *"qualifying heats are not implemented yet."*

**Planning implication:** R9/R10 is closer to "wire up and re-purpose tested code" than "write a new system". The mismatch to resolve: T04/T05/T06 assume **qualifying before the race** (isolated attempts → ranking → grid → staged release), whereas the user describes **sorting during the race at the first loop** (ride the loop, pool, ready-up, exit in entry order). The gate, the ranking, the tick-derived countdown, the occupancy-checked release, and the go-clock all transfer; the *phase order* does not.

### 5.8 Effects today, and the animation sheets `[H]`

**What exists:** `engine.emit(x, y, z, count, color, speed)` (`:748-756`) pushes 2D particles into `this.particles` (hard cap 160, `size 2..6`, gravity 310, life 0.35–0.95 s) and `engine.updateParticles(dt)` ages them. `emit()` is called from ~25 places: obstacle hits (tnt/spring/sheep/blimp/sign/water_rock/cauldron), loop exit, landing, boost, hop, bounce, shove, shield absorb, recover, lava plunge, finish. Airborne sheep (`airSheep`) and the 9-point `trail` are likewise simulated in the engine.

**What does not exist:** any consumer. `Renderer3D.render()` reads only `frame.ball`, `frame.racers`, `frame.runTime`, `frame.time`, `frame.reducedMotion`. There is no `THREE.Sprite`/`THREE.Points` emitter in the race path. **So in the current 3D build all of those effects are invisible.** R6 is therefore not "add effects" alone — it is "build the effect presentation layer (and decide how much of the engine's particle simulation survives)".

**Effect sheets already in the tree** (`public/art/animated/alpha/*.png`, registered as builder props at `track-builder-3d.ts:477-486`): every sheet is **4 frames in a 2×2 grid** with a suggested fps and a nominal world size.

| Prop type | Sheet | Nominal size | fps |
|---|---|---|---|
| `anim_43_explosion_fire` | `anim-43-explosion-fire.png` | 480×480 | 16 |
| `anim_44_spark_burst` | `anim-44-spark-burst.png` | 420×420 | 14 |
| `anim_45_smoke_puff` | `anim-45-smoke-puff.png` | 440×440 | 10 |
| `anim_46_gore_burst` | `anim-46-gore-burst.png` | 400×400 | 14 |
| `anim_47_gore_green_burst` | `anim-47-gore-green-burst.png` | 400×400 | 14 |
| `anim_48_ground_impact` | `anim-48-ground-impact.png` | 480×300 | 14 |
| `anim_49_dust_puff` | `anim-49-dust-puff.png` | 460×360 | 10 |
| `anim_50/51/52_firework_*` | red/blue/green | 460×460 | 14 |

**Quality caveats measured by the project's own audit** (`docs/EXPANSION_PROGRESS.md`, "Update 4"): *"Three sheets are clean and trustworthy: anim-43 (fire explosion), anim-46 (red gore) and anim-50 (red firework). Seven need a regeneration pass."* Specifically anim-47 (gore green) and anim-49 (dust) fail centroid drift (70.5 px / 93.5 px — the burst slides across the panel); anim-51 and anim-52 are near-static (element delta 0.032 / 0.098 — four near-identical frames); anim-48 barely animates (0.059) and carries 0.945 % magenta remnant; anim-45 has 1.008 % remnant. **A plan that hooks up "smoke/dust/sparks" should either budget regenerations or specify fallbacks** (e.g. use anim-43/46/50 plus procedurally animated billboards for dust/smoke).

**Audio cues available** (`src/game/audio.ts`): `'launch' | 'hop' | 'bounce' | 'bump' | 'boost' | 'boom' | 'sheep' | 'loop' | 'finish' | 'land' | 'pickup' | 'shield'` — all synthesised locally with Web Audio (no assets). A "starter goblin grunt/impact" cue would be a new name in this union.

**Existing decorative animated props** (anim 01–42) are wires/billboards placed by the builder and advanced by `updateAnimations` — they are not runtime effects and must not be used as such.

### 5.9 Lane-geometry touch list `[I]` — every place that assumes four discrete lanes

| File | Uses | Why it matters to R12 |
|---|---|---|
| `src/game/scene.ts` | `LANE`, `LANE_WIDTH`, `laneZ`, `closestLane`, `obstacleZ`, `obstacleBounds`, `occupiesLane` | The whole discrete-lane vocabulary. |
| `src/game/sim/racer-physics.ts` | 8 uses: steering target, lateral clamp, recovery lane choice | R12's core edit. |
| `src/game/sim/cpu-driver.ts` | 3 uses: lane scoring, rival proximity test `|other.z − laneZ(lane)| < 90`, hop-before-gap | AI must aim at path centres. |
| `src/game/engine.ts` | 7 uses: shove `clamp(…,0,3)`, `closestLane` in snapshot/standings | Shove must clamp to the authored corridor. |
| `src/game/environment.ts` | **72 uses** | Scenery/rails/crowd rows are laid out against the same lane frame; a path system that moves the drivable corridor can desync the dressed world. Prefer *additive* path data over moving existing scenery. |
| `src/game/track-space.ts` | `LANE_Z_RANGE = 480`, `lateralFromLaneZ`, `laneZFromLateral`, `LATERAL_RADIUS_FACTOR = 1.2` | Mapping layer between `z` and world lateral offset. |
| `src/game/qualifying/gate.ts`, `qualifying/field.ts`, `qualifying/mystery.ts`, `contracts/release.ts` | gate lane containment, corridor definitions | Corridor/release logic reads lane geometry. |
| `src/game/powerups.ts`, `collision/contacts.ts`, `track-3d-data.ts` | spawn placement, contact math, `LANE_WIDTH_3D = 240` | Secondary. |

Also frozen and relevant: `docs/TRACK_SPACE.md` (mapping contract), `docs/TRACK_STORAGE.md` (authoring storage contract), `docs/CONTRACTS.md` (what "frozen" means), `docs/COLLISION.md`, `docs/RELEASE.md`, `docs/STAGING.md`, `docs/QUALIFYING.md`. `src/game/contracts/` is imported by `engine.ts` only for `FIXED_STEP`; everything else there is consumed by tests. `CONTRACTS_VERSION = 1` in `core.ts` — bump it if you change a frozen shape.

### 5.10 Start-zone reconnaissance — real numbers `[J]`

Measured by evaluating the real modules in this session (`createTrackLayout`, `loopGeometry`, `courseY`, `createSimWorld`):

```
first loop obstacle (ridge):  { kind:'loop', x:1370, width:375, height:322, lane:2, laneSpan:1 }
loopGeometry(first loop):     { x:1370, y:315.44, radius:154.56, ballRadius:114.56, halfWidth:58 }
T04 gate formula would put the first-loop gate plane at  x = 1370 − (154.56 + 31) = 1184.44
engine checkpoint today:      x = 17000  (the 4th ridge loop; courses have 3–4 'loop' + 3 'lava_loop')

courseY(190)  = 478.0   courseY(1370) = 478.0      → the run-up to the first loop is FLAT
courseSlope(START_X)=0.0000   slope@700=0.0000   slope@2000=0.0483
surface at start = { y:478, slope:0, ramp:null }
laneZ: lane0 +360, lane1 +120, lane2 −120, lane3 −360   (LANE ±480, RADIUS 31)

obstacles before x=1500 (ridge):
  ramp@510 ×4 lanes | boost@770 ×4 lanes | sign@980 | blimp@1045 | sheep@1160 | loop@1370 (lane 2)
```

Implications the plan must handle explicitly:

1. **The starting zone is flat, so gravity alone will never move a ball.** `downhill = GRAVITY·slope/(1+slope²)/1.4` is 0 at slope 0. The slingshot is not decoration — it is the only initial energy source. **The goblin push must be a real impulse** (e.g. 300–450 x-units/s applied over ~0.4 s), not a cosmetic animation.
2. The first loop is at engine x 1370 → **distance 590 m**, which is *inside* the existing ramp/boost/sign/blimp run-up. A "starting zone + push + run down to the first loop" that reads cleanly needs those first 1 370 x-units re-authored (ramps at 510 and boosts at 770 currently sit in what would become the push lane), or the start moved uphill/back with a new flat start pad.
3. Because all riders are forced to `obstacle.lane` while on a loop, the first loop is the only place in the current physics where the field naturally converges — a good sign for R9/R10, and it means the merge pool does not need new lateral convergence logic, only gating and ordering.
4. `TRACK_DISTANCE = 36000` and `FINISH = 72190` are asserted all over the UI and records; a start-zone change must keep `distance` semantics (`distance = (x − START_X)/2`) or migrate every consumer.

---

## 6. GAP ANALYSIS — R → STATE → FILES → WHAT IS MISSING

| R | Current state | Primary files | What is missing |
|---|---|---|---|
| R1 | Third-person rig only (`back/height/side/lookAhead`), plus a builder free-fly override | `renderer-3d.ts:1408-1443, 1615-1625, 1769-1775`; `projection.ts` `RangeCamera` (2D-era, still used for pointer unprojection + viewport width) | A first-person rig mode; eye placement inside the ball (or in the cockpit frame); a viewport/window mask; handling of loops (upside-down), ramps, and `camera.up` during a loop ride; a mode switch that survives `setOptions` |
| R2 | SVG gauges (`BlizzardGauge`, `PositionMedallion`) bound to `GameSnapshot` | `RaceScreen.tsx:425-470`, `hud.css`, `BlizzardGauge.tsx` | Painted PNG HUD panels/bezels; deciding DOM overlay vs canvas; gauge→snapshot wiring for boost/bounce/shield/grade/time; idle-fade behaviour (`hudIdle` after 2.4 s) |
| R3 | Nothing | — | Yoke art + steering-driven transform; input already exists (`changeLane(±1)` → `targetLane`), so the yoke angle can be derived from `snapshot.targetLane` / `vz` |
| R4 | Nothing | — | Arm art + the transform that makes arms follow the yoke, with a bottom-of-screen crop (CSS `overflow:hidden` or an SVG clip) |
| R5 | One `SphereGeometry` per racer with `rotation.x += vx·dt/RADIUS` | `renderer-3d.ts:1655-1735, 1760`; unused-but-tested `cube-sphere.ts`, `rolling-state.ts` | The three-part mesh (middle sphere + 2 caps), the counter-rotation law that keeps the goblin frame level, a decision on whether caps are hemispheres of the same texture or separate art, and cheap geometry (do not add per-frame allocation) |
| R6 | Engine emits 2D particles nobody draws; effect sheets exist as builder props only | `engine.ts:748-770`, `renderer-3d.ts:1736-1790`, `public/art/animated/alpha/anim-4*.png`, `art-manifest.json` | An effect runtime (pooled billboards/points with sheet UV animation), event→effect mapping per gameplay event, preloading, particle budget, reduced-motion path, and a decision about the existing engine particle buffer |
| R7 | Slingshot launch: drag/Enter, `launchVelocity`, 4 ramps + 4 boosts in the run-up | `engine.ts:232-250, 465-499`; `scene.ts` `LAUNCHER/AIM_ANCHOR`; `track-layout.ts` start section; `RaceScreen.tsx` aim hint + canvas aria-label | Starter-zone layout, a push impulse, a starter-goblin actor + animation, removal/replacement of drag-aim UI, and the loading-cover copy |
| R8 | Run already descends, but the flat run-up and the first loop's position are as measured in §5.10 | `scene.ts` elevation table, `track-layout.ts` | Re-authored start section that actually rolls downhill into the first loop |
| R9 | Legacy `checkpoint/countdown` with wall-clock timers at x=17000; T04/T05/T06 stack tested but unwired | `engine.ts:299-432`; `qualifying/**`, `release/**`, `staging/**` | Tick-derived gating at the first loop, a real pool, ready-up semantics, unfreeze, and UI |
| R10 | `releaseFromCheckpoint` teleports + `setTimeout` stagger | same | Entry-order (time-in) ranking, collision-free exit, occupancy checks, and proof (headless test) |
| R11 | `resolveBumps` works, including shove and shields | `engine.ts:599-695` | Re-enable contacts after the merge, and make the shove respect the corridor instead of `clamp(0,3)` |
| R12 | Fixed 4 lanes from `laneZ()` | §5.9 list | A path data model, runtime sampling, physics integration, and a renderer visualisation |
| R13 | Builder has props only; no graph/path concept; storage is prop-shaped | `track-builder-3d.ts`, `track-storage.ts` | Node graph (paths as ordered node lists), merge/split topology, OOB node type, validation, storage v1 + backup, dev-backup route |
| R14 | Builder UX exists for props (ghost preview, snapping, undo, drawers) | `TrackBuilderUI.tsx` | A "Lanes & Paths" tool: node handles, drag, insert/delete, merge/split commands, node type inspector, snapping to track samples, undo integration |

---

## 7. DECISIONS YOUR PLAN MUST MAKE (with the Hands' recommendation)

Answer each with **accept / amend / reject + reason**. Freeze the chosen numbers in the ticket so the Hands cannot invent them.

| # | Decision | Options | Hands' recommendation |
|---|---|---|---|
| **D1** | Where does the first-person camera live? | (a) New mode inside `cameraRigAt`/`placeCamera` in `renderer-3d.ts`; (b) a separate `FirstPersonRig` module that `Renderer3D` delegates to; (c) a `THREE.Camera` attached to the racer group | **(b)**, exposed as a pure function `firstPersonFrame(track, space, racerState, opts) → { position, forward, up, roll }` so it is unit-testable headlessly, with `Renderer3D` doing only `camera.position.copy(...)`. It must consume the same `placementFromEngine` output the physics/renderer already share. |
| **D2** | Camera mode plumbing | Extend `CameraMode` (`types.ts:8`: `'third_person' \| 'follow_ball' \| 'fixed'`) with `'first_person'`, or add a separate `cockpit: boolean` option | **Extend `CameraMode`** and keep the default for backwards compatibility; `DEFAULT_OPTIONS.cameraMode` is currently `'follow_ball'` (`types.ts:186`) — decide the new default. `preferences.ts` validates stored options, so an unknown value must degrade, not crash. |
| **D3** | How is the "tank window" drawn? | (a) DOM overlay with a transparent PNG frame + CSS `clip-path`/`mask`; (b) in-scene 3D cockpit geometry; (c) canvas-2D pass over the WebGL output | **(a)**, because the HUD, yoke and arms are DOM-verifiable headlessly (§2) and cannot desync the GL pipeline. The 3D world must render *behind* the window; a radial/soft mask plus a dark bezel PNG sells the armour. Only reject this if you want the window to bob with the physics — in which case the bob amount becomes a pure function too. |
| **D4** | The gyro ball (R5) | (a) Middle sphere + 2 hemispherical caps, caps counter-rotate to hold the goblin frame level while the middle rolls; (b) simulate rolling in `rolling-state.ts` (sim-owned quaternion, renderer reads only) and add caps as a *visual* sub-tree; (c) full 6-axis rigid body | **(b) then (a)**: the repo's law is "simulation owns state, renderer reads". `rolling-state.ts` already implements pure rolling `ω = v/r` with `orientation`, `rollingPhase`, `angularVelocity`, visual-only bob, and is covered by `tests/dent-rolling.test.ts` + `integration-benchmarks.test.ts`. Decide the exact law, e.g. *middle sphere: `rotation.x += vx·dt/RADIUS` about the lateral axis; caps: same magnitude, opposite sign, so their world orientation stays constant* — and specify what happens in a loop and in a fall. Also decide whether caps use the same ball texture or new art. |
| **D5** | The push start (R7) | (a) Particle-free `applyPush(racer)` in `sim/racer-physics.ts` that sets `vx` for every racer at t=0 with a small per-racer spread; (b) a timed push window with a starter-goblin actor and a "GO" tick; (c) keep Enter/drag but change the visual | **(b)** with (a)'s math: a pure `pushImpulse(loadout, rng) → vx` in the sim, a `'pushed'` status or reuse of `flying` with a `runTime` gate, and the animation as presentation. Must be tick-driven, must be reproducible for tests, and must keep `distance`/`launchOrigin` semantics. |
| **D6** | What replaces the slingshot's removal? | Delete `launch()`/drag-aim entirely, or keep them behind a flag | **Keep the code path but stop routing input to it** (a `startMode: 'push' \| 'sling'` config would let the Hands A/B it and keep `commands.ts` valid). `contracts/commands.ts` gates `aim`/`launch` on the sling — record whether you bump `CONTRACTS_VERSION`. |
| **D7** | R9/R10 architecture | (a) Re-purpose T04/T05/T06 (`gate.ts` + `session.ts` + `release/*` + `staging/lifecycle.ts`) with a new phase order; (b) extend the legacy `engine.checkpoint` in place; (c) both, with the engine delegating | **(a)**, and treat the legacy checkpoint as deprecated (delete `setInterval`/`setTimeout` paths). The gate formula already yields "first loop entry" from the layout with no authoring, and the release scheduler already re-checks occupancy per tick. |
| **D8** | Pool + ready-up semantics | Who readies up: the player only, or each rider individually? Automatic after N seconds? What happens to a rider that never readies? | Specify explicitly. Suggestion: the player readies via the existing action button; bots ready with a deterministic per-racer delay derived from **entry time rank**; a rider that misses the window is released last, flagged (never dropped). All timers in ticks. |
| **D9** | Collision-free exit window | How is it enforced? | Options: (i) immunity `immuneUntil` for the ordered release window (existing field, zero new physics), (ii) `loopRide` already disables bumps, so extend it to a "merge corridor" state, (iii) explicit release scheduler with occupancy checks (T05 already does this). Specifying (iii) + (i) as the fallback matches the existing tested code. |
| **D10** | Effect runtime (R6) | (a) Pooled `THREE.Sprite`s with per-frame UV from sheets; (b) `THREE.Points` with a custom shader atlas; (c) keep the engine's 2D particle array and add a canvas-2D overlay pass; (d) mix: keep cheap 2D-looking sparks in the engine, sheet animation for the big events | **(a) + (d)**: one pooled billboard system (fixed pool size, e.g. 64, zero allocation per spawn) that consumes **effect events**, not particles. The engine's `SimFx.emit` is already the single funnel for every gameplay effect — extend it with a typed `effect(kind, x, y, z, opts)` so `emit()` can be retired or kept as a light spark path. Specify: pool size, per-kind sheet + fps + size + lifetime, distance culling, and the reduced-motion behaviour (freeze on a representative frame, or skip). |
| **D11** | Lane paths (R12/R13) — data model | Node list per path with branches? A single graph of nodes + segments? Per-lane paths that can merge? | Freeze a schema, e.g. `LaneNetwork { version, course, paths: Path[], nodes: Node[] }`, `Path { id, name, laneTag, nodeIds[], leftBound?, rightBound?, closed? }`, `Node { id, x, y, z, kind: 'normal' \| 'merge' \| 'split' \| 'oob', targetPathIds?, radius? }`. Decide: which space nodes are authored in (engine x + lateral `z` + altitude, or spline `s` + lateral), what "merge" does to the *right of way* and to collision resolution, and what an OOB node does (respawn via `recoverRacer('depth')`, DNF, or a lap-time penalty). Say which course(s) it targets first (probably `ridge`). |
| **D12** | Lane-path runtime integration | Replace the 4-lane model, or layer it on top? | **Layer it**: keep `laneZ(lane)` as the default when no authored network exists for a course, and add `pathCenterAt(targetPath, x)` / `corridorBoundsAt(x)` used by steering, shove clamps, CPU aim and recovery when a network *is* present. This preserves 451 green tests and every tuned handling value. |
| **D13** | Authoring storage & backup | New key + version + backup + dev-server mirror, or extend `hm2-track-props-v1`? | **New document** (`hm2-lane-paths-v1` + `-backup`), same validation/atomicity/unknown-field rules as `track-storage.ts`, plus a `POST /api/backup-lane-paths` route mirroring to `backups/lane-paths/`. Never coerce nodes into `PlacedProp`. |
| **D14** | Art generation budget | Who generates: the Hands (image tool, ≤10 images/turn per this project's convention) or the user supplies art? | The Hands can generate. Specify the **exact list** you need: e.g. (1) cockpit window frame/bezel, (2) yoke, (3) left arm + hand, (4) right arm + hand, (5) HUD backplate, (6–9) gauge faces/dials, (10) starter goblin / push hand. Specify style anchors (the existing concept art: warm brass, weathered iron, olive goblins, teal shadows), required transparent background, and target pixel sizes + anchor points (where the yoke centre is, where the arms tuck under the screen edge). |
| **D15** | Verification standard | What is "done"? | Demand per ticket: (1) `npm run check` green (451 + new tests), (2) new pure-function tests for every new math (camera frame, push impulse, gate/ordering, path sampling, effect pooling), (3) `npm run build` green, (4) a headless DOM check where the change is DOM-visible, (5) a live preview URL for the human for anything WebGL. Explicitly list what remains **unverified** (visuals in sandbox). |

---

## 8. NON-REGRESSION LAW (violating any of these fails the ticket)

From `handoff.md`, `docs/*.md`, and the code itself:

1. **Player identity is `PLAYER_ID`, never index 0.** Player is orange, home lane 2 (zero-based). Opponents keep stable IDs 1..n across cup rounds.
2. **Fixed 120 Hz physics** (`FIXED_STEP = 1/120`) with bounded catch-up; interpolated rendering via `racer.previous` + `alpha`. No wall-clock gameplay timers.
3. **Never teleport opponents** to fake a close race; recovery is the only repositioning, and it is policy-driven.
4. **No per-frame mesh construction, no image generation/decode/SVG parsing in a render or physics tick.** Art is prepared before racing (`preloadRaceAssets`, `prepareRaceBalls`, `preparePowerupSprites`, `prepareRosterArt`) and cached.
5. **Bounded particles**, distance culling, and a reduced-motion path for anything that moves.
6. **The renderer reads frozen data and writes nothing back.**
7. **Preserve the mapping**: engine ↔ world through `track-space.ts` only. The three courses must be passed explicitly through engine/renderer/environment/pickup helpers — a default of `'ridge'` silently desyncs art from collision.
8. **Do not weaken persistence**: atomic, validated, idempotent; unknown fields preserved; duplicate IDs and invalid dimensions refused; a failed save must never destroy the last valid version.
9. **Do not break the cup/session guards** (`commitRound` validates session ID, round and course; duplicate rounds ignored; a committed round is never re-raced for points).
10. **Accessibility stays**: keyboard focus, focus-trapped dialogs, `aria` labels on controls, high-contrast and reduced-motion variants, readable small-screen HUD.
11. **Performance envelope**: adaptive resolution (auto ≤1.1 MP, performance 0.72 MP, high 1.85 MP), no growth with the 15 km track, `data-render-fps`/`data-render-cpu-ms` diagnostics must keep working.

---

## 9. HOW THE HANDS WILL PROVE YOUR TICKETS (and where they cannot)

- **Provable headlessly:** anything pure — camera frame composition, push impulse, gate crossing + ranking, pool/ready ordering, lane-path sampling, effect pool accounting, storage round-trips. Tests go in `tests/*.test.ts` and get added to `scripts/check.mjs`'s list so `npm run check` covers them.
- **Provable in a headless browser:** DOM overlays — HUD panel geometry at multiple viewports, yoke/arm transform values, gauge DOM/state, focus and aria (pattern: `tests/ui-frame-check.mjs`, `tests/ticket02-visual.mjs`, `tests/ticket07-visual.mjs`; note the last two need the race screen and therefore WebGL, so they **will time out here** — see §2).
- **Not provable here:** anything requiring a rendered 3D frame. The Hands must state this plainly instead of claiming a visual success.
- **Deliverable for the human:** a running preview at `https://<port>-<sandboxId>.e2b.app` after `npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173`.

---

## 10. RECOMMENDED WORK ORDER (the Hands' proposal — approve, reorder, or replace)

Sequenced so that each ticket is independently shippable, and so that risky physics changes land before the presentation that depends on them.

**T1 — First-person camera rig + cockpit window (R1, D1, D2, D3).**
Files: new `src/game/first-person.ts` (pure `firstPersonFrame(...)`), `renderer-3d.ts` (mode branch inside the existing `if (!freeFly.active)` guard), `types.ts` (`CameraMode` union + default), `preferences.ts` validation, settings UI, new CSS/overlay component.
Tests: pure camera tests (straight descent, ramp, loop apex, canyon bank, fall) asserting eye position, forward, and that `up` never degenerates; DOM test for the window overlay.
Open sub-decisions: eye height inside the ball (`RADIUS + h`), FOV change (62° today), whether the window masks the HUD, and what happens when inverted in a loop.

**T2 — Gyro ball: middle sphere + counter-rotating caps (R5, D4).**
Files: `renderer-3d.ts` (racer mesh build + the spin line), optionally `rolling-state.ts` wiring, `art-assets`/`assets` if caps take separate art.
Tests: rotation law as a pure function, mesh-tree structure without a GL context (pattern: `tests/racer-pool.test.ts` constructs `Renderer3D.prototype` without a WebGL context — reuse it), and pool disposal.

**T3 — PNG HUD, gauges, yoke, arms (R2, R3, R4, D14).**
Files: new `src/components/CockpitHud.tsx` + `src/cockpit.css`, `RaceScreen.tsx` (mount inside `.game-stage`, keep the existing gear menu/telemetry reachable), gauges reusing `BlizzardGauge` behaviour, art under `public/art/cockpit/`.
Tests: DOM geometry across viewports, gauge value↔snapshot mapping, steering transform math (yoke angle from `targetLane`/`vz`), reduced motion, idle fade.
Note: the arms/yoke must be cropped by the screen edge, so the overlay's container must `overflow:hidden` and the transform must be driven by the same steering state the physics uses.

**T4 — Effect runtime + event mapping (R6, D10).**
Files: new `src/game/effects/*.ts` (pool + spawn spec + sheet UV), `SimFx` extension, `engine.ts` event sites, `renderer-3d.ts` update+render hook, preloader list, sheet registrations.
Tests: pool never grows/allocs, spawn→frame→despawn timing, reduced-motion freeze, unknown kind is refused.
Risk to name: 7 of the 10 effect sheets are flagged (§5.8). Decide regeneration vs fallback before implementation.

**T5 — Push start + starting zone (R7, R8, D5, D6).**
Files: `sim/racer-physics.ts` (pure `applyStartPush`), `engine.ts` (status/flow, drag-aim routing removed), `track-layout.ts` + `scene.ts` (start section re-authoring for an actual downhill), `RaceScreen.tsx` (aim hint → "the starter goblin will push you"), starter-goblin actor art/animation.
Tests: impulse reproducibility; the field clears the first loop within N ticks at every loadout; no racer stalls on the flat; `distance` semantics unchanged.

**T6 — First-loop sorting: gate, pool, ready-up, ordered collision-free exit (R9, R10, R11, D7, D8, D9).**
Files: re-purpose `qualifying/gate.ts` (gate at the first loop — the formula already yields it), a new pool/merge state machine (tick-driven, tick-quantised), `release/scheduler.ts` for the ordered release, `engine.ts` to drive it from `stepRace`, `StagingOverlay.tsx` + CSS for the UI, `RaceScreen.tsx` wiring.
Tests: entry order == exit order for scripted entry times; no two exits overlap; a late/absent readier is flagged, never dropped; contacts are impossible inside the merge window and possible immediately after; determinism across repeated runs (fingerprint style, as `npm run qualifying -- --repeat` does).

**T7 — Lane paths: authoring + runtime (R12, R13, R14, D11, D12, D13).**
Files: new `src/game/lane-network.ts` (schema, validation, sampling, merge/split topology, OOB resolution — pure), `track-storage.ts`-style `lane-storage.ts`, `track-builder-3d.ts` (node objects, drag handles, hit-testing reusing `raycastSurface`), `TrackBuilderUI.tsx` (a "Lanes & Paths" category with node inspector, merge/split/OOB buttons), `renderer-3d.ts` (draw polylines + node gizmos), `sim/racer-physics.ts` + `sim/cpu-driver.ts` + `engine.ts` (steering/aim/shove through `pathCenterAt` when a network exists), `vite.config.ts` backup route.
Tests: schema validation and refusals; sampling monotonicity; merge/split topology; OOB trigger; steering through a path vs the legacy lane model produces identical results when no network exists (the parity guarantee); storage round-trip + quota.

---

## 11. QUESTIONS ONLY THE HUMAN CAN ANSWER

Put these in your reply's "Open questions" block; the Hands will relay them.

1. **Field size** for the new flow — the classic 4, or the experimental 20/50/100 (which would finally make the tested qualifying stack worth wiring)?
2. **Ready-up**: does the player press a button at the loop, or does the pool auto-release after a fixed window?
3. **Out-of-bounds nodes**: respawn with a time penalty, DNF, or instant reset to the last node?
4. **First-person only, or a selectable camera?** (Keeping third-person costs little and preserves existing UI/records.)
5. **Do the gyro caps carry art** (team colour, armour texture) or stay plain metal?
6. **Push strength** — should a good start be skill-based (timing the goblin's shove) or fixed and fair?
7. **Lane paths**: do lanes remain four, visually and in gameplay, or can the authored network make 3 or 6 lanes wherever the user wants?
8. **Art direction approval** before the Hands spends its image budget on the cockpit set.

---

## 12. REQUIRED SHAPE OF YOUR REPLY

```md
## DECISIONS
D1 … D15 — accept/amend/reject + the frozen numbers/signatures.

## FROZEN INTERFACES
TypeScript signatures the Hands must implement exactly (types, function names, file paths).
Include the unit of every numeric field and which space it is in (engine x / lateral z / spline s / world).

## TICKETS (in order)
### T<n> — <title>
Goal · depends on · files to create/modify · interfaces frozen · behaviour spec (step by step,
tick-driven where gameplay-relevant) · acceptance criteria (numbered, testable) · required tests
(suite file + test names) · verification command · explicitly out of scope.
Repeat per ticket. Do not exceed ~7 tickets; park the rest in BACKLOG.

## BACKLOG (named, not specified)
## RISKS + MITIGATIONS (naming the specific ones from §5.8, §5.10, §7)
## OPEN QUESTIONS FOR THE HUMAN (from §11 plus anything you need)
## WHAT YOU ARE NOT ASKING FOR YET
```

Keep every requirement mapped: your ticket list must cover R1–R14 explicitly. If you decide to split a requirement across tickets, say so by number.

---

## APPENDIX A — FILE MAP (paths, sizes, relevance)

| Path | LOC | Role | M01 relevance |
|---|---|---|---|
| `src/screens/RaceScreen.tsx` | 550 | Race screen, engine lifetime, HUD, modals, builder mount | **T1–T7 (all)** |
| `src/game/engine.ts` | 789 | Fixed-step loop, input, bumps, particles, snapshot, legacy checkpoint | **T4, T5, T6, T7** |
| `src/game/renderer.ts` | 58 | Delegates to `Renderer3D`, keeps the legacy API + `RangeCamera.view` | T1 |
| `src/game/renderer-3d.ts` | 1796 | WebGL world, camera rig, racer meshes, atmosphere | **T1, T2, T4, T7** |
| `src/game/scene.ts` | 249 | Constants, lane vocabulary, `courseY/slope`, `Obstacle`/`RacerFrame`/`SceneFrame` | **T5, T6, T7** |
| `src/game/sim/racer-physics.ts` | 453 | The step: steering, loops, recovery, obstacles | **T5, T7** |
| `src/game/sim/cpu-driver.ts` | ~140 | AI lane scoring, hop/boost decisions | T7 |
| `src/game/sim/{world,pickups,context,obstacle-state}.ts` | ~400 | Bucket index, surface queries, `SimFx`, recovery policy | T4, T7 |
| `src/game/racers.ts` | 118 | `Racer` state + `createRacers` (grid rows, roster, pace) | T5, T6 |
| `src/game/roster.ts` | 238 | Field sizes, stable IDs, deterministic pace spread | T6 |
| `src/game/track-space.ts` | 1330 | Engine↔world mapping, ramps, frames | T1, T7 |
| `src/game/track-layout.ts` | 224 | Per-course obstacle placement (deterministic) | **T5, T6** |
| `src/game/track-builder-3d.ts` | 3204 | The editor: props, ghosts, snapping, undo, storage, animations | **T7** |
| `src/game/track-storage.ts` | 331 | Versioned prop storage, validation, backup, import/export | T7 |
| `src/components/TrackBuilderUI.tsx` | 2902 | Builder panel (categories, inspector, drawers, backups) | **T7** |
| `src/components/ui/BlizzardGauge.tsx` | ~200 | SVG arc/dial/meter gauges | T3 |
| `src/components/ui/PositionMedallion.tsx` | ~15 | Position disc | T3 |
| `src/components/StagingOverlay.tsx` | 242 | Ready/results overlay (unwired, unstyled) | T6 |
| `src/components/{RaceLoadingScreen,AirSupplies,Modal,SettingsPanel}.tsx` | — | Cover, pickup feedback, dialogs, settings | T3, T5 |
| `src/hud.css` / `src/index.css` / `src/frames.css` | 244 / 557 / 220 | HUD + stage + frame styling | T3 |
| `src/game/contracts/*.ts` | ~2600 total | Frozen pure contracts (T01) | T5, T6 |
| `src/game/qualifying/{gate,attempt,session,field,harness}.ts` | ~1900 | Tested qualifying stack | **T6** |
| `src/game/release/{grid,scheduler,go-clock}.ts` | ~840 | Tested grid/release/clock | **T6** |
| `src/game/staging/{lifecycle,presentation}.ts` | ~450 | Tested phase machine + presentation model | T6 |
| `src/game/collision/*.ts`, `cube-sphere*.ts`, `dent-state.ts`, `rolling-*.ts`, `gameplay-props.ts`, `physics/wall-ccd.ts`, `pickups/claims.ts` | ~3000 | Tested but unwired (T07–T12 work) | T2, T4, T7 (candidates) |
| `docs/{QUALIFYING,RELEASE,STAGING,TRACK_SPACE,TRACK_STORAGE,CONTRACTS,COLLISION}.md` | — | Contracts of the above | read before T6/T7 |
| `handoff.md` (590 lines) + `docs/EXPANSION_PROGRESS.md` (670) | — | Project history, user priorities, asset audit | **read before planning** |

## APPENDIX B — ART INVENTORY THAT ALREADY EXISTS

- `public/art/animated/alpha/anim-01..52-*.png` — 52 four-frame 2×2 sheets (01–42 decorative props, 43–52 effects, caveats in §5.8). Sources in `art-src/animated/*-src.png`; processors `scripts/process-animated.mjs`, `process-generated-animated.mjs`, auditor `scripts/analyze-animated-sheets.mjs`.
- `public/art/goblins/` — 30 cut-out goblin roles (flag-waver, war-drummer, pit-mechanic, ball-loader, …) and `public/art/props/` — 39 track props. Both registered in the builder.
- `public/art/balls/{iron,springsteel,siege}-ball.png` — 512² glossy ball renders, hull-normalised to a 452 px diameter.
- `public/art/riders/fullbody/*.png` — 512×768 full-body goblin renders (`*_full.png`); sources `public/art/sheets/riders-fullbody/*-full-src.png`.
- `public/art/decals/` (11 road decals), `public/art/menus/*.webp` (4 menu backdrops), `public/art/concepts/*.jpg` (5 concept paintings) — the last includes `transition3-mine-to-stadium-concept.jpg`, useful as style anchor.
- `public/ui/{button-gold,button-gold-hover,frame-gold,stone-tile}.png` + `PreGame/assets/ui/*` (predecessor UI kit: `uikit.png`, `uikit_nobackground.png`, `gamegraphics kit 1/2.png`, `USE_button.png`, `buttons*.png`) — 9-slice border assets already used by the ornate frame system.
- **Nothing exists** for: cockpit window/bezel, yoke, arms, HUD backplate/bezels, gauge faces, starter goblin, or a first-person-specific ball/cap texture.

## APPENDIX C — CAPABILITY BUDGET OF THE HANDS

- Full file read/write, bash, git, `gh`, and long-running dev servers; can install deps (`npm ci` verified).
- Can generate images (the project convention caps this at ~10 per turn and requires a user-side reset to continue — budget accordingly and say so in each ticket that needs art).
- Can run `npm run check`, `npm run build`, `npm run check:ui`, and start the Vite preview for the human.
- **Cannot** render or screenshot WebGL in this sandbox (§2). Never ask for a screenshot-based acceptance criterion.
- Writes tests in the repo's existing style (`node:test` + `assert/strict`, one suite per concern, registered in `scripts/check.mjs`), and documents contracts in `docs/` when a ticket freezes a new one.
