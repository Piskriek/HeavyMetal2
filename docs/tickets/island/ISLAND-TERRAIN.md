# ISLAND-TERRAIN: the body of Basalt Isle

## Goal
The island from the owner's reference render, as terrain the game draws: a volcano cone rising from cliff
shelves, broad pale beaches, turquoise lagoons with sandbars, basalt coastline and open sea, at the scale of
a course (a descent of ~21,000 units over ~76,000 of track, see `src/game/courses.ts` profiles).

## Solution
1. **`src/game/island/terrain.ts`** (new): `buildIslandTerrain(params): THREE.Group`, pure apart from THREE.
   - A heightfield from layered shapes, all deterministic from a seed: the volcano cone with a crater, two
     cliff shelves (ring terraces), a coastline with coves, lagoon basins below sea level, sandbars, beaches as
     wide gentle bands between cliff foot and water. Parameters in one exported object so the route authoring
     can move things.
   - Four painted material zones blended by height and slope: pale sand, wet sand at the waterline, basalt
     on steep faces, ochre rock on shelves. Use the existing painted tile textures under `public/art/` where
     they fit (`public/art/texture-masters/`, `dirt-tile.png`), no new image files needed.
   - A sea plane with a shoreline foam band and depth colour (turquoise over sand, deep teal offshore).
   - Two levels of detail by distance (the island is huge), and a `performance` graphics setting
     (`src/game/preferences.ts`: `graphics === 'performance'`) that uses the coarser mesh everywhere.
   - `sampleIslandHeight(x, z)` exported, so route authoring can place roads on the ground.
2. **Preview**: a dev-only route, `?island-preview` handled in `src/main.tsx` with **one** added branch that
   mounts `src/game/island/IslandPreview.tsx`: an orbit camera over the island, a toggle for the performance
   mesh, and the Meshy landmarks that exist in `public/models/kit/` placed as stand-ins (load with
   `src/game/models/glb.ts`).
3. Tests: the heightfield is deterministic (same seed → same hash), beaches exist as wide bands (a sampled
   coastline ring has sand wider than N units), lagoons are below sea level, the volcano is the highest point.

## Files allowed to change
New files under `src/game/island/` and `tests/island-terrain.test.ts`; `src/main.tsx` (one preview branch);
`scripts/check.mjs` (register the test).

## Acceptance
- [ ] The preview shows an island that reads like the reference: volcano, cliffs, broad beaches, lagoons (screenshots).
- [ ] Deterministic heightfield and the other tests pass; the performance mesh is used under `performance`.
- [ ] Frame time in the preview stays reasonable (report the triangle counts of both detail levels).
