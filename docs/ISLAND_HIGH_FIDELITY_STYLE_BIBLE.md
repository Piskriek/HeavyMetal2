# Basalt Isle high-fidelity style bible

**Version:** 1.0 — initial reference-generation gate  
**Applies to:** Basalt Isle Meshy references, generated models, cleanup, PBR materials, world assembly, lighting, and review  
**Quality target:** `docs/visual-guides/island-population-10.png`  
**Layout authority:** validated game route and terrain, not generated concept geometry

This document is the visual contract required by the high-fidelity report. Reference generation may begin against this version. Any intentional departure must be recorded before dependent assets are generated.

---

## 1. Identity

Basalt Isle is a premium stylized tropical volcanic racing island built by inventive goblins from dark timber, black iron, aged brass, rope, quarried stone, and repaired salvage. Nature is lush but irregular. Structures are chunky, legible, visibly engineered, and rooted into terrain. The result is colorful and adventurous, not realistic, toy-like, clean, or grim.

Core visual pillars:

1. **Natural island, engineered route.** Roads are carved into slopes or visibly supported.
2. **Chunky readable silhouettes.** Forms read from race-camera distance before surface detail.
3. **Layered tropical ecology.** Canopy, palms, understory, vines, flowers, grasses, and dead growth occupy believable moisture and altitude zones.
4. **Goblin construction logic.** Oversized fasteners, practical braces, repairs, ropes, pulleys, lamps, and asymmetric improvisation.
5. **Material clarity.** Basalt, ochre rock, timber, iron, brass, cloth, foliage, sand, and water remain distinguishable under one lighting system.
6. **Premium restraint.** Rich detail supports hierarchy and gameplay; it does not fill every surface.

---

## 2. Shape language

### Terrain

- Large primary masses, medium fracture groups, sparse fine breakup.
- Dark basalt uses angular columns, cleaved planes, and heavy shadow pockets.
- Ochre coastal rock uses broader eroded layers and rounded water-cut openings.
- Cliff silhouettes alternate shelves, overhangs, cavities, and scree fans; avoid evenly noisy edges.
- Caves and arches have thick believable crowns and grounded side walls.

### Goblin construction

- Structural timber is thick, slightly crooked, and visibly joined.
- Iron straps, brackets, rivets, and bolts are deliberately oversized for readability.
- Triangular bracing communicates load paths.
- Repairs are asymmetric but structurally plausible.
- Curves are segmented into fabricated bays rather than perfectly smooth futuristic forms.
- No razor-thin boards, unsupported spans, decorative gears without function, or random spikes.

### Foliage

- Read canopy masses first and individual leaves second.
- Use asymmetric crowns and directional wind shaping.
- Palms have curved, ringed trunks and broad separated frond masses.
- Understory clusters vary in scale and negative space.
- Avoid identical radial palms, spherical bushes, evenly spaced trees, and uniformly saturated green.

---

## 3. Scale contract

Final dimensions are verified against gameplay before model acceptance.

| Element | Reference proportion |
|---|---:|
| Racing ball | 1.0 m diameter design unit |
| Standard lane | 3.0 ball diameters wide |
| Guardrail top | 0.8 ball diameters above surface |
| Timber deck plank | 0.18–0.25 ball diameters wide |
| Main trestle beam | 0.3–0.5 ball diameters thick |
| Goblin doorway | 2.2 ball diameters high |
| Small launch ramp | 3–5 ball diameters long |
| Hero loop inside diameter | determined by physics; never inferred from concept art |
| Tall palm | 9–14 ball diameters high |

Track connectors, loop diameter, launch angle, tunnel clearance, and bridge width come from engineering blockouts. Meshy output must conform to those dimensions during cleanup.

---

## 4. Palette

Approximate targets are starting points; final measured swatches are validated in-engine.

| Material | Base-color family | Notes |
|---|---|---|
| Basalt | charcoal blue-grey, `#263033`–`#485052` | Never pure black |
| Ochre rock | warm umber/gold, `#85603D`–`#C49358` | Low saturation in shadow |
| Pale coastal rock | warm sandstone, `#BDA57C`–`#DDC495` | Avoid chalk white |
| Dry sand | pale warm beige, `#D7BD82` | Subtle coral variation |
| Wet sand | darker muted brown-grey | Smooth but not mirror-like |
| Race surface | deep warm charcoal/brown | Strong route contrast |
| Timber | dark warm brown, sun-bleached edges | Distinct end grain |
| Iron | blue-black to rusty brown | Metallic response carries highlights |
| Brass | aged muted gold | Used as controlled accent |
| Foliage | olive, deep jungle, fern green | Hue variation by species and light exposure |
| Flowers/flags | coral, crimson, teal, mustard | Small focal accents only |
| Water | turquoise shallows to deep cyan-blue | Depth-dependent |
| Emissive | amber lamps, orange lava | Never broad white glow |

---

## 5. Material and PBR contract

Every textured production asset requires:

- BaseColor in sRGB;
- tangent-space OpenGL Normal in linear space;
- Roughness in linear space — mandatory for every material, including foliage and terrain;
- Metallic in linear space;
- Ambient Occlusion in linear space;
- Height where useful;
- Emissive where useful;
- Opacity/alpha coverage where useful.

Runtime packing may use ORM: R = AO, G = Roughness, B = Metallic. Lossless source maps remain separate.

Rules:

- No directional shadows, specular highlights, or studio-light gradients baked into BaseColor.
- Broad hand-painted color variation is allowed, but it must describe material, wear, moisture, soot, minerals, or age—not fake the current key light.
- Roughness describes physical surface behavior and may not be derived blindly from BaseColor luminance.
- Rock is rough with smoother wet channels; timber has grain-dependent variation; iron ranges from rough rust to smoother worn contact points; brass has muted, broad highlights; leaves use moderate roughness with controlled sheen.
- AO is subtle and remains a separate map.
- Match approved texel density within each asset class.

Master targets:

- hero structures/stunts: 4K;
- standard structures, trees, cliff modules: 2K–4K;
- props and foliage atlases: 1K–2K;
- terrain tileables: 4K minimum plus macro variation and detail normals.

---

## 6. Reference-sheet standard

The owner’s current instruction supersedes the earlier individual-view recommendation. Each generated PNG is a **multi-angle reference sheet for exactly one object**.

### Required sheet presentation

- One object identity repeated consistently across all views.
- Minimum views: front, front-left three-quarter, left profile, rear, right profile, and top.
- Add underside for bridges, ramps, loops, platforms, roofs, overhangs, and floating objects.
- Complex assets should use 8–10 views.
- Views must not be mirrored duplicates.
- Same proportions, topology cues, damage, attachments, material placement, and texture pattern in every view.
- Clear panel spacing; no panel borders, captions, arrows, measurements, logos, or text.
- Neutral seamless grey background and matching grey floor.
- No visible horizon line.
- No base plate, plinth, pedestal, terrain cookie, sand mound, or display disc.
- Soft contact shadow only.
- Whole object uncropped in every view.
- 2048 px minimum long edge; PNG.

### Camera

- 70–85 mm full-frame equivalent perspective.
- Horizontal views at object mid-height.
- Three-quarter views may rise no more than 25–30° unless the top construction is otherwise unreadable.
- Top view is near-orthographic.
- Keep object scale consistent between panels.

### Studio lighting

Use the same rig for every sheet:

- neutral grey seamless cyclorama/floor, approximately `#808080` in the rendered output;
- 5500 K large soft key from upper-left, approximately 45° azimuth and 35° elevation;
- neutral broad fill at 30% of key intensity;
- very weak cool rim only where needed for a dark silhouette;
- fixed exposure, white balance, shadow softness, and tone mapping;
- no dramatic sun, colored environment, fog, bloom, depth of field, or vignette.

The lighting exists to reveal form and material consistently. It must not redesign the texture from sheet to sheet.

### Forbidden content

- scenery or environment around the object;
- characters or creatures unless the asset itself is a character/creature;
- unrelated props;
- smoke, fire, water spray, mist, god rays, or ocean planes;
- lettering;
- presentation bases;
- different object designs in different panels;
- cut-off extremities;
- baked cast shadows in the texture.

---

## 7. Construction grammar

### Track and support

- Deck thickness and support spacing communicate plausible load.
- Trestles use repeated bays with diagonal cross-bracing.
- Bridges terminate into authored abutments or connector sockets.
- Curved structures use visible segmented fabrication.
- Loops require a continuous running surface, outer support frame, cross-braces, guard elements, and a readable approach/exit transition.
- Ramps have a supported underside, reinforced lip, and engineered landing relationship.

### Settlement and industry

- Buildings use dark timber frames, patched boards, iron straps, rope, cloth roofing, and warm practical lights.
- Cranes expose pivots, counterweight logic, winches, hook paths, and structural bracing.
- Windmills have readable blade hubs, gearing housings, platforms, ladders, and foundations.
- Chimneys and vents connect to a plausible building or machine.

### Ground integration

Models do not include decorative base plates. In engine, foundations are hidden through terrain intersection, scree, sand drift, grass, decals, and vertex blending. Reference sheets show the clean object and its actual structural feet only.

---

## 8. Biome grammar

1. **Coastal wet zone:** palms, broadleaf understory, vines, flowers, wet rock, driftwood, sand, foam.
2. **Mid-slope rugged zone:** scrub, grasses, medium trees, exposed ochre rock, boulders, drainage channels.
3. **High volcanic zone:** dark basalt, sparse wind-shaped growth, dead wood, ash, industrial structures, vents.
4. **Waterfall corridors:** dark wet rock, ferns, moss, vines, mineral streaks, pools.
5. **Settlement clearings:** compact dirt, trampled vegetation, repairs, crates, lamps, controlled clutter.

Foliage remains outside protected racing sightlines and collision corridors.

---

## 9. Lighting and atmosphere target

Reference sheets use the neutral studio rig above. The island uses a separate but locked cinematic rig:

- warm upper-left late-afternoon sun;
- cool sky and ocean fill;
- soft but readable contact shadow;
- sky-matched aerial perspective;
- restrained volumetric shafts used as accents;
- depth-based water color and turquoise bounce near shore;
- warm practical lamps in settlement and industrial areas;
- one fixed exposure/tone-map target before final texture balancing.

All materials are reviewed in both rigs.

---

## 10. Modeling and delivery

- Correct real-world scale, pivot, forward axis, and named sockets.
- Clean topology and silhouette; remove floating fragments and internal garbage.
- Consistent bevel scale and normals.
- Approved UV density and minimal material slots.
- LOD0/1/2 and impostor where appropriate.
- Separate simple collision mesh.
- GLB plus source scene and source texture maps.
- Neutral turntable and in-engine review captures.

Meshy output is a starting mesh. Cleanup, retopology, UV correction, PBR validation, LODs, and collision are required before acceptance.

---

## 11. Initial benchmark reference set

The first ten sheets test the style across all major production risks:

1. basalt cliff module;
2. straight race-road module;
3. banked race-road curve;
4. tall timber trestle bay;
5. tall leaning palm;
6. goblin windmill;
7. timber-and-iron vertical loop;
8. reinforced launch ramp;
9. basalt tunnel entrance;
10. timber-and-iron cliff bridge.

Review these ten before expanding the library. Problematic sheets are regenerated before related objects proceed.

---

## 12. Acceptance gate

A reference sheet passes only when:

- all panels depict the same object;
- silhouette and construction match this bible;
- required views are present and useful;
- grey floor/background are seamless with no horizon;
- no base plate is present;
- lighting is neutral and consistent;
- the object is whole and uncropped in every panel;
- materials use the approved palette and remain distinguishable;
- no forbidden content appears;
- the sheet gives Meshy enough unambiguous information to reconstruct the object.
