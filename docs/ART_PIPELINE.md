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
| `public/art/*.png` | The 18 runtime sprites the game actually draws. |
| `src/game/art-manifest.json` | Generated metadata: sheet grids, cell rectangles, runtime sizes, hull geometry, hatch ellipses. |
| `src/game/art-assets.ts` | Typed manifest access, one-time decode cache, placeholders and failure reporting. |
| `src/game/loadout-art.ts` | Composites the baked race capsule (shell + pilot + team rim) once per roster. |
| `src/components/RacerFigure.tsx` | Menu-side shell + pilot composite for one loadout, using the same measured hatch. |
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
| `capsules-sheet.png` | 3x1 | `iron-shell.png`, `springsteel-shell.png`, `siege-shell.png` (512x512) |
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

### 3.4 The hatch is measured, then asserted on every build

A shell's cockpit opening is a **near-black opaque blob in the lower-right quadrant**, and it
is fitted to an **ellipse** (the opening is a circle seen from an angle). The numbers are
pinned in `build-art.mjs` (`MEASURED_HATCH`) rather than scanned on every run, because each
shell also contains the top opening, plate shadows and a large shaded hull area, and a blob
scan kept selecting the wrong one (in one run it selected the whole shell). Pinning alone
would rot silently, so `assertHatch()` re-checks each pinned ellipse against the freshly
written sprite on every build: at least 90% of the samples inside the ellipse must be the
dark opening, at least half of the opaque samples just outside it must be brighter painted
metal, and the mean luma contrast between the two has to be at least 25. Artwork that moves a
port fails the build instead of silently moving the pilot.

The manifest stores fractions of the sprite:

```json
"hatch": { "x": 0.8193, "y": 0.6172, "rx": 0.1016, "ry": 0.1436, "radius": 0.1436, "measured": true }
```

`radius` is `max(rx, ry)`, kept for callers that cannot draw an ellipse; `measured` is
`false` when the scan failed and a conservative fallback was substituted. The pilot bust is
then drawn at `3.4 * rx` by `3.4 * ry`, positioned so its eye line (`eyeLine`, a fraction of
the pilot PNG's height) sits on the hatch centre, and clipped to 99% of the ellipse so the
painted rim stays visible.

`eyeLine` is **measured per rider**, because a bust with a tall helmet carries its eyes much
lower in the 68% head crop than a bare-headed one (one shared constant pushed Grub's face
into the lower rim):

| Rider | Crop | eyeLine |
| --- | --- | --- |
| Rivet | leather aviator cap, brass goggles | 0.44 |
| Nix | asymmetric hair, goggles | 0.44 |
| Grub | battered spiked helmet | 0.52 |
| Sprocket | coiled brass helmet | 0.49 |

`tests/artifacts/eyeline-probe.png` (rewritten on every build) renders all four pilots at 3x
with 0.30 / 0.40 / 0.50 / 0.60 guide rows, so those numbers can
be re-read whenever the source portraits change. Horizontally the busts are centred on the
hatch: their alpha centroids measure 0.47-0.52 of the crop, so no per-rider x offset is
needed.

Current measurements (512x512 shells):

| Shell | Hatch centre | rx | ry |
| --- | --- | --- | --- |
| Rustbucket (iron) | 0.819, 0.617 | 0.102 | 0.144 |
| Springsteel | 0.817, 0.618 | 0.090 | 0.143 |
| Siegebreaker (siege) | 0.814, 0.610 | 0.096 | 0.142 |

`tests/artifacts/hatch-probe.png` re-draws each measured ellipse over its shell: if a
future sheet moves the opening, the probe shows it immediately and `assertHatch()` stops the
build. A wrong measurement would silently move the pilot, which is exactly why it is pinned,
asserted by pixel sampling and reviewed as an image.

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
                               "action": "portrait" | "pilot" | "shell" | "supply" | "prop" | "preview",
                               "anchor": "center", "pivot": { "x": 0.5, "y": 0.5 }, "envelope": 1,
                               "hull":  { "diameter": 452, "canvas": 512, "scale": 0.8496 },
                               "hatch": { "x": 0, "y": 0, "rx": 0, "ry": 0, "radius": 0, "measured": true },
                               "pilot": "art/grub-pilot.png",
                               "pilotRuntime": { "width": 256, "height": 256 },
                               "eyeLine": 0.52 } }
}
```

`pilot` and `pilotRuntime` only exist on rider cells: the cockpit bust is a second runtime
file derived from the same portrait, not a separate cell, which is why the build reports 18
cells while the Sprite Lab lists 22 runtime sprites. `pilotRuntime` is an object, not a
`[width, height]` tuple, because the typed consumers read it as `pilotRuntime.width`.

`src/game/art-assets.ts` types this file and exposes only accessors — `ART`, `artUrl`,
`riderCell`, `capsuleCell`, `supplyCell`, `courseCell`, `blimpCell`, `landmarkCell`,
`raceArtPaths`, `racerLayers`. No component reaches into the JSON directly.

The manifest is written twice: `src/game/art-manifest.json` (the one the app imports) and
`tests/artifacts/art-manifest.json` (a copy kept next to the verification images so a
reviewer can compare what was built against what was drawn).

## 5. Loading, caching and the fallback

- **Decode once, before racing.** `RaceScreen` preloads via `loadAssets()`,
  `prepareRaceCapsules()` and `preparePowerupSprites()`; `world-art.ts` decodes the blimp
  and landmarks before the first frame. `loadArtImage` caches by URL, so a second request
  is a no-op. Nothing in the render loop constructs meshes, generates images, applies
  expensive filters or rebakes an atlas.
- **Baked composites.** `prepareRaceCapsules()` builds one 192x192 composite per racer
  (shell, pilot inside the measured ellipse, team-colour rim arc) and caches it per roster
  — at most six entries. The race draws that canvas; it never composites per frame.
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

22 checks (see `tests/art-check.mjs`) assert that: four portrait PNGs and their pilot busts
decode; the menu composite is one shell plus one clipped pilot; the pilot window's clip-path
sits on the measured hatch centre (x 0.82 / y 0.61, rx 0.10 / ry 0.14) rather than the shell
middle and the pilot image stays inside the capsule silhouette; choosing another rider and
capsule swaps both layers; all three shells and all three course previews are the rasters
with no inline vectors; there are no broken images on the setup screen, the grid and the
race; HUD supply icons are the painted PNGs; the race frame contains painted metal/brass
pixels rather than flat fills; no request fails and no page error fires while painting a
race; the Sprite Lab lists the whole runtime library, every tile decodes, and every entry is
a `.png`; and each keyed sheet records its detected colour and the `#FF00FF` target.

Screenshots and a manifest copy are written to `tests/artifacts/`
(`art-1-loadout.png`, `art-1b-capsule-closeup.png` … `art-6-source-sheets.png`).
`alpha-check.png` is a checkerboard contact sheet of fifteen sprites, `hatch-probe.png`
overlays the measured ellipses, and `eyeline-probe.png` shows the pilot eye-line guides.

File-level facts are checked outside the browser as well: every shipped sprite is verified
to begin with the PNG signature and, for the keyed sprites, to carry a real alpha channel
with a transparent corner (`srgba(0,0,0,0)`), while the three course previews are
deliberately opaque. `grep` for `data:image/svg` across `src/**/*.ts{,x}` returns nothing:
no generated SVG art remains in the game modules.

These checks prove the library decodes and is what the game draws. They do **not** measure
frame pacing, gameplay balance or accessibility; Part 4.4 owns that.
