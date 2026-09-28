# Decoration painting & auto-decorate (NewDecor)

Paint decorations onto the mountain with a brush, or let six adjustable rules read the road and dress
it for you. Everything lands as ordinary `PlacedProp`s in the builder's document — same undo, same save,
same gizmo — tagged so a batch can be selected, cleared or re-rolled as one.

Files: `src/game/decor/` (pure rules + the three.js tool), `src/components/DecorPanel.tsx` (the UI),
`tests/decor.test.ts` (headless laws). Integration is three small hunks in `track-builder-3d.ts`.

## Why track space

The rules work in `(s, lateral)` — arc-length along the centreline and signed distance from it — using
the samples the renderer already has (`halfWidth`, `turnRate`, `stage`, `onBridge`, `inLoop`). That
makes the clever bits one comparison each:

| Rule | What it reads | What it does |
|---|---|---|
| **Verge line** | `halfWidth`, `turnRate` | Props along both edges at a spacing with jitter; thins the *inside* of tight bends so the line stays readable. |
| **Grove scatter** | `stage`, distance from edge | Fills a band beside the road; 3-octave clump noise makes groves and clearings; density falls off with distance; far-zone kinds drift outward, verge kinds hug the edge. |
| **Rhythm** | `halfWidth` | Lanterns/torches/flags at an exact period; mirrored pairs or alternating; phase slides the beat. |
| **Corner dressing** | `turnRate` sign & magnitude | Finds bends above a threshold, puts barricades/rock on the **outside** (where you'd fly off), more of them the tighter the bend, and a warning sign a set lead-in before the apex on the driver's right. |
| **Crowd** | span position | Rows of goblins facing the road, sparse at the start of the span and packed at the end (the finish). |
| **Landmark cadence** | — | One big silhouette every N units, alternating sides, far out, never two within a clearance. |

A **Theme** composes these per stage (alpine forest + verge + corners + lanterns; canyon rock + scaffolds;
mine glowcaps + torches every 1400; stadium crowd + flags) behind one *intensity* knob that scales
densities up and spacings down.

Every rule declares its parameters as a schema, so the panel's sliders come from the rule itself and a
theme step is just a saved set of numbers. Every rule is seeded: same span, same numbers, same seed →
the same forest. *Re-roll* changes only the seed.

### Guarantees (asserted in `tests/decor.test.ts`)

- Nothing stands on the road: `|lateral| ≥ halfWidth + footprint·scale/2`.
- Nothing overlaps: every candidate is tested against a hash grid of what already stands — including
  hand-placed props, which are projected into track space first.
- Bridges and loops stay bare; the stage filter holds; the budget caps a run exactly.
- Corners: dressing is on the outside, the sign is before the apex, straights are untouched.
- Rhythm: props at exact multiples of the period at the exact edge offset.
- The brush is idempotent per circle (stamps are seeded from their position), and the eraser with
  *auto-only* leaves hand-placed decorations standing.

## The brush

Enable it in the panel (or `builder.decor.setEnabled(true)`). Drag on the ground: every *flow* units a
stamp scatters *density* props inside the circle from the chosen palette, sized by *size variety*, spaced
by *spacing* × footprint. The circle is projected into track space around the hit, so the stamp knows
where the road is (toggle *allow on road* for crowds on a start straight). Each site is dropped onto the
terrain with a downward ray against the course's scenery; with nothing under it, it keeps the road plane.

*Erase* removes decorations in the circle; *auto-placed only* protects anything without a `decor` tag.

One stroke = one undo step (`applyDecorBatch(..., coalesce = true)` for the later stamps).

## Where decorations go

- `type` is a catalogued kind (`decor-catalog.ts`: 30 of the builder's props with footprint, zone,
  scale range, face-the-road, mirror, stage affinity, animated twin). Ramps, slingshots, start lines
  and race marks are not kinds, so they can never be sprayed.
- `decor: { rule, batch, seed }` and `groupId: decor_<batch>`, so the builder's group-select picks a
  whole run with one click; `trackDist` is the site's `s`.
- Saved through the normal `writeStorage` path; the tag is an unknown field, preserved by v2.

## Wiring

`track-builder-3d.ts` gains `applyDecorBatch()`, a public `decor` field built in `initGizmo()`, and
disposal. Mount the panel as a builder tab: `<DecorPanel tool={builder.decor!} />`. Off the island and
with no canvas (headless), `decor` stays `null`.

## Tuning notes

- `corners.threshold` default `0.00018 rad/u` marks the zigzag hairpins and the canyon lip; raise it
  to dress only hairpins.
- `scatter.clump = 1` is all-or-nothing groves; `0.6` reads as a natural treeline.
- The theme's landmark cadence is 5000 u — roughly one silhouette per screen at race speed.
- Budgets: a single rule stops at 600 props, a theme at 1500. The whole mountain themed at intensity 1
  is ~900 props; the builder's sprite path handles that, but check `data-render-fps` on Performance mode.
