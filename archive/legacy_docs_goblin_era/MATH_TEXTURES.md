# MATH TEXTURES: one look, scaled to every player's graphics card (owner, 2026-10-05)

Written 2026-10-05 by a side session. **For the main session:** a new owner ask, logged in `OWNER_ASKS.md` (2026-10-05 11:35) and tracked as **D21** in `STATUS.md`. The owner is sending the two Arena prompts himself ("fishing" for Gemini 4 Argon in battle mode). The Arena work runs in parallel. **The glue (section 4) belongs to RELEASE_PLAN Milestone 4. It does not jump ahead of Milestone 0.5 or 1.**

## 1. The ask

> "redo our voxels and their textures with low resource generated textures with optimised math that still looks stunning, then ... a set of pbr textures too with math, if the algorithms of the textures are linked to the graphics settings i think we can find the sweet spot for each users setup"

## 2. Where it stands (checked 2026-10-05)

| Piece | State |
|---|---|
| Voxel models (7 hero models, 3 nature, 48 head + 66 body parts) | **Flat palette colours only.** `voxel-view.ts`, `avatar-view.ts` and `decor.ts` draw vertex colours. `PaletteEntry.material?` exists in `@hm/voxel` but the renderer ignores it. Assembled goblins are not used (proportions, E1). |
| Voxel art bible | **Not written** (RELEASE_PLAN critique 18). It is needed before anyone mass-produces or reshapes models. |
| Smooth models (D12) | `@hm/smoothvox` (surface nets, decimate, LOD chain) and `@hm/smoothvox2` (palette to surface, triplanar weights, tangents, draw groups, surface blend) are merged but **not wired**. Caveat: smoothvox2's one-ring rule (`arena-gathered/README.md`). |
| Ground textures (D19) | **Authored as math, shipped as images.** The Arena sets are in `packages/texgraph/sets`: 26 surfaces, 83 styles and 26 voxel faces. `npm run bake:setmix` bakes them at build time into 512 px webp tiles (plus height/roughness maps) and a 32 px voxel atlas (3 seeds). Every tier gets the same files. |
| texgraph | 12 node types. Whole-image CPU evaluator. **No tier awareness.** |
| Goblin Racing | Keeps image sheets (PR 62), the high end, by owner choice. |
| D20 dither | Done (Bayer 4x4, `ditherDistance` per tier). |

## 3. The tier contract (the "sweet spot")

Both prompts teach the Arena models this contract, so their graphs degrade gracefully. Our evaluator then applies it.

| Tier | Voxel face | Model material (blocky) | PBR ground tile | PBR model material (smooth) | Variants | Octave cap | `grain` | `minTier` blends kept |
|---|---|---|---|---|---|---|---|---|
| Potato | 16 px | 16 px | 128 px | 32 px | 1 | 2 | flat 0.5 | none |
| Low | 16 | 32 | 256 | 64 | 2 | 3 | flat 0.5 | `low` |
| Medium | 32 | 32 | 512 | 128 | 3 | 4 | on | `low`, `medium` |
| High | 32 | 64 | 512 + detail map | 128 | 3 | 5 | on | up to `high` |
| Ultra | 32 | 64 | 1024 + detail map | 256 | 3 | 6 | on | all |

Rules the graphs follow:
- **R1.** Big shapes and the palette sit in octaves 1 to 2 and in cellular/stripes nodes. Higher octaves only add fine detail.
- **R2.** `grain` is flat 0.5 below Medium, so the look never depends on it.
- **R3.** An optional detail layer sits behind a `blend` with `"minTier"`. Below that tier the blend returns its `a` input unchanged.
- **R4.** The same tile reads the same at every tier: the mean colour differs by 0.03 or less per channel between Potato and Ultra.
- **R5.** Main shapes are at least 3 px across at the tier's smallest size.

Variants come from seed offsets (+1000 per variant), as `bake-setmix.mjs` already does. Authors send one graph per surface.

## 4. The glue (main session, Milestone 4)

1. **T1 texgraph tiers.** `evaluateGraph(graph, { size, tier })` applies the octave cap, the flat grain and the `minTier` blends. Merge any new node types the Arena answer adds, after their tests pass. Test: R4 holds for every graph in the sets.
2. **T2 runtime bake with a cache.**
   - Bake in a worker, only the surfaces the island uses, lazily.
   - Progressive: Potato size first, then refine to the tier.
   - Cache in IndexedDB keyed by graph hash + tier + size (next to `big-store`).
   - Run it behind the loading bar.
   - Never rebake when adaptive quality moves; only when Settings changes.
   - The baked webp files stay as the first-frame fallback.
3. **T3 graphics preset.**
   - Add `textureDetail` (potato..ultra) to `GraphicsSettings`, defaulting to the tier, with its own row in Fine-tune graphics. Low geometry with High textures is a valid sweet spot.
   - **Auto** benchmarks one reference graph at load. It picks the highest texture tier whose first bake fits about 1.5 s and whose texture memory fits the tier budget.
4. **T4 voxel model materials.**
   - Palette entries name a material.
   - Flat mode: a material atlas sampled in the model's own space per face direction, so grain runs across neighbouring voxels. Tint = palette colour times the greyscale tile. Roughness = palette roughness + (map - 0.5) x 0.6.
   - PBR mode: models are smooth meshes (smoothvox, then smoothvox2), triplanar with the PBR material set.
5. **T5 measure.**
   - Run `scripts/perf.mjs` on Low and Potato.
   - Add an e2e screenshot of the tier grid.
   - Record texture memory per tier in STATUS P11.
6. **Follow-up battle (optional): `texgraph-gpu`.** Compile a graph to one GLSL fragment shader that matches the CPU evaluator within tolerance (CPU stays the reference in tests). Ultra bakes in milliseconds, and it opens the way to live-animated textures (lava, water).

## 5. The prompts (the owner sends them)

- `docs/prompts/argon-fishing-benchmark.md`: **Master open-ended benchmark**. Challenges competing models on procedural architecture, mathematical tier scaling, new node proposals, and 4 demanding material archetypes. Best for smoking out Gemini 4 Argon vs generic models.
- `docs/prompts/argon-pbr-textures.md`: Open-ended challenge specifically for continuous PBR stylized ground & model materials.
- `docs/prompts/argon-voxel-textures.md`: Open-ended challenge specifically for 16x16 / 32x32 voxel block faces as procedural pixel art.

**Gathering:**
- Both battle answers use the same format, so pick per surface; we don't have to take one side wholesale.
- Check every graph with `validateGraph` and the R4 test before it goes into `packages/texgraph/sets`.
- Record the model names after the vote (memory: arena-vote-reveal).
