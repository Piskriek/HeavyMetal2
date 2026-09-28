# ART-CLOUDS: ten painted billboard clouds for the island sky (one agent)

- **Batch**: one Codex art agent, 10 images. Branch `art/sky-clouds`, cut from
  `origin/claude/quirky-clarke-rift62` (that branch carries the cloud layer and the `sky-clouds` keying set).
- **Feeds**: `src/game/sky/sky-clouds.ts`. It already loads `/art/clouds/cloud-01.png` … `cloud-10.png`
  and paints a stand-in for any file that is missing, so the art drops in with **no code change**.
- **Why**: the island sky is bare. The owner wants white, fluffy, whimsical clouds of different shapes in the
  game's hand-painted Blizzard style, floating round the island and shrinking toward the horizon. They are
  drawn as camera-facing billboards, up to ~60 at once, from ~40 000 to ~110 000 units away, so each one is
  a single clean silhouette that reads at small sizes.
- **Budget**: `public/` sits at ~596 MB of its 600 MB budget (`tests/art-budget.test.ts`). Masters are keyed
  at 512 px wide; the ten must total **under 3 MB**. Report the total.

## Rules for this batch
- Keyed art, the style bible of [README.md](README.md): flat pure magenta `#FF00FF` background, nothing
  pink/purple/violet/lavender in the subject. Clouds are shaded with **blues and blue-greys only**: a
  lavender shadow sits too close to the key and gets eaten.
- The cloud must **not touch the frame**: a clear magenta margin on all four sides (the keyer fails
  `borderTouch`).
- No ground, sea, sky, sun, rays, birds or haze: one cloud floating alone.
- Canvas: landscape **1536×1024** (or the generator's nearest landscape size). The cloud's own proportions
  are given per image; the keyer trims the margin.
- Raw: `art-src/clouds/raw/<id>.png` (PNG; convert a JPEG with `convert in.jpg -depth 8 <raw>`).
- Process: `node --import tsx scripts/key-art.ts --set sky-clouds --only <id>` → must print PASS
  (or WARN with a note you accept). Output lands in `public/art/clouds/<id>.png`.

---

## Part A: the prompt for the agent (paste all of this)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You generate ONE batch
of 10 images: ART-CLOUDS. You write no game code.

SETUP
  git fetch origin claude/quirky-clarke-rift62:refs/remotes/origin/claude/quirky-clarke-rift62
  git checkout -b art/sky-clouds origin/claude/quirky-clarke-rift62
  (If your session is locked to its own branch: stay on it and run
     git merge --no-edit origin/claude/quirky-clarke-rift62)
  npm ci   (only if node_modules is missing)
  Read: docs/tickets/art/ART-CLOUDS.md (this batch: binding), docs/tickets/art/README.md ("Style bible"
        and "Output rules"), docs/ART_PIPELINE.md §3 (keying rules).
  scripts/key-art.ts must list a 'sky-clouds' set; if it does not, stop and report.

FOR EACH IMAGE 1–10, in order
  1. Generate it with the prompt given for that image in ART-CLOUDS.md: the COMMON STYLE paragraph
     followed by the image's own SHAPE line, exactly as written; add nothing.
  2. Save the raw output as PNG at art-src/clouds/raw/<id>.png.
  3. node --import tsx scripts/key-art.ts --set sky-clouds --only <id>
     It must print PASS (or WARN with a note you accept).
     On FAIL: regenerate with the failing QA note appended to the prompt, up to 3 times; then move on
     and list it as failed.
  4. Look at the keyed PNG on a dark and a light background (e.g.
       convert public/art/clouds/<id>.png -background '#1b2433' -flatten /tmp/<id>-dark.png
       convert public/art/clouds/<id>.png -background '#dcefff' -flatten /tmp/<id>-light.png)
     Reject and regenerate (same 3-try limit) if you see a pink/magenta fringe, a hard black outline,
     a chopped-off edge, more than one cloud, or anything that is not a cloud.
  5. After images 5 and 10: stage ONLY your own files
       git add art-src/clouds/raw public/art/clouds
     (never git add -A or git add .), commit "art(clouds): images <a>-<b>", then
       git pull --rebase origin art/sky-clouds 2>/dev/null; git push -u origin art/sky-clouds
     If you hit the images-per-turn limit, push first, then output "[pause for turns to reset]" and
     stop until the user says "Reset".

WHEN THE BATCH IS DONE
  npm run check:edges                                  (0 failures)
  node --import tsx --test tests/art-budget.test.ts    (must pass)
  du -cb public/art/clouds/*.png | tail -1             (must be under 3 MB; if not, re-key the
                                                        biggest with a smaller master and say so)
  montage public/art/clouds/cloud-*.png -background '#6cb4f2' -tile 5x2 -geometry 256x160+8+8 \
    art-src/clouds/clouds-contact-sheet.png            (commit it with the raws)
  Push, then end your reply with the table:
    # | id | status (pass / warn / failed) | bytes | notes
  Do not open a PR, do not merge, do not edit game code, do not touch backups/.
```

---

## COMMON STYLE (the first half of every prompt, word for word)

> Isolated 2D game sprite of a single floating cloud for the sky of a goblin racing game, hand-painted
> cel-shaded fantasy illustration in a Blizzard/Warcraft style, like the painterly skies of World of
> Warcraft: big soft rounded cumulus lobes with bold, simplified, chunky readable shapes. Lit bright white
> on the top and upper-left where the sun hits, with a warm cream catch-light along the sunlit edges; the
> undersides and the tucks between lobes shaded in cool periwinkle-blue and soft slate-blue, with a clean
> painted band where light turns to shade; confident visible brush strokes; a soft, slightly darker
> blue-grey painted rim instead of a black outline. Whimsical, friendly, a little storybook. The cloud
> floats alone: no ground, no sea, no sky, no sun, no rays, no birds. Centered, filling about 80% of the
> width, with a clear margin of background on all four sides so no part touches the edge. Background:
> perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge, including every gap
> between the lobes; no gradient, no shadow, no vignette, no texture, no glow or haze spilling into the
> background. The cloud contains absolutely no pink, purple, violet, lavender or magenta tones: shade it only
> with blues and blue-greys. No text, no watermark, nothing else in frame.

## The ten shapes (the second half: `SHAPE:` then the line)

| # | id | name | SHAPE line |
|---|---|---|---|
| 1 | `cloud-01` | Towering cumulus | A tall, proud towering cumulus: a broad flat-bottomed base rising into a stack of big round puffs, the tallest puff crowning the middle like a scoop of ice cream; about one and a half times as wide as tall. |
| 2 | `cloud-02` | Long drifter | A long, low, lazy drifting cloud stretched wide: a gentle row of small rounded puffs along a flat underside, about three times as wide as tall. |
| 3 | `cloud-03` | Twin puffs | Two round fluffy puffs side by side, the right one a little taller, joined by a thin soft bridge of cloud like two friends holding hands; about twice as wide as tall. |
| 4 | `cloud-04` | Curl | A fluffy cloud whose top right curls over into a playful spiral, like an ocean wave frozen in cloud, the curl's tip tucking back toward the body; about one and a half times as wide as tall. |
| 5 | `cloud-05` | Little puff | A small, chubby, round single puff made of three soft lobes, cute and compact, a little wider than tall. |
| 6 | `cloud-06` | Mushroom | A whimsical mushroom-shaped cloud: a wide billowing rounded cap on top of a short puffy stem that tapers underneath; about as wide as it is tall. |
| 7 | `cloud-07` | Woolly sheep | A round woolly cloud whose whole outline is made of many tight curly little puffs, like a sheep's fleece, soft and cosy; about one and a half times as wide as tall. |
| 8 | `cloud-08` | Cloud castle | A cloud castle: three puffy towers of different heights rising from one fluffy base, the middle tower tallest, suggesting turrets with no buildings, walls or windows; about one and a third times as wide as tall. |
| 9 | `cloud-09` | Wisp trail | A comet-like cloud: a fat fluffy head on the left trailing off to the right in a line of smaller and smaller puffs that thin out into wisps; about two and a half times as wide as tall. |
| 10 | `cloud-10` | Floating isle | A cloud shaped like the underside of a floating island: a broad, flat-topped fluffy crown narrowing underneath into a soft rounded point; about one and two thirds times as wide as tall. |

The full prompt for an image is the COMMON STYLE paragraph, a space, `SHAPE:`, a space, and its line.

## Acceptance
- 10 raws in `art-src/clouds/raw/`, 10 keyed masters in `public/art/clouds/` (PASS or accepted WARN),
  the contact sheet in `art-src/clouds/`.
- `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; the ten total under 3 MB.
- In the builder on Basalt Isle (Sky → Sky & clouds…), the painted stand-ins are replaced by the art with
  no code change.
