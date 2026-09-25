# Art wave 1: generated PNGs (one PR, one agent at a time)

All generated art for this wave lands in **one pull request**, on the branch `art/generated-wave-1`
(base: `fix/flash-followups`). Codex agents run **one after another**, one batch each. Every agent
checks out the same branch, generates its batch, keys and QA-checks it, pushes to the branch (the PR
updates itself), ticks its boxes in the PR checklist, and stops. Then the next agent starts.

| Order | Batch | Images | Lands in |
|---|---|---|---|
| 1 | [ART-B1](ART-B1-avatar-parts-1.md): painted goblin parts, part 1 | 30 | `art-src/avatar-parts/raw/` → `public/avatar-parts/keyed/` |
| 2 | [ART-B2](ART-B2-avatar-parts-2-garage.md): painted goblin parts, part 2, and the Ball Garage | 26 | avatar parts + `art-src/garage-decals/raw/` → `public/art/garage/` |
| 3 | [ART-B3](ART-B3-track-and-effects.md): track obstacles, boost pads, barriers, race effects | 22 | `art-src/track/raw/`, `art-src/animated/` → `public/art/track-obstacles/`, `public/art/animated/alpha/` |

Art batches only add image files (and the regenerated `src/game/meta/painted-parts.generated.ts`).
Wiring the art into the game is done by the coding tickets after the PR is merged:
[ART-I1](ART-I1-painted-parts-dna-v3.md), [ART-I2](ART-I2-garage-art.md), [ART-I3](ART-I3-track-art.md).

---

## Part A: the prompt for every art agent (paste this, then the batch line)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You generate ONE batch
of images, named at the bottom. You write no game code.

SETUP
  git fetch origin
  git checkout art/generated-wave-1 && git pull
  npm ci   (only if node_modules is missing)
  Read: docs/tickets/art/README.md (this file: the rules below are binding), your batch file,
        docs/ART_PIPELINE.md §3 and §10 (keying rules; animated 2x2 sheet rules).

FOR EACH IMAGE IN YOUR BATCH, in order
  1. Generate it with the prompt given for that image (copy it exactly; add nothing).
     Animated sheets: first run `node scripts/build-anim-reference.mjs <name>` (or build a 2x2
     template with wide pure #FF00FF gutters) and pass the template as the image input.
  2. Save the raw output as PNG at the "Raw" path. If the generator returned a JPEG, convert it:
     convert in.jpg -depth 8 <raw path>
  3. Process it with the "Process" command. It must print PASS (or WARN with a note you accept).
     On FAIL: regenerate with the failing QA note appended to the prompt, up to 3 times; then
     move on and list it as failed in the PR.
  4. Every 10 images: commit ("art(B<n>): images <a>-<b>"), push, and tick those boxes in the PR
     description. If you hit the 10-images-per-turn limit, push first, then output
     "[pause for turns to reset]" and stop until the user says "Reset".

WHEN THE BATCH IS DONE
  npm run check:edges            (0 failures)
  node --import tsx --test tests/art-budget.test.ts
  Push, tick the batch's last box in the PR, and finish with a table:
    # | id | status (pass / warn / failed) | output path | notes
  Do not merge. Do not edit game code. Do not touch backups/.

YOUR BATCH:
```

Then append one line, for example: `ART-B1 — docs/tickets/art/ART-B1-avatar-parts-1.md`.

---

## Style bible (already written into every prompt)

- **Look:** hand-painted, cel-shaded fantasy illustration in the style of a Blizzard/Warcraft goblin
  world. Thick dark brown-black outlines, chunky readable shapes, warm rim light from the upper left,
  soft painted shading. Scrappy goblin engineering: brass, riveted iron, oily leather, soot.
- **Palette channels** (the avatar tint masks depend on these, ART-I1): skin is flat toxic green in
  the `#7fb24a` family; leather is dark brown; metal is brass or steel; accents are a neutral red.
- **Keyed art** (everything with a transparent result): the background is **perfectly flat, solid
  pure magenta `#FF00FF` filling the whole image edge to edge**. No gradient, shadow, floor, vignette
  or texture. The subject contains **no pink, purple or magenta at all** (it would key out). No text,
  no watermark, nothing else in frame.
- **Full-bleed art** (textures, backdrops) has no magenta and fills the frame.
- **Never** ask for alpha directly; generators fake it. Magenta is keyed by `scripts/key-art.ts`.

## Output rules

| Kind | Raw (committed, never shipped) | Runtime output (shipped) | Process |
|---|---|---|---|
| Avatar part | `art-src/avatar-parts/raw/<id>.png` | `public/avatar-parts/keyed/<id>.png` (≤ 512 px) | `node --import tsx scripts/key-art.ts --set avatar-parts --only <id>` |
| Garage decal / UI sprite | `art-src/garage-decals/raw/<id>.png` | `public/art/garage/decals/<id>.png` (≤ 256 px) | `node --import tsx scripts/key-art.ts --set garage-decals --only <id>` |
| Track sprite | `art-src/track/raw/<id>.png` | `public/art/track-obstacles/<id>.png` (≤ 512 px) | `node --import tsx scripts/key-art.ts --set track-sprites --only <id>` |
| Animated 2x2 sheet | `art-src/animated/<name>-src.png` | `public/art/animated/alpha/<name>.png` | `node scripts/process-generated-animated.mjs <name>` then the §10.4 gates |
| Full-bleed texture / backdrop | `art-src/<set>/raw/<id>.png` | the "Output" path in the batch, resized as stated | `convert <raw> -resize <size> <output>` |

Raws go in `art-src/` so they never count against the shipped-art budget (`tests/art-budget.test.ts`).
