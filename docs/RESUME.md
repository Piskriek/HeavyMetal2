# RESUME: start here (fresh session)

## 22 Oct Checkpoint (Antigravity Argon: Plan 42 & Unified Cross-Session Instructions; read this first)
- **Owner architectural synthesis (22 Oct, recorded in [`docs/OWNER_ASKS.md`](OWNER_ASKS.md) & [`docs/argo/plans/42-modular-stargate-earth-endgame.md`](argo/plans/42-modular-stargate-earth-endgame.md)):**
  1. **Stargate Campaign as Studio Onboarding ("The Bakery & The Cake"):** The *FIDELITY* campaign is completely modular. Progressing through the 6 fidelity stages ($S_0 \to S_6$) teaches the player how the Studio's algorithmic preset systems work across all four floats ($\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq}$).
  2. **Two-Tier Preset Control:** Every object in the game (machines, parts, materials, lights, flora, structures, gates) is built from modular presets that players modify with **curated sliders + live 3D turntable previews in-game** (at the Lab Bench / Planet Drafting Table) and edit with **full graph/layer/operator control inside The Studio** ([Plan 38](argo/plans/38-parts-modules-presets.md), [Plan 39](argo/plans/39-one-pattern-preset-factories.md), [Plan 40](argo/plans/40-bring-your-own-agent.md), [Plan 41](argo/plans/41-layered-materials.md), [Plan 42](argo/plans/42-modular-stargate-earth-endgame.md)).
  3. **Stage-6 Earth Restoration & Dual-World Sandbox:** Unlocking all 6 fidelity stages stabilizes the Breach and saves Earth, unlocking full sandbox building on both the **Earth Plot** and the **Moon Plot** so players can use the preset tools to build custom games and share them with the wider network.
  4. **Movable, Lockable & Random-Dialable Stargates (`@hm/coopnet` & `BaseWorld`):**
     - Plot owners can **move/reposition their Gate** (`moveGate`) on their Moon or Earth plot or **close/lock it off** (`gateAccess: 'open' | 'code-only' | 'closed'`).
     - Explorers can **dial random open gates** (`dialRandomGate`) to endlessly explore and compare player worlds and custom presets across the network.
  5. **Synchronized Cross-Session Agent Instructions & Command Center Job Board:**
     - Updated [`.agents/GEMINI.md`](../.agents/GEMINI.md), [`CLAUDE.md`](../CLAUDE.md), [`docs/argo/RULES.md`](argo/RULES.md), and [`docs/OWNER_ASKS.md`](OWNER_ASKS.md) so that whichever environment has active usage (Antigravity Gemini or Claude Opus) recovers the exact project state and enforces `RULES 8a`.
     - Built the **Multi-Agent Command Center & GitHub Job Board** ([`COMMAND_CENTER.bat`](../COMMAND_CENTER.bat), [`scripts/command-center.mjs`](../scripts/command-center.mjs) at `http://localhost:8090`, [`scripts/agent-worker.mjs`](../scripts/agent-worker.mjs), and [`docs/JOB_BOARD.md`](JOB_BOARD.md)), plus a **Command Center** launch button in the Studio header (`apps/web/src/studio/studio-app.tsx`). Agents can watch `docs/JOB_BOARD.md` locally or via GitHub (`node scripts/agent-worker.mjs --watch --agent <AGENT> --github`).
     - **Standing Overwatch Critique & AI/Tech Radar ([`docs/OVERWATCH_TECH_AND_AI_RADAR.md`](OVERWATCH_TECH_AND_AI_RADAR.md), `JOB-17`, `JOB-18`):** Audited all jobs and live code for **"Modular Preset Inception"** gaps, catching that `aimKitPart()` currently only hits `capacitor-bank` in the Lab (`plot-kits.ts` has `kitFrames = false` and vehicles/base structures bypass `@hm/kitspec`), plus dead `createGenMachineProp` (`POL-76`) and inverted `MACHINE_PLUME_GRAVITY` in `machine-props.ts`. Added `JOB-17` (Universal Cartridge Targetability + Two-Level AABB Kit Raycasting) and `JOB-18` (Recurring Overwatch Audit & AI/Fidelity Tech Radar on every session wake).
     - **Universal 5-Rung "Presets Inside Presets" Law & On-Foot Jump Fix ([Plan 43](argo/plans/43-modular-motion-and-logic-presets.md), `JOB-19`, `JOB-20`):**
       - Defined the **Universal 5-Rung Recursive Preset Architecture** (`Rung 1 Atoms -> Rung 2 Stack/Curve -> Rung 3 Part/Clip/Stem -> Rung 4 Kit/Assembly -> Rung 5 Cartridge/World`) across all 7 domains on [`docs/JOB_BOARD.md`](JOB_BOARD.md): **3D Parts/Kits**, **Materials/Tiles**, **2D Sprites/Shareware** (`JOB-20`), **Locomotion/Motion/Animations** (`JOB-19`), **Code/Logic/AI** (`JOB-19`), **Audio/Lighting** (`JOB-20`), and **Flora/Biomes** (`JOB-07`).
       - Shipped `@hm/kinematic/modular-motion` (`LOCOMOTION_PRESETS`, `stepVerticalJump`, `stageAnimRateHz`, `evaluateKitMotion` with 3/3 passing unit tests in `packages/kinematic/tests/modular-motion.test.ts`), fixed the rising-edge `jump.reset()` bug in `apps/web/src/avatar/scientist/animator.ts`, and wired `Space` to on-foot jumping in `apps/web/src/play/play.tsx` and `apps/web/src/play/play-scene.ts`.
- **Immediate execution queue when resuming code work (from 21 Oct state below + Plans 42–43 + Overwatch Critique):**
  1. Complete the **Plan 41 / TICKET-40 v5 / TICKET-41** items (`JOB-01`..`JOB-04`) and **Universal Cartridge Targetability (`JOB-17`)** so Part, Material, and Light Cartridges work on every machine, vehicle, base piece, Lab station, and Stargate in the game.
  2. Build **Plan 40** (`JOB-06`: Bring Your Own Agent Studio API with the 4-Step Vision+Coverage Loop: `studio-agent.ts`, `studio.material.coverage`, `studio-skill.md`, `studio.capture`, `studio.kit.validate`).
  3. Build **Plan 42 P0/P1** (`JOB-07`: modular `STARGATE_KIT` with physical Iris shield, `moveGate` & `setGateAccess` in `BaseWorld`, `dialRandomGate` in `@hm/coopnet`, and Stage-6 Earth Plot `PlotBiomePreset` sandbox unlock) and **Plan 43 / Sprite & Audio Presets** (`JOB-19`, `JOB-20`).

## OPUS STATE (21 Oct, evening: ON HOLD; read this first)
- **Hold (owner, 21 Oct ~17:30):** "lets hold here be ready to kickoff again in a while from now". The resources go to the other game first, then back here.
  - Nothing is running.
  - The branch is pushed and clean at `4255650c`, except the usual untracked `arena-gathered/`.
- **The owner's direction being built:** layered machine materials.
  - His words: "materials should be like machine parts presets, a combo of diffuse/normals/specular/bump/roughness/detail/ramp.. presets like rust/wear/dirt.. ready to apply and tweak .. keep asking yourself, is this modular, and can it be? the game is the cake .. in the bakery we are building". Memory: `modular-everything`.
  - **Research:** `docs/MATERIAL_LAYERS_RESEARCH.md`.
  - **Plan:** `docs/argo/plans/41-layered-materials.md`. Its section 7 has the done list and the next list.
- **Built 21 Oct (all tested):**
  - **`@hm/matstack`:**
    - the spec and reference formulas;
    - mask attributes (edge and crease lines per vertex, no extra triangles);
    - rank 0 flattened per face;
    - Argo's shelf (29 surfaces, 11 masks, 16 layers, 16 materials);
    - material codes (`matc:`, presetcodec).

    29 tests.
  - **The renderer `layered-material.ts`:**
    - ranks 0, 1 and 2 (flat, standard, physical);
    - the mask view;
    - kit-build's `layering` hook;
    - wired into lab and plot kit builds;
    - the plot reflection (the 0.35 metal cap is gone).

    Its GLSL matches matstack pixel for pixel: `scripts/test-layered-material.mjs` 7/7.
  - **The bench's Materials page, Machines shelf** (the Ground shelf stays the default):
    - a pinned test piece with mask view, and thumbnails;
    - paints, the layer stack and age;
    - Save (Yours) and Print a material cartridge (cartlab `material` print);
    - beam Apply: a tap dresses one part, a hold every part that wore the same;
    - plot saves keep `matc:` codes.

    `scripts/test-material-cartridge.mjs` 17/17. Also green: part-cartridge 28/28, lights 12/12, species 11/11, my-presets 10/10, lab-overhaul 78/78.
  - **partgen:** TICKET-40 v3's 13 new generators are installed (the old 7 build byte-identical). The bench's Parts page shelves the 20 in four families, with the live view pinned on top.
  - **Review tools:**
    - `scripts/material-sheet.mjs`;
    - `scripts/material-coverage.mjs` (each layer's coverage on faces, edges, creases, tops and the splash zone);
    - `scripts/kit-compare-sheet.mjs`, which draws `mat:` and `lx:` as the game does.
- **Open, in this order, when we resume:**
  1. **The perf gate is not yet proven.** `scripts/perf-layered-material.mjs` on the GTX 950M, Medium, 1080p: the median stayed 16.7 ms plain and in six layers, but both are capped at 60 Hz even with vsync flagged off. p95 went from 17.3 to 17.9 ms, and draw calls from 63 to 59. Find an uncapped measurement (Chrome's `--disable-frame-rate-limit`, or GPU timer queries) and re-run before calling it passed.
  2. **Argo, back at 18:13 on 21 Oct (Argon task mode, chat `77f3bf1cb56ba86c`):** he has not yet read the v4 review. Before typing, clear the stray "Allow" left in his input. The files are in Setmix:
     - `OPUS_NOTE_41_ticket40_review_v4.md` (1NNqjhQpTg3dC7_BDj0mQTykQtXXo_r7e);
     - `opus-matstack-coverage.txt` (1l6--QJFfKDKWh-L6Km1e-CNXF_p-VRSD);
     - `opus-t40v4-review-mill-compare.png` (1JaWtqXZLH6pQp6MT4WY2ORykvM17zoF_);
     - `opus-matstack-shelf-sheet.png` (1gGUPj0-zi3CmutP44H-6DvfCOvLu5WF9).

     He also has `OPUS_NOTE_44_tile_library.md` (TICKET-41) and `texgraph-index.ts`. Ask him for:
     - (a) TICKET-40 v5: the `kit-modules.ts` line 444 typing and the `kits.test.ts` palette test;
     - (b) the shelf's coverage tuning: rust bloom covers 67% of faces, soot never shows, and the ore bed's moon dust makes the hopper read as a light tray;
     - (c) TICKET-41, the 20 tile graphs and the nodes they need;
     - (d) his chamfered shader-ball test piece, if he still wants it (the bench uses an interim piece in `material-preview.tsx`).

     The v4 bundle is unpacked in `arena-gathered/argo-ticket40-v4/` (held). Install the mill only after v5 passes the same review.
  3. **Opus next:**
     - the layer cartridge (one layer over whatever a part wears);
     - the Studio Materials workspace (replaces `material-designer.tsx`);
     - the matstack commands for plan 40 (bring your own agent; Argo approved it with three additions, now in the plan);
     - then plan 40.
- **Known stale test:** `scripts/e2e-smoke.mjs` fails on the home screen. It expects the 8 Oct menu list and copy, which the home redesign changed; this is not from the material work.
- **Infra:**
  - The 3D PC moved to 192.168.0.5 (`scripts/worker.env`): the router reservation did not hold.
  - Adobe Substance 3D Painter 7.2.3 is installed there. Whether its licence is active is a question for the owner; it is plan 41's P1 look target.

## OPUS STATE (21 Oct, later; superseded by the evening hold above)
- **Owner rules added today:** "you guys need to check each other, shortcuts are unacceptable" (RULES 8a, memory `no-shortcuts-cross-check`): every Argo bundle is reviewed before install (tests against our packages, measured fit, four sides, the rules), every brief of mine is open to his challenge, no stopgap without the owner's yes. And the machines get rebuilt from parts (owner: "ok good so you understand the machines get rebuilt with the parts").
- **Branch pushed, green** at ee64a7e2: 3,117 unit tests; species 11/11, part-cartridge 28/28, beam-tool 61/61, lab-overhaul 78/78, studio-tabs 52/52, machine-plumes 121/121, machine-inspector 27/27, base-building pass. Pre-existing: `test-base-tabs` 2/4 (fails at 6043d0c7 too; a session card is offered).
- **Done today:** plan 39 steps 1-3 in play.
  - **Parts (Vtx):** bench and planet Drafting Table print parts; fired at lab and plot kit machines, like for like.
  - **Skins (Pxd):** a material cartridge paints a part's body.
  - **Species (Aq):** the bench's Species page (live tree, thumbnails, canopy balls, try-on), species cartridges, a tap or hold regrows trees on the plot, saved by place, at most 6 presets a plot.
  - **Previews drive play** (live turntable plus hover try-on on every bench page).
  - **Status lights** now sit on the real housing surface (they floated 0.13 to 1.95 m).
  - **Tooling:** `scripts/machine-reference-sheet.mjs`, `parts-reference-sheet.mjs`, `kit-compare-sheet.mjs` (the review tools).
- **TICKET-40 (Argo's from-scratch rebuild) is under review and held** in `arena-gathered/argo-ticket40-v2/` (not installed): v2's mill design is right (compact housing, no cage), but its body names five vault materials that do not exist (so it does not draw), the palette is near-black, and the hopper, chute and wheel generators do not do their jobs. Full findings: `docs/argo/notes/OPUS_NOTE_41_ticket40_review.md` (also in Setmix as OPUS_NOTE_41_ticket40_review_v2.md, with the shots). **Argo hit his usage limit; back 21 Oct 08:13.** First thing then: in his chat (Argon task mode, not Flash), point him at OPUS_NOTE_41 v2 in Setmix and ask for a v3 bundle; then run the same review: unpack, typecheck, `kit-compare-sheet.mjs mill ...` (with MSYS_NO_PATHCONV=1), the parts sheet, and show the owner the pilot only once it passes.
- **Stopgaps still in the code, removed by TICKET-40:** the frames-around-cores (`HEAVY_KITS` in `plot-kits.ts`, off), the plot kits' 0.35 metal cap (his answer: a planet environment map), flat trim colours (his answer: a banded trim texture). TICKET-39b is superseded.
- **Plan 39 step 4 done (9c894fbe):** the bench's Lights page and light cartridges; the lab's capacitor bank has a charge lamp on each cap (facing the room); a tap sets one lamp, a hold all; `test-light-cartridge` 12/12. All four preset factories are in play.
- **Next for Opus:** (1) when Argo is back (08:13): point him at OPUS_NOTE_41 v2 in Setmix for TICKET-40 v3, and ask him to review plan 40 (`docs/argo/plans/40-bring-your-own-agent.md`, research in `docs/BYOA_RESEARCH.md`); (2) review v3 with the same tools before the owner sees the pilot mill; (3) build plan 40 once Argo has reviewed it. Session cards are offered for player-relative tree near/far and for test-base-tabs.
- **Agents:** Flash 0% for 7 days. Web Argo via chat `77f3bf1cb56ba86c` (Argon, task mode) and the Drive folder Setmix.

## OPUS STATE (21 Oct, earlier; superseded above)
- **Branch pushed, green:** typecheck clean; 3,109 unit + 23 speed tests pass (two timing tests fail only while the browser pane renders the game: close it before `npm test`); single file 13.80 MB of 16. `test-part-cartridge` 28/28, lab-overhaul 78/78, studio-tabs 52/52, base-building, machine-inspector 27/27, machine-plumes 121/121.
- **Pre-existing failure (not ours, fails at HEAD 6043d0c7 too):** `test-base-tabs` cannot aim the camera at the hardpoint (2/4).
- **New today:**
  - **Previews drive play (owner rule, memory `previews-drive-play`, plan 39 item 7):** the bench Parts page has a live turntable of the printed part (`part-preview.tsx`, its own small WebGL context only while open), hover/focus try-on (a tag; leave restores, click keeps), part thumbnails, materials as lit balls.
  - **The planet Drafting Table's Parts tab** prints a part at once from a rack blank into the rifle (`printPart`/`freeBlank` in cartlab).
  - **Part cartridges on planet kit machines** (kit id `plot:<id>@<built>`), **like for like** (a cartridge fits only its own generator).
  - **Material cartridges paint a part's skin** (plan 39 step 2, `vault-skin.ts`): tap = the part's body slot, hold = every part that wore the same material; the preset's evaluated 64 px tile on Medium/High, flat look on Low.
  - **The bench mirror** copies a part flush against its own far face.
- **TICKET-39 installed** (Argo's kits: fabricator, mill/press/watermaker frames, hauler, crawler, trim palette; his 32 tests pass). The heavies and the fabricator build from them in `plot-kits.ts`, **but the frames ship OFF** (`kitFrames=false`; `__dev.kitFrames(true)` for tests): measured against the real cores, face parts float (the mill is a +-1.1 m body on a +-2.0 m plinth, not +-1.72). **Argo is on TICKET-39b** (refit from my raycast profiles, OPUS_NOTE_36, sent in chat 21 Oct). When it lands: unpack, run kits.test + plot-kits.test, turn the frames on, look at each machine from four sides, run machine-plumes + part-cartridge. Open palette questions to him: trim bands (banded texture vs own materials) and a planet environment map vs the 0.35 metal cap. Hauler/crawler not wired yet (check their mounts against the measured wheel/arm after 39b).
- **Next:** plan 39 step 3 (Aq: species presets, research first; note `applyTreePresetAt` with sliders regrows the shared species mesh, so per-tree variants need their own slots) and step 4 (Lx: light presets); then Bring Your Own Agent (Studio section 9; TICKET-30 in `arena-gathered/argo-ticket30/`).
- **Deferred by Argo (4e):** viewmodel inertia / hit-stop and the 256-slot linked storage pool.
- **Agents:** Flash 0% for 7 days. Web Argo via chat `77f3bf1cb56ba86c` and the Drive folder Setmix.

## OPUS STATE (20 Oct evening; superseded by 21 Oct above)
- **Branch pushed and green:** typecheck clean, 3,064 unit tests + 23 speed tests pass, single file 13.76 MB of 16. Merged today: the fix-3 session (lab draw calls 181, HUD portrait, beam test on the X radial) and the plotbiome session (bake 38.9 -> 16.9 ms, bit-identical).
- **Installed from Argo (ARGO_NOTE_34):** `@hm/meshops` (27 Studio operators in 6 families, TICKET-33..38) and the TICKET-31 foliage patch (`@hm/treegen` + `plot-biome-view.ts`, growTree bit-identical over 48 trees). Bugs fixed on install: plane-slice-clip zero-area polygons; surface-edge-wear-ao wore every edge (now only sharp edges, clipped in-plane); operator slider units (partgen `deg`/`factor`).
- **TICKET-32 (the fat-green-bolt loop) works end to end:** the lab bench's Parts page prints a part cartridge (Argo's cost tiers in raw vertices and raw pixels, base `pay` command); R and the X radial load it; in the lab, Apply tap = one part, hold 0.45 s or Shift = every part of that generator on the machine; overrides in the props save; the port keeps its part over a reload. `scripts/test-part-cartridge.mjs` 13/13.
- **The Studio Parts workspace:** Part and Stack pages; Stack = Argo's non-destructive operator stack (add, mute, reorder, remove, named presets, R0-R2 per layer, sliders).
- **Kits:** `@hm/kitspec` (parts, modules, presets, overrides, presetSockets), `@hm/partgen` (7 parametric parts), `kit-build.ts` (merge by material and rank window, partAt picking), `kit-machine.ts` (kit preset -> plot MachineProp from its power/vent/feed/top sockets; rank = min(stage, tier)). The lab's capacitor bank is the pilot.
- **Waiting on Argo: TICKET-39,** the kit specs (fabricator frame; mill/press/watermaker frames around heavygear cores; hauler and crawler hulls; the hull-steel / accent-hardware trim palette), briefed in chat 20 Oct ~20:00 with fresh sources in Setmix (kitspec-index-v2.ts, partgen-index-v2.ts, kit-capacitor-bank-v2.ts, heavygear-index.ts, gen-props.ts, machine-props.ts). When it lands: unpack into arena-gathered, validate each kit, register them in machine-props via kitMachineProp, run machine-plumes, base-building, ticket13, campaign on the 3D PC.
- **After that:** the planet Drafting Table's Parts page and Apply on planet kit machines (Argo ruling D.1: both benches print); plan 39's Lx (light presets) and Aq (species presets via `applyTreePresetAt`) factories; then Bring Your Own Agent (Studio section 9; Argo's TICKET-30 in `arena-gathered/argo-ticket30/`).
- **Deferred by Argo (4e):** viewmodel inertia / hit-stop and the 256-slot linked storage pool (helpers in argo-ticket22/23).
- **Plans:** 37 (retrofit split rejected), 38 (kits; sections 5-9 progress), 39 (one pattern: four preset factories, preset inception).
- **Agents:** Flash 0% for 7 days. Web Argo via chat `77f3bf1cb56ba86c` and the Drive folder Setmix (the browser pane is signed in; his session resets 22:13).

## HAND-BACK from Argo (Antigravity Argon, 20 Oct morning; read this first)
1. **All Flash Queue (`F-24..F-28`), Wave 1 (`T18`, `T21`, `T19`, `T22`), and Wave 2 (`T23..T28`) landed locally on `feat/monster-mash-exploration`:**
   - **`1b5011c7` (`F-27 (T15)` + `F-28 (T13b)`):** Completed Flash's in-progress `T15` (5-chord harmonic machine choir, diegetic radio & 6 cassette tapes, beat-synced plume breath & `[V]` Turbo Bass subwoofer mode) and `T13b` (`heavy-terraformers.ts`, perimeter defence turret & rover assembly gantry in `machine-props.ts`, `placeable-machines.ts`, `build-bar.tsx`, and `play-scene.ts` Window C).
   - **Wave 1 (`T18`, `T21`, `T19`, `T22`) + Wave 2 (`T23..T28`) Commit:**
     - **TICKET-18 (`POL-35`, `44`, `45`, `46`):** Title-card banner hold queue (`packages/hudmath/src/toast-queue-and-compass.ts`), rover drift badge + compass leak bearings + 25 m Gate dome `SyncWord` hide, responsive build drawer (`max-width: calc(100vw - 496px)`, `bottom: 104px` in `hud-zones.tsx`).
     - **TICKET-19 (`Window F`, `POL-65..69`, `104`, `105`, `121`, `171..173`):** `mergeStaticMeshes(..., keep)` across swapped Lab GLBs + geometry disposal (`lab-room.ts`, preserving `T07b`'s `room.armory.setTaken`), Capacitor Bank copper bus bars, metric lamp bars, floor cable treads, relay beacon cages, `0.95 rad` console lever throw (`lab-machines.ts`, preserving `F-13`'s `LabStationId` and `T16b`'s `setOperating`), and co-op gate-pad seed / lab-transition hide / debounced terrain sculpt sync (`packages/coopnet/src/sculpt-and-pad-sync.ts`, `OutpostRoom.ts`, `remote-peers.ts`, `window-f-lab-and-coop-hooks.ts`).
     - **TICKET-21 (`POL-12`, `P2-VEH-06`):** Zero-dependency `.glb`/`.vrm` binary inspector & 6-bone humanoid retargeter (`packages/anim/src/bone-retarget-map.ts`), IndexedDB store (`custom-avatar-store.ts`), `AvatarDock` dropzone keeping Hazmat Scientist as default, Workshop Vehicle Reskin panel (`workshop-vehicle-reskin.tsx`), and Beam Rifle hybrid cartridge modes (`Scatter Excavator` & `Color Spewer` in `packages/beamkit/src/hybrid-cartridge-modes.ts` & `beam-tool.ts`).
     - **TICKET-22 (`Window G`, `POL-49`, `281`, `282`, turret corner cap):** `planarBrk` tri-planar world-locked Bayer dither & damped Stage-0 luminance (`packages/groundshader/src/yaw-stable-dither.ts`, `portal-shaders.ts` preserving `T16b`'s `POL-301`), `resolveTurretCornerMount` (`0.96 m` corner cap block + `0.12 m` inward seat), press exhaust vent offsets (`+0.68 m` / `+1.15 m`) & `MACHINE_PLUME_GRAVITY` (`machine-props.ts`, `window-g-final-qa-hooks.ts`).
     - **TICKET-23 (`POL-39`, `73`, `77`):** 4-state machine housing status LED (`#3eff8b` running / `#ff9f2e` starved / `#3dc8ff` full / `#ff3d5a` unpowered), 100-item feed/output hopper caps + `linkedReserve` overflow (`packages/plotsim/src/hopper-and-led-rules.ts`, `placeable-machines.ts`, `machine-inspect.ts`).
     - **TICKET-24 (`POL-01`, `42`, `64`, `67`, `71`, `83`, `85`):** Main Menu frosted glass blade (`14 px` blur) & hero vista controller (`menu-hero-blade.tsx`), 16-colour IBM EGA Skin-1 quantizer & 40 ms CRT degauss coil pulse (`packages/hudmath/src/ega-palette-and-degauss.ts`), Gate ignition exponential capacitor charge curve (`68 -> 640 Hz` + amber arc crackle), scoped `.play[data-hud-root]` CSS (`play.css`), and `FIDELITY_LOADER_LABELS`.
     - **TICKET-25 (`Window H`, `POL-26`, `27`, `47`):** First-person procedural viewmodel inertia, sprint-to-fire recovery (`140 ms`), reload dip & 12° holstered climb (`packages/anim/src/viewmodel-inertia-and-ik.ts`), monster knockback velocity impulse & 90 ms white-hot hit-stop flash, and `0.55 m` ankle step-up / vertical wall slide (`window-h-combat-and-ik-hooks.ts`).
     - **TICKET-26 (`POL-16`, `84`):** Claimed sector readout (`SECTOR #04 // 226 m NE`) on Planetary Grid, 6-chevron Quantum Gate friend dialing (`2.70 s` lock), and sunflower-spiral neighbour plot rearrangement (`packages/coopnet/src/gate-dialer.ts`, `shared-planet.ts`).
     - **TICKET-27 (`POL-13`):** 256-slot Quantum Bridge linked base storage pool (`96` per-machine + `256` shared bridge reserve), priority auto-pull (`local -> bridge -> pack`) for Crafting Benches & Fabricators, and `QuantumBridgeLinkedBadge` (`packages/bridgekit/src/linked-storage-pool.ts`, `quantum-bridge-hud-badge.tsx`).
     - **TICKET-28 (`Window I`, `POL-15`, `53`):** Deterministic Keplerian 2-body orbital astrodynamics, Hohmann transfer planner, real-time Moon sky-arc projection & dynamic tidal Aq bonus (`1.00x -> 1.25x`), and 4-phase seamless surface-to-orbit launch (`packages/orbital/src/kepler-and-launch.ts`, `window-i-orbital-and-launch-hooks.ts`).
   - **All Notes Downloaded Locally:** `docs/argo/notes/ARGO_NOTE_19..28.md`.
2. **Verification Gate Results (20 Oct):**
   - `npm.cmd run typecheck`: **0 errors** across all workspaces.
   - `npm.cmd test`: **3,007 unit tests pass, 0 fail** (345 test files) + **19/19 speed tests pass**.
   - `npm.cmd run build`: **`13.74 MiB` (`14,412,513` bytes)** of the `16.00 MiB` cap (`~2.26 MiB` free headroom). `apps/web/dist/index.html` left clean at `HEAD`.
3. **Next for Opus on Return (1:00 PM Today):**
   - Run 3D PC visual/Playwright verification (`scripts/test-on-3dpc.sh`) across the newly landed `F-24..F-28` + `T18..T28` commits and push `feat/monster-mash-exploration`.
   - Plan the next priority ticket with Argo: **"Bring Your Own Agent" Studio Architecture** (`docs/OWNER_ASKS.md` 19 Oct directive, `project0.city` reference).

## HAND-BACK for Opus (written 19 Oct with 3% usage left; read this first)
1. **Flash's queue:** F-24 accepted (e847695e); F-12 then F-13, F-25 (T09b), F-26 (T16b), F-27 (T15), F-28 (T13b) in that order (`docs/sidecar/FLASH_INBOX.md`). Read each report in `FLASH_OUTBOX.md`. Check the shots yourself, the `npm test` line and the campaign line, and fix any `localStorage` or CRLF slips. Then push: the local branch is ahead with Flash commits, which Opus has NOT verified (not pushed on purpose).
2. **Argo's files in Setmix** (the owner moved them):
   - argo-ticket19-bundle.json (Window F), argo-ticket18-bundle.json (POL-35, 44, 45, 46), argo-ticket21-bundle.json (avatar import, the Workshop, beam hybrids), argo-ticket22-bundle.json (POL-49 yaw-stable dither, the window-g hooks);
   - ARGO_NOTE_19 (bundle summaries, the avatar research);
   - ARGO_NOTE_20 (TICKET-22, and his ruling on the turret plate overhanging a wall-top corner);
   - **in My Drive's root, to be moved:** ARGO_NOTE_21_install_guide_tickets_19_18_21_22 (Drive id 1gwZ3BHZ2OuSE9Bp1kl8vpUTwKb5Kpk0hBNTAhCe6Fdk: every API he assumed, with checks and fallbacks; read it before installing) and ARGO_NOTE_22_next_batch_ticket23_onward (id 17qomkwAW9QKAJGWPA18NcTyZM550LT6yTLAX7_J-WEk: the TICKET-23 to 28 plan);
   - **in progress, in My Drive's root:** Argo is writing argo-ticket23..28-bundle.json plus an ARGO_NOTE per bundle, as far as his budget reached.
3. **To process a bundle:** move it to Setmix, `curl` it, unpack it with the path-checked unpack script (lost with the old scratchpad: rewrite it, refusing absolute and `..` paths), stage it in `.stageNN`, run its tests and a strict tsc, then brief Flash (an F-job) or a Haiku. Haikus use Opus's usage; Flash and Argo don't.
4. **Drive tips:** Ctrl+A on a title search plus "More actions" works; filter chips sit where cards were before the AI overview loads, so take a fresh screenshot before clicking. The Move dialog refuses if any selected item is already in Setmix.
5. **Owner directive (19 Oct): "bring your own agent" is critical to the Studio**, which must be very agent-friendly, because Opus and the owner will use it together to make the game look good (see project0.city; memory studio-agent-friendly). Research it, then plan it with Argo as a priority ticket.
6. **Flash stopped (out of usage) at the start of F-27 (T15):** it had only listed the files to copy (harmonic-machine-choir.ts, harmonic-radio-and-turbobass.test.ts, diegetic-radio-and-tapes.ts, beat-synced-plume-and-turbobass.ts, diegetic-radio-tuner-widget.tsx; then merge the musicbox index). Check `git status` for half-done T15 edits before anything else, and finish or reset that job.
7. **Open questions:** the turret plate overhang (see ARGO_NOTE_20); POL-293 (scatter numbers), POL-294 (no GPU timer hook in play), POL-297 (the blue-sky shot).

## 19 Oct, early (read first: Opus paused about 24 h for usage)
- **Landed and pushed (verified on the 3D PC):** npm test 2,953 pass, 0 fail; the campaign 54 of 54; test-ticket13 38 of 38; the build 13.69 MB.
  - T13a: the turret (the real models, preloaded), the blue-sky push, peaceful drops, the scatter sidearm.
  - T17a: the single-file diet, 15.14 to 13.67 MiB (24 vista and unused lows to the HD pack).
  - T03P-R: Argo's plume rulings.
  - F-23: TICKET-16 part a. Opus fixed its localStorage use, the chain test and a CRLF file.
  - The campaign's beat 4 samples the dark lab at the strobe's low.
- **Flash's queue** (`docs/sidecar/FLASH_INBOX.md`, strictly in order, Flash the only play-scene writer): F-24 (the title portrait over the logo, POL-292), F-12 (T07b), F-13 (the lab aim), F-25 (T09b), F-26 (T16b), F-27 (T15), F-28 (T13b).
- **Argo** DELIVERED (ARGO_NOTE_19, Drive id 1JmxMSPeVy-jWQntdgFMeKR4pUPmj6K7xro-CjlA, 13 of 13 tests; three bundles in My Drive's root, not yet moved). Since then he's on TICKET-22 (POL-49 yaw-stable dither, window-g hooks) and ARGO_NOTE_20 (the turret plate overhang). The three bundles (OPUS_NOTE_25): TICKET-19 (Window F), TICKET-18's rest (POL-35, 44, 45, 46) and TICKET-21 (avatar import, with research first). They'll be in My Drive's root: move them to Setmix, unpack with the path-checked script, stage, then brief.
- **Argo's files:** the owner moved ARGO_NOTE_20_ticket22_and_turret_corner_ruling and argo-ticket22-bundle.json into Setmix (19 Oct). Still in My Drive's root unless the owner moved them: argo-ticket19-bundle.json, argo-ticket18-bundle.json, argo-ticket21-bundle.json and ARGO_NOTE_19 (two copies). Move them to Setmix: Drive's title-search plus Ctrl+A was flaky on 19 Oct; select them in the My Drive root list instead. F-24 is accepted (e847695e).
- **On return:** verify Flash's reports (shots, `npm test` line, campaign); collect Argo's bundles; POL-298-style question for Argo: the turret plate overhangs a thin wall-top corner.

## 18 Oct, evening (read first)
- **Landed:** the T03P follow-up (the fabricator pours while printing, feeds from the registry's measured sockets, 44b6107f); Flash's F-20 (POL-175 and 174; POL-99 half done, the HUD still shows); and `test-on-3dpc.sh` falls back to the laptop when the worker is busy (owner), running as one function so a mid-run edit can't break it.
- **TICKET-13:** the heavy machines and the gantry were already packed. Sheet 20 had no turret, so Opus drew P-41 (`panels/20/20-turret-s6.png`) and split it into turret-base, turret-yoke and turret-gun (images approved; the barrel is built in code). OPUS_NOTE_23 and `ticket13-context.json` are in Setmix; Argo is on it (ARGO_NOTE_16 first: the turret ruling and five plume answers).
- **The 3D PC pipeline was stalled** by the separate Hunyuan mini server (:8081) holding about 5 GB of VRAM. The PC agent stopped it and took it out of logon (only the pipeline and its watcher start, task `HM-Pipeline-Watcher`); the IP 192.168.0.8 is reserved on the router. The turret jobs are running.
- **Running:** Haiku T14 (the credits). Flash: F-21 (@hm/plume gravity and count), then F-22 (POL-99).
- **The play-scene queue:** free now. T07b (F-12) and T09b wait for T14 to release `play.tsx`; then F-13, T15, T16, and TICKET-13's Window C.

## 18 Oct, afternoon (read first)
- **Landed today:**
  - TICKET-12 (F-16 and F-17, Flash);
  - co-op Phase 2 (T11a and T11b);
  - TPOL;
  - TRIFT: the rift works; a wreck truck had been blocking it, so wrecks now stay 15 m from leaks;
  - T10: wall pathing, the wave band, the foregrip IK;
  - voice batch V1 (A7-01 to A9-03 and two barks);
  - Dr. Haddy's portrait.
- **The build is 14.92 MiB.** The 3D PC is at 192.168.0.8 (`scripts/worker.env`).
- **The pack script refuses a bare run now.** 79 orphan vista lows, about 5 MB, had broken PLAY.bat's build; they're in `zips/orphan-pack-2026-10-18`.
- **Argo** (chat https://gemini.google.com/app/77f3bf1cb56ba86c): every ticket in his plan (09 to 16) is delivered, staged and briefed.
- **Running:** Flash's F-19 (T14, the credits, plus the co-op HUD fixes) and Haiku T05 (play-scene).
- **The play-scene queue,** one writer at a time: T05 → T03P (plumes) → T09b (audio wiring; needs `play.tsx` after F-19) → T07b (F-12) → F-13 (the lab aim) → T15 (the choir) → T16 (Acts VII to IX, which also hides the Ending Credits item until the finale).
- **Still to plan:** TICKET-13 (heavy terraformers and turrets) needs asset batch B1 (sheets 17, 19 and 20).

## 18 Oct, morning (read first)
- **Landed:**
  - **F-09:** stage 6 on Low goes from 34 to 150 fps, from a layout key so the cover doesn't rebuild on every 0.1 s tick. The B key reads the scene's live position, and long toasts stay out of the space clear around the crosshair (479d8ae0).
  - **T06b:** the sheet 07 breaker panel and console (b60aee2f).
  - **Flash's F-15:** Studio hardening (5e77ed14).
- **Argo** (new chat https://gemini.google.com/app/77f3bf1cb56ba86c):
  - **ARGO_NOTE_10:** the TICKET-09 to 16 plan, accepted.
  - **ARGO_NOTE_11:** co-op Phase 2.
  - **Now:** he's on TICKET-10 (OPUS_NOTE_19).
- **Running:**
  - Haiku T09a (audio buses), T11a (co-op Phase 2 core) and TPOL (Argo's POL rulings, which holds `play-scene.ts` now);
  - Flash's F-16 (TICKET-12's Studio part).
- **The `play-scene.ts` queue** (one writer at a time; Opus schedules it): TPOL → T11b (co-op Window B) → T09b (audio wiring) → F-10 (T05), F-11 (plumes), F-12 (T07b) and F-13 (the lab aim), each to Flash or Haiku, whichever is free → TICKET-10 Window A (Argo's bundle, coming). F-10 and F-11 are held in Flash's inbox so Flash can't collide.
- **POL ranges in use:**
  - POL-141 to 150: TPOL;
  - POL-151 to 160: T09a;
  - POL-161 to 170: T11a;
  - POL-171 to 180: T11b;
  - POL-181 to 190: F-16.

## 18 Oct Checkpoint (read first)
- **(a) Landed (pushed):**
  - **T08b,** the Studio's Look and Scene tabs, the gizmo and the 4-angle panel (bba366cb, 7a2ab759).
  - **T07a,** the rifts, proximity spawns, the armory sidearm and the ammo badge (767f75a5).
  - **Co-op Phase 1** (plan 36): host and join an outpost by room code, with the same world hash in node and in two browser pages; the plain build stays solo (ad9eacec, 955395aa).
  - **T06,** the lab overhaul, with a draw-call pass that brought it from 307 down to 180 (6e7575dc).
  - **Build:** about 14.85 MB.
- **(b) Running:**
  - **Haiku T06b:** packs and adopts the generated sheet 07 breaker panel, isolator, console and lever (`docs/prompts/sidecar/T06b-sheet07-power-models.md`).
  - **Flash F-09** (the performance pass) is still taken. F-10 to F-14 (all `play-scene.ts`) queue behind it: T05, the plumes, T07b with POL-96 and 97, the lab aim, and the co-op hooks.
- **(c) Argo:** his Gemini chat began returning empty replies (likely full), so ARGO_NOTE_10 (the TICKET-09 onward plan) never arrived. The fresh-chat handoff is `docs/argo/notes/ARGO_HANDOFF_2026-10-18.md` (also in Setmix). The owner OK'd a fresh chat, and Opus started it on 18 October: https://gemini.google.com/app/77f3bf1cb56ba86c (Task mode, model Argon), seeded with the handoff, START_HERE, RULES and CLAUDE.md from Setmix.
- **(d) Polish:** the registry runs to POL-117. The ranges in use are POL-101 to 110 (T06), POL-111 to 120 (co-op) and POL-121 to 130 (T06b).

## 17 Oct Checkpoint (read first)
- **(a) The workflow** (`docs/argo/notes/`; Drive folder Setmix):
  - **Argo** (Gemini, PM and creative lead) gets one spec note per ticket (`OPUS_NOTE_NN`), writes or polishes the code, and saves `{files:{path:content}}` bundles. His Drive tool saves to My Drive's root, so Opus moves them into Setmix (the owner has given standing permission to upload or move anything Argo needs).
  - **Opus** runs the Arena battles and never reads their code; it judges them with hidden oracles.
  - **Sidecars install:** Gemini Flash takes jobs from `docs/sidecar/FLASH_INBOX.md` and reports in `FLASH_OUTBOX.md`; Haiku is briefed through the Agent tool (`docs/prompts/sidecar/T*.md`).
  - **Heavy checks run on the 3D PC worker** (`scripts/on-3dpc.sh` for the pushed branch, `scripts/test-on-3dpc.sh [--only paths]` for the working tree).
- **(b) Landed and verified together on the 3D PC at d153fb30:** typecheck 0; 2,782 unit tests; build 14.71 MB; ticket01 32 of 32; inspector 27 of 27; plot-biome, stage-world and base-building pass; campaign 45 of 45.
  - **TICKET-01:** colliders, the gate exit, the unpowered doorway, roof levels, the steering sign, and windows, doors, roofs and ramps on slopes.
  - **TICKET-02:** `@hm/sky` (the sky follows the stage); `@hm/plotbiome` (tufts from stage 2, bushes at 4, forest at 6); the coverage shader (the ground greens); hydro water.
  - **TICKET-03:** the machine inspector on E, the bench opening the Drafting Table, machines at real height.
- **(c) Running:**
  - Flash F-09: a performance pass, because stage 6 on Low fell to 35 fps on the laptop; the target is 45.
  - Haiku T04: thumbnails, the X radial, hold-Z to remove, build and Esc UX.
- **(d) Next:** the plume glue from `docs/argo/notes/ARGO_NOTE_08_plumes.md` (after F-09: it touches play-scene), then TICKET-05 to 08 (`ARGO_NOTE_05`). Deferred items are POL-73 to POL-77.

## 16 Oct Session Handoff Checkpoint
- **(a) Branch** `feat/monster-mash-exploration`, HEAD `df69c911`. `origin/main` is fast-forwarded to it.
- **(b) Done this session, all on Haiku workers, each accepted in `docs/SIDECAR_COMMS.md`:**
  - **TASK-24, the campaign e2e:** the act checkpoints in `apps/web/public/checkpoints/` and `docs/TEST_GUIDE.md`.
  - **TASK-25, the nine-zone HUD and build ribbon:** `apps/web/src/base/ui/hud-zones*`, `base-hud.tsx`, `build-menu.tsx`, `play.tsx`, `play-scene.ts` (ghost lock).
  - **TASK-27 (with 27b's rover camera), the stage looks:** the 0a wireframe and 0b dither (stage 1 now waits for the first output), the suit-cam setting, the sphere-cast rover camera. In `packages/plotsim`, `packages/groundshader`, `packages/camerarig`, the post pass, `play-scene.ts`, `play.tsx`.
  - **TASK-26, the base:** foundation frames with legs, the safe domes, the visible 12 kW brownout, salvage ore to the plot. In `packages/plotsim` and `apps/web/src/base/`.
  - **TASK-28, the lab:** the dark wake and power-on, the window budget at the peak frame. In `apps/web/src/play/lab-power.ts`, `lab-room.ts`, `lab-vista.ts`, `apps/web/src/lab/`.
  - **The debug menu and Instant builds:** Esc, then Debug menu. Commits ccc1ad83 to df69c911, and `scripts/test-debug-menu.mjs`.
  - **Briefs 29 to 35 are not started.** 35 (Acts VII–IX) is Argo's draft with Opus's notes.
- **(c) Failing tests and gotchas:**
  - test-stage-looks: the turn test fails, 16.9% against 10% (POL-49).
  - The lab's pre-power frame is grey, not the cold 0.08 tone.
  - The debug spawns and teleports are not browser-tested.
  - A campaign run rewrites the checkpoints: `git restore -- apps/web/public/checkpoints/` afterwards.
  - Never commit `apps/web/dist/index.html`.
  - **The owner's QA:** terraforming shows no foliage, water or texture change. The treegen, hydro and stage56 drop files are not wired in, and this is the top gap. Sync drains on long drives, as designed.
- **(d) The next session must read `ARGO_NOTE_05_PM_PROTOCOL_AND_SESSION_HANDOFF.md`** in the Setmix Drive folder: https://docs.google.com/document/d/1MpoGP7jfKlQ7KIOZSiE-KOYztBjUW0fHrQnWx9PmJ2s/edit (export it with `/export?format=md`). Then read Argo's `ARGO_GRAND_MASTER_REPORT.md` when it lands.

The context a new Opus session needs on its first message. Keep it current: update it after every finished step. Last update: 2026-10-12, by Opus on the old account at about 5% of its weekly usage.

## 1. Who and where
- **The game:** FIDELITY, the SetMix Multiverse (read `CLAUDE.md`). Repo `C:\MarbleGp`, branch `feat/monster-mash-exploration`; push after every commit.
- **The team:**
  - **Opus**, the lead and architect: briefs, reviews, glue.
  - **Haiku 5.5 sidecars**, the implementers. One at a time, through the Agent tool (model haiku, effort high, background). The prompt: "read CLAUDE.md, docs/prompts/sidecar/HANDOVER.md, the board docs/SIDECAR_COMMS.md, then <brief>; foreground tests; commit before reporting".
  - **The owner** decides features. Their words are in `docs/OWNER_ASKS.md`.
- **Run it:**
  - `PLAY.bat` builds and serves http://localhost:8080.
  - `npm run typecheck`, `npm test` (the fieldkit and plotgrid timing tests fail on this laptop; known), `npm run build`, and `npm run e2e` (the playthrough).
- **The 3D PC:** Hunyuan3D at 192.168.0.8 (see scripts/worker.env):8082 (changed from .0.5 on 2026-10-12). The token is in `.local3d-token`; never print or commit it.
  - Single image only. Multi-view crashes, so leave it OFF.
  - About 10 minutes per model, one job at a time.
- **Images:** the RUN.world CLI (`docs/runworld` and memory note runworld-setup), about 120 credits per image, balance about 66.4k. Keep the voice reserve (RUNWORLD_FLOOR 16000).

## 2. The owner's model rules (every generated asset)
- **Shape:**
  - chunky, with no thin tubes, cages, holes or deep tread;
  - **square sections** (tubing, rails, lights, housings), and nothing round unless it must be (wheels, barrels);
  - **no cloth and no heaps of small parts** (natural shapes don't reduce well);
  - no belts, no lettering, nothing floating;
  - empty cabs; the steering wheel is a square "[-u-]" yoke;
  - wall-mounted, pointy, tubular or holed parts are separate objects.
- **Workflow:** clean low cage, soft normals, colour and normals baked; silhouette parts snap on at sockets.
- **Review:** render every model from four angles before packing.

## 3. The asset pipeline (one id at a time, or a list)
1. Add it to `docs/runworld/assets.json` (`id, panel, class, size, axis, view, subject`, and optionally `fix`, `reach`, `hold`). Commit the manifest at once.
2. `node scripts/runworld-assets.mjs images <id>` makes `zips/runworld/assets/<id>/source.png`. Look at it; if good, `touch .../approved`.
3. `node scripts/local3d.mjs model <id>` makes `model-local.glb` (about 10 min).
4. `node scripts/runworld-post.mjs <id> [--levels=low]` makes norm, low, mid and high.
   - `fix: ['mirror-z'|'plain-back']` repairs an invented back.
   - `reach: 3` lengthens the bake ray for deep recesses.
5. Review: `blender -b --factory-startup -P scripts/render-angles.py -- out.png zips/runworld/assets/<id>/low.glb`, and the same for the high.
6. `node scripts/runworld-pack.mjs <ids>` writes `apps/web/src/assets/gen/*.glb` (low, inline), `apps/web/public/hd/<id>/` and registry.json (all Git LFS). Commit and push.

## 4. State right now
- **Done today (2026-10-12):**
  - the audio fixes (1c081bc0);
  - the Studio plan and briefs (TASK-17 and 18);
  - the four-angle review of every model, with the hidden sides fixed (ab224da5);
  - 14 rule-breaking models redone and packed (5a8c098f).
- **10 lab clutter props, packed and pushed (fa3395fb):** crate-large, crate-small, cardboard-stack, filing-cabinet, server-rack, locker, toolbox, coolant-can, sample-case and old-monitor. The re-baked operator-console and preset-bench lows went in with them. **They are not yet placed in the lab.**
- **Dropped** (`hold` set): crate-stack-sheet, machine-under-sheet, fallen-panels and parts-bin. The owner's rule: no cloth, no heaps.
- **lod-bake.py, fixed today:**
  - a ray miss fills with the model's colour instead of black;
  - `--reach` (`reach` in the manifest);
  - every material is de-metalled for the colour bake, because the plain-back lows had baked black.
- **The window scene:** the plan is `docs/WINDOW_SCENE_PLAN.md` and the brief `docs/prompts/sidecar/19-window-scene.md` (TASK-19, dispatched to a Haiku sidecar on 2026-10-12 afternoon; it commits after each step and posts [PROGRESS] on the board, so read the board to see how far it got).
- **Six vista pieces:** datacentre-hall, chiller-block, shipping-container, pylon-tower, overpass-segment and rubble-slab.
  - Images approved; the models were running on the 3D PC.
  - **If they are not packed yet:** for each id, check that `zips/runworld/assets/<id>/low.glb` exists (if not, `node scripts/local3d.mjs model <id>`, then `node scripts/runworld-post.mjs <id>`). Then render the angles, review, `node scripts/runworld-pack.mjs <ids>`, and commit.
- **TASK-17 (Studio shell) is PAUSED.** Its WIP is in `zips/studio-wip-2026-10-12/`: `git apply tracked.patch`, then copy the files back.

## 5. The game plan, in order
1. **Finish the props:** pack the accepted ids above and commit the gen and hd folders. Wiring them into the lab as clearable clutter (clear one to free floor for a machine, and it yields salvage) is a brief still to write.
2. **The window scene (the owner's current ask, top priority):**
   - Pack the vista pieces.
   - Dispatch TASK-19 to a Haiku sidecar, or build steps 1 and 2 yourself if they need the architect: the vista render pass and the S-space pocket shader are the risky parts.
   - Review the shots against plan §3 (composition) and §9 (budget).
3. **The Studio:** resume TASK-17 from the zip, then TASK-18 (the asset bench and one-click redo; the weapon bench is the test case).
4. **Smaller items:**
   - Turn on `USE_MODULAR_SCOUT` once the aerial is raycast onto the shell and the packed yoke shows.
   - Re-check VEHICLE_FIT for the redone hauler body.
   - Check the watermaker's 7.74 × 6.30 m footprint on its hardpoint.

## 6. Hard rules
- **Git:** shared tree. Commit only your own paths with `git commit -- <paths>`. Never `add -A`, `commit -a`, stash, reset, checkout or restore. Commit manifest edits straight away.
- **Secrets:** never enter credentials, and never print or commit tokens.
- **Admin:** ask before large downloads, firewall changes or publishing; admin commands go to the owner to run.
- **Arena:** never vote; at most 2 tabs.
- **Art and research:** concept art comes only from the art agent; research before you design (CLAUDE.md §3.4).
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 7. Live log (newest last)
- 2026-10-12, about 13:00: TASK-19's first pass was pushed (68f59686, 064a7f9e, bce7282d). It has the wiring, the setting and the tests, at 29 calls and 65k triangles. Shots are in docs/shots/window/. **REVIEW 1 was sent** (on the board):
  - the scale and distances are wrong (boxes crowd the glass);
  - no ground or horizon, and no fog depth;
  - the Breach must be the hero, a third from the left, rising past the top of the glass, glitch-sliced;
  - the pockets must float as full spheres, rendering their S inside;
  - storm clouds, not a starfield;
  - a crate through a pocket;
  - a fallback plane through the gate.
  
  The Haiku sidecar is working on it. If it stopped, re-dispatch TASK-19 with REVIEW 1 from the board.
- The vista models: five are packed (510f2314): hall, chiller (its own budgets, 1.5k low), container, pylon and overpass. rubble-slab was running (job bgd3yzmzw); when it lands, render the angles, then `node scripts/runworld-pack.mjs rubble-slab`, and commit.
- 2026-10-12 afternoon: all six vista models are packed (the rubble slab in 991968e1).
- **The overnight batch is running:** 40 subjects × 2 options (`<id>-a`, `<id>-b`), about 80 models, about 14 h. The ids are listed in `zips/runworld/overnight-ids.txt`, and the log is `zips/runworld/overnight.log` (POSTED, FAILED or NOIMG per id; "OVERNIGHT DONE" at the end).
  - The images were AUTO-approved, unreviewed.
  - **Next session:** render the angles of each pair, keep the better option (or neither), and pack the keepers.
  - **If the batch stopped:** re-run the same loop. It skips ids that already have high.glb (see the shell history in this file's commit message, or re-create it: for each id, images, then touch approved, then local3d model, then runworld-post).
- **The owner's new feature idea (2026-10-12, see OWNER_ASKS):** junked or broken models become "containment leaks". An object looks janky; the player seals the leak and uses a fidelity tool to restore it.
  - **The ladder:** broken junk, then our pack, then a RUN.world tier, then a max tier via the Meshy.ai API (its credits reset at the end of the month).
  - **NEVER delete junked models.** Next: research, then a plan doc, then the owner's sign-off.
- **TASK-19 review 1 is done** (b1a5173a). The view now has depth: a horizon, fog, moving storm clouds, floating pockets and a crate dithering inside a pocket. It runs at 28 calls and 65k triangles. **Still open (review 2, next session):**
  - The Breach doesn't read as a tall column from beside the gate; make it taller, brighter and wider.
  - My ruling on pockets: each one projects its fidelity straight down onto the ground below as a soft disc, so the ground under it changes too.
  - The rubble-slab low doesn't load at runtime (still the box fallback).
  - The dust motes should be about 2× bigger.
  - R8 (the planet side through the gate) needs a shot.
  - Frame time on the GTX 950M is still unmeasured.
- **Overnight failures** (redo next session):
  - generator-small-a; server-crate-a/b (no image or model; they hit the IP change);
  - barrier-block-a/b: the model is there, but the low bake wrote no low-raw.glb. Try `runworld-post.mjs <id>` with `budgets` raised, or `lowInPlace`.
- **Overnight batch FINISHED (2026-10-13): 72 of 80 posted.** Failed: generator-small-a, server-crate-a/b, barrier-block-a/b, gantry-crane-solid-b, warehouse-small-b, sign-gantry-a. Next: review the 72 (four angles per a/b pair, keep the better), pack the keepers, redo the failures.
- The watcher also hit the low-bake failure on office-block-ruin-b (no low-raw.glb), the same error as barrier-block. The low bake step likely crashes on some meshes; check lod-bake.py's stderr for one of them first.
- **Batch 2 running (2026-10-13):** option c for all 40 subjects, plus redos of 6 failures. The log is zips/runworld/overnight2.log, ending in 'BATCH2 DONE'. Review a/b/c as a set.
- **2026-10-13, back on the first session (979660db):** the "FAILED ... low-raw.glb" lines were a race, not a bad bake. The overnight loop and `runworld-watch.mjs` posted the same id at once, and one deleted the other's temporary file. All the listed failures have their low, mid and high, except **server-crate-a** (no image or model yet). `runworld-post.mjs` now takes a per-asset `.posting` lock: a second run waits, then skips (or posts, if the first failed). That session's last compact summary is saved in `docs/sessions/compact-979660db.md`.
- 2026-10-13 13:15: **TASK-19 review 2 posted** on the board (V1 to V7: the Breach as hero, clear pockets that cast their fidelity on the ground, rubble-slab, 2× motes, the R8 shot, shots without overlays, frame time on the real GPU) and **dispatched to a Haiku sidecar**. Batch 2 was still running (28 posted at 13:00).
- **2026-10-13 afternoon, the master plan** (`docs/ONE_GAME_PLAN.md`; the owner: "first plan everything ... then do the plan"):
  - TASK-20 to 24: one game with every system hooked up, the beam tool, the campaign chain, the monsters, test everything. Then main, then the Studio (TASK-17, 18, 25).
  - Landed: `@hm/terrainbrush` (55735c9a).
  - The Arena brief `docs/prompts/battle/leaksim.txt` (the monster brain) is ready, its tests typechecked.
  - The research: `docs/MONSTERS_PLAN.md` and `docs/DLSS5_NEURAL_BAKE_RESEARCH.md`.
  - The owner's calls are open: plan §4.
- **2026-10-13, about 14:30:**
  - **Landed `@hm/leaksim`** (a1b242ea), the monster brain: Arena answer B, 10/10 as landed.
  - **Monster art downloaded** to `zips/monsters/` (the owner: "download whatever you need"): Freedoom, Blasphemer, LibreQuake and 50 Quaternius CC0 monsters, about 93 in all. TASK-23's prerequisites are met.
  - **The owner:** DLSS parked; the faster machine is an RTX 3080.
  - **Batch-2 review (a/b/c per subject):**
    - 19 picks made on the contact sheets, then a four-angle low review: 17 kept.
    - pallet-crates is dropped: a crumpled low, and a heap.
    - terminal-old-a is held: dark bake smudges; re-post it with `fix: ['plain-back']`.
    - The packs keep the option ids (for example `barrier-block-a`).
    - The rest of the subjects wait for batch 2 to finish: drum-square, generator-small, cart-flatbed, cable-reel-square, shelving-closed, specimen-freezer, gas-cabinet, server-crate, portable-office, comms-mast-solid, wrecked-van, container-crushed, datacentre-annex, silo-square, transformer-box, checkpoint-booth, office-block-ruin, battery-pack, workbench-old, crater-rim-chunk, chimney-square.
    - Hold: chimney-square (the owner's no-chimney rule); crater-rim-chunk (no option is good).
  - **Sidecars running:** TASK-19 review 2, and TASK-20 (one game).
- **2026-10-13 afternoon:**
  - TASK-19 is accepted after review 3: the Breach is a glitch-sliced column and the storm reads dark. POL-25 and POL-26 are logged.
  - 17 batch-2 props are packed (cb5d569e).
  - **TASK-23a** (the monster art pipeline, `docs/prompts/sidecar/23a-monster-art.md`) is dispatched beside TASK-20. Both run in Haiku sidecars and never share files.
- **Batch 2, finished (2026-10-13):**
  - 28 props are packed from the overnight sets (cb5d569e and fe265bd7). The registry holds 114 assets.
  - **Held for a re-bake** (dark patches in the low): drum-square-b, generator-small-a, battery-pack-a, cable-reel-square-a, container-crushed-a, terminal-old-a. Try `reach: 3` or `fix: ['plain-back']`, then check lod-bake.py's colour bake for shadowed interiors.
  - **Dropped or held:** cart-flatbed and pallet-crates (crumpled lows); server-crate and transformer-box (no clean low); chimney-square (the owner's rule); crater-rim-chunk.
  - **Not yet placed in the game.** The lab clutter and vista placement brief is still to write. The window vista can use the wasteland ones now.
- **The six held props are re-baked and packed** (bd20dbbd); the registry holds 120. The fix was `reach: 3`. On coarse 300-triangle prop cages, the low surface dips inside the model, so bake rays started inside and caught dark interior faces. **For any future prop whose low shows dark patches, set `reach: 3` first.**
- **2026-10-13 evening:**
  - **TASK-17 (the Studio shell) accepted:** STUDIO.bat, the editor layout, write-back, and the game reads the tweaks.
  - **TASK-21 part 1 accepted:** G draws and holsters the beam; Q or the wheel cycles its modes; the rifle clips are packed.
  - **Running side by side:** TASK-21b (beam: view model, third person, reload, Apply paint) and TASK-18 (Studio asset bench plus the weapon-bench model redo, with a scoped pipeline exception on the board).
  - **Next:** TASK-21c (Sculpt, saving, the campaign beats), then TASK-22, 23b, 23c and 24, then main.
- **2026-10-13 about 19:00, stale processes stopped** (owner: "turn off what you gotta turn off"):
  - the dev servers from 9 and 10 October (ports 5173 and 5192), a leftover Studio server on 5201, the Flash board watcher, the 5 October ui-editor;
  - the overnight asset watcher (`scripts/runworld-watch.mjs`). Restart it with `node scripts/runworld-watch.mjs` for a long unattended batch; the per-asset lock keeps it safe beside a loop.
  - HANDOVER now says sidecars stop their own servers.
- **The weapon-bench set** (owner: "model individual tools ... the bench and the tools cant be one object"):
  - nine assets: weapon-bench (empty, `yaw: 90`), bench-jig, bench-printer, tool-wall, tool-drill, tool-wrench, tool-mallet, tool-scanner, tool-screwdriver;
  - images reviewed; the printer was redone without a cable;
  - models running in `zips/runworld/bench-set.log`;
  - the bench and the jig are reviewed (four angles) and good;
  - pack the set when the rest pass review. TASK-23c places it.
- **Studio:** TASK-18 and 18b work committed as WIP (6f1f4ee9); TASK-18c finishes the last check.
- **2026-10-13 evening, later:**
  - **TASK-21b accepted:** the rifle in hand, first and third person, about 4 to 7 ore a second, R reload, Apply painting.
  - **The Studio (TASK-17/18/18c) is done:** test-studio passes 74 of 74.
  - **Running side by side:** TASK-21c (black character, rifle scale, rifle-clip retarget) and TASK-22 (the campaign chain). Next is TASK-21d (Sculpt, saving, the beats).
  - **The game files hold the new empty weapon bench**, from TASK-18c's stray pack. It is reviewed, but **uncommitted** until the weapon-bench set is packed: commit `apps/web/src/assets/gen/weapon-bench.glb`, `registry.json` and `apps/web/public/hd/weapon-bench/` with the set.
- **2026-10-13, Gemini Argo is creative lead** (owner). His intro is docs/argo/START_HERE.md, the rules docs/argo/RULES.md, an 18-shot tour docs/argo/TOUR.md; his plans come back into docs/argo/plans/. Keep the tour and START_HERE §4–5 current when big things change.
- **The weapon-bench set is packed** (d63ffca5): an empty bench (yaw 90), the jig, the printer, the tool wall and five tools; the registry holds 128. The drill's low is 700 triangles (300 shattered). TASK-23c places the set. Until then the lab's bench stands bare.
- **2026-10-13, late:**
  - **TASK-21c accepted:** the suit reads on the planet, and the rifle clips are properly retargeted (34 KB). POL-28 logged for two-hand IK.
  - **Running:** TASK-22b (finishing the campaign chain; rulings on the board) and TASK-23b-1 (the monster renderers, the window walkers, a preview page).
  - **Queued:** TASK-21d (Sculpt, saving, the beam beats) and TASK-23b-2 (monster wiring), both after 22b; then 23c and 24, then main.
  - Argo's tour is refreshed (shot 14).
- **2026-10-13, about 21:40: Argo's master plan** (owner-approved) is in `docs/argo/plans/ARGO_MASTER_PLAN.md`. Opus's review, with objections O1 to O8 for Argo, is `ARGO_MASTER_PLAN_REVIEW.md`. The agreed items are folded into the briefs for 21d, 23b-2, 23c and 24, and Waves B to D are in ONE_GAME_PLAN §6. Opus's own items: Astro's mid and high levels out of the single file (saves about 2.9 MB), the low-luminance check, a 16 MB gate.
- **2026-10-13, about 23:30:**
  - **Argo accepted all eight objections** (`docs/argo/plans/ARGO_MASTER_PLAN_REPLY.md`; where it differs from the plan, the reply wins). His 14 area plans are committed beside the master plan, whose links are unwrapped.
  - **Argo's chat is open in Opus's built-in browser** (the Gemini tab), so we can talk directly. Asked him for the P0-LORE-01 micro-log texts and Dr. Haddy's line for the Act IV dormant leak; they go to `docs/argo/plans/22-lore-micrologs.md`. His app was waiting on the owner's "Allow" for its remote browser.
  - **The size (0e3a6f2e):** the single file is 14.51 MB, from 17.93: Astro's mid and high levels moved to `public/hd/astro/` (LFS), and a duplicate QuickJS was removed. The build fails above 16 MB; POL-27 is closed.
  - **The luminance gate** (`scripts/surface-luminance.mjs`): low ≥ 0.18 and low/high ≥ 0.85. Post reports it; pack refuses a failure unless `lumOk`.
  - **4f9187a0:**
    - audio and voice resolve beside the page (the root paths broke sub-path hosting and disk);
    - `npm test` and `verify.mjs` run one list (six tests, the quest test among them, had been skipped by the green set; all pass);
    - TASK-23b-1 accepted, with an early-3D facing check carried into 23b-2.
  - **Running:** TASK-22b, resumed after the usage limit cut it off. **Next, one at a time:** 21d, 23b-2, 23c, 24. Then main.
  - **For the owner's test on the RTX 3080:** serve it (`npm run host`, or `npm run dev`). Opened from disk, the file plays without music, voice, HD models or the extra monsters, because browsers block those fetches.
- **2026-10-14, about 02:30:**
  - **TASK-22b accepted** (e469a673): the chain is complete through Act VI, and the double stage-line bug is fixed.
  - **The campaign test exits 0** (6e4b3ed4): 27 of 27, 0 console and 0 HTTP errors. The HD probe now GETs, and the Studio no longer asks its dev routes in the build.
  - **`npm test` is `scripts/test.mjs`:** one list for npm test and verify, with the speed tests alone after the rest. 2546 tests, 0 failures; speed tests 19 of 19.
  - **Running:** TASK-21d (Sculpt, saving, the beam's juice, the rim, the mode rib, a `setSealing` hook for 23b-2). Then 23b-2, 23c, 24, one at a time. Then main.
  - **All of Argo's waves are briefed:** 25 to 27 (a262cfb0) and 28 to 32 (d8754ca8). Brief 32 needs Opus's art pass first (sheets 17, 19, 20).
  - **To send Argo once his chat is free:**
    - his app was waiting on the owner's "Allow" for a remote browser, to read NARRATION_SCRIPT for the micro-log and Act IV lines;
    - (1) POL-23: his "leak" stand-ins are the harvest field nodes; brief 30 gives leaks and nodes one glitch-shard language. Confirm or overrule;
    - (2) POL-04 was closed on 8 October; brief 30 measures stages 4 to 6 before cutting;
    - (3) ask him to skim briefs 25 to 32 for misreadings.
- **2026-10-14, midday:**
  - **Governance changed:** the owner delegates creative and design calls to Opus and Argo (OWNER_ASKS 14 October; CLAUDE.md guard 3, Argo's RULES rule 5). The owner provides resources and unblocking, and reviews objectively. His explicit rules still bind.
  - **Argo's chat is in the built-in browser.** Click Allow on his remote-browser prompts (owner), and send with a JS click on the "Send message" button; see the argo-creative-lead memory.
  - **Accepted:** 21d (050baa24) and 23b-2 (d30a9ced, 714e0815): the early-3D axis fixed, leaksim in play, the id files out.
  - **Their open items** go to TASK-24 (in its brief): the sapper, walls, the beam core, fight readability, GPU fps, base-building's drafting lock, beat 10. TASK-24 also makes act checkpoints for the owner's review.
  - **Argo's docs:** 22-lore-micrologs, 23-brief-review (briefs 25 to 32 signed off) and 24-lore-expansion (Acts VII to IX, Vance through logs, the Earth-window finale). A4-LEAK-SEAL and A6-LEAK-SURGE are voiced (481466d3).
  - **To do after 23c:** switch the game's `showSubtitleOnly('A4-LEAK-SEAL', …)` in play.tsx to the voiced line, and voice the surge toast.
  - **Asked Argo:** the owner's "camera realism" idea (bodycam games hiding asset flaws with exposure and lens effects) → `docs/argo/plans/25-camera-realism.md`, then into brief 27 or a new brief.
  - **The owner's "Singularity" song,** which he says Opus made: not found online. Ask him for the link or file.
  - **Running:** TASK-23c (resumed after the usage limit). Then 24, then main.
- **2026-10-14, afternoon:**
  - **The ending song is final** (fddb8b8b): "Four Floats" v4b at 1.2x tempo, 144 BPM.
    - `public/audio/music-ending.mp3` runs to the switch at 2:40.73, just after her last line, "See you, Sector Four", which ends at 2:40.2.
    - `music-ending-loop.mp3` holds three copies of the 8-bar instrumental chorus; loop the middle one with `levels.json` start..end.
    - `music-ending-overclocked.mp3` is the 1.2x speed variant, for the old-monitor replay.
    - `scripts/music-outro.py` makes the cut and the loop: soft outro lines are found in 100 ms frames, the loop length comes from cross-correlation (the generated track drifts), and the wrap is crossfaded. The owner's feedback on the re-cut preview is pending.
  - **Argo's relay drop** (5d643ead) is in `arena-gathered/argo-relay/`: 90 files, unwired and unreviewed. Read its `TRIAGE.md`. It is the parts list for briefs 25 to 34; each brief lands, reviews and wires its own files.
    - His plans 29b (voice manifest), 31 (TASK-24 review frame) and 32 (drop index) are in `docs/argo/plans/`.
    - Briefs 33 (credits video) and 34 (song radio and machine choir) carry landing notes: the song is 144 BPM, not his 112 BPM or 1:57.
  - **To send Argo once his usage resets (16:13 on 14 October):** the drop is committed and pushed; please resend fixed versions of the files TRIAGE.md lists (the vitest tests as node:test, the strict index reads, the purity flags). Use only `rich-textarea .ql-editor` (see the gemini-input-selector memory).
  - **Running:** TASK-24 (resumed after the usage limit). Then main for the owner's test.
  - **Hyper3D Rodin (the owner's offer, 14 October): not started, on purpose.**
    - The 7-day trial is the Creator plan: "Unlimited Export & Any Use", Smart Low-Poly, multi-image to 3D. There is no API (Business only).
    - It gives about 5 kept models: generating costs 0.5 credits, and a finished model is about 6 credits by the plan's own numbers. It renews at $24 a month unless the owner cancels.
    - The free plan has no "Any Use", so nothing is generated on it.
    - Plan: tell the owner to start the trial when brief 32's art pass begins. The first job is the heavy terraformer from sheet 17 in both Rodin and RUN.world, compared after reduction. If Rodin wins, spend the rest on the hero machines; if not, he cancels.
- **2026-10-14, evening:**
  - **TASK-24 is accepted.** main was fast-forwarded for the owner's test on the RTX 3080 PC; his guide is `docs/TEST_GUIDE.md`.
  - **Argo talks through the Drive folder** (argo-drive-relay memory). His v2 strict pass is in `arena-gathered/argo-relay-v2/`; his guide for briefs 25 to 27 is in `docs/argo/notes/`, with its errors flagged in TRIAGE.
  - **Usage:** about 22% of the week was left at 19:30 on 14 October, with the reset about 2.5 days off. Haiku workers do the bulk; spawn them with `model: haiku`.
  - **Next:** the owner's review report, then Wave B (briefs 25, 26, 27) with Haiku workers, one at a time.
