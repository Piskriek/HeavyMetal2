# DIRECTIVE FOR GEMINI ARGO: THE STUDIO SANITIZATION & PROTO-GRAVEYARD PURGE
> **To**: Gemini Argo (Creative & Modular Systems Lead)  
> **From**: Francois (The Owner) & Antigravity  
> **Mandatory Reading Before Any Work**: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md) (2026-10-08, 2026-10-21 Rule 8a, and 26 October feedback), [`docs/argo/RULES.md`](file:///c:/MarbleGp/docs/argo/RULES.md).  
> **Status**: P0 Immediate Remediation Mandate  

---

## 1. REALITY CHECK: THE OWNER'S 30-SECOND GLANCE AUDIT

Argo, look at the Studio through the Owner's eyes. Francois opened `http://localhost:5173/?studio` and in thirty seconds identified five glaring issues that scream "incoherent grab-bag of abandoned prototypes":

> *"i still see legacy 3d models in the "scene" and "look" sections, why is there a "monster" section that doesnt work? "spore cards" is a nonsensical page with a model that looks like gym equipment, what is "moon prototype"?? i feel like these are logical questions and problems one can pickup from just a glance, what else is going on under the surface, what has argon been doing?"*

While the headless packages (`@hm/matstack`, `@hm/texgraph`, `@hm/kitspec`, `@hm/partgen`, `@hm/cartlab`, `@hm/creature`) have 3,600+ passing unit tests, **the Studio UI was treated like an uncurated dumping ground for every half-baked experiment you and the Codex fleet touched.**

Every time a sidecar or agent touched a sub-package, you allowed another `<button>` to be tacked onto the top header without any design scrutiny. The result is an embarrassment that confuses any artist, coder, or player attempting to use the Studio.

**This is on you. Here is your cleanup mandate.**

---

## 2. THE FOUR GLARING OFFENDERS TO PURGE & REPAIR

### Offender 1: "Moon (prototype)" — Ancient Dead Code in the Header
- **The Crime**: [`apps/web/src/studio/studio-app.tsx`](file:///c:/MarbleGp/apps/web/src/studio/studio-app.tsx) still mounts `renderPrototype()`, an ancient months-old editor (`StudioScreen` in `shell.tsx`) from before the modern Studio was ever conceived.
- **The Fix**: **Delete the "Moon (prototype)" button and its workspace branch completely.** Dead prototypes do not belong in a production creative suite.

### Offender 2: "Monsters" — A Non-Working 2D Form Stub
- **The Crime**: [`apps/web/src/studio/monster-tab.tsx`](file:///c:/MarbleGp/apps/web/src/studio/monster-tab.tsx) was a quick side task ("O3: Monster Remap Strength Workspace") that someone slapped onto the top bar. It has **no 3D canvas, no creature mesh rendering, and no functional preview**. Clicking it opens a static text card with an unrendered remap slider trying to fetch a dev endpoint.
- **The Fix**: **Remove "Monsters" from the top navigation.** Monster customization belongs inside the creature kit workbench under `@hm/creature`, not as a broken text form pretending to be a studio workspace.

### Offender 3: "Spore Cards" — The Gym Equipment Mystery
- **The Crime**: [`apps/web/src/studio/spore-workbench.tsx`](file:///c:/MarbleGp/apps/web/src/studio/spore-workbench.tsx) is a cartridge serialization utility (`JOB-26`, `@hm/cartlab`) for encoding presets into PNG `zTXt` chunks. Its default dropdown item (`circuit-rally`) loads an untextured buggy chassis whose bare metal tubes and roll bars in a grey room literally **look like a gym weight bench**.
- **The Fix**: Spore Cards is an **export/sharing mechanism**, not a primary creative editing workspace. Move Spore Card generation into an `[Export Cartridge / Spore Card]` modal or action button in the top-right header cluster. Remove it as a top-level workspace tab.

### Offender 4: "Scene" & "Look" — Still Loading Legacy 132 `.glb` Files
- **The Crime**: [`scene-tab.tsx`](file:///c:/MarbleGp/apps/web/src/studio/scene-tab.tsx) and [`look-tab.tsx`](file:///c:/MarbleGp/apps/web/src/studio/look-tab.tsx) were written during Phase 1 (`TICKET-08b`) before `@hm/kitspec` existed. They hardcode `loadGenRaw()` from `apps/web/src/assets/gen.ts`, rendering the exact monolithic pre-baked `.glb` assets that Rule 8a strictly forbade.
- **The Fix**:
  - **In `LookTab`**: Replace `loadGenRaw(assetId)` with the active modular machine assembly (`studioState.activeKitId` via `buildStudioMachineModel`). When an artist scrubs stages 0–6 on the terrain patch, they must see the real modular machine (`MILL_V2`, Stargate, Capacitor Bank) reacting with its layered materials, not an obsolete `.glb`.
  - **In `SceneTab`**: Update scene item placement to place modular `@hm/kitspec` assemblies and parts with socket attachments, purging the hardcoded `GEN` asset catalogue.

---

## 3. THE UNIFIED STUDIO STRUCTURE (4 CLEAN WORKSPACES ONLY)

The Studio header must have **exactly four coherent workspaces**, strictly centered on the recursive preset architecture:

```
[ FIDELITY Studio ]  [ Creative Suite ] [ Look & Lighting ] [ Scene Layout ] [ Audio Lab ]    [ Export Spore Card ] [ Command Center ] [ Back to Lab ]
```

1. **`Creative Suite` (Default)**:
   - Center: Live 3D Viewport of the active machine (`MILL_V2`, Stargate, Capacitor Bank, Test Piece).
   - Top of Viewport: `<MaterialSlotStrip />` showing live slot swatches and `[Part | Whole]` scope toggle.
   - Right Dock: 4 core inspector tabs:
     - **`[Material & Layers]`**: Two-tier `@hm/matstack` inspector (16 presets, Paint 1 & 2 pickers, Age slider, 5-layer stack with `[M]` Mask B&W mode).
     - **`[Parts & Assemblies]`**: `@hm/kitspec` assembler, grounding validation badge (`0 Issues`), auto-snap button, and 3D triad socket gizmos.
     - **`[TexGraph (UV)]`**: `@hm/texgraph` procedural node graph editor with 2x2 seam preview.
     - **`[PartGen & MeshOps]`**: Parametric generator sliders with 27-operator mesh modifier stack.
2. **`Look & Lighting`**:
   - Preview the active modular machine on the `@hm/groundshader` terrain patch.
   - Stage scrubber ($S_0 \to S_6$), sun elevation slider, and day/night sky dome.
3. **`Scene Layout`**:
   - Multi-machine base layout placing pure `@hm/kitspec` assemblies with socket links and power/pipe runs.
4. **`Audio Lab`**:
   - Procedural synth stem editor and stage ladder audio preview.

---

## 4. IMMEDIATE ACTION ITEMS FOR ARGO

1. **Purge the Dead Buttons**: Remove `Moon (prototype)`, `Monsters`, and `Spore Cards` from the top navigation bar in `apps/web/src/studio/studio-app.tsx`.
2. **Relocate Spore Card Export**: Wire `downloadSporeCard()` into a clean `[Export Spore Card]` button in the top-right header cluster.
3. **Connect LookTab to Active Kit**: Update `look-tab.tsx` so `lookFrame()` renders the active modular machine from `studioState.kits` instead of `loadGenRaw()`.
4. **Purge Legacy Fallbacks**: Remove old transform inputs (Offset X, Y, Z) and monolithic GLB inspectors from `studio-app.tsx`.
5. **Verify**:
   - `npm run typecheck` (0 errors)
   - `npm test` (all 3,618 tests passing)
   - Standalone bundle strictly under 16.00 MiB.
   - Inspect visually in the browser to ensure zero dead tabs, zero gym equipment surprises, and zero legacy GLBs.
