export type CritCategory = 'bug' | 'inconsistency' | 'design' | 'process' | 'verification';
export type CritSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Critique {
  id: string;
  category: CritCategory;
  severity: CritSeverity;
  title: string;
  finding: string;
  evidence: string;
  fix: string;
  resolvedBy: string[]; // UQ ids / ticket ids
}

export interface UnaskedQuestion {
  id: string;
  question: string;
  why: string;
  answer: string;
  frozen: string[];
  tickets: string[];
  proof?: string; // anchor of an interactive proof
  humanConfirm?: boolean;
}

export const CRITIQUES: Critique[] = [
  {
    id: 'C1', category: 'bug', severity: 'critical',
    title: 'The merge gate refuses three of four lanes',
    finding: 'T2 reuses gate.ts as-is. That gate is centred on obstacleZ(loop) with halfWidth = LANE_WIDTH/2 = 120, and its validation includes lane containment. On ridge the first loop is lane 2 only (laneSpan 1), so riders in lanes 0, 1 and 3 get a typed refusal, never enter the pool and are never sorted. R9 says all riders join a pool.',
    evidence: '§5.7(b) gate.ts: "halfWidth = LANE_WIDTH/2 = 120 … lane → altitude → segment"; §5.10 first loop {lane:2, laneSpan:1}',
    fix: 'New firstLoopMergeGate(course, layout) that reuses gate.ts crossing/sub-tick/altitude/segment logic but uses the full corridor (|z| ≤ 443) for containment.',
    resolvedBy: ['UQ1', 'T2'],
  },
  {
    id: 'C2', category: 'bug', severity: 'critical',
    title: 'Released riders cannot reach the single-lane loop',
    finding: 'Held riders glide to slotZ = laneZ(rank % 4) and are released 31 x-units before the loop mouth (1184.44 → 1215.44). At 700 x-u/s that leaves 0.044 s to move up to 480 lateral units. If the obstacle scan filters loops by lane (loopGeometry has halfWidth 58, which suggests it does), 3 of 4 riders bypass the loop. That breaks R10 and makes the "exit order = entry order" proof meaningless.',
    evidence: '§5.2 loop engagement; §5.10 loopGeometry halfWidth 58; plan-v1 D8 "glide laterally to slot z = laneZ(rank mod 4)"',
    fix: 'Slots = nearest free lane to arrival z (glides never cross). Add an ALIGN step: the next rider glides to the loop lane (|Δz| ≤ 6, |vz| ≤ 30, max 150 ticks) before release. New AC: every released rider engages loopRide on the first loop. RQ-7 confirms whether the scan is lane-filtered; the fix is harmless either way.',
    resolvedBy: ['UQ1', 'T2'],
  },
  {
    id: 'C3', category: 'verification', severity: 'high',
    title: 'The planner’s own demo hid C1 and C2',
    finding: 'The v1 merge demo treated the loop as full-width and ignored the gate lane test, so it showed a green "exit = entry" check for a design that fails. Reference demos written without the repository can prove the spec is self-consistent, but not that the repository behaves the same way.',
    evidence: 'src/sim/merge.ts v1: loop entry had no z test; enter() had no containment',
    fix: 'The demo now models lane-filtered loops and the gate lane test, with a v1/v2 toggle that reproduces the failure. Every demo is labelled "reference, not repo". The Hands port the tests against real modules, never the demo code.',
    resolvedBy: ['UQ1'],
  },
  {
    id: 'C4', category: 'design', severity: 'high',
    title: 'R5 is invisible to the only person who plays it',
    finding: 'T3 hides the player’s own ball in first person. The user asked specifically that rolling stay visible while the goblin stays level, and in first person the player would never see either. The plan also never says how a goblin sees out of an opaque rolling sphere.',
    evidence: 'plan-v1 D1 frozen: "The player’s own core and caps are hidden in first_person"',
    fix: 'The middle sphere is a lattice cage. In first person its bars sweep past the window, driven by rollPhase, with anti-strobe blending above 50% of Nyquist. The brass cap rims show at the left and right window edges.',
    resolvedBy: ['UQ3', 'T3'],
  },
  {
    id: 'C5', category: 'design', severity: 'high',
    title: 'Nothing for the player to do between the push and the gate',
    finding: 'The push is fixed and fair, z is locked, and T1 removes every obstacle before the gate. Entry rank, which R10 turns into release order, is then decided by grid row and pace. The sorting mechanic sorts something the player never influenced.',
    evidence: 'T1 behaviour: "obstacles with 190 ≤ x < 1184.44 are removed"; D5 fixed push',
    fix: 'The run-up becomes a skill segment. Steering, bumps and a boost charge are allowed from push end. Boost pads stay only in outer lanes 0 and 3 (filtered, so RNG is untouched). Spending a charge early buys entry rank at a cost later in the race.',
    resolvedBy: ['UQ2', 'T1'],
  },
  {
    id: 'C6', category: 'process', severity: 'high',
    title: 'The riskiest perception question is answered third',
    finding: 'The world was dressed for a chase camera 430 up and 950 back. First person puts the eye about 55 above the road: billboards seen edge-on, decals z-fighting, and terrain edges exposed at the horizon. v1 learns this only in T3, after two heavy physics tickets.',
    evidence: '§5.4 cameraRigAt {back 950, height 430}; PlacedProp planes / cameraFacing flag; K7',
    fix: 'New T0: a first-person spike behind ?fp=1 using the frozen firstPersonFrame, plus a headless eye-level audit script and a preview URL. It gates the T3 numbers (FOV, near plane, eye height).',
    resolvedBy: ['UQ4', 'T0'],
  },
  {
    id: 'C7', category: 'design', severity: 'medium',
    title: 'The merge silently equalises everyone to 700',
    finding: 'Every rider leaves at 700, so loadout pace (a player choice) is erased at the first loop, and nobody was told.',
    evidence: 'plan-v1 D9 MERGE_RELEASE_VX = 700 for all',
    fix: 'Release at 700·clamp(pace, 0.94, 1.06). The lower bound keeps 658 ≥ 650, the loop minimum, so ride speed equals release speed. A closing-distance inequality proves exit order still holds: worst closing 96 < budget 144 x-units.',
    resolvedBy: ['UQ7', 'T2'],
  },
  {
    id: 'C8', category: 'inconsistency', severity: 'medium',
    title: 'Two clocks, undefined for late riders',
    finding: 'D8 says raceTime excludes the hold window for the whole field, while riders still on the run-up keep moving, which gives them free seconds. It also conflicts with the GoClock semantics of one absolute clock from GO, and it never defines a late rider’s time.',
    evidence: 'plan-v1 D8 "raceTime excludes the merge hold window"; §5.7 go-clock.ts',
    fix: 'Split timing: runUpSeconds (push tick 0 → entryTime, per rider) and raceSeconds (GoClock from GO → finish). Leaderboards rank by raceSeconds. Late riders run on the same GoClock with the late flag. Nothing gets excluded.',
    resolvedBy: ['UQ8', 'T2'],
  },
  {
    id: 'C9', category: 'design', severity: 'medium',
    title: 'Migration of records, cups and hand-placed props is parked in the backlog',
    finding: 'T1 changes start-section terrain and times on day one, but record namespacing is B11 (backlog). Law 9 (cup guards) and law 8 (persistence) are touched immediately. Builder props sitting on the changed terrain would float or sink.',
    evidence: 'Backlog B11; §8 laws 8–9; PlacedProp world x/y/z',
    fix: 'Moved into T1: RECORDS version bump with a "legacy-sling" tag, cup sessions persist startMode, and a prop re-seat report (never an automatic move).',
    resolvedBy: ['UQ9', 'T1'],
  },
  {
    id: 'C10', category: 'design', severity: 'medium',
    title: 'Selectable field sizes and solo mode regress',
    finding: 'The setup screen already offers 20/50/100 (ui-frame-check tests field-size selection). T2 refuses merges above 4, so those modes quietly lose the feature. Deleting triggerCheckpoint also deletes the legacy solo behaviour ("rebuilds the field behind the player") with no replacement.',
    evidence: '§2 ui-frame-check; §5.7(a) "solo mode rebuilds the field behind the player"',
    fix: 'Push mode disables 20/50/100 in setup with a visible reason. The engine refuses them with a typed error. Solo: the field spawns pre-held in the pool behind the player’s entry (a spawn, not a teleport). RQ-8.',
    resolvedBy: ['UQ10', 'T2'],
  },
  {
    id: 'C11', category: 'inconsistency', severity: 'medium',
    title: 'The effect plan both uses and bans gore',
    finding: 'D10 calls anim-46 (red gore) one of the clean sheets in use, while T5 lists gore as out of scope for tone.',
    evidence: 'plan-v1 D10 reason vs T5 outOfScope',
    fix: 'anim-46 and anim-47 are unused unless the human opts in (Q12). Impacts use the regenerated anim-44, falling back to anim-43 at 160u.',
    resolvedBy: ['T5'],
  },
  {
    id: 'C12', category: 'design', severity: 'medium',
    title: 'A rigid rotated PNG will not read as an arm',
    finding: 'armPose rotates one straight image about the shoulder, so the arm looks like a stick. Real arms fold at the elbow as the yoke turns.',
    evidence: 'plan-v1 IF-COCKPIT armPose → {x, y, rotDeg, length}',
    fix: 'Two-bone IK (upper arm + forearm), elbow by the law of cosines, bent outward. The art list splits the arm into 2 images and drops the rivet strip, which can be CSS, so the budget stays at 10.',
    resolvedBy: ['UQ13', 'T4'],
  },
  {
    id: 'C13', category: 'design', severity: 'medium',
    title: 'Authored lanes ignore lane-bound obstacles and loops',
    finding: 'Obstacles use lane/laneSpan/occupiesLane and loops force obstacle.lane. A path that misses lane 2 at a loop bypasses it, and paths straddling lane boundaries give half-hits. validateLaneNetwork checks topology only.',
    evidence: '§5.9 scene.ts occupiesLane; §5.2 loop forces targetLane',
    fix: 'validateAgainstCourse(net, layout) adds refusals loop_uncovered and gate_uncovered, plus a warning obstacle_straddle. After loop exit a rider takes the nearest path at the exit z.',
    resolvedBy: ['UQ15', 'T6'],
  },
  {
    id: 'C14', category: 'verification', severity: 'medium',
    title: 'Test budgets are unbounded',
    finding: '"100 seeds × 3 courses" full races at 120 Hz inside npm run check has no time budget, which risks a check that nobody runs.',
    evidence: 'T2 AC-2; T6 AC-1 (50 seeds × 3 courses)',
    fix: 'Merge suites stop 240 ticks after the last loop exit. Per-suite budget ≤ 20 s. The full-length parity sweeps move to a non-check `npm run soak:m01`.',
    resolvedBy: ['T2', 'T6'],
  },
  {
    id: 'C15', category: 'design', severity: 'medium',
    title: 'Your own crashes happen inside the camera',
    finding: 'A 480u explosion billboard centred on the player’s ball puts the camera inside the sprite. The engine’s shake is ignored, and "screen shake in FP" is out of scope, so R11 contact racing has no felt feedback.',
    evidence: 'T5 specs; §3 frame.shake ignored',
    fix: 'Player-owned effects in first person go to the cockpit: bezel sparks, a glass-dust overlay and a bounded jolt (≤10 px, decay 12/s, 0 under reduced motion). World billboards within 150u of the camera are suppressed, and other balls near-fade under 90u.',
    resolvedBy: ['UQ11', 'T4', 'T5'],
  },
  {
    id: 'C16', category: 'bug', severity: 'low',
    title: 'Caps at 1.04·R stick out past the collision sphere',
    finding: 'Two balls touching at 2R + 4 would show their caps interpenetrating on every side-by-side bump.',
    evidence: 'plan-v1 D4 CAP_RADIUS_SCALE = 1.04',
    fix: 'CAP_RADIUS_SCALE = 1.0 with a 1.5-unit inset. The rim bevel is in the normal map, not the geometry.',
    resolvedBy: ['T3'],
  },
];

export const UNASKED: UnaskedQuestion[] = [
  {
    id: 'UQ1', question: 'Can a rider in lanes 0, 1 or 3 even enter the pool and the first loop?',
    why: 'If not, R9 and R10 fail for 75% of the field, and v1’s ordering proof tests a design that cannot happen.',
    answer: 'Not under v1. v2 adds a full-width merge gate, nearest-free-lane slots, and an ALIGN step that brings each rider to the loop lane before release.',
    frozen: [
      'firstLoopMergeGate(course, layout): gate.ts crossing/altitude/segment + corridor containment |z| ≤ 443',
      'slot = nearestFreeLane(arrivalZ, heldLanes)',
      'ALIGN: target z = gate.z; aligned when |Δz| ≤ 6 and |vz| ≤ 30; held spring response 33, damping 9.5; ALIGN_MAX_TICKS = 150 → flag alignForced',
      'Alignment of rider k+1 starts at rider k’s release; release still needs gap ≥ 42 ticks and previous loop progress ≥ 0.25',
      'AC: 100% of released riders engage loopRide on the first loop',
      'Corridor gate is centred on z = 0 (not the loop lane): |z| ≤ 443 covers lanes 0–3 (the planner’s first v2 draft centred it on z = −120 and still refused lane 0)',
      'Known residual: an aligning rider may pass laterally through a held rider in the loop lane at the same x. Both are intangible and near-fade (UQ11) hides it in FP. B15’s slot grid removes it',
    ],
    tickets: ['T2'], proof: 'proof-merge',
  },
  {
    id: 'UQ2', question: 'What can the player actually do between the push and the gate?',
    why: 'Entry rank becomes release order. If the player can’t influence it, the sorting mechanic is theatre.',
    answer: 'Steering, bumps and boost are all live from push end. Boost pads stay in outer lanes 0 and 3 only, which rewards a committed line. Spending a boost charge buys rank now at the cost of a charge later.',
    frozen: [
      'Pushing ticks: z locked, no bumps. From push end: steering, bumps and boost enabled',
      'Layout filter keeps boost@770 in lanes 0 and 3; ramps, sign, blimp and sheep before the gate stay removed',
      'AC: in a scripted run the outer-lane line with boost reaches the gate ≥ 6 ticks before the same loadout in lane 2',
    ],
    tickets: ['T1'],
  },
  {
    id: 'UQ3', question: 'How does a goblin see out of a rolling opaque ball, and will the player ever see R5?',
    why: 'Hiding your own ball makes the headline gyro feature invisible from the default camera.',
    answer: 'The core is a lattice cage. Its bars sweep across the window from rollPhase and blend into a motion band before they can strobe. Cap rims frame the window edges and never roll.',
    frozen: [
      'CAGE_BARS = 10; barAlpha = clamp((1 − r)/0.5, 0, 1), r = |rollRate|·frameDt / (π/10)',
      'At 60 fps bars start fading around 47 km/h and are fully blended by about 94 km/h. The push and pool phases show crisp bars',
      'Reduced motion: static bars at 0.35 alpha',
      'Third person: core texture gains an alpha lattice (prepared at preload, law 4)',
    ],
    tickets: ['T3'], proof: 'proof-cage',
  },
  {
    id: 'UQ4', question: 'Was the world built to be seen from 55 units above the road?',
    why: 'Edge-on billboards, exposed terrain edges and decal z-fighting could sink first person whatever the code quality.',
    answer: 'We don’t know yet, so find out first. T0 ships a flagged first-person spike, a headless audit and a human go/no-go on a preview URL.',
    frozen: [
      'eyeLevelAudit(track, props, fpParams) → { thinBillboards[], terrainEdgeExposures[], decalsNearEye[] } (pure, no GL)',
      'Thin billboard: non-cameraFacing plane with |normal·viewDir| < 0.2 within 3000u of the eye path',
      'Edge exposure: terrain half-extent < far·tan(hfov/2) at any sample',
      'Go/no-go by the human; FP_FOV, FP_NEAR and FP_EYE_HEIGHT may move ±20% in T3 only via this report',
    ],
    tickets: ['T0'],
  },
  {
    id: 'UQ5', question: '“Level like a gyro”: level relative to the track or to gravity?',
    why: 'World-level on a 30% grade points the window at the hillside, and track-level in a loop turns you upside down. The user’s phrase allows either.',
    answer: 'Pitch follows the track (readable view). Bank blends 50% toward world-up. In loops the default is track-follow, and a comfort mode keeps the horizon world-level instead.',
    frozen: [
      "fpComfort: 'full' | 'horizon' (preference; reduced motion defaults to 'horizon')",
      'GYRO_BANK_WORLD_BLEND = 0.5',
      "'horizon' in loops: camera up = world up, forward follows the track tangent",
    ],
    tickets: ['T3'], humanConfirm: true,
  },
  {
    id: 'UQ6', question: 'Is steering discrete lane-hopping or analog?',
    why: 'An airplane yoke implies analog control, but the physics has discrete lanes. The yoke would twitch between snaps, and gamepads have nothing to bind.',
    answer: 'With a lane network present, a steer axis offsets the target within the current path, and holding the edge for 150 ms hops to the adjacent path. With no network, taps behave exactly as today (parity).',
    frozen: [
      'steerAxis ∈ [−1, 1] (keys held → ±1, gamepad analog)',
      'targetZ = pathZ − axis·(halfWidth − 37); EDGE_HOP_MS = 150',
      'null network ⇒ legacy changeLane taps, bit-identical',
    ],
    tickets: ['T6'],
  },
  {
    id: 'UQ7', question: 'Does the merge erase earned speed?',
    why: 'Loadout pace is a player choice, and flattening it at the first loop is a silent balance change.',
    answer: 'Keep pace within a proven-safe band: release at 700·clamp(pace, 0.94, 1.06).',
    frozen: [
      'releaseVx(pace) = 700·clamp(pace, 0.94, 1.06)',
      'Proof: (vMax − vMin)·rideDist/vMin < gap·vMin/120 − 66 − 20 ⇒ 96 < 144 ✓',
      'AC test asserts the inequality from the live constants (it fails if anyone retunes the gap or the band)',
    ],
    tickets: ['T2'], proof: 'proof-bound',
  },
  {
    id: 'UQ8', question: 'What exactly does the race clock measure now?',
    why: 'Pausing the clock only for held riders gives free seconds to riders still on the run-up. Records and leaderboards need one definition.',
    answer: 'Two splits: runUpSeconds (per rider) and raceSeconds (GoClock from GO). Leaderboards rank by raceSeconds, and the run-up split is shown as the qualifying split.',
    frozen: [
      'RaceTiming { runUpSeconds; raceSeconds; holdSeconds } (seconds, tick-derived)',
      'Late riders use the same GoClock; flag late',
      'Records store both; PB = raceSeconds',
    ],
    tickets: ['T2'],
  },
  {
    id: 'UQ9', question: 'What happens to saved records, in-progress cups and the user’s hand-placed props?',
    why: 'T1 changes start terrain and race times immediately, and laws 8–9 forbid silent damage.',
    answer: 'Records are versioned and old ones tagged legacy-sling (still shown, never compared). Cups keep the startMode they began with. Props on changed terrain are listed in a re-seat report, never moved automatically.',
    frozen: [
      "RECORDS_VERSION += 1; legacy entries tagged startMode 'sling'",
      'CupSession.startMode persisted; commitRound refuses a round whose startMode differs',
      'propReseatReport(props, changedSRange) → { id, dy }[]; builder button "Re-seat listed props" (undoable)',
    ],
    tickets: ['T1'],
  },
  {
    id: 'UQ10', question: 'What happens to the 20/50/100 field sizes and to solo mode?',
    why: 'Both are reachable from the setup screen today, and v1 quietly degrades them.',
    answer: 'Push mode disables 20/50/100 with a visible reason (B1 designs the slot grid later). Solo spawns the field pre-held in the pool, queued after the player.',
    frozen: [
      "NewGameSetup: sizes > 4 disabled, text 'Merge supports 4 riders in this build'",
      "normalizeRaceConfig refuses {startMode:'push', fieldSize>4} → 'merge_field_unsupported'",
      'Solo: opponents spawn held at free slots with entryTime = playerEntry + k·(1/120), released after the player',
    ],
    tickets: ['T2'],
  },
  {
    id: 'UQ11', question: 'What do your own collisions and explosions look like from inside?',
    why: 'Otherwise the camera sits inside a 480u sprite and bumps give no feedback: R11 without feel.',
    answer: 'Player-owned effects go to the cockpit layer (bezel sparks, glass dust) plus a bounded jolt. Nearby world sprites are suppressed and nearby balls fade.',
    frozen: [
      'cockpitJolt(prev, impulse = shake·0.66, dt, reduced): ≤ 10 px, decay 12/s',
      'Suppress world billboards < 150u from the camera; ball near-fade < 90u',
    ],
    tickets: ['T4', 'T5'], proof: 'proof-cockpit',
  },
  {
    id: 'UQ12', question: 'How does the player see threats behind or beside them?',
    why: '“A race to survive” means contact from behind, and first person removes the chase view that showed it.',
    answer: 'A brass sonar dial (no second render pass) shows riders within 900 units, with closing threats in red.',
    frozen: ['radarBlips(player, others, 900) → { sx, sy, dist01, closing }[]', 'Screen-reader text: “rider approaching left-rear”, throttled to 1 per 2 s'],
    tickets: ['T4'], proof: 'proof-cockpit',
  },
  {
    id: 'UQ13', question: 'Will a rigid rotated PNG read as an arm?',
    why: 'Stick arms undercut R4 more than any other element.',
    answer: 'Two-bone IK with the elbow bent outward, and upper-arm and forearm art as separate images.',
    frozen: ['twoBoneIK(shoulder, grip, l1 = 0.54·reach, l2 = 0.5·reach, bend = outward)', 'Art: goblin-upper-arm.png 512×1024, goblin-forearm-hand.png 512×1024 (mirrored); rivet strip removed (CSS)'],
    tickets: ['T4'], proof: 'proof-cockpit',
  },
  {
    id: 'UQ14', question: 'Does the cockpit react when you plunge into the dark mine?',
    why: 'A brightly lit PNG cockpit in cave fog breaks the illusion straight away.',
    answer: 'Yes. A CSS brightness and tint layer is driven by the same atmosphere values the renderer uses.',
    frozen: ['cockpitLight(caveBlend, fogRGB) → brightness = 1 − 0.45·c, tintAlpha = 0.08 + 0.27·c', 'The engine exposes caveBlend and fogRGB on the cockpit channel (read-only)'],
    tickets: ['T4'], proof: 'proof-cockpit',
  },
  {
    id: 'UQ15', question: 'Do obstacles and loops respect the authored paths?',
    why: 'A path that misses the loop lane silently removes a loop from the race.',
    answer: 'validateAgainstCourse adds course-aware refusals and warnings.',
    frozen: ["'loop_uncovered' (refusal): no path covers obstacle.lane ± halfWidth at loop.x", "'gate_uncovered' (refusal)", "'obstacle_straddle' (warning)"],
    tickets: ['T6', 'T7'],
  },
  {
    id: 'UQ16', question: 'How does a phone player start, ready up and steer?',
    why: 'Responsive breakpoints at 354/385/430 px exist, so mobile is supported. The slingshot drag was the touch input, and v1 removes it.',
    answer: 'Touch zones: the lower-left and lower-right thirds of the cockpit steer, and one large START / READY button sits in the dash.',
    frozen: ['Touch targets ≥ 44 px', 'Pointer events only (no gesture library)', 'RQ-9 lists existing touch controls to reuse'],
    tickets: ['T4'],
  },
  {
    id: 'UQ17', question: 'What physically stands at the start line now?',
    why: 'The slingshot is world scenery (isSlingshot props, LAUNCHER). Removing it from input leaves a useless slingshot in the view.',
    answer: 'Push mode hides isSlingshot props and the launcher. A start gate arch plus the starter-goblin sprite takes its place.',
    frozen: ["Visibility rule: startMode 'push' ⇒ isSlingshot props hidden (not deleted)", 'Starter goblin anchored at the player’s grid slot −80 x'],
    tickets: ['T1', 'T4'],
  },
  {
    id: 'UQ18', question: 'What happens to a rider who arrives after the pool has finished releasing?',
    why: 'v1 pool.enter returns not_open with no follow-up: undefined behaviour at the heart of R9.',
    answer: 'They pass straight through: no hold, ghost until 0.75 s after their loop exit, flagged late.',
    frozen: ["enter() after 'done' → { ok:false, reason:'not_open' } and the engine applies passThroughGhost(racer)", 'Counted in snapshot.merge.lateCount'],
    tickets: ['T2'],
  },
];

export const T0_TICKET_ID = 'T0';

export const AMENDMENTS: Record<string, string[]> = {
  T1: [
    '+ Run-up is a skill segment (UQ2): boost@770 kept in lanes 0 and 3; bumps, steering and boost live from push end',
    '+ Records version bump, cup startMode, prop re-seat report (UQ9)',
    '+ Hide isSlingshot props and launcher in push mode; start arch (UQ17)',
    '+ RQ-8 and RQ-9 answered before start',
  ],
  T2: [
    '~ Gate = firstLoopMergeGate (full corridor), replacing raw gate.ts (C1)',
    '~ Slots = nearestFreeLane; + ALIGN step before each release (C2)',
    '~ releaseVx = 700·clamp(pace, 0.94, 1.06) with the inequality asserted (UQ7)',
    '~ Timing split runUp/race via GoClock, replacing "exclude hold" (UQ8)',
    '+ Field > 4 refused in push mode with setup UI reason; solo pre-held spawn (UQ10)',
    '+ Late after done → pass-through ghost (UQ18)',
    '+ Budget: suites stop 240 ticks after the last loop exit; ≤ 20 s (C14)',
    '+ AC: 100% of released riders engage loopRide on the first loop; the held branch skips the obstacle scan',
  ],
  T3: [
    '~ Own mesh no longer hidden: lattice cage bars with anti-strobe blending (UQ3)',
    '+ fpComfort preference and bank blend (UQ5)',
    '~ CAP_RADIUS_SCALE 1.0 with a 1.5u inset (C16)',
    '~ FP numbers may move ±20% only through the T0 audit report',
  ],
  T4: [
    '~ Arms: two-bone IK; art split upper/forearm; rivet strip → CSS (UQ13)',
    '+ Radar dial (UQ12), cockpit light (UQ14), jolt (UQ11), touch zones (UQ16)',
  ],
  T5: ['~ No gore sheets unless Q12 opts in (C11)', '+ Player-owned FP effects go to the cockpit layer; near suppression 150u (UQ11)'],
  T6: ['+ validateAgainstCourse: loop_uncovered, gate_uncovered, obstacle_straddle (UQ15)', '+ Analog steer axis with edge hop when a network is present (UQ6)', '~ Parity sweep moves to npm run soak:m01 (C14)'],
  T7: ['+ Course-aware warnings shown inline on the offending segment (UQ15)'],
};

export const DECISION_PATCHES: Record<string, string[]> = {
  D1: ['Own ball NOT hidden: the lattice cage is drawn from inside with anti-strobe blending (C4/UQ3)', 'Other balls near-fade under 90u; world billboards suppressed under 150u (UQ11)'],
  D3: ['Cockpit layer gets cockpitLight() brightness/tint and cockpitJolt() translation (UQ14/UQ11)'],
  D4: ['CAP_RADIUS_SCALE 1.04 → 1.0 with a 1.5u inset (C16)', 'Core texture gains an alpha lattice prepared at preload (UQ3)', 'Bank blends 50% to world-up; fpComfort horizon mode (UQ5)'],
  D5: ['From push end: steering, bumps and boost are live; outer-lane boost pads kept (C5/UQ2)'],
  D7: ['Gate = firstLoopMergeGate (full corridor), not raw gate.ts (C1)'],
  D8: ['Slots = nearestFreeLane(arrival z) (C2)', 'raceTime exclusion replaced by the RaceTiming split (C8/UQ8)', 'Late after done → pass-through ghost (UQ18); solo pre-held spawn (UQ10)'],
  D9: ['+ ALIGN step to the loop lane before each release (C2)', 'MERGE_RELEASE_VX 700 → 700·clamp(pace, 0.94, 1.06) with the proven inequality (C7/UQ7)'],
  D10: ['anim-46/47 gore NOT used unless Q12 opts in (C11)'],
  D14: ['#3 arm → #3 upper arm 512×1024 + #9 forearm/hand 512×1024; rivet strip becomes CSS (C12). Total stays 10'],
  D15: ['Per-suite budget ≤ 20 s; long sweeps move to npm run soak:m01 (C14)', 'Demos are labelled reference, never evidence about the repo (C3)'],
};

export const NEW_RETRIEVAL = [
  { id: 'RQ-7', ask: 'racer-physics.ts obstacle scan: are loops filtered by occupiesLane/obstacleBounds before the engagement test?', why: 'C2 severity (the v2 fix works either way)' },
  { id: 'RQ-8', ask: 'engine.ts:299-330 — the exact solo-mode branch of triggerCheckpoint.', why: 'UQ10 replacement semantics' },
  { id: 'RQ-9', ask: 'RaceScreen/components: existing touch or on-screen steering controls, if any.', why: 'UQ16' },
  { id: 'RQ-10', ask: 'records/cup storage modules: key names, version constants, CupSession shape.', why: 'UQ9 migration' },
  { id: 'RQ-11', ask: 'racers.ts: player grid row and the x offset of each row.', why: 'UQ2 run-up fairness and the starter-goblin anchor' },
];

export const NEW_QUESTIONS = [
  { id: 'Q10', question: 'Gyro level: track-follow with a comfort option (default), or true world-level gimbal?', defaultAnswer: 'Track-follow pitch, 50% world bank, comfort mode available.' },
  { id: 'Q11', question: 'Should the pool be a pit moment (choose one of two pickups while held), or just a breath and standings reveal?', defaultAnswer: 'Breath + standings in v2; the pit choice is backlog B13.' },
  { id: 'Q12', question: 'Gore sheets (anim-46/47) on heavy impacts: yes or no?', defaultAnswer: 'No.' },
  { id: 'Q13', question: 'Is it acceptable that pace differences are capped at ±6% through the merge?', defaultAnswer: 'Yes (the proven-safe band).' },
];

export const NEW_BACKLOG = [
  'B13 Pit-choice pool (pick one of two pickups while held, via qualifying/mystery.ts)',
  'B14 Rolling-rumble synth cue scaled by rollRate (cockpit audio)',
  'B15 Slot grid with braking-to-slot for fields > 4 (continuous deceleration, no teleport)',
];
