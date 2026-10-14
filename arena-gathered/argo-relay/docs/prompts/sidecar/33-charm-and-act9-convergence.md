// File: docs/prompts/sidecar/33-charm-and-act9-convergence.md
# TASK-33: Portal-2 Reactive Charm Barks, Acts VII-IX Endgame Convergence & Curated 1 km Basin

## 1. Objective
Wire the 6 reactive *Portal 2*-style Dr. Haddy comedy barks (`CHARM-01..06` + `CHARM-RENAME`), complete the Acts VII–IX endgame quest chain culminating in the **Golden Master Cartridge (`.smx`)** healing the Earth Lab Window Breach (`A9-03`), sculpt the 4 canonical landmarks on the 1 km lunar plot (`P1-LAYOUT-04`), and close `POL-05` (47-tile blob transitions), `POL-17` (Stage 2 Twin Gate detail swap), and `POL-25` (Window Breach floor flash).

## 2. Pre-Built Drop-In Files to Wire
1. `packages/content/src/charm-and-act789.ts` & `packages/content/src/__tests__/charm-and-act789.test.ts` (`CHARM-01..06` triggers, `CHARM-RENAME` food/joke detector, `A7-01..A9-03` endgame quest definitions, and `LOG-08` Vance Ridge Transponder).
2. `packages/plotterrain/src/curated-lunar-basin.ts` & `packages/plotterrain/src/__tests__/curated-lunar-basin.test.ts` (Gate Pad Plateau `0–30 m`, Eastern Low Hydro Basin `-3.65 m`, NW Bouldered Ore Ridge `+8.8 m`, and Perimeter Wreck Rim `+14.0 m`).
3. `packages/groundshader/src/blob47-and-polish.ts` & `packages/groundshader/src/__tests__/blob47-and-polish.test.ts` (`POL-05` 47-tile blob reducer, `POL-17` Twin Gate `mid.glb` / `high.glb` swap, and `POL-25` Window Breach floor flash).
4. `packages/hydro/src/stage34-water-and-shoreline.ts`, `packages/treegen/src/stage56-lsystem-canopy.ts`, & `packages/hydro/src/__tests__/stage34-water-and-trees.test.ts` (Stage 3–6 water table, wet shoreline roughness, coverage creep tendrils, L-system trees, and grazing fauna).
5. `apps/web/src/shell/bridge-archive-rumor-graph.tsx` (`P2-LORE-06` *Outer Wilds*-style Bridge Archive rumor node graph).

## 3. Integration Steps
1. Register `CHARM_REACTIVE_BARKS` and `ACT_7_TO_9_QUEST_STEPS` in `apps/web/src/play/quest.ts`.
2. When `A9-03` completes, pass `isBreachHealedByAct9 = true` to `evaluateWindowBreachHealing()` in `apps/web/src/lab/lab-scene.ts` and `apps/web/src/lab/lab-vista.ts`.
3. Wire `sampleCuratedLunarPlot()`, `sampleHydroAndCoverageAtPoint()`, and `evaluatePlotCanopyCell()` into `apps/web/src/crafter/planet.ts`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/content packages/plotterrain packages/groundshader packages/hydro`
- Full playthrough from Act I Cold Boot to Act IX Golden Master Convergence verified.
