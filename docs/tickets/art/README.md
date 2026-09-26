# Art wave 1: generated PNGs (one PR, four agents at once)

All generated art for this wave lands in **one pull request**, on the branch `art/generated-wave-1`
(base: `fix/flash-followups`). **Four Codex agents work at the same time**, one batch each, all
pushing to that one branch (the PR updates itself). Every agent adds only its own files, pulls with
rebase before each push, and reports in a PR **comment**, never by editing the PR description (four
agents would overwrite each other). The owner ticks the checklist from the comments.

| Agent | Batch | Images | Lands in |
|---|---|---|---|
| 1 | [ART-B1](ART-B1-avatar-parts-1.md): painted goblin parts, part 1 | 30 | `art-src/avatar-parts/raw/` → `public/avatar-parts/keyed/` |
| 2 | [ART-B2](ART-B2-avatar-parts-2-garage.md): painted goblin parts, part 2, and the Ball Garage | 26 | avatar parts + `art-src/garage-decals/raw/` → `public/art/garage/` |
| 3 | [ART-B3a](ART-B3-track-and-effects.md): track textures, obstacle and barrier sprites, shield bubble (images 1–12 and 22) | 13 | `art-src/track/raw/` → `public/art/track-obstacles/` |
| 4 | [ART-B3b](ART-B3-track-and-effects.md): animated race effects (images 13–21) | 9 | `art-src/animated/` → `public/art/animated/alpha/` |

ART-B3b has only 9 images because every effect sheet has to pass the §10.4 gates, which usually
takes several regenerations.

### Who owns which shared file
Image files never collide: every id belongs to one batch. Three files are shared:

| File | Written by | Rule |
|---|---|---|
| `src/game/meta/painted-parts.generated.ts` | ART-B1 and ART-B2 (through `key-art.ts`) | Never edit it by hand. On a rebase conflict, take either side, then run `node --import tsx scripts/key-art.ts --set avatar-parts` (no `--only`): it re-keys every raw on the branch and rebuilds the manifest. `git add` it and continue the rebase. |
| `scripts/process-generated-animated.mjs` (the `SHEETS` list) | ART-B3b only | Nobody else touches it. |
| `art-src/animated/fx-template-2x2.png` | ART-B3b only | Nobody else touches it. |

Art batches only add image files (and the regenerated `src/game/meta/painted-parts.generated.ts`).
Wiring the art into the game is done by the coding tickets after the PR is merged:
[ART-I1](ART-I1-painted-parts-dna-v3.md), [ART-I2](ART-I2-garage-art.md), [ART-I3](ART-I3-track-art.md).

---

## Part A: the prompt for every art agent (paste this, then the batch line)

```
You are a Codex art agent on Heavy Metal GP 2 (repo Piskriek/HeavyMetal2). You generate ONE batch
of images, named at the bottom. You write no game code.

Three other agents are generating other batches on the same branch at the same time.

SETUP
  git fetch origin
  git checkout art/generated-wave-1 && git pull --rebase
  npm ci   (only if node_modules is missing)
  Read: docs/tickets/art/README.md (this file: the rules below are binding, including "Who owns
        which shared file"), your batch file, docs/ART_PIPELINE.md §3 and §10 (keying rules;
        animated 2x2 sheet rules).
  Generate only the images of YOUR batch (ART-B3a and ART-B3b: only your image numbers).

FOR EACH IMAGE IN YOUR BATCH, in order
  1. Generate it with the prompt given for that image (copy it exactly; add nothing).
     Animated sheets: first run `node scripts/build-anim-reference.mjs <name>` (or build a 2x2
     template with wide pure #FF00FF gutters) and pass the template as the image input.
  2. Save the raw output as PNG at the "Raw" path. If the generator returned a JPEG, convert it:
     convert in.jpg -depth 8 <raw path>
  3. Process it with the "Process" command. It must print PASS (or WARN with a note you accept).
     On FAIL: regenerate with the failing QA note appended to the prompt, up to 3 times; then
     move on and list it as failed in the PR.
  4. Every 10 images (ART-B3b: every 3 sheets): stage ONLY your own files (git add <paths>, never
     git add -A or git add .), commit ("art(<batch>): images <a>-<b>"), then
       git pull --rebase && git push
     If the push is rejected, pull --rebase again and retry. A rebase conflict can only be in
     painted-parts.generated.ts: fix it with the rule in "Who owns which shared file".
     Then post a PR comment "<batch>: images <a>-<b> pushed" with those rows of the results table
     below. Do not edit the PR description.
     (If you cannot comment on the PR, put those rows in the commit message body instead.)
     If you hit the 10-images-per-turn limit, push first, then output "[pause for turns to reset]"
     and stop until the user says "Reset".

WHEN THE BATCH IS DONE
  npm run check:edges            (0 failures)
  node --import tsx --test tests/art-budget.test.ts
  Push (pull --rebase first), then post a final PR comment "<batch> done" with the table:
    # | id | status (pass / warn / failed) | output path | notes
  and end your reply with the same table.
  Do not merge. Do not edit game code. Do not touch backups/.

YOUR BATCH:
```

Then append the line for that agent:

- Agent 1: `ART-B1 — docs/tickets/art/ART-B1-avatar-parts-1.md (images 1–30)`
- Agent 2: `ART-B2 — docs/tickets/art/ART-B2-avatar-parts-2-garage.md (images 1–26)`
- Agent 3: `ART-B3a — docs/tickets/art/ART-B3-track-and-effects.md (images 1–12 and 22 only)`
- Agent 4: `ART-B3b — docs/tickets/art/ART-B3-track-and-effects.md (images 13–21 only)`

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
