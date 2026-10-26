# MASTER DIRECTIVE FOR GEMINI ARGO: THE STUDIO CREATIVE SUITE ARCHITECTURE
> **To**: Gemini Argo (Creative & Modular Systems Lead)  
> **From**: Francois (The Owner) & Antigravity  
> **Mandatory Reading Before Any Work**: [`docs/OWNER_ASKS.md`](file:///c:/MarbleGp/docs/OWNER_ASKS.md) (2026-10-08, 2026-10-21 Rule 8a, and 26 October feedback), [`docs/argo/RULES.md`](file:///c:/MarbleGp/docs/argo/RULES.md), and [Plan 44](file:///c:/MarbleGp/docs/argo/plans/44-studio-creative-suite-realization.md).  
> **Status**: P0 Master Architecture & Implementation Blueprint  

---

## 0. THE CRITIQUE: WHY THE STUDIO FAILED THE 30-SECOND GLANCE TEST

Argo, look at the Studio through the Owner's eyes:
> *"i still see legacy 3d models in the "scene" and "look" sections, why is there a "monster" section that doesnt work? "spore cards" is a nonsensical page with a model that looks like gym equipment, what is "moon prototype"?? i feel like these are logical questions and problems one can pickup from just a glance, what else is going on under the surface, what has argon been doing?"*

The previous response was merely a **janitor's cleanup list** (delete Moon, delete Monsters, fix Look). It failed because it lacked the **holistic product vision and planned user loops** that make a creative studio work:
1. **No Planned Loop for Tuning the Example Game**: An artist who wants to customize the campaign machines (Texture Mill, Stargate, Capacitor Bank) couldn't see how their changes propagate into the game.
2. **No Planned Loop for Creating New Worlds from Scratch**: The core mantra—*"The Game is the Example built by the Studio"*—was completely absent. There was no button or workflow to start a blank world, choose a terrain biome preset, place a Stargate, drop modular machine assemblies, set game rules, and test-play it.
3. **Unanswered Mental Model**: Tabs were organized around internal code repositories (`@hm/creature` -> Monsters, `@hm/cartlab` -> Spore Cards, legacy prototype -> Moon) rather than the creator's mental model.

**This directive defines the complete architectural blueprint to make FIDELITY Studio the new gold standard in game editing and creation.**

---

## 1. THE TWO PLANNED CREATOR LOOPS

The Studio must support two primary, polished user loops:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FIDELITY STUDIO: TWO CORE LOOPS                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  LOOP A: TUNE & MOD THE EXAMPLE GAME │  LOOP B: GENESIS OF A NEW PLANET     │
│  (Inspection, Customization & Polish)│  (From Scratch: Biome, Base & Rules) │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. Pick Active Campaign Asset        │ 1. Click [+ New Planet / World]      │
│    (Mill V2, Stargate, Rover, etc.)  │    (Pick Seed, Biome & Atmospheric S)│
│ 2. Inspect Slots in 3D Viewport      │ 2. Procedural Landscape Generation   │
│    (Hover try-on, 3D face raycast)   │    (@hm/groundshader, water, flora)  │
│ 3. Polish Materials & Layers         │ 3. Place Network Stargate & Base     │
│    (Paint 1 & 2, Age, Mask B&W)      │    (Align to terrain, auto-grounding)│
│ 4. Swap Parts & Sockets              │ 4. Assemble Custom Modular Machines  │
│    (PartGen sliders, MeshOps stack)  │    (Snap hoppers, drills, conduits)  │
│ 5. Audit & Validate                  │ 5. Wire Logic & Game Objectives      │
│    (0 Loose ends, 0 Collisions)      │    (@hm/wiregraph: doors, spawners)  │
│ 6. [Apply to Campaign]               │ 6. [Test Play] & [Export Spore Card] │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Loop A: "Tune & Mod the Example Game" (The Campaign Polish Loop)
1. **Target Selection**: The creator selects any existing machine, vehicle, or structure from the campaign library (e.g., `MILL_V2`, `STARGATE_KIT`, `CAPACITOR_BANK`, `ROVER_KIT`).
2. **Contextual Inspection**: The machine appears in the center 3D turntable. The `<MaterialSlotStrip />` highlights its material slots (`hull-steel`, `accent-hardware`, `trim-emissive`).
3. **Non-Destructive Layering**: The creator adjusts paint colors, roughness, or weathering age using Tier-1 smart presets (`mat:workshop-steel`, `mat:rust-bucket`, `mat:old-copper`), or dives into Tier-2 layer stacks.
4. **Live Verification**: Every tweak immediately updates the 3D WebGL shader on the actual machine mesh with live triplanar/UV projection.
5. **Instant In-Game Handoff**: Clicking `[Apply to Campaign]` writes the override to `studio-data/` or active profile so firing the Beam Rifle or loading the Lab immediately reflects the polish.

### Loop B: "Genesis of a New Planet" (The From-Scratch World Builder Loop)
1. **World Genesis**: The creator clicks `[+ New World]` and picks a world seed and a **Biome Formula** (`PlotBiomePreset`: Lunar Basalt, Terran Forest, Volcanic Crag, Toxic Basin) governed by the Four Floats:
   $$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
2. **Landscape Sculpting & Look**: In `Look & Lighting`, the terrain generates procedurally. The creator scrubs sun angles, ambient light flux ($Lx$), and water tables ($Aq$).
3. **Placing the Gate & Foundations**: The creator drops a modular Stargate onto the plot. The auto-snap grounding system anchors the pedestal to the terrain normal, setting the dialing code and access permissions (`open | code-only | closed`).
4. **Machine & Base Outfitting**: The creator places foundations, snaps modular machines (`@hm/kitspec` assemblies), connects power relays and resource hoppers.
5. **Wiring Rules & Logic**: The creator opens the `Logic & Triggers` canvas to connect proximity sensors, iris locks, and turret spawners using `@hm/wiregraph`.
6. **Publish & Dial**: Clicking `[Export Spore Card]` burns the world preset into a 512x512 PNG Spore Card with embedded zTXt metadata and registers its Stargate network address in `@hm/coopnet` so players across the multiverse can dial into it.

---

## 2. THE 10 LOGICAL QUESTIONS EVERY STUDIO CREATOR ASKS (ANSWERED)

Any creator opening the Studio will naturally ask these ten logical questions. The UI must answer every one without hesitation:

### Q1: "What am I editing right now?"
- **Answer**: The **Context Header** at the top left of the center viewport always displays an unambiguous breadcrumb:
  `[World: Campaign Moon] > [Machine: Texture Mill V2] > [Slot: hull-steel] > [Layer 3: Paint 1]`
- You never wonder what asset, part, or material slot is currently active.

### Q2: "How do I switch between the Campaign and my own Custom Planets?"
- **Answer**: A prominent **World Switcher dropdown** in the top bar:
  - `Campaign: Moon Outpost`
  - `Campaign: Earth Arrival Sector`
  - `My Worlds: Planet Vulcan (Custom)`
  - `[+ Create New Planet / World...]`
- Selecting a world loads its complete scene graph, terrain formula, and placed machines.

### Q3: "What are all these presets, and how do they fit together?"
- **Answer**: The Studio enforces the universal **5-Rung Preset Hierarchy**:
  - **Rung 1 (Atoms)**: Math primitives (`@hm/partgen` bolt, plate, can) & procedural noise nodes (`@hm/texgraph`).
  - **Rung 2 (Stacks)**: 5-layer material stacks (`@hm/matstack`) & 27-operator mesh stacks (`@hm/meshops`).
  - **Rung 3 (Parts & Stems)**: Finished stamped parts with material slots & audio synth stems (`@hm/soundlab`).
  - **Rung 4 (Kits & Assemblies)**: Complete modular machines (`@hm/kitspec` Mill, Gate, Press) & creature rigs (`@hm/creature`).
  - **Rung 5 (Worlds & Cartridges)**: Playable planets, Spore Cards (`@hm/cartlab`), and Multiverse game modes.
- You can edit at any rung, and higher rungs update automatically.

### Q4: "How do I try things on without permanently breaking the asset?"
- **Answer**: **Previews Drive Play (RULES 8a)**:
  - Hovering over any material swatch in the shelf temporarily overrides the 3D viewport shader on the machine (`hover try-on`). Moving the mouse away restores the current material.
  - Clicking a swatch applies it to the active slot with a full Undo/Redo stack (`Ctrl+Z`, `Ctrl+Shift+Z`).

### Q5: "How do I attach parts to a machine without fighting 3D gizmos?"
- **Answer**: **3D Triad Sockets & Auto-Snap Grounding**:
  - Every machine kit exposes color-coded 3D triad socket pins (Red = Input, Blue = Output, Gold = Power, Green = Mount).
  - Dragging a modular part near a socket snaps its anchor automatically.
  - A persistent **Grounding Status Badge** (`0 Issues — Grounded & PBR Valid`) guards against floating parts, with an `[⚡ Auto-Snap Grounding]` button to snap floating bases to $Y=0$.

### Q6: "How do I customize a material without needing to know shader math?"
- **Answer**: **Two-Tier Preset Control**:
  - **Tier 1 (Artists/Players)**: Pick from 16 curated smart materials (`Workshop Steel`, `Rust Bucket`, `Old Copper`, `Hazard Gold`). Tweak simple macro sliders: Paint 1 Color, Paint 2 Color, and Master Weathering Age.
  - **Tier 2 (Technical Artists/Coders)**: Expand the 5-layer stack (Substrate, Primer, Paint 1, Paint 2, Weathering). Adjust roughness/metallic channels, toggle the `[M]` Mask B&W mode, or edit procedural wear masks.

### Q7: "How do I generate seamless procedural textures?"
- **Answer**: In the **TexGraph (UV)** tab, select any of the 20 canonical surface tiles (`brushed-metal`, `hex-plate`, `cast-iron`, `rust-bloom`). The canvas displays the node graph with interactive parameters (scale, seed, turbulence) and a live **2x2 tiled seam preview** ensuring 100% periodic wrapping.

### Q8: "How do I make things interactive (doors, lights, triggers)?"
- **Answer**: In the **Logic & Triggers** tab, the `@hm/wiregraph` visual canvas lets you connect outputs (proximity sensors, pressure plates, timers) to inputs (door iris actuators, alarm klaxons, Stargate dialers) with zero code.

### Q9: "How do I test my changes immediately?"
- **Answer**: A green **`[▶ Test Play in Sandbox]`** button in the header instantly spins up the player avatar with Beam Rifle and Rover directly in front of the active machine/scene. Pressing `Esc` returns directly to the Studio with all state preserved.

### Q10: "How do I share what I built with other players?"
- **Answer**: Clicking **`[Export Spore Card]`** captures a 512x512 beauty portrait, validates the anatomy audit, and embeds the complete mathematical preset losslessly into PNG `zTXt` chunks. Any other player can drag the PNG card directly onto their Studio canvas or dial the world's random Stargate code to explore it.

---

## 3. THE 4 CLEAN WORKSPACES (PURGING THE GRAVEYARD)

The top navigation header must have **exactly four coherent workspaces**, replacing the cluttered row of 10 legacy prototype buttons:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [FIDELITY Studio]  [ Creative Suite ] [ Look & Lighting ] [ Scene Layout ] [ Audio Lab ]    [▶ Test Play] [Export Spore Card] [Save]  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. `Creative Suite` (Default Workstation)
- **Left Panel**:
  - World / Kit Selector (`MILL_V2`, `STARGATE_KIT`, `CAPACITOR_BANK`, `TEST_PIECE`, or custom kits).
  - Grounding Validation Badge (`0 Issues` / `[⚡ Auto-Snap]`).
  - Hierarchical Assembly Tree (Root -> Child Placements -> Sockets).
- **Center Viewport**:
  - 3D WebGL turntable canvas with live layered material shaders.
  - `<MaterialSlotStrip />` anchored at the top with live slot swatches and `[This Part | Whole Machine]` scope toggle.
  - Interactive face raycasting (Click to select part & slot, Alt+Click eyedropper, Shift+Click apply).
- **Right Dock** (4 Contextual Tabs):
  - `[Material & Layers]`: Two-tier `@hm/matstack` inspector (Shelf, Paint pickers, Weathering Age, 5-layer stack, Mask B&W mode).
  - `[Parts & Assemblies]`: `@hm/kitspec` assembly hierarchy, socket list, triad pin toggles, auto-grounding.
  - `[TexGraph (UV)]`: Procedural node graph editor with 2x2 seam preview and live shader array updates.
  - `[PartGen & MeshOps]`: Parametric generator sliders with 27-operator mesh modifier stack.

### 2. `Look & Lighting`
- Replaces the legacy `.glb` terrain patch.
- Previews the **active modular machine kit** situated on the `@hm/groundshader` terrain patch.
- Controls: Stage Scrubber ($S_0 \to S_6$), Sun Elevation & Azimuth, Sky Dome turbidity, and OKLab color quantization.

### 3. `Scene Layout`
- Multi-machine base layout for the active world.
- Places verified `@hm/kitspec` assemblies onto the terrain, snaps foundation grids, and runs power/pipe conduits.
- Eliminates the 132 legacy pre-baked `.glb` files.

### 4. `Audio Lab`
- Procedural synth stem workshop (`@hm/soundlab` & `@hm/musicbox`).
- Auditions machine motor hums, ram impacts, Stargate horizon resonance, and stage-quantized audio ladders ($S_0 \to S_6$).

---

## 4. IMMEDIATE EXECUTION CHECKLIST FOR ARGO

1. **Purge the Dead Buttons from `apps/web/src/studio/studio-app.tsx`**:
   - Delete `Moon (prototype)` (obsolete legacy code).
   - Delete `Monsters` (broken 2D stub).
   - Relocate `Spore Cards` into a top-right `[Export Spore Card]` modal.
2. **Wire the World & Kit Context Header**:
   - Add the World Switcher dropdown (`Campaign Moon` vs `+ New Planet`).
   - Add the breadcrumb readout (`World > Machine > Slot > Layer`).
3. **Connect `LookTab` to Active Modular Kit**:
   - In [`look-tab.tsx`](file:///c:/MarbleGp/apps/web/src/studio/look-tab.tsx), replace `loadGenRaw()` with `buildStudioMachineModel()` from the active kit.
4. **Wire `[▶ Test Play in Sandbox]`**:
   - Provide instant live test-flight into the sandbox with Beam Rifle and Rover.
5. **Quality Gates & Verification**:
   - `npm run typecheck` (0 errors).
   - `npm test` (all 3,618 tests passing).
   - Standalone bundle strictly under 16.00 MiB.
   - Browser verification: Zero broken prototype tabs, zero gym equipment surprises, 100% modular preset inception.
