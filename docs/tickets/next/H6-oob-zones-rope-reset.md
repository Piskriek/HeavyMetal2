# H6: Out-of-Bounds Zones and Rope-Goblin Reset Animation

- **ID**: `H6`
- **Priority**: High
- **Component**: OOB Recovery / Visual FX / Gameplay Animation
- **Conflicts with**: `P3`, `P9`
- **Needs art**: Yes (4-frame 2x2 animated spritesheet of a goblin pulling a rope to reel in the marble, following `docs/ART_PIPELINE.md` Section 10)

---

## Goal
Authored Out-of-Bounds (OOB) nodes in the lane network detect when a marble leaves the designated track boundary, but the recovery currently triggers an abrupt instant teleport without narrative or visual context. Introduce a 1.0-second interactive rope-pulling goblin recovery sequence: when crossing an OOB threshold, the player's marble locks, a tow-rope goblin animation renders reeling the line taut, and the marble is smoothly returned to the last safe track waypoint before resuming rolling physics.

---

## Evidence
- `src/game/lane-network.ts:32, 239, 494-505`: OOB nodes (`LaneNodeKind = 'oob'`) and `oobCrossed()` detect boundary crossings.
- `src/game/sim/racer-physics.ts:553-560`: When `oobCrossed` triggers, it immediately invokes `recoverRacer(racer, ctx, 'oob', trace)`, instantly teleporting the racer without animation.
- No rope-pulling goblin animation asset or recovery state exists in `src/game/effects/` or `public/art/animated/`.

---

## Solution
1. **Art Generation (ART_PIPELINE Section 10)**:
   - Generate `art-src/animated/goblin-rope-reel-src.png`: 4-frame 2x2 grid (`#FF00FF` gutters) of an energetic goblin in harness aggressively reeling in a thick rope hand-over-hand.
   - Run `scripts/process-generated-animated.mjs` to validate gutters, register frames, despill magenta, and output `public/art/animated/alpha/goblin-rope-reel.png`.
2. **Recovery State Machine**:
   - In `src/game/sim/racer-physics.ts`, introduce an `oobRecovery` timer state on `Racer` (1.0 s duration).
   - During OOB recovery:
     - Racer is marked invulnerable and physics integration pauses velocity.
     - Spawn the animated rope-goblin billboard along with rope line graphics connecting to the ball.
     - Smoothly interpolate racer position from the OOB point back to the nearest active lane centerline.
     - At $t = 1.0\text{ s}$, release the marble with base forward velocity ($v_x = 180$) and resume race input.
3. **Audio Cue**:
   - Play a rope reel-in ratchet sound (`audio.play('rope_reel')`) during the sequence.

### Files Allowed to Change
- `src/game/sim/racer-physics.ts`
- `src/game/effects/renderer-fx.ts`
- `src/game/engine.ts`
- `src/game/audio.ts`
- `public/art/animated/**`
- `art-src/animated/**`

### Must NOT Change
- Topological node contracts in `lane-network.ts`

---

## Acceptance Criteria
- [ ] Crossing an authored OOB node initiates a 1.0 s rope recovery sequence rather than an instant teleport.
- [ ] Animated rope-pulling goblin sprite renders above the recovery path facing the camera.
- [ ] Marble smoothly reels back onto the valid lane centerline over the 1.0 s duration.
- [ ] Controls re-engage seamlessly at the end of the recovery cycle with positive forward momentum.

---

## Tests to Run
- `node --import tsx --test tests/lane-rope.test.ts`
- `node --import tsx --test tests/animated-props.test.ts`
- `node scripts/check.mjs`
