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
- **The 3D PC:** Hunyuan3D at 192.168.0.9:8082 (changed from .0.5 on 2026-10-12). The token is in `.local3d-token`; never print or commit it.
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
- **TASK-19 review 1 is done** (b1a5173a). The view now has depth: a horizon, fog, moving storm clouds, floating pockets and a crate dithering inside a pocket. It runs at 28 calls and 65k triangles. **Still open (review 2, next session):**
  - The Breach doesn't read as a tall column from beside the gate; make it taller, brighter and wider.
  - My ruling on pockets: each one projects its fidelity straight down onto the ground below as a soft disc, so the ground under it changes too.
  - The rubble-slab low doesn't load at runtime (still the box fallback).
  - The dust motes should be about 2× bigger.
  - R8 (the planet side through the gate) needs a shot.
  - Frame time on the GTX 950M is still unmeasured.
- **Overnight failures** (redo next session):
  - generator-small-a; server-crate-a/b (no image or model; they hit the IP change);
  - barrier-block-a/b: the model is there, but the low bake wrote no low-raw.glb. Try `runworld-post.mjs <id>` with `budgets` raised, or `lowInPlace`.
- **Overnight batch FINISHED (2026-10-13): 72 of 80 posted.** Failed: generator-small-a, server-crate-a/b, barrier-block-a/b, gantry-crane-solid-b, warehouse-small-b, sign-gantry-a. Next: review the 72 (four angles per a/b pair, keep the better), pack the keepers, redo the failures.
- The watcher also hit the low-bake failure on office-block-ruin-b (no low-raw.glb), the same error as barrier-block. The low bake step likely crashes on some meshes; check lod-bake.py's stderr for one of them first.
- **Batch 2 running (2026-10-13):** option c for all 40 subjects, plus redos of 6 failures. The log is zips/runworld/overnight2.log, ending in 'BATCH2 DONE'. Review a/b/c as a set.
- **2026-10-13, back on the first session (979660db):** the "FAILED ... low-raw.glb" lines were a race, not a bad bake. The overnight loop and `runworld-watch.mjs` posted the same id at once, and one deleted the other's temporary file. All the listed failures have their low, mid and high, except **server-crate-a** (no image or model yet). `runworld-post.mjs` now takes a per-asset `.posting` lock: a second run waits, then skips (or posts, if the first failed). That session's last compact summary is saved in `docs/sessions/compact-979660db.md`.
- 2026-10-13 13:15: **TASK-19 review 2 posted** on the board (V1 to V7: the Breach as hero, clear pockets that cast their fidelity on the ground, rubble-slab, 2× motes, the R8 shot, shots without overlays, frame time on the real GPU) and **dispatched to a Haiku sidecar**. Batch 2 was still running (28 posted at 13:00).
- **2026-10-13 afternoon, the master plan** (`docs/ONE_GAME_PLAN.md`; the owner: "first plan everything ... then do the plan"):
  - TASK-20 to 24: one game with every system hooked up, the beam tool, the campaign chain, the monsters, test everything. Then main, then the Studio (TASK-17, 18, 25).
  - Landed: `@hm/terrainbrush` (55735c9a).
  - The Arena brief `docs/prompts/battle/leaksim.txt` (the monster brain) is ready, its tests typechecked.
  - The research: `docs/MONSTERS_PLAN.md` and `docs/DLSS5_NEURAL_BAKE_RESEARCH.md`.
  - The owner's calls are open: plan §4.
- **2026-10-13, about 14:30:**
  - **Landed `@hm/leaksim`** (a1b242ea), the monster brain: Arena answer B, 10/10 as landed.
  - **Monster art downloaded** to `zips/monsters/` (the owner: "download whatever you need"): Freedoom, Blasphemer, LibreQuake and 50 Quaternius CC0 monsters, about 93 in all. TASK-23's prerequisites are met.
  - **The owner:** DLSS parked; the faster machine is an RTX 3080.
  - **Batch-2 review (a/b/c per subject):**
    - 19 picks made on the contact sheets, then a four-angle low review: 17 kept.
    - pallet-crates is dropped: a crumpled low, and a heap.
    - terminal-old-a is held: dark bake smudges; re-post it with `fix: ['plain-back']`.
    - The packs keep the option ids (for example `barrier-block-a`).
    - The rest of the subjects wait for batch 2 to finish: drum-square, generator-small, cart-flatbed, cable-reel-square, shelving-closed, specimen-freezer, gas-cabinet, server-crate, portable-office, comms-mast-solid, wrecked-van, container-crushed, datacentre-annex, silo-square, transformer-box, checkpoint-booth, office-block-ruin, battery-pack, workbench-old, crater-rim-chunk, chimney-square.
    - Hold: chimney-square (the owner's no-chimney rule); crater-rim-chunk (no option is good).
  - **Sidecars running:** TASK-19 review 2, and TASK-20 (one game).
- **2026-10-13 afternoon:**
  - TASK-19 is accepted after review 3: the Breach is a glitch-sliced column and the storm reads dark. POL-25 and POL-26 are logged.
  - 17 batch-2 props are packed (cb5d569e).
  - **TASK-23a** (the monster art pipeline, `docs/prompts/sidecar/23a-monster-art.md`) is dispatched beside TASK-20. Both run in Haiku sidecars and never share files.
- **Batch 2, finished (2026-10-13):**
  - 28 props are packed from the overnight sets (cb5d569e and fe265bd7). The registry holds 114 assets.
  - **Held for a re-bake** (dark patches in the low): drum-square-b, generator-small-a, battery-pack-a, cable-reel-square-a, container-crushed-a, terminal-old-a. Try `reach: 3` or `fix: ['plain-back']`, then check lod-bake.py's colour bake for shadowed interiors.
  - **Dropped or held:** cart-flatbed and pallet-crates (crumpled lows); server-crate and transformer-box (no clean low); chimney-square (the owner's rule); crater-rim-chunk.
  - **Not yet placed in the game.** The lab clutter and vista placement brief is still to write. The window vista can use the wasteland ones now.
- **The six held props are re-baked and packed** (bd20dbbd); the registry holds 120. The fix was `reach: 3`. On coarse 300-triangle prop cages, the low surface dips inside the model, so bake rays started inside and caught dark interior faces. **For any future prop whose low shows dark patches, set `reach: 3` first.**
- **2026-10-13 evening:**
  - **TASK-17 (the Studio shell) accepted:** STUDIO.bat, the editor layout, write-back, and the game reads the tweaks.
  - **TASK-21 part 1 accepted:** G draws and holsters the beam; Q or the wheel cycles its modes; the rifle clips are packed.
  - **Running side by side:** TASK-21b (beam: view model, third person, reload, Apply paint) and TASK-18 (Studio asset bench plus the weapon-bench model redo, with a scoped pipeline exception on the board).
  - **Next:** TASK-21c (Sculpt, saving, the campaign beats), then TASK-22, 23b, 23c and 24, then main.
- **2026-10-13 about 19:00, stale processes stopped** (owner: "turn off what you gotta turn off"):
  - the dev servers from 9 and 10 October (ports 5173 and 5192), a leftover Studio server on 5201, the Flash board watcher, the 5 October ui-editor;
  - the overnight asset watcher (`scripts/runworld-watch.mjs`). Restart it with `node scripts/runworld-watch.mjs` for a long unattended batch; the per-asset lock keeps it safe beside a loop.
  - HANDOVER now says sidecars stop their own servers.
- **The weapon-bench set** (owner: "model individual tools ... the bench and the tools cant be one object"):
  - nine assets: weapon-bench (empty, `yaw: 90`), bench-jig, bench-printer, tool-wall, tool-drill, tool-wrench, tool-mallet, tool-scanner, tool-screwdriver;
  - images reviewed; the printer was redone without a cable;
  - models running in `zips/runworld/bench-set.log`;
  - the bench and the jig are reviewed (four angles) and good;
  - pack the set when the rest pass review. TASK-23c places it.
- **Studio:** TASK-18 and 18b work committed as WIP (6f1f4ee9); TASK-18c finishes the last check.
- **2026-10-13 evening, later:**
  - **TASK-21b accepted:** the rifle in hand, first and third person, about 4 to 7 ore a second, R reload, Apply painting.
  - **The Studio (TASK-17/18/18c) is done:** test-studio passes 74 of 74.
  - **Running side by side:** TASK-21c (black character, rifle scale, rifle-clip retarget) and TASK-22 (the campaign chain). Next is TASK-21d (Sculpt, saving, the beats).
  - **The game files hold the new empty weapon bench**, from TASK-18c's stray pack. It is reviewed, but **uncommitted** until the weapon-bench set is packed: commit `apps/web/src/assets/gen/weapon-bench.glb`, `registry.json` and `apps/web/public/hd/weapon-bench/` with the set.
- **2026-10-13, Gemini Argo is creative lead** (owner). His intro is docs/argo/START_HERE.md, the rules docs/argo/RULES.md, an 18-shot tour docs/argo/TOUR.md; his plans come back into docs/argo/plans/. Keep the tour and START_HERE §4–5 current when big things change.
- **The weapon-bench set is packed** (d63ffca5): an empty bench (yaw 90), the jig, the printer, the tool wall and five tools; the registry holds 128. The drill's low is 700 triangles (300 shattered). TASK-23c places the set. Until then the lab's bench stands bare.
- **2026-10-13, late:**
  - **TASK-21c accepted:** the suit reads on the planet, and the rifle clips are properly retargeted (34 KB). POL-28 logged for two-hand IK.
  - **Running:** TASK-22b (finishing the campaign chain; rulings on the board) and TASK-23b-1 (the monster renderers, the window walkers, a preview page).
  - **Queued:** TASK-21d (Sculpt, saving, the beam beats) and TASK-23b-2 (monster wiring), both after 22b; then 23c and 24, then main.
  - Argo's tour is refreshed (shot 14).
- **2026-10-13, about 21:40: Argo's master plan** (owner-approved) is in `docs/argo/plans/ARGO_MASTER_PLAN.md`. Opus's review, with objections O1 to O8 for Argo, is `ARGO_MASTER_PLAN_REVIEW.md`. The agreed items are folded into the briefs for 21d, 23b-2, 23c and 24, and Waves B to D are in ONE_GAME_PLAN §6. Opus's own items: Astro's mid and high levels out of the single file (saves about 2.9 MB), the low-luminance check, a 16 MB gate.
- **2026-10-13, about 23:30:**
  - **Argo accepted all eight objections** (`docs/argo/plans/ARGO_MASTER_PLAN_REPLY.md`; where it differs from the plan, the reply wins). His 14 area plans are committed beside the master plan, whose links are unwrapped.
  - **Argo's chat is open in Opus's built-in browser** (the Gemini tab), so we can talk directly. Asked him for the P0-LORE-01 micro-log texts and Dr. Haddy's line for the Act IV dormant leak; they go to `docs/argo/plans/22-lore-micrologs.md`. His app was waiting on the owner's "Allow" for its remote browser.
  - **The size (0e3a6f2e):** the single file is 14.51 MB, from 17.93: Astro's mid and high levels moved to `public/hd/astro/` (LFS), and a duplicate QuickJS was removed. The build fails above 16 MB; POL-27 is closed.
  - **The luminance gate** (`scripts/surface-luminance.mjs`): low ≥ 0.18 and low/high ≥ 0.85. Post reports it; pack refuses a failure unless `lumOk`.
  - **4f9187a0:**
    - audio and voice resolve beside the page (the root paths broke sub-path hosting and disk);
    - `npm test` and `verify.mjs` run one list (six tests, the quest test among them, had been skipped by the green set; all pass);
    - TASK-23b-1 accepted, with an early-3D facing check carried into 23b-2.
  - **Running:** TASK-22b, resumed after the usage limit cut it off. **Next, one at a time:** 21d, 23b-2, 23c, 24. Then main.
  - **For the owner's test on the RTX 3080:** serve it (`npm run host`, or `npm run dev`). Opened from disk, the file plays without music, voice, HD models or the extra monsters, because browsers block those fetches.
- **2026-10-14, about 02:30:**
  - **TASK-22b accepted** (e469a673): the chain is complete through Act VI, and the double stage-line bug is fixed.
  - **The campaign test exits 0** (6e4b3ed4): 27 of 27, 0 console and 0 HTTP errors. The HD probe now GETs, and the Studio no longer asks its dev routes in the build.
  - **`npm test` is `scripts/test.mjs`:** one list for npm test and verify, with the speed tests alone after the rest. 2546 tests, 0 failures; speed tests 19 of 19.
  - **Running:** TASK-21d (Sculpt, saving, the beam's juice, the rim, the mode rib, a `setSealing` hook for 23b-2). Then 23b-2, 23c, 24, one at a time. Then main.
  - **All of Argo's waves are briefed:** 25 to 27 (a262cfb0) and 28 to 32 (d8754ca8). Brief 32 needs Opus's art pass first (sheets 17, 19, 20).
  - **To send Argo once his chat is free:**
    - his app was waiting on the owner's "Allow" for a remote browser, to read NARRATION_SCRIPT for the micro-log and Act IV lines;
    - (1) POL-23: his "leak" stand-ins are the harvest field nodes; brief 30 gives leaks and nodes one glitch-shard language. Confirm or overrule;
    - (2) POL-04 was closed on 8 October; brief 30 measures stages 4 to 6 before cutting;
    - (3) ask him to skim briefs 25 to 32 for misreadings.
- **2026-10-14, midday:**
  - **Governance changed:** the owner delegates creative and design calls to Opus and Argo (OWNER_ASKS 14 October; CLAUDE.md guard 3, Argo's RULES rule 5). The owner provides resources and unblocking, and reviews objectively. His explicit rules still bind.
  - **Argo's chat is in the built-in browser.** Click Allow on his remote-browser prompts (owner), and send with a JS click on the "Send message" button; see the argo-creative-lead memory.
  - **Accepted:** 21d (050baa24) and 23b-2 (d30a9ced, 714e0815): the early-3D axis fixed, leaksim in play, the id files out.
  - **Their open items** go to TASK-24 (in its brief): the sapper, walls, the beam core, fight readability, GPU fps, base-building's drafting lock, beat 10. TASK-24 also makes act checkpoints for the owner's review.
  - **Argo's docs:** 22-lore-micrologs, 23-brief-review (briefs 25 to 32 signed off) and 24-lore-expansion (Acts VII to IX, Vance through logs, the Earth-window finale). A4-LEAK-SEAL and A6-LEAK-SURGE are voiced (481466d3).
  - **To do after 23c:** switch the game's `showSubtitleOnly('A4-LEAK-SEAL', …)` in play.tsx to the voiced line, and voice the surge toast.
  - **Asked Argo:** the owner's "camera realism" idea (bodycam games hiding asset flaws with exposure and lens effects) → `docs/argo/plans/25-camera-realism.md`, then into brief 27 or a new brief.
  - **The owner's "Singularity" song,** which he says Opus made: not found online. Ask him for the link or file.
  - **Running:** TASK-23c (resumed after the usage limit). Then 24, then main.
- **2026-10-14, afternoon:**
  - **The ending song is final** (fddb8b8b): "Four Floats" v4b at 1.2x tempo, 144 BPM.
    - `public/audio/music-ending.mp3` runs to the switch at 2:40.73, just after her last line, "See you, Sector Four", which ends at 2:40.2.
    - `music-ending-loop.mp3` holds three copies of the 8-bar instrumental chorus; loop the middle one with `levels.json` start..end.
    - `music-ending-overclocked.mp3` is the 1.2x speed variant, for the old-monitor replay.
    - `scripts/music-outro.py` makes the cut and the loop: soft outro lines are found in 100 ms frames, the loop length comes from cross-correlation (the generated track drifts), and the wrap is crossfaded. The owner's feedback on the re-cut preview is pending.
  - **Argo's relay drop** (5d643ead) is in `arena-gathered/argo-relay/`: 90 files, unwired and unreviewed. Read its `TRIAGE.md`. It is the parts list for briefs 25 to 34; each brief lands, reviews and wires its own files.
    - His plans 29b (voice manifest), 31 (TASK-24 review frame) and 32 (drop index) are in `docs/argo/plans/`.
    - Briefs 33 (credits video) and 34 (song radio and machine choir) carry landing notes: the song is 144 BPM, not his 112 BPM or 1:57.
  - **To send Argo once his usage resets (16:13 on 14 October):** the drop is committed and pushed; please resend fixed versions of the files TRIAGE.md lists (the vitest tests as node:test, the strict index reads, the purity flags). Use only `rich-textarea .ql-editor` (see the gemini-input-selector memory).
  - **Running:** TASK-24 (resumed after the usage limit). Then main for the owner's test.
