# Scene-first interface prompt reference

This is the approved interface-generation baseline. Future interface concepts should preserve its composition, density, material treatment, and interaction hierarchy while changing only the workspace-specific scene and drawer contents.

The interface is itself a recursively editable preset. Its stage, toolbar, drawers, icon families, materials, accents and inhabited details may be sculpted and painted under [`../INTERFACE_PRESET_SCULPT_PAINT_STANDARD.md`](../INTERFACE_PRESET_SCULPT_PAINT_STANDARD.md) without violating this scene-first contract.

## Approved prompt

> Redesign this Preset Library, Share and Remix view as a scene-first gallery. A selected high-fidelity island or goblin preset preview occupies around 78 percent of the image on a bright white 3D stage. Remove persistent hierarchy tree, multi-tab grid, details sidebar, remix tree and action panel. Keep one compact six-button square toolbar at lower-left. Show ONE shallow Presets drawer pulled up from the bottom, occupying at most 20 percent height, containing a single row of six sharp-corner tactile PBR thumbnails, search icon, and square close/detach control. Selecting a card enlarges the scene; details appear temporarily beside the selected card, not in another window. No rounded cards or pills. A green/magenta paint spill from the selected card grows into PBR soil, ferns, road timber and metal props on the white floor. Small punk goblin racer sleeps beside paint cans at lower-right. Sparse handprints, crown/remix doodle and restrained scratches only. No additional windows, dense grids, dark background or clutter.

## Invariants to carry into every workspace

1. **Scene share:** the high-fidelity subject occupies roughly `78–90%` of the image.
2. **Stage:** bright white three-dimensional stage or gallery, not a flat dashboard background.
3. **Removal language:** explicitly list and remove every persistent tree, grid, sidebar, inspector, action panel, footer, and header not essential to the demonstrated task.
4. **Toolbar:** one compact toolbar with six square buttons at lower-left.
5. **Drawer budget:** one open drawer in a normal task state; it occupies no more than `20%` of the relevant width or height.
6. **Drawer contents:** one shallow row or one concise control stack—never a dense nested dashboard.
7. **Transient detail:** metadata and advanced options appear temporarily beside the selected object/card, not as another permanent window.
8. **Geometry:** sharp corners only; no rounded cards, pills, capsules, soft dashboard tiles, or decorative window arches.
9. **PBR preview:** thumbnails are tactile, physically lit material or preset previews rather than flat icons.
10. **Paint transformation:** a controlled green/magenta spill becomes context-relevant PBR terrain, foliage, materials, or props on the white floor.
11. **Recurring character:** one small punk goblin racer sleeps beside paint cans at lower-right and remains subordinate to the scene.
12. **Lived-in restraint:** sparse handprints, one or two workspace-relevant doodles, and restrained scratches only.
13. **Negative constraints:** always end by forbidding additional windows, dense grids, dark backgrounds, rounded UI, heavy graffiti, and clutter.

## Workspace substitutions

Keep the approved sentence structure and replace only these elements:

| Workspace | High-fidelity subject | Single drawer | Paint-grown PBR elements | Doodle accent |
|---|---|---|---|---|
| World Paint | Island and painted biome | Presets | Soil, ferns, rocks, road fragments | Crown/brush |
| Terrain Sculpt | Island terrain and sculpt cursor | Sculpt | Wet basalt, soil, roots | Crater/arrow |
| Recursive Dive | Selected recursive object | Preset or Material | Roots, leaf litter, child props | Nested mouth/eye |
| Goblin Creator | Editable 3D goblin | Material or Parts | Leather, moss, armor scraps | Teeth/ear |
| Material Lab | Selected surface close-up | Surface | Material samples, minerals, foliage | Eye/drip |
| Preset Graph | Dependency graph | Details | Roots, linked props, basalt | Plug monster |
| Local AI Forge | Generated modular preset | Forge | Timber, basalt, pipes, gears | Gear face |
| Bake/Performance | Island or selected cluster | Performance | Proxy geometry, grass, rock | Wheel/flame |
| Library/Remix | Selected preset diorama | Presets | Soil, ferns, timber, metal | Crown/remix |
| Compact Build | Full gameplay island | none by default | Jungle edge and road props | Speed teeth |

## Failure conditions

Reject or regenerate a concept when:

- the scene occupies less than roughly three quarters of the image;
- more than one normal drawer is open without specifically demonstrating parent/child navigation;
- a hierarchy tree, inspector, grid, timeline, shelf, and header are simultaneously visible;
- controls use rounded corners or pill shapes;
- the white stage becomes a generic flat web dashboard;
- paint and PBR growth obscure the subject or controls;
- the sleeping goblin becomes a focal character rather than a small lived-in detail;
- doodles, handprints, scratches, racing lines, or grime make the composition noisy.
