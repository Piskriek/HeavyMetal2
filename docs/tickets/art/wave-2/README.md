# Art wave 2: the rest of the game's missing art (one PR, six agents at once)

Wave 2 lands on the branch **`art/generated-wave-2`**, which starts from `art/generated-wave-1` (so the
wave-1 manifest is already there). Open the PR with base `art/generated-wave-1`. Six Codex agents work
at the same time, exactly like wave 1: read the **wave-1 README's Part A** (`docs/tickets/art/README.md`),
which is binding here too, with the branch name changed to `art/generated-wave-2`.

| Agent | Batch | Images | Lands in |
|---|---|---|---|
| 1 | [W2-A1](W2-A1-goblin-parts-3a.md): goblin parts 3a (eyes, eyewear, hair, headgear, a mouth) | 12 | `public/avatar-parts/keyed/` |
| 2 | [W2-A2](W2-A2-goblin-parts-3b.md): goblin parts 3b (mouths, necks, noses, ears, war paint) | 12 | `public/avatar-parts/keyed/` |
| 3 | [W2-B](W2-B-cockpit-and-gameplay.md): cockpit plate, glass grime and cracks, dashboard trinkets, rope-reel goblin, a builder icon | 15 | `public/art/cockpit/`, `public/art/animated/alpha/`, `public/art/ui/icons/` |
| 4 | [W2-C](W2-C-garage-decals-2.md): Ball Garage decal pack 2 | 16 | `public/art/garage/decals/` |
| 5 | [W2-D](W2-D-goblin-base-and-gauges.md): the last vector goblin parts (heads, war paint, goggles up) and painted gauge needles | 12 | `public/avatar-parts/keyed/`, `public/art/cockpit/`, `public/art/ui/icons/` |
| 6 | [W2-E](W2-E-builder-icons.md): painted builder shelf icons | 16 | `public/art/ui/icons/` |

**Rule from the owner: no vector-style art may remain.** W2-D and W2-E replace the last SVG-drawn art.

With wave 1 this takes the creator to 61 painted parts (the plan's ~60).

## What changed since wave 1 (lessons from the agents)
- **`key-art.ts` now runs the edge repair itself**, last. Never run `scripts/fix-edge-magenta.mjs` by hand
  after keying, and never re-key after a repair: the key script does both, in the right order.
- Tileable band decals (`pattern-*`) no longer fail on "touches the border": they come out as WARN
  "tileable band", which is expected.
- New keyed sets: `cockpit` (1024 masters), `cockpit-trinkets` (256), `ui-icons` (256).
- Animated sheets: **no dark-panel template**. Prompt for pure magenta cells and gutters; if you need an
  image input, a plain 1024² #FF00FF sheet. Drift warnings are accepted for effects and moving characters.
- `public/` is ~544 MB of its 600 MB budget; this wave adds roughly 15 MB.
- If your session can only push to its own branch, push there and say so in your report; the owner's
  session merges it in.

## Who owns which shared file
| File | Written by | Rule |
|---|---|---|
| `src/game/meta/painted-parts.generated.ts` | W2-A1, W2-A2, W2-D | Never hand-edit. On a rebase conflict, take either side, then run `node --import tsx scripts/key-art.ts --set avatar-parts` (no `--only`). |
| `scripts/process-generated-animated.mjs` (`SHEETS`) | W2-B only | Nobody else touches it. |

## The line to append to Part A, per agent
- Agent 1: `W2-A1 — docs/tickets/art/wave-2/W2-A1-goblin-parts-3a.md (images 1–12) — branch art/generated-wave-2`
- Agent 2: `W2-A2 — docs/tickets/art/wave-2/W2-A2-goblin-parts-3b.md (images 1–12) — branch art/generated-wave-2`
- Agent 3: `W2-B — docs/tickets/art/wave-2/W2-B-cockpit-and-gameplay.md (images 1–15) — branch art/generated-wave-2`
- Agent 4: `W2-C — docs/tickets/art/wave-2/W2-C-garage-decals-2.md (images 1–16) — branch art/generated-wave-2`
- Agent 5: `W2-D — docs/tickets/art/wave-2/W2-D-goblin-base-and-gauges.md (images 1–12) — branch art/generated-wave-2`
- Agent 6: `W2-E — docs/tickets/art/wave-2/W2-E-builder-icons.md (images 1–16) — branch art/generated-wave-2`
