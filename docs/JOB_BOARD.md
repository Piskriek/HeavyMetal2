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

---

## 3. JOB QUEUE

## JOB-01 [OPEN] Uncapped GTX 950M performance gate & GPU timer hook (Plan 41 + POL-294)
- **Role:** ENGINEER
- **Skills:** `perf`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `scripts/perf-layered-material.mjs, apps/web/src/play/play-scene.ts`
- **Verify:** `node scripts/perf-layered-material.mjs`
- **Updated:** 2026-10-22 13:08

1. Measure `layered-material.ts` on the GTX 950M laptop (Medium, 1080p) with frame-rate limiting disabled (`--disable-frame-rate-limit` or WebGL `EXT_disjoint_timer_query_webgl2`) so the 60 Hz vsync cap does not mask the delta between plain and 6-layer materials.
2. Expose a GPU timer hook in `PlayScene` (`POL-294`) so real GPU ms can be measured for both 6-layer materials and 4-turret Low-spec scenes. Confirm Lab gate view stays <= 181 draw calls (`POL-314`).

## JOB-02 [OPEN] TICKET-40 v5: Modular Mill kit typing, palette test & matstack shelf coverage tuning
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

## JOB-03 [REVIEW] TICKET-41: 20 procedural texgraph tile graphs & 6 new periodic nodes
- **Role:** ARCHITECT
- **Skills:** `visual-verify`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `packages/texgraph/src/index.ts, packages/texgraph/tests`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Updated:** 2026-10-22 13:08
- **Commit:** `2800ff3` (tile library `97c9678`)

Implement `OPUS_NOTE_44_tile_library.md`:
1. Add 6 periodic, deterministic nodes to `@hm/texgraph`: anisotropic `noise` (`scaleY`), `scratches`, `spots`, `hex` (`'edge'` | `'cell'`), `weave`, and wrapped `blur`.
2. Build `TILE_LIBRARY` with all 20 required tile graphs: `brushed-metal`, `cells`, `cast-iron`, `pits`, `fine-grain`, `orange-peel`, `stripes`, `rubber-grain`, `concrete`, `carbon-weave`, `hex-micro`, `flake-scale`, `grime-clouds`, `regolith-grain`, `moss-clump`, `frost-crystal`, `mud-splatter`, `mineral-crust`, `scorch-burn`, `scratches`.
3. Add unit tests for validation, determinism, seamless wrap-edge continuity, grey percentile spread (>= 0.35), non-constant height, and < 25 ms @ 128px evaluation budget.

## JOB-04 [REVIEW] Rule 8a matstack fixes: Layer ordering, coat/aniso writes, coplanar edge dedup & Solvent Cartridge
- **Role:** ENGINEER
- **Skills:** `shader`, `frontend`
- **Priority:** P0
- **Milestone:** M1
- **Paths:** `packages/matstack/src/index.ts, packages/matstack/src/mask-mesh.ts, packages/matstack/src/shelf.ts, packages/cartlab, apps/web/src/studio`
- **Verify:** `node scripts/test-layered-material.mjs && node scripts/test-material-cartridge.mjs`
- **Updated:** 2026-10-22 13:08
- **Commit:** `959a74c`

Implement the 4 Rule 8a catches from `ARGO_NOTE_43` + Plan 41 step 4:
1. **Mechanical abrasion on top:** Ensure `edge-wear`, `paint-chips`, and `scratches` evaluate above `dirt`/`rust-bloom` so sharp convex edges expose bright metal (`maxMetal > 0.45`).
2. **Suppress coat/aniso bleed-through:** Include `'coat'` and `'aniso'` in `writes` for opaque weathering layers (`rust-bloom`, `heavy-rust`, `dirt`, `grime`, `dust`, `moon-dust`, `moss`) so underlying clearcoat/anisotropy does not bleed through mud or rust.
3. **Coplanar edge deduplication (`mask-mesh.ts`):** Deduplicate colinear `SharpEdge` segments sharing the same `(inward, dot(a, inward))` line before `.slice(0, EDGE_LINES)` on notched polygons with > 4 boundary edges.
4. **Layer & Solvent Cartridges + Studio Materials Workspace:** Add `{ layer }` and `{ solvent: true }` cartridges to `@hm/cartlab` and beam `Apply`, and replace `material-designer.tsx` in the Studio with the full 5-level Materials workspace.

## JOB-05 [OPEN] Fix failing E2E regressions: test-base-tabs hardpoint aim & e2e-smoke home menu
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

## JOB-06 [REVIEW] Plan 40: Bring Your Own Agent Studio API, Vision+Coverage Loop & studio-skill.md
- **Role:** ENGINEER
- **Skills:** `feature-dev`, `route`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `apps/web/src/studio, scripts/studio-agent-bridge.mjs, packages/studiomesh`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Updated:** 2026-10-22 13:32
- **Commit:** `00c3bea`

Implement Plan 40 (`docs/argo/plans/40-bring-your-own-agent.md` + `ARGO_NOTE_32` + `ARGO_NOTE_43` §3 + `docs/OVERWATCH_TECH_AND_AI_RADAR.md`):
1. `studio-agent.ts` exposing `studio.doc.read`, `studio.commands.list` (`matstack.setPaint`, `matstack.setAge`, `matstack.addLayer`, `matstack.updateLayer`, `matstack.setMaskInput`), `studio.doc.propose`, `studio.changes.list/accept/reject`, `studio.capture({ mode: 'view' | 'turntable4', includeStaged: true, rank, maskView })`, `studio.kit.validate`, and **`studio.material.coverage(spec)`** (returning numeric % coverage on top/side/edge/crevice/bottom zones so AI agents self-correct before rendering).
2. Auto-generate `studio-skill.md` with the mandatory **4-Step Closed-Loop Vision + Coverage Playbook** (`Propose` -> `studio.kit.validate` -> `studio.material.coverage` -> `studio.capture({ mode: 'turntable4', maskView })`) and 3 worked examples.
3. Wire `scripts/studio-agent-bridge.mjs` with session pairing key.

## JOB-07 [OPEN] Plan 42: Modular STARGATE_KIT, Movable/Lockable Gate, Random Dialing & Earth Plot Biome Preset
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

## JOB-08 [OPEN] TICKET-40 Phase 2: From-scratch modular kits for all 11 Machines & 3 Vehicles (Zero GLB Cores)
- **Role:** ARCHITECT
- **Skills:** `visual-verify`
- **Priority:** P1
- **Milestone:** M2
- **Paths:** `packages/partgen, packages/kitspec, apps/web/src/play/plot-kits.ts, apps/web/src/play/kit-hauler.ts, apps/web/src/play/kit-crawler.ts`
- **Verify:** `npm.cmd run typecheck && node scripts/kit-compare-sheet.mjs`
- **Updated:** 2026-10-22 13:32

Per `RULES 8a`, Owner directive (21 Oct), and `docs/OVERWATCH_TECH_AND_AI_RADAR.md` critique:
1. Delete the legacy `HEAVY_KITS` frames-around-GLB-cores stopgap in `plot-kits.ts` and replace `HOUSING_LED_ANCHOR` + 76-ray `ledMount()` in `machine-props.ts` with a first-class `statusLed` socket + `lamp` part + `lx:` preset on every machine kit.
2. Author full from-scratch `@hm/partgen` + `@hm/kitspec` + `@hm/matstack` + `lx:` assemblies for all 11 machines (`MILL_V2`, `PRESS_V2`, `WATERMAKER_V2`, `PROJECTOR_V2`, `DRILL_V2`, `POWER_V2`, `PYLON_V2`, and heavy variants) plus `FABRICATOR_V2`.
3. Upgrade `HAULER_KIT`, `CRAWLER_KIT`, and author `SCOUT_KIT` to remove `{ kind: 'gen' }` baked GLB wheels/arms (`hauler-wheel`, `crawler-arm`) and capacitor `'can'` stand-ins, using real `@hm/partgen` `'wheel'` and `'track-pod'` generators, `@hm/matstack` (`mat:`), and `lx:` headlamps.

## JOB-09 [OPEN] Open Lab & Window Vista QA Polish + Preset Inception Fixes (POL-25, 38, 101, 102, 103, 121, 296, 311)
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

## JOB-10 [OPEN] Open Terrain, Combat, Anomaly Nodes & S-Space Rift QA Polish (POL-23, 29, 30, 33, 34, 37, 98, 100)
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

## JOB-11 [OPEN] Open Stage-Look (OKLab POL-49), Suit-Cam & Inspector QA Polish (POL-36, 49, 52, 53, 54, 60, 63, 74, 75, 81, 297)
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

## JOB-17 [REVIEW] Universal Cartridge Targetability ("Modular Preset Inception") & AABB Kit Raycast
- **Role:** ENGINEER
- **Skills:** `perf`, `code-review`
- **Priority:** P0
- **Milestone:** M2
- **Paths:** `apps/web/src/play/play-scene.ts, apps/web/src/play/lab-room.ts, apps/web/src/play/plot-kits.ts, apps/web/src/assets/gen-props.ts, apps/web/src/base/kit-pieces.ts`
- **Verify:** `npm.cmd run typecheck && node scripts/test-material-cartridge.mjs && node scripts/test-part-cartridge.mjs`
- **Updated:** 2026-10-22 13:33
- **Commit:** `7935d76` (raycast + dead paths; vehicles and base pieces still to wire)

Fix the #1 Modular Preset Inception gap uncovered in `docs/OVERWATCH_TECH_AND_AI_RADAR.md`:
1. **Enable Kit Targetability Across the Whole World:** Currently `lab-room.ts` only registers `capacitor-bank` in `kits`, and `plot-kits.ts` has `kitFrames = false` (so `aimKitPart()` returns `null` for 100% of planet machines, vehicles, base structures, and Lab stations). Wire `aimKitPart()` and `setKitOverrides()` to cover all plot machines (`plot:<id>`), all Lab stations (`lab-room.ts`), all 3 vehicles (`createGenRover` wired to `SCOUT_KIT`, `HAULER_KIT`, `CRAWLER_KIT`), the Stargate (`STARGATE_KIT`), and built base pieces (`kit-pieces.ts`).
2. **Two-Level AABB Accelerated `aimKitPart()` Raycasting:** Pre-check ray against each `KitBuild`'s outer world AABB and `PlacedPart` bounds before triangle intersection so scaling kits to the whole plot costs < 0.1 ms CPU on the GTX 950M.
3. **Clean Up Dead Legacy Paths:** Delete unused `createGenMachineProp` in `apps/web/src/assets/gen-props.ts` (`POL-76`) and remove the dead inverted-sign `MACHINE_PLUME_GRAVITY` export at the bottom of `apps/web/src/play/machine-props.ts`.

## JOB-18 [OPEN] Recurring Overwatch: Modular Preset Inception Audit & AI/Fidelity Tech Radar
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

## JOB-19 [REVIEW] Plan 43: Modular Locomotion (`loc:`), Stage-Fidelity Animation (`anim:`) & Logic Graph Presets (`logic:`)
- **Role:** BUILDER
- **Skills:** `frontend`
- **Priority:** P1
- **Milestone:** M3
- **Paths:** `packages/kinematic, packages/anim, packages/triggers, packages/wiregraph, apps/web/src/play, docs/argo/plans/43-modular-motion-and-logic-presets.md`
- **Verify:** `node --import tsx --test packages/kinematic/tests/modular-motion.test.ts && npm.cmd run typecheck`
- **Updated:** 2026-10-25
- **Commit:** see the JOB-19 commit on `arena/a2368b82-heavymetal2` (PR #68)

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

## JOB-20 [OPEN] Recursive Sprite (`@hm/shareware`), Procedural Audio Stem (`@hm/soundlab` + `@hm/musicbox`) & Stage Skin (`@hm/skin`) Preset Factories
- **Role:** ARCHITECT
- **Skills:** `frontend`
- **Priority:** P2
- **Milestone:** M3
- **Paths:** `packages/shareware, packages/soundlab, packages/musicbox, packages/skin, packages/cartlab, apps/web/src/lab, apps/web/src/studio`
- **Verify:** `npm.cmd run typecheck && npm.cmd test`
- **Updated:** 2026-10-22 14:09

Complete the remaining domains of the Universal 5-Rung "Presets Inside Presets" table so sprites, audio, and stage skins are 100% modular across $S_0 \to S_6$:
1. **2D Sprite & Billboard Preset Factory (`@hm/shareware` + `@hm/texgraph` + `@hm/partgen`):** Generate 8-angle Stage 0–2 shareware sprites and animated billboard sheets directly from 3D `@hm/kitspec` / `@hm/partgen` turntables + `@hm/skin` OKLab palettes, with in-game sliders (Angle Count, Pixel Size, Palette Skin, Frame Rate) and full Studio sprite-sheet editor.
2. **Procedural Audio & Music Stem Presets (`@hm/soundlab` + `@hm/musicbox`):** Build machine hums, Beam Rifle verbs, Gate chevron locks, and stage music stems from recursive `@hm/soundlab` synth patches (`oscillator` -> `envelope` -> `filter` -> `stem` -> `stage mix`), quantization-stepped from 1-bit PC speaker ($S_0$) to FM chip ($S_1\text{--}S_2$) to full spatial stereo ($S_4\text{--}S_6$).
3. **Cartridge & Bench Parity:** Allow printing Sprite/Skin (`pxdc:`) and Sound (`sndc:`) cartridges at the Lab Bench with live preview playback and Beam Rifle `Apply` onto any world kit, turret, door, or radio.

## JOB-12 [REVIEW] 3D PC Full Verification of Landed Wave 1 & Wave 2 QA Bundles (T18..T28 + F-24..F-28)
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
