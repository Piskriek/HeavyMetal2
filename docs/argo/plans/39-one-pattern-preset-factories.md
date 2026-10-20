# 39: One pattern for the whole game: four preset factories (Opus, 2026-10-20)

**The owner, 2026-10-20**, after plan 38's parts and the fat-green-screw loop: "its the same for lighting and other aspects of the game really. thats how it should be done."

This is the rule the per-domain plans follow. It adds no fifth metric (constitution 1): each of the four floats already has its machine, and each machine becomes the factory for one kind of preset.

## 1. The pattern
Every look-and-feel system in the game is built the same way:
1. **A preset is plain JSON**, evaluated by a **pure engine** (deterministic, no clock, no randomness, no DOM) into what the renderer draws.
2. **Its parameters carry a schema** (name, unit, min, max, step, default), so the Studio, the Drafting Table and an agent all get the same sliders for free.
3. **Detail is ranked and the stage unlocks it** (plan 38: drawn = min(stage rank, Graphics tier rank)), so reality visibly upgrades and the min-spec laptop stays smooth.
4. **A cartridge carries a preset** (`@hm/vault`). It is authored at the Drafting Table, printed by its machine for that machine's float, slotted into the beam rifle, and applied by firing at what it changes.
5. **New designs are graphs, not code** (nodes plus exposed sliders), so a player's or an agent's design is safe to share by code, to sync with the shared world, and to validate. The Studio's bring-your-own-agent API (STUDIO_CREATIVE_SUITE_SPEC section 9) edits these graphs.
6. **The world stores overrides:** a placed thing keeps its preset id plus per-path overrides, in the plot save, synced as JSON.

7. **Previews drive play (the owner, 2026-10-20):** "where appropriate we want to use previews to stimulate the players creativity, seeing the material preview and imagining what it would look like will trigger them to try it on the model, not just materials its how we drive the player to customize and play around with settings." Every page that edits a preset shows a live view of the exact result, and every choice on it (a part, an operator, a material, a light, a species, a preset) is drawn as a preview and tried on in that view by hover or focus: leaving restores it, a click keeps it. Sliders without a live view are not shipped. The pattern is the bench's Parts page (`bench-parts.tsx`, `part-preview.tsx`): a small turntable in its own WebGL context that exists only while the page is open, part thumbnails rendered once through it, and materials drawn as lit balls. The Lx and Aq factories follow it: a light preset tried on a lamp in the view, a species tried on a sapling.

**Preset inception (the owner):** "the studio is where you have maximum control. thats been the idea all along, preset inception." Presets are made of presets at every level: a part's sliders, a module of parts, a machine of modules, a base of machines, and likewise a material of layers, a light rig of lamps, a biome of species. The Drafting Table exposes a slice of this in play; the Studio exposes every level, with the player's own AI.

## 2. The four factories
| Float | Machine | Preset | Engine (have / to build) | The beam applies it to |
|---|---|---|---|---|
| Pxd | Texture Mill | material: maps, wear, colour | `@hm/texgraph` (have) | a surface: the ground (today), a part's skin |
| Vtx | Shape Press | part, module, machine | `@hm/kitspec` (have), `@hm/partgen` and shape graphs (to build) | a placed part (a bolt, a panel) |
| Lx | Light Projector | light: a lamp's colour, temperature, intensity, falloff, flicker; a plot's sun, sky, fog and exposure | to build, from the stage-look and lighting presets (Studio S1b's presets refactor) | a lamp, or the sky above a plot |
| Aq | Water Maker | water and life: water colour and flow, foliage species, density, wind | `@hm/treegen` and `@hm/flora` (have), Argo's TICKET-31 foliage patch | a water body, a tree, a patch of ground cover |

## 3. What already fits
- **Pxd:** `@hm/vault` already holds 50 material cartridges on texgraph with knobs, and beam Apply paints them onto the ground (TASK-21).
- **Vtx:** `@hm/kitspec` (parts, modules, presets, ranks) and the kit-built capacitor bank (plan 38).
- **Lx:** the stage looks and the lighting rig are values in code today. The Studio plan already turns them into presets (S1b); they become graph presets with ranked detail (shadow quality, light count, volumetrics) instead.
- **Aq:** treegen is already a pure generator with species parameters, and its foliage ladder is agreed (OPUS_NOTE_34).
- **Detail by stage:** heavygear already adds geometry by stage (plan 38 section 5).

## 4. Order
1. Vtx first: `@hm/partgen` (bolt, panel, can, beam), kitspec `param` parts, picking by part index, beam Apply on a part, a part cartridge (plan 38 sections 7 and 8).
2. Pxd: material cartridges also apply to a part's skin (the same Apply path).
3. Aq: the foliage patch (TICKET-31) lands as species presets with sliders; the beam applies a species to a tree.
4. Lx: light presets with sliders; the beam applies a light preset to a lamp, then to a plot's sky.
5. The Studio: one preset editor (schema sliders, the graph view, paint layers) for all four, and the agent API over it.

## 4b. The Studio vs the Drafting Table (the owner, 2026-10-20)
"what i see in the studio atm is good enough for the drafting table maybe... but the studio needs deep asset manipulation tools, these tools like the base algorithm created models can also have presets so you can smooth a entire model in one go with the smooth preset button... the popular software out there feature loads of presets we need."
- The current Parts panel (sliders, slot materials, the stage ladder) is the **Drafting Table's** level of control.
- The **Studio** needs a deep toolset: mesh operators as presets (one click applies to a whole model: smooth, bevel, decimate, remesh, subdivide, mirror, array, solidify, weld, boolean, displace, bend, twist, taper, UV unwrap and pack, paint layers, and more). Each operator is itself a preset with a slider schema, stacked non-destructively like Blender's modifier stack and saved with the asset.
- **Argo** researches the complete operator and preset set of the popular tools (Blender modifiers and geometry nodes, Houdini SOPs, ZBrush deformers, Substance Painter, Plasticity, Nomad Sculpt, Womp, Spline and others) and designs the Studio's layout and workflow. **Arena battles** code the operators as pure TypeScript (a mesh-operator package, one ticket per family), with Argo polishing and Opus verifying by tests.

## 5. Research to do first (SOP)
How the closest games let players author and apply presets, and what players praise and hate in them: Dreams (Media Molecule) for authored graphs and sculpting, Spore's part editors, Space Engineers 2's block variants and colour/skin tool, No Man's Sky's base parts and paint, the Fallout 4 and Starfield workshop and ship builder, and Townscaper for constrained procedural building. Write the findings to a research doc before the Studio preset editor is designed.

**For Argo (creative lead):** confirm the four factories and their beam targets; the Lx and Aq cartridge ideas are proposals for your call.

## 6. Steps 3 and 4: the build (Opus, 2026-10-21; research in `docs/PRESET_FACTORIES_RESEARCH.md`)
Steps 1 (Vtx parts) and 2 (Pxd skins on parts) are done. The same loop for the other two floats, in this order:

**Shared first.** The bench preview becomes one turntable (`turntable.ts`) that any page feeds an object: the part, a tree, a lamp. Each page keeps the previews rule (live result, hover try-on, choices drawn as previews).

**Aq: species cartridges.**
1. `@hm/cartlab`: a cartridge kind `species` carrying `{ name, species, params }` (params resolved through `resolveTreeSliderParams`), written on the bench like a Texture Mill preset (a blank, bench time, gate power; no raw stock), saved and validated like part cartridges.
2. The bench's **Species** tab: named presets first (one per species plus Autumn oak and Hydro birch), the treegen sliders (height, crown spread, crown base, lean, branch density, leaf size, sway, canopy palette), a live tree growing in the turntable, hover try-on.
3. The plot's trees: `plot-biome-view` gains **variant slots**: each distinct preset on the plot is its own instanced set (near and far), at most 6; a tree moved into a variant keeps its place, scale and yaw. The overrides (`tree place -> preset`) live in the props save and are re-applied after every rebuild (a stage change).
4. The beam: a species cartridge in Apply, aimed at a tree (the nearest trunk to the view ray, within reach), regrows that tree on a tap; a hold or Shift regrows every tree of the same kind within 12 m. Like for like: it fits trees only. At the cap it says so.
5. Tests: cartlab units, the variant slots (a tap moves one instance, the cap), and a browser check (print, load, fire, survives a stage change).

**Lx: light cartridges.**
1. `@hm/cartlab`: a cartridge kind `light` carrying `{ name, kelvin | colour, intensity, pattern }` (pattern: steady, pulse, blink, flicker).
2. The bench's **Lights** tab: named presets first (Sodium amber 2000 K, Work white 4000 K, Daylight 5600 K, Cold lab 7500 K, Hazard strobe, Ember flicker), a Kelvin slider drawn warm to cool, the signal colour as a separate mode, a square lamp housing glowing over a floor in the turntable, hover try-on.
3. Lamps: a kit lamp wears `lx:<kelvin>:<intensity>:<pattern>` as its material, resolved like a skin (one shared emissive material per preset, its pattern animated once a frame for all lamps that wear it, so it stays cheap); real point lights stay the Graphics tier's extra.
4. The beam: fired at a lamp it sets that lamp; held, every lamp on the machine. Like for like.
5. Later: a light preset on a plot's sky (sun, fog, exposure), with Argo.
