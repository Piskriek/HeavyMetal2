# MP-T04: Ball Customizer Studio Modal & Decal Catalog

- **ID**: `MP-T04`
- **Priority**: High (Phase B / Visual Track)
- **Track**: Frontend UI & Garage System
- **Estimate**: 5 days
- **Dependencies**: `MP-T02`, `MP-T03`
- **Target Files**: `src/components/garage/BallCustomizerModal.tsx`, `DecalGizmo.tsx`, `UnwrapMinimap.tsx`, `src/game/ball/decal-catalog.ts`, `public/decals/*.png`

---

## Goal
Deliver an interactive, dieselpunk-styled 3D Ball Customizer Modal ("The Garage") that allows players to inspect their marble in an orbit viewer, select base finishes, stamp up to 12 customizable decals with live 3D surface raycasting, tweak colors and layers, and preview their design with spin physics.

---

## UI/UX Specification

### 1. Viewport Layout (1440x900 & Mobile Responsive)
- **Left Drawer (320px)**: Finish selector (Scrap Iron, Galvanized Brass, Damascus, Obsidian, Boiler Copper), primary accent color picker, seam rivet toggle.
- **Center Stage**: Interactive Three.js 3D viewport. Left-click drag orbits camera, scroll zooms, right-click pans. Includes "Test Spin" toggle to watch circumferential bands roll.
- **Right Drawer (360px)**:
  - Active Decal Stack: Drag-and-drop layer reordering (0 to 12 stamps).
  - Selected Stamp Controls: Scale slider (0.05 to 0.5), rotation knob (-180° to +180°), opacity slider, blend mode radio (`normal`, `multiply`, `overlay`), tint color palette.
  - Number Roundel input (0 to 99).
- **Bottom Bar**: 2D Equirectangular Unwrap Minimap with polar bearing cap occlusion guides, 50-step Undo/Redo buttons, Cart Cost readout, "Save to Slot" button.

### 2. Raycast Decal Stamping
- Clicking directly on the 3D marble surface casts a ray onto the rotated sphere.
- Normal vector is converted to `(u, v)` coordinates; a new `DecalStamp` is instantly created and selected.
- Debounced Web Worker bake updates the 3D texture in `< 40 ms`.

### 3. Try-Before-Buy Economy Integration
- Unowned finishes or premium decals display an ornate brass lock icon and gold price.
- Players can freely experiment; clicking "Save" tallies the total gold cost and executes a ledger transaction if affordable.

---

## Acceptance Criteria
- [ ] Modal opens and renders at 60 fps across desktop (≥ 1024px) and tablet viewports.
- [ ] Surface raycasting stamps decals within 1 texel of the cursor impact point.
- [ ] Undo/Redo stack supports 50 historical actions with coalesced drag events.
- [ ] 12-decal cap strictly enforced; attempting to add a 13th decal displays a friendly warning toast.
- [ ] Unowned items block saving until confirmed and purchased via the gold ledger.

---

## Tests to Run
`npm run check:ui`
