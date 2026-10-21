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
1. **Mask inputs per vertex, computed once per geometry and cached:**
   - **Kit parts are low poly,** so a soft edge needs room. A new meshops operator, `edge-band`, splits a band of width w along sharp edges (the existing wear operator's clip, but kept in one slot). It writes `aMask.x` (edge: 1 at the edge, 0 at the band's inner line) and `aMask.y` (cavity: the same for concave creases).
   - **Dense GLB cores** get `aMask` from per-vertex curvature (normal divergence), with no split.
   - **Ground, Up and Down** come from object-space position and the world normal in the shader. Kits are built with their origin at the foot, so object y is the height above ground in metres.
2. **One noise atlas,** 256² RGBA, holds clouds, cells, speckle and scratches. texgraph evaluates it at boot, it is shared by every material, and it is sampled on the parts' metric box UVs, or triplanar on High for GLB cores with island UVs.
3. **Surface tiles live in one `DataArrayTexture`:** 128² on Medium, 256² on High, with colour or ramp input, height and roughness packed. So a material samples one array whatever its layer count, and the fragment shader stays far under the sampler limit.
4. **One shader family:**
   - `MeshStandardMaterial` (or `MeshPhysicalMaterial` when a layer uses coat, fuzz, anisotropy or thin film), patched through `onBeforeCompile`, as `plot-biome-view.ts` already does.
   - Defines carry the layer count and feature flags; uniforms carry the preset.
   - `customProgramCacheKey` is the feature set, so a hundred presets share a handful of programs.
   - Materials still merge by name in `kit-build`, so the lab's draw-call budget (190) holds.
5. **Detail by rank** (plan 38: drawn = min(stage rank, Graphics tier rank); the lab is shielded, so it follows the tier only):
   - **Rank 0:** the material **flattened on the CPU** to vertex colours: the same mask maths at each vertex, roughness and metal averaged. One plain material, no textures. Low draws this.
   - **Rank 1:** the layered shader with surface constants, the noise atlas and bump from the tiles.
   - **Rank 2:** adds tile normals, detail tiles, the physical extras and triplanar noise.
   - Rank changes fade with the world-locked dither (plan 38), never a cut.
6. **Metal needs something to reflect.** The planet gets a small PMREM environment from its stage look's sky and ground colours, rebuilt when the stage changes. Then the 0.35 cap goes.
7. **The toggle rule:** Graphics gains "Materials: Auto / Flat / Layered / Full". Auto picks from the tier and the measured frame time.

### 4.6 The preview (previews drive play)
- **A test piece.** Substance shows smart materials on a grooved material ball. Ours is a test piece built from partgen parts:
  - a skid;
  - a bevelled panel with a bolt row;
  - a square-section beam;
  - a bracket;
  - a short can.

  It is grounded and about 0.6 m tall, so every mask has something to land on: edges, crevices, tops, the splash zone and the undersides. It is a preset itself (a kit), so Argo can retune it.
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
- **P2, proposals for Argo:**
  - **Weathering over time.** A machine's Age rises with its operating hours, by its plot:
    - regolith dust on the moon from the first hour;
    - rust once water is about (Aq, stage 4+);
    - moss from stage 5;
    - frost on cold plots.
    
    A coat (sealant) slows it, and a solvent cartridge cleans the weathering layers off without touching the paint. The world wears your machines, and you choose to keep the patina or not.
  - **HD pack tiles,** from the owner's Substance work or CC0 scans.

## 7. Build order and who does what
1. **Opus: the `@hm/matstack` contract.** Types, slider schemas, the blend formulas written out, and the test oracle (fixed inputs to the expected mask and channel values).
2. **Arena battle A: the `@hm/matstack` engine.** Validate and clamp, CPU mask and layer evaluation, the flatten, the shelf as data, the presetcodec schema, and tests against the oracle.
3. **Arena battle B: meshops `edge-band` and `maskAttributes`.** Covers low-poly band splits and dense-mesh curvature. Tests: a 1 m cube's band area and attribute ramp, and that a flat diagonal never wears.
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
