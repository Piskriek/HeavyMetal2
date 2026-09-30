# Preset Stamp and Scrolling Material Standard

This standard turns water materials and kitbash atlases into recursively editable presets rather than static textures or finished props. It supports painting armor over a vehicle, stamping a complete engine bay in one action, and reusing the same adaptive tools at world, object, part, surface, and texture depth.

## 1. Stamp preset model

A stamp preset is a parameterized construction instruction containing:

- source atlas and selected entries;
- projection mode: planar, surface-normal, triplanar, spline, socket, or volume;
- output mode: deferred decal, height/normal blend, thin conforming mesh, instanced geometry, or child-part assembly;
- physical width, depth, thickness, bevel, inset, and edge lift;
- BaseColor tint, Roughness, Metallic, AO, Normal strength, Height, and Opacity controls;
- surface filters for slope, curvature, cavity, material ID, paint mask, and exclusion zones;
- spacing, seeded variation, rotation range, mirror permission, overlap and clipping rules;
- LOD policy, collision policy, shadow policy, bake target, and quality tier;
- named sockets and relationships between dependent sub-stamps;
- deterministic seed, source version, parent preset, overrides, and propagation state.

Every stamp remains editable until explicitly baked. A baked result preserves its source preset and seed so it can be rebuilt after an atlas or rule update.

## 2. Stamp output tiers

### Surface detail

Use projected material/decal output for paint, grime, shallow seams, weld discoloration, scratches and low-relief plates. Blend normals with angle-corrected normal blending and clamp height so silhouettes do not imply nonexistent collision.

### Raised detail

Use a thin conforming mesh for armor plates, grilles, deep seams and pipe collars. Offset along the sampled surface normal, shrink-wrap to curvature, weld or cap exposed edges, and avoid z-fighting.

### Functional part

Use instanced geometry for gears, pipes, exhausts, intakes, hinges and parts that change silhouette. These receive sockets, optional collision and separate LODs. Do not represent a silhouette-changing gear or exhaust header as parallax alone.

### Compound assembly

A one-click assembly can combine all three tiers. The user can Dive In to edit the whole assembly, a subsystem, one stamped part, or its material.

## 3. One-click engine-bay preset

The baseline `Goblin Engine Bay` recipe should:

1. sample the target cavity or user-painted rectangle;
2. place one primary block or backing plate at the cavity center;
3. choose one flywheel or two low-tooth gears from K002;
4. connect them with one manifold and two pipe paths from K003;
5. add one grille or radiator face from K004 toward the best exposed surface;
6. add K005 collars, seam strips, bolts and welds only at actual joins;
7. add one or two K001 guard plates without covering all machinery;
8. apply deterministic size and rotation variation within safe ranges;
9. preserve access gaps and reject self-intersections, floating parts and sub-pixel pieces;
10. expose sliders for density, plate coverage, gear count, pipe complexity, wear, color, symmetry and performance tier.

The recipe must adapt to available space. At low quality it may become a baked normal/ORM decal; medium quality retains raised plates and major pipes; high quality retains silhouette-changing gears, pipes and vents as instanced geometry.

## 4. Painting armor plates on vehicles

- Paint creates a placement mask; the preset resolves atlas entries inside it.
- Plate scale is expressed in metres, never arbitrary UV scale.
- Plates align to principal curvature and avoid stretching across sharp corners unless `Bridge Crease` is enabled.
- Adjacent plates maintain a configurable overlap and must not create tiny trapped gaps.
- Edge plates can wrap, trim, stop, or spawn a conforming corner plate.
- Rivets and welds follow plate boundaries as dependent child presets and update when the plate changes.
- Keep windows, wheels, steering, suspension travel, lights, exhaust exits and gameplay sockets in protected exclusion masks.
- Symmetry is optional and editable; asymmetry uses a deterministic seed.
- Collision is generated only for silhouette-changing plates above the configured thickness threshold.

## 5. Atlas and alpha requirements

- Atlas entries require generous dilation/padding at every mip level.
- Alpha-tested entries use clean binary cores with a controlled antialias fringe; avoid grey halos in BaseColor.
- Keep each entry inside a registered UV rectangle with stable ID and pivot.
- Provide BaseColor without baked lighting, tangent Normal, Roughness, Metallic, AO, Height where useful, and Opacity.
- For decal blending, include material-response masks so rust, brass, rubber and paint remain physically distinct.
- Author a signed-distance field when scalable feathering or outline generation is required.
- Test every stamp over white enamel, black iron, painted green metal, curved panels and grazing light.
- Provide 256, 512, 1024 and 2048 atlas tiers or equivalent virtual-texture residency targets.

## 6. Scrolling water presets

A scrolling water preset stores independent layers:

- low-frequency displacement or vertex motion;
- two normal samples with different direction, speed and scale;
- absorption/scattering color controlled by depth;
- shoreline depth fade and intersection foam;
- foam atlas selection, breakup normal and lifetime;
- flow map or spline direction;
- roughness and specular response;
- optional caustic projector beneath the surface;
- waterfall opacity, downward flow and edge feathering;
- splash/mist child emitters from runtime VFX-support geometry.

Recommended starting motion:

| Preset | Layer A | Layer B | Additional motion |
|---|---:|---:|---|
| Deep ocean | `0.03–0.08 m/s` | `0.05–0.12 m/s` opposing | slow vertex swell |
| Shallow water | `0.06–0.15 m/s` | `0.08–0.18 m/s` diagonal | depth-driven refraction |
| Waterfall | `0.8–2.5 m/s` downward | `1.4–3.2 m/s` downward | edge breakup and mist |
| Foam | follows flow | breakup `0.05–0.2 m/s` | spawn/fade or dissolve |
| Caustics | `0.02–0.08 m/s` | counter-scroll/rotate | low-frequency intensity pulse |

Speeds are authored in world units where practical. Offset phases and use nonmatching periods so loops are not obvious. Do not move collision, buoyancy or gameplay water volumes with visual UV scrolling.

## 7. Coverage and scatter stamp behavior

Alpha coverage atlases can resolve to several outputs from the same painted preset:

- **Near:** selected edge stones, planks, grass tufts or scrap become instanced geometry while the dense center uses a conforming decal.
- **Mid:** the complete patch becomes a normal/height/ORM decal or thin card with parallax constrained to safe depth.
- **Far:** patches bake into the parent terrain, vehicle or prop material, then merge into macro color/roughness variation.

The preset stores density, physical patch size, seed, rotation, scale range, slope response, altitude/moisture rules, edge feather, geometry percentage and protected masks. Scatter pieces must remain inside the alpha footprint unless an authored edge element deliberately breaks the silhouette.

For repeated painting:

- reject obvious atlas-entry repetition within the configured neighborhood;
- rotate and mirror only entries approved for those operations;
- use blue-noise placement with minimum separation rather than unconstrained random points;
- blend dense centers so they can function as texture coverage;
- preserve selected broad edge silhouettes through LOD;
- trim against roads, water, sockets and gameplay clearance masks;
- prevent floating rocks, vertical grass on ceilings, and debris penetrating thin surfaces;
- limit stacked transparent layers and convert stable overlaps into a bake;
- allow `Dissolve on impact`, rigidity and chunk-spawn rules to inherit from the touched material.

## 8. Recursive editing and propagation

- Vehicle → engine bay → manifold → pipe → collar → material is one navigable preset chain.
- `Dive In` changes the adaptive Paint, Sculpt, Clear, Select and Rules tools to the active depth.
- Parent changes propagate unless a child is explicitly overridden or detached.
- Atlas updates produce a reviewable version diff; they never silently replace detached instances.
- Undo/redo records the preset operation and seed rather than every generated triangle.
- Sharing/remixing preserves source attribution, dependencies, atlas versions and performance profiles.

## 9. Baking and performance

- Batch decals by atlas/material family and prefer texture arrays or virtual textures where supported.
- Instance repeated raised parts; merge only when baking a stable final assembly.
- Cap transparent layers and overdraw, especially foam, glass and stacked decals.
- Use distance-based stamp collapse: geometry → parallax/normal → baked surface → parent impostor.
- Disable collision and shadows for surface stamps by default.
- Build simplified collision only for functional silhouette-changing pieces.
- Reject stamps below the minimum projected pixel size for the selected quality tier.
- Pool water splash, foam, mist and particle children.
- Bake combined Normal/ORM outputs without destroying the editable source recipe.

## 10. Acceptance tests

A preset passes when it:

- stamps correctly onto flat, convex, concave and seam-crossing test meshes;
- has no floating pieces, z-fighting, alpha fringe, UV bleed or tiny trapped holes;
- survives registered LODs and remains readable at racing distance;
- respects protected gameplay masks and moving-part clearance;
- reproduces deterministically from seed;
- can be dived into, modified, versioned, baked, reverted, shared and remixed;
- meets its triangle, draw-call, texture-residency and overdraw budget;
- provides complete PBR channels, including authored Roughness.
