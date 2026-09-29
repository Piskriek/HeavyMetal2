# W2-R3: Goblin creator audit (2026-09-29) and the repaint batch

Every painted creator part was rendered on a standard goblin, and the risky layers (headgear, hair,
neck, eyewear) on all eight head masters, with `scripts/goblin-audit.ts`. This page records what was
wrong, what code fixed, and what needs new art (the Codex prompt at the end).

## What was wrong, and why

| Problem | Parts | Cause | Status |
|---|---|---|---|
| Collars, scarves and medal ribbons across the jaw and mouth, worst on the wide heads (bloated, wedge, jowls, bigchin) | every `neck-*` | The rig's `chin` anchor (0.432 × head height under the eye line) sits **13–23 px above the real jaw** on every head master | **Fixed in code**: new `jaw` anchor measured off each head PNG (`HEAD_JAW` in `painted-parts.ts`, re-measured by `tests/goblin-jaw.test.ts`); all neck wear hangs from it |
| Ear defenders cover the face (your Rivet-8 screenshot) | `headgear-ear-defenders` | Registered to the crown at head width + 36, so the cups landed on the cheeks; **and the art is a three-quarter product shot** with the inner pads facing us | Placement fixed (cups out over the ears). **Art: repaint** (front view, as worn) |
| Hats cut off by the top of the frame | `headgear-smokestack`, `headgear-horseshoe-magnet` | Too wide for their height | Fixed (narrower). Smokestack still grazes the top: **repaint shorter** |
| Valve cap perched high with a gap | `headgear-valve-cap` | Pivot too high | Improved (lower); the chin strap still crosses the brow: **repaint** |
| Turbo helm covers one eye on every head | `headgear-turbo-helm` | **Art**: the face opening is painted off-centre | **Repaint** |
| Greasy pigtails' fringe covers the eyes; all the hair sits in front of the face | `hair-greasy-pigtails` | **Art**: the fringe hangs to the eyes; no depth map | **Repaint** + depth map |
| Stud buzz reads as a tiny black cap, not a haircut | `hair-stud-buzz` | **Art** | **Repaint** |
| Sergeant collar swallows the whole jaw | `neck-sergeant-collar` | **Art**: the collar's back is painted as tall as its front; no depth map | **Repaint** + depth map |
| Medal ribbon loop drawn over the chin | `neck-trophy-medal` | Depth map marks the whole ribbon as front | **Redo the depth map** |
| Mild: a few mouths carry a skin patch a slightly different green | `mouth-zipper-lips`, `mouth-stitched-scar`, `mouth-oil-drip`, `mouth-blowtorch-grin` | Painted lips, no skin tint mask | Not in this batch |
| Mild: baked dark eye-socket shading | `head-lantern`, `head-peanut` | Art | Owner's call; not in this batch |

Everything else (ears, eyes, noses, bodies, most mouths, most hats and eyewear) registers well on
every head.

Check any part yourself: `node --import tsx scripts/goblin-audit.ts /tmp/sheet headgear heads ear-defenders`
(one row per part, one column per head master).

## The Codex prompt (paste all of this)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You repaint EIGHT goblin
creator parts and paint FOUR depth maps: W2-R3. You write no game code.

SETUP
  git fetch origin main && git checkout -b art/w2-r3-goblin-repaint origin/main
  npm ci   (only if node_modules is missing)
  Read, binding: docs/tickets/art/wave-2/W2-R3-goblin-creator-audit.md (this batch),
  docs/tickets/art/wave-2/README.md (agent prompt, review loop, depth-map steps), docs/tickets/art/README.md (style bible).

HOW EACH PART IS USED (read this: it is why the old art failed)
  The creator stacks parts on a FRONT-FACING goblin head, straight on, like a passport photo. Every
  part is painted as it looks WORN, seen from the front, on its own: no head, no face, no neck inside.
  Anything that would be hidden by the head (the back of a collar, the back of the hair, a strap going
  round behind the skull) is still painted, and its depth map marks it black so the game draws it
  behind the head.

FOR EACH PART, in order
  1. Generate with its prompt (below), the reference image as the style input. Save the raw at
     art-src/avatar-parts/raw/<id>.png.
  2. node --import tsx scripts/key-art.ts --set avatar-parts --only <id>   → must PASS.
  3. Review on every head:
       node --import tsx scripts/goblin-audit.ts /tmp/<id> <layer> heads <id>
     Open /tmp/<id>-0.png. Accept only if the "why" fault is gone on ALL EIGHT heads.
     Up to 3 tries; then move on and list it as failed.
  4. If it has a depth map: generate the map (prompt below, the keyed part flattened on magenta as the
     image input), save art-src/avatar-parts/depth-raw/<id>.png, run
     node scripts/build-depth-mask.mjs --only <id>, and look at art-src/review/<id>-depth.png
     (back pixels shaded blue). Re-run the audit step 3.
  If a key-art run changes painted-parts.generated.ts entries for other parts, keep only your id's change.
  Do NOT edit painted-parts.ts (registration): the owner's Claude session re-registers after you push.

THE PARTS

1. headgear-ear-defenders
  WHY: painted as a three-quarter product shot, the inner ear pads facing us; worn, they covered the face.
  Reference: public/avatar-parts/keyed/headgear-aviator-helmet.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if worn
  by an invisible head: riveted steel workshop ear defenders. A thick spring-steel headband arches
  over the top in a wide semicircle; at each lower end a big round ear cup seen EDGE-ON from the front
  (we see the cup's outer rim and side, never the soft inner pad), the two cups far apart, about 1.25
  times the band's inner width apart, so a wide goblin head fits between them. A red crown badge on the
  top of the band. Symmetric. Centered, filling about 80% of the width. Palette: steel = dark
  gunmetal, band padding = worn olive leather, badge = red. Hand-painted fantasy game art in a
  Blizzard/Warcraft goblin style: visible painterly brushwork, thick dark brown-black ink outlines,
  chunky readable shapes, warm key light from the upper left, soft painted shading. Not flat vector
  art, not clip art, no smooth airbrushed gradients, not a 3D render. Match the painting style,
  outline weight and lighting of the reference image, not its subject. Background: perfectly flat,
  solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow, no floor,
  no vignette, no texture. The subject contains absolutely no pink, purple or magenta, and no glow,
  haze or soft halo spreads past its outline. No text, no letters, no numbers, no watermark, nothing
  else in frame.

2. headgear-turbo-helm
  WHY: the face opening was painted off-centre, so the helmet covered one eye on every head.
  Reference: public/avatar-parts/keyed/headgear-aviator-helmet.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: an open-face cast-iron racing helmet made from a turbocharger. The helmet dome is centred and
  symmetric, with a wide open face hole in the middle of the lower half (the hole spans the full width
  between the ear flaps, from the brow down; nothing crosses the eyes). The turbocharger's round
  snail housing with its fan blades is mounted on the helmet's LEFT side above the ear, its exhaust
  pipe curling up over the top. Riveted seams. Centered, filling about 75% of the width. Palette:
  cast iron = dark gunmetal, fan = steel, rivets = brass. [style + magenta + no-text block exactly as
  in part 1]

3. headgear-smokestack
  WHY: too tall for the portrait; its top is cut off by the frame.
  Reference: public/avatar-parts/keyed/headgear-smokestack.png (its own current art: keep the look)
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: a SHORT riveted sooty stovepipe top hat, only as tall as it is wide (half the height of the
  current one), a wide brim, two rivet bands, a scorched glowing rim at the top and one wisp of smoke.
  Centered, filling about 70% of the width. Palette: iron = sooty black, glow = orange. [style +
  magenta + no-text block as in part 1]

4. headgear-valve-cap
  WHY: sat perched with a chin strap across the brow.
  Reference: public/avatar-parts/keyed/headgear-bucket-pot.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: a riveted brass skull cap shaped like a grinning skull that fits snugly over the top of the
  head down to the eyebrows, a small red-bronze steam valve wheel on top. No chin strap, no straps at
  all. The cap's lower edge is a clean curve where the forehead would be. Centered, filling about 70%
  of the width. Palette: brass, bronze, red valve. [style + magenta + no-text block as in part 1]

5. hair-greasy-pigtails  (+ depth map)
  WHY: the fringe hung over the eyes, and all the hair drew in front of the face.
  Reference: public/avatar-parts/keyed/hair-long-braids.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: a cropped black undercut: short greasy black hair covering the top of the skull, the fringe
  cut short and ending WELL ABOVE where the eyebrows would be (a clear gap of forehead), and two
  greasy black pigtails tied with knotted copper wire, sticking out and down at each side of the head
  behind the ears. The hair is a cap shape with an EMPTY middle below the hairline (no face). Symmetric.
  Centered, filling about 80% of the width. Palette: hair = blue-black, wire = copper. [style +
  magenta + no-text block as in part 1]
  DEPTH MAP: Turn this goblin costume part into a depth map. Keep its exact outline, size and
  position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit
  IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the
  goblin's head. In front: the hair on top of the skull, the fringe, and the two pigtails. Behind: any
  hair showing below the hairline at the back of the head between the pigtails. No shading, no
  outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta
  #FF00FF filling the entire image edge to edge.

6. hair-stud-buzz
  WHY: read as a tiny black cap, not a haircut.
  Reference: public/avatar-parts/keyed/hair-rivet-fringe.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: a very short buzz cut: a thin even layer of stubbly dark hair covering the whole top of a wide
  bald skull down to the temples (a wide low dome of stubble, clearly hair texture, not a hat), with a
  crest of small chrome bolt studs running down the middle. Nothing below the hairline. Centered,
  filling about 80% of the width. Palette: stubble = dark brown-black, studs = chrome. [style +
  magenta + no-text block as in part 1]

7. neck-sergeant-collar  (+ depth map)
  WHY: the collar's back was as tall as its front and covered the whole jaw.
  Reference: public/avatar-parts/keyed/neck-boiler-suit-collar.png
  PROMPT: Isolated 2D cosmetic part for a goblin face builder, seen perfectly from the front as if
  worn: a stiff crimson parade collar with brass piping: its two FRONT points are low and open in a V
  under where the chin would be (the front is no taller than a shirt collar); its BACK rises tall and
  stiff behind where the head would be, visible above the two front points on both sides. A brass
  number 5 pin on the left point. The middle is empty (no neck). Symmetric. Centered, filling about
  80% of the width. Palette: crimson, brass. [style + magenta + no-text block as in part 1]
  DEPTH MAP: [the depth-map prompt of part 5, with] In front: the two low front points and the pin.
  Behind: the tall back of the collar and its inner lining.

8. neck-trophy-medal  (depth map only: keep the part)
  WHY: the ribbon's back loop is marked front, so it draws over the chin.
  Input: the keyed part flattened on magenta (art-src/review/neck-trophy-medal-input.png).
  DEPTH MAP: [the depth-map prompt of part 5, with] In front: the two front lengths of ribbon below
  the knot and the medal. Behind: the whole upper loop of the ribbon (everything above the knot).

WHEN DONE
  npm run check:edges (0 failures); node --import tsx --test tests/art-budget.test.ts tests/painted-parts.test.ts (pass).
  git add art-src/avatar-parts/raw art-src/avatar-parts/depth-raw public/avatar-parts src/game/meta/painted-parts.generated.ts src/game/meta/painted-depth.generated.ts src/game/meta/painted-masks.generated.ts
  (only your ids' changes), commit "art(w2-r3): goblin creator repaints", git push -u origin art/w2-r3-goblin-repaint.
  End with the table: # | id | status | tries | notes (which heads you checked it on).
  Do not open a PR, do not merge, do not edit painted-parts.ts or any other game code, do not touch backups/.
```

After the push, the owner's Claude session merges the branch, re-registers the repainted parts (pivot,
width, anchor) with the audit sheets, and adds the new depth maps to the build.
