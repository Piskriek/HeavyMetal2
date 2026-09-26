# W2-D: the last vector goblin parts, and painted needles and gauges (12 images)

- **Batch**: agent 5 of 6 in art wave 2 (branch `art/generated-wave-2`; the others run at the same time).
  Read [README.md](README.md) first, and the wave-1 README's Part A (the rules still apply).
- **Why**: the owner's rule is that nothing in the game stays vector-drawn. These replace the creator's
  three SVG head shapes, its four SVG war paints and the SVG "goggles up", and the SVG gauge needles.

## Rules for this batch
- Images 1–8 (goblin parts): **Raw** `art-src/avatar-parts/raw/<id>.png`, then
  `node --import tsx scripts/key-art.ts --set avatar-parts --only <id>` → PASS (it runs the edge repair itself).
- **Heads must be blank**: no eyes, nose, mouth, ears or hair. Regenerate any head that paints a feature.
- War paint: only paint, no face. Do **not** edit `AVATAR_CATALOG` or `PAINTED_PARTS`.
- Images 9–12: the listed process. Needles point straight **up** with the hub at the bottom centre
  (the game rotates them about the hub).


### 1. `head-angular`
Layer head · pivot: face centre (≈ 0.50, 0.55)
> Isolated 2D game cosmetic asset for a goblin face builder: a bald goblin head with an angular, sharp-jawed shape: a pointed crown, flat cheek planes and a narrow pointed chin, completely blank and featureless: NO eyes, NO eyebrows, NO nose, NO mouth, NO ears and NO hair (those are separate parts drawn on top), only smooth skin with painted shading, a subtle brow ridge, a few wrinkles and small scars, cut off cleanly just below the chin with no neck, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. The face must stay empty so other features can be layered on it. Centered, filling about 45% of the width. Palette rules: skin = flat toxic green #7fb24a family, shading in darker green, highlights in pale green. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 2. `head-bloated`
Layer head · pivot: face centre (≈ 0.50, 0.50)
> Isolated 2D game cosmetic asset for a goblin face builder: a bald goblin head with a round, bloated, jowly shape: wide puffy cheeks and a double chin, completely blank and featureless: NO eyes, NO eyebrows, NO nose, NO mouth, NO ears and NO hair (those are separate parts drawn on top), only smooth skin with painted shading, a subtle brow ridge, a few wrinkles and small scars, cut off cleanly just below the chin with no neck, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. The face must stay empty so other features can be layered on it. Centered, filling about 45% of the width. Palette rules: skin = flat toxic green #7fb24a family, shading in darker green, highlights in pale green. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 3. `head-scrawny`
Layer head · pivot: face centre (≈ 0.50, 0.55)
> Isolated 2D game cosmetic asset for a goblin face builder: a bald goblin head with a long, scrawny, egg-shaped face: hollow cheeks and a narrow long chin, completely blank and featureless: NO eyes, NO eyebrows, NO nose, NO mouth, NO ears and NO hair (those are separate parts drawn on top), only smooth skin with painted shading, a subtle brow ridge, a few wrinkles and small scars, cut off cleanly just below the chin with no neck, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. The face must stay empty so other features can be layered on it. Centered, filling about 45% of the width. Palette rules: skin = flat toxic green #7fb24a family, shading in darker green, highlights in pale green. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 4. `warpaint-mud-stripes`
Layer warpaint · pivot: face centre
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint only, floating with no face under it: two short horizontal smears of brown mud under where each eye would be, finger-painted, dry brush edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. No face, no skin, only the paint. Centered, filling about 70% of the width. Palette rules: paint colours only as stated. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 5. `warpaint-red-handprint`
Layer warpaint · pivot: face centre
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint only, floating with no face under it: a single blood-red handprint with spread fingers, painted where the right cheek would be, dry brush edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. No face, no skin, only the paint. Centered, filling about 70% of the width. Palette rules: paint colours only as stated. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `warpaint-cog-tattoo`
Layer warpaint · pivot: face centre
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint only, floating with no face under it: a small dark blue cog wheel tattoo where the left cheek would be, crisp inked lines, dry brush edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. No face, no skin, only the paint. Centered, filling about 70% of the width. Palette rules: paint colours only as stated. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `warpaint-soot-smudges`
Layer warpaint · pivot: face centre
> Isolated 2D game cosmetic asset for a goblin face builder: goblin war paint only, floating with no face under it: a few soft black soot smudges and fingerprints scattered where the cheeks and forehead would be, dry brush edges, seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. No face, no skin, only the paint. Centered, filling about 70% of the width. Palette rules: paint colours only as stated. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 8. `eyewear-goggles-up`
Layer eyewear · pivot: lens midpoint
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of brass-rimmed round goggles pushed up high, with blue-tinted lenses and a thick leather strap stub at each side, drawn as if resting on a forehead (tilted up a little), seen perfectly from the front. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the width. Palette rules: leather = dark brown, metal = brass, lenses = pale blue glass with a white glint. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 9. `cockpit-needle-large`
Process: `node --import tsx scripts/key-art.ts --set cockpit --only cockpit-needle-large` (raw `art-src/cockpit/raw/cockpit-needle-large.png`)
> Isolated 2D game UI sprite: a single long gauge needle for a goblin speedometer, pointing straight UP, a tapered brass needle with a red tip and a round riveted brass hub at the bottom centre. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Vertical, centered, filling about 90% of the height and only about 12% of the width. Palette rules: metal = brass, tip = neutral red. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 10. `cockpit-needle-small`
Process: `node --import tsx scripts/key-art.ts --set cockpit --only cockpit-needle-small` (raw `art-src/cockpit/raw/cockpit-needle-small.png`)
> Isolated 2D game UI sprite: a short stubby gauge needle for a small goblin dial, pointing straight UP, dark iron with a brass hub at the bottom centre. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Vertical, centered, filling about 85% of the height and about 15% of the width. Palette rules: metal = dark iron and brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 11. `ui-gauge-arc-face`
Process: `node --import tsx scripts/key-art.ts --set ui-icons --only ui-gauge-arc-face` (raw `art-src/ui/raw/ui-gauge-arc-face.png`)
> Isolated 2D game UI element: a round goblin gauge face seen straight on, a brass bezel with rivets around a dark charcoal dial, a 270-degree arc of engraved tick marks from the lower left, over the top, to the lower right, the last third of the arc painted in a hot orange danger band, an empty centre (no needle, no numbers, no letters). Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 90% of the width. Palette rules: metal = brass, dial = charcoal, danger band = orange. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 12. `ui-gauge-needle`
Process: `node --import tsx scripts/key-art.ts --set ui-icons --only ui-gauge-needle` (raw `art-src/ui/raw/ui-gauge-needle.png`)
> Isolated 2D game UI sprite: a single gauge needle pointing straight UP, slim tapered orange-gold blade with a small round dark hub at the bottom centre. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Vertical, centered, filling about 90% of the height and about 10% of the width. Palette rules: blade = orange-gold, hub = dark iron. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

## Acceptance
- [ ] 12 keyed PNGs, each PASS; the three heads have no facial features.
- [ ] `npm run check:edges` 0 failures; results table posted as a PR comment.
