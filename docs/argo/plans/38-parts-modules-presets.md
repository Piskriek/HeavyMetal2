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

**Ask Argo (creative lead):** which detail goes in which rank for the lab machines and the rovers, whether the stage-to-rank ladder above reads right, and the trim-sheet palette.
