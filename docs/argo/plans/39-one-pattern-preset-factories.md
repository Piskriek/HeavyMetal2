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

## 5. Research to do first (SOP)
How the closest games let players author and apply presets, and what players praise and hate in them: Dreams (Media Molecule) for authored graphs and sculpting, Spore's part editors, Space Engineers 2's block variants and colour/skin tool, No Man's Sky's base parts and paint, the Fallout 4 and Starfield workshop and ship builder, and Townscaper for constrained procedural building. Write the findings to a research doc before the Studio preset editor is designed.

**For Argo (creative lead):** confirm the four factories and their beam targets; the Lx and Aq cartridge ideas are proposals for your call.
