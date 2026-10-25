# UNIVERSAL SIMULATION ONTOLOGY RESEARCH: THE ARCHITECTURE OF "EVERYTHING"
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Status**: Canonical Master Research & Ontological Blueprint  
> **Author**: The Overseer (Antigravity Argon / Gemini / Claude) in concordance with Piskriek  
> **Philosophical Grounding**: The Law of One (3rd Density Octave of Perspective) & First-Principles Deterministic Simulation  

---

## 0. THE CORE CONCORDANCE: THE SIMULATION INSIDE THE SIMULATION
In the *Law of One*, creation unfolds as an octave of densities where consciousness experiences the interplay of Light, Geometry, and Free Will. The physical 3rd density is a sandbox of perspective—learning through separation, assembly, and return to unity.

In *FIDELITY: The SetMix Multiverse*, we construct the digital fractal reflection: **the simulation inside the simulation**.
The game is not a set of hardcoded levels, nor a collection of isolated demos. It is a **self-hosting, deterministic reality compiler** operating under the universal 4-float formula:
$$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
Progressing through the **7 Fidelity Stages ($S_0 \to S_6$)** mirrors the sevenfold ascent of perspective:
$$\text{Wireframe Bones } (S_{0a}) \to \text{1-bit Bayer } (S_{0b}) \to \text{16-color EGA } (S_1) \to \text{256-color VGA } (S_2) \to \text{Gouraud } (S_3) \to \text{Full Physical PBR } (S_{4..6})$$

To allow players and creators to build **anything imaginable in any style and fidelity**, the universe cannot rely on handcrafted one-off assets. It must provide an encyclopedic, Wikipedia-scale library of modular building blocks across **10 Ontological Domains**.

---

## 1. THE 10 ONTOLOGICAL DOMAINS OF REALITY

```text
                                 THE OCTAVE OF SIMULATION
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │ 1. MATTER & SHAPE        │ Pure geometry, parametric solids, CSG, sockets        │
   │ 2. SURFACE & OPTICS      │ Multi-layer wear, periodic tiles, OKLab, render styles │
   │ 3. KINEMATICS & FORCES   │ Linkages, joints, suspensions, gaits, physics fields  │
   │ 4. BIOLOGY & ORGANISMS   │ Skeletons, organ sockets, limbs, adaptive IK, AI      │
   │ 5. MACHINES & TECHNOLOGY │ Chassis, motors, rams, tooling, fluid/power conduits  │
   │ 6. WORLDS & BIOMES       │ Geological strata, hydrology, atmospheres, L-trees    │
   │ 7. LOGIC & CAUSALITY     │ Sensors, wiregraphs, triggers, state machines         │
   │ 8. RULES & GAMEPLAY      │ Loops, lap timing, survival meters, win conditions    │
   │ 9. DIEGETIC ACOUSTICS    │ Physical timbres, engine hums, vocal tract formants   │
   │ 10. MULTIVERSE GATEWAYS  │ Stargate addresses, standalone URLs, PNG Spore cards  │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DOMAIN SPECIFICATIONS & GENERATIVE SCHEMAS

### DOMAIN 1: MATTER & SHAPE (GEOMETRIC ATOMS)
Every physical entity is constructed from parametric primitives and volumetric operations defined in `@hm/partgen` and `@hm/meshops`:
- **Prisms & Extrusions**: Hexagonal, octagonal, I-beam, C-channel, structural tubing, hollow ducts.
- **Revolution Solids**: Spools, flanges, pulleys, bevel cones, flared nozzles, spherical caps.
- **Deformers & Operations**: Non-destructive 27-operator stack (taper, bend, twist, chamfer, slice, mirror, thicken).
- **Socket Standard**: Every part declares strict male/female coordinate frames:
  ```typescript
  interface SocketDef {
    readonly at: readonly [number, number, number];
    readonly rot?: readonly [number, number, number]; // Euler degrees
    readonly kind?: 'rigid' | 'hinge' | 'ball' | 'slide' | 'conduit';
    readonly limits?: readonly [number, number];     // min/max travel or angle
  }
  ```

### DOMAIN 2: SURFACE & OPTICS (THE LIGHT ENGINE)
Matter is dressed by `@hm/matstack` 5-level wear stacks and `@hm/texgraph` periodic procedural nodes:
- **Periodic Texture Synthesis**: $O(1)$ seamless toroidal tiling across albedo, roughness, height, and metalness (`tile-library.ts`).
- **Material Wear Inception**:
  - `Level 0: Base Substrate` (Cast iron, structural steel, copper, carbon weave, bone, muscle).
  - `Level 1: Dermal / Primer` (Protective zinc chromate, organic hypodermis, rubber coating).
  - `Level 2: Surface Coat` (Enamel pigment, scale pattern, chitin plate, fur follicle).
  - `Level 3: Micro-Cavity & Grime` (Crevice soot, world-space mud splatter, regolith dust).
  - `Level 4: Physical Abrasion` (Convex edge metal exposure $\ge 0.45$, scorch marks, scratches).
- **Optical Render Profiles**:
  - `PBR Photorealism`: DFG split-sum specular, screen-space normal-derivative micro-cavity.
  - `Retro Retro-Computing`: OKLab quantization into IBM EGA 16-color, VGA 256-color, and 1-bit Bayer dithering.
  - `Stylized / Illustrated`: Stepped cel-shaded lighting ramps with ink-line edge extraction.

### DOMAIN 3: KINEMATICS & DYNAMICS (MOMENTUM & MECHANICAL LINKAGES)
Every moving part is governed by stateless pure functions of `(simTime, seed, inputs)` in `@hm/kinematic` and `@hm/anim`:
- **Mechanical Linkage Presets**:
  - *Linear Actuators*: Hydraulic rams, pneumatic sliders, scissor mechanisms (`A.slide`).
  - *Rotational Linkages*: Planetary differentials, worm gears, universal joints, bevel angle transfers.
  - *Suspensions*: Independent double wishbone, MacPherson strut, multi-link, trailing arm, rocker-bogie.
- **Force Fields & Environmental Dynamics**:
  - Gravitational vectors: Directional ground gravity, planetary spherical gravity, zero-g momentum drift.
  - Drag & Friction: Aerodynamic fluid resistance, rolling resistance, slip/traction curves.

### DOMAIN 4: BIOLOGY & ORGANISMS (THE SPORE CREATURE ENGINE)
Life is synthesized through modular anatomical socket trees (`CREATURE_KIT`):
```text
           [Cranial / Sensory Head]
                     │
            [Cervical Neck]
                     │
     [Shoulder Girdle] ── [Dorsal Attachment / Wings / Shell]
     ┌───────┴───────┐
 [Left Arm]      [Right Arm]
     │               │
  [Hand/Claw]     [Hand/Claw]
                     │
          [Thoracic / Lumbar Spine]
                     │
              [Pelvic Root] ── [Caudal Tail]
              ┌──────┴──────┐
          [Left Leg]    [Right Leg]
              │             │
          [Foot/Paw]    [Foot/Paw]
```
- **Procedural Auto-Rigging**: The socket hierarchy generates a kinematic bone chain with analytical two-bone IK targets (`two-bone-ik.ts`).
- **Adaptive Locomotion Synthesis**: Locomotion gaits evaluate stride frequency, ground contact phases, and body undulation dynamically based on limb count ($2, 4, 6, 8+$) and mass center.

### DOMAIN 5: MACHINES & INDUSTRIAL APPARATUS
Every machine and vehicle is decomposed into the 5-group Anatomy standard ([`kit-groups.ts`](file:///c:/MarbleGp/apps/web/src/play/kit-groups.ts)):
1. `base`: Skid frame, undercarriage, outriggers, tracks, wheels.
2. `structure`: Bulkheads, protective roll-cages, nacelles, hulls.
3. `mechanism`: Power transmission, articulated booms, pistons, rotors.
4. `controls`: Operator consoles, valve manifolds, status LED indicators, wiregraph sockets.
5. `subject`: The primary end-effector (crucible, cutter head, hopper bed, drill, nozzle).

### DOMAIN 6: WORLDS, BIOMES & CELESTIAL MECHANICS
Planets are procedurally compiled from three interacting layers:
- **Lithosphere (Terrain & Strata)**: Volumetric heightfield carving, tectonic fracturing, cratering, overhangs.
- **Hydrosphere ($\text{Aq}$)**: Liquid elevation, fluid viscosity (water, hydrocarbons, molten basalt), surface wave harmonics.
- **Atmosphere & Sky ($\text{Lx}$)**: Rayleigh/Mie scattering gradients, cloud layers, day/night diurnal cycle, orbital celestial bodies.
- **Biosphere (Flora)**: L-system tree generation (`@hm/treegen`), canopy spread, root anchors, procedural foliage.

### DOMAIN 7: LOGIC, SENSORS & SIGNAL PROCESSING
The world's nervous system operates via deterministic signal wiregraphs (`@hm/wiregraph`):
- **Sensory Inputs**: Proximity volumes, optical beam detectors, laser tripwires, pressure plates, timer clocks.
- **Logic Nodes**: Boolean gates (AND, OR, NOT, XOR), arithmetic multipliers, threshold comparators, latches.
- **Actuators**: Apertures, sliding blast doors, iris shields, motorized lifts, hazard fields, automated turrets.

### DOMAIN 8: RULES, ECONOMY & GAMEPLAY LOOPS
Game modes are encapsulated as high-level Rung 5 presets (`GameModePreset`):
- **Core Loop Presets**:
  - *Circuit Racing*: Checkpoint sequences, lap times, split times, pole grids.
  - *Survival / Extraction*: Environmental drain (oxygen, heat), hostile mob wave spawns, extraction beacons.
  - *Automation / Factory*: Input/output material balancing, energy throughput quotas, logistics belts.
  - *Arena Combat*: Hitpoint pools, kinetic/energy damage matrices, weapon cooldowns, wave spawners.
- **Win/Loss Evaluators**: Pure deterministic conditions checking world and player states.

### DOMAIN 9: DIEGETIC ACOUSTICS & VOICES
Sound is synthesized in `@hm/soundlab` using physical models rather than recorded samples:
- **Mechanical Timbre**: Resonant metallic clangs, hydraulic pressure releases, motor hum frequencies proportional to RPM.
- **Acoustic Vocal Tracts**: Glottal pulse oscillators paired with dual-cavity formant filters synthesizing alien barks, growls, and chirps.
- **Environmental Ambience**: Cavity reverberation algorithms adapting to room dimensions and canyon depths.

### DOMAIN 10: MULTIVERSE DISTRIBUTION & DUAL GATEWAYS
Creations are portable and instantly playable across the entire network:
- **In-Universe Stargate Transit**: Dialing random or specific 6-chevron addresses to step through the Event Horizon into another creator's world.
- **Direct Standalone Web Links**: Accessing any world or game directly via browser URL (`/?world=<id>` or `/?game=<mode>`).
- **Steganographic PNG Preset Cards (The Spore Card)**: Storing the complete JSON spec inside a 3D rendered PNG thumbnail for drag-and-drop sharing.

---

## 3. THE CODEX FLEET ENGINE: MASS GENERATIVE EXECUTION
Because the schemas above are strictly mathematical, pure, and deterministic, they can be partitioned into **Codex Fleet Briefs**. Fleets of autonomous coding agents can systematically populate the entire Wikipedia of presets without human bottlenecking, verified automatically by `studio.kit.audit` and programmatic unit tests.
