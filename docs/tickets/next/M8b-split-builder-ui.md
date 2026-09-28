# M8b: Split the rest of the builder by tool

- **ID**: `M8b` (follow-up to `M8`, part a done)
- **Priority**: Medium
- **Component**: Track Builder / maintainability
- **Conflicts with**: anything editing `src/components/TrackBuilderUI.tsx` or `src/game/track-builder-3d.ts`
- **Needs art**: No

## What M8 part (a) did
- `src/game/builder/prop-catalog.ts`: the prop catalog (every `PropDefinition`, `PROP_DEFINITIONS`,
  `ANIMATED_SOURCE_ART`, `DEFAULT_TRACK_PROPS`, `PlacedProp`) and the animated-sheet helpers.
- `src/game/builder/backup-service.ts`: `PropBackupService` (disk backup POST, C2's safety copies via
  the server, M12's skip-if-unchanged fingerprint, the 30 s / 2.5 s timers, status listeners, the
  backup listing) plus `propsFingerprint` / `stripPropsRuntimeState`.
- `track-builder-3d.ts` re-exports both, so no importer changed. 3,849 → 2,980 lines.

## Goal
Finish the split so no builder file is a 3,000-line monolith, with no behaviour change.

## Solution
1. `src/game/track-builder-3d.ts` (2,980 lines): move, as classes the facade owns (like `PropBackupService`):
   - `builder/fly-camera.ts`: the free-fly camera update (`// --- FREE FLY CAMERA UPDATE ---`).
   - `builder/prop-sprites.ts`: sprite/mesh creation and the texture cache
     (`// --- SPRITE & MESH CREATION & TEXTURE CACHE ---`) and the animated-texture cache.
   - `builder/selection-view.ts`: selection boxes and the rotation handle
     (`// --- SELECTION BOX HIGHLIGHT & ROTATION HANDLE ---`).
   Keep `TrackBuilder3D`'s public methods (Renderer3D, GameEngine and the UI call them) as thin delegates.
2. `src/components/TrackBuilderUI.tsx` (3,828 lines): extract presentational components that take
   props and callbacks only: the top toolbar, the props drawer (categories, search, thumbnail grid),
   the selected-prop inspector, and the backup/restore modal. Move the global keydown effect into a
   `useBuilderKeybindings` hook. State stays in `TrackBuilderUI`.

## Must NOT change
- `TrackBuilder3D`'s public API; builder hotkeys; the backup behaviour (C2/M12 stay in `backup-service.ts`).

## Acceptance
- [ ] No file under `src/game/track-builder-3d.ts`, `src/components/TrackBuilderUI.tsx` over ~1,500 lines.
- [ ] `node scripts/check.mjs` passes unchanged (no behaviour change), and `npm run build` succeeds.
- [ ] Manual: open the 3D map editor, place, move and delete a prop, undo/redo, fly the camera, open
      the backups list: all behave as before.

## Tests to run
- `node --import tsx --test tests/track-props-backup.test.ts tests/track-builder-validation.test.ts tests/lane-builder.test.ts tests/lane-panel.test.tsx tests/animated-props.test.ts tests/multi-select-grouping.test.ts`
- `node scripts/check.mjs`
