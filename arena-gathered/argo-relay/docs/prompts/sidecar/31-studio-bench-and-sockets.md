// File: docs/prompts/sidecar/31-studio-bench-and-sockets.md
# TASK-31: Studio 4-Angle Review Grid, Stage 0-4 Scrubber, Socket Gizmo & Act V Schema Terminal

## 1. Objective
Upgrade the Studio Asset Bench (`16-studio-asset-levels.jpg`) with a mandatory 4-Angle Review Grid (`Front 0°`, `Right 90°`, `Back 180°`, `Iso 45°` per `Rule 17`), one-click `fix` manifest flags (`mirror-z`, `plain-back`, `reach`, `hold`), a live `Stage 0–4` shader scrubber, an interactive Rule 16 Socket & Plume attachment editor, and the In-Lab Act V Schema Terminal (`A4-03`).

## 2. Pre-Built Drop-In Files to Wire
1. `apps/web/src/studio/asset-bench-4angle-and-sockets.tsx` (4-Angle synchronized review grid, manifest `fix` flag checkboxes, `Stage 0–4` lighting scrubber, `[W/E/R Unreal | G/R/S Blender]` keymap toggle per `DEC-10`, Rule 16 socket editor, and 2-tier Preset/Node material designer).
2. `apps/web/src/studio/act5-lab-schema-terminal.tsx` (In-Lab Act V Schema Inspector with `"SUBSTRATE PATCH APPLIED // 14 HUD REFERENCES UPDATED"` live toast and `CHARM-RENAME` hook).
3. `packages/structure/src/hologram-lock-and-nudge.ts` & `packages/structure/src/__tests__/hologram-lock-and-nudge.test.ts` (`[H]` Hologram Lock, `0.5 m` / `0.25 m` arrow-key nudge, and 100% refund demolish).

## 3. Integration Steps
1. Mount `<StudioAssetBenchAndSocketSuite />` inside `apps/web/src/studio/` and wire `onAcceptManifestPatch` to `studio-data/` write-back.
2. Open `<Act5LabSchemaTerminal />` when interacting with the Lab Studio console during quest `A4-03`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/structure`
- Verify Studio round-trip edit and 4-angle view in `15-studio-editor.jpg` and `16-studio-asset-levels.jpg`.
