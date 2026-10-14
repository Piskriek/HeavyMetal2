// File: docs/prompts/sidecar/29-audio-5bus-and-juice.md
# TASK-29: 5-Bus Web Audio Mixer with VO Ducking, World_SFX Bit-Depth Mirror & Interaction Juice

## 1. Objective
Route all game audio through the 5-bus Web Audio mixer with automatic sidechain ducking when Dr. Haddy speaks, mirror the plot's Fidelity Stage on `World_SFX_Bus` (`8 kHz` 4-bit at Stage 0 -> `48 kHz` stereo at Stage 3–4 per `DEC-07`), and wire the 6 tactile interaction juice recipes (`@hm/tooljuice`, `@hm/juice`, `@hm/plume`).

## 2. Pre-Built Drop-In Files to Wire
1. `apps/web/src/audio/five-bus-mixer.ts` (`Master_Bus`, `VO_Bus`, `Combat_UI_Bus`, `World_SFX_Bus`, `Ambience_Bus`, `Music_Bus`, `-6.5 dB` / `-8.0 dB` VO ducking, and `DEC-07` `World_SFX_Bus` bit-depth reducer).
2. `packages/soundpack/src/procedural-action-sfx.ts` (Zero-MB Web Audio procedural synthesis for all 12 core player verbs + 4-voice proximity-culled machine loops).
3. `packages/shareware/src/sub-bass-reinforcer.ts` (`64 Hz -> 31 Hz` sub-bass punch for 8-bit WAD audio).
4. `packages/tooljuice/src/interaction-juice-recipes.ts` & `packages/tooljuice/src/__tests__/interaction-juice-recipes.test.ts` (Beam brush ring decal, 16-chunk Bezier spiral vacuum stream, `0.65 s` `#7cff4d` wireframe print sweep + `4 cm` settle bounce, separated `feedHopperPos` / `exhaustVentPos` sockets, and `DEC-04` Rock Drill grey dust wisp).

## 3. Integration Steps
1. Instantiate `FiveBusAudioMixer` in `apps/web/src/audio/` and trigger `setVoActive(true/false)` around Dr. Haddy VO playback.
2. Connect `ProceduralActionSfxBank` and `evaluatePrintSweepAndBounce()` to `apps/web/src/play/beam-tool.ts` and `apps/web/src/base/view.ts`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/tooljuice`
- Verify `0 MB` added audio payload in `dist/index.html` (`POL-27`).
