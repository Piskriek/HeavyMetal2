# T10: the wave band, monster wall pathing, the foregrip IK, and play-scene Window A (TICKET-10)

**Spec:** OPUS_NOTE_19, and Argo's `docs/argo/notes/ARGO_NOTE_12_ticket10_window_a.md` (the bundle manifest and the Window A merge guide: each hook's function and its line of context). **Source:** `arena-gathered/argo-ticket10/`. **Opus's staging run:** all 11 unit tests pass across his 5 new test files.

**Start only when Opus opens `play-scene.ts` for you** (one writer at a time: TPOL, then T11b, then this).

## Read this first: copy or merge
- **Copy** (new files, or unchanged since Argo's snapshot):
  - **New modules and tests:** `packages/leaksim/src/wall-pathfinder.ts`, `apps/web/src/avatar/two-bone-ik.ts` and `packages/terrainbrush/src/seam-stitch.ts`, with their tests, plus `monster-rules.test.ts` and `portal-shaders.test.ts`.
  - **Changed files:** `packages/leaksim/src/index.ts`, `packages/terrainbrush/src/index.ts`, `monster-rules.ts`, `monsters.ts`, `beam-visuals.ts`, `rifle-hold.ts`, `portal-shaders.ts` and `machine-props.ts`.
  - Before copying each one, check it hasn't changed on HEAD since Argo's snapshot (`git diff 1392d1e9 HEAD -- <file>`). If it has, merge by hand instead.
- **Merge by hand:**
  - **`lab-vista.ts`:** TPOL changes it first (POL-102), so add Argo's +34 lines (the vista flash floor peak, POL-25) onto TPOL's version.
  - **`play-scene.ts`:** never copy Argo's file. It predates F-09's layout fix, TPOL's stage-look hook and T11b's Window B, and copying it would undo all three. Add his Window A section by hand, using the hook table in ARGO_NOTE_12, as one labelled block plus the call sites it lists.

## Do
1. **Install** the files above, and run their tests in the repo.
2. **Window A in `play-scene.ts`,** five hooks:
   - **The wave:** the band uniforms, the 30 m, 1 s machine-activation pulse, and the 350 m ring fade (P1-LIGHT-04, POL-52).
   - **The vista flash** peaks the floor light (POL-25).
   - **Third-person IK:** the left arm on the rifle's foregrip (POL-28).
   - **The beam ring** lifts to the slope's normal (POL-30).
   - **Monster nav:** navgrid walls and solids feed `monsters.update` (POL-32 pathing, POL-33 bolt blocking), and the machine housing status LEDs update (POL-39).
3. **POL-37:** check the fight overlay's readability at stages 1 and 6, and tune it as Argo specified.
4. **POL-29:** the seam stitch removes cracks between sculpted terrain chunks.

## Verify
- **A new `scripts/test-ticket10.mjs`:**
  - a ground monster routes around a built wall to reach the player, not through it;
  - a spitter bolt stops at a wall;
  - the wave band shows the triggering metric's colour, and the scan ring fades out by 350 m;
  - a machine's first activation pulses its 30 m surroundings for about 1 s;
  - in third person, the left hand sits on the foregrip (the hand bone within a few cm of the grip);
  - the beam ring sits flush on a slope;
  - a window lightning flash peaks the lab floor;
  - the status LEDs change with a machine's state (and are square);
  - sculpted chunk borders have no cracks.
  Save shots of each and look at every one.
- **Budgets:** stage 6 on Low stays at F-09's fps (`scripts/measure-stage6-low.mjs`); DRAWS near a fight shouldn't jump. Report the build size.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, `test-ticket10`, `test-ticket07a`, `test-planet-monsters` (if it exists), `test-lab-overhaul` and `test-campaign` (45 of 45).

## Stay inside
The files listed above, `play-scene.ts` (Window A and its call sites only), and the new test. Use POL-201 to POL-210 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
