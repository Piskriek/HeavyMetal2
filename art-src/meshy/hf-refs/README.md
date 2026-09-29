# Basalt Isle high-fidelity Meshy references

These are multi-angle, single-object reference sheets governed by [`docs/ISLAND_HIGH_FIDELITY_STYLE_BIBLE.md`](../../../docs/ISLAND_HIGH_FIDELITY_STYLE_BIBLE.md). Production dimensions, comparisons to the 1 m racing ball / 9 m standard road, and balanced triangle/LOD budgets are defined in [`docs/ISLAND_ASSET_SCALE_AND_TRIANGLE_BUDGET.md`](../../../docs/ISLAND_ASSET_SCALE_AND_TRIANGLE_BUDGET.md). Generated sheets communicate design and shape; the scale registry controls final cleanup.

Finish and approve the entire individual-object run first. A later image-generation pass will use these approved sheets as direct references for optimized modular combinations under [`docs/ISLAND_MODULAR_CLUSTER_STANDARD.md`](../../../docs/ISLAND_MODULAR_CLUSTER_STANDARD.md). Those clusters must remain readable close up and at distant LOD, with strong overlapping silhouettes, durable contact points, no floating thin geometry, and no unnecessary tiny holes.

## Batch 01 — benchmark set

![Batch 01 review contact sheet](./review/batch-01-contact-sheet.jpg)

| # | ID | Subject | Status | Review notes |
|---|---|---|---|---|
| 01 | `basalt-cliff-module` | Modular basalt cliff | pass | Eight readable views; coherent fractures, top and overhang; no decorative base. |
| 02 | `race-road-straight` | Straight road module | pass | Clear deck, connector ends, rails and underside bracing. Reads as a bridge-carried road module. |
| 03 | `race-road-banked-curve` | Banked curve module | pass | Nine views clearly describe curve, banking, outer wall and support structure. |
| 04 | `timber-trestle-tall` | Tall timber trestle bay | pass | Strong repeated cross-bracing, cap and structural feet; suitable benchmark construction grammar. |
| 05 | `palm-tall-leaning` | Tall leaning palm | pass | Useful cardinal, three-quarter, canopy-top and canopy-underside views; exposed roots, no sand base. |
| 06 | `goblin-windmill` | Goblin windmill | pass | Ten views with stable tower, blade, platform and rear-construction identity. |
| 07 | `vertical-loop` | Timber-and-iron vertical loop | pass | Side, through-opening, three-quarter, top and support views; clear approach/exit. Engineering dimensions still come from physics blockout. |
| 08 | `launch-ramp-reinforced` | Reinforced launch ramp | pass | Profile, approach, top and underside panels clearly expose launch angle and bracing. |
| 09 | `basalt-tunnel-entrance` | Basalt tunnel entrance | pass | Consistent arch, profiles, top and interior coverage; naturally open bottom with no terrain cookie. |
| 10 | `cliff-bridge-timber-iron` | Timber-and-iron cliff bridge | pass | Strong entry, broadside, three-quarter, top and underside coverage; readable truss and deck. |

## Batch 02 — modular vegetation clusters

![Batch 02 vegetation review contact sheet](./review/batch-02-vegetation-contact-sheet.jpg)

| # | ID | Subject | Status | Review notes |
|---|---|---|---|---|
| 11 | `palm-cluster-three` | Three-palm cluster | pass | Strong varied-height silhouette, coherent roots, cardinal views and canopy coverage. |
| 12 | `jungle-understory-cluster` | Broadleaf understory | pass | Compact modular footprint with useful plant-height variation and top/underside views. |
| 13 | `fern-cluster-large` | Large fern cluster | pass | Clean repeatable fern module with strong crown consistency and no terrain base. |
| 14 | `flowering-shrub-cluster` | Flowering shrubs | pass | Readable woody structure, controlled coral accents, top and underside coverage. |
| 15 | `coastal-grass-cluster` | Coastal grass and scrub | pass | Regenerated without labels; eight clean views preserve the compact windswept module. |
| 16 | `broadleaf-tree-cluster` | Two-tree broadleaf cluster | pass | Strong interlocking canopy, exposed roots, readable branch and canopy views. |
| 17 | `windswept-highland-trees` | Wind-shaped highland pair | pass | Clear shared wind direction, sparse crown language, suitable for exposed upper slopes. |
| 18 | `hanging-vine-cluster` | Hanging vine curtain | pass | Multiple hanging silhouettes and useful top attachment views; no wall/support baked in. |
| 19 | `cliff-creeper-cluster` | Cliff creeper network | pass | Low modular creeping mass with varied silhouettes and no included cliff geometry. |
| 20 | `driftwood-root-cluster` | Driftwood/root dressing | pass | Stable root and broken-limb silhouette with complete radial/top coverage. |

## Batch 03 — rocks, coastal terrain, and waterfall geology

![Batch 03 terrain review contact sheet](./review/batch-03-terrain-contact-sheet.jpg)

| # | ID | Subject | Status | Review notes |
|---|---|---|---|---|
| 21 | `basalt-boulder-cluster` | Basalt boulder cluster | pass | Strong size hierarchy and radial/top coverage; clean natural footprint. |
| 22 | `ochre-rock-slab-cluster` | Layered ochre slabs | pass | Readable eroded strata and low modular silhouette from eight views. |
| 23 | `scree-cluster-mixed` | Mixed scree cluster | pass | Stable basalt/ochre composition with useful top and underside views. |
| 24 | `sea-stack-hero` | Hero coastal sea stack | pass | Strong cardinal silhouette, basalt foot and ochre crown; no ocean or decorative base. |
| 25 | `natural-sea-arch` | Natural coastal arch | pass | Consistent opening and crown thickness with front/rear/profile/top coverage. |
| 26 | `beach-shelf-module` | Coastal shelf transition | pass | Clear land/water-facing profiles, modular edges and top surface. |
| 27 | `tide-pool-rock-ring` | Tide-pool surround | **weak—regenerate** | Geometry is useful, but forbidden letters appeared between panels. Regenerate after refresh. |
| 28 | `waterfall-lip-rock-module` | Bare waterfall lip | pass | Channel, spill edge, profiles, connectors and top are clearly exposed. |
| 29 | `plunge-pool-rocks` | Plunge-pool surround | pass | Strong inflow/outflow gaps and radial/top coverage with no water baked in. |

## Shared review result

- One object identity per sheet with multiple useful angles.
- Neutral grey floor/background and no visible environmental horizon.
- Neutral, broadly consistent studio lighting.
- No presentation plinths or decorative terrain bases.
- No text, dimensions, arrows, characters, or environmental scenery.
- All sheets remain concept references: Meshy output still requires scale correction, retopology, UV/PBR validation, LODs, and collision.
