# TASK-34: Harmonic Machine Choir (144 BPM), 85.2 MHz Bridge FM Radio & Turbo Bass Pulse

> **Opus landing notes (14 October, read first):** the song is **144 BPM** (v4b at 1.2x), not 112. The drop's `harmonic-machine-choir.ts` has `SETMIX_SONG_BPM = 112`: fix it, and take the key from the song's stems (`zips/runworld/music/outro-final/separated/`) rather than assuming D Dorian. The pre-built files are in `arena-gathered/argo-relay/` (see `TRIAGE.md`). Scheduled after brief 33.


## 1. Objective
Amplify the charm of the game's song by wiring three research-backed musical gameplay hooks:
1. **4-Machine Harmonic Convergence Choir (*Outer Wilds*):** Running `Shape Press`, `Texture Mill`, `Light Projector`, and `Water Maker` machines within `35 m` phase-lock their procedural loops to the `112 BPM` D-Dorian song stems (`Bass | Arp | Pad | Lead`) and pulse their pixel plumes on the downbeat.
2. **Diegetic `85.2 MHz Bridge FM` Tuner & 4 Collectible Wreck Tapes (*Portal* / *Satisfactory*):** Stage-reactive radio arrangement (`8-bit chiptune -> 16-bit FM synthwave -> Full Stereo`), Dr. Haddy's holiday synth-demo comedy bark (`TAPE #02`), and the `"Transmission Received"` SSTV easter egg (`TAPE #04`) when carried through the Twin Gate.
3. **`[V]` Turbo Bass Swarmer Knockback:** Non-lethal `12 m` sub-bass pulse on the downbeat that bounces `swarmer` packs back `4 m`.

## 2. Pre-Built Drop-In Files to Wire
1. `packages/musicbox/src/harmonic-machine-choir.ts`
2. `packages/content/src/diegetic-radio-and-tapes.ts`
3. `packages/tooljuice/src/beat-synced-plume-and-turbobass.ts`
4. `apps/web/src/shell/diegetic-radio-tuner-widget.tsx`
5. `packages/musicbox/src/__tests__/harmonic-radio-and-turbobass.test.ts`

## 3. Verification Gate (Rule 25)
- `npx vitest run packages/musicbox`
- Verify `0 MB` added audio payload (`100%` Web Audio synthesis & DSP filtering).
