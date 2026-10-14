# TASK-24: test everything, fix, report (before main)

After TASK-23 (the monsters). The owner wants "lots of testing to make sure its in", then main, to test on a faster machine.

## Do
1. **Run everything from clean:**
   - `npm run typecheck`, `npm test`, `npm run build`;
   - `npm run e2e`, `node scripts/test-base-building.mjs`, `test-planet-monsters.mjs`, `test-mentor-narration.mjs`, `test-music-sfx.mjs`, `test-fidelity-sync-studio.mjs`;
   - `node scripts/test-campaign.mjs` (the whole chain).

   Then run the campaign test 3 times in a row: it must pass every time (no flakes).
2. **A manual-style sweep with the debug hooks.** For each system, try the awkward cases and note what breaks:
   - building on a slope, then carving under a piece;
   - a full inventory;
   - driving into a mob;
   - dying while driving;
   - reloading mid-print;
   - entering the gate with the beam out;
   - a profile from before TASK-20.
3. **Fix what you can**, one commit per fix, each with a test that failed before it.
4. **The rest** goes into `docs/DEFERRED_POLISH_REGISTRY.md`, or the board if it blocks play.
5. **Measure:** fps on Low and Medium at four places (the lab, the gate, the base, mid-fight). Use the GPU launch flags from TASK-19 review 2 (V7) and log the renderer string.

## Also, carried from the reviews
- **The music 404s** in the base-building log (music-monster-mash, music-driving, music-moon-s6): the audio was fetched from root paths, fixed by Opus in 4f9187a0 (it now resolves beside the page). Check that the log is clean now. Rename the music-monster-mash context to "monsters" while there.
- **The step-7 stall** in `test-base-building.mjs` (seen once in TASK-20).
- **Tracked shots rewritten by test runs:** make the test scripts write to gitignored folders, and commit one reviewed set per area.
- **The timing tests:** `npm test` is now `scripts/test.mjs` (6e4b3ed4), which runs the `performance:` tests alone after the rest, and fieldkit and plotgrid pass there. For lattice-accept, scenedoc undo and any other timed test not named `performance: ...`, name it so, or make it measure fairly (warm-up, best of three). Never just raise a limit without saying so in a comment.
- **The GTX 950M frame check** (TASK-19 V7's method).

## Checkpoints for the owner's review (Opus, 14 October)
The owner will test everything as an objective observer (OWNER_ASKS, 14 October), and must reach each act without replaying the hours before it.
- **`scripts/test-campaign.mjs` saves a checkpoint at the start of each act** (I, IV, V and VI), plus one at stage 6 with the monsters unlocked. A checkpoint is every save key the game wrote for the profile (the play state, the base world, the beam, the chain, the inventory), as JSON in `apps/web/public/checkpoints/<name>.json`.
- **`?checkpoint=<name>` loads one into a separate "Checkpoint" profile** (created if missing, then made active), never into the player's own profile. It loads behind the loading bar. The main menu shows the checkpoints as a small list under Settings, only when the URL has `?checkpoint` or `?e2e`.
- **Tests:**
  - each checkpoint loads and lands in its act;
  - the player's own profile is byte-identical before and after;
  - an old checkpoint (from a previous save version) still loads, or says plainly why not.
- **Re-run the campaign test** to refresh the checkpoints whenever the save format changes; the checkpoint files are committed.

## Report
A [DONE] on the board:
- a table of every test with its real result;
- the bugs fixed (with their commits) and the bugs logged;
- the fps table;
- a shot per act.

Opus reviews it and pushes `main`.

## Additions from Argo's master plan (P0-PROD-01, owner-approved 13 October)
- Give the HUD's overlays `data-hud-zone` attributes (title, build-hint, subtitle, quest, hotbar). At every e2e shot, assert zero overlap between the title, build-hint and subtitle boxes.
- **To make that assertion pass now,** apply the three minimal rules from Argo's P0-UI-01. The full nine-zone grid is brief 25 (Wave B), not this task.
  1. **The radio subtitle** pins at bottom 108 px, above the hotbar, never higher than 160 px. Today it runs under the hotbar: docs/shots/campaign/17-a4-02-milled.png.
  2. **CANNOT PLACE** (base/ui/build-readout.tsx, base-hud.tsx) shows only while a placement ghost is shown, 36 px below the reticle.
  3. **Title cards** (`say()` in play.tsx) sit at top 72 px for 3 s and hold any other banner until they fade.
- **From TASK-23b-2 (fix before main; details on the board, 14 October 10:40):**
  - the sapper halves a latched machine's output (P0-MON-03);
  - monsters stay out of built pieces' footprints (push them out, or route them round);
  - the beam gun core ticks continuously while held;
  - fights read: a shot per era at stages 1 and 6 where you can tell what attacks you (tune the overlay down, never remove it);
  - fps on Low with 8 fighting, on the GPU.
- **From TASK-21d:**
  - `scripts/test-base-building.mjs` exits 1 since TASK-22's drafting lock: K is refused until the chain unlocks drafting. Fix the test by unlocking through the chain or the dev hooks; never remove or weaken the lock.
  - Campaign beat 10 (the reload comparison) flaked once; it now prints the differing paths. If the three runs show it, fix the race (snapshot after the base tick settles).
  - Measure sculpting on Low on the GPU; the sidecar's numbers were software-rendered.
- **From TASK-22b:**
  - with real input, walk to a freshly printed scout and press E; the test teleports, and lands the player 4 m away, outside E's 3.5 m reach;
  - add beats for the N-01 and N-02 sync lines;
  - beat 24 quick-stacks before forging, because the grants take the pack over 120 kg. Say whether the Act V kit should weigh less.
- **A clean-shot flag** (`?cleanShot=1`) hides the pointer-lock prompt and the debug UI for review shots.
- **Avatar luminance:** in the third-person Moon shot, the mean luminance of the avatar's pixel patch must be above 35/255, so a black-avatar regression fails the run.
