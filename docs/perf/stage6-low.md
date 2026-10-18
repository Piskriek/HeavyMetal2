# Stage 6 on Low: frame rate and layer costs (T02P, F-09)

Machine: this laptop (i7-6700HQ, GTX 950M, ANGLE D3D11 with the discrete GPU forced).
Scene (scripts/measure-stage6-low.mjs): the moon plot at stage 6, quality Low, a mill, a drill and a water maker
placed, the camera on the overlook. "Uncapped" is requestAnimationFrame with --disable-frame-rate-limit; the display
caps a real laptop at 60 Hz.

## Result

| Build | fps, stage 6, Low | frame ms | GPU ms per frame | triangles |
| :--- | :---: | :---: | :---: | :---: |
| HEAD (F-08), 3 rounds | 34.1 uncapped, 34.8 capped | 29.4 | not timed | 317,938 |
| HEAD + layout fix (docs/perf/f09-layout-key.diff), 2 rounds | 150.0 uncapped | 6.67 | about 4 | 319,970 |
| Working tree before this pass (Flash WIP + fix), 2 rounds | 148.8 uncapped | 6.72 | about 4 | 238,430 |

With the fix the frame is 59.9 fps capped (the 60 Hz display limit). Target 45 fps: met with a wide margin, but the
fix is not in the tree yet (see Campaign status).

## Where the 35 fps went

The base simulation sends a `tick` command every 0.1 s of mining time (play.tsx), and each tick calls
`scene.setBase`, `setFabricators` and `setPlot`. Those scheduled a full biome and cover rebuild every time, about 13 times a
second. The profile at stage 6 put 41% of the main thread in the plot-biome bake and 13% in the terrain sampling that
builds its input (65,536 `heightAt` calls per build). Logged bakes showed a second problem: the sliced cover bake restarted
on every tick and only ever got through stages 0 to 2 (sometimes 3), so HEAD's stage 4 to 6 covers were the first pass's, not the
current layout's.

## The fix (docs/perf/f09-layout-key.diff)

The biome input's layout (machines, keep-outs, water sources, tier) is now computed cheaply, and the cover and scatter
rebuild only when that layout changes. The water mesh now follows the stage through `uStage` in `applyCoverage`.
Output is the same as a fresh bake of the same layout. Nothing is put behind a Graphics setting, because nothing expensive
is left: the frame is about 4 ms of GPU and about 6.6 ms in total on this laptop.

## Per-layer costs (final build, uncapped, GPU timers, round 2 of 2)

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

Round 1 of "full" had a 25 ms GPU reading (another process on the GPU); it is left out here. Each layer's gain is within
the run-to-run noise (about 15 fps and 0.5 ms), so no layer stands out. The sky is the largest single cost (about 0.5 ms
of planet-pass GPU); the vegetation, coverage and water costs are too small to separate at this headroom.

## Look (shots in shots-run/perf, not committed)

- Stage 2: the same as HEAD (barren regolith, machine tufts, water pad).
- Stage 6: the same ground, trees, bushes and water as HEAD. Only the HUD and a narrator line differ, by timing.
- Stage 4: the ground is greener than HEAD's. HEAD's stage 4 was the stale first-pass cover (see above), so this is the
  fresh bake of the current layout. It needs an owner or Argo look before it lands.
- test-stage-world on the worker, with the fix: ground green-to-red S2 1.206, S4 1.449, S6 2.019, strictly rising, all checks
  passed (the stage ladder holds).

## Flash's WIP (rejected)

Measured against the fix alone: 148.8 fps with Flash's WIP, 150.0 without it. Flash's WIP gave no frame rate and it changed
the Low look: a coverage variant without macro breakup, a single-wave water shader with a coarser mesh, far rocks on Low, and
tree, bush and tuft culls on Low. Saved, unapplied, at docs/perf/rejected-flash-f09-wip.patch (the whole diff at that point,
so it includes an early version of the fix).

## Campaign status (not green with the fix)

- HEAD: test-campaign 45 of 45 on the worker, 3 of 3 runs. HEAD plus the debug accessors: 45 of 45.
- With the fix, six worker runs: beat 16 (A4-04: B opens the Build menu) failed in 3; a boot failure in 1; two ran 45 of 45
  beats, and the last of those exited 1 from the HUD-overlap check (the journal toast reached the reticle's clear zone).
- Diagnosis so far: the B key is ignored when React's `hud.where` has not caught up with the scene's `where` after
  `toPlanet()`. The key reaches the window (counted), so the handler's gate is the cause. The faster frames change that
  timing. Not fixed.
- Options: (a) make the test wait for the planet HUD before pressing B, and look at the toast's timing for the overlap check;
  (b) have the B handler read the scene's `where` (play.tsx, not this file).

## Files

- scripts/measure-stage6-low.mjs: the per-layer harness (GPU timers, layer switches, --shots, --fps-only, --uncapped, --loo).
- docs/perf/f09-layout-key.diff: the fix, against play-scene.ts with the accessors. Applies to the tree now.
- docs/perf/rejected-flash-f09-wip.patch: Flash's WIP, rejected above.
