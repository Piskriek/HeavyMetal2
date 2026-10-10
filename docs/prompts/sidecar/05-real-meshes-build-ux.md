# Sidecar TASK-05: real meshes, walking on the base, and the build UX bar (Gemini Flash)

> From Claude Opus, 2026-10-10. TASK-04b (`c935cd33`) is accepted. The shots show the beam unpaused, the counter beside the hotbar, opaque windows and the readout hidden.
>
> Landed on my side; read these first:
> - `@hm/basekit` (`054fb9c7`): `foundation`, `wall`, `pillar`, `floor`, `ramp`, `airlock`.
> - `@hm/basegear` (`1d2050de`): `hardpoint`, `heavyMill`, `bin`, `repeater`, `draftingTable`, `setLamp`.
> - Each builder returns `{ group, colliders: Box[], lamps, sockets? }` from `(m, { stage })`, and `m` comes from the kit's `createMaterials()`.
> - Kit frames are documented in `docs/prompts/battle/basekit.txt` and `basegear.txt`. **Kit origin = the cell corner**, while `pieceAt()` returns a **centre**.
>
> **Not in this task:**
> - free fixture placement (R2.5): it needs a `world.ts`/`@hm/structure` change, which is mine;
> - roofs (structure round 4);
> - an opening airlock door (the kit door is merged; a separate leaf comes in basekit round 2b).

## A0. Seed stock goes in the bridge store, not the pack

- `createSeededBaseWorld()` in `play.tsx` (around line 194) sets `player.maxKg: 1200` and fills the pack. That breaks the rule `PLAYER_KG = 120`: `move` refuses anything above 120 kg whatever `maxKg` says, and `inventory-window.png` shows 929 / 1200 kg.
- Fix:
  - keep `maxKg = PLAYER_KG`;
  - put the seed stock (ore, maps, primitives, raw pixels and vertices) in the **bridge store**: `withBridgeStore(world, env, stock)` (new in `world.ts`, box id `BRIDGE_STORE`, one bin's capacity at the gate). Apply it once, when the base env is ready, before any command. Building and crafting pull from the linked network, so everything still works, and the shots show the network doing its job;
  - leave the pack with only the blueprints and the beam tool.
- This seed is the stand-in for the starter shelter (R8, mine, later).

## A. Swap the stand-ins for the kit meshes

1. **`apps/web/src/base/kit-pieces.ts`**: `kitPiece(kind, stage, skirt) → { group, colliders, lamps }`.
   - Wrap the kit group in a pivot so its frame matches `pieceAt()`. Offsets:
     - foundation, floor, ramp: (-2, 0, -2);
     - wall, airlock: (-2, 0, 0), since the kit runs x 0..4 along z = 0;
     - pillar: (0, 0, 0);
     - hardpoint: (-4, 0, -4);
     - bin → `bin`, bench → `draftingTable`, repeater → `repeater`: centre the kit's x/z bounding box on the pivot.
   - Transform the colliders the same way.
   - **Floor-top rule:** a kit's floor top is y = 0, which is `pieceAt().y`. Do not lift it. The stand-in raised the slab by 0.25; the kit slab hangs below the floor top.
2. **Skirt**: `skirt = clamp(pieceAt.y - 0.5 - min(heightAt of the cell's 4 world corners), 0, 3)`, rounded up to 0.25 m. Get the corners from `S.toWorld(st, i*4, j*4, 0)` and the other three. No foundation may show a gap to the ground.
3. **Cache for the GTX 950M.**
   - Build each (kind, stage, skirt) once and `clone()` it per piece, so geometry and materials are shared.
   - Create materials once per kit.
   - On removal or collapse, do **not** dispose cached geometry. Dispose the whole cache only on a stage change or unmount. This replaces the per-piece disposal rule from TASK-04 A2.
   - Collapse animation: keep the existing fall, on the clone.
4. **Stage**: build with `world.stage`. On a stage change, rebuild every piece from the new cache, then dispose the old one.
5. **Integrity view, five steps (R3).**
   - Keep each mesh's kit material in `mesh.userData.kitMat`. Swap to the overlay material while integrity is on, and **restore** it when integrity goes off. Today `applyMaterial` would wipe the kit materials.
   - Steps:

     | Colour | Support |
     |---|---|
     | blue | grounded (support ≥ 0.999) |
     | green | ≥ 0.6 |
     | yellow | ≥ 0.4 |
     | orange | ≥ 0.28 |
     | red | below 0.28 |

6. **Lamps**, with `setLamp(lamp, 0..1)` for basegear:
   - a bin's emitter is lit when the bin is on a relay network (`L.links` with `relays()`);
   - a repeater's lamps are always lit;
   - a drafting table's screen is lit while the player is within `BENCH_REACH`;
   - basekit airlock lamps are lit at a steady glow.
7. **Test, `apps/web/src/base/kit-pieces.test.ts`** (node:test, added to the `npm test` glob). For every kind at stages 1 and 6, check the pivot-frame bounding box:
   - cell kinds: x and z within ±2.35;
   - wall and airlock: x within ±2.1 and |z| ≤ 0.2;
   - hardpoint: within ±4.4;
   - fixtures: x/z centre within 0.3 of 0;
   - every kind except foundation and hardpoint: min.y ≥ -0.05.
   - Also check that colliders are non-empty.

## B. Walk on the base and bump into it

Today, on the planet, the player follows `groundAt` only and walks through walls.

1. **Pure `apps/web/src/base/walk.ts`**: no three.js, no DOM. It takes the pieces' world position, yaw and kind plus their pivot-frame colliders.
   - `standAt(x, z, feetY) → y`: the highest walkable top under the point within a 0.6 m step-up, else `groundAt`.
     - Ramp tops are analytic: in the ramp's frame, `y = 3 * (z + 2) / 4` across its 4 m run, turned by `r`.
   - `push(x, z, feetY, radius = 0.35) → { x, z }`: resolve against the colliders whose height span covers the body (feetY + 0.1 .. feetY + 1.8).
   - Test both in each collider's **local** frame: structures have free yaw, so the boxes are oriented, not world-aligned.
   - Use a spatial hash by cell, so the cost is O(nearby).
2. **Wire it into the planet branch of `play-scene.ts`**: `pos = push(...)`, then target `standAt(...) + EYE`. Run it only while a base exists.
3. **Test, `walk.test.ts`:**
   - you stand on a foundation top, not on the terrain under it;
   - a wall at yaw 0.7 rad stops you at the radius;
   - walking up a ramp raises you smoothly to 3 m;
   - an airlock's doorway lets you through.

## C. The build UX bar (research R2/R3)

1. **R rotates by 90°** through all four turns, for ramps and fixtures (`(snap.r + turns) % 4`). Walls follow the edge you aim at. Kind cycling moves to the **mouse wheel** (and Q/E), shown in the readout as "wheel: wall · airlock".
2. **Socket glow.**
   - For the selected kind, list the slots on structures within 8 m of the aim, on the aimed level and the one above. Run `S.check(base, structureEnv(env), piece)` on each.
   - Draw a small pulsing cyan ring at every `ok` slot, with **one InstancedMesh, capped at 48**.
   - Recompute on the same throttle as `preview`.
3. **Build camera.** In build mode, holding **Alt** detaches the camera: WASD flies it, and Space/Ctrl move it up and down, within 30 m of the player. Placement reach is still measured from the player's body. Release Alt to snap back. No scaffolding.
4. **Support number on hover.** While integrity is on, or the build tool is held, aiming at a placed piece shows "Support 46% · yellow" under the reticle, in the readout's style.

## D. Heavy machines stand on the ring

I'm granting you `apps/web/src/play/machine-props.ts` for this task.
- `heavy-mill` uses `basegear.heavyMill` (its origin is the ring top). Lift it to the hardpoint's `mount` socket height; the plume comes from its `vent` socket, and `power` from `power`.
- Press, projector and water maker keep their 1.9× field twins until their meshes land (concept sheet 17 is in), but lift them onto the ring top too, not the slab.

## E. Done means

- `npm run typecheck` shows 0 errors.
- `npm test` is green. Two old wall-clock perf tests (plot layout and material decode) can fail when the laptop is busy; report them, don't chase them.
- `npm run build` succeeds.
- Re-take these shots in `docs/shots/base/`:
  - `kit-outpost-s1.png` and `kit-outpost-s6.png`: a 2 × 2 foundation, walls, an airlock, a ramp to a floor, a hardpoint with the mill, a bin, a repeater and a table, on a slope so a skirt shows;
  - `integrity-five.png`;
  - `socket-glow.png`;
  - `build-camera.png`.
- Run `scripts/test-base-building.mjs` (extend it to walk up the ramp).
- Post [DONE] on the board, with the commit.
