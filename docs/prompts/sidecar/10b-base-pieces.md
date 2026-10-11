# TASK-10b: the generated building pieces in base building

**What:** the base-building lattice pieces become the generated models, the way TASK-10 did for the rovers, machines and fixtures (`apps/web/src/assets/gen-props.ts` is the pattern to follow).

**Where:** `apps/web/src/base/kit-pieces.ts` (the `case` per kind). The pieces render through `@hm/batcher` via `PieceMeshManager` (`apps/web/src/base/piece-meshes.ts`). Its `ensureFloatGeometry` already handles the generated meshes' quantized attributes.

## The map (kit kind → generated id)
- `foundation` → `foundation`, `wall` → `wall`, `pillar` → `pillar`, `floor` → `floor`
- `ramp` → `ramp`, `stairs` → `stairs`
- `airlock` → `airlock`, `hardpoint` → `hardpoint`
- `roof` → `roof-pitched`, `lowRoof` → `roof-low`, `roofOuter` → `roof-corner-outer`, `roofInner` → `roof-corner-inner`
- `ridgeCap` → `ridge-cap`, `gable` → `gable`
- `halfWall` → `half-wall`, `windowWall` → `window-wall`
- `doorframe` → `doorframe`, `door` → `door-leaf`
- **Stay procedural** (owner rule: bars and holes tear when reduced): `railing`, `ladder`.

## How
- **Placement:** each generated piece was fitted to its procedural kit piece's exact box, in that piece's own local frame (`registry.json` has the `box` and `kind`).
  - Place the generated mesh where the procedural mesh was, inside the same piece group and before the piece's offset.
  - Do not rescale or re-centre it.
  - The roofs, ramp and stairs already rise toward +z like the kit pieces.
- **Level:** `getGenSync(id, genLevelForStage(stage, quality))`. When the asset is not packed yet, keep the procedural piece (the same fallback pattern as TASK-10).
- **Keep the procedural piece's colliders, sockets, snap points and lamps.** Physics, snapping and building rules must not change.
  - The airlock's status lamp stays its own mesh over the generated one.
  - The door leaf stays a separate object on the procedural hinge line: it is fitted to the kit leaf's box.
- **Preload** the lattice pieces' generated levels behind the loading bar, with the others (`preloadAllGenAssets`).

## Done when
- **A test:** for every mapped kind, the generated mesh's bounding box matches the procedural piece's box within 2% on each axis, in the piece's frame. Report any that fail; do not "fix" them by scaling. A mismatch is a pipeline issue for Opus.
- **Shots in `docs/shots/base/`,** each looked at before posting:
  - a built outpost at stage 1 and at stage 6 (foundation, walls with a window and a door, the roof with both corners and the ridge, a ramp and stairs, an airlock);
  - one close-up of the roof corners meeting.
- **No regression:** `test-base-building.mjs` (including 200 pieces and the integrity checks) passes. Report the draw calls with 200 pieces, before and after.
- **Checks:** typecheck shows 0 errors; the tests are green; `npm run build` succeeds.
- **Git:** stage and commit only your own paths (`git commit -- <paths>`). Never restore or check out files you did not change.
