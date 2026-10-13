# 20 — The Studio Creative Suite Plan: An In-Engine Editor Worthy of Building the Game Inside Itself

## 1. The Goal: Turn the Studio from an Inspector Shell into the Owner's Daily Polishing Bench

The owner stated his vision for **The Studio** clearly in [`docs/OWNER_ASKS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/OWNER_ASKS.md) (2026-10-08):
> *"the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely ... so that our studio is the new gold standard in game editing and creation."*

On 13 October ([`15-studio-editor.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/15-studio-editor.jpg), [`16-studio-asset-levels.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)), the Studio shell and the Low/Mid/High asset bench landed in [`apps/web/src/studio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio). Our goal now is to elevate that shell into a frictionless creative powerhouse where the owner (and players in Act V+) can **inspect any asset across all 5 Fidelity Stages simultaneously, snap socketed sub-parts visually, author procedural textures/cartridges with 1-click presets, and commit changes straight back to the repo (`studio-data/`) or shareable `.smx` bundles**.

## 2. Where It Stands Today

- **What Exists:**
  - [`apps/web/src/studio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio) implements the 4-pane editor shell ([`15-studio-editor.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/15-studio-editor.jpg)): Content Browser, 3D Gizmo Viewport (`@hm/gizmo`), Schema-Driven Details Inspector (`@hm/modui`), and a **Changes Panel** with `Accept` write-back (`studio-data/`).
  - **The Asset Bench ([`16-studio-asset-levels.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)):** Displays one generated model at `Low`, `Mid`, and `High` detail side-by-side with a redo/touch-up panel hooked to the RUN.world + Hunyuan3D + Blender bake pipeline ([`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3).
  - Supporting packages: [`packages/scenedoc/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/scenedoc), [`packages/presetcodec/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/presetcodec), [`packages/gizmo/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/gizmo), [`packages/selectset/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/selectset), [`packages/texgraph/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/texgraph), and [`packages/wiregraph/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/wiregraph).
- **What Is Weak or Missing:**
  - **Asset Bench Shows Models Only Under Neutral Grey Lighting (`16-studio-asset-levels.jpg`):** Models that look fine in the Studio's neutral viewport can turn near-black or lose their silhouette when placed on the Stage 0 (1-bit dither) or Stage 1 (EGA) Moon! The Asset Bench lacks a **Stage 0–4 Lighting & Shader Scrubber**.
  - **Manual Socket & Hard-Part Alignment (Rule 16):** Rule 16 requires splitting hard parts (tools on benches, guns on racks, cables, aerials, yokes, plume vents) into separate objects placed in code. Right now, finding the exact `(x, y, z, rx, ry, rz)` socket coordinates requires manual code edits instead of dragging a socket gizmo on the parent mesh in the Studio and clicking `Accept`.
  - **Four-Angle Review Gate Isn't Built Into the Asset Bench UI (Rule 17):** Rule 17 requires reviewing every model from four angles (`Front`, `Right`, `Back`, `Three-Quarter`) to catch invented/black backs before shipping.

## 3. What the Best Tools & Games Do (Research & Sources)

| Reference Tool / Engine | Best-in-Class Workflow Feature | User Praise / Pain Point Solved (`docs/STUDIO_PLAN.md` Grounding) |
| :--- | :--- | :--- |
| **Unreal Engine 5 / Substance 3D Painter** | **Smart Materials / Preset Shelf + Non-Destructive Layer Stack:** Artists pick a 1-click preset (`Weathered Gunmetal`, `Lunar Basalt`, `Amber Coil`) that immediately looks great, then expand a clean slider drawer only if they want to fine-tune roughness, wear, or noise octaves. | Solves the "blank node-graph intimidation" of Substance Designer / Blender Shader Editor while keeping full procedural power (`@hm/texgraph`) one click away. |
| **Blender / Godot 4** | **Quad-View Orthographic/Angle Toggle & Socket (`Empty`) Snapping:** One hotkey switches the viewport into a 4-up grid (`Front / Back / Side / Perspective`) and lets you snap child attachments (`Sockets`) directly to surface normals with live JSON transform write-back. | Directly automates Rule 16 (splitting hard parts onto sockets) and Rule 17 (mandatory 4-angle model review). |
| **Roblox Studio / Forge Mode (*Halo*)** | **Instant Play-Here (`F5`) Toggle with Zero Reload:** Pressing one button drops your character directly into the edited scene at the camera's position, and pressing it again returns to the editor with all state intact. | Bridges the gap between the standalone Studio menu mode and the Act V in-Lab Studio terminal. |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-STUDIO-01: Add a 4-Angle Review Grid & `fix` Flag Toggle to the Asset Bench (`16-studio-asset-levels.jpg` & Rule 17)**
   - **What to build:** In the Studio Asset Bench ([`apps/web/src/studio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/studio), [`16-studio-asset-levels.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/16-studio-asset-levels.jpg)):
     - Add a **`[4-Angle Review]`** toggle next to the `Low / Mid / High` turntable that renders synchronized `Front (0°)`, `Right (90°)`, `Back (180°)`, and `Iso (45°)` views of the selected asset, highlighting the back face so invented or dark backs are spotted in 1 second.
     - Expose one-click checkboxes for the manifest repair flags from [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3 (`fix: 'mirror-z'`, `fix: 'plain-back'`, `reach: 3`, `hold: true`) that write directly to `docs/runworld/assets.json` via the Changes panel (`Accept`).
   - **Needs:** **Code** (`apps/web/src/studio/`).

2. **P0-STUDIO-02: Add a Live Stage 0–4 Shader & Lighting Scrubber to the Studio Viewport**
   - **What to build:** Add a top toolbar pill in the Studio viewport (`[Neutral Studio] | [S0: 1-Bit] | [S1: EGA] | [S2: VGA] | [S3: Gouraud] | [S4: Lush PBR]`) that applies the exact planet lighting and `fidelity` shader to the asset or scene being edited. That guarantees no asset ever ships looking right in the Studio but rendering near-black on the Stage 0 Moon.
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/fidelity/`).

### P1 — Makes It Feel AAA

3. **P1-STUDIO-03: Visual Socket & Plume-Point Editor for Rule 16 Multi-Part Assemblies**
   - **What to build:** Add a **`Sockets & Attachments`** sub-mode in the Studio (`@hm/gizmo`) that lets the owner select a base model (e.g., `preset-bench`, `weapon-rack`, `modular-scout`, `texture-mill`), click **`+ Add Socket`** (`type: 'child-mesh' | 'feed-hopper' | 'pixel-exhaust' | 'cable-gland'`), raycast-snap the socket onto any face normal of the base cage, preview the attached tool/yoke/pixel-plume live, and click **`Accept`** in the Changes panel to persist the socket coordinates into the asset registry!
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/gizmo/`).

4. **P1-STUDIO-04: Two-Tier "Preset First, Node Graph Second" Material & Cartridge Designer (`@hm/texgraph` + `@hm/vault`)**
   - **What to build:** In the Studio's Material / Cartridge tab:
     - **Tier 1 (Default Simple View):** Display the 50 curated `@hm/vault` cartridges as visual material spheres with 5 macro sliders (`Primary Hue`, `Grain Scale`, `Weathering/Moss`, `Roughness`, `Bump Depth`) and a **`[Fuse 2 Cartridges]`** slot matching the Lab's Preset Combiner.
     - **Tier 2 (`[Advanced Node Graph]` Toggle):** Expands the full `@hm/wiregraph` / `@hm/texgraph` procedural DAG editor with live Potato (`16px/128px`) to Ultra (`32px/1024px`) tier-scaling preview (`docs/MATH_TEXTURES.md` `D21`), ensuring constant mean color across all hardware tiers.
   - **Needs:** **Code** (`apps/web/src/studio/`, `packages/texgraph/`, `packages/wiregraph/`).

5. **P1-STUDIO-05: Unify the In-Lab Act V Schema Terminal (`A4-03`) with the Studio Details Inspector**
   - **What to build:** Ensure the Studio terminal inside the Lab (`TASK-22` step `A4-03`, *"It's not really dirt"*) embeds the exact same `@hm/modui` schema inspector and `Changes` diff panel used in the full Studio, filtered to gameplay-safe schemas (`ResourceLabels`, `CartridgePresets`, `PlotRules`) with a **`[Open Full Studio Suite]`** button for players who want the complete 3D editor.
   - **Needs:** **Code** (`apps/web/src/studio/`, `apps/web/src/play/`).

### P2 — Stretch Goals

6. **P2-STUDIO-06: One-Click `.smx` Cartridge & Scene Bundle Drag-and-Drop Export/Import**
   - **What to build:** Allow exporting any custom cartridge, socketed machine assembly, or spliced monster from the Studio as a compact binary `.smx` file (`@hm/presetcodec`, `< 4 KB`) or PNG "Cartridge Card" with embedded metadata that another player can drag-and-drop directly into their browser window.
   - **Needs:** **Code** (`packages/presetcodec/`, `apps/web/src/studio/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 15 (Chunky shapes), Rule 16 (Split hard parts into their own objects), & Rule 17 (Three detail levels, reviewed from four angles):** Directly enforced and accelerated by `P0-STUDIO-01` and `P1-STUDIO-03`.
- **Rule 21 (The toggle rule):** Simple Preset Sliders vs. Full Procedural Node Graph (`P1-STUDIO-04`) and Blender-style (`G/R/S`) vs. Unreal-style (`W/E/R`) gizmo hotkeys ship as instant Studio header toggles.

## 6. Owner Decisions Needed

1. **Default Gizmo Hotkeys in the Studio (`W / E / R` vs. `G / R / S`):**
   - *Question:* In `docs/STUDIO_PLAN.md`, users split between game-engine gizmo keys (`W` Move, `E` Rotate, `R` Scale — Unreal/Unity/Godot) and 3D-modeling keys (`G` Grab/Move, `R` Rotate, `S` Scale — Blender). Which keyset should be the **default** when you open the Studio on your machine (with a 1-click `[Keymap: Unreal | Blender]` toggle in the top bar)?
   - *Recommendation:* Default to **`W / E / R` (Unreal/Unity standard)** when `Right-Click Mouse Look` is not held, with the **`[Unreal | Blender]` pill toggle** right in the top viewport bar saved to your profile.
