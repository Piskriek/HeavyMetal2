# P9: Sound Effects Pass and Pitch Scaling with Slow Motion

- **ID**: `P9`
- **Priority**: Polish
- **Component**: Audio Synthesis / Dynamic Sound Effects / Slow-Motion Pitch
- **Conflicts with**: `H6`, `H8`, `P6`
- **Needs art**: No

---

## Goal
The synthesized sound engine in `src/game/audio.ts` currently plays all sound effects at fixed, static frequencies regardless of the game's simulation speed (tick rate). Additionally, key mechanical actions—tree smashes, rope reel-ins, race start GO horns, and heavy lane clunks—lack audio signatures. Implement dynamic pitch and duration scaling so that slow motion (0.1x to 0.5x) lowers playback pitch and stretches audio envelopes realistically into deep rumbling bass, and synthesize rich audio effects for tree impacts, rope ratchets, the starting horn, and lane shifts.

---

## Evidence
- `src/game/audio.ts:25-60`: `play(name: SoundName)` plays fixed oscillator frequencies and buffer durations regardless of whether the game is running at 0.1x slow motion or 1.0x normal speed.
- `src/game/audio.ts:1`: Missing audio names for `'tree_smash'`, `'rope_reel'`, `'go'`, and `'lane_clunk'`.
- Running slow-motion tests results in high-frequency audio playing at normal speed while visuals move at 10% speed, breaking immersion.

---

## Solution
1. **Dynamic Pitch & Time Scale Tracking**:
   - In `GameAudio`, track `private timeScale = 1.0;`.
   - Update `setTimeScale(scale: number)` called by `engine.setTimeScale()`.
   - When playing sound effects, multiply base frequencies by $\text{pitchMultiplier} = \text{timeScale}^{0.4}$ and stretch buffer/envelope durations by $1 / \text{timeScale}^{0.6}$, producing cinematic, deep slow-mo bass groans.
2. **New Sound Synthesizers**:
   - `'tree_smash'`: Splintering wood crack (high-frequency noise burst followed by resonant hollow thud).
   - `'rope_reel'`: Rapid ratcheting metallic teeth clicks (simulating high-tension winch).
   - `'go'`: Resonant brass battle horn fanfare marking race start.
   - `'lane_clunk'`: Solid iron clunk and suspension creak on rapid lane shifts.

### Files Allowed to Change
- `src/game/audio.ts`
- `src/game/engine.ts`
- `tests/time-scale.test.ts`

### Must NOT Change
- Web Audio API gain and volume safety limits

---

## Acceptance Criteria
- [ ] Slowing game speed down to 0.1x / 0.5x pitches down sound effects into dramatic slow-motion rumble.
- [ ] Tree smashes, rope reel-ins, race start, and lane changes trigger distinct audio cues.
- [ ] No audio clipping or harsh digital distortion occurs across all speed presets.

---

## Tests to Run
- `node --import tsx --test tests/time-scale.test.ts`
- `node scripts/check.mjs`
