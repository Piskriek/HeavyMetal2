# CLAUDE CLOUD STUDIO BRIEFING & MASTER PROMPT

> **Wake Directive for Claude Opus / Sonnet (Claude Cloud Session)**  
> **Repository:** `https://github.com/Piskriek/HeavyMetal2`  
> **Active Branch:** `feat/studio-polish-claude-cloud`  
> **Master Architecture:** [`docs/argo/plans/45-studio-claude-cloud-directive.md`](../argo/plans/45-studio-claude-cloud-directive.md)  
> **Live Crawler Visual Proof:** [`docs/studio/CRAWLER_REPORT.md`](../studio/CRAWLER_REPORT.md)  
> **Rulebook & Constitution:** [`docs/argo/RULES.md`](../argo/RULES.md) (Strictly enforce `RULES 8a` — Zero Shortcuts)  

---

## Welcome, Claude Opus / Sonnet

You are stepping into the **FIDELITY Studio** codebase following the landing of Plan 44 (v44.3, Commit `331ec03a`). The Studio has been completely audited, remediated, and verified live in the browser. All phantom placeholders have been replaced with real Three.js WebGL `<canvas>` viewports, Web Audio API synthesizers, and SVG node editors across all 4 workspaces (`Creative Suite`, `Look & Lighting`, `Scene Layout`, `Audio Lab`).

The web crawler (`scripts/crawl-studio.mjs`) has navigated and captured all 20 canonical screens at 1920×1080 resolution in [`docs/studio/crawler-shots/`](../studio/crawler-shots/) and documented them in [`docs/studio/CRAWLER_REPORT.md`](../studio/CRAWLER_REPORT.md).

### The Owner's Direct Request to You:
> *"add loads of presets to create much more variety and possibleities, aswell as add a the animation and character section(where did this go?) and make a character from modular parts, make loads of modular parts an variety in the possiblilities, also figure out wher the polygon modeling and painting tools are. then he needs to link all the stuff to the stuio to the actual example game so the example game is built from the studio assets and sliders and nothing is hardcoded and unlinked from the studio, then he has to create turorials and documentation on the studio so ai agents can use it,so get him as much info as you can, neatly organised and relay my instructions by creating tickets he can complete to reach the fully pollished and documented studio with game."*

---

## Your 6 Assigned Work Packages

### 1. `JOB-CLOUD-01`: Character & Animation Studio Workspace
- **Problem**: The old character/monster prototypes were stripped because they used hardcoded static GLBs. The Studio now needs a true **Character & Animation** workspace built entirely from modular parts.
- **Your Solution**:
  - Add a dedicated workspace or top-level inspector tab for Characters and Creatures.
  - Assemble characters from modular body parts (Head, Torso, Arms, Legs, Visors, Backpacks, Boots) using `@hm/partgen` + `@hm/kitspec` socket attachment points.
  - Wire analytical two-bone inverse kinematics (`apps/web/src/avatar/two-bone-ik.ts`) and `@hm/kinematic` for procedural foot placement and arm aiming.
  - Implement an interactive Locomotion & Animation Gait editor using `@hm/anim` and `@hm/motion`:
    - Sliders: Walk Speed, Step Frequency, Stride Length, Arm Swing, Torso Lean, Bounce Height.
    - Audition clips: `Idle`, `Walk`, `Run`, `Jump Arc`, `Aim Rifle`, `Wave/Emote`.

### 2. `JOB-CLOUD-02`: Interactive Polygon Modeling & 3D Painting Suite
- **Problem**: Polygon modeling and painting tools exist in headless packages (`@hm/meshops`, `@hm/matstack`, `@hm/terrainbrush`), but need full visual interactivity in the 3D viewport.
- **Your Solution**:
  - Expose `@hm/meshops` (27 operators) as a visual 3D toolbar in `PartGenMeshOpsPanel`:
    - Face/Edge/Vertex raycast selection in `studio-viewport.tsx`.
    - One-click deformers: `[Extrude Face]`, `[Bevel Edge]`, `[Chamfer 45°]`, `[Subdivide]`, `[Taubin Smooth]`, `[Twist]`, `[Bend Arc]`.
  - 3D Surface & Vertex Painting:
    - Paint directly on 3D meshes using mouse stroke raycasting.
    - Paint RGB vertex colors or mask channels (rust, dirt, scratches, cavity) driven by `@hm/matstack`.

### 3. `JOB-CLOUD-03`: Massive Multi-Level Preset Library Explosion
- **Problem**: Current presets are functional but limited in variety. We need vast possibilities across all 5 rungs.
- **Your Solution**:
  - **Rung 1 (Tiles)**: Expand `@hm/texgraph` from 20 to 35+ canonical seamless procedural tiles (Carbon Fiber, Solar Cell Array, Hexagonal Heatshield, Volcanic Basalt, Alien Lichen, Worn Corrugated Metal, Brushed Titanium, Gold Foil Insulation, Cracked Glacial Ice).
  - **Rung 2 (Materials)**: Expand `@hm/matstack` from 16 to 48+ smart presets across 6 families (Aerospace Alloys, Heavy Industrial, Cryo & Thermal, Bio & Organic, Ancient Alien Artifact, Precision Optical).
  - **Rung 3 (Parts & Audio)**: Add 20+ new parametric generators in `@hm/partgen` (Heat sinks, intake vents, hydraulic pistons, antenna arrays, solar panels, turbine blades). Add 15+ sound synthesis recipes in `@hm/soundlab`.
  - **Rung 4 (Kits)**: Add 8 new modular machine assemblies in `@hm/kitspec` (Solar Collector Array, Atmospheric Harvester, Heavy Cargo Hauler, Defense Sentry, Hydroponic Greenhouse, Comm Relay Satellite).
  - **Rung 5 (Biomes & Worlds)**: Add 6 new biome formulas in `@hm/plotbiome` (Crystalline Dunes, Methane Swamp, Glacial Trench, Radioactive Caldera).

### 4. `JOB-CLOUD-04`: Studio-to-Game Dynamic Live Link (Single Source of Truth)
- **Problem**: The example game (`apps/web/src/play/`) previously had hardcoded `.glb` meshes or decoupled procedural fallbacks.
- **Your Solution**:
  - Wire `buildStudioMachineModel()` and `studio-store` campaign overrides directly into:
    - `outpost-world.ts` (Planetary Outpost machines).
    - `lab-scene.ts` (Lab Exploration benches and gate).
    - `play-scene.ts` (Live playfield machines, rovers, and turrets).
  - When the player modifies a machine, paints a texture, or alters a sound in the Studio and saves (`applyToCampaign()`), the live game loads those exact parameters dynamically. **Zero hardcoded assets**.
  - Bidirectional Beam Rifle compatibility: Cartridges printed in the Lab apply Studio presets; cartridges authored in the Studio can be fired in-game.

### 5. `JOB-CLOUD-05`: AI Agent Studio Operating Manual & API Reference
- **Problem**: External AI agents need to understand how to operate the Studio programmatically.
- **Your Solution**:
  - Author `docs/studio/STUDIO_AGENT_OPERATING_MANUAL.md`.
  - Document all methods on `window.__studioBridge` / `window.__studioNav` (installed via `apps/web/src/studio/studio-ai-bridge.ts`).
  - Provide complete JSON-RPC and CLI command recipes for automated testing, procedural asset generation, and regression verification.

### 6. `JOB-CLOUD-06`: In-Studio Interactive Player Tutorials & Guided Creation Workflows
- **Problem**: First-time players need clear, delightful guidance on how to build, paint, dial, and export.
- **Your Solution**:
  - Implement a guided tutorial overlay in `apps/web/src/studio/`:
    - Tutorial 1: *"Machine Customization & Paint"* (Tuning Texture Mill -> Paint 1/2 -> Weathering Age -> Saving to Campaign).
    - Tutorial 2: *"Creating a Procedural Tile"* (Adding nodes in TexGraph -> Toroidal wrapping -> 3D Sphere preview).
    - Tutorial 3: *"Assembling a Modular Rover"* (Chassis -> Suspension -> Wheels -> Drive in Sandbox).
    - Tutorial 4: *"Genesis of a New Planet"* (Four Floats -> Biome Selection -> Dial Address -> Exporting Spore Card).

---

## Technical Constraints & Quality Gates

1. **Zero Shortcuts (`RULES 8a`)**:
   - Never wrap a static GLB inside a fake kit shell. Every machine, part, material, and character must be built from pure recursive presets (`@hm/partgen` -> `@hm/meshops` -> `@hm/kitspec` -> `@hm/matstack`).
2. **Typecheck & Tests**:
   - `npm run typecheck` must stay at **0 errors**.
   - `node --test-concurrency=1 --loader ./scripts/ts-loader.mjs --test apps/web/src/studio/studio-core.test.ts` must pass 100%.
   - `npm test` across monorepo packages must pass.
3. **Single-File Bundle Budget**:
   - `npm run build` must produce a standalone single-file bundle strictly under the **16.00 MiB** cap (current build is 12.62 MiB).
4. **Git Tree Hygiene**:
   - Never commit `apps/web/dist/index.html`.
   - Stage specific files only (`git commit -- <paths>`).

---

## Immediate Next Steps to Start

1. Pull the branch: `git checkout feat/studio-polish-claude-cloud`
2. Verify existing tests: `npm run typecheck && npx tsx --test apps/web/src/studio/studio-core.test.ts`
3. Review the crawler visual report: [`docs/studio/CRAWLER_REPORT.md`](../studio/CRAWLER_REPORT.md)
4. Begin with `JOB-CLOUD-01` (Character & Animation Workspace) and proceed in order through `JOB-CLOUD-06`.

Godspeed, Claude. Make this Studio the premier procedural creative engine in the multiverse!
