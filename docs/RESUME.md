# RESUME: start here (fresh session)

The context a new Opus session needs on its first message. Keep it current: update it after every finished step. Last update: 2026-10-12, by Opus on the old account at about 5% of its weekly usage.

## 1. Who and where
- **The game:** FIDELITY, the SetMix Multiverse (read `CLAUDE.md`). Repo `C:\MarbleGp`, branch `feat/monster-mash-exploration`; push after every commit.
- **The team:**
  - **Opus**, the lead and architect: briefs, reviews, glue.
  - **Haiku 5.5 sidecars**, the implementers. One at a time, through the Agent tool (model haiku, effort high, background). The prompt: "read CLAUDE.md, docs/prompts/sidecar/HANDOVER.md, the board docs/SIDECAR_COMMS.md, then <brief>; foreground tests; commit before reporting".
  - **The owner** decides features. Their words are in `docs/OWNER_ASKS.md`.
- **Run it:**
  - `PLAY.bat` builds and serves http://localhost:8080.
  - `npm run typecheck`, `npm test` (the fieldkit and plotgrid timing tests fail on this laptop; known), `npm run build`, and `npm run e2e` (the playthrough).
- **The 3D PC:** Hunyuan3D at 192.168.0.5:8082. The token is in `.local3d-token`; never print or commit it.
  - Single image only. Multi-view crashes, so leave it OFF.
  - About 10 minutes per model, one job at a time.
- **Images:** the RUN.world CLI (`docs/runworld` and memory note runworld-setup), about 120 credits per image, balance about 66.4k. Keep the voice reserve (RUNWORLD_FLOOR 16000).

## 2. The owner's model rules (every generated asset)
- **Shape:**
  - chunky, with no thin tubes, cages, holes or deep tread;
  - **square sections** (tubing, rails, lights, housings), and nothing round unless it must be (wheels, barrels);
  - **no cloth and no heaps of small parts** (natural shapes don't reduce well);
  - no belts, no lettering, nothing floating;
  - empty cabs; the steering wheel is a square "[-u-]" yoke;
  - wall-mounted, pointy, tubular or holed parts are separate objects.
- **Workflow:** clean low cage, soft normals, colour and normals baked; silhouette parts snap on at sockets.
- **Review:** render every model from four angles before packing.

## 3. The asset pipeline (one id at a time, or a list)
1. Add it to `docs/runworld/assets.json` (`id, panel, class, size, axis, view, subject`, and optionally `fix`, `reach`, `hold`). Commit the manifest at once.
2. `node scripts/runworld-assets.mjs images <id>` makes `zips/runworld/assets/<id>/source.png`. Look at it; if good, `touch .../approved`.
3. `node scripts/local3d.mjs model <id>` makes `model-local.glb` (about 10 min).
4. `node scripts/runworld-post.mjs <id> [--levels=low]` makes norm, low, mid and high.
   - `fix: ['mirror-z'|'plain-back']` repairs an invented back.
   - `reach: 3` lengthens the bake ray for deep recesses.
5. Review: `blender -b --factory-startup -P scripts/render-angles.py -- out.png zips/runworld/assets/<id>/low.glb`, and the same for the high.
6. `node scripts/runworld-pack.mjs <ids>` writes `apps/web/src/assets/gen/*.glb` (low, inline), `apps/web/public/hd/<id>/` and registry.json (all Git LFS). Commit and push.

## 4. State right now
- **Done today (2026-10-12):**
  - the audio fixes (1c081bc0);
  - the Studio plan and briefs (TASK-17 and 18);
  - the four-angle review of every model, with the hidden sides fixed (ab224da5);
  - 14 rule-breaking models redone and packed (5a8c098f).
- **10 lab clutter props, packed and pushed (fa3395fb):** crate-large, crate-small, cardboard-stack, filing-cabinet, server-rack, locker, toolbox, coolant-can, sample-case and old-monitor. The re-baked operator-console and preset-bench lows went in with them. **They are not yet placed in the lab.**
- **Dropped** (`hold` set): crate-stack-sheet, machine-under-sheet, fallen-panels and parts-bin. The owner's rule: no cloth, no heaps.
- **lod-bake.py, fixed today:**
  - a ray miss fills with the model's colour instead of black;
  - `--reach` (`reach` in the manifest);
  - every material is de-metalled for the colour bake, because the plain-back lows had baked black.
- **The window scene:** the plan is `docs/WINDOW_SCENE_PLAN.md` and the brief `docs/prompts/sidecar/19-window-scene.md` (TASK-19, dispatched to a Haiku sidecar on 2026-10-12 afternoon; it commits after each step and posts [PROGRESS] on the board, so read the board to see how far it got).
- **Six vista pieces:** datacentre-hall, chiller-block, shipping-container, pylon-tower, overpass-segment and rubble-slab.
  - Images approved; the models were running on the 3D PC.
  - **If they are not packed yet:** for each id, check that `zips/runworld/assets/<id>/low.glb` exists (if not, `node scripts/local3d.mjs model <id>`, then `node scripts/runworld-post.mjs <id>`). Then render the angles, review, `node scripts/runworld-pack.mjs <ids>`, and commit.
- **TASK-17 (Studio shell) is PAUSED.** Its WIP is in `zips/studio-wip-2026-10-12/`: `git apply tracked.patch`, then copy the files back.

## 5. The game plan, in order
1. **Finish the props:** pack the accepted ids above and commit the gen and hd folders. Wiring them into the lab as clearable clutter (clear one to free floor for a machine, and it yields salvage) is a brief still to write.
2. **The window scene (the owner's current ask, top priority):**
   - Pack the vista pieces.
   - Dispatch TASK-19 to a Haiku sidecar, or build steps 1 and 2 yourself if they need the architect: the vista render pass and the S-space pocket shader are the risky parts.
   - Review the shots against plan §3 (composition) and §9 (budget).
3. **The Studio:** resume TASK-17 from the zip, then TASK-18 (the asset bench and one-click redo; the weapon bench is the test case).
4. **Smaller items:**
   - Turn on `USE_MODULAR_SCOUT` once the aerial is raycast onto the shell and the packed yoke shows.
   - Re-check VEHICLE_FIT for the redone hauler body.
   - Check the watermaker's 7.74 × 6.30 m footprint on its hardpoint.

## 6. Hard rules
- **Git:** shared tree. Commit only your own paths with `git commit -- <paths>`. Never `add -A`, `commit -a`, stash, reset, checkout or restore. Commit manifest edits straight away.
- **Secrets:** never enter credentials, and never print or commit tokens.
- **Admin:** ask before large downloads, firewall changes or publishing; admin commands go to the owner to run.
- **Arena:** never vote; at most 2 tabs.
- **Art and research:** concept art comes only from the art agent; research before you design (CLAUDE.md §3.4).
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
