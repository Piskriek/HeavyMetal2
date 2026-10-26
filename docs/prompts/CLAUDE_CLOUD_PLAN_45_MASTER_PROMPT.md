# CLAUDE CLOUD (FABLE) MASTER SESSION PROMPT — PLAN 45 + STAGE S5 ULTRA GAUSSIAN SURFELS

> **How to use this file:** Copy the entire block inside the `=== BEGIN CLAUDE CLOUD PROMPT ===` section below and paste it directly as your opening prompt in your Claude Cloud session connected to `Piskriek/HeavyMetal2` on branch `feat/studio-polish-claude-cloud` (Commit `5e300902`).

---

## `=== BEGIN CLAUDE CLOUD PROMPT ===`

# MISSION DIRECTIVE: COMPLETE PLAN 45 STUDIO POLISH (`JOB-CLOUD-01` → `JOB-CLOUD-06`) & BUILD STAGE S5 ULTRA MODULAR 2D GAUSSIAN SURFELS (`JOB-CLOUD-07`)

You are operating on repository **`Piskriek/HeavyMetal2`**, branch **`feat/studio-polish-claude-cloud`** (starting at Commit `5e300902`).

## 1. FIRST-TURN ORIENTATION & MANDATORY READS

Before writing code, read these files in the repository to align with the Owner's non-negotiable rules and the live Studio architecture:
1. `docs/OWNER_ASKS.md` (specifically 2026-10-08 Studio Gold Standard mandate, 2026-10-21 Rule 8a "Shortcuts are unacceptable", and Rule 17 4-Angle Visual Inspection).
2. `docs/argo/RULES.md`
3. `docs/prompts/CLAUDE_CLOUD_STUDIO_BRIEFING.md` and `docs/argo/plans/45-studio-claude-cloud-directive.md`
4. `docs/studio/CRAWLER_REPORT.md` and `scripts/crawl-studio.mjs`
5. `apps/web/src/studio/studio-ai-bridge.ts` (`window.__studioNav` and `window.__studioBridge`)
6. `apps/web/src/studio/studio-app.tsx`, `apps/web/src/studio/state/studio-store.ts`, and `apps/web/src/studio/viewport/build-studio-machine-model.ts`

### Branch & Codebase Path Resolution Map (Verified)
When wiring packages across the monorepo, use this verified path map (some modules exist in both legacy and new locations—wire both where applicable so Play, Lab, and Studio stay 100% synchronized):
- **Studio Core & AI Navigation**:
  - `apps/web/src/studio/studio-app.tsx`
  - `apps/web/src/studio/studio-ai-bridge.ts` (`window.__studioNav`, `window.__studioBridge`)
  - `apps/web/src/studio/state/studio-store.ts`
  - `apps/web/src/studio/viewport/studio-viewport.tsx`
  - `apps/web/src/studio/viewport/build-studio-machine-model.ts`
- **Character, Avatar, Rigging & IK**:
  - `packages/anim/src/index.ts` (`BONES`, `ANIM_STYLES`, `AnimPreset`, `Pose`)
  - `packages/puppet/src/index.ts` (`RIG`, `LIMBS`, `LimbPose`, two-bone Goblin puppet IK) AND `apps/web/src/avatar/ik/two-bone-ik.ts` (if present on branch)
  - `packages/motion/src/index.ts` (`Clip`, `Track`, `Key`, `Sample` keyframe recording & curve fitting)
  - `packages/kinematic/src/index.ts` and `packages/ragdoll/src/index.ts`
  - `packages/avatarlook/src/index.ts` and `packages/goblins/src/index.ts`
  - `apps/web/src/avatar/scientist/scientist-model.ts` (`loadScientistTemplate`, `createScientistInstance`, `scientist.fbx`)
  - `apps/web/src/avatar/scientist/animator.ts` (`createScientistAnimator`, `OneShotKind`, `LocomotionInput`)
  - `apps/web/src/avatar/scientist/anims-loader.ts` (`loadScientistAnimations`)
  - `apps/web/src/avatar/create-scientist.tsx`, `apps/web/src/avatar/create-goblin.tsx`, `apps/web/src/avatar/parts-lab.tsx`
- **Campaign / Lab / Outpost Live Scene Sync**:
  - `apps/web/src/lab/lab-scene.ts` and `apps/web/src/play/lab-room.ts`
  - `apps/web/src/play/play-scene.ts` and `apps/web/src/play/machine-props.ts` (`machineProp`, `PIXELS_OF`)
  - `apps/web/src/outpost/outpost-world.ts` (if present on branch)
  - `apps/web/src/studio/persistence/asset-override-writer.ts` and `apps/web/src/studio/persistence/spore-card.ts`

---

## 2. PROGRAMMATIC VERIFICATION LOOP (HEADLESS CRAWLER + CDP)

You have a zero-dependency headless Chromium crawler at `scripts/crawl-studio.mjs` and a global navigation API (`window.__studioNav` in `apps/web/src/studio/studio-ai-bridge.ts`).
- After implementing each ticket, run unit/integration tests AND run `node scripts/crawl-studio.mjs` against `http://localhost:5173/?studio` to capture 1920×1080 PNG proofs and verify zero console/page errors.
- Extend `window.__studioNav` and `scripts/crawl-studio.mjs` to cover the new Character & Animation Studio (`creative-suite` / `character-anim`) and the new **Stage S5 Ultra Gaussian Surfel** rendering mode (`setRenderMode('mesh' | 'hybrid-surfel' | 'pure-splat')`), producing screenshots `21` through `25` in `docs/studio/crawler-shots/`.

---

## 3. THE 7 EXECUTION TICKETS (`JOB-CLOUD-01` THROUGH `JOB-CLOUD-07`)

Execute all 7 tickets below in full production TypeScript/React/Three.js code. **Rule 8a applies strictly: zero fake sliders, zero disconnected mockups, zero stubbed functions.**

---

### TICKET 1 (`JOB-CLOUD-01`): 5th Workspace or Inspector Pillar — Character, Avatar & Animation Rigging Studio
- **Problem:** The Studio edits machines, materials, textures, worlds, and audio, but lacks an integrated Character & Animation editor for the Scientist (`apps/web/src/avatar/scientist/scientist-model.ts`) and Goblin (`packages/goblins`, `packages/puppet`, `apps/web/src/avatar/create-goblin.tsx`) rigs.
- **Deliverables:**
  1. Create `apps/web/src/studio/inspectors/character-anim-panel.tsx` (or 5th workspace tab `Character & Anim` in `studio-app.tsx` + `studio-store.ts`).
  2. **Model Switcher**: Toggle live in the 3D WebGL viewport between **Scientist Rig** (`createScientistInstance` + `createScientistAnimator` from `apps/web/src/avatar/scientist/`), **Goblin Block Rig** (`@hm/goblins` + `@hm/puppet`), and **Active Machine Kinematic Rig**.
  3. **Animation Clip Scrubber & Blending**:
     - Expose all `@hm/anim` styles (`idle`, `walk`, `run`, `jump`, `fall`, `swing`, `wave`, `dance`, `cheer`, `waddle`) with sliders for `cadence`, `legSwing`, `armSwing`, `armRaise`, `bob`, `lean`, `headNod`, `sway`, `twist`.
     - Expose Scientist FBX one-shots (`lever`, `button`, `plant`, `wave`, `cheer`, `point`) and locomotion blend weights (`forward`, `strafe`, `run`, `jumping`).
  4. **Interactive 3D Two-Bone IK & Keyframe Recorder**:
     - Render draggable 3D IK target gizmos for `armL`, `armR`, `legL`, `legR` using `@hm/puppet` (`RIG`, `pickLimb`, `dragLimb`, `toAngles`) and `apps/web/src/avatar/ik/two-bone-ik.ts`.
     - Wire `@hm/motion` (`Sample` stream recording -> `Clip` keyframe curve reduction) with `[● Record Gizmo Motion]`, `[▶ Play Clip]`, and timeline keyframe scrubbing.
  5. **Equipment & Material Slot Integration**:
     - Allow equipping tools (Beam Rifle, Rock Drill, Wrench) onto hand sockets and routing character submesh slots (`SUBMESH_COLORS` in `scientist-model.ts` / `@hm/avatarlook`) directly through `@hm/matstack` smart presets.

---

### TICKET 2 (`JOB-CLOUD-02`): Interactive 3D Vertex / Cage Gizmos for `@hm/meshops`
- **Problem:** `@hm/meshops` currently deforms geometry via sidebar sliders in `partgen-meshops-panel.tsx`, but artists also need direct 3D viewport manipulation handles.
- **Deliverables:**
  1. Create `apps/web/src/studio/viewport/meshops-cage-gizmo.ts` and mount it in `studio-viewport.tsx` whenever Rung 3 (`part`) is active and a MeshOp is selected.
  2. Render an interactive 3D wireframe lattice/control cage around the selected part's bounding box with draggable corner, face-center, and bend-axis handles:
     - **Top-ring radius handle** $\to$ drives `taper-flare.topScaleX` / `topScaleZ`.
     - **Mid-plane slice planes** $\to$ drives `extender-mid-slice.splitRatio` and `extensionMeters`.
     - **Arc curvature handle** $\to$ drives `bend-arc.angleDeg`.
     - **Helix twist ring** $\to$ drives `twist-helix.twistDeg`.
     - **Edge bevel handle** $\to$ drives `chamfer-hard-edges.bevelWidth`.
  3. Enforce `y = 0` grounding invariant so dragging any cage handle never ungrounds machine feet.
  4. Commit pointer-up changes as a single atomic Undo/Redo entry in `StudioStore`.

---

### TICKET 3 (`JOB-CLOUD-03`): Direct 3D Viewport Brush Painting & Decal Stamping
- **Problem:** Material wear, rust, and decals are controlled globally per slot via sliders (`matstack-inspector.tsx`), lacking localized 3D surface brush strokes.
- **Deliverables:**
  1. Create `apps/web/src/studio/viewport/viewport-paint-brush.ts` and add a **3D Paint / Decal Toolbar** (`[🖌️ Paint Wear]`, `[🎨 Paint Layer Mask]`, `[🏷️ Stamp Decal]`, `Brush Radius`, `Brush Falloff`, `Erase`) in `studio-viewport.tsx`.
  2. Use `THREE.Raycaster` hit UV / barycentric coordinates on the intersected part mesh (`hit.uv` or triplanar world-space projection on procedural `@hm/partgen` geometry) to paint directly into a per-slot `256×256` RGBA mask `THREE.DataTexture` (`R` = Paint 1 mask, `G` = Paint 2 mask, `B` = Edge Wear / Rust override, `A` = Decal stamp alpha).
  3. Integrate with `packages/decals` (`@hm/decals`) so clicking `[🏷️ Stamp Decal]` projects hazard stripes, faction emblems, serial numbers, or scorch marks onto the hit surface normal.
  4. Serialize painted masks compactly (RLE / Base64 PNG data URI) into `StudioSlotOverride` so painted strokes persist in `localStorage`, `studio-data/overrides/`, and **Spore Cards**.

---

### TICKET 4 (`JOB-CLOUD-04`): Live Hot-Reload Binding into Campaign Lab & Outpost World
- **Problem:** Clicking `[🚀 Apply to Campaign]` writes overrides to `localStorage` (`hm:studio:campaign-overrides:v1`) and `window.__hmCampaignOverrides`, but the running Campaign scenes (`apps/web/src/lab/lab-scene.ts`, `apps/web/src/play/play-scene.ts`, `apps/web/src/play/machine-props.ts`, and `apps/web/src/outpost/outpost-world.ts`) must dynamically rebuild and hot-swap their 3D machine groups when an override is saved.
- **Deliverables:**
  1. Create `apps/web/src/studio/persistence/campaign-live-binder.ts` that listens for `'hm:studio-apply-campaign'` events and reads `loadCampaignOverrides()` on startup.
  2. Wire `apps/web/src/play/machine-props.ts` (`machineProp()`), `apps/web/src/play/play-scene.ts`, `apps/web/src/lab/lab-scene.ts`, and `apps/web/src/outpost/outpost-world.ts` so that whenever a kit override exists for `mill` (`kit:texture-mill-v2`), `press` (`kit:shape-press`), `pylon` / `projector` (`kit:stargate-portal`), `drill`, or `rover` (`kit:rover-scout`), the game constructs or updates the live `THREE.Group` using `buildStudioMachineModel()` with the user's custom `@hm/matstack`, `@hm/partgen`, `@hm/meshops`, and Stage S5 Surfel overrides.
  3. Add an in-Studio `[👁️ Preview in Campaign Lab]` split or toggle check and verify via automated test that modifying a machine in Studio immediately mutates the active Campaign prop instance without requiring a page reload.

---

### TICKET 5 (`JOB-CLOUD-05`): Full PBR Material Maps (Normal, Roughness, Metalness, Emissive) in `build-studio-machine-model.ts`
- **Problem:** `bakeMatstackDataTexture()` in `build-studio-machine-model.ts` currently bakes an RGBA `albedoMap` (`64×64` or `24×24`) and sets scalar roughness/metalness per part, rather than feeding full per-pixel `normalMap`, `roughnessMap`, `metalnessMap`, and `emissiveMap` textures into `THREE.MeshStandardMaterial` / `THREE.MeshPhysicalMaterial`.
- **Deliverables:**
  1. Upgrade `bakeMatstackDataTexture()` (and create `bakeMatstackPBRMaps()`) in `apps/web/src/studio/viewport/build-studio-machine-model.ts` to evaluate `@hm/matstack` layers + `@hm/texgraph` height/roughness fields at `128×128` resolution (cached by content hash):
     - **`map` (Albedo RGBA `SRGBColorSpace`)**: Multi-layer composited colour + painted mask override.
     - **`normalMap` (Tangent-Space Normal RGB `NoColorSpace`)**: Central-difference Sobel gradient $(\partial h/\partial u, \partial h/\partial v)$ from the composited `@hm/matstack` height + `@hm/texgraph` bump + procedural micro-scratches, matching `surfaceTextures()` in `apps/web/src/lab/lab-scene.ts`.
     - **`roughnessMap` & `metalnessMap` (`NoColorSpace`)**: Per-texel roughness and metallic response (e.g. exposed bare metal on worn edges has low roughness `0.22` and high metalness `0.92`, while oxidized rust cavities have high roughness `0.88` and metalness `0.08`).
     - **`emissiveMap` (`SRGBColorSpace`)**: Per-texel emissive mask for plasma coils, Stargate chevrons, and status lamps.
  2. Bind all 4 maps to each part's `THREE.MeshStandardMaterial` in `buildStudioMachineModel()` with `normalScale: new THREE.Vector2(1.2, 1.2)`.

---

### TICKET 6 (`JOB-CLOUD-06`): Responsive Layout Polish (`1280×720` to `2560×1440`) & Zero-Clip Inspector Scrollbars
- **Problem:** At `1920×1080` and `1366×768`, dense inspector panels (`matstack-inspector.tsx`, `kit-assembler-panel.tsx`, `partgen-meshops-panel.tsx`, `character-anim-panel.tsx`) need clean internal scroll containers, collapsible accordion sections, and responsive top-bar wrapping so nothing clips or overflows.
- **Deliverables:**
  1. Add collapsible section headers with persistent open/closed state and custom slim dark scrollbars (`scrollbar-width: thin`) across all right-hand inspector panels.
  2. Ensure the Top Header Bar, 5-Rung Inception Breadcrumb Bar, and Bottom Material Slot Strip remain 100% visible and non-overlapping at `1280×720`, `1920×1080`, and `2560×1440`.
  3. Add keyboard shortcut HUD badges (`W`/`E`/`R` gizmos, `Q` Quad View, `G` Grid, `C` Colliders, `S` Ultra Surfels, `1`–`5` Rung Dive, `Ctrl+Z` / `Ctrl+Shift+Z`).

---

### TICKET 7 (`JOB-CLOUD-07`): Stage S5 / Ultra Fidelity — Modular Procedural 2D Gaussian Surfels & Terrain Contact Skirts (`@hm/surfels` + Optional `.splat` Bake)

#### Architectural Context & Why We Use Modular Procedural 2D Gaussian Surfels (Not Monolithic Static 3DGS Bakes)
In HeavyMetal2's Stage progression ($S_0$ Wireframe $\to$ $S_1$ Flat Low-Poly $\to$ $S_2$ Lit Mesh $\to$ $S_3$ Procedural PBR $\to$ $S_4$ Weathering & Biome $\to$ **$S_5$ Ultra Gaussian Surfel** $\to$ $S_6$ Transcendence), baking a monolithic static 3D Gaussian Splat (`.splat` / `.ply`) of a machine + terrain has 5 severe game-engine flaws:
1. **Breaks Modularity & Kinematics**: A monolithic baked `.splat` fuses rotating drill bits, pulsing Stargate chevrons, and articulated rover wheels into a static cloud.
2. **Destroys Spore Cards**: A static 400k-splat bake weighs `12–25 MB`, breaking `<100 KB` PNG Spore Cards (`hm:spore:v1`).
3. **CPU Radix-Sort Frame Hitching**: Classical 3DGS requires per-frame CPU/WASM depth sorting (`4–12 ms/frame` main-thread stalls during camera orbit).
4. **Static Baked Lighting**: Pre-baked spherical harmonics ignore live sun elevation/azimuth (`look-tab.tsx`), shadows, and Beam Rifle impacts.
5. **View-Dependent "Popcorn" Artifacts**: Unconstrained 3D ellipsoids look fuzzy at grazing angles on hard industrial steel plates.

#### The Solution: Canonical Part-Space 2D Gaussian Surfels + Sort-Free Stochastic Rendering + `40 cm` Terrain Contact Skirt
Implement **both** the live modular **Stage S5 Procedural 2D Gaussian Surfel Engine** (default for Stage $S_5$/$S_6$ and close-up LOD `< 18m`) **AND** an on-demand **`[✨ Bake Ultra Splat (.splat)]`** exporter for external inspection:

1. **Create `apps/web/src/studio/viewport/studio-surfel-layer.ts` (and/or `packages/surfels/src/index.ts`)**:
   - **Canonical Surface Poisson / Blue-Noise Emitter (`emitPartSurfels`)**:
     - Deterministically sample triangles of any `@hm/partgen` (post-`@hm/meshops` deformation) mesh using Golden-Ratio / Sobol quasi-random barycentric coordinates seeded by `partId`.
     - Emit **2D oriented tangent-disk Gaussian surfels** (inspired by *2D Gaussian Splatting for Geometrically Accurate Radiance Fields*, Huang et al. SIGGRAPH 2024):
       - Position $\mathbf{p}_i \in \mathbb{R}^3$ in part-local coordinates (lifted along $\mathbf{n}_i$ by `@hm/matstack` layer thickness: Base Metal `+0.0 mm`, Primer `+0.4 mm`, Paint 1/2 `+0.9 mm`, Rust/Moss blooms `+1.5..4.0 mm` near high-curvature/cavity edges).
       - Orthonormal tangent frame $(\mathbf{t}_{u,i}, \mathbf{t}_{v,i}, \mathbf{n}_i)$ aligned with principal curvature / brush direction (anisotropic stretched splats $s_u = 3.5 s_v$ for brushed steel or wood grain; isotropic fuzzy micro-splats for moss/rust/dust).
       - Scales $(s_{u,i}, s_{v,i})$, base opacity $\alpha_i$, PBR material tuple $(\text{albedo}_i, \text{roughness}_i, \text{metalness}_i, \text{emissive}_i)$ sampled from the composited `@hm/matstack` + `@hm/texgraph` field, plus view-dependent **Degree-1 Spherical Harmonics (SH)** coefficients for metallic glint.
   - **Zero-Sort Stochastic Alpha-Hash / Hybrid Core+Shell Rasterizer (`createSurfelInstancedMesh`)**:
     - Render using a single `THREE.InstancedBufferGeometry` / `THREE.ShaderMaterial` per part (or per machine group) with **zero CPU depth sorting (`0.0 ms` CPU overhead)**:
       - The watertight `@hm/partgen` PBR mesh renders first as the **opaque depth core** (`depthWrite: true`), preventing light leaks and handling 95% of occlusion.
       - The **2D Gaussian Surfel Shell** renders around edges, bevels, rust blooms, bolts, welds, energy vents, and terrain contact zones using **Order-Independent Stochastic Alpha Hashing** (or screen-space Blue-Noise thresholded MSAA alpha-to-coverage):
         $$\alpha(\mathbf{u}) = \alpha_0 \exp\!\left(-\frac{1}{2}(u^2 + v^2)\right), \quad \text{discard if } \alpha(\mathbf{u}) < \text{hash2D}(\text{gl\_FragCoord.xy}, \text{instanceId})$$
       - Also support a **Pure Splat Mode** (`renderMode === 'pure-splat'`) that hides the triangle mesh and increases surfel density $4\times$ so every surface is rendered purely from 2D Gaussian disks with analytical ray-disk `gl_FragDepth` correction and full real-time PBR `DirectionalLight` + hemisphere + SH specular shading!
   - **Procedural `40 cm` Terrain Contact Skirt (`emitTerrainContactSkirtSurfels`)**:
     - Wherever machine parts approach ground level ($y \in [0, 0.40\text{ m}]$), automatically generate a dense skirt of **Terrain-to-Machine Blending Surfels** that bridge the terrain normal $\mathbf{n}_{\text{terrain}}$ and the machine foot normal $\mathbf{n}_{\text{part}}$.
     - Sample the live `@hm/plotterrain` / `@hm/groundshader` biome colour (lunar regolith dust, wet mud, or $S_4$–$S_6$ moss/lichen) so the machine looks organically embedded into the ground—and if the user moves the machine or sculpts the terrain with a brush in `scene-tab.tsx`, the skirt updates in `< 1 ms`!
   - **Continuous Camera Distance LOD (`d < 18 m`)**:
     - Smoothly scale surfel density / opacity by camera distance $w(d) = \text{smoothstep}(18.0, 6.0, \|\mathbf{p}_{\text{cam}} - \mathbf{p}\|)$ so distant machines cost `0` extra splat overdraw while close-up inspection reveals plush sub-millimeter micro-surface detail.
   - **On-Demand `.splat` Binary Exporter (`exportMachineToSplatBinary`)**:
     - Add a **`[✨ Bake Ultra Splat (.splat)]`** button in the Studio Viewport toolbar (`studio-viewport.tsx`) and expose `window.__studioNav.bakeUltraSplat()`.
     - Serializes all active machine + contact-skirt surfels into the standard 32-byte-per-splat binary `.splat` format (`position: float32[3]`, `scale: float32[3]`, `color: uint8[4]`, `quaternion: uint8[4]`) for one-click download or external 3DGS viewers, while keeping **Spore Card** exports (`hm:spore:v1`) at **`0 KB` extra bloat** because surfels regenerate deterministically from the existing recipe seed!

---

## 4. REQUIRED UPDATES TO `window.__studioNav` & `scripts/crawl-studio.mjs`

1. In `apps/web/src/studio/studio-ai-bridge.ts`, add:
   - `window.__studioNav.setRenderMode(mode: 'mesh' | 'hybrid-surfel' | 'pure-splat')`
   - `window.__studioNav.setSurfelDensity(multiplier: number)`
   - `window.__studioNav.bakeUltraSplat(): { splatCount: number; byteLength: number; buffer: ArrayBuffer }`
   - `window.__studioNav.selectCharacterRig(rig: 'scientist' | 'goblin' | 'machine')`
   - `window.__studioNav.setCharacterAnim(style: string, params?: Record<string, number>)`
2. In `scripts/crawl-studio.mjs`, add 5 new automated visual verification captures (bringing the gallery to **25 uncompressed 1920×1080 PNGs** in `docs/studio/crawler-shots/` and documenting them in `docs/studio/CRAWLER_REPORT.md`):
   - `21-character-scientist-rig-ik.png` — Scientist FBX rig in Studio with two-bone IK gizmos and animation curve scrubber.
   - `22-meshops-3d-lattice-cage.png` — Interactive 3D wireframe deformation cage on Rung 3 part with live vertex taper/bend handles.
   - `23-viewport-3d-paint-decal-stamp.png` — Localized 3D brush wear painting and stamped hazard decal on Texture Mill V2 hull.
   - `24-ultra-stage-s5-hybrid-surfels.png` — Close-up (`4m` camera distance) of Texture Mill V2 in `hybrid-surfel` mode showing micro-surface rust/paint thickness surfels and the `40 cm` terrain contact skirt at `y = 0`.
   - `25-ultra-stage-s5-pure-splat-mode.png` — Close-up in `pure-splat` mode showing 100% 2D Gaussian Surfel rendering with dynamic directional sun glint and `.splat` bake telemetry badge.

---

## 5. DEFINITION OF DONE & COMMIT PROTOCOL

1. All unit and integration tests pass (`npm test` and ` studio-core.test.ts`).
2. `node scripts/crawl-studio.mjs` completes with `0` console errors, `0` uncaught page errors, and all 25 screenshots (`01` through `25`) rendered and verified in `docs/studio/crawler-shots/`.
3. Update `docs/studio/CRAWLER_REPORT.md` and `docs/JOB_BOARD.md` with the final metrics and commit everything cleanly to branch `feat/studio-polish-claude-cloud`.

## `=== END CLAUDE CLOUD PROMPT ===`
