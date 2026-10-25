# PLAN 46 // CROSS-GAME MULTIVERSE STREAMING & THE UNIVERSAL ENTITY TRANSCEIVER (`JOB-21`)
> **Status**: Approved & Authored by Argon (Creative Architect)  
> **Milestone**: M5 / v1.0 Feature Complete Sprint (`JOB-21`)  
> **Target Modules**: `apps/web/src/play/cross-game-stream.ts`, `apps/web/src/play/cross-game-buffer.ts`, `apps/web/src/play/kit-target.ts`, `packages/kitspec`, `packages/creature`, `packages/matstack`, `packages/wiregraph`  
> **Rule 8a Mandate**: Zero binary `.glb` meshes or imperative scripts across worlds; pure declarative recipes (`< 4 KiB` JSON / `< 900 B` `fflate` compressed) that reconstruct and adapt deterministically locally in `< 12 ms`.  

---

## 0. THE PARADIGM SHIFT: WHY "MONSTER MASH" IS CROSS-GAME STREAMING

With Wave 4 merged on `feat/monster-mash-exploration`, every machine (`JOB-08`), vehicle (`JOB-08v`), Stargate assembly (`JOB-07`/`08b`), material stack (`@hm/matstack`), kinematic gait (`@hm/kinematic`), and biological creature (`@hm/creature` / Plans 44 & 45) in *FIDELITY* is a **100% declarative, closure-free 5-Rung specification**.

We do **not** import static third-party meshes. Instead, **any entity created in any user-authored game world can stream live across Stargates or via the player's Beam Rifle into any other user-created game world—automatically adapting its locomotion, colliders, wiregraph ports, and utility AI (`@hm/npcbrain`) to the destination game's genre rules.**

---

## 1. THE `CrossGameEntityPacket` STANDARD (`hm2:entity-packet:v1`)

A `CrossGameEntityPacket` is a self-contained, deterministic, zero-closure Rung 5 wire envelope (`< 4 KiB` JSON, `< 900 B` `fflate` compressed) capturing the complete anatomical, visual, kinematic, acoustic, and cognitive identity of any entity (whether an 8-legged arachnid crawler, a 6x6 `HAULER_KIT` truck, an automated crusher rig, or a custom player suit):

```typescript
export type EntityDomainKind = 'creature' | 'vehicle' | 'machine' | 'prop-assembly';

export interface EntityCapabilityVector {
  readonly massKg: number;                // Derived deterministically from @hm/partgen bounding volumes
  readonly baseTopSpeedMps: number;       // Natural locomotion/wheel/stride top speed (m/s)
  readonly powerOutputKw: number;         // Wiregraph power generation/consumption rating
  readonly structuralIntegrityHp: number; // Derived from 'base' + 'structure' volume & matstack metalness
  readonly cargoCapacitySlots: number;    // Derived from 'subject' hopper/bed volume
  readonly combatThreatRating: number;    // Derived from 'subject' effector sharpness/mandibles/turrets
  readonly locomotionMode: 'legged-ik' | 'wheeled-axle' | 'tracked-sponson' | 'hover-thruster' | 'stationary-plinth';
}

export interface NpcUtilityBrainSpec {
  readonly archetype: 'predator' | 'herbivore-grazer' | 'hauler-drone' | 'patrol-scout' | 'racer-pilot' | 'turret-sentinel';
  readonly weights: {
    readonly seekTarget: number;          // [0..1] Drive toward goal/waypoint/prey
    readonly avoidHazard: number;         // [0..1] Repulsion from cliffs, lava, obstacles, or Beam fire
    readonly preserveEnergy: number;      // [0..1] Return to power conduit / grazing node when low
    readonly packCohesion: number;        // [0..1] Boids alignment/separation with same-seed peers
    readonly aggressionOrOvertake: number;// [0..1] Combat strike urge (Arena) OR slipstream overtake urge (Racing)
  };
  readonly perceptionRadiusM: number;     // Scaled by 'controls' sensory organ count/size
  readonly reactionRateHz: number;        // Aligned with stageAnimRateHz (8..60 Hz)
}

export interface CrossGameEntityPacket {
  readonly schema: 'hm2:entity-packet:v1';
  readonly packetId: string;              // Deterministic SHA-256 / FNV-1a content hash of canonical payload
  readonly originWorld: {
    readonly worldSeed: number;
    readonly gamePresetId: string;        // e.g. 'game:mining-survival', 'game:circuit-rally', 'game:factory-defense'
    readonly authorTag: string;
    readonly mintedAtSimTick: number;
  };
  readonly domain: EntityDomainKind;
  readonly anatomySpec: {
    // 100% 5-Group Anatomy ('base' | 'structure' | 'mechanism' | 'controls' | 'subject')
    readonly kitSpec?: KitSpec;                    // For machines/vehicles (@hm/kitspec)
    readonly creatureGenome?: CreatureGenomeSpec;  // For organisms/avatars (@hm/creature)
  };
  readonly appearanceSpec: {
    readonly matstackOverrides: Readonly<Record<string, MaterialSpec>>; // Per-group or per-part Rung 4 matstacks
    readonly skinPaletteId: string;                                      // @hm/skin OKLab + Bayer dither preset
  };
  readonly kinematicsSpec: {
    readonly motionSpec?: KitMotionSpec;                 // Closure-free @hm/kinematic oscillator/hinge spec
    readonly ikChains?: readonly CreatureLimbChainSpec[];// Analytical Law-of-Cosines two-bone IK chains
  };
  readonly audioSpec: {
    readonly voiceOrEngineStemId: string;               // @hm/soundlab / @hm/musicbox synth patch
  };
  readonly brainSpec: NpcUtilityBrainSpec;              // @hm/npcbrain declarative utility weights
  readonly capabilities: EntityCapabilityVector;        // Pre-computed physical invariants (verified on import)
  readonly auditSignature: {
    readonly looseEnds: 0;
    readonly collisionFaults: 0;
    readonly convexEdgeMetalMin: number;                // Must be >= 0.45 per Rule 8a
  };
}
```

### Ingestion Anti-Cheat & Audit Guarantee:
Upon receiving a `CrossGameEntityPacket`:
1. The receiving world re-derives `computeCapabilitiesFromAnatomy(packet.anatomySpec)` directly from `@hm/partgen` bounding volumes.
2. The packet runs through `studio.kit.audit` to confirm `looseEnds === 0` and `collisionFaults === 0`.
3. Any tampered or out-of-spec packet is rejected with a structured refusal payload without mutating world state.

---

## 2. CROSS-GENRE ADAPTATION RULES (`adaptPacketToGamePreset`)

When an entity created in **Game A** steps through an active Stargate (`moveGate`) or is materialized via the Beam Rifle inside **Game B** (`MultiverseGamePresetSpec`), a pure stateless adapter `adaptEntityToGenre(packet, destGamePreset)` maps its attributes into the destination world:

| Source Entity Aspect | Survival / Mining (`exploration-o2`) | Circuit Racing (`race-lap-telemetry`) | Factory Logistics (`sandbox-freeplay`) | Arena Wave Combat (`arena-wave-survivor`) |
| :--- | :--- | :--- | :--- | :--- |
| **Locomotion & Speed Scaling (`base` + `mechanism`)** | Uses raw `baseTopSpeedMps` modulated by terrain slope and `gravityScale`. Legged IK (`solveTwoBoneIk`) snaps feet to terrain; wheels use torque traction. | Normalizes `baseTopSpeedMps` into a balanced **Class Tier (`Light / Heavy / Open`)**: $v_{\text{race}} = v_{\text{class}} \cdot (0.85 + 0.30 \cdot \text{norm}(v_{\text{raw}}))$. Legged creatures run at high-cadence sprint cycles along the track spline! | Locks movement to factory lane splines or dock-to-dock waypoints at deterministic throughput speed ($v = \min(v_{\text{raw}}, 8.0\text{ m/s})$) to prevent conveyor desync. | Uses raw `baseTopSpeedMps` with burst dodge impulses derived from `mechanism` limb/wheel count. |
| **Utility Brain Remapping (`@hm/npcbrain`)** | `seekTarget` $\to$ ore veins / biomass;<br>`avoidHazard` $\to$ anoxic pits & radiation;<br>`aggressionOrOvertake` $\to$ territorial defense. | `seekTarget` $\to$ next checkpoint gate spline;<br>`avoidHazard` $\to$ track walls & oil slicks;<br>`aggressionOrOvertake` $\to$ **slipstream drafting & apex overtaking**! | `seekTarget` $\to$ highest-priority unfilled storage hopper;<br>`preserveEnergy` $\to$ auto-dock at wiregraph charging plinths;<br>`aggressionOrOvertake` $\to$ `0` (cooperative right-of-way). | `seekTarget` $\to$ player / Stargate plinth;<br>`avoidHazard` $\to$ player Beam Rifle line-of-sight;<br>`aggressionOrOvertake` $\to$ flank & melee strike frequency. |
| **5-Group Collider & Socket Mapping (`kit-target.ts`)** | `base`/`structure` = hull armor;<br>`controls` = sensory blinding weakpoint;<br>`subject` = mining drill / harvesting claw (yields ore/biomass on strike). | Sweeps non-lethal **Chassis Bumper OBB** around `base` + `structure` for rub-racing; `subject` effectors clear track hazards or hit boost pads. | Exposes `controls` and `base` wiregraph ports as live **I/O Logistics Nodes**—mandibles or truck beds automatically ferry cartridges and ore between machines. | Full 2-level `Build AABB -> Mesh AABB` weakpoint damage: hitting `mechanism` limbs cuts speed by $50\%$; hitting `controls` scrambles `@hm/npcbrain` targeting. |

### Immutability & Zero Generational Drift:
The source `CrossGameEntityPacket` is **immutable**. `adaptEntityToGenre()` outputs an ephemeral `AdaptedEntityRuntimeConfig`. Returning to Game A or stepping into Game C re-derives state from the canonical genome with **zero generational corruption**.

---

## 3. THE BEAM RIFLE CROSS-GAME BUFFER (`Sample` $\leftrightarrow$ `Apply`)

The Beam Rifle acts as the universal entity transceiver:

```text
[ WORLD A ]                                             [ 12-SLOT CROSS-GAME DECK ]                           [ WORLD B ]
Target Entity (Machine / Vehicle / Creature)            Persistent Buffer + PNG Spore Card                    Reticle Aim
      │                                                              │                                             │
      ├── 1. Fire Beam Rifle (Hold SAMPLE 0.35s) ───────────────────►├── 2. Mint & Verify CrossGameEntityPacket    │
      │   • kit-target.ts resolves root Build AABB (<0.05ms)         │   • Store in deck + export PNG              │
      │   • Holographic scan sweep (uSampleEnvelope 0 -> 1)          │                                             │
      │                                                              └── 3. Switch World (Stargate / URL) ────────►├── 4. Fire Beam Rifle (APPLY)
                                                                                                                   │   • adaptEntityToGenre()
                                                                                                                   │   • Materialize in World B!
```

1. **Tap vs. Hold `Sample` in `kit-target.ts`**:
   - **Tap Fire**: Samples sub-part material preset (Rung 4) or `KitMotionSpec` (Rung 3) into component cartridges.
   - **Hold Fire (`0.35s` lock-on)**: Elevates hit from `Mesh AABB` to root `Build AABB`, extracting the complete 5-Group `CrossGameEntityPacket`.
2. **Persistent Storage**:
   - Stored in `localStorage` under `hm2:cross-game-buffer:v1` and synchronized into World v5 save blocks.
   - Holds up to 12 quick-select entity cartridges on the radial wheel.
3. **Materialization via `Apply`**:
   - Verifies surface OBB clearance via `solidClearances`.
   - Materializes the entity and enables instant `Interact` mount/pilot possession under World B's camera and HUD blade.
