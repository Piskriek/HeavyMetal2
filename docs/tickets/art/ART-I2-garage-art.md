# ART-I2: Use the painted decals and backdrop in the Ball Garage

- **Priority**: Medium · **Type**: code (after the art PR with ART-B2 is merged)
- **Conflicts with**: work on `src/components/garage/BallCustomizer.tsx` or `src/game/meta/ball-design.ts`
- **Needs art**: No (uses ART-B2 images 12–26)

## Goal
Replace the code-drawn decal shapes with the painted decals, and dress the garage with its backdrop
and ball cradle.

## Evidence
- `src/game/meta/ball-design.ts:30` `decalImage()`: every decal is a hard-edged shape drawn per pixel
  in code (the "amateur" look).
- `src/components/garage/BallCustomizer.tsx`: no backdrop, the preview ball floats on the modal.

## Solution
1. A loader that decodes `public/art/garage/decals/<id>.png` into the baker's `RgbaImage`
   (browser: canvas `getImageData`; headless tests: keep `decalImage()` as the fallback). Map catalog
   ids to files: `emblem.crossed-wrenches` → `emblem-crossed-wrenches.png`, and so on;
   `roundel.number` uses `roundel-blank.png` with the stamp's `number` drawn on top in code.
2. Decode all decals once when the garage opens (before the first bake); show a small loading state.
3. Garage backdrop behind the stage (`public/art/garage/garage-backdrop.png`, darkened under the
   panels) and the brass cradle (`ui-ball-cradle.png`) under the preview ball.
4. Decal palette buttons show the decal thumbnail (tinted with the current stamp colour), not text.

## Files allowed to change
`src/game/meta/ball-design.ts`, `src/components/garage/BallCustomizer.tsx`, `src/hud.css` (garage
rules), `tests/ball-design.test.tsx`.

## Acceptance
- [ ] Every catalog decal bakes from its painted PNG in the browser (manual check with a screenshot).
- [ ] Headless tests still pass with the code fallback; the 12-decal cap, undo and ownership rules are unchanged.
- [ ] Band decals wrap the ball with no visible seam (screenshot of the rolling preview).

## Tests to run
`node --import tsx --test tests/ball-design.test.tsx tests/sphere-baker.test.ts`, then `node scripts/check.mjs`.
