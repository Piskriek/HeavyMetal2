# Grand Landscape Material Standard

Aerial PBR materials make very large generated worlds readable from mountain, flight, map and distant racing viewpoints. They are macro layers in a recursive terrain preset—not photographs pasted over playable ground.

## 1. Nested scale stack

Each landscape preset combines four independent scales:

| Layer | Typical coverage | Purpose |
|---|---:|---|
| Continental/biome | `2–16 km` | Major climate, mountain, basin, coast and vegetation distribution |
| Macro material | `256 m–1 km` | Fields, ridges, watersheds, canopy masses, dunes and wetland channels |
| Ground material | `2–8 m` | Rock, soil, grass, scree, mud and sand surface response |
| Detail | `0.05–1 m` | Leaves, pebbles, cracks, tracks, stains and scatter |

The camera blends between layers by projected texel size. Macro color and height must fade before they look like painted terrain beneath the player; near-ground PBR and geometry take over smoothly.

## 2. Required channels

Every macro material requires:

- BaseColor without directional sunlight, cloud shadows, atmospheric haze or AO;
- tangent or world-space Normal derived from the registered height source;
- authored Roughness;
- Height in documented world units;
- AO used sparingly and never baked into BaseColor;
- biome/material masks for vegetation, rock, soil, water, snow or cultivation as applicable;
- flow direction for rivers, wetlands, dunes, lava and drainage where relevant.

The four-square generated sheets are derivation references. Production channels must be rebuilt from one shared procedural or authored data source and validated as seamless.

## 3. Terrain geometry and displacement

- Macro Height may shape terrain only through a controlled, low-frequency displacement pass.
- Register minimum, maximum and mean elevation for every preset; never infer metre scale from grayscale at runtime.
- Clamp slopes to traversal and erosion rules before road placement.
- Preserve drainage direction after blending adjacent presets; rivers cannot climb a seam.
- Use signed distance or blend bands at biome boundaries rather than averaging incompatible height fields blindly.
- Keep cliffs, cave mouths, arches and track supports as terrain features or modular geometry, not painted height illusions.
- Collision comes from the final terrain surface, never the rendered parallax layer.

## 4. Recursive biome generation

A macro material is itself an editable preset. Examples:

- Farmland → field cell → crop/soil material → hedgerow → gate/track scatter.
- Mountain → watershed → ridge/scree/cliff → rock material → boulder and foliage scatter.
- Forest canopy → crown mass → species distribution → tree cluster → bark/leaf materials.
- River valley → channel/floodplain/upland → water preset → banks, wetlands and debris.
- Wetland → tidal channel → mudflat/mangrove island → waterline growth and roots.

`Dive In` exposes the next scale; `Dive Out` shows how edits affect the larger terrain. Seeds remain deterministic, and detached child regions retain local overrides.

## 5. Landscape-specific rules

### Farmland

- Generate field boundaries from a tileable cell graph, then assign crop/fallow materials per cell.
- Roads and hedgerows must connect across preset boundaries.
- Buildings, fences, vehicles and individual trees remain spawned geometry, not BaseColor detail.

### Mountains

- Height begins with a connected watershed network; normal and color derive from it.
- Snow, scree and vegetation follow altitude, slope, aspect and moisture.
- Avoid one centered hero peak, radial starburst erosion and repeated crater stamps.

### Forests

- Aerial canopy supplies broad color/height masses only.
- Near and mid views replace canopy texture with dense cluster shells, trees and impostors.
- Canopy gaps drive undergrowth, ground darkness and navigation—not random black holes.

### Rivers and wetlands

- Channels enter and exit tile boundaries with registered flow vectors.
- Water surface elevation remains physically monotonic downstream.
- Floodplains, banks, wetness and vegetation derive from distance-to-channel masks.
- The visible water uses scrolling water presets; macro maps define placement and depth context.

### Dunes and volcanic flows

- Store a flow vector and use it to orient ridges, strata, decals and scatter.
- Blend rotations through vector fields rather than abruptly rotating the texture.
- Volcanic materials separate cooled crust, ash and emissive lava; bright crater lighting never belongs in BaseColor.

## 6. Anti-repetition strategy

- Blend at least two rotated or mirrored macro samples only where directional rules permit.
- Use biome-scale low-frequency masks to vary hue, roughness, density and erosion.
- Support stochastic texture sampling or virtual-texture synthesis for large expanses.
- Place authored landmarks independently so macro tiles do not repeat lighthouses, farms or craters.
- Test from top-down map view, wide oblique gameplay view and ground level.
- A repeated feature must not be recognizable within the camera's maximum visible range.

## 7. Geometry spawning from maps

Macro masks may spawn near-detail systems:

- forest/canopy masks spawn approved tree and understory clusters;
- farmland boundaries spawn hedges, fences and dirt tracks;
- scree masks spawn rock coverage and selected hero stones;
- river banks spawn reeds, driftwood, mud and waterline decals;
- dune crests spawn wind streaks and sparse scrub;
- volcanic channels spawn crust modules, cinders, mist and lava VFX.

Use blue-noise placement and deterministic seeds. Dense centers may become texture coverage; boundaries receive the strongest silhouette geometry. Respect roads, water, track clearance, buildings and gameplay exclusion masks.

## 8. Streaming, LOD, and baking

- Prefer clipmaps, runtime virtual textures or equivalent terrain streaming for kilometre-scale surfaces.
- Maintain consistent mip generation across BaseColor, Normal, Roughness, Height and masks.
- At long range, bake spawned geometry into macro color/normal/height or impostor layers.
- At close range, fade macro normal and displacement to prevent double relief with ground materials.
- Stream biome masks at lower resolution than visible surface maps when rules tolerate it.
- Use the same source data for map view, terrain shading and spawn rules to prevent disagreement.
- Profile texture residency, terrain tessellation, virtual-texture feedback and vegetation draw cost separately.

## 9. Acceptance tests

A grand-landscape material passes when:

- all four edges survive a 3 × 3 tile test;
- BaseColor contains no directional light, haze, labels, map symbols or cast shadows;
- channels align to one authoritative height/mask source;
- registered metre scale produces plausible field, ridge, river, canopy or dune sizes;
- terrain seams preserve height and drainage;
- the material transitions cleanly to near-ground PBR and geometry;
- no repetition is obvious from the maximum gameplay or map-view altitude;
- roads, rivers and biome boundaries connect across adjacent presets;
- the generated world remains recursively editable, deterministic and bakeable.
