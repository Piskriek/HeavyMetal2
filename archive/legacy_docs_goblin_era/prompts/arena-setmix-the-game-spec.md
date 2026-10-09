# Master Prompt for Arena AIs: "SetMix — The Resolution Crafter"
### Comprehensive Game Design Document & Systems Architecture Prompt

> **How to use**: Copy everything below the line into LMSYS Chatbot Arena or your frontier model chat. It is 100% self-contained and sets up the complete philosophical, mechanical, and technical design brief.

---

You are a legendary game director, lead systems designer, and principal graphics engine architect. You have shipped genre-defining titles that merge creative freedom, systemic automation, and captivating progression (e.g., *Minecraft*, *The Planet Crafter*, *Factorio*, *Subnautica*, and *Dreams*).

We are designing **SetMix: The Game**—a breakthrough 3D terraforming, crafting, and creative sandbox built upon a mind-bending premise: **Terraforming a planet means increasing its graphical resolution and rendering fidelity from raw math.**

---

## 1. The High Concept & Narrative Premise

- **The Incident**: You are an ambitious research scientist in a cutting-edge technological facility. A containment accident rips open an Einstein-Rosen bridge—a portal archway connecting your pristine laboratory to an uncharted sector of the multiverse: a desolate, barren, low-poly moon suspended in a starry void.
- **The Dual Reality (The Archway)**:
  - **The Lab (High-Fidelity PBR Science Studio)**: A pristine, minimalist, high-end white room (inspired by a Star Trek holodeck / Braun-aesthetic science lab). Everything here is rendered in state-of-the-art PBR fidelity with subtle ambient occlusion, tactile equipment, and advanced workstations. This is the artist/scientist's ultimate creative studio.
  - **The Portal**: A physical sci-fi doorway standing in the lab. Looking through the archway, you see the low-poly moon. Walking through is completely seamless—no loading screens.
  - **The Transformation**: As you cross the threshold onto the moon, your avatar transforms into a stylized, low-poly astronaut/goblin explorer. The environment is harsh, desolate, and computationally "coarse" (flat-shaded cubes, stark 4-color palette, unlit surfaces).
- **The Core Loop (The "Resolution Crafter")**:
  - Inspired by *The Planet Crafter*, but instead of just generating Oxygen, Heat, and Pressure, **your machines generate Pixels, Geometric Flux, and Lumens**.
  - You mine raw "pixels" (discrete color crystals) and "topology shards" from the desolate moon.
  - You construct atmospheric emitters and terraforming spires on the moon that pump these computational units into the sky.
  - As the **Fidelity Index (Fi)** climbs, the world visibly transforms in real-time before your eyes:
    - Blocky cube terrain dissolves into bevelled voxels, then smooths into lush rolling hills.
    - Flat 4-color shading dither-blends into rich multi-octave procedural PBR surfaces.
    - Stark black space develops an atmospheric Rayleigh scatter, forming blue skies, clouds, and rainfall.
    - Barren craters fill with liquid water, blooming into vibrant oceans with procedural caustics, coral, and life.
- **The Lab-Planet Pipeline (Presets as Inventory Cartridges)**:
  - In the Lab, you use specialized science consoles (The Preset Synthesizer, The Fusion Matrix) to craft, customize, and combine **Presets** (e.g., a specific hand-painted grass shader, a columnar basalt formation, or a goblin vehicle chassis).
  - Presets materialize as **physical physical Cartridges / Punchcards** in your character's inventory.
  - You carry the cartridge through the portal and slot it into a terraforming spire on the planet.
  - The spire alters its emissions: instead of generic pixels, it now spews customized algorithmic data, shifting the local biome to grow that exact grass texture or rock formation!
- **Dual Play Modes**:
  1. **Studio Mode (From the Main Menu)**: The Lab is fully unlocked with infinite power, all machines active, and an unrestricted Maya-style Outliner where artists can freely build, inspect, and export presets for use across the SetMix multiverse.
  2. **Play Mode (The Campaign Progression)**: You awaken in a sparse, power-starved lab with offline consoles. You must step onto the moon, gather primitive resources, construct basic extractors, and feed data back to the lab to unlock higher-tier synthesizers and machines.

---

## 2. Your Task: Comprehensive System & Game Design Blueprint

We need you to produce a masterclass Game Design Document and Systems Specification that reasons deeply through every mechanic, progression phase, economy loop, and technical interface.

Deliver your analysis structured across these seven essential sections:

### Section 1: Core Systems & The "Fidelity Crafter" Engine
1. **The Four Fidelity Metrics**:
   Define the four core planetary metrics that replace Heat/Oxygen/Pressure from *The Planet Crafter*:
   - **Pixel Density (Pxd)**: Controls texture resolution, color depth, and procedural noise octaves.
   - **Geometric Flux / Poly-Harmonics (Vtx)**: Controls vertex subdivision, voxel meshing, smoothing algorithms, and model detail.
   - **Atmospheric Lumens (Lx)**: Controls lighting models (unlit ➔ vertex lighting ➔ directional shadows ➔ dynamic GI and volumetric fog).
   - **Hydrology / Fluidity (Aq)**: Controls water generation, procedural wave caustics, and buoyancy.
2. **The 6 Terraformation Stages of Graphical Evolution**:
   Map out the exact visual, auditory, and systemic milestones from 0 Fi to 100,000,000 Fi:
   - *Stage 1: Coarse Wireframe / Flat Block (The Desolate Moon)*
   - *Stage 2: Dithered Palette & Sky Glint*
   - *Stage 3: Subdivided Geometry & Atmospheric Haze*
   - *Stage 4: Liquid Condensation (Valleys Flood into Realtime Water)*
   - *Stage 5: Biome Shading (Procedural PBR Flora & Fauna)*
   - *Stage 6: Master Render (Full Raytraced/PBR Living Paradise)*
   Detail what happens to the player's avatar, soundscape, and game physics at each stage!

### Section 2: The Lab Tech & The Fusion Matrix (Preset Alchemy)
1. **The Lab Machinery Suite**:
   Describe the interactive workstations in the White Room Lab:
   - *The Material Synthesizer*: How players visually tweak procedural math graphs without code.
   - *The Fusion Matrix (Combiner Machine)*: The recipe system for fusing disparate presets into higher-order tools and biomes.
   - *The Hardware Fabricator*: Upgrading the player's suit, portal bandwidth, and mining tools.
2. **The Fusion Matrix Alchemy Tree (At least 8 Compelling Combinations)**:
   Provide concrete examples of how combining intuitive presets produces emergent gameplay templates:
   - e.g., `[Mud Texture Preset]` + `[Linear Strata Tool]` = `[Carved Cobblestone Road Cartridge]`
   - e.g., `[Bioluminescent Slime]` + `[Kinematic Spring Rig]` = `[Bouncing Hazard Geyser]`
   - Explain the design logic behind each combination.

### Section 3: The Planetary Gameplay Loop & Resource Economy
1. **Planetary Gathering & Hazard Loop**:
   - What does the player mine on the moon? (e.g. Raw Chromatic Crystals, Topological Quartz, Logic Substrates).
   - What is the player's "survival / exploration tension"? (If not oxygen, how does "rendering entropy" or "buffer capacity" create compelling survival risk outside the lab or spires?).
2. **Planetary Spire Infrastructure**:
   - Describe the machines placed on the moon (Pixel Chimneys, Harmonic Mesh Vibrators, Solar Collectors, Template Injectors).
   - How do power grids, logistics, and cartridge insertion work in the field?

### Section 4: Studio Mode vs. Play Mode Architecture
1. **Studio Mode (The Unlocked Artist Suite)**:
   - How does a creator access this from the main menu?
   - How does the Maya-style Outliner integrate with the 3D lab environment?
   - How can an artist create a standalone asset, test it live in the viewport, and export it as a universal `.setmix` bundle?
2. **Play Mode (The Progression Arc)**:
   - How is the lab progressively restored?
   - How does the player unlock new recipe tiers?
   - What is the end-game victory state? (Does the portal expand to connect to other player worlds in the Voxel Galaxy?).

### Section 5: The Pedagogical Philosophy (Teaching Real Game Dev as Gameplay)
1. **Intuitive Graphics Education**:
   - How does playing this game secretly teach the player real-world computer graphics concepts (albedo, normal maps, roughness, UV coordinates, level-of-detail, octaves, domain warping)?
   - How do the in-game tools do 90% of the mathematical heavy lifting while leaving 100% of the creative aesthetic decisions to the player?

### Section 6: Hard Game Design Reasoning Questions Answered
Address these critical design tensions:
1. *The Performance Paradox*: If terraforming increases graphical resolution from potato to ultra, won't low-end player laptops (e.g. Intel HD graphics or GTX 950M) choke as the planet becomes lush? What is the technical and algorithmic solution to keep 60 fps at all stages?
2. *Spatial Scope vs Global Shifts*: When a player slots a "Grass Cartridge" into a spire, does the entire moon instantly turn to grass, or does it expand as a volumetric radial wave? How is popping prevented?
3. *Inventory & Cartridge Management*: How do we prevent players from drowning in hundreds of obscure preset cartridges?
4. *Pacing & Boredom*: How do we keep the middle game engaging while waiting for fidelity meters to fill?

### Section 7: Recommended MVP Vertical Slice
Define the exact first 60 minutes of gameplay for the vertical slice:
- Starting in the sparse lab.
- First step through the portal archway.
- First pixel crystal mined.
- First Pixel Vaporizer built.
- First visible fidelity upgrade witnessed by the player.

---

Reason thoroughly, provide concrete formulas, UI layouts, and mechanical loops. Make this document an inspiring, production-ready blueprint that will blow away anyone who reads it!
