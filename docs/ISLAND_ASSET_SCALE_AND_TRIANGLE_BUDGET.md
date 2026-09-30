# Basalt Isle asset scale and triangle budget

**Units:** metres  
**Primary scale reference:** racing ball = **1.0 m diameter**  
**Gameplay reference:** one lane = **3.0 m**; standard three-lane racing surface = **9.0 m clear width**  
**Applies to:** high-fidelity Meshy references and cleaned production models

This registry keeps Meshy outputs, modular joins, texture density, collision, and environment composition at a coherent scale. Dimensions are target bounding boxes for cleanup, not dimensions inferred from generated sheets. Gameplay blockouts remain authoritative for track width, jump angle, loop diameter, tunnel clearance, and collision.

Triangle counts are **recommended LOD0 rendered triangle budgets after cleanup**, not targets that must always be consumed. Simple silhouettes should use fewer. Extra triangles are justified only where they improve silhouette, deformation, strong curvature, or close-range structural readability.

---

## 1. Shared scale rules

- Racing ball: `1.0 m` diameter.
- Lane: `3.0 m` wide.
- Standard three-lane road: `9.0 m` clear racing width, excluding shoulders and guardrails.
- Narrow route: `3.0–6.0 m` clear racing width.
- Guardrail: `0.8 m` above the road surface.
- Goblin doorway: approximately `2.2 m` high.
- Main timber beam: `0.30–0.50 m` thick.
- Deck plank: `0.18–0.25 m` wide and `0.08–0.14 m` thick.
- Oversized structural bolt head: `0.10–0.18 m` diameter.
- Standard modular track connector: `9.0 m` clear width, centered pivot, consistent forward axis.
- Small vegetation is judged against the 1 m ball; trees and structures are judged against the 2.2 m doorway and 9 m road.

### Bounding-box notation

`W × D × H` means width across the principal front, depth along the object, and total height. Curves and radial objects use maximum footprint dimensions.

---

## 2. LOD policy

| Level | Triangle target | Use |
|---|---:|---|
| LOD0 | 100% of listed budget | Close race camera, hero inspection, builder view |
| LOD1 | 45–60% of LOD0 | Normal mid-distance gameplay |
| LOD2 | 15–25% of LOD0 | Far race-camera view |
| LOD3 / impostor | 2–8% or billboard | Distant vegetation, sea stacks, skyline props |
| Collision | 0.5–5% of LOD0 | Separate simple deterministic collision mesh |

Switch distances depend on screen size, not a universal metre value. Transitions should be tested for silhouette popping from the actual race camera.

### Performance principles

- Spend geometry on silhouette, curved track edges, large branch forms, arch openings, and visible underside structure.
- Put small cracks, grain, rivet wear, leaf veins, and surface breakup in normal/height maps rather than geometry.
- Model hero bolts only where their silhouette or close-up scale warrants it; use normal/trim detail for repeated minor fasteners.
- Foliage triangle count is only half the cost: alpha overdraw, double-sided shading, wind, and shadow casting must also be budgeted.
- Repeated modules must be GPU-instanced where possible.
- Collision never uses the render mesh for complex assets.
- A model passing under budget is preferable to one padded to the limit.

---

## 3. Batch 01 — track, structure, and benchmark assets

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 01 | Basalt cliff module | `12 × 6 × 12 m` | About 12 balls tall; one large road-cut/cliff bay; similar height to the tall trestle | 12,000 | 6,000 / 2,500 |
| 02 | Straight race-road module | `11 × 12 × 2.5 m` | 9 m clear road plus shoulders/rails; 12-ball-long repeatable segment | 8,000 | 4,000 / 1,600 |
| 03 | Banked race-road curve | `18 × 18 × 6 m` | 90° three-lane curve; roughly 18-ball footprint; bank height below a tall trestle | 14,000 | 7,000 / 2,800 |
| 04 | Tall timber trestle bay | `8 × 5 × 14 m` | Slightly taller than cliff module; supports one road bay; beams readable beside 1 m ball | 14,000 | 7,000 / 2,500 |
| 05 | Tall leaning palm | `6 × 6 × 12 m` | Crown spans about two lanes; height similar to cliff module and below windmill blades | 6,000 | 3,000 / 900 + impostor |
| 06 | Goblin windmill | `11 × 9 × 17 m` | Blade tip height about 17 balls; larger than palm, shorter than loop; doorway remains 2.2 m | 24,000 | 12,000 / 4,500 |
| 07 | Vertical loop | `16 × 8 × 22 m` | Recommended visual target: 16 m inner loop diameter, ~22 m total; gameplay physics must approve | 32,000 | 16,000 / 6,000 |
| 08 | Reinforced launch ramp | `11 × 8 × 4.5 m` | Approximately three-lane approach; 11 balls long; lip height below tunnel opening | 10,000 | 5,000 / 2,000 |
| 09 | Basalt tunnel entrance | `15 × 7 × 11 m` | Clear opening target `10 × 7 m`; comparable overall mass to cliff module | 18,000 | 9,000 / 3,500 |
| 10 | Timber-and-iron cliff bridge | `11 × 20 × 7 m` | 9 m clear road, 20-ball span; roughly one and a half trestle bays long | 20,000 | 10,000 / 4,000 |

### Track-specific notes

- Road modules share the same `9.0 m` clear connector width and connector elevation.
- Structural width may exceed 9 m, but barriers cannot reduce the gameplay clearance.
- The loop and ramp dimensions remain provisional until ball physics, speed, camera, and recovery tests pass.
- Bridge and trestle sockets must use the same beam/support coordinate convention.

---

## 4. Batch 02 — vegetation and organic dressing

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 11 | Three-palm cluster | `10 × 8 × 13 m` | Slightly taller and wider than one tall palm; crown spans about three lanes | 15,000 | 7,000 / 2,000 + impostor |
| 12 | Jungle understory cluster | `5 × 4 × 2.3 m` | Roughly doorway height; fills one compact non-drivable patch | 7,000 | 3,000 / 800 + impostor |
| 13 | Large fern cluster | `4.5 × 4 × 1.8 m` | Below guardrail-to-doorway scale; foreground groundcover module | 5,000 | 2,200 / 600 + impostor |
| 14 | Flowering shrub cluster | `5 × 4 × 3.2 m` | Taller than a goblin doorway but below tree canopy; color-accent module | 7,000 | 3,000 / 800 + impostor |
| 15 | Coastal grass and scrub | `4 × 2.5 × 1.2 m` | Near ball height; elongated shoulder module; should never hide racers | 2,500 | 1,000 / 250 + impostor |
| 16 | Broadleaf tree pair | `12 × 9 × 11 m` | Similar height to palm, wider canopy; about four lanes across | 20,000 | 9,000 / 2,500 + impostor |
| 17 | Windswept highland tree pair | `10 × 6 × 8 m` | Lower than palms; sparse crown for exposed upper slopes | 14,000 | 6,000 / 1,800 + impostor |
| 18 | Hanging vine curtain | `5 × 1.5 × 6 m` | One to two lanes wide; hangs about six balls; attaches to cliffs/bridges | 5,000 | 2,000 / 500 + impostor |
| 19 | Cliff-creeper cluster | `5 × 3 × 1.3 m` | Low surface-conforming module; around ball height | 4,500 | 1,800 / 450 + impostor |
| 20 | Driftwood/root cluster | `5 × 3.5 × 2.5 m` | Slightly taller than doorway; medium shoreline/jungle-edge prop | 6,000 | 3,000 / 900 |

### Vegetation-specific notes

- Triangle figures assume efficient leaf cards or low-poly leaf clumps, not every leaf modeled as thick geometry.
- Use two-sided foliage only where needed. Disable distant per-leaf shadows before reducing visible silhouette quality.
- Make 2–4 LOD silhouette variants per tree family and vary instance scale by approximately ±15%.
- Cluster footprints contain no modeled soil or base plate. Terrain blending happens in engine.
- Keep grass and understory below gameplay sightlines near road edges.

---

## 5. Batch 03 — rock, coast, and waterfall geology

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 21 | Basalt boulder cluster | `6 × 4.5 × 4.5 m` | Main boulder about four balls high; half the height of cliff module | 5,000 | 2,500 / 800 |
| 22 | Ochre slab cluster | `7 × 5 × 3 m` | Wide, low formation; can frame one lane without becoming a cliff | 5,500 | 2,700 / 900 |
| 23 | Mixed scree cluster | `5 × 4 × 2.5 m` | Smallest rocks roughly 0.3 ball; largest roughly 2 balls | 5,000 | 2,200 / 700 |
| 24 | Hero sea stack | `18 × 16 × 32 m` | Major skyline object; about 2.5 cliff modules high and twice loop height | 24,000 | 11,000 / 3,500 + impostor |
| 25 | Natural sea arch | `26 × 10 × 16 m` | Opening target about `14 × 9 m`; wider than bridge span and below sea-stack height | 26,000 | 12,000 / 4,000 |
| 26 | Beach shelf module | `16 × 14 × 4 m` | Broad low shoreline transition; about five lanes wide | 12,000 | 6,000 / 2,000 |
| 27 | Tide-pool rock ring | `9 × 7 × 2 m` | Basin approximately two lanes wide; low enough for shoreline dressing | 8,000 | 4,000 / 1,200 |
| 28 | Waterfall-lip module | `10 × 9 × 3.5 m` | Channel roughly one lane wide; low cliff-shelf connector | 9,000 | 4,500 / 1,500 |
| 29 | Plunge-pool surround | `14 × 12 × 5 m` | Basin larger than tide pool and comparable to cliff-module footprint | 13,000 | 6,000 / 2,000 |

### Terrain-specific notes

- Large island landform remains engine terrain. These meshes provide silhouette, overhangs, arches, caves, and authored transitions that heightfields cannot provide well.
- Repeated surface cracks remain in normal/height textures; geometry carries primary and medium fractures only.
- Sea stack and arch require impostors or HLOD at skyline distance.
- Waterfall modules contain geology only. Water, mist, foam, and wetness are separate systems.

---

## 6. Batch 04 — settlement and race structures

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 30 | Small goblin shack | `5 × 4 × 5 m` | One-room building; doorway remains 2.2 m; lower than grandstand and half watchtower height | 12,000 | 6,000 / 2,200 |
| 31 | Goblin workshop hut | `8 × 6 × 7 m` | About one road lane deep and nearly three lanes wide; larger than shack, below windmill mass | 18,000 | 9,000 / 3,200 |
| 32 | Race watchtower | `5 × 5 × 14 m` | Same height class as tall trestle; cabin floor approximately 10 m above ground | 18,000 | 9,000 / 3,000 + impostor |
| 33 | Fixed timber crane | `7 × 6 × 11 m` | Boom reaches roughly three lanes high; shorter than watchtower and windmill | 16,000 | 8,000 / 2,800 |
| 34 | Goblin mine hoist | `4 × 3 × 5 m` | Similar height to shack but narrower; machine silhouette readable beside 1 m ball | 12,000 | 6,000 / 2,000 |
| 35 | Straight grandstand bay | `10 × 5 × 6 m` | One modular bay spans slightly over three lanes; three seating tiers, below workshop roof height | 16,000 | 8,000 / 2,800 |
| 36 | Finish gate arch | `14 × 4 × 10 m` | Clear opening `10 × 7 m`; wider than standard road and below tall trestle height | 14,000 | 7,000 / 2,200 + impostor |
| 37 | Goblin lantern post | `1.5 × 1.5 × 5 m` | About two doorways high; lantern remains visible above guardrails and racers | 4,000 | 1,800 / 500 |
| 38 | Blank race banner | `3 × 1.5 × 5 m` | Same height class as lantern post; cloth panel roughly `2 × 3 m` | 5,000 | 2,200 / 650 |

### Structure-specific notes

- Buildings use the same 2.2 m doorway and shared beam/fastener scale as the windmill, trestle, and bridge.
- Watchtower, crane, gate, lantern, and banner require LOD-safe thickness; ropes, rails, and braces below the modular-cluster minimums are replaced by broader geometry or removed in distant LODs.
- Grandstand connector ends must align so repeated bays do not create doubled posts or thin gaps.
- Cloth uses broad folds in geometry and fine weave/fold breakup in Normal and Roughness maps.
- Lantern emissive is a separate material/state; the reference and default model remain unlit.

---

## 7. Batch 05 — terrain-conforming road and environment carpets

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 39 | Long S-curve road carpet | `9 × 30 × 0.12 m` | Three-lane road width; two and a half straight modules long | 5,000 | 2,500 / 1,000 |
| 40 | Hairpin road carpet | `24 × 22 × 0.12 m` | Three-lane constant-width 180° turn; footprint slightly larger than loop | 6,000 | 3,000 / 1,200 |
| 41 | Y-fork road carpet | `24 × 28 × 0.12 m` | 9 m trunk into two 6 m branches; larger than bridge footprint | 7,000 | 3,500 / 1,400 |
| 42 | Arena/plaza road blob | `24 × 18 × 0.12 m` | Broad racing area with three 9 m connector necks | 6,000 | 3,000 / 1,200 |
| 43 | Curved dirt-path carpet | `4 × 22 × 0.08 m` | Slightly wider than one lane; long secondary path overlay | 3,000 | 1,500 / 600 |
| 44 | Grass/moss carpet | `10 × 8 × 0.08 m` | Roughly one road module footprint; broad biome-blending patch | 2,000 | 1,000 / 400 |
| 45 | Wind-swept sand carpet | `14 × 9 × 0.08 m` | Wider than standard road; shoreline and drift transition patch | 2,500 | 1,200 / 500 |
| 46 | Mud/runoff carpet | `12 × 6 × 0.08 m` | One road module long and two lanes wide | 2,500 | 1,200 / 500 |
| 47 | Scree-ground carpet | `10 × 8 × 0.10 m` | Road-module footprint; shallow embedded-rock transition | 4,000 | 2,000 / 800 |
| 48 | Shallow-water/foam carpet | `16 × 6 × 0.05 m` | Long shoreline ribbon; approximately two lanes wide | 2,000 | 1,000 / 300 or shader proxy |

### Surface-carpet rules

- These assets are thin conforming overlays, not terrain slabs, cliffs, or presentation bases.
- Mesh density supports broad bending over terrain. It must not encode gravel, grass blades, ripples, cracks, or aggregate that belongs in Normal, Height, Roughness, decals, or shaders.
- Keep regular, decimation-friendly topology with enough cross-sections to conform without visible faceting.
- Remove underside faces when the runtime conform/decal solution does not expose them; the listed budgets are ceilings and may drop substantially for projector/decal implementations.
- Road connector widths remain exact after deformation. Keep UV direction continuous through curves, forks, and hairpins.
- Feather edges with alpha, vertex color, height blend, or terrain material blending rather than thin geometric fringe strips.
- Apply a controlled depth bias or terrain offset to prevent z-fighting without visibly floating above the ground.
- Patches may overlap, but layered order and material blending must avoid coplanar flicker.
- Water carpet is shader-driven. Foam and caustics belong in texture/shader channels; generated wave thickness is not production geometry.
- Build several rotated/scaled variants only for organic carpets. Engineered road carpets use uniform scale and preserve connector dimensions.

---

## 8. Batch 06 — small and large carpet scale variants

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 49 | Short S-curve road carpet | `6 × 12 × 0.10 m` | Two-lane width; 40% of long S-curve length and two-thirds its width | 3,000 | 1,500 / 600 |
| 50 | Extra-long road curve | `9 × 60 × 0.12 m` | Standard three-lane width; twice the long S-curve length | 8,000 | 4,000 / 1,600 |
| 51 | Small dirt-path carpet | `3 × 8 × 0.06 m` | One-lane width; about one-third of medium path length | 1,500 | 750 / 300 |
| 52 | Small grass/moss carpet | `4 × 3 × 0.05 m` | Roughly 15% of medium grass-carpet area | 800 | 400 / 160 |
| 53 | Large grass meadow carpet | `30 × 22 × 0.10 m` | Roughly eight medium grass-carpet areas; broad biome foundation | 5,000 | 2,500 / 1,000 |
| 54 | Small sand-drift carpet | `5 × 3 × 0.06 m` | Local drift; about 12% of medium sand-carpet area | 900 | 450 / 180 |
| 55 | Large sand-dune carpet | `32 × 24 × 0.12 m` | About six medium sand-carpet areas; large shoreline/dune foundation | 5,000 | 2,500 / 1,000 |
| 56 | Small mud/puddle carpet | `4 × 3 × 0.05 m` | Local wet accent; one-sixth of medium runoff area | 800 | 400 / 160 |
| 57 | Large mud/runoff carpet | `24 × 12 × 0.10 m` | Four times medium runoff area; broad drainage corridor | 4,000 | 2,000 / 800 |
| 58 | Small scree carpet | `4 × 3 × 0.06 m` | Local transition; about 15% of medium scree-carpet area | 1,000 | 500 / 200 |

### Scale-variant rules

- Reference sheets normalize object framing; production scale comes from these dimensions and must be applied after Meshy generation.
- Small carpets hide local seams, contacts, decals, and repeated-material edges. Medium carpets define standard transitions. Large carpets establish biome fields and broad route material zones.
- Do not create a large carpet by uniformly scaling a small texture. Large variants need lower-frequency macro variation and correctly sized detail textures.
- Small, medium, and large variants share material families and texel density so grains, grass, stones, and cracks retain believable world scale.
- Large road carpets preserve the 9 m connector standard; narrow road/path variants explicitly use 6 m or 3–4 m widths.
- Triangle growth follows deformation needs, not surface area alone. A large flat patch can remain inexpensive when broad detail stays in PBR maps.

---

## 9. Batch 07 — bridge, stunt, and barrier expansion

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 59 | Rope suspension bridge | `8 × 18 × 6 m` | 6 m two-lane clear deck; similar span to cliff bridge but narrower and lighter | 18,000 | 9,000 / 3,000 |
| 60 | Iron girder bridge | `11 × 20 × 5 m` | 9 m three-lane clear deck; same span class as timber cliff bridge | 22,000 | 11,000 / 4,000 |
| 61 | Stone arch bridge | `11 × 18 × 8 m` | 9 m road deck; thicker and heavier than iron bridge, below tunnel height | 24,000 | 12,000 / 4,500 |
| 62 | Corkscrew descent | `20 × 20 × 10 m` | One 6 m two-lane helical turn with approximately 8 m drop; similar footprint to loop | 32,000 | 16,000 / 6,000 |
| 63 | Banked wall ride | `24 × 18 × 10 m` | Three-lane 60° curve; footprint larger than hairpin quarter and about half loop height | 28,000 | 14,000 / 5,000 |
| 64 | Reinforced landing ramp | `11 × 10 × 4 m` | Three-lane receiver matching launch-ramp width; slightly shorter and lower | 12,000 | 6,000 / 2,200 |
| 65 | Timber guardrail | `6 × 0.5 × 0.8 m` | One repeatable barrier bay; top stays below ball diameter | 3,000 | 1,400 / 450 |
| 66 | Rope/post barrier | `6 × 0.5 × 1.0 m` | Same bay length as timber rail; rope top at one ball diameter | 3,000 | 1,400 / 400 |
| 67 | Stone parapet | `6 × 0.6 × 1.0 m` | Same modular bay; heavier opaque barrier using large LOD-safe blocks | 3,500 | 1,700 / 600 |

### Expanded-track notes

- Rope and cable thickness must survive LOD2; distant LODs may replace cylindrical rope with broad cards or simplified prisms.
- The corkscrew reference defines style and support grammar only. Physics-approved centerline, gradient, connector transform and clearance control final geometry.
- Wall-ride banking must transition smoothly enough for deterministic collision and camera motion.
- Guardrail, rope barrier and parapet share a 6 m bay convention and compatible end sockets.
- Bridge decks share existing 6 m or 9 m clear widths; structural trusses and parapets sit outside gameplay clearance.
- Bridge undersides receive real geometry only where visible from lower routes or race cameras; hidden interior faces are removed.

---

## 10. Batch 08 — volcanic terrain, cliffs, and caves

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 68 | Straight ochre cliff | `14 × 6 × 10 m` | Slightly wider and lower than basalt cliff benchmark; one major cliff bay | 16,000 | 8,000 / 3,000 |
| 69 | Concave cliff corner | `12 × 12 × 10 m` | Two cliff bays meeting at 90°; same height class as straight ochre cliff | 18,000 | 9,000 / 3,500 |
| 70 | Overhanging outer corner | `13 × 13 × 12 m` | Similar height to basalt cliff; broader footprint and visible underside | 20,000 | 10,000 / 3,800 |
| 71 | Sea-cave mouth | `16 × 8 × 10 m` | Clear opening `10 × 7 m`; slightly wider than basalt tunnel entrance | 18,000 | 9,000 / 3,500 |
| 72 | Cave interior bend | `12 × 12 × 8 m` | Clear passage `7 × 6 m`; one 90° route/cave module | 22,000 | 11,000 / 4,000 |
| 73 | Timber-braced mine mouth | `10 × 6 × 8 m` | Clear opening `6 × 5 m`; smaller than race tunnel and workshop width | 18,000 | 9,000 / 3,200 |
| 74 | Volcano summit cone | `30 × 28 × 22 m` | Major skyline mass; similar height to loop and below sea stack | 30,000 | 14,000 / 4,500 + impostor |
| 75 | Crater-rim segment | `18 × 8 × 7 m` | 60° arc; six segments form roughly a 34 m diameter rim | 16,000 | 8,000 / 3,000 |
| 76 | Volcanic lava vent | `7 × 6 × 5 m` | Similar footprint to medium boulder cluster; taller than shack doorway | 10,000 | 5,000 / 1,600 |
| 77 | Lava-pool surround | `12 × 9 × 2 m` | Low hazard ring slightly larger than tide pool; separate shader insert | 9,000 | 4,500 / 1,500 |

### Volcanic-terrain notes

- Cliff modules share height classes and connector conventions so straight, inner-corner, outer-corner and tunnel pieces can overlap without thin cracks.
- Cave and tunnel clearance is gameplay-authoritative; concept shells are rebuilt around validated collision volumes.
- Large terrain pieces spend geometry on silhouette, overhangs and openings, while strata and small fractures remain in Normal/Height maps.
- Volcano summit and crater rim use HLOD/impostors at skyline distance.
- Lava vent emissive cracks and the pool insert use separate Emissive maps/materials; no orange light is baked into BaseColor.
- Lava, smoke, heat haze and particles are runtime effects, never opaque Meshy geometry.

---

## 11. Batch 09 — impact-destruction chunk families

Family dimensions below describe the complete review-kit envelope. Runtime chunks spawn as separate pieces using the listed piece-size range, not as one rubble cluster.

| # | Asset | Family envelope / piece range | Relative scale and use | Suggested family LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 78 | Timber debris family | `6 × 4 × 2 m`; pieces `0.35–2.8 m` | Splinters from rails, beams, decks and huts; largest piece under three balls long | 5,000 | 2,400 / 900 |
| 79 | Iron debris family | `6 × 4 × 2.5 m`; pieces `0.3–3.0 m` | Girder, plate and bracket fragments; lower count/heavier motion than timber | 5,500 | 2,600 / 1,000 |
| 80 | Basalt debris family | `5 × 4 × 2.5 m`; pieces `0.3–2.5 m` | Chips through medium blocks; largest roughly half boulder-cluster height | 4,000 | 2,000 / 700 |
| 81 | Ochre-rock debris family | `6 × 4 × 2 m`; pieces `0.25–2.8 m` | Layer-aligned slabs from cliffs and arches | 4,000 | 2,000 / 700 |
| 82 | Masonry debris family | `6 × 4 × 2.5 m`; pieces `0.3–2.5 m` | Block/wall fragments sized against 1 m ball and parapet courses | 5,000 | 2,400 / 900 |
| 83 | Road-surface debris family | `6 × 4 × 1 m`; pieces `0.3–2.5 m` | Thick crust fragments; cosmetic only where road width is protected | 4,000 | 2,000 / 700 |
| 84 | Dirt-clod debris family | `5 × 3 × 1.5 m`; pieces `0.2–1.8 m` | Low-density clods with broad spread and short collision lifetime | 3,000 | 1,400 / 450 |
| 85 | Foliage debris family | `7 × 5 × 3 m`; pieces `0.5–3.5 m` | Attached branch/frond masses; no individual leaf bodies | 6,000 | 2,800 / 800 + cards |
| 86 | Lava-crust debris family | `6 × 4 × 1.5 m`; pieces `0.3–2.5 m` | Thick cooled plates with separate emissive fracture surfaces | 4,500 | 2,200 / 750 |
| 87 | Machinery debris family | `6 × 4 × 2 m`; pieces `0.25–2.5 m` | Housing, plate, axle and bracket pieces; no loose micro-fasteners | 5,500 | 2,600 / 900 |

### Destruction-budget notes

- Per-piece budgets and runtime behavior are governed by [`ISLAND_DESTRUCTION_AND_CHUNK_STANDARD.md`](./ISLAND_DESTRUCTION_AND_CHUNK_STANDARD.md).
- Family triangle counts assume all six pieces are simultaneously visible; ordinary impacts spawn a subset.
- Collision uses near-convex proxies of 8–80 triangles per piece and is disabled quickly.
- Chunk LOD prioritizes closed outer silhouette and broad fracture face; small chips convert to particles or disappear at distance.
- One family serves many impacts through seeded piece selection, rotation, uniform scale and subtle material variation.
- Fracture-face BaseColor/Roughness/Normal and any Emissive remain separate, calibrated PBR channels.

---

## 12. Batch 10 — dense coverage and texture-bake masses

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 88 | Dense palm grove | `18 × 14 × 13 m` | Several palm crowns across roughly six lanes; one broad tropical coverage cell | 18,000 | 9,000 / 3,000 + impostor |
| 89 | Dense broadleaf forest | `22 × 18 × 12 m` | Wider than jungle tree pair; major forest coverage cell | 20,000 | 10,000 / 3,200 + impostor |
| 90 | Dense fern/understory mat | `12 × 9 × 2.5 m` | One road-module footprint and near doorway height | 8,000 | 4,000 / 1,200 + impostor |
| 91 | Dense jungle edge | `24 × 8 × 10 m` | Long biome-edge strip; approximately eight lanes long | 20,000 | 10,000 / 3,200 + impostor |
| 92 | Dense highland scrub | `16 × 11 × 7 m` | Medium exposed-slope coverage with low tree crowns | 14,000 | 7,000 / 2,200 + impostor |
| 93 | Dense rock/scree field | `18 × 14 × 5 m` | Broad rubble cell larger than boulder cluster and below cliff height | 12,000 | 6,000 / 2,000 |
| 94 | Dense beach driftwood | `14 × 8 × 3 m` | Long low shoreline pile; slightly above doorway height | 10,000 | 5,000 / 1,600 |
| 95 | Dense timber scrap pile | `10 × 8 × 4 m` | Workshop-scale clutter mass; below shack roof height | 12,000 | 6,000 / 1,800 |
| 96 | Dense masonry salvage | `11 × 9 × 4.5 m` | Roughly one road-module footprint; dense settlement/industrial pile | 14,000 | 7,000 / 2,200 |
| 97 | Dense lava rubble | `16 × 12 × 3.5 m` | Broad volcanic coverage cell; below vent height | 12,000 | 6,000 / 1,800 + emissive impostor |

### Dense-coverage notes

- These budgets assume perimeter hero forms plus a simplified interior shell, not complete source models hidden inside the center.
- Remove buried geometry and bake dense interior detail to shared atlases or impostors.
- LOD2 retains outer contour and several anchor forms; the interior becomes one or two broad shells.
- Vegetation budgets are also constrained by alpha overdraw, wind vertices, shadow cards, and material count.
- Use one material where possible and no more than two for normal coverage assets.
- Collision uses coarse hulls only; groundcover is commonly non-colliding.
- See [`ISLAND_DENSE_COVERAGE_STANDARD.md`](./ISLAND_DENSE_COVERAGE_STANDARD.md) for shell, bake, silhouette, collision, placement, and impostor rules.

---

## 13. Batch 11 — landmarks, secrets, and utility props

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 98 | Goblin lighthouse | `9 × 9 × 18 m` | Slightly taller than windmill; major coastal skyline landmark | 24,000 | 12,000 / 4,000 + impostor |
| 99 | Shipwreck hull | `18 × 7 × 7 m` | Bridge-span length and workshop height; broad shoreline landmark | 24,000 | 12,000 / 4,000 |
| 100 | Crashed balloon | `10 × 7 × 5 m` | Workshop footprint but lower; compact ledge story prop | 16,000 | 8,000 / 2,800 |
| 101 | Marble shrine | `7 × 5 × 5 m` | Similar footprint to lava vent; sphere roughly two ball diameters | 14,000 | 7,000 / 2,400 |
| 102 | Armored sheep statue | `5 × 3 × 5 m` | Roughly shack height on a narrow monument footprint | 12,000 | 6,000 / 2,000 |
| 103 | Kraken tentacle arch | `14 × 8 × 10 m` | Race-clear opening spans standard road; tunnel-height landmark | 18,000 | 9,000 / 3,000 |
| 104 | Skeleton treasure set | `4 × 3 × 2.5 m` | Slightly above doorway height; compact close-range secret | 14,000 | 7,000 / 2,200 |
| 105 | Dock supply cluster | `5 × 4 × 3 m` | Medium prop pile; approximately two lanes wide | 10,000 | 5,000 / 1,600 |
| 106 | Goblin ore cart | `3 × 2 × 2 m` | Door-height vehicle prop; clear beside 1 m racing ball | 10,000 | 5,000 / 1,600 |
| 107 | Mine rail segment | `2 × 8 × 0.3 m` | Eight-ball repeat length; narrow utility route | 4,000 | 2,000 / 700 |

### Landmark and prop notes

- Lighthouse, shipwreck and tentacles need impostor/HLOD treatment when visible across the island.
- Skeleton, treasure, cart and supply props preserve silhouette details but bake coins, grain, wicker and small hardware into PBR maps.
- Balloon cloth requires broad connected folds; no thin loose fabric or rope geometry at distant LOD.
- Tentacle suckers reduce to Normal/Height detail after LOD0 except those affecting outer silhouette.
- Mine rails retain exact connectors and gauge; repeated segments instance and avoid doubled sleepers.
- Landmark practical lights, lava glow and other emissives remain separate material channels.

---

## 14. Batch 12 — industrial, settlement, track-detail, and VFX support

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 108 | Goblin foundry hut | `10 × 8 × 8 m` | Slightly larger/taller than workshop; one-road-width industrial building | 26,000 | 13,000 / 4,500 |
| 109 | Chimney/pipe cluster | `5 × 4 × 9 m` | Narrow industrial vertical accent; below watchtower height | 14,000 | 7,000 / 2,200 + impostor |
| 110 | Work platform | `8 × 6 × 4 m` | One broad modular deck; lower than workshop doorway-plus-roof | 14,000 | 7,000 / 2,500 |
| 111 | Dock pier segment | `6 × 12 × 5 m` | Two-lane deck width and one road-module length | 16,000 | 8,000 / 2,800 |
| 112 | Patched market awning | `6 × 4 × 4 m` | Two-lane-width shelter; below shack roof | 10,000 | 5,000 / 1,600 |
| 113 | Goblin tool rack | `3 × 1 × 2.5 m` | Door-height close prop; compact workshop dressing | 8,000 | 4,000 / 1,200 |
| 114 | Track drainage grate | `3 × 1 × 0.25 m` | One lane wide and road-flush | 2,500 | 1,200 / 400 |
| 115 | Track boost inlay | `6 × 3 × 0.20 m` | Two lanes long by one lane wide; road-flush | 4,000 | 2,000 / 650 |
| 116 | Waterfall ribbon mesh | `6 × 1 × 12 m` | Two lanes wide, cliff-module height | 800 | 400 / 120 or shader proxy |

### Industrial and VFX-support notes

- Foundry lights, fire, smoke, steam and glow remain separate runtime effects/material channels.
- Pipe interiors and hidden building faces are removed; only visible routing and silhouette receive geometry.
- Dock piles and platform supports require underside LOD only when visible from lower routes.
- Cloth awning folds simplify aggressively after LOD0; small fabric weave stays in Normal/Roughness.
- Tool silhouettes remain broad at LOD0, then bake into a rack card/atlas for distance.
- Drainage grate openings may collapse to Normal/Opacity detail at distant LOD.
- Boost-pad emissive is separate and does not bake glow into BaseColor.
- Waterfall mesh remains low-poly; scrolling normal, opacity, foam, refraction and spray supply fidelity.

---

## 15. Batch 13 — runtime VFX support geometry

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 117 | Shoreline foam ribbon | `16 × 2 × 0.05 m` | Long shore edge, narrower than one lane | 400 | 200 / shader proxy |
| 118 | Waterfall splash ring | `8 × 6 × 1.5 m` | Plunge-pool center scale with low splash height | 600 | 300 / shader proxy |
| 119 | Mist card cluster | `8 × 6 × 4 m` | Pool-scale atmospheric volume | 120 | 60 / billboard |
| 120 | Smoke emitter housing | `2 × 2 × 2.5 m` | Small chimney-cap module | 4,000 | 2,000 / 600 |
| 121 | Steam vent emitter | `2.5 × 2.5 × 0.8 m` | Low terrain/road-flush vent | 4,000 | 2,000 / 600 |
| 122 | Lava crack decal | `8 × 5 × 0.04 m` | Multi-lane terrain overlay | 500 | 250 / shader proxy |
| 123 | Lantern flame insert | `0.35 × 0.35 × 0.8 m` | Fits lantern housing; sub-ball scale | 200 | 80 / billboard |
| 124 | Impact dust cards | `3 × 3 × 2 m` | Local ball-impact volume | 150 | 70 / billboard |
| 125 | Leaf burst cards | `3 × 3 × 2.5 m` | Local foliage-impact volume | 150 | 70 / billboard |
| 126 | Boost trail ribbons | `1.5 × 8 × 0.8 m` | Ball-width trail extending eight diameters | 300 | 150 / shader proxy |

### VFX-support notes

- These triangle budgets are ceilings; card/ribbon meshes should usually be far below them.
- Opacity, UV scrolling, distortion, depth fade, soft particles, emissive and animation provide detail.
- Do not model droplets, smoke wisps, sparks, foam bubbles, dust grains or individual flying leaves.
- Disable collision and shadow casting unless a specific effect requires it.
- Pool all effect meshes and materials; no runtime mesh creation.
- Overdraw, fill rate and particle count are more important than triangle count for translucent effects.
- Use camera-facing billboards or shader proxies for distant LOD.

---

## 16. Batch 14 — modular road shapes and transitions

| # | Asset | Target size W × D × H | Relative scale and use | Suggested LOD0 triangles | LOD1 / LOD2 |
|---|---|---:|---|---:|---:|
| 127 | Gentle curve | `8 × 24 × 0.5 m`, 30° | Three ball-width lane; broad routing adjustment | 8,000 | 4,000 / 1,200 |
| 128 | Tight curve | `18 × 26 × 0.5 m`, 150° | Hairpin footprint; enforce playable 8 m lane | 14,000 | 7,000 / 2,000 |
| 129 | S-curve | `8 × 32 × 0.5 m` | Two opposing 30° bends; parallel ends | 12,000 | 6,000 / 1,800 |
| 130 | Split junction | `20 × 26 × 0.5 m` | One 8 m lane into two equal branches | 14,000 | 7,000 / 2,000 |
| 131 | Merge junction | `18 × 28 × 0.5 m` | Shallow asymmetric branch into main road; image pending | 14,000 | 7,000 / 2,000 |
| 132 | Dirt-to-timber transition | `8 × 12 × 0.7 m` | Short material and structure handoff | 7,000 | 3,500 / 1,000 |
| 133 | Timber-to-iron transition | `8 × 12 × 0.7 m` | Heavy deck-joint module | 9,000 | 4,500 / 1,300 |
| 134 | Bridge approach | `8 × 16 × 1.2 m` | Gentle 0.7 m rise into deck connector | 9,000 | 4,500 / 1,300 |
| 135 | Tunnel approach | `8 × 14 × 0.7 m` | Dirt-to-basalt floor with edge drainage | 8,000 | 4,000 / 1,200 |

### Modular-road notes

- Connector width, elevation, pivot, tangent and edge-beam sockets must be shared exactly across the road kit.
- Author direction variants through rotation or spline metadata, not duplicate left/right meshes.
- Keep road collision continuous and simpler than visual geometry; avoid seams that can catch the ball.
- Preserve broad silhouettes and structural bands through LOD2; bake small wear and fasteners.
- Track materials require complete BaseColor, Normal, Roughness and AO maps; iron may additionally use Metallic.

---

## 17. Texture density by class

| Asset class | Master texture | Target texel density | Notes |
|---|---:|---:|---|
| Hero loop, windmill, bridge | 4K | 512 px/m hero areas, 256 px/m secondary | Prefer trim sheets where repetition permits |
| Track and trestle modules | 2K–4K | 256 px/m | Shared timber/iron/road trims reduce memory |
| Cliff/coastal modules | 4K tileables + masks | 256 px/m base + detail normal | Avoid unique 4K per repeated rock module |
| Trees and palm clusters | 2K atlas | silhouette-driven | Alpha coverage and mip quality are critical |
| Understory/grass/vines | 1K–2K atlas | shared family atlas | Batch by biome/material |
| Medium rocks and props | 1K–2K | 256 px/m | Reuse rock materials with per-instance tint |
| Sea stack/arch | 4K tileables + masks | macro + detail layers | Do not use one giant unique texture |

Every texture set requires an authored roughness map. Texture memory, material count, and overdraw are reviewed together with triangle count.

---

## 18. Acceptance and variance

Every future reference asset must receive a row in this registry with bounding dimensions, a comparison to existing assets, an LOD0 triangle ceiling, LOD reductions, and texture class before its generated model is accepted.

Second-generation combination assets follow [`ISLAND_MODULAR_CLUSTER_STANDARD.md`](./ISLAND_MODULAR_CLUSTER_STANDARD.md). Their cleaned LOD0 budget normally targets 60–75% of the sum of the source objects' individual budgets, removing hidden contact faces, redundant interiors, fragile details, and tiny holes while protecting the outer silhouette.

An asset passes its performance budget when:

- dimensions match this registry or an approved gameplay override;
- LOD0 is at or below the listed triangle budget unless a documented close-camera need justifies more;
- LOD1 and LOD2 preserve silhouette without visible race-camera popping;
- material slots and texture resolution match the class budget;
- collision is separate and simple;
- repeated assets instance correctly;
- foliage overdraw and shadow cost pass profiling;
- the object reads at expected distance beside the 1 m ball, 2.2 m doorway, 9 m road, and related modules.

Record approved exceptions in the asset manifest rather than silently changing scale or density.
