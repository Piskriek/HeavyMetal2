# WIRE-4: Painted builder icons and the painted UI gauge

- **Art**: `public/art/ui/icons/builder-prim-*.png` (10), `builder-light-*.png` (6), `custom-model.png`,
  `ui-gauge-arc-face.png`, `ui-gauge-needle.png` (needle points up, hub at the bottom centre).

## Goal
The builder's Primitives and Lights shelves and its Custom 3D card show painted icons instead of amber
line drawings, and the setup screen's arc gauges are painted brass instead of SVG strokes (owner's rule:
no vector-style art).

## Evidence
- `src/game/builder/primitives.ts` builds each primitive's `icon` as an SVG data URI ("Line icons in the builder's amber").
- `src/game/builder/light-rig.ts` does the same for the light presets.
- `src/components/ui/BlizzardGauge.tsx` `arc` variant draws its face, ticks and needle in SVG.

## Solution
1. **Primitives**: each `PRIMITIVES` entry's `icon` becomes `/art/ui/icons/builder-prim-<shape>.png`
   (box, sphere, cylinder, cone, torus, wedge, panel, rock, capsule, arch; check every shape in the list has a
   file and map any name that differs). **Lights**: the presets map to `builder-light-lantern`, `-torch`,
   `-crystal`, `-lava`, `-worklamp` (work-lamp spot) and `-bulb` (plain).
2. **Shelf tiles**: the icons sit on the builder's dark zinc tiles at their natural painted look: no amber
   tint filter over them. Check the shelf CSS still frames them (about 56 px; the art is 256 px, so let the
   browser downscale with `image-rendering: auto`). The selected tile keeps the Forge's amber ring.
3. **Custom 3D card**: confirm it shows `custom-model.png` (the code already points there) and looks like the
   other shelf tiles.
4. **Arc gauge**: `BlizzardGauge` `variant="arc"` draws `ui-gauge-arc-face.png` as the face and rotates
   `ui-gauge-needle.png` about its hub over the same 270° sweep; keep the label, the value readout and the
   smooth CSS transition (none under reduced motion). The painted face already has its ticks and orange danger
   band, so drop the SVG ticks. `dial` and `meter` stay as they are.
5. Preload the icons when the builder opens so the shelves never pop in.

## Files allowed to change
`src/game/builder/primitives.ts` (icons only), `src/game/builder/light-rig.ts` (icons only), the builder shelf
component(s) and their CSS (find where `PRIMITIVES` and the light presets are rendered),
`src/components/ui/BlizzardGauge.tsx`, its CSS, tests `scene-kit` and a new `tests/painted-icons.test.ts`.

## Must NOT change
Primitive geometry, light settings, the scene kit's saved data format, the other gauge variants.

## Acceptance
- [ ] Every primitive and light preset has a painted icon file that exists on disk (test over the lists).
- [ ] No `data:image/svg` icon remains in `primitives.ts` or `light-rig.ts` (test).
- [ ] The arc gauge renders the painted face and needle at the same angles as before (test on the angle maths).
- [ ] Screenshots: the Primitives shelf, the Lights shelf, a setup screen with arc gauges, at 1366×657 and 1920×1080.

## Tests to run
`node --import tsx --test tests/scene-kit.test.ts tests/painted-icons.test.ts`, then `node scripts/check.mjs`.
