# Arena battle prompts: status

The plan is `docs/ARENA_PLAN.md`; the protocol is `docs/handoff/CATCHUP.md` section 3 with the rules of 12d (small prompts, two battles at a time, reply route, STOP sentence). Every prompt here asks for the reply route: two code blocks, `src/index.ts` and `tests/<name>.test.ts`. Collect them with `scripts/arena-recv.mjs` (or copy them from the page), then merge as `packages/<name>/` with a package.json, the tsconfig path and the vite alias, run the tests, wire the glue.

| Wave | Prompt | Package | For | Status |
|---|---|---|---|---|
| A1 | `gizmo.txt` | `@hm/gizmo` | F1 transform gizmo (move, rotate, scale, snapping, +/- size) | MERGED 2026-10-04 (answer A, 24 tests; B failed the view ring) |
| A2 | `selectset.txt` | `@hm/selectset` | F1 box, lasso, pick, groups, locks | MERGED 2026-10-04 (answer A with its toggle fixed; 4 flawed extra tests dropped; 15 tests) |
| A3 | `primitives.txt` | `@hm/primitives` | F3 building blocks as voxel models | MERGED 2026-10-04 (answer A, 22 tests; both passed ours) |
| A4 | `soundscape.txt` | `@hm/soundscape` | F5 emitters, ambience zones, mix, 8 ambiences | MERGED 2026-10-04 (answer A, 15 tests) |
| A5 | `triggers.txt` | `@hm/triggers` | F7 zones, wires, gates, actions | MERGED 2026-10-04 (answer A, 9 tests; B went into agent mode) |
| A6 | `npcbrain.txt` | `@hm/npcbrain` | F9 simple character AI | MERGED 2026-10-04 (answer A; one flawed extra test dropped: radius-0 wander walking home is right; 28 tests) |
| A7 | `physmat.txt` | `@hm/physmat` | F11 physical materials, toy physics, push hammer | MERGED 2026-10-04 (answer A, 7 tests) |
| A8 | `particles.txt` | `@hm/particles` | F12 particle system and 12 presets | MERGED 2026-10-04 (second chat; 17 tests) |
| B2 | `voxelcsg.txt` | `@hm/voxelcsg` | F3 join, carve, cut, crop, hollow, fill, pieces | MERGED 2026-10-04 (answer B, 18 tests; A failed hollow) |
| B4 | `lightplace.txt` | `@hm/lightplace` | F6 light presets, fall-off, cone, flicker, pick the lights that matter | MERGED 2026-10-04 (answer B, 11 tests; both passed ours) |
| B3 | `walkpath.txt` | `@hm/walkpath` | F4 paths with waits; once, loop, ping-pong; smooth curves | MERGED 2026-10-04 (answer A, 11 tests) |
| B5 | `camtrack.txt` | `@hm/camtrack` | F8 camera keys, eases, orbit shot, slow motion | MERGED 2026-10-04 (answer A, 26 tests) |
| B1, B6, B7, C1-C5 | (to write; see ARENA_PLAN section 2) | | | planned |

Each prompt's acceptance tests were worked through by hand (numbers checked); still, when a test fails against a good implementation, check my arithmetic before blaming the model (CATCHUP 11).

Send order: A1 + A5 first (the gizmo and Logic's wires are what the owner and his brother asked about), then A3 + A8, A2 + A7, A4 + A6.
