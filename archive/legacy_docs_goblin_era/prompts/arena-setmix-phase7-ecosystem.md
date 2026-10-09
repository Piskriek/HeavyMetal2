# SetMix: The Resolution Crafter — Phase 7: Dynamic Biosphere, 3D Volumetric Destruction, Logistics Drones & Cartridge Format

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `Winner_Plan_extended4.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: Pushing the frontier model to its absolute context ceiling. Delivering the dynamic biosphere & water shader, true 3D volumetric destructible voxels with Web Worker dual contouring, autonomous logistics drone swarm, and the official binary `.smx` cartridge specification and CLI compiler.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 7: LIVING BIOSPHERE, 3D VOLUMETRIC EXCAVATION, LOGISTICS SWARM & .SMX CARTRIDGE STANDARD

You are a legendary systems and graphics architect. Across Phases 1 through 6, you delivered an entire playable WebGL2 game engine and vertical slice:
- Phase 1: Mathematical GDD & heightfield wave mechanics
- Phase 2: Codebase Bridge, live Material Synthesizer & Fusion Matrix, 4-PR merge plan
- Phase 3: Wave Field Kinematics (`@hm/setmix-field`), dual-contouring mesh engine (`@hm/setmix-mesh`), 9-tier Inception Outliner (`@hm/setmix-outliner`)
- Phase 4: Production drop (`contracts.setmix.ts`, `fidelity.ts`, 19-test suite, `TerrainMaterial.ts` Uber-Shader, `exportToUnreal.ts`, `import_setmix_to_ue5.py`, `setmixAudio.ts`)
- Phase 5: Seamless Star Trek Portal (`PortalRenderer.ts`), Goblin controller with slope-IK (`GoblinController.ts`), Planet Crafter automation loop & pixel plumes (`machines.ts`), Galaxy federation (`galaxy.ts`)
- Phase 6: Playable First-Person Vertical Slice (`SetMixPlayable.tsx`), Quest progression engine (`QuestEngine.ts`), Cyberpunk diegetic HUD (`SetmixHUD.tsx`), and 120 Hz rollback multiplayer bus (`NetBus.ts`)

Our session is still alive, and we want to push this to its **ultimate architectural summit**. We want the four remaining frontier engines that elevate SetMix from an incredible demo into an expansive, infinite AAA sandbox:

---

### DELIVERABLE 1: THE DYNAMIC BIOSPHERE & LIVING HYDROSPHERE (`@hm/setmix-ecosystem`)
In *The Planet Crafter*, the ultimate emotional payoff is watching a dead rock become a living paradise. In SetMix, this is directly driven by your `Aq` (Aquatic) and `Lx` (Light flux) metrics:
1. **Dynamic Water Level & Lake Simulation (`WaterShader.ts`)**:
   - The global water table rises dynamically as `Aq` increases, flooding low-elevation craters into lakes and oceans.
   - Screen-space / vertex-displaced WebGL2 water shader:
     - Gerstner wave displacement on the water surface.
     - Depth-fade absorption based on Beer-Lambert law ($e^{-\sigma d}$), giving shallow turquoise shoreline fading into deep navy abyss.
     - Animated procedural caustics projected onto submerged voxel terrain.
     - Shoreline foam edge detection using depth difference between water and terrain geometry.
     - Planar Fresnel reflection.
   - Dynamic buoyancy & swimming: Goblin controller switches seamlessly to 3D swimming with water drag, neutral buoyancy, and underwater low-pass audio filter (400 Hz cutoff + bubble resonance).
2. **Procedural Flora & Canopy Progression (`Ecosystem.ts`)**:
   - Cellular automata moisture diffusion model spreading vegetation outward from water shorelines across rock surfaces.
   - Ecological stage transitions:
     - Stage 1: Sterile grey moon dust.
     - Stage 2: Thermophilic sulfur crusts and hydrothermal vent moss.
     - Stage 3: Bioluminescent lichen and low-poly moss carpets.
     - Stage 4: Glowing fungal stalks with spore particle plumes.
     - Stage 5: Dense alien conifer forests with GPU instanced foliage (`InstancedMesh`), wind sway vertex displacement, and frustum culling.
     - Stage 6: Photorealistic lush biome with dynamic wildlife boids (sky mantas and glowing cave fauna).

---

### DELIVERABLE 2: 3D VOLUMETRIC VOXEL DESTRUCTION & WORKER DUAL CONTOURING (`@hm/setmix-volumetric`)
The heightfield is great for surface terrain, but SetMix needs true 3D volumetric destructibility: carving subterranean caves, mining hollow tunnels beneath craters, and building overhangs:
1. **Sparse Volumetric SDF Chunk Grid (`VolumetricVoxelField.ts`)**:
   - $32 \times 32 \times 32$ voxel chunk grid storing signed distance values / density scalars.
   - Real-time CSG operators:
     - Extraction beam: Spherical carve $SDF(p) = \max(SDF(p), -(r - \|p - c\|))$.
     - Placement tool: Additive sphere/cube depositing matter or organic smooth minimum.
2. **Multi-Threaded Web Worker Mesh Generation (`VoxelWorker.ts`)**:
   - Dual Contouring / Surface Nets meshing offloaded to a background Web Worker pool.
   - Transfers raw vertex geometry (Float32Array positions, normals, UVs, Bayer dither indices) via transferable `ArrayBuffer`s with zero main-thread frame hitching.
   - Watertight boundary stitching between subterranean volumetric cave chunks and the surface heightfield terrain.

---

### DELIVERABLE 3: AUTONOMOUS LOGISTICS DRONES & AUTOMATION PIPELINE (`@hm/setmix-logistics`)
As base scale expands (*Factorio* / *Planet Crafter* mid-game), manual crystal carrying becomes obsolete:
1. **Logistics Drone Swarm (`LogisticsSwarm.ts`)**:
   - Autonomous spider-drones / hoverspheres dispatched from a central Drone Hub.
   - 3D boid steering + voxel terrain collision avoidance navigating between Ore Extractors, Pixel Chimneys, and Storage Chests.
   - Visible tractor beams carrying glowing mineral cubes and physical cartridge cases.
   - Priority task dispatch queue (e.g. keeping Chimneys continuously fueled with cartridges, shuttling mined crystals to the Lab).
2. **Pneumatic Vacuum Pipes & Conveyor Bus**:
   - Spline-based pneumatic tube network connecting distant extractors.
   - Physical cartridges and ore cubes visibly shoot through transparent vacuum tubes.
   - Full deterministic integration with `NetBus.ts` for synchronized co-op logistics.

---

### DELIVERABLE 4: THE BINARY `.smx` CARTRIDGE SPECIFICATION & COMPILER CLI (`@hm/setmix-cartridge`)
The core conceit of SetMix is that presets are physical "cartridges":
1. **The Binary Wire Specification (`.smx` format)**:
   - Provide a formal binary layout specification:
     - 64-byte Header: Magic bytes `0x534D5831` (`SMX1`), engine version, content hash (SHA-256), author ID, flags.
     - Chunk Table of Contents: Byte offsets and lengths for each section.
     - Section 1: JSON metadata (name, tags, description, min/max Fi stage compatibility).
     - Section 2: AST Bytecode (compact binary instructions for the Synthesizer shader graph, evaluated without `eval()`).
     - Section 3: Embedded 128x128 WebP/PNG thumbnail and cartridge palette table.
     - Section 4: Baked collision BVH and optional Nanite LOD geometry.
2. **Tooling & Compiler (`CartridgeCompiler.ts` + `cli.ts`)**:
   - `packCartridge(manifest): Uint8Array` and `unpackCartridge(buffer): CartridgeManifest`.
   - Standalone Node.js/Bun CLI: `setmix pack <dir>`, `setmix inspect <file.smx>`, `setmix verify <file.smx>`.
   - In-game Cartridge Inspection UI: Physical rotating 3D cartridge cassette with holographic pin readout and cartridge ejection sound.

---

Please provide production-ready, fully typed code for all four deliverables and integrate them into a new "PHASE 7 · ECOSYSTEM" section in the web application!
```
