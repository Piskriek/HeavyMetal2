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

## 6. Texture density by class

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

## 7. Acceptance and variance

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
