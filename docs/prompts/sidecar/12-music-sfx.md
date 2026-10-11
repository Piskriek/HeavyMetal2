# TASK-12: music and sound effects in the game (after TASK-11)

**Files:**
- `apps/web/public/audio/<id>.mp3`: 10 music tracks and 36 effects, through Git LFS, beside index.html like `vo/`.
- `index.json`: what each one is.
- `levels.json`: the gain in dB for each file, and the loop region (`start`, `end`) for loops. Apply both always.
- The list and its prompts: `docs/runworld/audio.json`.
- Listen at `/audio.html`. The owner trusts the set and will flag anything that sounds wrong in play.

## 1. Buses and settings
- Master → music, effects and dialogue buses. TASK-11's dialogue chain plugs into the dialogue bus.
- Settings: master, music, effects and dialogue volumes.
- Music ducks under Dr. Haddy's lines (`MENTOR_MIX.duck`), one shared duck.

## 2. Loading (hard rule: never start a screen choppy)
- Effects are small: decode them all behind the startup loading bar.
- Music: decode `music-lab` at startup.
- Decode the seven `music-moon-s*` behind the gate transition's loading bar before the first Moon visit. Decode Monster Mash and driving with them.

## 3. Music by context
- **Lab:** `music-lab`, looped over its loop region.
- **Moon, the score that gains fidelity:**
  - run all seven `music-moon-s0`..`s6` together, in sync and looped;
  - the current plot's stage sets an equal-power crossfade between the two nearest tracks (the `/audio.html` scrubber shows exactly this);
  - while a stage rises, ease the crossfade along with the picture's transition;
  - multiply each gain by its `levels.json` gain: the levels already rise from stage 0's whisper to stage 6's full score.
- **Monster Mash:** crossfade to `music-monster-mash` over about 2 s when mobs engage, and back to the score after about 10 s of calm.
- **Driving:** crossfade to `music-driving` while in a rover, and back when you leave it.

## 4. Effects at their moments
- **Positional** loops and one-shots use a `PannerNode` (`equalpower` panning: the min-spec laptop) with an inverse distance model. At most 8 positional voices; past that, the farthest stops.
- **The lab:**
  - `sfx-breaker`, `sfx-relay` (each relay in the power-on sequence), `sfx-lever`;
  - `sfx-capacitor-hum`, looped at the capacitor bank while powered;
  - `sfx-gate-spool` as the coils light, then `sfx-gate-hum`, looped at the gate;
  - `sfx-storm`, looped at the window, quieter as the storm clears.
- **Building:** `sfx-place`, `sfx-refuse`, `sfx-collapse`, `sfx-weld` (printing a piece), `sfx-door`, `sfx-airlock`.
- **Machines,** looped at each running machine: `sfx-mill`, `sfx-projector`, `sfx-watermaker`, `sfx-fabricator` (while printing). `sfx-press` plays on each ram stroke.
- **Harvest:** `sfx-beam`, looped while the beam is held; `sfx-pickup-1`, `-2` and `-3` by pickup grade.
- **Weapons:** `sfx-fire-semi`, `-burst` and `-beam` (looped while firing) by core; `sfx-reload`; `sfx-empty`.
- **Rovers:**
  - `sfx-motor-scout`, `-hauler` and `-crawler`, looped, with the playback rate following speed (about 0.8 to 1.3);
  - `sfx-skid` on a slide;
  - `sfx-impact` on a hard hit.
- **UI:** `sfx-ui-hover`, `-select`, `-open` and `-close` on the game's windows and buttons.

## Done when
- **A debug hook** (`window.__audio`) lists the active voices with their gains. A test drives these moments and asserts them:
  - the power-on sequence plays the breaker, relays and lever, then the spool and hum;
  - the Moon score's weights follow a stage change;
  - entering a rover crossfades to the driving music;
  - the music ducks under a mentor line.
- Typecheck shows 0 errors; the tests are green; `npm run build` succeeds.
- No per-frame allocations in the audio update. Report the CPU time of the audio update on a busy base.
- Git: stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change.
