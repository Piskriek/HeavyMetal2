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
| musicbox | `docs/handoff/prompts/battle/musicbox.txt` | **X** (the one answer posted in the chat) | 9/9 tests, strict typecheck clean. |
| chunkworld | `docs/handoff/prompts/battle/chunkworld.txt` | **X** (the first answer finished) | 9/9 tests, strict typecheck clean. |
| pixels | `docs/handoff/prompts/battle/pixels.txt` | **B** | 9/9 tests, strict typecheck clean. A: 7/8 (its place test fails). |
| questline | `docs/handoff/prompts/battle/questline.txt` | **A** | 8/8, strict clean; B also 8/8 (A has the larger test file). |
| machines | `docs/handoff/prompts/battle/machines.txt` | **B** | 11/11, strict clean. A: 12/14. |
| market | `docs/handoff/prompts/battle/market.txt` | **B** | 10/10, strict clean. A: 8/9. |
| rocket | `docs/handoff/prompts/battle/rocket.txt` | **B** | 10/10, strict clean. A: 12/13 (its floating-part test expects exactly one problem). |
| ragdoll | `docs/handoff/prompts/battle/ragdoll.txt` | **A** | 9/9, strict clean. B: 8/9 (blend). Cross-run: A fails B's "sticks keep their length" (tolerance; raise iterations or loosen to 2%), B fails A's knee limit. |
| navgrid | `docs/handoff/prompts/battle/navgrid.txt` | **B** | 9/9, strict clean. A: 10/13 on its own tests (water, box snap, reachable), and A passes B's 9/9. B fails A's water/reachable tests and its cellOf test (A floors; the spec puts cell centres at c*cell, so B rounding is right). Check water handling with a real island before merging. |
| hull | `docs/handoff/prompts/battle/hull.txt` | **X** | 8/8, strict clean (the other model built in its own project, not collected). Large (1200 lines) but genuine: degenerate cases, Jacobi OBB. |
| remesh | `docs/handoff/prompts/battle/remesh.txt` | **X** | 13/13, strict clean (the other model built in its own project, not collected). |

## Merged (2026-10-05)

All 17 picks above are copied to `packages/<name>/` with `@hm/<name>` in tsconfig.json and apps/web/vite.config.ts. Repo typecheck clean; every package passes its tests. Two fixes for the repo typecheck: hull dropped an unused `add`, and pixels dropped a test line reading a `grid` field that does not exist. None is wired into the game yet (the glue is in RELEASE_PLAN).

## Not gathered yet (2026-10-05)

Arena started asking for a reCAPTCHA security check, and chats sent after that were never saved. These prompts are written and ready, but have no answers yet:

- `docs/handoff/prompts/battle/toolanims.txt` (B7)
- `docs/handoff/prompts/battle/tooljuice.txt` (B6)
- `docs/handoff/prompts/battle/smoothvox2.txt` (smoothvox rev 2: surfaces, triplanar, tangents, draw groups)

Worth a second answer to compare (only one model answered in chat): hull, remesh, musicbox, chunkworld.
