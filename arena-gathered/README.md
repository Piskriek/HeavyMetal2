# Arena battle answers, gathered for implementation

Collected on the `arena/gather` branch (owner, 2026-10-04: "gather code from arena ai ... then you will have all the battle ai work ready for implimentation"). Nothing here is wired into the game. To merge one, copy the chosen answer to `packages/<name>/` (`src/index.ts`, `tests/<name>.test.ts`), add a `package.json` (`@hm/<name>`), then the tsconfig path after `@hm/physmat` and the vite alias, as `merge.cjs` did in the earlier sessions (CATCHUP 12ad).

**Collecting:** read each answer's `pre` `textContent` only **after reloading the chat page**. While a battle is still streaming, the page drops pieces of code around `<` (for example `size[1] <= limit && size[2]` came out as `size[1][2]`).

| Package | Prompt | Use | State |
|---|---|---|---|
| vox | `docs/handoff/prompts/battle/vox.txt` | **B** | 15/15 tests, strict typecheck clean. Its own test read the XYZI chunk at the wrong offset (fixed: content size at byte 48 is 12; a second bogus offset check dropped). A: 5/9, fails the acceptance test (kept for reference). |
| schematic | `docs/handoff/prompts/battle/schematic.txt` | **B** | 11/11 tests after one typo fixed in its dye table (`['brown': 'brown' as const, ...]` became `['brown', [0.45, 0.28, 0.15]]`); strict typecheck clean. A wrote its files into its own Arena project instead of the chat (not collected). |
| puppet | `docs/handoff/prompts/battle/puppet.txt` | **A** | 13/13 tests, strict typecheck clean. B: 8/9 (its toAngles of a raised arm fails). |
| decals | `docs/handoff/prompts/battle/decals.txt` | **B** | 11/11 tests after its own slope test was fixed (lifting 1 cm along a tilted normal also moves x: `pos[0]` is `1 - 0.01 * SQRT1_2`); strict typecheck clean. A wrote into its own project (not collected). |
| kart | `docs/handoff/prompts/battle/kart.txt` | **B** | 9/9 tests, strict typecheck clean (A was still writing when collected). |
| kinematic | `docs/handoff/prompts/battle/kinematic.txt` | **B** | 11/11 tests, strict typecheck clean. A fails 5 of 10, including the wall acceptance tests (kept for reference). |
| musicbox | `docs/handoff/prompts/battle/musicbox.txt` | **A** (rerun 2026-10-05; was X) | A: 8/8 own + X's 9/9, strict clean. X let a lead note run into the last half beat of the loop (against the spec), caught by A's test; packages/musicbox now uses A, with X's tests kept as musicbox-x.test.ts (17/17). The other rerun model's answer was cut short. |
| chunkworld | `docs/handoff/prompts/battle/chunkworld.txt` | **X** (the first answer finished) | 9/9 tests, strict typecheck clean. Rerun 2026-10-05: X still the pick. B 9/9 strict clean, A 9/9 but 10 strict errors. The one disagreement is "retried at most twice": X and B allow 2 retries (3 attempts), A allows 2 attempts; decide when wiring. |
| pixels | `docs/handoff/prompts/battle/pixels.txt` | **B** | 9/9 tests, strict typecheck clean. A: 7/8 (its place test fails). |
| questline | `docs/handoff/prompts/battle/questline.txt` | **A** | 8/8, strict clean; B also 8/8 (A has the larger test file). |
| machines | `docs/handoff/prompts/battle/machines.txt` | **B** | 11/11, strict clean. A: 12/14. |
| market | `docs/handoff/prompts/battle/market.txt` | **B** | 10/10, strict clean. A: 8/9. |
| rocket | `docs/handoff/prompts/battle/rocket.txt` | **B** | 10/10, strict clean. A: 12/13 (its floating-part test expects exactly one problem). |
| ragdoll | `docs/handoff/prompts/battle/ragdoll.txt` | **A** | 9/9, strict clean. B: 8/9 (blend). Cross-run: A fails B's "sticks keep their length" (tolerance; raise iterations or loosen to 2%), B fails A's knee limit. |
| navgrid | `docs/handoff/prompts/battle/navgrid.txt` | **B** | 9/9, strict clean. A: 10/13 on its own tests (water, box snap, reachable), and A passes B's 9/9. B fails A's water/reachable tests and its cellOf test (A floors; the spec puts cell centres at c*cell, so B rounding is right). Check water handling with a real island before merging. |
| hull | `docs/handoff/prompts/battle/hull.txt` | **X** | 8/8, strict clean (the other model built in its own project, not collected). Large (1200 lines) but genuine: degenerate cases, Jacobi OBB. Rerun 2026-10-05: X also passes A's 9/9 and B's 11/11. A (16k chars, 9/9, strict clean, passes X's tests) is a smaller drop-in if X proves slow; B has 6 strict errors. |
| remesh | `docs/handoff/prompts/battle/remesh.txt` | **X** | 13/13, strict clean (the other model built in its own project, not collected). Rerun 2026-10-05: B is 5/8 on its own tests, and X fails the same 3 (L shape, two colours, hollow box), so B's expected numbers are likely wrong; X stays. The other model posted only fragments. |
| smoothvox2 | `docs/handoff/prompts/battle/smoothvox2.txt` | **A** | 20/20, strict clean. B: 6/7. Cross-run: A fails B's "surface blend splits a border" (check the one-ring rule before wiring); B fails 3 of A's. |
| toolanims | `docs/handoff/prompts/battle/toolanims.txt` | **A** | 23/24, strict clean; its one failure is its own strict check of the can's three shakes (tune the data). B: 19/20; its failing step-key sample test looks wrong (A fails it too). Cross-runs fail on each other's data-specific tests, as expected for hand-made data. Review the motion by eye in the Animate tab. |
| tooljuice | `docs/handoff/prompts/battle/tooljuice.txt` | **B** | 18/18, strict clean. A: 13/13 but one strict typecheck error. Cross-runs fail on each other's data-specific tests (hand-made data). |

## Merged (2026-10-05)

All 17 picks above are copied to `packages/<name>/` with `@hm/<name>` in tsconfig.json and apps/web/vite.config.ts. Repo typecheck clean; every package passes its tests. Two fixes for the repo typecheck: hull dropped an unused `add`, and pixels dropped a test line reading a `grid` field that does not exist. None is wired into the game yet (the glue is in RELEASE_PLAN).

## Merged in arena/gather2 (2026-10-05)

smoothvox2 (A), toolanims (A) and tooljuice (B) are copied to packages/ with tsconfig paths and vite aliases. toolanims: the can's wiggle keys were made slightly asymmetric (+0.22/-0.2) so its own sign-change test does not land a sample exactly on zero (24/24). musicbox switched to A (see its row).

## Arena notes

Arena sometimes shows a reCAPTCHA; a chat sent while it is up is lost (the link bounces to the home page). The owner completes the check, then resend. Vote buttons only enable once both builds load, so prompts now ask for a small preview page.

## SetMix: The Resolution Crafter (2026-10-06)

The winner of the side session's concept battles (battle 4, answer A, out of 8 concept answers) kept working in the same chat for eleven more phases; all of it is gathered in `setmix/` with its own README. One model per phase, so there is no A/B pick. The audit (its tests, its claims) and the landing waves are in `docs/SETMIX_LANDING.md`.

## SetMix: the first Play and the plot (2026-10-07, `docs/SETMIX_PLAN.md` Phases 2b and 3)

Battles sent in Code Arena (Battle mode), one self-contained module each, collected and tested here before landing.

| Package | Prompt | Chat | State |
|---|---|---|---|
| labkit | `docs/handoff/prompts/battle/labkit.txt` | https://arena.ai/c/01a114b4-5730-76c3-bccc-670dc0d848f6 | **Neither** (not voted: A never finished, so the vote never unlocked). Both answered as agents with projects, not chat code blocks. A sat in "Running command" for over 5 hours after inventing a postinstall package to run its tests. B (`labkit/B`, read from its project's editor) is plain boxes and cylinders (its own notes: "visual quality is secondary"), no better than our stand-ins in `apps/web/src/play/kit.ts`, and fails 3 of 13 tests, 2 of them acceptance tests (the gate sinks 4 cm into the floor; the frame is the wrong size). Rerun as labkit v2 with tests that measure detail. |
| plume | `docs/handoff/prompts/battle/plume.txt` | https://arena.ai/c/01a115d7-4191-7add-a707-531d7da35eab | **B** (claude-sonnet-5-5-high), landed as `packages/plume`. B wrote into its project (collected from its editor, with its preview page `B/src/preview.ts`): 19/19 own tests and the acceptance tests, strict typecheck clean, sRGB colours converted to linear (our planet target is linear), one draw call per way, the motion in the vertex shader with its constants generated into the GLSL. Two changes on landing: its timing test is named `performance:` (verify runs those alone), and dither sprites are drawn 1.22 times wider (a tumbling cube covers 1.5 faces of screen on average, so the sprites now read as full as the cubes). A (gpt-5.4): pasted its code and also wrote a slightly different copy into its project (both kept, `A/` and `A-project/`); 10/10 own tests, but 7 strict errors, no preview, sRGB colours used as linear, and it fails 6 of B's tests. |
| labkit v2 | `docs/handoff/prompts/battle/labkit-v2.txt` | https://arena.ai/c/01a115da-dbf7-738b-b748-528652e8c955 | running (sent 2026-10-07): the same API, "the look is the job", triangle minimums, merged draw calls |
| plotterrain | `docs/handoff/prompts/battle/plotterrain.txt` | https://arena.ai/c/01a114cf-75b0-78bf-a80e-1a0a05f7b398 | **B** (gpt-6-luna-max), landed as `packages/plotterrain`. Both pass the 5 acceptance tests and strict typecheck. B: 9/9 own tests after one fix (red soil faded with the rock weight itself, so it never dominates beside rock on crater rims; its own test caught it); 1.14 M heights a second on this laptop; the map reads as natural ground (dust, gravel, red soil, rimmed craters, rock). A (claude-opus-5.5-low): 10/11 (its own speed test: 0.56 M heights a second); its map had maze-like raised lines. |
| groundshader | `docs/handoff/prompts/battle/groundshader.txt` | https://arena.ai/c/01a114d0-6882-7f53-aae8-a068f5c5921a | **A** (gpt-6-luna-max), landed as `packages/groundshader`. Both pass the 4 acceptance tests and strict typecheck. A: 7/7 own tests; on our own terrain (side by side, same camera and sun) stage 1 reads as natural low-res desert (gravel, dust, red soil bands) and stage 6 as detailed stones. B (claude-opus-5-max): 13/15 own tests (a seam in one channel, its speed test); stage 1 drew flat saturated red and grey blotches. Tiles at 256 px take about 0.7 s on this laptop: the first Play builds 128 px on Low. |
