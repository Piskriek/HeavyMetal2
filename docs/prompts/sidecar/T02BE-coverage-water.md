# T02BE: Argo's coverage shader and water surfaces, wired in (TICKET-02 items B and E)

**Source:** `arena-gathered/argo-ticket02-coverage-water/`. Opus has checked it: its tests pass (coverage 2 of 2, water 2 of 2). The `groundshader` change only adds 290 lines, and that file hasn't changed since Argo's snapshot, so a straight copy is safe.

## Install
- Copy `packages/groundshader/src/index.ts`, `packages/groundshader/tests/coverage.test.ts`, `apps/web/src/play/water-surfaces.ts` and `apps/web/src/play/water-surfaces.test.ts` into place.
- Read the new exports in groundshader: `makeCoverTextures` and `setCoverage`. Read water-surfaces' exports too.

## Wire the coverage (the ground finally greens)
- The cover mask changes with the stage, unlike the scatter. So at load, behind the loading bar, bake plotbiome's cover for stages 0 to 6: 7 bakes of about 50 ms each, from the same `BiomeInput` that F-06 and F-07 build. Keep one DataTexture per stage.
- Call `makeCoverTextures` once at load.
- On every stage change (in `raiseStage` when the wave settles, in `setFidelityStage` and in `restore`), call `setCoverage(groundMaterial, { tex, x0, z0, size })` with that stage's mask.
- When machines or structures change, rebuild the masks time-sliced, never as a hitch.

## Wire the water
- Build the surfaces from `@hm/hydro`'s `flood`, with the `water` machines as sources (the F-07 sources). Show them from the stage the look bible gives (lakes at stage 4).
- Hide the old world's crater water disc from that stage on (`crafter/world.ts` and `looks.ts` `waterLevel`), so there is never double water. Make that the smallest change in `crafter/world.ts`.

## Verify
- **Extend `scripts/test-stage-world.mjs`,** or add `scripts/test-ground-cover.mjs`. Take a ground-band shot at stages 1 to 6 near the plot centre, and assert the ground band's mean green against red rises from stage 2 to 4 to 6. Look at the shots: moss from stage 3, grass from 4, darker wet ground by the water, and no tiling stripes.
- **The fps check stays on the laptop:** Low at stage 6, with coverage, water and plants, must hold at least 30 fps.
- Run everything else through `scripts/test-on-3dpc.sh`: `npm test`, the build, `test-stage-world`, `test-plot-biome`, and `test-campaign` (45 of 45).

## Stay inside
- The new files above, `play-scene.ts`, `plot-ground.ts`, `crafter/world.ts` (the disc only), and the test script.
- In `play.tsx`, the loading step only: a Haiku worker is editing play.tsx's E-key handler at the same time.
