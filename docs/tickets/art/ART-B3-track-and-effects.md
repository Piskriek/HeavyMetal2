# ART-B3: Track obstacles, boost pads, barriers and race effects (22 images, two agents)

- **Batch**: agents 3 and 4 of 4 in art wave 1 (PR branch `art/generated-wave-1`; all four run at
  the same time). Read [README.md](README.md) first.
  - **ART-B3a** (agent 3): images **1–12 and 22** (textures, obstacle and barrier sprites, shield
    bubble). Commit prefix `art(B3a)`.
  - **ART-B3b** (agent 4): images **13–21** (the animated effect sheets). The only agent that edits
    `scripts/process-generated-animated.mjs` and builds the template. Commit prefix `art(B3b)`.
- **Feeds**: `src/game/obstacle-view.ts` (the race's obstacles), the builder's barrier props, and
  the effect renderer, via [ART-I3](ART-I3-track-art.md).
- **Why**: boost pads are a flat orange strip, gaps a black quad and ramps a brown deck
  (`ObstacleView.roadMaterial`); spinners, rock gates, water rocks and roller rails are tinted boxes
  (`BLOCK_COLOURS`); the builder's five barriers borrow unrelated prop art; the race's effects are
  only explosion, sparks, smoke and dust.
- **Reused, not generated**: cauldron (`anim-06-molten-cauldron`), breaking bridge
  (`/art/track-parts/bridge-wooden-broken.png`), sheep, TNT and spring (existing sprites), and the
  pickups (the existing `fuel/shield/bounce-supply.png`).

## Rules for this batch
- **Textures (1–3)**: full-bleed, top-down, no magenta. Save the raw to `art-src/track/raw/<id>.png`,
  then `convert <raw> -resize <size>! public/art/track-obstacles/tex/<id>.png` (sizes below).
- **Sprites (4–12, 22)**: raw `art-src/track/raw/<id>.png`, then
  `node --import tsx scripts/key-art.ts --set track-sprites --only <id>` → PASS.
- **Animated effect sheets (13–21)**: 2x2 sheets.
  1. Add the sheet's name to the `SHEETS` list in `scripts/process-generated-animated.mjs` (the
     only code edit this batch makes).
  2. Build the guide-free template once:
     `convert -size 1024x1024 xc:'#FF00FF' -fill '#2a2a2a' -draw 'rectangle 48,48 487,487' -draw 'rectangle 536,48 975,487' -draw 'rectangle 48,536 487,975' -draw 'rectangle 536,536 975,975' art-src/animated/fx-template-2x2.png`
     and pass it as the image input with every effect prompt. (Dark panels, pure magenta gutters, no
     guide lines: ART_PIPELINE §10.2.)
  3. Raw `art-src/animated/<name>-src.png`, then `node scripts/process-generated-animated.mjs <name>`.
  4. Pass the §10.4 effect gates: layout ≥ 97 %, drift ≤ 20 px, min element Δ > 0.150, pairwise
     Δ > 0.080, remnant < 0.3 % (`node scripts/analyze-animated-sheets.mjs <name>`,
     `node scripts/onion-skin-check.mjs <name>`). fillSpread does not apply to effects.
- Effect prompts all begin with the same layout paragraph; keep it word for word.

---

## Textures

### 1. `boost-pad-chevrons` → `public/art/track-obstacles/tex/boost-pad-chevrons.png` at 512x1024
> A seamless top-down game texture of a goblin speed-boost pad set into a dirt racetrack, viewed straight down: a riveted dark iron plate with three bold glowing chevron arrows pointing straight up (the direction of travel), the chevrons molten orange-gold with a hot yellow core and a faint heat shimmer, hazard-striped yellow-and-black edges down both long sides. Tileable top to bottom so pads can be made any length. Hand-painted cel-shaded Blizzard/Warcraft goblin style, bold readable shapes, soft painted shading. Fills the whole frame edge to edge, portrait 1:2. No perspective, no shadow cast off the edges, no text, no watermark.

### 2. `gap-pit` → `public/art/track-obstacles/tex/gap-pit.png` at 1024x512
> A top-down game texture of a collapsed gap in a timber-and-dirt racetrack, viewed straight down: a dark bottomless pit in the middle with a few falling splinters and pebbles fading into black, its near and far edges made of snapped broken planks with jagged splinters and exposed iron nails, loose dirt crumbling over the lips. The darkness must fill the centre so the gap reads instantly as "don't fall in". Hand-painted cel-shaded Blizzard/Warcraft goblin style, soft painted shading. Fills the whole frame edge to edge, landscape 2:1, the broken edges along the left and right sides. No perspective, no text, no watermark.

### 3. `ramp-deck` → `public/art/track-obstacles/tex/ramp-deck.png` at 512x1024
> A seamless top-down game texture of a goblin stunt-ramp deck, viewed straight down: weathered timber planks running across the direction of travel, fastened with rows of iron straps and big square bolts, scuffed tyre marks down the middle, with a painted yellow-and-black hazard lip across the top edge. Tileable top to bottom below the lip. Hand-painted cel-shaded Blizzard/Warcraft goblin style, bold readable shapes, soft painted shading. Fills the whole frame edge to edge, portrait 1:2. No perspective, no text, no watermark.

## Obstacle sprites (keyed)

### 4. `rock-gate`
> Isolated 2D game obstacle sprite for a goblin racetrack: a rock gate, two jagged grey granite pillars leaning toward each other with a narrow opening between them for a racing ball to squeeze through, moss in the cracks and a goblin warning rag tied to one pillar, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 85% of the width, standing on the bottom edge. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including the opening between the pillars; no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 5. `water-rock`
> Isolated 2D game obstacle sprite for a goblin racetrack: a big wet mossy boulder sitting in a shallow stream, white water splashing up around its base and a small spray on one side, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 75% of the width, standing on the bottom edge. Palette: slate grey rock, green moss, white and pale-blue water. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 6. `roller-rails`
> Isolated 2D game obstacle sprite for a goblin racetrack: a short section of goblin roller-coaster track, two curved steel rails lined with fat iron rollers, carried on a rickety timber trestle with cross-braces, seen from a three-quarter front view. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 85% of the width, standing on the bottom edge. Palette: dark steel, brown timber, brass bolts. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including between the trestle beams; no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 7. `gap-warning-sign`
> Isolated 2D game prop sprite for a goblin racetrack: a crooked wooden warning sign on a single post, a triangular plank board painted with a big white goblin skull above a downward arrow and a jagged crack symbol, nails and a torn corner, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, filling about 55% of the width, the post standing on the bottom edge. Palette: brown wood, white and neutral red paint. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No letters, no text, no watermark, nothing else in frame.

## Builder barriers (keyed; replace the borrowed prop art)

### 8. `barrier-spike-wall`
> Isolated 2D game barrier sprite for a goblin racetrack: a long low wall of rusty iron plates bristling with sharpened steel spikes pointing toward the viewer, bolted to timber posts, a few spikes bent, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, wide, filling about 90% of the width, standing on the bottom edge. Palette: rusty iron, steel, brown timber. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including between the spikes; no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 9. `barrier-electric-fence`
> Isolated 2D game barrier sprite for a goblin racetrack: a goblin electric fence, three iron posts with ceramic insulators and brass coils on top, strung with sagging wires crackling with bright cyan electric arcs, a small crank generator box at one end, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, wide, filling about 90% of the width, standing on the bottom edge. Palette: dark iron, brass, white insulators, cyan and white arcs. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including between the wires; no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones (arcs are cyan, never violet). No text, no watermark, nothing else in frame.

### 10. `barrier-fire-pit`
> Isolated 2D game barrier sprite for a goblin racetrack: a fire-pit trap, a ring of blackened stones and iron grating around a trench of roaring orange flames and glowing coals, a few sparks rising, seen from the front at a slight downward angle. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light, soft painted shading. Centered, filling about 85% of the width, sitting on the bottom edge. Palette: charcoal stone, dark iron, orange and yellow fire. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no smoke haze, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 11. `barrier-rock-slide`
> Isolated 2D game barrier sprite for a goblin racetrack: a rock slide blocking the road, a heap of tumbled grey boulders and broken slabs with a snapped timber support beam sticking out and a small cloud of dust at the base, seen from the front at eye level. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, wide, filling about 90% of the width, sitting on the bottom edge. Palette: slate and granite grey, brown timber, tan dust. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

### 12. `barrier-mine-field`
> Isolated 2D game barrier sprite for a goblin racetrack: a goblin mine field, a patch of churned dirt with four round iron landmines half buried in it, each with a blinking red bulb and a pressure plate on top, one little goblin warning flag on a stick, seen from the front at a slight downward angle. Hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style, thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading. Centered, wide, filling about 85% of the width, sitting on the bottom edge. Palette: brown dirt, dark iron, neutral red bulbs. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, no watermark, nothing else in frame.

## Animated effect sheets (2x2, pass the template as the image input)

Every effect prompt starts with this layout paragraph (keep it word for word):
> *Four panels in a 2x2 grid: top-left, top-right, bottom-left, bottom-right, one animation frame in each dark panel of the template. Replace each dark panel with the effect on a perfectly flat solid pure magenta #FF00FF background. The bright magenta #FF00FF separator gutters must remain completely clean and pure. No glow, halo, mist, spark or shadow may touch or bleed into the gutters: shrink the effect rather than letting any pixel touch a gutter. Keep the effect's centre at the same point in every panel. No guide lines, no circles, no frames, no text.*

### 13. `anim-53-pinball-spinner`
> *[layout paragraph]* Trace the spinner once and reuse that exact tracing across all four panels. The effect: a goblin pinball spinner post for a racetrack, a squat brass bumper column with two paddle arms of riveted iron, seen from the front; in each panel the paddles are rotated a further quarter turn (0°, 45°, 90°, 135°) with a faint motion smear, the brass column itself identical in every panel. Hand-painted cel-shaded Blizzard/Warcraft goblin style, thick dark outlines, warm rim light. Palette: brass, dark iron, a neutral red bumper ring. Absolutely no pink, purple or magenta in the spinner.

### 14. `anim-54-nitro-flame`
> *[layout paragraph]* The effect: a nitro boost exhaust burst blasting out to the left, as from the back of a racing ball: panel 1 a tight bright blue-white ignition flash, panel 2 a long roaring orange-and-yellow flame jet with a blue core, panel 3 the jet at full length breaking into flame tongues and sparks, panel 4 a fading plume of orange embers and grey smoke. Hand-painted cel-shaded Blizzard/Warcraft goblin style, bold painted flame shapes. Palette: blue-white, yellow, orange, grey smoke. Absolutely no pink, purple or magenta in the flame.

### 15. `anim-55-boost-pad-flash`
> *[layout paragraph]* The effect: a burst of energy rising off a boost pad as a ball rolls over it, seen from a low front angle: panel 1 a flat bright golden ring on the ground, panel 2 the ring widening with three upward chevron-shaped streaks of orange light, panel 3 the streaks at full height with gold sparkles, panel 4 the streaks thinning into a few fading sparkles. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Palette: gold, orange, hot yellow-white. Absolutely no pink, purple or magenta.

### 16. `anim-56-pickup-collect-burst`
> *[layout paragraph]* The effect: a supply crate being collected, a magical pop seen from the front: panel 1 a small white-gold star flash, panel 2 a ring of radiating gold sparkles and four-point glints, panel 3 the ring expanded with a soft pale-gold shimmer and flying coins of light, panel 4 a few last drifting glints fading out. Painted in white and pale gold so the game can tint it per pickup. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Absolutely no pink, purple or magenta.

### 17. `anim-57-shield-shatter`
> *[layout paragraph]* The effect: a protective energy shield bubble breaking, seen from the front: panel 1 a round cyan hexagon-patterned energy bubble with a bright crack at the upper left, panel 2 cracks spreading across the whole bubble, panel 3 the bubble bursting outward into dozens of flying cyan hexagon glass shards, panel 4 a few scattered shards and cyan sparkles fading. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Palette: cyan, pale blue, white glints. Absolutely no pink, purple, violet or magenta.

### 18. `anim-58-spring-launch-puff`
> *[layout paragraph]* The effect: a spring pad launching a ball upward, seen from the front at ground level: panel 1 a flat burst of white steam at ground level, panel 2 a column of steam and dust shooting straight up with two brass bolts flying off, panel 3 the column spreading into a mushroom of steam, panel 4 wisps of steam drifting and thinning. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Palette: white steam, tan dust, brass glints. Absolutely no pink, purple or magenta.

### 19. `anim-59-landing-shockwave`
> *[layout paragraph]* The effect: a heavy ball slamming down onto a dirt track after a jump, seen from a low front angle: panel 1 a bright impact flash at ground level with dirt clods starting to lift, panel 2 a flat ring shockwave of dust spreading out along the ground with pebbles flying, panel 3 the dust ring wide and low with a low dust wall, panel 4 the dust settling and thinning. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Palette: tan and brown dust, grey pebbles, white flash. Absolutely no pink, purple or magenta.

### 20. `anim-60-tree-smash-splinters`
> *[layout paragraph]* The effect: a racing ball crashing into trackside trees, seen from the front: panel 1 a burst of snapped wood and a white impact flash, panel 2 wood splinters, bark chips and green pine needles exploding outward, panel 3 the debris at its widest with leaves tumbling, panel 4 a few splinters and needles falling and fading. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Palette: pale and brown wood, dark green needles, white flash. Absolutely no pink, purple or magenta.

### 21. `anim-61-speed-lines`
> *[layout paragraph]* The effect: speed streaks for a screen overlay at high speed, in each panel a set of thin white motion lines radiating outward from the centre toward the panel edges, the middle of each panel left empty; the lines are placed differently in every panel so they flicker when played. White and very pale warm-yellow lines only. Hand-painted, crisp tapered strokes. Absolutely no pink, purple or magenta.

## One more sprite

### 22. `shield-bubble-hex` (keyed, track set)
> Isolated 2D game effect sprite: a round protective energy shield bubble seen from the front, a translucent-looking sphere drawn as a bright cyan hexagon lattice with brighter edges, a soft white glint at the upper left and a faint inner glow, painted so the hex lines are clearly readable. Hand-painted cel-shaded Blizzard/Warcraft goblin style. Symmetrical, centered, filling about 85% of the width. Palette: cyan, pale blue and white only. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including inside the bubble between the hex lines; no gradient, no shadow, no vignette, no texture. Absolutely no pink, purple, violet or magenta in the bubble. No text, no watermark, nothing else in frame.

---

## Acceptance
- [ ] Textures 1–3 at their sizes in `public/art/track-obstacles/tex/`, full-bleed, no magenta;
      1 and 3 tile top to bottom (the first and last pixel rows match within 2 %).
- [ ] Sprites 4–12 and 22: keyed PNGs in `public/art/track-obstacles/`, each PASS.
- [ ] Sheets 13–21: registered in `SHEETS`, processed to `public/art/animated/alpha/`, passing the
      §10.4 effect gates (list any that need a regeneration).
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; each agent (B3a, B3b) posts its results table as a PR comment.
