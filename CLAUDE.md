# CLAUDE OPUS MASTER CONTEXT & OPERATING DIRECTIVE
> **Game**: *FIDELITY: The SetMix Multiverse* (incorporating *The Resolution Crafter* & *Monster Mash*)  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Active Branch**: `feat/monster-mash-exploration`  
> **Root Workspace**: `c:\MarbleGp`  
> **Sidecar Comms**: [`docs/SIDECAR_COMMS.md`](file:///c:/MarbleGp/docs/SIDECAR_COMMS.md)  
> **Active Roadmap**: [`docs/ACTIVE_ROADMAP.md`](file:///c:/MarbleGp/docs/ACTIVE_ROADMAP.md)  
> **Narrative Bible**: [`docs/NARRATIVE_AND_LORE_BIBLE.md`](file:///c:/MarbleGp/docs/NARRATIVE_AND_LORE_BIBLE.md) | Owner words: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md)

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

---

## 1. THE CARDINAL CONSTITUTION (NON-NEGOTIABLE)
1. **Four Floats, One Formula**:
   $$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
   (Pixel Density, Vertex Density, Light Flux, Aquatic Level). Never propose a 5th global metric.
2. **Purity is Load-Bearing**: All simulation packages must be 100% deterministic pure functions. No `Date.now()`, no `Math.random()`, no direct I/O.
3. **Single-File Zero-Dependency Distribution**: The client builds to a standalone self-contained bundle (`apps/web/dist/index.html`).
4. **Terraforming IS Graphical Fidelity**: As machines run, reality physically upgrades:
   $$\text{Stage 0 (1-bit Bayer Dither)} \to \text{Stage 1 (16-color EGA)} \to \text{Stage 2 (256-color VGA)} \to \text{Stage 3 (Gouraud)} \to \text{Stage 4 (Full PBR)}$$

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
3. **NO FEATURE CREEP / OBEY OWNER ASKS**:
   - Check features against verbatim owner words in [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md).
   - No unrequested chimneys or floating abstract objects. Machines must be grounded and spew colorful pixel plumes while operating.
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

## 6. PINNED FOR NEXT MILESTONE: BASE-BUILDING, SUBSTRATE HARVESTING & LINKED STORAGE
> 📌 **Directive from Owner**: Once current plans and Monster Mash stabilization wrap up, do NOT spiral into premature implementation. This architecture is formally pinned as the immediate next major milestone:

1. **Freeform Base & Machine Construction (Valheim / Dune: Awakening style)**:
   - Move away from machine spam: terraformers become **more expensive, heavier, and far more efficient**.
   - Players build with structural freedom: foundations, walls, ramps, airlocks, and machine hardpoints.
   - Deploy Arena Codex agent to build the base-building ECS package.
2. **Substrate Resource Harvesting & Material Synthesis**:
   - Harvest raw pixels ($\text{Pxd}$) and raw geometry vertices ($\text{Vtx}$) from anomalies and terrain.
   - Refine raw pixels into **Material Texture Maps** and vertices into **3D Geometric Primitives** (cubes, cylinders, chassis frames).
   - Combine primitives + maps at a Drafting Table to create custom structural presets.
3. **Linked Quantum Bridge Storage**:
   - The lab's quantum bridge technology links all base storage containers into an inter-dimensional shared inventory.
   - Crafting benches and fabricators pull directly from the linked storage network.
4. **Player Inventory & Hotbar**:
   - Proper grid inventory, weight/stacking, hotbar slots, and tool/weapon equipment slots.
5. **In-Game Vehicle & Weapon Fabricators**:
   - Vehicles and weapons are researched and built in-game via fabricator benches.
   - In The Workshop, players can skin their rovers with imported vehicle meshes from their favorite games.

