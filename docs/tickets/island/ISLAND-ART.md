# ISLAND-ART: 14 reference images for the island set

These images are **inputs to Meshy's image-to-3D** (the owner's session turns each into a 3D model), so they
are judged on one thing: will a 3D generator read one clear object, in the kit's style, from this picture?

## Where they end up
Each becomes a low-poly textured model placed on Basalt Isle, next to the 13 kit pieces made from the kit
sheet (`art-src/meshy/refs/*.png` are those kit references: study them, they are the style target).

## Rules
- **Style**: match the kit sheet exactly: clean stylized low-poly 3D model presentation, broad simple
  hand-painted materials (pale warm sand, dark basalt, ochre rock, weathered timber, black iron, muted teal
  water), soft studio light from the upper left, sharp silhouettes, chunky readable shapes.
- **One object per image**, whole and uncropped, three-quarter view from about 30° above, centred, filling
  about 75% of the frame, on a **plain flat light grey background (#d9d9d9)** with only a soft contact shadow.
  No magenta here (these are not keyed). No text, no people, no foliage, no smoke, no scenery around it.
- **Reference image**: pass `art-src/meshy/refs/basalt-cave.png` for stone objects and
  `art-src/meshy/refs/boardwalk-bridge.png` for timber/iron objects, for style only. Last wave, reference
  subjects leaked into results (a skull, a lightning bolt): reject any try that copies the reference's shape.
- Output: PNG, at least 1024 px wide, at `art-src/meshy/refs/<id>.png`. Nothing else is written or keyed.
- **Review each image by eye** next to the kit references (a contact sheet on white): same hand, one object,
  nothing cut off, nothing extra. Regenerate up to 3 times; mark weak ones in your table.
- At most 10 images per turn, then push and output "[pause for turns to reset]".

## Images
Every prompt below ends with this style block, copied exactly:
> Clean stylized low-poly 3D game asset presentation, a single object shown whole in three-quarter view from
> slightly above, centred on a plain flat light grey background (#d9d9d9) with a soft contact shadow only.
> Broad simple hand-painted materials: pale warm sand, dark basalt, ochre rock, weathered timber, black iron,
> muted teal water. Soft light from the upper left, sharp silhouette, chunky readable shapes. No text, no
> people, no plants, no smoke, nothing else in frame.

| # | id | Subject (prompt start) |
|---|---|---|
| 1 | `float-isle-large` | A large floating island of dark basalt with an ochre rock crown, a flat pale-sand top big enough for a road, its underside a jagged inverted cone of basalt columns, hanging in the air. |
| 2 | `float-isle-medium` | A medium floating basalt rock, a flat timber landing deck on top with black iron posts, its underside a short jagged basalt spike, hanging in the air. |
| 3 | `float-isle-small` | A small floating chunk of basalt and ochre rock with one iron mooring ring on its side, hanging in the air. |
| 4 | `chain-bridge` | A straight suspension bridge of weathered timber planks hung from two heavy black iron chains, with iron posts at both ends, shown alone. |
| 5 | `sky-gate` | A tall starting gate: two basalt pillars bound with black iron bands, a timber crossbeam with a hanging iron bell, a lowered iron gate bar. |
| 6 | `anchor-pylon` | A tall black iron pylon with a giant ship's anchor chained to its top, standing on a basalt block. |
| 7 | `lava-tube` | A short straight section of volcanic lava tube tunnel: a round basalt tube with a flat floor, glowing orange cracks in its walls, open at both ends. |
| 8 | `lava-bridge` | A short black iron girder bridge with timber decking over a narrow channel of glowing orange lava, basalt abutments at both ends. |
| 9 | `basalt-columns` | A cluster of tall hexagonal basalt columns of different heights, like a giant's causeway, on a sand base. |
| 10 | `lava-pool` | A round pool of glowing orange lava ringed by broken basalt rocks, flat and low. |
| 11 | `cliff-trestle` | A tall timber trestle support tower with black iron braces and bolts, built to hold a road against a cliff, shown alone. |
| 12 | `shipwreck` | The broken hull of a wrecked wooden sailing ship lying on its side in sand, ribs showing, one iron-banded mast snapped, no sails. |
| 13 | `arena-gate` | A finish-line arch: two stout ochre stone towers joined by a black iron truss carrying a checkered timber banner board (no letters), on a basalt base. |
| 14 | `volcano-massif` | A whole volcano mountain: a steep dark basalt cone with a wide crater at the top, ochre cliff bands and ridges down its sides, sheer cliffs at its base; no roads, no water. |

## Acceptance
- [ ] 14 PNGs at `art-src/meshy/refs/<id>.png`, each through the review, one object, the kit's style.
- [ ] A results table in the report: # | id | status (pass / weak) | notes.
