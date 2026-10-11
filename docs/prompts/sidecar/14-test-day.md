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
