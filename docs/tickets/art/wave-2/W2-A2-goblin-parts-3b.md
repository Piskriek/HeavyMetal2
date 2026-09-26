# W2-A2: Painted goblin parts, part 3b (12 images)

- **Batch**: agent 2 of 4 in art wave 2 (PR branch `art/generated-wave-2`; the other three run at the
  same time). Read [README.md](README.md) first, and the wave-1 README's Part A (the rules still apply).
- **Feeds**: the Goblin Creator through ART-I1 (registration is not your job).

## Rules for this batch
- Every image: **Raw** `art-src/avatar-parts/raw/<id>.png`, then
  `node --import tsx scripts/key-art.ts --set avatar-parts --only <id>` must print PASS. It writes the keyed PNG,
  runs the edge repair itself, and updates `src/game/meta/painted-parts.generated.ts`. Commit all three.
- **Never** run the edge fixer by hand after keying, and never re-key after it (the key script already does both, in order).
- Parts with skin are painted in the toxic green `#7fb24a` family on purpose (tint masks follow that hue).
- Ears: paint ONE ear, a **left** ear, its root against the right edge (the creator mirrors it).
- War paint: only the paint strokes, no face under them.
- Do **not** edit `AVATAR_CATALOG` or `PAINTED_PARTS`.


### 1. `mouth-buck-teeth`
Layer mouth · pivot: mouth centre · fill 55 %
> Isolated 2D game cosmetic asset for a goblin face builder: a goofy goblin grin only (no face) with thin toxic-green lips and two huge ivory buck teeth in the middle with a chip in one, dark brown mouth interior, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 55% of the width. Palette rules: skin = flat toxic green #7fb24a family for the lips, teeth = ivory, mouth interior = dark brown (no pink gums, no pink tongue). Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 2. `mouth-corncob-pipe`
Layer mouth · pivot: mouth corner (≈ 0.35, 0.40) · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: a goblin mouth only (no face) with thin toxic-green lips clenching a corncob pipe that sticks out to the right, a curl of grey smoke rising from the bowl, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: skin = flat toxic green #7fb24a family for the lips, pipe = tan corncob with a brown stem, smoke = pale grey. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 3. `neck-wool-scarf`
Layer neck · pivot: top centre (≈ 0.50, 0.30) · fill 80 %
> Isolated 2D game cosmetic asset for a goblin face builder: a thick knitted wool scarf wrapped around a neck with one long frayed end hanging down to the left, nothing above it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 80% of the width. Palette rules: wool = neutral red with charcoal stripes. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 4. `neck-padlock-collar`
Layer neck · pivot: top centre (≈ 0.50, 0.35) · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: a heavy iron collar ring with a big brass padlock hanging from the front and a short broken chain link, nothing above it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: metal = dark iron, lock = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 5. `neck-trophy-medal`
Layer neck · pivot: top centre (≈ 0.50, 0.20) · fill 55 %
> Isolated 2D game cosmetic asset for a goblin face builder: a ribbon worn around a neck with a big round brass winner's medal hanging on it, the medal stamped with a cog and a checkered flag emblem (no letters), seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 55% of the width. Palette rules: ribbon = neutral red, medal = brass and gold. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `nose-pierced-ring`
Layer nose · pivot: nose bridge (≈ 0.50, 0.30) · fill 40 %
> Isolated 2D game cosmetic asset for a goblin face builder: a long crooked goblin nose only (no face) with a big brass ring through the septum and one small stud on the side, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 40% of the width. Palette rules: skin = flat toxic green #7fb24a family, metal = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `nose-snub-button`
Layer nose · pivot: nose centre · fill 30 %
> Isolated 2D game cosmetic asset for a goblin face builder: a short upturned snub goblin nose only (no face), round and pudgy with two big dark nostrils and a freckle-like wart, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 30% of the width. Palette rules: skin = flat toxic green #7fb24a family, nostrils = dark green-brown. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 8. `nose-long-droop`
Layer nose · pivot: nose bridge (≈ 0.50, 0.15) · fill 35 %
> Isolated 2D game cosmetic asset for a goblin face builder: a very long drooping goblin nose only (no face) that hangs down in a curve with a bulbous tip and a few bristles, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 35% of the width. Palette rules: skin = flat toxic green #7fb24a family, bristles = dark brown. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 9. `ears-cauliflower-studs`
Layer ears · pivot: left ear root (≈ 0.90, 0.50) · fill 45 %
> Isolated 2D game cosmetic asset for a goblin face builder: ONE lumpy battered goblin ear only (a left ear, its root at the right side of the image), thick and cauliflowered with three brass studs along the rim, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Only one ear. Centered, filling about 45% of the width. Palette rules: skin = flat toxic green #7fb24a family, metal = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 10. `ears-long-ragged`
Layer ears · pivot: left ear root (≈ 0.92, 0.55) · fill 55 %
> Isolated 2D game cosmetic asset for a goblin face builder: ONE very long pointed goblin ear only (a left ear, its root at the right side of the image) that sweeps up and outward, with ragged notches bitten out of the edge, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Only one ear. Centered, filling about 55% of the width. Palette rules: skin = flat toxic green #7fb24a family. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 11. `warpaint-tribal-stripes`
Layer warpaint · pivot: face centre (≈ 0.50, 0.50) · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint strokes only, floating with no face under them: three bold horizontal charcoal stripes across where the cheeks would be (two on the left, one on the right) and one jagged red line running down from where the forehead would be, dry brush edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: paint = charcoal black and neutral red only. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 12. `warpaint-bone-skull`
Layer warpaint · pivot: face centre (≈ 0.50, 0.50) · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint strokes only, floating with no face under them: a white skull mask painted in bold brush strokes, two hollow eye rings, a nose triangle and a row of stitched teeth marks, with gaps where the eyes and mouth would be, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. The eye and mouth gaps are background. Centered, filling about 70% of the width. Palette rules: paint = bone white with a few charcoal accents only. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

## Acceptance
- [ ] 12 keyed PNGs in `public/avatar-parts/keyed/`, each PASS in the manifest.
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; results table posted as a PR comment.
