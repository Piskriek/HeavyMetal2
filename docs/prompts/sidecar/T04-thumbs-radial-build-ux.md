# T04: real 3D thumbnails, one radial wheel on X, hold-Z remove, build and Esc UX (TICKET-04)

**Spec:** OPUS_NOTE_11 (in the Setmix Drive). Argo approved every design call, with no vetoes.
**Source:** `arena-gathered/argo-ticket04/`:
- `apps/web/src/base/ui/thumb-map.ts` and its `.test.ts`;
- `apps/web/src/base/ui/use-item-thumb.ts`;
- `apps/web/src/base/ui/radial-menu.tsx` and `.css`;
- `apps/web/src/play/controls-grid.tsx` and `.css`.

Install them as they are, and list any fix you make.

## The root causes (from the spec)
- Every HUD icon is `ItemGlyph` (`base/ui/item-glyph.tsx`), a lucide line icon by `item.kind`. `studio/studio-thumbs.ts` `thumbOf(assetId)` already renders the 128 packed assets.
- The mouse-wheel hint in `play.tsx` (about line 1715) prints the raw kind ids (`lowRoof`).
- X removes the aimed piece (`play.tsx`, about line 2741); there's no radial wheel.
- In Sculpt, keys 1–3 pick tools and the hotbar ignores them (`hotbar.tsx` line 16, `play.tsx` about line 2690).
- `placeNow` (`play.tsx`, about line 2603) calls `setBuilding(null)` after every placement.
- The modals have no close hints. The Esc screen renders `CONTROLS` (`play.tsx` line 249) as a text `<dl>` (about line 3900).

## Do
1. **Install** the 7 files. Run `thumb-map.test.ts`: every blueprint kind and every machine kind must map to an existing registry id.
2. **ItemGlyph** shows `useItemThumb(ref)` when it returns a picture, and its line icon only while loading or for items with no mesh. Every window that uses ItemGlyph (hotbar, inventory, drafting, fabricator, refinery, lattice, machine picker) gets thumbnails through it. The build menu's machine and structure entries get them too.
3. **The wheel hint** uses the player names from `build-menu.tsx` (the kind-name table, line 15) instead of the raw ids.
4. **X opens the `RadialMenu`**, filled by context:
   - build mode: the held blueprint's kinds, with thumbnails;
   - beam in Apply: the player's texture cartridges as swatches, and picking one loads it into the beam (find how the rack loads `cartridge`);
   - beam in Sculpt: carve, raise and smooth.
   Releasing X or clicking picks; Esc cancels.
5. **Hold Z for 0.5 s removes** the aimed piece, with a progress ring at the crosshair; letting go early cancels. Remove the old X-removes path.
6. **Free keys 1–3:** delete the sculpt digit capture in `play.tsx`, and the `beamSculpt` check in `hotbar.tsx`, so 1–3 always select hotbar slots.
7. **Build mode stays on** after `placeNow` places. Esc, right mouse or B ends it.
8. **Close hints:** every modal (refinery, fabricator, weapon bench, inventory, drafting, lattice, machine picker, machine inspector) shows a small `Esc` (or `Esc / Tab`) close hint in the HUD style.
9. **The Esc screen** uses `ControlsGrid` with the updated controls: X Radial, Hold Z Remove, and 1–9 hotbar always. Update the `CONTROLS` list, and the build menu's footer hint (Argo's note: `X Radial · Hold Z Remove`).
10. **UI:** load the frontend-design skill (`frontend-design:frontend-design`) before any UI adjustment, and keep Argo's components as they are unless broken.

## Verify
- **A new `scripts/test-build-ux.mjs`** (boot pattern: `scripts/test-base-building.mjs`). Assert:
  - the hotbar `img` elements are thumbnails, not lucide svgs;
  - X opens the radial with the blueprint's kinds, and picking one changes the ghost;
  - with the beam in Sculpt, X shows the three tools and key 1 selects hotbar slot 1;
  - Apply's radial shows swatches;
  - a tap on Z removes nothing, and holding it for 0.6 s removes the aimed piece;
  - you can place two machines in a row without reopening B;
  - the Esc screen shows the keycap grid.
  Save shots of the hotbar, the build menu, each radial, and the Esc grid.
- Run typecheck on the laptop. Run everything heavy through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, the build, your new test, `test-base-building`, `test-machine-inspector`, `test-ticket01-collision` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/base/ui/`, `apps/web/src/play/play.tsx`, `apps/web/src/play/build-menu.tsx`, `apps/web/src/play/controls-grid.*`, and the new test. **Flash is doing a performance pass in `play-scene.ts`, `plot-biome-view.ts`, `plot-ground.ts`, `water-surfaces.ts`, `packages/groundshader` and the Graphics settings: don't touch those.**

## Git
- The tree and index are shared. Run `git diff --cached --stat` first, then `git commit -m "..." -- <your paths>`.
- Never commit `apps/web/dist/index.html`, and never push.
- End commit messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Don't post on `docs/SIDECAR_COMMS.md`; it's retired.
