# T02P: a performance pass, so stage 6 on Low is smooth on the min-spec laptop

**Why:** each TICKET-02 layer cost frame rate on this laptop (GTX 950M, the min-spec): 53 fps after F-06, 39 after F-07 and 35 after F-08, at stage 6 on Low. That's over the 30 floor, but "smooth on low settings" needs headroom: **the target is 45 fps or more at stage 6 on Low**. Rules: the toggle rule (keep the look and ship competing techniques behind a Graphics setting with Auto) and the min-spec rule.

## Do
1. **Measure per layer, on the laptop.** At stage 6 on Low, from a fixed camera with the vegetation, coverage and water each on and off, record fps, draw calls, triangles and GPU frame time. Write it as a table in `docs/perf/stage6-low.md`.
2. **Fix the biggest costs first.** Likely levers, but measure before choosing:
   - the tuft count and radius on Low;
   - the tree LOD switch distance, with the 400-triangle LOD past 40 m on Low;
   - the coverage shader's octaves and texture fetches on Low (a cheaper variant behind the setting);
   - the water's reflections and glint on Low;
   - shadow casters: only trees near the camera cast on Low.
3. **New expensive features go behind the existing Graphics settings with Auto,** and Auto picks what holds 45 fps on this laptop. Never delete a look; offer it on Mid and High.
4. **Keep the stage ladder.** `test-stage-world`'s ground and sky deltas and `test-plot-biome`'s counts must still pass.

## Verify
- The fps table before and after, on the laptop: stage 6, Low, at least 45 fps.
- Through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, the build, `test-stage-world`, `test-plot-biome` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/play/plot-biome-view.ts`, `water-surfaces.ts`, `plot-ground.ts`, `packages/groundshader` (the Low variant only), the Graphics settings code, `play-scene.ts` (the hook-up), and `docs/perf/`.
