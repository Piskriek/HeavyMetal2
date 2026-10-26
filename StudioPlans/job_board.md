# FIDELITY: THE STUDIO OVERHAUL — MASTER AI AGENT JOB BOARD (`docs/JOB_BOARD.md`)

> **Mandate:** Execute [Plan 44 (docs/argo/plans/44-studio-creative-suite-realization.md)](https://www.google.com/search?q=./argo/plans/44-studio-creative-suite-realization.md) to transform `http://localhost:5173/?studio` from a disconnected prototype shell into the Owner's gold-standard in-engine creative suite.  
> **Rule 8a Enforcement ("Shortcuts are unacceptable; check each other"):** Every ticket below has strict file locks, deterministic unit tests, and mandatory 4-angle visual verification criteria. No mock sliders, no disconnected demo spheres, and no un-grounded parts.

## 1. Master Ticket Queue & Role Assignment

| Ticket ID | Priority & Wave | Assigned Agent | Title & Scope Summary | Locked Files (Strict Boundary) | Verification Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **STUDIO-44A** | **P0 — Wave 1 (Immediate)** | **Arena / Haiku** (Reviewed by Argo & Opus) | **Complete the 20-Tile `@hm/texgraph` Library (`OPUS_NOTE_44` / `TICKET-41`) & Fix `@hm/matstack` Shelf Coverage (`OPUS_NOTE_41` v4)** | `packages/texgraph/src/index.ts`, `packages/texgraph/src/tile-library.ts`, `packages/texgraph/tests/tile-library.test.ts`, `packages/matstack/src/shelf.ts`, `apps/web/src/play/kit-modules.ts`, `apps/web/src/play/kits.test.ts` | All 20 tiles validate, wrap seamlessly (`seamDiff <= 1.5x interior`), `grey` spread `>= 0.35`, evaluate `< 25 ms` at `128px`; `rust-bloom` face coverage `5–15%` (not `67%`); `soot > 15%`; `kit-modules.ts` strict `tsc` green. |
| **STUDIO-44B** | **P0 — Wave 1 (Immediate)** | **Claude Opus** (Lead Architect) | **Shared `StudioSessionState`, Live 3D Asset Raycast Slot Picker & `DataArrayTexture` / `layered-material.ts` Studio Viewport Integration** | `apps/web/src/studio/state/studio-store.ts`, `apps/web/src/studio/state/studio-persistence.ts`, `apps/web/src/studio/viewport/studio-viewport.tsx`, `apps/web/src/studio/viewport/raycast-picker.ts`, `apps/web/src/play/layered-material.ts`, `apps/web/src/play/kit-build.ts` | Clicking any mesh part in `/studio` selects its `PlacedPart` path + `slotName`; assigning any `mat:` preset immediately renders on the 3D asset in the viewport (zero isolated sphere); `Mask B&W` view renders `layerWeight` on the 3D asset; `POST /__studio/write` persists to `studio-data/`. |
| **STUDIO-44C** | **P0 — Wave 1 (Immediate)** | **Gemini Flash** (UI Builder) | **Pillar 1 & 3 UI: Asset Material Slot Strip, Two-Tier `@hm/matstack` Layer Stack Inspector & `@hm/texgraph` Node Editor Binding** | `apps/web/src/studio/inspectors/material-slot-strip.tsx`, `apps/web/src/studio/inspectors/matstack-inspector.tsx`, `apps/web/src/studio/inspectors/texgraph-node-editor.tsx`, `apps/web/src/studio/outliner/unified-shelf.tsx` | Retire the 5-slider fake sphere tab; display live material slots for the selected asset; hover try-on from `FIRST_MATSTACK_SHELF`; full `paint1`/`paint2`, `age`, per-layer `SurfaceSpec`, `MaskSpec`, channel `writes` toggles, and live `@hm/texgraph` node graph editing with 2×2 seam preview. |
| **STUDIO-44D** | **P0 — Wave 2** | **Claude Opus + Gemini Flash** | **Pillar 2 UI: Interactive `@hm/kitspec` Machine & Kit Assembler, 3D Socket Triad Gizmos, Outliner Tree & `@hm/meshops` Stack Panel** | `apps/web/src/studio/outliner/studio-outliner.tsx`, `apps/web/src/studio/viewport/socket-gizmos.ts`, `apps/web/src/studio/inspectors/kit-assembler-panel.tsx`, `apps/web/src/studio/inspectors/partgen-meshops-panel.tsx`, `apps/web/src/studio/viewport/quad-angle-view.tsx` | Retire the isolated single-part viewer; select any kit (`texture-mill`, `capacitor-bank`, `shape-press`, etc.), inspect its `AssemblyDef` hierarchy, click 3D socket pins to attach `@hm/partgen` parts/modules, drag `@hm/gizmo` (`W/E/R`), run 27 `@hm/meshops` operators, and see live `validate()` grounding status. |
| **STUDIO-44E** | **P0 — Wave 2** | **Arena / Haiku + Flash** (Reviewed by Opus) | **Wave 1 & 2 Legacy GLB Replacement: Rebuild Lab & Field Machines (`Shape Press`, `Water Maker`, `Rock Drill`, `Power Wall`, `Lab Benches`) as Pure `@hm/kitspec` Assemblies** | `apps/web/src/play/kit-mill-v2.ts`, `apps/web/src/play/kit-press-v2.ts`, `apps/web/src/play/kit-water-maker.ts`, `apps/web/src/play/kit-rock-drill.ts`, `apps/web/src/play/kit-lab-machines.ts`, `apps/web/src/play/machine-props.ts` | Replace legacy `.glb` machine wrappers with 100% `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` assemblies; `validate() === 0 issues`; 4-angle `kit-compare-sheet.mjs` wins side-by-side against every legacy model; Lab Gate draw calls `<= 181`. |
| **STUDIO-44F** | **P1 — Wave 3** | **Claude Haiku / Opus** | **End-to-End Studio Playwright Verification Suite (`scripts/test-studio-suite.mjs`) & Legacy GLB Purge (`scripts/retire-legacy-glbs.mjs`)** | `scripts/test-studio-suite.mjs`, `scripts/retire-legacy-glbs.mjs`, `apps/web/src/assets/gen/registry.json` | Automated Playwright test verifies slot picking, `@hm/matstack` live application, `Mask B&W` toggle, `@hm/kitspec` socket attachment, `@hm/meshops` stack, and `studio-data/` disk round-trip; removes retired man-made GLBs to keep `dist/index.html <= 15.0 MB`. |

## 2. Detailed Copy-Paste Implementation Briefs

### BRIEF `STUDIO-44A` — Complete the 20-Tile `@hm/texgraph` Library & Fix `@hm/matstack` Shelf Coverage
- **Assignee:** Arena Battle (`claude-opus-5.5-high` / `gpt-6-astra-max`) or Haiku Sidecar
- **Context & Why:**
  1. `packages/matstack/src/shelf.ts` references 20 procedural tile IDs (`brushed-metal`, `cells`, `cast-iron`, `pits`, `fine-grain`, `orange-peel`, `stripes`, `rubber-grain`, `concrete`, `carbon-weave`, `hex-micro`, `flake-scale`, `grime-clouds`, `regolith-grain`, `moss-clump`, `frost-crystal`, `mud-splatter`, `mineral-crust`, `scorch-burn`, `scratches`). Right now `@hm/texgraph` only has ground presets, so every machine surface falls back to `FLAT_TILE`!
  2. In `OPUS_NOTE_41_ticket40_review_v4.md`, Opus's `scripts/material-coverage.mjs` caught 4 issues in `shelf.ts` and `kit-modules.ts`:
     - `MATSTACK_TEST_PIECE_KIT` in `kit-modules.ts` line 444 needs `kind: 'param' as const` (or `: Kit` annotation) so `Object.freeze` doesn't widen `kind` to `string`.
     - `kits.test.ts` ("defines the 4d two-material trim palette") must be updated for the 4-material palette (`hull-steel`, `accent-hardware`, `khaki-paint`, `hopper-slate`).
     - In `packages/matstack/src/shelf.ts`:
       - `rust-bloom` currently covers `67%` of flat faces on `mat:field-worn-hazard` (turning the khaki mill into rust-brown speckle because `scale: 0.18` on `cells` with 7 features/repeat creates `2.6 cm` blobs everywhere). Fix `rust-bloom`'s mask so it multiplies `cells` (`scale: 0.85 m`) with `cavity`/`edge` or lowers `balance` to `-0.35`, keeping mean face weight to **`5%–15%`** so the warm khaki `#b8b2a2` (`paint1`) dominates `>= 65%` of flat panels!
       - `oil-leaks` covers `40%` of flat faces; restrict it to `streaks` (`scale: 0.6 m`, `stretch: 4`) multiplied with `cavity`/`edge` so mean face coverage is **`8%–18%`**.
       - `soot` has `0%` weight on `mat:furnace`, `mat:oily-engine`, and `mat:slatted-grille-steel`; adjust its `ground`/`cavity`/`noise` balance so `soot` achieves **`15%–35%`** coverage on those three materials.
       - On `mat:crushed-ore-bed`, remove or reduce `moon-dust` (`top` mask opacity `<= 0.12`) so the top hopper ore bed reads as dark crushed ore (`#1c2026`), never a light grey tray!
- **Required Implementation in `packages/texgraph/`:**
  1. Add the 6 periodic, seeded, wrapping node types to `packages/texgraph/src/index.ts` (and `validateGraph`):
     - `noise`: add optional integer `scaleY` (defaulting to `scale`) for anisotropic streaks (`brushed-metal`).
     - `scratches`: `{ count, length, width, angleSpread, seed }` — thin anti-aliased line segments that wrap cleanly across `[0, 1)` tile boundaries.
     - `spots`: `{ count, radiusMin, radiusMax, softness, seed }` — wrapped discs for pits, flakes, mud, and pebbles.
     - `hex`: `{ count, lineWidth, mode: 'edge' | 'cell', seed }` — periodic hexagonal lattice.
     - `weave`: `{ countX, countY, gap }` — over-under 2×2 twill weave with height rising over crossings (`carbon-weave`).
     - `blur`: `{ in, radius }` — wrapped separable box/gaussian blur (`radius` as fraction of tile `0..0.15`).
  2. Export `TILE_LIBRARY: Readonly<Record<string, TexGraph>>` containing all 20 canonical tile IDs.
- **Acceptance & Verification Gate:**
  - `npm run typecheck` and `npm test` exit 0.
  - Every tile in `TILE_LIBRARY` passes: (a) `validateGraph(tile).ok === true`, (b) determinism check, (c) wrap-seam check (mean absolute difference across `x=0 / x=size-1` and `y=0 / y=size-1` is `<= 1.5x` interior neighbor difference), (d) 5th-to-95th percentile `grey` spread `>= 0.35`, (e) non-constant `height`, and (f) evaluates `128×128` in `< 25 ms`.
  - `node --import tsx scripts/material-coverage.mjs` confirms `mat:field-worn-hazard` flat-face `rust-bloom` weight is `5%–15%`, `soot` is `15%–35%` on `mat:furnace`, and `mat:crushed-ore-bed` top dust is `<= 15%`.

### BRIEF `STUDIO-44B` — Shared `StudioSessionState`, Live 3D Raycast Slot Picker & `layered-material.ts` Viewport Wiring
- **Assignee:** Claude Opus (Lead Architect)
- **Context & Why:**
  - Connects `@hm/matstack`, `@hm/texgraph` (`TILE_LIBRARY`), and `@hm/kitspec` (`kit-build.ts`) to the central 3D viewport in `apps/web/src/studio/` so every material, texture, and part edit happens directly on the 3D asset in view.
- **Required Implementation:**
  1. Create `apps/web/src/studio/state/studio-store.ts` implementing `StudioSelection` and reactive actions:
     - `selectTarget(kind, id)`
     - `selectPartAndSlot(partPath, slotName)`
     - `assignSlotMaterial(slotName, matIdOrSpec, scope: 'part-override' | 'kit-slot')`
     - `updateActiveMaterialSpec(updater: (spec: MaterialSpec) => MaterialSpec)`
     - `attachPartToSocket(parentChildIndex, socketName, placement: Placement)`
     - `updatePartParamsOrOps(partId, params, ops)`
     - All mutations record an undoable command in `@hm/scenedoc` and append a diff entry to the `Changes` panel.
  2. In `apps/web/src/play/layered-material.ts` and `apps/web/src/studio/viewport/studio-viewport.tsx`:
     - Build the `DataArrayTexture` at boot/studio-init from `@hm/texgraph`'s 20 `TILE_LIBRARY` graphs (`128²` on Medium, `256²` on High) plus the `256²` RGBA noise atlas (`clouds`, `cells`, `speckle`, `scratches`).
     - Provide `updateTileInArray(tileId: string, evaluated: EvaluatedTexture)` so editing a `@hm/texgraph` node graph in the Studio uploads the modified slice via `gl.texSubImage3D` in `< 25 ms` and immediately updates the 3D asset in the viewport!
     - Support `viewportMode === 'mask-bw'`: when `activeLayerIndex >= 0` and Mask View is toggled on, output `vec3(layerWeight)` in the fragment shader so the user sees the exact B&W mask on the 3D machine.
     - Wire the Stage 0–4 lighting & PMREM environment scrubber (`[Lab Neutral | S0 | S1 | S2 | S3 | S4]`) in the Studio viewport header so metallic surfaces (`metal > 0.5`) reflect accurate stage sky/ground colors.
  3. In `apps/web/src/studio/viewport/raycast-picker.ts`:
     - On `PointerDown` (when gizmo is not dragging), raycast the active kit build in the viewport, call `kitBuild.partAt(intersection)`, and dispatch `selectPartAndSlot(hit.path, hit.slotName)`.
- **Acceptance & Verification Gate:**
  - Selecting `kit:texture-mill` or `kit:capacitor-bank` in `/studio` and clicking any part highlights that part and its material slot (`body`, `trim`, `bolts`, `band`, `hopper`).
  - Changing the slot's material or tweaking `paint1` / `age` updates the 3D machine in the viewport within 1 frame (`< 16 ms`).
  - Clicking `Accept & Save` writes the updated JSON to `studio-data/` via `studio-persistence.ts`.

### BRIEF `STUDIO-44C` — Pillar 1 & 3 UI: Asset Material Slot Strip, Two-Tier `@hm/matstack` Inspector & `@hm/texgraph` Editor
- **Assignee:** Gemini Flash (UI Builder, reviewed by Opus)
- **Context & Why:**
  - Replaces the disconnected 5-slider sphere demo in the Studio's `Materials` workspace with the real 5-level `@hm/matstack` + `@hm/texgraph` inspector bound to `studio-store.ts`.
- **Required Implementation:**
  1. **`material-slot-strip.tsx`:**
     - Renders at the top of the Right Dock whenever any asset, kit, or part is selected.
     - Lists every material slot on the target (`body`, `trim`, `bolts`, `band`, `hopper`, `lamp`) with its live `48×48` thumbnail swatch, human-readable material name, and `[Scope: This Part | Whole Machine]` toggle.
  2. **`matstack-inspector.tsx`:**
     - **Tier 1 (Preset Shelf & Macro Bar):**
       - Grid of all 16 `FIRST_MATSTACK_SHELF` presets + user-saved `studio-data/materials/` presets with hover try-on (`onMouseEnter` previews on the 3D asset in the viewport, `onMouseLeave` restores, `onClick` commits).
       - `Paint 1` and `Paint 2` color pickers (`#rrggbb` + HSV popovers) and master `Age` (`0..1`) slider + `[Clean with Solvent (Reset Age & Weathering)]` button.
     - **Tier 2 (Interactive Layer Stack — up to `MAX_LAYERS = 6`):**
       - Reorderable list of `LayerSpec` rows (`top` first) plus the `base: SurfaceSpec` row at the bottom.
       - Each row has: `[Eye Toggle (visible)]`, `[Mask B&W Toggle (M)]`, `[Layer Swatch + Name]`, `[Opacity Slider 0..1]`, `[Up/Down/Delete]`, and `[+ Add Layer]` (opening `LAYER_SHELF` with hover try-on).
       - Expanding a layer reveals:
         - **Channel Writes Pills (`writes`):** `colour`, `metal`, `rough`, `specular`, `height`, `coat`, `fuzz`, `aniso`, `film`, `emit`.
         - **Surface Controls (`SurfaceSpec`):** Preset dropdown (`SURFACE_SHELF`), colour/ramp editor (`RampStop[]`), `metal`, `rough`, `specular`, primary `tile` picker (`TILE_LIBRARY` thumbnails + `scale`, `bump`, `roughVar`, `colourVar` + `[Edit Tile Graph ->]`), `detail` tile picker, and OpenPBR collapsible sections (`coat`, `fuzz`, `aniso`, `film`, `emit`).
         - **Mask ("Where") Controls (`MaskSpec`):** Preset dropdown (`MASK_SHELF`), `balance`, `contrast`, `invert`, `heightBlend`, and the `inputs` stack (`edge`, `cavity`, `up`, `down`, `ground`, `noise`, `streaks` with `width`/`angle`/`height`/`scale` in metres/mm and blend modes).
  3. **`texgraph-node-editor.tsx`:**
     - Embeds the `@hm/wiregraph` DAG canvas for the active `TexGraph` tile (`albedo`, `height`, `roughness` output ports).
     - Includes a `[+ Add Node]` menu for all 18 node types, schema sliders for the selected node, a 2×2 seamless wrap preview canvas (`Grey | Height | Normal | Rough | Lit`), and live calls to `updateTileInArray()` so the 3D asset in the main viewport updates as you drag node sliders!
- **Acceptance & Verification Gate:**
  - Zero isolated demo sphere: every slider and preset in `matstack-inspector.tsx` and `texgraph-node-editor.tsx` visibly updates the selected 3D machine/part in the main Studio viewport.
  - All controls carry deterministic `data-testid` attributes for Playwright and Plan 40 BYOA agent automation.

### BRIEF `STUDIO-44D` — Pillar 2 UI: Interactive `@hm/kitspec` Machine & Kit Assembler, 3D Socket Gizmos & `@hm/meshops` Panel
- **Assignee:** Claude Opus + Gemini Flash
- **Context & Why:**
  - Replaces the isolated single-part viewer (`Parts` tab) and static GLB viewer (`Assets` tab) with the unified **Kit & Machine Assembler** (`@hm/kitspec` + `@hm/partgen` + `@hm/meshops`).
- **Required Implementation:**
  1. **`studio-outliner.tsx` & `unified-shelf.tsx` (Left Dock):**
     - Tree view of the active `Kit` (`assemblies[presetId].children`), showing each child `Placement` (`key`, `ref`, attached socket `on`, `mirror`, `repeat`, `rank`), its child sockets, and its material slots.
     - Shelf tabs for `Machines & Kits`, `Reusable Modules`, `Parametric Parts (@hm/partgen — 20 generators in 4 shelves)`, and `Materials (@hm/matstack)`.
  2. **`socket-gizmos.ts` & `quad-angle-view.tsx` (Viewport):**
     - Render interactive 3D socket pins for all `SocketDef` points on the active assembly/part.
     - Implement **`[+ Add Socket on Surface]`** raycast tool (clicks any mesh face, snaps `at` to `5 mm` grid, sets `rot` from face normal).
     - Attach `@hm/gizmo` (`W` Move, `E` Rotate, `R` Scale) to the selected `Placement.at` / `Placement.rot` or `SocketDef.at` / `SocketDef.rot`.
     - Implement the **`[4-Angle Grid]`** (`Front 0°`, `Right 90°`, `Back 180°`, `Iso 45°` — Rule 17) and **`[Compare vs. Legacy GLB]`** split viewport mode.
  3. **`kit-assembler-panel.tsx` & `partgen-meshops-panel.tsx` (Right Dock):**
     - **Live Validation Header:** Runs `@hm/kitspec` `validate()` on every change; displays `0 issues (Grounded)` in green or lists `floating` / `below-ground` / `unknown-socket` issues with a 1-click `[Auto-Snap to Ground / Parent Face]` button.
     - **Placement Controls:** Edit `key`, `ref`, `on: { child, socket, copy }`, `at`, `rot`, `mirror: 'x' | 'z'`, `repeat: { count, step }`, and `rank: 0 | 1 | 2`.
     - **Parametric Part & `@hm/meshops` Stack:** When the selected node is a `param` part, render its `@hm/partgen` schema sliders, the **6 One-Click Preset Pills** (`Smooth`, `45° Chamfer`, `Recessed Seam`, `Taper`, `Stretch Span`, `Edge Wear`), and the full reorderable 27-operator `@hm/meshops` stack (`evaluateOperatorStack`).
- **Acceptance & Verification Gate:**
  - User can open `kit:capacitor-bank` or `kit:texture-mill`, click a socket in 3D, attach a `@hm/partgen` part (`lamp`, `bolt`, `louvre`, `handle`), move/mirror/repeat it, apply a `@hm/meshops` chamfer or smooth preset, verify `validate() === 0 issues`, and save to `studio-data/kits/`.

### BRIEF `STUDIO-44E` — Wave 1 & 2 Legacy GLB Replacement: Rebuild Lab & Field Machines as Pure `@hm/kitspec` Assemblies
- **Assignee:** Arena Battle / Haiku Sidecar + Flash (Reviewed by Opus with `kit-compare-sheet.mjs`)
- **Context & Why:**
  - Enforces Rule 8a ("Shortcuts are unacceptable"): replaces the legacy one-piece `.glb` models and wrapped cores in the Lab and on the Moon with genuine `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` assemblies that players and the Owner can inspect, restyle, and shoot with Part/Material Cartridges.
- **Required Implementation:**
  1. Finalize and land `MILL_V2` (`apps/web/src/play/kit-mill-v2.ts`) with the v4 review fixes from `OPUS_NOTE_41_ticket40_review_v4.md` (`2.80 m` footprint, sloped open-throat hopper with dark `mat:crushed-ore-bed` lumps, base `mat:hazard-chevron` stripes, glowing `lx:` red status lamp and pink `lx:6500:1.2:steady:ff4fd8` cartridge slot, and warm khaki `mat:field-worn-hazard` body).
  2. Author matching pure `@hm/kitspec` assemblies (using the 20 `@hm/partgen` generators and `FIRST_MATSTACK_SHELF` materials) for:
     - **Field Machines (Sheet 12):** `Shape Press` (`kit-press-v2.ts`), `Water Maker` (`kit-water-maker.ts`, `3.6 m × 3.0 m` 1×1 pad per `DEC-05`), `Light Projector` (`kit-light-projector.ts`), `Rock Drill` (`kit-rock-drill.ts`), `Power Unit` (`kit-power-unit.ts`), `Relay Pylon` (`kit-relay-pylon.ts`).
     - **Lab Power & Synthesis Bay (Sheet 06 & 07):** `Breaker Panel`, `Relay Cabinet` (×4), `Operator Console` (angled pedestal with physical red throw lever), `Freestanding Gate Frame` (chunky box-section uprights + 8 recessed ribbed amber coil blocks + floor cable covers), `Hardware Fabricator`, `Preset Bench`, `Preset Combiner`.
  3. Wire `apps/web/src/play/machine-props.ts` and `apps/web/src/lab/lab-scene.ts` to instantiate these `@hm/kitspec` assemblies via `kit-build.ts` (with `partAt()` raycast support for the Beam Rifle's `Apply` mode).
- **Acceptance & Verification Gate:**
  - Every new machine assembly passes `validate(kit, preset) === []` (zero floating or below-ground parts) and resolves 100% of its `mat:` and `lx:` slots.
  - `node scripts/kit-compare-sheet.mjs` 4-angle comparison sheets (`Front`, `Right`, `Back`, `Left`) verified by Opus before retiring each legacy `.glb`.
  - Lab Gate view stays `<= 181` draw calls and `>= 60 FPS` on Low spec.
