# 38: Parts, modules, presets: one kit, detail by what is drawn (Opus, 2026-10-20)

**The owner, 2026-10-20:** "if the 3d pc just outputs common parts that assemble into bigger presets like modules and those combine into presets like machines and vehicles etc. we could hide smaller details in the low poly versions instead of new low poly meshes cos its all low poly its just more or less depending on your gpu."

This follows [plan 37](37-t29-part-split-low-poly.md). Splitting a fused model afterwards made it worse; generating repeats once and assembling them removes the web at the source. This plan makes that the asset model for machines, vehicles and structures.

## 1. Research (SOP)
- **Hiding small parts by size is standard, and screen size beats distance.** Unity users cull small props with one-level LOD groups or per-layer cull distances ([Unity forum](https://discussions.unity.com/t/lod-group-versus-culllayerdistance-on-a-single-lod/618255), [Unity forum](https://discussions.unity.com/t/questions-regarding-benefits-costs-of-lods/38288)). Unreal's LOD switch uses the fraction of the screen a mesh covers, which holds across FOV and resolution ([UE5 notes](https://uhiyama-lab.com/en/notes/ue/performance-lod-culling-occlusion/)). Torque3D also drops small objects from the shadow pass by pixel size ([Torque3D](https://reference.torque3d.org/scripting/namespace/namespace_0bpref_1_1pssm/)).
- **The known cost is popping.** Culling doors and windows off a building at range while keeping the walls works, but parts pop in and out ([gamedev.net](https://gamedev.net/forums/topic/163663/)). So rank changes need a fade, not a cut.
- **The usual alternative is a decimated copy per level, and it costs upkeep.** Space Engineers 2 decimates each block per level, and any change to the full mesh must be carried through every level ([SE2 mod guide](https://2.spaceengineersgame.com/wp-content/uploads/2025/06/Mod-Guide-Art-Omnibus.pdf)). The original engine's bottleneck was draw calls with many vertices ([VRAGE render blog](https://blog.marekrosa.org/2016/08/guest-post-by-jan-hlousek-vrage-render_25/)).
- **Modular kits share one material through a trim sheet**, which keeps a whole assembly to few draw calls ([Roblox: building architecture](https://create.roblox.com/docs/en-us/resources/beyond-the-dark/building-architecture)). Vertex colour gives variation at no texture cost. The hard part is the seams between modules ([The Rookies](https://www.therookies.co/entries/7336)).
- **In the repo already:** `@hm/basekit` (procedural structures, one mesh per material), `@hm/heavygear` (procedural heavy machines with sockets and named parts), the lab's merged static meshes, and generated parts placed several times (wheels, the crawler arm, press rams, relay cabinets, control boxes). The pinned base-building milestone (CLAUDE.md section 6) already has players combining primitives at the Drafting Table into structural presets.

## 2. The model
- **Part:** one solid, made once. The 3D PC generates the chunky, distinctive ones (a capacitor can, a wheel, a cab shell); code builds the plain ones as square-section boxes (rails, skids, frames, bars, bolts, grilles, cable runs). Each part is already low poly by design (square sections), so it has **one mesh**, not a low, mid and high copy. A big curved part (a tyre, a tank) may keep a second, rounder mesh for the top tier.
- **Module:** parts on named sockets (a capacitor cell = can + terminal cap + standoffs).
- **Preset:** modules on sockets (a capacitor bank, a press, the scout rover, a wall section). Modules and presets are **pure, deterministic JSON assembly specs** (a part id, a socket, a transform, a mirror flag), so the Studio, an agent and later the player's Drafting Table all edit the same thing, and `presetcodec` can share them by code.
- **Detail is what is drawn.** Every part carries a detail rank:
  - 0: the silhouette and structure (housings, frames, wheels);
  - 1: the secondary forms (doors, panels, caps, standoffs, lamps);
  - 2: the small details (bolts, vents, grilles, cables, labels-free plates).
  The graphics tier sets the highest rank drawn (Low 0-1, Medium 0-2 near, High 0-2), and rank 2 also hides by screen size. Ranks fade in and out with the world-locked Bayer dither we already use at stage 0b, so nothing pops.
- **Stage ties in (constitution 4, terraforming is fidelity):** the stage also unlocks ranks, so a machine visibly gains its details as reality upgrades: wireframe at 0a; rank 0 at 0b-1; rank 1 from 2; rank 2 from 3. What is drawn = min(stage rank, tier rank). Textures still step up per stage and tier (256 / 512 / 1024 maps), as now.
- **Draw calls:** each placed preset merges its parts per material and per rank into at most a few meshes (rank toggles flip one mesh's visibility); a part type repeated across a base (wheels, cans, panels) becomes one `InstancedMesh`. Parts share a trim-sheet atlas plus vertex colour, so a preset is one or two materials.
- **Single-file size:** parts are shared between presets, and there are no three levels per asset, so the inlined low set shrinks.

## 3. Rules and risks
- Seams: modules meet at sockets inside recesses, flanges or bolt lines, never mid-flat-panel.
- Nothing floats: every part sits on a socket of its parent; the assembler rejects an unsocketed part (the grounding rule).
- Small parts are code, not AI: the 3D PC's minutes go to the distinctive solids.
- Single-object scenery (rocks, slabs, crater chunks, rubble) stays as it is: the cage pipeline is right for those (plan 37 section 3).

## 4. Order
1. **`@hm/kitspec` (pure package):** the part, module and preset spec types, socket transforms and mirroring, the rank rule (min of stage and tier), validation (grounding, unknown ids, cycles), and a flattener that turns a preset into placed parts per material and rank. Tests. Arena or Argo can write it from this plan.
2. **Pilot: the capacitor bank** in the lab: one generated `capacitor-can`, the skid, standoffs, terminal caps and bus bars as code, the ranks wired to the lab's quality and stage. Compare against the current model: triangles, draw calls, the 4-angle render and the luminance gate. The lab's draw-call budget (190) must hold or improve.
3. **Then:** the fabricator (one upright, mirrored), the press and mill (heavygear already has their parts), the scout rover (its wheels are already separate), then the props from plan 37's kit list.
4. **Later:** the asset bench shows a preset's tree and its ranks; the Drafting Table uses the same specs for player-made presets (the base-building milestone).

## 5. Progress
- **Step 1 done:** `@hm/kitspec` (`af77b277`, 11 tests): specs, sockets, mirrors, repeats, `maxRank`, `draws`, `validate` (nothing floats), merge and instance buckets.
- **Step 2 done, the capacitor bank** (`d92cce8d`): `capacitor-can` generated once (a RUN image with the old bank as its style reference, local Hunyuan, fitted to 1.0 m: 0.51 x 1.00 x 0.52 m, 23 KB low), placed six times (3 wide, 2 deep, as sheet 21's power wall); the skid, hazard edges, caps, insulators and copper bus bars are code (`apps/web/src/play/kit-capacitor-bank.ts`), built by `kit-build.ts` (dequantises packed meshes, merges per material and rank, flips mirrored winding). The lab's rank follows the Graphics tier only (the lab is shielded, so it is always at its full stage). The fused bank left the single file (`inline: false`, 88 KB saved; the can costs 23). test-lab-overhaul 78/78, 181 draw calls at the gate view.
- **Prior art found:** `@hm/heavygear` already adds detail by stage (`L.at(4)`, `L.seg(6, 12)`, `L.rep(3, 5)`) and rebuilds a heavy machine per stage, so the heavy press, projector and water maker already gain detail as reality upgrades. They move onto kitspec only if the Studio or the Drafting Table needs to edit them.
- **Next:** the generated machines (mill, press frame, water maker, the fabricator's frame) are the candidates, after Argo picks their modules and ranks.

## 6. Authoring parts: we model the shape, AI adds the surface (the owner, 2026-10-20)
"model them in blender... render a few angles of the lows, do pbr higher poly renders... let the 3d machine make a high version... bake the high detail to the low... build a machine with those parts... save that as a preset and then combine 6 with some other preset parts."
- **1. Shape in Blender, by script** (`scripts/parts/<part>.py`, headless Blender 5.2): one recipe makes the part twice, the low cage (square sections, exact size, sockets as empties) and its high (bevels, inset panel seams, bolt heads, vent slots). Both come from the same recipe, so they line up exactly and the bake has no drift. This replaces asking an image model for the shape; AI shape drift and fused webs cannot happen.
- **2. Clay renders** of the high from four angles (`render-angles.py`).
- **3. Restyle** each render with the RUN image model (the render as the reference image): the kit's painted steel, wear and hazard bands, as a PBR-looking image.
- **4. Paint our own mesh on the 3D PC:** the pipeline's route 1 (`POST /jobs` with `mesh_glb_base64` and `image_base64`, already live: rembg, reduce to 40k faces, Hunyuan3D-2.0 Paint) textures OUR high; nothing generates a new shape.
- **5. Bake the high's normals and colour onto the low** with `lod-bake.py`'s existing bake (the cage, the 512 px colour and tangent normals). A rank-2 detail (a bolt) is both a mesh, drawn on High, and a bump in its panel's baked normal map, so Low still reads it when the mesh is hidden.
- **6. Assemble** with @hm/kitspec: parts into modules (panels, bolts and a cylinder into a canister), modules into presets (six canisters, a skid and bus bars into the bank), presets into bigger presets (the bank on the power wall). Every level is a saved JSON spec the Studio and agents can edit.

**UV packing.** Per part: Blender's built-in unwrap and Pack Islands (concave shapes, rotation, margin), already in the bake path; Hunyuan's paint stage unwraps with xatlas (MIT). In the browser (the Studio, later player presets): xatlas compiled to WebAssembly, loaded only by the Studio. Per preset: a deterministic MaxRects rectangle packer in TypeScript (ours) that packs each part's baked maps into one atlas and remaps its UVs, so a preset draws with one material (on a trim-sheet budget).

**First test:** remake the capacitor can this way (a square can with inset panels, bolt heads and a hazard band) and compare it with the image-made can in the same lab shot.

**Ask Argo (creative lead):** which detail goes in which rank for the lab machines and the rovers, whether the stage-to-rank ladder above reads right, and the trim-sheet palette.
