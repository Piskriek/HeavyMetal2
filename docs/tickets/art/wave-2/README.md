# Art wave 2: the rest of the game's missing art (one PR, seven agents at once)

Wave 2 lands on the branch **`art/generated-wave-2`**, which starts from `art/generated-wave-1` (so the
wave-1 art is already there to use as style references). Open the PR with base `art/generated-wave-1`.
Seven Codex agents work at the same time. **This README replaces the wave-1 Part A for this wave**: the
agent prompt is below, complete.

| Agent | Batch | Images | Lands in |
|---|---|---|---|
| 1 | [W2-A1](W2-A1-goblin-parts-3a.md): goblin parts 3a (eyes, eyewear, hair, headgear, a mouth) | 12 + 5 depth maps | `public/avatar-parts/keyed/`, `…/depth/` |
| 2 | [W2-A2](W2-A2-goblin-parts-3b.md): goblin parts 3b (mouths, necks, noses, ears, war paint) | 12 + 3 depth maps | `public/avatar-parts/keyed/`, `…/depth/` |
| 3 | [W2-B](W2-B-cockpit-and-gameplay.md): glass grime and cracks, dashboard trinkets, rope-reel goblin (image 1 dropped) | 13 | `public/art/cockpit/`, `public/art/animated/alpha/` |
| 4 | [W2-C](W2-C-garage-decals-2.md): Ball Garage decal pack 2 | 16 | `public/art/garage/decals/` |
| 5 | [W2-D](W2-D-goblin-base-and-gauges.md): the last vector goblin parts (heads, war paint, goggles up) and painted needles | 12 + 1 depth map | `public/avatar-parts/keyed/`, `public/art/cockpit/`, `public/art/ui/icons/` |
| 6 | [W2-E](W2-E-builder-icons.md): painted builder shelf icons and the Custom 3D icon | 17 | `public/art/ui/icons/` |
| 7 | [W2-F](W2-F-depth-maps-wave-1.md): depth maps for the 14 wave-1 clothing parts (no new art) | 14 depth maps | `public/avatar-parts/depth/` |

**Rule from the owner: no vector-style art may remain.** W2-D and W2-E replace the last SVG-drawn art, and
every prompt says "not flat vector art" in so many words.

## Art direction (the design pass)
The first draft of these prompts described each object well but not where it would be seen, so wave 1 came
back as good paintings that did not always sit together. Every batch file now opens with **where its art is
seen** and what that demands, and three things are new everywhere:

1. **A reference image for every prompt.** Each image names a wave-1 file of the same kind, passed as the
   image input on every try. It fixes the hand (outline weight, brushwork, light), never the subject. Where
   nothing exists yet (trinkets, builder icons), the batch paints one anchor image first and uses it as the
   second reference for the rest, so the set is one family.
2. **Read at the size it is used.** Goblin parts must read at 48 px (the creator's medallions and the race
   badges), decals at 48 px on a spinning ball, builder icons at 56 px on a dark zinc tile. One clear idea
   per image, detail spent on the silhouette.
3. **A review loop after every image** (below): the agent looks at its result next to the reference and
   small, and regenerates when it is off-family, unreadable small, a near-copy of an existing part, or has a
   pink fringe.

Glows never spread past an outline (on magenta a halo keys into a pink fringe); lights show as a bright part
inside the outline. War paint has no ink outlines: it is paint on skin, not a sticker.

## Depth maps: clothing that wraps around the goblin
A collar's back half, a hat's back brim and dark inside, a goggle strap going round the head: drawn as one
layer, those back pieces paint over the face. Parts like these get a **depth map**: the same part repainted
in two flat colours, white for what sits in front of the goblin, black for what is hidden behind its head
or neck. `scripts/build-depth-mask.mjs` lines the map up with the keyed part (bounding box onto bounding
box, so it never has to be pixel exact) and writes `public/avatar-parts/depth/<id>.png`, a half-resolution
greyscale mask, white = front. The game draws the part twice: through the inverted mask behind the head,
and through the mask in front of it. The two add up to the part exactly.

**Depth-map steps** (for every part marked "Depth map", and all of W2-F):
1. Key the part first; it must PASS.
2. Flatten the keyed part onto magenta and pass that as the image input:
   `convert public/avatar-parts/keyed/<id>.png -background '#FF00FF' -flatten art-src/review/<id>-input.png`
3. Generate with the part's depth prompt (copied exactly). Save the raw as PNG at
   `art-src/avatar-parts/depth-raw/<id>.png`.
4. `node scripts/build-depth-mask.mjs --only <id>` must print PASS. It also writes
   `art-src/review/<id>-depth.png`: the part as painted, then the part with its back pieces shaded blue.
   Look at it: every blue piece must really be behind the goblin. Regenerate otherwise (3 tries).
5. Commit the map raw and `public/avatar-parts/depth/<id>.png`.

## Review loop (after every keyed image)
```
montage -background '#0f1814' -geometry 192x192+10+10 <your output> <the reference file(s)> art-src/review/<id>-check.png
convert <your output> -background '#0f1814' -flatten -resize 48x48 art-src/review/<id>-48.png
```
(`magick montage` / `magick convert` on ImageMagick 7.) Open both and answer four questions:
1. **Same hand?** Does it look painted by the same artist as the reference: outline weight, brushwork, light
   from the upper left? A flat vector look, thin even lines, airbrushed gradients or a 3D render = no.
2. **Reads small?** In the 48 px copy, can you tell what it is and how it differs from its siblings?
3. **One idea?** Exactly one clear subject, nothing extra: no second prop, no scenery, no letters.
4. **Clean edge?** No pink or magenta fringe, no glow haze, nothing cut off at the canvas edge.

Any "no": regenerate with the same prompt plus one short sentence naming the fix ("Thicker outlines like
the reference." / "Simpler shape, fewer small parts."), up to 3 tries in all. Then keep the best and mark it
`weak` in your table with the reason. `art-src/review/` is never committed (it is in `.gitignore`).

## Agent prompt (paste this, then the agent's batch line)
```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You paint ONE batch of
images, named at the bottom. You write no game code (W2-B adds one line to SHEETS, as its file says).
Six other agents are painting other batches on the same branch right now.

SETUP
  git fetch origin art/generated-wave-2:refs/remotes/origin/art/generated-wave-2
  (Name the branch: a plain "git fetch origin" may only fetch main.)
  If you can switch branches:   git checkout -B art/generated-wave-2 origin/art/generated-wave-2
  If your session is locked to its own branch (arena/…): stay on it and bring the wave in:
                                git merge --no-edit origin/art/generated-wave-2
  Either way, docs/tickets/art/wave-2/README.md must now exist. If it does not, stop and report.
  npm ci   (only if node_modules is missing)
  Read, in this order: docs/tickets/art/wave-2/README.md (binding: art direction, depth maps, the
  review loop, who owns which shared file), your batch file (its "Where these are seen" notes are the
  brief), docs/ART_PIPELINE.md §3 and §10.
  Paint only the images of YOUR batch.

FOR EACH IMAGE, in the batch file's order
  1. Generate it with the prompt given for that image, copied exactly (add nothing), passing the
     image's Reference file(s) as the image input on every try.
  2. Save the raw as PNG at the batch's raw path. A JPEG result: convert in.jpg -depth 8 <raw path>
  3. Run the Process command. It must print PASS (or the WARN your batch file says to expect).
     On FAIL: regenerate with the failing QA note appended to the prompt.
  4. Run the review loop from the README and answer its four questions. Any "no": regenerate with one
     short sentence naming the fix appended. At most 3 tries per image in all; then keep the best and
     mark it weak or failed in your table with the reason.
  5. If the image has a Depth map: do the README's depth-map steps now.
  6. Every 10 images: stage ONLY your own files (git add <paths>, never git add -A or git add .),
     commit ("art(<batch>): images <a>-<b>"), then push:
       on art/generated-wave-2:  git pull --rebase origin art/generated-wave-2 && git push origin HEAD:art/generated-wave-2
       on your own arena/… branch: git push origin HEAD   (the owner's session merges it into the wave)
     If the push is rejected, pull --rebase again and retry. A rebase conflict can only be in
     painted-parts.generated.ts: fix it with the rule in "Who owns which shared file".
     Say in every report which branch you pushed to.
     Then post a PR comment "<batch>: images <a>-<b> pushed" with those rows of the results table.
     Do not edit the PR description. (No PR access: put the rows in the commit message body.)
  At most 10 generated images per turn: when you reach it, push, then output
  "[pause for turns to reset]" and stop until the user says "Reset".

WHEN THE BATCH IS DONE
  npm run check:edges            (0 failures)
  node --import tsx --test tests/art-budget.test.ts
  Push (as in step 6), then post a final PR comment "<batch> done" with the table:
    # | id | status (pass / warn / weak / failed) | output path | depth map (pass / — ) | notes
  and end your reply with the same table.
  Do not merge. Do not edit game code. Do not touch backups/. Never commit art-src/review/.

YOUR BATCH:
```

The line to append, per agent:
- Agent 1: `W2-A1 — docs/tickets/art/wave-2/W2-A1-goblin-parts-3a.md (images 1–12, 5 depth maps)`
- Agent 2: `W2-A2 — docs/tickets/art/wave-2/W2-A2-goblin-parts-3b.md (images 1–12, 3 depth maps)`
- Agent 3: `W2-B — docs/tickets/art/wave-2/W2-B-cockpit-and-gameplay.md (images 2–14; image 1 dropped)`
- Agent 4: `W2-C — docs/tickets/art/wave-2/W2-C-garage-decals-2.md (images 1–16)`
- Agent 5: `W2-D — docs/tickets/art/wave-2/W2-D-goblin-base-and-gauges.md (images 1–12, 1 depth map)`
- Agent 6: `W2-E — docs/tickets/art/wave-2/W2-E-builder-icons.md (images 1–17)`
- Agent 7: `W2-F — docs/tickets/art/wave-2/W2-F-depth-maps-wave-1.md (14 depth maps)`

## Pipeline notes (lessons from wave 1)
- **`key-art.ts` runs the edge repair itself**, last. Never run `scripts/fix-edge-magenta.mjs` by hand after
  keying, and never re-key after a repair.
- Tileable band decals (`pattern-*`) come out as WARN "tileable band", which is expected.
- Keyed sets: `avatar-parts` (512), `garage-decals` (256), `cockpit` (1024), `cockpit-trinkets` (256),
  `ui-icons` (256).
- Animated sheets: **no dark-panel template**. Pure magenta cells and gutters; if you need an image input,
  a plain 1024² #FF00FF sheet. Drift warnings are accepted for effects and moving characters.
- `public/` is ~544 MB of its 600 MB budget; this wave adds roughly 16 MB (depth masks are tiny).

## Who owns which shared file
| File | Written by | Rule |
|---|---|---|
| `src/game/meta/painted-parts.generated.ts` | W2-A1, W2-A2, W2-D (through `key-art.ts`) | Never hand-edit. On a rebase conflict, take either side, then run `node --import tsx scripts/key-art.ts --set avatar-parts` (no `--only`), `git add` it and continue. |
| `scripts/process-generated-animated.mjs` (`SHEETS`) | W2-B only | Nobody else touches it. |
| `public/avatar-parts/keyed/*` from wave 1 | nobody | W2-F only reads them. |

Depth masks need no manifest in this wave: the integration ticket registers every file in
`public/avatar-parts/depth/` after the PR, so agents never share a list.
