# ART-B2: Painted goblin parts, part 2, and the Ball Garage (26 images)

- **Batch**: agent 2 of 4 in art wave 1 (PR branch `art/generated-wave-1`; the other three run at
  the same time). Read [README.md](README.md) first. ART-B1 also writes
  `painted-parts.generated.ts`: follow the conflict rule in the README.
- **Feeds**: the Goblin Creator via [ART-I1](ART-I1-painted-parts-dna-v3.md); the Ball Garage
  (`src/components/garage/BallCustomizer.tsx`) via [ART-I2](ART-I2-garage-art.md).
- **Why**: the rest of the painted parts, and real painted decals for the garage, which currently
  draws its 13 decals as crude shapes in code (`decalImage` in `src/game/meta/ball-design.ts`).

## Rules for this batch
- Images 1–11 (avatar parts): **Raw** `art-src/avatar-parts/raw/<id>.png`, then
  `node --import tsx scripts/key-art.ts --set avatar-parts --only <id>` → PASS. Commit the regenerated
  `src/game/meta/painted-parts.generated.ts`.
- Images 8–11 are **full-bleed backgrounds** (no magenta): save the raw, then
  `convert <raw> -resize 512x512^ -gravity center -extent 512x512 public/avatar-parts/keyed/<id>.png`
  (don't run the keyer on them).
- Images 12–24 (decals): **Raw** `art-src/garage-decals/raw/<id>.png`, then
  `node --import tsx scripts/key-art.ts --set garage-decals --only <id>` → PASS.
  **Decals are painted light (near-white and pale grey) with dark outlines**, because the garage tints
  them with the stamp colour (white = full tint, outlines stay dark).
- Band decals (18–21) must **tile seamlessly left to right**: the left and right edges must match.
- Image 25 (garage backdrop) is full-bleed: `convert <raw> -resize 1600x900 public/art/garage/garage-backdrop.png`.
- Image 26 is keyed with the garage set.

---

### 1. `hair-mutton-chops`
Layer hair (front) · pivot: centre, at eye height · fill 80 %
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of big bushy mutton-chop sideburns, one on each side, wiry and bristling, joined by nothing in the middle (the face sits between them), seen perfectly from the front with no head. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Symmetrical, centered, filling about 80% of the width. Palette rules: hair = neutral red with darker red shading (recoloured by the accent swatch). Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including the gap in the middle; no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 2. `hair-singed-topknot`
Layer hair (front) · pivot: scalp line · fill 40 %
> Isolated 2D game cosmetic asset for a goblin face builder: a single tight topknot of hair tied with a brass ring, its frayed tip singed black and still smoking with one thin grey wisp, cut flat at the bottom where it meets the scalp, seen perfectly from the front with no head under it. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 40% of the width. Palette rules: hair = neutral red, singed tip = charcoal black, ring = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 3. `hair-wire-tufts`
Layer hair (front) · pivot: scalp line · fill 70 %
> Isolated 2D game cosmetic asset for a goblin face builder: a scruffy crown of wiry hair tufts sticking out in all directions like frayed copper wire, sparser in the middle, cut flat along the bottom scalp line, seen perfectly from the front with no head under it. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Roughly symmetrical, centered, filling about 70% of the width. Palette rules: hair = neutral red with darker red shading. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 4. `eyes-bloodshot-crazy`
Layer eyes · pivot: midpoint between the eyes · fill 60 % · skin: eyelids in toxic green
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of wild, wide-open goblin eyes, big yellow-white eyeballs with thin red veins, tiny pinprick black pupils looking in slightly different directions, heavy toxic-green eyelids and bristly dark brows, seen perfectly from the front, only the two eyes with nothing between them. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Nearly symmetrical, centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family, eyeballs = pale yellow-white, veins = neutral red, irises = amber. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 5. `eyes-narrow-squint`
Layer eyes · pivot: midpoint between the eyes · fill 60 % · skin: toxic green
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of narrow, suspicious squinting goblin eyes, thin slits showing glowing amber irises, heavy furrowed toxic-green brows angled down toward the middle, seen perfectly from the front, only the two eyes with nothing between them. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Symmetrical, centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family, irises = amber. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `eyes-wide-mismatched`
Layer eyes · pivot: midpoint between the eyes · fill 60 % · skin: toxic green
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of mismatched goblin eyes, the left one small and round with an amber iris, the right one big and bulging with a cyan iris, both with toxic-green lids and one raised eyebrow, seen perfectly from the front, only the two eyes with nothing between them. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family, irises = amber and cyan, eyeballs = pale yellow-white. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `eyes-sleepy-lidded`
Layer eyes · pivot: midpoint between the eyes · fill 60 % · skin: toxic green
> Isolated 2D game cosmetic asset for a goblin face builder: a pair of sleepy, half-closed goblin eyes with heavy drooping toxic-green eyelids, dark bags underneath and amber irises peeking out, seen perfectly from the front, only the two eyes with nothing between them. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Symmetrical, centered, filling about 60% of the width. Palette rules: skin = flat toxic green #7fb24a family, irises = amber. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 8. `background-workshop-wall` (full-bleed, no key)
Layer background · square 1:1
> A square hand-painted background panel for a goblin portrait: the wall of a cluttered goblin workshop, riveted iron sheets and wooden planks, hanging wrenches and cogs, a pinned blueprint, warm lamplight pooling in the centre and falling off to dark corners so a face in the middle stands out. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, soft painted shading, slightly out of focus so it reads as a backdrop. Fills the whole square edge to edge. No characters, no text, no watermark.

### 9. `background-furnace-glow` (full-bleed, no key)
Layer background · square 1:1
> A square hand-painted background panel for a goblin portrait: the open mouth of a roaring smelting furnace behind, orange and yellow glow radiating from the centre, sparks and embers drifting up, soot-black brickwork at the edges, strongest light in the middle so a face in front is rim-lit. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, soft painted shading, slightly out of focus so it reads as a backdrop. Fills the whole square edge to edge. No characters, no text, no watermark.

### 10. `background-racing-pennants` (full-bleed, no key)
Layer background · square 1:1
> A square hand-painted background panel for a goblin portrait: a racetrack grandstand at dusk strung with rows of triangular racing pennants in black-and-yellow check and red, a blurred crowd of goblin silhouettes, a golden evening sky, calmer in the middle so a face in front stands out. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, soft painted shading, slightly out of focus so it reads as a backdrop. Fills the whole square edge to edge. No characters in focus, no text, no watermark.

### 11. `background-smog-sky` (full-bleed, no key)
Layer background · square 1:1
> A square hand-painted background panel for a goblin portrait: a smoggy industrial sky over distant goblin smokestacks and a blimp, heavy brown-grey clouds lit amber from below by factory fires, a soft clear patch in the centre so a face in front stands out. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, soft painted shading, slightly out of focus so it reads as a backdrop. Fills the whole square edge to edge. No characters, no text, no watermark.

### 12. `emblem-crossed-wrenches` (decal)
> A flat 2D emblem decal for painting onto a racing ball: two big crossed wrenches over a round riveted plate, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 80% of the width. The emblem uses only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. The emblem contains absolutely no pink, purple or magenta. No text, no watermark.

### 13. `emblem-flaming-skull` (decal)
> A flat 2D emblem decal for painting onto a racing ball: a grinning goblin skull with pointed ears and tusks, wreathed in stylised flames rising behind it, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 80% of the width. The emblem uses only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. The emblem contains absolutely no pink, purple or magenta. No text, no watermark.

### 14. `emblem-clockwork-gear` (decal)
> A flat 2D emblem decal for painting onto a racing ball: a chunky cogwheel with twelve square teeth, a smaller gear meshed inside it and a bolt in the centre, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 80% of the width. The emblem uses only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. The emblem contains absolutely no pink, purple or magenta. No text, no watermark.

### 15. `emblem-goblin-fist` (decal)
> A flat 2D emblem decal for painting onto a racing ball: a clenched goblin fist punching upward, knuckles wrapped in a strip of cloth, with three short speed lines at the sides, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Centered, filling about 75% of the width. The emblem uses only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. The emblem contains absolutely no pink, purple or magenta. No text, no watermark.

### 16. `emblem-trefoil` (decal)
> A flat 2D emblem decal for painting onto a racing ball: a three-leafed lucky trefoil made of three round lobes around a centre rivet, like a riveted metal badge, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 75% of the width. The emblem uses only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. The emblem contains absolutely no pink, purple or magenta. No text, no watermark.

### 17. `tech-pressure-gauge` (decal)
> A flat 2D decal for painting onto a racing ball: a round pressure gauge with a riveted bezel, tick marks around the face and a needle pointing into the danger zone, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, bold and readable at small size, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 80% of the width. Only white, pale grey and the dark outline colour, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. Absolutely no pink, purple or magenta in the decal. No numbers, no text, no watermark.

### 18. `pattern-dual-stripes` (band decal, tiles left to right)
> A horizontal seamless tileable strip decal for wrapping around a racing ball: two parallel bold racing stripes running the full width, each with a thin pin-line above and below, painted in near-white and pale grey with thick dark brown-black edge outlines and a hint of cel shading, wide format about 4:1. The left and right edges must line up perfectly so the strip repeats without a seam. Only white, pale grey and the dark outline colour. Background (the gaps above, below and between the stripes): perfectly flat, solid pure magenta #FF00FF, no gradient, no texture. Absolutely no pink, purple or magenta in the stripes. No text, no watermark.

### 19. `pattern-hazard-chevrons` (band decal, tiles left to right)
> A horizontal seamless tileable strip decal for wrapping around a racing ball: a band of bold hazard chevrons all pointing right, alternating solid near-white chevrons and empty gaps, with thick dark brown-black outlines, wide format about 4:1. The left and right edges must line up perfectly so the band repeats without a seam. Only white, pale grey and the dark outline colour. Background (the gaps between chevrons and above and below the band): perfectly flat, solid pure magenta #FF00FF, no gradient, no texture. Absolutely no pink, purple or magenta in the chevrons. No text, no watermark.

### 20. `pattern-checker-band` (band decal, tiles left to right)
> A horizontal seamless tileable strip decal for wrapping around a racing ball: a racing checker band two squares tall, alternating near-white squares and empty squares, with thick dark brown-black outlines around the whole band, wide format about 4:1. The left and right edges must line up perfectly so the band repeats without a seam. Only white, pale grey and the dark outline colour. Background (the empty squares and above and below the band): perfectly flat, solid pure magenta #FF00FF, no gradient, no texture. Absolutely no pink, purple or magenta in the squares. No text, no watermark.

### 21. `pattern-boiler-rivets` (band decal, tiles left to right)
> A horizontal seamless tileable strip decal for wrapping around a racing ball: a riveted metal seam, a narrow plate running the full width studded with one evenly spaced row of round domed rivets, painted in near-white and pale grey with thick dark brown-black outlines and cel-shaded highlights on each rivet, wide format about 4:1. The left and right edges must line up perfectly so the seam repeats without a join. Only white, pale grey and the dark outline colour. Background above and below the seam: perfectly flat, solid pure magenta #FF00FF, no gradient, no texture. Absolutely no pink, purple or magenta. No text, no watermark.

### 22. `tech-patch-plate` (decal)
> A flat 2D decal for painting onto a racing ball: a rectangular repair patch plate with rounded corners, four big corner rivets, a dented surface and a welded seam across it, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Centered, filling about 80% of the width. Only white, pale grey and the dark outline colour. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. Absolutely no pink, purple or magenta. No text, no watermark.

### 23. `tech-exhaust-louver` (decal)
> A flat 2D decal for painting onto a racing ball: a rectangular exhaust louver vent with five slanted horizontal slats and a riveted frame, a little soot above it, painted in near-white and pale grey tones with thick dark brown-black outlines and simple cel shading, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Centered, filling about 80% of the width. Only white, pale grey, dark grey soot and the dark outline colour. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. Absolutely no pink, purple or magenta. No text, no watermark.

### 24. `roundel-blank` (decal; the number is drawn on top in code)
> A flat 2D racing number roundel decal for painting onto a racing ball: a plain round disc with a thick outer ring and a thin inner ring, the centre left completely empty for a number to be added later, painted in near-white with pale grey shading and thick dark brown-black outlines, seen perfectly flat from the front. Hand-painted Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 85% of the width. Only white, pale grey and the dark outline colour. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no texture. Absolutely no pink, purple or magenta. No numbers, no text, no watermark.

### 25. `garage-backdrop` (full-bleed, no key; 16:9)
> A wide 16:9 hand-painted background for a ball-customising menu: the inside of a goblin paint-and-tune garage, a heavy workbench in the foreground half out of focus, spray cans, stencils, brushes and pots of paint, a half-painted iron racing ball on a brass cradle in the soft background, hanging lamps casting warm light, the middle of the image calm and darker so menu panels read on top of it. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, soft painted shading, depth of field. Fills the whole frame edge to edge. No text, no watermark, no characters in focus.

### 26. `ui-ball-cradle` (keyed, garage set)
> Isolated 2D game UI prop: a small brass display cradle for a spherical racing ball, a round riveted brass base with three curved claw prongs rising to hold a ball, the cradle empty, seen from the front at a slight downward angle. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, warm rim light from the upper left. Symmetrical, centered, filling about 70% of the width, sitting in the lower half of the image. Palette: brass and dark iron. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no texture. Absolutely no pink, purple or magenta in the object. No text, no watermark, nothing else in frame.

---

## Acceptance
- [ ] Images 1–7 and 12–24, 26: keyed PNGs present, each PASS (or WARN with a note).
- [ ] Images 8–11 and 25: full-bleed outputs at the stated sizes, no magenta anywhere.
- [ ] Band decals 18–21 tile: the first and last pixel columns of each keyed output match (check
      with `convert <out> -crop 1x+0+0 a.png; convert <out> -gravity east -crop 1x+0+0 b.png; compare -metric AE a.png b.png null:` ≤ 2 % of the height).
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; results table posted as a PR comment.
