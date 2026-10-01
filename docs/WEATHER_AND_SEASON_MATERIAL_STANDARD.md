# Weather and Season Material Standard

Weather and season presets are reversible material/state layers over the recursive world. They must change color, roughness, height, density, spawning and VFX coherently without replacing the authored biome or baking directional lighting into textures.

## 1. Layer order

Apply world-condition layers in this order:

1. base biome and ground material;
2. long-term season state;
3. weather accumulation or drying;
4. event deposits such as ash, storm debris or race wear;
5. local interaction decals such as footprints, tire marks, impacts and cleared paths;
6. transient VFX such as rain, mist, blowing snow, falling leaves or airborne ash.

A later layer may mask or displace an earlier layer but must preserve enough source data to reverse, melt, dry, clear or recover.

## 2. Shared preset parameters

Every condition preset records:

- physical coverage and texel density;
- accumulation amount in metres or normalized film thickness;
- temperature, moisture, wind vector and exposure response;
- slope, cavity, upward-normal, shelter and altitude filters;
- roughness, BaseColor, Normal and Height influence;
- geometry spawn density and selected asset families;
- melt, evaporation, bleaching, settling or recovery rate;
- interaction masks for vehicles, characters, water, foliage and structures;
- deterministic seed, quality tier and bake policy.

## 3. Snow and frost

- Frost favors exposed edges and thin surfaces; rime follows wind-facing normals.
- Light snow collects on upward surfaces, cavities and sheltered ledges before vertical faces.
- Heavy snow modifies terrain height/collision only after exceeding a registered depth threshold.
- Snow material must not contain baked blue skylight or sun shadow.
- Near geometry may bend or compress; distant coverage becomes material height/normal.
- Tire tracks, footprints and cleared paths subtract snow depth rather than painting dark lines only.
- Melt reveals the base material progressively and feeds dampness/puddles downhill.

## 4. Rain, wetness, and puddles

- Rain darkening is a material-response change: BaseColor darkens modestly, Roughness decreases and Normal detail may strengthen or soften by material class.
- Vertical runoff follows gravity and surface flow; it cannot climb UV space.
- Puddles occupy connected low areas and use a water shader with depth fade/reflection—not opaque blue decals.
- Wetness around puddles and channels extends beyond visible standing water.
- Collision and buoyancy remain independent from cosmetic ripples unless puddle depth becomes gameplay-relevant.

## 5. Wind transport

- Leaves, sand, snow, ash and storm debris use one world-space wind vector plus local obstruction.
- Deposits form windrows behind barriers, corners and terrain breaks.
- Avoid random uniform scatter after a strong directional event.
- Broad connected piles become decals/coverage at distance; selected edge pieces remain instanced geometry nearby.
- Thin or floating debris must not survive LOD reduction as isolated triangles.

## 6. Seasonal vegetation

- Dry season changes tint, roughness, leaf density and ground exposure from the same moisture mask.
- Spring bloom adds approved flower/leaf families and does not recolor every surface uniformly.
- Canopy, understory and ground layers transition at different rates.
- Seasonal geometry variants retain sockets, collision policy, wind settings and LOD compatibility.
- Dead or shed material enters pooled litter/debris systems rather than spawning unlimited persistent objects.

## 7. Ash and event deposits

- Ash accumulation is matte, low relief and slope/shelter aware.
- Hot ash, smoke, embers and glow remain separate VFX/material states.
- Ash may suppress vegetation spawn density while preserving the underlying biome for recovery.
- Storm debris combines approved organic, timber, rope and metal families with material-appropriate rigidity.
- Impact and cleanup can locally dissolve deposits and spawn pooled chunks according to the destruction standard.

## 8. Environmental media and recovery

- Underwater haze, algae bloom, fog and airborne dust are shader/volume states driven by world depth, flow and density—not opaque geometry.
- Oil sheen, condensation and tidal wetness modify the receiving water or surface shader and retain independent thickness/roughness masks.
- Burn and forest recovery use one monotonic recovery parameter plus authored stage curves for color, roughness, ground cover, shrubs and mature geometry.
- Recovery does not respawn every asset at once; geometry families enter by stage and preserve deterministic seeds.
- Tidal exposure accumulates wetness, salt and marine growth over different time constants and removes them gradually when conditions reverse.
- Post-race recovery separately restores material compaction, rut height, loose scatter, foliage density and repair geometry.
- Environmental media must fade and stream without discontinuities at volume, terrain-tile or water-body boundaries.

## 9. Recursive editing

Weather layers remain presets at every depth:

- world season → biome response → object accumulation → part wetness → material response → local decals;
- Dive In exposes the active depth without flattening parent masks;
- detached objects may override weather response while still inheriting global temperature and wind;
- changing the parent weather preset propagates unless a child response is explicitly detached;
- baking preserves source preset, seed, amount and timestamp so the state can be rebuilt.

## 10. Performance and quality tiers

- Low: macro tint/roughness masks, no spawned seasonal geometry.
- Medium: local height/normal, limited decals and instanced edge debris.
- High: surface displacement, interactive tracks, richer geometry and local VFX.
- Cinematic: maximum spawn diversity, deformation and atmospheric coupling within fixed budgets.

Pool all transient particles and debris. Merge stable distant coverage into runtime virtual textures or equivalent terrain caches. Limit transparent layers, especially puddles, mist, blowing snow and wet glass.

## 11. Acceptance tests

A condition layer passes when:

- it contains no baked directional light, labels or view-dependent reflections;
- channel coordinates align and masks use documented physical scale;
- accumulation obeys slope, shelter, gravity, wind and moisture;
- the base biome can be recovered without destructive repainting;
- geometry and decals transition cleanly through LOD;
- interaction marks alter the condition state rather than merely overlaying color;
- adjacent terrain tiles do not expose seams;
- scene cost remains inside texture, draw-call, overdraw, particle and spawned-instance budgets;
- the layer can be edited, detached, versioned, baked and restored through the preset system.
