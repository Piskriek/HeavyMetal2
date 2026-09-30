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
| M015 | Cooled lava crust | Volcanic shelves and crater | `3 × 3 m` | **Pending generation.** The generator returned no image; reserve this ID. |
| M016 | Molten lava | Lava pools and channels | `3 × 3 m` | Pass as mask reference. Derive BaseColor and Emissive separately and animate flow in shader. |
| M017 | Dry coastal rock | Beach shelves and salt rock | `3 × 3 m` | Weak—regenerate. Current deep vertical cuts read as a cliff face rather than a broadly eroded tile. |
| M018 | Wet ochre waterfall rock | Waterfall channels and wet ledges | `3 × 3 m` | Pass. Strong strata and vertical wetness language; BaseColor must exclude generated shading. |
| M019 | Basalt cave wall | Tunnel and cavern walls | `3 × 3 m` | Pass with variation constraint. Broad erosion pockets work; reduce repeated circular cavities in the production height source. |
| M020 | Basalt cave floor | Driveable cave and tunnel floor | `3 × 3 m` | Pass. Low relief, restrained damp patches and broad plate structure support gameplay collision. |

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

### Batch 03 — foliage and organics

Palm bark, broadleaf bark, dead driftwood, palm frond, broadleaf canopy leaf, fern leaf, coastal grass, hanging vine, moss, and flower petals. Foliage sheets require opacity/cutout references in addition to PBR channels.

### Batch 04 — built materials

Fresh timber, charred timber, rope, sailcloth, patched canvas, cut basalt masonry, ochre masonry, painted goblin metal, galvanized grate iron, and copper/patina metal.

### Batch 05 — race and workshop details

Road repair plate, iron grate, boost emissive inlay, hazard paint, white enamel interface metal, gold rivet metal, rubber, leather, ceramic, and dirty glass.

### Batch 06 — decals and blend masks

Road wear, dampness, soot, rust runoff, moss edge, sand accumulation, mud splash, tire scuff, chipped paint, and goblin graffiti. These require alpha/mask-first sheets and must not carry baked lighting.
