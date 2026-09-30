# Basalt Isle seamless PBR material references

These sheets establish material breakup, color range, weathering scale, and channel intent for the high-fidelity island kit. They are **derivation references**, not engine-ready textures.

![Material Batch 01 contact sheet](./review/material-batch-01-contact-sheet.jpg)

## Four-square convention

Every sheet uses the same fixed 2 × 2 arrangement:

| Position | Channel | Authoring requirement |
|---|---|---|
| Top left | BaseColor | Linear material color only; no baked direct light, highlights, cast shadows, or AO |
| Top right | Normal | Tangent-space RGB normal; DirectX/OpenGL green-channel orientation must be selected during implementation |
| Bottom left | Roughness | Linear grayscale roughness; white is rough, black is smooth |
| Bottom right | AO / height reference | Grayscale form guide; derive separate AO and height maps rather than packing this image directly |

Generated maps may look coordinated but are not mathematically derived from one height field. Production artists must rebuild/bake the channels, remove gutters, make the crop exactly square, verify edge continuity with a 3 × 3 tile test, remove baked lighting, and validate normal vectors before import. Every delivered textured material requires BaseColor, Normal, Roughness, and AO. Add Height and Metallic where the material class needs them.

## Material Batch 01 — terrain and structural foundations

| ID | Material | Primary use | Recommended real-world coverage | Status and production note |
|---|---|---|---:|---|
| M001 | Basalt cliff | Cliffs, cave mouths, boulders | `4 × 4 m` | Pass as derivation reference. Strong broad plates; rebuild cracks from one shared height source. |
| M002 | Ochre layered cliff | Dry cliffs, shelves, strata | `4 × 4 m` | Pass. Good horizontal strata; use macro variation to avoid visible band repetition. |
| M003 | Compacted race dirt | Main drivable road | `4 × 4 m` | Weak—regenerate. Useful color/roughness range, but the radial swirl is too directional and will expose tiling. |
| M004 | Volcanic ash and cinder | Crater slopes, soot beds | `3 × 3 m` | Weak—regenerate. The starburst flow is unsuitable for a seamless general-purpose tile. |
| M005 | Wet coastal basalt | Tide pools, wet cliff feet | `3 × 3 m` | Pass with shape constraint. Keep broad eroded cells irregular and break the cobble-like repetition with macro masks. |
| M006 | Tropical beach sand | Beach shelves, sandbars | `3 × 3 m` | Weak—regenerate. Color is useful, but deep slab-like cuts must become shallow wind ripples. |
| M007 | Mossy jungle soil | Forest floor, humid banks | `2 × 2 m` | Weak—regenerate. Current breakup reads as loose rubble; production needs compact loam with decomposed organic staining. |
| M008 | Weathered structural timber | Trestles, huts, bridges | `1.5 × 1.5 m` | Pass. Broad vertical grain survives LOD; board seams and fasteners remain geometry or trim-sheet details. |
| M009 | Blackened forged iron | Girders, straps, machines | `1 × 1 m` | Pass. Restrained forged variation; use Metallic = 1 except rust/contamination masks. |
| M010 | Aged brass | Rivets, collars, controls | `0.75 × 0.75 m` | Weak—regenerate. Current surface reads like yellow stone; next pass needs finer hammered metal and controlled patina. |

## Material Batch 02 — ground and natural surfaces

![Material Batch 02 contact sheet](./review/material-batch-02-contact-sheet.jpg)

| ID | Material | Primary use | Recommended real-world coverage | Status and production note |
|---|---|---|---:|---|
| M011 | Mud and puddle edge | Runoff, low ground, track margins | `2 × 2 m` | Pass as breakup reference. Separate mud and wetness into blendable layers; soften the repeated round puddle shapes. |
| M012 | Dry dusty dirt | Dry paths, shoulders, disturbed terrain | `3 × 3 m` | Pass. Broad low-relief variation supports tiling and does not over-model individual grains. |
| M013 | Road shoulder aggregate | Track edges and repair zones | `2 × 2 m` | Pass. Controlled embedded basalt chips with clear channel correspondence. |
| M014 | Loose mixed scree | Talus, cliff feet, gravel beds | `2 × 2 m` | Pass. Dense readable packing and useful material/color variation; add macro masks at terrain scale. |
| M015 | Cooled lava crust | Volcanic shelves and crater | `3 × 3 m` | Pass after regeneration. Broad ropy folds, restrained heat staining and strong cross-channel correspondence. |
| M016 | Molten lava | Lava pools and channels | `3 × 3 m` | Pass as mask reference. Derive BaseColor and Emissive separately and animate flow in shader. |
| M017 | Dry coastal rock | Beach shelves and salt rock | `3 × 3 m` | Weak—regenerate. Current deep vertical cuts read as a cliff face rather than a broadly eroded tile. |
| M018 | Wet ochre waterfall rock | Waterfall channels and wet ledges | `3 × 3 m` | Pass. Strong strata and vertical wetness language; BaseColor must exclude generated shading. |
| M019 | Basalt cave wall | Tunnel and cavern walls | `3 × 3 m` | Pass with variation constraint. Broad erosion pockets work; reduce repeated circular cavities in the production height source. |
| M020 | Basalt cave floor | Driveable cave and tunnel floor | `3 × 3 m` | Pass. Low relief, restrained damp patches and broad plate structure support gameplay collision. |

## Material Batch 03 — foliage and organic surfaces

![Material Batch 03 contact sheet](./review/material-batch-03-contact-sheet.jpg)

Foliage atlases retain BaseColor, Normal, and Roughness in the first three positions. Their bottom-right quadrant is an **Opacity/AO composite reference**: black is outside the cutout, white is exposed leaf surface, and grey describes internal overlap. Production must derive separate binary/dithered opacity and AO maps from this reference; do not import the composite directly.

| ID | Material | Primary use | Recommended coverage | Status and production note |
|---|---|---|---:|---|
| M015 | Cooled lava crust | Volcanic shelves and crater | `3 × 3 m` | Pass after regeneration. Broad nondirectional rope folds and restrained heat staining. |
| M021 | Palm trunk bark | Palm trunks | `1.5 × 1.5 m` | Pass. Broad horizontal growth rings and simple fibers remain readable through LOD. |
| M022 | Broadleaf tree bark | Jungle tree trunks and branches | `1.5 × 1.5 m` | Pass. Deep irregular vertical plates with restrained color variation. |
| M023 | Salt-weathered driftwood | Wreckage and shore dressing | `1.5 × 1.5 m` | **Weak—regenerate.** Material language is useful, but the sheet contains forbidden generated headings and channel labels. |
| M024 | Palm frond atlas | Palm canopy cards | atlas | Pass. Six complete, well-padded silhouettes with useful age/color variation. |
| M025 | Broadleaf canopy atlas | Jungle canopy cards | atlas | Pass. Eight broad leaf silhouettes and clean channel correspondence. |
| M026 | Fern leaf atlas | Understory cards | atlas | Pass. Complete fronds with varied poses and strong alpha-test silhouettes. |
| M027 | Coastal grass atlas | Grass cards and clump shells | atlas | Pass. Grouped thick blades in green/straw variants; readable at distance. |
| M028 | Hanging vine atlas | Cliff, bridge and canopy vines | atlas | Pass. Six complete vine strips with broad leaves and wind-ready segmentation. |
| M029 | Cushion moss | Damp rock and soil blends | `1 × 1 m` | **Weak—regenerate.** Good cushion forms, but generated channel labels violate the clean-sheet standard. |

## Material Batch 04 — built materials

![Material Batch 04 contact sheet](./review/material-batch-04-contact-sheet.jpg)

| ID | Material | Primary use | Recommended real-world coverage | Status and production note |
|---|---|---|---:|---|
| M030 | Fresh-cut timber | New repairs, clean structural beams | `1.5 × 1.5 m` | Pass. Warm broad grain complements the older M008 timber without duplicating it. |
| M031 | Charred timber | Burned structures and impact damage | `1.5 × 1.5 m` | **Weak—regenerate.** Material language is useful, but the generator returned a `1408 × 768` landscape sheet instead of the required square 2 × 2 format. |
| M032 | Heavy rope | Bridges, cranes, rigging and moorings | `0.5 × 0.5 m` | Pass with construction constraint. Use the bold braid as a tiling rope surface; geometry must provide the cable silhouette. |
| M033 | Weathered sailcloth | Shipwreck sails, banners and shade cloth | `1 × 1 m` | **Weak—regenerate.** Current basket-like weave is too coarse and reads as interlocking strips rather than woven canvas. |
| M034 | Patched goblin canvas | Awnings, tents and workshop covers | `2 × 2 m` | **Weak—regenerate.** Patch language works, but forbidden generated channel labels must be removed. |
| M035 | Cut basalt masonry | Shrines, tunnel retaining walls | `3 × 3 m` | Pass. Strong regular courses, readable mortar and restrained surface variation. |
| M036 | Ochre rubble masonry | Settlement walls and retaining structures | `3 × 3 m` | Pass. Warm irregular blocks contrast clearly with basalt masonry. |
| M037 | Painted goblin metal | Machines, carts and race structures | `1 × 1 m` | Pass with cleanup. Preserve broad chipped green paint but remove highlight-like purple spots from production BaseColor. |
| M038 | Galvanized grate iron | Drains, work decks and vents | `1 × 1 m` | Pass. Broad openings and thick bars remain stable through LOD; openings become geometry/opacity as required. |
| M039 | Aged copper with patina | Lighthouse, trim and machinery | `0.75 × 0.75 m` | Pass. Controlled verdigris coverage and warm rubbed copper give a useful metallic mask basis. |

## Material Batch 05 — race, interface, and workshop surfaces

![Material Batch 05 contact sheet](./review/material-batch-05-contact-sheet.jpg)

Specialized transparent or emissive sheets replace bottom-right AO/Height with a documented Emissive or Opacity/Transmission mask. Production still requires AO where materially relevant; the special mask is an additional authored channel, not a waiver.

| ID | Material | Primary use | Recommended real-world coverage | Status and production note |
|---|---|---|---:|---|
| M040 | Road repair plate | Track patches and industrial floors | `2 × 2 m` | Pass with material check. Good overlapping structure; production BaseColor must clearly retain metallic plate rather than stone-tile response. |
| M041 | Boost emissive inlay | Boost pads and racing-line inserts | `2 × 2 m` | Pass. Excellent broad cyan/magenta channels and clean emissive mask; animate UV flow separately. |
| M042 | Chipped hazard paint | Track edges and workshop hazards | `2 × 2 m` | Pass. Strong readable stripe rhythm, restrained chips and coordinated relief. |
| M043 | White enamel interface metal | White void UI and clean race structures | `1 × 1 m` | Pass. Dominant warm white with appropriately minimal scratches and chips. |
| M044 | Gold rivet metal | Interface rivets and premium fasteners | `0.5 × 0.5 m` | **Weak—regenerate.** Surface is useful but the image contains extensive forbidden generated UI, headings and buttons. |
| M045 | Racing rubber | Bumpers, grips and flexible guards | `1 × 1 m` | Pass. Restrained compressed grain and broad abrasion arcs without tire-tread literalism. |
| M046 | Weathered leather | Harnesses, straps and balloon rigging | `1 × 1 m` | **Weak—regenerate.** Useful leather breakup, but tiny generated channel labels violate the clean-sheet standard. |
| M047 | Painted ceramic | Race markers and goblin props | `1 × 1 m` | Pass. Clean off-white glaze with controlled green/purple handmade accents. |
| M048 | Dirty lantern glass | Lanterns and workshop glazing | `1 × 1 m` | Pass. Restrained soot and transmission-mask concept; final glass uses proper transmission/refraction shader. |
| M049 | Worn rail steel | Mine rail and machine contact surfaces | `1 × 1 m` | Pass. Strong longitudinal wear, restrained pitting and usable metallic/roughness separation. |

## Material Batch 06 — scrolling water and projected effects

![Material Batch 06 water contact sheet](./review/material-batch-06-water-contact-sheet.jpg)

| ID | Material | Primary use | Recommended coverage | Status and production note |
|---|---|---|---:|---|
| M050 | Deep-ocean scrolling water | Open sea and deep channels | `12 × 12 m` | Pass. Broad current bands support two offset scrolling normal/flow layers without noisy texture swimming. |
| M051 | Shallow tropical water | Lagoons, shallows and tide pools | `6 × 6 m` | Pass. Clear intersecting currents and calm wavelets; depth absorption comes from the water shader, not BaseColor alone. |
| M052 | Waterfall flow | Vertical waterfall ribbons | `4 × 8 m` | Pass. Strong continuous top-to-bottom strands for looped downward scrolling and opacity breakup. |
| M053 | Water foam mask atlas | Shore foam, wakes, churn and splash rings | atlas | Pass. Eight broad alpha-ready shapes with useful normal, roughness and opacity references. |
| M054 | Underwater caustic projector | Submerged rock, sand and props | `4 × 4 m` | Pass. Broad cells and secondary phase mask support inexpensive animated cross-fade projection. |

Water textures are shader inputs rather than opaque material replacements. Use world-space or stable local-space coordinates, depth fade, shoreline intersection masks and two incommensurate scroll speeds. Never scroll BaseColor, Normal and foam at the same rate. Keep ocean collision and buoyancy independent from visual displacement.

## Kitbash Stamp Batch 01 — vehicle and machine construction

![Kitbash Stamp Batch 01 contact sheet](./review/kitbash-stamp-batch-01-contact-sheet.jpg)

| ID | Stamp family | Contents | Status and production note |
|---|---|---|---|
| K001 | Armor plates | 12 rectangular, trapezoid, curved and repair plates | Pass. Strong varied silhouettes, large fasteners and clean alpha masks. |
| K002 | Gears and mechanisms | 12 gears, sprockets, flywheels and toothed arcs | Pass. Low tooth counts and broad holes remain readable after scaling and LOD. |
| K003 | Engine pipes | 12 pipe bends, manifolds, headers and hose loops | Pass. Excellent one-click engine-bay vocabulary with thick tubing and clear masks. |
| K004 | Vents and grilles | 12 louvers, meshes, intakes and radiator faces | Pass. Wide range of opening patterns with stable frames and useful cutout alpha. |
| K005 | Fasteners and welds | 16 rivet, bolt, weld, hinge, collar and seam details | Pass. Good secondary-detail family for joining primary stamps without random noise. |

Stamp atlases use BaseColor, Normal, Roughness/metal reference and Alpha. Production exports separate Roughness, Metallic, AO and Opacity maps; the displayed roughness/metal quadrant is a derivation guide, not a packed runtime texture. Runtime projection, raised-mesh selection, engine-bay recipes, recursive editing, water scrolling and bake rules are defined in [`docs/PRESET_STAMP_AND_SCROLLING_MATERIAL_STANDARD.md`](../../../docs/PRESET_STAMP_AND_SCROLLING_MATERIAL_STANDARD.md).

## Required validation before engine use

1. Re-author all channels from one shared height/mask stack.
2. Confirm perfect left/right and top/bottom continuity with offset and 3 × 3 tile tests.
3. Remove directional lighting, highlights, shadows, perspective, and ambient occlusion from BaseColor.
4. Normalize tangent-space normals and document Y+ or Y− convention.
5. Check roughness under neutral overcast, hard key light, and grazing light.
6. Produce macro-variation masks so large terrain does not reveal repetition.
7. Check the material at its registered physical coverage and through every gameplay LOD.
8. Supply 2K masters by default; reserve 4K for hero cliffs or trims justified by screen coverage.
9. Use texture arrays/atlases by shader family and mip-chain every channel consistently.
10. Never infer roughness from BaseColor at runtime; roughness is authored and required.

## Next material batches

### Batch 07 — decals and blend masks

Road wear, dampness, soot, rust runoff, moss edge, sand accumulation, mud splash, tire scuff, chipped paint, and goblin graffiti. These require alpha/mask-first sheets and must not carry baked lighting.
