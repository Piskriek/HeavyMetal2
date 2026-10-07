# Sidecar task 01: the scientist, the only starting avatar (POL-11, POL-12)

Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` (typecheck, every test, the single-file build) and `E2E_GPU=1 node scripts/e2e-smoke.mjs`. Both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Log any visual rough spot you leave in `docs/DEFERRED_POLISH.md`. Do not tune frame rates.

## What the owner wants (2026-10-07, verbatim in `docs/OWNER_ASKS.md`)
- In SetMix's starting lab, the scientist in the biohazard/hazmat suit is the ONLY default choice. Remove the goblin and the generic human options from this creator.
- The player sets a name and chooses a visor colour, which tints the visor's glass and glow.
- There is one alternative: "Import custom 3D character". The player drags and drops a `.glb` or `.vrm`. "Connect to external game" appears too, disabled: it comes with the bridge (POL-13). Do not build it now.

## Where things are
- **Play's creator:** `apps/web/src/play/play.tsx` (about line 337), inside `{ready && creating ? ...}`. It renders `<CreateGoblin inLab kind="human" voice="setmix" .../>` from `apps/web/src/avatar/create-goblin.tsx`. `onDone` calls `created(state, look.id)` (`apps/web/src/play/quest.ts`; `PlayState.avatarId`).
  - Replace that with a new `apps/web/src/avatar/create-scientist.tsx`. Keep `CreateGoblin` as it is: My island and the Goblin Racing edition still use it, and the e2e's island creator checks must keep passing.
- **The model:** `zips/Models/rigged/Sketchfab.fbx` (1.2 MB, Mixamo humanoid rig, 66 bones, 9 skinned meshes). `zips/` is gitignored, so put the asset in a tracked folder, `apps/web/src/avatar/scientist/`, with a README giving its source and licence.
  - Converting it to `.glb` (Blender, if installed) is preferred.
  - Otherwise load the FBX with three's `FBXLoader`.
  - The single-file build may grow by at most about 2 MB.
- **Credits:** `CREDITS.md` (untracked; commit it). CC BY 4.0 requires visible attribution: show "Scientist by Scarecrow_original, CC BY 4.0" in small print in the creator, and in Settings if there is a credits place.
- **The look:** the creator's "mirror" vocabulary in `create-goblin.tsx` (dark panel, the avatar large in a lit mirror). Reuse it so the new creator looks like the same family.

## Build
1. **The scientist in the creator preview.** If the file has animation clips, play an idle loop. Otherwise relax the A/T-pose: upper arms down about 70 degrees through the rig's bones, plus a slow breathing sway. Load it behind the existing loading bar: never let the screen start choppy.
   - Budget on Low: about 30k triangles and textures at 1024 at most. Measure it; if it is over, decimate or downsize at conversion time.
2. **Name** (required; reuse the "an avatar needs a name" warning).
3. **Visor colour:** six swatches (amber, cyan, green, magenta, white, red) plus a custom colour input. Find the visor mesh or material among the 9 meshes by name or material, clone its material, and tint both the glass colour and the emissive glow.
4. **Import a custom character:** a drop zone and a "Choose file" button for `.glb` / `.vrm`, up to 30 MB.
   - Load it with `GLTFLoader`. A `.vrm` is glTF; no VRM library is needed for now.
   - Refuse, in plain words, a file with no mesh.
   - Scale it to 1.8 m tall and stand its feet on the floor.
   - Keep the file's bytes in IndexedDB through `apps/web/src/storage/big-store.ts`, so it survives a reload, and preview it in the same mirror.
5. **Save** what was chosen: `{ kind: 'scientist', name, visor }` or `{ kind: 'custom', name, key }`.
   - Store it in `PlayState` (bump `v` to 3 and migrate v2: an old `avatarId` becomes the default scientist under the same name if one is known, else "Scientist").
   - Unit-test the migration in `apps/web/src/play/quest.test.ts`.
   - Done: "Into the lab", then the quest goes on as now ("Turn on the gate").
6. **e2e** (`scripts/e2e-smoke.mjs`, about lines 688 to 691): it now checks for a looks list with "Explorer". Change it to check that:
   - the scientist is the only default;
   - the name and a visor swatch are set;
   - Done leads into the lab;
   - the import option is there.

## Report back
What changed (files), the scientist's triangle count and the size it added to the build, verify and e2e results, and a screenshot of the creator.
