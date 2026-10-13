# TASK-23: test everything, fix, report (before main)

After TASK-22. The owner wants "lots of testing to make sure its in", then main, to test on a faster machine.

## Do
1. **Run everything from clean:**
   - `npm run typecheck`, `npm test`, `npm run build`;
   - `npm run e2e`, `node scripts/test-base-building.mjs`, `test-planet-monstermash.mjs`, `test-mentor-narration.mjs`, `test-music-sfx.mjs`, `test-fidelity-sync-studio.mjs`;
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

## Report
A [DONE] on the board:
- a table of every test with its real result;
- the bugs fixed (with their commits) and the bugs logged;
- the fps table;
- a shot per act.

Opus reviews it and pushes `main`.
