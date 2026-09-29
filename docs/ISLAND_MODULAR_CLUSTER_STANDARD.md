# Basalt Isle modular cluster generation standard

**Phase:** begins after the complete individual-object reference run is approved  
**Inputs:** approved multi-angle reference sheets in `art-src/meshy/hf-refs/`  
**Purpose:** generate reusable clusters of approved objects that retain strong silhouettes at close range and through aggressive LOD reduction

The complete reference run establishes the identity, materials, scale, and construction of each object. The next image-generation pass will use those approved sheets as visual inputs to compose modular clusters. Cluster generation must not redesign the source objects.

---

## 1. Production sequence

1. Finish the entire individual-object reference run.
2. Review and regenerate weak sheets.
3. Lock each object's scale and triangle budget.
4. Group compatible source references into cluster recipes.
5. Feed the approved reference images—not only text descriptions—into the image-generation pass.
6. Generate one multi-angle sheet per cluster.
7. Review silhouette, contact, holes, thickness, scale, and cross-angle identity.
8. Generate the cluster through Meshy.
9. Clean topology, remove hidden/internal geometry, author PBR maps, and build LODs.
10. Validate at close range, race distance, and skyline distance before world placement.

No second-generation cluster becomes authoritative until every source object used in it has passed review.

---

## 2. Cluster composition goals

A cluster should appear naturally irregular while remaining easy to read and cheap to simplify.

Use this hierarchy:

- **one primary mass** that establishes the silhouette;
- **one or two supporting masses** that overlap or visually connect to the primary;
- **zero to three fillers** that close awkward base gaps and create controlled asymmetry;
- **one clear footprint** rather than several unrelated objects scattered near one another.

Recommended object counts:

| Cluster class | Typical count | Examples |
|---|---:|---|
| Small ground dressing | 3–6 | rocks, ferns, grass, driftwood |
| Vegetation group | 2–5 | palms, broadleaf trees, shrubs, vines |
| Structural dressing | 2–4 | crates, barrels, posts, lamps |
| Rock formation | 3–7 | hero boulder plus supporting rocks and scree |
| Settlement vignette | 2–5 | hut, awning, crates, lamp, tool rack |
| Trackside landmark | 2–4 | sign frame, barrier, lamp, rock/plant support |

More objects are not automatically better. A cluster is successful when it has a distinctive outer contour and one readable visual idea.

---

## 3. Silhouette rules

Cluster quality is judged first as a flat black silhouette.

- Build two or three large silhouette lobes, not many equal-size bumps.
- Use overlap to make the cluster read as one composition.
- Preserve controlled negative space only where it remains legible at LOD2.
- Avoid evenly spaced objects, parallel repeated trunks, mirrored layouts, and circular radial placement.
- Avoid tangent contacts where two forms only barely touch in screen space.
- Do not hide every source object; each major component needs at least one readable contour.
- Keep the base denser than the top so the cluster appears grounded.
- Favor broad branch, frond, beam, and rock shapes over fine spikes.
- Check front, rear, both profiles, four three-quarter views, and top. A cluster may not have one good hero side and several broken sides.

### Silhouette thumbnail test

Review every cluster as a solid black shape at:

- 256 px — close/readability review;
- 128 px — normal race-camera review;
- 64 px — distant gameplay review;
- 32 px — LOD/impostor review.

At 64 px the primary and supporting masses must remain identifiable. At 32 px the cluster must still form a clean, intentional icon-like mass without flickering spikes or accidental holes.

---

## 4. Contact and grounding rules

Every visible part must be physically connected, deliberately suspended, or clearly supported.

- No floating leaves, rocks, boards, roots, ropes, lamps, or fragments.
- Interpenetrate ground-contact forms slightly where it prevents fragile seams.
- Overlap rocks at their bases instead of balancing them on tiny points.
- Merge foliage stems into a compact root/trunk zone.
- Attach vines to a clear shared stem or attachment strip.
- Attach props to a rack, wall, platform, rope, or common ground footprint.
- Use supporting stones, roots, scrub, or structural feet to resolve awkward gaps.
- Do not include a decorative base plate, terrain cookie, sand disc, or plinth.
- World integration still uses terrain intersection, decals, scree, sand drift, and foliage blending in engine.

A contact that disappears after one decimation step is too weak and must be enlarged or redesigned.

---

## 5. Thin-geometry and tiny-hole rules

Thin unsupported geometry and tiny negative spaces collapse into noise during retopology and LOD reduction.

### Minimum durable thickness

Use these minimum visual thicknesses unless gameplay scale requires more:

| Feature | Minimum LOD0 thickness | LOD2 treatment |
|---|---:|---|
| Structural timber/brace | `0.20 m` | merge minor braces into primary beam groups |
| Branch supporting a canopy mass | `0.12 m` | thicken or merge into canopy shell |
| Exposed root | `0.10 m` | merge into root mass or remove |
| Vine/stem intended as geometry | `0.06 m` | replace with card or remove |
| Metal rail/strap | `0.08 m` | merge into larger silhouette or normal detail |
| Rock bridge between masses | `0.20 m` | merge masses or open the gap fully |
| Leaf/frond card group | broad grouped shape | collapse inner layers; preserve outer contour |

### Hole policy

- Keep a hole only if it contributes to the silhouette at 64 px.
- Enlarge important holes so their shortest dimension is at least 3–5% of the cluster's bounding-box width.
- Fill or merge holes smaller than that threshold.
- Avoid tunnels of empty space trapped between nearly touching rocks, roots, leaves, or props.
- Avoid deep inaccessible cavities that create hidden triangles and poor baking.
- Replace a row of tiny gaps with one or two larger intentional openings.
- Remove internal faces that can never be seen after assembly.

No LOD may produce loose sliver triangles, isolated islands, zero-area faces, or unrecognizable triangular scraps.

---

## 6. Source-object fidelity

Image generation uses the approved source sheets as references.

- Preserve the source objects' shape language, palette, material response, scale ratios, and construction logic.
- Do not invent a new palm species, beam system, rock geology, or fastener language inside a cluster.
- Component dimensions must match the scale registry.
- Do not shrink a hero object merely to fit more objects into the composition.
- Repeated objects may vary within approved limits, but they must remain members of the same asset family.
- Generated lighting must use the same neutral grey-floor studio rig as the individual sheets.
- Every cluster sheet remains one cluster shown from multiple angles, with no text or labels.

---

## 7. Controlled variation in world placement

Clusters are designed to tolerate modest transformation without looking duplicated.

### Default allowed variation

- Whole-cluster yaw: `0–360°` for omnidirectional natural clusters.
- Whole-cluster yaw: constrained to authored facing ranges for cliffs, roads, waterfalls, and directional structures.
- Uniform scale: `0.85–1.15`.
- Vertical scale variation: avoid by default; maximum `0.95–1.05` only for approved vegetation.
- Per-instance color variation: subtle hue/value shift, generally within `±5%`.
- Terrain sink: small controlled offset to hide contact seams without burying structural detail.

Avoid arbitrary non-uniform scaling of rocks, buildings, track pieces, and engineered props because it changes material scale, beam thickness, and connector dimensions.

### Variant strategy

For heavily repeated families, create at least three compositions:

- `A` — primary mass left-heavy;
- `B` — primary mass right-heavy;
- `C` — lower/wider or taller/narrower silhouette.

Rotation and small uniform scale changes are then layered on top. Do not rely on rotation alone for hero clusters visible repeatedly along one route.

---

## 8. Triangle-budget strategy

Cluster budgets derive from the source assets in `ISLAND_ASSET_SCALE_AND_TRIANGLE_BUDGET.md`.

### LOD0 target

A cleaned cluster should normally use **60–75% of the sum of its source objects' individual LOD0 budgets** because:

- hidden contact faces are removed;
- overlapping inner foliage is simplified;
- shared materials and attachment zones are consolidated;
- tiny fillers become texture/normal detail;
- redundant interior geometry is deleted.

Use up to 85% only where several hero silhouettes remain independently visible. Never keep 100% of every source mesh merely because they were combined.

### LOD reduction

| Level | Cluster target | Preservation priority |
|---|---:|---|
| LOD0 | 60–75% of source-sum budget | full outer silhouette, primary construction, close material breakup |
| LOD1 | 45–55% of cluster LOD0 | silhouette, main overlaps, largest holes and branches |
| LOD2 | 15–25% of cluster LOD0 | primary mass, supporting lobes, ground footprint |
| LOD3 | 2–8% or impostor | stable distant contour and color blocks |

Do not decimate every part uniformly. Protect outer contours and simplify hidden/interior surfaces first.

### Foliage cost

For vegetation clusters also budget:

- alpha overdraw;
- number of double-sided cards;
- wind-deformed vertices;
- shadow-casting cards;
- material switches;
- mip behavior and alpha coverage.

A 5k-triangle transparent cluster can cost more than a 15k opaque rock cluster. Profile both.

---

## 9. LOD construction rules

### LOD0 — close range

- Preserve object identity, strong branch/beam structure, hero fractures, and meaningful overlap.
- Use normal/roughness/height for small detail.
- Remove unseen internal faces even at LOD0.
- Ensure no paper-thin accidental surfaces.

### LOD1 — normal gameplay

- Merge nearby leaf or grass cards into broader groups.
- Simplify interior rocks and branches.
- Preserve outer contour and primary gaps.
- Remove fasteners that do not affect silhouette.

### LOD2 — far gameplay

- Convert foliage interiors to canopy shells or very broad cards.
- Merge touching rock masses while retaining the main contour.
- Collapse small supports into larger structural forms.
- Fill tiny holes and remove minor gaps before they flicker.
- Keep the base stable and grounded.

### LOD3 / impostor

- Match the cluster's major silhouette from common race-camera angles.
- Bake color, normal, roughness, and depth where the runtime supports them.
- Verify lighting response against the live asset.
- Avoid a billboard transition that changes height, footprint, or dominant lean.

---

## 10. Multi-angle cluster reference requirements

Each generated cluster reference uses:

- front, rear, left, right;
- at least two three-quarter views;
- top;
- underside or low view when grounding/attachment is otherwise ambiguous.

All panels must show:

- exactly the same component count;
- identical placement and overlap;
- identical scale relationships;
- identical damage, leaf arrangement, ropes, and materials;
- the same fixed neutral studio lighting;
- seamless grey floor/background with no visible horizon;
- no base plate, labels, captions, arrows, or panel borders.

Reject a sheet if components change position, number, or identity between views.

---

## 11. Initial second-generation cluster families

After the complete individual run, prioritize:

1. basalt boulder + mixed scree clusters;
2. ochre slabs + grass/scrub clusters;
3. palm + understory + fern clusters;
4. broadleaf tree + vine + flowering shrub clusters;
5. windswept tree + highland scrub clusters;
6. driftwood + coastal grass + small-rock clusters;
7. cliff-creeper + hanging-vine attachment clusters;
8. waterfall rock + fern + vine clusters;
9. settlement crate/barrel/lamp clusters;
10. trackside barrier/sign/rock/plant clusters.

Each family should eventually provide A/B/C silhouette variants.

---

## 12. Cluster acceptance checklist

- [ ] Every source object has an approved individual reference sheet.
- [ ] Cluster dimensions and triangle budget are recorded before model acceptance.
- [ ] One primary mass and clear supporting hierarchy are visible.
- [ ] Silhouette passes at 256, 128, 64, and 32 px.
- [ ] Cluster reads from front, rear, profiles, three-quarter views, and top.
- [ ] No floating parts or unsupported contact points.
- [ ] No fragile tangencies, thin slivers, or unnecessary tiny holes.
- [ ] Important gaps remain legible at LOD2; insignificant gaps are filled.
- [ ] No decorative base plate or terrain cookie.
- [ ] Source-object scale and style remain intact.
- [ ] LOD0 stays within 60–75% of the naive source triangle sum unless justified.
- [ ] LOD1 and LOD2 preserve contour without popping or triangle debris.
- [ ] Foliage alpha overdraw, wind, and shadows pass performance review.
- [ ] Whole-cluster rotation and scale variation remain believable.
- [ ] PBR maps, including roughness, remain consistent with source materials.
- [ ] Close-range and far-distance in-engine captures both pass review.
