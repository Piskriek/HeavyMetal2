# KIT-WIRE: the Meshy kit in the builder and the race

## Goal
The 13 Meshy kit pieces (and every later Meshy model) are placeable props in the 3D map editor and show in
races; the low tier is used on the performance setting and at distance; pieces a ball can hit collide
through their collision tier.

## What exists
- `public/models/kit/<id>.glb` (full, ~8k tris, 1024 texture), `<id>.lod.glb` (~1.5k, 512), `<id>.collision.glb`
  (~300, texture stripped to a stub). Ids: beach-shelf, cliff-block, hairpin-turn, road-straight, arch-bridge,
  boardwalk-bridge, jump-ramp, basalt-cave, waterfall-cave, lagoon-platform, stone-wall, railing-wall, iron-crate.
- **The three tiers are not aligned**: Meshy's remesh rescales slightly (the jump ramp is 1.51 wide in full,
  1.44 in its low tier). Fit every tier to the **full** model's bounding box when loading.
- `src/game/models/glb.ts`: `loadGlb` / `cloneGlb` (cached, shared geometry).
- The builder's Custom 3D path (`src/components/builder/CustomModelsTab.tsx`, `src/game/assets/model-import.ts`)
  imports OBJ files as `RawMesh`, and `'terrain'`-role meshes are rasterized into deterministic collision
  patches (`src/game/collision/terrain-patch.ts`, roles in `obstacle-roles.ts`).

## Solution
1. A **kit catalog** (`src/game/models/kit-catalog.ts`): id, name, category (Bridges, Ramps, Caves, Cliffs,
   Walls, Props), default size in world units, default collision role (ramps, bridges, platforms, cliffs →
   `terrain`; walls, crates → `barrier`; caves → `terrain` for the floor), and the three tier urls.
2. **Builder**: a "Kit" shelf in the map editor listing the catalog with thumbnails (render each model once to
   a small canvas and cache it, or use `art-src/meshy/<id>/thumbnail.png` copied to `public/models/kit/thumbs/`
   at ≤ 256 px). Placing a kit piece makes an ordinary PlacedProp (selection, gizmo, undo, save and the disk
   backup all work as for other props; follow how `prim_*` scene-kit props do it). **Stub every save while
   testing** (see the catch-up rule: the owner's track must never receive test objects).
3. **Rendering**: kit props render the full tier; beyond a distance (and always under `graphics ===
   'performance'`) the low tier. Shared geometry across copies.
4. **Collision**: a kit prop with role `terrain` or `barrier` feeds its **collision tier** (GLB → `RawMesh`,
   transformed by the prop's placement) into the same patch/barrier path custom models use. Never the full mesh.
5. Tests: tier alignment (fitted bounds within 1%), catalog files exist, a placed ramp produces a collision
   patch with a stable hash, the performance setting picks the low tier.

## Files allowed to change
New `src/game/models/kit-catalog.ts` and `src/game/models/*`; the builder shelf component(s) and their CSS;
`src/game/track-builder-3d.ts` and `src/game/renderer-3d.ts` (kit prop rendering only);
`src/game/collision/*` only if the RawMesh hand-off needs an adapter; `src/game/builder/prop-catalog.ts` (kit
entries); new tests; `scripts/check.mjs`. **Not** `src/game/sim/**`, `engine.ts`, `track-space.ts`.

## Acceptance
- [ ] Every kit piece can be placed in the editor, moved, undone, saved (with saving stubbed in tests) (screenshots).
- [ ] A placed jump ramp is ridable in a test drive: the ball rolls up it via its collision tier (screenshot or a test).
- [ ] The performance setting shows the low tier (screenshot of both).
- [ ] Tier alignment, catalog and collision-hash tests pass.
