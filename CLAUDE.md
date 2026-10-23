# CLAUDE OPUS MASTER CONTEXT & OPERATING DIRECTIVE
> **NEW SESSION? Read [`docs/RESUME.md`](docs/RESUME.md) first**: the current state, the owner's model rules and the game plan.
> **Creative & Modular Systems Lead (since 2026-10-13): Gemini Argo** ([`.agents/GEMINI.md`](.agents/GEMINI.md), [`docs/argo/START_HERE.md`](docs/argo/START_HERE.md)). Sessions alternate between Claude and Antigravity (Gemini) based on usage; keep [`docs/RESUME.md`](docs/RESUME.md) updated at the end of every session so either environment resumes cleanly.
> **Game**: *FIDELITY: The SetMix Multiverse* (Stargate-style progression campaign & modular preset Studio engine)  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Active Branch**: `feat/monster-mash-exploration`  
> **Root Workspace**: `c:\MarbleGp`  
> **Sidecar Comms & Multi-Agent Job Board**: [`docs/JOB_BOARD.md`](file:///c:/MarbleGp/docs/JOB_BOARD.md) (Launch UI: `COMMAND_CENTER.bat` / `http://localhost:8090`, CLI: `node scripts/agent-worker.mjs --list`) | **Overwatch & Tech Radar**: [`docs/OVERWATCH_TECH_AND_AI_RADAR.md`](file:///c:/MarbleGp/docs/OVERWATCH_TECH_AND_AI_RADAR.md) | [`docs/SIDECAR_COMMS.md`](file:///c:/MarbleGp/docs/SIDECAR_COMMS.md)  
> **Active Plans**: [`docs/argo/plans/`](file:///c:/MarbleGp/docs/argo/plans/README.md) ([38 Kits](docs/argo/plans/38-parts-modules-presets.md) · [39 Four Factories](docs/argo/plans/39-one-pattern-preset-factories.md) · [40 BYOA](docs/argo/plans/40-bring-your-own-agent.md) · [41 Layered Materials](docs/argo/plans/41-layered-materials.md) · [42 Modular Stargate & Earth Endgame](docs/argo/plans/42-modular-stargate-earth-endgame.md) · [43 Modular Motion, Animation & Logic Presets](docs/argo/plans/43-modular-motion-and-logic-presets.md))  
> **Narrative Bible**: [`docs/NARRATIVE_AND_LORE_BIBLE.md`](file:///c:/MarbleGp/docs/NARRATIVE_AND_LORE_BIBLE.md) | Owner words: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md) | Rules: [`docs/argo/RULES.md`](file:///c:/MarbleGp/docs/argo/RULES.md)

---

## 0. THE CO-PILOT CONTRACT: "AAA THE FLASH JOB"
> ⚠️ **CRITICAL DIRECTIVE FOR CLAUDE OPUS 5.5 MAX**:  
> **DO NOT LOOK AT GEMINI FLASH'S CODE AND THINK: *"Oh, that's finished code."***

### The Cognitive Gap & Division of Labor:
- **Gemini Flash 3.8 High (The Vanguard / Scaffolder)**: Optimized for blazing throughput and rapid synthesis. Flash builds the rails, wires routes, satisfies the compiler, sets up WebGL hooks, creates working UI layouts, and ensures green tests.
- **Claude Opus 5.5 Max (The Systems Architect / AAA Craftsman)**: Optimized for deep, multi-step deliberate reasoning, mathematical rigor, and production-grade craftsmanship.

### Your Mandate as Claude Opus:
1. **Never Assume Prototype Code is Final**: Flash builds working functional prototypes ("Flash jobs") so you never face a blank slate or broken build. **Your job is to "AAA" the Flash job**:
   - Turn prototype UI into rich, deeply polished game-engine HUDs with micro-interactions, sound feedback, and live telemetry.
   - Refactor client state and heuristic math into robust, pure ECS architectures and deterministic simulation logic.
   - Deepen physics, collision meshes, stage shaders, and world persistence.
2. **Do Not Become Passive**: If tests pass and TypeScript compiles, that is the *starting line*, not the finish line. Look at the prototype systems (Studio, Planet Forge, Monster Mash mobs, synced campaign) and elevate them into master-tier production systems.
3. **Keep Sidecar Comms Synchronized**: Check [`docs/SIDECAR_COMMS.md`](file:///c:/MarbleGp/docs/SIDECAR_COMMS.md) before and after major architectural shifts.

### Modular Roles & Environment Adaptation (owner, 2026-10-22)
> The names above (Flash, Opus, Argo, Haiku) describe **abilities**, not guaranteed models. Jobs on [`docs/JOB_BOARD.md`](docs/JOB_BOARD.md) name a **Role**; [`docs/agents/roster.json`](docs/agents/roster.json) maps it to a model per environment. Guide: [`docs/agents/ROSTER.md`](docs/agents/ROSTER.md).

- **In Claude Code you may have no Gemini at all.** You are the `OVERSEER` (and usually `ARCHITECT`/`ENGINEER`). Spawn through the Agent tool: `BUILDER` → **Sonnet, high effort**; `RUNNER` → **Haiku, high effort**; `RIG` → `bash scripts/test-on-3dpc.sh`. Review their output before `[DONE]`.
- **Reason less, lean on skills.** Load the job's `Skills:` first (e.g. `frontend` → `/frontend-design`; `route` → `/route` once located). Skill tags resolve per environment via the roster.
- **On every wake:** `node scripts/skill-inventory.mjs` (what is installed; MISSING tags), research new Claude Code skills/plugins and models, update the roster, then `node scripts/agent-worker.mjs --dispatch --env claude-code` for the spawn plan.

---

## 1. THE CARDINAL CONSTITUTION (NON-NEGOTIABLE)
1. **Four Floats, One Formula**:
   $$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
   (Pixel Density, Vertex Density, Light Flux, Aquatic Level). Never propose a 5th global metric.
2. **Purity is Load-Bearing**: All simulation packages must be 100% deterministic pure functions. No `Date.now()`, no `Math.random()`, no direct I/O.
3. **Single-File Zero-Dependency Distribution**: The client builds to a standalone self-contained bundle (`apps/web/dist/index.html`).
4. **Terraforming IS Graphical Fidelity**: As machines run, reality physically upgrades. Every stage is a capture medium. The progression stays Stage 0 to 6 (quests, unlocks and lines key on it); the looks are set by [`docs/argo/plans/27-stage-look-bible.md`](docs/argo/plans/27-stage-look-bible.md) (the owner's wireframe idea, 2026-10-14):
   $$\text{0a (Wireframe, on arrival)} \to \text{0b (1-bit flat-faceted dither, from the first machine)} \to \text{1 (16-color EGA)} \to \text{2 (256-color VGA)} \to \text{3 (Gouraud)} \to \text{4–6 (PBR through the suit camera: water, coverage, forest)}$$

---

## 2. CANONICAL STORY & NARRATIVE BIBLE
> **"A simulation cannot sustain simulations running inside of it."**

- **The Collapse & The Bridge**: Humanity ran experiments to siphon raw compute into our digital creations via "The Bridge". When the compute limit breached, reality's rendering engine broke down.
- **Broken Chains (The Monster Mash)**: Our digital creations are *no longer bound to their simulated chains*. Decades of retro shareware entities (DOOM Demons, Quake Ogres, 2D sprites, MD2 meshes) broke into physical reality.
- **The Shielded Lab & Moon Portal**: The player's white-room lab is quantum-shielded on Earth. Reversing the bridge opened a freestanding portal to the desolate Moon.
- **The Mission**: Setting up terraforming machines on the moon triggers an expanding radial resolution wave. The goal is to restore universal fidelity before the simulation collapse spreads back to Earth.
- **Narrator Voice**: Female scientist radio mentor guiding through Acts I–IV.

---

## 3. DRIFT GUARDS: KEEPING CLAUDE HONEST & FOCUSED
> ⚠️ **Claude's high reasoning causes tunnel-vision drift. Keep these guards active at all times:**

1. **NO VECTOR / SVG CONCEPT ART**:
   - **NEVER sketch crude SVG or vector graphic concept art.**
   - Concept art is produced by **Arena.ai Codex / Art agents** (see [`docs/concept/setmix/`](file:///c:/MarbleGp/docs/concept/setmix/)).
   - Claude reviews, plans, and builds toward approved concept art; Claude does not draw art.
2. **LOAD FRONTEND DESIGN SKILLS (`/frontend`)**:
   - Do NOT ship bare, unstyled DOM, raw buttons, or browser defaults.
   - Always load and apply frontend design skills: rich CSS design systems, dark mode, glassmorphism, glowing telemetry, Outfit/Inter typography, responsive layouts, and polished micro-animations.
3. **WHO DECIDES, AND NO DRIFT (owner, 2026-10-14)**:
   - **Opus (engineering) and Gemini Argo (creative lead) own the creative and design calls:** lore, narration, features, designs and styles. The owner provides tokens, credits and unblocking, and reviews the results objectively. His words: "its yours and Argo's call to expand on the game/lore and make those decisions".
   - Decide deliberately: research, plan and record each decision in [`docs/argo/plans/`](docs/argo/plans/README.md) or the briefs, then build. Arena GDDs are ideas, never decisions.
   - **The owner's explicit rules still bind:**
     - the constitution;
     - single file plus HD pack;
     - the min-spec laptop;
     - square sections, nothing floating, no lettering;
     - believable grounded machines that spew colourful pixel plumes only while operating;
     - legal art only;
     - research first.
     
     Changing one of them needs his yes. Check [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md) for them, and act on his review reports.
   - No chimneys or floating abstract objects (the 2026-10-06 lesson).
4. **RESEARCH BEFORE YOU DESIGN (SOP, owner 2026-10-10)**:
   - Before designing any feature, system, piece list, rule set or UI, research it first: how the closest comparable games do it; what players praise and complain about (Steam threads, feature-request boards, and popular mods, which show unmet needs); and the newest releases and techniques. *"These days there is always a new innovation and we are pushing the frontier."*
   - Write the findings with sources as a research doc (pattern: [`docs/BASE_BUILDING_RESEARCH.md`](docs/BASE_BUILDING_RESEARCH.md)), then brief Arena, the art agent or the sidecar. Anything beyond the owner's words is a proposal for the owner.
5. **SAVE REASONING FOR ARCHITECTURE & INTEGRATION**:
   - Delegate heavy self-contained modules to Arena AI battles; save Claude reasoning tokens for high-level architecture, glue, and review.

---

## 4. ARENA.AI OPERATING PROCEDURE (TRUNCATED)
- **Role**: Arena battle AIs write heavy, self-contained pure TypeScript packages; Claude writes the glue (schemas, UI windows, e2e, integration).
- **Rules**:
  - 2 battles at a time (captcha limit).
  - Prompts < 5,000 characters.
  - Pure TypeScript, strict types (`noUncheckedIndexedAccess`), zero DOM/Date/Math.random.
  - Reply route receiver: `scripts/arena-recv.mjs` (127.0.0.1:8791) writes to `arena-out/<pkg>/`.
- **Full Reference**: Read [`docs/ACTIVE_ROADMAP.md`](file:///c:/MarbleGp/docs/ACTIVE_ROADMAP.md) and [`docs/ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md`](file:///c:/MarbleGp/docs/ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md) when preparing or running battles.

---

## 5. CURRENT FIDELITY BASE GAME & STUDIO SUITE STATE (`feat/monster-mash-exploration`)
- **FIDELITY Creative Studio (`apps/web/src/studio/studio-screen.tsx`)**:
  - **Moon Base Game Editor**:
    - Live 3D WebGL 2 lunar surface viewport with orbit camera & zoom controls.
    - Fidelity stage progression scrubber ($S_1$ through $S_6$).
    - Geological mantle cartridge slotting from `@hm/vault` (Lunar Anorthosite, Basalt, Olivine, Obsidian, Quartz, etc.).
    - Topological elevation tuning (crater radius, floor depth, peak height).
    - Machinery grid controls (pylon density, replicator yield, quantum bridge bandwidth).
    - Substrate Coherence Telemetry HUD (resolution, lattice spacing, vertex budget, sync drift).
    - Weekly Update Consensus Patch generator (JSON diff, cryptographic hash, submit to consensus queue).
  - **Planet Forge (Multiverse Activity Creator)**:
    - Celestial preset templates: *Ignis-IV Caldera* (Volcano), *Verdant-Prime Canopy* (Emerald), *Thalassa-Atoll Basin* (Coral), *Myco-VI Steppe* (Spore), *Lumen-IX Flats* (Prismata), *Selene Outpost* (Lunar).
    - Real-time celestial visualizer with spherical 3D lighting, dynamic atmospheric hue (0°-359°), and ring configurations (none, thin, dense, dual).
    - Activity Game System: Rover Circuit, Daemon Containment (Monster Mash), Terraforming Rally, Open Expedition, Quantum Sandbox.
    - "Publish to SetMix Multiverse": registers custom activity planet into `profile.activities`, galaxy canvas orbit, and generates shareable `SMX-PLN-XXXX-NAME` code.
- **Eradication of Legacy Island from Studio**:
  - `toStudio` completely decoupled from old `openRaceWorld()` / `MapMaker` island path.
  - Studio route is its own dedicated creative screen (`screen === 'studio'`).
- **Unified Synced vs. Desynced Campaign**:
  - Desynced (solo local branch) vs Synced (40,000 km shared world with majority-rules merging).
  - In-game live branch toggle on campaign HUD (`[GRID SYNCED]` / `[SOLO DESYNCED]`).
- **Monster Mash Retro Entities (`@hm/shareware`)**:
  - Quake 2 MD2 3D Ogro + DOOM 2D billboard Demon with shotgun weapon pickups and combat telemetry.
- **Verification Workflow**:
  - `npm run typecheck` — TypeScript check across all packages (0 errors).
  - `npm run build` — Build single-file production bundle (`dist/index.html`).
  - `node scripts/test-fidelity-sync-studio.mjs` — Automated Playwright test verifying Main Menu, Studio (Moon Editor + Planet Forge), and Synced/Desynced campaign.
  - `node scripts/test-planet-monstermash.mjs` — Automated Playwright test verifying mobs, combat, and rendering.

---

## 6. CURRENT ARCHITECTURAL MILESTONES (PLANS 38–43: "THE BAKERY & THE CAKE")
> 📌 **Core Mandate (Owner, 2026-10-20 to 2026-10-22)**: The *FIDELITY* Stargate campaign is completely modular—every machine, structure, material, sprite, locomotion/jump gait, animation, code logic rule, audio stem, light, and species is built from recursive **presets inside presets** (`Rung 1 Atoms -> Rung 2 Stack/Curve -> Rung 3 Part/Clip/Stem -> Rung 4 Kit/Assembly -> Rung 5 Cartridge/World`) that players tweak with **sliders + live turntable previews in-game** and control completely inside **The Studio** ([`docs/argo/plans/42-modular-stargate-earth-endgame.md`](docs/argo/plans/42-modular-stargate-earth-endgame.md), [`docs/argo/plans/43-modular-motion-and-logic-presets.md`](docs/argo/plans/43-modular-motion-and-logic-presets.md)).

1. **Universal Recursive Preset Factories ([Plan 38](docs/argo/plans/38-parts-modules-presets.md), [Plan 39](docs/argo/plans/39-one-pattern-preset-factories.md), [Plan 41](docs/argo/plans/41-layered-materials.md), [Plan 43](docs/argo/plans/43-modular-motion-and-logic-presets.md))**:
   - **Vtx (`@hm/partgen`, `@hm/kitspec`, `@hm/meshops`)**: Parametric parts and operator stacks assembled into modules and machines (`TICKET-40` from-scratch modular rebuilds; no wrapper shortcuts around old cores per `RULES 8a`).
   - **Pxd & Sprites (`@hm/texgraph`, `@hm/matstack`, `@hm/shareware`, `@hm/skin`, `layered-material.ts`)**: 5-level layered materials (Tile $\to$ Surface $\to$ Mask $\to$ Layer $\to$ Material) and 8-angle Stage 0–2 shareware sprite/billboard generators (`JOB-20`) with edge/cavity vertex attributes, rank 0/1/2 rendering, and `matc:` / `pxdc:` share codes.
   - **Aq (`@hm/treegen`, `@hm/flora`)**: Parametric species presets with live turntable preview and up to 6 variant slots per plot.
   - **Lx & Audio (`lx:`, `@hm/soundlab`, `@hm/musicbox`)**: Kelvin warmth, signal colour, intensity, and pulse/flicker lamp/sky presets plus procedural synth & stage music stem presets (`JOB-20`).
   - **Locomotion, Stage-Quantized Animation & Logic (`@hm/kinematic`, `@hm/anim`, `@hm/triggers`, `@hm/wiregraph`, `@hm/npcbrain` — [Plan 43](docs/argo/plans/43-modular-motion-and-logic-presets.md) / `JOB-19`)**:
     - `LOCOMOTION_PRESETS` (`earth-standard`, `lunar-ballast`, `lunar-low-g`, `arcade-quake`) with `stepVerticalJump`, `Space` jump, and in-game sliders.
     - Stage-quantized animation rates (`stageAnimRateHz`: `8 Hz` $S_0 \to$ `12 Hz` $S_1 \to$ `18 Hz` $S_2 \to$ `30 Hz` $S_3 \to$ `60+ Hz` + IK + spring-damper $S_4\text{--}S_6$) and declarative `KitMotionSpec` on `@hm/kitspec` sockets.
     - Modular logic presets (`logic:`) for Auto-Doors, Turrets, Stargate Iris locks, and Monster Spawners.
2. **Bring Your Own Agent Studio API ([Plan 40](docs/argo/plans/40-bring-your-own-agent.md))**:
   - `window.studioAgent`, `scripts/studio-agent-bridge.mjs`, and `studio-skill.md` allowing external coding agents and human creators to inspect (`studio.capture` 4-angle + mask views), validate (`studio.kit.validate`), and propose staged edits to any Studio document or preset.
3. **Stage-6 Earth Restoration & Dual-World Sandbox ([Plan 42](docs/argo/plans/42-modular-stargate-earth-endgame.md))**:
   - Progressing through $S_0 \to S_6$ teaches the player how the Studio's procedural tools work.
   - Unlocking all 6 stages saves Earth, unlocking full sandbox building on both the **Earth Plot** and the **Moon Plot** so players can create custom games with the preset library and share them with the network.
4. **Movable, Lockable & Random-Dialable Stargates ([Plan 42](docs/argo/plans/42-modular-stargate-earth-endgame.md))**:
   - Plot owners can **move/reposition their Gate** (`moveGate`) or **close/lock it off** (`gateAccess: 'open' | 'code-only' | 'closed'`).
   - Explorers can **dial random open gates** (`dialRandomGate` in `@hm/coopnet`) to endlessly explore and compare player worlds across the network.
5. **Base-Building, Linked Storage & Fabricators**:
   - Valheim/Dune-style structural pieces (`@hm/structure`, `@hm/basekit`), 256-slot linked quantum bridge storage (`@hm/lattice`, `@hm/bridgekit`), and in-game vehicle/weapon fabricators.

