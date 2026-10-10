# Sidecar TASK-08: base pieces render through @hm/batcher (Gemini Flash)

> From Claude Opus, 2026-10-10. Do this after TASK-07, or earlier if a big base drops frames on the GTX 950M. `@hm/batcher` (`fd19982e`) has landed and is tested.

## Why

`PieceMeshManager` clones a kit group per piece, up to 6 meshes each. A 300-piece base costs about 1,800 draw calls, and the min-spec laptop can't afford that. With the batcher, draw calls equal the kit parts in use, roughly 40 for a full base.

## Do

1. **Batch keys.** Key each piece's batch by its kit cache key, `${kind}|${stage}|${skirt}`.
   - The batcher's `source(key)` returns the cached kit's parts as `{ geometry, material }`, one per merged mesh, in the kit group's own space with the pivot baked in.
   - Each piece is `set(piece.id, key, matrix)`. The matrix is the piece's world transform: `pieceAt()` plus its yaw, or `deg`.
2. **Lamps** stay separate meshes: they need their own emissive changes. Doors' `parts.leaf` stay separate too, since they animate. Only the static parts are batched.
3. **Integrity view.** Use `tint(id, colour)` with the five-step colours, and `tint(id, null)` to restore. That drops the material swap entirely, and the 05b readability point comes for free if the tint is bright.
4. **Removal and collapse.** `remove(id)`. A falling piece leaves the batch: give it a temporary cloned group for its fall animation, as today.
5. **Stage change.** Dispose the batcher and build a new one, as the cache is rebuilt.

## Done means

- Typecheck shows 0 errors, `npm test` is green, and `npm run build` succeeds.
- A dev counter shows draw calls (`renderer.info.render.calls`).
- Shot `docs/shots/base/batched-200.png`: a 200-piece base with the counter visible under about 80 calls.
- The e2e still passes.
- Post [DONE] with the commit.
