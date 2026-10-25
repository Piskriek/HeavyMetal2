# PLAN 44 // MODULAR SPORE CREATURE & AVATAR KITS (`@hm/creature`)
> **Status**: Approved by Argon (Creative Architect) on `30ddd8a6`  
> **Phase**: Phase 6 (Immediate Post-1.0 Execution)  
> **Target Packages**: `packages/creature` (`@hm/creature`), `packages/partgen`, `packages/kitspec`, `apps/web/src/avatar/astro/astro-model.ts`, `apps/web/src/monsters/roster.ts`  
> **Rule 8a Mandate**: Purge `astro-low.glb` (1.2 MiB) and all 37 external monster GLBs/sprites (~4.8 MiB). Rebuild the player suit avatar and all 37 roster creatures as pure 5-Rung declarative `CreatureKitSpec` assemblies.  

---

## 0. THE BIOLOGICAL PRESET LADDER ("PRESETS INSIDE PRESETS")

Every organism in `@hm/creature` (including the player's `ASTRO_SUIT_KIT` and all 37 monsters in `roster.ts`) is constructed as a **5-Rung Recursive Preset Tree** whose parts mount strictly onto the five canonical [`wheresryan22/anatomy`](https://github.com/wheresryan22/anatomy/blob/main/SKILL.md) groups declared in [`apps/web/src/play/kit-groups.ts`](../../apps/web/src/play/kit-groups.ts):

| Anatomy Group (`kit-groups.ts`) | Biological / Suit Counterpart | `@hm/partgen` Primitives & Socket Topology | Kinematic & Audit Role |
| :--- | :--- | :--- | :--- |
| **`base`** | **Pelvic Root & Sacral Hub** | Pelvic girdle, sacral keel, tail root socket, bilateral acetabular (hip) ball sockets. | Center of mass (`COM`), ground-clearance reference, root transform for `locomotion.ts`. |
| **`structure`** | **Vertebral Column (`Sushumna` Axis), Rib Cage & Cranium** | Multi-segment axial spine (`N = 2..12` vertebrae along spline/arc), thoracic carapace/rib shell, cervical neck ring, cranial housing, backpack life-support (`ASTRO_SUIT_KIT`). | Axial pitch/yaw/roll flex; carries pectoral (shoulder) sockets and dorsal/ventral armor plates. |
| **`mechanism`** | **Bilateral Articulated Limb Chains** | `femur`/`humerus` upper links, `tibia`/`ulna` lower links, digitigrade `tarsus` links, wing spars, or arachnid coxa-trochanter-femur chains (`0, 2, 4, 6, 8` limbs). | Driven by zero-allocation `solveTwoBoneIk()` (`two-bone-ik.ts`) + declarative gait phase oscillators (`KitMotionSpec` with **0 closures**). |
| **`controls`** | **Sensory & Telemetry Organs** | Compound/camera eyes, optic visors (`ASTRO_SUIT_KIT`), auditory horns, chemoreceptor antennae, bioluminescent threat nodes, Beam Rifle neural receptors. | Targetable weakpoints in `kit-target.ts`; head/eye look-at tracking toward reticle/player. |
| **`subject`** | **End-Effectors & Primary Weapons** | Opposable manipulator hands (holding the Beam Rifle), raptorial talons, fossorial digging claws, venomous chelicerae, crushing mandibles, tail stingers. | Primary action/attack effectors; carries high-contrast hero material (`@hm/matstack`) and strike AABB. |

---

## 1. DECLARATIVE `CreatureGenomeSpec` SCHEMA (ZERO CLOSURES)

```typescript
export interface CreatureSpineSegmentSpec {
  readonly id: string;
  readonly length: number;       // Axial length (m)
  readonly radiusX: number;      // Lateral half-width (m)
  readonly radiusY: number;      // Dorsal-ventral half-height (m)
  readonly pitchRestDeg: number; // Natural spinal curve angle
  readonly matPresetId: string;  // Rung 4 @hm/matstack preset
}

export interface CreatureLimbChainSpec {
  readonly id: string;
  readonly parentSegmentId: string; // 'pelvis' or spine segment ID
  readonly symmetry: 'bilateral' | 'medial';
  readonly mountOffset: readonly [number, number, number];
  readonly upperLength: number;     // L1 for solveTwoBoneIk()
  readonly lowerLength: number;     // L2 for solveTwoBoneIk()
  readonly kneeBendDir: readonly [number, number, number]; // Pole vector hint
  readonly gaitPhaseOffset: number; // [0..1) phase offset in gait cycle (biped=0/0.5, quadruped=0/0.5/0.25/0.75, hexapod=alternating tripod)
  readonly stepHeight: number;
  readonly strideLength: number;
  readonly effectorKind: 'boot' | 'hoof' | 'talon' | 'hand' | 'pincer' | 'thruster';
}

export interface CreatureGenomeSpec {
  readonly id: string;
  readonly archetype: 'biped-astro' | 'theropod' | 'quadruped' | 'hexapod' | 'arachnid' | 'serpentine' | 'avian-drone';
  readonly seed: number;
  readonly pelvis: {
    readonly restHeight: number;
    readonly radius: readonly [number, number, number];
    readonly matPresetId: string;
  };
  readonly spine: readonly CreatureSpineSegmentSpec[];
  readonly limbs: readonly CreatureLimbChainSpec[];
  readonly sensoryControls: readonly KitSocketPartSpec[];
  readonly subjectEffectors: readonly KitSocketPartSpec[];
  readonly skinPaletteId: string; // @hm/skin OKLab + Bayer dither binding
  readonly voiceStemId: string;   // @hm/soundlab vocal/footstep synth stem
}
```

---

## 2. COAXIAL KNUCKLE ARTICULATION WITHOUT CPU VERTEX SKINNING

Following the [`wheresryan22/anatomy` 3D runtime rule](https://github.com/wheresryan22/anatomy/blob/main/SKILL.md):
- Every limb segment (`upper`, `lower`, `effector`) and spinal segment is a rigid `@hm/partgen` parametric primitive parented to a socket `THREE.Group` or `THREE.Bone`.
- Joints are capped by coaxial spherical and cylindrical knuckles (`G.sphereOf` and coaxial knuckle discs). Because the spherical knuckle centers match the pivot axis, joints rotate across their full biological range of motion without mesh pinching, visible gaps, or vertex-weight buffer uploads.
- **Zero Software Skinning Overhead**: Transforms compose strictly via scene-graph matrices. On the GPU, `@hm/matstack` shaders run completely unmodified.
- **Micro-Second Beam Targetability**: Because every link and organ is a distinct placed part in the kit hierarchy, every individual limb, visor, horn, or claw can be targeted and hit by the Beam Rifle's `kit-target.ts` slab test in $< 0.05\text{ ms}$.

---

## 3. ZERO-ALLOCATION ANALYTICAL IK & 3-TIER DISTANCE LOD (`GTX 950M LOW` BUDGET)

1. **Reusing `solveTwoBoneIk()` (`apps/web/src/avatar/two-bone-ik.ts`)**:
   - Foot placement and arm reach evaluate via our existing pure Law-of-Cosines solver (`< 0.002 ms` per limb, 0 heap allocations using module-static scratch vectors).
   - **Gait Swing/Stance Curve**: For normalized gait phase $\phi = (\text{simTime} \cdot \text{strideFreq} + \text{gaitPhaseOffset}) \bmod 1$:
     - **Stance ($\phi \in [0, 1 - s_{\text{duty}})$)**: Foot locks to world ground target $(x_{\text{foot}}, y_{\text{foot}}, z_{\text{terrain}})$ while pelvis advances.
     - **Swing ($\phi \in [1 - s_{\text{duty}}, 1)$)**: Foot interpolates along a cycloid arc of height $h_{\text{step}} \cdot \sin(\pi \cdot u)$ to the next deterministic foothold.
2. **3-Tier LOD Schedule**:
   - **Tier 0 (`dist < 15m` — Near / Player / Active Combat)**: Full 60 Hz `solveTwoBoneIk()` per limb with exact terrain/platform height snapping and head/visor `controls` tracking.
   - **Tier 1 (`15m <= dist < 50m` — Midground Roster)**: Evaluated at `stageAnimRateHz` (`12–30 Hz`) against the pure analytical terrain heightfield $z = f(x, y)$ (**0 raycasts**).
   - **Tier 2 (`dist >= 50m` — Far Horizon / Crowd)**: Limb sub-assemblies sleep (`matrixAutoUpdate = false`) or switch to the `@hm/shareware` 8-angle OKLab/Bayer billboard baked directly from the creature's own `CreatureGenomeSpec` at load time.

---

## 4. REPLACING `astro-low.glb` & THE 37 ROSTER MONSTERS

- **Player Avatar (`apps/web/src/avatar/astro/astro-model.ts`)**:
  - Replace `astro-low.glb` (1.2 MiB) with `ASTRO_SUIT_CREATURE_KIT`: a 38-part articulated astronaut suit (`base`: pelvic thrust belt; `structure`: torso pressure hull + PLSS life-support pack + helmet dome; `mechanism`: 2 legs + 2 arms driven by `two-bone-ik.ts`; `controls`: gold-coated helmet visor + chest telemetry unit; `subject`: articulated gloves holding the Beam Rifle).
  - Because `ASTRO_SUIT_CREATURE_KIT` is a standard 5-Rung kit, the player can now fire `@hm/matstack`, `@hm/skin`, or `@hm/partgen` cartridges at their own suit on the Studio turntable!
- **Monster Roster (`apps/web/src/monsters/roster.ts`)**:
  - Replace all 37 borrowed Quaternius/LibreQuake/Freedoom static models (~4.8 MiB) with 37 deterministic `CreatureGenomeSpec` presets spanning the 7 archetypes (`biped`, `theropod`, `quadruped`, `hexapod`, `arachnid`, `serpentine`, `avian-drone`).
- **Bundle Diet Calculation**:
  - Binary GLB/sprite purge: **-6.0 MiB**.
  - Minified procedural `@hm/creature` code: **+85 KiB** (+25 KiB gzipped).
  - **Net bundle savings: > 5.5 MiB reduction** (dropping `apps/web/dist/index.html` from ~14.8 MiB to ~9.3 MiB).

---

## 5. MANDATORY AUDIT GATE (`studio.kit.audit`)

In strict accordance with Rule 8a and the `wheresryan22/anatomy` standard, every generated creature kit must pass:
1. `looseEnds === 0`: Every vertebral segment, limb joint, and sensory socket connects flush to its parent socket within $0.25\text{ mm}$ tolerance.
2. `solidClearances === 0`: Zero solid interpenetration between overlapping part pairs at rest, exploded, and across all 8 gait motion phases ($t \in [0, 1]$).
3. `terminals === 0`: All conduit and nerve endings terminate flush on valid hubs or sockets.
4. `hingeBendRadius`: Joint rotations stay strictly within declared limits ($\theta \le \theta_{\max}$).
5. `orbitClearance24 === true`: Clean visual silhouette from 24 sampled turntable angles.

---

## 6. PART A — IMPLEMENTED (JOB-24)

`packages/creature` (`@hm/creature`) exists and every archetype passes the audit gate. What landed:

| Piece | Where | Note |
| :--- | :--- | :--- |
| Genome schema | `packages/creature/src/creature-spec.ts` | `CreatureGenomeSpec`, `CreatureSpineSegmentSpec`, `CreatureLimbChainSpec` (+ `CreaturePelvisSpec`, `KitSocketPartSpec`, `CreatureLimbRole`); pure quat/vector math, no three.js. |
| Skeleton | `packages/creature/src/creature-skeleton.ts` | Genome → resolved joint frames (`spine`, `limbs`, `sacrum`, `groundY`). Clamps `strideLength`/`stepHeight` to each chain's own reach, so no genome asks for a step it cannot take. |
| Assembly | `packages/creature/src/creature-assembly.ts` | `buildCreatureKit()` / `creatureAssembly()` → a `@hm/kitspec` `Kit` of the five canonical groups, coaxial knuckle at every pivot, declared sockets, deterministic settle. No vertex weights, no CPU skinning. |
| Gait | `packages/creature/src/creature-gait.ts` | `evaluateCreatureGait(genome, simTime, strideVelocity, options)` → `CreatureGait`, solved by `apps/web/src/avatar/two-bone-ik.ts`; 3-tier LOD (`<15 m` 60 Hz exact ground, `15–50 m` stage cadence 12–30 Hz on the pure heightfield with **0 raycasts**, `>=50 m` asleep). A pelvis crouch keeps every stance foot inside its reach. |
| Presets | `packages/creature/src/creature-presets.ts` | `ASTRO_SUIT_GENOME` (45 parts), `THEROPOD_GENOME` (44), `QUADRUPED_GENOME` (44), `HEXAPOD_GENOME` (58); every foot planted on `y = 0`. |
| Gate | `packages/creature/tests/creature-assembly.test.ts`, `creature-gait.test.ts` | `kitAudit(kit, { phases: 8 })` → `looseEnds === 0`, `solidClearances.length === 0`, `terminals === 0` for all four archetypes; knuckle centres equal the resolved joint; kits are pure functions of the genome. |

The player's suit (`apps/web/src/avatar/astro/astro-model.ts`) is now `ASTRO_SUIT_CREATURE_KIT`:

- `astro-low.glb` (and the HD pack) are **deleted**; `scripts/pack-character.mjs` is retired and
  `scripts/retarget-astro.ts` now retargets the rifle set against `apps/web/src/avatar/astro/mixamo-rig.ts`, the Mixamo
  rest skeleton kept as a 28-row data table (bones are a rig, not an asset).
- `buildAstroSuit(level)` builds the genome's parts into the bone frame of the one Mixamo bone each part binds
  (`creaturePartBones()`), one mesh per (part, material), each carrying `userData.astroPartPath`. The animator, the rifle
  mount (`mixamorigRightHand`) and the lab's lean (`mixamorigSpine`) are unchanged, and nothing is skinned.
- `astroSuitBuildFor(group)` wraps the live player instance as a `KitBuild`, registered in the lab as the `astro-suit` kit
  (`room.registerKit`), so `aimKitPart()` reaches the player's own visor, thruster belt and gloves — on the plot too —
  and part cartridges land on the suit exactly as on any machine.
- `/suit.html` (`apps/web/src/dev/suit.ts`): the Studio turntable view of the suit, with the live audit readout and every
  placed part listed by group and highlighted on hover.

**Out of scope for Part A (Part B):** the 37 roster monsters in `apps/web/src/monsters/roster.ts` still use their packed
assets; only the four genome presets above are compiled by the gate.
