import type { Decision } from './types';

export const DECISIONS: Decision[] = [
  {
    id: 'D1',
    title: 'Where the first-person camera lives',
    verdict: 'accept',
    choice: '(b) Separate pure module `src/game/first-person.ts`. Renderer3D only copies the numbers it returns.',
    reason:
      'This is the only option that makes the camera testable without a GL context (§2). It takes `placementFromEngine` output plus the gyro frame from D4, so camera, physics and meshes share one mapping (law 7).',
    frozen: [
      'FP_EYE_HEIGHT = 24 world units above ball centre along the gyro up',
      'FP_EYE_FORWARD = 6 world units along the gyro forward',
      'FP_LOOK_AHEAD = 520 spline units (s)',
      'FP_FOV = 74°, FP_NEAR = 4, FP_FAR = 60000 (fog hides the rest)',
      'FP_UP_SMOOTH_RATE = 8 /s (visual only, render dt)',
      'Degeneracy guard: |forward·up| > 0.985 → re-orthonormalise against previous up; output is never NaN',
      'The player’s own core and caps are hidden in first_person',
    ],
    reqs: ['R1'],
  },
  {
    id: 'D2',
    title: 'Camera mode plumbing',
    verdict: 'amend',
    choice: "Extend `CameraMode` with `'first_person'` and make it the default. Existing third-person modes stay selectable.",
    reason:
      "The user asked to convert the game, so the new default is first_person. Keeping the other modes costs nothing and protects records and older UI. A preferences migration flag applies the new default once without overriding a later explicit choice. Unknown stored values fall back to the default.",
    frozen: [
      "CameraMode = 'first_person' | 'third_person' | 'follow_ball' | 'fixed'",
      "DEFAULT_OPTIONS.cameraMode = 'first_person'",
      'Preferences key gains `cockpitDefaultApplied: true` (one-time migration)',
      'Unknown cameraMode → DEFAULT (typed refusal logged, not thrown)',
    ],
    reqs: ['R1'],
  },
  {
    id: 'D3',
    title: 'How the tank window is drawn',
    verdict: 'accept',
    choice:
      '(a) DOM overlay: a PNG bezel with a CSS mask aperture. Its geometry comes from the pure function `cockpitLayout(w, h)`, and the GL camera gets `setViewOffset` so the horizon is centred in the aperture rather than the screen.',
    reason:
      'This can be checked headlessly, cannot desync the GL pipeline, and keeps the HUD, yoke and arms in one DOM stacking context. Viewport bob comes from a pure function (`cockpitBob`) of speed and grounded state. It is visual only and disabled under reduced motion.',
    frozen: [
      'Aperture = rounded rect: x 7%..93% of width, y 6%..62% of height, corner radius 9% of height',
      'Horizon target = aperture centre (y = 34% of height) via camera.setViewOffset',
      'Bob amplitude ≤ 6 px, 0 when reducedMotion',
    ],
    reqs: ['R1', 'R2'],
  },
  {
    id: 'D4',
    title: 'Gyro ball: rolling middle sphere with level side caps',
    verdict: 'amend',
    choice:
      '(b) then (a): the sim owns `racer.rollPhase` (radians) and `racer.rollRate` (rad/s). The pure `gyroPose(rollPhase, frame)` returns a core quaternion (rolls about the lateral axis) and a gyro quaternion (no roll). The caps and the goblin frame use the gyro quaternion, so they stay level.',
    reason:
      "Law 6 says the sim owns state and the renderer only reads it. A 120 Hz rollPhase can be interpolated like x/y and replayed deterministically. Today's renderer-side `rotation.x += …` is frame-rate dependent. We use the caps' zero-roll pose directly instead of counter-rotating them: it is numerically identical to 'opposite sign, same magnitude' and cannot drift.",
    frozen: [
      'rollPhase += speedGround·dt / RADIUS (mod TAU), speedGround = hypot(vx, vz) when grounded or in loopRide',
      'Airborne/falling: rollRate conserved, decays ×exp(−0.6·dt); rollPhase += rollRate·dt',
      'Loop: gyro up = normalize(loopCentre − ballCentre) (the goblin rides the loop head-in)',
      'Fall: gyro frame freezes at the last grounded frame',
      'Caps: shared SphereGeometry(RADIUS·1.04, 20, 6, 0, TAU, 0, CAP_THETA = 0.62 rad), poles on ±right',
      'Caps are plain brass: MeshStandardMaterial metalness 0.85, roughness 0.35, tinted with the racer colour (no new art)',
      'The physics-parity fingerprint stays bit-identical; rollPhase is additive and excluded',
    ],
    reqs: ['R5'],
  },
  {
    id: 'D5',
    title: 'Push start',
    verdict: 'amend',
    choice:
      "(b) with (a)'s math, fixed and fair. Pressing `start` in 'ready' enters 'pushing' for 48 ticks. The pure `startPushVelocity()` sets each racer's target vx, reached by a linear per-tick ramp. The starter goblin is presentation only.",
    reason:
      'The start pad is flat (§5.10), so the push must be a real impulse. A deterministic ±2% seeded spread gives the field some texture without rewarding reflexes. Skill-based timing waits on Q6.',
    frozen: [
      'PUSH_TICKS = 48 (0.4 s @ 120 Hz)',
      'PUSH_BASE_VX = 360 x-units/s',
      'PUSH_SPREAD = 0.04 → spread_i = (hash01(seed, racerId) − 0.5)·0.04',
      'target_i = PUSH_BASE_VX · racer.pace · (1 + spread_i); vx(k) = target_i · k / 48, k = 1..48',
      "During 'pushing': z locked, vy = 0, grounded forced, no steering input",
      'launchOrigin = position at push tick 0; distance = (x − START_X)/2 unchanged',
    ],
    reqs: ['R7'],
  },
  {
    id: 'D6',
    title: 'What replaces the slingshot',
    verdict: 'accept',
    choice:
      "Keep `launch()` and drag-aim behind `startMode: 'push' | 'sling'` (default 'push'). Input stops reaching them in push mode. CONTRACTS_VERSION goes 1 → 2.",
    reason:
      "This allows A/B comparison and keeps `commands.ts` coherent. Adding the `start` and `ready` commands, and refusing `aim`/`launch` with `sling_disabled`, changes a frozen shape, so the version bump is required.",
    frozen: [
      "CommandKind += 'start' | 'ready'",
      "'aim' | 'launch' in push mode → { ok: false, reason: 'sling_disabled' }",
      'CONTRACTS_VERSION = 2; contracts.test.ts, commands tests and docs/CONTRACTS.md updated in the same ticket',
    ],
    reqs: ['R7'],
  },
  {
    id: 'D7',
    title: 'R9/R10 architecture',
    verdict: 'amend',
    choice:
      '(a) Reuse `qualifying/gate.ts` for gate detection, `staging/lifecycle.ts` for the tick countdown and `release/scheduler.ts` for occupancy-checked releases. Add one new pure state machine, `src/game/merge/pool.ts`, for the in-race phase order. Delete the legacy checkpoint.',
    reason:
      "The gate formula already yields the first-loop entry (x = 1184.44 on ridge) with no authoring. The in-race order (ride → gate → hold → ready → countdown → ordered release) differs from qualifying-first, so a thin adapter reuses the tested pieces rather than bending session.ts. The legacy `setInterval`/`setTimeout`/teleport code breaks laws 2 and 3 and must go.",
    frozen: [
      'Remove triggerCheckpoint, readyUp, releaseFromCheckpoint, checkpointX, frozenVelocities, countdownInterval',
      "Status reuse: 'checkpoint' = pool phase, 'countdown' = merge countdown (no GameStatus rename churn)",
      "GameStatus += 'pushing'",
    ],
    reqs: ['R9', 'R10'],
  },
  {
    id: 'D8',
    title: 'Pool + ready-up semantics',
    verdict: 'amend',
    choice:
      'The player readies with the `ready` command (Space, Enter or the READY button). Bots ready at a fixed delay after their entry tick that grows with entry rank. The pool closes when everyone is held or a timeout passes. The countdown starts when the pool is closed and every held rider is ready. The player auto-readies after 15 s and keeps their entry slot.',
    reason:
      'Auto-ready keeps an idle player from stalling the race, and dropping them to last place would feel punitive. Late arrivals are appended and flagged, never dropped, so the law "flagged, not repaired" holds. All timers count ticks.',
    frozen: [
      'BOT_READY_TICKS(rank) = 90 + 30·rank',
      'POOL_MAX_WAIT_TICKS = 1200 (10 s after the first entry)',
      'PLAYER_AUTO_READY_TICKS = 1800 (15 s after the player’s entry) → flag autoReady',
      'COUNTDOWN_TICKS = 360 (3/2/1/GO from staging/lifecycle)',
      'Held riders: vx = vy = vz = 0, x fixed at the crossing x, intangible, glide laterally to slot z = laneZ(rank mod 4)',
      'Race clock: raceTime excludes the merge hold window (held + countdown ticks)',
      "Pause freezes the pool's tick counter",
    ],
    reqs: ['R9'],
  },
  {
    id: 'D9',
    title: 'Collision-free exit window',
    verdict: 'amend',
    choice:
      '(iii) plus (i), with one addition: every rider leaves at the same speed (MERGE_RELEASE_VX). With a common speed through a common loop, release order is exit order, and that can be proven with a pure test. Released riders are ghosts until 0.75 s after their loop exit.',
    reason:
      "If each rider got their saved velocity back, a faster later rider could overtake inside the loop and exit order would no longer follow entry time. Entry order is already the reward. The occupancy check stays as a safety net and delays are flagged.",
    frozen: [
      'MERGE_RELEASE_VX = 700 x-units/s (≥ the loop minimum of 650), vy = vz = 0',
      'RELEASE_GAP_TICKS = 42 (0.35 s) → exit spacing ≈ 265 x-units ≫ 66 (the diameter)',
      "Occupancy: release k waits until release k−1 has reached loopRide progress ≥ 0.25 turn or has exited; retry every 6 ticks, at most 8 retries, then release with the flag 'forced'",
      'mergeGhost = true until runTime ≥ loopExitTime + MERGE_GHOST_TAIL_S (0.75 s); resolveBumps skips ghosts',
      'Order key: ascending entryTime (sub-tick), ties broken by ascending racerId',
    ],
    reqs: ['R10', 'R11'],
  },
  {
    id: 'D10',
    title: 'Effect runtime',
    verdict: 'amend',
    choice:
      '(a) + (d): the sim emits typed EffectEvents into a 128-entry ring buffer. The renderer keeps its own read cursor (it never writes back), feeds a pool of 64 billboards, and draws the existing engine spark particles (cap 160) as one `THREE.Points` object.',
    reason:
      'Of the 10 sheets, 7 are flagged (§5.8). We use the clean sheets (anim-43 explosion, anim-46 red gore) and build dust and smoke from one procedural soft-puff texture baked once at preload. Sparks reuse the engine particles that already exist but are never drawn. One regeneration (anim-44 sparks) is budgeted in the art list.',
    frozen: [
      "EffectKind = 'explosion' | 'impact' | 'dust' | 'smoke' | 'sparks'",
      'EFFECT_QUEUE = 128 (ring buffer, oldest overwritten, overflow counter exposed)',
      'BILLBOARD_POOL = 64, SPARK_POINTS = 160 (existing engine particle cap)',
      'Spawn cull: world distance to camera > 6000 → skip (counted)',
      'Reduced motion: sheets hold frame 1 at 0.5 opacity for half their lifetime; puffs are static; sparks are skipped',
      'Unknown kind → ContractError("unknown_effect_kind")',
    ],
    reqs: ['R6'],
  },
  {
    id: 'D11',
    title: 'Lane-path data model',
    verdict: 'amend',
    choice:
      "Nodes plus paths, authored in engine space (x, lateral z), with altitude taken from the surface. A path is an ordered list of node IDs with strictly increasing x. Paths connect through shared nodes. Node kind is authored and then validated against the topology. OOB nodes are terminal.",
    reason:
      "Physics steers in z. Authoring in world space would desync whenever the track-space reparameterisation changes, and engine space is what `placementFromEngine` consumes. Strictly increasing x keeps sampling to a single lookup. Terminal OOB nodes make 'reached' unambiguous: the racer's x passes the node while it is on that path.",
    frozen: [
      "Node.kind 'merge': end node of ≥ 2 paths and start node of exactly 1",
      "Node.kind 'split': end node of exactly 1 path and start node of ≥ 2",
      "Node.kind 'oob': end node of ≥ 1 path, start node of none",
      "Node.kind 'normal': start/end of at most 1 path each",
      'Default path halfWidth = 120 z-units (LANE_WIDTH/2); z ∈ [−443, 443]',
      "OOB reached → recoverRacer(racer, 'oob') using the course RecoveryPolicy (no DNF by default, see Q3)",
      "Target course first: 'ridge'",
    ],
    reqs: ['R12', 'R13'],
  },
  {
    id: 'D12',
    title: 'Lane-path runtime integration',
    verdict: 'accept',
    choice:
      'Layer it on top of the existing model. The single pure function `resolveLaneTarget(racer, network | null)` returns `{ targetZ, zMin, zMax }`. With a null network it returns exactly `laneZ(targetLane)` and the legacy clamp.',
    reason:
      'This keeps all 451 tests and every tuned handling value intact. The PD spring shape and the steerLockedUntil response cut are unchanged; only their inputs are generalised. physics-parity must stay bit-identical when no network exists.',
    frozen: [
      'Steering, shove, CPU aim and recovery lane choice all read resolveLaneTarget',
      "Racer gains `pathId: string | null` (null means legacy lanes)",
    ],
    reqs: ['R12'],
  },
  {
    id: 'D13',
    title: 'Authoring storage & backup',
    verdict: 'accept',
    choice:
      'A new document, `hm2-lane-paths-v1` plus `-backup`, with LANE_STORAGE_VERSION = 1 and one network per course. It follows the same validation, atomicity and unknown-field rules as track-storage.ts. A dev route `POST /api/backup-lane-paths` mirrors saves to `backups/lane-paths/`.',
    reason: 'This keeps law 8. Nodes are never coerced into PlacedProp.',
    frozen: [
      'Document = { version: 1, savedAt: ISO string, networks: Partial<Record<CourseId, LaneNetwork>> }',
      'Save refused while validateLaneNetwork returns errors (the last valid document is kept)',
      'The dev route refuses to overwrite with a set that is ≥ 25% smaller (same guard as the props route)',
    ],
    reqs: ['R13', 'R14'],
  },
  {
    id: 'D14',
    title: 'Art generation budget',
    verdict: 'amend',
    choice:
      'Nine new images plus one regeneration (anim-44 sparks), 10 in total, the full per-turn budget. One arm image is mirrored in CSS for the other side. Gauge needles are SVG, so live values never depend on the art.',
    reason:
      'Mirroring saves an image. Needles drawn in SVG keep the gauges working (R2) even if the art is replaced later. Art direction needs human approval before generation (Q8).',
    frozen: [
      '1 cockpit-bezel.png 2560×1440, transparent aperture matching D3',
      '2 yoke.png 1024×768, hub pivot at (512, 420), grips at (150, 400) / (874, 400)',
      '3 goblin-arm.png 640×1280, grip at top (320, 60), shoulder leaves the bottom edge; mirrored for the left side',
      '4 gauge-cluster-left.png 1024×512, 5 gauge-cluster-right.png 1024×512',
      '6 gauge-face-speed.png 512², 0–360 km/h over a 240° sweep; 7 gauge-face-small.png 256²',
      '8 starter-goblin-push.png 1024² 2×2 sheet, 4 frames @ 12 fps',
      '9 cockpit-rivet-strip.png 2048×128 (lower dash lip)',
      '10 regenerate anim-44-spark-burst.png (2×2, 420×420 nominal)',
      'Style anchors: warm brass, weathered iron, olive goblins, teal shadows, transition3-mine-to-stadium-concept.jpg',
    ],
    reqs: ['R2', 'R3', 'R4', 'R6', 'R7'],
  },
  {
    id: 'D15',
    title: 'Verification standard',
    verdict: 'amend',
    choice:
      "Accepted, with three additions. Every new suite is registered in scripts/check.mjs. The JS bundle grows by at most 40 kB gzip per ticket. Each ticket report has an 'UNVERIFIED' section.",
    reason:
      "WebGL can't be proven in the sandbox (§2), so every visual claim is either expressed as pure numbers or explicitly handed to the human with a preview URL.",
    frozen: [
      'npm run check green (451 + new tests, 0 fail)',
      'npm run build green; gzip delta ≤ 40 kB per ticket',
      'Headless DOM check where DOM-visible (pattern: tests/ui-frame-check.mjs)',
      'Preview URL via vite.preview.config.ts for anything WebGL',
    ],
    reqs: ['all'],
  },
];
