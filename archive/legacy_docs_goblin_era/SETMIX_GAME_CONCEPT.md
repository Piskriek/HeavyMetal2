# SETMIX: THE RESOLUTION CRAFTER — GAME CONCEPT & DESIGN REASONING

> **Origin**: Owner Directive (2026-10-06).
> **Master Arena Prompt**: [`docs/prompts/arena-setmix-the-game-spec.md`](file:///c:/MarbleGp/docs/prompts/arena-setmix-the-game-spec.md).

---

## 1. Premise Breakdown & Creative Vision

### The Narrative & Aesthetic Hook
* **The Scientist in the White Room**: You are a research scientist operating in a pristine, state-of-the-art white laboratory. Every surface in the lab is rendered with stunning PBR materials, soft ambient occlusion, and sleek sci-fi machinery (inspired by a Star Trek holodeck / Braun-aesthetic lab).
* **The Archway Portal**: A freestanding sci-fi gateway stands in the center of the lab. When looking through it, you gaze out across an alien horizon: a desolate, low-poly moon surrounded by stars.
* **The Seamless Threshold**: Walking through the portal archway is 100% seamless (no loading screens). Crossing the threshold transforms your avatar into a stylized, low-poly astronaut/goblin explorer on the desolate moon.
* **The Core Hook ("Resolution as Terraforming")**:
  In standard survival/terraforming games (like *The Planet Crafter*), placing machines slowly raises Oxygen, Heat, and Pressure to turn a red desert into a green planet.
  In **SetMix: The Game**, **TERRAFORMING IS GRAPHICAL FIDELITY**.
  - The starting moon is computationally raw: flat-shaded, blocky, harsh cubes, a 4-tone palette, stark black void.
  - You mine "raw pixels" and "topology shards" from the planet's surface.
  - You construct atmospheric emitters and mesh polishers that spew calculated pixels and vertex flux into the atmosphere.
  - As the **Fidelity Index (Fi)** climbs, the planet's rendering algorithms upgrade live in front of you:
    - Cubes round out into bevelled voxels, then smooth into rolling hills.
    - Flat palette colors dither-blend into rich procedural PBR textures.
    - Black sky develops atmospheric scattering, clouds, rain, and oceans.
    - Barren craters fill with crystal turquoise water, foam caustics, and alien flora.

---

## 2. Research: *The Planet Crafter* Mechanics vs. SetMix Mapping

| Mechanic in *The Planet Crafter* | Standard Function | SetMix Counterpart ("The Resolution Crafter") |
|---|---|---|
| **Terraformation Index (Ti)** | Global numerical score derived from O2, Heat, Pressure, and Biomass. | **Fidelity Index (Fi)**: Combined score of Pixel Density, Poly-Harmonics, Lumens, and Hydrology. |
| **Oxygen (O2)** | Generates atmosphere, allows player to breathe outside base. | **Pixel Density (Pxd)**: Upgrades texture resolution, color bit-depth, and procedural noise octaves. |
| **Pressure (nPa)** | Drills into ground, releases gases, triggers clouds/rain. | **Poly-Harmonics (Vtx)**: Spires emit mesh subdivision waves, smoothing voxels into organic sculpts. |
| **Heat (pK)** | Heaters melt ice, revealing hidden caves and forming lakes. | **Atmospheric Lumens (Lx)**: Powers global illumination, directional shadows, volumetric fog, and HDR sky. |
| **Biomass (g)** | Spreads moss, grass, trees, and insects. | **Procedural Biome Shading (Bio)**: Ingests user presets to seed living grass, trees, and animated fauna. |
| **Life Support / Tank** | Player must return to base/pods to refill Oxygen tanks. | **Buffer Coherence / Resolution Field**: Outside the lab or powered spires, your avatar's data degrades/jitters, requiring tether pods or energy cells. |
| **DNA / Recipe Sequencer** | Combines seeds, tree bark, and mutagen into new plants. | **The Fusion Matrix (Combiner Machine)**: Fuses presets in the lab (e.g. `Mud Texture` + `Terrain Sculpt` = `Cobblestone Road Cartridge`). |
| **Flooding Valleys** | As heat rises, ice melts and valleys flood with real water. | **Hydrological Synthesis**: Barren basins flood with procedural water, waves, and buoy physics. |

---

## 3. The Two Entry Points: Studio Mode vs. Play Mode

1. **Studio Mode (The Unlocked Artist Suite)**:
   - Accessible via a prominent button on the Main Menu.
   - Spawns the player in the **fully upgraded White Room Lab**.
   - All machines unlocked, infinite power, full Maya-style Outliner accessible.
   - The player can design procedural math textures, sculpt voxel rigs, test in-hand props, and export them as universal `.setmix` bundles to share across games.
2. **Play Mode (The Progression Campaign)**:
   - Spawns the player in a **sparse, power-starved lab** with offline consoles.
   - The portal is open, leading to the desolate moon.
   - Player must explore, mine color crystals and topology shards, construct basic Pixel Vaporizers, and feed research data back to the lab to unlock higher-tier synthesizers and machines.

---

## 4. Game Design Reasoning Questions for the Planning Stage

These are the fundamental questions that every game design must answer before writing code:

### A. The Core Loop & Survival Tension
1. **What replaces the Oxygen clock?**
   - In *Planet Crafter*, running out of O2 means suffocation. In SetMix, does leaving the Lab or powered field cause "Rendering Entropy" (avatar pixels glitching/disintegrating), or is it an energy battery that drains?
   - *Recommendation*: **Data Coherence Gauge**. Unpowered areas have high noise entropy. If coherence reaches 0, you de-rez and respawn at the portal with your inventory dropped in a memory cache.

2. **How does resource gathering feel logical and satisfying?**
   - What are you mining?
     - **Chromatic Crystals**: Pure RGB nodes jutting out of moon rock (Red, Green, Blue, Alpha).
     - **Topology Shards**: Sharp crystalline polyhedrons (Triangles, Quads) used for geometric spires.
     - **Logic Substrates**: Conductive metallic veins used to craft circuit boards and machines.

### B. The Transformation Experience
3. **How does the resolution upgrade happen visually without jarring popping?**
   - When a threshold is crossed, does the entire planet snap to higher resolution at once?
   - *Recommendation*: **Radial Volumetric Shockwaves**. When a spire activates or a milestone is hit, a brilliant glowing "scan-line wave" expands outward across the landscape, tessellating and smoothing surfaces as it passes over them. It feels like a magnificent technological pulse!

4. **The Performance Paradox: How does low-end hardware survive high fidelity?**
   - If the player's laptop is an i7 with integrated graphics, won't increasing fidelity drop frame rates?
   - *Recommendation*: **Algorithmic Decoupling**. "Fidelity" in game lore means richer art direction and procedural noise complexity, but the engine's internal budget meter dynamically scales shader passes and mesh LODs so that **Low Tier always maintains 60 fps**, while High/Ultra enables full resolution and dynamic shadows.

### C. The Preset Economy & Crafting
5. **How does the physical Cartridge system work in the field?**
   - In the lab, designing or fusing a preset produces a physical item in your inventory: a **Template Cartridge** (e.g. `[Cartridge: Vibrant Palm Turf]`).
   - You carry it through the portal and insert it into a slot on a planetary spire.
   - The spire's emission color changes, and the local terrain begins transforming to match that exact cartridge!

6. **How does the Fusion Matrix teach real game development?**
   - The combinations mirror real graphics workflows:
     - `[Base Albedo]` + `[Height Gradient]` = `[Relief Material]`
     - `[Cellular Voronoi]` + `[Domain Warp]` = `[Organic Cobblestone]`
     - `[Mud Texture]` + `[Carve Brush]` = `[Worn Dirt Roadway]`
   - Players intuitively learn how textures, normals, and meshes assemble into a living game world.

---

## 5. Master Prompt Status

The self-contained prompt to send to Arena AI (Gemini 4 Argon, Claude 3.7, Opus) is located at:
📁 **[`docs/prompts/arena-setmix-the-game-spec.md`](file:///c:/MarbleGp/docs/prompts/arena-setmix-the-game-spec.md)**
