# M3: Lazy-Load 3D Track Builder in Main Application

- **ID**: `M3`
- **Priority**: Medium
- **Component**: Bundle Splitting / Code Organization / Performance
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The 3D Map Editor and Track Builder UI (`src/screens/MapEditorScreen.tsx` and `src/components/TrackBuilderUI.tsx`, together over 7,500 lines of complex tooling, gizmos, and asset drawers) are currently imported synchronously at the top level of `src/App.tsx`. Lazy-load `MapEditorScreen` using `React.lazy()` and `<Suspense>`, ensuring players who only race never download or parse the editor bundle, cutting initial JavaScript chunk size and speeding up first contentful paint.

---

## Evidence
- `src/App.tsx:10`:
  `import MapEditorScreen from './screens/MapEditorScreen';`
  Statically imported in the root entry file, forcing Vite to bundle the full editor toolchain and all its asset manifests into the critical path.
- `src/components/TrackBuilderUI.tsx`: Weighs 193 KB (3,794 lines) of builder-specific code.
- `src/game/track-builder-3d.ts`: Weighs 173 KB (3,813 lines) of editor gizmos, undo stacks, raycasting, and placement logic.

---

## Solution
1. **Dynamic Import in `src/App.tsx`**:
   - Replace static import with:
     ```typescript
     const MapEditorScreen = React.lazy(() => import('./screens/MapEditorScreen'));
     ```
2. **Suspense Boundary**:
   - Wrap `<MapEditorScreen />` rendering inside `<Suspense fallback={<BuilderLoadingSkeleton />}>`.
   - Provide a themed loading spinner / progress plate matching the gold-and-iron UI styling.
3. **Vite Chunk Verification**:
   - Run `npm run build` and inspect `dist/assets/` output to verify that `MapEditorScreen` and `TrackBuilderUI` are split into a separate async `.js` chunk.

### Files Allowed to Change
- `src/App.tsx`
- `tests/ui-frame-check.mjs`

### Must NOT Change
- Editor opening behavior from main menu or race gear menu
- Editor hotkeys ($B$)

---

## Acceptance Criteria
- [ ] `npm run build` generates a distinct asynchronous chunk for the track builder rather than inlining it in `index-*.js`.
- [ ] Opening "3D Track Builder" from the main menu loads smoothly with a brief thematic fallback.
- [ ] No race mode features or menu screens regress.
- [ ] Total initial JavaScript payload for racing is measurably reduced.

---

## Tests to Run
- `npm run build`
- `node scripts/check.mjs`
