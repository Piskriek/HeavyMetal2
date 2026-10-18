# T15: the harmonic machine choir, the 85.2 MHz Bridge FM radio and tapes, and Turbo Bass (TICKET-15)

**Spec:** OPUS_NOTE_21, brief 34 (`docs/prompts/sidecar/34-diegetic-song-radio-and-harmonic-machines.md`), and Argo's `docs/argo/notes/ARGO_NOTE_14_ticket15_and_pol141.md`. **Source:** `arena-gathered/argo-ticket15/` (11 files). **Opus's staging run:** the musicbox suite passes 5 of 5.

**Start only when Opus opens it,** after TRIFT (`wreck-sites.ts`), T10 (`monsters.ts`) and T09b (the audio wiring) have landed. Argo built on the files before those three, so several files must be merged, not copied.

## Copy or merge
- **Copy (new):**
  - `packages/musicbox/src/harmonic-machine-choir.ts` and its test (`__tests__/harmonic-radio-and-turbobass.test.ts`);
  - `packages/content/src/diegetic-radio-and-tapes.ts`;
  - `packages/tooljuice/src/beat-synced-plume-and-turbobass.ts`;
  - `apps/web/src/shell/diegetic-radio-tuner-widget.tsx`.
- **Merge by hand onto the current files:**
  - `packages/musicbox/src/index.ts` (+2) and `packages/audiomix/src/index.ts` (+2 −2);
  - `apps/web/src/audio/game-audio.ts` (+116): the choir and radio voices, routed through T09a's buses. The choir and radio go on music or world, as brief 34 says, and Turbo Bass on combat and UI. Never on voice. MENTOR_MIX stays untouched.
  - `apps/web/src/play/monsters.ts` (+58 −32): `knockbackSwarmers`, on top of T10's wall pathing;
  - `apps/web/src/play/wrecks.ts` (+10) and `wreck-sites.ts` (+20 −2): the four tapes hang on wrecks, on top of TRIFT's rule that wrecks stay 15 m from leaks.
- **`play-scene.ts` Window D:** the two hooks in ARGO_NOTE_14 (the plume emission times `beatPulse(t, 144)` while the choir converges, and `triggerTurboBass` calling `monsters.knockbackSwarmers`), as one labelled section.
- **`play.tsx`:** V triggers Turbo Bass, the radio tuner widget mounts, and picking up a tape adds it to the radio.

## Do
1. **The choir** (brief 34): when the Shape Press, Texture Mill, Light Projector and Water Maker all run within 35 m, they phase-lock at 144 BPM in the stems' key, and their plumes pulse on the downbeat.
2. **The radio:** a diegetic 85.2 MHz Bridge FM tuner widget, four collectible wreck tapes (TAPE #01 to #04), and the gate SSTV easter egg.
3. **Turbo Bass:** V sends a sub-bass ground ring 12 m out on the downbeat, knocking swarmers back 4 m.
4. **POL-141, while you're in the play files:** wire Argo's lab plume gate (ARGO_NOTE_14 §1). In `setLabActivity`, forward each station's flag to `labMachines.setOperating`, and keep the 3.5 s tail after a write, combine, catalogue or print in the station events.

## Verify
- **A new `scripts/test-ticket15.mjs`:**
  - four running machines within 35 m start the choir, and their plume counts pulse at 144 BPM;
  - the radio tunes to 85.2 and plays a found tape;
  - V knocks a swarmer back about 4 m;
  - a lab station's plume shows while its window is open and for about 3.5 s after an action, then stops.
  Use Web Audio taps for the bus checks. Take shots of the radio widget and a choir plume pulse, and look at them.
- Stage 6 on Low stays at F-09's fps. Report the build size (Argo estimates +15 KB).
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, the new test, `test-audio-buses`, `test-ticket07a`, `test-ticket10` and `test-campaign` (45 of 45).

## Stay inside
The files above, `play-scene.ts` (Window D only), `play.tsx` (V, the radio widget, tapes and the lab plume gate only), and the new test. Use POL-231 to POL-240 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
