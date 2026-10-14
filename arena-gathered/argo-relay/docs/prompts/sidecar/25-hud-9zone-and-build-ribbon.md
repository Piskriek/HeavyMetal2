// File: docs/prompts/sidecar/25-hud-9zone-and-build-ribbon.md
# TASK-25: 9-Zone Non-Overlapping HUD Grid, Bottom Build Ribbon & Raycast Machine Labels

## 1. Objective
Eliminate the 3-way center-screen HUD text collision on Moon arrival (`07-moon-stage0.jpg`), replace the viewport-blocking Build Menu modal (`09-build-menu.jpg`) with a compact `136px` bottom-docked ribbon (`bottom: 92px`), and cull floating 3D machine text billboards (`08-first-machine.jpg`) to crosshair raycast + proximity.

## 2. Pre-Built Drop-In Files to Wire
1. `packages/hudlayout/src/nine-zone-grid.ts` (Pure 9-zone state machine, `2.0 s` subtitle holdoff after location banners, `8°` / `14 m` raycast machine label gate, and DOM bounding-box overlap detector).
2. `packages/hudlayout/src/__tests__/nine-zone-grid.test.ts` (Vitest unit tests).
3. `apps/web/src/shell/hud-9zone.css` (CSS Grid tokens reserving all 9 screen zones with `180px` vertical clearance between center prompts and bottom subtitles).
4. `apps/web/src/shell/build-ribbon-drawer.tsx` (`136px` bottom-docked build ribbon with `Machines | Structures | Heavy | Plans` tabs and `[R] Rotate 45° | [H] Lock & Nudge | [F] Demolish 100% Refund` strip).

## 3. Integration Steps
1. Mount `hud-9zone-root` in `apps/web/src/shell/hud.tsx` and tag each overlay with its `data-hud-zone` attribute (`top-left`, `top-center`, `top-right`, `center-reticle`, `bottom-center-upper`, `bottom-center-lower`, `bottom-left`, `bottom-right`).
2. Gate `"CANNOT PLACE"` strictly on `isPlacingStructure && !canPlace`.
3. Replace the centered `B` build modal with `<BuildRibbonDrawer />`.
4. In `apps/web/src/base/view.ts` and `apps/web/src/crafter/world.ts`, call `shouldShowMachineWorldLabel()` so 3D text billboards only appear when aimed within `8°` inside `14 m` (or while holding `Alt`).

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/hudlayout`
- `node scripts/e2e-hud-and-luminance-gate.mjs` (`assertZeroHudZoneOverlap` must report `0 px²` overlap on Moon arrival).
