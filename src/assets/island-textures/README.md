# Island texture library

Drop seamless 1024x1024 JPG tiles here, named `<kind>-<descriptor>-<nn>.jpg` (kinds: sand, wetsand, shallows,
grass, moss, rock, cliff, strata, mud, dunes, path, coral, planks, iron, crystal). They appear in the Island
panel tile picker automatically (`src/game/island-route/island-texture-library.ts`).

The pipeline-built Basalt Isle library is not here: it lives in `public/textures/island-lib/` (256 px WebP, named
`<kind>-<descriptor>-<sheet id>.webp`, so it stays out of the inlined RUN bundle) and is listed in
`src/game/island-route/island-lib-index.generated.ts`. Both are written by the art pipeline's
`tools/build_island_library.py`: do not edit them by hand. A tile marked *provisional* in its name comes from a
sheet the image agent has been asked to regenerate; the pipeline swaps it in place (same file name) when the new sheet passes.
