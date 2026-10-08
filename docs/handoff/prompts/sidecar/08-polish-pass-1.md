# Sidecar task 08: the base game's first polish pass

The owner (2026-10-08): "first polish the scientist and base game". Do this right after TASK-07. Pull `main` first. Work on `main` and push there (no PRs), **one commit per item**, so each can be judged on its own. Before each push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check.

Rules that hold for every item (`docs/SETMIX_PLAN.md` and `docs/OPTIMIZATION_AND_INNOVATION.md`):
- The minimum spec is the i7-6700HQ / GTX 950M laptop, with the Intel HD 530 in Low: hold 60 fps on Low.
- Anything that costs frames goes behind a Graphics setting with an Auto choice, never always on.
- Everything loads behind the loading bar.
- Every item ends with before and after screenshots from the same place, with no overlays (no toast, no start prompt).

## Items (`docs/DEFERRED_POLISH.md`), in this order
1. **POL-19, the hologram reads weak.**
   - Dim the projection disc to a glow, so the floating relief is the bright thing.
   - Make the relief's contour lines and lit rim strong enough that the plot's hills read from 2 m.
   - Judge against sheet 07, "PLANET TABLE — plot hologram".
2. **POL-08, build menu overlap:** the build menu (B) never covers the top HUD. Check it at 1280x720, 1366x768 and 1920x1080.
3. **POL-17, twin gate detail:** the planet's twin gate is rebuilt at full detail when the plot reaches stage 2, as the machines' props are (`rebuildProps` in `apps/web/src/play/play-scene.ts`).
4. **POL-04, stage 4 and up on Low:** it measured about 50 fps on the laptop.
   - Cap Low's planet lines, or step the ground shader's later-stage cost, until Low holds 60.
   - Keep the stage ladder's look: each stage still reads as more detailed than the one before.
   - Measure with the existing tools and report the numbers.
5. **POL-02, plume ground glow:** a soft coloured glow on the ground under each pouring machine. It was written once and reverted for cost; now it goes behind a Graphics setting that is on for High and Ultra and off for Low and Medium.
6. **POL-03, pixel light on Ultra:** the pouring pixels light their surroundings a little (a few cheap point lights, or a light-gathering pass), on Ultra only, behind the same kind of setting.
7. **POL-20, the oak:** the oak in `@hm/treegen` could spread wider. Widen its crown envelope a little so it reads as a spreading oak next to the pine and birch. Keep every treegen test passing.

## Report back
On the board, one line per item: what changed, the fps on Low where it matters, and the before and after screenshots' paths. Mark each POL row in `docs/DEFERRED_POLISH.md` done or what is left.
