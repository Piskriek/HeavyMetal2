# W2-B: Cockpit, dashboard trinkets, the rope-reel goblin and a builder icon (15 images)

- **Batch**: agent 3 of 4 in art wave 2 (PR branch `art/generated-wave-2`; the other three run at the
  same time). Read [README.md](README.md) first, and the wave-1 README's Part A (the rules still apply).
- **Feeds**: tickets P1, P2, X12, H6 and the builder's Custom 3D card.

## Rules for this batch
- Each image lists its own process. Keyed sets (`cockpit`, `cockpit-trinkets`, `ui-icons`) run the edge repair
  themselves; never run the fixer by hand after them.
- The glass overlays (2–4) are **not** magenta: light marks on pure black, resized with ImageMagick.
- The rope-reel sheet (14) is the only image that edits code (`SHEETS`).


### 1. `gauge-cluster-left` → `public/art/cockpit/gauge-cluster-left.png`
Ticket P1. **Pass the current `public/art/cockpit/gauge-cluster-left.png` as the image input** and keep its composition, size and outline exactly; only the lower-left third ring changes.
Process: `node --import tsx scripts/key-art.ts --set cockpit --only gauge-cluster-left` (raw `art-src/cockpit/raw/gauge-cluster-left.png`). The keyer trims to the content, so then put it back on the original canvas: `convert public/art/cockpit/gauge-cluster-left.png -background none -resize 1024x419 -gravity center -extent 1024x419 public/art/cockpit/gauge-cluster-left.png`, and compare with the old file (`git show HEAD~:public/art/cockpit/gauge-cluster-left.png`): the two existing rings must sit on the same pixels (their dial anchors are in `src/game/cockpit-art.json`). If they drift, regenerate rather than ship it.
> Repaint this goblin cockpit instrument plate exactly as it is, same shape, same size, same three brass rings in the same positions and the same iron plate and rivets, with one change: the third ring at the lower left must become a real gauge housing like the other two, with an empty dark round dial face recessed inside a bevelled brass bezel (no needle, no numbers). Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 2. `cockpit-glass-grime` → `public/art/cockpit/cockpit-glass-grime.png`
Ticket P2. **Not magenta**: painted light-on-black, used with a screen blend.
Process: `convert <raw> -resize 1920x1080! <output>` (no keying; used with screen blending, so black stays invisible)
> A 16:9 overlay texture for the inside of a goblin cockpit windscreen, painted as faint light marks on a pure black background: soft curved specular glare streaks along the upper left and the rim, two arcs of wiper streaks, a few oily thumb smudges and fine scratches from goblin tools, very subtle and sparse so most of the image stays pure black. Painted in soft pale grey and warm white only. Hand-painted illustration style. Background: pure black #000000 everywhere else. No text, no watermark.

### 3. `cockpit-glass-crack-1` → `public/art/cockpit/cockpit-glass-crack-1.png`
Ticket P2. Light-on-black, screen blend.
Process: `convert <raw> -resize 1024x1024! <output>`
> A square overlay of a spiderweb crack in thick glass, painted as bright white and pale blue-grey fracture lines on a pure black background: a small shattered impact point slightly off centre, long radial cracks reaching out towards the edges and a few rings of concentric cracks, with tiny chips of light along the lines. Stylized hand-painted game art, crisp lines. Background: pure black #000000. No text, no watermark.

### 4. `cockpit-glass-crack-2` → `public/art/cockpit/cockpit-glass-crack-2.png`
Ticket P2. Light-on-black, screen blend.
Process: `convert <raw> -resize 1024x1024! <output>`
> A square overlay of a long diagonal crack across thick glass, painted as bright white and pale blue-grey fracture lines on a pure black background: one main jagged crack from the lower left to the upper right with short branching cracks and a small starburst where it began. Stylized hand-painted game art, crisp lines. Background: pure black #000000. No text, no watermark.

### 5. `trinket-sheep-bobble-body` → `public/art/cockpit/trinkets/trinket-sheep-bobble-body.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-sheep-bobble-body` (raw `art-src/cockpit/trinkets-raw/trinket-sheep-bobble-body.png`)
> Isolated 2D game prop sprite: the body of a dashboard bobblehead toy of a fluffy armored sheep, sitting on a small round spring base, WITHOUT its head (a flat neck top where the head will sit), seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: wool = off-white, armor = dark iron with brass rivets, base = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `trinket-sheep-bobble-head` → `public/art/cockpit/trinkets/trinket-sheep-bobble-head.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-sheep-bobble-head` (raw `art-src/cockpit/trinkets-raw/trinket-sheep-bobble-head.png`)
> Isolated 2D game prop sprite: the oversized head of a dashboard bobblehead toy of a sheep, big googly eyes, small curled horns and a tiny iron helmet, no body, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: wool = off-white, face = charcoal grey, helmet = dark iron, horns = tan. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `trinket-fuzzy-dice` → `public/art/cockpit/trinkets/trinket-fuzzy-dice.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-fuzzy-dice` (raw `art-src/cockpit/trinkets-raw/trinket-fuzzy-dice.png`)
> Isolated 2D game prop sprite: a pair of fuzzy dice hanging from a short string with a brass hook at the top, one tilted, pips as black dots, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: dice = neutral red fuzz with black pips, hook = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 8. `trinket-mini-rocket` → `public/art/cockpit/trinkets/trinket-mini-rocket.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-mini-rocket` (raw `art-src/cockpit/trinkets-raw/trinket-mini-rocket.png`)
> Isolated 2D game prop sprite: a small toy goblin rocket standing upright on three fins with a round porthole and a riveted nose cone, a little puff of grey smoke under it, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: body = brass and dark iron, porthole = cyan glass, smoke = pale grey. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 9. `trinket-cup-gold` → `public/art/cockpit/trinkets/trinket-cup-gold.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-cup-gold` (raw `art-src/cockpit/trinkets-raw/trinket-cup-gold.png`)
> Isolated 2D game prop sprite: a small gleaming gold trophy cup with two big curved handles on a squat black base with a brass plate (no letters), seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: cup = gold, base = charcoal black with a brass plate. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 10. `trinket-cup-silver` → `public/art/cockpit/trinkets/trinket-cup-silver.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-cup-silver` (raw `art-src/cockpit/trinkets-raw/trinket-cup-silver.png`)
> Isolated 2D game prop sprite: a small shiny silver trophy cup with two curved handles on a squat black base with a steel plate (no letters), seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: cup = silver steel, base = charcoal black. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 11. `trinket-cup-bronze` → `public/art/cockpit/trinkets/trinket-cup-bronze.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-cup-bronze` (raw `art-src/cockpit/trinkets-raw/trinket-cup-bronze.png`)
> Isolated 2D game prop sprite: a small bronze trophy cup with two curved handles on a squat black base, slightly dented (no letters), seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: cup = bronze copper, base = charcoal black. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 12. `trinket-hula-goblin` → `public/art/cockpit/trinkets/trinket-hula-goblin.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-hula-goblin` (raw `art-src/cockpit/trinkets-raw/trinket-hula-goblin.png`)
> Isolated 2D game prop sprite: a little dashboard figurine of a goblin dancer in a grass skirt with arms raised, standing on a spring base, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: skin = flat toxic green #7fb24a family, skirt = straw yellow, base = brass. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 13. `trinket-lucky-horseshoe` → `public/art/cockpit/trinkets/trinket-lucky-horseshoe.png`
Ticket X12. Small dashboard sprite.
Process: `node --import tsx scripts/key-art.ts --set cockpit-trinkets --only trinket-lucky-horseshoe` (raw `art-src/cockpit/trinkets-raw/trinket-lucky-horseshoe.png`)
> Isolated 2D game prop sprite: an iron lucky horseshoe with nail holes, hung on a short loop of red cord, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 70% of the height, standing on the bottom edge. Palette rules: metal = dark iron, cord = neutral red. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 14. `anim-62-goblin-rope-reel` → `public/art/animated/alpha/anim-62-goblin-rope-reel.png`
Ticket H6 (it names the output `goblin-rope-reel.png`; use this id, ART-I3 wires it).
Process: Add `anim-62-goblin-rope-reel` to `SHEETS` in `scripts/process-generated-animated.mjs` (the only code edit in wave 2), raw `art-src/animated/anim-62-goblin-rope-reel-src.png`, then `node scripts/process-generated-animated.mjs anim-62-goblin-rope-reel` and the §10.4 gates. **Do not use the dark-panel template**; if you need an image input, use a 1024² pure #FF00FF sheet.
> A 2x2 animation sprite sheet, four frames in reading order (top left, top right, bottom left, bottom right), each frame in its own square cell separated by wide empty gutters: an energetic goblin in a leather harness and goggles braced with one boot forward, reeling in a thick rope hand over hand; frame 1 reaching forward to grab the rope, frame 2 pulling it back to the chest, frame 3 leaning back with the rope taut and coils dropping at his feet, frame 4 recovering to reach again. The same goblin, same size and same position in every frame. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Palette rules: skin = flat toxic green #7fb24a family, leather = dark brown, metal = brass, rope = tan hemp. Background: perfectly flat, solid pure magenta #FF00FF filling every cell and every gutter edge to edge, no gradient, no shadow, no floor, no guide lines. The goblin contains absolutely no pink, purple or magenta. No text, no watermark.

### 15. `custom-model` → `public/art/ui/icons/custom-model.png`
The builder's "Custom 3D" shelf card icon (the code already points here).
Process: `node --import tsx scripts/key-art.ts --set ui-icons --only custom-model` (raw `art-src/ui/raw/custom-model.png`)
> Isolated 2D game UI icon: a small wooden crate with its lid open and a glowing brass wireframe cube floating out of it, surrounded by three tiny sparkles. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 75% of the width. Palette rules: wood = brown, metal = brass, glow = warm gold. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

## Acceptance
- [ ] All 15 outputs at their paths; keyed ones PASS; the plate is still 1024 wide and lines up with the old one.
- [ ] The rope-reel sheet passes the §10.4 gates (drift may warn: accepted for effects and characters in motion).
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; results table posted as a PR comment.
