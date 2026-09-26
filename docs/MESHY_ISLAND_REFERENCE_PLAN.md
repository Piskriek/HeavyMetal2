# Meshy Island Stunt Map — Reference Pack and Handoff Plan

## Goal

This pack starts a new modular island terrain for **Heavy Metal GP 2 / Goblin Rally**:

- three readable routes descend from a mountain summit;
- a high route carries the hero loop and long launch ramp;
- a mid route uses timber scaffolding, bridges, banks and landing decks;
- a low route enters a cave behind a waterfall, then reappears on a lower deck;
- every major stunt is a separate 3D object that can be placed, duplicated or replaced in the builder;
- the first pass is intentionally a clean model/blockout pass: no foliage, crowds, vehicles, smoke, signs, logos or tiny surface clutter.

This is a **reference pack**, not runtime art. Do not add these PNGs to the sprite manifest or use them as in-game textures. They are supplied to Meshy (or its agent) as shape and proportion references.

## Reference images

All four files are in `public/art/meshy-reference/` and are 1536 × 1024 PNGs.

| File | Use it for | What must remain legible |
| --- | --- | --- |
| `island-overview-01.png` | Composition and macro layout | summit-to-lower-basin flow, three route heights, waterfall cave, bridge crossover, loop silhouette |
| `mountain-track-cutaway-01.png` | Terrain/cutaway reference | separate route layers, exposed rock section, cave entrance/exit, waterfall crossing and lane continuity |
| `stunt-object-kit-01.png` | Individual stunt-prop silhouettes | loop, scaffold tower, launch ramp, quarter-pipe, bridge jump, portals, waterfall curtain and landing platform |
| `terrain-modular-kit-01.png` | Modular terrain/connector kit | island slabs, downhill pieces, banked curves, tunnel/waterfall chunks, loop base, guard rail and small side boxes |

### Mega-scale revision

The first four references were deliberately compact. The **02** set raises the target to a full expansion-sized island: several mountain masses, long sightlines, deep ravines, multiple waterfalls, multiple route layers and stunt structures that are much taller than the surrounding terrain.

| File | Use it for | What must remain legible |
| --- | --- | --- |
| `mega-island-overview-02.png` | Macro world scale | several peaks, five route bands, giant loop, long bridges, deep water basin and underground shelf |
| `mega-cutaway-network-02.png` | Full route/cave network | separate mountain masses, long underground route, multiple cave portals and waterfall breakthroughs |
| `mega-stunt-structures-02.png` | Oversized stunt assets | towering loop, double loop, corkscrew, giant launch ramp, suspended bridge, scaffold tower and landing deck |
| `mega-terrain-kit-02.png` | Large modular chunks | mountain modules, long connectors, large tunnel sections, loop foundation, retaining walls and side boxes |

Use the **02** images as the primary references when the goal is the larger island. Keep the **01** images as close-up shape references for clean individual meshes.

### 10× scale revision

The **03** set is the new target: an island-scale world roughly **10× the footprint and route-length budget** of the original compact concept. This means more geographic regions and longer travel between stunts, not ten-times-thicker lanes or ten-times-heavier collision meshes. Keep the lane width and object thickness consistent; expand the world by adding modular terrain regions, long connectors, deep vertical layers and large unoccupied spaces.

| File | Use it for | What must remain legible |
| --- | --- | --- |
| `colossal-island-10x-overview-03.png` | Primary world-scale reference | one huge island footprint, central mountain range, outer plateaus, long routes, ocean perimeter and distant stunts |
| `colossal-island-10x-map-03.png` | Route planning reference | several geographic regions, route corridors across the full island, separated elevation bands and a central underground zone |
| `colossal-island-10x-cutaway-03.png` | Underground scale reference | long cave network, multiple underground tiers, waterfall shafts, large chambers and distant exits |
| `colossal-structures-10x-03.png` | Large structure reference | giant loops, long bridge spans, very long ramps, waterfall portals and repeated support bays |

Primary handoff order is now `colossal-island-10x-overview-03.png`, `colossal-island-10x-map-03.png`, then the cutaway and structures sheets. Do not shrink this back into a small tabletop scene when generating the Meshy models.

### Recommended image usage

1. Give `colossal-island-10x-overview-03.png` to the agent first as the **full world composition and scale reference**.
2. Give `colossal-island-10x-map-03.png` second as the **route-planning and geographic-region reference**.
3. Use `colossal-island-10x-cutaway-03.png` to generate the large underground terrain family.
4. Use `colossal-structures-10x-03.png` to generate the oversized loop, ramp, bridge, portal and scaffold family one at a time.
5. Keep the **02** images for closer mega-scale composition and the **01** images for individual shape close-ups.
6. Do not ask for one giant Meshy scene. The builder needs separate meshes with predictable pivots and clean collision surfaces.

### Coastal and beach pass

The new beach references add a proper coastal biome without changing the shape-first rule. Beaches should be broad navigable regions with pale sand, shallow lagoons, basalt outcrops, sandbars and water crossings. They are not narrow decorative strips around the island.

| File | Use it for | What must remain legible |
| --- | --- | --- |
| `colossal-beach-coastline-04.png` | Primary beach composition | broad beaches, lagoons, coastal route, boardwalk crossing, beach ramp and waterfall cave |
| `beach-terrain-kit-04.png` | Beach terrain modules | sand slabs, sand-to-basalt transitions, beach hairpins, lagoon bridges, sea cave and side boxes |
| `beach-coast-cutaway-04.png` | Beach elevation/collision | plateau-to-beach-to-water layers, boardwalk route and underground sea cave beneath the shore |
| `beach-stunt-kit-04.png` | Separate coastal stunt models | beach launch ramp, sand berm, pier, lagoon gap, beach loop support, portals and platforms |

Beach asset additions for the Meshy agent:

- `beach-slab-a`: thick flat-bottomed sand chunk with a clean water edge;
- `sand-basalt-transition-a`: modular slope from dark cliff to pale beach;
- `coastal-track-4lane-a`: wide sand or boardwalk route with square snap ends;
- `lagoon-bridge-a`: timber/iron bridge over shallow water;
- `beach-launch-a`: sand-supported stunt ramp with a separate landing deck;
- `sea-cave-portal-a`: open rock portal beneath the beach;
- `beach-waterfall-portal-a`: removable water curtain over a cave entrance;
- `sandbar-platform-a`: broad low landing island with collision-safe water boundary.

Keep beaches free of trees, palms, grass, bushes, shells and other foliage in this modeling pass.

## Meshy generation rules

### Global prompt

> Clean stylized low-poly 3D game asset for an original arcade stunt-racing island. Chunky readable silhouette, broad bevels, simple planar surfaces, restrained material breakup, weathered timber and dark iron braces over ochre basalt rock, studio lighting, neutral gray background, no foliage, no characters, no vehicle, no text, no logo, no UI, no smoke, no particles. Make the driving surface a continuous clean surface with no holes, no accidental props, and no thin decorative geometry. Model only the requested object, centered and fully visible, with the front/entry direction facing the camera.

### Negative prompt

> trees, leaves, grass, bushes, vines, mushrooms, flowers, crowd, goblin, car, marble, tire, fire, smoke, sparks, flags, signs, letters, numbers, logos, text, wires, dangling ropes, broken topology, floating pieces, paper-thin walls, noisy rocks, excessive bevels, sharp spikes on the driving line, hidden underside, cropped object, multiple unrelated objects, background scenery

### Non-negotiable shape requirements

- **Silhouette before texture.** The object must be recognizable as a solid shape in flat gray clay.
- **Driving surfaces are continuous.** No gaps between ramp, loop, landing or bridge pieces.
- **No foliage.** Rock, timber, iron and water are the entire first-pass material vocabulary.
- **Separate meshes.** Keep terrain, road deck, supports, guard rails and water curtains separable where practical.
- **Readable thickness.** Do not use single planes for rock, timber walls or waterfall portals; give them real thickness.
- **No microdetail.** Rivets and plank seams should be broad, sparse and secondary to the shape.
- **Keep openings open.** The loop interior, tunnel mouth and scaffold bays must not be filled by generated rock or wood.
- **Consistent forward axis.** Export the track entry-to-exit direction along local `+Z`; local `+Y` is up; local origin is on the driving surface at the entry center.
- **Apply transforms.** Export with scale applied, normals outward, no hidden cameras/lights, and no animation.

## Suggested asset breakdown

Generate these as independent assets rather than a single island scene.

| ID | Asset | Role | Shape notes |
| --- | --- | --- | --- |
| `island-base-a` | Island base slab | terrain | Thick, flat-bottomed chunk with 3–4 broad rock layers; attachment points for route pieces |
| `summit-wedge-a` | Mountain summit wedge | terrain | Three clean lane slots leaving one broad launch deck; strong peak silhouette |
| `track-straight-4lane-a` | Straight 4-lane deck | terrain/road | Width is exactly four lane modules; square ends for snapping |
| `track-bank-4lane-a` | Banked curve | terrain/road | One wide continuous deck with raised outer wall; no guard clutter on the racing line |
| `loop-large-a` | Large vertical loop | stunt/terrain | Circular timber deck with dark iron outer bands and triangular support feet; open interior |
| `ramp-launch-a` | Summit launch ramp | stunt/terrain | Long, steep, slightly crowned deck with solid side walls and rear braces |
| `ramp-quarter-a` | Quarter-pipe / return ramp | stunt/terrain | Clean concave transition; broad landing lip; separate support frame |
| `scaffold-bay-a` | Modular timber scaffold | support | Two-level bay with X-braces, square feet and a flat deck; duplicate-friendly |
| `bridge-span-a` | Ravine bridge | terrain/road | Straight deck, support posts, rail sockets at both ends |
| `landing-deck-a` | Stunt landing platform | stunt/terrain | Broad flat deck with thick edge rails and square connector ends |
| `tunnel-portal-a` | Rock tunnel portal | terrain | Thick stone arch, clear rectangular/rounded opening, short tunnel throat |
| `waterfall-portal-a` | Cave behind waterfall | terrain/visual | Solid, simple water curtain in front of an open tunnel; water must be removable |
| `loop-support-a` | Loop support base | support | Two triangular feet and crossbar, sized to the loop; no terrain fused to it |
| `guardrail-4lane-a` | Guard rail segment | decoration/collision | Repeating low iron/wood rail with square snap ends; avoid thin posts on lane center |
| `side-box-kit-a` | Small side boxes/barriers | decoration/collision | 2–3 chunky rectangular blocks for edge markers, jump guides and lane blockers |

## Provisional scale for the builder

Use these ratios first; convert to engine units only after the first import test. The 10× set is a world-scale target, not a literal single mesh: build it from many modules and let the builder own the final route length.

- Macro island target: **7–10 geographic regions**, **5–8 distinct route bands**, **4–6 deep ravines**, and **6+ waterfall/cave breakthroughs**.
- Coastal target: **2–4 broad beaches**, at least one large lagoon, one sandbar/landing region and a beach route that is long enough to feel like its own island sector.
- World footprint target: roughly **10× the original compact concept's island footprint and route length**, achieved through more regions and longer connectors, not thicker lanes.
- Stunt scale target: the hero loop and summit ramp should be **roughly 2–3 times the height of nearby scaffold bays**, with long bridge spans between separate terrain masses.
- Route spacing target: keep enough vertical and lateral separation that the upper route, mid route, coastal route and underground route read as separate tracks from the overview camera.
- One lane module: **1 unit of width**.
- Four-lane route: **4 units wide** at the clean deck surface.
- Marble diameter: about **0.26 lane units** (the game uses radius 31 and lane width 240).
- Standard guard rail height: **0.35 lane units** above the deck.
- Standard ramp width: **4 lane units** for a full-field stunt; half-width variants may be **2 lane units**.
- Loop deck width: **4 lane units**; inner opening should leave at least **2 marble diameters** of clearance above the deck and side rails.
- Scaffold bay: **2 lane units wide**, with a repeatable square footprint.
- Tunnel opening: at least **4 lane units wide** for a full-field route, with extra shoulder clearance around the rails.
- Side boxes: **0.5–1 lane unit** wide, never placed where they can unexpectedly intersect the physical route.

The existing game constants are the authority when these provisional ratios become real placements: lane width is 240 world units, the four-lane corridor is 960 units wide, and the marble radius is 31 units. Keep imported assets within the builder's documented scale envelope and inspect their generated AABB before placing them.

## Collision and pivot handoff

For the first playable blockout, classify assets as follows:

- `island-base-a`, `summit-wedge-a`, `track-*`, `bridge-span-a`, `loop-large-a`, `ramp-*`, `landing-deck-a`, `tunnel-portal-a`: **static terrain / drivable surface**.
- `scaffold-bay-a`, `loop-support-a`, `guardrail-4lane-a`, `side-box-kit-a`: **static decoration or barrier** unless they visibly overlap the driving surface.
- `waterfall-portal-a`: **visual decoration plus a separate tunnel collision volume**; the water curtain should not become an accidental solid wall.

For every asset, verify:

- local origin is at the entry-center deck contact point;
- local `+Z` points toward the exit;
- local `+Y` is world up;
- no negative scale or unapplied rotation remains;
- the mesh has a finite AABB and no disconnected accidental geometry;
- drivable pieces have a closed or intentionally documented collision surface;
- visible guard rails and supports do not silently elevate the physics surface.

The current custom-model UI accepts OBJ/GLTF/GLB by label, but its upload path currently sends the file through `parseOBJ`. For this first pass, ask Meshy for **OBJ export** or verify GLB loading in a separate importer change before relying on GLB. Keep the original Meshy source files outside the runtime art folder until an import format is confirmed.

## Suggested build order

1. **Blockout:** `island-base-a`, `summit-wedge-a`, `track-straight-4lane-a`, `track-bank-4lane-a`.
2. **Route spectacle:** `ramp-launch-a`, `loop-large-a`, `loop-support-a`, `landing-deck-a`.
3. **Vertical structure:** `scaffold-bay-a`, `bridge-span-a`, `guardrail-4lane-a`.
4. **Waterfall/cave:** `tunnel-portal-a`, `waterfall-portal-a`.
5. **Edge language:** `side-box-kit-a`, then one alternate loop/ramp/support set.
6. **Playtest:** place a summit-to-basin route, confirm lane continuity and collisions, then duplicate pieces to build the second and third routes.

Do not author foliage, crowd dressing, decals, destructibles or detailed lighting until the three routes are fun to drive and the imported collision surfaces agree with the visible decks.

## Acceptance checklist for the Meshy agent

- [ ] Every requested object is exported separately, not as one scene.
- [ ] All silhouettes read in a clay render and in a thumbnail.
- [ ] Route decks are continuous and have no holes or paper-thin walls.
- [ ] Loop, ramp, scaffold, tunnel and waterfall are visibly distinct objects.
- [ ] Waterfall cave has an actual visible opening behind the water curtain.
- [ ] No foliage, vehicles, characters, text, signs or logos appear.
- [ ] Origins, axes and applied transforms follow the handoff rules.
- [ ] Meshes stay within the project's import triangle/size budget; warn or decimate before export when needed.
- [ ] One OBJ import is tested in the builder before generating a full asset family.
- [ ] A placed test route confirms visual and physical surface agreement.
