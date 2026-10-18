# Stage 6 on Low: frame rate and layer costs (T02P, F-09)

Machine: this laptop (i7-6700HQ, GTX 950M, ANGLE D3D11 with the discrete GPU forced).
Scene (scripts/measure-stage6-low.mjs): the moon plot at stage 6, quality Low, a mill, a drill and a water maker
placed, the camera on the overlook. "Uncapped" is requestAnimationFrame with --disable-frame-rate-limit; a real laptop
display caps at 60 Hz.

## Result

| Build | fps, stage 6, Low, uncapped | frame ms | fps capped (60 Hz) | triangles |
| :--- | :---: | :---: | :---: | :---: |
| HEAD before this work (e9f2c3e2), same conditions | 24.5 | 42.3 | 17.6 | 317,938 |
| HEAD before this work, quiet laptop, 3 rounds | 34.1 | 29.4 | 34.8 | 317,938 |
| Final (fix, B-key and toast changes), same conditions | 94.2 | 10.6 | 58.6 | 319,970 |
| Final, quiet laptop, 2 rounds (before the B-key and toast changes) | 150.0 | 6.67 | 59.9 | 319,970 |

"Same conditions" means the two builds were measured back to back while other processes loaded the laptop (CPU 42 to 85%).
The ratio is 3.8 times, and 4.4 times on the quiet laptop. Target 45 fps: met on the laptop with a wide margin, and at
62 fps on the 3D PC (scripts/test-plot-biome.mjs, stage 6, Low).

## Where the 35 fps went

The base simulation sends a `tick` command every 0.1 s of mining time (play.tsx), and each tick calls `scene.setBase`,
`setFabricators` and `setPlot`. Those scheduled a full biome and cover rebuild every time, about 13 times a second. The
profile at stage 6 put 41% of the main thread in the plot-biome bake and 13% in the terrain sampling that builds its input
(65,536 `heightAt` calls per build). Logged bakes showed a second problem: the sliced cover bake restarted on every tick
and only ever got through stages 0 to 2 (sometimes 3), so HEAD's stage 4 to 6 covers were the first pass's, not the
current layout's.

## The fix

1. Layout key (docs/perf/f09-layout-key.diff, now in play-scene.ts): the biome input's layout (machines, keep-outs, water
   sources, tier) is computed cheaply; the cover and scatter rebuild only when that layout changes. The water mesh follows
   the stage through `uStage` in `applyCoverage`. Nothing is put behind a Graphics setting: nothing expensive is left.
2. B key race (play.tsx): the key handlers read the scene's own `where` through `liveWhereRef`, set by the frame loop each
   frame. They used the React `hud.where`, which is written at most every 90 ms. This covers B (Build menu), G (rifle) and
   E (lore props, inspect, lab panels).
3. HUD overlap (play.tsx, play.css): a toast's title was 54 px wherever it came from, so a long title ("Missing: 4 Basalt
   Slab, 2 Quartz Pixel Core, 3 Anomaly Shard", "Cannot place: ...") wrapped to three or four lines, and its box ran into
   the reticle's 48 px clear zone. A title longer than 20 characters now takes 26 to 40 px (scaled to the viewport width and
   height), and the base title size scales with the height too. Measured on 16 of the longest toast texts found in the play code, at
   1280 x 720 (the campaign's size): 0 reach the zone, lowest bottom 307 px against 336 px; at 1920 x 1080 the same.
   Open edge: at 1024 x 600 one short toast still reaches the zone (the width rule, not the height, sets its size).

## Per-layer costs (final build before items 2 and 3, uncapped, GPU timers, round 2 of 2)

| Scenario | fps (rounds) | GPU ms per frame | planet pass | post pass |
| :--- | :---: | :---: | :---: | :---: |
| full | 158.5 | 3.94 | 3.19 | 0.74 |
| vegetation off (tris 320k to 241k) | 149.8 | 3.98 | 3.29 | 0.68 |
| coverage off | 139.6 | 4.08 | 3.32 | 0.76 |
| water off | 135.1 | 4.73 | 4.02 | 0.71 |
| sky off | 161.3 | 3.45 | 2.77 | 0.69 |
| wrecks off | 168.0 | 3.96 | 3.28 | 0.67 |
| leaks off | 164.6 | 4.22 | 3.52 | 0.71 |
| whole planet off (the floor) | 255.5 | 1.56 | 0.76 | 0.80 |

Round 1 of "full" had a 25 ms GPU reading (another process on the GPU); it is left out. Each layer's gain is within the
run-to-run noise (about 15 fps and 0.5 ms), so no layer stands out. The sky is the largest single cost (about 0.5 ms of
planet-pass GPU). Shadows: the play scene never enables the shadow map, so there is no shadow pass.

## Look (approved by Opus)

Before and after, stages 2, 4 and 6: shots-run/perf/f09-before-after.png (not committed; HEAD top row of each pair, the
fix below it. Rows: stage 2, 4, 6; left HEAD, right the fix).

- Stage 2: the same terrain as HEAD; the fix shows a narrator line, the HUD and timing differ.
- Stage 4: HEAD's ground was the stale first-pass cover (dusty, mostly regolith). The fix shows the fresh bake of the
  current layout: green cover, approved by Opus as the intended stage 4 look.
- Stage 6: the same ground, trees, bushes and water in both.
- test-stage-world on the worker, final tree: ground green-to-red S2 1.201, S4 1.476, S6 2.028, strictly rising.

## Flash's WIP (rejected)

Measured against the fix alone: 148.8 fps with Flash's WIP, 150.0 without it. Flash's WIP gave no frame rate and it changed
the Low look: a coverage variant without macro breakup, a single-wave water shader with a coarser mesh, far rocks on Low, and
tree, bush and tuft culls on Low. Saved, unapplied, at docs/perf/rejected-flash-f09-wip.patch (the whole diff at that point,
so it includes an early version of the fix).

## Campaign status (test-campaign on the worker, final tree)

- Three runs, each 45 of 45 beats, zero console errors, zero HTTP errors, zero HUD overlaps, exit 0 (the script's exit rule:
  all beats pass, no console errors and no HUD overlaps).
- Earlier with the layout fix and before items 2 and 3: beat 16 failed in 3 of 6 runs, a boot failure in 1, and two runs had
  45 of 45 beats with the HUD check failing in the last. HEAD: 45 of 45 in 3 of 3 runs.
- npm test (worker, final tree): 2,840 unit tests pass, 0 fail; speed tests 19 of 19.
- test-stage-world: ALL CHECKS PASSED. test-plot-biome: ALL CHECKS PASSED (counts 13 / 126 / 379 at S2 / S4 / S6).
- Typecheck (laptop): 0 errors.

## Files

- scripts/measure-stage6-low.mjs: the per-layer harness (GPU timers, layer switches, --shots, --fps-only, --uncapped, --loo).
- docs/perf/f09-layout-key.diff: the layout fix (applied to play-scene.ts).
- docs/perf/rejected-flash-f09-wip.patch: Flash's WIP, rejected above.
