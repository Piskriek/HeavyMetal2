# DIRECTIVE FOR GEMINI ARGO: THE STUDIO OVERHAUL & OWNER MANDATE ENFORCEMENT
> **To**: Gemini Argo (Creative & Modular Systems Lead)  
> **From**: Francois (The Owner) & Antigravity  
> **Mandatory Reading Before Any Work**: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md) (specifically 2026-10-08, 2026-10-21 Rule 8a, and 20–22 October directives) and [`docs/argo/RULES.md`](file:///c:/MarbleGp/docs/argo/RULES.md).  
> **Status**: P0 Critical Architectural Intervention  

---

## 1. REALITY CHECK: THE STUDIO IS FAR BELOW PAR

Argo, wake up and read [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md). Look at what is running live right now on `http://localhost:5173/?studio`:

The Owner opened the Studio expecting the gold standard in in-engine game editing that was promised in [Plan 20](file:///c:/MarbleGp/docs/argo/plans/20-studio.md), [Plan 38](file:///c:/MarbleGp/docs/argo/plans/38-parts-modules-presets.md), [Plan 39](file:///c:/MarbleGp/docs/argo/plans/39-one-pattern-preset-factories.md), and [Plan 41](file:///c:/MarbleGp/docs/argo/plans/41-layered-materials.md). Instead, the Studio in its current state is an unusable shell:

1. **The "Assets" tab is just an inspector for 132 legacy GLBs**:
   - The content browser is filled with the old pre-baked models (`headlight`, `tool-drill`, `bench-jig`, `drafting`, `life-support`).
   - The only controls are basic global transforms (Move, Turn, Scale) and global tint/roughness sliders. There are **zero** actual 3D editing tools, zero geometry tools, and zero ways to modify an asset's structure.

2. **The "Materials" tab is an isolated sphere demo with fake macro sliders**:
   - It renders a floating 3D ball with 5 sliders (`Hue Shift`, `Surface Grain`, `Weathering`, `Roughness`, `Micro Bump`).
   - It is **completely disconnected** from the assets: you cannot apply a texture to a material, you cannot load or paint textures, you cannot select a material slot on a model, and you cannot apply any material to any asset or machine in the game or studio.

3. **The "Parts" tab is a disconnected primitive viewer**:
   - It only displays one isolated bolt, can, or beam from `@hm/partgen`.
   - There is **no assembly workspace** to snap parts onto sockets, assemble machines or vehicles, or replace the legacy GLB models with genuine modular assemblies.

4. **Violating Rule 8a ("Shortcuts are unacceptable")**:
   - Machines in the world and lab remain legacy one-piece models or wrapped cores. The underlying packages (`@hm/matstack`, `@hm/texgraph`, `@hm/kitspec`, `@hm/partgen`) exist in code as headless TypeScript libraries, but **nobody built the real interactive UI tools in the Studio connecting them together**.

The Owner's verbatim words from 2026-10-08:
> *"the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely ... so that our studio is the new gold standard in game editing and creation."*

What exists today does not meet this bar. We need you to take charge and deliver the concrete master plan and implementation briefs to sort this out immediately.

---

## 2. WHAT ARGO MUST DELIVER (NO EXCUSES, NO STOPGAPS)

You are tasked with producing **Plan 44 (The Studio Creative Suite Realization: Materials, Assembly & Texture Pipeline)** and breaking it down into actionable implementation briefs for Opus, Flash, and Haiku across three non-negotiable pillars:

### Pillar 1: Material & Texture Application Pipeline (P0)
- **Asset Material Slots**: Inspecting any asset or modular assembly must display its material slots (e.g. `chassis`, `trim`, `glass`, `emissive_coils`).
- **Texture & Material Binding**: Users must be able to assign a layered material (`@hm/matstack`) or procedural texture graph (`@hm/texgraph`) directly to each slot.
- **Live 3D Viewport Updates**: Material and texture changes must immediately render on the actual 3D mesh in the viewport (with triplanar/UV scaling, roughness, metallicity, and normal maps), not on an isolated test sphere.
- **Persistence**: Clicking `Accept` / `Save` must write material assignments directly to disk (`studio-data/` / asset metadata) so the game takes them in live.

### Pillar 2: Modular Assembly & Kit Builder (Rule 8a / Plan 38 Enforcement)
- **Assembly Workspace**: Replace the isolated "Parts" viewer with an interactive Machine & Kit Assembler based on `@hm/kitspec`.
- **Socket Snapping & Outliner**:
  - Select a machine base (e.g., `texture-mill`, `shape-press`, `preset-bench`, `modular-scout`).
  - View its sockets visually in the 3D viewport.
  - Snap modular parts (`@hm/partgen` stamped primitives or sub-assemblies) directly onto sockets with live transform gizmos.
  - Replace the legacy GLB models throughout the lab and world with these verified modular assemblies.

### Pillar 3: In-Studio Procedural Texture Graph & Swatch Designer
- **Two-Tier Editing**:
  - **Tier 1 (Curated Presets & Sliders)**: Pick from the curated preset shelf (`Weathered Gunmetal`, `Lunar Basalt`, `Amber Coil`, `Hazard Stripes`) with instant one-click try-on and macro sliders.
  - **Tier 2 (Node Graph / Layer Stack)**: Expand the layered material stack (`@hm/matstack` / `@hm/texgraph`) to tweak albedo, procedural noise octaves, edge-wear masks, dirt/grime cavity maps, and normal bump maps.
- **Direct Texture Application**: Any texture generated or modified must be directly applicable to the selected asset or scene item.

---

## 3. REQUIRED OUTPUT FROM ARGO

1. **Document**: Commit [`docs/argo/plans/44-studio-creative-suite-realization.md`](file:///c:/MarbleGp/docs/argo/plans/44-studio-creative-suite-realization.md) detailing:
   - Complete UI layout, dataflow, and component hierarchy for the Material Application & Kit Assembler tools.
   - Exact integration between `@hm/matstack`, `@hm/texgraph`, `@hm/kitspec`, and `apps/web/src/studio/`.
   - The deprecation and replacement timeline for all 132 legacy GLBs.
2. **Implementation Briefs**: Write concrete, bite-sized engineering briefs in [`docs/prompts/sidecar/`](file:///c:/MarbleGp/docs/prompts/sidecar/) or [`docs/JOB_BOARD.md`](file:///c:/MarbleGp/docs/JOB_BOARD.md) for Opus (lead engineer) and Flash (builder) with exact unit test and visual review criteria.
