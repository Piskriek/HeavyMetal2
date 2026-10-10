# Sidecar TASK-03 — Wire the real base world into play (Gemini Flash)

> From: Claude Opus, 2026-10-10. `@hm/structure` and `@hm/lattice` are landed, and so is my glue `apps/web/src/base/world.ts` (commands, rules, events) with `catalog.ts` (items, blueprints, costs). Read both first, and decisions D9–D11 in `docs/BASE_BUILDING_ARCHITECTURE.md`. Same shared-tree rules and trailer as before.

## 1. The real view source — `apps/web/src/base/world-view.ts` (new, yours)

`createWorldViewSource(o: { getWorld(): BaseWorld; env: WorldEnv; getAt(): Point; dispatch(cmd: BaseCommand): void }): BaseViewSource`, replacing the mock behind `?base`. Keep `mock-view.ts` for tests and screenshots.

**Inventory**
- `world.player.slots` as 9 x 4 (row 0 is the hotbar), and `world.equipment`.
- `kg` = grid weight plus worn weight, using `L.kg` with `ITEMS`.
- `ItemView`s come from `ITEMS`.

**Lattice**
- Groups from `L.links([...world.boxes], relays(world, env))`.
- Totals from `L.totals`, largest first.
- `here` = `networkAt(world, env, at)`, or null when that is empty.

**Draft**
- Counts are what the player plus the network in reach hold: the one-count rule, now real.
- The preview reads from `catalog.ts`: `blueprint(blueprintId(p, m))` gives the name and family; `MATERIALS[m]` gives `vKeep` / `hKeep`; the cost is prim + map + `DRAFT_ORE` with have counts.
- `piece` = the family's first kind.

**Actions** dispatch `BaseCommand`s, always with `at` = the player position:
- `selectHotbar` → `hotbar`
- `move` → `move`
- `quickStack` → `quickStack`
- `draft` → `draft`

`pickDraft` and `toggleIntegrity` are local UI state.

**Refusals:** every `refused` event becomes a toast with plain words. Reuse your TASK-01 phrases and add:
- `short` → "Missing: 12 ore" (from `event.short`)
- `no-blueprint`, `wrong-kind`, `not-empty` → "Empty the bin first"
- `would-spill` → "A full bin would fall"
- `no-bench` → "Stand at a Drafting Table"
- `known`, `too-heavy`, `out-of-range`

## 2. World in play — `play.tsx` (behind `?base`)

1. Keep a `BaseWorld` in a ref, starting from `createWorld()`.
2. `env` = `{ heightAt: (x, z) => scene.heightAt(x, z), bridge: { ...gate position, range: 60 } }`. Add `heightAt` to the play scene's API: it is the existing `groundAt`.
3. One `dispatch(cmd)` calls `apply`, stores the world and handles the events (toasts, sounds).
4. Dev seed behind `?base` only: 200 ore, 3 `prim-cube`, 3 `map-basalt`, 1 `prim-chassis`, so the loop can be played without the substrate battle.
5. Expose `__hm.base = { world: () => ref.current, apply: dispatch }` on the existing debug hook for e2e.

Persistence is mine (save v2), so do not add it.

## 3. Pieces in the scene — `apps/web/src/base/piece-meshes.ts` (new, yours)

**Meshes**
- Diff `world.base.pieces` by id into a `THREE.Group` of stand-in meshes from `stand-in-pieces.ts`.
- Place each one at `pieceAt(base, piece)`, rotated by the structure's yaw (plus 90° for `r = 1` edges, and `r * 90°` for ramps and fixtures).
- Set `userData.pieceId` on each, and hand the group to `scene.setPieces`.

**Removal**
- On a `removed` event, animate the collapsed ids: drop about 0.5 m, tilt, and fade over 0.6 s, then dispose.
- The removed piece itself just vanishes, with a dust puff if one is cheap.

**Integrity overlay** (`toggleIntegrity`): tint each piece by `supports(base, structureEnv(env))`:
- 1.0 → blue `#38bdf8`
- 0.6 → green
- 0.35 → yellow
- under 0.25 → red

Do it by swapping to four shared materials, never per-piece materials.

**Cost:** one draw call per kind is fine for now. The real meshes come later from an Arena battle.

## 4. Build input (skeleton now; the ghost waits for `snap`)

**Now**
- When the selected hotbar item is a blueprint, play is in build mode.
- `R` (and the wheel, if it is free) cycles the kinds of `blueprint(id).kinds`.
- The build readout shows the blueprint and kind.
- `X` while aiming at a piece (`aimPoint().piece`) sends `remove`.

**Later**
- Placing (LMB / E) and the ghost need `@hm/structure.snap` from round 2, which is running now. I will post `[FYI] snap landed` on the board.
- Do not write your own snapping in the meantime: no hybrid that we would have to rip out.

## 5. e2e — extend `scripts/test-base-building.mjs`

Through `__hm.base`:
1. Found a slab, a bench, a floor, a basalt bin.
2. Check that the meshes exist (count children with a `pieceId`).
3. Remove the floor and check that the bin collapses (its mesh is gone after the animation).
4. Check the ore refund in the HUD's real counts.
5. Draft a blueprint at the bench and check that it appears in the inventory window.

Re-take the screenshots against real data.

## Done means

Typecheck clean, `npm test` green (it now includes `apps/web/src/base/world.test.ts`), all three e2e suites green. Post `[DONE]` with the sha. Visual rough spots go into `docs/DEFERRED_POLISH_REGISTRY.md`.

## Files

| Owner | Files |
|---|---|
| Yours | `world-view.ts`, `piece-meshes.ts`, `stand-in-pieces.ts`, `ui/**`, `base.css`, the `?base` lines in `play.tsx`, `heightAt` / `setPieces` in `play-scene.ts`, the e2e script |
| Mine | `world.ts`, `catalog.ts`, `view.ts`, `packages/**`. If `world.ts` lacks something you need, ask on the board. |
