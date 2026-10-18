# T09b: a sound for every verb, the print sweep, and the audio wiring in the play screen (TICKET-09, part B)

**Spec:** brief 29 (`docs/prompts/sidecar/29-audio-5bus-and-juice.md`) items 2 and 5, and Argo's sign-off. **Part A has landed** (T09a, e45e035c and c5e83924): the five buses, the duck, the bit-depth mirror, stage ambience, `@hm/audiomix` and `@hm/tooljuice`'s `printFrame`.

**Start only when Opus opens `play-scene.ts` for you** (one writer at a time; the queue is TPOL, then T11b, then this).

## Decisions already made (Opus, 2026-10-18)
1. **The music duck follows the owner's ear:** `MENTOR_MIX.duck` (music to 0.45 of its level, 0.4 s down, 1.2 s up). The brief's −8 dB is replaced for music only. The other buses keep Argo's amounts and the 80 ms attack and 450 ms release.
2. **The chime ladder's octave cap stays.**
3. **The print sweep's settle stays as T09a built it:** held 4 cm up during the 0.65 s sweep, then a damped 5 Hz spring.
4. **Settings: no two sliders with the same name.** Rename the old Sound group's sliders for what they drive (for example "Maker and racing: effects" and "Maker and racing: music"), or fold them into the Game mix if they really are the same thing. Load the frontend-design skill (`frontend-design:frontend-design`) first, and take a shot of the Settings Sound section.

## Do
1. **The verb table** (brief 29 item 2):
   - Inventory every verb the player performs: the breaker, the gate's ignition, the beam's dry fire, Extract (with the chime ladder), Apply, Sculpt, Seal, the cartridge's snap, placing, refusing, the weld, doors and airlocks, pickups, and the others brief 29 lists.
   - Map each verb to an approved file in `apps/web/public/audio/index.json` where one fits. Build a procedural sound in `@hm/soundpack` (transient, tonal body, mechanical tail) only for the gaps; the brief's likely gaps are the three mode chords, the cartridge's snap and ping, and the chime.
   - Route each verb to its bus. Post the table in your report.
2. **Wire it in** `play-scene.ts` and `play.tsx`, where each verb fires.
3. **`setAmbience`'s call sites:** the play screen calls `gameAudio.setAmbience({ where, stage, floats, nearWater })` on stage changes, on entering and leaving the lab, and when the player moves near water or away from it. That's throttled, never every frame.
4. **The print sweep** (brief 29 item 5): placing a foundation, wall or machine runs `printFrame` over 0.65 s (from its base to its top, with the bright `#7cff4d` leading edge), then the settle. It's one uniform per piece in `piece-meshes.ts` and `machine-props.ts`. Keep it cheap on Low.
5. **POL-42:** the 40 ms skin degauss tick on the combat and UI bus, and the EGA quantise of the metric bars (see the registry).
6. **POL-67:** the rising capacitor-charge pitch during the gate's ignition (see the registry).

Brief 29 item 6 (hoppers and exhaust vents) belongs to the plume job (F-11), not this one.

## Verify
- Extend `scripts/test-audio-buses.mjs`:
  - each verb in the table triggers its sound on the right bus;
  - Extract's chime rises a semitone per chunk and resets after 1.2 s;
  - the music duck matches `MENTOR_MIX.duck`;
  - `setAmbience` changes the layers when the player walks from the gate into growth at stage 4.
- Shots: a print sweep mid-way, and the Settings Sound section. Look at every one.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, `test-audio-buses`, `test-music-sfx`, `test-base-building` and `test-campaign` (45 of 45). Stage 6 on Low stays at F-09's fps. Report the build size.

## Stay inside
`play-scene.ts` and `play.tsx` (the verb hooks, the ambience calls and the print sweep only), `piece-meshes.ts`, `machine-props.ts`, `apps/web/src/audio/`, `packages/soundpack/`, `settings-body.tsx`, and the test. Use POL-191 to POL-200 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
