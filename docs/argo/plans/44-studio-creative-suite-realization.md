# 44 — The Studio Creative Suite Realization: Live Material Binding, Interactive Kit Assembler & Legacy GLB Retirement

> **File Destination in Repo:** `docs/argo/plans/44-studio-creative-suite-realization.md`  
> **Author:** Gemini Argo (Creative & Modular Systems Lead)  
> **Mandate Source:** Francois (The Owner — Verbatim Directives of 2026-10-08, 2026-10-20, 2026-10-21 Rule 8a, and 2026-10-25 Live Studio Audit)  
> **Status:** **P0 CRITICAL ARCHITECTURAL INTERVENTION — BINDING FOR OPUS, FLASH & HAIKU**

## 1. Executive Reality Check: Why the Current `/studio` Build Fails the Owner's Mandate

On 2026-10-08, the Owner locked the foundational vision for **The Studio** in `docs/OWNER_ASKS.md`:
> *"the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely ... so that our studio is the new gold standard in game editing and creation."*

On 2026-10-20 and 2026-10-21 (Plans 38, 39, 40, 41 and **Rule 8a**: *"Shortcuts are unacceptable; check each other"*), the Owner further mandated **Preset Inception**:
1. **Parts (`@hm/partgen` + `@hm/meshops`) -> Modules (`@hm/kitspec`) -> Machines/Vehicles (`@hm/kitspec`)**
2. **Tiles (`@hm/texgraph`) -> Surfaces -> Masks -> Layers -> Layered Materials (`@hm/matstack`)**
3. **Every level is a pure JSON preset with schema sliders, live 3D try-on directly on the asset, and disk persistence (`studio-data/`).**

### What Went Wrong in `http://localhost:5173/?studio`
While the pure TypeScript engines (`@hm/matstack`, `@hm/texgraph`, `@hm/kitspec`, `@hm/partgen`, `@hm/meshops`, `@hm/presetcodec`, `@hm/scenedoc`, `@hm/gizmo`) were built and unit-tested in isolation, **nobody wired them together into an integrated, artist-grade Studio UI in `apps/web/src/studio/`**:
1. **`Assets` Tab Is a Dead Legacy GLB Viewer:** Displays 132 old pre-baked `.glb` meshes (`headlight`, `tool-drill`, `bench-jig`, `drafting`, `life-support`) with only Move/Turn/Scale and global tint/roughness sliders. Zero slot-level material assignment, zero `@hm/meshops` modifier stack, and zero modular decomposition.
2. **`Materials` Tab Is a Disconnected Demo Ball:** Renders a floating sphere with 5 fake macro sliders (`Hue Shift`, `Surface Grain`, `Weathering`, `Roughness`, `Micro Bump`). It cannot inspect or target material slots on an asset, cannot bind `@hm/matstack` layers or `@hm/texgraph` procedural tiles to a model, and cannot save material assignments to any machine or asset in the game.
3. **`Parts` Tab Is an Isolated Primitive Previewer:** Renders one standalone `bolt`, `can`, or `beam` from `@hm/partgen` with no assembly tree, no 3D socket gizmos, and no way to snap parts together into modules and machines.
4. **`TILE_LIBRARY` Gap in `@hm/texgraph` (`OPUS_NOTE_44`):** `packages/matstack/src/shelf.ts` references 20 procedural tiles (`brushed-metal`, `cells`, `cast-iron`, `pits`, `fine-grain`, `orange-peel`, `stripes`, `rubber-grain`, `concrete`, `carbon-weave`, `hex-micro`, `flake-scale`, `grime-clouds`, `regolith-grain`, `moss-clump`, `frost-crystal`, `mud-splatter`, `mineral-crust`, `scorch-burn`, `scratches`) that are not yet registered in `@hm/texgraph`, causing surfaces to fall back to `FLAT_TILE`.

This plan (`Plan 44`) terminates all disconnected prototype tabs and establishes the unified **Studio Creative Suite Architecture** across three non-negotiable pillars.

## 2. Unified Studio Architecture & Shared Selection Context (`StudioContext`)

The root cause of the current Studio's failure is **tab isolation**: selecting an asset in `Assets`, a material in `Materials`, or a part in `Parts` operates on three separate, unlinked state trees.

### 2.1 Single Shared `StudioSessionState` (`apps/web/src/studio/state/studio-store.ts`)

Every workspace mode in the Studio must read and mutate a single reactive `StudioSessionState` backed by `@hm/scenedoc` undo/redo and the `Changes` staging queue (`studio-data/`):

```ts
export interface StudioSelection {
  /** Active top-level target being edited in the 3D viewport */
  readonly targetKind: 'kit-preset' | 'kit-module' | 'part-def' | 'legacy-glb' | 'scene-entity';
  readonly targetId: string; // e.g., 'kit:texture-mill', 'mod:bolted-door', 'part:hopper-main'
  /** Selected PlacedPart path within an assembly (e.g., 'body/service-door#3/hinge[0]') */
  readonly activePartPath: string | null;
  /** Selected material slot on the active part or assembly (e.g., 'body', 'trim', 'bolts', 'band', 'lamp') */
  readonly activeSlotName: string | null;
  /** Selected socket name when snapping/aligning parts (e.g., 'top_hopper', 'side_vent', 'door_hinge_0') */
  readonly activeSocketId: string | null;
  /** Selected @hm/matstack MaterialSpec ID bound to activeSlotName (e.g., 'mat:field-worn-hazard') */
  readonly activeMaterialId: string;
  /** Selected layer index inside activeMaterialId (-1 = base SurfaceSpec, 0..5 = LayerSpec) */
  readonly activeLayerIndex: number;
  /** Viewport inspection mode */
  readonly viewportMode: 'lit' | 'mask-bw' | 'wireframe-ranks' | 'quad-4angle' | 'compare-legacy';
  /** Active detail rank override in viewport ('auto' | 0 | 1 | 2) */
  readonly previewRank: 'auto' | 0 | 1 | 2;
  /** Active planet stage lighting scrubber (0..4, or 'lab-neutral') */
  readonly previewStage: 'lab-neutral' | 0 | 1 | 2 | 3 | 4;
}
```

### 2.2 The 4-Zone Studio Layout (Always Connected to the Active Asset)

| Studio Zone | Width / Position | Persistent Role Across All Modes |
| :--- | :--- | :--- |
| **Zone 1: Left Dock (`300px`) — Content Browser & Hierarchy Outliner** | Top half: **Hierarchy Outliner** (shows the selected machine/kit's `AssemblyDef` tree, `PlacedPart` paths, `SocketDef` nodes, and **Material Slots**).<br>Bottom half: **Unified Shelf Browser** (`Kits & Machines`, `Modules`, `Parts (@hm/partgen)`, `Materials (@hm/matstack)`, `Tiles (@hm/texgraph)`, `Legacy GLB Queue [Deprecated]`). | Clicking any machine, part, or material slot in the Outliner immediately focuses it in the 3D Viewport and opens its exact inspector in the Right Dock. Dragging a Material or Part from the Shelf onto a 3D mesh part or Outliner slot binds it immediately. |
| **Zone 2: Center Top Bar (`44px`) — Viewport Mode, Rank, Stage & Keymap Bar** | `[Keymap: SetMix W/E/R | Blender G/R/S]` · `[Rank: R0 | R1 | R2 | All 3]` · `[Stage Look: Lab | S0 | S1 | S2 | S3 | S4]` · `[View: Lit | Mask B&W | Sockets | 4-Angle Grid | Side-by-Side vs Legacy]` · `[F5: Play in Lab/Plot]` | Ensures Rule 17 (4-angle review) and Stage 0–4 lighting verification are 1 click away at all times. |
| **Zone 3: Center 3D Viewport (`flex: 1`) — Live Kit, Socket & Layered Material Canvas** | Renders the **actual selected machine, module, or part** using `apps/web/src/play/kit-build.ts` and `apps/web/src/play/layered-material.ts` (never an isolated fake sphere, unless the user explicitly toggles `[Preview on Test Piece / Sphere]`). | Supports raycast picking via `partAt(hitTriangleIndex)` to select individual `PlacedPart` instances and their `Slot` (`body`, `trim`, `bolts`, `band`), plus 3D `@hm/gizmo` handles on sockets and parts. |
| **Zone 4: Right Dock (`380px`) — Context-Sensitive 3-Tab Inspector (`[Assembly & Parts] | [Material & Layers] | [TexGraph & UV]`) + Bottom `Changes` Bar** | Contextually edits the selected Assembly, Part (`@hm/partgen` + `@hm/meshops` stack), Material Slot (`@hm/matstack` 5-level stack), or Tile (`@hm/texgraph` DAG). Bottom bar shows staged diffs (`studio-data/`) with `[Accept & Save to Disk]` and `[Revert]`. | Eliminates switching away from your model to edit its materials or parts—everything edits the live asset in place. |

## 3. Pillar 1: Material & Texture Application Pipeline (P0)

### 3.1 End-to-End Data Flow: From `@hm/texgraph` & `@hm/matstack` to Live 3D Asset Slots

Every mesh in the Studio—whether a parametric `@hm/partgen` part, a multi-part `@hm/kitspec` machine assembly, or a remaining hero cage—exposes named **Material Slots**:
- For `@hm/partgen` parts: `Generator.slots` (e.g., `can` -> `['body', 'trim', 'band']`; `panel` -> `['plate', 'bolts']`; `grille` -> `['frame', 'slats']`; `duct` -> `['duct', 'flange', 'bolts']`).
- For `@hm/kitspec` assemblies: `PartDef.material` (default slot) + `PartDef.slotMaterials?: Readonly<Record<string, string>>` + per-path `PartOverride.slotMaterials` + emissive lamp codes `lx:<kelvin>:<intensity>:<pattern>[:<hex>]`.

When an asset or assembly is loaded into the Studio viewport:
1. **Slot Discovery (`extractMaterialSlots(target)`):**
   - Enumerates every distinct slot on the selected assembly/part, displaying each slot as a row in the **Material Slots Strip** at the top of the Right Dock:
     - `[Slot Pill: body]` -> bound to `mat:field-worn-hazard` (`64×64` live thumbnail swatch + `paint1` `#b8b2a2` / `paint2` `#eab308` chips)
     - `[Slot Pill: trim]` -> bound to `mat:workshop-steel`
     - `[Slot Pill: hopper]` -> bound to `mat:rust-bucket`
     - `[Slot Pill: band]` -> bound to `mat:hazard-chevron`
     - `[Slot Pill: status_lamp]` -> bound to `lx:6500:1.2:steady:ff3d8a`
2. **Click-on-Model Slot Picking (`Raycast -> PlacedPart -> Slot`):**
   - Clicking any triangle on the 3D model in the viewport calls `kitBuild.partAt(hit)` to resolve `{ path, partId, slotName }`.
   - Single-click selects the `PlacedPart` (`path`) and highlights its active `slotName` in the Material Slots Strip.
   - `Alt + Click` (or clicking the Eyedropper icon) samples the `MaterialSpec` on that face; `Shift + Click` on a preset swatch in the shelf applies that `MaterialSpec` to **all parts in the assembly sharing that slot name**; plain click applies it as a `PartOverride` on the selected `PlacedPart` path (or edits the `PartDef.slotMaterials` if editing the base kit).
3. **Live Three.js Shader Compilation (`apps/web/src/play/layered-material.ts`):**
   - Every edit to `paint[0]`, `paint[1]`, `age`, `base: SurfaceSpec`, or `layers[i]: LayerSpec` immediately updates the uniforms on the `MeshStandardMaterial` / `MeshPhysicalMaterial` compiled by `layered-material.ts` (recompiling the shader program only when `featureKey(features(matSpec))` changes).
   - **Precomputed Geometry Mask Attributes (`@hm/matstack` `maskAttributes`):** Whenever a part geometry is built or modified by `@hm/partgen` / `@hm/meshops`, `kit-build.ts` computes and caches the `aEdge` (`vec4` signed distances to the 4 nearest convex sharp edges) and `aCavity` (`vec4` signed distances to the 4 nearest concave creases) vertex attributes (or `curvatureMasks` for dense meshes where `longestEdge < 2 * EDGE_BAND`).
   - **Live Mask B&W Diagnostic View (`viewportMode === 'mask-bw'`):** Toggling the **Mask Eye (`[M]`)** on any layer in the layer stack switches the 3D model in the viewport to render `layerWeight(layer, ...)` as crisp grayscale `[0..1]` directly across the machine's bevels, crevices, top faces, and ground splash zone!

### 3.2 Persistence to Disk (`studio-data/` Write-Back)

Clicking **`[Accept & Save]`** in the Studio Changes panel writes deterministic, formatted JSON via the dev-server write-back endpoint (`POST /__studio/write`):
- Custom/edited materials save to `studio-data/materials/<id>.json` (and update `packages/matstack/src/shelf.ts` when promoted to canon).
- Custom/edited procedural tiles save to `studio-data/tiles/<id>.json` (and `packages/texgraph/src/tile-library.ts`).
- Kit slot-material assignments and assembly changes save to `studio-data/kits/<kitId>.json` (and `apps/web/src/play/kit-*.ts`), immediately hot-reloading in both the Lab and Planet scenes without a page refresh.

## 4. Pillar 2: Modular Assembly & Kit Builder (`@hm/kitspec` + `@hm/partgen` + `@hm/meshops`)

### 4.1 Replacing the Isolated "Parts" Viewer with the Interactive Kit Assembler

The old `Parts` tab is replaced by the **Kit & Machine Assembler Workspace**, which operates at three hierarchical levels matching Plan 38 & Plan 39 ("Preset Inception"):

```
[Level 1: Part (@hm/partgen + @hm/meshops)]
   └── e.g., 'hopper-funnel' (gen: 'hopper', params: {...}, ops: [{ op: 'chamfer-hard-edges', ... }])
         │
         ▼ snaps onto SocketDef { at: [x,y,z], rot: [rx,ry,rz] }
[Level 2: Module (Reusable Sub-Assembly in @hm/kitspec)]
   └── e.g., 'mod:service-door-assy' (panel + 2× hinge + handle + status-lamp + 6× bolt)
         │
         ▼ snaps onto Parent SocketDef + optional mirror ('x'|'z') & repeat ({ count, step })
[Level 3: Machine / Vehicle / Structure Kit Preset (@hm/kitspec)]
   └── e.g., 'kit:texture-mill', 'kit:shape-press', 'kit:capacitor-bank', 'kit:modular-scout'
```

### 4.2 Interactive 3D Socket Snapping & Assembly Controls

1. **Visual 3D Socket Gizmos (`[Show Sockets]` Overlay):**
   - Renders every `SocketDef` (`PartDef.sockets` and `AssemblyDef.sockets`) in the 3D viewport as a color-coded triad pin:
     - **Blue Pin (`#3dc8ff`):** Unoccupied structural socket.
     - **Green Pin (`#7cff4d`):** Occupied socket (shows dashed leader line to attached child).
     - **Amber/Pink Pin (`#ffc13d` / `#ff3d8a`):** Functional machine gameplay socket (`feed_hopper`, `exhaust_plume`, `power_cable`, `cartridge_slot`, `wheel_well`).
2. **Snap-to-Socket Workflow (`Click Socket -> Pick Part/Module` or Drag-and-Drop):**
   - Clicking any socket pin in the 3D viewport sets `activeSocketId` and opens the **Quick-Attach Popover** (`+ Attach Part` / `+ Attach Module`).
   - Selecting a `@hm/partgen` generator (any of the 20 generators across the 4 shelves: *Fasteners & Fittings*, *Plates & Frames*, *Vessels & Flow*, *Wheels & Lamps*) or an existing `AssemblyDef` module inserts a new `Placement` into `AssemblyDef.children`:
     ```ts
     { ref: 'panel', key: 'access_door', on: { child: 0, socket: 'left_bay' }, at: [0, 0, 0], rot: [0, 90, 0] }
     ```
   - **Raycast Surface-Normal Socket Authoring (`+ Add Socket on Face`):** Clicking **`[+ Add Socket]`** and clicking any face of a part in the 3D viewport raycasts the exact hit position `(x, y, z)` and face normal, snapping coordinates to `5 mm` (`0.005 m`) increments and aligning the socket's local axes to the face normal so parts never float!
3. **Placement Inspector (`at`, `rot`, `mirror`, `repeat`, `rank`):**
   - Selecting any `Placement` child in the Outliner or 3D viewport attaches the `@hm/gizmo` (`W` Move, `E` Rotate 90°/15°, `R` Scale/Param) and exposes:
     - **Socket Binding:** Dropdown of parent sibling + socket name (or `<Root Origin>`).
     - **Local Offset & Rotation:** `at: [x, y, z]` (m) and `rot: [rx, ry, rz]` (deg, with quick `-90° / +90° / 180°` buttons).
     - **Symmetry Mirror:** `[None | Mirror X | Mirror Z]` (automatically flips triangle winding via `determinant3(matrix) < 0` in `@hm/kitspec`).
     - **Linear Repeat Array:** `count` (`1..24`) and `step: [dx, dy, dz]` (e.g., placing 6 capacitor cans or a row of 8 bolts in one `Placement`).
     - **Detail Rank Gate:** `[R0: Silhouette | R1: Secondary | R2: Fine Detail]`.
4. **Live `@hm/kitspec` Grounding & Validation Banner (`validate()`):**
   - Runs `validate(kit, activePreset)` + material resolution checks on every edit in `< 2 ms`.
   - If any part is `floating` (`> 2 mm` gap from a grounded support chain), `below-ground` (`y < 0`), or has an `unresolved-material`, a bright red/amber badge in the viewport highlights the offending part wireframe in `#ff3d8a` with a **`[Snap to Nearest Face / Ground (y=0)]`** 1-click auto-fix button!
5. **Embedded `@hm/meshops` Non-Destructive Modifier Stack on Every Parametric Part:**
   - When a `param` part is selected, the Right Dock displays both its **`@hm/partgen` Schema Sliders** AND its **`@hm/meshops` Operator Stack** (`OpRef[]`), including the **6 One-Click Preset Pills** (`[Smooth (Taubin)]`, `[45° Chamfer]`, `[Recessed Seam]`, `[Funnel Taper]`, `[Stretch Span]`, `[Edge Wear]`) and the full 27-operator menu across Families 1–6 (`ARGO_NOTE_34`).

### 4.3 Deprecation & Replacement Timeline for the 132 Legacy GLBs (Rule 8a Enforcement)

Per Rule 8a (*"Shortcuts are unacceptable"*), legacy one-piece AI-generated `.glb` models with baked webs, blurry `256²` stretched UVs, or un-editable geometry must be systematically retired and replaced by verified `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` assemblies.

| Deprecation Wave | Asset Category & Count | Target Assets Being Retired / Replaced | Replacement Architecture | Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **Wave 1 (Immediate — P0 Lab & Field Machines)** | **18 Core Lab & Field Machines** | `texture-mill`, `shape-press`, `light-projector`, `water-maker`, `rock-drill`, `power-unit`, `relay-pylon`, `preset- mixer`, `capacitor-bank`, `breaker-panel`, `relay-cabinet`, `control-box`, `operator-console`, `gate-frame`, `hardware-fabricator`, `preset-bench`, `preset-combiner`, `planet-table` | **100% Pure `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` Assemblies** (`kit-capacitor-bank-v2.ts`, `kit-mill-v2.ts`, `kit-press-v2.ts`, `kit-lab-power.ts`, `kit-gate-frame.ts`). Zero legacy `.glb` meshes allowed on any machine. | `node scripts/kit-compare-sheet.mjs` 4-angle side-by-side approval; `validate() === 0 issues`; `<= 181` draw calls at Lab Gate view. |
| **Wave 2 (P0 Base Construction & Furniture Kits)** | **26 Base Structure & Lab Clutter Props** | Sheet 13 & 15 base pieces (`foundation`, `wall`, `window-wall`, `doorway`, `ramp`, `roof`, `corner-post`, `cable-ramp`, `hardpoint-pad`) + 10 Lab clutter props (`server-rack`, `filing-cabinet`, `locker`, `crate-large`, `crate-small`, `toolbox`, `coolant-can`, `sample-case`, `old-monitor`, `bench-jig`) | **100% `@hm/kitspec` Modular Kits** sharing the canonical `@hm/matstack` shelf (`mat:lab-fresh`, `mat:workshop-steel`, `mat:field-worn-hazard`, `mat:hazard-chevron`). | Walkable trimesh/box colliders verified; `partAt()` raycast works on every bolt/panel for Beam `Apply` part cartridges. |
| **Wave 3 (P1 Vehicles, Heavy Terraformers & Weapons)** | **24 Vehicles, Heavy Gear, Turrets & Tools** | `modular-scout`, `heavy-hauler`, `crawler`, `vehicle-fabricator`, `heavy-shape-press`, `heavy-light-projector`, `heavy-water-maker`, `beam-rifle`, `scatter-sidearm`, `perimeter-turret`, `tool-drill`, `tool-mallet`, `tool-scanner`, `tool-screwdriver`, `headlight` | **`@hm/kitspec` Socketed Assemblies** (square-section frames, empty cab + `[-u-]` yoke, 20-sided lugged `wheel` / `track-pod` generators from `@hm/partgen`). | 4-angle render check; wheel/suspension travel bounds (`VEHICLE_FIT`) pass; `partAt()` works on rover wheels & panels. |
| **Wave 4 (P1 Vista Ruins & Wreck Sites)** | **22 Exterior Vista & Lunar Wreck Props** | `datacentre-hall`, `chiller-block`, `shipping-container`, `pylon-tower`, `overpass-segment`, `salvage-rover-wreck`, `comms-dish-wreck`, `solar-array-wreck`, `cargo-pod-wreck` | **`@hm/kitspec` Structural Modules** with `@hm/meshops` deformers (`bend-arc`, `twist-helix`, `plane-slice-clip`) + `mat:rust-bucket` / `mat:moon-dusted` weathering. | Window vista stays `<= 1.5 ms` on GTX 950M; wrecks support `[Hold E]` part salvage. |
| **Wave 5 (Organic / Geological Exceptions — Plan 38 §3)** | **42 Natural Scenery & Rigged Characters** | Lunar boulders, crater rims, rubble slabs, Scientist Mixamo rig, and 38 imported shareware monsters | **Retained as Cage / Rigged Assets (Per Plan 38 §3):** Natural rocks/craters stay on the 3-LOD cage pipeline but bind `@hm/matstack` triplanar materials (`mat:moon-dusted`, `mat:overgrown-relic`). All 90 man-made legacy `.glb` entries are **removed from `dist/index.html`**, saving **~3.8 MB** of inline bundle size! | `dist/index.html <= 14.5 MB`; `registry.json` audit confirms zero man-made legacy GLBs remain in game scenes. |

## 5. Pillar 3: In-Studio Procedural Texture Graph & Swatch Designer (`@hm/matstack` + `@hm/texgraph`)

### 5.1 Two-Tier Material & Texture Editing Workflow

Following `docs/STUDIO_PLAN.md` §1 (*"Three depths in every tool: 1. Preset, 2. Tune, 3. Overhaul"*) and Plan 41 (`41-layered-materials.md`), the Right Dock's **`[Material & Layers]`** and **`[TexGraph & UV]`** tabs provide a seamless progression from 1-click presets to deep node-graph authoring—always rendering live on the selected 3D asset in the main viewport:

#### Tier 1: Curated Smart-Material Shelf & Quick Macro Tuning (Default View)
1. **16 Curated `@hm/matstack` Smart-Material Swatches (`FIRST_MATSTACK_SHELF`):**
   - Rendered as `64×64` cached thumbnails of the `MATSTACK_TEST_PIECE_KIT` wearing each material:
     - `mat:lab-fresh`, `mat:workshop-steel`, `mat:field-worn-hazard`, `mat:moon-dusted`, `mat:rust-bucket`, `mat:furnace`, `mat:old-copper`, `mat:oily-engine`, `mat:overgrown-relic`, `mat:frozen-rig`, `mat:brushed-lab-steel`, `mat:carbon-racer`, `mat:hazard-chevron`, `mat:rubber-seal`, `mat:slatted-grille-steel`, `mat:crushed-ore-bed`.
   - **Hover Try-On:** Hovering any swatch previews it live on the selected `activeSlotName` in the 3D viewport; clicking commits it.
2. **Quick Macro Controls (Top of Material Inspector):**
   - **`Paint 1` & `Paint 2` Color Pickers:** Hex swatches + HSV sliders (e.g., changing `paint1` on `mat:field-worn-hazard` repaints the machine's powder-coat body while keeping all edge-wear, cavity grime, and hazard stripes intact).
   - **`Age / Weathering` Master Slider (`0.00 .. 1.00`):** Scales all `weathering: true` layers simultaneously using `@hm/matstack`'s `layerWeight` threshold formula `clamp01((m + age - 1) / age)` so rust, dust, and grime grow organically out of crevices and pits!
   - **`UV Scale & Triplanar Toggle`:** Adjusts base tile scale in metres (`0.05 m .. 4.0 m`).

#### Tier 2: Substance-Style 5-Level Layer Stack (`@hm/matstack` Deep Editor)
 below the macro controls sits the interactive **Layer Stack** (`layers` array, rendered top-down with drag-to-reorder):
- **Layer Row Controls:** `[Eye Toggle (visible)]` · `[Mask B&W View Toggle]` · `[Layer Thumbnail + Name]` · `[Weathering Tag]` · `[Opacity 0..1]` · `[Up / Down / Delete]` · `[+ Add Layer from LAYER_SHELF]`.
- **Expanded Layer Drawer (when a Layer Row is clicked):**
  1. **Channel Write Toggles (`writes: ChannelGroup[]`):** Pill toggles for `colour`, `metal`, `rough`, `specular`, `height`, `coat`, `fuzz`, `aniso`, `film`, `emit` (defaulting opaque weathering layers to include `'coat'` and `'aniso'` so base clearcoat/anisotropy never bleeds through rust or mud, per `ARGO_NOTE_43` Bug #2).
  2. **Surface Editor (`SurfaceSpec`):**
     - Pick from the 29 `SURFACE_SHELF` presets (14 base + 15 weathering) or customize:
     - `colour` (`paint1`, `paint2`, `#rrggbb`) or **Multi-Stop Gradient `ramp`** (`RampStop[]` over tile grey, up to `MAX_RAMP_STOPS = 6`).
     - `metal` (`0..1`), `rough` (`0..1`), `specular` (`0..1`).
     - **Primary Tile (`TileUse`):** Visual picker from the 20 `TILE_LIBRARY` procedural tiles + `scale` (m), `bump` (`0..1`), `roughVar` (`0..1`), `colourVar` (`0..1`).
     - **Detail Tile (`detail?: TileUse`):** Secondary micro-relief tile (e.g., `pits`, `orange-peel`, `fine-grain`, `scratches`).
     - **OpenPBR Physical Slabs:** Collapsible toggles for `coat` (`amount`, `rough`), `fuzz` (`amount`, `colour`), `aniso` (`amount`, `axis: 'u'|'v'`), `film` (`amount`, `thickness` nm), and `emit` (`colour`, `intensity`).
  3. **Mask ("Where") Editor (`MaskSpec`):**
     - Pick from the 11 `MASK_SHELF` presets (`edge-chips`, `worn-edges`, `crevices`, `tops`, `undersides`, `splash-zone`, `drips`, `patches`, `pitting`, `scratches`, `everywhere`) or stack up to `MAX_MASK_INPUTS = 4` inputs:
       - `edge` / `cavity` (`width` in mm, `0.5 mm .. 80 mm`)
       - `up` / `down` (`angle` deg, `soft` deg)
       - `ground` (`height` m above machine foot, `soft` m)
       - `noise` (`clouds | cells | speckle | scratches`, `scale` m, `seed`)
       - `streaks` (`scale` m, `stretch`, `seed` — gravity-aligned leaks on side walls)
     - Per-input `blend` (`normal | add | subtract | multiply | max | min`), `opacity`, `invert`, plus global mask `balance` (`-1..1`), `contrast` (`0..1`), and `heightBlend` (`0..1`).

#### Tier 3: Procedural `@hm/texgraph` DAG Node Editor (`[TexGraph & UV]` Tab)
Clicking **`[Edit Tile Graph]`** on any `TileUse` (or opening the `TexGraph` tab) opens the interactive node-graph canvas (`@hm/wiregraph` + `@hm/texgraph`):
- **All 18 Periodic Node Types:**
  - *Existing 12:* `noise` (with anisotropic `scaleY`), `cellular` (`f1 | f2 | edge`), `grain`, `stripes` (with seamless integer `tilt`), `checker`, `constant`, `warp` (with divergence-free `curl: true`), `blend`, `levels`, `invert`, `ramp`, `scaleBias`.
  - *New 6 (`OPUS_NOTE_44` / `TICKET-41`):* `scratches` (wrapped line segments), `spots` (wrapped discs for pits/flakes/mud), `hex` (`edge | cell` lattice), `weave` (over-under twill), `blur` (wrapped box/gaussian blur), plus `normalFromHeight`.
- **Live 2×2 Seamless Tile Preview + Direct 3D Asset Binding:**
  - Shows a 2×2 tiled 2D preview (`Grey`, `Height`, `Normal`, `Roughness`, `Lit`) to verify zero wrap seams, while **simultaneously updating the `DataArrayTexture` slice on the 3D machine in the main viewport** in `< 25 ms` (at `128×128`)!

## 6. Component Hierarchy & File Map for `apps/web/src/studio/`

```
apps/web/src/studio/
├── studio-app.tsx                 # Top-level 4-zone Studio shell & keyboard router (W/E/R, G/R/S, M mask view, F5 play)
├── state/
│   ├── studio-store.ts            # Shared StudioSelection, undo/redo (@hm/scenedoc), and staged Changes queue
│   └── studio-persistence.ts      # POST /__studio/write client for studio-data/{materials,tiles,kits}/*.json
├── viewport/
│   ├── studio-viewport.tsx        # Three.js canvas rendering active Kit/Part/Asset with Stage 0..4 look & PMREM
│   ├── raycast-picker.ts          # Triangle hit -> kitBuild.partAt() -> { path, partId, slotName } + Socket pin picking
│   ├── socket-gizmos.ts           # 3D triad pins for SocketDef + surface-normal raycast socket creation
│   └── quad-angle-view.tsx        # Synchronized 4-angle (Front 0°, Right 90°, Back 180°, Iso 45°) & Legacy-vs-Kit split view
├── outliner/
│   ├── studio-outliner.tsx        # Tree view of AssemblyDef -> PlacedPart -> Slots & Sockets
│   └── unified-shelf.tsx          # Searchable thumbnail grid for Kits, Modules, @hm/partgen, @hm/matstack, @hm/texgraph
├── inspectors/
│   ├── material-slot-strip.tsx    # Horizontal pill bar of all material slots on the selected asset/part + eyedropper
│   ├── matstack-inspector.tsx     # Tier 1 (Paint 1/2, Age, Swatches) + Tier 2 (Layer Stack, SurfaceSpec, MaskSpec, B&W toggle)
│   ├── kit-assembler-panel.tsx    # Socket attachment, Placement (at/rot/mirror/repeat/rank), and live validate() banner
│   ├── partgen-meshops-panel.tsx  # @hm/partgen schema sliders + 6 Quick-Preset pills + 27-op @hm/meshops modifier stack
│   └── texgraph-node-editor.tsx   # Tier 3 @hm/texgraph + @hm/wiregraph node canvas with 2x2 seam preview & live array upload
```

## 7. Verification Gates (No Ticket Lands Without Passing All 4 Gates)

1. **Automated Unit & Oracle Gate (`npm test` & `npm run typecheck`):**
   - Zero TypeScript errors (`noUncheckedIndexedAccess: true`).
   - All `@hm/matstack`, `@hm/texgraph` (20 tiles seam/spread/timing tests), `@hm/kitspec` (`validate() === 0 issues`), `@hm/partgen` (20 generators × 3 ranks), and `@hm/meshops` (27 operators) unit tests pass.
2. **Coverage & Shader Parity Gate (`scripts/material-coverage.mjs` & `scripts/test-layered-material.mjs`):**
   - `mat:field-worn-hazard` shows warm khaki `#b8b2a2` across `>= 65%` of flat panel faces, `5–15%` rust-bloom patches near crevices/edges, `>= 80%` bright metal on sharp convex bevels (`aEdge`), and striped yellow/black hazard bands (`stripes` tile).
3. **4-Angle Visual & Side-by-Side Comparison Gate (Rule 17 & Rule 8a):**
   - Every kit machine and material shelf change must generate a 4-angle sheet (`node scripts/kit-compare-sheet.mjs` and `node scripts/parts-reference-sheet.mjs`) reviewed from `Front (+z)`, `Right (+x)`, `Back (-z)`, and `Left (-x)` at Ranks `0`, `1`, and `2`.
4. **End-to-End Studio Playwright Gate (`scripts/test-studio-suite.mjs`):**
   - Automated headless browser test that opens `http://localhost:5173/?studio`, selects `kit:texture-mill`, clicks the `body` slot in the 3D viewport, assigns `mat:field-worn-hazard`, changes `paint1` to `#4ade80`, toggles `Mask B&W View`, snaps a `bolt` part onto a socket, clicks `Accept & Save`, reloads the page, and asserts that the saved material and part persist in both the Studio and the Lab!
