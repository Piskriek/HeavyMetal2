# WIRE-1: The Ball Garage wears the painted decals

- **Replaces**: [ART-I2](../art/ART-I2-garage-art.md), extended with decal pack 2.
- **Art**: `public/art/garage/decals/*.png` (13 wave-1 decals + 16 pack-2 decals, white/grey painted, tinted
  by the stamp colour), `public/art/garage/garage-backdrop.png`, `public/art/garage/decals/ui-ball-cradle.png`.

## Goal
Every decal on a ball is the painted art, not a shape drawn per pixel in code; pack 2 is on sale; the
garage stage looks like a goblin workshop, and the decal picker shows the decals themselves.

## Evidence
- `src/game/meta/ball-design.ts:30` `decalImage()` draws every decal per pixel (hard-edged, "amateur").
- `DECAL_CATALOG` (same file) lists only the 13 wave-1 ids; pack 2 exists only as files.
- `src/components/garage/BallShowroom.tsx` / `BallCustomizer.tsx`: no backdrop or cradle; the picker is text.

## Solution
1. **Loader**: decode `public/art/garage/decals/<file>.png` into the baker's `RgbaImage` in the browser
   (canvas `getImageData`), keep `decalImage()` as the headless fallback (tests run in Node). Map ids to
   files: `emblem.crossed-wrenches` → `emblem-crossed-wrenches.png` (the dot becomes a dash). `roundel.number`
   uses `roundel-blank.png` with the stamp's number drawn on top in code, as now.
2. **Decode once** when the garage opens, before the first bake, with a short loading state in the garage's
   own style ("Warming the paint…"). A decal whose file fails to load falls back to `decalImage()`.
3. **Pack 2** in `DECAL_CATALOG` and the `DecalTextureId` union (`src/game/meta/interfaces.ts`):
   `emblem.hot-rod-flames` 300, `emblem.crossbones` 250, `emblem.marble-comet` 400, `emblem.lightning-bolt` 0,
   `emblem.sheep-head` 350, `emblem.tnt-bundle` 300, `emblem.winged-cog` 250, `emblem.spiked-star` 0,
   `emblem.anvil` 200, `emblem.bomb-fuse` 250 (projection `gnomonic`); `pattern.flame-band` 300,
   `pattern.lightning-band` 250, `pattern.sawtooth-band` 0, `pattern.chain-link` 200, `pattern.rope-twist` 0,
   `pattern.skull-row` 350 (projection `band`). Names in title case from the id. Existing saved designs
   must still load (the union only grows).
4. **Bands tile**: band decals repeat around the ball with no visible seam (the files are cut to whole repeats;
   sample them with wrap-around).
5. **Stage**: `garage-backdrop.png` behind the showroom, darkened under the panels so text stays readable;
   the brass cradle under the ball, lined up with the ball's contact point at every window size.
6. **Decal picker**: each decal button shows its painted thumbnail, tinted with the current stamp colour, on a
   dark recessed well (the look of the Goblin Creator's parts tray: `src/creator.css` `.tray` / `.well`).
   Locked decals show their price; the selected one has the brass ring. Keyboard: arrow keys move through the grid.

## Files allowed to change
`src/game/meta/ball-design.ts`, `src/game/meta/interfaces.ts` (`DecalTextureId` only),
`src/game/meta/sphere-decal-baker.ts` (band wrap sampling only), `src/components/garage/*`, `src/garage.css`,
`tests/ball-design.test.tsx`, new `tests/garage-decal-art.test.ts`.

## Acceptance
- [ ] In the browser every catalog decal (29) bakes from its painted PNG (screenshot of a ball with 6+ painted decals).
- [ ] Headless tests pass with the code fallback; the 12-decal cap, undo/redo, ownership and pricing rules are unchanged.
- [ ] A design saved before this change still loads and bakes identically (test with a fixture).
- [ ] Band decals wrap with no visible seam (screenshot of the spinning preview).
- [ ] The picker shows painted, tinted thumbnails; backdrop and cradle in place at 1366×657 and 1920×1080 (screenshots).

## Tests to run
`node --import tsx --test tests/ball-design.test.tsx tests/sphere-baker.test.ts tests/garage-decal-art.test.ts`, then `node scripts/check.mjs`.
