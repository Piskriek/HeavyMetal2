# 32 — Master Pre-Written Code Drop Index for Claude Opus

> **Author:** Gemini Argo (Creative Lead)
> **Purpose:** While Claude Opus & Haiku's shared usage window was resetting on 14 Oct 2026, Argo pre-wrote **42 complete, drop-in source files, briefs, build scripts, and Vitest unit suites** in chat (zero inner fences) so Opus can save them straight to disk and save hours of Haiku sidecar token burn.

## Complete File Map (42 Drop-In Deliverables in Chat History)

| # | Target Path in Repo | Brief / Plan | What It Implements |
| :--- | :--- | :--- | :--- |
| **1** | `docs/prompts/sidecar/33-credits-video.md` | `TASK-33` | Sidecar Brief 33 for `"Four Floats"` (v4b @ 144 BPM) with all 7 owner corrections. |
| **2** | `docs/argo/plans/29b-voice-manifest.md` | `Plan 29b` | Unified 17-line Dr. Haddy Voice Manifest (`A7-01..A9-03` + 8 `CHARM-*`). |
| **3** | `docs/argo/plans/31-review-task-24.md` | `TASK-24` | Merge gate review & Milestone Wave B (`Briefs 25–27`) dispatch sequence. |
| **4** | `apps/web/src/shell/hud-skins.css` | `Brief 25` / `Plan 28` | 9-Zone Non-Overlapping HUD Grid, `136px` Bottom Build Ribbon, and 6 `data-fidelity` skins (`0a`, `0b`, `1`, `2`, `3`, `4-6`). |
| **5** | `packages/groundshader/src/stage-post.glsl.ts` | `Brief 27` / `Plan 25` | Single-pass depth-reconstructed Wireframe (`0a`), 1-Bit Facet Dither (`0b`), EGA (`1`), and Suit-Cam CMOS (`4-6`) post-shader + uniform helper. |
| **6** | `apps/web/src/credits/timeline.ts` | `Brief 33` | 144 BPM v4b timeline, `outro.json` loop loader, 7 chapters, synced v4b lyrics (`"you pulled it right in front of me"`), and legal/team credits roll. |
| **7** | `apps/web/src/credits/credits-hud.tsx` | `Brief 33` | Stage-skinned lyric pill, 4-float chiptune equalizer, and scrolling right-third credits column. |
| **8** | `apps/web/src/credits/__tests__/timeline.test.ts` | `Brief 33` | Vitest suite for 144 BPM timeline, loop math, v4b lyric cue, and credits roll. |
| **9** | `packages/content/src/charm-and-act789.ts` | `Plans 26, 29, 29b` | Pure data & state helpers for Acts VII–IX, stateful Lab fixture inspections, 1-in-50 Rover greeting, and `"dirt"` joke detector. |
| **10** | `apps/web/src/credits/index.ts` | `Brief 33` | 3D Credits Director, camera keyframe interpolator, mouse parallax, and `"Four Floats (Overclocked)"` (`1.2x` pitch) monitor player. |
| **11** | `scripts/test-credits-video.mjs` | `Brief 33` | Headless verification script for `TASK-33`. |
| **12** | `packages/shareware/src/fidelity-mob-leak.ts` | `Brief 30` / `DEC-02` | S-Space Containment Leak Shader (`#181c24` obsidian remap + metric veins + scanline slices), era staging, and `3.5 m` Glitch Rift Column (`POL-23`). |
| **13** | `packages/camerarig/src/rover-spring-arm.ts` | `Brief 27` / `P0-VEH-01` | Sphere-cast Rover spring arm with hard terrain floor clamp (`+0.65 m`) and `>= 1.8 s` hang-time detector. |
| **14** | `packages/plotsim/src/coherence-and-power.ts` | `Brief 26` / `Brief 27b` | `25 m` Gate / `15 m` Pylon Coherence Safe Dome, Zero-Loss Recall, `12 kW` Gate brownout math, and `2 kW` Perimeter Turret targeter. |
| **15** | `apps/web/src/lab/lab-choreography-and-heal.ts` | `Brief 28` / `Plan 26` | Act I dark strobe wake, sequential strip-light power-on, `3.0 s` bottom-up Gate coil ignition, and Act IX `6.0 s` Window Breach heal. |
| **16** | `packages/audio/src/five-bus-mixer.ts` | `Brief 29` / `DEC-07` | 5-Bus Web Audio Mixer with VO sidechain ducking, `World_SFX_Bus` Stage 0–4 bit-crush mirror, and procedural action SFX. |
| **17** | `scripts/e2e-hud-and-luminance-gate.mjs` | `TASK-24` / `P0-PROD-01` | Playwright/Puppeteer DOM `[data-hud-zone]` overlap checker and center-canvas avatar luminance floor gate (`>= 35/255`). |
| **18** | `apps/web/src/base/foundation-frame.ts` | `Brief 26` | Sheet 13 gunmetal box-section foundations, raycasted telescoping legs, `0.65 s` `#7cff4d` print sweep, and floor cable covers. |
| **19** | `apps/web/src/shell/build-ribbon.tsx` | `Brief 25` | Non-blocking `136px` bottom-docked Build Ribbon drawer with Linked Depot ore & `12 kW` grid readout. |
| **20** | `apps/web/src/studio/asset-bench-4angle.tsx` | `Brief 31` / `DEC-10` | Studio 4-Angle Review Grid (`Rule 17`), Stage `0a`–`6` shader scrubber, `Rule 16` Socket Editor, and `W/E/R` vs `G/R/S` keymap toggle. |
| **21** | `apps/web/src/play/screensaver-pipes.ts` | `Plan 29` §2.3 | `45 s` idle 1993 3D Pipes & Bouncing Four-Float Helmet Screensaver with corner-hit gold flash. |
| **22** | `apps/web/src/play/beam-juice-and-modes.ts` | `Brief 29` | Armoured suit & real-size (`1.0x`) Beam Rifle de-metalling (`<= 0.25`) + rim rig, mode coils, ground ring decal, and 16-chunk spiral stream. |
| **23** | `apps/web/src/base/machine-plume-and-labels.ts` | `Brief 25/29` / `DEC-04` | Separated hopper (in) vs. exhaust (out) sockets, `Rock Drill` grey dust wisp, off-spews-nothing rule, and `8°`/`14 m` raycast label culling. |
| **24** | `packages/plotsim/src/__tests__/coherence-and-power.test.ts` | `Brief 26/27b` | Vitest suite for Safe Dome, Zero-Loss Recall, `12 kW` brownout, and `2 kW` turret priority. |
| **25** | `packages/groundshader/src/radial-scan-wave.ts` | `Brief 30` / `POL-04` | `450 m` Radial Volumetric Stage Scan-Wave (`4.5 s`) and Stage 4–6 Low-Spec `60 FPS` Governor profile. |
| **26** | `apps/web/src/shell/inventory-rig-panel.tsx` | `P1-UI-05` | Upgraded `Tab` Inventory with Armoured Suit Visor Customizer, `.glb`/`.vrm` dropzone, Cartridge Bandolier, and Bridge Incident Log reader. |
| **27** | `apps/web/src/lab/planet-table-hologram.ts` | `P1-LORE-05` / `Plan 26` | `2.4 m` Planet Table 12-node amber/green consensus hologram + Act IX Golden Master `.smx` slot. |
| **28** | `apps/web/src/base/heavy-and-vehicle-bay.ts` | `Brief 32` | Sheet 17 Heavy Terraformers on `8 m` pads, Sheet 19 Vehicle Gantry & rear sockets, aerial raycast, and Sheet 20 `2 kW` Turret rig. |
| **29** | `apps/web/src/shell/main-menu-diptych.tsx` | `Brief 28` / `DEC-08` | Live 3D Lab Dual-Contrast Main Menu blade (`POL-01`) + `Rule 22` real subsystem preload bar. |
| **30** | `packages/camerarig/src/__tests__/rover-spring-arm.test.ts` | `Brief 27` | Vitest suite for Rover camera terrain floor clamp, obstacle pull-in, and `>= 1.8 s` hang-time trigger. |
| **31** | `packages/content/src/__tests__/charm-and-act789.test.ts` | `Plans 26, 29, 29b` | Vitest suite for 17 voice manifest entries, multi-inspects, 1-in-50 Rover greeting, and `"dirt"` joke detector. |
| **32** | `packages/questline/src/act789-chain.ts` | `Plan 26` | Pure deterministic Act VII–IX quest chain (`A7-01` through `A9-03` -> `CAMPAIGN-COMPLETE` + Credits launch). |
| **33** | `packages/questline/src/__tests__/act789-chain.test.ts` | `Plan 26` | Vitest suite for Act VII–IX quest chain progression. |
| **34** | `scripts/quantize-low-glb.mjs` | `DEC-10` / `POL-27` | `Int16` vertex quantizer & `< 16.0 MB` `dist/index.html` bundle size gate. |
| **35** | `scripts/triage-overnight-batch.mjs` | `Plan 21` §4 | Automated 5-Point Asset Acceptance Gate for `zips/runworld/overnight-ids.txt`. |
| **36** | `scripts/batch-voice-act789.mjs` | `Plan 29b` | One-pass batch voice generator for the 17 new Dr. Haddy lines (`RUNWORLD_FLOOR >= 16,000` guard). |
| **37** | `apps/web/src/studio/preset-combiner-ui.tsx` | `Brief 31` / `Rule 23` | 2-Tier Material Designer (5 Macro Sliders vs. `@hm/texgraph` DAG), Golden Master splicer, and `Rule 23` Peaceful Core Synthesis. |
| **38** | `packages/groundshader/src/__tests__/stage-post-and-wave.test.ts` | `Brief 27/30` | Vitest suite for `0a`->`4-6` post-shader uniforms, radial scan-wave, and `POL-04` 60 FPS governor. |
| **39** | `apps/web/src/play/charm-detector-engine.ts` | `Plan 29` | Runtime detector for all 8 Dr. Haddy `CHARM-*` triggers. |
| **40** | `apps/web/src/play/__tests__/charm-detector-engine.test.ts` | `Plan 29` | Vitest suite for all 8 runtime charm detectors. |
| **41** | `packages/soundscape/src/stage-ambience-and-machine-loops.ts` | `Brief 29` | Procedural stage ambience crossfader, 4-voice machine loop proximity culler, and Shepard-tone stage swell. |
| **42** | `apps/web/src/crafter/gate-beacon-and-moss-patina.ts` | `Plans 11–17` | `80 m` Twin Gate sky beacon, portal gravity camera dip, `@hm/lattice` cable pulse beads, and Stage 4–6 moss patina. |
| **43** | `apps/web/src/play/footstep-and-tire-roost.ts` | `P2-VFX-05` | Pooled `InstancedMesh` stage-reactive footstep & Rover tire roost particles. |
| **44** | `packages/presetcodec/src/smx-cartridge-card.ts` | `P2-STUDIO-06` | Binary `.smx` and PNG `tEXt` "Cartridge Card" drag-and-drop encoder/decoder. |
| **45** | `packages/presetcodec/src/__tests__/smx-cartridge-card.test.ts` | `P2-STUDIO-06` | Vitest suite for `.smx` and PNG Cartridge Card round-trip serialization. |
