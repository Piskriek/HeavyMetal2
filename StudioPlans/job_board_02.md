# FIDELITY: THE STUDIO OVERHAUL — MASTER AI AGENT JOB BOARD (`docs/JOB_BOARD.md`)

> **Mandate:** Execute [Plan 44 (docs/argo/plans/44-studio-creative-suite-realization.md)](https://www.google.com/search?q=./argo/plans/44-studio-creative-suite-realization.md) to transform `http://localhost:5173/?studio` from a disconnected prototype shell into the Owner's gold-standard in-engine creative suite.  
> **Opus Core Status (`studio-44-opus-core-bundle.json`):** Because we are operating without Claude Opus right now, **Argo has written, compiled, and unit-tested all 12 complex math, procedural node, shader-bridge, raycast-picking, socket-alignment, and state-machine files (`77 / 77` tests passing)** in `studio-44-opus-core-bundle.json`!  
> **Flash's Job:** Unpack `studio-44-opus-core-bundle.json` with the 1-line command below, then build the thin React UI panels (`STUDIO-44C` and `STUDIO-44D-UI`) and machine kits (`STUDIO-44E`) directly on top of Argo's verified store and viewport APIs.

## 0. One-Command Unpack of Argo's Verified Core Bundle (`77 / 77` Tests Passing)

Run this from `C:\MarbleGp` to install all 12 verified core files from `studio-44-opus-core-bundle.json`:

```bash
node -e "const fs=require('fs'),path=require('path'),b=JSON.parse(fs.readFileSync('studio-44-opus-core-bundle.json','utf8'));for(const[p,c]of Object.entries(b.files)){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);console.log('Unpacked:',p);}"
```

### Files Installed by `studio-44-opus-core-bundle.json`:
1. `packages/texgraph/src/index.ts` — Adds the 6 periodic, seamless nodes (`noise.scaleY`, `scratches`, `spots`, `hex`, `weave`, `blur`) + `TILE_LIBRARY` (all 20 canonical procedural tiles from `OPUS_NOTE_44`, evaluating `< 25 ms` at `128px`).
2. `packages/texgraph/tests/tile-library.test.ts` — `40 / 40` unit tests passing (`validateGraph`, determinism, seamless wrap `<= 1.5x` interior diff, 5th–95th grey spread `>= 0.35`, non-constant height, `< 25 ms` speed gate).
3. `packages/matstack/src/index.ts` — Re-exports `./shelf` for unified `@hm/matstack` imports.
4. `packages/matstack/src/shelf.ts` — Fixes all 4 coverage & ordering bugs from `OPUS_NOTE_41` v4 (`Rust bloom` `10%` on flat faces / `82%` in creases; `Oil leaks` `11%` on flat faces / `78%` in creases; `Soot` `82%` in creases; dark `mat:crushed-ore-bed` with `0%` top moon-dust; mechanical `paint-chips` and `edge-wear` at top of layer stack).
5. `apps/web/src/play/kit-trim-palette.ts` — Synced with the updated `shelf.ts`.
6. `apps/web/src/play/kit-modules.ts` — Fixes strict TypeScript `kind: 'param' as const` on `MATSTACK_TEST_PIECE_KIT` (`29 / 29` tests passing in `kit-mill-v2.test.ts`).
7. `apps/web/src/studio/viewport/raycast-picker.ts` — $O(\log N)$ binary-search triangle-to-`PlacedPart` & `slotName` raycast resolver (`buildKitPickTable`, `pickPartAndSlotAtTriangle`, `pickSlotOnStandalonePart`, `extractMaterialSlots`).
8. `apps/web/src/studio/viewport/socket-gizmos.ts` — 3D socket pin enumerator (`enumerateAssemblySockets`), surface-normal raycast socket creator (`surfaceHitToSocketDef` with `5 mm` snap & Three.js `'XYZ'` Euler alignment), and 1-click floating-part repair solver (`autoSnapFloatingPlacements`).
9. `apps/web/src/studio/viewport/layered-material-bridge.ts` — Builds the 20-slice `DataArrayTexture` buffer + 4-channel noise atlas (`createStudioTileBank`), live single-slice updater (`updateTileInBank`), and shader uniform packer (`compileMaterialUniforms` with `uMaskViewLayer` for B&W mask diagnostic mode).
10. `apps/web/src/studio/state/studio-store.ts` — Complete `createStudioStore` state machine with `subscribe`/`getSnapshot` (`useSyncExternalStore`-ready), hover try-on, slot binding, 6-layer `@hm/matstack` mutations, `@hm/texgraph` live graph updates, `@hm/kitspec` socket attachment, `@hm/meshops` quick presets, and 64-step undo/redo.
11. `apps/web/src/studio/state/studio-persistence.ts` — `persistStagedStudioChanges` (`POST /__studio/write` client).
12. `apps/web/src/studio/studio-core.test.ts` — `8 / 8` end-to-end unit tests verifying all Studio core modules.

## 1. Master Ticket Queue & Status

| Ticket ID | Priority & Wave | Status | Assigned Agent | Title & Scope Summary | Locked Files (Strict Boundary) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **STUDIO-44A** | **P0 — Wave 1** | **DONE (`40/40` & `29/29` Tests Pass)** | **Argo** (Delivered in `studio-44-opus-core-bundle.json`) | **Complete 20-Tile `@hm/texgraph` Library & Fix `@hm/matstack` Shelf Coverage** | `packages/texgraph/src/index.ts`, `packages/texgraph/tests/tile-library.test.ts`, `packages/matstack/src/shelf.ts`, `apps/web/src/play/kit-modules.ts`, `apps/web/src/play/kit-trim-palette.ts` |
| **STUDIO-44B** | **P0 — Wave 1** | **DONE (`8/8` Tests Pass)** | **Argo** (Delivered in `studio-44-opus-core-bundle.json`) | **Shared `StudioStore`, $O(\log N)$ 3D Raycast Slot Picker, Socket Math & Live `DataArrayTexture` Bridge** | `apps/web/src/studio/state/studio-store.ts`, `apps/web/src/studio/state/studio-persistence.ts`, `apps/web/src/studio/viewport/raycast-picker.ts`, `apps/web/src/studio/viewport/socket-gizmos.ts`, `apps/web/src/studio/viewport/layered-material-bridge.ts` |
| **STUDIO-44C** | **P0 — Wave 1 (READY FOR FLASH NOW)** | **OPEN — READY TO WIRE** | **Gemini Flash** | **Pillar 1 & 3 React UI: Material Slot Strip, Two-Tier `@hm/matstack` Layer Inspector & `@hm/texgraph` Node Editor** | `apps/web/src/studio/inspectors/material-slot-strip.tsx`, `apps/web/src/studio/inspectors/matstack-inspector.tsx`, `apps/web/src/studio/inspectors/texgraph-node-editor.tsx`, `apps/web/src/studio/outliner/unified-shelf.tsx` |
| **STUDIO-44D-UI** | **P0 — Wave 1 (READY FOR FLASH NOW)** | **OPEN — READY TO WIRE** | **Gemini Flash** | **Pillar 2 React & Viewport UI: Outliner Tree, 3D Socket Pin Meshes, Kit Assembler Panel & `@hm/meshops` Stack UI** | `apps/web/src/studio/outliner/studio-outliner.tsx`, `apps/web/src/studio/viewport/studio-viewport.tsx`, `apps/web/src/studio/inspectors/kit-assembler-panel.tsx`, `apps/web/src/studio/inspectors/partgen-meshops-panel.tsx`, `apps/web/src/studio/viewport/quad-angle-view.tsx` |
| **STUDIO-44E** | **P0 — Wave 2** | **OPEN** | **Gemini Flash + Haiku** | **Wave 1 & 2 Legacy GLB Replacement: Rebuild Lab & Field Machines as Pure `@hm/kitspec` Assemblies** | `apps/web/src/play/kit-mill-v2.ts`, `apps/web/src/play/kit-press-v2.ts`, `apps/web/src/play/kit-water-maker.ts`, `apps/web/src/play/kit-rock-drill.ts`, `apps/web/src/play/kit-lab-machines.ts`, `apps/web/src/play/machine-props.ts` |
| **STUDIO-44F** | **P1 — Wave 3** | **OPEN** | **Gemini Flash / Haiku** | **End-to-End Studio Playwright Verification (`scripts/test-studio-suite.mjs`) & Legacy GLB Purge** | `scripts/test-studio-suite.mjs`, `scripts/retire-legacy-glbs.mjs` |

## 2. Step-by-Step Implementation Guide for Gemini Flash (`STUDIO-44C` & `STUDIO-44D-UI`)

All complicated math, raycast triangle lookup, socket normal alignment, undo/redo, and texture buffer slicing are already implemented in `studio-44-opus-core-bundle.json`. Flash only needs to wire the React components and Three.js viewport hooks below!

### Step 1: Shared React Hook (`useStudioStore`) in `apps/web/src/studio/studio-app.tsx`

```tsx
import { useSyncExternalStore } from 'react';
import { createStudioStore, type StudioState, type StudioStore } from './state/studio-store';
import { MILL_V2_KIT } from '../play/kit-mill-v2';
import { CAPACITOR_BANK_V2_KIT } from '../play/kit-capacitor-bank-v2';
import { MATSTACK_TEST_PIECE_KIT } from '../play/kit-modules';

export const globalStudioStore: StudioStore = createStudioStore(
  {
    'kit:texture-mill': { kit: MILL_V2_KIT, rootPreset: 'mill-frame' },
    'kit:capacitor-bank': { kit: CAPACITOR_BANK_V2_KIT, rootPreset: 'capacitor-bank' },
    'kit:test-piece': { kit: MATSTACK_TEST_PIECE_KIT, rootPreset: 'matstack-test-piece' },
  },
  'kit:texture-mill',
);

export function useStudioState(): StudioState {
  return useSyncExternalStore(globalStudioStore.subscribe, globalStudioStore.getSnapshot);
}
```

### Step 2: `STUDIO-44C` — Wiring the Material Slot Strip & Two-Tier `@hm/matstack` Inspector

#### A. `apps/web/src/studio/inspectors/material-slot-strip.tsx`
- Call `const slots = globalStudioStore.getMaterialSlotsForActiveKit();` and `const state = useStudioState();`.
- Render a horizontal scrollable pill strip at the top of the Right Dock showing each `slot` in `slots`:
  - Pill label: `slot.slotName` (e.g. `mill-main-carcass:body`) + badge `×${slot.partCount}`.
  - Swatch preview: `slot.materialId` colour chip (`paint[0]` and `paint[1]` from `globalStudioStore.getEffectiveMaterialSpec(slot.materialId)`).
  - `onClick`: `globalStudioStore.selectPartAndSlot(slot.partPaths[0] ?? null, slot.slotName.split(':')[0] ?? null, slot.slotName)`.

#### B. `apps/web/src/studio/inspectors/matstack-inspector.tsx`
- Read `const state = useStudioState();` and `const spec = globalStudioStore.getEffectiveMaterialSpec(state.activeMaterialId);`.
- **Tier 1 (Curated Smart-Material Shelf & Macro Bar):**
  - Map over `FIRST_MATSTACK_SHELF` (`import { FIRST_MATSTACK_SHELF, LAYER_SHELF, SURFACE_SHELF, MASK_SHELF } from '@hm/matstack'`):
    - `onMouseEnter={() => globalStudioStore.setHoveredMaterial(preset.id)}`
    - `onMouseLeave={() => globalStudioStore.setHoveredMaterial(null)}`
    - `onClick={() => state.activeSlotKey && globalStudioStore.assignSlotMaterial(state.activeSlotKey, preset.id, state.activePartPath ? 'part-override' : 'kit-slot')}`
  - **Paint 1 & Paint 2 Pickers:**
    - `<input type="color" data-testid="mat-paint1" value={spec.paint[0]} onChange={(e) => globalStudioStore.setMaterialPaint(0, e.target.value)} />`
    - `<input type="color" data-testid="mat-paint2" value={spec.paint[1]} onChange={(e) => globalStudioStore.setMaterialPaint(1, e.target.value)} />`
  - **Master `Age` Slider (`0..1`) & Solvent Button:**
    - `<input type="range" min={0} max={1} step={0.01} data-testid="mat-age" value={spec.age} onChange={(e) => globalStudioStore.setMaterialAge(Number(e.target.value))} />`
    - `<button data-testid="mat-solvent" onClick={() => globalStudioStore.applySolventToActiveKit(state.activePartPath)}>Clean with Solvent</button>`
- **Tier 2 (Interactive 6-Layer Stack — rendered top-first `[...spec.layers].reverse()`):**
  - For each layer at index `li`:
    - **Visibility Eye Toggle:** `onClick={() => globalStudioStore.toggleLayerVisible(li)}`
    - **Mask B&W Diagnostic Toggle (`[M]`):**
      ```tsx
      const isMaskActive = state.viewportMode === 'mask-bw' && state.maskViewLayerIndex === li;
      <button
        data-testid={`layer-mask-view-${li}`}
        onClick={() => globalStudioStore.setViewportMode(isMaskActive ? 'lit' : 'mask-bw', isMaskActive ? null : li)}
      >
        {isMaskActive ? 'Mask B&W: ON' : 'Mask B&W'}
      </button>
      ```
    - **Opacity Slider:** `onChange={(e) => globalStudioStore.updateLayer(li, { opacity: Number(e.target.value) })}`
    - **Move Up / Move Down / Delete:** `globalStudioStore.moveLayer(li, li + 1)`, `globalStudioStore.moveLayer(li, li - 1)`, `globalStudioStore.removeLayer(li)`
    - **Expanded Layer Drawer (when `state.activeLayerIndex === li`):**
      - **Channel Writes Pills (`CHANNEL_GROUPS`):** `onClick={() => globalStudioStore.toggleLayerChannelWrite(li, ch)}`
      - **Surface Preset Dropdown (`SURFACE_SHELF`):** `onChange={(e) => globalStudioStore.updateLayer(li, { surface: SURFACE_SHELF[e.target.value]! })}`
      - **Surface Sliders (`metal`, `rough`, `specular`, `tile.scale`, `tile.bump`):** `globalStudioStore.updateLayerSurface(li, { ... })`
      - **Mask Preset Dropdown (`MASK_SHELF`):** `onChange={(e) => globalStudioStore.updateLayer(li, { mask: MASK_SHELF[e.target.value]! })}`
      - **Mask Sliders (`balance`, `contrast`, `invert`, `heightBlend`):** `globalStudioStore.updateLayerMask(li, { ... })`

#### C. `apps/web/src/studio/inspectors/texgraph-node-editor.tsx`
- Read `const state = useStudioState();` and `const graph = state.tiles[state.activeTileId]!;`.
- When any node parameter slider changes:
  1. Call `const res = globalStudioStore.updateTexGraph(state.activeTileId, updatedGraph);`
  2. In the viewport's `StudioTileBank`, call `updateTileInBank(tileBank, state.activeTileId, updatedGraph)` and set `dataArrayTexture.needsUpdate = true` so the 3D machine updates in `< 15 ms`!

### Step 3: `STUDIO-44D-UI` — Wiring the 3D Viewport Raycast Picker, Socket Pins & Kit Assembler

#### A. Viewport Raycast Click -> Part & Slot Selection (`apps/web/src/studio/viewport/studio-viewport.tsx`)
```ts
import { buildKitPickTable, pickPartAndSlotAtTriangle } from './raycast-picker';
import { enumerateAssemblySockets, surfaceHitToSocketDef } from './socket-gizmos';

// Rebuild pickTable whenever activeKitId, previewRank, or overrides change:
const entry = state.kits[state.activeKitId]!;
const pickTable = buildKitPickTable(
  entry.kit,
  entry.rootPreset,
  state.previewRank === 'auto' ? 2 : state.previewRank,
  state.overridesByKit[state.activeKitId],
);

// On canvas pointerdown (when not dragging gizmo):
const hits = raycaster.intersectObject(kitMeshGroup, true);
const hit = hits[0];
if (hit && hit.faceIndex !== undefined && hit.faceIndex !== null) {
  if (isAddingSocketOnSurfaceMode && state.activePartId) {
    const newSock = surfaceHitToSocketDef(
      [hit.point.x, hit.point.y, hit.point.z],
      [hit.face!.normal.x, hit.face!.normal.y, hit.face!.normal.z],
    );
    globalStudioStore.addSocketToPart(state.activePartId, `sock_${Date.now() % 1000}`, newSock);
  } else {
    const picked = pickPartAndSlotAtTriangle(pickTable, hit.faceIndex);
    if (picked) {
      globalStudioStore.selectPartAndSlot(
        picked.path,
        picked.partId,
        `${picked.partId}:${picked.slotName}`,
      );
    }
  }
}
```

#### B. Rendering 3D Socket Pins (`enumerateAssemblySockets`)
```ts
const socketPins = state.showSockets
  ? enumerateAssemblySockets(entry.kit, entry.rootPreset, state.overridesByKit[state.activeKitId])
  : [];
// Render each pin in `socketPins` at `pin.worldPos` oriented along `pin.worldUpDir` with color `pin.colorHex`.
// Clicking a pin calls `globalStudioStore.selectSocketPin(pin.pinId)`, and choosing a generator from the popover calls:
// `globalStudioStore.attachPartToSocket(pin.childIndex, pin.socketName, chosenGenId)`!
```

#### C. Live Grounding Banner & 1-Click Auto-Fix (`apps/web/src/studio/inspectors/kit-assembler-panel.tsx`)
```tsx
{state.validationIssues.length === 0 ? (
  <div data-testid="kit-valid-badge" className="studio-badge-ok">
    0 issues — All parts grounded & valid
  </div>
) : (
  <div data-testid="kit-issues-banner" className="studio-badge-warn">
    <span>{state.validationIssues.length} grounding/kit issues detected</span>
    <button
      data-testid="kit-autofix-grounding"
      onClick={() => globalStudioStore.autoFixGroundingIssues()}
    >
      Auto-Snap Floating Parts to Ground
    </button>
  </div>
)}
```

#### D. Parametric `@hm/partgen` Sliders + 6 Quick-Preset `@hm/meshops` Pills (`partgen-meshops-panel.tsx`)
```tsx
import { GENERATORS } from '@hm/partgen';
import { QUICK_MESHOP_PRESETS, type QuickMeshOpPreset } from '../state/studio-store';

// For the selected part `state.activePartId`:
const partDef = entry.kit.parts[state.activePartId];
if (partDef && partDef.source.kind === 'param') {
  const gen = GENERATORS[partDef.source.gen];
  // 1. Render schema sliders for `gen.params`:
  //    onChange={(v) => globalStudioStore.updatePartParam(state.activePartId!, param.key, v)}
  // 2. Render the 6 One-Click Quick-Preset buttons:
  //    (['smooth', 'chamfer-45', 'recessed-seam', 'funnel-taper', 'stretch-span', 'edge-wear'] as QuickMeshOpPreset[]).map(preset => (
  //      <button key={preset} onClick={() => globalStudioStore.applyQuickMeshOp(state.activePartId!, preset)}>
  //        {preset}
  //      </button>
  //    ))
}
```