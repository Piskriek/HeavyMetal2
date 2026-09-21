# Goblin Rally: Art Pipeline, Manifest And Fallback Contract

This document covers the raster art pass (Section 4, Part 4.2): where the artwork comes
from, how a source sheet becomes a runtime sprite, what the typed manifest promises, and
what the game does when a file is missing or broken.

Everything here is original artwork generated for this project, in the game's own
Warcraft-inspired-but-not-Warcraft identity: chunky painted goblins, iron and brass
machinery, muted dirt, readable silhouettes, green-iron/gold/crimson UI. It contains no
third-party characters, logos or implied affiliation.

## 1. Files and responsibilities

| Path | Role |
| --- | --- |
| `public/art/sheets/*` | Source art. Only `build-art.mjs` reads these. |
| `scripts/build-art.mjs` | The only place pixels are keyed, cropped, trimmed or measured. |
| `public/art/*.png` | The runtime sprites the game actually draws (portraits, badge busts, full-body riders, balls, supplies, props). |
| `src/game/art-manifest.json` | Generated metadata: sheet grids, cell rectangles, runtime sizes, hull geometry, full-body stances. |
| `src/game/art-assets.ts` | Typed manifest access, one-time decode cache, placeholders and failure reporting. |
| `src/game/loadout-art.ts` | Bakes one standalone-ball race sprite (ball + team rim) per roster slot, once per roster. |
| `src/components/CharacterShowcase.tsx` | The selection stage: full-body rider standing beside the standalone ball on a lit pedestal. |
| `src/components/ArtGallery.tsx` | The Sprite Lab: every runtime sprite and every source sheet, downloadable. |
| `tests/art-check.mjs` | Headless browser checks that the drawn art is really the PNG library (dist build or a live URL). |

Regenerate everything with:

```
node scripts/build-art.mjs
```

It takes roughly 45 seconds (ImageMagick work, not a game-time cost), prints one line per
source sheet with the matte it detected, and rewrites the runtime PNGs, both manifest
copies and the two verification montages. Set `ART_DEBUG=1` to echo the `convert`
commands.

Requires ImageMagick 6 (`convert`, `identify`, `montage`) on `PATH`. Nothing in the
runtime needs ImageMagick, Node's filesystem, or any build step: the browser only fetches
finished PNGs.

## 2. Source sheets

Sheets are cut on a regular grid; the grid is declared in the script (`grid(file, columns,
rows)`), and each cell is recorded in the manifest with its pixel rectangle.

| Sheet | Grid | Produces |
| --- | --- | --- |
| `balls/iron-ball-src.png`, `balls/springsteel-ball-src.png`, `balls/siege-ball-src.png` | 1x1 each | `balls/iron-ball.png`, `balls/springsteel-ball.png`, `balls/siege-ball.png` (512x512) |
| `riders-fullbody/rivet-full-src.png` … `sprocket-full-src.png` | 1x1 each | `riders/fullbody/<id>_full.png` (512x768) |
| `landmarks-sheet.png` | 2x2 | `landmark-pines/quarry/windmill/pasture.png` |
| `blimp.png` | 1x1 | `blimp.png` (900x576) |
| `courses-sheet.png` | 1x3 | `ridge/boomtown/sheep-course.png` (800x440) |
| `supply-fuel.png`, `supply-shield.png`, `supply-bounce.png` | 1x1 | `fuel/shield/bounce-supply.png` (256x256) |
| `riders-source.png` | 5x3 | four rider portraits (512x512) and four pilot busts (256x256) |

The supply icons are individual source files rather than one sheet: they were painted
separately and there is no reason to pack them.

`riders-source.png` is not generated fresh each run — it is copied from the predecessor
project's painted portrait sheet (`PreGame/assets/portraits/user_portraits.png`, a 5x3
alpha sheet) so the rider art is genuine hand-painted-style artwork rather than a second
generation of synthetic heads. Cells are used row-major: `0` Rivet, `8` Nix, `11` Grub,
`3` Sprocket. Each portrait is trimmed and normalised to 512x512; the top 68% (the head) is
cropped and normalised to the 256x256 pilot bust that is inserted into the capsule hatch.

## 3. The keying, despill and normalisation rules

### 3.1 Matte detection is per cell, not per sheet

Generated sheets do not hold one perfectly flat key colour: the key is shaded, and
neighbouring cells can drift. `borderKeys()` therefore samples the border pixels of *each
cell* (and of the whole sheet) and builds a list of candidate keys, and `extract()` keys
against every candidate at once.

Two keys are recognised, by channel signature:

- **magenta `#FF00FF`** (`r > 150 && b > 150 && g < 110`) — the preferred key for this
  project, because the subjects are goblins and green subjects would clash with a green
  key.
- **green `#00FF00`** (`g > 120 && r < 110 && b < 110`, clearly dominant) — still
  supported for any future sheet, but nothing shipped uses it.

Detection is recorded, not assumed. Every keyed sheet gets a `matte` entry in the
manifest with the **detected** rounded hex (e.g. `#FF00F8`), the detected name
(`magenta`) and the **canonical target** the detection is aiming at (`#FF00FF`). The
Sprite Lab prints both, so a drifting sheet is visible instead of silent. A sheet with no
key at all (the course previews, the portrait sheet) is recorded as `painted alpha`.

If a matte cannot be found, the build fails loudly rather than shipping an opaque sprite.

### 3.2 Despill clamps only the matte channels

After keying, the antialiased fringe still carries key colour. `despill()` clamps the
matte's own channels to the strongest remaining channel, so a magenta fringe becomes
neutral rather than pink, while keeping interiors untouched:

- magenta matte: clamp `R` and `B` down to `max(G, B)` / `max(G, R)` as detected.
- green matte: clamp `G` down to `max(R, B)`.

That is what keeps olive skin, mint springs and teal metal from going grey. The despill
mask is derived from alpha, so fully transparent pixels and fully opaque interiors are
never modified.

### 3.3 Shave, trim, and hull normalisation

- **`-shave 6x6` per cell** removes the painted divider strip that surrounds each cell, so
  a "connected component" cannot include the sheet's own framing.
- **Alpha trim** then removes the remaining empty margin.
- **Hull normalisation** (capsule shells only) finds the largest opaque connected component
  (`-connected-components 4`) and scales it so the hull diameter is exactly **452 px on a
  512 px canvas**, then centres that artwork inside the canvas with a single
  `-gravity center -extent 512x512`. (The earlier version padded and then `-roll`ed the
  sprite by coordinates, which shifted the shell the wrong way, wrapped a band of pixels
  around the canvas and pushed the sprite off-canvas; centring by extent cannot do either.)
  Armour knobs, hooks and exhaust pipes therefore never change the collision envelope or the
  draw scale, and the pilot insert lands in the same place in every shell.
- Everything else is fitted into a fixed runtime box with `object-fit`-like behaviour at
  build time, so runtime code never scales per frame.

### 3.4 Full-body riders and standalone balls (TICKET-04)

The cockpit composite is retired: there is no hatch, no clipped bust, and no
`measureHatch()` / `assertHatch()` anywhere in the pipeline. The selection stage shows two
disentangled painted figures instead - a heroic full-body goblin and a standalone ball -
and the race rolls the same standalone ball with a rider-colour rim.

- **Defringe.** Single-subject renders sometimes come back with off-white side bars around
  the matte. `defringeWhite()` flood-fills the connected near-white border regions with the
  matte (22% fuzz reaches the white/matte blend column but never the matte itself), so one
  key removes the whole background while interior highlights survive.
- **Full-body riders** (`riders-fullbody/<id>-full-src.png`) are fitted with `fitStance()`
  into a 512x768 portrait box, feet on the bottom edge, never clipped; the build merges
  `fullbody` / `fullbodyRuntime` onto each rider cell.
- **Balls** (`balls/<id>-ball-src.png`) reuse the old hull normalisation: the largest opaque
  component is scaled to a 452px diameter on a 512px canvas, so the retired shells' draw
  scale and collision envelope carry over unchanged. The capsule cell's runtime sprite is
  the ball itself (`action: "ball"`).

The retired `capsules-sheet.png` source and the three `*-shell.png` sprites are no longer
built or referenced; the Sprite Lab lists the full-body renders, badge portraits and racing
balls instead. The pilot busts survive as the HUD badge and off-screen pointer portraits.

## 4. Manifest schema

```jsonc
{
  "generatedAt": "2026-09-17",
  "matte":  { "<sheet>": { "hex": "#FF00F8", "detected": "magenta", "canonical": "#FF00FF", "despill": ["R", "B"] } },
  "sheets": { "<name>":  { "file": "art/sheets/<name>.png", "width": 0, "height": 0,
                           "columns": 3, "rows": 1, "cells": [ { "x": 0, "y": 0, "width": 0, "height": 0 } ],
                           "alpha": "painted" } },
  "cells":  { "<kind>:<id>": { "sheet": "<name>", "sheetCell": 0, "image": "art/<file>.png",
                               "runtime": { "width": 512, "height": 512 },
                               "action": "portrait" | "ball" | "icon" | "prop" | "preview",
                               "anchor": "center", "pivot": { "x": 0.5, "y": 0.5 }, "envelope": 1,
                               "hull":  { "diameter": 452, "canvas": 512, "scale": 0.8496 },
                               "pilot": "art/grub-pilot.png",
                               "pilotRuntime": { "width": 256, "height": 256 },
                               "fullbody": "art/riders/fullbody/grub_full.png",
                               "fullbodyRuntime": { "width": 512, "height": 768 } } }
}
```

`pilot`, `pilotRuntime`, `fullbody` and `fullbodyRuntime` only exist on rider cells: the
badge bust and the full-body render are extra runtime files derived per rider, not separate
cells, which is why the build reports 18 cells while the Sprite Lab lists 26 runtime
sprites. The size fields are objects, not `[width, height]` tuples, because the typed
consumers read them as `pilotRuntime.width`.

`src/game/art-assets.ts` types this file and exposes only accessors — `ART`, `artUrl`,
`riderCell`, `capsuleCell`, `riderFullBody`, `supplyCell`, `courseCell`, `blimpCell`,
`landmarkCell`, `raceArtPaths`. No component reaches into the JSON directly.

The manifest is written twice: `src/game/art-manifest.json` (the one the app imports) and
`tests/artifacts/art-manifest.json` (a copy kept next to the verification images so a
reviewer can compare what was built against what was drawn).

## 5. Loading, caching and the fallback

- **Decode once, before racing.** `RaceScreen` preloads via `loadAssets()`,
  `prepareRaceBalls()` and `preparePowerupSprites()`, plus the player's badge portrait;
  `world-art.ts` decodes the blimp and landmarks before the first frame. `loadArtImage`
  caches by URL, so a second request is a no-op. Nothing in the render loop constructs
  meshes, generates images, applies expensive filters or rebakes an atlas.
- **Baked sprites.** `prepareRaceBalls()` builds one 192x192 sprite per racer (the
  standalone ball plus a team-colour rim arc) and caches it per roster — at most six
  entries. The race draws that canvas; it never composites per frame. The rider appears in
  the HUD badge and the off-screen pointer, not on the ball.
- **Placeholders, not blanks.** If a PNG 404s or fails to decode, `prepareArtSprites()`
  produces a painted placeholder canvas, marks the sprite `placeholder: true`, prints a
  `[Goblin Rally] art placeholders in use: ...` warning and lists the failures, so a broken
  file is visible in the console and on screen instead of silently drawing nothing. The
  Sprite Lab and the art checks report the same information.
- **Honest size.** A decoded image reports its natural size, falling back to the manifest's
  runtime size only when the image did not decode.

## 6. Verification

```
npm run check:art                          # builds the app, then drives the dist build
node tests/art-check.mjs http://127.0.0.1:5173   # or check a running server (the preview)
```

20 checks (see `tests/art-check.mjs`) assert that: four portrait PNGs decode; the retired
cockpit composite is absent (no goblin head peeking out of a hatch); the stage shows one
full-body rider and one standalone ball; the rider render is a portrait-orientation figure
and the ball a square high-detail render; choosing another rider and ball swaps both
painted figures; all three ball renders and all three course previews are the rasters with
no inline vectors; there are no broken images on the setup screen, the grid and the race;
HUD supply icons are the painted PNGs; the race frame contains painted metal/brass pixels
rather than flat fills; no request fails and no page error fires while painting a race; the
Sprite Lab lists the whole runtime library, every tile decodes, and every entry is a
`.png`; and each keyed sheet records its detected colour and the `#FF00FF` target.

Screenshots and a manifest copy are written to `tests/artifacts/`
(`art-1-loadout.png`, `art-1b-capsule-closeup.png` … `art-6-source-sheets.png`).
`alpha-check.png` is a checkerboard contact sheet of all nineteen alpha sprites. The hatch
and eye-line probes were retired with the cockpit composite.

File-level facts are checked outside the browser as well: every shipped sprite is verified
to begin with the PNG signature and, for the keyed sprites, to carry a real alpha channel
with a transparent corner (`srgba(0,0,0,0)`), while the three course previews are
deliberately opaque. `grep` for `data:image/svg` across `src/**/*.ts{,x}` returns nothing:
no generated SVG art remains in the game modules.

These checks prove the library decodes and is what the game draws. They do **not** measure
frame pacing, gameplay balance or accessibility; Part 4.4 owns that.

## 7. The painted UI pass (gold-and-iron chrome)

The menus, HUD chrome and the last vector holdouts were retextured as painted art in the
same Warcraft-inspired-but-not-Warcraft identity (dark carved stone, ornate gold trim,
crimson accents). `scripts/cut-ui-art.mjs` is the pipeline: it is the UI-facing sibling of
`build-art.mjs`, reusing the same matte rules — magenta `#FF00FF` detected on the border,
fuzz-keyed in two passes, then the fringe-only despill ported from `build-art.mjs`
(clamping only the matte's own R and B channels on semi-transparent pixels). It is
idempotent: a source whose border is already transparent is only despilled again, and a
grayscale-keyed source is gilded through a gold colour-ramp CLUT rather than silently
shipping grey art.

| Source | Runtime art | Used by |
| --- | --- | --- |
| `public/art/sheets/ui/emblem-src.png` | `public/art/goblin-emblem.png` | `GoblinMark` (brand, menus, loading) — replaces the inline `<svg>` mark |
| `public/art/sheets/ui/favicon-src.png` | `public/favicon.png` | browser icon — replaces `favicon.svg` |
| `public/art/sheets/ui/aim-arrow-src.png` | `public/art/aim-arrow.png` | the aiming hint — replaces the inline dashed SVG arc |
| `public/art/sheets/ui/frame-src.png` | `public/ui/frame-gold.png` | 9-slice `border-image` for `.modal` and `.fantasy-dialog` (slice 96 fill) |
| `public/art/sheets/ui/frame-src.png` | `public/ui/stone-tile.png` | quiet stone backdrop tile (app and menu background, stage buttons) |
| `public/art/sheets/ui/button-src.png` | `public/ui/button-gold.png` | 9-slice `border-image` for `.primary-button`, `.forged-menu-button`, `.fantasy-primary` (slice 52 86 80 fill) |
| `public/art/sheets/ui/button-hover-src.png` | `public/ui/button-gold-hover.png` | the hovered/glowing state of the same plates |
| `public/art/sheets/ui/menu-vista-src.png` | `public/art/menu-vista.png` | the main-menu world painting and the loading screen |
| `public/art/sheets/ui/dirt-src.png` | `public/art/dirt-tile.png` | the in-race dirt: `dirtMaterial()` draws the tile and re-hues it toward each course's palette with a `color` composite pass, keeping the procedural ruts, speckles and chalk lane dividers for readability |
| `PreGame/public/art/map-panel-src.png` | `PreGame/public/art/map-panel.png` | the predecessor game's minimap: a keyed parchment panel behind the live vector course overlay (dots, camera box and finish line re-inked in warm browns) |
| `PreGame/public/art/exit-glyph-src.png` | `PreGame/public/art/exit-glyph.png` | the predecessor game's exit button — replaces the inline SVG arrow |

The dirt tile is seamless by construction: the source centre crop is mirrored into a 2x2
windmill, so opposite edges match exactly. It loads as the `dirtArt` sprite through the
same `loadAssets()` decode-or-fail contract as every other runtime sprite, so a broken
file degrades to the visible loading error and retry, not a blank track.

With this pass no SVG remains anywhere in either project's runtime: the favicon, the
brand mark, the aiming arrow, the predecessor's exit glyph and the minimap's dark vector
backing plate are all painted PNGs, and the only remaining `<svg>` elements are the
PreGame minimap's live data overlay (course geometry, racer dots, camera window) and the
standard `lucide-react` icon set, which are data, not art.

## 8. Skybox / skydome panoramas (TICKET-06)

The painted panoramas in `public/art/tracks/sky_*.png` are mapped onto the race
skydome (`buildSky()` in `src/game/renderer-3d.ts`) and double as the far parallax
layer of the 2D renderer (`src/game/world-art.ts`). The dome shader stretches the
painting from just below the horizon up to the zenith, so any landscape painted
above the bottom of the image towers into the sky during a race. The composition
standard for every skybox is therefore:

- **Sky dominates**: clouds, light shafts, smoke columns, airships and atmosphere
  fill the top ~85% of the frame.
- **Landscape is a silhouette strip only**: treetops / ridge crests / smelter
  silhouettes form a single narrow line of foliage or skyline inside the bottom
  ~15% of the image. No valleys, roads, foreground terrain or sprawling vistas.
- **Format**: 2048x1024 PNG, left and right edges painted to blend seamlessly
  (the texture wraps 360 degrees around the dome with `RepeatWrapping`).
- **Lighting values are sampled from the art**: each `SKY_PRESETS` entry derives
  `fogColor` from the horizon band, `zenithColor` from the top band and
  `ambientColor` from a darkened mid-sky average, so dome fog and lighting always
  match the painting.

Ten variations ship with the game, grouped by course biome; the three canonical
files are the ones referenced by `TRACKS[...].lighting.skyboxUrl`, the rest are
selectable in the Track Builder's Skydome Atmosphere menu:

| File | Preset id | Biome / mood |
| --- | --- | --- |
| `sky_copperwood_ridge.png` | `ridge` | golden-hour sunburst over a pine treetop line |
| `sky_copperwood_misty_dawn.png` | `copperwood_dawn` | cool fog banks at first light |
| `sky_copperwood_autumn_dusk.png` | `copperwood_dusk` | copper sunset over silhouetted canopy |
| `sky_copperwood_frost_morning.png` | `copperwood_frost` | crisp frosty blue morning, snow spires |
| `sky_boomtown_quarry.png` | `boomtown` | crimson forge dusk, smoke columns from smelter silhouettes |
| `sky_boomtown_ember_storm.png` | `boomtown_embers` | churning ember storm lit from below |
| `sky_boomtown_night_furnace.png` | `boomtown_night` | night sky, furnace glow underlighting cloud |
| `sky_woolly_wasteland.png` | `sheep` | slate-emerald highland storm, sunbeams, wool zeppelins |
| `sky_woolly_sunbeam_break.png` | `woolly_sunbeams` | storm breaking into golden-green light shafts |
| `sky_woolly_dusk_zeppelins.png` | `woolly_dusk` | violet dusk with silhouetted zeppelins |

## 9. Edge & magenta-bleed audit (`npm run check:edges`)

`scripts/check-edge-magenta.mjs` audits **every PNG in the project** (Node +
ImageMagick only, no browser) and exits non-zero when a runtime sprite breaks
the contract. `scripts/fix-edge-magenta.mjs` repairs violations; run the
checker after it to confirm zero failures. Both share the pixel tests in
`scripts/edge-magenta-lib.mjs`.

File classes:

- **source** (`public/art/sheets/**`, raw `public/art/props/prop-*.png`):
  matte-backed scans the pipeline reads. Magenta is expected and only counted.
- **legacy** (`PreGame/**`): archived predecessor art, reported but never
  failed or rewritten.
- **runtime** (everything else the game draws): must pass all gates below.

Runtime gates:

1. **No matte holes** — zero opaque/semi pixels near `#FF00FF`
   (`r,b>150`, `min(r-g,b-g)>=120`, `|r-b|<=45`). The symmetry test keeps
   painted purples (glowcap mushrooms, violet UI) safe: they are blue-shifted.
2. **No fringe spill** — zero semi or boundary pixels with
   `min(r-g,b-g)>=90` and symmetric channels, and zero opaque *shaded-matte*
   fringe (`dom>=60`, symmetric) hugging transparency.
3. **No stored-matte bleed** — transparent pixels within 2px of the silhouette
   must not carry matte RGB; scalers that interpolate non-premultiplied
   channels would otherwise resurface pink speckle. The fixer bleeds edge
   colour into the transparent fringe (alpha stays 0).
4. **No stale-colour fringe** — any transparent pixel next to visible art
   (alpha >= 16 within one ring) must carry the bled edge colour, i.e. be
   within 16/channel of the mean of its filled 3x3 neighbourhood — exactly
   what the fixer's bleed pass writes. Catches generator leftovers the matte
   test cannot: a canvas `clearRect` black (the Warcraft grass-fringe strips
   shipped with `(0,0,0,0)` fringes) tints dark when a non-premultiplied
   scaler interpolates across the edge.
5. **Clean edges** — at most half of the silhouette boundary may be hard
   255-vs-0 steps; the fixer feathers offenders with one premultiplied 3x3
   alpha blur.
6. **Raw-scan proof (props and goblins)** — for `public/art/props/alpha/*`
   the raw scan's
   background (saturated-matte components touching the sheet border, or >=80%
   saturated pockets) is ground truth: any opaque matte-tinted pixel inside it
   is leftover backdrop and fails the audit.

The repair passes, in order: key residual holes and raw-proven backdrop;
despill opaque boundary fringe toward green+40; soften rims around freshly
keyed holes; unmix matte out of semi fringe (`C = t*A + (1-t)*M` solved for
the art colour `A`); feather hard silhouettes; bleed edge colour into the
transparent fringe. Every pass is idempotent and leaves asymmetric painted
purples/violets untouched.
