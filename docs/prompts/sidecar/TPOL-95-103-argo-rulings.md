# TPOL: Argo's rulings on POL-95 and POL-98 to POL-103 (ARGO_NOTE_10 §1)

**Spec:** `docs/argo/notes/ARGO_NOTE_10_next_batch_ticket09_onward.md` §1, and the decisions in `docs/DEFERRED_POLISH_REGISTRY.md`. **Source:** `arena-gathered/argo-pol95-103/` (Argo's bundle, 11 files).

**F-09 (479d8ae0) and F-15 (5e77ed14) have both landed, so start now.** POL-95's Look tab half (`look-tab.tsx`, `levelsLabel`) went to Flash's F-16, since Flash is in the Studio files; don't touch `apps/web/src/studio/`.

## Read this first: what is safe to copy
- **Copy as they are** (built on the current repo): `packages/groundshader/src/index.ts`, `rift.ts` and `rift.test.ts`.
- **Merge by hand** (small deltas on current files): `lab-vista-math.ts`, `lab-vista.ts`, `lab-vista.test.ts` (POL-102).
- **Do NOT copy `lab-room.ts` or `lab-machines.ts`.** Argo built them on his own TICKET-06 bundle, not on what landed. Copying them would undo T06's draw-call pass (`mergeStaticMeshes`, the instanced plumes) and T06b's sheet 07 breaker panel and console (the isolator, toggles, keypad and lever). Apply POL-103's intent to the current files by hand (below). Take any of his new `lab-machines.test.ts` cases that still apply.

## Do
1. **POL-95, the Look tab and the stage 6 ground.**
   - In `@hm/groundshader`: the retuned `COVER_BASE_COLOURS` (moss `[0.115, 0.165, 0.078]`, grass `[0.145, 0.215, 0.092]`), the isotropic Worley tuft relief in place of the diagonal sine stripes, and a cover `slopeScale` and normal blend of 0.55.
   - The stage 2, 4 and 6 ground shots must still green strictly upward (`test-stage-world`'s G/R check).
2. **POL-100 and POL-98, the rift.**
   - Argo's `rift.ts` draws the rift as one mesh (one draw call) in its own unlit S-Space palette, with `userData.ignoreStageLook = true`.
   - The stage-look pass in `play-scene.ts` must honour that flag: draw flagged objects after the stage-look pass, or keep them out of it, whichever fits how that pass works. Find the pass first and describe it in your report.
   - The rift then reads as a magenta and cyan tear with a violet core at stages 0a, 0b, 3 and 6. Measure DRAWS near an open leak: about 60 now, about 1 expected.
3. **POL-101:** nothing to do. The EGA pocket stays cyan (Argo's call), and the 1-bit rim stays `[1, 1, 1]`.
4. **POL-102:** merge Argo's cold storm-slate ramp and symmetric 12-level quantisation across 0.125 ≤ vP < 0.75, `HORIZON_STORM` `[0.10, 0.13, 0.16]`, and the dusk `smoothstep(0.55, 1.0, p)`. At storm 0.5 in Lite and Full, no block may sample warm (R ≤ G ≤ B).
5. **POL-103, the lab's east wall, by hand on the current `lab-room.ts` and `lab-machines.ts`.**
   - Move the filing cabinet (LOG-03) to the south wall beside Dr. Haddy's desk (about x −0.35, z 2.48, yaw π).
   - The Hardware Fabricator faces the room. Argo says it sits at yaw +π/2 with its glass bay to the wall; check with a shot first, then set yaw −π/2.
   - Argo also says the rack, bench and combiner dressings face the wall. **Check each with a shot from the room before rotating anything:** T06's shots show the rack's shelves facing the room. Rotate only what really faces the wall.
   - The T06b breaker panel and console must stay exactly as they are.

## Verify
- Shots: stages 2, 4 and 6 ground; the rift at stages 0a, 0b, 3 and 6 (open and sealing); the window at storm 0.5 (Lite and Full); the east wall and the south wall. Look at every one.
- DRAWS near an open leak, and the lab's gate-view draw calls. The lab must stay at 185 or below.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, `test-stage-world`, `test-plot-biome`, `test-ticket07a`, `test-lab-overhaul` and `test-campaign` (45 of 45). Stage 6 on Low must stay at F-09's fps (`scripts/measure-stage6-low.mjs`).

## Stay inside
The files above, plus `play-scene.ts` for the stage-look hook only. Use POL-141 to POL-150 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
