# Material layers research (Opus, 2026-10-21)

**The owner, 2026-10-21:** "the machines look much better, materials should be like machine parts presets, a combo of diffuse/normals/specular/bump/roughness/detail/ramp.. the list goes on. there should be presets like rust/wear/dirt/.. the list goes on, ready to apply and tweak, you can do it in substance painter and i know ive asked for the good stuff. keep asking yourself, is this modular, and can it be? the game is the cake example int he bakery we are building to use a crude metaphor"

This is the research pass (CLAUDE.md drift guard 4) before plan 41. Plan 39 already named "a material of layers" as the Pxd factory's next level; this is that level.

## 1. What we have
- **`@hm/texgraph`** (`packages/texgraph/src/index.ts`): 11 node types (blend, cellular, checker, constant, grain, invert, levels, noise, ramp, stripes, warp). It evaluates a tileable square into albedo, height, a normal from the height, and roughness. It has no metalness channel and nothing that reads a mesh.
- **`@hm/vault`:** 50 material cartridges on texgraph, made for the ground. `apps/web/src/play/vault-skin.ts` already puts one on a part's skin (`vault:<id>`): a 64 px tile a metre on the parts' metric box UVs on Medium and High, and a flat colour on Low.
- **Kit materials:** `PART_SWATCHES` (6 flat colour, metal and roughness values, `part-swatches.ts`) and `KIT_TRIM_PALETTE`. The planet caps metalness at 0.35 (`plot-kits.ts`), because the planet scene has no environment map and true metal draws black there. That cap is a stopgap.
- **`@hm/meshops` `surface-edge-wear-ao`** (TICKET-38): it cuts hard strips along sharp edges into an `edge-wear` slot and puts the bottom band into a `cavity-dirt` slot. Each is a whole slot with one flat material: no soft falloff, no noise breakup, no layering over the paint.
- **The Studio's material designer** (`apps/web/src/studio/material-designer.tsx`): macro sliders (hue, grain, weathering, roughness, bump) over 6 flat cartridges. A Flash prototype.
- **Planned, never built:** STUDIO_CREATIVE_SUITE_SPEC's S1 `@hm/matgraph` ("a PBR material node graph (noise, layers, masks, triplanar) compiled to a three.js material, with a preset library").
- **three.js 0.186:** `MeshStandardMaterial` covers colour, roughness, metalness, normal, bump, AO and emissive. `MeshPhysicalMaterial` adds clearcoat, sheen, anisotropy, iridescence and specular. The repo already patches shaders through `onBeforeCompile` (`plot-biome-view.ts`, `rim-floor.ts`, `terrain-view.ts`).

**The gap:** we have no layers, no masks from geometry, and no channels beyond colour, roughness, metal and a tile's height. Players get no preview of wear and no way to save a material.

## 2. How the reference tools do it
- **Substance 3D Painter:**
  - **Smart materials.** A smart material is a saved group of layers that "can generate textures that take the geometry of the targeted 3D asset into account". If you swap the mesh, it recalculates. Smart materials can only be made and used inside Painter ([Adobe: smart material](https://helpx.adobe.com/substance-3d-community-assets/desktop/the-different-asset-types-on-substance-3d-community-assets/smart-material.html)).
  - **Generators.** Masks come from generators that read baked mesh maps (position, curvature, AO, world-space normal). The **Dirt** generator exposes these controls ([Adobe: Dirt](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/generators/dirt)):
    - level and contrast;
    - grunge amount and scale;
    - triplanar projection;
    - edge masking from the curvature;
    - micro detail (curvature type: Standard, Sobel or Smooth; AO radius and depth).
  - **The Mask Editor.** It stacks these inputs, each with its own blend mode and opacity, then applies a global balance, contrast, blur and invert ([Adobe: Mask Editor](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/generators/mask-editor)):
    - textures (scale, contrast, triplanar);
    - AO (balance, contrast, blur);
    - curvature, with modes for edges, cavities, both or raw, and frequency bands from sharp to huge;
    - world-space normal directions (top to bottom, left to right, front to back);
    - position gradients on each axis;
    - thickness and micro details.
  - **Anchor points.** One layer's result can feed another layer's mask or fill, so painted detail drives the wear live ([Adobe: anchor point](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/anchor-point), [Substance magazine](https://magazine.substance3d.com/substance-painter-introducing-anchor-points-and-references/)).
  - **Newest releases.** 12.0 (March 2026) added flatten layers, warp-to-geometry decals and post effects ([The Rookies](https://www.therookies.co/blog/headlines/adobe-unveils-substance-3d-gdc)). 12.1 (SIGGRAPH 2026) adds auto rebake, a hard-surface auto UV mode and OpenPBR across the Substance tools ([Adobe community](https://community.adobe.com/announcements-48/substance-3d-at-siggraph-2026-faster-workflows-openpbr-everywhere-and-digital-twins-at-scale-1633138)).
- **Unity HDRP Layered Lit:** up to four layers, a layer mask whose channels set each layer's visibility (with its own tiling), height-based blending, and vertex colour that multiplies or adds to the mask ([Unity docs](https://docs.unity3d.com/Packages/hdrp/manual/Layered-Lit-Shader.html), [SRP commit](https://plastichub.unity.cn/unity-tech-cn/ScriptableRenderPipeline/commit/f3b40a2b-6730-457b-94e2-24c4a5cfa50a)).
- **Unreal:**
  - **Material Layers.** Layer assets are blended by masks, "paint over primer, dirt over metal, or moss over stone", and a dirt mask uses noise in crevices ([Evermotion](https://evermotion.org/tutorials/show/13180/material-layering-in-unreal-engine)).
  - **Substrate.** It is on by default in 5.7. Layering is vertical (a clear coat over a base over flakes) and horizontal, and coverage weights blend rust ([UE 5.7 Substrate notes](https://lilys.ai/notes/zh/d5-render-20260219/substrate-materials-ue5)).
  - **"Procedural Material Layers" (Fab).** The pack sells this feature set ([Fab](https://fab.com/s/0a26f21e3f35)):
    - 4-channel vertex painting;
    - breakup textures;
    - height and albedo blending;
    - procedural damage;
    - dirt and peeling.
- **OpenPBR** (Academy Software Foundation, a MaterialX subproject): a base slab, then thin film, a coat (clear coats and varnish), and fuzz, which models micro-fibres "such as peach fuzz, textile strands, and dust grains" ([OpenPBR companion paper, Dec 2025](https://arxiv.org/html/2512.23696v1), [Maxon docs](https://help.maxon.net/c4d/en-us/Content/_REDSHIFT_/html/Material+OpenPBR.html)).
- **ArmorPaint** (open source, zlib):
  - unlimited masks per layer and mask blending (0.8);
  - masks on layer groups (0.9);
  - node-driven masks;
  - bakes of AO, cavity, curvature and thickness.
  
  Sources: [CG Channel 0.8](https://www.cgchannel.com/2021/10/armorpaint-0-8-ships), [CG Channel 0.9](https://www.cgchannel.com/2023/09/armorpaint-0-9-ships).
- **Wear without unique UVs:**
  - Artists colour vertices by edge angle and use that as the wear mask ([Polycount](https://www.polycount.com/forum/showthread.php?p=1162713)).
  - A Blender add-on stores masks per vertex "with no UVs and no texture memory", adding a texture only for fine detail ([Superhive Advanced Masks](https://superhivemarket.com/products/advanced-masks-bundle/docs)).
  - An Unreal prototype drives paint, rust, metal and dirt layers from vertex colour with no dedicated UVs ([Polycount](https://polycount.com/discussion/comment/2472797)).

## 3. How games hand it to players
- **Armored Core VI:** players choose a colour per part, plus weathering, pattern and luster. Painting can go "en masse for quick and easy jobs" or down to "nearly every minute detail" ([Destructoid](https://destructoid.com/?p=399590)). Quick presets add "shine, rust, and other weathering options" ([Shacknews](https://shacknews.com/article/136759/armored-core-6-fires-of-rubicon-review-score)). There are 23 weathering effects, applied to the entire frame ([Siliconera](https://vip-develop.siliconera.com/?p=977801)), and players share their designs online ([Sportskeeda](https://www.sportskeeda.com/esports/armored-core-6-complete-ac-customization-guide-all-options-online-features-explored)).
- **Gundam Breaker 4:** colour, finishing, weathering and decals, per piece or all at once. Reviewers call the customisation the standout ([Shacknews](https://shacknews.com/article/141155/gundam-breaker-4-slug), [Nintendo Everything](https://nintendoeverything.com/review-gundam-breaker-4/)).
- **Halo Infinite:** a coating is "a seven-layer shader" holding artist-made colour, material and pattern channels. It replaced free primary and secondary colours, and players objected to the confusion and to the sales ([Windows Central](https://windowscentral.com/343-industries-explains-what-halo-infinites-armor-coatings-are), [VGC](https://www.videogameschronicle.com/news/343-industries-addresses-confusion-over-halo-infinites-new-customisation-system-and-microtransactions), [Halopedia](https://www.halopedia.org/Coatings_(Halo_Infinite))).
- **Satisfactory:** the build gun's Customizer sets a material, a swatch (primary and secondary colour) and a pattern. A material applies only to compatible structures ([wiki](https://satisfactory.wiki.gg/wiki/Customizer)). The modding docs warn that each new material limits performance ([ficsit docs](https://docs.ficsit.app/satisfactory-modding/latest/Development/Satisfactory/Paintable.html)).
- **Starfield:** a ship part has three colour slots set by hue, saturation and brightness. A player can't paint half the ship one colour without changing each piece by hand. Mods add palettes and retextures, with no weathering ([Prima](https://primagames.com/gaming/how-to-customize-your-ship-color-in-starfield), [Nexus palette mod](https://www.nexusmods.com/starfield/mods/6950)).
- **Space Engineers:**
  - **One skin per block.** A block has a colour and exactly one skin. Rust, dust, frozen and battered are each a whole skin, several of them DLC ([wiki](https://spaceengineers.wiki.gg/wiki/Paint)).
  - **The unmet request.** Players asked for frozen, dust and rust as an extra texture layer that weather applies and removes without repainting. Keen's status: "Considered (Not Planned)" ([Keen feedback: Covered materials](https://support.keenswh.com/spaceengineers/pc/topic/49476-covered-materials)).

## 4. What players like, and what they miss
- **Liked:**
  - one-click looks with a quick weathering amount (AC6's shine and rust);
  - deep per-piece control for those who want it (AC6, Gundam Breaker 4);
  - painting one piece or everything at once (Gundam Breaker 4, Space Engineers' multipaint);
  - sharing designs.
- **Missed or disliked:**
  - weathering welded into a skin, so dust or frost can't sit over your paint (Space Engineers);
  - looks sold as bundles in place of free colour (Halo);
  - no way to paint a group (Starfield);
  - materials only on "compatible" pieces (Satisfactory);
  - each new material costing frame time (Satisfactory modding).
- **Tool side:** Substance's smart materials can't leave Painter, so they can't be tweaked in a game. Its generators need baked maps on unique UVs, which our kit parts don't have: they use shared metric box UVs.

## 5. What this means for us
1. **Weathering is layers over the paint, never a skin swap.** Rust, dust, dirt and frost are applied, tuned and removed on their own, over any paint. This is the Space Engineers gap.
2. **Masks come from geometry like Substance's generators, but per vertex plus noise:** edges, cavities, up-facing, a bottom-to-top gradient, noise and streaks. They need no bake and no unique UVs, so they work on kit parts and on generated GLB cores alike.
3. **One shader family draws every material:** features become compile flags and presets become uniforms. So a hundred presets cost what one does (the Satisfactory warning).
4. **Two depths:**
   - an Age slider for the quick AC6 path;
   - the full layer stack for the Substance path.
5. **Apply to one part, to every part on the machine with the same material, or to the whole machine:** Gundam Breaker 4 and Space Engineers' multipaint.
6. **Every look is free to make, and paint stays free.** No locked colours (Halo).
7. **Channels follow OpenPBR's slabs:**
   - base colour, metal, roughness and specular;
   - height as bump and normal;
   - a detail tile;
   - a colour ramp;
   - coat;
   - fuzz (dust sheen);
   - anisotropy (brushed metal);
   - thin film (heat tint);
   - emission.
   
   OpenPBR is where Substance is heading (12.1), so our presets map onto it cleanly later.
8. **Substance Painter is a look target and a source of HD tiles, not the runtime.** Its smart materials can't leave Painter. We build each preset in it as the reference, compare renders side by side, and export tileable maps for the HD pack (the toggle rule: the procedural tiles ship in the single file, the authored ones in the pack).
9. **Legal art (owner rule):**
   - HD tiles are either the owner's own Substance work or CC0 scans. ambientCG and Poly Haven are CC0 according to third-party guides ([Cinevva guide](https://app.cinevva.com/guides/free-textures-hdris-materials)); read each site's own licence page before shipping.
   - Substance's bundled assets need their EULA checked before anything made from them goes into the bundle.
