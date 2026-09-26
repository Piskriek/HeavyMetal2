# W2-A1: Painted goblin parts, part 3a (12 images)

- **Batch**: agent 1 of 4 in art wave 2 (PR branch `art/generated-wave-2`; the other three run at the
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


### 1. `eyes-cyborg-lens`
Layer eyes · pivot: both eye centres · fill 60 %
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of goblin eyes only (no face): the left eye a normal bulging yellow eye with a black slit pupil under a heavy toxic-green lid, the right eye replaced by a glowing red mechanical lens in a riveted brass socket, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family for the lids, eye = yellow with black pupil, lens = glowing red with a white glint, metal = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 2. `eyes-furnace-glow`
Layer eyes · pivot: both eye centres · fill 60 %
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of narrow goblin eyes only (no face), both glowing orange-gold like furnace embers with no pupils, under heavy toxic-green lids with a faint orange glow on the lid edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family for the lids, eyes = orange and gold glow. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 3. `eyewear-aviator-shades`
Layer eyewear · pivot: lens midpoint · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of round dark aviator sunglasses with thin brass wire frames, a double bridge and short arm stubs only, dark smoky lenses with a curved white reflection, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: metal = brass, lenses = dark smoky grey with a white glint. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 4. `eyewear-triple-loupe`
Layer eyewear · pivot: main lens centre (≈ 0.40, 0.45) · fill 50 %
> Isolated 2D game cosmetic asset for a goblin face builder: a jeweller's loupe rig for one eye: a brass headband stub holding three small magnifying lenses on hinged arms stacked in front of one lens socket, tiny screws and a leather pad, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 50% of the width. Palette rules: metal = brass, leather = dark brown, lenses = pale blue glass with white glints. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 5. `hair-slicked-quiff`
Layer hair · pivot: scalp line centre (≈ 0.50, 0.85) · fill 60 %
> Isolated 2D game cosmetic asset for a goblin face builder: a greasy slicked-back goblin quiff of hair rising in a big glossy wave above the forehead, cut flat along the bottom scalp line, with no head under it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 60% of the width. Palette rules: hair = neutral red with darker red shading and one white shine streak. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `hair-long-braids`
Layer hair · pivot: scalp line centre (≈ 0.50, 0.20) · fill 75 %
> Isolated 2D game cosmetic asset for a goblin face builder: goblin hair as two long thick braids hanging down the left and right sides tied with brass rings, joined by a short fringe across the top, with an empty gap in the middle where the face would be (no head, no face), seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. The middle gap between the braids is background. Centered, filling about 75% of the width. Palette rules: hair = neutral red with darker red shading, rings = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `hair-wild-flame`
Layer hair · pivot: scalp line centre (≈ 0.50, 0.90) · fill 65 %
> Isolated 2D game cosmetic asset for a goblin face builder: wild spiky goblin hair sticking straight up in jagged flame-like points, singed black at the tips, cut flat along the bottom scalp line, with no head under it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 65% of the width. Palette rules: hair = neutral red with orange highlights and charcoal-black tips. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 8. `headgear-horned-scrap-helm`
Layer headgear · pivot: brow contact line (≈ 0.50, 0.80) · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: a round riveted iron helmet made of scrap plates with two curved horns made from bent exhaust pipes, a dented brow ridge and a brass rivet row, empty with no head inside, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: metal = dark iron with brass rivets, horns = scorched steel pipe. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 9. `headgear-bandana-knot`
Layer headgear · pivot: brow contact line (≈ 0.50, 0.75) · fill 65 %
> Isolated 2D game cosmetic asset for a goblin face builder: a tied cloth bandana worn over the top of a head, with a knot and two short tails sticking out at the right side and a few oil stains, empty with no head inside, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 65% of the width. Palette rules: cloth = neutral red with a darker red pattern of small dots, stains = dark brown. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 10. `headgear-propeller-beanie`
Layer headgear · pivot: brim bottom (≈ 0.50, 0.90) · fill 55 %
> Isolated 2D game cosmetic asset for a goblin face builder: a small knitted beanie cap with a brass propeller on a short spindle on top, a folded brim and a small patch, empty with nothing under it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 55% of the width. Palette rules: wool = neutral red and charcoal stripes, propeller = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 11. `headgear-bucket-pot`
Layer headgear · pivot: brim bottom (≈ 0.50, 0.92) · fill 60 %
> Isolated 2D game cosmetic asset for a goblin face builder: a dented iron cooking pot worn as a helmet, with a long wooden spoon handle sticking out sideways, soot streaks and a strap stub at each side, empty with nothing under it, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 60% of the width. Palette rules: metal = dark iron with soot, handle = brown wood. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 12. `mouth-rusty-grille`
Layer mouth · pivot: mouth centre · fill 65 %
> Isolated 2D game cosmetic asset for a goblin face builder: a wide goblin mouth only (no face) with thin toxic-green lips and a row of teeth replaced by a rusty iron grille of vertical bars held by bolts at the corners, dark brown mouth interior, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 65% of the width. Palette rules: skin = flat toxic green #7fb24a family for the lips, metal = rusty iron with orange-brown rust, mouth interior = dark brown (no pink gums). Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

## Acceptance
- [ ] 12 keyed PNGs in `public/avatar-parts/keyed/`, each PASS in the manifest.
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; results table posted as a PR comment.
