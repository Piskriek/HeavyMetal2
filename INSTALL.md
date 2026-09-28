# ModelPaint — 3D Model Textured Surface Painting & Island Mesh Sculpt

This patch adds 3D model textured surface painting (rocks, cliffs, ruins, kit pieces) to Forge 3D in HeavyMetal2, matching the natural island ground surfaces with triplanar world-space projection and height blending.

---

## 1. Apply Steps

From the repository root on base commit `79994ef`:

```bash
# Check that the patch applies cleanly
git apply --check ModelPaint.patch

# Apply the patch
git apply ModelPaint.patch
```

Or using `git am`:
```bash
git am < ModelPaint.patch
```

---

## 2. Files Touched

| File | Purpose |
| :--- | :--- |
| `src/components/builder/KitInspector.tsx` | Added "Paint this model" action button which opens Sculpt & Mesh Paint targeted at the selected prop. |
| `src/components/TrackBuilderUI.tsx` | Wired `onPaintModel` callback prop down to `KitInspector`, auto-opening sculpt window with paint tool active and targeted. |
| `src/components/SculptPanel.tsx` | Added textured **Island surface** palette with 14 island textures, thumbnail previews, flat colour toggle, and erase tips. |
| `src/game/sculpt/sculpt-doc.ts` | Added `surface` section (`idx` LEB128 varints + `s` bytes) to `SculptMeshDoc`, hash tracking, and serialization. |
| `src/game/sculpt/sculpt-mesh.ts` | Added `islSurface` attribute handling (`vec2: id, weight`), `paintSurfaceGroup()`, `unpaintSurfaceGroup()`, material hook, and doc apply/extract. |
| `src/game/sculpt/sculpt-brushes.ts` | Extended brush parameters with `paintMode: 'surface' | 'color'` and `surfaceId`, applying surface stamps with falloff. |
| `src/game/sculpt/sculpt-tool.ts` | Added `focusTarget(id)` method and updated dynamic 3D brush ring swatch indicator to match surface tile colors. |
| `src/game/island-route/island-surfaces.ts` | Added `IslandSurfaceArray.getInstance()` singleton, headless/offline decode safety, and immediate procedural tile fallbacks. |
| `src/game/island-route/island-surface-shader.ts` | Added `SURF_NOISE_GLSL` export and `injectIslandModelShader()` `onBeforeCompile` hook with world-space triplanar projection and height blend over model texture. |
| `tests/model-paint.test.ts` | Pure logic tests: codec round-trips, doc serialization, per-vertex paint law, falloff, and undo reset. |
| `scripts/check.mjs` | Registered model paint test suite into verification pipeline. |

---

## 3. How to Test

### A. Automated Logic & Type Verification

```bash
# 1. Type checking (strict TypeScript with noUncheckedIndexedAccess and noUnusedLocals)
npx tsc --noEmit -p .
node node_modules/typescript/bin/tsc --noEmit -p tests

# 2. Run unit tests
node --import tsx --test tests/model-paint.test.ts
node scripts/check.mjs
```

### B. Interactive Builder Verification

1. Start development server:
   ```bash
   npm run dev
   ```
2. Open the Forge 3D Builder in your browser.
3. Click on any 3D model (e.g. **Granite Boulder**, **Mossy Cliff Rock**, **Ancient Island Arch**).
4. In the right-hand **Kit Inspector** panel, click **"Paint this model"**.
5. Observe that the **Sculpt & Mesh Paint** window opens immediately with the **Paint** tool active and targeted on that model.
6. Select any surface tile from the **Island surface** palette (e.g., *Mossy rock*, *Granite cliff*, *Packed sand*, *Beach grass*).
7. Drag your mouse over the 3D model:
   - Notice smooth, organic textured surface painting blending into the rock using triplanar world-space mapping.
   - Adjust **Radius**, **Strength**, and **Hardness** sliders.
   - Hold **Shift** to erase painted surface back to the original model look.
   - Press **Ctrl+Z** to undo strokes step-by-step.
   - Inspect the **Target** vertex & byte size counters.
