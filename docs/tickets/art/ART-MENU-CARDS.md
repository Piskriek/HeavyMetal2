# ART-MENU-CARDS: five painted card illustrations for Quick Races and Multiplayer (one agent)

- **Batch**: one Codex art agent, 5 images. Branch `art/menu-cards` from `origin/main`.
- **Feeds**: `src/components/quick/QuickRacesPanel.tsx` and `src/components/multiplayer/MultiplayerHub.tsx`.
  Both already load `/art/menus/cards/<id>.png` and show an icon until the file exists (`CardArt`), so the
  art drops in with **no code change**.
- **Why**: the new Quick Races and Multiplayer screens use line icons on their cards; everything else in the
  game is painted.
- **Budget**: `public/` is close to its 600 MB budget (`tests/art-budget.test.ts`). Masters are 512 px;
  the five must total **under 1.5 MB**.

## Rules
- Keyed art, the style bible of [README.md](README.md): flat pure magenta `#FF00FF` background, nothing
  pink/purple/violet/magenta in the subject, no text, a clear magenta margin on all four sides.
- Canvas: square **1024×1024** (the keyer trims and fits to 512).
- Raw: `art-src/menus/cards/raw/<id>.png`. Process: `node --import tsx scripts/key-art.ts --set menu-cards --only <id>` → PASS.

## The prompt (paste all of this)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You generate ONE batch
of 5 images: ART-MENU-CARDS. You write no game code.

SETUP
  git fetch origin main && git checkout -b art/menu-cards origin/main   (or merge origin/main into your locked branch)
  npm ci   (only if node_modules is missing)
  Read docs/tickets/art/ART-MENU-CARDS.md (binding), docs/tickets/art/README.md ("Style bible").
  scripts/key-art.ts must list a 'menu-cards' set; if not, stop and report.

THE PROMPT FOR EACH IMAGE = the COMMON STYLE paragraph, a space, "SUBJECT:", a space, the image's line.

COMMON STYLE:
Isolated 2D game menu illustration for a goblin racing game, a single small object composition,
hand-painted cel-shaded fantasy illustration in a Blizzard/Warcraft goblin style: thick dark brown-black
outlines, chunky readable shapes, warm rim light from the upper left, soft painted shading, brass, riveted
iron, oily leather and soot. Reads clearly at 120 pixels. Centered, filling about 75% of the frame, with a
clear margin of background on all four sides so no part touches the edge. Background: perfectly flat,
solid pure magenta #FF00FF filling the entire image edge to edge; no gradient, no shadow, no floor, no
vignette, no glow spilling into the background. The subject contains absolutely no pink, purple, violet or
magenta tones. No text, no letters, no numbers, no watermark, nothing else in frame. Square 1:1.

THE FIVE
  1 card-quick-race       SUBJECT: A battered riveted-iron racing ball with brass bearing caps bursting forward off a small wooden launch ramp, a checkered flag on a bent pole stuck in the ramp, a puff of dust and a few sparks behind it.
  2 card-tournament       SUBJECT: A chunky goblin trophy cup welded from scrap: a brass bowl with riveted iron handles shaped like wrenches, a small racing ball mounted on top, standing on a stack of three wooden crates.
  3 card-create-your-own  SUBJECT: A rolled-out parchment course map of a serpent-shaped island with a winding dotted route, held flat by a brass compass and a stubby pencil, a small red-and-white checkered finish flag pinned into it.
  4 card-race-online      SUBJECT: A brass goblin radio-telegraph on a wooden crate: a big crackling antenna made of bent pipe, dials and gauges, a speaking horn, little lightning sparks jumping off the antenna tip.
  5 card-leaderboards     SUBJECT: A wooden goblin scoreboard on two iron posts with three blank brass nameplates in a stepped row (1st highest), a gold medal hanging from the top corner on a leather strap.

FOR EACH IMAGE, in order
  1. Generate it with its full prompt. Save the raw PNG at art-src/menus/cards/raw/<id>.png.
  2. node --import tsx scripts/key-art.ts --set menu-cards --only <id>   → must print PASS (or accepted WARN).
     On FAIL: regenerate with the QA note appended, up to 3 times; then move on and list it as failed.
  3. Check it on dark and light (convert public/art/menus/cards/<id>.png -background '#14231b' -flatten /tmp/<id>.png);
     regenerate if there is a pink fringe, text, a chopped edge, or more than one subject.

WHEN DONE
  npm run check:edges (0 failures); node --import tsx --test tests/art-budget.test.ts (pass);
  du -cb public/art/menus/cards/*.png | tail -1 (under 1.5 MB).
  git add art-src/menus/cards/raw public/art/menus/cards   (only these), commit "art(menu-cards): 5 card illustrations",
  git push -u origin art/menu-cards. End with the table: # | id | status | bytes | notes.
  Do not open a PR, do not merge, do not edit game code, do not touch backups/.
```
