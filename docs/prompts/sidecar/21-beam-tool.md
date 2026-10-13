# TASK-21: the beam tool (extract, apply cartridges, sculpt), held like a rifle

After TASK-20. The owner: the Extraction Beam is the player's handheld tool. It mines; it applies cartridges (textures and presets) onto things in the field; it deforms the terrain (carve, add, sculpt). "if we make it the shape of a rifle we can use the mixamo rifle animations". And: "tools and machines, everythign hooked up pls".

## First: three TASK-20 follow-ups (Opus's review, 13 October)
- **F1** The `DRAWS n (PIECES)` badge (`hm-draw-calls-badge` in `play.tsx`) shows on the planet for every player. It is a debug readout. Show it only when a new Graphics setting **Show performance stats** is on (off by default; on under `?e2e`), styled with the other settings.
- **F2** Delete `apps/web/src/base/mock-view.ts`, now unused (check nothing imports it).
- **F3** Add tests for what TASK-20 wired but nothing exercises:
  - the Heavy tab (aim at a hardpoint, press, the machine picker opens);
  - the Plans tab (save a layout, place it);
  - E on a bin opening the lattice;
  - deleting a profile clearing its base save (a unit test).

## The pieces (all landed)
- **`@hm/beamkit`:** `extractionBeam(materials, {stage})` builds the rifle-shaped prop. Its sockets are grip, foregrip, shoulder, muzzle, cartridge and screen, with `setMode`, `setCartridge`, `setCharge` and `setFiring`. `beamEffect()` (already drawn in `play-scene.ts`) is the one-draw-call beam.
- **`@hm/terrainbrush`:** carve, raise, smooth, flatten, paint and erase on a delta heightfield plus a paint layer.
  - Carving yields ore; raising and filling cost ore.
  - Protected cells, undo patches, `encodeField`/`decodeField`.
- **`@hm/cartlab`:** the cartridges (the lab's rack).
- **The rifle clips:** 11 Mixamo FBX in `zips/Models/rigged/anims/rifle/`: rifle-idle, rifle-aiming-idle, firing-rifle, rifle-walk, rifle-run, backwards-rifle-walk, strafe-left, strafe-right, rifle-pull-out, rifle-put-away and reloading.
  - They use the mixamorig skeleton, the same as the Astro player (`apps/web/src/avatar/astro`).
  - Pack them with `scripts/pack-anims.mjs` (In Place, 30 fps) into the anims binary, or a second one. At most 150 KB more.
  - The animator is `apps/web/src/avatar/scientist/animator.ts`.

## Build
1. **Carrying it.**
   - It starts racked on the lab wall. TASK-22's Act IV step "pick up the extraction rifle" takes it. Until then, the TASK-11 hold-E gathering at boulders is the way to get ore.
   - Key 1 equips it (rifle-pull-out) or puts it away (rifle-put-away). While it is out, the player uses the rifle clips.
   - In first person, a view model of the prop sits right of centre, held at the grip and foregrip sockets. In third person it is in the hands.
   - In the lab it stays racked.
2. **Modes:** the wheel or Q cycles Extract, Apply and Sculpt. The prop's screen and the HUD show the mode. Hold the left mouse button to fire, out to 25 m; the beam runs from the muzzle socket.
3. **Extract.** It feeds the base world's existing beam harvest (`BEAM_RANGE`, the field nodes) and the boulders, about 4 ore a second (more on rock and scree). Boulders shrink as TASK-11 made them.
4. **Apply.**
   - R reloads (the reloading clip) with a written cartridge from the lab's rack. On the planet the beam carries one loaded cartridge, shown in its port.
   - Firing paints the cartridge's preset at the aim point (terrainbrush `paint`, radius 3 m). The ground shader shows painted cells in the preset's colour and roughness: add a paint texture to the plot ground that coverage and water can share later.
   - Applying costs no ore.
5. **Sculpt.**
   - Sub-modes on 1, 2 and 3 while in Sculpt: Carve (gains ore), Raise (costs ore) and Smooth.
   - Only the touched ground chunks rebuild (`plot-ground.ts`), spread over frames if needed.
   - Protected: the gate pad, every machine and piece footprint, and the plot edge.
   - Placed pieces re-check their support after a carve (`@hm/structure` integrity).
6. **Saving.** The field (`encodeField`) and the loaded cartridge save with the profile, and survive a reload.

## Tests
- **Unit:** the mode cycle, and a stroke's ore bookkeeping (gained, spent, never below zero).
- **Extend `scripts/test-campaign.mjs`:**
  1. pick up the beam in the lab;
  2. equip it (rifle-idle playing);
  3. extract at a boulder (ore rises);
  4. load a cartridge and paint (cells painted);
  5. carve (the ground drops, ore rises), then raise (ore falls);
  6. reload the page (the edits stay);
  7. check the gate pad is untouched.
- **Shots** of each mode in first and third person, without overlays.
- **The usual green set:** typecheck, test, build, e2e, test-base-building, test-campaign.

## Report
On the board:
- what changed;
- the pack size;
- fps with the beam firing in each mode;
- the test results;
- the shots.

## TASK-21d additions from Argo's master plan (owner-approved 13 October; see docs/argo/plans/ARGO_MASTER_PLAN.md and Opus's review)
- **P0-VFX-01:**
  - a projected ring decal at the aim point showing the brush radius, coloured by mode (Extract #3dc8ff, Apply #ff3d8a, Sculpt #7cff4d, Seal #ffc13d);
  - in Extract, an instanced stream of 16 dark chunks spiralling from the hit point into the muzzle;
  - the first-person rifle sways on look, bobs on walk and vibrates while firing, through `@hm/tooljuice`'s damped spring.
- **P0-LIGHT-01 (the rest):** a view-aligned rim term and a hemisphere floor for the player and the view model in stages 0 to 2, so they never merge into the dark ground. The metal cap from 21c stays.
- **The mode rib (P0-VEH-02 as Argo ruled on O2):** a square emissive strip along the rifle's top rail, glowing in the mode's colour:
  - Extract #3dc8ff;
  - Apply #ff3d8a;
  - Sculpt #7cff4d;
  - Seal #ffc13d, shown while Extract is held on a leak (sealing is not a fourth mode to cycle).
  
  The rifle stays real size in first person. In third person keep 1.0x; go up to 1.10x only if the shots show it reading small after the lighting fix, and never past 1.15x.
