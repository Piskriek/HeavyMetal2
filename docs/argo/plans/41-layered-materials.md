# 41: Layered materials, the Pxd factory's next level (Opus, 2026-10-21)

**The owner, 2026-10-21:** "materials should be like machine parts presets, a combo of diffuse/normals/specular/bump/roughness/detail/ramp.. the list goes on. there should be presets like rust/wear/dirt/.. the list goes on, ready to apply and tweak ... keep asking yourself, is this modular, and can it be? the game is the cake example in the bakery we are building."

Research: [`docs/MATERIAL_LAYERS_RESEARCH.md`](../../MATERIAL_LAYERS_RESEARCH.md). This plan follows plan 39's pattern (a preset is JSON, a pure engine, schema sliders, ranked detail, a cartridge, previews drive play) and is the "material of layers" its preset inception names.

## 1. The goal
A machine's look is built the way the machine is:
- parts make modules, and modules make machines;
- surfaces and masks make layers, and layers make materials.

Every level is a preset with sliders, a live preview, a save and a share code. A player picks "Field-worn hazard", drags its Age up, swaps the rust for moon dust, repaints it signal green, and fires it at a machine. An agent does the same through the Studio. The good stuff: real channels (not a flat colour), wear that lands where wear lands (edges, crevices, the splash zone), and breakup noise so it never reads as a stencil.

## 2. Where it stands
See the research, section 1:
- `texgraph` makes tileable albedo, height, normal and roughness;
- vault skins put one tile on a part;
- kit parts wear 6 flat swatches;
- the planet caps metal at 0.35 (a stopgap);
- the wear operator cuts hard-edged slots;
- the Studio's material designer is a slider prototype.

No layers, masks, previews of wear or saves exist yet.

## 3. What the best do
Research, sections 2 to 4. In short:
- **Substance:** smart materials (layers whose masks read the mesh: curvature, AO, world normal, position, plus grunge noise).
- **Unity HDRP:** four layers, height blending and vertex masks.
- **Unreal:** material layers and Substrate's coat and coverage.
- **OpenPBR's channels:** base, coat, fuzz and thin film.
- **AC6:** a quick weathering amount, deep per-part paint and sharing.
- **Gundam Breaker 4:** per piece or all at once.
- **Space Engineers' unmet request:** frost, dust and rust as a layer weather applies and removes without repainting.

## 4. The design (decisions, made)
### 4.1 Five levels, each a preset
| Level | What it is | Players call it | Made of |
|---|---|---|---|
| Tile | a tileable texgraph graph (the vault's 50, plus new ones) | (hidden in the bench; a node graph in the Studio) | texgraph nodes |
| Surface | one look's channels | Surface | a tile, plus channel values |
| Mask | where a layer lands | Where | geometry inputs, noise, levels |
| Layer | a surface placed by a mask | Layer (Rust, Dust, Edge wear...) | a surface, a mask, opacity, channels |
| Material | a base surface, paint colours, layers, age | Material | a surface, plus 0 to 6 layers |

A machine kit names a material per slot. The machine is the cake, the material is its icing, and every level above is on the bakery's shelf.

### 4.2 The channels (a surface)
These follow OpenPBR's slabs so presets map onto Substance 12.1 and MaterialX later:
- **Colour:** a hex value, `paint1` or `paint2` (the material's paint slots), or a **ramp**: a gradient map over the tile's grey value. Rust, verdigris and galvanised spangle are ramps.
- **Metal, roughness, specular level.** Roughness varies by the tile (`roughVar`).
- **Height** from the tile: drawn as a bump on Medium, and as a normal on High (texgraph's `normalFromHeight`).
- **Detail:** a second tile at a small scale (casting pits, mill scale, orange peel), as bump and roughness.
- **Coat:** amount and roughness (enamel, oil film, sealant).
- **Fuzz:** amount and colour (dust, moss, regolith; drawn as three.js sheen).
- **Anisotropy:** amount and axis (brushed steel).
- **Thin film:** amount and thickness (heat tint, oil sheen; drawn as three.js iridescence).
- **Emission:** colour and intensity (rare: glowing slag, status panels; lamps stay Lx).

### 4.3 Masks (where)
A mask stacks inputs, each with a blend mode (multiply, add, subtract, max, min) and an opacity, then applies balance, contrast and invert. This is Substance's Mask Editor, cut to what reads at game distance:
- **Edges:** convex sharpness, in a band of width w (mm) from each sharp edge.
- **Cavities:** concave creases and enclosed corners.
- **Up** and **Down:** the surface normal in world space (dust on tops, drips under lips).
- **Ground:** height above the machine's foot in metres, which gives the splash zone and the dirt line.
- **Noise:** clouds, cells, speckle or scratches, with a scale in metres and a seed.
- **Streaks:** noise stretched along gravity, starting under edges (rust runs, oil leaks).

Units are metres and millimetres, never "0 to 1 of the object", so wear is the same size on a bolt and on a tank.

### 4.4 Layers and materials
- **A layer:**
  - a surface and a mask;
  - its opacity;
  - which channels it writes (colour, roughness, metal, height), as in Substance's per-channel toggles;
  - a height-blend amount: rust grows out of pits first;
  - a `weathering` flag.
- **A material:**
  - a base surface;
  - two paint colours;
  - up to 6 layers, drawn top first in the UI;
  - **Age (0 to 1):** it scales every weathering layer's opacity together. This is the AC6 quick path, and the hook for weathering over time (section 6, P2).
- **Saved and shared prints carry the full spec.** Named presets may be retuned between versions, but a share code must reproduce exactly. Game kits name presets by id (`mat:field-worn-hazard`). A player's own material is `matc:<code>`, made with `@hm/presetcodec` (a schema, versioned, CRC-checked).

### 4.5 How it draws (the min-spec laptop decides)
1. **Mask inputs per vertex, computed once per geometry and cached** (`@hm/matstack` `maskAttributes`, built 2026-10-21):
   - **Kit parts:** each triangle gets its own vertices carrying signed distances to up to four nearby sharp-edge lines (`aEdge`, vec4) and four crease lines (`aCavity`, vec4). A signed distance to a line is a plane over the triangle, so it interpolates exactly, and the fragment takes the smallest. On a convex face that is exactly the distance to the face's boundary, corners included. The lines of coplanar neighbours count too, so a face cut along its diagonal still wears along all four sides. The triangle count does not change.
     - **First try, rejected:** a band split, which was exact but cost 28 times the triangles across partgen's generators (136 times on the grille).
   - **Dense GLB cores and small knobs** (no face wider than twice the band) get a curvature value in the first slot instead: the sharpest bend, smoothed once, with no split.
   - **Ground, Up and Down** come from object-space position and the world normal in the shader. Kits are built with their origin at the foot, so object y is the height above ground in metres.
2. **One noise atlas,** 256² RGBA, holds clouds, cells, speckle and scratches. texgraph evaluates it at boot, it is shared by every material, and it is sampled on the parts' metric box UVs, or triplanar on High for GLB cores with island UVs.
3. **Surface tiles live in one `DataArrayTexture`:** 128² on Medium, 256² on High, with colour or ramp input, height and roughness packed. So a material samples one array whatever its layer count, and the fragment shader stays far under the sampler limit.
4. **One shader family:**
   - `MeshStandardMaterial` (or `MeshPhysicalMaterial` when a layer uses coat, fuzz, anisotropy or thin film), patched through `onBeforeCompile`, as `plot-biome-view.ts` already does.
   - Defines carry the layer count and feature flags; uniforms carry the preset.
   - `customProgramCacheKey` is the feature set, so a hundred presets share a handful of programs.
   - Materials still merge by name in `kit-build`, so the lab's draw-call budget (190) holds.
5. **Detail by rank** (plan 38: drawn = min(stage rank, Graphics tier rank); the lab is shielded, so it follows the tier only):
   - **Rank 0:** the material **flattened on the CPU** to one flat colour per face: the material averaged over the face, with roughness and metal averaged too. One plain material, no textures. Low draws this, and so do stages 0b and 1, whose flat facets it matches; wear then reads as crisp worn bevel faces.
     - **Why per face, not per vertex (Argo, 2026-10-21):** every vertex of a faceted part sits on an edge, so per-vertex values would make the whole part read as edge wear. Dense cores, which take the curvature way, flatten per vertex.
   - **Rank 1:** the layered shader with surface constants, the noise atlas and bump from the tiles.
   - **Rank 2:** adds tile normals, detail tiles, the physical extras and triplanar noise.
   - Rank changes fade with the world-locked dither (plan 38), never a cut.
6. **Metal needs something to reflect.** The planet gets a small PMREM environment from its stage look's sky and ground colours, rebuilt when the stage changes. Then the 0.35 cap goes.
7. **The toggle rule:** Graphics gains "Materials: Auto / Flat / Layered / Full". Auto picks from the tier and the measured frame time.

### 4.6 The preview (previews drive play)
- **A test piece (Argo's call, 2026-10-21).** It is a chamfered industrial shader ball: a ball seated on a square bevelled plinth, with four milled vertical flutes, two bolted flange ears and a recessed top lip. So every mask has something to land on: edges, crevices, tops, the splash zone and the undersides. A plain ball alone would hide the edge and crease masks.
  - It is a kit preset built from partgen parts, so it can be retuned.
  - In the world, MILL_V2 (TICKET-40) is the test piece, beside today's mill.
- **Turntable and thumbnails:** a turntable (the bench's `turntable.ts`), with every choice drawn as a thumbnail through `snapshot`:
  - **a material:** the test piece wearing it;
  - **a layer:** the test piece in neutral grey with that layer;
  - **a mask:** black and white on the test piece;
  - **a surface:** a lit 3D ball.
- **Try-on:** hover or focus tries any of them on in the view, leaving restores it, and a click keeps it.
- **Mask view:** a toggle shows the selected layer's mask in black and white on the piece. This is Substance's mask view, and it is how players learn what "Where" means.

### 4.7 The bench (Materials tab) and the Studio
- **The Materials tab gets two shelves:**
  - **Machines** (these materials);
  - **Ground** (the vault surfaces the ground already takes).
- **The Machines page, in steps:**
  1. **Pick a material:** the named presets, then Yours.
  2. **Paint:** two colour slots (swatches, plus hue, saturation and value).
  3. **Layers:** the stack, top first. Each row has its thumbnail, name, an eye toggle, opacity and up/down buttons. Clicking a row opens it:
     - its surface choices (balls);
     - its Where choices (mask thumbnails);
     - the Where sliders (amount, scale, contrast).
     
     Add layer opens the layer shelf, with hover try-on.
  4. **Age.**
- **The actions:** Print cartridge, Save as preset and Copy code (plan 39 section 7).
- **The Studio's Materials workspace** replaces the slider prototype with the same component plus every level:
  - all mask inputs and blend modes;
  - per-channel toggles;
  - surfaces' full channel lists;
  - tiles as texgraph node graphs.

  It is agent-friendly: every control is a schema slider with a test id, and every level is JSON (plan 40).

### 4.8 In the world
- **`cartlab`'s `Print` gains `{ material }` and `{ layer }`:**
  - **A material cartridge:** a tap sets the shot part's slot (like-for-like, as skins do now). A hold sets every part on that machine wearing the same material.
  - **A layer cartridge** adds its layer over whatever the shot part wears: the paint stays, with rust over it. This is the Space Engineers gap. A tap covers the part, and a hold the whole machine.
- **Overrides** keep material names (`mat:` and `matc:`) in the plot save, under the kits cap (128).
- **Never an invisible part (Argo, 2026-10-21):** an unknown or broken material name draws a neutral fallback at once and warns, and a test fails on any `mat:` id a kit names that does not resolve.

### 4.9 The first shelf (Argo tunes the values and names)
- **Surfaces:**
  - bare steel;
  - brushed stainless (anisotropy);
  - galvanised (a spangle ramp);
  - cast iron (pitting detail);
  - anodised aluminium (paint1, dyed);
  - copper and brass;
  - powder coat (paint1, an orange-peel detail);
  - enamel (paint1, a coat);
  - hazard paint (paint2);
  - rubber;
  - concrete;
  - carbon fibre (a weave, a coat);
  - ceramic insulator (a coat);
  - lab composite.
- **Weathering surfaces:**
  - rust (a ramp over cells and pits);
  - heavy scale;
  - verdigris;
  - grime;
  - dust (fuzz);
  - regolith (fuzz, the moon's grey-tan);
  - soot;
  - oil (a coat, low roughness);
  - heat tint (thin film);
  - moss (fuzz);
  - frost;
  - mud;
  - limescale;
  - scorch;
  - bright metal (what edge wear exposes).
- **Masks:**
  - everywhere;
  - edge chips;
  - worn edges;
  - crevices;
  - tops;
  - undersides;
  - splash zone;
  - drips;
  - patches;
  - pitting;
  - scratches.
- **Layers:**
  - edge wear;
  - paint chips;
  - rust bloom;
  - rust streaks;
  - heavy rust;
  - dirt;
  - grime;
  - dust;
  - moon dust;
  - oil leaks;
  - soot;
  - heat tint;
  - verdigris;
  - moss;
  - frost;
  - scratches.
- **Materials:**
  - lab fresh;
  - workshop steel;
  - field-worn hazard;
  - moon-dusted;
  - rust bucket;
  - furnace;
  - old copper;
  - oily engine;
  - overgrown relic;
  - frozen rig;
  - brushed lab steel;
  - carbon racer.
- **Not on the first shelf:** lettering (owner rule) and decals. Decals stay `@hm/decals`, a later layer kind.

## 5. The rules it touches
- **Constitution 1:** no new metric. Materials are the Pxd factory's presets, and the Texture Mill prints them.
- **Constitution 2:** `@hm/matstack` and the meshops operator are pure and deterministic. Noise is seeded, the CPU flatten and the shader use the same documented formulas, and a test holds them together.
- **Constitution 3:** single file plus HD pack. Procedural tiles ship in the file; authored or scanned tiles (Substance, CC0) go in the pack behind the toggle.
- **Constitution 4:** the stage unlocks ranks (rank 0 flat, rank 1 layered, rank 2 full), so machines gain their wear as reality upgrades.
- **Owner rules:**
  - min-spec smooth (the perf gate in section 7);
  - legal art (section 4.9 and the research, section 5.9);
  - no lettering;
  - previews drive play;
  - cross-checked by Argo before the owner sees it.

## 6. The changes, ranked
- **P0, the system:**
  - `@hm/matstack`;
  - the `edge-band` and mask attributes;
  - the renderer with its ranks;
  - the planet's environment map, after which the metal cap goes;
  - the first shelf;
  - the bench page with its preview;
  - material and layer cartridges;
  - saves and codes;
  - the machine kits wearing `mat:` presets, which replaces TICKET-40's missing `vault:` ids.
- **P1:**
  - the Studio Materials workspace;
  - mask view;
  - Substance calibration: each preset built in Substance Painter on the test piece as the look target, with our render beside it and the values tuned until they match;
  - the ground takes materials too (slope is Up, valleys are Cavities).
- **P2, weathering by the world (decided by Argo, 2026-10-21):**
  - **No decay on a clock.** It would punish players for taking their time, and it would churn state across co-op rooms.
  - **The stage and the plot's floats drive the environmental layer:**
    - regolith dust dominates in stages 0 to 2;
    - damp oxide and grime deepen as Aq rises (stages 3 and 4);
    - in stages 5 and 6, in high-Aq, high-biomass sectors, moss or lichen settles on cool plinths while running vents stay clean.
  - **The player's Age slider sits on top,** with hover preview: 0 factory fresh, 0.5 field-seasoned (the default), 1 heavy salvage.
  - **The solvent cartridge stays a proposal.**
  - **HD pack tiles,** from the owner's Substance work or CC0 scans.

## 7. Build order and who does what
1. **Opus: the `@hm/matstack` contract.** Types, slider schemas, the blend formulas written out, and the test oracle (fixed inputs to the expected mask and channel values).
2. **Done (Opus):** the reference engine (mask, surface, layer and material evaluation, the flatten) and the mask attributes, 17 tests (`3a2e8702`, `c719d174`). Opus wrote both, because the shader must mirror them formula for formula and the attribute layout is the shader's input; Argo was the bottleneck for a battle round-trip.
3. **Still to write:** validate and clamp, and the presetcodec schema (a code form with every field present, since presetcodec has no unions or optional fields). The shelf as data comes from Argo (section 4.9).
4. **Opus: the renderer:**
   - `layered-material.ts`;
   - the noise atlas;
   - the tile array;
   - the ranks;
   - the planet's environment map.
   
   **Perf gate on this laptop:** the lab gate view keeps 181 draw calls or fewer, and the layered shader adds at most 1 ms a frame on Medium at 1080p.
5. **Opus: the bench page:** the test piece, thumbnails, mask view, Yours, codes, cartridges and Apply. Playwright tests in the pattern of `test-my-presets.mjs`.
6. **Argo: TICKET-40 v3.** Each machine's slots name `mat:` presets, and he tunes the shelf. Arena codes it, Haiku installs it, and Opus verifies it with the review sheets (`machine-reference-sheet`, `kit-compare-sheet`) before the owner sees it.
7. **The Studio workspace, then section 6's P1 and P2.**

## 8. Ask the owner (resources only)
**Substance Painter:** it is not on this laptop, and the 3D PC refused SSH on 2026-10-21. Is it installed and licensed on the 3D PC, or should it be? It is the look target for P1 and a source of HD tiles. Nothing in P0 waits on it.
