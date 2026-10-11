# TASK-10d: the lab rebuilt to sheet 21

**Owner, 2026-10-11:** sheet 21 is approved with the square rule. "square rule, ill get the 3d thing up and running, anything round is killing us atm".

**Concept:**
- `docs/concept/setmix/panels/21/`: 41 (layout), 42 (Act I dark), 43a/b/c (the storm as progress), 44 (power wall), 45 (studio corner), 46 (armory and her corner).
- Read them all before you start.
- Research and reasons: `docs/LAB_LAYOUT_RESEARCH.md`.

**Where:** `apps/web/src/play/lab-room.ts` (`createLabRoom`).
- Keep the `LabRoom` interface, `Power`, `powerAt`, `POWER_*`, and the `ROOM` and `GATE_AT` exports, so `play-scene.ts` and `lab-scene.ts` keep working. Update their values.
- Add `setStorm(progress: number)` to `LabRoom`.

## The room (lab frame: x right, y up, z towards the start, north = −z)
- `ROOM = { left: -8, right: 8, back: -9, front: 3, height: 5 }`: 16 × 12 m with a 5 m ceiling.
- **North wall: the observation window.**
  - Nearly full width (x −7.4 to 7.4), sill 0.4 m, top 3.5 m.
  - A thick square steel frame with three square mullions.
  - Keep the void storm shader behind it and drop the rain. Panel 43 is the reference: dithered black-and-white static clouds and broken pixel lightning.
- **The gate: `GATE_AT = { x: 0, z: -1.0 }`.**
  - Its opening faces the window, so it frames the storm as you walk in.
  - It stands on a square two-step plinth (procedural boxes, about 5 × 5 m then 4 × 4 m, 0.2 m per step).
  - The plinth is walkable, with step colliders.
- **West wall, the power wall,** south to north as panel 44 reads left to right, all against x ≈ −7.6:
  - the capacitor bank (z ≈ 1.0);
  - the breaker panel (z ≈ −1.0), with its handles in the six bays;
  - four relay cabinets, wall-mounted at about 1.0 m (z ≈ −2.6, −3.5, −4.4, −5.3);
  - two control boxes, wall-mounted at about 1.4 m (z ≈ −6.1, −6.7);
  - the operator console with its throw lever (z ≈ −7.8), facing into the room (+x), beside the window.
  - One square cable tray runs along the wall at about 4.2 m. Square floor covers carry the power across the floor from the breaker and relays to the gate plinth's west side.
- **East wall, north part, the studio corner (panel 45):**
  - the preset rack (z ≈ −7);
  - the preset bench (z ≈ −5);
  - the combiner (z ≈ −3.4), all against x ≈ 7.6;
  - the planet table in front of them at about (5.0, −5.0), carrying the existing `PlotHolo` hologram.
- **South-east, the armory (panel 46 left):**
  - the armory rail on the east wall (z ≈ 0.6, rail at about 1.3 m) with the extraction tool resting on it (`weapon-frame`);
  - the weapon bench against the south wall at about x 6.
- **South wall, her corner (panel 46 right, and 41):**
  - the camp cot along the wall at about (−2.5, 2.2);
  - her desk at about (1.0, 2.4);
  - the wall radio inset in the south wall beside the desk, at about 1.4 m: her voice comes from here;
  - charts taped on the wall above the desk: flat paper quads with a canvas-drawn chart texture, no lettering.
  - On the desk, procedural props: a few paper stacks (thin boxes with a paper texture) and a mug (one low-sided cylinder is fine: it is tiny).
- **Spawn:** Act I wakes beside the cot, about (−2.5, 1.0), facing north toward the gate and the storm (panel 42's camera).

## The pieces
- **Each piece is generated:** `getGenSync(id, genLevelFor(quality))`. The lab is pristine Earth, so its level follows the Graphics setting only, not a plot stage.
- **Every piece falls back to its `@hm/labkit` procedural piece while its model is not yet packed**, so the room works now and upgrades as the assets land.
- **IDs:** `gate`, `capacitor-bank`, `breaker-panel`, `breaker-handle`, `relay-cabinet`, `control-box`, `operator-console`, `console-lever`, `preset-bench`, `preset-combiner`, `preset-rack`, `planet-table`, `her-desk`, `cot`, `wall-radio`, `armory-rail`, `weapon-bench`, `weapon-frame`. Sizes are in `registry.json`.
- **Lamps the power sequence drives are their own meshes.**
  - The gate's coils become thin emissive plates laid flush over its copper panels: three per pillar, bottom to top, plus the top beam.
  - The relay lamps and the console's screen are emissive squares over the baked ones, at positions you measure on the model.
  - The baked texture stays unlit. `setPower` drives the overlays exactly as it drives the kit lamps today.
- **The gate's portal surface** is sized to the generated gate's opening, measured once from the model's inner frame.
- **The breaker handle and console lever** are separate objects on their pivots, so the power sequence can throw them.

## The storm as progress (panel 43)
- `setStorm(p)`, where p is 0 to 1 and eased:
  - 0 is 43a, the full storm;
  - 0.5 is 43b, thinning, with grey ground far away;
  - 1 is 43c, breaking, with a patch of real blue sky.
- Drive it from the campaign's restoration progress: the highest plot stage reached ÷ 6, unless you find a better existing measure. State what you used.
- Stage 0 keeps the 1-bit dithered look.

## Light (the min-spec budget: four lights)
- Keep one main lamp for the ceiling strips, one emergency light, the gate glow and the window light.
- Act I (panel 42): emergency amber only. The storm in the window is the brightest thing in the room.

## Owner rules
- Square sections. Every cable is in the tray or the floor covers.
- Nothing floats. No lettering or numbers anywhere.
- No chimneys or stacks.

## Done when
- **Shots in `docs/shots/lab/`, each looked at before posting:**
  - 41 from above the south-east corner (hide the ceiling for that shot only);
  - 42 Act I dark from the cot;
  - 44 the power wall;
  - 45 the studio corner;
  - 46 the armory and her corner;
  - the window at storm 0, 0.5 and 1.
- **The power-on sequence runs end to end:** lever, relays, floor pulse, coils bottom to top, static clears.
- **Checks:** typecheck shows 0 errors; the tests are green; `npm run build` succeeds. Report the lab's draw calls (`renderer.info`) before and after.
- **Git:** stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change.
