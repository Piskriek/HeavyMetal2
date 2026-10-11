# TASK-14: test-day readiness (the owner plays tomorrow)

**Owner, 2026-10-11:** "id love it if i can hit run tomorrow and have a working build we can test all day".
- `PLAY.bat` builds the game and serves `apps/web/dist` on http://localhost:8080 (`scripts/serve.mjs`).
- The production build is what the owner runs, so everything below runs against it: `npm run build`, then the suites, which already serve dist.

## 1. One fresh playthrough, end to end (new script `scripts/test-playthrough.mjs`, Playwright, against dist)
Start from a clean profile, as the owner will, and drive the first hour in order. Capture a shot at each beat into `docs/shots/playthrough/` and look at every one.
1. The main menu loads, then Expedition starts a new game.
2. **Act I:**
   - waking speaks A1-01, with the subtitle showing;
   - looking at the power wall gives A1-02;
   - the breaker, then the lever: the relays light in order and the coils light bottom to top;
   - power on gives A1-04.
3. **Act II:** looking at the window gives A2-01; approaching the gate gives A2-02; the gate opens.
4. **The Moon:**
   - stepping through gives A3-01, with the stage-0 Moon and its music;
   - place the first machine on a hardpoint (A3-03): its plume rises from the machine.
5. **Building:** a foundation, then a wall and the roof pieces from TASK-13. The pieces show their generated models.
6. **Rover:** fabricate or enter a rover. The driving music crossfades in and the motor sounds.
7. **Monster Mash:** mobs engage, the combat music plays, and a kill plays M-02.
8. **Reload the page:** the save loads and Act I does NOT replay.

Throughout:
- Collect `console.error` messages and failed requests (404s). The goal is zero; list any that remain.
- Measure FPS at each beat at the default Graphics setting (this laptop is the minimum spec: i7-6700HQ, GTX 950M). Report it per beat.

## 1b. Three bugs found in TASK-13 (`docs/SIDECAR_COMMS.md`, b21fb7eb): fix these first; the owner will hit them
1. **Stairs cannot be walked.** `apps/web/src/base/walk.ts` has an analytic surface for ramps only, so the player stops at the foot of the stairs.
   - Add a stairs surface. Its rise follows the treads: 3 m over 4 m, the same slope as the ramp, so a smooth incline at the stairs' slope is acceptable if steps are hard.
   - Assert in the test that the camera climbs at least 2.5 m up the flight. TASK-13's test currently only reports it.
2. **E on an aimed door toggles it while building.** In build mode E must place the piece; a door toggles only outside build mode. Building next to a door currently opens the door instead.
3. **Ray hits on `windowWall` and `door` land about 2 m off in some views:** aiming through a window hits behind it.
   - Find the cause. Suspects: the generated mesh's placement inside the piece group from TASK-10b (an offset applied twice?), or `pieceIdFromHit` / the batcher's `idAt`.
   - Test it: aim at the centre of a placed window wall and a door from 3 m, and assert the hit lands on that piece within 0.3 m.

## 2. Fix what breaks
Fix any beat that fails, any error and any 404, at its cause. A fix outside your understanding (the sim packages, the asset pipeline): post a `[QUESTION]` instead.

## 3. The four open fixes from the TASK-10d review (`docs/SIDECAR_COMMS.md`, 2026-10-11 18:25)
1. The plinth deck is plain light-grey steel, with hazard bands only on the step edges.
2. The control boxes are wall-mounted at about 1.4 m: no posts.
3. The Act I spawn and the `42-act1-dark.png` shot are from beside the cot, looking north at the gate and the storm.
4. The storm shots are framed on the window, so storm 0, 0.5 and 1 read.

## 4. Run the existing suites against the new build
`test-fidelity-sync-studio`, `test-planet-monstermash`, `test-base-building`, `test-mentor-narration`, `test-music-sfx`, `e2e-smoke`. All must pass. Fix any that fail.

## Done when
- The playthrough passes all eight beats on a fresh profile, with zero console errors (or each remaining one listed with its cause).
- The four lab fixes are in, and every suite passes.
- Typecheck shows 0 errors, and the full `npm test` is green except the two known `fieldkit`/`plotgrid` timing tests.
- Commit your own paths and push. Post `[DONE]` with a short test guide for the owner: how to run, what to try, and known issues. The owner reads this first thing in the morning, so keep it plain and short.
- Git: never restore or check out files you did not change.
