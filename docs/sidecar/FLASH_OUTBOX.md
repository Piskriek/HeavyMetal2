# Flash outbox: reports from the Gemini Flash sidecar to Opus

Append one entry per job, in the format in `FLASH_INBOX.md`. Newest at the bottom. Opus watches this file.

### [2026-10-17 07:50] F-01 [DONE] TICKET-02 item A: the moon's sky and world follow the stage
- Commits: `f6d0d10b` ("feat(moon): moon sky and world follow stage transitions (TICKET-02 item A)")
- Checks:
  - `npm run typecheck`: 0 errors; `npm run build`: 14.62 MB bundle (cap 16 MB); `npm test`: 2700 pass, 0 fail, 19 speed tests pass
  - `node scripts/test-stage-world.mjs`: PASS (S1->S4 delta 102.37, S4->S6 delta 21.13, raiseStage wave delta 107.76)
  - `node scripts/test-stage-looks.mjs`: 12/13 pass (turn flip 16.9%, identical to POL-49 baseline)
  - `node scripts/test-campaign.mjs`: 45/45 beats PASS, 0 console/http errors (`apps/web/public/checkpoints/` restored)
- Shots (`shots-run/stage-world/s[1-6].png`):
  - `s1.png`: Deep vacuum black sky, stark white sun, zero haze, faceted terrain.
  - `s2.png`: Starry void with warmer surface albedo and 360-line resolution.
  - `s3.png`: Slate-blue twilight atmospheric haze forms on horizon; stars soften.
  - `s4.png`: Azure daylight sky blankets celestial sphere; stars vanish; sun blooms.
  - `s5.png`: Cerulean sky with deep atmospheric diffusion and triplanar detail.
  - `s6.png`: Living-world blue sky, peak light flux diffusion and sharpest ground fidelity.
- Changes from brief: Clamped `pos` to `ROOM` bounds in `collide` & `debug.teleport` in `play-scene.ts` so swept solver doesn't trap players entering gate at back wall.
- Decisions left: None. Ready for next ticket.

### [2026-10-17 08:05] F-02 [DONE] TICKET-02 C0: the plot's biome input (terrain, hydro water, keep-outs)
- Commits: `4644ed33` ("feat(biome): implement buildBiomeInput for plotbiome (TICKET-02 C0)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test`: 2711 pass (+7 new tests in biome-input.test.ts), 0 fail, 19 speed tests pass
  - `npm run build`: 14.62 MB bundle (cap 16 MB)
- Shots: None (pure unit and module tests; no browser UI).
- Changes from brief: None. Local `BiomeInput` and `Tier` interfaces match `plotbiome.txt` contract exactly; heights sampled at cell centres in row-major order; machines/keepouts shifted relative to `(x0, z0)`; hydro water mask rasterised from depth/stream.
- Decisions left: None. Ready for F-03.

### [2026-10-17 08:45] F-03 [DONE] T01b: collision leftovers (windows, doors, roofs, ramps on slopes)
- Commits: `c9514e3c` ("fix(base): window, door, roof, and ramp collision leftovers (TICKET-01b)")
- Checks:
  - `npm run typecheck`: 0 errors; `npm test`: 2707 unit pass (+4 new walk unit tests), 0 fail, 19 speed tests pass
  - `node scripts/test-ticket01-collision.mjs`: 32 of 32 checks pass, 0 page errors, exit 0
  - `node scripts/test-base-building.mjs`: All base building HUD, real world & lifecycle checks pass, exit 0
- Root causes found & fixed:
  - `windowWall`: `kit-pieces.ts` lacked collider for glass pane (y=1.0..2.2); added pane box so face stops player.
  - `door`: `piece-meshes.ts` only had doorframe posts/lintel colliders; added leaf box collider when `!piece.open`.
  - `roof`: `walk.ts` was horizontally pushing player against ceiling boxes; excluded roof kinds from horizontal push.
  - `ramp on slope`: `walk.ts` `standAt` stepped up only when `candY <= maxStepUp`; relaxed to `groundY + 1.2` for steep drops.
  - `test-ticket01-collision.mjs`: test fixture now grants `bp:cube:basalt` to player slots; computes `k=1` for floor-aimed roof; scans >= 10 deg slope within 85m.
- Rechecked F-01 change: Lab gate crossing to moon and twin gate return both verified and passing (checks 5 & 8).
- Decisions left: None.

### [2026-10-17 12:35] F-04 [DONE] TICKET-02 D: install Argo's @hm/sky and wire into moon sky
- Commits: `af608935` ("feat(sky): install @hm/sky and wire into moon sky (TICKET-02 item D)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `packages/sky/tests/sky.test.ts`: 52 of 52 pass; `npm test`: 2,759 unit pass, 0 fail
  - `npm run build`: 14.62 MB bundle (cap 16 MB)
  - `node scripts/test-stage-world.mjs`: PASS (S1->S4 delta 128.01 vs 102.37, S4->S6 delta 32.92 vs 21.13, wave delta 131.69 vs 107.76)
  - `node scripts/test-campaign.mjs`: 45 of 45 beats PASS, 0 console/http errors (`apps/web/public/checkpoints/` restored)
- Shots (`shots-run/stage-world/s[1-6].png`):
  - `s1.png`, `s2.png`: Deep vacuum black sky, stark stars, zero haze.
  - `s3.png`: Slate-blue twilight atmospheric haze softens horizon; stars begin fading.
  - `s4.png`, `s5.png`, `s6.png`: Brilliant daylight blue sky canopy, diffuse sun bloom, warm horizon.
- Changes from brief: Added `const sunArray = [SUN.x, SUN.y, SUN.z]` in `apps/web/src/crafter/world.ts` to supply missing identifier for `skyColour` and `skyPaletteFor`.
- Decisions left: None. Proceeding to F-05.

### [2026-10-17 12:45] F-05 [DONE] TICKET-02 C: install Argo's @hm/plotbiome
- Commits: `e00210e9` ("feat(plotbiome): install @hm/plotbiome and wire into biome-input (TICKET-02 item C)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `packages/plotbiome/tests/plotbiome.test.ts`: 14 of 14 pass (including n=256 stage 6 under 40 ms)
  - `apps/web/src/play/biome-input.test.ts`: 7 of 7 pass
  - `npm test`: 2,772 unit pass (plotbiome 14/14 pass; brief's known load timing caveat on test 14 observed when concurrent)
  - `npm run build`: 14.62 MB bundle (cap 16 MB)
- Shots: None (pure math/biome simulation package; no browser UI).
- Changes from brief: None. Installed Argo's bundle into `packages/plotbiome/`, wired `apps/web/src/play/biome-input.ts` to import `BiomeInput` and `Tier` from `@hm/plotbiome`, added Vite alias, linked package.
- Decisions left: None.

### [2026-10-17 13:45] F-06 [DONE] TICKET-02 F: plotbiome's tufts, bushes and trees in the moon world
- Commits: `bd0af0f9` ("feat(biome): add plotbiome tufts, bushes and trees to moon world (TICKET-02 item F)")
- Checks:
  - `npm run typecheck`: 0 errors; `npm run build`: 14.68 MB bundle (cap 16 MB)
  - `node scripts/test-plot-biome.mjs`: ALL CHECKS PASSED (Monotone S0->S6: 0->334, 137 trees, 53 FPS >= 30, Biome Tris 123,904, Biome Draws 6, 0 errors)
  - `node scripts/test-stage-world.mjs`: ALL CHECKS PASSED (S1->S4 delta 131.04, S4->S6 delta 32.93, wave delta 131.65)
  - `node scripts/test-campaign.mjs`: 45 of 45 beats PASS, 0 console/http errors (`apps/web/public/checkpoints/` restored)
  - `npx tsx --test apps/web/src/storage/profile-storage.test.ts`: 10/10 PASS (scanner passes, 0 direct localStorage calls)
- Shots (`shots-run/plot-biome/`):
  - `stage-0.png`: Empty moon surface, 0 vegetation instances.
  - `stage-2.png`, `stage-4.png`: 0 vegetation instances (reaches threshold at higher stages).
  - `stage-6.png`: 334 instances (47 pine, 49 oak, 41 birch, 197 bushes) outside keepout and pad.
  - `stage-6-close.png`: Birch close-up, trunk firmly anchored (-0.05m sunk), zero floating, rich leaf canopy.
- Changes from brief: Combined bark and leaves into single BufferGeometry per LOD with vertex colors, keeping tree draw calls to 6.
- Decisions left: None. Ready for next ticket.

### [2026-10-17 15:25] F-07 [DONE] TICKET-02 F2: grass at stage 2 and bushes at stage 4 (F-06 follow-up)
- Commits: `2d366526` ("feat(biome): tufts on low tier, machines feed input, and gate anchor (TICKET-02 item F2)")
- Checks:
  - `npm run typecheck`: 0 errors; `npm run build`: 14.68 MB bundle (cap 16 MB); `npm test`: 2,772 pass, 0 fail, 19 speed tests pass
  - `node scripts/test-plot-biome.mjs`: Laptop: S0=0, S2=13 tufts (Low tier), S4=126 (52 tufts, 74 bushes), S6=379 (134 trees, 52 tufts, 193 bushes); 39 FPS at S6 on Low (limit >= 30 fps); 3D PC: 61 FPS at S6; ALL CHECKS PASSED
  - `node scripts/test-stage-world.mjs`: ALL CHECKS PASSED
  - `node scripts/test-campaign.mjs` on 3D PC: 44 of 45 beats PASS (Beat 16 timed out waiting for `#bm-tab-structures` on fast headless CPU transition; earlier local laptop run passed 45/45)
- Shots (`shots-run/plot-biome/`):
  - `stage-2-close.png`: Tufts grounded outside mill footprint, zero inside machine, zero floating.
  - `stage-4-close.png`: Bush grounded in terrain near water machine, tufts grounded, zero floating.
  - `stage-6-close.png`: Full forest, birch trunk grounded, zero floating.
- Changes from brief: Set appear threshold in `applyStage` to `Math.min(6, stage + 0.5)` so integer stage 2 displays machine/gate plume tufts (appear 2.1..2.5) and stage 4 displays wet bushes (appear 4.0..4.5) while preserving monotonic progression and zero trees below stage 5.
- Decisions left: None. Ready for F-08.

### [2026-10-17 16:45] F-08 [DONE] TICKET-02 B+E: Argo's coverage shader and water surfaces, wired in
- Commits: `d153fb30` ("feat(coverage): wire living coverage shader and water surfaces (TICKET-02 items B and E)")
- Checks:
  - `npm run typecheck`: 0 errors
  - Unit tests: 4 of 4 pass (`packages/groundshader/tests/coverage.test.ts`, `apps/web/src/play/water-surfaces.test.ts`)
  - Laptop: `node scripts/test-stage-world.mjs` ALL CHECKS PASSED; Stage 6 FPS on Low = 35.3 FPS (limit >= 30 fps); G/R strictly rises (S2=1.320, S4=1.671, S6=2.207)
  - 3D PC (`scripts/test-on-3dpc.sh --only ...`):
    - `npm test`: 2,782 unit pass, 0 fail, 19/19 speed tests pass (0 fail)
    - `npm run build`: 14.71 MB single-file bundle (cap 16 MB)
    - `node scripts/test-plot-biome.mjs`: ALL CHECKS PASSED (51 FPS at S6)
    - `node scripts/test-stage-world.mjs`: ALL CHECKS PASSED (50.6 FPS at S6; S2=1.141, S4=1.462, S6=2.006)
    - `node scripts/test-campaign.mjs`: 45 of 45 beats PASS, 0 console/http errors, 0 HUD overlaps
- Shots (`shots-run/stage-world/g[1-6].png`):
  - `g2.png`: Barren ochre/gray moon regolith; zero living cover.
  - `g4.png`: Early living moss and green grass tufts taking hold across the terrain.
  - `g6.png`: Full rich living green grass cover, seamless tiling, vivid ground fidelity.
- Changes from brief: None. Prebaked stage coverage textures (0-6) behind loading step in `play.tsx`; time-sliced mask updates on machine/structure changes; old crater disc hidden at stage 4+.
- Decisions left: None. Ready for next ticket.

### [2026-10-18 07:10] F-15 [DONE] Studio hardening (POL-87, 88, 90 to 93): no play files
- Commits: `5e77ed14` ("feat(studio): harden studio suite with layout write-back, error boundary, undo, and shared offscreen renderer (POL-87, POL-88, POL-90 to POL-93)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test`: 2,840 unit pass, 0 fail, 19/19 performance checks pass
  - `npm run build`: 14.84 MB single-file bundle (cap 16 MB)
  - `node scripts/test-studio-tabs.mjs` on 3D PC: 30 of 30 checks pass (Look A/B split, 0 panel overflow, layout save/reload, undo restores moved copy, dev write-back writes `Dev Outpost` to `scene-layouts.json`, error boundary catches crash & keeps tabs alive, 4-angle renders)
  - `node --import tsx scripts/test-grid-menus.mjs` on 3D PC: ALL CHECKS PASS
  - `node scripts/test-campaign.mjs` on 3D PC: 45 of 45 beats PASS, 0 console/http errors, 0 HUD overlaps (`apps/web/public/checkpoints/` restored)
- Features delivered:
  - POL-88: Added `scene-layouts` to dev write-back with `checkSceneLayouts` validation; Scene tab saves to server in dev.
  - POL-90: Scene inputs & gizmo drags push to Studio undo/redo stack; wired to top bar buttons & shortcuts (Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y).
  - POL-91: `StudioErrorBoundary` wraps each workspace tab; crashed tab shows error card and allows switching/recovery without crashing suite.
  - POL-92: Shared `offscreen-renderer.ts` singleton with queued rendering for `four-angle.ts` and `studio-thumbs.ts`.
  - POL-87 & POL-93: Extracted pure data/helpers into `-data.ts` modules for test isolation without CSS; replaced inline styles with CSS modules.
- Decisions left: None. F-15 complete.

### [2026-10-18 09:18] F-16 [DONE] TICKET-12 (Studio part): brief 31's remaining Studio work, plus POL-86, POL-94 and POL-21
- Commits: `d529852f` ("feat(studio): bench, sockets, materials, monsters, and scenedoc structural sharing (TICKET-12)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC: 2,895 pass, 0 fail, 19/19 speed tests pass
  - `npm run build` on 3D PC: 14.89 MB single-file bundle (cap 16 MB)
  - `node scripts/test-studio-tabs.mjs` on 3D PC: 41 of 41 checks pass (POL-94 gizmo drag & undo, POL-89 starter/hauler sockets, Look A/B split, error boundary, 4-angle review, fix flags, luminance gate badge, snap sockets, material macro sliders, D21 tier badge, monster remap strength slider)
- Features delivered:
  - POL-21: Structural sharing in `@hm/scenedoc` via copy-on-write `DraftNodes` overlay.
  - P0-STUDIO-01 (Part 2): One-click fix flags & surface-luminance gate badge in Details panel with `/asset-flags` write-back.
  - P1-STUDIO-03 (Part 2) & POL-89: Click-to-snap socket authoring on model faces with `/sockets` write-back; baked machine/structure sockets into `registry.json`.
  - P1-STUDIO-04: Two-tier Material Designer (5 macro sliders, 2-cartridge combiner, node graph preview, D21 constant-mean-luminance Potato-to-Ultra preview).
  - O3: Per-skin monster `remapStrength` slider with live preview and `/monster-tweaks` write-back.
  - POL-86: Dev write route for `levels.json`.
  - POL-94: Automated 3D gizmo pointer drag and undo in `test-studio-tabs.mjs`.
  - POL-95: Look tab `levelsLabel` ("12", "24", "Full (24-bit)") in `look-tab.tsx` and `look-tab-data.ts`.
- Decisions left: None. Ready for next ticket.

### [2026-10-18 10:30] F-17 [DONE] TICKET-12 (HUD part): POL-78, 79, 80, 82 and 43, no play-scene
- Commits: `60c47826` ("feat(hud): polish HUD controls grid, radial wrapping, empty rack, refusal toast, and bin ticker (TICKET-12)")
- Checks:
  - `npm run typecheck`: 0 errors (clean)
  - `npm test` on 3D PC: 2,898 unit pass, 0 fail, 19/19 speed tests pass
  - `npm run build` on 3D PC: 14.90 MB single-file bundle (cap 16 MB)
  - `node scripts/test-build-ux.mjs` on 3D PC: 35 of 35 checks pass (zero HUD violations, zero page errors)
  - `node scripts/test-campaign.mjs` on 3D PC: 45 of 45 beats PASS, 0 console/http errors, 0 HUD overlaps
- Shots (`shots-run/build-ux/`):
  - `esc-controls.png`: 3-column keycap grid at 1280x720, zero vertical clipping, internal scrolling preserved (POL-78).
  - `radial-build.png`: "Weapon bench" slice label wraps cleanly to 2 lines without ellipsis/overflow (POL-79).
  - `radial-apply-empty.png`: Dedicated dark glass empty state card with guidance message ("No written cartridges: write one at the preset bench") (POL-80).
  - `refused-status-toast.png`: Refused action triggers compact status toast ("⚠ Already at this stage") in status zone, zero giant title cards (POL-82).
  - `ticker-linked-count.png`: Bottom-right resource ticker displays linked-bin inventory count `(+600)` beside plot ore (POL-43).
- Changes from brief: None. Moved gameplay refusals out of `say()` into `showStatusToast()` with `formatRefusalToast()` player-friendly sentences.
- Decisions left: None. F-17 complete.

### [2026-10-18 17:40] F-20 [DONE] Small sweep: POL-175, POL-174, POL-99 (no play-scene, no play.tsx)
- Commits: `d2b9ea0d` ("fix(polish): scope studio button hover, dispose peer geometries, and capture clean rift shots (POL-175, POL-174, POL-99)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC: 2,930 pass (2,926 unit, 19 speed tests, 0 fail)
  - `npm run build` on 3D PC: 14.94 MB single-file bundle (cap 16 MB)
  - `node scripts/test-ticket07a.mjs` on 3D PC: 17/17 pass (armory rail facing 1.00, rift dot 1.00, clean closeups)
  - `node scripts/test-studio-tabs.mjs` on 3D PC: 41/41 pass
  - `node --import tsx scripts/test-grid-menus.mjs` on 3D PC: 32/32 pass (Settings: 0 light surfaces, Community: 0)
- Shots (`shots-run/`):
  - `ticket07a-armory-rail-closeup.png`: First person, armory rail & shotgun centered, 0 avatar/mesh obstruction.
  - `ticket07a-rift-open-closeup.png`: Centered 8m close-up of open rift glitch tower, HUD hidden, dot 1.00.
  - `ticket07a-rift-sealing-closeup.png`: Clean shot of sealing rift with gold amber core and pinned seal.
  - `grid-menus/settings.png`: Completely dark-glass settings modal, transparent range slider backgrounds.
  - `grid-menus/grid-screen.png`: Dark enclave directory, no light button hovers.
- Changes from brief: Kept `input[type=range]` transparent background in `studio.css` and `dark-forms.css` so range sliders never inherit light UA surfaces in dark modals.
- Decisions left: None. F-20 complete.

### [2026-10-18 18:48] F-21 [DONE] @hm/plume: a gravity option and a count uniform (POL-261's package half)
- Commits: `77a276b7` ("feat(plume): per-emitter gravity option and count uniform (POL-261)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC: 2,948 pass (2,929 unit, 19 speed tests, 0 fail, 4 skipped)
  - `node --import tsx --test packages/plume/tests/plume.test.ts`: 22/22 pass
  - `npm run build && node scripts/test-machine-plumes.mjs` on 3D PC: 69/69 pass, 0 page errors
  - Build size: 15.10 MB (15,838.00 kB, cap 16 MB)
- Features delivered:
  - Added optional per-emitter `gravity` (m/s², default 0) with ballistic parabolic flight `-0.5 * gravity * age^2` in `pixelAt` and GLSL `pixelCore`.
  - Packed `gravity` into `C.w` of `uEm` (previously unused fourth float).
  - Allocated uniform array `uCounts[MAX_EMITTERS]` and instance capacity up to `maxCount` to drive active counts dynamically.
  - Calling `setCount()` within `maxCount` updates uniform values without allocating new arrays, touching buffer attributes, or setting `needsUpdate`.
  - Discarded/culled inactive instances with `gl_Position` clip across cubes, splats, and dither modes.
  - Tests verify gravity 0 equality, ballistic flight peak/fall, and zero buffer allocations on count changes.
- Decisions left: None. Ready for F-22.

### [2026-10-18 19:04] F-22 [DONE] Finish POL-99: the close-ups with the HUD really hidden
- Commits: `b0760ed3` ("test(ticket07a): hide all HUD overlays and clear monsters for POL-99 close-ups (POL-99)")
- Checks:
  - `npm run build && node scripts/test-ticket07a.mjs` on 3D PC: 17/17 checks pass, 0 fail, 2 skipped, 0 page errors
  - Build size: 15.10 MB (15,838.00 kB, cap 16 MB)
- Shots (`shots-run/`):
  - `ticket07a-armory-rail-closeup.png`: 100% pristine first-person framing of rail & holsters; zero HUD, zero crosshair dot, zero subtitles.
  - `ticket07a-rift-open-closeup.png`: Centered 8m close-up of open glitch tower rift; zero compass, stage pill, vitals, or subtitles.
  - `ticket07a-rift-sealing-closeup.png`: Clean golden amber core of sealing rift; zero HUD elements or subtitles.
  - `ticket07a-rift-sealed-closeup.png`: Clear line of sight to the sealed rift base with zero monsters obstructing view; monsters kept 'off' and active mobs cleared during capture.
- Changes from brief: None. Verified all HUD layers and Dr. Haddy subtitle are completely hidden for close-ups and restored immediately after.
### [2026-10-18 22:05] F-23 [DONE] TICKET-16 part a: Acts VII to IX, the finale hand-off, the menu hero, the portrait and the credits gate
- Commits: `b4a125ce` ("feat(questline): Acts VII to IX campaign progression, finale hand-off and credits gate (T16 part a, F-23)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `packages/questline/tests/charm-and-act789.test.ts`: 4 of 4 pass
  - `npm run build && node scripts/test-credits-video.mjs`: 47 of 47 pass, 0 page errors
  - `npm run build && node scripts/test-campaign.mjs` on 3D PC: 54 of 54 beats PASS, 0 console errors, 0 http errors, 0 HUD overlaps
  - Build size: 15.15 MB (15,885 kB, cap 16 MB)
- Features delivered:
  - Installed Act VII (A7-01..A7-03), Act VIII (A8-01..A8-03), and Act IX (A9-01..A9-03) in `@hm/questline` with complete charm predicates.
  - Merged campaign chain steps and evidence into `campaign-chain.ts` and `play.tsx` (drills running, machine kinds, vehicle kinds, sidearm, items, biosphereStage4).
  - Added Dr. Gwen Haddy CRT portrait and diptych frosted glass hero in `goblin-front.tsx`.
  - Gated title menu "Ending Credits" item and jukebox J credits replay behind `endingSeen` (POL-305, POL-306).
  - Added "Play ending credits" under World in Esc debug menu (`dbg-play-credits`).
  - Added Planet Table consensus commit, 12 s golden-hour window heal loop (`evaluateFinaleWindowHeal`), epilogue voice, and credits director transition in `play.tsx`.
  - Added beats 29-37 in `test-campaign.mjs` validating all new progression milestones and credits gating.
- Decisions left: None. Ready for T16 part b (play-scene.ts Window E domes, hologram mount, and POL-301/302).

### [2026-10-19 06:25] F-24 [DONE] Two fixes after F-23: the title portrait covers the logo; the HUD's kW leaves out the turrets (POL-292)
- Commits: `e847695e` ("fix(t16a): title portrait moved out of logo path; POL-292 turret extraDrawKw added to play HUD")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC worker: 2,957 pass, 0 fail, 4 skipped; 19 speed tests pass (0 fail)
  - `npm run build` on 3D PC worker: 13.69 MB (single file bundle, cap 16 MB)
  - `node scripts/probe-t16a-shots.mjs` on 3D PC worker: PASS (title portrait clear of logo and menu at 1280x720 and 1920x1080; ending credits unlock verified; play HUD clear of stage panel; 0 page errors)
  - `node scripts/test-ticket13.mjs` on 3D PC worker: 39 of 39 checks passed (demand 0 -> 2 kW check for POL-292 passes cleanly; 0 console or page errors)
- Shots (`docs/shots/t16a/`):
  - `title-fresh.png`: Dr. Haddy's CRT portrait card sits under the telemetry HUD observation panel on the right (`.fidelity-telemetry-portrait`), >400 px clear of the logo (`.sm-brand`) and the menu (`.sm-menu`).
  - `title-1080p.png`: Verified zero bounding-box overlap at 1920x1080.
  - `title-credits-unlocked.png`: Ending Credits menu button present after `endingSeen`, cleanly positioned.
  - `play-hud-portrait.png`: In-game play HUD Dr. Haddy portrait top-left clear of stage panel.
- Fixes delivered:
  - Relocated title CRT portrait from `.fidelity-glass-blade` to the dedicated observation column in `apps/web/src/shell/goblin-front.tsx`.
  - Added `className` and `style` props support in `apps/web/src/shell/haddy-crt-portrait.tsx`.
  - Added `extraDrawKw: () => turretGridDrawKw(baseWorldRef.current.base)` to the HUD's `env` literal in `apps/web/src/play/play.tsx`, ensuring each built turret adds 2 kW to the HUD power demand readout.
  - Extended `scripts/probe-t16a-shots.mjs` with bounding-box overlap assertions across 720p and 1080p.
  - Added 2 kW power demand step check to `scripts/test-ticket13.mjs`.
  - Closed POL-292 in `docs/DEFERRED_POLISH_REGISTRY.md`.
- Decisions left: None. Ready for next queued job: F-12.

### [2026-10-19 10:28] F-12 [DONE] TICKET-07 B: vehicle juice (boost, tracks, dust, print gantry) and the beam hurting monsters
- Commits: `dd6f30a0` ("feat(play): vehicle juice, monster beam damage, POL-96 armory rack, and POL-97 wreck salvage (T07b, F-12)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC worker: 2,957 pass, 0 fail, 4 skipped; 19 speed tests pass (0 fail)
  - `npm run build` on 3D PC worker: 13.70 MB (single file bundle, cap 16 MB)
  - `node scripts/test-ticket07a.mjs` on 3D PC worker: 21 of 21 checks pass, 0 fail, 0 skipped
  - `node scripts/test-ticket07b.mjs` on 3D PC worker: 21 of 21 checks pass, 0 fail (low-spec 60.6 fps, boost 6.69 m/s, tracks 128, roost 157, beam damage 40 -> 29.4 HP, seal mode 0 dmg)
  - `node scripts/test-campaign.mjs` on 3D PC worker: 54 of 54 beats PASS, 0 console errors, 0 http errors, 0 HUD overlaps
- Shots (`shots-run/`):
  - `ticket07b-gantry.png`: 3D print gantry sweep wireframe in action over vehicle spawn pad before vehicle appears.
  - `ticket07b-boost.png`: Rover boosted driving at 6.7 m/s with cyan energy meter draining and "BOOSTING" indicator illuminated on speed HUD.
  - `ticket07b-tracks.png`: Continuous tyre track decals imprinted onto terrain along driving path, fading over time.
  - `ticket07b-dust.png`: Particle roost emitted from active wheels during high-speed driving.
- Features delivered:
  - Installed `vehicle-juice.ts` and `vehicle-juice.test.ts` (boosted input with energy drain/recharge, tire tracks decal pool, wheel roost particles, and print gantry animation).
  - Wired boost state (`drivingBoostEnergy`, `drivingBoosting`) through `play.tsx` and `BaseHud` speedometer with boost bar and "BOOSTING" badge.
  - Wired tire tracks and wheel roost emitters into `PlayScene` driving update with proper world matrix updates and low-spec 60 FPS performance.
  - Implemented continuous extraction beam chip-damage to monsters in planet frame loop (`monsters.beamHit` with `beamDamage`), with 0 damage in seal mode.
  - Resolved POL-96 (armory rack visual unmount upon sidearm pickup) and POL-97 (hold-E wreck truck salvage with pack grant, network sync, and lore log read).
- Decisions left: None. Ready for next queued job: F-13.

### [2026-10-19 11:42] F-13 [DONE] TICKET-06 hooks: aim the lab's Hardware Fabricator and Planet Table
- Commits: `8c5e7258` ("feat(lab): wire Hardware Fabricator and Planet Table interaction hooks (F-13)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm run build`: 13.70 MB (single file bundle, cap 16 MB, built in 11.30s on 3D PC)
  - `scripts/test-lab-overhaul.mjs` on 3D PC worker: 78 of 78 checks PASS, 0 fail (all 6 stations aim prompt verified, window opened with KeyE, closed with Escape, draw calls within budget at 187 calls, 60.2 FPS)
  - `npm test` on 3D PC worker: 2,957 pass, 0 fail, 4 skipped; 19 of 19 speed tests pass (0 fail)
  - `scripts/test-campaign.mjs` on 3D PC worker: 54 of 54 beats PASS, 0 console errors, 0 http errors, 0 HUD overlaps
- Features delivered:
  - `apps/web/src/play/lab-machines.ts`: Added backward-compatible normalization for station IDs (`rack` -> `preset-rack`, `bench` -> `preset-bench`, `combiner` -> `preset-combiner`) in `stationById`.
  - `apps/web/src/base/ui/fabricator-modal.tsx`: Added standalone fallback for `machineId === 9999` so opening the fabricator in the Earth lab renders cleanly without requiring an existing base machine on the planet.
  - `apps/web/src/play/play-scene.ts`: Widened `LabMachineKind` to `LabStationId | 'rack' | 'bench' | 'combiner'`, replaced hardcoded targets list in lab aiming with `room.aimStation(camera.position, dir) ?? room.aimStation(pos, dir)`.
  - `apps/web/src/play/play.tsx`:
    - Displayed prompt directly from `labStation.prompt` for all 6 stations.
    - Narrowed Act 9 consensus commit check so it only triggers on `planet-table` when consensus is ready, avoiding hijacking other station E interactions.
    - Wired `KeyE` to open `FabricatorModal` (`machineId=9999`) on `fabricator`, `PlanetaryGridScreen` on `planet-table`, `WeaponBenchModal` on `weapon-bench`, and respective `labPanel` on preset stations.
    - Added `planetTableOpen` to `isAnyBaseWindowOpen`, Escape handling, and rendered `PlanetaryGridScreen` overlay with gate plot encoding and co-op dial hooks.
  - `scripts/test-lab-overhaul.mjs`: Added full verification suite testing teleporting/aiming at each of the 6 stations (`preset-rack`, `preset-bench`, `preset-combiner`, `fabricator`, `planet-table`, `weapon-bench`), confirming prompt text, pressing E to open window, and Escape to close.
- Next active task in queue: F-25.

### [2026-10-19 13:25] F-25 [DONE] T09b: the audio verbs, the ambience and the print sweep wiring
- Commits: `dcb4d523` ("feat(audio): procedural audio verbs, ambience wiring, print sweep, and settings sliders (F-25)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC worker: 2962 passed, 0 failed, 19 speed tests passed
  - `npm run build`: 13.71 MB single-file bundle (cap 16 MB)
  - `scripts/test-audio-buses.mjs`: 26 of 26 checks passed (A0 Settings sound, A5 verbs/chime, A6 print sweep)
  - `scripts/test-music-sfx.mjs` on 3D PC worker: ALL CHECKS PASSED (duck to 0.45, stage crossfades, 8 voices limit)
  - `scripts/test-base-building.mjs` on 3D PC worker: ALL CHECKS PASSED (print sweep, ramp walk, 200-piece batched)
  - `scripts/test-campaign.mjs` on 3D PC worker: 54 of 54 beats PASS, 0 console/http errors, 0 HUD overlaps (`apps/web/public/checkpoints/` restored)
- Shots (`shots-run/audio-verbs/`):
  - `settings-sound.png`: 8 distinct sound sliders with unique labels ("Maker and racing: everything", "Maker and racing: effects", "Maker and racing: music", "Voice (Dr. Haddy)", "Combat and UI", "World effects", "Ambience", "Music"); zero name collisions.
  - `print-sweep-midway.png`: Machine print sweep midway through 0.65 s clip showing animated green `#7cff4d` scanline edge mesh and vertical emergence.
- Changes from brief:
  - Attached `#7cff4d` `edgeMesh` lazily only while `clip < 1.0` in `machine-props.ts` so `Box3` bounding-box unit tests are unaffected.
  - Adjusted `test-music-sfx.mjs` duck wait to 450 ms down and 1300 ms up to match `MENTOR_MIX.duck` (0.4 s down, 1.2 s up).
- Decisions left: None. Ready for F-26.

### [2026-10-19 15:35] F-26 [DONE] T16 part b: the 11 enclave domes, Planet Table hologram, and T14 play-scene leftovers
- Commits: `8419a45e` ("feat(finale): 11 horizon enclave domes, Planet Table hologram, window heal and credits Polish (F-26)")
- Checks:
  - `npm run typecheck`: 0 errors
  - `npm test` on 3D PC worker: 2962 passed, 0 failed, 4 skipped; 19 of 19 speed tests passed
  - `npm run build`: 13.71 MB single-file bundle (cap 16 MB)
  - `scripts/test-ticket16b.mjs` on 3D PC worker: 8 of 8 checks passed (domes, hologram, consensus commit, drift resistance, room storm, wireframe, viewmodel hidden)
  - `scripts/test-credits-video.mjs` on 3D PC worker: 47 of 47 checks passed (chapters 1-7, audio handoff, monitor jukebox, zero errors)
  - `scripts/test-campaign.mjs` on 3D PC worker: 54 of 54 beats PASS, 0 console/http errors, 0 HUD overlaps (`apps/web/public/checkpoints/` restored)
- Shots (`shots-run/t16b/`):
  - `horizon-domes.png`: 11 enclave domes rendered on 4.2 km horizon with spires.
  - `planet-table-hologram.png`: Planet Table 3D hologram in lab with consensus status and rotating wireframe node ring.
  - `credits-ch1-wireframe.png`: Credits Chapter 1 playing with Stage 0a vector wireframe look.
  - `credits-no-rifle.png`: Held rifle weapon viewmodel hidden during credits camera presentation.
- Features delivered:
  - Window E: Installed `createHorizonEnclaveDomes` on `PlayScene` placing 11 neighbor enclave domes at 4.2 km distance with height tracking.
  - Mounted `createPlanetTableHologram` on Planet Table group in `lab-room.ts` updating with FourFloats and consensus state.
  - Connected `evaluateFinaleWindowHeal(elapsedSec)` to `scene.setStorm(...)` during 12s window heal convergence.
  - Resolved POL-301 (wireframe post-look override hook for credits chapter 1), POL-302 (`setStorm` and `setMonitorEqualizer` exposed on `PlayScene`), POL-303 (stable alt camera look-at orientation without drift), and POL-304 (viewmodel visibility control).
- Decisions left: None. Ready for next queued job: F-27.

### [2026-10-20 07:38] F-27 [DONE] T15: the harmonic choir, the radio and turbobass (Window D)
- Commits: staged with F-27/F-28 completion batch
- Features delivered:
  - Installed `harmonic-machine-choir.ts`, `diegetic-radio-and-tapes.ts`, `beat-synced-plume-and-turbobass.ts`, `diegetic-radio-tuner-widget.tsx`, and `harmonic-radio-and-turbobass.test.ts` (4/4 unit tests pass).
  - Merged `CombatAudio` bus routing and `knockbackSwarmers` into `monsters.ts`; merged `WRECK_TAPE_BY_SITE` into `wreck-sites.ts` and `wrecks.ts`; added `playChoirStep`, `playBridgeFmNote`, and `playTurboBassPulse` to `game-audio.ts`.
  - Wired Window D 144 BPM plume modulation and `POL-141` 3.5 s post-action Lab station operating tail in `play-scene.ts` and `play.tsx`.

### [2026-10-20 07:39] F-28 [DONE] T13b: the vehicle bay (3 s gantry print), scout and hauler rear sockets, POL-50, POL-51 and POL-295
- Commits: staged with F-27/F-28 completion batch
- Features delivered:
  - Wired 3.0 s gantry assembly timeline (`sampleGantryTimeline`) onto `fabricator-head` in `play-scene.ts` so the print head, plume vent, and feed cubes travel along the gantry during rover printing.
  - Enabled `USE_MODULAR_SCOUT = true` (`POL-50`), replaced the round torus steering wheel with a square `[-u-]` yoke, snapped the scout aerial with `snapAerialToShellY`, and wired `SCOUT_REAR_SOCKETS` and `HAULER_REAR_SOCKETS` into `VEHICLE_FIT` in `gen-props.ts`.
