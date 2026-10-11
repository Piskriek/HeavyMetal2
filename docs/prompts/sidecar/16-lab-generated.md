# TASK-16: the lab shows its generated pieces (it is the first thing the owner sees)

TASK-10d built the sheet-21 lab with `@hm/labkit` fallbacks, because the lab's generated models were not packed yet. They are all packed now (`apps/web/src/assets/gen/registry.json`), but `apps/web/src/play/lab-room.ts` only looks one up (`weapon-frame`). The room still shows round procedural cans, the round planet table and the old gate, where the owner approved square pieces.

## The swap
For each placed lab piece: `getGenSync(id, genLevelFor(quality))`, falling back to the labkit piece when it is missing. Follow the `createGenFixture` / gen-props pattern.

| labkit piece | generated id | notes |
|---|---|---|
| gate | `gate` | the portal surface is sized to the generated opening (measure the inner frame once); the coil lamps become thin emissive plates over its flat copper panels: 3 per pillar plus the top beam, lit bottom to top by `setPower` as now |
| capacitorBank | `capacitor-bank` | |
| breakerPanel | `breaker-panel` | the handles are `breaker-handle` × 6, one per bay; each a separate object on its pivot, so the breaker throw can animate them |
| relayCabinet × 4 | `relay-cabinet` | wall-mounted at about 1.0 m; its two amber lamps get emissive overlays driven by `p.relays` as now |
| controlBox × 2 | `control-box` | wall-mounted at about 1.4 m (no posts); lamp overlays as now |
| operator console | `operator-console` | the lever is `console-lever`, a separate object on its pivot (`leverAt`, `lever` keep working: the pull animates it); the screen gets an emissive overlay |
| presetRack | `preset-rack` | |
| presetBench | `preset-bench` | |
| presetCombiner | `preset-combiner` | |
| planetTable | `planet-table` | square: the `PlotHolo` hologram sits on its projector plate; `tableDisc` becomes an emissive overlay on the plate |
| her desk | `her-desk` | keep the procedural paper stacks and mug on top |
| cot | `cot` | |
| wall radio | `wall-radio` | inset in the south wall at about 1.4 m; her voice comes from here (positional, if the audio engine allows) |
| armory rail | `armory-rail` | the extraction tool (`weapon-frame`) rests on it |
| weapon bench | `weapon-bench` | |

- **Each generated piece:** scale it uniformly so its footprint matches the labkit piece it replaces (registry sizes are real metres, so the scale should be near 1; report any piece needing more than ±15%). Keep the labkit piece's colliders.
- **Preload** all of these behind the loading bar before the lab opens.
- **Re-measure** the lamp overlay positions on the generated meshes. Every lamp the power sequence drives must still light in order.

## Done when
- **Retake** the sheet-21 shots (`scripts/capture-lab-sheet21.mjs`) and look at every one: 41 the layout, 42 Act I dark, 44 the power wall, 45 the studio corner, 46 the armory and her corner.
  - They must show the square generated pieces, not the round labkit ones.
  - Compare each with the concept panels in `docs/concept/setmix/panels/21/`.
- **The power sequence:** the lever, the breaker, the relays in order, the floor pulse, the coils bottom to top, and the static clearing. It still works and is asserted.
- **Checks:**
  - `scripts/test-playthrough.mjs` and the other suites pass;
  - typecheck shows 0 errors;
  - `npm test` is green, apart from the known timing tests;
  - `npm run build` succeeds;
  - report the lab's draw calls, before and after.
- **Git:** commit your own paths in small steps and push. Post `[DONE]`. Never restore or check out files you did not change.
