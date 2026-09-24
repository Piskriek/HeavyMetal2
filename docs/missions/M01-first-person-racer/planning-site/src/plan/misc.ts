import type { Question, Risk } from './types';

export const REQUIREMENTS: { id: string; text: string; tickets: string[] }[] = [
  { id: 'R1', text: 'First-person camera through a tank-like window', tickets: ['T3', 'T0'] },
  { id: 'R2', text: 'PNG HUD with working gauges', tickets: ['T4'] },
  { id: 'R3', text: 'Steampunk yoke that turns with steering', tickets: ['T4'] },
  { id: 'R4', text: 'Goblin arms on the yoke, cropped at the screen bottom', tickets: ['T4'] },
  { id: 'R5', text: 'Gyro ball: rolling core, level side caps', tickets: ['T3'] },
  { id: 'R6', text: 'Explosions, collisions, dust, smoke, sparks', tickets: ['T5'] },
  { id: 'R7', text: 'Start zone at the hilltop, goblin push, no slingshot', tickets: ['T1'] },
  { id: 'R8', text: 'Roll downhill to the first loop', tickets: ['T1'] },
  { id: 'R9', text: 'Sorting at first-loop entry: pool, ready, unfreeze', tickets: ['T2'] },
  { id: 'R10', text: 'Exit in entry-time order without collisions', tickets: ['T2'] },
  { id: 'R11', text: 'Contact racing resumes after the merge', tickets: ['T2', 'T6'] },
  { id: 'R12', text: 'Lanes as authored vector paths with movable nodes', tickets: ['T6', 'T7'] },
  { id: 'R13', text: 'Merge / split / OOB nodes', tickets: ['T6', 'T7'] },
  { id: 'R14', text: 'Easy to use in builder mode', tickets: ['T7'] },
];

export const BACKLOG: string[] = [
  'B1 Merge slots for 20/50/100 fields (row slots behind the gate reached by a visible glide back)',
  'B2 Qualifying heats before the race (session.ts + grid.ts), if Q1 says large fields',
  'B3 Skill-timed push (a timing meter on the starter goblin), if Q6 says skill',
  'B4 Regenerate anim-45/47/48/49/51/52 and swap the procedural puffs for sheets',
  'B5 Re-dress environment.ts rails and crowd to follow authored lanes',
  'B6 Wire collision/spatial-hash + contacts.ts in place of the O(n²) resolveBumps',
  'B7 Wire dent-state / cube-sphere onto the gyro core',
  'B8 Touch and gamepad yoke input',
  'B9 Show authored lane lines during races (option)',
  'B10 Spline (Catmull-Rom) lane segments',
  'B11 Records namespaced by startMode (push vs sling) with a migration',
  'B12 Fix the grounded altitude ≡ RADIUS quirk (needs its own migration ticket)',
];

export const RISKS: Risk[] = [
  { id: 'K1', ref: '§5.10 #1', severity: 'high', risk: 'The flat start pad and run-in mean that too weak a push/drop stalls racers before the loop, and too strong a push overshoots loop engagement.', mitigation: 'T1 AC-3/AC-4 bound vx at the gate to [700, 1100] for every loadout. START_DROP is tuned inside a frozen window and recorded.' },
  { id: 'K2', ref: '§5.10 #2', severity: 'medium', risk: 'Removing the ramp/boost/sign/blimp/sheep before the gate could shift layout RNG and move every later obstacle.', mitigation: 'Filter after generation; the post-gate fingerprint test (T1 AC-5) covers all 3 courses.' },
  { id: 'K3', ref: '§5.10 #4', severity: 'medium', risk: 'Changing the start elevation could desync the spline (track-space) from courseY near D_START = 1100.', mitigation: 'Retrieval RQ-1 before T1. If the spline samples courseY, rebuild it and assert the start-segment placement round trip.' },
  { id: 'K4', ref: '§5.8', severity: 'high', risk: 'Seven of ten effect sheets are flagged, so dust and smoke would slide or sit static.', mitigation: 'Use the clean anim-43/46, procedural puffs for dust and smoke, and one regeneration (anim-44). The rest go to the backlog (B4).' },
  { id: 'K5', ref: '§5.3', severity: 'medium', risk: 'The Float64Array(16) pair cooldowns are wrong for more than 4 racers.', mitigation: 'Resized to n·n in T2; the size is asserted in merge-race.' },
  { id: 'K6', ref: '§5.7(a)', severity: 'high', risk: 'The legacy checkpoint uses wall-clock timers and teleports, and leaks the interval on unmount paths.', mitigation: 'Deleted in T2; the grep AC and the no-teleport AC enforce it.' },
  { id: 'K7', ref: 'D1', severity: 'medium', risk: 'near = 4 with far = 60000 gives depth precision artefacts (z-fighting on decals).', mitigation: 'far is cut from 200000 to 60000 because fog hides it anyway. The human checks the preview; logarithmicDepthBuffer is a fallback flag.' },
  { id: 'K8', ref: 'D4/D9', severity: 'medium', risk: 'Adding rollPhase or merge fields might perturb the physics-parity fingerprint.', mitigation: 'The fields are additive and excluded from the fingerprint list. Parity runs in every ticket’s check.' },
  { id: 'K9', ref: '§2', severity: 'high', risk: 'No WebGL in the sandbox, so visual regressions can’t be seen.', mitigation: 'All composition is pure math with tests, and every ticket lists an UNVERIFIED section plus a preview URL for the human.' },
  { id: 'K10', ref: 'R1', severity: 'low', risk: 'Motion sickness in loops.', mitigation: 'Third-person stays selectable (D2). A comfort option (horizon-locked up in loops) is a one-flag variant of gyroFrameFor.' },
  { id: 'K11', ref: 'D14', severity: 'medium', risk: 'The art budget is used up in one turn with no retries.', mitigation: 'Human approval first (Q8). Needles are SVG, so the gauges work with placeholder art. The arm is mirrored.' },
];

export const QUESTIONS: Question[] = [
  { id: 'Q1', question: 'Field size for the new flow: the classic 4, or 20/50/100?', defaultAnswer: 'Classic 4 (T2 refuses >4 with a typed reason).', blocks: 'B1, B2' },
  { id: 'Q2', question: 'Ready-up: does the player press a button, or does the pool auto-release?', defaultAnswer: 'Button, with auto-ready after 15 s.', blocks: 'T2 constants only' },
  { id: 'Q3', question: 'OOB nodes: respawn with a penalty, DNF, or reset to the last node?', defaultAnswer: 'Respawn via the existing RecoveryPolicy, no extra penalty.', blocks: 'T6 OOB branch' },
  { id: 'Q4', question: 'First-person only, or a selectable camera?', defaultAnswer: 'Selectable, first_person by default.', blocks: 'nothing' },
  { id: 'Q5', question: 'Do the gyro caps carry art, or stay plain metal?', defaultAnswer: 'Plain brass tinted with the racer colour.', blocks: 'nothing' },
  { id: 'Q6', question: 'Push strength: skill-timed or fixed and fair?', defaultAnswer: 'Fixed and fair, ±2% seeded.', blocks: 'B3' },
  { id: 'Q7', question: 'Can authored networks have 3 or 6 lanes, or always 4?', defaultAnswer: 'Any count within the ±443 z corridor.', blocks: 'nothing' },
  { id: 'Q8', question: 'Approve the art direction and the 10-image list before generation.', defaultAnswer: 'Must be answered before T4/T5 art.', blocks: 'T4 art, T5 image 10' },
  { id: 'Q9', question: 'Should the race clock exclude the merge hold? (records comparability)', defaultAnswer: 'Yes, exclude it.', blocks: 'T2 raceTime' },
];

export const RETRIEVAL: { id: string; ask: string; why: string }[] = [
  { id: 'RQ-1', ask: 'track-space.ts: how the spline is built from courseY for x < 1370, and what D_START = 1100 anchors.', why: 'K3 — the start-pad elevation change' },
  { id: 'RQ-2', ask: 'racers.ts createRacers: grid row x/z offsets and the loadout table (pace, handling, launchSpeed).', why: 'T1 AC-3 loadout sweep' },
  { id: 'RQ-3', ask: 'track-space.ts: does an inverse world → (engine x, z) exist? Signature?', why: 'T7 dragging' },
  { id: 'RQ-4', ask: 'tests/physics-parity.test.ts: the fingerprint field list.', why: 'Excluding rollPhase, pathId and merge fields' },
  { id: 'RQ-5', ask: 'track-layout.ts: RNG draw order per obstacle and whether the ridge first-loop x is a constant.', why: 'K2 filtering' },
  { id: 'RQ-6', ask: 'preferences.ts: validation shape and stored key/version.', why: 'D2 migration flag' },
];

export const NOT_ASKING: string[] = [
  'Multiplayer or networked racing',
  'Qualifying heats before the race, or merge slots for fields > 4',
  'Regenerating six of the seven flagged sheets (only anim-44)',
  'Any change to the grounded-altitude quirk or to track-space reparameterisation',
  'Wiring the unwired collision, dent, cube-sphere or pickup-claim modules',
  'Re-dressing scenery to follow authored lanes',
  'New audio assets (only a synthesised "push" cue)',
  'Mobile touch steering, gamepad support or VR',
  'Removing the slingshot code (kept behind startMode)',
  'Screenshot-based acceptance of anything WebGL',
];
