# ART-CLOUDS-EPIC: epic horizon cloud banks and overhead cloud decks (one agent)

- **Batch**: one Codex art agent, **8 cloud banks + 3 overhead decks = 11 images**. Branch `art/clouds-epic`
  from `origin/main`.
- **Why**: the owner finds the first cloud set (ART-CLOUDS) small and blobby. Those were keyed at 512 px and
  stand ~5 000 units wide; these are painted like a feature-film sky (DreamWorks: *How to Train Your Dragon*,
  *Kung Fu Panda*): huge towering cumulus banks with real volume that stand on the horizon, and cloud
  ceilings for storm scenes, seen from below.
- **Feeds**: `src/game/sky/sky-clouds.ts` (banks: the horizon ring) and `src/game/sky/sky-overhead.ts`
  (decks: a ceiling over the island). Both already draw painted stand-ins and load these files when they
  exist, so the art drops in with **no code change**.
- **Budget**: `public/` has ~50 MB left. Banks key to 1536 px wide; the 8 must total **under 10 MB**; the 3
  decks **under 3 MB**. Report both totals.

## Part A: the prompt for the agent (paste all of this)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You generate ONE batch of
11 images: ART-CLOUDS-EPIC (8 horizon cloud banks, 3 overhead cloud decks). You write no game code.

SETUP
  git fetch origin main && git checkout -b art/clouds-epic origin/main
    (if your session is locked to its own branch: stay on it and git merge --no-edit origin/main)
  npm ci   (only if node_modules is missing)
  Read, binding: docs/tickets/art/ART-CLOUDS-EPIC.md, docs/tickets/art/README.md ("Style bible").
  scripts/key-art.ts must list a 'sky-cloud-banks' set; if not, stop and report.

PART 1: THE 8 CLOUD BANKS (keyed on magenta)
  For each bank 1-8: the prompt = BANK STYLE + " SHAPE: " + its line below.
  1. Generate at landscape 2:1 (2048x1024, or the generator's nearest wide size).
  2. Save the raw PNG at art-src/clouds/banks/raw/<id>.png
  3. node --import tsx scripts/key-art.ts --set sky-cloud-banks --only <id>   -> PASS (or WARN you accept).
     On FAIL: regenerate with the QA note appended, up to 3 tries, then move on and list it as failed.
  4. Check it flattened on a sky blue and on a dusk orange:
       convert public/art/clouds/banks/<id>.png -background '#6cb4f2' -flatten /tmp/<id>-day.png
       convert public/art/clouds/banks/<id>.png -background '#f0a060' -flatten /tmp/<id>-dusk.png
     Reject (same limit) for: a pink/magenta fringe, a hard dark outline, a flat bottom that is cut off
     straight, anything touching the frame, sky or sea painted behind the cloud, or small separate puffs.

BANK STYLE:
Epic feature-film painted cloud bank in the style of DreamWorks animation skies (How to Train Your
Dragon, Kung Fu Panda): one enormous towering cumulus cloud formation, seen from far away across the
sea, with huge billowing volumes piled on each other, deep soft shadows between the billows, crisp
sunlit edges on top and a soft slightly flattened base. Rich painterly rendering with visible soft
brushwork, luminous and cinematic, NOT cartoon outlines, NOT flat vector, NOT a photo. Colours: lit
tops warm cream white with a faint gold glow, shadows cool blue and slate blue-grey, the base a deeper
blue-grey. Absolutely no pink, purple, violet, lavender or magenta anywhere in the cloud (shadows are
blue, never lavender). The cloud floats alone, centred, filling about 85% of the width, with a clear
margin of background on all four sides so no part touches the edge. Background: perfectly flat, solid
pure magenta #FF00FF filling the entire image edge to edge; no sky, no sea, no sun, no rays, no birds,
no haze or glow spilling into the background. No text, no watermark.

THE 8 BANKS
  1 cloud-bank-01  SHAPE: A massive towering cumulonimbus tower rising from a wide base, its top boiling up into three great rounded domes, the tallest in the middle-left.
  2 cloud-bank-02  SHAPE: A long low bank of piled cumulus, twice as wide as it is tall, a row of five big rounded billows of different heights along its top.
  3 cloud-bank-03  SHAPE: A grand cloud castle: two huge billowing towers on the left and right joined by a lower mass of cloud between them.
  4 cloud-bank-04  SHAPE: A leaning cumulus giant, its enormous rounded top swelling out to the right over a narrower base, like a wave about to break.
  5 cloud-bank-05  SHAPE: A wide anvil storm cloud: a dark heavy base, a tall column, and a broad flat anvil top spreading out to both sides, the top lit gold.
  6 cloud-bank-06  SHAPE: A soft layered bank: three stacked horizontal layers of billowing cloud, each smaller and further back, a gentle sunset mood.
  7 cloud-bank-07  SHAPE: A heroic single tower of cumulus, taller than it is wide, with a big rounded head and cauliflower billows cascading down its sides.
  8 cloud-bank-08  SHAPE: A long drifting range of cumulus hills, very wide and low, gentle rounded peaks along its top and a flat soft base.

PART 2: THE 3 OVERHEAD CLOUD DECKS (seamless tiles, NOT keyed)
  These are cloud ceilings seen from directly below, tiled across the sky. They are density maps: white =
  thick cloud, black = open sky. The game colours them itself.
  For each deck:
  1. Generate a SQUARE image (1024x1024 or larger) with the prompt = DECK STYLE + " PATTERN: " + its line.
  2. Save the raw at art-src/clouds/decks/raw/<id>.png
  3. Make it tile seamlessly and write the game file (grey, 1024 px). The half-offset copy is seamless at
     its edges; a radial mask keeps the original in the middle, where the offset copy has its seam cross:
       mkdir -p public/art/clouds/decks
       convert art-src/clouds/decks/raw/<id>.png -colorspace Gray -resize 1024x1024! /tmp/<id>-a.png
       convert /tmp/<id>-a.png -roll +512+512 /tmp/<id>-b.png
       convert -size 1024x1024 radial-gradient:white-black /tmp/mask.png
       convert /tmp/<id>-b.png /tmp/<id>-a.png /tmp/mask.png -composite -quality 90 public/art/clouds/decks/<id>.png
  4. Check the tiling: convert public/art/clouds/decks/<id>.png -write mpr:t +delete -size 2048x2048 tile:mpr:t /tmp/<id>-tiled.png
     Reject (3 tries) if a seam, a repeated obvious blob, text, or a hard edge shows.

DECK STYLE:
A seamless tileable texture of a cloud layer seen from directly below, looking straight up at the
underside of the clouds, painted in a soft painterly feature-film style. Pure greyscale density map:
pure white where the cloud is thickest, soft greys at the thin edges, pure black for open sky between
the clouds. Soft billowing shapes with painterly edges, no hard outlines, even coverage across the whole
square with no centre focus and nothing touching only one edge, so it repeats seamlessly. No sky colour,
no sun, no horizon, no perspective, flat top-down. No text, no watermark.

THE 3 DECKS
  1 cloud-deck-fair    PATTERN: Scattered fair-weather cumulus: many separate rounded cloud patches of mixed sizes with lots of open black sky between them (about 35% cloud).
  2 cloud-deck-broken  PATTERN: A broken cloud layer: big merging billowing masses with irregular gaps and channels of black open sky (about 65% cloud).
  3 cloud-deck-storm   PATTERN: A heavy storm ceiling: almost solid cloud with deep rolling lumpy undersides, a few thin dark rifts, textured mammatus pouches (about 90% cloud).

WHEN DONE
  npm run check:edges (0 failures); node --import tsx --test tests/art-budget.test.ts (pass)
  du -cb public/art/clouds/banks/*.png | tail -1   (under 10 MB)
  du -cb public/art/clouds/decks/*.png | tail -1   (under 3 MB)
  montage public/art/clouds/banks/cloud-bank-*.png -background '#6cb4f2' -tile 4x2 -geometry 384x192+8+8 art-src/clouds/banks/contact-sheet.png
  git add art-src/clouds/banks art-src/clouds/decks public/art/clouds/banks public/art/clouds/decks   (only these)
  commit "art(clouds-epic): 8 cloud banks, 3 overhead decks", git push -u origin art/clouds-epic.
  End with the table: # | id | status | tries | bytes | notes.
  Do not open a PR, do not merge, do not edit game code, do not touch backups/.
```
