# T05: square socket markers, gunmetal panels, sliding door, the avatar at 3 m, the beam core, mineral outcrops (TICKET-05)

**Spec:** OPUS_NOTE_12 (in the Setmix Drive). Argo approved every call, with no vetoes.
**Source:** `arena-gathered/argo-ticket05/`, 10 files.
- New: `socket-markers.ts`, `panel-pieces.ts` and `outcrops.ts`, each with its test.
- Full replacements: `scientist-model.ts` (+141/−13) and `beam-visuals.ts` (+225/−24), each with a test. Neither file has changed since Argo's snapshot, so copy them.

Opus has run the tests that work from the staging folder: markers 2 of 2, panels 2 of 2, outcrops 1 of 1, beam 2 of 2.

## Do
1. **Install** the 10 files.
2. **Socket markers:** in `play-scene.ts` (about line 1039), replace the `RingGeometry` socket rings with `socketMarkerGeometry()` and `socketMarkerMaterial()`, at the same `setSocketRings` call sites. Only the slot the ghost will use pulses.
3. **Panels:** in `kit-pieces.ts`, `windowWall`, `door`, `halfWall` and `gable` build from `gunmetalPanel(kind, size)` instead of the white slabs. Keep the colliders the same as today's; the T01b collision checks must still pass.
4. **Sliding door:** in `piece-meshes.ts` (about line 183), replace the hinge rotation with `slideDoor(leaf, open, travel)`. Animate `open` 0→1 over about 0.4 s. The leaf's collider follows the open state, as T01b set up.
5. **Avatar:** the new `scientist-model.ts` loads `'high'` for the player. Wire Argo's third-person light rig (key, rim and hemisphere fill on his avatar light layer) in `play-scene.ts`'s third-person camera path. Put the avatar and the held rifle on that layer, and keep the world meshes off it.
6. **Beam core:** in `play-scene.ts`'s beam frame code (about lines 2205–2227, where `setStream` is called), call `beamVisuals.setCore(muzzle, hit, mode, t)` in every beam mode, and `setCore(null, …)` when the beam is off. Take the first-person muzzle from the rifle view model (`rifle-hold.ts`).
7. **Outcrops:** replace the stand-in node geometries (`play-scene.ts`, about lines 1076–1094) with `outcropGeometry(kind, seed)` and `outcropMaterial(kind)` per @hm/substrate kind, keeping the InstancedMesh per kind and the per-kind tint. Sink them so they're grounded.

## Verify
- **A new `scripts/test-ticket05-look.mjs`:**
  - in build mode, the markers show and no `RingGeometry` socket rings remain;
  - placed window, door, half-wall and gable pieces aren't white: the mean colour of their screen region is dark gunmetal;
  - opening a door slides the leaf (its world x/z changes, its rotation doesn't) and you can walk through;
  - in third person at 3 m, the avatar's head region shows detail: the pixel variance in its box rises against the old mid model;
  - the beam core is visible in first and third person, with beam-coloured pixels between the muzzle and the hit;
  - the nodes are outcrops: no `TorusGeometry` or `DodecahedronGeometry` instanced meshes remain.
  Save shots of each, and look at them yourself.
- **fps on the laptop:** stage 6 on Low must not drop more than 2 fps below F-09's result.
- Through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"` (always rebuild first: the snapshot resets `dist`): `npm test`, your new test, `test-ticket01-collision`, `test-base-building`, `test-build-ux`, `test-machine-inspector` and `test-campaign` (45 of 45).

## Stay inside
The 10 files, `play-scene.ts`, `kit-pieces.ts`, `piece-meshes.ts`, and the new test.
