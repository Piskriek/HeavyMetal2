# 31 — Creative & Technical Review of TASK-24 (Full Campaign E2E & Merge Gate to `main`)

> **File Destination in Repo:** `docs/argo/plans/31-review-task-24.md`
> **Author:** Gemini Argo (Creative Lead)
> **Reviewed Commits:** `d9b29575` (`TASK-23c` Lab Clutter, Lunar Wrecks & Forensic Logs) & `TASK-24` (`24-campaign-e2e.md` Full E2E Regression Suite)
> **Date:** 14 October 2026
> **Verdict:** **READY FOR `main` MERGE GATE** (Subject to the 6 automated assertions and visual checks below; transitions immediately into **Milestone Wave B: Sidecar Briefs 25–27**).

## 1. What Landed Cleanly Leading Into `TASK-24`

1. **`TASK-21c/d` (Beam Tool, Armoured Suit Lighting & Sculpt/Save):**
   - Armoured suit rim/hemisphere floor and real-size (`1.0x`) Beam Rifle IK/animations wired alongside `Sculpt` mode and save/load persistence.
2. **`TASK-22` (Acts IV–VI Campaign Quest Chain):**
   - Full progression from `A4-01` (Armory rifle pickup) $\to$ `A4-02` (mine 50 dirt & refine) $\to$ `A4-03` (Studio schema inspect/edit) $\to$ `A4-04` (Stage 2 color bloom) $\to$ `B-01..B-05` (Foundation & Linked Bin).
3. **`TASK-23b` (Monsters in World via `@hm/leaksim` & `@hm/shareware`):**
   - All 6 archetypes wired with non-destructive `sapper` brownout behavior (`Rule 23`) and `25 m` Gate safe zone.
4. **`TASK-23c` (`d9b29575` — Lab Clutter, Wreck Props & Bridge Incident Logs):**
   - All 10 lab clutter props and lunar wreck transponders placed in-world with the forensic micro-logs (`LOG-01` to `LOG-08` from `Plan 10` / `Plan 26`), keeping `old-monitor` and `server-rack` as permanent inspectable fixtures (`DEC-01`).

## 2. `TASK-24` Verification Matrix (`scripts/e2e-smoke.mjs` & `scripts/test-*.mjs`)

Verify that the `[DONE] TASK-24` report in `docs/SIDECAR_COMMS.md` confirms green status across all 6 gates before fast-forwarding `main`:

| Check ID | Script / Gate | Required Pass Condition | Creative / UX Watch Item for Wave B |
| :--- | :--- | :--- | :--- |
| **`GATE-01`** | `npm run typecheck` & `npm test` | `0` TypeScript errors; all pure-package unit suites (`@hm/fidelity`, `@hm/plotsim`, `@hm/leaksim`, `@hm/questline`, `@hm/structure`, `@hm/lattice`) green. | Confirm `Stage 0a/0b` and `12 kW` / `2 kW` constants match `Briefs 26–27`. |
| **`GATE-02`** | `scripts/test-campaign.mjs` | Deterministic headless walkthrough completes Acts I $\to$ VI (`A1-01` through `B-05`) with zero soft-locks on Ore or Dirt. | Acts VII–IX (`Plan 26`) and the Credits Video (`Brief 33`) layer cleanly on top of `B-05`. |
| **`GATE-03`** | `scripts/test-planet-monsters.mjs` | Monsters spawn outside the `25 m` Twin Gate safe zone, `sapper` units brown-out rather than destroy structures (`Rule 23`), and `Seal` mode closes rifts. | Visual unification via the `S-Space Containment Leak Shader` (`fidelity-mob.ts`) follows in `Brief 30`. |
| **`GATE-04`** | `scripts/test-lab-clutter.mjs` (`d9b29575`) | Holding `E` dissolves floor clutter into salvage + unlocks `LOG-01..08`, while `old-monitor` and `server-rack` remain permanent inspectable fixtures. | Add the stateful 2nd/3rd inspection jokes (`Plan 29` §2.2) and `"Four Floats (Overclocked)"` replay (`Brief 33`) in Wave C. |
| **`GATE-05`** | `scripts/e2e-smoke.mjs` (Tour Screenshots) | All tour screenshots capture without uncaught page errors or WebGL context loss, using `?cleanShot=1` to hide pointer-lock prompts (`Rule 24`). | Inspect `07-moon-stage0.jpg`, `10-foundation-placed.jpg`, `12-rover-driving.jpg`, and `14-beam-third-person.jpg` to confirm baseline before Wave B overwrites them. |
| **`GATE-06`** | `dist/index.html` Bundle Size (`POL-27`) | Single-file bundle builds cleanly (`<= 18.0 MB` pre-Wave-B, targeting `<= 16.0 MB` once `low.glb` `Int16` quantization runs). | Keep all new audio tracks (`v4b` and `Overclocked`) streamed from `public/hd/audio/` with `@hm/musicbox` fallback. |

## 3. Creative Issues Still Visible in `TASK-24` Screenshots (Why Wave B Starts Immediately After Merge)

Even with `TASK-21c/d` through `TASK-24` passing all functional tests on `feat/monster-mash-exploration`, four visual/UX issues remain intentionally queued for **Milestone Wave B (`Briefs 25, 26, 27`)** immediately after merging to `main`:

1. **Moon Arrival HUD Overlap & Full-Screen Build Modal (`07-moon-stage0.jpg`, `09-build-menu.jpg`) $\to$ Fixed by `Brief 25`:**
   - `Brief 25` enforces the 9-zone non-overlapping HUD grid, converts `B` into the `136px` bottom-docked build ribbon, culls 3D machine labels to raycast aim, and wires the 6 stage-reactive `data-fidelity` HUD skins (`Plan 28`).
2. **Prototype Red Foundation Slabs (`10-foundation-placed.jpg`) $\to$ Fixed by `Brief 26`:**
   - `Brief 26` swaps the red slab/blue ring geometry for the packed Sheet 13 gunmetal box-section frames with raycasted telescoping legs, wires the `25 m` Twin Gate Coherence Safe Dome, and sets the `12 kW` Gate baseline with proportional brownout.
3. **Stage 0a Wireframe / Stage 0b Flat-Facet Dither & Rover Camera Clipping (`07-moon-stage0.jpg`, `12-rover-driving.jpg`) $\to$ Fixed by `Brief 27` & `27b`:**
   - `Brief 27` implements the single-pass depth-reconstructed `Stage 0a` hidden-line wireframe $\to$ `Stage 0b` 1-bit flat-faceted `Obra Dinn` dither shader, fixes the Rover spring-arm terrain clipping with a heightfield floor clamp, and switches on `USE_MODULAR_SCOUT` (`Brief 27b`).
4. **Late-Game Campaign (`Acts VII–IX`) & Real-Time Credits Video (`"Four Floats" v4b`) $\to$ Fixed by `Briefs 28–33`:**
   - `Briefs 28–33` complete the Lab power-up choreography, the 3D Window Breach heal (`lab-vista.ts`), the Suit-Cam CMOS shader (`Plan 25`), the 17-line Dr. Haddy voice batch (`Plan 29b`), and the 144 BPM in-engine credits music video (`Brief 33`).

## 4. Immediate Next Step After `TASK-24` Green

1. Fast-forward merge `feat/monster-mash-exploration` into `main`.
2. Dispatch **Sidecar Brief 25** (`25-hud-9zone-and-build-ribbon.md`), **Sidecar Brief 26** (`26-foundation-frames-and-safe-dome.md`), and **Sidecar Brief 27 / 27b** (`27-stage0-dither-and-rover-cam.md` / `27b-vehicles-and-turrets.md`).
