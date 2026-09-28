# Mesh painting mode: sculpting terrain and 3D objects (NewSculpt)

Sculpt the course's own scenery — the alpine heightfield, cliffs, cave walls, the island terrain — and
any placed 3D object (Meshy models, primitives) with brushes, and paint their vertices. Every stroke is
one undo step; every sculpt is saved with the track and shows in the race.

Files: `src/game/sculpt/` (doc format, geometry wrapper, brushes, tool), `src/components/SculptPanel.tsx`,
`tests/sculpt.test.ts`. Integration is six small hunks in `track-builder-3d.ts`.

## The two facts that shape the design

1. **The scenery is generated from code on every load**, and **Meshy copies share geometry**
   (`scene.clone(true)` in `kit-object.ts`). A sculpt therefore cannot be "the mesh". It is a sparse
   **displacement layer** over the generated shape: per mesh, which vertices moved and by how much (local
   space, int16 × 0.25 units), plus which were painted and their RGB. `SculptMesh.wrap()` clones the
   geometry once per sculpted instance, so a second copy of the same rock — and the generated original —
   never move.
2. **The builder exists during races** (the renderer owns it) but its UI does not. So the tool is built
   in the builder's constructor with no canvas, and `sync()` re-applies documents whenever the builder
   changes or a model finishes loading. The canvas is attached later by `initGizmo`.

## Where a sculpt lives

The same place a moved or re-shaded scenery part lives: on a `PlacedProp`.

- A placed model or primitive: `prop.sculpt = SculptDoc` on that prop.
- Scenery: the builder's own `pickTerrain` gives (or creates) the `terrain_edit` override for the clicked
  part, and the document rides on it. `isNoOpEdit` is taught that a sculpt is not a no-op, so the edit is
  saved and never pruned.
- The road surface (`TrackSurface`, `locked` in `SceneryIndex`) refuses the brush: it shows the race line.

Document per mesh (`sculpt-doc.ts`): `{ key, n, shape?: {idx, d}, paint?: {idx, c} }` — `key` is the mesh's
traversal index, name and vertex count; `n` guards against a mesh that changed size (the doc is refused,
not misapplied); indices are LEB128 deltas; offsets int16 × quantum; colours uint8 RGB; all base64. A
fully reshaped alpine heightfield (4 800 vertices) is ~45 KB.

## The brushes

| Tool | Key | What it does |
|---|---|---|
| Raise / Lower | 1 / 2 | Push along the brush area's average normal, world up, or toward the view. |
| Inflate | 3 | Each vertex along its own normal. |
| Smooth | 4 | Toward the neighbour mean (targets computed first, so order doesn't matter). **Ctrl** = smooth with any tool. |
| Flatten | 5 | Toward the weighted plane through the brush area — a terrace, a pad for a prop. |
| Pinch | 6 | Slide toward the centre along the surface (a crease); inverted = spread. |
| Noise | 7 | Seeded per-vertex bumps along the normal (rock, scree); same seed, same rock. |
| Grab | 8 | Drag the captured area with the pointer on a camera-facing plane. |
| Paint | 9 | Blend a colour into vertex colours; inverted = back toward the generated colour. |

**Shift** inverts, `[` `]` radius, `−` `=` strength. Falloff is flat inside *hardness* × radius, then a
smoothstep to the rim. Amounts scale with the radius, so a mountain and a boulder feel the same.

## What makes it hold together

- **Welding.** Vertices at the same position (UV seams, hard edges) form a *group*; brushes move groups,
  so a GLB never tears along a seam. Normals are recomputed **per vertex** from that vertex's own
  triangles, so hard edges stay hard.
- **Spatial grid + drift.** Groups are bucketed by local position. During a stroke the grid is not
  rebuilt; the query radius grows by the largest distance any group has drifted from its bucket and every
  candidate is checked exactly in world space. `finishStroke()` re-buckets.
- **Transforms.** Queries and displacements go through the mesh's world matrix (scale included), so a
  scaled model and a rotated scenery pivot both sculpt in world units.
- **Vertex paint and the kit look.** `setKitLook` swaps `mesh.material` between `userData.baseMaterial`
  and a per-copy look; enabling vertex colours clones the base once, makes the clone the new base, and
  flags any existing look material, so brightness/shading changes keep the paint.
- **Undo.** `host.beginSculpt()` is the builder's `pushUndo`; the prop's document is written at
  pointer-up. Ctrl+Z restores the prop; `sync()` sees the hash change and puts the geometry back.

## Guarantees (asserted in `tests/sculpt.test.ts`)

Raise dents what is under the brush and nothing else, monotone to the rim, normals follow the slope;
directions honoured; non-indexed meshes weld to the indexed vertex count and move as one surface;
smooth lowers a peak, flatten shrinks a height range, pinch slides inward, inflate pushes out; noise is
seeded; grab follows the pointer; a moved and scaled mesh finds the same disc under a world-space brush;
codecs round-trip; extract → apply lands within the quantum with a stable hash; a mesh of another size
refuses a document; reset is exact; paint creates the attribute, switches only this mesh's material, and
round-trips; wrapping clones (the shared buffer never moves); sync applies, clears on undo, re-applies
on redo.

## Wiring

`track-builder-3d.ts`: imports; `sculpt: SculptTool | null`; built at the end of the constructor;
`onModelLoaded` also calls `sculpt.syncProp`; `attach(canvas)` in `initGizmo`; the three `isNoOpEdit`
sites treat a sculpt as a real edit; host methods `sculptObjectFor`, `isSculptLocked`, `beginSculpt`,
`commitSculpt`; disposal. Mount `<SculptPanel tool={builder.sculpt!} />` as a builder tab.

## Known limits

- **Collision.** Scenery is decoration for physics (the race runs on track data), so terrain sculpts change
  nothing physical. A sculpted Meshy model with a collision role keeps its unsculpted patch until the next
  load; `commitSculpt` is the place to re-run `kitCollisionInput`/`patchFromWorldMeshes` when that matters.
- The vertex-colour clone of a scenery part's material sits outside `sceneryMaterials()`, so the scene-wide
  tile randomiser does not reach a painted part, and removing a shader from that part restores the
  generated material (the colours stay in the geometry and return when painted again).
- Instanced meshes and sprites are not sculptable (there is nothing per-instance to move).
- Quantisation is 0.125 units; a reload rounds a stroke to that, invisibly at this scale (a lane is 240).
