# Next wave: status (2026-09-25)

All work is on `fix/flash-followups`, one commit per ticket, each gated on `node scripts/check.mjs`
passing (899 tests at the end, 898 pass, 1 skipped: a file-symlink case Windows can't create without
developer mode). `npm run check:slow` (soak) passes too.

| Ticket | Status | Commit | Notes |
|---|---|---|---|
| C2 | Done | 2e0758d | Safety copies at 522 and 523 props (two builder tabs disagreed), authorised baseline; the dev server writes an add-only copy whenever the track grows. |
| H2b | Done | 0af68f9 | Baked segment-index tables; results exactly equal the binary search. 100 racers × 1000 ticks: 163 → 114 ms. |
| H5 | Done | 04f9d97 | Thumb controls for coarse pointers, through `engine.dispatch`. |
| H6 | Done | 29908a0 | 1 s rope-goblin reel. Reuses `anim-33-rope-heave-trio` (no new art). |
| H7b | Done | 12d15b1 | Dev-only ROPE drawer; the config rides on the sim context. |
| H8 | Done | 2697bb2 | Camera kick, yoke jolt, thud; reduced motion keeps 10 % and flashes instead. |
| H9 | Done | 7e2215a | Gap chip plus a 100-dot strip map (canvas, no per-frame allocation). |
| H10 | Done | 5691aad | `src/game/input/gamepad.ts`, hysteresis, rumble. |
| H11 | Done | 2b4ada4 | Ram tactics, 0.3 s (rookie 0.5 s) wobble tell; parity fixture keeps the legacy coin flip. |
| H12 | Done | 4d074d9 | The soak test needed `--expose-gc` (it counted garbage as a leak). |
| H13 | Done | 9e8d128 | Guide, handbook, canvas label, loading screen and Controls settings. |
| M2 | Part a | cbf9910 | Size budget (600 MB, 25 MB per file) and `npm run report:art`. **Owner decision:** WebP conversion changes image quality and the pipeline's output paths; 93 MB of pipeline source sheets could move to `art-src/` if the art scripts read from there. |
| M3 | Not done | — | `vite-plugin-singlefile` inlines dynamic imports, so lazy-loading cannot shrink the race's download (measured: same size). **Owner decision:** keep the single-file build or split chunks. |
| M5 | Done | 2c232e0 | Push is the only start; placement no longer floats un-grounded balls ~210 units. The command contracts keep their sling envelopes for the frozen sims. |
| M6 | Done | b50091d | |
| M7 | Done | 5853b04 | ~16 draw calls for 100 balls (13 distinct ball textures). |
| M8 | Part a | d3dd0a1 | Prop catalog and backup service extracted (3,849 → 2,980 lines). The rest is `M8b-split-builder-ui.md`. |
| M9 | Done | fa8d7f1 | Spinner hash (seed, tick, racer id); `engine.dispatch` with the T01 gate. |
| M10 | Done | e2afbdc | `EngineRacerState.course` is required; no module global. |
| M11 | Done | d7f6481, 8df5435 | One UI update per animation frame; memoised LanePanel with stable handlers. |
| M12 | Done | 2e0758d | An idle builder sends nothing. |
| M13 | Done | c218a56 | Moved to an ignored `archive/`, nothing deleted. |
| M14 | Done | a934a37 | `docs/RACE.md`. |
| P1 | Already fixed | — | Both gauge plates have exactly two openings and all four have dials (art re-cut 2026-09-24). No blank ring exists. |
| P2 | Done | 6079991 | Glass and cracks are drawn (SVG), no generated art. |
| P3 | Done | 98c634a | Also carries an unrelated renderer tweak from a parallel session (ball emissive), swept in by `git add`. |
| P5 | Done | b491ecb | |
| P6 | Done | 7b7de4a | |
| P7 | Done | cdb2ace | Presentation only; the pool's scheduling is unchanged. |
| P8 | Done | 5bc30ad | |
| P9 | Done | 40b4ca8 | |
| P10 | Done | b62c275 | |
| P11 | Done | 5939c56 | Honorary only; points unchanged. |
| X4–X17 | Proposals | — | Left for the owner to pick, as the dispatch says. |

Not verified in a browser (the pane was hidden for the later tickets): H6, H8, H9, P2, P3, P5, P6, P7, P9, P10, P11.
Their logic is covered by tests, but they have not been looked at in the running game.
