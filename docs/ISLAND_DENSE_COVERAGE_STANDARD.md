# Basalt Isle dense coverage asset standard

**Purpose:** define low-cost, high-density modular coverage assets that read as forests, rubble fields, scrap piles, and biome masses from a distance while retaining convincing close-range perimeter detail.

Dense coverage assets are not collections of fully modeled source objects hidden inside one another. They are purpose-built hybrid meshes: strong recognizable forms around the perimeter, a compact texture-bake-friendly interior, aggressive LODs, and optional impostors.

---

## 1. Visual objective

A coverage item must:

- read as one intentional environmental mass from race distance;
- remain attractive from several rotations;
- have enough perimeter detail for close passes;
- use a densely packed interior with no unnecessary see-through micro holes;
- replace repeated hidden geometry with broad shells, cards, or merged low-poly forms;
- preserve two or three large silhouette notches instead of dozens of tiny gaps;
- avoid floating parts, thin tendrils, isolated pebbles, individual leaves, loose nails, and other unstable geometry;
- bake cleanly into color, normal, roughness, AO, depth, and impostor textures.

The interior may be visually dense enough to behave like a textured mass. The outer contour carries object identity.

---

## 2. Mesh architecture

Build coverage items in three zones:

1. **Perimeter hero forms** — recognizable trunks, fronds, rocks, beams, roots, or machinery pieces that define the silhouette.
2. **Transition forms** — simplified overlapping geometry connecting the perimeter to the center.
3. **Interior shell** — low-poly opaque or alpha-tested mass carrying baked material detail.

Rules:

- Remove all fully hidden faces and buried source geometry.
- Interpenetrate bases enough to eliminate fragile seams.
- Close holes that disappear below 64 px.
- Keep only gaps that contribute to the 64 px silhouette.
- Use thick shared stems and root zones for vegetation.
- Merge interior rubble into broad connected masses.
- Keep no internal cavity that cannot be seen or used.
- Limit materials to one shared atlas where possible, two where materially necessary.
- Interior shell normals must transition cleanly into perimeter forms.

---

## 3. Density without waste

Density is communicated by overlapping color, normal, roughness, depth, and large shape layers—not by preserving every source object's complete topology.

### Vegetation

- Use broad canopy shells and grouped leaf/frond cards.
- Model only perimeter trunks and major branches that affect silhouette.
- Bake inner trunks, leaves, vines, and understory into interior textures.
- Avoid several transparent layers directly behind one another; opaque canopy cores reduce overdraw.
- Use alpha-tested detail primarily around the boundary.

### Rock and rubble

- Merge interior stones into one rubble shell.
- Preserve several large perimeter rocks and broad creases.
- Put gravel and small fractures into Normal/Height/Roughness maps.
- Remove buried undersides and contact faces.

### Scrap and salvage

- Preserve major diagonal beams, block steps, and metal arcs around the boundary.
- Merge the center into broad timber, masonry, or metal masses.
- Bake small plank ends, bolts, rubble, and broken edges into textures.
- Do not model loose fasteners, wires, nail points, or thin sheet scraps in the interior.

---

## 4. Silhouette requirements

Review as solid black at 256, 128, 64, and 32 px.

- At 128 px, asset family and dominant components must be clear.
- At 64 px, the primary mass and two or three secondary lobes must remain readable.
- At 32 px, the object must remain a stable icon-like shape without flickering spikes or pinholes.
- No hole under 3–5% of bounding-box width survives into LOD2.
- Avoid circular uniform blobs: use asymmetrical height and two or three strong contour events.
- Top silhouette matters because the island is often viewed from elevated cameras.
- Rear and side silhouettes must be authored, not accidental leftovers from one hero angle.

---

## 5. LOD strategy

| Level | Purpose | Geometry treatment |
|---|---|---|
| LOD0 | Close race pass / builder | Perimeter hero forms, transition forms, simplified interior shell |
| LOD1 | Normal gameplay | Reduce inner cards/forms, preserve contour and largest gaps |
| LOD2 | Distant gameplay | Canopy/rubble/scrap shell plus a few silhouette anchors |
| LOD3 | Skyline / far island | Octahedral or multi-view impostor, or extremely simple hull/cards |

Recommended ratios:

- LOD1: 45–55% of LOD0 triangles.
- LOD2: 12–22% of LOD0 triangles.
- LOD3: 2–5% equivalent or impostor.

Do not uniformly decimate. Protect the outer contour and simplify the interior first.

### Impostor bake

Where supported, bake:

- BaseColor;
- Normal;
- Roughness;
- AO;
- depth/parallax data;
- opacity/coverage;
- emissive for lava only.

Use enough azimuth and elevation frames for the elevated island camera. Match impostor footprint, top height, dominant lean, and color value to LOD2.

---

## 6. Collision and interaction

- Dense vegetation interiors normally have no per-leaf or per-trunk collision.
- Use one to four simplified perimeter/center collision hulls only where gameplay needs them.
- Small ground coverage should often be non-colliding.
- Rock/scrap piles use coarse convex hulls or a few broad blockers.
- If destructible, the carved/sculpted result and support graph are authoritative; the coverage visual swaps or dissolves rather than fracturing every baked interior object.
- Spawn approved pooled chunk families for impact presentation.

---

## 7. Placement variation

Natural omnidirectional coverage:

- yaw: 0–360°;
- uniform scale: 0.85–1.15;
- subtle material hue/value variation: ±5%;
- controlled terrain sink to hide contact seams.

Directional edge modules:

- constrain yaw to preserve jungle edge, wind direction, cliff edge, or shoreline facing;
- overlap thick end lobes by 5–15%;
- never stretch non-uniformly enough to expose texture scale or thin the shell.

Eventually provide A/B/C variants for the most repeated families. Rotation alone is insufficient for hero viewpoints.

---

## 8. PBR and texture rules

Every coverage asset requires:

- BaseColor;
- Normal;
- Roughness;
- Metallic where applicable;
- AO;
- Height/depth where useful;
- Opacity/coverage for foliage boundaries;
- Emissive only where appropriate.

Roughness is mandatory. Interior baked lighting may not replace PBR response. Do not bake the studio key, cast shadows, or specular highlights into BaseColor. AO may describe dense interior occlusion but remains controlled and separate.

Maintain source-object texel scale. Dense interiors should use shared atlases and trim/material families rather than one unique high-resolution texture for every instance.

---

## 9. Performance budgets

- Prefer one material, maximum two for a standard coverage asset.
- Use GPU instancing for repeated coverage modules.
- Reduce or disable dynamic shadows by distance before sacrificing silhouette.
- Vegetation is constrained by alpha overdraw and shadow cards as well as triangles.
- Interior opaque shells should replace stacked transparent cards where possible.
- Use HLOD to combine neighboring coverage modules in fixed world zones.
- Cull whole modules, not individual leaves or stones.
- Test VRAM, overdraw, draw calls, shadow time, wind vertices, and impostor transitions.

---

## 10. Reference-sheet requirements

Each generated sheet shows one coverage asset from:

- front;
- rear;
- left;
- right;
- at least two high three-quarter views;
- top;
- underside or canopy underside.

All panels must preserve identical object placement and density. Use the approved grey seamless floor/background, fixed neutral light, no visible horizon, no labels, and no base plate.

Approved individual-object and chunk-family sheets must be used as direct image references so coverage assets retain the same species, geology, construction, palette, and materials.

---

## 11. Acceptance checklist

- [ ] Strong silhouette at 256, 128, 64, and 32 px.
- [ ] Dense interior has no unnecessary micro holes.
- [ ] Perimeter retains recognizable source-object forms.
- [ ] Hidden source geometry and buried faces are removed.
- [ ] No floating parts, thin tendrils, loose pebbles, or tiny hardware.
- [ ] Top, rear, and side views are intentionally composed.
- [ ] LOD1 and LOD2 preserve the dominant contour.
- [ ] Impostor matches height, footprint, lean, and color.
- [ ] Materials include authored Roughness and consistent PBR maps.
- [ ] Alpha overdraw and shadow cost meet budget.
- [ ] Collision uses simplified hulls only where needed.
- [ ] Rotation/scale variation does not expose an empty center.
- [ ] Close and distant race-camera captures both pass review.
