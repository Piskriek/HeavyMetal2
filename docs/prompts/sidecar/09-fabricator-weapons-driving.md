# Sidecar TASK-09: Vehicle Fabricator, Weapon Bench, loadout and driving (Gemini Flash)

> From Claude Opus, 2026-10-10. Do this after TASK-06b. Read `docs/FABRICATOR_RESEARCH.md` first (the owner's decisions are its first table) and concept sheets 19 (fabricator and rovers) and 20 (weapons) in `docs/concept/setmix/`. Load the frontend design skills before any UI work (CLAUDE.md §3.2).

## What is already in the world (do not re-implement)

All of this is in `apps/web/src/base/world.ts`, `catalog.ts`, `weapons.ts`; the tests are in `world.test.ts` ("fabrication").

- **The station:**
  - `install { at, hardpoint, kind: 'fabricator' }` puts a Vehicle Fabricator on a hardpoint ring and pays `FABRICATOR_BILL` from linked storage.
  - `craft { at, machine, recipe: 'vehicle-scout' | 'vehicle-hauler' | 'vehicle-crawler' }` queues a print.
  - It is refused `'locked'` below the vehicle's `stage` (scout 2, hauler 4, crawler 6).
  - It runs on relay power. A `tick` emits `printed { kind }`, and the rover appears in `world.vehicles` parked on the pad.
- **Vehicles:**
  - Each one is `{ id, kind, x, z, yaw, box }`.
  - A hauler's `box` is a linked storage bin (`vehicleBox(id)`) that travels with it.
  - `park { vehicle, x, z, yaw }` moves it; the world moves the hauler's bin too.
- **Weapons:**
  - `forge { at, item }` crafts a frame or a part at a Weapon Bench within reach. Parts are stage-gated per `FORGE`.
  - `fit { slot, item }` swaps a part between the pack and `world.loadout` (`core`, `barrel`, `sight`, `cell`). The old part goes back to the pack, and a wrong slot is refused.
  - `weaponStats(world.loadout)` gives the numbers, or null if any slot is empty.
  - **The default loadout (semi, scatter, iron, compact) is exactly today's shotgun.**
- **Physics:** `@hm/rover`: `spawn(kind, x, z, heading, ground)`, `step(state, input, ground)` at `DT = 1/60`, `speed(state)`, `ROVERS[kind]`.
  - `Ground` is `{ height(x, z), g: 1.62, boxes? }`.
  - Boxes are oriented boxes in the three.js `rotation.y` yaw convention.
- **Meshes:** the rovers and the fabricator come from the rovergear battle (pending). Until it lands, use stand-ins behind one adapter: a box body, a cylinder wheel the game spins about local x and steers about y, and wheel origins at the hubs in `ROVERS`. The real meshes then drop in without UI changes. They will expose `body`, `wheel`, `hubs`, `wheelRadius`, `sockets` (`seat`, `dish`, `drill`), `lamps`, `parts.head` (the print head, which slides in x) and `parts.arm`.

## Do

1. **Vehicle Fabricator window**, opened by interacting with the station:
   - a card per catalog rover with its name, seats, cargo, print time and its bill;
   - have/need for each bill line counted from linked storage (`networkAt`);
   - a locked card says "Opens at stage N" (the plot is at stage M) in words, not just a padlock;
   - **Print**, then a progress bar from the machine's state;
   - the print head slides across the bed while printing. Never a centre toast; one quiet line when it is done.
2. **Weapon Bench window**:
   - the frame and four slots;
   - the part list by slot, with stage locks and bills;
   - the stats from `weaponStats`, as bars (damage, fire rate from cooldown and burst, spread, range, zoom, magazine), each with its change against the current loadout before forging or fitting;
   - **Forge** crafts into the pack.
3. **Field swaps**: a loadout panel in the inventory with the four slots. Click or drag a pack part onto a slot to `fit`, and show refusals in words. This works anywhere, not only at the bench (research F4).
4. **Combat reads `weaponStats`:**
   - the existing shotgun code takes mode, burst, cooldown, pellets, damage, spread, range and magazine from the loadout;
   - beam mode is a held ray that ticks damage every `cooldown`;
   - a null loadout cannot fire and says why;
   - a small weapon readout beside the hotbar shows the mode and the magazine (the hotbar itself stays V3, unchanged).
5. **Driving:**
   - **E** at a parked rover's `seat` socket enters it; **WASD** is throttle and steer, **Space** brakes, **E** exits;
   - step `@hm/rover` at a fixed 60 Hz with an accumulator, and interpolate the render;
   - build `Ground.height` from the terrain, and `boxes` from the structures' wall, foundation and machine footprints (oriented, three.js yaw);
   - the chase camera is a spring arm behind and above that never dips into the terrain;
   - a speed readout;
   - on exit, send `park` with the rover's position and yaw;
   - wheels spin by distance travelled over the radius, the front wheels steer, and the crawler's tracks scroll.
6. **Rendering**: parked and driven rovers use the stand-in or the real meshes; lamps glow while driven. Nothing floats: wheels touch the ground at rest.

## Rules
- Use the base UI's vocabulary (`base.css`: glass panels, Oxanium and Inter, the telemetry glow); no browser-default controls.
- No centre toasts for routine events (TASK-05b point 2).
- Screens that load meshes preload behind a visible loading bar.
- Stage only your own paths and commit with `git commit -- <paths>`. We share one index.

## Done means
- Typecheck shows 0 errors, `npm test` is green, `npm run build` succeeds.
- The e2e (`scripts/test-base-building.mjs`) gains this flow:
  1. install a fabricator; at stage 1 the scout card says "Opens at stage 2";
  2. at stage 2, print a scout and wait for `printed`;
  3. enter it, drive 20 m, exit; the save reloads with the scout where it was parked;
  4. forge a long barrel, fit it, and check that `weaponStats` pellets go from 7 to 1;
  5. fit the scatter barrel back.
- Shots in `docs/shots/base/`: `fabricator-window.png`, `printing.png`, `scout-driving.png` (chase cam), `weapon-bench.png`, `loadout-swap.png`.
- Post [DONE] with the commit.
