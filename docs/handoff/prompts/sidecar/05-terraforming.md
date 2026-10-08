# Sidecar task 05: water, ground cover and trees on the plot as the stages rise

Do this after TASK-06, or after TASK-04 if 06 is blocked. Pull `main` first. Work on `main` and push there (no PRs), in two pushes: **05a** (water and ground cover) and then **05b** (trees). Before each push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check. Log rough spots in `docs/DEFERRED_POLISH.md`. Do not tune frame rates: log them.

## Why
The owner (`docs/SETMIX_PLAN.md` section 3, answer 6): stage 1 is "a real, natural desolate place ... the stages raise the resolution of the same natural world, and terraforming adds water, the coverage layer and the forest." The three rule modules are landed and tested; this task puts them on the plot.

## The modules (read each API first)
- **`@hm/hydro`** (`packages/hydro`): `flood(terrain, sources, volume)` returns the water depth and level per cell, streams, wetness, the volume held in lakes and the volume drained.
- **`@hm/coverage`** (`packages/coverage`): five layers (dust, moss, grass, leaves, vines) creep from seeds as `OPENS` allows by stage. `step(state, env, dt)` advances them; `bake(state, layer)` gives one byte per cell for a texture.
- **`@hm/treegen`** (`packages/treegen`): `growTree({ species, seed, height, detail })` gives bark and leaf geometry. It is one skeleton at four details, so detail is the level of detail (LOD). Detail 0 is the chunky, flat-shaded stage-1 look.

Add all three to the `tsconfig.json` paths and the `apps/web/vite.config.ts` aliases, as `@hm/plotsim` is.

## Where things are
- **The ground:** `apps/web/src/play/plot-ground.ts`.
  - `ground.heightAt(x, z)`.
  - `ground.terrain.materials(x, z)` gives the weights of `['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil']`.
  - The ground shader is `@hm/groundshader` (`packages/groundshader`).
- **The plot** is 1 km across, centred on the planet gate at (0, 0). The plot state (`@hm/plotsim`) has the machines, `stage` and `points` (metric `aq` is water).
- **The scene:** `apps/web/src/play/play-scene.ts`. Its stage changes run through `raiseStage`, and `setPlot` is called every frame. `warm()` compiles behind the loading bar.

## 05a: water and ground cover
1. **One grid over the plot.** Size 128, or 64 on the potato tier, with cell = 1000 / size metres. For each cell:
   - `heights` from `ground.heightAt`;
   - `slope` from the height differences (normalised 0..1: 45 degrees and steeper is 1);
   - `rock` = rock + scree weight from the materials.

   Put the grid sampling in a pure, unit-tested helper (`apps/web/src/play/terraform.ts` plus a test file).
2. **Water from stage 4.**
   - Sources: the running water makers (`kind 'water'`), each at its cell, with share = its running level.
   - Volume = `WATER_PER_POINT * points.aq`. Pick the constant so that stage 4's water requirement fills a few hollows. It is a tuning constant: name it, comment it, and log its tuning in DEFERRED_POLISH.
   - Re-flood when the volume grows by 5% or more, or when a water maker starts or stops. Never re-flood every frame.
   - Draw the lakes as one mesh: flat quads at the lake level over the cells with depth > 0, and a simple water material in the stage's look (low resolution at stage 4).
   - Show streams as darker, wet ground through the coverage texture (point 4).
3. **Ground cover from stage 1.**
   - `env.cells` from the grid, with wet = hydro's `wet` (0 before water exists). `env.stage` = the plot's stage.
   - Seeds:
     - dust at the gate pad and at every machine;
     - moss and grass at each running water maker (strength 3 cells);
     - leaves at each tree (05b).
   - Step coverage every 2 seconds of play with that dt.
   - Keep the state across reloads: save the baked bytes in IndexedDB through `apps/web/src/storage/big-store.ts`, and rebuild a `CoverState` from them on load. Scale a cell down if rounding pushes its sum over 1.
4. **Into the ground shader.**
   - Upload the five baked layers as textures: one RGBA8 for moss, grass, leaves and vines, plus dust in a second texture or channel.
   - Sample them in `@hm/groundshader` over the plot's square. Each layer tints the albedo and roughness: moss deep green and soft, grass yellow-green, leaves brown, vines dark green on steep rock, dust pale and dry.
   - The stage's look still rules: low resolution at stage 1. Add the textures as uniforms so a stage change never recompiles.
5. **e2e.** Using debug hooks: raise the plot to stage 4 with a water maker running and enough `aq`, and check that `hmPlay.water()` reports lake cells > 0 and `hmPlay.cover()` reports moss or grass > 0 near the water maker.

## 05b: trees
1. **Where.** A deterministic scatter (Poisson disc, seeded from the plot), only from stage 5, on cells that are dry (depth 0), with slope below 0.5 and grass above 0.4. Count by stage and tier:

   | Tier | Stage 5 | Stage 6 |
   |---|---|---|
   | potato | 15 | 40 |
   | low | 40 | 120 |
   | medium | 80 | 300 |
   | high | 150 | 600 |
   | ultra | 250 | 1000 |

   Log the numbers as tuning.
2. **What.**
   - Species by place: birch near water (wet > 0.6), pine on slopes above 0.3, oak elsewhere.
   - Height 6 to 15 m from a seeded random number; the seed from the cell.
   - Grow each distinct tree once and reuse it: keep about 6 variants per species, chosen by seed.
3. **How it is drawn.** Instanced meshes per species, variant and detail, so draw calls stay low.
   - Detail by distance: 3 near, 2 and 1 further, 0 far.
   - Until stage 6, only details 0 to 1 are used (the stage-5 look is still low poly).
   - The bark material uses a simple procedural bark texture, the leaves a leaf-cluster alpha texture (generate both, small, once).
   - Trees seed coverage leaves round their feet.
4. **Behind the loading bar:** grow the variants and compile at load, not on the stage change.
5. **e2e.** Raise to stage 5 and check `hmPlay.trees()` > 0. Raise to stage 6 and check that the count grows.

## Report back
Two reports here, one per push. Each says what changed, the draw calls and triangles added at stage 4 and at stage 6, verify and e2e results, and screenshots of the plot at stages 4, 5 and 6 from the same place (no overlays).
