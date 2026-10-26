# PLAN 45: CLAUDE CLOUD STUDIO REALIZATION & POLISH DIRECTIVE

**Author:** Antigravity Overwatch (Gemini)  
**Target Agent:** Claude Opus 5.5 / Sonnet (Claude Cloud Session)  
**Status:** READY FOR CLOUD EXECUTION  
**Active Branch:** `feat/studio-polish-claude-cloud`  
**Reference Report & Screenshots:** [`docs/studio/CRAWLER_REPORT.md`](../studio/CRAWLER_REPORT.md) & [`docs/studio/crawler-shots/`](../studio/crawler-shots/)  

---

## 1. Executive Summary & Context

The Studio overhaul has successfully transitioned from headless TypeScript models into a live, fully verified React/WebGL application at `http://localhost:5173/?studio` (Commit `331ec03a`). The automated web crawler (`scripts/crawl-studio.mjs`) has navigated and captured all 20 canonical screens at 1920×1080 resolution, proving that:
1. Real Three.js WebGL `<canvas>` viewports are mounted across Creative Suite, Look & Lighting, Scene Layout, and Test Play Sandbox.
2. Web Audio API synthesizes procedural sounds with live FFT spectrum and oscilloscope rendering.
3. Interactive SVG node wiring (WireGraph) and 512×512 Spore Card PNG codecs are functional.
4. Programmatic AI navigation (`window.__studioBridge` / `window.__studioNav` via `apps/web/src/studio/studio-ai-bridge.ts`) allows external AI agents to navigate and inspect every state.

### The Mandate for Claude Cloud
Claude Cloud has been commissioned by the Owner to elevate the Studio into a production-grade, fully unified game engine studio and creator tool. This involves 6 major work packages:
1. **Character & Animation Section (`JOB-CLOUD-01`)**: Restore and elevate the modular Character & Animation workspace built from recursive parts (`@hm/partgen` + `@hm/kitspec` + `@hm/kinematic` + `@hm/anim` + `@hm/skin` + `two-bone-ik.ts`), allowing players and AI to build humanoid, creature, and robot avatars with live locomotion blend trees.
2. **Interactive Polygon Modeling & Painting Tools (`JOB-CLOUD-02`)**: Surface `@hm/meshops` (27 operators) into an interactive 3D polygon modeling tool (extrude, bevel, chamfer, subdivide, weld, vertex color painting) directly on the viewport canvas.
3. **Massive Multi-Tier Preset Explosion (`JOB-CLOUD-03`)**: Author loads of new presets across all 5 rungs to create vast variety and possibilities (50+ materials, 30+ part generators, 20+ machine kits, 15+ audio recipes, 10+ planetary biomes).
4. **Dynamic Studio-to-Game Live Binding (`JOB-CLOUD-04`)**: Connect the Studio directly to the actual campaign / example game (`apps/web/src/play/`), ensuring the game is built purely from Studio assets and sliders with **zero hardcoded models or unlinked assets**.
5. **AI Agent Operating Manual & Tutorials (`JOB-CLOUD-05`)**: Author complete documentation and API reference (`studio-agent-skill.md`) so AI agents can use the Studio programmatically.
6. **In-Studio Guided Player Tutorials (`JOB-CLOUD-06`)**: Create onboarding step-by-step creation loops guiding human players through building machines, painting materials, dialing gates, and exporting Spore Cards.

---

## 2. Key Codebase Landmarks & Package Architecture

### Pure Sim & Generator Packages (Deterministic Core)
- `@hm/kitspec` (`packages/kitspec/`): Assembly definitions, socket definitions, bounds, grounding validation (`auditKit`), detail ranks.
- `@hm/partgen` (`packages/partgen/`): Parametric mesh generators (`cylinder`, `box`, `truncated-cone`, `torus`, `flange`, etc.).
- `@hm/meshops` (`packages/meshops/`): 27 real-time mesh deformers (`chamfer-hard-edges`, `taper-flare`, `smooth-taubin`, `twist-helix`, `bend-arc`, `inset-outset-faces`, etc.).
- `@hm/matstack` (`packages/matstack/`): 5-layer surface stacks, PBR channels, mask inputs, weathering age evaluation.
- `@hm/texgraph` (`packages/texgraph/`): Procedural tile graphs, seamless 2x2 wrapping, noise generators, `TILE_LIBRARY`.
- `@hm/kinematic` & `@hm/anim` (`packages/kinematic/`, `packages/anim/`): Inverse kinematics, keyframe curves, blend trees.
- `@hm/skin` (`packages/skin/`): Skeletal mesh rigging, bone vertex weights, envelope deformation.
- `@hm/soundlab` (`packages/soundlab/`): Synthesizer engine recipes, sound stems, frequency glide, biquad filters.
- `@hm/wiregraph` (`packages/wiregraph/`): Directed acyclic graphs for sensor-to-actuator logic.
- `@hm/plotterrain` & `@hm/plotbiome` (`packages/plotterrain/`, `packages/plotbiome/`): Heightfield terrain generation and vegetation scattering.

### Studio React App (`apps/web/src/studio/`)
- `studio-app.tsx`: Studio shell, top navigation, workspace router, 5-rung breadcrumbs.
- `studio-ai-bridge.ts`: Programmatic AI hook (`window.__studioBridge`, `window.__studioNav`).
- `viewport/studio-viewport.tsx`: Three.js WebGL canvas, OrbitControls, 4-angle quad view, raycast picking.
- `viewport/build-studio-machine-model.ts`: Procedural kit-to-Three.js builder, socket pins, MeshOps evaluation.
- `look-tab.tsx`: Look & Lighting 3D terrain canvas, dynamic sun elevation/azimuth shadows, Stage 0..6 scrubber.
- `scene-tab.tsx`: 3D Planetary Outpost staging canvas, 15m twin gate dome, placed machines, terrain brushes.
- `audio-tab.tsx`: Real Web Audio API synthesizer, continuous motor drone, oscilloscope, 32-band FFT.
- `inspectors/`:
  - `matstack-inspector.tsx`: Tier 1 (16 swatches, hover try-on, paint 1/2, age) + Tier 2 (5-layer stack).
  - `kit-assembler-panel.tsx`: Color-coded Triad sockets, Auto-Snap Grounding, Kit Anatomy audit.
  - `texgraph-node-editor.tsx`: 20 seamless presets, 2x2 toroidal wrap canvas, 3D shaded sphere.
  - `partgen-meshops-panel.tsx`: Parametric sliders + interactive 8-operator MeshOps list.
  - `logic-triggers-panel.tsx`: Interactive SVG cubic Bezier node-wiring canvas.
- `modals/`:
  - `spore-card-modal.tsx`: 512x512 visual collectible card, RFC-2083 lossless PNG zTXt metadata.
  - `new-planet-modal.tsx`: Genesis modal for Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$.
  - `test-play-overlay.tsx`: Live 3D playtest sandbox WebGL canvas with WASD avatar, rover, and Beam Rifle.

### Existing Avatar & Animation Foundations (`apps/web/src/avatar/`)
- `custom-avatar-store.ts`: LocalStorage avatar profile store.
- `two-bone-ik.ts`: Real analytical two-bone inverse kinematics with foot grounding.
- `accessories.ts`: Modular visor, backpack, chest plate, shoulder pads.
- `scientist/animator.ts`: AnimationMixer wrapping clips (`idle`, `walk`, `run`, `jump`, `point`, `beam`).
- `create-scientist.tsx` & `create-goblin.tsx`: Existing avatar instances.

---

## 3. Work Package Execution Plan

### `JOB-CLOUD-01`: Character & Animation Studio Workspace
- Add `character-anim` workspace or dedicated 5th inspector tab in Creative Suite.
- Modular Character Assembly:
  - Assemble characters from modular body parts (Head, Torso, Left/Right Arm, Left/Right Leg, Visor, Backpack, Boots).
  - Use `@hm/partgen` + `@hm/kitspec` sockets for limb attachment.
  - Wire `two-bone-ik.ts` and `@hm/kinematic` for procedural foot placement on terrain.
- Animation & Locomotion Editor:
  - Expose gait sliders: Walk Speed, Step Cadence, Stride Length, Arm Swing Amplitude, Torso Lean.
  - Support clip playback and audition: `Idle`, `Walk`, `Run`, `Jump Arc`, `Aim Rifle`, `Wave/Emote`.
  - Connect to `@hm/anim` keyframe tracks.

### `JOB-CLOUD-02`: Interactive Polygon Modeling & Painting Tools
- Polygon Modeling:
  - Surface `@hm/meshops` 27 operators into a visual 3D toolbar.
  - Raycast polygon selection: Click on faces/edges/vertices in the 3D viewport.
  - Action buttons: `[Extrude Face]`, `[Bevel Edge]`, `[Chamfer 45°]`, `[Subdivide]`, `[Taubin Smooth]`, `[Twist]`, `[Bend Arc]`.
  - Parametric numerical inputs for operation depth/offset.
- Painting & Surface Texturing:
  - 3D Mesh Painting: Paint directly onto the 3D model surface using `@hm/matstack` layers as paint channels.
  - Vertex Color Painting: Paint RGB vertex tint onto geometry.
  - Mask Splat Painting: Paint cavity, rust, or edge-wear directly on the 3D mesh via mouse drag.

### `JOB-CLOUD-03`: Massive Multi-Level Preset Library Explosion
- Expand presets across all 5 rungs:
  - **Rung 1 (Tiles)**: Expand `@hm/texgraph` from 20 to 35+ canonical seamless procedural tiles (Carbon fiber, solar cell array, hexagonal heatshield, volcanic basalt, alien moss, worn corrugated sheet, brushed titanium, gold foil insulation, cracked ice, bio-luminescent lichen).
  - **Rung 2 (Materials)**: Expand `@hm/matstack` from 16 to 48+ smart presets across 6 families (Aero-space Alloys, Heavy Industrial, Cryo & Thermal, Bio & Organic, Ancient Alien Artifact, Precision Optical).
  - **Rung 3 (Parts & Audio)**: Add 20+ new parametric generators in `@hm/partgen` (Heat sinks, intake vents, hydraulic pistons, antenna arrays, solar panels, turbine blades). Add 15+ sound synthesis recipes in `@hm/soundlab`.
  - **Rung 4 (Kits)**: Add 8 new complete modular machine assemblies in `@hm/kitspec` (Solar Collector Array, Atmospheric Harvester, Heavy Cargo Hauler, Defense Sentry, Hydroponic Greenhouse, Comm Relay Satellite).
  - **Rung 5 (Biomes & Worlds)**: Add 6 new biome formulas in `@hm/plotbiome` (Crystalline Dunes, Methane Swamp, Glacial Trench, Radioactive Caldera).

### `JOB-CLOUD-04`: Dynamic Studio-to-Game Live Link (Single Source of Truth)
- Eliminate all hardcoded machine/vehicle models in `apps/web/src/play/`.
- Replace static `.glb` or hardcoded procedural fallbacks with dynamic calls to `buildStudioMachineModel()` driven by `studio-store` campaign overrides.
- When the player tunes sliders in the Studio and clicks `[Apply to Campaign / Save]`, the staged JSON payloads (`studio-data/campaign/<kitId>.json`) must automatically load into:
  - The Planetary Outpost (`outpost-world.ts`)
  - The Lab Exploration Scene (`lab-scene.ts`)
  - The Field Machines and Vehicles in Live Play (`play-scene.ts`)
- Ensure bidirectional cartridge support: Cartridges printed in the Lab can be loaded into the Studio, and presets authored in the Studio can be fired via the Beam Rifle in the campaign.

### `JOB-CLOUD-05`: AI Agent Studio Operating Manual & API Reference
- Author `docs/studio/STUDIO_AGENT_OPERATING_MANUAL.md`:
  - Complete documentation of `window.__studioBridge` / `window.__studioNav`.
  - Detailed schema for every method (`selectKit`, `setWeatheringAge`, `assignMaterial`, `navigateWorkspace`, etc.).
  - Playbook for AI agents to inspect, diagnose, and repair broken assets.
  - Headless Node.js test examples using Chrome DevTools Protocol (CDP).

### `JOB-CLOUD-06`: In-Studio Guided Player Tutorials
- Interactive step-by-step tutorial overlay in `apps/web/src/studio/`:
  - Tutorial 1: *"Your First Machine Modification"* (Select Texture Mill -> Change Paint Colors -> Dial Weathering -> Save).
  - Tutorial 2: *"Creating a Custom Seamless Material"* (Open TexGraph -> Add Noise Node -> Tweak Frequency -> Assign to Slot).
  - Tutorial 3: *"Assembling a Modular Vehicle"* (Select Rover Kit -> Attach High-Torque Suspension -> Snap Antennas -> Test Drive in Sandbox).
  - Tutorial 4: *"Genesis of a New Planet"* (Adjust Four Floats -> Pick Biome -> Dial Stargate -> Export Spore Card).

---

## 4. Quality Gates & Constraints for Claude Cloud
- `npm run typecheck` must remain **0 errors** across all workspaces.
- `studio-core.test.ts` and all monorepo test suites must pass.
- Single-file bundle build (`npm run build`) must remain strictly under the **16.00 MiB** budget cap.
- Strict compliance with `RULES 8a`: zero shortcuts, no wrapper stopgaps around legacy GLB meshes, pure recursive presets inside presets.
- Never commit `apps/web/dist/index.html`. Stage specific files only (`git commit -- <paths>`).
