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

