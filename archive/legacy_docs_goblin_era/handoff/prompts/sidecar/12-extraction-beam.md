# Sidecar task 12: the Extraction Beam, the player's handheld tool (extract, apply cartridges, sculpt)

The owner (2026-10-08), through you: the Extraction Beam is the player's handheld tool. It must let the player use and test cartridges on things in the field (apply textures from cartridges), deform the terrain directly (carve, add, sculpt), and mine. It is front and centre of the loop, so cartridges are not only slotted into buildings. Then: "if we make it the shape of a rifle we can use the mixamo rifle animations". The design notes agree (`docs/SETMIX_GAME_CONCEPT.md`, `docs/HOTBAR.md`: the early game uses the Extraction Beam; Act III adds the full Sculpt and Paint tools).

**Do this after TASK-11 and the rest of TASK-08, before TASK-05.** It waits for two Arena modules (below); Claude marks it QUEUED on the board when they land. Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check.

## The pieces
- **`@hm/terrainbrush`** (Arena, landing): carve, raise, smooth, flatten, paint and erase on a delta heightfield plus a paint layer. Carving yields ore; raising and filling cost ore. Protected cells, undo patches, compact encoding.
- **`@hm/beamkit`** (Arena, landing): the rifle-shaped beam prop (sockets: grip, foregrip, shoulder, muzzle, cartridge, screen; `setMode`, `setCartridge`, `setCharge`, `setFiring`) and the one-draw-call beam effect.
- **The rifle clips:** 11 Mixamo clips for the scientist's rig, in `zips/Models/rigged/anims/rifle/`. All were checked standing:
  - rifle-idle, rifle-aiming-idle, firing-rifle;
  - rifle-walk, rifle-run, backwards-rifle-walk, strafe-left, strafe-right;
  - rifle-pull-out, rifle-put-away, reloading.

  Pack them with `scripts/pack-anims.mjs` into the same binary (or a second one). Budget for the pack: at most 150 KB more.
- **What it uses:** the cartridges from `@hm/cartlab` (TASK-04's rack), the plot ground (`apps/web/src/play/plot-ground.ts`, which builds chunks from the terrain's height), the coverage and hydro grids (TASK-05, if they are in by then), and the scientist's animator (TASK-07).

## Build
1. **Carrying it.**
   - 1 equips the beam (rifle-pull-out) or puts it away (rifle-put-away).
   - While it is out, the scientist uses the rifle clips: idle, aiming idle, walk, run, the strafes, backwards, firing. In first person a view model of the beam sits in the right of the view, held by the grip and foregrip sockets.
   - The beam works only on the planet; in the lab it is racked on the wall.
2. **Modes:** the mouse wheel or Q cycles Extract, Apply and Sculpt. The beam's screen shows the mode and the HUD shows it too. Hold the left mouse button to fire. The beam effect runs from the muzzle to the point aimed at, within 25 m.
3. **Extract.** Aimed at a boulder or rocky ground, ore streams into the beam: 4 ore a second, more on rock and scree. Boulders shrink and crumble as TASK-11 made them.
   - This becomes the main way to gather by hand. TASK-11's hold-E-to-gather can stay as the fallback with the beam away.
   - The quest's "Feed your mill" hint says: "Hold the beam on a boulder to extract ore, or build a rock drill."
4. **Apply (cartridges in the field).**
   - R reloads (the reloading clip): it takes a written cartridge from the rack. The rack lives in the lab; on the planet, the beam carries one loaded cartridge.
   - Firing paints the cartridge's preset onto the ground at the aim point with terrainbrush `paint`, at radius 3 m. The ground shader shows painted cells in the preset's material colour and roughness. This is the same overlay path as the coverage layer (TASK-05); if TASK-05 is not in yet, add the paint texture now and let TASK-05 share it.
   - Applying uses no ore. A cartridge stays loaded until swapped.
5. **Sculpt.**
   - Sub-modes on 1, 2 and 3 while in sculpt: Carve (dig, gain ore), Raise (build, costs ore), Smooth.
   - The ground chunks under the brush rebuild their heights from the delta field within the frame budget. Rebuild only the touched chunks, and spread the work over frames if needed.
   - Protected: the gate pad and every machine's footprint. The plot's edge is never carved below the max depth.
   - Coverage and water read the new heights if TASK-05 is in.
6. **Saving.** The delta and paint field is saved per profile through the big store (`terrainbrush.encodeField`), with the loaded cartridge. A plot code visit (TASK-06) shows the owner's edits if the code has room; otherwise log it in DEFERRED_POLISH.
7. **Tests:**
   - Unit: the mode cycling and the ore bookkeeping of a stroke (gained, spent, never below zero).
   - e2e, through debug hooks:
     1. Equip the beam (the rifle idle plays in third person).
     2. Extract at a boulder (ore rises).
     3. Load a cartridge and paint (the painted cells exist).
     4. Carve (the ground under the aim drops and ore rises), then raise (it costs ore).
     5. Reload the page and check the edits persist.
     6. Check the gate pad is untouched.

## Report back
What changed, the rifle pack's size, fps on Low with the beam firing in each mode, verify and e2e results, and screenshots of each mode in first and third person (no overlays).
