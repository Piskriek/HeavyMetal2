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
- **The music 404s** in the base-building log: music-monster-mash, music-driving and music-moon-s6 exist in `public/audio`, so check the test server's root. Rename the music-monster-mash context to "monsters" while there.
- **The step-7 stall** in `test-base-building.mjs` (seen once in TASK-20).
- **Tracked shots rewritten by test runs:** make the test scripts write to gitignored folders, and commit one reviewed set per area.
- **The timing tests** (fieldkit, plotgrid, lattice-accept, scenedoc undo): make them measure fairly under load (warm-up, best of three). Never just raise a limit without saying so in a comment.
- **The GTX 950M frame check** (TASK-19 V7's method).

## Report
A [DONE] on the board:
- a table of every test with its real result;
- the bugs fixed (with their commits) and the bugs logged;
- the fps table;
- a shot per act.

Opus reviews it and pushes `main`.

## Additions from Argo's master plan (P0-PROD-01, owner-approved 13 October)
- Give the HUD's overlays `data-hud-zone` attributes (title, build-hint, subtitle, quest, hotbar). At every e2e shot, assert zero overlap between the title, build-hint and subtitle boxes.
- **A clean-shot flag** (`?cleanShot=1`) hides the pointer-lock prompt and the debug UI for review shots.
- **Avatar luminance:** in the third-person Moon shot, the mean luminance of the avatar's pixel patch must be above 35/255, so a black-avatar regression fails the run.
