# Auto-paint: the easy surface passes (AutoPaint)

One click dresses the road: asphalt down the carriageway, gravel on the shoulders, scree on the outside
of every bend, worn ruts at the tyre lines, repairs scattered along the span, lane markings where they
help and none where they'd lie. Built the same way as the auto-decorate rules — parameter schemas, one
seed, honest previews — except these write **surface mask texels** instead of placing props.

Files: `src/game/surface/paint-rules.ts` (the rules), `src/game/surface/auto-paint.ts` (runner, jobs,
undo, presets), `src/components/AutoPaintPanel.tsx` (UI), `tests/auto-paint.test.ts`.
**Depends on NewRoads.patch** (the mask, `RoadMask`, `RoadSurfacePaint`); independent of NewDecor/NewSculpt.

## Why it can afford to be clever

The road mask is 16 texels across and one row per 60 units along, keyed by arc-length (`RoadMask`). So a
pass over the whole 120 km mountain is ~2 000 rows × 16 columns = 32 000 texel writes — a few
milliseconds, no GPU work, one dirty-rect upload on the next frame. Rules therefore read the road
directly, in track space:

| Rule | Reads | Does |
|---|---|---|
| **Carriageway** | `halfWidth` | A band of one surface down the middle, feathered at the edges, wobbling off a ruler line. Bridges and loops can be spared. |
| **Shoulders & verge** | `halfWidth` | A loose band on both sides, tapering into the road so there is no hard paint line. |
| **Corner scree** | `turnRate` (and ahead) | Puts the loose surface on the **outside** of the bend, wider the tighter it is, and starts the wash on the approach so you meet it before the apex. |
| **Worn ruts** | lane geometry | Two tracks per lane at the tyre lines, broken up by noise. The cheapest thing that makes a big fill look driven on. |
| **Repair patches** | — | Seeded blobs from a noise field: contiguous, tapering patches, no run bookkeeping. |
| **Lane markings** | `turnRate`, `stage` | Sets the flag byte per row: dashes on straights, **none in tight bends** (they'd read as a lie at speed), double + edge lines near the stadium. |
| **Stage theme** | `stage` | One pass that dresses every stage from a table (alpine asphalt, canyon/zigzag dirt, cavern rock, mine planks, stadium cobbles), including ruts and markings. |

Road lines are **off by default** (`AutoPaint.lines`): the Markings rule does nothing, presets skip their markings step and the stage theme adds none until a course switches them on.

Presets compose them: **Asphalt highway · Rally stage · Stadium circuit · Mine works · Dirt & wear only**.

## The three properties that make it safe to hammer

1. **Order-independent.** A rule's look comes from noise over `s` and a `seed` parameter — never a stream
   it consumes — and it writes only the row it is handed. Painting the same span twice therefore changes
   **nothing** the second time (asserted), so live sliders, re-running after an edit, and repeated clicks
   are all free.
2. **The preview is the real code.** `preview: true` runs the identical rules on a scratch copy of the
   mask, so "N rows would change" and the coverage bar are measured, not estimated. There is no second
   implementation to drift out of sync.
3. **Coverage is integrated, not sampled.** A texel takes the *fraction of its own width* the band covers.
   At 60 world units a column, a centre-sampled 40-unit rut would flicker between "full" and "missing"
   depending on where it landed; integrating means thin features paint softly and every pass is stable.

## Undo, jobs, factory reset

* Every pass records a **job** `{ rule, params, span, label }` and an undo entry holding one rectangle
  snapshot of the mask (ten deep, `PAINT_UNDO_DEPTH`). `undo()` puts the bytes back *and* truncates the
  job list, so the two can never disagree.
* A preset is one undo step (a batch), not five.
* **Reset to factory** clears the mask but keeps the cleared jobs, so undo returns the whole paint job —
  including the ability to re-run it.
* Jobs are saved inside the road-mask document (`jobs`, an unknown field the v2 validator preserves). A
  track therefore loads dressed *and* remembers how it got that way: **Re-run N jobs** rebuilds the paint
  over a road that has changed underneath it. Asserted: replaying recorded jobs on a blank mask
  reproduces the exact mask hash.

Persist the mask, never a bake (plan §3.2) — these rules only ever write the mask.

## Keys (with the brush, `?paint=1`)

`A` carriageway · `T` stage theme · `R` shoulders · `Q` undo the last auto pass, all with the surface
currently selected on the palette (`0–9`). The panel exposes every parameter, the presets, the span
(whole road / this stage / around the camera), the preview, and the coverage bar.

## Mounting

```tsx
import { AutoPaintPanel } from '../components/AutoPaintPanel';
{renderer.surfacePaint && <AutoPaintPanel paint={renderer.surfacePaint} locate={() => ({ s: playerS, stage: playerStage })} />}
```
`locate` is optional — it only enables the "this stage" and "around the camera" spans; without them the
panel paints the whole road.

## Deliberate limits

* Rules target the **road mask** only. Terrain/prop masks (plan §3.1 tiers) keep the brush; a rule for
  them is a `PaintField` with a triplanar `infoAt`, which is a small adapter away.
* A row is 60 units, so a feature shorter than that snaps to a row. The shader's bilinear weight blend
  hides this across rows; nothing tries to hide it along them.
* `shoulders` and the brush's locked shoulder columns are independent: the rule paints whatever width it
  is told, and the hand brush keeps protecting columns 0/15 unless Shift.
* Presets are tuned for the four-lane, 960-wide road. `width` parameters are fractions of the local
  half-width, so a narrower custom course still reads proportionally.

## On the island

The island has no road ribbon: its road is part of the terrain model. So the island ground uses the same
layered mask format (two IDs + a weight per texel, 2048² over the island square) and the road's paint is
laid onto it:

* `IslandGround.autoPaint` runs these rules on the island road's own `RoadMask` (along `islandTrackSpace()`),
  exactly as on a course. Jobs save inside the ground document (version 2, `road`), so **Re-run** works
  after the route changes (a mask that no longer fits the route is rebuilt by replaying its jobs).
* `island-road-paint.ts` lays that mask onto the ground. The **footprint** (which ground texel shows which
  road texel) is built once when the terrain's heights arrive, behind the loading bar; a texel is only
  in it when the terrain meets the road within 400 units, so a bridge deck never paints the valley below.
  A preset on the whole island road is ~0.1 s.
* The ground shows `hand` (the brush) with the road composed over it by the same share-raising law, so
  undoing an auto pass never touches brush paint and the other way round.
* ID 0 is the bare island; `SURFACE_CRACKED` (10) is the island's own procedural dirt (the old dirt brush;
  version-1 saves migrate to it); every other ID is an atlas tile.

## One sampler for both grounds

`surface/surface-shader.ts` is the GLSL both the road ribbon and the island terrain use: a four-tap mask
read whose weight blends across texel edges (a solid texel borrows its neighbour's surface, so edges fade
instead of stepping), and two `textureGrad` atlas taps: a solid texel spends them on non-repeating
two-offset variation, a mixed one on its two surfaces. The atlas cells are padded with their own wrapped
edges and mipmapped; gradients are clamped to the mip the padding holds. On steep island faces the tiles
are projected from the side.
