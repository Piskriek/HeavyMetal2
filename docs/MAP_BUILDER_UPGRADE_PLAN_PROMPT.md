# PROMPT: High-End Architectural Plan for Heavy Metal GP 2 Map Builder Upgrade

> **Target AI**: Frontier Planning / Systems Architecture AI (Codex, Claude 3.5 Sonnet / Opus, OpenAI o1-preview)
> **Goal**: Generate a production-grade, interactive, typed architectural plan (matching the schema of `temp/codex_plan` with `tickets.ts`, `interfaces.ts`, `decisions.ts`, `redteam.ts`, and interactive simulator demos) to transform the *Heavy Metal GP 2* 3D Track Builder into a joyful, professional, high-performance 3D scene editor.

---

```markdown
# MISSION BRIEF: Heavy Metal GP 2 — Next-Gen 3D Map Builder & Asset Pipeline Architecture

## 1. EXECUTIVE CONTEXT & PURPOSE
You are acting as the Principal Graphics, Physics & Tools Engine Architect for **Heavy Metal GP 2**, a high-octane 3D dieselpunk goblin marble racing game running on WebGL (Three.js), React 19, and TypeScript.

The current 3D Track Builder allows placing 2D cutout billboard sprites, simple wedge stunt ramps, and bezier lane paths over a procedural roller-coaster race track ribbon. While functional, the tooling lacks modern 3D world-building ergonomics, cannot import arbitrary 3D models (GLTF/GLB/OBJ), lacks static collision/terrain designation, and suffers from draw-call overhead on densely decorated scenes.

Your mission is to produce a comprehensive, battle-hardened, typed implementation plan that elevates the builder into an intuitive, artist-grade "Blender/Godot in the Browser" workflow.

### Key Upgrade Objectives:
1. **Joyful Workspace & Ergonomics (QoL)**: 3D Transform Gizmo (translate, rotate, scale with snapping), multi-selection & grouping, raycast surface snapping, camera orbit/fly modes, collapsible drawer layout themed in ornate dieselpunk brass/iron.
2. **3D Model Import & Export Pipeline**: In-browser GLTF 2.0 / GLB / OBJ loading, asset library persistence (IndexedDB), static collision terrain vs. static decoration vs. dynamic obstacle tagging, full scene GLTF export for Blender round-tripping.
3. **Lit vs. Unlit Material & Shader Pipeline**: Flexible PBR (`MeshStandardMaterial`) with biome sun/ambient lighting vs. stylized unlit (`MeshBasicMaterial`) for glowing emissives/neon and potato-spec performance.
4. **Cheap Post-Processing & Atmospheric FX**: High-performance, single-pass/minimal-pass WebGL post-processing (fast bloom for emissives/boosts, tonemapping, depth fog matched to `SKY_PRESETS`, vignette, subtle film grain).
5. **Lightmap & Vertex Lighting Bake + Draw Call Batching**: Static vertex-color AO and directional lighting baker (0 extra texture memory!), texture atlas combiner, and automatic `InstancedMesh` batching for repeated static props.
6. **Robust, Non-Destructive Persistence**: Storage Schema v2 with backward-compatible v1 migration, unknown field preservation, and quota-safe asset bundling.

---

## 2. EXISTING CODEBASE & ARCHITECTURAL DOSSIER

### 2.1 Technology Stack & Constraints
- **Core Engine**: Three.js (`^0.186.0`), WebGL 2.0 forward renderer.
- **Frontend**: React 19 (`19.2.6`), TypeScript 5.9, Tailwind CSS v4, Lucide React, Framer Motion.
- **Build System**: Vite 7 (`7.3.2`), `vite-plugin-singlefile` (production standalone single-file distribution capability).
- **Test Framework**: Node.js test runner via `scripts/check.mjs` and `tsx`.
- **CRITICAL CONSTRAINT**: Must preserve 100% test pass parity (`npm run check` currently passes 641 tests across 47 suites). Physics simulation is deterministic (120 Hz tick rate) and must never drift due to visual or tooling changes.

### 2.2 Coordinate Systems & Spaces (`src/game/track-space.ts`)
- **Engine Space**: 1D distance $x \in [190, 72190]$ where $x = 190 + 2 \times \text{distance}$. Marble physics moves down this space with velocity $v_x$ (units/sec).
- **Spline Space**: Arc-length $s \in [0, L]$, sampled every 50 units. Lane lateral coordinate $z \in [-480, +480]$ across track half-width.
- **World Space**: 3D Cartesian coordinates $(X, Y, Z)$ evaluated from track spline frames (`pos`, `tangent`, `normal/up`, `binormal/right`):
  $$\mathbf{P}_{\text{world}} = \mathbf{P}_{\text{frame}}(s) + \mathbf{R}_{\text{frame}} \cdot \left(\frac{z}{480}\right) \cdot (W_{\text{half}}(s) - 1.2R) + \mathbf{U}_{\text{frame}} \cdot (R + \text{altitude})$$
  (where $R = 31$ is marble radius).
- **Physical Ramps & Collisions**: `PhysicalRampSurface` defines physical collision planes compiled from placed props (`src/game/track-space.ts:compileRampSurfaces`).

### 2.3 Current Track Builder Architecture (`src/game/track-builder-3d.ts`)
- `TrackBuilder3D`: Owns `THREE.Scene`, `THREE.PerspectiveCamera`, track mesh reference, and placed props group.
  - Controls free-fly camera (`updateFlyCamera(dt, keys)`).
  - Raycasting against track spline ribbon and terrain meshes (`raycastSurface(pointer)`).
  - Undo/Redo stack: Deep JSON snapshots pushed to `history: string[]`.
  - Prop Data Model:
    ```typescript
    export interface PlacedProp {
      id: string;
      type: string;
      name: string;
      x: number; y: number; z: number;
      rotY: number; rotZ?: number; rotX?: number;
      quaternion?: [number, number, number, number];
      scale: number;
      width?: number; height?: number; depth?: number;
      alignToTrack: boolean;
      trackDist?: number;
      cameraFacing?: boolean;
      flipX?: boolean;
      isDecal?: boolean;
      groupId?: string;
      lit?: boolean;
      visible?: boolean;
      animate?: boolean; animated?: boolean; animSpeed?: number;
      animFrames?: boolean[]; animFrameDelays?: number[];
      authoringNotes?: string;
      [key: string]: unknown;
    }
    ```
- `PROP_DEFINITIONS`: Catalog of ~80 props. Currently supports 2D PNG billboards, decals, animated sprite sheets, and a hardcoded procedural wedge ramp (`wedgeMesh`) and slingshot (`createSlingshotMesh`). **Arbitrary 3D meshes (GLTF/OBJ) are not yet supported.**
- Storage: Version 1 schema stored in `localStorage` under `hm2-track-props-v1` (`src/game/track-storage.ts`).
- UI: `TrackBuilderUI.tsx` with top toolbar, bottom category tabs, left props drawer, and right inspector.

### 2.4 Rendering Pipeline (`src/game/renderer-3d.ts` & `src/game/effects/renderer-fx.ts`)
- `ThreeSceneRenderer`: Owns scene, directional sun light, ambient light, skybox dome (`SKY_PRESETS`), terrain meshes (`ALPINE`, `CAVE`, `VALLEY`), and marble racer meshes.
- Materials: PBR `MeshStandardMaterial` for terrain, track ribbon, and wood/iron surfaces; `MeshBasicMaterial` for unlit particles/decals.
- `EffectRenderer`: Preallocated pool of 64 billboard meshes and point cloud particles for sparks and explosions.

---

## 3. CORE UPGRADE SPECIFICATION & EPIC PILLARS

### PILLAR 1: Joyful Builder Ergonomics & 3D Manipulation
1. **Interactive 3D Transform Gizmos**:
   - Provide interactive 3D handles for **Translate** (3 axis arrows + 3 planar quads), **Rotate** (3 Euler rings + screen-space gimbal circle), and **Scale** (3 axis boxes + central uniform cube).
   - Mode switching: `W` (Translate), `E` (Rotate), `R` (Scale).
   - Transform spaces: Toggle between **Local** (aligned to prop orientation/track frame) and **World** (global XYZ axes) via `Q`.
   - Magnetic Snapping:
     - Translation snap: Configurable grid increments (Off, 10, 50, 100 world units).
     - Rotation snap: Configurable angular increments (Off, 15°, 45°, 90°).
     - Surface Snap: Raycast to track surface, aligning prop normal to track tangent frame or ground normal.
     - Centerline Snap: Magnetically snap lateral position to $z = 0$ or lane positions.
2. **Multi-Selection, Grouping & Hierarchy**:
   - Marquee / Box select (drag rectangle on canvas) and `Shift+Click` multi-select.
   - Grouping: `Ctrl+G` groups selected props under a virtual parent container with computed centroid; `Ctrl+Shift+G` ungroups.
   - Batch transformation: Moving/rotating a group moves all members maintaining relative offsets.
   - Alignment tools: Align X/Y/Z, distribute spacing evenly, match scale.
3. **Camera Navigation Rigs**:
   - **Fly Mode**: Hold Right-Click + WASD, Space (up), Z (down), Shift (turbo fly).
   - **Orbit Mode**: `Alt + Left-Click Drag` orbits around the active selection centroid; Scroll wheel zooms.
   - **Focus**: `F` key frames the camera smoothly onto the selected prop(s).
   - **Orthographic Projections**: Toggle Top (`Numpad 7`), Front (`Numpad 1`), and Side (`Numpad 3`) views.
4. **Forged Iron & Brass Workspace Layout**:
   - Collapsible drawer system matching `frames.css`/`menu.css`:
     - Left Drawer: Asset Catalog & 3D Model Library (collapsible with edge tab).
     - Right Drawer: Inspector (Transform, Collision, Shading, Lighting, Animation).
     - Bottom Dock: Timeline / Lanes / Palette (collapsible, resizable height).
     - Zen Mode: `H` hides all UI overlays except a subtle restore button for pure scenic authoring.

---

### PILLAR 2: 3D Model Import & Export Pipeline (GLTF / GLB / OBJ)
1. **In-Browser Model Ingestion**:
   - Accept `.glb`, `.gltf` (with embedded or external buffers/textures), and `.obj` (+ `.mtl`).
   - Drag-and-drop onto the builder canvas or explicit "Import 3D Asset" file dialog.
   - Ingestion validation & sanitization:
     - Inspect geometry vertex counts (warn if $> 50{,}000$ tris).
     - Compute axis-aligned bounding box (AABB) and auto-scale / normalize suggested dimensions.
     - Offscreen thumbnail generation: Render model preview with standard lighting into a 128x128 canvas, cached as a data URL for UI cards.
2. **Asset Library Persistence (IndexedDB)**:
   - Store imported 3D model files (binary ArrayBuffers) in an IndexedDB store (`hm2_custom_assets`).
   - Custom props appear in a dedicated "Custom 3D" builder palette tab and persist across reloads.
3. **Static vs. Dynamic Roles & Collision Hull Generation**:
   - **Static Terrain / Road Extension**:
     - The mesh is marked as drivable terrain.
     - Collision generation: Extract world-space triangle soup or generate simplified convex decomposition.
     - Integrate collision triangles into the physical surface registry (`PhysicalRampSurface` / `TrackSpaceMap`) so marbles collide, roll, jump, and bank off imported 3D track pieces, bridges, and terrain chunks.
   - **Static Scenery / Decoration**:
     - Visual-only mesh with no physics cost. Frustum culled via bounding spheres.
   - **Dynamic / Obstacle / Trigger**:
     - Tagged as bouncy barrier, hazard / kill zone, speed boost gate, or rotating obstacle.
4. **Full Scene & Asset Export**:
   - **Export GLTF Scene**: Export entire decorated track as a standard `.glb` file using `three/addons/exporters/GLTFExporter`, enabling artists to take the track into Blender, Unreal, or Godot.
   - **Track Package Export**: Export `.hmt` (Heavy Metal Track) JSON package containing prop definitions, lane paths, and referenced custom binary 3D assets bundled as base64 or zip.

---

### PILLAR 3: Lit vs. Unlit Material & Shading Configurator
1. **PBR Lit Mode (`MeshStandardMaterial`)**:
   - Full interaction with directional sun light, shadow maps, and biome ambient light.
   - Inspector controls:
     - Albedo tint color picker.
     - Roughness & Metalness sliders ($0.0 \dots 1.0$).
     - Normal map intensity multiplier.
     - Emissive color & intensity (for glowing parts).
     - Double-sided rendering toggle.
2. **Stylized Unlit Mode (`MeshBasicMaterial`)**:
   - Unaffected by scene lighting, preserving pure author texture colors.
   - Ideal for glowing magical runes, lava surfaces, neon signs, holographic arrows, and low-end mobile devices.
3. **Biome Adaptive Shading**:
   - Option to auto-tint props based on track biome (e.g., warm golden amber in Canyon, cool mist blue in Alpine, fiery orange in Cavern).

---

### PILLAR 4: Fast Post-Processing & Visual FX
1. **Lightweight Post-Processing Stack**:
   - Must run at 60-120 FPS on integrated GPUs without tanking frame rate.
   - Use a lightweight, combined single-pass or dual-pass shader pipeline (via `EffectComposer` or custom fullscreen quad):
     - **Tone Mapping & Exposure**: ACES Filmic or Reinhard tone mapping to prevent blown-out highlights.
     - **Fast Kawase / Dual-Filtering Bloom**: Low-overhead downsample/upsample blur for emissive materials, torches, lava, and boost gates.
     - **Atmospheric Depth Fog**: Exponential squared distance/height fog matching active `SKY_PRESETS` horizon colors.
     - **Dieselpunk Stylization**: Subtle vignette, adjustable film grain / dither, and optional speed-burst chromatic aberration.
2. **Runtime Quality Scaler**:
   - Low (Post-processing disabled, standard WebGL clear).
   - Medium (Depth fog + Tonemapping + Vignette).
   - High (Bloom + Tonemapping + Depth Fog + Subtle Grain).

---

### PILLAR 5: Lightmap / Vertex Lighting Baker & Draw Call Batching
1. **Vertex Lighting & Ambient Occlusion (AO) Baker**:
   - Why: High-fidelity lighting and contact shadows without the runtime cost of dynamic shadows or extra texture memory.
   - Implementation: In-editor raycast/hemisphere sample baker that computes direct sun shadow occlusion + ambient skylight for static meshes and track geometry.
   - Output: Written directly into `geometry.attributes.color` (Float32Array). The shader multiplies albedo by vertex color ($0$ draw calls added, $0$ VRAM allocated for lightmap textures).
2. **Automatic InstancedMesh Batching**:
   - Detect repeated identical static props (trees, rocks, barriers, lanterns) sharing identical geometry and material.
   - Merge them into `THREE.InstancedMesh` at race start or builder bake time.
   - Reduces draw calls from 500+ down to $< 20$, dramatically boosting frame rates on low-end hardware.
3. **Texture Atlas Combiner (Optional/Advanced)**:
   - Tool in builder to pack multiple 2D prop textures or 3D model albedo maps into a unified 2048x2048 atlas, eliminating material switching overhead.

---

### PILLAR 6: Versioned Persistence & Non-Destructive Storage
1. **Schema v2 Upgrade (`src/game/track-storage.ts`)**:
   - Schema version bumped to `2`.
   - New fields: `modelRef` (ID of imported 3D asset), `meshRole` (`'terrain' | 'decoration' | 'obstacle' | 'trigger'`), `shadingMode` (`'lit' | 'unlit'`), `customProps` dictionary, and baked vertex lighting data cache.
   - Non-destructive migration: Legacy v1 storage is automatically parsed and upgraded without data loss.
   - Unknown fields are strictly preserved during round-trip serialization.

---

## 4. REQUIRED PLAN DELIVERABLE FORMAT

You must output a complete, production-grade architectural plan modeled directly on the format and rigor of `temp/codex_plan`. Your plan must include the following distinct artifacts:

### Artifact 1: `interfaces.ts` (Frozen TypeScript Interfaces)
Define exact, strict TypeScript interfaces and types for every subsystem:
- `IF-GIZMO`: Transform gizmo modes, raycast interactions, snapping configs, events.
- `IF-MODEL-IMPORT`: File loaders, asset registry, IndexedDB schema, mesh sanitization, thumbnail generation.
- `IF-COLLISION-TERRAIN`: Mesh-to-ramp compiler, triangle soup collider, dynamic raycast surface.
- `IF-MATERIAL-SHADING`: Lit vs unlit descriptors, PBR overrides, biome tinting.
- `IF-POSTFX`: Post-processing pipeline, quality presets, bloom and fog uniforms.
- `IF-BAKER`: Vertex AO baker parameters, hemisphere raycasting, instanced mesh batching engine.
- `IF-STORAGE-V2`: Version 2 track storage schema, migration functions, asset bundling.

### Artifact 2: `tickets.ts` (Phased Work Tickets T0..T8)
Provide sequentially executable work tickets with:
- `id` (e.g. `T0`, `T1`, ... `T8`).
- `title` and `goal`.
- `reqs` (requirements addressed) and `decisions` (linked ADRs).
- `dependsOn` (strict prerequisite tickets).
- `create` (new file paths to create).
- `modify` (existing files and exact functions to modify).
- `interfaces` (referenced `IF-*` symbols).
- `behaviour` (bulleted algorithmic steps, math, tolerances, bounds, fallbacks).
- `acceptance` (strict, testable `AC-1`..`AC-N` criteria).
- `tests` (exact test files and test case names).
- `verify` (exact terminal commands: `npm run check`, `npm run build`, custom scripts).
- `outOfScope` and `unverifiable` declarations.

### Artifact 3: `decisions.ts` (Architectural Decision Records D1..D8)
Formal ADRs covering:
- **D1: Gizmo Implementation**: Custom Three.js raycast gizmo vs. importing `three/addons/controls/TransformControls.js` (weighing bundle size, single-file packaging, touch/mouse responsiveness).
- **D2: 3D Asset Storage Strategy**: IndexedDB binary blob store vs. base64 in `localStorage` vs. ephemeral session cache (handling quota limits and large models).
- **D3: Collision Representation for 3D Terrain**: Exact triangle mesh raycasting vs. bounding volume hierarchy (BVH) vs. heightfield rasterization vs. simplified convex hulls.
- **D4: Shading & Material Strategy**: Standard PBR vs. custom GLSL shaders vs. `MeshBasicMaterial` toggle.
- **D5: Post-Processing Architecture**: Full `EffectComposer` vs. custom lightweight fullscreen blit pass vs. WebGL canvas CSS filters.
- **D6: Vertex AO vs. Lightmap Textures**: Why vertex color baking was chosen over UV2 lightmap textures (zero texture memory, works on un-unwrapped meshes).
- **D7: Draw Call Batching**: Runtime `InstancedMesh` vs. `BatchedMesh` vs. geometry merging.
- **D8: Storage Schema Migration**: Non-destructive v1 $\to$ v2 migration with forward/backward compatibility.

### Artifact 4: `redteam.ts` (Adversarial Analysis & Risk Matrix)
Identify failure modes and mitigation strategies:
- High polygon count models ($> 100{,}000$ tris) freezing browser main thread.
- Memory leak on repeatedly importing/deleting 3D models.
- Non-manifold / inverted normal meshes breaking marble collision and falling through the world.
- Mobile GPU out-of-memory (OOM) crashes with post-processing bloom.
- IndexedDB storage quota exceeded when saving large track packs.
- Single-file build (`vite-plugin-singlefile`) size explosion if assets are inlined.

### Artifact 5: Interactive Simulator / Demo Webapp Spec
Describe the interactive plan demo webapp (replicating `temp/codex_plan/src/App.tsx` and `demos/`):
- Live Gizmo & Snapping simulator tab.
- 3D Model drag-and-drop testbed tab with lit/unlit & wireframe toggles.
- Collision triangle debug visualizer tab.
- Vertex AO bake progress & preview tab.
- Interactive ticket dependencies graph and filterable acceptance criteria matrix.

---

## 5. EXECUTION DIRECTIVE
Begin your response by summarizing the strategic roadmap, then output the complete TypeScript code and markdown specifications for each artifact (`interfaces.ts`, `decisions.ts`, `redteam.ts`, `tickets.ts`). Ensure all mathematical formulas, Three.js API calls, and file modifications are exact, unambiguous, and immediately implementable.
```
