# TASK-11: the mentor speaks in the game

**Read first:**
- `docs/NARRATION_SYSTEM.md`: the research and the rules;
- `packages/narrator`: the pure engine and FIDELITY's table, with 13 tests;
- `apps/web/src/audio/mentor-mix.ts`: the owner's radio mix;
- `apps/web/src/dev/radio.ts`: the audition page's audio chain, which you reuse.

The narrator decides; the game detects, plays and shows.

## 1. Load and measure
- Behind the startup loading bar (hard rule: never start a screen choppy), fetch and decode every `public/vo/<ID>.mp3` listed in `public/vo/index.json`.
- Measure each clip, then build `fidelityRules(secondsById)`.
- Restore the radio log from the profile save into `createNarrator(heard)`. Save `state.heard` back whenever it grows.

## 2. Step and play
- Every frame: `step(rules, state, dt)`. The narration is presentation, so the render clock is fine. It never touches the sim.
- **`start: id`:** play the clip through the mentor chain at the owner's levels. Lift the chain out of `dev/radio.ts` into a shared module so the audition page and the game use one chain:
  - the radio band, presence and de-harsh filters, drive, compressor, and the wet/dry `radioBlend`;
  - the static bed under her voice;
  - music ducked by `MENTOR_MIX.duck` while she speaks.
- **`cut: id`:** fade the clip out over about 0.3 s.
- **When a clip's audio ends:** call `finish(rules, state, id)`.

## 3. The events
Wire `trigger(rules, state, event)` at the moments in `packages/narrator/src/fidelity.ts`:
- **Act I:** `wake`, `look:power-wall`, `breaker:thrown`, `power:on`.
- **Act II:** `look:window`, `gate:approach`, `gate:lever`, `gate:open`.
- **Moon and progression:**
  - `moon:enter`;
  - `sync:low`: sync under 30%, each time it drops below, not every frame; the cooldown handles the rest;
  - `machine:first`, `tool:pickup`, `dirt:process`, `studio:open`, `bloom:first`.
- **Base building:** `build:foundation`, `build:refused`, `build:collapse`, `harvest:pixels`, `bin:linked`, `drafting:blueprint`, `room:sealed`.
- **Fabrication:** `fab:installed`, `fab:scout`, `weapon:swap`, `fab:hauler`, `fab:crawler`.
- **Monster Mash and status:** `mob:seen`, `mob:kill`, `health:low`, `stage:2` to `stage:6` (a plot reaching that stage), `sync:on`, `sync:off`.

Rules for the events:
- A "look" event fires when the crosshair rests on the target for about 0.8 s.
- Fire each event at its moment, and let the narrator handle once-only, cooldowns and order.
- An event with no game moment yet: list it in your post, and do not invent a feature for it.

## 4. Subtitles and the radio log (load the frontend-design skill first)
- **The caption:**
  - a radio caption at the bottom centre, styled as the game's telemetry HUD;
  - "Mentor" as the speaker (she has no name yet; the owner decides);
  - the text from `vo/index.json` with the v3 tags (`[breathes]`, `[pause]`, `[dry]` and so on) stripped;
  - it appears when the line starts, holds for the clip, and fades.
- **Subtitles are on by default,** and they show even at dialogue volume 0.
- **The radio log:** in the pause or inventory screen, every heard line in order, each with a replay button that plays through the same chain.
- **Settings:** a dialogue volume and a subtitles toggle.

## Done when
- Act I plays end to end: waking speaks A1-01; looking at the power wall gives A1-02, then the breaker, power-on and window lines in order.
- A test drives the events, and a shot shows the caption.
- Story lines never repeat across a reload (the saved log), and `sync:low` held for two minutes speaks at most twice.
- Checks: typecheck shows 0 errors; the tests are green, including `packages/narrator`; `npm run build` succeeds.
- Git: stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change.
