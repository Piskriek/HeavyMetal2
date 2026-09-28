# M8: Decompose Monolithic Track Builder Files into Domain-Specific Modules

- **ID**: `M8`
- **Priority**: Medium
- **Component**: Code Architecture / Refactoring / Maintainability
- **Conflicts with**: `C2`, `M11`, `M12`
- **Needs art**: No

---

## Goal
The track builder currently concentrates over 7,600 lines of code across just two monolithic files: `src/game/track-builder-3d.ts` (3,813 lines) and `src/components/TrackBuilderUI.tsx` (3,794 lines), combining camera flight, transform gizmos, prop catalog drawers, lane network path editing, raycasting, undo history, and auto-backup in a single sprawling namespace. Decompose both files into focused, domain-specific modules grouped by tool responsibility under `src/game/builder/` and `src/components/builder/`.

---

## Evidence
- `src/game/track-builder-3d.ts`: 3,813 lines of code (173.6 KB). Houses fly camera controls, prop placement, gizmo adapters, lane editing commands, validation hooks, serialization, and disk auto-backups.
- `src/components/TrackBuilderUI.tsx`: 3,794 lines of code (193.3 KB). Contains top toolbar, props drawer, lane node inspector, hotkey bindings, placement HUD, modal dialogs, and test drive controls in one giant component.
- High risk of merge conflicts and cognitive overload for coding agents touching editor features.

---

## Solution
1. **Decompose `track-builder-3d.ts` into Domain Services**:
   - `src/game/builder/fly-camera.ts`: Free-fly camera state, keyboard integration, collision clamping.
   - `src/game/builder/prop-manager.ts`: Prop selection, instantiation, raycast snapping, transforms.
   - `src/game/builder/lane-tool.ts`: Lane node manipulation, path splitting, branch insertion.
   - `src/game/builder/backup-service.ts`: LocalStorage autosave, server backup POST, safety backups.
   - Keep `TrackBuilder3D` as a clean facade orchestrating these services.
2. **Decompose `TrackBuilderUI.tsx` into Dedicated Components**:
   - `src/components/builder/BuilderToolbar.tsx`: Top header, file dropdown, undo/redo, test race button.
   - `src/components/builder/PropsDrawer.tsx`: Prop categories, thumbnail grid, search filter.
   - `src/components/builder/NodeInspector.tsx`: Selected lane node coordinates, path width slider.
   - `src/components/builder/BuilderKeybindings.tsx`: Global keydown listener and hotkey dispatch.
3. **Verify Existing Tests**:
   - Ensure `tests/track-builder-validation.test.ts`, `tests/lane-builder.test.ts`, and `tests/lane-panel.test.tsx` pass without broken imports.

### Files Allowed to Change
- `src/game/track-builder-3d.ts`
- `src/components/TrackBuilderUI.tsx`
- `src/game/builder/**`
- `src/components/builder/**`
- `tests/track-builder-validation.test.ts`
- `tests/lane-builder.test.ts`

### Must NOT Change
- Public API contract of `TrackBuilder3D` exposed to `Renderer3D` and `GameEngine`

---

## Acceptance Criteria
- [ ] Neither `track-builder-3d.ts` nor `TrackBuilderUI.tsx` exceeds 1,200 lines of code.
- [ ] Dedicated sub-modules under `src/game/builder/` and `src/components/builder/` handle fly camera, prop catalog, lane editing, and toolbar UI respectively.
- [ ] All builder features (prop placement, lane editing, gizmo dragging, auto-backup, test drive) function identically.
- [ ] `node scripts/check.mjs` passes with zero TypeScript or test errors.

---

## Tests to Run
- `node --import tsx --test tests/track-builder-validation.test.ts`
- `node --import tsx --test tests/lane-builder.test.ts`
- `node --import tsx --test tests/lane-gizmo.test.ts`
- `node scripts/check.mjs`
