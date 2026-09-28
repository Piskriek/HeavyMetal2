# Surface Paint & Roads (NewRoads) — Phase 0 answers and what was built

This is the Phase 0 deliverable from *Surface Paint & Roads: Plan v2*, followed by the vertical slice
(Phase 1), roads as a first-class object (Phase 2), the storage and physics hooks (Phases 3–4) and the
polish that came for free (Phase 5). Everything lives under `src/game/surface/` and is asserted by
`tests/surface-paint.test.ts`.

## Phase 0 — the six answers

| # | Question | Answer from the code | Branch taken |
|---|---|---|---|
| **Q1** | Do build objects have usable UVs? | The road is swept by `sweepProfile` (`renderer-3d.ts`) with `uv = (across-length / 480, dist / 480)`: continuous, but in world units and shared with walls/verges. Props are arbitrary. | **Roads get authored UVs regardless** (§2.1): the paint ribbon carries `(u 0‥1 across, s along)`. Generic props → triplanar later (Phase 3, not started). |
| **Q2** | Texture-based or procedural dirt? | Texture. `MeshStandardMaterial({ map: /textures/dirt.png })` — painted PNG tiles, no noise. Three surfaces the plan wants (asphalt, gravel, concrete) have no PNG. | `sampleSurface(id)` = one atlas lookup. PNG surfaces are copied into the atlas; the missing three are **generated once on a canvas** into the same atlas. |
| **Q3** | How many paintable objects on screen? | One road, ~120 000 units long, built as one mesh per stage run (7 stages) that share materials with the walls. Hundreds of props. | **No bake.** The road mask is 16 × ~2 000 texels (≈130 KB live, a few KB saved). One shared material for the whole overlay. |
| **Q4** | Save format supports blobs? | `track-storage.ts`: JSON `TrackDocV2` in localStorage, **unknown fields preserved**. | **Embed** (`surfacePaint` field via `attachToTrackDoc`) + a per-course sidecar key (`hm2-surface-paint-v1:<course>`) that works today without touching the builder's save path. |
| **Q5** | Surface affects physics? | Vehicle game with `rolling-resistance.ts` already bounded and pure. | **Yes.** Mask is CPU-resident; `RoadSurfacePaint.surfaceIdAt(s, laneZ)` is O(1); `applyRollingEffects` takes a surface multiplier. |
| **Q6** | Render API? | three.js WebGL; WebGL2 detected at runtime (`ballPool` is null on WebGL1). No compute. | **CPU paint, one `needsUpdate` upload per painted frame.** Shader via `onBeforeCompile`; GLSL ES 1.0-compatible (no bitwise ops, no dynamic uniform arrays). |

### One decision the plan left open: overlay, not in-place

The plan's §1.2 edits "the existing shader". Here the road's material is shared with the walls of its
stage, so an in-place edit would paint the cliffs. `lane-paint.ts` already solved this for lane lines with
a lifted ribbon and its own material; `road-surface-paint.ts` does the same for surfaces, **transparent
wherever surface 0 dominates**. Result: an unpainted course is pixel-identical to today, and painted asphalt
blends into the dirt underneath through the mask weight rather than a mesh seam.

## What was built (by plan section)

| Plan | File | Notes |
|---|---|---|
| §1.1 mask = `{id0, id1, weight, flags}` | `surface-mask.ts` | 256 IDs, two samples per pixel, dominant ID readable on the CPU. Dirty rect, rect snapshots, RLE + base64, FNV-1a hash. |
| §1.2 `sampleSurface(id)` + 2-way blend | `road-surface-paint.ts`, `surface-atlas.ts` | Albedo and roughness are blended; alpha = 1 − share of surface 0; discard below 0.4 %. Weight is bilinear over the four nearest texels, IDs never interpolate. Normal blending (RNM/UDN) waits for tiles with normal maps. |
| §1.3 CPU brush | `surface-paint-tool.ts` | Raycast → `intersection.uv` **is** the mask coordinate. Brush rule per texel exactly as specified; `Shift` overrides the shoulder lock. |
| §2.1 authored UVs + curb bevel | `buildRoadPaintChunks` | `[curb \| road \| curb]`, two extra columns per edge lifted 2 units. Chunked every 48 rows for frustum culling. |
| §2.2 1D-ish mask, shoulders | `road-mask.ts` | 16 across (4 lanes, see file header), one row per 60 units. Column 0 and 15 lock to gravel. |
| §2.3 markings / wear / wetness / dust | shader in `road-surface-paint.ts` | Markings are procedural (cheaper than the plan's strip texture): flags bit 0 lane dashes, bit 1 double centre, bit 2 edge lines. Wear = two gaussians per lane. `setWeather(wet, dust)`. Intersections: n/a — one centreline (the island's branches are out of scope for this slice). |
| §3.2 persist the mask | `surface-storage.ts` | Content-hashed writes skip when unchanged; masks for a different track length are refused, not stretched. |
| §3.3 bake | — | Not built, by design (opt-in only when profiling says so). |
| §4 surface table + physics | `surface-table.ts`, `rolling-resistance.ts` | `{ id → grip, rollingResistance, dustFX, tireSound }`. `applyRollingEffects(…, surfaceRolling = 1)`: default is the legacy behaviour. |
| §5 undo, ring cursor, palette, micro-variation | tool + shader | Undo = per-stroke list of pre-stamp rectangles. Per-97-unit hash on albedo. Texture array with mips remains Phase 5. |

## Using it

1. Start a race with `?paint=1` in the URL (same pattern as `?fp=1`). A hint box lists the keys.
2. `1` selects asphalt; drag on the road. `[`/`]` radius, `M` cycles markings under the cursor, `G` lays
   gravel shoulders end-to-end, `Z` undoes, `X` clears. Autosave runs 1.5 s after each stroke.
3. Reload: the mask comes back from `hm2-surface-paint-v1:<courseId>`.
4. From the builder (later): `renderer.surfacePaintTool?.setEnabled(true)`; on save call
   `attachToTrackDoc(doc, courseId, renderer.surfacePaint.mask)`; on load use `roadMaskFromTrackDoc`.

## Wiring the physics (one line, where the sim calls `applyRollingEffects`)

```ts
const id = renderer.surfacePaint?.surfaceIdAt(s, laneZ) ?? 0; // or a headless RoadMask from storage
applyRollingEffects(v, mass, grounded, dt, state, surfaceRollingResistance(id));
```

The sim is headless; it should hold its own `RoadMask` (from `readRoadMask`) rather than reach into the
renderer. `surfaceGrip(id)` is provided for lateral/steering code the same way.

## Exit criteria (§1.4) — how to check

- Paint asphalt on the alpine descent, drive on it: asphalt with tyre-track wear, edge blending into dirt
  through the weight, no seam. `data-render-fps` unchanged (one extra draw per visible chunk; the
  fragment cost is two atlas taps + five mask taps).
- `npm run check` includes `tests/surface-paint.test.ts`: brush law, shoulder lock, RLE round trip, undo
  rectangle, ribbon-on-frame, physics readback, rolling-resistance default.

## Deferred, deliberately

- Generic prop painting (Phase 3.1 tiers, triplanar branch, variants catalog, "override default").
- Texture-array surfaces with mips (Phase 5); the atlas is padded and mip-less, so distant paint may
  shimmer slightly until then.
- Normal-map blending (no tile normal maps exist yet).
- Intersections/fades (single centreline; island branches).
- A builder panel for the palette (the shortcut hint stands in).
