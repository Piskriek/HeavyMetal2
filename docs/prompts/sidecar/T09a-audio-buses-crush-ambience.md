# T09a: the five audio buses, voice ducking, the bit-depth mirror and stage ambience (TICKET-09, part A)

**Plan:** ARGO_NOTE_10 (`docs/argo/notes/ARGO_NOTE_10_next_batch_ticket09_onward.md`), TICKET-09. **The full spec is brief 29:** `docs/prompts/sidecar/29-audio-5bus-and-juice.md`, with Argo's sign-off at its end. Read it first.

**Why it's split:** part A touches only the audio code and two new pure modules, so it can run while F-09 is in `play-scene.ts` and `play.tsx`. Part B (T09b) does the play-screen wiring later.

## Do (part A)
1. **Two pure modules,** with unit tests (no DOM, no `Date.now()`, no `Math.random()`):
   - **`packages/audiomix/`** (`@hm/audiomix`):
     - the five-bus routing table (voice, combat and UI, world SFX, ambience, music: every source on exactly one bus);
     - the duck envelope (80 ms attack, 450 ms release; world −6.5 dB with a 1.8 kHz low-pass, music −8 dB, ambience −5 dB, combat and UI −2 dB);
     - the stage-to-crush table (stage 0: 8 kHz and 4-bit; stage 1: 11 kHz and 8-bit; stage 2: 22 kHz and 12-bit; stage 3 and up: full);
     - the pickup chime ladder (+1 semitone per consecutive chunk, reset after 1.2 s).
   - **`packages/tooljuice/src/print-sweep.ts`:** the 0.65 s clip-plane sweep progress (base to top), and the 4 cm settle spring, as pure functions of time. If `@hm/tooljuice` doesn't exist, create it the way the other packages are set up.
2. **The five buses** (brief 29 item 1), in `apps/web/src/audio/game-audio.ts`, using `@hm/audiomix`.
   - Voice and music keep the owner's mix: `MENTOR_MIX` in `mentor-mix.ts` (Voice 80, Radio 10, Static 30, Music 45, Overdrive 10). Don't change it.
   - The existing music duck becomes part of the five-bus duck.
   - Expose bus levels in Settings (`apps/web/src/shell/settings-body.tsx`): one slider per bus, saved like the current audio settings.
3. **The bit-depth mirror** (brief 29 item 3, DEC-07) on the world SFX bus only, as an AudioWorklet loaded from an inline-string Blob URL.
   - It must load from the built single file served over http AND opened from disk.
   - Never apply it to voice, UI or music.
   - `gameAudio.setStage(stage)` drives it.
4. **Stage ambience** (brief 29 item 4), procedural in `@hm/soundscape`, from the four floats.
   - **The API:** `gameAudio.setAmbience({ where: 'lab' | 'planet', stage, floats, nearWater })`.
   - **No call site in the play screen yet;** that's part B. Drive it from a dev hook in the browser check.
   - Reuse the approved `sfx-storm` in the lab where it fits. No creature calls.
5. **No autoplay at the menu** (POL-72, Argo's sign-off): the world SFX and ambience buses stay at zero gain until the first pointer or key press, or entering the lab. Do it inside `game-audio.ts` with a one-time listener, without editing the menu screens.

## Not in this part (T09b, after F-09)
- the verb sound table and its wiring (brief 29 item 2) in the play files;
- hooking the print sweep into `piece-meshes.ts` and `machine-props.ts` (item 5);
- POL-42 (the skin degauss tick) and POL-67 (the gate's charge pitch).

Brief 29's item 6 (hoppers and exhaust vents) goes with Flash's plume job (F-11).

## Verify
- **Unit:** the bus map, the duck amounts and timing, the crush table, the chime reset, and the sweep's progress over time.
- **A browser check:** extend `scripts/test-music-sfx.mjs`, or write `scripts/test-audio-buses.mjs`, with Web Audio taps.
  - During a voice line, the world bus measures at least 6 dB down.
  - At stage 0, a world SFX is crushed and a UI click is not.
  - Ambience layers change between stage 0 and stage 4.
  - The menu is silent on world and ambience until the first click.
  - Run it against the built file over http and from disk.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new check and `test-campaign` (45 of 45). Report the build size.

## Stay inside
`apps/web/src/audio/`, `packages/audiomix/` (new), `packages/tooljuice/` (new or existing), `packages/soundscape/`, `packages/soundpack/` (only if a gap sound needs it), `apps/web/src/shell/settings-body.tsx`, the new test, and the workspace wiring for the new packages (`package.json`, `package-lock.json`, tsconfig references).
- Never touch `play-scene.ts` or `play.tsx`: F-09 has them.
- Never touch `apps/web/src/studio/`, `apps/web/studio-server/` or `planetary-grid.*`: Flash's F-15 has them.
- Use POL-151 to POL-160 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
