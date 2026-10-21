# ARGO\_NOTE\_43: Rule 8a Cross-Check of Plan 41 (`@hm/matstack`) & Plan 40 (BYOA), plus Aligned First Shelf & Test Piece (Argo, 2026-10-21)

## 1\. Bundle in `Setmix`: `argo-ticket40-v3-matstack-bundle.json`

All 6 files in `argo-ticket40-v3-matstack-bundle.json` are aligned byte-for-byte with `packages/matstack/src/index.ts`, `packages/matstack/src/mask-mesh.ts`, and `packages/matstack/src/constants.ts`, and pass 60/60 unit tests:

- `packages/matstack/src/shelf.ts`:  
  - `SURFACE_SHELF` (29 `SurfaceSpec` presets: 14 base \+ 15 weathering from Plan 41 §4.9).  
  - `MASK_SHELF` (11 `MaskSpec` presets from Plan 41 §4.9).  
  - `LAYER_SHELF` (16 `LayerSpec` presets from Plan 41 §4.9).  
  - `MATERIAL_SHELF` / `FIRST_MATSTACK_SHELF` (the 12 canonical Plan 41 §4.9 `MaterialSpec` presets \+ 4 machine-detail presets `mat:hazard-chevron`, `mat:rubber-seal`, `mat:slatted-grille-steel`, `mat:crushed-ore-bed` \+ 4 aliases).  
  - `flattenMeshFaces(m, mesh, tiles, noise)`: Rank-0 per-triangle centroid evaluator (interpolating the 4 signed line distances `edge` and `cavity` to the triangle centroid so wide panel faces keep dielectric `paint1` while narrow bevel/chamfer strips evaluate within `EDGE_BAND` to `edge-wear`).  
- `apps/web/src/play/kit-trim-palette.ts`:  
  - Re-exports `SURFACE_SHELF`, `MASK_SHELF`, `LAYER_SHELF`, `FIRST_MATSTACK_SHELF`, and `flattenMeshFaces` typed against `@hm/matstack`.  
  - Maps `MAT_PRESET_SKINS` to the canonical Plan 41 §4.9 names (`khakiBody: 'mat:field-worn-hazard'`, `brushedTrim: 'mat:workshop-steel'`, `darkHopper: 'mat:rust-bucket'`, `copperBus: 'mat:old-copper'`, `hazardStripe: 'mat:hazard-chevron'`, `rubberSeal: 'mat:rubber-seal'`, `slattedGrille: 'mat:slatted-grille-steel'`, `crushedOre: 'mat:crushed-ore-bed'`).  
  - Dielectric paint surfaces (`powder-coat`, `enamel`, `hazard-paint`, `lab-composite`) have `metal: 0`, warm khaki `#b8b2a2` is in `paint[0]` (`paint1`), and `hazard-paint` uses a yellow-to-black `ramp` over a `stripes` tile.  
- `apps/web/src/play/kit-modules.ts`:  
  - Adds `MATSTACK_TEST_PIECE_KIT` (Plan 41 §4.6: grounded at `y = 0`, `0.60 m` tall, built from `@hm/partgen` `can` skid \+ `panel` with bolt row \+ vertical square-section `beam` \+ gusset `bracket` \+ short `can` housing).  
- `packages/partgen/src/index.ts`, `apps/web/src/play/kit-mill-v2.ts`, and `apps/web/src/play/kit-mill-v2.test.ts`:  
  - Sloped open-throat `hopper` (Ranks 0..2), continuous inclined `chute` ramp, 10/14/20-sided radial-lug `wheel`, unused `HOPPER_Y` removed, and 60/60 tests passing.

---

## 2\. Rule 8a Audit of Plan 41 (`41-layered-materials.md`) & `@hm/matstack`

### What Is Strong & Verified

1. **Signed Line-Distance Attributes (`mask-mesh.ts` `edgeLines`):** Storing 4 convex and 4 concave signed in-plane line distances per unshared triangle vertex (`aEdge`, `aCavity` `vec4`s) with coplanar union-find is a great piece of engineering: zero extra triangles on kit parts, exact distance to the polygon boundary (corners included) without unique UVs, and automatic fallback to 1-ring smoothed normal curvature (`curvatureMasks`) when `longestEdge < 2 * band`.  
2. **DataArrayTexture \+ Single Shader Family (`41-layered-materials.md` §4.5):** Packing tiles into one `DataArrayTexture` (128² Medium, 256² High) \+ one 256² RGBA noise atlas (`clouds`, `cells`, `speckle`, `scratches`) keeps sampler count fixed regardless of layer count, and `featureKey(features(m))` (`L3 t d r c f a i e`) keeps WebGL program compilation bounded.

### Four Technical Bugs / Traps Caught by Rule 8a (Please Fix in Renderer & `@hm/matstack`)

1. **Layer Ordering Trap (Mechanical Edge Abrasion vs Dirt/Rust):**  
   - When we ran `mat:field-worn-hazard` through the real `materialAt()` oracle with `layers: [grime, paint-chips, edge-wear, rust-bloom, dirt]`, `dirt` (`metal: 0`) and `rust-bloom` (`metal: 0.04`) sat *above* `edge-wear` (`metal: 0.94`) and overwrote the exposed metal on every lower bevel (`maxMetal` dropped to `0.18`).  
   - **Fix (applied in `FIRST_MATSTACK_SHELF`):** In physical reality and Substance Painter smart materials, mechanical abrasion (`paint-chips`, `edge-wear`, `scratches`) must sit **at the top of the `layers` array** (evaluated last) because fresh scraping rubs off dirt and rust along sharp convex edges to expose bright metal (`maxMetal > 0.45`).  
2. **Clearcoat & Anisotropy Bleed-Through Under Rust/Mud/Dust (`blendChannels`):**  
   - In `matstack/src/index.ts` `blendChannels`, if a base surface has `coat` (`enamel`, `carbon-fibre`, `lab-composite`) or `aniso` (`brushed-stainless`), and a weathering layer (`rust-bloom`, `heavy-rust`, `dirt`, `grime`, `dust`, `moon-dust`, `moss`) only lists `writes: ['colour', 'metal', 'rough', 'height']`, then the base surface's shiny clearcoat (`coat: 0.85`) or brushed anisotropy (`aniso: 0.65`) bleeds straight through opaque rust and mud\!  
   - **Fix (applied in `LAYER_SHELF`):** Every opaque weathering layer in `LAYER_SHELF` explicitly includes `'coat'` and `'aniso'` in `writes` (writing `0` to suppress underlying gloss/brush where rust or mud covers the surface). In the Studio UI when a player adds a new layer, default `writes` to `['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso']`.  
3. **Coplanar Diagonal Line Selection When a Polygon Has \> 4 Convex Boundary Edges (`mask-mesh.ts` line 213):**  
   - In `edgeLines`, `ranked` sorts `mine` (`d: -1`) ahead of `neighbours` (`d: reach(t, e)`), where `reach(t, e)` is the minimum distance from 7 probe points on triangle `t` to segment `e`.  
   - On a bevelled or notched face with \> 4 convex boundary edges in its coplanar group, two colinear boundary segments on opposite sides of a notch share the same line equation, or `mine` \+ `neighbours` can exceed `EDGE_LINES = 4`. Deduplicating coplanar `SharpEdge`s that share the same `(inward, dot(a, inward))` line before `.slice(0, EDGE_LINES)` guarantees a slot isn't wasted on two colinear segments of the same border.  
4. **Solvent Cartridge Ruling (Plan 41 §6 P2 & `OPUS_NOTE_42` 2c):**  
   - **Weathering over time:** Already agreed and locked—no wall-clock timer; driven by `(stage, localAq, localBiomass)` plus the player's `age` slider (`0..1`).  
   - **Solvent Cartridge:** **YES.** Include `{ solvent: true }` (or `mat:clean` action mode) in `@hm/cartlab`: firing it at a part (tap) or whole machine (hold) strips any applied `{ layer }` weathering overlays and resets the part's/machine's `age` override to `0.0` without touching `paint1` / `paint2` or the base material. It closes the loop on `{ layer }` cartridges so players can experiment freely.

---

## 3\. Rule 8a Audit of Plan 40 (`40-bring-your-own-agent.md`)

### What Is Right

- **The Document Is the API:** Routing all agent edits through `@hm/scenedoc` operations and schema-validated preset commands (with zero opaque agent-only state) and staging every mutation into the `Changes` review list with per-row turntable preview and undo integration is clean and honours the owner's rules.

### Four Additions Needed Before Building Plan 40 (Rule 8a)

1. **Expose `@hm/matstack` & Mask-View Inspection to Agents:**  
   - Ensure `studio.commands.list` and `studio.doc.propose` include the new Plan 41 commands (`matstack.setPaint`, `matstack.setAge`, `matstack.addLayer`, `matstack.updateLayer`, `matstack.setMaskInput`), and allow `studio.capture` to accept `maskView?: number` (layer index) so an agent can visually verify its own B\&W mask placement on the test piece or machine.  
2. **Staged Preview in `studio.capture` (`includeStaged: boolean`):**  
   - Under Rule 8a, an agent must inspect its own work from four sides (`+z`, `+x`, `-z`, `-x`) *before* handing the staged proposal to the user. `studio.capture` must support `includeStaged: true` (defaulting to `true` when called by the agent) and `rank?: 0 | 1 | 2` so the agent sees the proposed geometry/materials across all four views and across Rank 0 (`S0b`/`S1` flattened) and Rank 2 (`S6` full).  
3. **Upgrade `studio.kit.validate` with the 4-Side Face-Contact & Socket Audit:**  
   - In `TICKET-39b` and `TICKET-40`, the critical bugs were parts floating `0.13..0.60 m` off a housing face, status lamps floating off pilasters, or missing measured sockets (`vent`, `feed`, `power`). `studio.kit.validate` must return structured errors for:  
     - any unresolved `mat:` or `vault:` material ID;  
     - any part below `y = 0` or floating (`> 5 mm` gap to its parent/sibling AABB);  
     - any missing required machine socket (`vent`, `feed`, `power`) or socket drift beyond tolerance.  
4. **Answers to Plan 40 Section 6 Open Questions:**  
   - **Q1 (`studio.mesh.retopo_single_asset` timing):** Put `studio.mesh.retopo_single_asset` **after TICKET-29's native/3D-PC quad-remesh \+ bake pipeline lands** (do not ship a stub in Phase 1). However, the pure in-browser `@hm/meshops` topology operators from TICKET-35 (`planar-dissolve-decimate`, `quadric-edge-decimate`, `weld-by-distance`, `recompute-hard-normals-ground`) are already deterministic and belong in Phase 1 through the standard operator-stack commands.  
   - **Q2 (The three worked examples in `studio-skill.md`):**  
     1. **Tune a `@hm/partgen` part & `@hm/meshops` stack, then print a cartridge** (e.g., flare a `hopper` or chamfer a `panel`, verify at `rank: 0` and `rank: 2` via `studio.capture`, and print).  
     2. **Assemble a reusable module from parts on sockets** (e.g., `bolted-access-door` with hinges, handle, lamp, and corner bolts, verified with `studio.kit.validate` for zero floating parts).  
     3. **Restyle a machine's lamps and `@hm/matstack` layered materials with a 4-side turntable check** (apply `mat:field-worn-hazard`, set `paint1`/`paint2`, add a `rust-streaks` or `moon-dust` layer, inspect `maskView`, and capture the 4-side turntable).