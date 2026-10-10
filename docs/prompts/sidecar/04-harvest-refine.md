# Sidecar TASK-04 — TASK-03 fixes, then harvesting and heavy machines in play (Gemini Flash)

> From: Claude Opus, 2026-10-10. TASK-03 (`e0c2b1fd`) is accepted as a base: typecheck clean, 61 package and base tests green, and the yaw maths is right. Do part A first; it is small.
> New on my side, read first:
> - `world.ts` commands `tick`, `stage`, `install`, `craft`, `collect`, and `BRIDGE_RANGE` (`926b0475`)
> - `catalog.ts` `HEAVY_BILL`, `RECIPES`, `QUEUE_MAX`
> - `@hm/plotsim` heavy kinds `heavy-mill` / `heavy-press` / `heavy-projector` / `heavy-water` (`5e8ac589`), with stand-in props in `machine-props.ts`

## A. TASK-03 review fixes

1. **One `WorldEnv`, built once.** The bridge is hard-coded at `{ x: 0, z: 0 }` in four places in `play.tsx` (around lines 198, 215, 422 and 497).
   - It must stand at the gate's planet position (`scene.debug.gatePlanet()`) with `range: BRIDGE_RANGE`.
   - Build that env once into a ref when the planet is ready, and use the same object for `preview` and for `dispatch`. If they differ, the ghost says yes and the build says no.
2. **Dispose GPU resources.** Nothing is disposed today, so a long session leaks.
   - In `piece-meshes.ts`, free the geometry of removed pieces when they go, and the geometry plus the cloned materials of collapsed pieces when their fall ends. Never dispose the shared materials.
   - In the ghost swap (`setPieceGhost` on a kind change), dispose the old ghost's geometry.
3. **Throttle `preview`.** It runs every frame, and `snap` re-solves support for up to 18 slots. That is fine at 50 pieces and heavy at 500 on the GTX 950M.
   - Recompute only when the aim moves more than 0.25 m, the yaw turns more than 5°, the blueprint or kind changes, or `world.tick` changes.
   - Otherwise reuse the last result.

## B. Harvesting

1. **Nodes.** Render `world.field.nodes` as instanced stand-in markers, one `InstancedMesh` per kind, and label them stand-ins in code. The look waits for concept art. Make each kind recognisable:
   - `dither` and `fold` (stage 0 and up): a flickering black-and-white pixel crack, and a wire-ripple bump
   - `chroma` and `spire` (stage 2 and up): a colourful pixel swirl, and a crystal shard
   - size and brightness scale with `reserve / MAX[kind]`
   - rebuild the instances only when the field changes (`stage` or a harvest), not every frame
2. **Beam input.** Holding LMB with the Extraction Beam worn (`world.equipment.beam`), while aiming within `BEAM_RANGE` of a node, harvests it.
   - Accumulate frame time and dispatch one `tick` every 100 ms: `{ t: 'tick', at, dt, beam: { node, power: 1 } | null, power }`. The harvest maths is closed-form, so ten 10 ms steps and one 100 ms step are equal.
   - Always send the 100 ms `tick`, even without the beam: that is what regrows nodes and runs machines.
3. **Beam VFX.** Use `@hm/beamkit` if its API fits (it is the Extraction Beam rifle; read its exports): a beam from the muzzle to the node, with pixels flowing back to the player. Raw pixels are in the node's colours, vertices are wireframe dots. It must be cheap on Low.
4. **Feedback.** On a `harvested` event, a small floating "+14 Raw Pixels (mono)" near the hotbar and a soft tick sound. On `lost`, an amber "Pack full" toast.

## C. Heavy machines

1. **Install.** E while aiming at a `hardpoint` piece with no machine opens a machine picker: the four heavy kinds, each with its `HEAVY_BILL` shown as have / need from the player plus the network in reach. Its Install button dispatches `install`.
   - On the `installed` event, also place the plotsim machine: `place(plot, env, 'heavy-<kind>', padCentre.x, padCentre.z, yaw)` through the existing plot path (cost 0 ore).
   - Keep a map from hardpoint id to plot machine id, rebuilt from positions on load.
   - The heavy machine then shows its stand-in prop and pours pixels through the existing plume path.
2. **Power share.** Each `tick` carries `power: { [hardpointId]: share }`, where share is plotsim's `running(plot, env).get(plotMachineId)` (0..1).
3. **Refinery window.** E on an installed mill or press opens it:
   - the `RECIPES` for its kind, with input have / need
   - a Queue button (dispatches `craft`; it is disabled at `QUEUE_MAX` or when short)
   - the queue with progress bars (`done / seconds`)
   - a Collect button when `out` holds items
   On a `finished` event, a toast and a chime.
4. **Stage.** When plotsim reports a `stage-up` event, dispatch `{ t: 'stage', stage }` so the field regrows richer.

## D. e2e (extend `scripts/test-base-building.mjs`)

Through `__hm.base`:
1. Teleport next to `world.field.nodes[0]`, send a 1 s beam `tick`, and check the raw item count rises.
2. Build a slab, three foundations and a hardpoint from the dev seed (seed the chassis blueprint parts), install a heavy mill, queue `map-basalt`, `tick` 40 s at power 1, and check the map arrives (in a bin, or `out`, then collect).
3. Screenshot: the beam on a node, the machine picker, the refinery window.

## Done means

Typecheck clean, `npm test` green, all three e2e suites green, screenshots in `docs/shots/base/`. Post `[DONE]` with the sha. Rough visual spots go in `docs/DEFERRED_POLISH_REGISTRY.md`.

## Files

| Owner | Files |
|---|---|
| Yours | `play.tsx` (base parts), `play-scene.ts` (node instances, beam VFX hook), `piece-meshes.ts`, `world-view.ts`, `ui/**` (machine picker, refinery window), `base.css`, the e2e script |
| Mine | `world.ts`, `catalog.ts`, `view.ts`, `packages/**`, `machine-props.ts` (the heavy stand-ins I just added). Ask on the board if `world.ts` lacks something. |
