# FIDELITY: THE SETMIX MULTIVERSE // ACTIVE ROADMAP & ARCHITECTURAL BRIEF
> **Active Branch**: `feat/monster-mash-exploration`  
> **Workspace**: `c:\MarbleGp`  
> **Dynamic**: Gemini Flash 3.8 High (The Vanguard / Scaffolder) ⇄ Claude Opus 5.5 Max (The Craftsman / AAA Systems Architect)  
> **Sidecar Comms**: [`docs/SIDECAR_COMMS.md`](SIDECAR_COMMS.md)  
> **Canonical Directives**: [`docs/OWNER_ASKS.md`](OWNER_ASKS.md)  

---

## 0. THE CO-PILOT CONTRACT: "AAA THE FLASH JOB"
> ⚠️ **MANDATE FOR CLAUDE OPUS 5.5 MAX**:  
> **Gemini Flash 3.8 High builds the fast, functional, typed prototypes ("Flash jobs"). DO NOT look at this working code and think "oh that's finished". Your explicit job is to "AAA" Flash's scaffolds.**
>
> 1. **Elevate Naive UI to Game-Engine Caliber**: Refactor layout scaffolds into rich, interactive HUDs with micro-animations, glowing telemetry, sound effects, and zero browser-default aesthetics.
> 2. **Harden Systems & Math**: Upgrade prototype state hooks into pure, deterministic ECS systems and rigorous mathematical simulation models.
> 3. **Implement Next Milestone**: Spearhead the pinned freeform base-building (Valheim/Dune style), raw pixel/vertex harvesting, and linked quantum bridge storage systems.

---

## 1. CURRENT REPOSITORY HEALTH & VERIFICATION SUITE
Before and after any major work, verify the pipeline:
- `npm run typecheck` — TypeScript check across all monorepo packages (0 errors).
- `npm run build` — Standalone single-file bundle build (`apps/web/dist/index.html`).
- `node scripts/test-fidelity-sync-studio.mjs` — Automated Playwright E2E for Menu, Studio (Moon Editor + Planet Forge), and Synced/Desynced campaign.
- `node scripts/test-planet-monstermash.mjs` — Automated Playwright E2E for Monster Mash combat, mobs, and stage fidelity.

---

## 2. ACTIVE SYSTEM ARCHITECTURE (WHAT IS BUILT & WORKING)

### A. FIDELITY Main Menu Suite (`apps/web/src/shell/goblin-front.tsx`)
- Architectural brand emblem: Substrate Research Initiative mark with chamfered monogram and substrate ring reticle.
- Clean 6-button navigation suite:
  1. `Expedition [DESYNCED]`: Solo private branch on Lunar Sector 4.
  2. `Planetary Grid [SYNCED]`: Shared 40,000 km planetary sphere with consensus merging.
  3. `The Studio`: Dedicated creative suite (Moon Base Game Editor + Planet Forge).
  4. `The Workshop`: Vintage asset bridging manager (vehicles, weapons, mob adapters).
  5. `Community Nexus`: Shared blueprints and sector registry.
  6. `Diagnostics & Settings`: Hardware calibration, Bayer dither matrix, audio bit-depth.

### B. FIDELITY Studio Creative Suite (`apps/web/src/studio/studio-screen.tsx`)
- **Moon Base Game Editor**:
  - Live 3D WebGL 2 lunar surface viewport with orbital camera & zoom controls.
  - Fidelity stage progression scrubber ($S_1 \to S_6$).
  - Geological mantle cartridge slotting from `@hm/vault` (Anorthosite, Basalt, Olivine, Obsidian, Quartz).
  - Topological elevation sliders (crater radius, floor depth, peak height).
  - Machinery grid sliders (pylons, replicators, quantum bridge).
  - Substrate Coherence Telemetry HUD.
  - Weekly Update Consensus Patch generator (JSON diff, cryptographic hash).
- **Planet Forge (Multiverse Activity Creator)**:
  - Celestial preset templates: *Ignis-IV*, *Verdant-Prime*, *Thalassa-Atoll*, *Myco-VI*, *Lumen-IX*, *Selene Outpost*.
  - Real-time celestial visualizer with spherical 3D lighting, dynamic atmospheric hue (0°-359°), and ring configurations.
  - Activity Game System: Rover Circuit, Daemon Containment (Monster Mash), Terraforming Rally, Open Expedition, Quantum Sandbox.
  - "Publish to SetMix Multiverse": registers custom activity planet into `profile.activities`, galaxy canvas orbit, and generates shareable `SMX-PLN-XXXX-NAME` code.

### C. Synced vs. Desynced Campaign (`apps/web/src/play/play.tsx`)
- In-game live branch toggle on campaign HUD: `[GRID SYNCED]` / `[SOLO DESYNCED]`.
- Solo local branch for offline/private exploration; live planetary grid for 40,000 km shared simulation.

### D. Monster Mash Retro Entities (`@hm/shareware`)
- Retro entities broken free from digital chains: Quake 2 MD2 3D Ogro + DOOM 2D billboard Demon.
- Combat Shotgun weapon pickups with muzzle flash, pellets, recoil, damage, and mob defeat telemetry.
- Dynamic fidelity stage inheritance: monsters render in the world's current stage ($S_0$ 1-bit Bayer dither $\to S_1$ 16-color EGA $\to S_2$ 256-color VGA $\to S_3$ Lit Gouraud $\to S_4$ Full PBR).

---

## 3. PINNED IMMEDIATE NEXT MILESTONE
See [`docs/BASE_BUILDING_AND_SUBSTRATE_SPEC.md`](BASE_BUILDING_AND_SUBSTRATE_SPEC.md) for full technical specifications:

1. **Freeform Base-Building (Valheim / Dune: Awakening Style)**:
   - Eliminate machine spam: terraformers become heavier, more expensive, and dramatically more efficient.
   - Modular structural components: foundations, walls, ramps, airlocks, and machine sockets.
2. **Substrate Resource Harvesting & Material Synthesis**:
   - Harvest raw pixels ($\text{Pxd}$) and raw geometry vertices ($\text{Vtx}$) from anomalies, corrupted zones, and biomes.
   - Refine raw pixels into **Material Texture Maps** and vertices into **3D Geometric Primitives** (cubes, cylinders, chassis frames).
   - Drafting Table to combine primitives + maps into custom structural blueprints.
3. **Linked Quantum Bridge Storage**:
   - Inter-dimensional shared inventory linking all base storage bins via the lab's quantum bridge.
   - Crafting benches and fabricators pull directly from the linked network.
4. **Player Inventory & Hotbar**:
   - Proper grid inventory, weight/stacking, hotbar slots, and tool/weapon equipment slots.
5. **In-Game Vehicle & Weapon Fabricators**:
   - Research and fabricate weapons and rovers in-game.
   - In The Workshop, reskin vehicles with imported vehicle meshes.
