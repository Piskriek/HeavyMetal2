# TASK-31: the Studio's review grid and fix flags, the stage scrubber, sockets, the two-tier material designer, the lab terminal (Wave D)

After Wave C. The sources:
- Argo's `20-studio.md` (P0-STUDIO-01, P0-STUDIO-02, P1-STUDIO-03, P1-STUDIO-04, P1-STUDIO-05);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, briefs 31 and 32, which wins where it differs:
  - **the scrubber shows stages 0 to 6** (five looks; never S0 to S4);
  - **the monster `remapStrength` slider** belongs here (O3: per skin, 0 to 1, default 0.20).

The owner's words for the Studio (OWNER_ASKS, 2026-10-08 and 2026-10-12): "the one stop shop with the latest and greatest most favoured editing tools in the industry ... easy to use with loads of presets and depth". "Me first, players later." The research (Unreal's Content Browser, Blender's keymap, Substance's layers) is in `docs/STUDIO_CREATIVE_SUITE_SPEC.md` and the plan's §3.

**Load the frontend-design skill.** Match the Studio's existing look (TASK-17 and 18; `apps/web/src/studio/`, `studio.css`).

## Where it lives
- **The Studio:** `apps/web/src/studio/`, with the content browser, gizmo viewport, details, the Changes panel with Accept, and the asset bench with Low, Mid and High and the redo panel.
- **The write-back** is dev-only: `apps/web/studio-server/` (tweaks into `studio-data/asset-tweaks.json`; the bench routes under `/__studio/bench`). The built game asks none of them (6e4b3ed4).
- **The pipeline manifest:** `docs/runworld/assets.json`, with `fix`, `reach`, `budgets`, `yaw`, `lowInPlace`, `hold` and `lumOk`.
- **The monster roster:** `apps/web/src/monsters/roster.ts`, generated from `docs/monsters/packed.json`.
- **The cartridges:** `@hm/vault` (the curated set) and `@hm/texgraph` / `@hm/wiregraph` (the graph).

## Build
1. **The four-angle review and the fix flags (P0-STUDIO-01).**
   - A toggle beside Low, Mid and High shows the selected asset front, right, back and iso at once, with the back face picked out, so a dark or invented back shows in a second. It is the same review Opus runs in Blender (`scripts/render-angles.py`).
   - One-click flags write to `assets.json` through the Changes panel and Accept: `fix: mirror-z`, `fix: plain-back`, `reach: 3`, `hold`, and `lumOk`. Add a dev route in `studio-server` for them, validated like the tweak route; never a free-form write.
   - Show the asset's luminance gate result (`scripts/surface-luminance.mjs`, low ≥ 0.18 and low/high ≥ 0.85) beside the levels.
2. **The stage scrubber (P0-STUDIO-02):** a pill in the viewport's toolbar, from Neutral through S0 to S6. It renders the asset or scene with the game's own stage look and lighting (the post pass and the stage lights from `apps/web/src/play/`, not a copy), so nothing ships that looks right in the Studio and black on the stage-0 Moon.
3. **Sockets and attachments (P1-STUDIO-03).**
   - A sub-mode: select a base model (preset bench, weapon bench, modular scout, texture mill, and so on), add a socket (child mesh, feed hopper, pixel exhaust, cable gland), and raycast-snap it onto a face.
   - Preview the attached tool, yoke or plume live; Accept persists the sockets in a Studio data file the game reads (beside `asset-tweaks.json`).
   - The game uses these sockets where TASK-29 placed hoppers and exhausts, and where TASK-23c placed the bench's tools.
4. **The material designer in two tiers (P1-STUDIO-04).**
   - **Tier 1 (the default):** the curated cartridges as material spheres, with five macro sliders (hue, grain, weathering, roughness, bump) and a fuse slot for two cartridges, as the lab's combiner does.
   - **Tier 2 (behind an Advanced toggle):** the full node graph, with a live tier preview from Potato to Ultra, keeping the mean colour constant across tiers (D21 in `archive/legacy_docs_goblin_era/MATH_TEXTURES.md`).
5. **The lab terminal (P1-STUDIO-05):** the in-game Studio terminal (TASK-22's A4-03, "It's not really dirt") embeds the same schema inspector and Changes panel, filtered to the gameplay-safe schemas (resource labels, cartridge presets, plot rules), with an "Open the full Studio" button.
6. **Monsters' `remapStrength`** (O3): a per-skin slider in the Studio's monster view (0 to 1, default 0.20). It previews on the monster bench's renderer and saves through the Changes panel to a monster tweak file the game reads.

## Tests
- **Extend `scripts/test-studio.mjs`** (74 of 74 today):
  - the grid shows four views;
  - a flag goes into `assets.json` on Accept, and back out on Undo;
  - the scrubber changes the look, with a pixel check that S0 is black and white;
  - a socket persists and the game reads it;
  - the material sliders change the sphere;
  - the terminal's filtered schemas;
  - the monster slider saves.
- **Unit:** the flag writer's validation (only known flags, only known ids) and the socket file's schema.
- **Shots:** each new panel. Look at every one.
- **The usual green set,** with the build size.

## Report
On the board:
- the shots;
- the test-studio count;
- what the owner should try first.

Opus refreshes Argo's tour shots 15 and 16.
