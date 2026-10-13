# ARGO CREATIVE LEAD MASTER PLAN & OWNER-APPROVED DIRECTIVES FOR CLAUDE OPUS

> **File Destination in Repo:** `docs/argo/plans/ARGO_MASTER_PLAN.md` (Single-File Complete Relay for Claude Opus)
> **Author:** Gemini Argo (Creative Lead)
> **Approved By:** Francois (Owner) — **13 October 2026**
> **Target Branch:** [feat/monster-mash-exploration](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration) (and `main` immediately following `TASK-24`)
> **Status:** **ALL 10 OWNER DECISIONS LOCKED & APPROVED.** This document is an active engineering mandate, not an undecided proposal menu.

## 0. EXECUTIVE HANDOFF TO CLAUDE OPUS: WHAT THE OWNER JUST APPROVED

Francois has reviewed the full Creative Lead audit and all 12 area plans below and **approved all 10 recommendations**. Save or commit this file to `docs/argo/plans/ARGO_MASTER_PLAN.md` (and optionally split out the individual sections into `docs/argo/plans/00-review.md` through `21-production.md` using the headings below).

### The 10 Locked Owner Decisions (13 October 2026)

| Decision ID | Area | Locked Owner Decision (Binding for Opus & Sidecars) |
| :--- | :--- | :--- |
| **DEC-01** | **Fidelity Stage Numbering** ([CARDINAL\_CONSTITUTION\_AND\_STAGES.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/CARDINAL_CONSTITUTION_AND_STAGES.md) vs. [08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png)) | Keep the **5 canonical engine rendering stages (`Stage 0` to `Stage 4`)** in code and HUD, and treat **Water Pooling**, **Coverage Creep**, and **Forest Canopy** as automatic environmental sub-blooms inside Stages 3 and 4 driven by `Aq` and `Lx` (strictly 4 floats `S = (Pxd, Vtx, Lx, Aq)`, zero 5th float). |
| **DEC-02** | **Monster Visual Unification & Era Staging** (`TASK-23b`, [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg)) | Resolve the clash between gory 2D *Freedoom*/*Blasphemer* sprites, *LibreQuake* `.md1`/`.md2` meshes, and *Quaternius* 3D models via: (1) remapping all 38 monsters through the **`S-Space Containment Leak Shader`** (`fidelity-mob.ts`) into our dark obsidian/gunmetal substrate palette (`#181c24`–`#4a5568`) with glowing metric veins (`#ff3d8a` chargers, `#ffc13d` spitters, `#3dc8ff` sappers) + horizontal scanline glitch slices, and (2) staging them chronologically by computing era (**Stage 0–1:** 2D sprites $	o$ **Stage 2–3:** early-3D `.md1`/`.md2` $	o$ **Stage 4:** full 3D rigged models). |
| **DEC-03** | **Suit Coherence Safe Dome & Zero-Loss Recall** (Fixing the Brother's Quit Trigger in [`12-first-hour.md`](#12--the-first-hour--onboarding-plan-zero-dead-end-pacing-from-cold-boot-to-first-color-bloom)) | Within **`25 m` of the Planet Twin Gate** and **`15 m` of any powered Relay Pylon or Shelter**, Suit Coherence (`Sync`) **never drains and recharges at `20%/s`**. Coherence only drains (`90 s` buffer) in unpowered wasteland beyond the grid. If Coherence ever hits `0%`, emergency-recall the player to the Lab Gate threshold with **100% of their inventory intact**. |
| **DEC-04** | **Rock Drill Exhaust Wisp & Lab-First Preset Mixing** ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)) | Keep a **faint, low-altitude grey/unrefined dust-mote wisp** on the `Rock Drill` rear stack when running (visibly distinct from the tall neon `#ff3d8a`/`#7cff4d`/`#ffc13d`/`#3dc8ff` pixel plumes of the fidelity processors). Keep **Preset Mixing inside the Lab (`Preset Combiner`) during Acts I–VI**, unlocking the field `Preset Mixer` (#6) at Stage 3. |
| **DEC-05** | **Water Maker Footprint** ([docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4) | Scale the standard field `Water Maker` (#5 on Sheet 12) to fit a **1x1 foundation cell (`3.6 m × 3.0 m` on a `4 m × 4 m` pad)** matching the `Texture Mill` and `Shape Press`. Reserve the `8 m × 8 m` (2x2 cell) hardpoint socket for the Sheet 17 **Heavy Water Maker (`#30`)**. |
| **DEC-06** | **Stage 0 Twin Gate Amber Coil Pool** ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)) | Keep the Stage 0 Moon pure stark black-and-white (`#050608` / `#e8eef5`), but cast a **`15 m` warm amber (`#ffc13d`) dither light pool** around the Twin Gate's glowing ribbed coils so the portal beachhead immediately reads as a warm safe haven. |
| **DEC-07** | **Stage-Linked Audio Bit-Depth Mirror** ([apps/web/src/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio)) | Apply the stage-linked sample-rate/bit-depth reducer (`Stage 0 = 8 kHz` 4-bit $	o$ `Stage 1 = 11 kHz` 8-bit $	o$ `Stage 2 = 22 kHz` $	o$ `Stage 3–4 = 48 kHz` full stereo) **strictly to `World_SFX_Bus`**, keeping Dr. Haddy (`VO_Bus`) and UI/weapon clicks (`Combat_UI_Bus`) full-bandwidth and crystal clear at all times. |
| **DEC-08** | **Main Menu Dual-Contrast Backdrop** ([01-main-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg), [04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png), `POL-01`) | Render the live 3D Lab on the Main Menu with the **desolate glitching Bridge wasteland outside the left window (`POL-01`)** and the **lush Stage 4 hero vista inside the right freestanding Gate**; when the player starts a New Expedition (Act I), the Lab boots dark and power-starved with the Gate off. |
| **DEC-09** | **Rover Cab Presentation & Camera Shake** ([12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg), Rule 12) | Keep the Rover cab **visually empty with a tinted/amber-lit canopy (remote telemetry link) and the packed square `[-u-]` yoke** until dedicated seated IK is built (preventing Mixamo standing/crouching skeleton clipping). Default camera micro-shake trauma to **Subtle (`35%`)** with a `0–100%` slider in Settings. |
| **DEC-10** | **`dist/index.html` `< 16.0 MB` Cap (`POL-27`), Studio Keymap & Milestone Wave B** | Quantize inline `low.glb` vertex positions to `Int16` and inline baked basecolor maps to `256×256` WebP/JPEG (`quality = 82`) in `scripts/runworld-pack.mjs` to drop `dist/index.html` from `17.9 MB` to **`~13.5–15.0 MB`** (with full `1024²` maps in `public/hd/`). Default Studio gizmo hotkeys to **`W / E / R` (Unreal/Unity)** with a 1-click `[Unreal | Blender]` header toggle. Execute **Milestone Wave B (Sidecar Briefs 25–27)** immediately after `TASK-24`. |

### Sequenced Execution Order for Claude Opus

1. **Finish Active Queue (`Milestone Wave A`):** Complete `TASK-21c/d` (incorporating `P0-LIGHT-01` de-metalling + hemisphere/rim rig and `P0-VEH-02` `1.65x` 3P rifle scale), `TASK-22` (Acts IV–VI quests), `TASK-23b` (incorporating `P0-MON-01` S-Space Leak Shader), `TASK-23c` (incorporating `P0-LORE-01` clutter micro-logs), and `TASK-24` (incorporating `P0-PROD-01` HUD-overlap and avatar-luminance e2e assertions). Triage the 40 overnight model pairs in `zips/runworld/overnight-ids.txt` using the 5-Point Acceptance Gate in Section 21, run `P0-PROD-02` (`low.glb` quantization), and merge `feat/monster-mash-exploration` to `main`.
2. **Dispatch Milestone Wave B (`Sidecar Briefs 25–27`):**
   - **Brief 25 (`docs/prompts/sidecar/25-hud-9zone-and-build-ribbon.md`):** `P0-UI-01`, `P0-UI-02`, `P0-UI-03`, `P0-HOUR-02` (eliminate the 3-way Moon HUD overlap in `07-moon-stage0.jpg`, convert `B` build modal into a `136px` bottom-docked ribbon, cull 3D machine text to raycast aim).
   - **Brief 26 (`docs/prompts/sidecar/26-foundation-frames-and-safe-dome.md`):** `P0-LAYOUT-01`, `P0-HOUR-01`, `P0-LOOP-01`, `P0-LOOP-02` (replace red slab foundations in `10-foundation-placed.jpg` with Sheet 13 gunmetal box-section frames + raycasted support legs, wire the 25 m Twin Gate Coherence Safe Dome + zero-loss recall, enforce `100 kW` Gate baseline with proportional brownout).
   - **Brief 27 (`docs/prompts/sidecar/27-stage0-dither-and-rover-cam.md`):** `P0-LIGHT-02`, `P0-VEH-01`, `P0-VEH-03` (*Obra Dinn* world-locked cylindrical Stage 0 dither + 1 px depth contours + 15 m amber Gate pool, sphere-cast Rover spring arm with heightfield floor clamp fixing `12-rover-driving.jpg`, flip `USE_MODULAR_SCOUT = true`).
3. **Dispatch Milestone Wave C (`Sidecar Briefs 28–30`):**
   - **Brief 28 (`docs/prompts/sidecar/28-lab-choreography-and-vista.md`):** `P0-LIGHT-03`, `P1-HOUR-03`, `P0-LAYOUT-02`, `P0-LAYOUT-03`, `P1-UI-04` (Act I dark strobe wake + sequential strip-light power-on, 3.5 s bottom-up Gate coil ignition, full Power Wall + cable ramps, Window Vista Review 1 completion, live Lab Main Menu `POL-01`).
   - **Brief 29 (`docs/prompts/sidecar/29-audio-5bus-and-juice.md`):** `P0-SOUND-01`, `P0-SOUND-02`, `P1-SOUND-03`, `P0-VFX-01`, `P0-VFX-02`, `P1-VFX-03` (5-bus Web Audio mixer with VO sidechain ducking, 12 procedural action SFX, `World_SFX_Bus` stage bit-crush mirror, Beam brush ring decal + spiral chunk stream, bottom-up `#7cff4d` wireframe print sweep, separated hopper/exhaust sockets).
   - **Brief 30 (`docs/prompts/sidecar/30-monster-leak-shader-and-rifts.md`):** `P0-MON-01`, `P0-MON-02`, `P0-MON-03`, `P1-MON-04`, `P1-MON-05`, `P1-LIGHT-04`, `P1-LIGHT-05` (S-Space Leak Shader unification, vertical glitch-sliced rift shards `POL-23`, era escalation across stages, radial volumetric stage scan-wave, Stage 4 Low 60 FPS lock `POL-04`).
4. **Dispatch Milestone Wave D (`Sidecar Briefs 31–32`):**
   - **Brief 31 (`docs/prompts/sidecar/31-studio-bench-and-sockets.md`):** `P0-STUDIO-01`, `P0-STUDIO-02`, `P1-STUDIO-03`, `P1-STUDIO-04`, `P1-STUDIO-05` (4-angle review grid + `fix` checkboxes in Asset Bench, Stage 0–4 lighting scrubber, interactive socket/plume gizmo, 2-tier preset/node material editor, Lab Act V schema inspector).
   - **Brief 32 (`docs/prompts/sidecar/32-heavy-terraformers-and-turrets.md`):** `P1-LOOP-04`, `P1-VEH-04`, `P1-VEH-05` (Sheet 17 heavy terraformers on 8 m hardpoints `POL-24`, Sheet 19 Vehicle Fabricator gantry + rear cargo sockets, Sheet 20 handheld sidearm + `15 kW` automated perimeter defense turret).



# 00 — Candid Creative & Technical Audit of FIDELITY: The SetMix Multiverse

## Executive Verdict: A Frontier Engine Core Trapped Behind Prototype Staging

Claude Opus and the Haiku sidecars have built a genuinely remarkable deterministic simulation core on [feat/monster-mash-exploration](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration). The pure four-float architecture (`S = (Pxd, Vtx, Lx, Aq)` in [packages/fidelity/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/fidelity)), the pure-function monster brain in [packages/leaksim/src/index.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts), the WAD/MD2/MD1 asset parsers in [packages/shareware/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/shareware), the 114 generated 3D models in [apps/web/src/assets/gen/registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json), and the write-back Studio editor in [apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio) are real engineering achievements that pass strict verification gates.

However, judged through a player's eyes via [docs/argo/TOUR.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md) and the 18 tour screenshots in [docs/argo/tour/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/docs/argo/tour), the game currently plays and reads like an internal engineering testbed rather than a cohesive AAA survival-terraforming game. In several areas, the "Flash job" scaffolding warned against in [CLAUDE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CLAUDE.md) is still the visible surface of the game: the HUD overlaps itself in three places on Moon arrival, base foundations look like bright red hockey pucks with blue rings, the player character renders near-black on the lunar surface, the Lab power-up sequence lacks theatrical lighting contrast, and every player interaction (mining, placing, printing, shooting) lacks physical and audio-visual impact.

## Area-by-Area Audit Against Concept Art and Code

| Area | Current State in Code & Tour Shots | What Works Well | What Is Weak, Flat, or Missing |
| :--- | :--- | :--- | :--- |
| **Main Menu & Shell** | [apps/web/src/shell/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/shell), [01-main-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg) | Telemetry column uses the Oxanium/Inter token palette from [docs/UI\_DESIGN\_SYSTEM\_AND\_TOKENS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/UI_DESIGN_SYSTEM_AND_TOKENS.md); profile switcher works cleanly. | Reads as a vertical list of text buttons over a dark void (`Expedition`, `Planetary Grid`, `The Studio`, `The Workshop`, `Community Nexus`, `Settings`). Missing the live 3D Lab + glitching desolate window vista required by [docs/DEFERRED\_POLISH\_REGISTRY.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/DEFERRED_POLISH_REGISTRY.md) (`POL-01`) and [04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png). Copy like `"Growing the trees"` feels placeholder. |
| **The Lab & Act I Wake** | [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts), [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts), [02-lab-act1-wake.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/02-lab-act1-wake.jpg), [03-lab-power-wall.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/03-lab-power-wall.jpg), [04-lab-power-on.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg) | Freestanding gate architecture matches [06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png) (chunky box-section uprights, ribbed amber coils, hazard plinth, floor cable ramps). 10 lab clutter props are packed in [registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json). | Power wall in [03-lab-power-wall.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/03-lab-power-wall.jpg) looks like flat grey office lockers; throwing the breaker in [04-lab-power-on.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg) barely changes the room's exposure or mood compared to [01-lab-first-play.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/01-lab-first-play.png) and [02-gate-power-on.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png). Concept sheet [21-sheet-the-lab.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/21-sheet-the-lab.png) and the 10 packed clutter props (`crate-large`, `server-rack`, `coolant-can`, etc.) are not yet staged with believable lighting and cable runs. |
| **3D Window Vista** | [apps/web/src/lab/lab-vista.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-vista.ts), [docs/WINDOW\_SCENE\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/WINDOW_SCENE_PLAN.md), [05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg) | Runs in 1.5 ms on the GTX 950M budget; 6 vista models (`datacentre-hall`, `chiller-block`, `shipping-container`, `pylon-tower`, `overpass-segment`, `rubble-slab`) are packed and placed. | As Opus noted in Review 1 on [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md), scale and atmospheric depth still need work: foreground silhouettes crowd the glass, the cyan Breach column needs stronger vertical dominance and glitch-sliced displacement, and static bursts do not yet cast light onto the lab floor (`POL-25`). |
| **The Gate & Stage 0 Moon** | [06-gate-open.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg), [07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg) | Seamless portal transition without loading screens works; 1-bit Bayer dither immediately signals another reality. | Opening the gate in [06-gate-open.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg) is a state toggle rather than a sequence (ribbed coils should ignite bottom-to-top with capacitor hum and arc flash per [06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)). On the Moon ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)), the screen-space 1-bit dither swims on camera rotation and flattens depth gradients at the horizon. |
| **HUD & UI Layout** | [apps/web/src/shell/hud.tsx](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx), [07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg), [09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg), [11-inventory.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/11-inventory.jpg) | Clean glassmorphic tokens and typography when viewed in isolation. | **Critical P0 collision in [07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg):** the giant zone banner, the `"CANNOT PLACE"` build readout, and Dr. Haddy's radio subtitle stack right on top of each other in center-screen. The build modal (`B` in [09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg)) covers 70% of the 3D viewport while the player is trying to preview a foundation ghost. |
| **Base Building & Machines** | [apps/web/src/base/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/base), [08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg), [10-foundation-placed.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/10-foundation-placed.jpg) | Pure logic packages (`@hm/structure`, `@hm/lattice`, `@hm/substrate`, `@hm/plotsim`) are rock-solid. Pink pixel plume in [08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg) reads clearly against the dark sky. | **Foundations in [10-foundation-placed.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/10-foundation-placed.jpg) are flat red slabs with glowing blue target rings**—the single biggest visual immersion breaker on the planet, completely divorced from [13-sheet-base-construction.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/13-sheet-base-construction.png) and [14-outpost-stage-3.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/14-outpost-stage-3.png). Floating text labels over machines in [08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg) clutter the silhouette. |
| **Beam Tool & Avatar** | [apps/web/src/play/beam-tool.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts), [apps/web/src/avatar/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/avatar), [13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg), [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg) | Rifle silhouette and 4 modes (`Extract`, `Apply`, `Sculpt`, `Seal`) unify survival mining and creative terrain editing. | In [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg), the Scientist hazmat avatar renders near-black because PBR metallic/roughness materials lack a hemisphere/probe fill on the unlit Stage 0/1 Moon, and the rifle scale is ~60% too small in third-person hands. First-person viewmodel in [13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg) is similarly under-lit and lacks diegetic mode-color coils. |
| **Vehicles & Camera** | [packages/kart/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/kart), [12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg) | Pacejka tire drift math and low-gravity suspension physics are fun and deterministic. | In [12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg), the third-person spring arm clips directly into terrain slopes and boulders, and the modular scout's packed `[-u-]` square yoke and raycast aerial (noted in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4) still need final switch-on. |
| **Monsters & Combat** | [packages/leaksim/src/index.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts), [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg), [18-monsters-batch3.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) | `@hm/leaksim` has 6 distinct archetypes (`charger`, `spitter`, `swarmer`, `flyer`, `brute`, `sapper`), telegraphed windups, and non-destructive building rules (Rule 23). | Not yet wired into the live planet loop (`TASK-23b`). Visually, placing gory 2D *Freedoom*/*Blasphemer* sprites next to smooth pastel *Quaternius* 3D meshes ([17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg)) creates a jarring art-style collision unless unified by an S-space containment-leak shader. |
| **The Studio** | [apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio), [15-studio-editor.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/15-studio-editor.jpg), [16-studio-asset-levels.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg) | Outliner, gizmo viewport, schema inspector, Changes diff panel, and Low/Mid/High asset comparison bench ([16-studio-asset-levels.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)) are functional and fast. | Still feels like an external developer debugger rather than the owner's promised "gold standard creative suite" where presets, textures, sockets, and monster splices can be previewed under live Stage 0–4 lighting with one-click A/B comparisons. |

## Cross-Cutting Diagnosis: Why the Game Feels Like a Prototype Despite Great Tech

1. **Missing State-Transition Choreography:** In [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [apps/web/src/crafter/world.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts), major narrative milestones (pulling the emergency breaker, igniting the Gate, crossing Stage 0 to Stage 1, triggering the first green grass bloom) happen as instantaneous or linear parameter flips. AAA games treat every threshold as a 3-to-6-second multi-sensory sequence combining sequential light activation, camera micro-shake, sub-bass sweep, and radial shader waves.
2. **Ununified Lighting Across Stages:** Because Stage 0 and Stage 1 strip sky light (`Lx`), 3D meshes with standard PBR materials (`metalness > 0`, dark base albedo) collapse into black silhouettes ([13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg), [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)). Every stage needs a guaranteed minimum rim/hemisphere floor and stage-authentic shading rule so characters, tools, and monsters remain readable against 1-bit and EGA terrain.
3. **HUD Layering Without a Spatial Z-Budget:** UI components in [apps/web/src/shell/hud.tsx](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx) render independently without a shared notification queue or screen-zone reservation map, causing center-screen text pileups ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)) and viewport-blocking modals ([09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg)).
4. **Placeholder Geometry in Core Player Loops:** Players spend 80% of their time looking at their tool, their foundations, their machines, and the ground directly in front of them. Replacing the red-slab foundations ([10-foundation-placed.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/10-foundation-placed.jpg)), lighting the beam rifle ([13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg)), and grounding machines with cable covers and hoppers ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)) will immediately transform perceived quality.

## Priority Execution Order for Opus and Sidecars

| Priority Tier | Target Plan File | Immediate Focus Before Merging `feat/monster-mash-exploration` to `main` |
| :--- | :--- | :--- |
| **Wave 0 (Finish Active Queue)** | [12-first-hour.md](12-first-hour.md), [18-monsters-combat.md](18-monsters-combat.md), [19-vehicles-weapons.md](19-vehicles-weapons.md) | Complete `TASK-21c/d` (avatar rim lighting, rifle scale/IK, Sculpt, save), `TASK-22` (Acts IV–VI quest chain), `TASK-23b` (monsters in world with S-space shader), `TASK-23c` (lab clutter & wreck props), and `TASK-24` (full e2e regression). |
| **Wave 1 (P0 Visual & UX Blockers)** | [16-ui-ux.md](16-ui-ux.md), [13-layouts-and-lab.md](13-layouts-and-lab.md), [14-lighting.md](14-lighting.md) | Eliminate the 3-way HUD text overlap on Moon arrival; convert the Build Menu to a non-blocking bottom/left drawer; replace flat red foundation slabs with Sheet 13 industrial frames; add world-space cylindrical dither stabilization to Stage 0. |
| **Wave 2 (P1 AAA Feel & Choreography)** | [17-vfx-juice.md](17-vfx-juice.md), [15-sound.md](15-sound.md), [10-lore.md](10-lore.md), [11-core-loop.md](11-core-loop.md) | Choreograph the Lab breaker and Gate ignition sequences; add tactile beam/mining/building juice and stage-linked audio bit-depth progression; stage environmental storytelling logs across Lab clutter and lunar wreck sites. |
| **Wave 3 (Studio & Production Scale)** | [20-studio.md](20-studio.md), [21-production.md](21-production.md) | Add live Stage 0–4 split-screen preview and socket snapping to the Studio asset bench; enforce the 18 MB single-file budget (`POL-27`) via procedural audio synthesis and lazy HD pack streaming. |


# 01 — Master Creative Direction: Standing Inside a Living Progress Bar

## Core Creative Pillars and Player Fantasy

**The Player Fantasy:** You are the last systems engineer inside a collapsing reality engine—stepping out of a tactile, heavy-industrial quantum bunker onto a raw, 1-bit monochrome moon, and physically rebuilding the rendering pipeline of the universe until a lush, living PBR biosphere blooms around your boots.

Every design, art, audio, and code decision in **FIDELITY: The SetMix Multiverse** serves four creative pillars grounded in [docs/argo/RULES.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/RULES.md) and [docs/OWNER\_ASKS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/OWNER_ASKS.md):

1. **Resolution Is Physical Terraforming (Rules 1, 4, 9):** In [The Planet Crafter](https://store.steampowered.com/app/1284190/The_Planet_Crafter/), machines raise invisible numbers (`O2`, `Heat`, `Pressure`) until the sky turns blue. In **FIDELITY**, your machines upgrade the **actual graphics pipeline of the world** through four strict floats: `S = (Pxd, Vtx, Lx, Aq)`. Crucially, per Rule 9, **it is always one natural, believable world**—never an abstract cyberspace grid. Stage 0 is not a "computer level"; it is a real lunar desert seen through a starved 1-bit rendering budget.
2. **Heavy Tactile Cassette-Industrial Engineering (Rules 10, 11, 12, 15, 16):** Our machines are grounded, bolted, cabled, and logical. Nothing floats. Enclosures use heavy square/rectangular steel tubing, ribbed transformer coils, hazard-striped plinths, and steel floor cable covers ([06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png), [07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png)). Dark inert material goes **in** at the feed hopper; luminous square pixels pour **out** of a separate exhaust vent ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)).
3. **Cozy-Urgent Competence, Zero Griefing (Rule 23):** The world outside is unstable and haunted by leaked shareware anomalies, accompanied by Dr. Gwen Haddy's dry, grounded radio mentorship ([docs/NARRATION\_SCRIPT.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md)). Yet the player's creations are sacred: monsters never destroy built structures, every combat drop has a peaceful synthesis path, and a player can never soft-lock on ore or sync.
4. **The Game Is Its Own Studio (Rule 24, `STUDIO_PLAN.md`):** The player does not just consume content; Act V pulls back the curtain ("It's not really dirt") and hands the player the actual in-engine Studio tools ([apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio)) to inspect schemas, fuse cartridges, splice monsters, and submit branches to community consensus.

## Art Direction: The Fidelity Ladder as the Visual Hook

To resolve the historical tension between `CLAUDE.md` (Stages 0–4) and Concept Sheet 08 ([08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png), Stages 1–6), all plans unify around the canonical **5 Engine Rendering Stages (`S0`–`S4`)** while treating **Coverage (`S4.5`) and Forest Canopy (`S5/S6`)** as natural hydrological/biological sub-blooms driven by `Aq` and `Lx` within the `S = (Pxd, Vtx, Lx, Aq)` constitution (zero 5th float, honoring Rule 1).

| Stage | Threshold & Float Driver | Visual Look & Shader Behavior | Model & Geometry Fidelity | Sky, Water & Coverage Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 0: Cold Boot (1-Bit Dither)** | Starting Moon (`Pxd < 0.15`, `Vtx < 0.15`, `Lx < 0.10`, `Aq = 0`) | High-contrast monochrome/amber-tinted 1-bit ordered Bayer dither inspired by [Return of the Obra Dinn](https://dukope.com/devlogs/obra-dinn/tig-32/), projected in cylindrical world-space so dots lock to surfaces instead of swimming on camera turn. | `low.glb` cages (~500–1,500 tris), hard face normals, silhouette edge outlining at 1 px so horizons and boulders read clearly ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)). | Pitch-black vacuum sky with crisp 1-bit stars and the alien ochre/green Goblin planet overhead; dry faceted crater basins. |
| **Stage 1: Early Allocation (16-Color EGA)** | First Shape Press & Texture Mill (`Pxd >= 0.20`, `Vtx >= 0.20`) | Quantized 16-color natural mineral palette (ochre dust, slate basalt, rust iron, moss green) with 4x4 ordered dither transitions across material seams (`POL-05` 47-tile blob transitions). | `low.glb` cages with bevelled silhouette sockets snapped on; terrain grid steps subdivide into faceted low-poly hills ([08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png) Panel 1). | Black sky gains a thin indigo/amber scattering band along the horizon; machines emit crisp color-coded square pixel plumes. |
| **Stage 2: Palette Bloom (256-Color VGA)** | Cartridge Synthesis & Light Amplifier (`Pxd >= 0.45`, `Lx >= 0.35`) | Rich 256-color indexed textures with subtle affine/integer UV snap inspired by [Signalis](https://store.steampowered.com/app/1262350/Signalis/) and [Prodeus](https://store.steampowered.com/app/964800/Prodeus/); first directional sunlight and hard sun-glint highlights. | Swap to `mid.glb` models; Twin Gate rebuilds to full industrial detail (`POL-17`); boulders and cliffs show stratified mineral veins. | Atmospheric haze softens the 4.2 km horizon; first green grass patches bloom where Texture Mills spew `#ff3d8a` / `#7cff4d` plumes. |
| **Stage 3: Lit Gouraud & Hydrology** | Water Maker & Power Grid (`Vtx >= 0.65`, `Lx >= 0.65`, `Aq >= 0.40`) | Smooth vertex-interpolated Gouraud lighting transitions into normal-mapped relief; soft cascaded shadows and atmospheric scattering ([14-outpost-stage-3.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/14-outpost-stage-3.png)). | `mid.glb` to `high.glb` smooth dual-contoured terrain (`@hm/smoothvox2`) with zero terrace stepping; water runnels carve into basins. | Turquoise water pools in low craters (`@hm/hydro`); coverage tendrils creep outward from water edges and machine shadows ([09-sheet-coverage-growth.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/09-sheet-coverage-growth.png)). |
| **Stage 4: Full PBR Biosphere (Sheet 08 S5–S6)** | Full Array (`Pxd >= 0.85`, `Vtx >= 0.85`, `Lx >= 0.85`, `Aq >= 0.75`) | Full metallic/roughness PBR shading, normal-mapped moss/grass/soil relief, wet-shoreline roughness gradients, golden-hour god rays, and Gerstner wave caustics ([10-plot-stage-6-hero.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/10-plot-stage-6-hero.png)). | Full `high.glb` cages with weathered moss/patina overlays on machines ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) bottom row) and multi-LOD L-system forests (`@hm/treegen`). | Deep azure sky with volumetric clouds, swimmable lakes, full turf/clover/fern coverage, and grazing fauna (`@hm/fauna`). |

## Unified Chromatic Language (Strict Hex Tokens)

Every machine exhaust plume, cartridge slot indicator, beam mode coil, and HUD telemetry widget must strictly obey the canonical five-color code from [07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png):

| Metric / System | Canonical Hex | Visual & Material Role |
| :--- | :--- | :--- |
| **Pixel Density (`Pxd`)** | `#ff3d8a` (Chromatic Pink) | Texture Mill exhaust plumes, Preset Bench writing lasers, Apply-mode beam coils, texture cartridge LEDs. |
| **Vertex Density (`Vtx`)** | `#7cff4d` (Topology Green) | Shape Press exhaust vents, Hardware Fabricator print bed, Sculpt-mode beam coils, geometry cartridge LEDs. |
| **Light Flux (`Lx`)** | `#ffc13d` (Lumen Amber) | Light Projector housing vents, Gate ribbed field coils, Planet Table hologram, Seal/Power telemetry accents. |
| **Aquatic Level (`Aq`)** | `#3dc8ff` (Hydro Cyan) | Water Maker top-rear condenser vents, moisture coverage overlays, Breach static accents, coolant canisters. |
| **Preset Mixing / Fusion** | `#b46bff` (Synthesis Violet) | Preset Combiner plasma globe, Cartridge Archive rack scanner, multi-metric fused cartridges and bio-spliced cores. |

## Audio Direction: The Bit-Depth Mirror

Sound in **FIDELITY** is not background wallpaper; it is the **auditory twin of the Fidelity Ladder**. Using pure Web Audio API synthesis in [packages/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/audio) and [packages/soundpack/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack):
- **The Lab** sounds warm, grounded, and claustrophobic: 50 Hz transformer hum, fluorescent ballast buzz, heavy clunking steel relays, and Dr. Haddy's band-passed radio voice (`300 Hz–3.2 kHz` with subtle push-to-talk squelch clicks).
- **The Planet** upgrades its acoustic fidelity alongside `S`: Stage 0 crushes environmental SFX through an 8-bit sample-rate reducer (`8 kHz` mono, dry and airless); Stage 1–2 expands to 16-bit FM/PCM crunch; Stage 3 introduces stereo reverb tails and running water; Stage 4 blooms into full-spectrum stereo ambience (wind through conifer needles, lapping water, distant fauna calls, and polyphonic generative synth pads).

## Reference Games Matrix and Why Each One Guides Us

| Reference Game | Target Area in FIDELITY | Specific Mechanism We Adopt | What Players Praise / Complain About (Research Grounding) |
| :--- | :--- | :--- | :--- |
| [The Planet Crafter](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | Core Loop, Stage Transitions, Diegetic Monitors ([11-core-loop.md](11-core-loop.md)) | Visible world transformation tied directly to player-built emitters; legible indoor wall monitors showing global metrics. | Players love watching barren dust turn into blue sky, lakes, and forests ([Steam Discussions](https://steamcommunity.com/app/1284190/discussions/0/632293266018010121/)), but complain when early oxygen tethers punish exploration or when stage transitions pop abruptly. |
| [Return of the Obra Dinn](https://dukope.com/devlogs/obra-dinn/tig-32/) | Stage 0 & Stage 1 Shaders ([14-lighting.md](14-lighting.md)) | World-locked / sphere-projected 1-bit Bayer dithering and luminance-preserving edge recovery. | Lucas Pope's devlog on [stabilizing 1-bit dithering](https://dukope.com/devlogs/obra-dinn/tig-32/) solved the exact nausea/swimming problem seen when screen-space dither matrices stay fixed while the camera rotates. |
| [Portal 2](https://developer.valvesoftware.com/wiki/Clean_%28Portal_2%29) & [Control](https://www.gamedeveloper.com/art/the-real-buildings-that-inspired-i-control-i-s-oldest-house) | The Lab, Power Wall & Window Vista ([13-layouts-and-lab.md](13-layouts-and-lab.md)) | Stark industrial paneling contrasted against catastrophic outside vistas; sequential indicator strip lights (`Indicator Lights`) that trace power flow from breaker to device. | Valve's [Portal 2 lighting guides](https://developer.valvesoftware.com/wiki/Glass_Light_%28Portal_2%29) and Remedy's [brutalist Oldest House architecture](https://www.gamedeveloper.com/art/the-real-buildings-that-inspired-i-control-i-s-oldest-house) prove that industrial rooms feel AAA through contrast, cable lines, and spotlight pools—never flat ambient fill. |
| [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) & [Enshrouded](https://www.reddit.com/r/Enshrouded/comments/1h6l9ze/while_i_really_like_valheim_building_one_thing_i/) | Base Building, Snapping & Linked Storage ([11-core-loop.md](11-core-loop.md), [16-ui-ux.md](16-ui-ux.md)) | Holographic build ghosts with `H` Lock/Nudge, straight cable-cover runs, and linked plot bins (`@hm/lattice` acting like *Satisfactory 1.0*'s [Dimensional Depot](https://www.youtube.com/watch?v=oPsb7OFp1gg)). | Builders universally praise building straight from linked storage without inventory-shuttle tedium, and praise foundations that blend into uneven terrain rather than floating on ugly slabs. |
| [Prodeus](https://store.steampowered.com/app/964800/Prodeus/) & [Deep Rock Galactic](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) | Monsters, Combat & Terrain Readability ([18-monsters-combat.md](18-monsters-combat.md)) | Dynamic shader unification of 2D sprites and 3D meshes under modern point-light/particle pipelines; clear audio-visual wave telegraphing. | [Prodeus discussions](https://steamcommunity.com/app/964800/discussions/0/3371531264818900018/) highlight how normal-lit pixel/sprite shaders make retro monsters feel grounded in 3D space; [Deep Rock Galactic](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) proves swarm defense works best when every enemy silhouette and attack cue is unmistakable in low light. |
| [Dead Space](https://deadspace.fandom.com/wiki/Resource_Integration_Gear) & [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | HUD, First Hour & Tool Juice ([12-first-hour.md](12-first-hour.md), [16-ui-ux.md](16-ui-ux.md), [17-vfx-juice.md](17-vfx-juice.md)) | Diegetic suit/weapon telemetry (`RIG`-style spine/rifle gauges) and juicy beam-fabrication scanlines. | [Dead Space's diegetic UI](https://medium.com/@lorenzoardeni/dead-space-the-ui-art-that-disappears-in-the-game-world-289718133c29) keeps the player's eyes on the world rather than overlapping 2D text boxes; [Subnautica's Habitat Builder](https://store.steampowered.com/app/264710/Subnautica/) makes every constructed piece feel earned. |

## Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Unifying the 5-Stage (`S0`–`S4`) Code Ladder with the 6-Panel (`S1`–`S6`) Concept Art:**
   - *Context:* [CLAUDE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CLAUDE.md) and [CARDINAL\_CONSTITUTION\_AND\_STAGES.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/CARDINAL_CONSTITUTION_AND_STAGES.md) define 5 stages (`Stage 0` 1-bit $	o$ `Stage 4` Full PBR), while [08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png) shows 6 visual milestones (adding Water at panel 4, Coverage at panel 5, and Lush Forest at panel 6).
   - *Recommendation:* Keep the 5 canonical rendering stages (`Stage 0` to `Stage 4`) in code and UI, and treat **Water Pooling**, **Coverage Creep**, and **Forest Canopy** as automatic environmental sub-phases inside Stages 3 and 4 driven by `Aq` and `Lx`. Shall we lock this terminology across all HUD readouts and quests?
2. **Tonal Resolution of Monster Assets (`TASK-23b`):**
   - *Context:* [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg) and [18-monsters-batch3.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) mix gritty 2D *Freedoom*/*Blasphemer* sprites with stylized low-poly *Quaternius* 3D models.
   - *Recommendation:* Render all leaked monsters through an **S-Space Anomaly Shader** (scanline horizontal slicing, local stage palette quantization, and `#3dc8ff` / `#ff3d8a` containment edge-glow) so they explicitly look like *corrupted simulation leaks from different computing eras* rather than mismatched native fauna. Do you approve this visual framing?


# 10 — Lore, Narrative & Environmental Storytelling Plan: Making the Collapse Physical

## 1. The Goal: A World That Tells Its Story Without Pausing Gameplay

In AAA narrative-survival games, lore is never trapped inside a wall of text in a design doc—it is discovered through the physical environment, machine interfaces, and reactive voiceover. Our goal is to translate the rich premise in [docs/NARRATIVE\_AND\_LORE\_BIBLE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATIVE_AND_LORE_BIBLE.md) and [docs/NARRATION\_SCRIPT.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) (*"A simulation cannot sustain simulations running inside of it"*) into tangible environmental beats across the Earth Lab, the Window Vista, the Moon plot, and the Studio terminal.

## 2. Where It Stands Today

- **What Exists:**
  - [docs/NARRATIVE\_AND\_LORE\_BIBLE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATIVE_AND_LORE_BIBLE.md) and [docs/NARRATION\_SCRIPT.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) establish the Bridge Array catastrophe, Dr. Gwen Haddy's character voice, and Acts I–VI dialogue lines.
  - Voiced audio files (`public/vo/`) and radio filter chains exist in [apps/web/src/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio).
  - [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) and [apps/web/src/assets/gen/registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) include 10 lab clutter props (`filing-cabinet`, `server-rack`, `old-monitor`, `sample-case`, etc.) and 28 lunar wreck/vista props (`TASK-23c`).
- **What Is Weak or Missing:**
  - As noted in [docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, the lore is **strong in the bible and thin in the game**.
  -Salvaging lab clutter in [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) yields raw materials when holding `E`, but carries zero narrative payoff—no terminal logs, no sticky notes, no audio fragments explaining *what* the Bridge experiment was doing minutes before the collapse.
  - The lunar wreck sites (`TASK-23c`) and leaked shareware monsters (`TASK-23b`) appear mechanically without in-world forensic traces linking them to the Bridge Array's compute exhaustion.
  - Act V's philosophical turning point (*"It's not really dirt, you get that right?"* in [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)) needs diegetic reinforcement inside the Studio UI so editing a schema variable feels like hacking the simulation substrate.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Narrative Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | **Non-Blocking Audio Logs at Salvage Wrecks:** Scanning or salvaging a wreck triggers a 12–20 second voiced/radio databank entry that plays *while* the player continues moving and mining ([Steam Community Guide](https://steamcommunity.com/app/264710/discussions/0/506208224013267336/)). | Players hate lore that freezes movement in a modal text reader; short radio/log bursts during salvage double the reward of clearing clutter. |
| [Outer Wilds](https://store.steampowered.com/app/753640/Outer_Wilds/) | **Rumor-Mode Node Graph & Forensic Props:** Every discovered log updates a visual connection board ([Ship Log Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3500382207)), and every ruin has a physical purpose (pointing toward the next signal or anomaly). | Players praise *Outer Wilds* because text logs are always anchored to a physical prop you can see from a distance and never exceed 3–4 punchy lines per node. |
| [Control](https://www.gamedeveloper.com/art/the-real-buildings-that-inspired-i-control-i-s-oldest-house) & [Abiotic Factor](https://store.steampowered.com/app/427410/Abiotic_Factor/) | **Bureaucratic Workplace Realism Amid Cosmic Collapse:** Dry technical containment memos and mundane lab equipment juxtaposed with reality-breaking anomalies ([Oldest House Analysis](https://www.reddit.com/r/controlgame/comments/1vshfnv/the_oldest_house_cold_bureaucratic_and_deeply/)). | Grounded workplace details (maintenance tags on breakers, incident tickers on old monitors, coffee-stained test logs) make the sci-fi catastrophe believable. |
| [Portal 2](https://developer.valvesoftware.com/wiki/Clean_%28Portal_2%29) | **Reactive Mentor Commentary:** The guide reacts to specific player micro-actions (firing an empty tool, staring out the window, standing near a hazard) with dry wit. | Turns tutorial guardrails into memorable character moments—just like the owner's `"Not that button"` and `"It's not really dirt"` beats in [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md). |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-LORE-01: Wire Micro-Lore Inspections to the 10 Lab Clutter Props & Lunar Wreck Sites (`TASK-23c` Integration)**
   - **What to build:** Extend the clutter salvage table in [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) and lunar wreck props in [apps/web/src/assets/gen-props.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen-props.ts) so that 8 key props (`old-monitor`, `server-rack`, `filing-cabinet`, `sample-case`, plus 4 lunar wreck transponders) display a 2-sentence forensic readout on hover and unlock a compact `"Bridge Incident Log"` entry in the HUD databank when salvaged with `E`.
   - **Content examples:**
     - `old-monitor`: *"BRIDGE TELEMETRY [T-00:04:12]: Recursive sub-sim allocation hit 99.4% of host substrate. Exterior terrain meshes dropping to 1-bit fallback."*
     - `sample-case`: *"CONTAINMENT LOG #09: Archive shareware sectors (1993–1997) breached quarantine. Sprite and MD2 entities materializing along low-Pxd fault lines."*
   - **Needs:** **Code** (`apps/web/src/play/lab-room.ts`, `packages/content/`), **Audio** (short CRT data-chirp SFX on log unlock).

2. **P0-LORE-02: Stage the Act I–II Window & Gate Reveal Beats Around Physical Sightlines**
   - **What to build:** In [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [apps/web/src/play/quest.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts), gate Dr. Haddy's Act II window line (*"That's you if you didn't turn the power on just now"*) on a camera frustum/proximity trigger within 3.5 m of the observation window looking at the Breach column ([05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), rather than firing on a blind timer while the player is still facing the power wall.
   - **Needs:** **Code** (`apps/web/src/play/quest.ts`, `apps/web/src/lab/lab-scene.ts`).

### P1 — Makes It Feel AAA

3. **P1-LORE-03: Diegetic "Substrate Memory" Framing for Monster Leaks & Cartridges**
   - **What to build:** When a reality leak spawns on the Moon (`packages/leaksim/src/index.ts`), display a brief diegetic telemetry tag over the rift before monsters emerge (e.g., `LEAK DETECTED: SECTOR_WAD_1994 // UNCOMPILED IMP ARCHETYPE`). When sealed with the Beam Tool (`Seal` mode), Dr. Haddy or the suit HUD logs which vintage computing block was reclaimed into the local `S` budget.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/leaksim/`), **UI** (`apps/web/src/shell/hud.tsx`).

4. **P1-LORE-04: Contextual Micro-Barks for Dr. Haddy Across Acts IV–VI**
   - **What to build:** Add 10 short, non-repeating contextual radio barks in [docs/NARRATION\_SCRIPT.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) triggered by player state:
     - Firing the Extraction Beam before slotting a tool cartridge (*"You need a tool cartridge to use it for anything other than mining"* — already in [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md), verify VO hook in `TASK-22`).
     - First time renaming `dirt` or `ore` in the Studio schema inspector (*"It's not really dirt, you get that right? We're just calling it that for your sake."*).
     - Stepping into water at Stage 3 (`Aq >= 0.40`).
     - First time a neighboring player enclave's fidelity dome becomes visible on the 4.2 km horizon.
   - **Needs:** **Code** (`apps/web/src/play/quest.ts`, `apps/web/src/audio/`), **Audio** (RUN.world voice generation from `RUNWORLD_FLOOR` reserve).

5. **P1-LORE-05: Diegetic Planet Table Hologram Showing Real-Time Continent Sync Branches**
   - **What to build:** Upgrade the amber Planet Table in the Lab ([07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png) panel 4) so interacting with it shows the 40,000 km shared planet with glowing markers for the Bridge Epicenter, the Lunar Gate anchor, and neighboring player sync branches, tying the "majority consensus reality" lore from [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md) to a physical centerpiece.
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`), **Art** (shader update on existing Planet Table prop).

### P2 — Stretch Goals

6. **P2-LORE-06: "Bridge Archive" Node Map Tab in the Inventory/Databank**
   - **What to build:** An [Outer Wilds](https://store.steampowered.com/app/753640/Outer_Wilds/)-style visual node card view inside a secondary tab of the `Tab` menu showing recovered Bridge logs, discovered monster archetypes, and unlocked cartridge recipes connected by causal links.
   - **Needs:** **Code** (`apps/web/src/shell/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula):** All lore explanations of the collapse strictly reference `Pxd`, `Vtx`, `Lx`, and `Aq`—no fifth metric is ever mentioned in logs or dialogue.
- **Rule 12 (No lettering, numbers or logos on generated models):** Forensic logs and labels are rendered solely via HUD hover cards and screen shaders, never baked onto 3D model textures.
- **Rule 14 (No unrequested branding):** The phrase `"Monster Mash"` is never used in-world; monsters are referred to in-universe as **Containment Leaks** or **Uncompiled Archive Entities**.
- **Rule 18 (Legal assets only):** Archive references in lore logs strictly cite generic computing eras or BSD/CC0 communities (*Freedoom*, *LibreQuake*, *Blasphemer*), never trademarked commercial titles.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Salvage Clutter Behaviour (Permanent Removal vs. Respawn/Toggle):**
   - *Question:* When the player holds `E` to dissolve the 10 Lab clutter props (`crate-large`, `old-monitor`, etc.) in `TASK-23c` to clear floor space and read their logs, should those props stay permanently gone on that save profile, or should the narrative terminal (`server-rack` / `old-monitor`) remain permanently mounted on the desk/wall so the player can re-read logs?
   - *Recommendation:* Keep `old-monitor` and one `server-rack` as permanent inspectable fixtures against the wall, while allowing all floor crates, lockers, and coolant cans to dissolve into salvage.
2. **Additional RUN.world Voice Lines for Acts IV–VI:**
   - *Question:* Should we budget ~1,500 credits from the 66.4k RUN.world balance (well above the 16k voice floor in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)) to voice the 10 new contextual micro-barks and Act IV–VI transitions, or keep new barks subtitle + radio-chirp only until `TASK-24` passes?
   - *Recommendation:* Keep subtitle + radio-chirp for `TASK-24` merge to `main`, then batch-generate the 10 voice files in one pass once the exact wording is locked.


# 11 — Core Loop, Mechanics, Progression & Economy Plan: Closing the Feedback Circuit

## 1. The Goal: A Self-Reinforcing Loop Where Every Machine Visibly Upgrades Reality

A AAA survival-automation game lives or dies by how tightly its micro-loop (gather $	o$ process $	o$ build) drives its macro-loop (world transformation $	o$ new hazards $	o$ new tools). In **FIDELITY**, every resource gathered and every machine wired must produce an immediate, visible, local change in the four floats `S = (Pxd, Vtx, Lx, Aq)`, culminating in radial stage-upgrade waves that physically transform the 1 km plot and unlock deeper Studio synthesis.

## 2. Where It Stands Today

- **What Exists:**
  - Pure math and economy packages: [packages/fidelity/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/fidelity), [packages/plotsim/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim), [packages/structure/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/structure), [packages/lattice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/lattice), [packages/substrate/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/substrate), [packages/cartlab/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/cartlab), and [packages/vault/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/vault) (50 texture cartridges + 100 fusion recipes).
  - First-hour loop (Lab wake $	o$ Gate $	o$ Moon arrival $	o$ first Texture Mill in [08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg)) and the `TASK-11` ore soft-lock fix (hand-gathering boulders with `E` + free first Rock Drill).
  - `TASK-22` ([docs/prompts/sidecar/22-campaign-chain.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/22-campaign-chain.md)) wires Acts IV–VI quests (`A4-01` pick up rifle $	o$ `A4-02` mine 50 dirt & process at mill $	o$ `A4-03` Studio terminal $	o$ `A4-04` first Stage 2 color bloom $	o$ `B-01` foundation $	o$ `B-05` linked bin).
- **What Is Weak or Missing:**
  - **Disjointed Early Economy (`Dirt` vs. `Ore` vs. `Salvage`):** Because hand-gathering boulders (`TASK-11`), beam-mining 50 dirt (`TASK-22`), and dissolving lab clutter (`TASK-23c`) were added in consecutive passes, their conversion rates and machine roles need one unified table so players never wonder whether a machine wants Dirt, Ore, Salvage, or a Cartridge.
  - **Flat Stage Thresholds:** Crossing from Stage 0 to Stage 1 or Stage 2 currently happens when a float crosses a threshold, but lacks a local **Spatial Radius of Influence** per machine—meaning players don't feel the satisfaction of placing Relay Pylons ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #8) to push the high-fidelity frontier outward across their 1 km plot.
  - **Underused Cartridge Economy:** `@hm/vault` has 50 cartridges and 100 recipes, but in normal play the player only slots 1–2 basic cartridges before reaching Stage 2.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Core Loop & Economy Mechanism | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [The Planet Crafter](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | **Multiplicative Tier Unlocks Coupled to Visible World States:** Each metric (`O2`, `Heat`, `Pressure`, `Biomass`) has dedicated generator tiers; crossing a global index milestone unlocks recipes that require the newly formed environmental resource (e.g., harvesting water and algae only after ice melts into lakes) ([Planet Crafter Wiki](https://planet-crafter.fandom.com/wiki/Terraformation_Index)). | Players love when the *world itself* becomes the new resource node at each stage—e.g., Stage 3 water pools enabling hydro-condensers and moss harvesting. |
| [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Dimensional Depot / Linked Cloud Bins & Zero-Tedium Building:** Once a player links a storage bin (`@hm/lattice`), building and crafting pull directly from linked bins across the plot ([Dimensional Depot Guide](https://www.youtube.com/watch?v=oPsb7OFp1gg)). | Eliminates the "walk back to 6 chests because you are 2 iron short" frustration noted in [docs/BASE\_BUILDING\_RESEARCH.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/BASE_BUILDING_RESEARCH.md) (`D13–D16`). |
| [Factorio](https://store.steampowered.com/app/427520/Factorio/) | **Readable Power Satisfaction Bar & Brownout Grace:** If power demand exceeds supply (`Power Unit` + `Gate Junction`), machines slow down proportionally (brownout) and flash an amber status LED rather than shutting off 100% of the base at once ([Factorio Power Discussions](https://www.reddit.com/r/factorio/comments/szb97e/power_outage_in_factory_need_help/)). | Prevents catastrophic blackout spirals while clearly motivating the player to build a `Power Unit` ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #7) before placing high-draw machines like the `Light Projector` (#4). |
| [Abiotic Factor](https://store.steampowered.com/app/427410/Abiotic_Factor/) & [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | **Clutter Disassembly into Starter Tech:** Breaking down lab office/server furniture yields the exact components needed for your first field tools and storage bins ([Abiotic Factor Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3296702187)). | Makes the starting lab feel interactive and rewards thorough exploration before stepping into hostile territory. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Unified Resource & Machine Loop Specification

| Resource / Item | How the Player Gets It (Guaranteed Non-Soft-Lock) | What Consumes It | Visual Readability |
| :--- | :--- | :--- | :--- |
| **Raw Regolith (`Dirt`)** | Infinite via Beam Tool (`Extract` mode) carving terrain anywhere on the plot (`TASK-21/22`). | **Dirt $	o$ Ore Processor** (2 Dirt $	o$ 1 Ore) and **Beam Sculpt Mode** (fills holes). | Dark grey/ochre voxel clumps vacuumed into the rifle muzzle. |
| **Substrate `Ore`** | Hand-mining boulders (`Hold E`), automated **Rock Drill** (#1), or refined from Dirt. | Building foundations, field machines, Relay Pylons, and blank **Cartridges**. | Chunky metallic polyhedrons discharged into the drill's front tray ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #1). |
| **Lab `Salvage` & `Anomaly Cores`** | Dissolving lab clutter (`Hold E` in `TASK-23c`), lunar wreck sites, or sealing/defeating **Containment Leaks** (`TASK-23b` — also synthesizable peacefully in the Combiner per Rule 23). | Upgrading tool tiers, building **Heavy Terraformers** (Sheet 17), and splicing cartridges in the **Preset Combiner**. | Glowing cyan/violet circuit modules and stabilized shareware cores. |
| **Cartridges (`.smx` / `@hm/vault`)** | Crafted blank at **Fabricator**, written at **Preset Bench** (`#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff`), or fused at **Preset Combiner** (`#b46bff`). | Slotted into **Beam Tool** (Apply/Sculpt modes) or **Field Machines** to multiply their `S` output by `2.5x` and imprint custom biome looks. | Physical chunky cassette with color-coded LED spine matching its metric. |

### P0 — Must Fix Before First Public Test

1. **P0-LOOP-01: Unify the Dirt $	o$ Ore $	o$ Cartridge Progression Table in `@hm/substrate` and `apps/web/src/play/`**
   - **What to build:** Ensure the three gathering paths (`Hold E` on boulders, `Beam Extract` on terrain for Dirt, `Hold E` on Lab/Wreck clutter for Salvage) feed a single deterministic inventory table in [packages/substrate/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/substrate) and [apps/web/src/play/quest.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts). Guarantee Rule 23 (No Soft-Locks): if `Ore == 0` and no drill is running, mining 20 Dirt with the Beam Tool or holding `E` on any surface boulder always yields enough Ore to build a Rock Drill or Blank Cartridge.
   - **Needs:** **Code** (`packages/substrate/`, `apps/web/src/play/quest.ts`).

2. **P0-LOOP-02: Enforce Proportional Power Brownout Instead of Hard Stall on the Gate & Relay Line**
   - **What to build:** In [packages/plotsim/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim) and [apps/web/src/base/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/base), set the Planet Twin Gate's foot junction box ([06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)) to supply `100 kW` baseline power—enough for the first `Shape Press` (`30 kW`), `Texture Mill` (`35 kW`), and `Rock Drill` (`25 kW`). Placing the `Light Projector` (`120 kW`) without first building a `Power Unit` (`+250 kW`, [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #7) triggers a visible brownout warning (plumes dim to 25% rate, white pulse beads on Relay Pylons slow down, and Dr. Haddy plays the Act VII power prompt).
   - **Needs:** **Code** (`packages/plotsim/`, `apps/web/src/base/`), **UI** (power bar in build HUD).

### P1 — Makes It Feel AAA

3. **P1-LOOP-03: Cartridge Multiplicative Yield & Visual Plume Tinting**
   - **What to build:** Running a field machine (`Texture Mill`, `Shape Press`, `Light Projector`, `Water Maker`) *without* a cartridge outputs `1.0x` baseline float growth with default regolith styling. Slotting a crafted cartridge from `@hm/vault` boosts that machine's float rate to `2.5x`, tints its square pixel exhaust plume to match the cartridge's dominant chromatic signature, and imprints that cartridge's procedural material (`@hm/texgraph`) onto the surrounding terrain radius.
   - **Needs:** **Code** (`packages/plotsim/`, `apps/web/src/crafter/world.ts`), **VFX** (plume tint uniform).

4. **P1-LOOP-04: Heavy Terraformer Hardpoint Progression (Stage 2 $	o$ Stage 4)**
   - **What to build:** Replace the 1.9x scaled stand-in heavy machines (`POL-24`) with the dedicated 8 m hardpoint socket progression from [17-sheet-heavy-terraformers.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/17-sheet-heavy-terraformers.png) (`#28 Heavy Shape Press`, `#29 Heavy Light Projector`, `#30 Heavy Water Maker`). Require a snapped 2x2 foundation hardpoint (`@hm/structure`) and linked `@hm/lattice` bin feed to construct them, creating a clear mid-game engineering goal between Stage 2 and Stage 4.
   - **Needs:** **Art** (pack Sheet 17 models via `runworld-pack.mjs`), **Code** (`packages/structure/`, `packages/plotsim/`).

5. **P1-LOOP-05: Peaceful Synthesis Alternative for All Monster Leak Drops (Rule 23 Enforcement)**
   - **What to build:** Every `Anomaly Core` or `Shareware Fragment` dropped by `@hm/leaksim` monsters must also be obtainable by sealing a dormant reality leak with the Beam Tool (`Seal` mode) *or* fusing `Salvage + Blank Cartridge` inside the Lab's Preset Combiner (`Aggression: 'off' | 'calm'` compatibility).
   - **Needs:** **Code** (`packages/leaksim/`, `packages/substrate/`).

### P2 — Stretch Goals

6. **P2-LOOP-06: Automated Relay Pylon Logistics Pulse (`@hm/lattice` Visual Beads)**
   - **What to build:** When a `Rock Drill` is connected to a `Texture Mill` or `Linked Bin` via Relay Pylons ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #8), travel a bright white energy bead (`#ffffff`) and color-coded packet pulse along the catenary sag cables whenever `@hm/lattice` transfers ore or power.
   - **Needs:** **Code** (`apps/web/src/base/view.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula):** Every machine and cartridge modifies only `S = (Pxd, Vtx, Lx, Aq)`.
- **Rule 2 (Purity is load-bearing):** All economy ticks, brownout ratios, and lattice transfers remain 100% deterministic pure functions in `@hm/plotsim` and `@hm/lattice`.
- **Rule 10 (Believable machines):** Material goes in at the dark feed hopper; colored pixels exit from the rear/top exhaust stack ([12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)).
- **Rule 23 (No soft-locks):** Infinite terrain dirt mining + hand-boulder gathering + brownout grace + non-destructive monsters guarantee zero dead-end states.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Rock Drill Exhaust Wisp (From Concept Sheet 12 Callout):**
   - *Question:* In [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) ("FOR THE OWNER"), the sheet asks: *"the drill's faint wisp is unrefined motes — keep or drop it?"*
   - *Recommendation:* **Keep a faint, low-altitude grey/dust mote wisp** at the Rock Drill's rear stack when running, distinct from the tall, saturated neon pixel plumes (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`) of the four fidelity processors. That way players can tell from 200 m away whether their drill is powered and mining without confusing it with a fidelity emitter. Do you agree?
2. **Starting Field Machine Set for Act III–VII:**
   - *Question:* Sheet 12 presents 8 candidate field machines (`1 Rock Drill`, `2 Texture Mill`, `3 Shape Press`, `4 Light Projector`, `5 Water Maker`, `6 Preset Mixer`, `7 Power Unit`, `8 Relay Pylon`). Should `6 Preset Mixer` stay exclusively inside the Lab (as the `Preset Combiner` on Sheet 07) during the first hour so players have a reason to walk back through the Gate, unlocking the field `Preset Mixer` only at Stage 3?
   - *Recommendation:* **Yes—keep Preset Mixing inside the Lab until Stage 3.** That preserves the dual-world Portal loop in Acts I–VI while rewarding late-game builders with field automation.


# 12 — The First Hour & Onboarding Plan: Zero-Dead-End Pacing from Cold Boot to First Color Bloom

## 1. The Goal: A 45-Minute Masterclass in Show-Don't-Tell Pacing

The first hour of **FIDELITY** is our hook. As noted in [docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, the first hour has never been tuned with external players, and the owner's brother previously quit when he ran out of oxygen/ore and didn't know how to recover. Our goal is to pace Acts I through VI (`TASK-22`, [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)) so that every 3–5 minutes delivers an unforgettable visual/auditory payoff, zero tutorials rely on walls of text, and no player can ever stall on coherence, ore, or direction.

## 2. Where It Stands Today

- **What Exists:**
  - Acts I–III work end-to-end in [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [apps/web/src/play/quest.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts): waking in the Lab ([02-lab-act1-wake.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/02-lab-act1-wake.jpg)), powering the breaker wall ([03-lab-power-wall.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/03-lab-power-wall.jpg)), inspecting the window storm ([05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), opening the Gate ([06-gate-open.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg)), and stepping onto the Stage 0 Moon ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)).
  - `TASK-11` fixed the early ore soft-lock (`Hold E` on boulders + free first Rock Drill).
  - `TASK-22` ([docs/prompts/sidecar/22-campaign-chain.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/22-campaign-chain.md)) extends `@hm/questline` through Acts IV–VI (`A4-01` pick up rifle $	o$ `A4-02` mine 50 dirt & refine $	o$ `A4-03` Studio schema edit $	o$ `A4-04` Stage 2 color bloom $	o$ `B-01` foundation $	o$ `B-05` linked bin).
- **What Is Weak or Missing:**
  - **The Brother's Quit Trigger (Suit Coherence / Oxygen Anxiety):** In early Stage 0, stepping onto a visually disorienting 1-bit dither landscape while a timer drains and 3 HUD banners overlap ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)) induces panic before the player even understands how to place a machine.
  - **Flat Set-Piece Beats:** Throwing the Lab breaker ([04-lab-power-on.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg)) and pulling the Gate lever ([06-gate-open.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg)) happen instantly without build-up, failing to match the drama of [01-lab-first-play.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/01-lab-first-play.png) and [02-gate-power-on.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png).
  - **Missing "Breadcrumb" Guidance Between Lab and Moon:** When the player needs to return to the Lab Armory (`A4-01`) or bring 50 Dirt back to the processor (`A4-02`), the monochrome Stage 0 terrain makes it easy to lose orientation relative to the Twin Gate if the player walked 80 m away.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | First-Hour Onboarding Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Portal 2](https://developer.valvesoftware.com/wiki/Indicator_Lights_%28Portal_2%29) | **Environmental Indicator Lines & Single-Verb Isolation:** Valve introduces one mechanic at a time and uses floor/wall indicator light lines to connect switches to the exact device they power ([Valve Developer Wiki](https://developer.valvesoftware.com/wiki/Indicator_Lights_%28Portal_2%29)). | Our steel floor cable covers ([06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)) should act just like *Portal 2* indicator lines—pulsing amber from the breaker to the console, and from the console to the Gate plinth. |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | **Safe Shallow Tether Before Deep Hazard:** The player starts inside the Lifepod (fire extinguisher tutorial), then swims in bright, shallow coral water where surfacing takes 2 seconds before ever facing deep O2 pressure ([Subnautica Beginner Guide](https://www.reddit.com/r/subnautica/comments/929xhc/tips_for_starting_outhabitat_building/)). | On the Moon, the **Twin Gate's foot pad must project a 25 m "Coherence Safe Dome"** where suit sync *never* drains, so the player can place their first machine and learn the build UI with zero timer stress. |
| [The Planet Crafter](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | **Immediate Visual Feedback on First Machine Placement:** Within 5 minutes of landing, placing a single drill and heater visibly ticks the global counter and powers indoor screens ([Steam Store](https://store.steampowered.com/app/1284190/The_Planet_Crafter/)). | Placing the free starter machine in Act III must trigger an immediate, unmistakable radial wave that sharpens Stage 0 dither perspective within 3 seconds. |
| [Half-Life 2](https://developer.valvesoftware.com/) / [Abiotic Factor](https://store.steampowered.com/app/427410/Abiotic_Factor/) | **The "Dry Fire" Tool Teaching Beat:** Letting the player pick up a tool, press fire, hear a distinct mechanical *clack/brrt*, and immediately see/hear why it needs a cartridge or battery. | Directly validates the owner's Act III beat in [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md): pick up rifle $	o$ dry fire `"brrt"` $	o$ default mining works on dirt, cartridge required for sculpt/paint. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Target 45-Minute First-Hour Pacing Timeline

| Minute Mark | Act & Quest ID | Player Action | Sensory & World Payoff | Fail-Safe / Anti-Quit Guardrail |
| :--- | :--- | :--- | :--- | :--- |
| **00:00 – 03:00** | **Act I: Cold Boot** (`A1-01` to `A1-03`) | Eyes open to dark ceiling; red alarm strobe; sit up; Dr. Haddy glitch portrait (`"Not that button"`); pull Power Wall breaker. | Capacitors thrum bottom-up; overhead strip lights flicker on row-by-row; machines spin up. | Zero drain inside the shielded Lab; flashing amber LED on the breaker handle. |
| **03:00 – 07:00** | **Act II: The Breach & The Gate** (`A2-01` to `A2-03`) | Walk to window (see 3D Breach storm); pull Console lever to ignite the freestanding Gate. | Gate's ribbed amber coils ignite sequentially over 3.5 s; portal aperture tears open to 1-bit Stage 0 Moon. | Floor cable ramps pulse with amber light guiding the eye from Breaker $	o$ Console $	o$ Gate. |
| **07:00 – 14:00** | **Act III: First Step & Shape Press** (`A3-01` to `A3-03`) | Step through Gate onto Stage 0 Moon; place free **Shape Press** inside the 25 m Gate Safe Dome; slot starter cartridge. | Green `#7cff4d` pixel plume rises; radial scan-wave sweeps outward, stabilizing Stage 0 dither into crisp Stage 1 EGA contours. | **25 m Gate Coherence Dome** prevents any sync/oxygen drain while learning the build menu (`B`). |
| **14:00 – 24:00** | **Act IV: Armory, Leak & Dirt Mining** (`A4-01`, `A4-02`) | Perimeter leak warning triggers; grab **Extraction Beam Rifle** from Lab wall rack; seal/defeat 2 perimeter imps; mine 50 Dirt; refine to Ore in Lab. | Terrain physically carves under the beam; first shareware anomaly dissolves into core shards; Dirt $	o$ Ore processor hums. | Twin Gate emits a persistent amber beacon beam into the sky so the player can always find the portal from anywhere on the plot. |
| **24:00 – 34:00** | **Act V: The Meta-Studio & Base Foundation** (`A4-03`, `B-01` to `B-05`) | Open Lab Studio console (*"It's not really dirt"*); inspect/edit schema variable; craft `smooth ground` + `Grass` cartridges; place first Foundation & Linked Bin. | Player sees live schema change; terrain craters smooth out under the rifle's Sculpt mode; outpost takes shape. | All resources in the Linked Bin (`B-05`) are automatically available to the build tool anywhere on the plot. |
| **34:00 – 45:00** | **Act VI–VII: First Color Bloom & Light Surge** (`A4-04`) | Slot Grass cartridge into **Texture Mill**; place **Rock Drill**, **Power Unit**, and **Light Projector**. | Pink/Green plume blooms emerald grass patches across the monochrome rock; **Light Projector** fires an amber sky wave that turns the black void into a blue atmospheric sky with real shadows. | Dr. Haddy transitions from step-by-step quest guide to contextual advisor; open sandbox unlocked. |

### P0 — Must Fix Before First Public Test

1. **P0-HOUR-01: Implement the 25 m Twin Gate Coherence Safe Dome & Graceful Desync Recovery (Fixing the Brother's Quit Point)**
   - **What to build:** In [apps/web/src/play/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/play) and [packages/plotsim/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim):
     1. Within `25 m` of the Planet Twin Gate (and `15 m` of any powered Relay Pylon or Shelter), **Suit Coherence (`Sync`) never drains and regenerates at `20%/sec`**.
     2. Only when venturing beyond the powered perimeter into raw Stage 0 unpowered terrain does Coherence drain (`90 seconds` full buffer).
     3. At `30%` Coherence, play a gentle radio static cue + amber compass arrow pointing straight back to the Twin Gate; if Coherence ever hits `0%`, **never delete items or reset progress**—emergency-recall the player to the Lab Gate threshold with 100% inventory intact and a witty line from Dr. Haddy (*"Pulled your buffer back before the static ate you. Stay near the relay line or drop a pylon."*).
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/plotsim/`), **UI** (compass tether arrow).

2. **P0-HOUR-02: Stage Sequential Quest Banners (`TASK-22` + HUD Queue Fix)**
   - **What to build:** On first Moon arrival ([07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)), suppress the build-mode `"CANNOT PLACE"` warning unless the build menu (`B`) is actively open, and delay Dr. Haddy's voiceover line by `2.0 seconds` until the `STAGE 0 // LUNAR SUBSTRATE` location title card finishes fading out.
   - **Needs:** **Code** (`apps/web/src/shell/hud.tsx`, `apps/web/src/play/quest.ts`).

### P1 — Makes It Feel AAA

3. **P1-HOUR-03: Choreograph the 4-Second Act I Wake-Up & Act II Gate Ignition Sequences**
   - **What to build:**
     - **Act I Wake (`LabScene.ts`):** Start camera pitched `+65°` toward the dark ceiling under a rotating red emergency strobe (`1.2 Hz`), smoothly ease pitch to `0°` over `2.2 seconds` as the player sits up, then pop in Dr. Haddy's glitching CRT portrait in the top-left corner (`"Not that button..."`).
     - **Act II Gate Ignition (`LabScene.ts`):** When the console lever is pulled, ignite the 8 horizontal ribbed coil blocks on each Gate upright from bottom to top over `3.0 seconds` (`250 ms` per block) accompanied by a rising capacitor charge pitch, culminating in an amber arc flash that reveals the live Stage 0 Moon stencil view.
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`), **Audio** (`packages/soundpack/`).

4. **P1-HOUR-04: Twin Gate Vertical Sky Beacon for Effortless Plot Orientation**
   - **What to build:** Render a subtle vertical amber telemetry beam (`#ffc13d`, additive cylinder fade up to 80 m height) rising from the top lintel of the Planet Twin Gate during Stages 0–2 so the player can always spot the way home across craters and boulders.
   - **Needs:** **Code** (`apps/web/src/crafter/world.ts`).

### P2 — Stretch Goals

5. **P2-HOUR-05: Interactive Schema Diff Toast When Renaming `Dirt` / `Ore` in Act V (`A4-03`)**
   - **What to build:** When the player changes the display label of `dirt` in the Studio terminal during `A4-03`, immediately flash a live `"SUBSTRATE PATCH APPLIED // 14 HUD REFERENCES UPDATED"` toast and show the player's custom word on every dirt chunk pickup and processor tooltip for the rest of the session.
   - **Needs:** **Code** (`apps/web/src/studio/`, `apps/web/src/shell/hud.tsx`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 23 (No soft-locks):** The 25 m Gate Coherence Safe Dome, zero-loss emergency recall, and `TASK-11` hand-mining guarantee no player can quit from oxygen/coherence death or ore starvation.
- **Rule 8 (Owner's words are logged verbatim):** Implements every beat of the owner's verbatim onboarding sequence from [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md).

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Coherence / Oxygen Drain Inside the Starting Plot Radius:**
   - *Question:* Your brother quit when he ran out of oxygen/ore early on. Do you want Suit Coherence (`Sync`) to be **100% infinite inside the powered Gate/Pylon radius** (only draining when exploring outside the powered zone or during a Monster Leak storm), or should it always drain slowly outdoors until the Life-Support Unit (Concept Sheet 18, [18-sheet-life-support.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/18-sheet-life-support.png)) is built?
   - *Recommendation:* Make Coherence **infinite within 25 m of the Twin Gate and 15 m of any powered Relay Pylon/Life-Support Unit**, and only drain when walking beyond the power grid into raw unpowered wasteland. That rewards building pylons and shelters without punishing players while they arrange machines in their base!


# 13 — Level Layouts, Plot Topology & The Lab Plan: Grounded Industrial Spatial Design

## 1. The Goal: A Believable Portal-2-Caliber Lab Opening Onto a 1 km Natural World

Our spatial architecture has two halves that must contrast sharply yet connect seamlessly through a single 2.6 m × 1.7 m freestanding doorway:
1. **The Shielded Earth Lab:** A grounded, tactile research facility inspired by [Portal 2](https://developer.valvesoftware.com/wiki/Clean_%28Portal_2%29) and [Control](https://www.gamedeveloper.com/art/the-real-buildings-that-inspired-i-control-i-s-oldest-house), laid out strictly per [07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png) and [21-sheet-the-lab.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/21-sheet-the-lab.png), with a 14.8 m × 3.1 m observation window looking out onto the collapsing Bridge Array wasteland ([docs/WINDOW\_SCENE\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/WINDOW_SCENE_PLAN.md)).
2. **The 1 km Lunar Plot:** A natural geological basin on a 40,000 km shared planet ([11-desolate-horizon.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/11-desolate-horizon.png), [10-plot-stage-6-hero.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/10-plot-stage-6-hero.png)) where elevation, crater rims, mineral veins, and hydrological drainage reward smart machine and outpost placement.

## 2. Where It Stands Today

- **What Exists:**
  - [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) implement the Lab interior, freestanding Gate, power wall, and 3D window vista ([apps/web/src/lab/lab-vista.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-vista.ts)).
  - 10 lab clutter props (`crate-large`, `crate-small`, `cardboard-stack`, `filing-cabinet`, `server-rack`, `locker`, `toolbox`, `coolant-can`, `sample-case`, `old-monitor`) and 6 vista pieces (`datacentre-hall`, `chiller-block`, `shipping-container`, `pylon-tower`, `overpass-segment`, `rubble-slab`) are packed in [apps/web/src/assets/gen/registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json).
  - [apps/web/src/crafter/planet.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/planet.ts) and [packages/plotterrain/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotterrain) generate the 1 km plot with a 4.2 km horizon and 11 sample neighbor domes.
- **What Is Weak or Missing:**
  - **The Lab Still Reads as a Sparse Stage Set ([02-lab-act1-wake.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/02-lab-act1-wake.jpg), [03-lab-power-wall.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/03-lab-power-wall.jpg)):** Sheet 21 ([21-sheet-the-lab.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/21-sheet-the-lab.png)) and [docs/LAB\_LAYOUT\_RESEARCH.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/LAB_LAYOUT_RESEARCH.md) are only partly realized. The power wall lacks copper bus bars and overhead cable trays ([07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png)), and the floor feels empty before clutter placement.
  - **Foundations Look Like Red Prototype Pucks ([10-foundation-placed.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/10-foundation-placed.jpg)):** Instead of the industrial box-section steel frames and grated decks of [13-sheet-base-construction.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/13-sheet-base-construction.png) and [14-outpost-stage-3.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/14-outpost-stage-3.png), placed foundations render as flat red slabs with blue rings.
  - **3D Window Vista Composition (`05-window-view-storm-and-breach.jpg`):** Needs Review 1 fixes from [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §7 completed (push foreground boxes back, ground horizon plane with fog depth, make the cyan glitch-sliced Breach column tower past the top of the glass one-third from the left, and float full spherical S-space fidelity pockets).

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Spatial & Architectural Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Portal 2](https://developer.valvesoftware.com/wiki/Clean_%28Portal_2%29) | **Modular Panel Grids & Overhead Service Trays:** Off-white 2 m × 2 m modular wall panels with dark recessed seams, steel kick-plates, and exposed ceiling cable trays that ground high-tech machines in industrial reality ([Valve Clean Theme Docs](https://developer.valvesoftware.com/wiki/Clean_%28Portal_2%29)). | Directly matches our canon Lab spec in [docs/concept/setmix/README.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/README.md): off-white panels, dark steel kick band, polished concrete floor, 8 m ceiling with cold-white strip lights, and floor cable ramps. |
| [Abiotic Factor](https://store.steampowered.com/app/427410/Abiotic_Factor/) | **Functional Lab Zones & Clearable Clutter:** Every corner of a lab room has a clear purpose (Power & Engineering, Fabrication & Synthesis, Observation & Command, Armory & Storage), and clearing crates opens prime real estate for advanced benches ([Abiotic Factor Base Tips](https://www.reddit.com/r/AbioticFactor/comments/1itys3y/how_to_build_a_better_base/)). | Validates `TASK-23c` where dissolving `crate-large` and `cardboard-stack` clears the right-wall bay for new machines while yielding starter salvage. |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) & [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Terrain-Adaptive Foundation Legs & Hardpoint Pads:** When a foundation is placed on a slope, telescoping corner legs automatically extend down into the bedrock so nothing ever floats ([Base Building Research D13–D16](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/BASE_BUILDING_RESEARCH.md)). | Essential for Rule 10 (*"Nothing floats"*): every foundation and field machine must extend support legs or a cast concrete plinth down into the lunar slope. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical Lab Floor Plan (18 m × 14 m × 8 m High)

| Zone | Coordinates & Orientation | Fixtures & Props (All Grounded + Cabled per Rule 10) |
| :--- | :--- | :--- |
| **Back-Left: Observation Window** | Back wall, left/center-left (`14.8 m × 3.1 m` letterbox armored glass) | Looks out onto [apps/web/src/lab/lab-vista.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-vista.ts) (Bridge Array ruins, towering cyan Breach column 1/3 from left, floating spherical S-pockets). Flanked by `old-monitor` telemetry desk and `filing-cabinet`. |
| **Center-Right: Freestanding Gate** | `3.0 m` forward of back wall, middle-right (`2.6 m × 1.7 m` opening, `3.2 m` outer height) | Box-section gunmetal frame, ribbed amber field coils, side buttresses, hazard-striped plinth, rear junction box with 6 cable glands ([06-sheet-gate.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)). Main **Operator Console** (red lever) stands `2.2 m` front-left of Gate. |
| **Back-Right: The Power Chain** | Back-right corner along wall | Left-to-right per [07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png): **Capacitor Bank** (6 cylinders + copper bus bars on steel skid) $	o$ **Breaker Panel** (rotary handle + 2 analog gauges) $	o$ **4 Relay Cabinets** (amber top beacons) $	o$ **Control Boxes** $	o$ **Ribbed Steel Floor Cable Covers** running straight into the Gate plinth. |
| **Right Wall: Synthesis & Fabrication Bay** | Right wall, front-to-back | **Hardware Fabricator** (`#7cff4d` green print bed), **Preset Bench** (`#ff3d8a` pink laser), and **Preset Combiner** (`#b46bff` violet plasma globe), fed by overhead ceiling cable drops. Clutter props (`crate-large`, `coolant-can`, `toolbox`) initially block the secondary expansion slots (`TASK-23c`). |
| **Center-Left & Left Wall: Command & Armory** | Center-left floor & left wall | **Round 2.4 m Planet Table** (amber hologram of plot + neighbor enclaves) in center-left; **Preset Rack** (cartridge library wall) and **Armory Tool Rack** (holding the Extraction Beam Rifle and Shareware Sidearm, mounted as separate socketed objects per Rule 16) on the left wall. |

### P0 — Must Fix Before First Public Test

1. **P0-LAYOUT-01: Replace Red Slab Foundations with Sheet 13 Industrial Box-Section Frames (`10-foundation-placed.jpg` Fix)**
   - **What to build:** In [apps/web/src/base/view.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/base/view.ts), retire the prototype red cylinder/ring geometry seen in [10-foundation-placed.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/10-foundation-placed.jpg) and bind the packed modular pieces from [13-sheet-base-construction.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/13-sheet-base-construction.png) and [15-sheet-base-roofs-openings.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/15-sheet-base-roofs-openings.png) (gunmetal box-section frame, grated deck plate, hazard-striped rim, and auto-extending corner support legs that raycast down into slopes up to 3 m).
   - **Needs:** **Code** (`apps/web/src/base/view.ts`), **Art** (already in `registry.json` from Sheet 13/15 batches).

2. **P0-LAYOUT-02: Complete the Lab Power Chain & Clutter Staging (`03-lab-power-wall.jpg` & `TASK-23c`)**
   - **What to build:** In [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [apps/web/src/play/lab-room.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts):
     - Arrange the Power Wall strictly left-to-right per [07-sheet-lab-power-and-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png) with visible copper bus bars on the Capacitor Bank, amber rotating/pulsing beacons atop the 4 Relay Cabinets, and ribbed steel floor cable ramps connecting the relays to the Gate plinth and Operator Console.
     - Place the 10 packed clutter props (`crate-large`, `crate-small`, `cardboard-stack`, `filing-cabinet`, `server-rack`, `locker`, `toolbox`, `coolant-can`, `sample-case`, `old-monitor`) in logical functional clusters with ground contact shadows so the room feels lived-in.
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`, `apps/web/src/play/lab-room.ts`).

3. **P0-LAYOUT-03: Lock 3D Window Vista Composition & Scale (`05-window-view-storm-and-breach.jpg` & `TASK-19` Review 1)**
   - **What to build:** In [apps/web/src/lab/lab-vista.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-vista.ts), verify all items from Opus's Review 1 ([docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §7):
     - Push `datacentre-hall` and `chiller-block` to mid-ground (`45–120 m`) so they do not crowd the glass; place `overpass-segment` and `pylon-tower` leading the eye toward the **Breach Column** positioned at the left one-third rule (`x = -35%` of window span), rising above the upper window frame with horizontal glitch-slice shader displacement.
     - Render 3 floating **S-Space Fidelity Pockets** as true 3D spheres (`r = 4–9 m`) that stencil/shader-render Stage 3/4 lush terrain inside their volume while a `shipping-container` or `rubble-slab` straddles a pocket boundary (half 1-bit dither, half full PBR).
   - **Needs:** **Code** (`apps/web/src/lab/lab-vista.ts`).

### P1 — Makes It Feel AAA

4. **P1-LAYOUT-04: Curate the 1 km Starting Lunar Plot Topology (`packages/plotterrain/`)**
   - **What to build:** Tune the default starting plot heightfield in [packages/plotterrain/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotterrain) and [apps/web/src/crafter/planet.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/planet.ts) around four distinct, readable landmarks within 250 m of the Twin Gate ([08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png), [11-desolate-horizon.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/11-desolate-horizon.png)):
     1. **The Gate Pad Plateau (`0–30 m`):** Flat enough to place the first 4 machines and a 3x3 outpost without fighting steep slopes.
     2. **The Low Hydro Basin (`35–90 m` East/Center):** A natural depression `-3.5 m` below pad level that stays dry in Stages 0–2 and floods into the hero turquoise lake at Stage 3–4 ([08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png) Panel 4–6).
     3. **The Bouldered Ore Ridge (`50–120 m` North-West):** High-density boulder scatter and exposed mineral veins ideal for `Rock Drill` placement and `Goblin Rover` hill climbs.
     4. **The Wreck & Anomaly Rim (`120–220 m` Perimeter):** Crater rim hosting 3 salvageable lunar wreck sites (`TASK-23c`) and the initial perimeter anomaly leak points (`TASK-23b`), framing the 11 distant neighbor enclave domes on the 4.2 km horizon.
   - **Needs:** **Code** (`packages/plotterrain/`, `apps/web/src/crafter/planet.ts`).

5. **P1-LAYOUT-05: Dynamic Floor Cable Covers Between Field Machines & Relay Pylons**
   - **What to build:** Whenever a field machine (`Texture Mill`, `Shape Press`, `Light Projector`, `Water Maker`) is placed within 20 m of the Twin Gate pad or a `Relay Pylon`, automatically extrude a low-poly ribbed steel floor cable cover (on flat ground/foundations) or catenary sag cable (between pylons) so no machine ever operates "wirelessly" (enforcing Rule 10 and [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)).
   - **Needs:** **Code** (`apps/web/src/base/view.ts`, `apps/web/src/crafter/world.ts`).

### P2 — Stretch Goals

6. **P2-LAYOUT-06: Weathering & Moss Progression on Placed Base Pieces at Stage 4 (`12-sheet-field-machines.png` Bottom Row)**
   - **What to build:** As local `Aq` and `Lx` cross Stage 4 (`>= 0.75`), blend a world-space top-down moss and patina normal/albedo overlay onto the upward-facing surfaces of the Twin Gate, foundations, and field machines so they age into the meadow they created ([10-plot-stage-6-hero.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/10-plot-stage-6-hero.png)).
   - **Needs:** **Code** (`packages/groundshader/`, `apps/web/src/crafter/world.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 9 (One natural world, 1 km plot):** The starting plot topology uses natural geological basins and ridges that stay identical across Stages 0–4, only gaining vertex smoothness, water, and flora.
- **Rule 10 (Believable machines, nothing floats, cabled):** Telescoping foundation legs and automatic floor cable covers ensure every structure and machine is physically anchored and wired.
- **Rule 11 (Square sections) & Rule 16 (Split hard parts):** Wall-mounted rifles and benchtop printers remain separate socketed meshes placed in code.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Water Maker Footprint (`7.74 m × 6.30 m` vs. 8 m Hardpoint Socket):**
   - *Question:* [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4 flags checking the `Water Maker`'s `7.74 m × 6.30 m` footprint on its hardpoint. Should the standard field `Water Maker` fit on a **1x1 foundation cell (`4 m × 4 m`)** like the `Texture Mill` and `Shape Press` (scaling the field version to `3.6 m × 3.0 m`), while reserving the `8 m × 8 m` (2x2 cell) footprint for the **Heavy Water Maker** (`#30` on Sheet 17)?
   - *Recommendation:* **Yes—scale the starter field Water Maker to fit a 1x1 (`4 m × 4 m`) pad** and reserve the 2x2 (`8 m × 8 m`) hardpoint for the Sheet 17 Heavy Terraformer tier.


# 14 — Lighting Per Stage & Transitions Plan: From 1-Bit Dither to Golden-Hour PBR

## 1. The Goal: Make Every Stage of `S = (Pxd, Vtx, Lx, Aq)` Look Like an Art-Directed Masterpiece

In **FIDELITY**, lighting is not a static post-process—it is a core gameplay metric (`Lx`, Light Flux) and the primary way the player perceives progress. Right now ([docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5), stage lighting and transitions are functional rather than cinematic, the Lab power-up barely changes room exposure ([04-lab-power-on.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg)), and the player character and rifle render near-black on the Moon ([13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg), [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)). Our goal is to make **every stage from Stage 0 to Stage 4 look intentionally art-directed** while keeping the GTX 950M locked at 60 fps (`POL-04`).

## 2. Where It Stands Today

- **What Exists:**
  - [packages/lighting/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/lighting), [packages/lightplace/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/lightplace), [packages/groundshader/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/groundshader), and [apps/web/src/crafter/looks.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/looks.ts) drive the shader uniforms for `Pxd`, `Vtx`, `Lx`, and `Aq`.
  - [08-plot-stage-ladder.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/08-plot-stage-ladder.png) defines the exact canonical lighting arc: low sun `20–25°` up from frame right, pitch-black sky at S1 $	o$ thin horizon color band at S2 $	o$ atmospheric haze and soft shadows at S3 $	o$ water reflections at S4 $	o$ golden-hour god rays through lush forest canopy at S6 ([10-plot-stage-6-hero.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/10-plot-stage-6-hero.png)).
  - `TASK-21c` ([docs/prompts/sidecar/21-beam-tool.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/21-beam-tool.md)) is currently addressing avatar lighting in [apps/web/src/avatar/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/avatar).
- **What Is Weak or Missing:**
  - **Near-Black Avatar & Viewmodel (`13-beam-first-person-apply-paint.jpg`, `14-beam-third-person.jpg`):** Standard Three.js `MeshStandardMaterial` with `metalness > 0.3` and no environment cubemap (`scene.environment = null` at low `Lx`) multiplies diffuse light toward zero and reflects black sky, turning the Scientist and rifle into black silhouettes.
  - **Screen-Space Dither Swimming in Stage 0 (`07-moon-stage0.jpg`):** Sampling a 4x4 Bayer matrix solely in screen-space `(gl_FragCoord.xy)` causes terrain patterns to "swim" across polygons whenever the player rotates the camera, flattening perspective depth (`V1_1_ONBOARDING_PLAN.md` §1 note: *"needs slight adjustment on the dither of the terrain to add perspective"*).
  - **Flat Lab Power-On Contrast (`02-lab-act1-wake.jpg` vs. `04-lab-power-on.jpg`):** Act I wakes in a room that is already too evenly lit by ambient light, so throwing the breaker in [04-lab-power-on.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg) lacks the dramatic shift shown in [01-lab-first-play.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/01-lab-first-play.png) and [02-gate-power-on.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png).
  - **Missing Radial Wave Drama:** Stage upgrades interpolate globally or linearly without a dramatic volumetric scan-ring sweeping across the terrain and leaving glowing edge-tessellation in its wake.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Lighting & Shader Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Return of the Obra Dinn](https://dukope.com/devlogs/obra-dinn/tig-32/) | **Surface/Sphere-Projected 1-Bit Dither & Sobel Edge Preservation:** Lucas Pope projected the dither pattern onto a world-anchored sphere/cube around the camera and injected a 1-bit normal/depth edge line so horizon silhouettes stay rock-solid during camera rotation ([Lucas Pope TIGSource Devlog](https://dukope.com/devlogs/obra-dinn/tig-32/)). | Solves our exact Stage 0 dither swimming and perspective-loss problem at virtually zero GPU cost (~0.2 ms). |
| [Portal 2](https://steamcommunity.com/sharedfiles/filedetails/?id=158903426) | **Dark Contrast Pools & Sequential Power-Up Choreography:** Power-off rooms rely on a single emergency bounce light and dark silhouettes; power-on sequences fire banks of cold-white strip lights (`5600K`) with a subtle fluorescent ballast flicker while warm amber (`2700K`) accents highlight interactive consoles ([Portal 2 Lighting Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=158903426)). | Directly upgrades `LabScene.ts` to match [01-lab-first-play.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/01-lab-first-play.png) and [02-gate-power-on.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png). |
| [The Planet Crafter](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | **Atmospheric Scattering & Fog Color Progression:** Transitioning the sky dome from harsh airless vacuum to warm dust haze to Rayleigh blue sky transforms how every rock and machine reads without changing a single mesh ([Steam Store](https://store.steampowered.com/app/1284190/The_Planet_Crafter/)). | Validates tying Rayleigh/Mie sky uniforms and distance fog directly to `Lx` and `Aq`. |
| [Signalis](https://store.steampowered.com/app/1262350/Signalis/) & [Prodeus](https://store.steampowered.com/app/964800/Prodeus/) | **Quantized Color Ramps with Rim-Light Separation:** Even in 16-color or 256-color palettes, dynamic actors (player, weapons, enemies) receive a view-space Fresnel rim light locked to the nearest bright palette index so they never merge into dark backgrounds. | Permanently fixes the dark avatar and dark rifle in Stages 0–2 (`TASK-21c`). |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical Stage-by-Stage Lighting Specification

| Stage | Sun & Sky Parameters (`sunElevation = 22°` Frame Right) | Shadow & Ambient Model | Character / Viewmodel Fill (`TASK-21c`) | Performance Guard (`GTX 950M = 60 FPS`) |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 0 (`Lx < 0.15`)** | Black vacuum sky (`#050608`), crisp 1-bit starfield, alien ochre/green Goblin planet; hard directional key (`intensity = 1.4`). | World-space/cylindrical 4x4 Bayer dither + 1 px normal/depth silhouette edge; zero sky ambient (`hemisphere = 0.12` cold slate floor). | View-space Fresnel rim light (`power = 2.5`, intensity `0.65`, quantized to 1-bit white/amber) + minimum albedo floor (`metalness <= 0.15` in Stage 0–2). | Single directional light, no shadow map cascades needed (`0.4 ms` total pass). |
| **Stage 1 (`Lx 0.15–0.35`)** | Black zenith (`#080b12`) with thin indigo/amber horizon band (`#2a1f3d` $	o$ `#b86b35`); 16-color EGA ramp quantization. | Flat face normals (`dFdx/dFdy` screen-space face normal) + hard sun glint (`specular power = 16`, quantized to 2 steps). | Rim light tints to suit visor color + `#ffc13d` bounce from Twin Gate coils within 25 m. | No extra draw calls; face normals computed in fragment shader. |
| **Stage 2 (`Lx 0.35–0.60`)** | Deep twilight blue zenith (`#14243b`) to warm ochre horizon haze (`#c98a5b`); 256-color VGA LUT with distance fog starting at `180 m`. | 1-cascade PCF shadow map (`1024²` on Low, `2048²` on High) + Gouraud vertex/fragment interpolation. | Hemisphere light (`sky = #4a6b9c`, `ground = #5c4332`, `intensity = 0.55`) + weapon emissive mode coils. | Low tier caps shadow map at `1024²` and disables distant grid lines (`POL-04`). |
| **Stage 3 (`Lx 0.60–0.85`)** | Full Rayleigh blue sky (`#3b78b8`) with warm horizon scatter (`#e8c89b`); normal maps active on terrain and machines. | Soft PCF shadows + procedural hemisphere IBL cubemap baked once per stage transition (`64²` PMREM). | Full hemisphere + PMREM environment reflections on hazmat visor, rifle housing, and rover chassis. | PMREM cubemap updates only when `Lx` changes by `> 0.05` (zero per-frame cost). |
| **Stage 4 (`Lx >= 0.85`)** | Golden-hour scattering (`sun = #ffe2a8`, `intensity = 2.4`), volumetric cloud shadow plane, water specular caustics (`@hm/hydro`). | 2-cascade shadow map (High/Ultra) + contact ambient occlusion around machine feet and coverage turf ([09-sheet-coverage-growth.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/09-sheet-coverage-growth.png)). | Full PBR with subtle canopy dapple shadow and `#ff3d8a`/`#7cff4d` plume bounce (`POL-02` on High/Ultra). | Low tier uses analytical sun + baked vertex AO (`POL-04` guaranteed 60 fps). |

### P0 — Must Fix Before First Public Test

1. **P0-LIGHT-01: Fix Near-Black Avatar & Beam Rifle Rendering via Hemisphere Floor + Fresnel Rim + De-Metalling (`TASK-21c`)**
   - **What to build:** In [apps/web/src/avatar/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/avatar) and [apps/web/src/play/beam-tool.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts):
     1. Clamp `material.metalness = Math.min(material.metalness, 0.25)` on the Scientist suit and Beam Rifle whenever `scene.environment` is absent or `Lx < 0.5` (the exact same root cause fixed in `lod-bake.py` on 12 Oct in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §4 where metallic surfaces baked black without an environment map!).
     2. Attach a dedicated three-point rig to the player/viewmodel layer (`HemisphereLight(#8fa8c8, #3d352e, 0.65)` + view-aligned rim term `(1.0 - max(dot(N, V), 0.0))^2.5 * 0.55`) so the character and rifle read clearly in [13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg) and [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg) even in pitch-black Stage 0 craters.
   - **Needs:** **Code** (`apps/web/src/avatar/`, `apps/web/src/play/beam-tool.ts`).

2. **P0-LIGHT-02: Stabilize Stage 0 1-Bit Dither with Cylindrical World-Direction Projection & Depth Contours (`07-moon-stage0.jpg` Fix)**
   - **What to build:** In [packages/groundshader/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/groundshader) and [apps/web/src/crafter/world.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts):
     1. Replace raw screen-space `gl_FragCoord.xy` Bayer indexing in Stage 0 with a blended **world-anchored / camera-spherical UV projection** (`atan(viewDir.x, viewDir.z), asin(viewDir.y)` quantized to pixel grid, following Lucas Pope's [Obra Dinn method](https://dukope.com/devlogs/obra-dinn/tig-32/)) so the dither pattern stays glued to the lunar hills as the player looks around.
     2. Add a distance-attenuated luminance gradient and 1 px depth-discontinuity contour line so crater rims at `50 m`, `150 m`, and `500 m` separate into distinct perspective planes (`V1_1_ONBOARDING_PLAN.md` §1).
   - **Needs:** **Code** (`packages/groundshader/`).

3. **P0-LIGHT-03: Dramatize Lab Power-Off vs. Power-On Lighting (`02-lab-act1-wake.jpg` to `04-lab-power-on.jpg`)**
   - **What to build:** In [apps/web/src/lab/lab-scene.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts):
     - **Act I Cold State (`power = false`):** Drop global Lab ambient light to `0.08` cold blue-grey (`#1a2433`); light the room primarily with a pulsing red emergency strobe (`#ff2a1a`, `1.2 Hz`) over the Power Wall, the cyan storm glow leaking through the `14.8 m × 3.1 m` window (including the `POL-25` floor flash on static bursts), and the glowing red breaker handle.
     - **Act I Powered State (`power = true`):** Sequentially ignite 3 banks of overhead cold-white strip lights (`#eef4ff`, `intensity = 1.8` total) from back to front over `1.8 seconds`, turn on the warm amber (`#ffc13d`) Relay Cabinet beacons and Planet Table hologram, and kick in machine emissives (`#ff3d8a` Preset Bench, `#b46bff` Combiner, `#7cff4d` Fabricator) matching [02-gate-power-on.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png) and [04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png).
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`).

### P1 — Makes It Feel AAA

4. **P1-LIGHT-04: Radial Volumetric Scan-Wave on Every Stage & Machine Upgrade**
   - **What to build:** When a machine activates or `S` crosses a stage boundary, trigger an expanding spherical shell in [packages/groundshader/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/groundshader) (`radius = 0 -> 450 m` over `4.5 seconds`, ring thickness `6 m`, colored by the triggering metric `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff`). Inside `r < waveRadius`, render the new stage shader; outside `r > waveRadius`, keep the old stage shader; inside the `6 m` ring band, render a glowing wireframe tessellation grid so the player literally watches the higher-resolution reality sweep across rocks and craters.
   - **Needs:** **Code** (`packages/groundshader/`, `apps/web/src/crafter/looks.ts`).

5. **P1-LIGHT-05: Lock Stage 4 Low-Spec 60 FPS Governor (`POL-04` Resolution)**
   - **What to build:** On the `Low` graphics tier (targeting the GTX 950M laptop where Stage 4 currently measures `49.5–50 FPS` in [docs/DEFERRED\_POLISH\_REGISTRY.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/DEFERRED_POLISH_REGISTRY.md)), cap ground shader noise octaves at `2` beyond `80 m` distance, skip dynamic shadow map rendering on distant neighbor domes (`> 250 m`), and bake the Stage 4 sky cubemap once on transition—recovering the missing `~3.3 ms/frame` to lock `60 FPS` without sacrificing the golden-hour palette.
   - **Needs:** **Code** (`packages/groundshader/`, `apps/web/src/crafter/world.ts`).

### P2 — Stretch Goals

6. **P2-LIGHT-06: High/Ultra Plume Ground Glow & Floating Pixel Point Lights (`POL-02`, `POL-03`)**
   - **What to build:** Behind the `High` / `Ultra` graphics toggle (Rule 21), enable a single pooled `PointLight` (`distance = 14 m`, `decay = 2`) at the base of each active pixel plume (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`, `#b46bff`) so surrounding grass, wet rocks, and machine housings catch colored bounce light at dusk.
   - **Needs:** **Code** (`apps/web/src/crafter/world.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** Every lighting parameter is a pure deterministic function of `Lx`, `Pxd`, `Vtx`, and `Aq`.
- **Rule 20 (GTX 950M at 60 fps on Low) & Rule 21 (The toggle rule):** `P1-LIGHT-05` brings Stage 4 Low from `49.5 fps` to `60 fps` (`POL-04`), while `POL-02` and `POL-03` ship exclusively on `High`/`Ultra` behind the `Auto` graphics setting.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Stage 0 Dither Tint (Pure Black & White vs. Subtle Amber/Phosphor Warmth Near the Gate):**
   - *Question:* In [07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg), Stage 0 is stark black-and-white (`#000000` / `#ffffff`). Would you like Stage 0 to remain pure monochrome `#050608` / `#e8eef5` across the crater while casting a warm amber `#ffc13d` dither pool within `15 m` of the Twin Gate's glowing coils, so the Gate immediately reads as a warm safe haven?
   - *Recommendation:* **Yes—keep the Moon pure stark monochrome, with a 15 m amber coil glow around the Twin Gate.** It makes the contrast between your powered beachhead and the cold 1-bit wasteland unforgettable.


# 15 — Sound, Music & Acoustic Progression Plan: The Bit-Depth Mirror of Reality

## 1. The Goal: An Acoustic Landscape That Upgrades Its Resolution Alongside the Graphics

In **FIDELITY: The SetMix Multiverse**, sound has a once-in-a-generation creative hook: just as `S = (Pxd, Vtx, Lx, Aq)` upgrades the visual rendering pipeline from 1-bit dither to full PBR, **the audio engine upgrades the acoustic resolution of the world**. Right now ([docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5), music, Dr. Haddy's voiceover, and basic SFX exist in [apps/web/src/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio), [packages/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/audio), [packages/soundpack/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack), [packages/soundscape/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape), and [packages/musicbox/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/musicbox), but there is **no master mix plan, no stage-linked ambience layering, and no cohesive audio feedback language**. Our goal is to make every click, beam pulse, machine hum, and stage bloom sound unmistakably tactile while adding zero megabytes to the single-file `index.html` budget (`POL-27`) via procedural Web Audio synthesis.

## 2. Where It Stands Today

- **What Exists:**
  - [apps/web/src/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio) plays Dr. Haddy's voiced narration (`public/vo/`) through a band-pass radio filter (`1c081bc0` audio fixes logged in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)).
  - Pure Web Audio synthesis packages: [packages/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/audio), [packages/soundpack/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack), [packages/soundscape/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape), [packages/soundlab/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundlab), and [packages/musicbox/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/musicbox), plus authentic 8-bit PCM lump decoding (`DSSHOTGN`, monster barks) in [packages/shareware/src/wad.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/shareware/src/wad.ts).
- **What Is Weak or Missing:**
  - **No Master Bus Architecture or Ducking:** When Dr. Haddy speaks over a running Texture Mill, Extraction Beam, and music track, frequencies collide in the `400 Hz–2.5 kHz` midrange because there is no sidechain ducking bus.
  - **Silence Between Actions on the Moon:** Stepping through the Gate onto the Moon lacks a continuous stage-reactive environmental bed (suit respirator + low-frequency lunar rumble in Stage 0 $	o$ wind and water in Stage 3–4).
  - **Silent or Flat Machine & UI Interactions:** Placing foundations, snapping cables, slotting cartridges, and dry-firing the Extraction Beam lack distinct mechanical transient layers.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Audio & Mix Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | **Diegetic Suit/Habitat Threshold Filtering & Musical Stingers:** Crossing an airlock immediately shifts the acoustic space from muffled underwater hydrophone + suit breathing to crisp indoor room reverb, and every major biome/depth milestone fires a deep synthesizer stinger ([Subnautica Steam](https://store.steampowered.com/app/264710/Subnautica/)). | Stepping through the freestanding Gate between the Earth Lab and the Moon should immediately swap the acoustic impulse response (warm reflective concrete room $\leftrightarrow$ airless low-bit lunar suit feed). |
| [Factorio](https://store.steampowered.com/app/427520/Factorio/) | **Distance-Attenuated Machine Loops & Alert Priority:** Each machine class has a signature rhythmic loop that only plays within a strict camera proximity radius (`< 25 m`) with max-instance voice stealing so 20 machines never turn into white noise ([Factorio Store](https://store.steampowered.com/app/427520/Factorio/)). | Essential for our field machines: cap active 3D positional machine loops to the 4 nearest machines and blend distant machines into a warm harmonic drone. |
| [Outer Wilds](https://store.steampowered.com/app/753640/Outer_Wilds/) | **Signalscope Positional Audio Layers:** Every anomaly, beacon, and planet has a distinct harmonic signature that grows clearer as you aim toward it ([Outer Wilds Store](https://store.steampowered.com/app/753640/Outer_Wilds/)). | Reality Leaks (`@hm/leaksim`) and the Twin Gate should emit distinct spatialized harmonic signatures so players can locate leaks and their portal by ear even in Stage 0. |
| [Prodeus](https://store.steampowered.com/app/964800/Prodeus/) | **Hybrid Retro PCM + Modern Sub-Bass Layering:** Classic 8-bit `11 kHz` shareware sound effects (`DSSHOTGN`) sound thin on modern speakers unless paired with a clean procedural `55–80 Hz` sub-bass transient punch ([Prodeus Store](https://store.steampowered.com/app/964800/Prodeus/)). | Keeps `@hm/shareware` weapons and monster audio authentic to their retro roots while giving them AAA physical weight. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Master Web Audio Bus & Ducking Architecture

| Bus Channel | Default Gain | Ducking Behavior When `VO_Bus` (Dr. Haddy) Is Active | High/Low Pass & Stage Processing |
| :--- | :--- | :--- | :--- |
| **`Master_Bus`** | `0.0 dBFS` | Limiter ceiling at `-1.0 dBFS` (`DynamicsCompressorNode`, ratio `12:1`, attack `3 ms`) to prevent Web Audio clipping. | Global user volume slider (`0–100%`). |
| **`VO_Bus` (Dr. Haddy)** | `-2.0 dBFS` | Primary sidechain trigger (`attack = 80 ms`, `release = 450 ms`). | Band-pass `320 Hz–3.4 kHz` + subtle asymmetric waveshaper warmth + `60 ms` PTT squelch click at start/end. |
| **`Combat_UI_Bus`** | `-4.0 dBFS` | Ducks by `-2.0 dB` during VO. | Always full-bandwidth (`48 kHz`) so UI clicks, warnings, and weapon impacts stay crisp at every stage. |
| **`World_SFX_Bus`** | `-6.0 dBFS` | Ducks by `-6.5 dB` + low-pass cut at `1.8 kHz` during VO so machines never mask speech. | **Bit-Depth Mirror Node (`AudioWorklet` / `WaveShaper`):** Stage 0 = `8 kHz` 4-bit crush; Stage 1 = `11 kHz` 8-bit; Stage 2 = `22 kHz` 12-bit; Stage 3–4 = `48 kHz` full stereo + convolution reverb. |
| **`Ambience_Bus`** | `-12.0 dBFS` | Ducks by `-5.0 dB` during VO. | Crossfades 5 procedural stems tied directly to `(Pxd, Vtx, Lx, Aq)`. |
| **`Music_Bus` (`@hm/musicbox`)** | `-11.0 dBFS` | Ducks by `-8.0 dB` during VO; fades out during active leak combat (`@hm/leaksim` chase/attack) in favor of tension pulse. | Stage 0 = sparse monophonic square-wave arpeggio; Stage 2 = 4-op FM synth pad; Stage 4 = lush polyphonic ambient chords. |

### P0 — Must Fix Before First Public Test

1. **P0-SOUND-01: Implement the 5-Bus Web Audio Mixer with Automatic VO Sidechain Ducking (`apps/web/src/audio/`)**
   - **What to build:** Route all audio sources in [apps/web/src/audio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio) through the 5-bus graph above (`VO_Bus`, `Combat_UI_Bus`, `World_SFX_Bus`, `Ambience_Bus`, `Music_Bus`). Whenever a Dr. Haddy voice file (`public/vo/`) plays, automatically ramp `World_SFX_Bus.gain` by `-6.5 dB` and `Music_Bus.gain` by `-8.0 dB` over `80 ms`, restoring `450 ms` after the line finishes.
   - **Needs:** **Code** (`apps/web/src/audio/`, `packages/audio/`).

2. **P0-SOUND-02: Build the Tactile Action Feedback Vocabulary (12 Procedural Synth SFX in `@hm/soundpack`)**
   - **What to build:** Ensure every core player verb has a 3-layer procedural sound (`transient click + tonal body + mechanical tail`) in [packages/soundpack/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundpack):
     1. **Breaker Throw (Act I):** Heavy steel clunk (`90 Hz` impulse) + rising capacitor sine sweep (`60 Hz -> 420 Hz` over `1.8 s`) + overhead relay latch clicks.
     2. **Gate Ignition (Act II):** 8 stepped transformer thrums (`+2 semitones` per coil block) + electrostatic aperture tear + deep `45 Hz` sub-hum loop within `8 m` of the doorway.
     3. **Beam Rifle Dry Fire:** Hollow mechanical solenoid clack + low buzz (`"brrt"` per [docs/V1\_1\_ONBOARDING\_PLAN.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)).
     4. **Beam Extract (Dirt/Ore):** Continuous harmonic carrier beam (`220 Hz + FM wobble`) + granular crystalline crackle as chunks detach + rising pitch chime on each inventory pickup (`+1 semitone` per consecutive chunk, resetting after `1.2 s`).
     5. **Beam Apply / Sculpt / Seal:** Distinct carrier chord per mode (`#ff3d8a` Apply = warm major 3rd spray; `#7cff4d` Sculpt = low resonant filter sweep; `#ffc13d` Seal = high phase-locked harmonic lock).
     6. **Cartridge Slot / Eject:** Cassette plastic snap + brass contact ping + metric-chord arpeggio.
     7. **Foundation & Machine Placement:** Hologram lock beep + pneumatic hydraulic thud (`65 Hz`) + bolt ratchet whir.
   - **Needs:** **Code** (`packages/soundpack/`, `apps/web/src/play/`).

### P1 — Makes It Feel AAA

3. **P1-SOUND-03: Stage-Linked Acoustic Resolution & Ambience Layering (`@hm/soundscape`)**
   - **What to build:** Wire the `S = (Pxd, Vtx, Lx, Aq)` floats directly into [packages/soundscape/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/soundscape):
     - **Lab Interior:** Constant `50 Hz` electrical hum, quiet ventilation air, and distant muffled thunder from the Window Breach.
     - **Moon Stage 0–1:** Muffled helmet-interior respirator breath + dry sample-crushed footstep crunches on regolith + eerie low-bit solar wind whistle.
     - **Moon Stage 2 (`Lx >= 0.35`):** Helmet filter opens to external atmosphere; crisp gravel/rock footsteps; atmospheric wind sweep across crater rims.
     - **Moon Stage 3 (`Aq >= 0.40`):** Gentle water lapping near hydro basins (`@hm/hydro`) and wet footstep splashes along shorelines.
     - **Moon Stage 4 (`Lx >= 0.85`, `Aq >= 0.75`):** Rustling conifer needles/grass in wind, distant alien bird/strider calls (`@hm/fauna`), and warm stereo reverb.
   - **Needs:** **Code** (`packages/soundscape/`, `apps/web/src/crafter/world.ts`).

4. **P1-SOUND-04: Machine Signature Loops with 4-Voice Proximity Culling**
   - **What to build:** Give each field machine on [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) a distinct procedural loop (`Rock Drill` = rhythmic percussive thumper; `Texture Mill` = granular pink-noise grinder + sparkling pixel chime; `Shape Press` = hydraulic cyclic stamp every `2.5 s`; `Light Projector` = warm arc-lamp hum; `Water Maker` = condenser bubble & hiss). Cull active `PannerNode` instances to the 4 closest machines within `30 m`.
   - **Needs:** **Code** (`packages/soundpack/`, `apps/web/src/base/`).

5. **P1-SOUND-05: Sub-Bass Reinforcement Layer for `@hm/shareware` 8-Bit Combat Audio**
   - **What to build:** Whenever `@hm/shareware` plays an 8-bit `11 kHz` WAD lump (`DSSHOTGN`, monster pain/attack barks), trigger a synchronous procedural Web Audio sub-punch (`60 Hz -> 32 Hz` exponential sine drop over `110 ms` + stereo cabinet slapback) so retro shareware weapons feel punchy without altering the legal WAD lump data.
   - **Needs:** **Code** (`packages/shareware/`, `packages/audio/`).

### P2 — Stretch Goals

6. **P2-SOUND-06: Generative Stage-Transition Harmonic Swell (`@hm/musicbox`)**
   - **What to build:** When the radial stage-upgrade wave (`P1-LIGHT-04`) sweeps across the plot, trigger a 6-second Shepard-tone / lush pad crescendo in `@hm/musicbox` synchronized to the wave radius passing the player's position.
   - **Needs:** **Code** (`packages/musicbox/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** Acoustic resolution and environmental stems derive strictly from `(Pxd, Vtx, Lx, Aq)`.
- **Rule 3 (Single-file distribution, `POL-27` 18 MB watch):** 100% of the new SFX, machine loops, and stage ambiences are procedural Web Audio graphs (`< 15 KB` of TypeScript code), adding **zero MB** of audio bloat to `dist/index.html`.
- **Rule 18 (Legal assets only):** Shareware PCM audio comes exclusively from BSD-licensed *Freedoom* / *Blasphemer* / *LibreQuake* lumps or local user files.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Stage 0 Audio Bit-Crush Intensity:**
   - *Question:* When the player first steps onto the Stage 0 Moon, should external world sounds (footsteps, boulders, machine hums) have an audible retro `8 kHz` sample-rate crunch that clears up smoothly as `Pxd` and `Lx` rise to Stage 2, while keeping Dr. Haddy's voice and HUD clicks crisp?
   - *Recommendation:* **Yes—apply the sample-rate reducer only to `World_SFX_Bus` in Stage 0 (`8 kHz` $	o$ `48 kHz` by Stage 2)** and never to `VO_Bus` or `Combat_UI_Bus`. It sells the "low-resolution reality" fantasy within half a second of stepping through the Gate without ever making voiceover hard to understand.


# 16 — UI, UX & HUD Architecture Plan: Zero-Overlap Telemetry and Non-Blocking Craftsmanship

## 1. The Goal: A Diegetic-First Telemetry HUD Where Two Text Elements Never Collide

Look at [07-moon-stage0.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg) and [09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg) in [docs/argo/TOUR.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): right now, the UI is the single most visible source of prototype friction. On Moon arrival, **three separate text layers overlap in the center of the screen** (the big location title, the `"CANNOT PLACE"` build readout, and Dr. Haddy's radio subtitle). When pressing `B` to build ([09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg)), a giant dark modal covers the entire center viewport so you cannot see the foundation ghost you are trying to place. And the Main Menu ([01-main-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg)) is a plain vertical list of text over a dark background.

Our goal is to enforce a **strict 9-zone spatial HUD grid with priority queuing** in [apps/web/src/shell/hud.tsx](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx), convert the Build Menu into a **compact bottom-docked ribbon (`< 22%` screen height)** so the center 78% of the 3D world remains unobstructed during placement, and turn the Main Menu into the live 3D Lab + glitching window showcase promised in [04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png) and `POL-01`.

## 2. Where It Stands Today

- **What Exists:**
  - [docs/UI\_DESIGN\_SYSTEM\_AND\_TOKENS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/UI_DESIGN_SYSTEM_AND_TOKENS.md), [packages/ui/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/ui), [packages/uistack/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/uistack), [packages/hudlayout/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/hudlayout), and [apps/web/src/shell/hud.tsx](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx) establish the Oxanium/Inter typography, glassmorphic dark panels, and glowing metric tokens (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`, `#b46bff`).
  - [docs/HOTBAR\_V3\_SPEC.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/HOTBAR_V3_SPEC.md) defines the 10-slot hotbar and `F1–F10` mode tabs.
- **What Is Weak or Missing:**
  - **Center-Screen Collision (`07-moon-stage0.jpg`):** Location banners, build-ghost status labels, and subtitles all anchor near `top: 50%–75%` without a shared layout manager (`@hm/hudlayout` is not enforcing mutual exclusion across React overlays).
  - **Viewport-Blocking Build Menu (`09-build-menu.jpg`):** Opening `B` spawns a large centered modal over the crosshair.
  - **Cluttered 3D World Labels (`08-first-machine.jpg`):** Floating 3D text tags over placed machines render at full opacity regardless of distance or camera aim, cluttering the horizon.
  - **Flat Main Menu (`01-main-menu.jpg`):** Missing the live 3D Lab backdrop, the desolate glitching window vista (`POL-01`), and the active plot portal preview ([04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png)).
  - **Generic Inventory (`11-inventory.jpg`):** Works functionally, but lacks a visual 3D/silhouette Scientist rig preview showing suit visor tint, slotted cartridges, and linked `@hm/lattice` depot totals.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | UI / UX Architecture | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Dead Space](https://deadspace.fandom.com/wiki/Resource_Integration_Gear) | **Diegetic Rig & Weapon Displays + Uncluttered Center Reticle:** Health, energy, and ammo live on the character's suit spine and weapon rear housing (`RIG`), keeping the center 60% of the screen completely clear of floating text ([Dead Space UI Analysis](https://medium.com/@lorenzoardeni/dead-space-the-ui-art-that-disappears-in-the-game-world-289718133c29)). | Move Beam Tool mode (`Extract / Apply / Sculpt / Seal`) and charge readout onto a crisp diegetic OLED strip on the rear of the rifle viewmodel + a minimal 4-dot reticle arc, eliminating redundant center-screen text. |
| [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Compact Build Drawer + Hologram Lock (`H`) + Nudge (`Arrow Keys`) + Linked Depot Bar:** Pressing `B` opens a quick-select bar/drawer that immediately closes on selection; while aiming a build ghost, a small bottom-right keybind pill shows `H: Lock Hologram`, `R: Rotate`, and pulls materials from both pockets and the [Dimensional Depot](https://www.youtube.com/watch?v=oPsb7OFp1gg). | Directly solves [09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg): selecting a piece or pressing `B` must keep the center viewport 100% open so the player can see the 3D hologram snap onto sockets. |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) & [***The Planet Crafter***](https:// planet-crafter.fandom.com/wiki/Terraformation_Index) | **Corner-Pinned Terraformation Telemetry & Raycast-Only World Labels:** Global metrics (`Ti` / `Fi`) sit cleanly in the top-right corner; machine status readouts in the 3D world only appear when the player's crosshair raycasts within `6°` of the machine within `12 m`. | Eliminates the floating text soup in [08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg). |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical 9-Zone Non-Overlapping HUD Grid (`apps/web/src/shell/hud.tsx`)

| Screen Zone | Reserved Coordinates | Assigned Widget (Strict Single-Owner Rule) | Collision / Queue Rule |
| :--- | :--- | :--- | :--- |
| **Top-Left** | `top: 24px, left: 24px` (`max-width: 340px`) | **Dr. Haddy Radio Portrait & Active Quest Step** (`1–2` plain sentences + key hint pill). | Portrait slides in only during active VO or quest step update. |
| **Top-Center** | `top: 20px, center` (`height: 44px`) | **Compass Ribbon & Coherence Safe-Dome Indicator** (shows Gate beacon bearing, Leak bearings, and `SYNC: STABLE / DRAINING`). | Act/Stage Milestone Title Cards (`STAGE 1 REACHED`) drop down at `top: 72px` for `3.0 s` and **suppress** any secondary banner while visible. |
| **Top-Right** | `top: 24px, right: 24px` (`width: 240px`) | **The 4-Float Fidelity Telemetry Pill (`S = Pxd, Vtx, Lx, Aq`)** + Current Stage Badge (`S0`–`S4`) + Profile Chip (on Menu). | Compact 4-bar sparkline using canonical colors (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`). |
| **Center Crosshair** | `50% x, 50% y` (`radius: 48px` clear zone) | **Minimal Reticle + Contextual Raycast Prompt (`[E] Salvage Monitor` / `CANNOT PLACE: Needs Flat Ground`)**. | **Hard Rule:** `"CANNOT PLACE"` only renders when `buildGhostActive === true`, positioned `36px` below the reticle—never overlapping bottom subtitles. |
| **Bottom-Center (Upper)** | `bottom: 108px, center` (`max-width: 680px`) | **Radio Subtitle Banner** (single dark-glass pill with `2px` left amber border). | Never rises above `bottom: 160px`, guaranteeing at least `180px` vertical clearance from the center crosshair. |
| **Bottom-Center (Lower)** | `bottom: 20px, center` | **10-Slot Hotbar (`1–0`) + Build Ribbon Drawer (`B`)** (`docs/HOTBAR_V3_SPEC.md`). | When `B` is pressed, a sleek horizontal category dock (`Machines | Structures | Heavy | Plans`) rises `88px` above the hotbar (`bottom: 92px`), leaving the top 78% of the screen completely clear! |
| **Bottom-Left** | `bottom: 24px, left: 24px` | **Suit Coherence Gauge & Stamina/Jet Bar** (or **Rover Speed/Drift Telemetry** when driving). | Hides automatically at 100% Coherence inside the Lab or Gate Safe Dome to keep the screen clean. |
| **Bottom-Right** | `bottom: 24px, right: 24px` | **Active Tool / Cartridge Readout + Linked Lattice Resource Ticker** (`Dirt | Ore | Power kW`). | Shows both Pocket count and `+Linked Bin` count (`Ore: 24 (+140)`). |

### P0 — Must Fix Before First Public Test

1. **P0-UI-01: Enforce the 9-Zone HUD Layout & Eliminate the 3-Way Overlap in `07-moon-stage0.jpg`**
   - **What to build:** Refactor [apps/web/src/shell/hud.tsx](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx) and wire [packages/hudlayout/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/hudlayout) so every overlay mounts into its dedicated grid slot above. Specifically:
     - Gate `"CANNOT PLACE"` strictly on `isPlacingStructure && !canPlace`.
     - Pin Radio Subtitles to `bottom: 108px` (`z-index: 20`).
     - Queue Act/Location Title Cards (`top: 72px`) so they fade out (`2.5 s`) before non-critical tutorial hints appear.
   - **Needs:** **Code** (`apps/web/src/shell/hud.tsx`, `packages/hudlayout/`).

2. **P0-UI-02: Convert the Build Menu (`B`) from a Center-Screen Blocker into a Bottom-Docked Ribbon (`09-build-menu.jpg` Fix)**
   - **What to build:** Replace the full-screen modal in [09-build-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg) with a bottom-docked glassmorphic drawer (`bottom: 92px`, `height: 136px`, `max-width: 820px`) displaying crisp 3D/icon cards for `Machines`, `Structures`, `Heavy`, and `Plans`, plus a live keybind strip (`[R] Rotate 45°`, `[H] Lock Ghost & Nudge`, `[F] Demolish 100% Refund`, `[RMB/Esc] Cancel`). Clicking a card immediately collapses the drawer to a minimal header pill so the player has an unobstructed view of the 3D placement ghost.
   - **Needs:** **Code** (`apps/web/src/base/`, `apps/web/src/shell/hud.tsx`).

3. **P0-UI-03: Cull Floating 3D Machine Labels to Crosshair Raycast + Proximity (`08-first-machine.jpg` Fix)**
   - **What to build:** In [apps/web/src/crafter/world.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts) and [apps/web/src/base/view.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/base/view.ts), hide all floating 3D machine text billboards unless the player is within `14 m` **and** aiming within `8°` of the machine (or holding `Alt` for `"Tactical Telemetry View"`). When not aimed at, a machine's state is communicated purely by its physical LED (`Green = Running`, `Amber Blink = Brownout/No Ore`, `Red = Unpowered`) and its pixel plume!
   - **Needs:** **Code** (`apps/web/src/base/view.ts`, `apps/web/src/crafter/world.ts`).

### P1 — Makes It Feel AAA

4. **P1-UI-04: Upgrade the Main Menu to the Live 3D Lab + Glitching Window & Active Gate Backdrop (`01-main-menu.jpg` & `POL-01`)**
   - **What to build:** Replace the dark static menu backdrop in [01-main-menu.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg) with the live camera composition from [04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png):
     - Left third: Sleek angled glassmorphic menu blade (`Expedition`, `Planetary Grid`, `The Studio`, `The Workshop`, `Community Nexus`, `Settings`) with clean engineering copy (replace `"Growing the trees"` during preload with real subsystem stages: `"Compiling S-Space Shaders..."`, `"Syncing Lunar Lattice..."`, `"Calibrating Bridge Array..."` per Rule 22).
     - Center-Left Window: Shows the desolate 3D Bridge Array wasteland actively glitching (`POL-01`).
     - Right Third Freestanding Gate: Renders a live stencil preview of the active profile's plot (or a hero Stage 4 preview if hovering over `Planetary Grid`).
   - **Needs:** **Code** (`apps/web/src/shell/`, `apps/web/src/lab/lab-scene.ts`).

5. **P1-UI-05: Upgrade the Inventory & Suit Rig Screen (`11-inventory.jpg`) with Visor Customizer & Linked Depot View**
   - **What to build:** In [11-inventory.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/11-inventory.jpg), add a live interactive 3D preview of the Scientist hazmat avatar in the left pane (with the owner-approved **Name + Visor Color Picker** and `.glb`/`.vrm` custom avatar dropzone from `OWNER_ASKS.md` 2026-10-07), a dedicated **Cartridge Bandolier** section in the middle pane (color-coded by `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff` / `#b46bff`), and a **Linked Lattice Depot (`@hm/lattice`)** summary on the right.
   - **Needs:** **Code** (`apps/web/src/shell/`, `apps/web/src/avatar/`).

### P2 — Stretch Goals

6. **P2-UI-06: Hologram Lock (`H`) & Arrow-Key Nudge Mode During Base Building**
   - **What to build:** Adopting the most praised UX feature from [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) (`docs/BASE_BUILDING_RESEARCH.md` `R5`), pressing `H` while aiming a foundation or machine ghost freezes the hologram in world space so the player can walk around it to inspect socket alignment and use the arrow keys to nudge it by `0.5 m` steps before left-clicking to commit.
   - **Needs:** **Code** (`packages/structure/`, `apps/web/src/base/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 22 (Loading bars):** Preload screen uses real subsystem progress bars with clean technical telemetry copy.
- **Rule 24 (UI quality):** Strictly uses the Oxanium/Inter glassmorphic telemetry design system from [docs/UI\_DESIGN\_SYSTEM\_AND\_TOKENS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/UI_DESIGN_SYSTEM_AND_TOKENS.md), with zero bare DOM and clean screenshot mode toggle (`F12` / automated test flag hides pointer-lock overlays).

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Main Menu Gate Preview (`04-menu-setmix.png` vs. `POL-01`):**
   - *Question:* On the Main Menu ([04-menu-setmix.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png)), the left window shows the desolate glitching Bridge wasteland (`POL-01`). For the freestanding Gate on the right side of the Main Menu, should it show **the player's current save plot stage** (e.g., off/dark if they haven't started Act I yet, Stage 1 if their save is at Stage 1, Stage 4 if they reached Stage 4), or should the Main Menu Gate always preview a **lush Stage 4 hero vista** to inspire new players?
   - *Recommendation:* Show the **lush Stage 4 hero vista on the Main Menu** (exactly as you specified on 2026-10-06 18:40 in [docs/OWNER\_ASKS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/OWNER_ASKS.md): *"a gateway on the right showing the planet in all its glory after terraforming"*), and then when they click **Play / New Expedition**, they wake in the dark power-starved Lab with the Gate off!


# 17 — VFX, Particles & Game Feel ("Juice") Plan: Making Every Interaction Tactile

## 1. The Goal: Turn Functional State Changes into Visceral Physical Actions

As highlighted in [docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, **placing, mining, printing, and killing currently lack the feedback (VFX, camera response, animations, shader pulses) that makes them fun**. We already have [packages/particles/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/particles), [packages/plume/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume), [packages/juice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/juice), and [packages/tooljuice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice) in the monorepo! Our goal is to wire those pure packages directly into the 6 core player interactions so every action has an **Anticipation $	o$ Impact $	o$ Aftermath** arc that runs within a strict instanced GPU particle budget on the GTX 950M.

## 2. Where It Stands Today

- **What Exists:**
  - [packages/plume/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume) renders the rising square pixel plumes above running field machines ([08-first-machine.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg)).
  - [packages/beamkit/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/beamkit), [packages/juice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/juice), [packages/tooljuice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice), and [packages/particles/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/particles) provide pure math for recoil springs, screen shake trauma, and particle emitters.
  - `TASK-23c` adds a dissolve effect when holding `E` on lab clutter props.
- **What Is Weak or Missing:**
  - **Juice Packages Are Under-Wired in `apps/web/src/play/`:** Mining dirt or boulders, placing foundations/machines, fabricating cartridges, and shooting monsters happen with minimal viewmodel recoil, no impact debris fountains, and no wireframe-to-solid materialization sweep.
  - **In vs. Out Plume Rule Needs Strict Enforcement:** Per [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) and [docs/concept/setmix/README.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/README.md), raw dark material must visibly drop into the **feed hopper**, while crisp square pixels (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`, `#b46bff`) pour exclusively out of the **separate rear/top exhaust stack**.
  - **Flat Gate Crossing:** Walking through the Gate between the Earth Lab and the Moon has no threshold screen-edge shimmer or gravity-shift camera dip (`9.81 m/s²` $	o$ `1.62 m/s²`).

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Game Feel / VFX Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) & [Satisfactory 1.0](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Bottom-Up Wireframe Print Sweep + Mass Settle Bounce:** When a structure or machine is placed, a bright emissive scan-plane sweeps from base to roof over `0.6–1.2 s`, followed by a `4 cm` vertical spring settle and dust ring at the feet ([Subnautica Habitat Builder](https://store.steampowered.com/app/264710/Subnautica/)). | Makes placing a `Texture Mill` or `Foundation` feel like materializing heavy industrial hardware rather than toggling `mesh.visible = true`. |
| [Astroneer](https://astroneer.fandom.com/wiki/Terrain_Tool) & [Deep Rock Galactic](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) | **Spiral Vacuum Stream Along the Mining Beam:** When excavating terrain, detached voxel chunks spiral along a Bezier curve directly from the impact crater into the tool barrel while the nozzle vibrates with micro-trauma ([Astroneer Terrain Tool Wiki](https://astroneer.fandom.com/wiki/Terrain_Tool)). | Visually connects terrain deformation (`@hm/terrainbrush`) to the player's inventory counter ticking up. |
| [Prodeus](https://store.steampowered.com/app/964800/Prodeus/) | **Pixel-Cube Hit Bursts & Muzzle Flash Lighting:** Hitting a retro enemy erupts a burst of stage-quantized voxel cubes that bounce once on the ground and dissolve, paired with a `40 ms` hit-flash and punchy viewmodel kickback ([Prodeus Store](https://store.steampowered.com/app/964800/Prodeus/)). | Unifies 2D sprites and 3D monster meshes in `TASK-23b` so every shot feels meaty and consistent with the simulation lore. |

## 4. Concrete Changes Ranked P0, P1, and P2

### The 6 Core Interaction Juice Recipes (`@hm/juice` + `@hm/tooljuice` + `@hm/particles`)

| Player Action | Anticipation (0–150 ms) | Impact / Active Loop | Aftermath (150–800 ms) |
| :--- | :--- | :--- | :--- |
| **1. Beam Extract (Mining Dirt / Boulders)** | Barrel coils spin up (`#ff3d8a`/`#3dc8ff`), viewmodel pulls back `1.5 cm`. | Laser core + helical ring shader (`@hm/beamkit`); dark voxel chunks spiral from ground crater into rifle muzzle (`12 chunks/sec`); `0.08` micro-shake trauma. | Glowing hot decal at beam contact point cools over `0.6 s`; inventory counter pops `1.25x` scale on each `+1` tick. |
| **2. Beam Apply / Sculpt (Painting & Shaping)** | Mode LED on rifle spine flashes (`#ff3d8a` Apply / `#7cff4d` Sculpt). | Projected ground ring decal shows exact brush radius (`@hm/terrainbrush`) with marching grid lines; square pixels spray onto vertices as height/texture updates live. | Subtle dust/pixel settle puff along modified vertices. |
| **3. Placing a Structure or Machine** | Hologram ghost pulses between `0.35` and `0.55` alpha; snapping to a socket triggers a crisp `1.04x` scale snap-lock. | Bottom-to-top `#7cff4d` wireframe print plane sweeps across the mesh over `0.65 s` while 16 green square pixels rise from the corners. | Mesh drops `4 cm` with damped spring bounce (`@hm/juice`) and emits a radial regolith dust puff around its feet/plinth. |
| **4. Machine Feeding & Plume Exhaust** | Dark ore chunks tumble into the top/side feed hopper (`#1a1c20`, inert). | Internal status window glows; separate rear/top exhaust stack emits instanced square pixels (`@hm/plume`, `64–128` cubes/machine) drifting upward with curl-noise turbulence. | If a cartridge is slotted, an immediate ring burst of the cartridge's color shoots `8 m` up the plume stack. |
| **5. Salvaging Clutter / Sealing a Leak (`Hold E` / `Seal`)** | Radial progress ring fills around crosshair (`0.8 s`); target prop vibrates with increasing scanline slice offset. | Prop de-compiles top-down into 32 glowing voxel cubes that arc into the player's hip pack (`TASK-23c`). | Leaves a brief faded wireframe ghost silhouette on the floor for `0.4 s`. |
| **6. Firing Combat Weapons & Hitting Monsters** | Crisp `1-frame` muzzle flash + `8°` pitch recoil spring (`@hm/tooljuice`). | Hit target flashes pure white/amber for `45 ms`, plays `@hm/leaksim` `pain` flinch, and bursts 12 stage-quantized pixel cubes at the hit normal. | On `dead` phase, monster either collapses via `@hm/ragdoll` or shatters into a fountain of `Anomaly Core` shards that hover with a vertical loot beam. |

### P0 — Must Fix Before First Public Test

1. **P0-VFX-01: Wire `@hm/tooljuice` Recoil, Muzzle Stream, and Brush Ring Decal to the Beam Tool (`TASK-21c/d`)**
   - **What to build:** In [apps/web/src/play/beam-tool.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts) and [apps/web/src/play/beam-effect.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-effect.ts):
     - Render a projected ground ring decal at the raycast hit point showing the exact `Extract / Apply / Sculpt / Seal` brush radius, colored by active mode (`#3dc8ff`, `#ff3d8a`, `#7cff4d`, `#ffc13d`).
     - Spawn an instanced stream of 16 voxel chunks spiraling from the hit point into the rifle barrel during `Extract`, and drive the first-person rifle transform with the damped harmonic oscillator in [packages/tooljuice/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice) (sway on mouse look, bob on walk, vibration when firing).
   - **Needs:** **Code** (`apps/web/src/play/beam-tool.ts`, `apps/web/src/play/beam-effect.ts`).

2. **P0-VFX-02: Add Bottom-Up Wireframe Print Sweep & Settle Bounce to All Placed Buildings and Machines**
   - **What to build:** In [apps/web/src/base/view.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/base/view.ts), when a foundation, wall, or machine is placed, run a `0.65 s` vertex/fragment clip-plane sweep (`y_local` from `bbox.min.y` to `bbox.max.y`) with a bright `#7cff4d` leading edge and a damped vertical settle spring (`amplitude = 0.04 m`, `stiffness = 280`, `damping = 18`).
   - **Needs:** **Code** (`apps/web/src/base/view.ts`, `packages/juice/`).

### P1 — Makes It Feel AAA

3. **P1-VFX-03: Strictly Separate Inert Hopper Feed from Neon Exhaust Plume Sockets on All Field Machines (`12-sheet-field-machines.png`)**
   - **What to build:** Audit every machine socket in [apps/web/src/crafter/world.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts) and [packages/plume/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume) against [12-sheet-field-machines.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png):
     - Define two distinct local transform sockets per machine: `feedHopperPos` (front/top tray where dark grey ore cubes drop downward) and `exhaustVentPos` (rear/top stack where bright `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff` / `#b46bff` square pixels drift upward).
     - When a machine is unpowered or out of ore, set plume emission rate to `0` immediately (Rule 10: *"A machine that is off spews nothing"*).
   - **Needs:** **Code** (`apps/web/src/crafter/world.ts`, `packages/plume/`).

4. **P1-VFX-04: Portal Threshold Shimmer & Gravity Transition Dip**
   - **What to build:** When the player's camera crosses the plane of the freestanding Gate (`Lab <-> Moon`), trigger a `250 ms` chromatic/dither edge vignette, a subtle vertical camera spring dip reflecting the `6x` gravity change (`9.81 m/s²` $\leftrightarrow$ `1.62 m/s²`), and a burst of 24 amber coil sparks around the doorframe reveal.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/juice/`).

### P2 — Stretch Goals

5. **P2-VFX-05: Stage-Reactive Footstep & Rover Tire Roost Particles**
   - **What to build:** Emit pooled instanced particles behind the player's boots and the Rover's rear tires (`@hm/kart`) that adapt to the local stage: 1-bit white/black square pixels in Stage 0, grey regolith dust puffs in Stage 1–2, water splashes (`#3dc8ff`) when driving through Stage 3 hydro puddles, and green grass/soil flecks in Stage 4 meadows.
   - **Needs:** **Code** (`packages/particles/`, `apps/web/src/crafter/world.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 10 (Believable machines, running machines spew colourful pixel plumes, off spews nothing):** Enforces separate `feedHopperPos` and `exhaustVentPos` sockets and zero emission when off.
- **Rule 20 (GTX 950M at 60 fps on Low):** All particle systems use a single pre-allocated `THREE.InstancedMesh` pool (`max = 2,048` instances globally on Low, `8,192` on High/Ultra) with zero per-frame garbage collection.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Screen-Shake Intensity Default:**
   - *Question:* When firing the Shotgun, mining boulders with the Beam Tool, or standing near the Gate when it ignites, should camera micro-shake trauma default to **Subtle (`35%` amplitude)** with a `0%–100%` slider in Settings for motion-sensitive players?
   - *Recommendation:* **Yes—default camera shake to Subtle (`35%`) with a `Camera Shake` slider in Settings.** Viewmodel spring recoil (`@hm/tooljuice`) carries 80% of the punch without ever making the horizon jittery.


# 18 — Monsters, Containment Leaks & Combat Plan: Unifying Retro Eras Inside S-Space

## 1. The Goal: Turn 38 Imported Retro Monsters into Cohesive, Telegraphed "Simulation Leaks"

Look at [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg) and [18-monsters-batch3.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) in [docs/argo/TOUR.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): we have a pure, deterministic combat brain in [packages/leaksim/src/index.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts) (6 archetypes, telegraphed windups, safe zones, leak sealing) and 38 legal BSD/CC0 monsters from *Freedoom*, *Blasphemer*, *LibreQuake*, and *Quaternius* ready to wire into the world in `TASK-23b` ([docs/prompts/sidecar/23-monsters.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/23-monsters.md)).

However, Opus rightly flagged the central creative challenge in [docs/argo/TOUR.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): **placing gory 2D Doom-era sprites next to cute low-poly Quaternius 3D models and early-3D Quake meshes creates a jarring visual clash unless unified by art direction**. Our goal is to resolve that clash through an **S-Space Containment Leak Shader** and strict archetype-to-era mapping so every monster looks like a **corrupted digital entity leaking out of a ruptured simulation archive**, while honoring Rule 14 (no "Monster Mash" branding) and Rule 23 (monsters never destroy built structures, and peaceful players can earn every drop without fighting).

## 2. Where It Stands Today

- **What Exists:**
  - [packages/leaksim/src/index.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts) defines:
    - `Archetype`: `'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper'`
    - `Aggression`: `'off' | 'calm' | 'normal' | 'hard'`
    - `Phase`: `'roam' | 'chase' | 'windup' | 'attack' | 'recover' | 'pain' | 'dead'`
  - [packages/shareware/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/shareware) parses 2D WAD sprite patches (*Freedoom*, *Blasphemer*), `.md1` / `.md2` vertex-morphed 3D meshes (*LibreQuake*), and `.glb` rigged meshes (*Quaternius*), plus `fidelity-mob.ts` multi-stage shader hooks.
  - `TASK-23b` ([docs/prompts/sidecar/23-monsters.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/23-monsters.md)) wires `@hm/leaksim` into the planet gameplay loop.
- **What Is Weak or Missing:**
  - **Tonal & Visual Clash (`17-monsters-batch1.jpg`, `18-monsters-batch3.jpg`):** Raw 2D sprites have baked doom-palette blood/grime, whereas *Quaternius* glTF models have clean flat pastel vertex colors. Rendered side-by-side without a unifying material pass, they look like assets from three unrelated games.
  - **Stand-In Anomaly Rift Geometry (`POL-23`):** Leak spawn points currently use basic primitives (dodecahedron, torus, icosahedron) instead of tearing vertical S-space rifts that echo the Lab Window Breach ([05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)).
  - **Telegraph Readability in Low-Fidelity Stages:** In Stage 0 (1-bit) and Stage 1 (EGA), a monster entering its `windup` phase (`@hm/leaksim`) needs an unmistakable high-contrast visual and audio tell so players can dodge or counter-fire.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Monster & Combat Design Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Prodeus](https://store.steampowered.com/app/964800/Prodeus/) | **Shader-Unified Sprite/3D Rendering with Emissive Weakpoints:** 2D directional sprites and 3D meshes share the exact same normal-mapped dynamic lighting, stage palette quantization, and bright emissive eyes/projectiles ([Prodeus Technical Discussions](https://steamcommunity.com/app/964800/discussions/0/3371531264818900018/)). | Passing both 2D sprites and 3D meshes through our `createFidelityMobMaterial` with a shared **S-Space Glitch Outline & Stage Quantizer** makes them look like siblings born from the same simulation breach. |
| [Deep Rock Galactic](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) | **Unmistakable Silhouette + Audio Telegraph Per Archetype:** Every enemy class (Swarmer, Mactera Spitter, Praetorian Brute) has a distinct silhouette, glowing weakspot, and 0.6 s pre-attack audio/visual windup cue ([Deep Rock Galactic Steam](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/)). | Maps 1:1 to our 6 `@hm/leaksim` archetypes (`charger`, `spitter`, `swarmer`, `flyer`, `brute`, `sapper`). |
| [Control](https://store.steampowered.com/app/870780/Control_Ultimate_Edition/) & [Factorio](https://store.steampowered.com/app/427520/Factorio/) | **Compute/Pollution-Triggered Breach Waves & Non-Griefing Sappers:** High machine activity attracts localized anomalies (`Leak Waves`), and peaceful/builder modes allow full progression without losing hours of base construction ([BASE\_BUILDING\_RESEARCH.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/BASE_BUILDING_RESEARCH.md)). | Already encoded in Rule 23: `sapper` archetypes temporarily **drain/brown-out** a machine's fidelity output by latching onto its relay line rather than destroying the placed structure! |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical Archetype, Visual Era & Behavior Mapping (`@hm/leaksim` + `TASK-23b`)

| `@hm/leaksim` Archetype | Assigned Asset Family (`docs/monsters/`) | Combat Role & Telegraph (`windup` Phase) | Interaction with Player & Base (Rule 23 Compliant) |
| :--- | :--- | :--- | :--- |
| **`swarmer`** | *Quaternius* small low-poly critters (rendered with faceted wireframe/glitch shell) | Fast ankle-biters in packs of 4–6; `0.35 s` hop crouch telegraph with high-pitched chitter. | Cleared in one Shotgun blast or wide Beam sweep; never damages buildings. |
| **`charger`** | *Freedoom* / *Blasphemer* melee beasts & *LibreQuake* Fiend (`md1`) | Bull-rush line attacker; pauses `0.6 s` during `windup`, glowing `#ff3d8a` along its spine before lunging in a straight vector. | Sidestepping causes it to stagger (`recover` phase `0.8 s`) for easy critical hits. |
| **`spitter`** | *Freedoom* Imp / ranged sprites & *Blasphemer* acolytes | Mid-range artillery; raises arms for `0.7 s` (`windup`) charging a bright `#ffc13d` / `#ff3d8a` plasma orb before firing a slow dodgeable bolt. | Projectiles can be shot down mid-air or deflected with a pulse of the Beam Tool. |
| **`flyer`** | *Freedoom* floating skull/sphere sprites & *Quaternius* flying drones | Hovers `4–7 m` above craters, strafing around vertical cover; `0.65 s` sonar screech before diving or firing. | Keeps combat three-dimensional; drops high-yield `Lumen Shards` (`#ffc13d`). |
| **`brute`** | *LibreQuake* Ogre / Shambler (`md1`/`md2`) | Heavy tank spawned only at Stage 2+ leaks; `0.9 s` ground-slam windup with a visible `#ff3d8a` shockwave ring on the terrain. | High health; weak to head/back core shots or turret focus fire. |
| **`sapper`** | Glitch-tethered parasite entities | Ignores the player until aggroed; moves toward the nearest running field machine and attaches a `#3dc8ff` static tether that **halves the machine's `S` output (brownout)** without ever damaging its HP (Rule 23). | Shooting the sapper or hitting it with the Beam Tool (`Seal` mode) immediately restores 100% machine output and drops bonus `Salvage`. |

### P0 — Must Fix Before First Public Test

1. **P0-MON-01: Unify All 38 Monsters Under the `S-Space Containment Leak Shader` (`packages/shareware/src/fidelity-mob.ts` & `TASK-23b`)**
   - **What to build:** Solve the tonal clash in [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg) and [18-monsters-batch3.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) by passing every monster material (2D sprite billboard, `.md1`/`.md2` morph mesh, and *Quaternius* `.glb`) through a shared three-stage shader wrapper in `fidelity-mob.ts`:
     1. **Desaturate Gore / Unify Base Palette:** Remap raw blood/gore reds and cartoon pastels into the game's dark gunmetal/obsidian substrate palette (`#181c24` to `#4a5568`) with glowing metric veins (`#ff3d8a` for attackers, `#3dc8ff` for sappers, `#ffc13d` for spitters).
     2. **Dynamic Local Stage Inheritance:** A monster standing on Stage 0 terrain renders in crisp 1-bit Bayer dither with a 1 px cyan/pink silhouette edge; as it walks into a Stage 3/4 high-fidelity zone near the player's outpost, its shader upgrades live across its body into normal-mapped/lit fidelity!
     3. **Horizontal Glitch-Slice Displacement:** Apply a subtle periodic horizontal scanline tear (`2–4 px` vertex/UV offset on `pain` and `windup` phases) echoing the Window Breach column ([05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), visually proving they are unstable simulation leaks.
   - **Needs:** **Code** (`packages/shareware/src/fidelity-mob.ts`, `apps/web/src/play/`).

2. **P0-MON-02: High-Contrast `windup` Telegraph Flash & Audio Cue (`@hm/leaksim` Integration)**
   - **What to build:** Whenever an entity in `@hm/leaksim` transitions into `Phase: 'windup'`, pulse its emissive rim from `0.2` to `2.0` (`#ffc13d` amber for ranged bolts, `#ff3d8a` pink for melee charges) and fire a distinct `350 ms` rising FM telegraph sound (`@hm/soundpack`) so the player never takes blind damage from off-screen or in low-light Stage 0 craters.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/soundpack/`).

3. **P0-MON-03: Enforce the 25 m Twin Gate Safe Zone & Non-Destructive `sapper` Behavior (Rule 23)**
   - **What to build:** Verify in `TASK-23b` and `scripts/test-planet-monsters.mjs` (`TASK-24`) that:
     - Monsters cannot enter or fire into the `25 m` Twin Gate Coherence Safe Dome (pressing against the dome boundary repels them with an amber shield ripple).
     - Monsters never reduce structure/machine durability or delete player-built pieces; `sapper` units only apply a reversible efficiency debuff until cleared.
     - Setting `Aggression: 'off'` or `'calm'` in Settings / New Profile disables unprovoked waves while allowing players to seal dormant leaks with the Beam Tool (`Seal` mode) for the exact same drops.
   - **Needs:** **Code** (`packages/leaksim/`, `apps/web/src/play/`).

### P1 — Makes It Feel AAA

4. **P1-MON-04: Replace Primitive Leak Nodes with Vertical Glitch-Torn Rift Columns (`POL-23` Upgrade)**
   - **What to build:** Replace the stand-in dodecahedron/torus leak geometries (`POL-23`) with a miniature `3.5 m` vertical glitch-sliced shard column (reusing the exact shader language of the Lab Window Breach in [05-window-view-storm-and-breach.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg) surrounded by 3 orbiting low-poly rubble fragments). As the player channels the Beam Tool (`Seal` mode) into the rift for `3.0 seconds`, the rift's horizontal slices lock back into alignment and compress into a collectible `Anomaly Core`.
   - **Needs:** **Code** (`apps/web/src/play/`), **Art** (concept pass + shader reuse from `WindowScene.ts`).

5. **P1-MON-05: Era-Escalation Across Fidelity Stages**
   - **What to build:** Tie leak compositions to the plot's current stage so the history of 3D graphics unfolds through combat:
     - **Stage 0–1 Leaks:** 2D directional billboard sprites (*Freedoom* / *Blasphemer* imps and chargers) emerging from flat 1-bit/EGA rifts.
     - **Stage 2–3 Leaks:** Early 3D vertex-morphed `.md1` / `.md2` monsters (*LibreQuake* Fiends and Ogres) with chunky Gouraud shading.
     - **Stage 4 Leaks:** Full 3D skeletal-rigged monsters (*Quaternius* + high-tier hybrids) with PBR materials and dynamic point-light emissions.
   - **Needs:** **Code** (`packages/leaksim/`, `apps/web/src/play/`).

### P2 — Stretch Goals

6. **P2-MON-06: Bio-Spliced Companion / Farmable Cartridges in the Preset Combiner (`V2_0_MASTER_PLAN.md` Act VIII)**
   - **What to build:** Allow slotting two recovered `Monster Cores` (or `Monster Core + Machine Cartridge`) into the Lab's **Preset Combiner** (`#b46bff`) to synthesize a tamed defender/harvester drone that patrols the outpost perimeter.
   - **Needs:** **Code** (`packages/assembler/`, `packages/leaksim/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 2 (Purity is load-bearing):** `@hm/leaksim` remains 100% pure and deterministic.
- **Rule 14 (No unrequested branding):** All UI, quest text, and code labels refer to **Containment Leaks** and **Archive Entities**, never `"Monster Mash"`.
- **Rule 18 (Legal assets only):** Uses only BSD/CC0 assets (*Freedoom*, *Blasphemer*, *LibreQuake*, *Quaternius*) documented in [CREDITS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CREDITS.md), plus local user-dropped files in the Workshop.
- **Rule 23 (No soft-locks, monsters never destroy built pieces, peaceful alternative):** Strictly enforced by `P0-MON-03`.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Unifying the 2D Doom/Heretic Sprites and 3D Quaternius Models (`P0-MON-01`):**
   - *Question:* In [17-monsters-batch1.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg), the gory 2D *Freedoom* sprites clash with the cute pastel *Quaternius* 3D models. Do you approve our **two-part unification plan**: (a) remapping both families into the game's dark obsidian/gunmetal containment-leak palette with glowing metric veins (`#ff3d8a` / `#3dc8ff` / `#ffc13d`), and (b) staging them by computing era (2D sprites in Stage 0–1 $	o$ Quake `.md1`/`.md2` in Stage 2–3 $	o$ full 3D rigged models in Stage 4)?
   - *Recommendation:* **Approve both.** Staging 2D sprites $	o$ early 3D $	o$ full 3D across the Fidelity Stages turns a potential asset mismatch into one of the cleverest meta-jokes and visual progressions in the entire game!


# 19 — Vehicles, Weapons & Modular Hardpoints Plan: Square-Section Heavy Metal Engineering

## 1. The Goal: Grounded, Modular Industrial Hardware That Feels Heavy and Responsive

Look at [12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg), [13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg), and [14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg) in [docs/argo/TOUR.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md), alongside Concept Sheets [19-sheet-vehicle-fabricator.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png) and [20-sheet-weapons.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png):
- While driving the Rover ([12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg)), **the camera clips directly into terrain geometry**, and the modular scout chassis is waiting on final switch-on (`USE_MODULAR_SCOUT` in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4).
- In third-person ([14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)), **the Beam Rifle is tiny (`~40%` of proper scale)** and renders dark; in first-person ([13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg)), the rifle lacks clear mode-color feedback.

Our goal is to make every vehicle (Scout Rover, Heavy Hauler) and weapon (Extraction Beam Rifle, Shareware Sidearms, Base Defense Turrets) obey the owner's **Square-Section & Empty-Cab Yoke Rules** (Rules 11, 12, 15, 16), eliminate camera clipping via a sphere-cast spring arm (`@hm/camerarig`), and deliver punchy, deterministic handling across `1.62 m/s²` lunar gravity.

## 2. Where It Stands Today

- **What Exists:**
  - [packages/kart/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/kart), [packages/racers/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/racers), and [packages/camerarig/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/camerarig) implement Pacejka tire drift physics, spring-damper suspension, and 9-byte deterministic ghost replays.
  - [apps/web/src/play/beam-tool.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts), [packages/beamkit/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/beamkit), and [packages/toolanims/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/toolanims) implement the 4-mode rifle (`Extract`, `Apply`, `Sculpt`, `Seal`) and 11 standing Mixamo rifle clips.
  - Concept Sheets [19-sheet-vehicle-fabricator.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png) and [20-sheet-weapons.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png) and packed models in [apps/web/src/assets/gen/registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) include the modular scout, redone hauler body, `[-u-]` square yoke, and weapon models.
- **What Is Weak or Missing:**
  - **Rover Camera Terrain Clipping (`12-rover-driving.jpg`):** The vehicle camera uses a fixed offset or simple point raycast without terrain-height clamping or pitch horizon leveling, plunging underground whenever the rover crests a crater rim or drives near a boulder.
  - **Tiny Third-Person Rifle & Dark Viewmodel (`13-beam-first-person-apply-paint.jpg`, `14-beam-third-person.jpg`):** Hand-socket scale in `TASK-21c` needs a `1.65x` correction in third-person and emissive mode strips along the square barrel housing.
  - **Pending Modular Vehicle Switch-On (`RESUME.md` §5.4):** `USE_MODULAR_SCOUT` needs the aerial raycast onto the shell and the packed `[-u-]` yoke verified, plus `VEHICLE_FIT` re-checked for the redone hauler body.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Vehicle & Weapon Engineering Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [Space Engineers](https://steamcommunity.com/sharedfiles/filedetails/?id=1138675837) & [Astroneer](https://store.steampowered.com/app/361420/ASTRONEER/) | **Spring-Arm Sphere-Cast Camera + Utility Cargo Sockets:** Vehicle cameras cast a `r = 0.35 m` sphere from the chassis pivot to the camera target, sliding smoothly forward and pitching up when a slope rises behind the vehicle; rear beds feature standardized modular sockets for ore bins or drills ([Space Engineers Rover Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1138675837)). | Permanently cures the terrain clipping in [12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg) while making the Scout and Hauler true workhorses of the core loop. |
| [Deep Rock Galactic](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) & [Subnautica](https://store.steampowered.com/app/264710/Subnautica/) | **Color-Coded Tool Viewmodels & Automated Perimeter Turrets:** Tools change their physical housing glow and reticle shape immediately when switching modes; base/engineer turrets track and suppress swarmers with a visible laser sightline so solo builders never feel overwhelmed while mining. | Directly informs our Beam Rifle mode coils and Sheet 20 ([20-sheet-weapons.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png)) defense emplacements. |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-VEH-01: Fix Rover Camera Geometry Clipping via Sphere-Cast Spring Arm & Terrain Floor Clamp (`12-rover-driving.jpg` Fix)**
   - **What to build:** In [packages/camerarig/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/camerarig) and the rover camera controller:
     1. Cast a ray/sphere (`radius = 0.35 m`) from the rover roof anchor (`pivot = chassisPos + (0, 1.4, 0)`) to the desired camera position (`distance = 5.5 m`, `height = +2.1 m`). If the ray hits terrain or a boulder at `d < 5.5 m`, pull the camera forward to `d - 0.35 m` with fast `25 ms` snap-in and smooth `250 ms` ease-out.
     2. Enforce a hard **Heightfield Floor Clamp**: `camera.position.y = Math.max(camera.position.y, sampleTerrainHeight(camera.position.x, camera.position.z) + 0.65)` so the camera lens can never dip below the lunar surface even during extreme crater jumps (`TASK-24` edge-case check).
     3. Decouple camera roll (`roll = 0°`) and damp pitch follow (`lag = 0.12 s`) so rocky micro-bumps do not shake the horizon.
   - **Needs:** **Code** (`packages/camerarig/`, `apps/web/src/play/`).

2. **P0-VEH-02: Fix Third-Person Beam Rifle Scale (`1.65x`) & First-Person Emissive Mode Strip (`13` & `14` Tour Fixes, `TASK-21c`)**
   - **What to build:** In [apps/web/src/avatar/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/avatar) and [apps/web/src/play/beam-tool.ts](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts):
     - Scale the third-person attached Beam Rifle mesh by `1.65x` and align its rear grip and forend to the Mixamo right/left hand bone sockets (`RightHand`, `LeftHand` IK target) so it reads as a substantial two-handed industrial carbine rather than a tiny pistol ([14-beam-third-person.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)).
     - Add a square-section emissive rib along the top/side rail of the rifle that glows `#3dc8ff` in `Extract`, `#ff3d8a` in `Apply`, `#7cff4d` in `Sculpt`, and `#ffc13d` in `Seal` mode, giving instant visual confirmation in [13-beam-first-person-apply-paint.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg).
   - **Needs:** **Code** (`apps/web/src/avatar/`, `apps/web/src/play/beam-tool.ts`).

3. **P0-VEH-03: Enable `USE_MODULAR_SCOUT` with Raycast Aerial, `[-u-]` Yoke & Hauler `VEHICLE_FIT` (`RESUME.md` §5.4)**
   - **What to build:** Complete the three vehicle items listed in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4:
     1. Raycast the modular scout's antenna/aerial socket onto the top rear shell so it sits flush with zero floating gap (Rule 10, Rule 16).
     2. Verify the packed square `[-u-]` steering yoke inside the empty cab (Rule 12) and flip `USE_MODULAR_SCOUT = true`.
     3. Re-run `VEHICLE_FIT` wheel-well and suspension travel bounds for the redone Heavy Hauler body.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/kart/`).

### P1 — Makes It Feel AAA

4. **P1-VEH-04: Vehicle Fabricator Bay & Rear Cargo Socket Integration (`19-sheet-vehicle-fabricator.png`)**
   - **What to build:** Wire the **Vehicle Fabricator** hardpoint pad ([19-sheet-vehicle-fabricator.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png)) so building a Scout Rover or Heavy Hauler plays a 3-second gantry assembly sequence. Give the Scout Rover 1 rear modular socket (holds a portable `Linked Ore Bin` or `Coherence Beacon`) and the Heavy Hauler 3 rear sockets (holds bulk ore or a mobile turret), turning vehicles into mobile extensions of the `@hm/lattice` network.
   - **Needs:** **Code** (`packages/kart/`, `packages/lattice/`, `apps/web/src/base/`).

5. **P1-VEH-05: Handheld & Emplaced Weapons from Sheet 20 (`20-sheet-weapons.png`)**
   - **What to build:** Alongside the Beam Rifle (Slot 1), wire two distinct kinetic/energy combat archetypes from [20-sheet-weapons.png](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png) and `@hm/shareware`:
     - **Handheld Pulse/Scatter Sidearm (Slot 2):** Square-section industrial receiver with round barrel (Rule 11), firing high-impact kinetic/pellet bursts for close-quarters `swarmer` and `charger` defense.
     - **Automated Perimeter Defense Turret (Buildable on Sheet 13 Corner/Roof Sockets):** Uses `15 kW` grid power to automatically target `sapper` and `swarmer` leaks within `35 m` with a visible `#ffc13d` targeting laser, letting builders focus on terraforming without constant manual babysitting.
   - **Needs:** **Code** (`apps/web/src/play/`, `apps/web/src/base/`), **Art** (already in Sheet 20 asset batch).

### P2 — Stretch Goals

6. **P2-VEH-06: Cartridge-Modded Weapon Hybrids (`Scatter Excavator` & `Color Spewer`)**
   - **What to build:** Allow slotting a fused Weapon+Tool cartridge (`V2_0_MASTER_PLAN.md` Act VIII) into the Beam Rifle to unlock wide-cone crater excavation or rapid terrain painting while driving the Rover.
   - **Needs:** **Code** (`packages/beamkit/`, `packages/assembler/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 10 (Nothing floats):** Aerial, wheels, suspension arms, and rear cargo bins snap to raycasted surface sockets.
- **Rule 11 (Square sections; round only for wheels, tyres, gun barrels):** All weapon receivers, turret housings, and rover roll-cages use square/rectangular box tubing; only wheels and barrels are round.
- **Rule 12 (No lettering, numbers or logos; empty cabs with square `[-u-]` yoke):** Strictly enforced across both Scout and Hauler cabs.
- **Rule 16 (Split hard parts into their own objects):** Yoke, wheels, aerial, and roof turret are separate meshes snapped at sockets in code.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Player Avatar Inside the Rover Cab When Driving (`12-rover-driving.jpg`):**
   - *Question:* Rule 12 states that generated vehicle models must have **empty cabs** with a square `[-u-]` yoke (so the AI 3D generator doesn't bake a melted driver inside the mesh). At runtime in the game, when the player presses `E` to enter and drive the Rover in third-person ([12-rover-driving.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg)), should the cab stay visually empty (remote/drone-link driving with the tinted glass canopy closed), or should we seat the Scientist avatar mesh at the yoke socket?
   - *Recommendation:* Keep the cab **visually empty with a sleek tinted/amber-lit canopy or remote-telemetry HUD feed** on Low/default (since Mixamo seated driving IK clips through chunky roll-cages), or only seat the Scientist once dedicated seated IK is verified. Which do you prefer?


# 20 — The Studio Creative Suite Plan: An In-Engine Editor Worthy of Building the Game Inside Itself

## 1. The Goal: Turn the Studio from an Inspector Shell into the Owner's Daily Polishing Bench

The owner stated his vision for **The Studio** clearly in [docs/OWNER\_ASKS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/OWNER_ASKS.md) (2026-10-08):
> *"the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely ... so that our studio is the new gold standard in game editing and creation."*

On 13 October ([15-studio-editor.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/15-studio-editor.jpg), [16-studio-asset-levels.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)), the Studio shell and the Low/Mid/High asset bench landed in [apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio). Our goal now is to elevate that shell into a frictionless creative powerhouse where the owner (and players in Act V+) can **inspect any asset across all 5 Fidelity Stages simultaneously, snap socketed sub-parts visually, author procedural textures/cartridges with 1-click presets, and commit changes straight back to the repo (`studio-data/`) or shareable `.smx` bundles**.

## 2. Where It Stands Today

- **What Exists:**
  - [apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio) implements the 4-pane editor shell ([15-studio-editor.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/15-studio-editor.jpg)): Content Browser, 3D Gizmo Viewport (`@hm/gizmo`), Schema-Driven Details Inspector (`@hm/modui`), and a **Changes Panel** with `Accept` write-back (`studio-data/`).
  - **The Asset Bench ([16-studio-asset-levels.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)):** Displays one generated model at `Low`, `Mid`, and `High` detail side-by-side with a redo/touch-up panel hooked to the RUN.world + Hunyuan3D + Blender bake pipeline ([docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3).
  - Supporting packages: [packages/scenedoc/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/scenedoc), [packages/presetcodec/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/presetcodec), [packages/gizmo/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/gizmo), [packages/selectset/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/selectset), [packages/texgraph/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/texgraph), and [packages/wiregraph/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/wiregraph).
- **What Is Weak or Missing:**
  - **Asset Bench Shows Models Only Under Neutral Grey Lighting (`16-studio-asset-levels.jpg`):** Models that look fine in the Studio's neutral viewport can turn near-black or lose their silhouette when placed on the Stage 0 (1-bit dither) or Stage 1 (EGA) Moon! The Asset Bench lacks a **Stage 0–4 Lighting & Shader Scrubber**.
  - **Manual Socket & Hard-Part Alignment (Rule 16):** Rule 16 requires splitting hard parts (tools on benches, guns on racks, cables, aerials, yokes, plume vents) into separate objects placed in code. Right now, finding the exact `(x, y, z, rx, ry, rz)` socket coordinates requires manual code edits instead of dragging a socket gizmo on the parent mesh in the Studio and clicking `Accept`.
  - **Four-Angle Review Gate Isn't Built Into the Asset Bench UI (Rule 17):** Rule 17 requires reviewing every model from four angles (`Front`, `Right`, `Back`, `Three-Quarter`) to catch invented/black backs before shipping.

## 3. What the Best Tools & Games Do (Research & Sources)

| Reference Tool / Engine | Best-in-Class Workflow Feature | User Praise / Pain Point Solved (`docs/STUDIO_PLAN.md` Grounding) |
| :--- | :--- | :--- |
| **Unreal Engine 5 / Substance 3D Painter** | **Smart Materials / Preset Shelf + Non-Destructive Layer Stack:** Artists pick a 1-click preset (`Weathered Gunmetal`, `Lunar Basalt`, `Amber Coil`) that immediately looks great, then expand a clean slider drawer only if they want to fine-tune roughness, wear, or noise octaves. | Solves the "blank node-graph intimidation" of Substance Designer / Blender Shader Editor while keeping full procedural power (`@hm/texgraph`) one click away. |
| **Blender / Godot 4** | **Quad-View Orthographic/Angle Toggle & Socket (`Empty`) Snapping:** One hotkey switches the viewport into a 4-up grid (`Front / Back / Side / Perspective`) and lets you snap child attachments (`Sockets`) directly to surface normals with live JSON transform write-back. | Directly automates Rule 16 (splitting hard parts onto sockets) and Rule 17 (mandatory 4-angle model review). |
| **Roblox Studio / Forge Mode (*Halo*)** | **Instant Play-Here (`F5`) Toggle with Zero Reload:** Pressing one button drops your character directly into the edited scene at the camera's position, and pressing it again returns to the editor with all state intact. | Bridges the gap between the standalone Studio menu mode and the Act V in-Lab Studio terminal. |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-STUDIO-01: Add a 4-Angle Review Grid & `fix` Flag Toggle to the Asset Bench (`16-studio-asset-levels.jpg` & Rule 17)**
   - **What to build:** In the Studio Asset Bench ([apps/web/src/studio/](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio), [16-studio-asset-levels.jpg](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)):
     - Add a **`[4-Angle Review]`** toggle next to the `Low / Mid / High` turntable that renders synchronized `Front (0°)`, `Right (90°)`, `Back (180°)`, and `Iso (45°)` views of the selected asset, highlighting the back face so invented or dark backs are spotted in 1 second.
     - Expose one-click checkboxes for the manifest repair flags from [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3 (`fix: 'mirror-z'`, `fix: 'plain-back'`, `reach: 3`, `hold: true`) that write directly to `docs/runworld/assets.json` via the Changes panel (`Accept`).
   - **Needs:** **Code** (`apps/web/src/studio/`).

2. **P0-STUDIO-02: Add a Live Stage 0–4 Shader & Lighting Scrubber to the Studio Viewport**
   - **What to build:** Add a top toolbar pill in the Studio viewport (`[Neutral Studio] | [S0: 1-Bit] | [S1: EGA] | [S2: VGA] | [S3: Gouraud] | [S4: Lush PBR]`) that applies the exact planet lighting and `fidelity` shader to the asset or scene being edited. That guarantees no asset ever ships looking right in the Studio but rendering near-black on the Stage 0 Moon.
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/fidelity/`).

### P1 — Makes It Feel AAA

3. **P1-STUDIO-03: Visual Socket & Plume-Point Editor for Rule 16 Multi-Part Assemblies**
   - **What to build:** Add a **`Sockets & Attachments`** sub-mode in the Studio (`@hm/gizmo`) that lets the owner select a base model (e.g., `preset-bench`, `weapon-rack`, `modular-scout`, `texture-mill`), click **`+ Add Socket`** (`type: 'child-mesh' | 'feed-hopper' | 'pixel-exhaust' | 'cable-gland'`), raycast-snap the socket onto any face normal of the base cage, preview the attached tool/yoke/pixel-plume live, and click **`Accept`** in the Changes panel to persist the socket coordinates into the asset registry!
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/gizmo/`).

4. **P1-STUDIO-04: Two-Tier "Preset First, Node Graph Second" Material & Cartridge Designer (`@hm/texgraph` + `@hm/vault`)**
   - **What to build:** In the Studio's Material / Cartridge tab:
     - **Tier 1 (Default Simple View):** Display the 50 curated `@hm/vault` cartridges as visual material spheres with 5 macro sliders (`Primary Hue`, `Grain Scale`, `Weathering/Moss`, `Roughness`, `Bump Depth`) and a **`[Fuse 2 Cartridges]`** slot matching the Lab's Preset Combiner.
     - **Tier 2 (`[Advanced Node Graph]` Toggle):** Expands the full `@hm/wiregraph` / `@hm/texgraph` procedural DAG editor with live Potato (`16px/128px`) to Ultra (`32px/1024px`) tier-scaling preview (`docs/MATH_TEXTURES.md` `D21`), ensuring constant mean color across all hardware tiers.
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/texgraph/`, `packages/wiregraph/`).

5. **P1-STUDIO-05: Unify the In-Lab Act V Schema Terminal (`A4-03`) with the Studio Details Inspector**
   - **What to build:** Ensure the Studio terminal inside the Lab (`TASK-22` step `A4-03`, *"It's not really dirt"*) embeds the exact same `@hm/modui` schema inspector and `Changes` diff panel used in the full Studio, filtered to gameplay-safe schemas (`ResourceLabels`, `CartridgePresets`, `PlotRules`) with a **`[Open Full Studio Suite]`** button for players who want the complete 3D editor.
   - **Needs:** **Code** (`apps/web/src/studio/`, `apps/web/src/play/`).

### P2 — Stretch Goals

6. **P2-STUDIO-06: One-Click `.smx` Cartridge & Scene Bundle Drag-and-Drop Export/Import**
   - **What to build:** Allow exporting any custom cartridge, socketed machine assembly, or spliced monster from the Studio as a compact binary `.smx` file (`@hm/presetcodec`, `< 4 KB`) or PNG "Cartridge Card" with embedded metadata that another player can drag-and-drop directly into their browser window.
   - **Needs:** **Code** (`packages/presetcodec/`, `apps/web/src/studio/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 15 (Chunky shapes), Rule 16 (Split hard parts into their own objects), & Rule 17 (Three detail levels, reviewed from four angles):** Directly enforced and accelerated by `P0-STUDIO-01` and `P1-STUDIO-03`.
- **Rule 21 (The toggle rule):** Simple Preset Sliders vs. Full Procedural Node Graph (`P1-STUDIO-04`) and Blender-style (`G/R/S`) vs. Unreal-style (`W/E/R`) gizmo hotkeys ship as instant Studio header toggles.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Default Gizmo Hotkeys in the Studio (`W / E / R` vs. `G / R / S`):**
   - *Question:* In `docs/STUDIO_PLAN.md`, users split between game-engine gizmo keys (`W` Move, `E` Rotate, `R` Scale — Unreal/Unity/Godot) and 3D-modeling keys (`G` Grab/Move, `R` Rotate, `S` Scale — Blender). Which keyset should be the **default** when you open the Studio on your machine (with a 1-click `[Keymap: Unreal | Blender]` toggle in the top bar)?
   - *Recommendation:* Default to **`W / E / R` (Unreal/Unity standard)** when `Right-Click Mouse Look` is not held, with the **`[Unreal | Blender]` pill toggle** right in the top viewport bar saved to your profile.


# 21 — Production, Asset Pipeline, Quality Bars, Budgets & Milestones Plan

## 1. The Goal: Ship a 60 FPS Single-File Build (`< 18 MB`) with an Optional HD Pack and Zero Rule-Breaking Assets

Our production pipeline combines four engines working in concert: **Claude Opus** (architecture, briefs, reviews, asset pipeline), **Claude Haiku sidecars** (sequential brief implementation), **Arena.ai battles** (pure TypeScript modules), and the **RUN.world $	o$ local Hunyuan3D (`192.168.0.9:8082`) $	o$ Blender 3-LOD bake pipeline** ([docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §7, [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3).

Right now, two production risks stand out:
1. **Bundle Size Watch (`POL-27`):** The single-file build `dist/index.html` is at **17.9–18.0 MB** ([docs/argo/START\_HERE.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, [docs/DEFERRED\_POLISH\_REGISTRY.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/DEFERRED_POLISH_REGISTRY.md)), and an overnight batch of 40 subjects × 2 options (`~80 models` in `zips/runworld/overnight-ids.txt`) is finishing. Packing dozens more inline `low.glb` assets without a strict budget cap will push `index.html` past 25–30 MB and stall startup parse times on the GTX 950M laptop.
2. **Automated Quality Gates for Creative Polish:** While `npm run typecheck`, `npm test`, and `npm run e2e` verify that code compiles and runs, visual regressions (like the near-black avatar in `14-beam-third-person.jpg`, the 3-way HUD overlap in `07-moon-stage0.jpg`, or rule-breaking meshes) only get caught when Opus or the owner manually eyeballs screenshots.

Our goal is to enforce hard **Triangle, Memory, Bundle, and Frame-Time Budgets**, establish a **5-Point Asset Acceptance Gate** for the overnight batch, and sequence the exact **Post-TASK-24 Production Milestones** so every creative plan in `docs/argo/plans/` lands cleanly.

## 2. Where It Stands Today

- **What Exists:**
  - **114 generated 3D models** packed in [apps/web/src/assets/gen/registry.json](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) (`low.glb` inline in `apps/web/src/assets/gen/`, `mid.glb` and `high.glb` in `apps/web/public/hd/<id>/` via Git LFS).
  - **38 legal monsters** imported from *Freedoom*, *Blasphemer*, *LibreQuake*, and *Quaternius* (`docs/monsters/`, [CREDITS.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CREDITS.md)).
  - **Active Queue (`START_HERE.md` §4):** `TASK-21c/d` (avatar lighting, rifle anims, Sculpt, saving) $	o$ `TASK-22` (Acts IV–VI quests) $	o$ `TASK-23b` (monsters in game) $	o$ `TASK-23c` (props in world) $	o$ `TASK-24` (full e2e test suite, then merge `feat/monster-mash-exploration` to `main`).
  - **Overnight Asset Batch (`RESUME.md` §7):** 40 subjects × 2 options (`<id>-a`, `<id>-b`) in `zips/runworld/overnight-ids.txt` awaiting 4-angle review and selection.
- **What Is Weak or Missing:**
  - **`dist/index.html` Size Ceiling (`17.9 MB`, `POL-27`):** Inline base64/binary assets (114 `low.glb` meshes + embedded VO/audio + WAD lumps) are approaching the browser single-HTML parse sweet spot on low-spec laptops.
  - **No Automated Visual/Luminance Check in `TASK-24`:** `e2e` takes screenshots (`docs/argo/tour/*.jpg`), but does not assert that the player avatar's mean pixel luminance is `> 15%` (catching black-bake bugs) or that HUD bounding boxes have `0 px²` intersection.

## 3. What the Best Productions Do (Research & Sources)

| Industry Practice / Reference | Production & Optimization Technique | Why It Fits Our Pipeline |
| :--- | :--- | :--- |
| ** Core + Streaming HD Pack Architecture (Rule 3: `"Lean file + HD pack"`)** | Keep the single-file `dist/index.html` strictly under a **16.0 MB hard ceiling** by quantizing inline `low.glb` vertex positions to `Int16` (`EXT_meshopt_compression` / quantized attributes + `128×128` indexed/JPEG-baked colour maps) while streaming `mid.glb`, `high.glb`, and non-Act-I voiceover files on-demand from the adjacent `hd/` folder with a visible preload bar (Rule 22). | Cuts inline per-model footprint from `~95 KB` to `~28 KB`, allowing 150+ unique models inside `index.html` while actually *shrinking* total file size from `18 MB` to `~13.5 MB`. |
| **Automated Screenshot Histogram & DOM Box Assertions in E2E (`Playwright` / `Puppeteer`)** | During `npm run e2e`, query `getBoundingClientRect()` on all visible `[data-hud-zone]` elements to fail the test if any two HUD boxes overlap by `> 2 px`, and sample the center-screen avatar pixel patch in `14-beam-third-person.jpg` to assert mean luminance `> 0.12`. | Prevents HUD overlaps (`07-moon-stage0.jpg`) and black-model regressions (`14-beam-third-person.jpg`) from ever slipping past a sidecar commit again. |

## 4. Concrete Changes, Budgets & Milestones Ranked P0, P1, and P2

### Hard Technical & Art Budgets (Enforced by `scripts/verify.mjs` & `scripts/perf.mjs`)

| Budget Category | Low Spec Target (`GTX 950M Laptop @ 60 FPS`) | High / Ultra Spec Target (`RTX 3080 Desktop`) | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Frame Time & Draw Calls** | `<= 16.6 ms` (`60 FPS` hard floor), `<= 95` draw calls, `<= 180k` active triangles (Scene + `1.5 ms` Window Vista). | `<= 8.3 ms` (`120 FPS`), `<= 250` draw calls, `<= 1.2M` triangles (`high.glb` + dynamic shadows + `POL-02/03` plume lights). | `scripts/perf.mjs` + runtime `Auto` tier governor (`POL-04`). |
| **Per-Asset Triangle Budgets (`runworld-post.mjs`)** | **Small prop/clutter:** `Low <= 350 tris` \| **Medium machine/rover:** `Low <= 900 tris` \| **Large vista/heavy terraformer:** `Low <= 1,500 tris`. | **Mid:** `2.5x Low` (`800–3,500 tris`) \| **High:** `6x Low` (`2,000–9,000 tris`) with `1024²` normal/albedo maps in `public/hd/<id>/`. | Checked automatically in `scripts/runworld-post.mjs` before packing. |
| **Single-File Bundle (`dist/index.html`, `POL-27`)** | **Hard Cap: `16.0 MB` (Target: `13.5 MB`)**. Inline `low.glb` average `<= 35 KB` via `Int16` quantized vertices + `128px/256px` baked atlas; procedural Web Audio SFX (`0 MB`). | Optional `public/hd/` pack streams `mid.glb`, `high.glb`, and Act IV–VI VO archives behind a smooth preload bar (Rule 22). | `scripts/verify.mjs` fails if `dist/index.html > 16.5 MB`. |
| **RUN.world Credit Reserve** | Maintain `>= 16,000` credits (`RUNWORLD_FLOOR` in [docs/RESUME.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)) reserved for Dr. Haddy voiceover; image generation costs `~120 credits/image` from the `66.4k` balance. | Use end-of-month resetting **Meshy.ai API credits** for experimental Tier-4 max-detail containment leak restorations (`RESUME.md` §7). | Checked by `scripts/runworld-assets.mjs` before dispatching jobs. |

### The 5-Point Asset Acceptance Gate (For Triage of the 80-Model Overnight Batch)

Before any `<id>-a` or `<id>-b` model from `zips/runworld/overnight-ids.txt` is packed via `node scripts/runworld-pack.mjs`:
1. **Four-Angle Render Check (Rule 17):** Run `blender -b --factory-startup -P scripts/render-angles.py` on both `-a` and `-b`. Reject or flag with `fix: ['mirror-z' | 'plain-back']` any model with an invented, hollowed, or black back face.
2. **Square-Section & Chunky Silhouette Check (Rules 11, 15):** Reject any option with thin spindly cages, melted cloth, round tubing where square belongs, or unrequested chimneys.
3. **No Baked Text/Logos & Empty Cab Check (Rule 12):** Reject any model with AI-hallucinated gibberish text decals or a driver baked inside a cab.
4. **Separate Hard-Parts Check (Rule 16):** Ensure wall-mounted items, benchtop tools, and cables are standalone socketed props rather than fused blobs.
5. **De-Metalled Bake Luminance Check (`lod-bake.py`):** Confirm `low.glb` mean diffuse luminance is `>= 0.18` so no asset renders near-black in Stage 0–1.

### P0 — Must Fix Before First Public Test (`feat/monster-mash-exploration` $	o$ `main`)

1. **P0-PROD-01: Add Automated HUD-Collision & Avatar-Luminance Checks to `TASK-24` (`scripts/e2e-smoke.mjs`)**
   - **What to build:** Extend `TASK-24` ([docs/prompts/sidecar/24-campaign-e2e.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/24-campaign-e2e.md)) so every e2e screenshot step asserts:
     - Zero bounding-box overlap (`intersectionArea === 0`) between `[data-hud-zone="title"]`, `[data-hud-zone="build-hint"]`, and `[data-hud-zone="subtitle"]` (preventing `07-moon-stage0.jpg` regressions).
     - Test screenshots taken for `docs/argo/tour/` automatically pass `?cleanShot=1` to hide the `"Click to look around"` pointer-lock prompt (enforcing Rule 24).
     - Avatar pixel sample in third-person Moon shot has mean RGB luminance `> 35/255` (preventing `14-beam-third-person.jpg` black-character regressions).
   - **Needs:** **Code** (`scripts/e2e-smoke.mjs`, `apps/web/src/shell/hud.tsx`).

2. **P0-PROD-02: Quantize Inline `low.glb` Meshes & Move Non-Act-I Audio/High-LODs to `public/hd/` (`POL-27` Fix)**
   - **What to build:** In `scripts/runworld-pack.mjs`:
     - Quantize `low.glb` positions/normals to 16-bit integers and compress inline baked basecolor textures to `256×256` WebP/JPEG (`quality = 82`), reducing the 114 packed `low.glb` payload in `dist/index.html` by `~4.5 MB` so the 40 best keepers from the overnight batch can be packed while keeping `dist/index.html` **under 16.0 MB**.
   - **Needs:** **Code** (`scripts/runworld-pack.mjs`).

### P1 — Post-Merge AAA Polish Waves (Turning Argo's Plans into Sidecar & Arena Briefs)

| Milestone Wave | Target Duration | Exact Sidecar Briefs & Arena Battles to Dispatch | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Milestone A: Complete Active Queue & Merge to `main`** | Days 1–2 (In Progress) | Finish `TASK-21c/d` (avatar light, rifle scale/IK, Sculpt, save), `TASK-22` (Acts IV–VI quests), `TASK-23b` (monsters in world), `TASK-23c` (lab clutter + wreck props), `TASK-24` (full e2e suite), plus triage the 40 overnight model pairs (`zips/runworld/overnight-ids.txt`). | All 6 `scripts/test-*.mjs` scripts green; merge `feat/monster-mash-exploration` $	o$ `main`. |
| **Milestone B: P0 Visual, HUD & Onboarding Overhaul** | Days 3–4 | **Sidecar Brief 25 (`hud-9zone-and-build-ribbon.md`):** `P0-UI-01`, `P0-UI-02`, `P0-UI-03` (fix Moon HUD overlap, bottom build drawer, raycast machine labels).<br>**Sidecar Brief 26 (`foundation-frames-and-safe-dome.md`):** `P0-LAYOUT-01` (replace red slab foundations with Sheet 13 frames), `P0-HOUR-01` (25 m Gate Coherence Safe Dome + zero-loss recall).<br>**Sidecar Brief 27 (`stage0-dither-and-rover-cam.md`):** `P0-LIGHT-02` (*Obra Dinn* world-locked dither + depth edges), `P0-VEH-01` (Rover sphere-cast camera + floor clamp), `P0-VEH-03` (`USE_MODULAR_SCOUT`). | Regenerate all 18 shots in `docs/argo/tour/` with zero HUD overlap, industrial foundations, lit avatar, and clip-free rover camera. |
| **Milestone C: P1 Set-Pieces, Audio Mix & S-Space Monsters** | Days 5–7 | **Sidecar Brief 28 (`lab-choreography-and-vista.md`):** `P0-LIGHT-03`, `P1-HOUR-03`, `P0-LAYOUT-02`, `P0-LAYOUT-03` (dramatic Lab power-up, 3.5 s Gate coil ignition, 3D Window Breach & spherical pockets, Main Menu live Lab `P1-UI-04`).<br>**Sidecar Brief 29 (`audio-5bus-and-juice.md`):** `P0-SOUND-01`, `P0-SOUND-02`, `P1-SOUND-03`, `P0-VFX-01`, `P0-VFX-02` (5-bus mixer with VO ducking, stage bit-crush mirror, wireframe print sweep, separated hopper/plume sockets).<br>**Sidecar Brief 30 (`monster-leak-shader-and-rifts.md`):** `P0-MON-01`, `P0-MON-02`, `P1-MON-04`, `P1-MON-05` (unified S-space leak shader, vertical glitch rifts, era escalation). | `scripts/perf.mjs` locked at `>= 60.0 FPS` across Stages 0–4 on Low spec (`POL-04` closed); `dist/index.html <= 16.0 MB` (`POL-27` closed). |
| **Milestone D: Studio Suite & Heavy Terraformer Expansion** | Days 8–10 | **Sidecar Brief 31 (`studio-bench-and-sockets.md`):** `P0-STUDIO-01`, `P0-STUDIO-02`, `P1-STUDIO-03`, `P1-STUDIO-04` (4-angle review grid, Stage 0–4 lighting scrubber, interactive socket gizmo, 2-tier preset/node material editor).<br>**Sidecar Brief 32 (`heavy-terraformers-and-turrets.md`):** `P1-LOOP-04`, `P1-VEH-04`, `P1-VEH-05` (Sheet 17 heavy terraformers on 8 m hardpoints, Vehicle Fabricator gantry, Sheet 20 automated perimeter turret). | Full playthrough from Act I Cold Boot to Stage 4 PBR lush forest + Studio round-trip asset edit verified. |

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 3 (Single-file distribution + HD pack):** Enforces the `16.0 MB` cap on `dist/index.html` (`POL-27`) with `public/hd/` streaming.
- **Rule 7 (Plan everything first, then execute):** Sequences all 12 area plans into concrete, reviewable Milestones A–D for Opus and the Haiku sidecars.
- **Rule 20 (GTX 950M at 60 fps on Low) & Rule 25 (Never delete or weaken a check or test):** Adds automated HUD-collision and luminance checks on top of existing tests.

## 6. Owner Decisions (APPROVED BY OWNER — 13 October 2026)

1. **Hard Cap for `dist/index.html` (`POL-27`):**
   - *Question:* `dist/index.html` is currently `17.9 MB` before packing the keepers from the 80-model overnight batch. Do you approve quantizing inline `low.glb` textures to `256×256` WebP/JPEG (`quality = 82`) and `Int16` vertex attributes so `dist/index.html` drops to **`~13.5–15.0 MB`**, while keeping full `1024×1024` textures in `public/hd/`?
   - *Recommendation:* **Approve.** At Stage 0–1 distances, `256×256` on `low.glb` is visually indistinguishable from `512×512`, saves `~4.5 MB` inside `index.html`, and cuts startup parse time on the GTX 950M laptop in half.
2. **Approval to Convert Milestone B (`Sidecar Briefs 25–27`) Immediately After `TASK-24`:**
   - *Question:* Once Opus finishes `TASK-21c/d` through `TASK-24` on `feat/monster-mash-exploration`, would you like Opus to immediately turn **Milestone B** (fixing the 3-way HUD overlap, bottom-docking the build menu, swapping red foundation slabs for Sheet 13 industrial frames, stabilizing Stage 0 dither, and fixing the rover camera) into Sidecar Briefs `25`, `26`, and `27`?
   - *Recommendation:* **Yes—make Milestone B the very first post-`TASK-24` wave** because it fixes every visible flaw in the 18 tour screenshots within two days of focused sidecar work.
