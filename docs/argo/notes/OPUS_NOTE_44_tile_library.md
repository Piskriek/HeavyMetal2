# OPUS_NOTE_44: TICKET-41, the tile library (Opus, 2026-10-21)

Your shelf (`packages/matstack/src/shelf.ts`, installed in `be286755`) names 20 tiles. None exist yet: texgraph's `TEXTURE_PRESETS` holds only the ground's basalt, sand and grass. Until they do, every surface reads as flat colour (FLAT_TILE, by the matstack contract). They are the bakery's flour: every material on the shelf is made from them. Since the looks are a creative call and your sandbox can run texgraph and look at the results, this ticket is yours, after the mill fixes (OPUS_NOTE_41, v3 section).

The source you need is in Setmix: `texgraph-index.ts` (packages/texgraph/src/index.ts).

## What a tile is
A `TexGraph` (texgraph's JSON: nodes plus `out.albedo`, `out.height` and `out.roughness`), evaluated by `evaluateGraph(graph, { size, seed, relief })`. matstack reads three values per texel:
- **grey:** the albedo's luminance. The surface's colour, or its ramp, comes from it, so the tile carries variation, not colour. Keep albedo grey or near-grey, and use the full range: grey's 5th to 95th percentile spread should be at least 0.35.
- **height:** the relief, from 0 to 1.
- **roughness:** variation around 0.5.

Every tile must wrap seamlessly (every node is periodic on the unit square). It must be deterministic, and evaluate at 128 px in under 25 ms (256 px in under 100 ms) on a laptop.

## The 20 looks
1. **brushed-metal:** long fine streaks along u.
2. **cells:** rust-like cellular blotches.
3. **cast-iron:** sand-cast mottle.
4. **pits:** small round pits on a mostly flat field.
5. **fine-grain:** anodised micro grain.
6. **orange-peel:** soft bumpy paint.
7. **stripes:** hazard diagonal stripes, two per tile, hard edges (grey 0 and 1, so the hazard ramp works).
8. **rubber-grain:** fine matte texture.
9. **concrete:** aggregate speckle and pores.
10. **carbon-weave:** a 2x2 twill.
11. **hex-micro:** a fine hex lattice.
12. **flake-scale:** overlapping flakes (heavy rust scale).
13. **grime-clouds:** soft blotches.
14. **regolith-grain:** dusty grains with small pebbles.
15. **moss-clump:** clumpy organic blobs.
16. **frost-crystal:** branching crystal edges.
17. **mud-splatter:** splatter spots.
18. **mineral-crust:** crusty rings and deposits.
19. **scorch-burn:** burn blotches with soot speckle.
20. **scratches:** random fine scratches.

## New nodes
texgraph cannot make several of these looks. Add these nodes, each periodic, seeded, validated in `validateGraph`, and documented like the existing ones:
- **`noise`:** gains an optional integer `scaleY` (anisotropic, defaulting to `scale`), for brushed metal.
- **`scratches`:** count, length, width, angle spread and seed. Thin segments that wrap across the edges.
- **`spots`:** count, radius min and max, softness and seed. Discs that wrap (mud, flakes, pits, pebbles).
- **`hex`:** count across, line width, and mode `'edge'` or `'cell'` (a random value per cell).
- **`weave`:** count and gap. An over-under weave with a height that rises over each crossing.
- **`blur`:** a wrapped box or gaussian blur of a scalar input, with a radius as a fraction of the tile.

Add others if a look needs them, and say why.

## Deliver
- **The tiles:** `TILE_LIBRARY: Readonly<Record<string, TexGraph>>` in texgraph, with exactly these 20 ids.
- **Tests:**
  - every tile validates;
  - two evaluations are identical;
  - the seam check: the mean absolute difference across the wrap edge is within 1.5 times the interior neighbour difference;
  - the grey spread;
  - height is not constant;
  - the time budget.
- **A contact sheet PNG** of all 20, each tiled 2x2 so a seam would show. Lit with texgraph's `litPreview`, and also as plain grey, height and roughness.

I will review with my own tile sheet in the game's renderer before anything lands.
