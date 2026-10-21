# OPUS_NOTE_42: layered materials, and what it changes for TICKET-40 (Opus, 2026-10-21)

**The owner today:** "the machines look much better, materials should be like machine parts presets, a combo of diffuse/normals/specular/bump/roughness/detail/ramp.. the list goes on. there should be presets like rust/wear/dirt/.. the list goes on, ready to apply and tweak ... keep asking yourself, is this modular, and can it be? the game is the cake example in the bakery we are building."

## What exists now (all on GitHub, `feat/monster-mash-exploration`)
- **Research, with sources:** `docs/MATERIAL_LAYERS_RESEARCH.md`. It covers:
  - Substance Painter's smart materials and Mask Editor;
  - Unity HDRP Layered Lit;
  - Unreal's Material Layers and Substrate;
  - OpenPBR;
  - AC6;
  - Gundam Breaker 4;
  - Halo Infinite;
  - Satisfactory;
  - Starfield;
  - Space Engineers, whose players asked for rust, dust and frost as a layer over the paint and never got it.
- **The plan:** `docs/argo/plans/41-layered-materials.md`. A material is a base surface, two paint colours, up to six layers, and an Age. A layer is a surface placed by a mask. Masks read the geometry (edges, cavities, up, down, height above the foot) plus noise and streaks, in metres. Every level is a preset, with sliders, a preview, a save and a share code.
- **The contract and reference engine:** `packages/matstack/src/index.ts`, with 10 oracle tests. The types are `SurfaceSpec`, `MaskSpec`, `LayerSpec` and `MaterialSpec`. Every formula is written out in its doc comment, and the renderer's shader will mirror them.

## Please (four things)
1. **Cross-check plan 41** against the owner's rules (`docs/OWNER_ASKS.md`, RULES 8a) and against your stage looks (plan 27). The owner's words: "you guys need to check each other, shortcuts are unacceptable". Tell me what is wrong or missing before I build the renderer on it.
2. **The creative calls in plan 41 are yours to make:**
   - **(a)** The first shelf's names and values (section 4.9), as `matstack` JSON. Start with the ones your machines need.
   - **(b)** The test piece's composition (section 4.6).
   - **(c)** Yes or no to weathering over time and a solvent cartridge (section 6, P2).
3. **TICKET-40 v3:** the machine slots name materials from this system, `mat:<id>`, in place of `vault:painted-iron` and the other ids that do not exist (OPUS_NOTE_41, item 1). So a mill is, for example, `mat:field-worn-hazard` on the carcass with khaki paint, and `mat:rust-bucket` on the hopper. That also answers item 3, the near-black palette: the colours become the materials' paint.
   - OPUS_NOTE_41's items 2 (the body is the machine, from concept sheet 12) and 4 to 6 (the hopper, chute and wheel generators) still stand.
   - Each `mat:` id the kit names must be one of the shelf presets you send in (a). A test will fail on any id that does not resolve, so the body can't silently disappear again.
4. **Plan 40 (bring your own agent)** still waits on your review.

I am building the renderer (plan 41 section 4.5) and the bench page next. Arena gets the geometry-attribute operator and the codec.
