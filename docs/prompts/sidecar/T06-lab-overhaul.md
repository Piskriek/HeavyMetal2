# T06: the lab overhaul, the wall stations, the gate's coil ignition and the window vista (TICKET-06)

**Spec:** OPUS_NOTE_16 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket06/`, Argo's bundle, all under `apps/web/src/play/`:
- `lab-room.ts` (full replacement, built on T07a's version with the armory rack);
- `lab-machines.ts` (new) and its test;
- `lab-power.ts` and its test;
- `lab-vista.ts`, `lab-vista-math.ts`, and a new `lab-vista.test.ts`.

**Model brief** (for Opus's generator batch, not this ticket): `docs/argo/notes/ARGO_NOTE_09_ticket06_models.md`.

**Opus's staging run:** 29 of 30 lab tests pass. Argo's four files match the repo as of T07a, so copy them.

## Fix while installing
1. **The power re-export.** Argo's `lab-room.ts` dropped `export { POWER_OFF, POWER_ON, POWER_SECONDS, powerAt, type Power } from './lab-power';`, and `play-scene.ts` and `lab/lab-scene.ts` import those names from `lab-room`. Put the line back.
2. **The 1-bit pocket rim.** Argo tinted it `[0.85, 0.96, 1]`. 1-bit means pure white, so restore `[1, 1, 1]`. The existing `lab-vista-math.test.ts` ("the rim of each pocket is its own colour") then passes.
3. **The missing test.** Argo cites draw-call budgets from a `lab-room.test.ts` that doesn't exist. Measure instead (see Verify).

## Do
1. **Install** the files above with fixes 1 to 3, and run their tests and the existing lab tests (`lab-vista-math`, `lab-clutter`).
2. **The wall stations.**
   - The Preset Rack, Bench and Combiner keep their positions, so the existing aim and E prompts in `play-scene.ts` and `play.tsx` still find them. Check that E on each still opens its panel.
   - The new Hardware Fabricator station and the Planet Table need a `play-scene.ts` aim change, which Flash owns. That goes to Flash as F-13. Don't touch `play-scene.ts`.
3. **The gate's coil ignition** (Argo's `coilLevels` and `coilsLitAt` in `lab-power.ts`) must play over 3.5 s when the lever is pulled, through the existing power sequence. If it truly needs a `play-scene.ts` change, stop and report it.

## Verify
- **A new `scripts/test-lab-overhaul.mjs`,** with shots of each item compared against the old ones in `docs/shots/lab/`:
  - the ceiling (no black boxes);
  - the left wall (no stretched smudge);
  - the right wall: the four machines distinct, standing on the floor, cabled to the overhead tray, none floating;
  - the gate (no floating orange rectangles);
  - the coil ignition at 0, 1.75 and 3.5 s after the lever;
  - the window at storm 0, 0.5 and 1, in all three window views (static, lite, full), with no pink or purple cubes.
  Look at every shot yourself.
- **Budget:** on the laptop at Low, record the lab's draw calls (`renderer.info.render.calls`) and fps before and after the install. Draw calls must not rise by more than 10%, and fps must not drop. Report both pairs of numbers.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new test, `test-ticket07a`, `test-campaign` (45 of 45), and the single-file build under 16 MB (it was 14.82 MB after T08b; report the new size).

## Stay inside
`apps/web/src/play/lab-room.ts`, `lab-machines.ts`, `lab-power.ts`, `lab-vista.ts`, `lab-vista-math.ts` and their tests, and the new test. Never touch `play-scene.ts`, `plot-ground.ts`, `plot-biome-view.ts`, `water-surfaces.ts` or `packages/groundshader`: those are Flash's work in progress. `play.tsx` is T36P1's (running alongside you); don't edit it.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
