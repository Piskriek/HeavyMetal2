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

## 7. Live log (newest last)
- 2026-10-12, about 13:00: TASK-19's first pass was pushed (68f59686, 064a7f9e, bce7282d). It has the wiring, the setting and the tests, at 29 calls and 65k triangles. Shots are in docs/shots/window/. **REVIEW 1 was sent** (on the board):
  - the scale and distances are wrong (boxes crowd the glass);
  - no ground or horizon, and no fog depth;
  - the Breach must be the hero, a third from the left, rising past the top of the glass, glitch-sliced;
  - the pockets must float as full spheres, rendering their S inside;
  - storm clouds, not a starfield;
  - a crate through a pocket;
  - a fallback plane through the gate.
  
  The Haiku sidecar is working on it. If it stopped, re-dispatch TASK-19 with REVIEW 1 from the board.
- The vista models: five are packed (510f2314): hall, chiller (its own budgets, 1.5k low), container, pylon and overpass. rubble-slab was running (job bgd3yzmzw); when it lands, render the angles, then `node scripts/runworld-pack.mjs rubble-slab`, and commit.
- 2026-10-12 afternoon: all six vista models are packed (the rubble slab in 991968e1).
- **The overnight batch is running:** 40 subjects × 2 options (`<id>-a`, `<id>-b`), about 80 models, about 14 h. The ids are listed in `zips/runworld/overnight-ids.txt`, and the log is `zips/runworld/overnight.log` (POSTED, FAILED or NOIMG per id; "OVERNIGHT DONE" at the end).
  - The images were AUTO-approved, unreviewed.
  - **Next session:** render the angles of each pair, keep the better option (or neither), and pack the keepers.
  - **If the batch stopped:** re-run the same loop. It skips ids that already have high.glb (see the shell history in this file's commit message, or re-create it: for each id, images, then touch approved, then local3d model, then runworld-post).
- **The owner's new feature idea (2026-10-12, see OWNER_ASKS):** junked or broken models become "containment leaks". An object looks janky; the player seals the leak and uses a fidelity tool to restore it.
  - **The ladder:** broken junk, then our pack, then a RUN.world tier, then a max tier via the Meshy.ai API (its credits reset at the end of the month).
  - **NEVER delete junked models.** Next: research, then a plan doc, then the owner's sign-off.
