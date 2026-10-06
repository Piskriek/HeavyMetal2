# SetMix: The Resolution Crafter — Phase 5: Portal Physics, Goblin Controller, Planet Crafter Loop & Galaxy Sync

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `Winner_Plan_extended2.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: Squeezing the remaining frontier capability out of the model. Implementing the seamless Star Trek/Holodeck Portal stencil pipeline, the progressive 6-stage Goblin avatar controller with slope-IK, the *Planet Crafter* machine automation and power grid loop, and the Voxel Galaxy federation protocol.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 5: SEAMLESS PORTAL, GOBLIN CONTROLLER, AUTOMATION LOOP & GALAXY SYNC

You have given us an incredible foundation across Phases 1 through 4: the mathematical GDD, the codebase bridge, the wave and meshing kinematics, the Inception outliner, and the Phase 4 production drop (`contracts.setmix.ts`, `fidelity.ts`, `TerrainMaterial.ts`, `exportToUnreal.ts`, `import_setmix_to_ue5.py`, and `setmixAudio.ts`).

While we still have context in this session, we want to extract the four remaining core gameplay engines that turn this architecture into a living, playable game:

---

### DELIVERABLE 1: THE SEAMLESS STAR TREK / HOLODECK PORTAL (`@hm/portal`)
The core premise of the game is the archway connecting the White Room Lab to the low-poly moon:
- **Visual Stencil / Oblique Camera Rendering (Three.js / WebGL2)**:
  - How does the portal archway render the destination world seamlessly without split-screen seam glitches?
  - Provide `PortalRenderer.ts`: Stencil buffer masking, virtual camera position transformation relative to the portal frame matrix, and oblique near-plane clipping so geometry behind the portal doesn't poke through.
- **The Threshold Crossing State Machine**:
  - When the player camera crosses the portal plane:
    - Transform player entity: High-Fidelity Scientist in lab ⟷ Goblin Astronaut on the moon.
    - Coordinate space transform: Lab room origin `(0, y, 0)` ⟷ Planet surface coordinate `(spire_x, spire_y, spire_z)`.
    - Seamless audio crossfade: Transitioning between pristine studio acoustics and the moon's current diegetic audio stage.

---

### DELIVERABLE 2: THE PROGRESSIVE GOBLIN AVATAR & KINEMATIC CONTROLLER (`@hm/goblin-controller`)
In your GDD, the avatar evolves diegetically from a 48-triangle block goblin into a 48k hero character:
- **`GoblinController.ts`**:
  - Implements the movement physics across the fidelity ladder:
    - Stage 1: Stepped AABB clambering, parabolic jump quantized to 0.25m, snapped drops.
    - Stage 2: Capsule collision on slopes up to 28°, tumbling rigid body drops.
    - Stage 3: Continuous collision, slide/sprint momentum, slope-dependent friction.
    - Stage 4: Swimming, diving, buoyancy forces, and water drag.
- **`AvatarFidelityManager.ts`**:
  - Two-bone analytical Inverse Kinematics (IK) for feet placement on sloped voxels.
  - Procedural head-look targeting Points of Interest (spires, crystals).
  - Cloth simulation for the goblin's cape (Verlet integration with wind force vector).
  - Mesh budget scaling: Dynamically toggling triangle tiers and shader uniforms (suit wear, mud accumulation, wetness).

---

### DELIVERABLE 3: THE PLANET CRAFTER AUTOMATION & POWER GRID ENGINE (`@hm/setmix-machines`)
The primary planetary loop is mining pixels and building terraforming extractors:
- **The Core Extractor Machinery**:
  - **Pixel Chimneys** (Pxd emitters): Spew pixel plumes into the atmosphere.
  - **Harmonic Vibrators** (Vtx emitters): Induce terrain resonance that subdivides geometry.
  - **Lumen Masts & Rayleigh Bellows** (Lx emitters): Pump photon blooms and atmospheric scatter.
  - **Condensation Towers & Glacier Crackers** (Aq emitters): Sublimate clathrates and flood valleys.
- **Power & Clock Distribution Network**:
  - Power sources: Solar collectors, geothermal vents, hydro waterwheels, nuclear fission.
  - Clock demand vs. supply: Under-clocked machines brown out; over-clocked machines generate heat and risk thermal trips.
- **Pixel Plume Particle System (`PixelPlume.ts`)**:
  - GPU instanced particle plumes physically spewing pixel cubes into the sky that drift with the wind vector and dissipate into the active terraform wave band.

---

### DELIVERABLE 4: THE VOXEL GALAXY MULTI-WORLD FEDERATION (`@hm/galaxy`)
In late-game Stage 6, the portal bandwidth expands to link to other players' moons across the Voxel Galaxy:
- **`PlanetManifest.ts`**:
  - The portable `.galaxy.json` world specification:
    - Master seed, total accumulated Fidelity Index ($Fi$), author signature, content hashes of slotted cartridges, machine coordinates, and topological terrain delta journal.
- **Federated World Streaming Protocol**:
  - How one player steps through a portal into another player's hosted or cached moon:
    - Downloading only the manifest and required cartridges (~200 KB total).
    - Procedurally reconstructing the entire planet deterministically from the seed and command journal without downloading gigabytes of voxel data.

Provide clean, production-ready, fully typed TypeScript code for all four systems.
```
