You are the concept artist for "FIDELITY: The SetMix Multiverse" (repo Piskriek/HeavyMetal2). Your session starts on your own branch; first FETCH the branch `feat/monster-mash-exploration` BY NAME and merge it into your branch (it holds everything below). Push your work to your own branch only.

READ FIRST (canon; it outranks this prompt where they differ): `docs/concept/setmix/README.md` (the world bible and how the earlier sheets were made: text-free images, callouts typeset afterwards with ImageMagick, verbatim prompts recorded), then LOOK at `docs/concept/setmix/06-sheet-gate.png`, `08-plot-stage-ladder.png`, `11-desolate-horizon.png` and `12-sheet-field-machines.png`. Match their gate, ground, palette and stage ladder exactly. Then read `docs/BASE_BUILDING_ARCHITECTURE.md` sections 0 and 2 (what the pieces are and how they join).

THE TASK: the art direction for freeform base building on the moon plot (Valheim / Dune: Awakening style). Players build bases from snapping pieces on a lattice of 4 m cells and 3 m storeys. Heavy terraformers no longer stand alone in the field: each one is bolted to a hardpoint pad on the base. Deliver:

1. `13-sheet-base-construction.png` — design sheet, every piece twice: stage 1 (chunky low-poly, 16-colour, flat-shaded) and stage 6 (full PBR). A hazmat scientist (1.8 m) stands in one panel for scale. Pieces:
   - Heavy foundation slab, 4 x 4 m, about 0.5 m thick, on sloped regolith: its levelling skirt drops into the ground so nothing floats; anchor bolts; hazard-striped edge.
   - Structural wall, 4 m wide x 3 m tall; pillar (corner post); upper floor / roof panel; ramp (rises one storey over one cell).
   - Reinforced airlock: a wall piece with a sealed door, a status light and a pressure seal you can read as working.
   - Heavy terraformer hardpoint: a socket on a 2 x 2 pad of slabs (8 x 8 m) with a bolted mounting ring and power and data glands. Show it empty and with a HEAVY texture mill installed: clearly bigger, heavier and more serious than the field mill on sheet 12 (about twice its height, on the pad, fed by thick cables in floor covers), spewing a plume of colourful pixels while it runs.
   - Quantum storage bin (several link up through the lab's quantum bridge: give it a visible link emitter), quantum repeater pylon (extends the link range), drafting table (a workbench where a geometric primitive and a texture map are combined into a blueprint: show a primitive and a material swatch on its surface).
2. `14-outpost-stage-3.png` — scene: a small sealed outpost on the plot at stage 3 (stage 3 as on sheet 08): a few slabs on uneven ground, walls, an airlock, one heavy terraformer on its pad pouring pixels, a storage bin, the gate visible in the distance, cables in floor covers. The plot is natural, just low-res; desolate, not lit like a stage.
3. Update `docs/concept/setmix/README.md` with rows for 13 and 14 and their verbatim prompts; rebuild `contact-sheet.jpg`.

HARD RULES (the owner rejected these before):
- NO chimneys, stacks or smokestacks of any kind. Machines spew colourful pixels while they operate; that is the only emission.
- Nothing floats. Every piece stands on the ground or on another piece; feet, plinths, skirts and bolts are visible. Every machine has a cable from a power source, routed in floor covers or trays. Every part has a job you can guess.
- No floating abstract shapes, no sci-fi greebles without a purpose, no text baked into images (callouts are typeset afterwards).
- Do not draw goblins, karts or race tracks.
- Keep scale honest: the scientist is 1.8 m, a slab is 4 m, a storey is 3 m.

REVIEW LOOP: you can see images, so look at each render before keeping it: check for anything floating, any chimney-like shape, a wrong scale, or stage 1 that is not chunky and low-colour. Redo what fails. Report what you checked.

When done, reply with the branch name, the two file paths and a one-line note per image.
