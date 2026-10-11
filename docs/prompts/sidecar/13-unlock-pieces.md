# TASK-13: unlock the roofs, gables, stairs and wall variants in the build menu

**Owner, 2026-10-11:** "Unlock all of them". The roofs (pitched, low, both corners, ridge cap), gables, stairs, half walls, window walls, and door frames with doors join the build menu.

**Where:** `apps/web/src/base/catalog.ts`.
- The kinds are already costed in `PIECE_ORE`. They are only missing from `FAMILY`.
- The comment "costed, but in no blueprint family until the game renders them" is out of date: they now render with generated models (TASK-10b). Update it.

## Families (what each primitive's blueprints build)
- **cube:** add `halfWall`, `windowWall`, `doorframe`, `door`, `gable` (slabs and panels, beside foundation, floor and wall).
- **beam:** add `stairs`, `roof`, `lowRoof`, `roofOuter`, `roofInner`, `ridgeCap` (sloped and long pieces, beside the ramp).
- **Leave `railing` and `ladder` out:** the owner was not asked about them.
- **Check whether the starter kit (`STARTER`) builds the cube family.** If it does, the new cube kinds come with it. Say what you found.

## Verify through the real build path
Do not write pieces straight into the world (TASK-10b's capture script did that for its shots). In `scripts/test-base-building.mjs`, build a small house the way a player does: blueprint, hotbar, aim, place, snap. It needs:
- a foundation and a floor;
- walls with one doorframe holding a door, and one window wall;
- a half wall;
- a gable at each end;
- the pitched roof on both slopes, plus a ridge cap, with an outer corner where two roofs meet;
- stairs up to a second floor.

Each piece must place, snap and pass the structural integrity rules (support), and the door must open. Report any kind that will not snap or is refused, with the reason. Do not loosen the integrity rules to make a piece fit: that is a question for Opus.

## Done when
- **Shots,** each looked at before posting: the house in the build menu (the new pieces visible in the hotbar or blueprint list), the finished house at stage 1 and at stage 6, and the door open.
- **Checks:** typecheck shows 0 errors; the full `npm test` is green, except the two known timing tests in `fieldkit` and `plotgrid`, which fail on this loaded laptop (note them); `npm run build` succeeds; `test-base-building.mjs` passes.
- **Git:** stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change. Commit and push before you post, then post `[DONE]` on the board.
