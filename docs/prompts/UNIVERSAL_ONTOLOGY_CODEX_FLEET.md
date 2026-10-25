# THE UNIVERSAL ONTOLOGY: CODEX FLEET DISPATCH PROMPTS
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Target Branch**: `feat/monster-mash-exploration`  
> **Constitutional Mandate**: Rule 8a (Zero Shortcuts) & The Anatomy Standard  
> **Objective**: Deploy fleets of autonomous Codex agents to systematically author the Wikipedia-scale modular ontology across all 10 simulation domains.

---

## OVERVIEW: THE MASS-GENERATION PROTOCOL
Each prompt batch below assigns an autonomous Codex agent a specific domain of the **Universal Simulation Ontology**.
Every generated preset must satisfy three non-negotiable gates:
1. **Mathematical Purity**: 100% deterministic pure functions with zero hidden state (`Date.now()`, `Math.random()`, DOM/I/O).
2. **Audit Verification**: Every mechanical or creature kit must pass `studio.kit.audit(spec)` with **0 loose ends**, **0 collision violations across 8 motion phases**, and proper terminal connections.
3. **Preset Inception**: Every component must be serializable into Rung 5 cartridges, targetable by `kit-target.ts`, and editable via in-game sliders and Studio node graphs.

---

## BATCH 1: MECHANICAL & INDUSTRIAL ENCYCLOPEDIA (SUSPENSIONS, DRIVETRAINS & MECHANISMS)

```markdown
# AGENT DIRECTIVE: BATCH 1 — THE UNIVERSAL MECHANICAL TAXONOMY

You are authoring the encyclopedic mechanical preset library for FIDELITY (HeavyMetal2).
Target package: `packages/kitspec/src/taxonomy/mechanical/`

### Deliverables:
1. **Suspension Geometries (10 Archetypes)**:
   - `double-wishbone`, `macpherson-strut`, `rocker-bogie`, `trailing-arm`, `solid-axle`, `multi-link`, `torsion-beam`, `leaf-spring-pack`, `pneumatic-hydrolastic`, `scissor-crawler`.
   - Each suspension must be decomposed into 5-group Anatomy sockets (`base`, `structure`, `mechanism`, `controls`, `subject`) and provide a closure-free `KitMotionSpec` driving wheel travel and spring compression.
2. **Industrial Kinetic Mechanisms (15 Archetypes)**:
   - `planetary-gearbox`, `worm-drive-actuator`, `telescoping-hydraulic-ram`, `rack-and-pinion`, `universal-joint-shaft`, `gimbal-mount-dual-axis`, `centrifugal-flyball-governor`, `rotary-cam-follower`, `reciprocating-piston-crank`, `scissor-lift-lattice`, `winch-drum-cable`, `geneva-drive-indexer`, `high-pressure-slurry-pump`, `cyclone-separator-duct`, `rotary-lathe-chuck`.
3. **Verification**:
   - Write comprehensive unit tests in `packages/kitspec/tests/taxonomy-mechanical.test.ts`.
   - Run `studio.kit.audit(spec)` on every archetype: must report `looseEnds === 0` and `0` collisions across 8 sampled motion phases (`t in [0, 1]`).
```

---

## BATCH 2: THE SPORE CREATURE & ORGANISM ENGINE (`@hm/creature`)

```markdown
# AGENT DIRECTIVE: BATCH 2 — THE MODULAR CREATURE & AVATAR TAXONOMY

You are authoring the Spore-style modular organism engine for FIDELITY (HeavyMetal2).
Target package: `packages/creature/` (new package) and `apps/web/src/avatar/`

### Deliverables:
1. **Anatomical Socket Grammar (`CreatureSpec`)**:
   - `root`: Pelvis anchor, mass center, ground clearance offset.
   - `spine`: Multi-segment spinal column (1 to 5 vertebral segments) with procedural curvature parameters.
   - `cranial`: Skull morphology (humanoid, reptilian, insectoid, avian, alien), jaw articulation sockets, eye cluster sockets, antennae/horns.
   - `limbs`: Modular bilateral limb chains (`shoulder/hip` -> `upper-limb` -> `lower-limb` -> `end-effector`). Support bipedal, quadrupedal, and hexapod configurations.
   - `end-effectors`: Opposable hands, hooves, paws, talons, suction pads, insectoid claws.
2. **Procedural Auto-Rigging & IK Integration**:
   - Create `bindCreatureSkeleton(spec: CreatureSpec)`: Automatically builds a Three.js / analytical bone hierarchy from the socket tree.
   - Wire upper and lower limb lengths directly into our analytical `solveTwoBoneIk()` solver (`apps/web/src/avatar/two-bone-ik.ts`).
3. **Adaptive Locomotion Synthesis (`@hm/anim` + `@hm/kinematic`)**:
   - Create `evaluateCreatureGait(spec, simTime, locomotionPreset)`: Synthesizes walk, run, and jump gaits analytically based on leg count, limb length, and stride radius without handmade animation clips.
4. **Verification**:
   - Write unit tests in `packages/creature/tests/creature-audit.test.ts` verifying that assembled creatures pass `studio.kit.audit` and kinematic IK bounds.
```

---

## BATCH 3: PLANETARY BIOMES, GEOLOGY & HYDROLOGY

```markdown
# AGENT DIRECTIVE: BATCH 3 — THE PROCEDURAL PLANET & BIOME ONTOLOGY

You are authoring the encyclopedic biome and geological formation library for FIDELITY (HeavyMetal2).
Target files: `packages/plotbiome/`, `apps/web/src/play/biome-preset.ts`, and `packages/treegen/`

### Deliverables:
1. **Geological Formation Presets (12 Planetary Archetypes)**:
   - `volcanic-caldera`, `lunar-impact-crater`, `canyon-badlands`, `dune-sea`, `coastal-fjords`, `tectonic-rift`, `crystalline-spires`, `mesa-plateau`, `karst-sinkholes`, `subterranean-chasm`, `glacial-moraine`, `hydrothermal-basin`.
2. **Flora & Canopy Taxonomies (20 L-System Species)**:
   - Expand `@hm/treegen` to include alien flora: `bioluminescent-fungus`, `spiral-succulent`, `conifer-spire`, `weeping-willow`, `canopy-mangrove`, `tentacle-fern`, `coral-crag`, `spore-pod-tower`.
3. **Atmospheric & Fluid Profiles**:
   - Define Rayleigh/Mie scattering parameters, atmospheric density, fluid viscosity (`water`, `heavy-brine`, `liquid-methane`, `acid-slurry`), and wave harmonics.
4. **Verification**:
   - Unit tests verifying deterministic heightfield generation, bounding constraints, and seed repeatability.
```

---

## BATCH 4: GAMEPLAY MODES, RULES & WIREGRAPH AI BRAINS

```markdown
# AGENT DIRECTIVE: BATCH 4 — UNIVERSAL GAME MODES & AI BRAIN PRESETS

You are authoring the interactive gameplay presets and behavioral AI engine for FIDELITY (HeavyMetal2).
Target packages: `packages/wiregraph/`, `packages/npcbrain/` (new), `packages/triggers/`

### Deliverables:
1. **Game Mode Schemas (`GameModePreset` / Rung 5)**:
   - `circuit-racing`: Spline-based track boundaries, checkpoint triggers, lap timer, split times, pole grid start.
   - `wave-survival`: Dynamic threat escalation, spawn volumes, barrier integrity, ammo economy.
   - `factory-logistics`: Throughput quotas, conveyor routing, energy consumption balance.
   - `arena-combat`: Hitpoint pools, damage matrices, weapon cooldowns, cover nodes.
2. **Modular NPC Brain Presets (`@hm/npcbrain`)**:
   - Replace hardcoded monster logic with modular behavior utility graphs:
     - Sensory nodes: `PerceiveNoise`, `DetectPlayerSight`, `SmellResource`, `DetectDamageBearing`.
     - Behavioral nodes: `FleeIfDamaged`, `PackFlock`, `StalkAndAmbush`, `DefendTerritory`, `GrazeFlora`.
3. **Verification**:
   - Test suite verifying that AI utility graphs evaluate deterministically from `(simTime, worldState, mobState)` with zero memory allocations in the inner loop.
```

---

## BATCH 5: DIEGETIC ACOUSTICS & ACOUSTIC VOCAL TRACT MODELS

```markdown
# AGENT DIRECTIVE: BATCH 5 — PHYSICAL ACOUSTICS & VOCAL TRACT SYNTHESIS

You are authoring the physical acoustic simulation library for FIDELITY (HeavyMetal2).
Target package: `packages/soundlab/`

### Deliverables:
1. **Acoustic Vocal Tract Model (`vocal-tract.ts`)**:
   - Implement a physical glottal pulse oscillator coupled with an analytical dual-cavity formant filter (controlling throat length, mouth aperture, nasal resonance).
   - Generates deterministic creature vocalizations: barks, growls, chirps, hisses, clicks, and purrs without audio sample files.
2. **Mechanical Sound Generators**:
   - RPM-linked electric motor whines, planetary gear chatter, hydraulic pressure relief hisses, pneumatic exhaust snaps, and resonant metal impact strikes.
3. **Surface Footstep & Collision Physics**:
   - Procedural footstep generators adapting to surface material (`metal-grating`, `regolith-dust`, `rock-slab`, `water-puddle`, `deep-mud`).
4. **Verification**:
   - Unit tests verifying zero clipping, strict $-1.0 \le y \le 1.0$ audio bounds, and seed-repeatable waveform generation.
```

---

## BATCH 6: UNIVERSAL OPTICAL LENSES & STEGANOGRAPHIC SPORE CARDS

```markdown
# AGENT DIRECTIVE: BATCH 6 — OPTICAL STYLES & STEGANOGRAPHIC PRESET CARDS

You are authoring the rendering lenses and multiverse sharing pipeline for FIDELITY (HeavyMetal2).
Target packages: `packages/skin/`, `apps/web/src/play/layered-material.ts`, `packages/cartlab/`

### Deliverables:
1. **Optical Aesthetic Lenses**:
   - `cel-shaded-cartoon`: Stepped N-dot-L lighting bands, saturated OKLab remap, ink-line silhouette edge extraction.
   - `technical-blueprint`: Cyan monochrome pass, edge-line highlight, grid overlay.
   - `halftone-print`: CMYK dot-screen thresholding.
   - `degauss-crt`: Interlaced scanline simulation, phosphor bloom, degauss pulse warp.
2. **Steganographic PNG Preset Cards (The Spore Card Standard)**:
   - `encodePresetCard(canvas, presetJson): Blob`: Encodes compressed JSON preset data into the least-significant bits (LSB) or dedicated PNG chunks of a 3D turntable thumbnail.
   - `decodePresetCard(pngBuffer): PresetJson`: Decodes and validates any dropped PNG image to instantly reconstruct the creature, machine, or world.
3. **Direct-Play URL Routing**:
   - Wire `/?world=<id>` and `/?game=<preset>` in `apps/web/src/` to boot straight into custom standalone games with their own HUD blade.
4. **Verification**:
   - Unit tests verifying 100% lossless round-trip encoding/decoding of complex presets inside PNG images.
```
