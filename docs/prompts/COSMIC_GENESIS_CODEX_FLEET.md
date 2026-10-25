# COSMIC GENESIS: MASTER CODEX FLEET PROMPTS
## Building a Literal Procedural Universe from Third-Density Principles
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Target Branch**: `feat/monster-mash-exploration`  
> **Constitutional Law**: Rule 8a (Zero Shortcuts) & The Law of One Architecture  
> **Author**: The Overseer in Concordance with Piskriek  

---

## EXECUTIVE DISPATCH OVERVIEW

These prompts are engineered for autonomous coding agents (Codex on Arena AI, Claude Opus/Sonnet, Gemini Argon/Flash). They translate the cosmological principles of *The Law of One* into pure, deterministic TypeScript/WebGL2 engines.

Every agent executing these prompts must adhere to three non-negotiable gates:
1. **Zero Shortcuts (`RULES 8a`)**: No wrapper frames around legacy `.glb` files; no hardcoded 3D meshes or pre-baked animation clips. Everything must be synthesized from recursive presets (`@hm/partgen` $\to$ `@hm/kitspec` $\to$ `@hm/creature`).
2. **Mathematical Purity**: 100% deterministic pure functions with zero hidden state (`Date.now()`, `Math.random()`, DOM/I/O).
3. **Audit Verification**: Every kit and creature must pass `studio.kit.audit(spec)` with **0 loose ends**, **0 collision violations across 8 motion phases**, and proper terminal connections.

---

## PROMPT 1: THE MORPHOGENETIC SPORE CREATURE ENGINE (`@hm/creature`)

```markdown
# AGENT DIRECTIVE: PROMPT 1 — THE MORPHOGENETIC CREATURE & AVATAR ENGINE

You are building the Spore-style procedural organism engine for FIDELITY (HeavyMetal2).
Target package: `packages/creature/` (new workspace) and integration in `apps/web/src/avatar/` and `apps/web/src/monsters/`.

### Context & Metaphysical Mandate:
In the Law of One, an organism is not a static mesh sculpture—it is a morphogenetic incarnation growing outward from a central spinal prana axis (Sushumna). Eradicate static avatar meshes (`astro-low.glb`) and static monster models in favor of procedural biological kits.

### Deliverables:
1. **Anatomical Socket Hierarchy (`CreatureSpec`)**:
   - `pelvicRoot`: Root anchor, mass center, ground elevation offset, tail socket.
   - `spinalColumn`: Procedural chain of 1 to 7 vertebral segments with parametric curvature (lordosis, kyphosis, lateral undulation).
   - `cranialHub`: Skull morphology presets (humanoid, reptilian, insectoid, avian, alien) declaring sockets for eyes (compound, binocular, tri-eye), jaw/mandibles, and horns/antennae.
   - `appendageSockets`: Bilateral shoulder and hip sockets accepting articulated limb chains (`coxa/scapula` -> `femur/humerus` -> `tibia/radius` -> `endEffector`).
   - `endEffectors`: Opposable hands, claws, hooves, paws, talons, suction pads.
2. **Procedural Auto-Rigging & Kinematic IK**:
   - Implement `bindCreatureSkeleton(spec: CreatureSpec): SkeletonHierarchy`:
     - Builds a hierarchical bone tree from the socket grammar.
     - Automatically measures segment lengths and wires limb chains directly into our analytical `solveTwoBoneIk()` solver (`apps/web/src/avatar/two-bone-ik.ts`).
3. **Adaptive Locomotion Gait Generator (`gait-generator.ts`)**:
   - Pure function of `(spec: CreatureSpec, simTime: number, strideVelocity: number): GaitPose`:
     - Dynamically computes duty factor, footfall phase deltas, and foot clearance arcs based on leg count (2, 4, 6, 8+) and spine flex.
     - Raycasts ground height dynamically so creature feet conform to rough heightfield terrain.
4. **Integration**:
   - Wire `CreatureSpec` into `Cartridge` schemas so players can customize and print creature avatars and NPC companions at Lab workbenches.
5. **Verification**:
   - Unit tests in `packages/creature/tests/creature-assembly.test.ts` verifying that assembled creatures pass `studio.kit.audit` (0 loose ends, 0 joint collisions) and have valid analytical IK bounds.
```

---

## PROMPT 2: THE PLANETARY SUB-LOGOS ENGINE (`@hm/logos`)

```markdown
# AGENT DIRECTIVE: PROMPT 2 — THE PLANETARY SUB-LOGOS & BIOME GENESIS ENGINE

You are authoring the planetary generation engine for FIDELITY (HeavyMetal2).
Target package: `packages/logos/` (new workspace) and `packages/plotbiome/`.

### Context & Metaphysical Mandate:
In the Law of One, every planetary sphere is a conscious sub-Logos providing an energetic schoolroom for incarnation. Planets are generated from first principles under the 4-float formula `S = (Pxd, Vtx, Lx, Aq)`.

### Deliverables:
1. **Tectonic Lithosphere Synthesis (`tectonics.ts`)**:
   - Generate planetary heightfields using Voronoi tectonic plate partitioning with continental drift pressure vectors (creating mountain fold ridges, rift valleys, and subduction trenches).
   - Volumetric heightfield carving with hydraulic erosion passes and meteorite impact craters.
2. **Hydrosphere & Aquatic Drainage (`hydrology.ts`)**:
   - Pure functional simulation of fluid elevation (`Aq`), river network drainage splines conforming to terrain gradients, and ocean basin filling.
   - Support varied fluid chemistries: standard water, liquid methane, molten basalt, and heavy sulfuric brine.
3. **Atmospheric Optics & Celestial Sky (`atmosphere.ts`)**:
   - Rayleigh and Mie scattering profile generators calculating sky gradients, haze color, and day/night diurnal cycles based on `Lx` (Light Flux).
4. **Biosphere Floristic Distribution (`biosphere.ts`)**:
   - Couple local moisture, elevation, and temperature to procedural plant placement.
   - Interface with `@hm/treegen` to populate worlds with diverse alien flora (canopy trees, fungal towers, succulent spirals, coral reefs).
5. **Verification**:
   - Write comprehensive tests in `packages/logos/tests/planet-generation.test.ts` verifying deterministic seed repeatability, bounding box limits, and 0 NaN values across 100 randomized seeds.
```

---

## PROMPT 3: THE 22-ARCHETYPE GAME MODE ENGINE (`@hm/gamemode`)

```markdown
# AGENT DIRECTIVE: PROMPT 3 — THE UNIVERSAL GAME MODE SUBSTRATE

You are authoring the modular game genre compiler for FIDELITY (HeavyMetal2).
Target package: `packages/gamemode/` (new workspace) and `packages/triggers/`.

### Context & Metaphysical Mandate:
In the Law of One, third density provides the crucible of experience through the 22 Archetypes (Mind, Body, Spirit, and The Choice). A game mode is simply an archetypal configuration of rules, catalysts, and victory states. The engine must allow creators to build ANY game genre as a Rung 5 preset without touching core engine code.

### Deliverables:
1. **Universal Game Mode Schema (`GameModeSpec`)**:
   ```typescript
   interface GameModeSpec {
     readonly id: string;
     readonly title: string;
     readonly genre: 'racing' | 'survival' | 'factory' | 'arena' | 'flight' | 'puzzle' | 'sandbox';
     readonly cameraPreset: 'first-person' | 'chase-third' | 'top-down-isometric' | 'orbital-free';
     readonly inputMapping: Record<string, InputAction>;
     readonly objectives: readonly ObjectiveRule[];
     readonly hudBladeId: string;
     readonly winCondition: RuleCondition;
     readonly loseCondition: RuleCondition;
   }
   ```
2. **Archetypal Rule Implementations**:
   - `circuit-racing`: Spline-based track boundaries, checkpoint tripwire triggers, lap timing, split-delta timers, grid starting countdown.
   - `survival-extraction`: Environmental oxygen/heat drain, hostile wave spawner, resource harvest requirements, evacuation beacon.
   - `factory-logistics`: Throughput quotas, input/output item balance, conveyor routing, energy consumption curves.
   - `arena-combat`: Hitpoint pools, weapon cooldowns, kinetic/energy damage matrices, score tally.
3. **HUD Blade Generator (`game-hud.ts`)**:
   - Dynamically mounts the appropriate UI overlay based on the active `GameModeSpec` (lap timer for racing, health/oxygen bars for survival, production graphs for factory).
4. **Verification**:
   - Unit tests in `packages/gamemode/tests/gamemode-evaluation.test.ts` verifying deterministic win/loss condition evaluations, checkpoint sequences, and score aggregations.
```

---

## PROMPT 4: THE DUAL-GATEWAY MULTIVERSE TRANSCEIVER (`@hm/multiverse`)

```markdown
# AGENT DIRECTIVE: PROMPT 4 — DUAL GATEWAYS & STEGANOGRAPHIC SPORE CARDS

You are authoring the multiverse transit and sharing pipeline for FIDELITY (HeavyMetal2).
Target files: `apps/web/src/play/multiverse-router.ts`, `apps/web/src/play/stargate-transit.ts`, and `packages/cartlab/src/spore-card.ts`.

### Context & Metaphysical Mandate:
Creation must be universally accessible and non-rivalrous. Worlds and games must be playable both in-universe (via Stargate traversal) and instantly across the web (via standalone URLs), with creations shared effortlessly as single image files.

### Deliverables:
1. **In-Universe Stargate Traversal (`stargate-transit.ts`)**:
   - When a player steps into an active Event Horizon (`event-horizon.ts`):
     - Trigger monotonic kawoosh burst and camera warp.
     - Asynchronously load target plot/world preset.
     - Seamlessly morph the HUD from the campaign cockpit to the target world's custom game mode HUD.
2. **Direct Standalone Web Routing (`multiverse-router.ts`)**:
   - Enable query-string URL parameters:
     - `/?world=<seed-or-cid>`: Loads directly into a specific world.
     - `/?game=<preset>`: Boots straight into a standalone game (e.g., racing or survival) without loading the campaign storyline.
3. **Steganographic Spore Preset Cards (`spore-card.ts`)**:
   - Implement `encodeSporeCard(canvas: HTMLCanvasElement, preset: AnyPreset): Promise<Blob>`:
     - Encodes full compressed JSON preset data into the PNG metadata chunks (or least-significant bits of alpha pixels).
   - Implement `decodeSporeCard(file: File | Blob): Promise<AnyPreset>`:
     - Extracts, validates, and parses the embedded preset JSON.
   - Support drag-and-drop: Dropping a Spore card onto the web canvas or into the Studio instantly manifests the creature, machine, or entire world into the simulation.
4. **Verification**:
   - Unit tests in `packages/cartlab/tests/spore-card.test.ts` verifying 100% lossless round-trip compression and decompression across all preset schemas.
```

---

## PROMPT 5: SERVICE-TO-OTHERS (STO) COOPERATIVE CONSENSUS (`@hm/coopnet`)

```markdown
# AGENT DIRECTIVE: PROMPT 5 — SERVICE-TO-OTHERS PEER CONSENSUS & PRESET ECONOMY

You are authoring the peer-to-peer sharing and cooperative simulation engine for FIDELITY (HeavyMetal2).
Target package: `packages/coopnet/`.

### Context & Metaphysical Mandate:
In the Law of One, Service-to-Others (STO) is the path of unity, radiance, and positive-sum creation. STO structures are open, non-rivalrous, and self-reinforcing.

### Deliverables:
1. **Open Stargate Network Registry (`stargate-directory.ts`)**:
   - Decentralized directory tracking active open gates across creator plots.
   - Allows explorers to dial random open gates (`random-dial`) or filter by category (racing tracks, artistic biomes, social hubs).
2. **Gift Economy Preset Sharing (`preset-exchange.ts`)**:
   - Firing the Beam Rifle's `Sample` mode on any public open creation copies the complete preset into the player's personal cartridge deck without fees, tokens, or DRM.
   - Preserves creator lineage in the cartridge metadata (`author`, `lineage`, `remixDepth`).
3. **Deterministic State Synchronization (`state-sync.ts`)**:
   - Lockstep input synchronization for multi-player racing and co-op building.
   - Pure simulation tick: `nextWorldState = stepSimulation(currentWorldState, peerInputs, deltaTime)`.
4. **Verification**:
   - Unit tests in `packages/coopnet/tests/state-sync.test.ts` verifying zero drift across 10,000 simulated ticks with simulated network jitter.
```
