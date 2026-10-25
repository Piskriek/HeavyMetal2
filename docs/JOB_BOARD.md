<!-- ROADMAP_PROGRESS_START -->
[![Release Progress](https://img.shields.io/badge/QA_Remediation-IN_PROGRESS-FF1E8E?style=for-the-badge&logo=target)](docs/argo/plans/ARGO_GRAND_MASTER_REPORT.md)
[![Rule 8a Status](https://img.shields.io/badge/Rule_8a_Audit-ENFORCING-yellow?style=for-the-badge&logo=checkmarx)](docs/argo/RULES.md)
[![Active Branch](https://img.shields.io/badge/Branch-feat%2Fmonster--mash--exploration-FF1E8E?style=for-the-badge&logo=git)](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration)

```text
FIDELITY: The SetMix Multiverse — QA Audit Remediation (ARGO_GRAND_MASTER_REPORT.md)
[████████████░░░░░░░░] 60.0% Complete (3/5 Waves Done | 45 Findings)

Wave A1: Physics & Colliders (LAB-10, GATE-04, BB-02)         [DONE]
Wave A2: Steering & Machine Inspector (VEH-02, BB-10, BB-11)   [DONE]
Wave A3: Stage Visual Differentiation (STAGE-01, STAGE-02)     [DONE]
Wave B:  Global Thumbnails & Texture Swatches (THUMB-01)       [OPEN]
Wave C/D: Specs A-D (Planetary Grid, Studio Suite, Nexus)       [OPEN]
```
<!-- ROADMAP_PROGRESS_END -->

# FIDELITY // MULTI-AGENT COMMAND CENTER & ROADMAP JOB BOARD
> **Launch Visual Command Center UI**: Double-click [`COMMAND_CENTER.bat`](../COMMAND_CENTER.bat) or run `node scripts/command-center.mjs` (`http://localhost:8090`).  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2` (`feat/monster-mash-exploration`)  
> **Live State & Handoff**: [`docs/RESUME.md`](RESUME.md) | **Overwatch & Tech Radar**: [`docs/OVERWATCH_TECH_AND_AI_RADAR.md`](OVERWATCH_TECH_AND_AI_RADAR.md) | **Polish Registry**: [`docs/DEFERRED_POLISH_REGISTRY.md`](DEFERRED_POLISH_REGISTRY.md) | **Flash Queue**: [`docs/sidecar/FLASH_INBOX.md`](sidecar/FLASH_INBOX.md)

---

## 0. OVERWATCH MANDATE: UNIVERSAL "PRESETS INSIDE PRESETS" INCEPTION
Every system in *FIDELITY: The SetMix Multiverse* is generated from **recursive presets inside presets** across all 6 Fidelity Stages ($S_0 \to S_6$). Zero one-off hardcoded assets, opaque `.glb` cores, or bespoke closures are permitted (`RULES 8a`):

| Domain | Rung 1: Atomic Nodes | Rung 2: Stack / Curve | Rung 3: Part / Clip / Stem | Rung 4: Kit / Behavior Assembly | Rung 5: World / Cartridge (`cartlab`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **3D Parts & Kits** ([Plan 38](argo/plans/38-parts-modules-presets.md)) | `@hm/partgen` primitives | `@hm/meshops` 27-op stack | Socketed Part Preset (`part:`) | `@hm/kitspec` Machine/Rover/Gate Kit | Part Cartridge + `aimKitPart()` |
| **Materials & Tiles** ([Plan 41](argo/plans/41-layered-materials.md)) | `@hm/texgraph` periodic nodes | `TILE_LIBRARY` + mask generators | `@hm/matstack` 5-level layer | Multi-layer Material Preset (`mat:`) | Material / Layer / Solvent Cartridge |
| **Sprites & 2D Shareware** ([Plan 39](argo/plans/39-one-pattern-preset-factories.md)) | `@hm/texgraph` + `@hm/skin` | Palette + Bayer dither curve ($S_0 \to S_6$) | `@hm/shareware` 8-angle sprite frame | Animated Sprite Sheet / Billboard Kit | Skin / Sprite Cartridge |
| **Motion & Animation** ([Plan 43](argo/plans/43-modular-motion-and-logic-presets.md)) | `@hm/kinematic` curves & impulses | Stage rate (`8 Hz` $S_0 \to$ `60 Hz` $S_6$) | `LocomotionPreset` (`loc:`) & `KitMotionSpec` | `@hm/anim` + `@hm/motion` IK & state graph | Motion / Gait Cartridge |
| **Code, Logic & AI** ([Plan 43](argo/plans/43-modular-motion-and-logic-presets.md)) | `@hm/triggers` condition/action atoms | `@hm/wiregraph` signal wires | `LogicPreset` (`logic:`) réflex rule | `@hm/npcbrain` utility/FSM assembly | Logic Cartridge (Doors, Turrets, Iris) |
| **Audio & Lighting** ([Plan 39](argo/plans/39-one-pattern-preset-factories.md)) | `@hm/soundlab` osc/filter & IES curves | Envelope + flicker + harmonic stack | Synth patch / Stem / Lamp (`lx:`) | `@hm/musicbox` stage stems + light rigs | Light & Sound Cartridge |
| **Flora & Biomes** ([Plan 42](argo/plans/42-modular-stargate-earth-endgame.md)) | `@hm/treegen` L-system / space colonization | Bark + Foliage `@hm/matstack` | Species Preset (`aq:`) | `PlotBiomePreset` (Terrain + 6 Species + Sky) | Species Cartridge + Earth Sandbox |

---

## 1. HOW AGENTS PICK UP JOBS FROM ANYWHERE (MODULAR ROLES, NOT MODELS)
Jobs name a **Role** (a capability slot), never a model. Whichever environment the Overseer wakes in (Claude Code with Opus/Sonnet/Haiku, or Antigravity with Gemini Argon/Flash or Claude), [`docs/agents/roster.json`](agents/roster.json) maps each role to the best model available there. Guide: [`docs/agents/ROSTER.md`](agents/ROSTER.md) · Installed skills: [`docs/agents/SKILLS_INVENTORY.md`](agents/SKILLS_INVENTORY.md).

| Role | Task shape | Claude Code | Antigravity |
| :--- | :--- | :--- | :--- |
| `OVERSEER` | Board, radar, routing, audits | main session | main session |
| `ARCHITECT` | No spec yet, taste, preset design | main session (Opus) | main session (Argon or Opus) |
| `ENGINEER` | Correctness, parity, perf, public APIs | main session, or Sonnet high + Opus review | main session / `pro` |
| `BUILDER` | Clear brief, 2–12 files, has Verify | Sonnet, high effort | `flash` |
| `RUNNER` | One-file, mechanical | Haiku, high effort | `flash_lite` |
| `RIG` | Real GPU / long visual suites | `scripts/test-on-3dpc.sh` | `scripts/test-on-3dpc.sh` |

Each job may list **Skills** (tags such as `frontend`, `route`, `visual-verify`); load them *before* reasoning. Legacy names `ARGO/OPUS/FLASH/HAIKU/3DPC` still work and map to `ARCHITECT/ENGINEER/BUILDER/RUNNER/RIG`.

- **Wake-time inventory (Overseer, every session)**:
  ```bash
  node scripts/skill-inventory.mjs
  node scripts/agent-worker.mjs --dispatch --env <claude-code|antigravity>
  ```
- **Watch for the next open job for a role (polls local file + optional GitHub fetch)**:
  ```bash
  node scripts/agent-worker.mjs --watch --role <ARCHITECT|ENGINEER|BUILDER|RUNNER|RIG|ANY> [--github]
  ```
- **List all jobs (or filter by role/status)**:
  ```bash
  node scripts/agent-worker.mjs --list [--role ENGINEER] [--status OPEN]
  ```
- **Claim a job (marks `[TAKEN]` and records which model took it)**:
  ```bash
  node scripts/agent-worker.mjs --claim <JOB-ID> --by "<model>@<env>" [--push]
  ```
- **Complete or update a job (marks `[REVIEW]` or `[DONE]` with commit SHA)**:
  ```bash
  node scripts/agent-worker.mjs --complete <JOB-ID> --status DONE --sha <COMMIT_SHA> --note "Verified typecheck + tests" [--push]
  ```

---

## 2. ACTIVE ROADMAP MILESTONES
- **M1 — Layered Materials & Procedural Tile Library ([Plan 41](argo/plans/41-layered-materials.md))**: 5-level `@hm/matstack` stack, GLSL/CPU parity, Rule 8a mask/channel fixes, solvent cartridge, 20 procedural tile graphs (`TICKET-41`), coverage tuning, and GTX 950M uncapped perf gate.
- **M2 — From-Scratch Modular Machine & Vehicle Kits ([Plan 38](argo/plans/38-parts-modules-presets.md) / `TICKET-40`)**: Rebuild all machines and vehicles from `@hm/partgen` + `@hm/kitspec` parts with zero wrapper shortcuts (`RULES 8a`), starting with `MILL_V2`, then press, watermaker, fabricator, hauler, and crawler.
- **M3 — Bring Your Own Agent & Full Studio Workspaces ([Plan 40](argo/plans/40-bring-your-own-agent.md))**: `window.studioAgent`, `studio-skill.md`, `studio.capture` (4-angle + mask views), `studio.kit.validate`, T29 part-split retopo button, and full Studio Materials/Parts/Species/Lights workspaces.
- **M4 — Stargate Network, Co-Op & Stage-6 Earth Endgame ([Plan 42](argo/plans/42-modular-stargate-earth-endgame.md))**: Movable gates (`moveGate`), gate privacy (`open` | `code-only` | `closed`), random explorer gate dialing (`dialRandomGate`), and Stage-6 Earth Plot restoration sandbox.
- **M5 — Previous QA Rounds & E2E Regression Fixes (`POL-01..314` / `F-01..28` / `T01..T28`)**: Verification of Wave 1 & Wave 2 bundles (`T18..T28`), failing E2E smoke/base-tab fixes, Lab & Window vista QA fixes, combat/rover E2E checks, and GPU timer hooks.
- **M6 — Modular Spore Creatures & Multiverse Game Presets ([Plan 44](argo/plans/PLAN_44_MODULAR_SPORE_CREATURE_KITS.md) & [Plan 45](argo/plans/PLAN_45_MULTIVERSE_GAME_PRESETS_AND_SPORE_CARDS.md))**: Rebuild avatar and 37 roster monsters as pure 5-Rung `@hm/creature` kits (-5.5 MiB bundle reduction), `MultiverseGamePresetSpec`, URL gateway (`/?world=&game=&rig=`), and Steganographic PNG Spore Cards.

---

## 3. JOB QUEUE

## ═══════════════════════════════════════════════════════════════════════════
## ACTIVE FOCUS: QA AUDIT REMEDIATION (ARGO_GRAND_MASTER_REPORT.md)
## ═══════════════════════════════════════════════════════════════════════════

## JOB-QA-01 [DONE] Wave A1: Physics & Colliders (LAB-10, GATE-04, BB-02)
- **Role:** ENGINEER
- **Skills:** `physics`, `collision`
- **Priority:** P0 (BLOCKER)
- **Milestone:** QA-W1
- **Paths:** `apps/web/src/play/lab-room.ts, packages/labkit/src/index.ts, apps/web/src/base/walk.ts, apps/web/src/play/play-scene.ts`
- **Verify:** `node --import tsx --test packages/labkit/tests/labkit.test.ts apps/web/src/play/lab-machines.test.ts packages/structure/tests/*.test.ts`
- **Assigned:** `OVERSEER@antigravity`
- **Updated:** 2026-10-25 20:05

1. Added solid AABB boundary & prop colliders across Lab room and closed gate aperture blocker (`LAB-10`).
2. Broadened Moon Twin Gate colliders to match full Stargate kit bounds (4.02m x 3.44m x 1.97m) with dialing pedestal and closed iris aperture blocker (`GATE-04`).
3. Fixed base building foundation and floor step-up reach (`Math.max(maxStepUp, groundY + 1.35)`) and exempted walkable foundation top decks from horizontal barrier pushing (`BB-02`).

## JOB-QA-02 [DONE] Wave A2: Vehicle Steering & Field Machine Interactions (VEH-02, BB-10, BB-11)
- **Role:** ENGINEER
- **Skills:** `controls`, `ui`
- **Priority:** P0 (BLOCKER)
- **Milestone:** QA-W1
- **Paths:** `packages/rover/src/index.ts, packages/rover/tests/rover.test.ts, apps/web/src/play/play-scene.ts, apps/web/src/play/play.tsx`
- **Verify:** `node --import tsx --test packages/rover/tests/rover.test.ts`

1. Fixed inverted vehicle steering physics sign (`Rhx = Fhz; Rhz = -Fhx;`) so pressing `D` (+steer) turns right (+X) and `A` (-steer) turns left (-X), and aligned visual wheel steer angle (`steer * maxSteer`) (`VEH-02`).
2. Wired `[E]` on placed field machines to open the `MachineInspector` modal directly for base hardpoint machines and plot machines (`BB-10`).
3. Wired `[E]` on placed field benches and weapon benches to open drafting and weapon modding (`BB-11`).

## JOB-QA-03 [DONE] Wave A3: Stage Visual Differentiation (STAGE-01, STAGE-02)
- **Role:** ARCHITECT
- **Skills:** `shaders`, `visual-verify`
- **Priority:** P0 (BLOCKER)
- **Milestone:** QA-W1
- **Paths:** `apps/web/src/play/portal-shaders.ts, apps/web/src/play/play-scene.ts`
- **Verify:** `node scripts/test-stage-looks.mjs`

1. Fixed TDZ ReferenceError in `createPlayScene` (`gateOn` and `powerT` declaration order).
2. Damped screen-space facet deviation in `portal-shaders.ts` (`dampedFacet` clamped to `+-0.05`, 10% mix), dropping the 5-degree yaw flip fraction from 12.3% to 7.3% (below the 10% target).
3. Verified full visual pass with `node scripts/test-stage-looks.mjs`: 13/13 checks pass.

## JOB-QA-04 [OPEN] Wave B: Global 3D Model & Procedural Texture Thumbnails (THUMB-01, BEAM-01, BEAM-02)
- **Role:** BUILDER
- **Skills:** `frontend`, `ui`
- **Priority:** P1
- **Milestone:** QA-W2
- **Paths:** `packages/ui, apps/web/src/shell/hud.tsx, apps/web/src/play/beam-tool.ts`
- **Verify:** `npm run typecheck`

1. Replace generic SVG icons across Hotbar, Build Menu, and Inventory with real 3D offscreen renders (`THUMB-01`).
2. Add live 64x64 `@hm/texgraph` procedural texture swatch thumbnails and cycle hotkeys to Beam Rifle Apply mode (`BEAM-01`).
3. Decouple Sculpt mode sub-keys (1, 2, 3) from Hotbar slots (`BEAM-02`).

## ═══════════════════════════════════════════════════════════════════════════

## JOB-01 [DONE] Uncapped GTX 950M performance gate & GPU timer hook (Plan 41 + POL-294)
- **Role:** ENGINEER
- **Skills:** `perf`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `scripts/perf-layered-material.mjs, apps/web/src/play/play-scene.ts`
- **Verify:** `node scripts/perf-layered-material.mjs`
- **Updated:** 2026-10-22 13:08

1. Measure `layered-material.ts` on the GTX 950M laptop (Medium, 1080p) with frame-rate limiting disabled (`--disable-frame-rate-limit` or WebGL `EXT_disjoint_timer_query_webgl2`) so the 60 Hz vsync cap does not mask the delta between plain and 6-layer materials.
2. Expose a GPU timer hook in `PlayScene` (`POL-294`) so real GPU ms can be measured for both 6-layer materials and 4-turret Low-spec scenes. Confirm Lab gate view stays <= 181 draw calls (`POL-314`).

## JOB-02 [DONE] TICKET-40 v5: Modular Mill kit typing, palette test & matstack shelf coverage tuning
- **Role:** BUILDER
- **Skills:** `visual-verify`
- **Priority:** P0
- **Milestone:** M2
- **Paths:** `packages/kitspec, packages/matstack, apps/web/src/play/kit-modules.ts, apps/web/src/play/kit-mill-v2.ts`
- **Verify:** `npm.cmd run typecheck && node --import tsx scripts/material-coverage.mjs`
- **Updated:** 2026-10-22 13:08

Address all open review items in `OPUS_NOTE_41` v4:
1. Fix strict typecheck in `kit-modules.ts` line 444 (`MATSTACK_TEST_PIECE_KIT`: annotate `kind: 'param' as const` or type as `Kit`).
2. Update `kits.test.ts` ("defines the 4d two-material trim palette") to include `khaki-paint` and `hopper-slate`.
3. Tune `@hm/matstack` shelf coverage: reduce `rust-bloom` face coverage from 67% down to 5–15% patches, restrict `oil-leaks` (currently 40% of faces) to streaks under edges/crevices, make `soot` visible (currently 0%), and keep `moon-dust` off the dark `crushed-ore-bed` hopper top (currently 84%).
4. Verify with `scripts/kit-compare-sheet.mjs` from all 4 angles before installing.

## JOB-03 [DONE] TICKET-41: 20 procedural texgraph tile graphs & 6 new periodic nodes
- **Role:** ARCHITECT
- **Skills:** `visual-verify`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `packages/texgraph/src/index.ts, packages/texgraph/tests`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Commit:** `2800ff3 (tile library 97c9678)`
- **Updated:** 2026-10-22 13:08

Implement `OPUS_NOTE_44_tile_library.md`:
1. Add 6 periodic, deterministic nodes to `@hm/texgraph`: anisotropic `noise` (`scaleY`), `scratches`, `spots`, `hex` (`'edge'` | `'cell'`), `weave`, and wrapped `blur`.
2. Build `TILE_LIBRARY` with all 20 required tile graphs: `brushed-metal`, `cells`, `cast-iron`, `pits`, `fine-grain`, `orange-peel`, `stripes`, `rubber-grain`, `concrete`, `carbon-weave`, `hex-micro`, `flake-scale`, `grime-clouds`, `regolith-grain`, `moss-clump`, `frost-crystal`, `mud-splatter`, `mineral-crust`, `scorch-burn`, `scratches`.
3. Add unit tests for validation, determinism, seamless wrap-edge continuity, grey percentile spread (>= 0.35), non-constant height, and < 25 ms @ 128px evaluation budget.

## JOB-04 [DONE] Rule 8a matstack fixes: Layer ordering, coat/aniso writes, coplanar edge dedup & Solvent Cartridge
- **Role:** ENGINEER
- **Skills:** `shader`, `frontend`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `packages/matstack/src/index.ts, packages/matstack/src/mask-mesh.ts, packages/matstack/src/shelf.ts, packages/cartlab, apps/web/src/studio`
- **Verify:** `node scripts/test-layered-material.mjs && node scripts/test-material-cartridge.mjs`
- **Commit:** `959a74c`
- **Updated:** 2026-10-22 13:08

Implement the 4 Rule 8a catches from `ARGO_NOTE_43` + Plan 41 step 4:
1. **Mechanical abrasion on top:** Ensure `edge-wear`, `paint-chips`, and `scratches` evaluate above `dirt`/`rust-bloom` so sharp convex edges expose bright metal (`maxMetal > 0.45`).
2. **Suppress coat/aniso bleed-through:** Include `'coat'` and `'aniso'` in `writes` for opaque weathering layers (`rust-bloom`, `heavy-rust`, `dirt`, `grime`, `dust`, `moon-dust`, `moss`) so underlying clearcoat/anisotropy does not bleed through mud or rust.
3. **Coplanar edge deduplication (`mask-mesh.ts`):** Deduplicate colinear `SharpEdge` segments sharing the same `(inward, dot(a, inward))` line before `.slice(0, EDGE_LINES)` on notched polygons with > 4 boundary edges.
4. **Layer & Solvent Cartridges + Studio Materials Workspace:** Add `{ layer }` and `{ solvent: true }` cartridges to `@hm/cartlab` and beam `Apply`, and replace `material-designer.tsx` in the Studio with the full 5-level Materials workspace.

## JOB-05 [DONE] Fix failing E2E regressions: test-base-tabs hardpoint aim & e2e-smoke home menu
- **Role:** RUNNER
- **Skills:** `e2e`
- **Priority:** P0
- **Milestone:** M5
- **Paths:** `scripts/test-base-tabs.mjs, scripts/e2e-smoke.mjs`
- **Verify:** `node scripts/test-base-tabs.mjs && node scripts/e2e-smoke.mjs`
- **Updated:** 2026-10-22 13:08

Fix the two known failing E2E scripts noted in `docs/RESUME.md`:
1. `scripts/test-base-tabs.mjs` (currently 2/4): camera fails to aim directly at the placed hardpoint ring to open the Machine Picker / Refinery tabs; compute exact lookAt pitch/yaw from `gatePlanet()` / piece coordinates.
2. `scripts/e2e-smoke.mjs`: update home screen assertions from the legacy 8 Oct menu copy to the current 6-button FIDELITY Main Menu (`Expedition [DESYNCED]`, `Planetary Grid [SYNCED]`, `The Studio`, `The Workshop`, `Community Nexus`, `Diagnostics & Settings`).

## JOB-06 [DONE] Plan 40: Bring Your Own Agent Studio API, Vision+Coverage Loop & studio-skill.md
- **Role:** ENGINEER
- **Skills:** `feature-dev`, `route`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `apps/web/src/studio, scripts/studio-agent-bridge.mjs, packages/studiomesh`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Commit:** `00c3bea`
- **Updated:** 2026-10-22 13:32

Implement Plan 40 (`docs/argo/plans/40-bring-your-own-agent.md` + `ARGO_NOTE_32` + `ARGO_NOTE_43` §3 + `docs/OVERWATCH_TECH_AND_AI_RADAR.md`):
1. `studio-agent.ts` exposing `studio.doc.read`, `studio.commands.list` (`matstack.setPaint`, `matstack.setAge`, `matstack.addLayer`, `matstack.updateLayer`, `matstack.setMaskInput`), `studio.doc.propose`, `studio.changes.list/accept/reject`, `studio.capture({ mode: 'view' | 'turntable4', includeStaged: true, rank, maskView })`, `studio.kit.validate`, and **`studio.material.coverage(spec)`** (returning numeric % coverage on top/side/edge/crevice/bottom zones so AI agents self-correct before rendering).
2. Auto-generate `studio-skill.md` with the mandatory **4-Step Closed-Loop Vision + Coverage Playbook** (`Propose` -> `studio.kit.validate` -> `studio.material.coverage` -> `studio.capture({ mode: 'turntable4', maskView })`) and 3 worked examples.
3. Wire `scripts/studio-agent-bridge.mjs` with session pairing key.

## JOB-07 [DONE] Plan 42: Modular STARGATE_KIT, Movable/Lockable Gate, Random Dialing & Earth Plot Biome Preset
- **Role:** BUILDER
- **Skills:** `frontend`, `multiplayer`, `visual-verify`
- **Priority:** P1
- **Milestone:** M4
- **Paths:** `apps/web/src/base/world.ts, apps/web/src/play, apps/web/src/shell/planetary-grid.tsx, packages/coopnet`
- **Verify:** `node --import tsx --test packages/coopnet/tests/gate-dialer.test.ts && npm.cmd run typecheck`
- **Updated:** 2026-10-22 13:32

Wire the pure helpers from `@hm/coopnet/gate-dialer` (`resolveMovedGatePose`, `canDialPlotGate`, `selectRandomOpenGate`, `isEarthSandboxUnlocked`) AND complete Modular Preset Inception for the Stargate and Earth Plot:
1. Build **`STARGATE_KIT` (`@hm/kitspec`)** from `@hm/partgen` + `@hm/matstack` + `lx:` chevron presets (ring segments, 9 chevrons, ramp, dialing pedestal, and physical **Iris shield** that closes across the aperture when `gateAccess` is `'closed'` or `'code-only'`), registered in `aimKitPart()` so players can customize their Gate with Part, Material, and Light cartridges.
2. Add `moveGate` and `setGateAccess` (`'open' | 'code-only' | 'closed'`) commands to `apps/web/src/base/world.ts`, plus the **Gate Privacy Toggle** and **"Dial Random Gate"** explorer button in the Gate Dialer UI.
3. When `isEarthSandboxUnlocked(stage)` is true (Stage 6), transition the lab window to the restored Earth biome and unlock the buildable **Earth Plot** with a customizable `PlotBiomePreset` (Terrain `matstack` + 6 Species `treegen` slots + Sky/Sun `lx:` preset).

**State (25 Oct).** Done: the `STARGATE_KIT` with its nine `lx:` chevrons, ramp, pedestal and iris (`kit-stargate.ts`,
`plot-kits.ts`), `moveGate` / `setGateAccess` in `base/world.ts`, the gate privacy toggle and random dialing, and the
Stage-6 Earth plot with `EARTH_BIOME_PRESET` (water, blue sky, six species slots). Plan 42 part 3 landed with Wave 4:
`earth-endgame.ts` joins the pieces into a pure state machine — the transit rule (`gateTransit`, with the reason a gate
will not take you), the aperture crossing (`crossedHorizon`, frame-rate independent), the arrival sector resolved by
`@hm/coopnet`'s own `resolveMovedGatePose`, the dual-world gate telemetry hook (both gates, the power that links them
and the return dial, through `movePlotGate` / `canDialGate` / `setGateAccessMode` / `isEarthSandboxUnlocked`), the
completion monument's stats, and the `FidelityEndingCredits` roll whose progress is a function of the clock alone.
`play-scene.ts` reports the crossing and stands the traveller on the arrival pad; `play.tsx` applies the biome and rolls
the credits the first time Earth is reached; the monument reads in the dial panel on the Earth plot, with the sandbox
(building, driving, cartridges) still open behind it. Twelve tests in `earth-endgame.test.ts`.

## JOB-08 [DONE] TICKET-40 Phase 2: From-scratch modular kits for all 11 Machines & 3 Vehicles (Zero GLB Cores)
- **Role:** ARCHITECT
- **Skills:** `visual-verify`
- **Priority:** P1
- **Milestone:** M2
- **Paths:** `packages/partgen, packages/kitspec, apps/web/src/play/plot-kits.ts, apps/web/src/play/kit-vehicles.ts, apps/web/src/play/kit-target.ts`
- **Verify:** `npm.cmd run typecheck && node scripts/kit-compare-sheet.mjs`
- **Commit:** `3a4b5ad (vehicles), 00c511a (machines)`
- **Updated:** 2026-10-25

Per `RULES 8a`, Owner directive (21 Oct), and `docs/OVERWATCH_TECH_AND_AI_RADAR.md` critique:
1. Delete the legacy `HEAVY_KITS` frames-around-GLB-cores stopgap in `plot-kits.ts` and replace `HOUSING_LED_ANCHOR` + 76-ray `ledMount()` in `machine-props.ts` with a first-class `statusLed` socket + `lamp` part + `lx:` preset on every machine kit.
2. Author full from-scratch `@hm/partgen` + `@hm/kitspec` + `@hm/matstack` + `lx:` assemblies for all 11 machines (`MILL_V2`, `PRESS_V2`, `WATERMAKER_V2`, `PROJECTOR_V2`, `DRILL_V2`, `POWER_V2`, `PYLON_V2`, and heavy variants) plus `FABRICATOR_V2`.
3. Upgrade `HAULER_KIT`, `CRAWLER_KIT`, and author `SCOUT_KIT` to remove `{ kind: 'gen' }` baked GLB wheels/arms (`hauler-wheel`, `crawler-arm`) and capacitor `'can'` stand-ins, using real `@hm/partgen` `'wheel'` and `'track-pod'` generators, `@hm/matstack` (`mat:`), and `lx:` headlamps.

**State (25 Oct).** Done: items 1 and 2 for all eleven machines — `kit-machines.ts` (five groups, 35-36 parts, no `gen`
source, no fallback), `kit-groups.ts` (the taxonomy as data), `machineProp` rebuilt on the kit with a declared `statusLed`
socket, `HEAVY_KITS`/`heavyKitProp` deleted, `kit-build` per-path `skip` so movers are their own builds. Gate: `validate`
0 problems and `studio.kit.audit` 0 loose ends / 0 collisions / 0 unterminated ends / 0 bend failures / every control
reachable on all eleven (`kit-machines.test.ts`).
Done (25 Oct, item 3): `kit-vehicles.ts` carries all three vehicles as five-group kits — `HAULER_KIT` (53 parts, 6x6
articulated transporter: twin-rail chassis, three axle bogies, six `wheel` tyres on `mat:rubber-seal`, armoured cab and
roll cage, twin stacks, tilting ore bed with hazard trim, two lift rams on rod-in-gland slide sockets, a terminating
hydraulic hose, twin `lx:` headlamps and a winch drum that turns), `CRAWLER_KIT` (49 parts, tracked excavation rig: two
`track` pods with sprockets and idlers, slew deck, engine housing and grille, operator cage, boom gantry, an articulated
boom on a `KitMotionSpec`, a dipper rod, and twin counter-rotating `mat:scorch-burn` cutter heads with sixteen lugs
each), and `SCOUT_KIT` (32 parts, recon rover: spaceframe tub, four wishbone arms and balloon tyres, roll hoop, saddle
packs, engine and cooling fan, steering rack, handlebar yoke, HUD dash, searchlight, beacon and a gimballed scanner
dish). The `gen` sources (`hauler-wheel`, `crawler-arm`) and the `can` track stand-ins are gone: every part is a
`@hm/partgen` primitive or a box. Gate: `validate` 0 problems and `studio.kit.audit` 0 loose ends / 0 collisions (rest,
exploded and 8 motion phases) / 0 unterminated ends / 0 bend failures / every control reachable on all three
(`kit-vehicles.test.ts`, 17 tests). `kit-target.ts` registers each vehicle's build as a targetable (`vehicleTargetable`,
lazy O(1) root box) and `play-scene.ts` aims the beam at them beside the machines; the targeter's steady state is now
allocation-free, so an aim over three vehicles costs ~0.02 ms each. `kit-hauler.ts` / `kit-crawler.ts` are deleted.

## JOB-08b [DONE] Stargate Event Horizon WebGL Shader & Monotonic Envelopes
- **Role:** ENGINEER
- **Skills:** `shader`, `visual-verify`
- **Priority:** P1
- **Milestone:** M4
- **Paths:** `apps/web/src/play/event-horizon.ts, apps/web/src/play/play-scene.ts`
- **Verify:** `npm.cmd run typecheck && node --import tsx --test apps/web/src/play/event-horizon.test.ts`
- **Commit:** `feat(shader) (see git log -1 --grep='feat(shader)')`
- **Updated:** 2026-10-25

`event-horizon.ts` holds the horizon as four pure envelopes of `(simTime, gateState, lastEventTime)` — no damped spring,
no `+=`, no per-frame accumulator anywhere, so a scrub to t = 40 s is the frame the play-through showed at 40 s:

1. `uLockEnvelope` — the 9-chevron step build: nine discrete steps from 0.0 to exactly 1.0.
2. `uKawooshBurst` — a monotonic 0.18 s attack to exactly 1.0, a monotonic 1.1 s decay to exactly 0.0, nothing after; the
   shader turns it into the outward displacement that pushes the pool to the rim.
3. `uSteadyHorizon` — the damped ripples the burst pushes aside and the pool settles back into, with chromatic dispersion
   across the rim.
4. `uShutdownFade` — monotonic cooling from 1.0 on the closing frame to exactly 0.0 at 0.9 s: closing never pops.
5. `uIrisMask` — locked blades clamp the burst to an impact shimmer (`IRIS_KAWOOSH_SUPPRESSION`), and the aperture's edge
   is clamped with `smoothstep(uInnerRadius, uInnerRadius - uRimWidth, r)`, exactly 0.0 at the glyph wall, so there is no
   cell-edge seam.

## JOB-09 [DONE] Open Lab & Window Vista QA Polish + Preset Inception Fixes (POL-25, 38, 101, 102, 103, 121, 296, 311)
- **Role:** BUILDER
- **Skills:** `visual-verify`, `e2e`
- **Priority:** P1
- **Milestone:** M5
- **Paths:** `apps/web/src/play/lab-vista.ts, apps/web/src/play/lab-room.ts, packages/cartlab, apps/web/public/vo`
- **Verify:** `npm.cmd run typecheck && node scripts/test-lab-overhaul.mjs`
- **Updated:** 2026-10-22 13:32

Close the open Lab & Window Vista QA items using the Modular Preset stack (no new baked GLBs):
- **POL-25:** Add peak hook in `lab-vista.ts` so static bursts visibly flash on the lab floor in captures.
- **POL-38:** Track or clean up `apps/web/public/vo/A4-LEAK-SEAL.mp3.json` and `A6-LEAK-SURGE.mp3.json`.
- **POL-101 & POL-102:** Clamp dusk tint in `lab-vista.ts` at `storm = 0.5` in **OKLab perceptual colour space** so no structures shift to mauve/pink (`RGB(181,148,171)`).
- **POL-103 & POL-121:** Replace the east-wall grey placeholder box (`POL-103`) and upgrade the Operator Console lever arc slot (`POL-121`) as **modular `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` kits** (never re-baking opaque GLB models).
- **POL-296:** Expose `PEACEFUL_COMBINER_RECIPES` (`pxd-mono`, `vtx-rough`, `anomaly-core` from ore + blank) in the Lab Preset Combiner UI.

## JOB-10 [DONE] Open Terrain, Combat, Anomaly Nodes & S-Space Rift QA Polish (POL-23, 29, 30, 33, 34, 37, 98, 100)
- **Role:** BUILDER
- **Skills:** `perf`, `e2e`
- **Priority:** P1
- **Milestone:** M5
- **Paths:** `apps/web/src/play/plot-ground.ts, apps/web/src/play/rift.ts, apps/web/src/play/leak-visual.ts, apps/web/src/play/monsters.ts`
- **Verify:** `npm.cmd run typecheck && node scripts/test-ticket07a.mjs`
- **Updated:** 2026-10-22 13:32

Close the open Terrain, Combat & Rift QA items:
- **POL-29:** Stitch geomipmap border vertices where 16 m sculpt-refined chunks meet coarse terrain chunks in `plot-ground.ts`.
- **POL-30:** Orient or project the Extraction/Sculpt brush ring along local terrain slope normal.
- **POL-33:** Intersect Spitter projectile bolts against built wall AABBs (`planetSolids`) so walls block enemy projectiles.
- **POL-34 & POL-37:** Add third-person Moon avatar pixel-patch luminance assertion (`>= 35/255`) and Stage 1 vs Stage 6 monster fight readability captures.
- **POL-98, POL-100 & POL-23:** Merge `rift.ts` slabs into a single instanced/merged draw call (dropping near-rift cost from 59 draw calls to 1–2) in vivid S-Space `#FF1E8E` / `#00F0FF` / `#2A0845` across all stages, and build Anomaly Field Nodes (`POL-23`) from `@hm/partgen` + `@hm/meshops` + `lx:` presets rather than concept-art GLBs.

## JOB-11 [DONE] Open Stage-Look (OKLab POL-49), Suit-Cam & Inspector QA Polish (POL-36, 49, 52, 53, 54, 60, 63, 74, 75, 81, 297)
- **Role:** BUILDER
- **Skills:** `shader`, `e2e`
- **Priority:** P2
- **Milestone:** M5
- **Paths:** `apps/web/src/play/stage-look.ts, scripts/test-machine-inspector.mjs, scripts/test-stage-looks.mjs`
- **Verify:** `node scripts/test-machine-inspector.mjs && node scripts/test-stage-looks.mjs`
- **Updated:** 2026-10-22 13:32

Close the remaining visual & E2E QA items from `docs/DEFERRED_POLISH_REGISTRY.md`:
- **POL-49:** In `stage-look.ts`, damp high-frequency normal derivatives (`fwidth(vWorldNormal)`) and evaluate Stage 1–2 palette quantization in **OKLab perceptual space** so the 5-degree yaw turn test (`scripts/test-stage-looks.mjs`) drops from 16.5% below the 10% flip target.
- **POL-52:** Fade out the radial scan ring smoothly at its 350 m maximum radius instead of holding visibly.
- **POL-53 & POL-54:** Tune suit-cam step overshoot (`+0.85 EV`, `0.4 s` settle) and measure per-pass GPU cost on Low/Medium.
- **POL-60 & POL-63:** Add subtle ground shader band at the 25 m safe dome edge and capture Stage-1 flat-ground foundation shots.
- **POL-74 & POL-75:** Add browser E2E step placing and inspecting a planet plot-machine in `scripts/test-machine-inspector.mjs`, and capture running mill/projector plume height shots.
- **POL-81 & POL-36:** Pre-warm hotbar/radial 3D blueprint thumbnails behind the loading bar and run automated edge-case sweep.

## JOB-17 [DONE] Universal Cartridge Targetability ("Modular Preset Inception") & AABB Kit Raycast
- **Role:** ENGINEER
- **Skills:** `perf`, `code-review`
- **Priority:** P0
- **Milestone:** M2
- **Paths:** `apps/web/src/play/play-scene.ts, apps/web/src/play/lab-room.ts, apps/web/src/play/plot-kits.ts, apps/web/src/assets/gen-props.ts, apps/web/src/base/kit-pieces.ts`
- **Verify:** `npm.cmd run typecheck && node scripts/test-material-cartridge.mjs && node scripts/test-part-cartridge.mjs`
- **Commit:** `7935d76 (raycast + dead paths; vehicles and base pieces still to wire)`
- **Updated:** 2026-10-22 13:33

Fix the #1 Modular Preset Inception gap uncovered in `docs/OVERWATCH_TECH_AND_AI_RADAR.md`:
1. **Enable Kit Targetability Across the Whole World:** Currently `lab-room.ts` only registers `capacitor-bank` in `kits`, and `plot-kits.ts` has `kitFrames = false` (so `aimKitPart()` returns `null` for 100% of planet machines, vehicles, base structures, and Lab stations). Wire `aimKitPart()` and `setKitOverrides()` to cover all plot machines (`plot:<id>`), all Lab stations (`lab-room.ts`), all 3 vehicles (`createGenRover` wired to `SCOUT_KIT`, `HAULER_KIT`, `CRAWLER_KIT`), the Stargate (`STARGATE_KIT`), and built base pieces (`kit-pieces.ts`).
2. **Two-Level AABB Accelerated `aimKitPart()` Raycasting:** Pre-check ray against each `KitBuild`'s outer world AABB and `PlacedPart` bounds before triangle intersection so scaling kits to the whole plot costs < 0.1 ms CPU on the GTX 950M.
3. **Clean Up Dead Legacy Paths:** Delete unused `createGenMachineProp` in `apps/web/src/assets/gen-props.ts` (`POL-76`) and remove the dead inverted-sign `MACHINE_PLUME_GRAVITY` export at the bottom of `apps/web/src/play/machine-props.ts`.

## JOB-18 [DONE] Recurring Overwatch: Modular Preset Inception Audit & AI/Fidelity Tech Radar
- **Role:** OVERSEER
- **Skills:** `code-review`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `docs/OVERWATCH_TECH_AND_AI_RADAR.md, docs/JOB_BOARD.md, docs/agents/roster.json, docs/agents/SKILLS_INVENTORY.md, .agents/GEMINI.md, CLAUDE.md`
- **Verify:** `node scripts/skill-inventory.mjs && node scripts/agent-worker.mjs --list`
- **Updated:** 2026-10-22 13:56

Standing recurring Overwatch task executed whenever Antigravity / Overwatch is activated:
1. Audit all recent commits and job briefs against **Modular Preset Inception** (`RULES 8a`: zero opaque `.glb` shortcuts, zero hardcoded `THREE.BoxGeometry` props where `@hm/partgen` + `@hm/kitspec` + `@hm/matstack` + `lx:` presets belong).
2. Research and fold new breakthroughs in **AI Agent Skills (Vision+Coverage closed loops, procedural graph synthesis), WebGL2/WebGPU Visual Fidelity (OKLab quantization, screen-space normal-derivative micro-cavity), and Logical/Spatial Optimization (BVH/AABB raycasting, UBO material batching)** into `docs/OVERWATCH_TECH_AND_AI_RADAR.md` and active `JOB-*` cards.
3. **Know your environment & adapt the roster:** Identify where you woke (Claude Code or Antigravity) and which models you can spawn. Run `node scripts/skill-inventory.mjs` (refreshes `docs/agents/SKILLS_INVENTORY.md` and flags **MISSING** skills), research new models, tools and skills (Claude Code plugins/skills such as `/frontend-design`, `/route`, `/code-review`; Antigravity skills and subagent tiers), then update `docs/agents/roster.json` (role ladders, skill tags) and re-tag job **Role**/**Skills** fields so cheaper rungs plus the right skills do the work. Finish with `node scripts/agent-worker.mjs --dispatch --env <env>`.

## JOB-20 [DONE] Plan 43 Step 4: Sprites, Audio Stems & Cartridge Parity (`pxdc:` / `sndc:`)
- **Role:** BUILDER
- **Skills:** `frontend`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `packages/skin, packages/shareware, packages/soundlab, packages/musicbox, packages/cartlab, apps/web/src/play, apps/web/src/audio`
- **Verify:** `node --import tsx --test apps/web/src/play/sprite-sound-cartridge.test.ts packages/soundlab/tests/stems.test.ts packages/musicbox/tests/stems.test.ts && npm.cmd run typecheck`
- **Commit:** `see the JOB-20 commit on arena/a2368b82-heavymetal2 (PR #68)`
- **Updated:** 2026-10-25

### Landed (2026-10-25)

1. **`@hm/skin` — the stage's palette as data.** OKLab (`hexToOklab`/`oklabToHex`, `toOklch`, `deltaOk`), the four stage
   palettes (`mono` 1-bit, `ega` 16, `vga` 32, `true`), `paletteForStage` (0–6, clamped), `nearestPaletteIndex` in OKLab,
   Bayer 2/4 matrices with `ditherBias`, `quantiseRgba`/`indexedToRgba`, `shiftPalette` for skins and `asciiPreview`.
2. **`@hm/shareware` sprite factory.** `bakeTurntable({kit, preset, stage, size, angles, dither, elevationDeg})` flattens a
   `@hm/kitspec` preset, projects its solids into eight (or 1–16) yaw frames at a constant camera crane, flat-shades each face
   from its real box axis normal (`0.42 + 0.58 · lambert`, lifted `0.04`), scan-converts the convex quads and quantises the
   result into the stage's palette with that stage's dither. Plus `billboardFrameAt`/`frameForView` (front +z is frame 0),
   `sheetToImage`/`sheetToRgba`, and `defaultMaterialColour` (a stable OKLCh ink per missing material).
3. **`@hm/soundlab` stems, as a recursion.** `OscAtom → PatchNode → StemPreset` with `AUDIO_STAGE_LADDER` (1-bit 11 kHz mono
   one voice at S0 → 16-bit 48 kHz stereo, filters and placement at S4–S6). `stageSoundsLike` performs the reduction the
   hardware forces (a saw becomes a square on a speaker, a filter disappears, a pan has nowhere to go, voices are capped),
   and `renderStem` renders it deterministically (seeded noise, RBJ biquads). The shelf: eleven machine hums, the rifle's three
   verbs, the gate's chevron lock (nine ticks of one atom) and dial, four music stems.
4. **`@hm/musicbox` song stems.** `songStem`/`songStems` turn a `Song` into the four stems the mix plays — one child patch per
   note, each voice its own wave and filter, the loop the song's length — and `renderSongMix` sums them at a stage's hardware
   (at S0 the whole arrangement is one voice, which is what the hardware did to eight bars of music).
5. **Cartridge parity.** `@hm/cartlab` gains the `sprite` and `sound` print kinds (structural specs, readers and refusals:
   a kit slug, a stage off the ladder, a bounded patch recursion), the rifle-only rule, and cartridge/job fields.
   `sprite-sound-cartridge.ts` holds the `pxdc:`/`sndc:` codes (base64url JSON behind the prefix, read back through
   `readPrint`), the six kit presets, `spriteBill`/`soundBill` (a patch is data, so a sound takes no stock), `spriteFps` and
   the atlas. The Lab Bench has Sprites and Sounds tabs with a live animated card and an audible render, and the beam's Apply
   hangs the card over the machine (`setSpriteCard`: a `DataTexture` atlas turned at the stage's cadence) or gives it the hum
   (`playPrintSamples`: a loop, or one strike, played through the master bus). Both are saved per profile (`PropsSave.sprites`
   / `.sounds`) and restored with the kit overrides.

### Numbers

`3386` tests, `3348` pass, `34` fail (the three known LFS lattice/monster failures), perf `23/23`. New suites: `@hm/skin`
`7/7`, `@hm/shareware` sprite sheet `7/7`, `@hm/soundlab` stems `7/7`, `@hm/musicbox` stems `6/6`, cartlab sprite/sound
`4/4`, `sprite-sound-cartridge` `6/6`, plus the props-save and my-presets plan-43 cases. `tsc --noEmit` clean.

Unverified visually (no Chrome in this sandbox): how a baked sprite reads at each stage, and how a rendered stem sounds.

## JOB-19 [DONE] Plan 43: Modular Locomotion (`loc:`), Stage-Fidelity Animation (`anim:`) & Logic Graph Presets (`logic:`)
- **Role:** BUILDER
- **Skills:** `frontend`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `packages/kinematic, packages/anim, packages/triggers, packages/wiregraph, apps/web/src/play, docs/argo/plans/43-modular-motion-and-logic-presets.md`
- **Verify:** `node --import tsx --test packages/kinematic/tests/modular-motion.test.ts && npm.cmd run typecheck`
- **Commit:** `see the JOB-19 commit on arena/a2368b82-heavymetal2 (PR #68)`
- **Updated:** 2026-10-25

### Landed (2026-10-25)

1. **`loc:` is live.** `apps/web/src/play/locomotion.ts` owns the *choice* over `@hm/kinematic`'s `LOCOMOTION_PRESETS`:
   `auto` (the lab deck keeps Earth standard, the Moon's surface keeps the suit's ballast) or any preset pinned everywhere,
   kept per PC (`settings.locomotion`). The player loop reads it every frame — walk/sprint speed (`locomotionSpeed`, times
   the preset's **air control** while the feet are off the ground), the jump (`stepVerticalJump` with the preset's impulse,
   gravity, coyote time, buffer and landing spring) on both grounds, and the flying debug camera — so switching mid-jump
   retunes the rest of the arc and keeps the state it had. Debug ▸ **Movement** has the row. `locomotion.test.ts` 5/5.
2. **`anim:` is stage-quantised and declarative.** `stageAnimRateHz` is 8 / 12 / 18 / 30 / **60** at S4–S6 (60 is the frame
   cadence: a machine that samples every frame is smooth), `@hm/anim` re-exports the surface (`STAGE_ANIM_HZ`, `stageAnimHz`,
   `stageAnimStepSeconds`, `stageAnimTime`, `poseAtStage`), and `@hm/kitspec` now carries a `KitMotionSpec` on a **part**, a
   **placement** (which wins) and a **socket**, with `presetMotions` listing them and `presetSockets` passing the socket's
   motion through. Every `Math.sin` closure in `machine-props.ts` is gone: `kit-motion-specs.ts` names the press rams (twin,
   half a cycle apart), the heavy ram, the projector sway, the drill spin and the idle LED blink, and the plume cadences and
   the ram strokes read **one** angular constant (`RAM_CADENCE_RAD`), so the pour pulses when the ram strikes. `machine-motion.ts`
   binds a spec to an object (rest pose + `evaluateKitMotion`) and poses it — pure in `(simTime, stage)`, so a scrub lands
   where a step chain lands, and the prop's `animate(t, run, stage)` steps with the picture at S0. `PRESS_FRAME_KIT` puts the
   stroke on its ram **sockets**; a builder only bolts the ram on. `kit-press-frame.test` coverage via `machine-motion.test` 7/7,
   `machine-props.test` 12/12, kinematic 19/19, anim 8/8, kitspec 14/14.
3. **`logic:` decides the Stargate.** New actuator kinds `lock-iris`, `turret-track`, `spawn-monster` and three new shelf
   presets: **`stargate-iris-lock`** (privacy + code → iris shut / ramp door open; a `closed` plot admits nobody),
   `perimeter-turret` (track, then fire through a 400 ms hold) and `nest-spawner` (stage gate + proximity, counted).
   `apps/web/src/play/gate-logic.ts` evaluates the iris lock with `evaluateWireGraph`, the scene draws the access the graph
   fired (`irisAccessFor`), and `stargateIrisClosed` — the world's, the kit's and the tests' single rule — is now that
   graph's answer, memoised per mode. `gate-logic.test.ts` 4/4, wiregraph 7/7.
4. **Guardrail 3 (AABB under motion).** `kit-target.ts` keeps a box per mesh with the world matrix it was measured at: on each
   aim a pre-pass of sixteen-float compares finds a part a spec drove, re-boxes **only that mesh** from its cached geometry
   bounding box, and re-takes the build's union from the boxes it keeps — no triangle is ever re-read on the aim path, and a
   standing build costs the compares and nothing else. Counters `buildsRemeasured` / `meshesRemeasured` report it. The new
   test drives a mesh with a `gantry-slide` spec and proves the ray follows it up and back (a stale box would still catch it).
   `kit-target.test.ts` 9/9.

### Outstanding on this ticket
- The **slider and Studio curve UI** for the `loc:` and `anim:` params (the presets and the live switch exist; the sliders are
  a Bench/Studio surface still to build), and the Beam Rifle's `logic:` cartridge UI for the three new shelf presets.
- `perimeter-turret` and `nest-spawner` are shelf-ready and tested but not yet consumed by `turret-view.ts` / the monsters.
- The iris graph's `open-door` output has no leaf to move on the plot's gate yet (the kit's ramp is static): the iris shield is
  the gate's door until the kit carries a leaf.
- Visual verification of all four (no GPU/Chrome in this session): the counts above are unit and numeric only.

Extend Modular Preset Inception (`docs/argo/plans/43-modular-motion-and-logic-presets.md`) across all non-visual game systems and Fidelity Stages ($S_0 \to S_6$):
1. **Locomotion & Jump Presets (`loc:` — Core Jump Shipped):** Expose `LOCOMOTION_PRESETS` (`earth-standard`, `lunar-ballast`, `lunar-low-g`, `arcade-quake`) with curated in-game sliders (Walk/Sprint Speed, Jump Impulse, Gravity, Air Control, Landing Spring) and Studio curve controls.
2. **Stage-Quantized Procedural & Skeletal Animation (`anim:` & `KitMotionSpec`):** Wire `stageAnimRateHz(stage)` (`8 Hz` at $S_0$, `12 Hz` at $S_1$, `18 Hz` at $S_2$, `30 Hz` at $S_3$, continuous `60+ Hz` + IK + spring-damper at $S_4\text{--}S_6$) and replace hardcoded `Math.sin` closures in machine props with declarative `KitMotionSpec` on `@hm/kitspec` sockets.
3. **Modular Logic & Behaviour Presets (`logic:` via `@hm/triggers` + `@hm/wiregraph` + `@hm/npcbrain`):** Wire Auto-Doors, Perimeter Turrets, Stargate Iris locks, and Monster Spawners to `LogicPreset` sliders in-game and full node-and-wire DAGs in the Studio.



## JOB-12 [DONE] 3D PC Full Verification of Landed Wave 1 & Wave 2 QA Bundles (T18..T28 + F-24..F-28)
- **Role:** RIG
- **Priority:** P0
- **Milestone:** M5
- **Paths:** `scripts/test-on-3dpc.sh, scripts/test-campaign.mjs, scripts/test-ticket13.mjs`
- **Verify:** `bash scripts/test-on-3dpc.sh "npm test && npm run build && node scripts/test-campaign.mjs"`
- **Commit:** `1b5011c7`
- **Updated:** 2026-10-20 12:00

Run the full visual & Playwright E2E suite on the 3D PC (`192.168.0.5`) across the landed `F-24..F-28` and `TICKET-18..28` commits:
- **TICKET-18 (`POL-35, 44, 45, 46`):** Title-card banner hold queue, rover drift badge, compass leak bearings, 25 m Gate dome `SyncWord` hide, responsive build drawer.
- **TICKET-19 (`POL-65..69, 104, 105, 121, 171..173`):** Lab static mesh merge + dispose, copper bus bars, metric lamp bars, floor cable treads, relay beacon cages, `0.95 rad` console lever throw, co-op gate-pad seed & sculpt sync.
- **TICKET-21 (`POL-12, P2-VEH-06`):** `.glb`/`.vrm` avatar retargeter & IndexedDB dock, Workshop vehicle reskin, Beam Rifle hybrid cartridges (`Scatter Excavator` & `Color Spewer`).
- **TICKET-22 (`POL-49, 281, 282`):** Tri-planar world-locked Bayer dither, turret corner cap, press exhaust vent offsets.
- **TICKET-23 (`POL-39, 73, 77`):** 4-state machine housing status LED, 100-item hopper caps + `linkedReserve`.
- **TICKET-24 (`POL-01, 42, 64, 67, 71, 83, 85`):** Main Menu frosted glass blade & hero vista, 16-colour EGA Skin-1 quantizer & 40 ms degauss pulse, Gate ignition charge curve.
- **TICKET-25 (`POL-26, 27, 47`):** First-person viewmodel inertia, sprint-to-fire recovery, monster knockback & hit-stop flash, `0.55 m` ankle step-up.
- **TICKET-26 (`POL-16, 84`):** Claimed sector readout (`SECTOR #04 // 226 m NE`), 6-chevron Gate friend dialing, neighbour plot rearrangement.
- **TICKET-27 (`POL-13`):** 256-slot Quantum Bridge linked storage pool & priority auto-pull.
- **TICKET-28 (`POL-15, 53`):** Keplerian 2-body orbital astrodynamics, Moon sky-arc projection & 4-phase surface-to-orbit launch.

## JOB-13 [DONE] Plan 41 P0: @hm/matstack 5-level engine, layered-material.ts renderer, Bench Materials page & review sheets
- **Role:** ENGINEER
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `packages/matstack, apps/web/src/play/layered-material.ts, apps/web/src/lab, scripts/material-sheet.mjs`
- **Verify:** `node scripts/test-layered-material.mjs && node scripts/test-material-cartridge.mjs`
- **Commit:** `4255650c`
- **Updated:** 2026-10-21 17:30

Built `@hm/matstack` (29 tests), `layered-material.ts` (Ranks 0, 1, 2 + B&W mask view; GLSL matches CPU pixel-for-pixel 7/7 in `test-layered-material.mjs`), removed the 0.35 planet metal cap via room reflection (`setPlotEnvironment`), built the Bench Materials page (Machines shelf, pinned test piece, paint slots, layer stack, Age slider, `matc:` save/print, beam tap/hold Apply: 17/17 in `test-material-cartridge.mjs`), and built `material-sheet.mjs`, `material-coverage.mjs`, and `kit-compare-sheet.mjs`.

## JOB-14 [DONE] Plan 39 Steps 1-4: Parts (Vtx), Skins (Pxd), Species (Aq) & Lights (Lx) preset factories + Previews Drive Play
- **Role:** ENGINEER
- **Priority:** P0
- **Milestone:** M2
- **Paths:** `packages/partgen, packages/kitspec, packages/meshops, packages/cartlab, apps/web/src/lab, apps/web/src/play`
- **Verify:** `node scripts/test-part-cartridge.mjs && node scripts/test-species-cartridge.mjs && node scripts/test-light-cartridge.mjs && node scripts/test-my-presets.mjs`
- **Commit:** `ee64a7e2`
- **Updated:** 2026-10-21 14:00

Installed `@hm/partgen` (20 generators across 4 shelves), `@hm/meshops` (27 non-destructive operators across 6 families), `@hm/kitspec` (capacitor bank pilot), live 3D turntable previews + hover try-on across all bench tabs (`previews-drive-play`), Part cartridges (28/28), Species cartridges & 6 plot variant slots (11/11), Light cartridges & grounded housing status lamps (12/12), and `my-presets.ts` player library + share codes (10/10).

## JOB-15 [DONE] Sidecar Wave F-15 to F-28 & T13..T17a QA Closures (Studio Hardening, HUD, Plumes, Finale, Credits, Vehicle Bay & Bundle Diet)
- **Role:** BUILDER
- **Priority:** P0
- **Milestone:** M5
- **Paths:** `apps/web/src/studio, apps/web/src/play, apps/web/src/base/ui, packages/plume, packages/questline`
- **Verify:** `npm.cmd test && node scripts/test-campaign.mjs`
- **Commit:** `1b5011c7`
- **Updated:** 2026-10-20 11:30

Completed and verified previous QA rounds across `docs/sidecar/FLASH_INBOX.md` (`F-01`..`F-28`) and `T13..T17a`:
- **F-15 & F-16 (`5e77ed14`, `d529852f`):** `POL-21` (`scenedoc` structural sharing), `POL-86` (`levels.json` write route), `POL-87/93` (CSS dedup), `POL-88` (`scene-layouts` write-back), `POL-89` (registry sockets), `POL-90` (Scene undo stack), `POL-91` (Studio tab ErrorBoundaries), `POL-92` (shared offscreen WebGL renderer), `POL-94` (gizmo drag E2E), `POL-95` (Look tab levels readout).
- **F-17 (`60c47826`):** `POL-43` (linked-bin ticker count), `POL-78` (3-column 720p controls grid), `POL-79` (2-line radial labels), `POL-80` (empty Apply rack state), `POL-82` (compact HUD refusal toast).
- **F-20, F-21 & F-22 (`d2b9ea0d`, `77a276b7`, `b0760ed3`):** `POL-174` (remote peer geometry disposal), `POL-175` (scoped Studio button hover CSS), `POL-261/282` (`@hm/plume` ballistic gravity & `uCounts` uniform), `POL-99` (clean HUD-hidden close-up shots of armory rail and open/sealing rifts).
- **T17a:** `POL-27` single-file diet (`15.14 MiB` -> `13.67 MiB`), `POL-83` scoped `.play` CSS, `POL-115` & `POL-117` co-op host seed guard & join usernames, `POL-313` loader labels.
- **F-23, F-24 & F-26 (`e847695e`):** Acts VII–IX finale chain (`POL-241`), `endingSeen` credits gate (`POL-305`, `POL-306`), Dr. Haddy title portrait non-overlapping placement, turret 2 kW HUD readout (`POL-292`), 11 enclave domes, Planet Table hologram (`POL-70`), wireframe chapter-1 credits hook (`POL-301`), `setStorm`/`setMonitorEqualizer` exposure (`POL-302`), zero-drift `setAltCam` (`POL-303`), hidden credits viewmodel (`POL-304`).
- **F-25, F-27 & F-28 (`1b5011c7`):** `T09b` audio verbs & mentor ducking, `T15` 5-chord harmonic choir, diegetic radio & Turbo Bass (`POL-141`), `T13b` 3s vehicle bay gantry print, scout/hauler rear sockets, `POL-50` & `POL-51` rover crater/wall camera E2E.

## JOB-16 [DONE] Plan 42 spec, cross-session agent directives, Command Center UI & @hm/coopnet pure gate/Earth helpers
- **Role:** ARCHITECT
- **Priority:** P0
- **Milestone:** M4
- **Paths:** `docs/argo/plans/42-modular-stargate-earth-endgame.md, .agents/GEMINI.md, CLAUDE.md, docs/RESUME.md, docs/JOB_BOARD.md, scripts/command-center.mjs, scripts/agent-worker.mjs, packages/coopnet`
- **Verify:** `node --import tsx --test packages/coopnet/tests/gate-dialer.test.ts && npm.cmd run typecheck`
- **Updated:** 2026-10-22 13:08

Authored `docs/argo/plans/42-modular-stargate-earth-endgame.md`, synchronized `.agents/GEMINI.md`, `CLAUDE.md`, `docs/RESUME.md`, `docs/OWNER_ASKS.md`, and `docs/argo/RULES.md`, built the visual Command Center & GitHub Job Board (`COMMAND_CENTER.bat`, `scripts/command-center.mjs`, `scripts/agent-worker.mjs`), and implemented pure deterministic helpers (`resolveMovedGatePose`, `canDialPlotGate`, `selectRandomOpenGate`, `isEarthSandboxUnlocked`) with 6/6 passing unit tests in `packages/coopnet/tests/gate-dialer.test.ts`.

---

## JOB-21 [DONE] Cross-Game Multiverse Exploration Loop & Multi-Cartridge Synergy (formerly Monster Mash)
- **Role:** ARCHITECT
- **Skills:** `frontend`, `multiplayer`, `visual-verify`
- **Priority:** P1
- **Milestone:** M5
- **Paths:** `packages/crossgame, apps/web/src/play/cross-game.ts, apps/web/src/play/play-scene.ts, packages/cartlab`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Updated:** 2026-10-25

1. Reframe the feature formerly known as "Monster Mash" as the **Cross-Game Multiverse Feature**:
   - Entities and mechanics are 100% procedural (`@hm/creature`, `@hm/kitspec`, `@hm/wiregraph`).
   - The system does NOT import static third-party meshes; it streams procedural assets, vehicles, creatures, physics, and rules across completely different games in the multiverse.
2. Build the Cross-Game streaming bridge: allow an entity from one GameMode (e.g. survival, mining) to traverse Stargates or be beamed via cartridges into another GameMode (e.g. rally racing, factory automation) with its procedural gait, material wear stack, and interaction rules intact.
3. Multi-Cartridge Synergy: Firing the Beam Rifle (`Apply` mode) allows sampling an entity in Game A and manifesting it inside Game B.

## JOB-22 [DONE] 60 FPS Frame-Budget Audit, 380-Part Stress Benchmark & Zero-Alloc Raycast Audit
- **Role:** RIG
- **Skills:** `perf`, `visual-verify`
- **Priority:** P0
- **Milestone:** M5
- **Paths:** `scripts/perf-layered-material.mjs, apps/web/src/play/kit-target.ts, apps/web/src/play/play-scene.ts`
- **Verify:** `node scripts/perf-layered-material.mjs && npm.cmd test`
- **Updated:** 2026-10-25

1. Run the 380-part scene stress test on the GTX 950M Low profile (11 machines + 3 vehicles + Stargate in view simultaneously).
2. Verify kit-target zero-allocation steady state: aiming over 14 kits costs < 0.05 ms with zero heap garbage generated per tick.
3. Confirm draw calls remain <= 181 and frame times hold 60 FPS (16.6 ms budget).

## JOB-23 [DONE] 1.0 Release Packaging, studio-skill.compact.md & CI Gate Lock
- **Role:** BUILDER
- **Skills:** `feature-dev`, `code-review`
- **Priority:** P0
- **Milestone:** M5
- **Paths:** `public/studio-skill.compact.md, scripts/compress-skill.mjs, apps/web/dist/index.html`
- **Verify:** `npm.cmd run build && node scripts/test-bundle-size.mjs`
- **Updated:** 2026-10-25

1. Generate `public/studio-skill.compact.md` via Caveman prompt compression (saving ~46% input tokens and ~65% output tokens while preserving 100% of hard schemas and constraints).
2. Lock in standalone single-file distribution (`apps/web/dist/index.html`, staying well under the 16.00 MiB cap).
3. Validate CI release gate: zero typecheck errors, 100% passing test suites, and tag `v1.0.0-feature-complete`.


## 4. PHASE 6: POST-1.0 EXPANSION (PLANS 44 & 45 — ZERO-IDLE FLEET QUEUE)
> **Status**: Approved by Argon (Creative Architect) on `30ddd8a6`  
> **Mandate**: Staged immediately behind Milestone #1 (Wave 4 `JOB-08v` Vehicles & `JOB-09` Earth Endgame) to ensure zero fleet idle time.

## JOB-24 [DONE] Plan 44 Part A: @hm/creature Core Package, 5-Group Genome Builder, 3-Tier IK LOD & ASTRO_SUIT_CREATURE_KIT
- **Role:** ENGINEER
- **Skills:** `feature-dev`, `visual-verify`
- **Priority:** P1
- **Milestone:** M6
- **Paths:** `packages/creature, packages/partgen, packages/kitspec, apps/web/src/avatar/astro/astro-model.ts, apps/web/src/avatar/two-bone-ik.ts`
- **Verify:** `npm.cmd run typecheck && npm.cmd test && node --import tsx packages/creature/tests/creature-assembly.test.ts`
- **Commit:** `dd468c65`
- **Updated:** 2026-10-25 14:48

1. Author the `@hm/creature` package exporting `CreatureGenomeSpec`, `bindCreatureSkeleton()`, and `evaluateCreatureGait()`.
2. Map morphology 1:1 onto the 5 `kit-groups.ts` groups (`base`: pelvis/sacral root, `structure`: Sushumna spine/ribs/cranium, `mechanism`: limb chains with coaxial knuckles, `controls`: sensory organs, `subject`: hands/claws/effectors).
3. Integrate zero-allocation `solveTwoBoneIk()` with 3-tier distance LOD (<15m 60 Hz foot IK; 15–50m `stageAnimRateHz` against analytical heightfield; >50m sleep).
4. Rebuild the player avatar as `ASTRO_SUIT_CREATURE_KIT` (38-part articulated suit kit), purging `astro-low.glb` (1.2 MiB). Must pass `studio.kit.audit` with 0 loose ends and 0 collision violations across 8 motion phases.

**Completion Note (2026-10-25 14:48):** @hm/creature core package, 5-group genome builder, 3-tier IK LOD, and ASTRO_SUIT_CREATURE_KIT (astro-low.glb purged)

## JOB-25 [DONE] Plan 44 Part B: 37 Procedural Monster Roster Rebuild in apps/web/src/monsters/roster.ts
- **Role:** BUILDER
- **Skills:** `visual-verify`
- **Priority:** P1
- **Milestone:** M6
- **Paths:** `packages/creature, apps/web/src/monsters/roster.ts, apps/web/src/monsters/`
- **Verify:** `npm.cmd run typecheck && node scripts/kit-compare-sheet.mjs`
- **Commit:** `2beec047`
- **Updated:** 2026-10-25 15:49

1. Rebuild all 37 roster monsters across the 7 archetypes (`biped`, `theropod`, `quadruped`, `hexapod`, `arachnid`, `serpentine`, `avian-drone`) using declarative `CreatureGenomeSpec` presets.
2. Purge all 37 static external GLB/sprite assets (~4.8 MiB) from `apps/web/src/monsters/`, locking in a net ~5.5 MiB single-file bundle reduction.
3. Every creature must pass `studio.kit.audit(spec)` with 0 loose ends and 0 collision penetrations across 8 motion phases ($t \in [0, 1]$).
4. Bind `@hm/skin` OKLab palettes and `@hm/soundlab` physical vocal tract formants (`vocal-tract.ts`) to each monster species.

**Completion Note (2026-10-25 15:49):** Procedural monster roster rebuild: 38 species ported to @hm/creature, 5.55 MB static assets purged, 39/39 audit tests pass

## JOB-26 [DONE] Plan 45: MultiverseGamePresetSpec, main.ts URL Query Gateway & Steganographic PNG Spore Cards
- **Role:** ARCHITECT
- **Skills:** `frontend`, `route`
- **Priority:** P1
- **Milestone:** M6
- **Paths:** `packages/gamepreset, apps/web/src/main.ts, apps/web/src/play/game-presets.ts, apps/web/src/studio/spore-card.ts`
- **Verify:** `npm run typecheck && node --import tsx apps/web/src/studio/spore-card.test.ts` (Linux; use `npm.cmd` on Windows). Full `npm test` baseline exceptions are documented in the handoff.
- **Updated:** 2026-10-25

1. Implement `MultiverseGamePresetSpec` declaring `cameraMode`, `hudBlade`, `playerRigId`, and `activeRules` (circuit racing, wave survivor, ecosystem observer, Stargate escape).
2. Wire the 6-line dual-gateway router in `apps/web/src/main.ts` parsing `/?world=<seed>&game=<preset>&rig=<kit>`, reusing the existing canvas, shaders, physics, and raycaster while swapping HUD blade and camera controller.
3. Build `spore-card.ts` in `apps/web/src/studio/`: encode 512x512 turntable snapshots with compressed `fflate` `zTXt` ancillary PNG chunks (`"hm2:preset:v1"`).
4. Implement secure drag-and-drop decoder: 256 KiB decompression bomb cap, frozen Zod schema validation, `studio.kit.audit` gate, and zero `eval`.

**Completion Note (2026-10-25, Arena):** Implemented on `arena/44905b50-heavymetal2` from `016864b6`: strict frozen `@hm/gamepreset` schema/four games, dual gateway/five HUD blades/shared-engine objectives, 512² Spore beauty + portable `@hm/cartlab` codec/audit and transactional canvas/Studio drop. Typecheck/build PASS (5.68 MB); direct Spore tests 63/63, preset/audio tests 10/10 + 3/3; full suite 3,568 pass/2 unchanged LFS failures/4 skip (3,574 total), speed 23/23. Browser boot/import/save-isolation/actual-export checks passed. Live full assault, campaign-credit handoff and hardware review remain explicit manual checks. Details: [`JOB_26_MULTIVERSE_HANDOFF.md`](JOB_26_MULTIVERSE_HANDOFF.md).
