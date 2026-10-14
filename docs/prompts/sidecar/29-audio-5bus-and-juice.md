# TASK-29: the five-bus mixer with ducking, sounds for every verb, ambience by stage, the bit-depth mirror, the print sweep (Wave C)

After Wave B. The sources:
- Argo's `15-sound.md` (P0-SOUND-01, P0-SOUND-02, P1-SOUND-03, and the bus table in its §4);
- the master plan's DEC-07 (the bit-depth mirror);
- `17-vfx-juice.md` (P0-VFX-02, P1-VFX-03);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, brief 29, and ruling 07, which win where they differ:
  - **every approved RUN.world file stays** (the music, the 36 SFX and Dr. Haddy's voice); procedural sound only fills the gaps;
  - **the owner's radio mix stays as he set it by ear:** Voice 80, Radio 10, Static 30, Music 45, Overdrive 10 (`MENTOR_MIX` in `apps/web/src/audio/mentor-mix.ts`).

P0-VFX-01 (the beam's ring and chunk stream) was TASK-21d's.

## Where it lives
- **`apps/web/src/audio/game-audio.ts`:** a master gain, `musicBus`, `sfxBus`, `dialogueBus`, a music duck (`musicDuckGain`), and per-context music gains. Plus `mentor-voice.ts` (the radio chain) and `mentor-mix.ts`.
- **The approved files:** `apps/web/public/audio/index.json` (10 music, 36 SFX: breaker, relay, lever, capacitor hum, gate spool and hum, storm, place, refuse, collapse, weld, door, airlock, the four machines, fabricator, beam, three pickups, the three gun fires, reload, empty, the three motors, skid, impact, four UI) and `levels.json`. The voice is `apps/web/public/vo/`.
- **The packages:** `@hm/soundpack`, `@hm/soundscape`, `@hm/audio`, `@hm/soundlab`. Read them before writing anything new.
- **The plumes:** `@hm/plume` and the machine views in `apps/web/src/base/`. TASK-26 already scales plume emission by each machine's run rate.

## Build
1. **The five buses (P0-SOUND-01).**
   - Rebuild the graph as five buses: **voice** (Dr. Haddy), **combat and UI**, **world SFX**, **ambience**, **music**. Every source routes to exactly one.
   - **The starting gains:** voice and music from the owner's mix (Voice 80, Music 45; the radio, static and overdrive stay in the voice chain as they are). The new buses start at Argo's levels: combat and UI -4 dB, world -6 dB, ambience -12 dB. The audio settings get a slider per bus.
   - **While she speaks** (attack 80 ms, release 450 ms):
     - world SFX duck 6.5 dB, with a low-pass at 1.8 kHz;
     - music ducks 8 dB;
     - ambience ducks 5 dB;
     - combat and UI duck 2 dB.
   
     The existing music duck becomes part of this.
   - Once TASK-23b-2's fights exist, the music fades under combat.
2. **A sound for every verb (P0-SOUND-02).**
   - **First, inventory the verbs:** throwing the breaker, the gate's ignition, the beam's dry fire, Extract (with a pickup chime rising a semitone per consecutive chunk, resetting after 1.2 s), Apply, Sculpt, Seal, slotting and ejecting a cartridge, placing a piece or a machine, and anything else the player does that is silent.
   - **Map each to an approved file where one fits.** Build a procedural sound (in `@hm/soundpack`, as Argo's three layers: a transient, a tonal body, a mechanical tail) **only for the gaps**. Likely gaps:
     - the three mode chords: Apply a warm major third, Sculpt a low resonant sweep, Seal a high phase-locked tone;
     - the cartridge's snap and ping;
     - the pickup chime ladder.
   - Post the table (verb → file or procedural) on the board.
3. **The bit-depth mirror (DEC-07), on the world SFX bus only:**
   - stage 0: 8 kHz, 4-bit;
   - stage 1: 11 kHz, 8-bit;
   - stage 2: 22 kHz, 12-bit;
   - stage 3 and up: full.
   
   **Never** on the voice, UI or music. An AudioWorklet in a single-file build needs its module as a Blob URL from an inline string; test that it loads from the built file over http and from disk.
4. **Ambience by stage (P1-SOUND-03), procedural in `@hm/soundscape`, from the four floats:**
   - the lab: 50 Hz hum, vent air, the storm's muffled thunder (the approved `sfx-storm` where it fits);
   - stages 0 and 1: helmet breath, dry regolith crunch under foot, a thin low-bit wind;
   - from stage 2 (Lx at least 0.35): the helmet opens, the gravel is crisper, wind sweeps the rims;
   - from stage 3, near water (Aq at least 0.40): lapping, wet steps;
   - from stage 4: wind in the growth, and a warmer reverb.
   
   No creature calls unless a fauna system exists.
5. **The print sweep (P0-VFX-02):** placing a foundation, wall or machine runs a 0.65 s clip-plane sweep from its base to its top with a bright #7cff4d leading edge, then a small settle spring (4 cm). On Low, keep it cheap (one uniform per placed object, no extra pass).
6. **Hopper and exhaust (P1-VFX-03):**
   - every machine gets two sockets: the feed hopper (dark grey ore cubes drop in) and the exhaust vent (the bright square pixels rise out). Check each against sheet `docs/concept/setmix/12-sheet-field-machines.png` and sheet 17 for the heavy ones;
   - a machine that is off or out of ore spews nothing (TASK-26's run-rate scaling; confirm it reaches 0).

## Tests
- **Unit (pure):** the bus map (every source on one bus), the duck envelope and amounts, the stage-to-crush table, the chime ladder's reset, the sweep's progress over time.
- **A browser check** (a capture script with Web Audio taps, or `scripts/test-music-sfx.mjs` extended): during a voice line, the world bus measures at least 6 dB down; at stage 0, a world SFX is crushed and the UI click is not.
- **Shots:** a print sweep mid-way, and a machine's hopper and exhaust working. Look at every one.
- **The usual green set,** with the build size (the procedural sounds add code, not files).

## Report
On the board:
- the verb table;
- the bus levels;
- the duck measurement;
- the crush check;
- the shots;
- the results.

Flag any approved file you think should be redone; the owner decides.

## Argo's sign-off (14 October, docs/argo/plans/23-brief-review.md)
Approved as written, plus:
- **No autoplay at the menu:** the world-SFX and ambience buses stay at zero gain on the main menu until the first click or entering the lab (TASK-28's live menu). Whichever of 28 and 29 lands second wires it.
