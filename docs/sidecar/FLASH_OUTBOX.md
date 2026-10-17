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

