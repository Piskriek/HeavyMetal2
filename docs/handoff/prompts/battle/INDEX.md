# Arena battle prompts: status

The plan is `docs/ARENA_PLAN.md`; the protocol is `docs/handoff/CATCHUP.md` section 3 with the rules of 12d (small prompts, two battles at a time, reply route, STOP sentence). Every prompt here asks for the reply route: two code blocks, `src/index.ts` and `tests/<name>.test.ts`. Collect them with `scripts/arena-recv.mjs` (or copy them from the page), then merge as `packages/<name>/` with a package.json, the tsconfig path and the vite alias, run the tests, wire the glue.

| Wave | Prompt | Package | For | Status |
|---|---|---|---|---|
| A1 | `gizmo.txt` | `@hm/gizmo` | F1 transform gizmo (move, rotate, scale, snapping, +/- size) | MERGED 2026-10-04 (answer A, 24 tests; B failed the view ring) |
| A2 | `selectset.txt` | `@hm/selectset` | F1 box, lasso, pick, groups, locks | sent 2026-10-04: https://arena.ai/c/01a105f1-f11b-7f0e-8b32-b503274f0c0b |
| A3 | `primitives.txt` | `@hm/primitives` | F3 building blocks as voxel models | MERGED 2026-10-04 (answer A, 22 tests; both passed ours) |
| A4 | `soundscape.txt` | `@hm/soundscape` | F5 emitters, ambience zones, mix, 8 ambiences | ready, not sent |
| A5 | `triggers.txt` | `@hm/triggers` | F7 zones, wires, gates, actions | MERGED 2026-10-04 (answer A, 9 tests; B went into agent mode) |
| A6 | `npcbrain.txt` | `@hm/npcbrain` | F9 simple character AI | ready, not sent |
| A7 | `physmat.txt` | `@hm/physmat` | F11 physical materials, toy physics, push hammer | ready, not sent |
| A8 | `particles.txt` | `@hm/particles` | F12 particle system and 12 presets | resent 2026-10-04 (first chat: "Something went wrong"): https://arena.ai/c/01a105f1-3948-7c88-9f4a-71e1d97dde92 |
| B1-B7, C1-C5 | (to write after wave A merges; see ARENA_PLAN section 2) | | | planned |

Each prompt's acceptance tests were worked through by hand (numbers checked); still, when a test fails against a good implementation, check my arithmetic before blaming the model (CATCHUP 11).

Send order: A1 + A5 first (the gizmo and Logic's wires are what the owner and his brother asked about), then A3 + A8, A2 + A7, A4 + A6.
