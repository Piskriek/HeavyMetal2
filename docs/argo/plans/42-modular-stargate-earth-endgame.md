# 42: Modular Stargate progression, Earth endgame sandbox, and movable/random gate network (Argo, 2026-10-22)

**The owner, 2026-10-22:** "The system we are building is essentially the best of every design program combined, a game engine that has ready-made presets as well as a Stargate-like game where the player learns how the Studio works at a fundamental level while progressing through fidelity (perspective) stages ... Everything should be replaced with presets created and then made available to the player to modify, with sliders in the game and with full control within the Studio ... When you have unlocked all fidelity stages the Earth is saved and you can now build on the Earth and use the preset tools to create your own game and share it with the wider network, the same goes for your Moon plot, you can move your gates or close them off, while explorers can dial random gates and endlessly explore and compare perspectives."

This plan unifies [plan 38](38-parts-modules-presets.md) (parts, modules, kits), [plan 39](39-one-pattern-preset-factories.md) (four preset factories), [plan 40](40-bring-your-own-agent.md) (Bring Your Own Agent in the Studio), and [plan 41](41-layered-materials.md) (layered materials) with the overarching campaign loop, the Stage-6 Earth restoration endgame, and the Stargate plot network (`@hm/coopnet`).

---

## 1. The goal
1. **The Campaign as Interactive Studio Onboarding:** Playing through the *FIDELITY* campaign ($S_0 \to S_6$) is how a player learns the Studio's algorithmic design tools at a fundamental level—without ever feeling like they are reading a manual. Every machine built and every fidelity stage unlocked introduces another layer of the preset engine.
2. **100% Modular Preset Replacement:** Nothing in the playable world remains a hardcoded, opaque one-off asset. Every machine, structure, material, part, lamp, tree species, terrain biome, and gate is instantiated from a **pure, deterministic preset spec** that can be tweaked with **curated sliders in-game** (at the Lab Bench or Planet Drafting Table) and opened with **full graph/stack/layer control in the Studio**.
3. **Stage-6 Earth Restoration Endgame:** Reaching Stage 6 on the Moon plot stabilizes the quantum collapse, saving Earth. This unlocks the player's **Earth Plot** alongside their **Moon Plot**, granting full sandbox building and game-creation tools on both worlds to publish custom games and activities to the network.
4. **Movable, Lockable, and Random-Dialable Stargates:** Plot owners have full control over their Quantum Archway Gate—they can **reposition their gate** anywhere on their plot or **close/lock the iris** for privacy, while explorers can **dial random open gates** to endlessly visit, explore, and compare other players' worlds and custom perspectives.

---

## 2. Where it stands
- **Four Preset Factories (Plans 38, 39, 41):**
  - **Vtx (`@hm/partgen`, `@hm/kitspec`, `@hm/meshops`):** 20 parametric part generators, 27 non-destructive mesh operators, and kit assembly specs (`kit-build.ts`, `kit-machine.ts`).
  - **Pxd (`@hm/texgraph`, `@hm/matstack`):** 5-level layered material system (Tile $\to$ Surface $\to$ Mask $\to$ Layer $\to$ Material) with rank 0/1/2 rendering (`layered-material.ts`) and `matc:` share codes.
  - **Aq (`@hm/treegen`, `@hm/flora`):** Parametric tree species presets with live turntable previews and up to 6 variant slots per plot (`plot-biome-view.ts`).
  - **Lx (`lx:` light cartridges):** Kelvin temperature, signal colour, intensity, and pulse/flicker pattern presets on machine and base lamps.
- **Gate Dialing (`packages/coopnet/src/gate-dialer.ts`, `shared-planet.ts`):**
  - 6-chevron gate dialing (`2.70 s` lock) and sector addressing (`SECTOR #XX`) exist for friend/sector dialing, but gates are currently fixed at local $(0, 0)$ on the plot, lack an open/closed privacy state, and lack a one-click "Dial Random Gate" explorer mode.
- **Endgame Earth State (`apps/web/src/play/lab-vista.ts`):**
  - The Breach storm outside the lab window reacts to plot fidelity, but reaching Stage 6 does not yet open the Earth surface as a buildable, gate-connected plot.

---

## 3. What the best do (Research)
- **Dreams (Media Molecule):** The campaign (*Art's Dream*) is built entirely out of the same modular gadgets, sculptures, and fleck shaders given to players in DreamShaping; unlocking campaign prizes seeds the player's creation inventory.
- **No Man's Sky (Portal Network & Base Computers):** Players dial 12-glyph Stargate portals to visit community bases, or dial random coordinates to explore unknown worlds; base owners control permissions ( anyone / friends / private ) at their base terminal.
- **Trackmania / Fortnite UEFN / Roblox Studio:** A tiered editing UX where casual players assemble and tweak high-level presets with sliders in-game, while power creators open the full editor workspace to manipulate the underlying node graphs and operator stacks.
- **The Planet Crafter / Subnautica:** Terraforming progression visibly transforms a hostile, low-information environment into a living biosphere, culminating in an endgame state that recontextualizes the starting hub.

---

## 4. The design (decisions, made)

### 4.1 Two-Tier Preset Control: In-Game Sliders vs. Full Studio Control
Every object in *FIDELITY* is backed by a pure JSON preset (`@hm/presetcodec`) and follows a strict two-tier editing contract:

| Domain | In-Game Bench / Drafting Table (Curated Sliders) | The Studio (Full Engine Control + BYOA Agent API) |
| :--- | :--- | :--- |
| **Parts & Kits ($\text{Vtx}$)** | Pick a part generator, adjust primary dimension/bevel sliders with live turntable preview, print cartridge, fire beam to swap one part (tap) or matching parts (hold). | Full `@hm/meshops` 27-operator stack, socket placement, mirror/array assembly (`@hm/kitspec`), custom shape graphs, 4-angle validation (`studio.kit.validate`). |
| **Materials ($\text{Pxd}$)** | Pick a named material preset, choose 2 paint colours, toggle/reorder layers, drag the **Age (0–1)** weathering slider, preview mask in B&W, print `matc:` cartridge. | Full 5-level editor: `@hm/texgraph` procedural tile node graphs, custom OpenPBR surface channels, multi-input mask stack (edges, cavities, ground, noise, streaks). |
| **Lighting ($\text{Lx}$)** | Pick lamp/sky preset, drag Kelvin warmth (2000K–7500K), intensity, and pulse pattern, preview on housing turntable, apply via beam. | Full stage-look lighting rig, sun/sky/fog curves, volumetric scattering, exposure & color grading LUTs per stage. |
| **Biosphere ($\text{Aq}$)** | Pick tree/flora species, tweak height, crown spread, lean, leaf size, sway, and canopy palette on live sapling turntable, apply to plot trees. | Full `@hm/treegen` L-system / growth rules, biome coverage masks, hydrological table levels, and custom species authoring. |
| **Game & Plot Rules** | Choose plot activity mode, adjust gravity/hazard sliders, move or lock the plot's Stargate. | Full scene document (`@hm/scenedoc`), custom quest/activity rules, mob wave spawners, and Multiverse publishing (`SMX-PLN-XXXX`). |

### 4.2 The 6-Stage Fidelity Ladder as Progressive Studio Mastery
Each stage upgrades the world's rendering fidelity **and** unlocks the next layer of preset manipulation so the player learns the engine organically:
- **Stage 0a $\to$ 0b (Wireframe $\to$ 1-bit Bayer Dither):** Teaches spatial geometry and silhouette (`Rank 0`). The player powers the lab, opens the gate, and places the first shape/texture machine to establish basic sync.
- **Stage 1 (16-colour EGA, Flat Facets):** Unlocks basic **Part Sliders ($\text{Vtx}$)** and **Flat Surface Swatches ($\text{Pxd}$ Rank 0)** at the bench. Players learn that every machine part and structural piece is parametric.
- **Stage 2 (256-colour VGA):** Unlocks **Procedural Tiles & Basic Weathering Masks ($\text{Pxd}$ Rank 1)** and **Ground Cover ($\text{Aq}$)**. Players see edge wear and height bumps appear on their machines and learn how masks read geometry.
- **Stage 3 (Lit Gouraud Shading):** Unlocks **Light Presets ($\text{Lx}$)** and **Secondary Kit Ranks (`Rank 1` panels, doors, lamps)**. Lighting temperature, shadows, and emissive patterns become editable presets.
- **Stage 4 (Early PBR, Liquid Water & Reflections):** Unlocks **Full Layered Materials ($\text{Pxd}$ Rank 2: coat, fuzz, metal reflections)** and **Hydrological / Sapling Presets ($\text{Aq}$)**.
- **Stage 5 (Full PBR Biome & Heavy Automation):** Unlocks **Full Kit Assembly & Operator Stacks** and **Inter-Plot Gate Dialing**. Players can customize whole machine assemblies and vehicles.
- **Stage 6 (Complete Biosphere Restoration — "Earth Saved"):**
  - The radial fidelity wave reaches full coherence. Outside the lab window, the Breach collapses and the wasteland resolves into a restored, living **Earth Biosphere**.
  - **Endgame Sandbox Unlock:** The lab's secondary Earth Bay door / gate target unlocks. The player can now step out onto their **1 km Restored Earth Plot** as well as their **1 km Moon Plot**, with all Studio preset tools unlocked to build custom games, obstacle courses, combat arenas, or architectural showcases and share them with the network.

### 4.3 Stargate Network: Movable Gates, Gate Lock/Close, and Random Explorer Dialing
The Quantum Archway Gate is a physical, modular preset structure on the player's plot with three new capabilities in `@hm/coopnet` and `BaseWorld`:

1. **Movable Gate Placement (`moveGate` command):**
   - Instead of being permanently bolted to $(0, 0)$, the plot owner can relocate their Gate (via Build Mode or the Gate Console) to any grounded foundation or terrain pad within their plot bounds.
   - Moving the gate updates `world.gatePose = { x, y, z, yaw }`, automatically realigning the arrival pad, safe sync dome, and quantum bridge root (`gatePlanet()`).
2. **Gate Privacy & Iris Lock (`gateAccess: 'open' | 'code-only' | 'closed'`):**
   - At the Gate Console (or HUD quick-toggle), the owner sets their plot gate's state:
     - **`open` (Public Network):** Listed in the random explorer pool and dialable by sector/friend code.
     - **`code-only` (Unlisted):** Dialable only by players who have the explicit 6-chevron share code (`SMX-GAT-XXXX`), excluded from random dialing.
     - **`closed` (Iris Locked):** The gate is closed off completely to incoming travelers; outbound dialing from the owner's plot still works.
3. **Random Gate Dialing for Explorers (`dialRandomGate`):**
   - At the Lab Gate Console or any Planet Gate Dialer (`packages/coopnet/src/gate-dialer.ts`), players can press **"Dial Random Gate"** (or spin the chevron ring to `RANDOM`).
   - Deterministically selects an `open` plot from the planetary grid / SetMix directory (excluding the current plot and recently visited plots), locks the 6 chevrons, and steps through to explore another creator's perspective, custom presets, and world stage.
   - While visiting an explored plot, the explorer can inspect any placed machine, tree, or material with their scanner to view its preset breakdown—and optionally bookmark/save shared presets (`matc:`, `SMX-PRT-`, `SMX-SPC-`, `SMX-LGT-`) into their own library.

---

## 5. The rules it touches
- **Constitution 1 (Four Floats):** All presets remain strictly organized under $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$.
- **Constitution 2 (Purity):** `moveGate`, `setGateAccess`, and deterministic random gate selection in `@hm/coopnet` are 100% pure functions (seeded PRNG for offline/fallback explorer plots; zero `Math.random()` or `Date.now()`).
- **Constitution 3 (Single-File Bundle):** Because worlds and custom games are composed of compact JSON preset codes (`@hm/presetcodec`) rather than bespoke binary meshes, entire player-created worlds share and sync in a few kilobytes.
- **Constitution 4 (Terraforming is Fidelity):** Completing Stage 6 directly drives the narrative and mechanical unlock of the Earth plot.
- **Rule 8a (No Shortcuts, Cross-Check):** Every legacy one-piece machine or hardcoded prop is systematically replaced by modular kit presets (`TICKET-40` onward), verified from four angles before landing.

---

## 6. The changes, ranked

### P0 (Foundation & Core Loop Completion)
1. **Finish the Modular Kit & Layered Material Rollout (Plan 41 + TICKET-40/41):**
   - Land the perf gate check for `layered-material.ts`, complete the 20 procedural tile graphs (`TICKET-41`), and finish replacing one-piece machines with modular `@hm/kitspec` + `@hm/partgen` assemblies starting with `MILL_V2` (`TICKET-40 v5`).
2. **Gate Mobility & Privacy Commands in `BaseWorld` and `@hm/coopnet`:**
   - Add `gatePose: { x, y, z, yaw }` and `gateAccess: 'open' | 'code-only' | 'closed'` to `BaseWorld` (defaulting to `(0, 0)` and `'open'`).
   - Add `moveGate` and `setGateAccess` commands to `apps/web/src/base/world.ts` and wire `gatePlanet()` to read `world.gatePose`.
   - Add the **Random Gate Dial** action and **Gate Lock / Iris Toggle** to the Gate Dialer UI (`packages/coopnet/src/gate-dialer.ts`).

### P1 (Studio Unity & Stage-6 Earth Unlock)
3. **Unified Studio Preset Workspaces + Bring Your Own Agent (Plan 40):**
   - Replace the remaining prototype panels in `apps/web/src/studio/` with the full 5-level Materials workspace, Operator Stack Parts workspace, Species workspace, and Lights workspace, all exposed through `window.studioAgent` and `studio-skill.md`.
4. **Stage-6 Earth Restoration & Earth Plot Sandbox:**
   - When the Moon plot reaches Stage 6, transition `lab-vista.ts` from the Breach storm to the restored Earth biome and unlock the **Earth Plot** destination on the Gate Dialer so players can build on Earth and publish custom games.

### P2 (Explorer Preset Inspection & Multiverse Sharing)
5. **Explorer Preset Scanner:**
   - Allow explorers visiting random gates to inspect placed objects and bookmark their preset codes (`matc:`, part kits, species) into `my-presets.ts`.
