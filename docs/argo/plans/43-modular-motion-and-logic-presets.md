# PLAN 43 // RECURSIVE PRESETS INSIDE PRESETS: MOTION, SPRITES, AUDIO & CODE LOGIC
> **Status**: Active Specification (`@hm/kinematic/modular-motion` + On-Foot Jump Shipped)  
> **Packages**: `@hm/kinematic`, `@hm/anim`, `@hm/motion`, `@hm/triggers`, `@hm/wiregraph`, `@hm/npcbrain`, `@hm/worldrules`, `@hm/shareware`, `@hm/soundlab`, `@hm/kitspec`  
> **Core Principle ("Presets Inside Presets")**:  
> *"As long as it's presets inside presets you build from modular pieces—be it code or animations, or sprites, the list goes on and on—the game using those presets is then super modular in every aspect cos it's all generated."* (Owner, 2026-10-22)

---

## 0. THE UNIVERSAL RECURSIVE PRESET LADDER ("PRESETS INSIDE PRESETS")

Every system in *FIDELITY* is constructed as a **5-Rung Recursive Preset Tree**, where each rung is assembled from presets of the rung below it, serialized as a compact deterministic code, and editable via sliders in-game or full graphs in The Studio:

| Domain | Rung 1: Atomic Piece | Rung 2: Micro-Preset | Rung 3: Module Preset | Rung 4: Entity / Kit Preset | Rung 5: World / Game Preset |
|---|---|---|---|---|---|
| **Geometry (`Vtx`)** | Primitive + `@hm/meshops` op (`bevel`, `booleans`, `extrude`) | Parametric Part (`@hm/partgen`: `bolt`, `panel`, `wheel`, `hopper`) | Sub-Assembly (`bolted-hatch`, `bogie-pair`, `ram-head`) | Machine / Vehicle / Structure Kit (`@hm/kitspec`) | Base & Plot Scene (`@hm/scenedoc`) |
| **Surfaces & Sprites (`Pxd`)** | Periodic Node (`@hm/texgraph`: `cells`, `hex`, `weave`, `scratches`) | Procedural Tile Graph (`TILE_LIBRARY`) or Sprite Frame (`@hm/pixels`) | Surface / Mask / Weathering Layer or Sprite Flipbook (`@hm/shareware`) | 5-Level Material Stack (`@hm/matstack`) or Billboard Actor | Stage Look & Palette Bible (`@hm/fidelity`) |
| **Motion & Animation (`anim:` / `loc:`)** | Curve / Easing / Spring-Damper Atom (`@hm/keyframes`) | Bone / Socket Motion Track (`KitMotionSpec`: `spin`, `reciprocate`) | Pose / Action Clip (`@hm/anim` + `@hm/motion`: `walk`, `jump`, `swing`) | Character / Machine Animator + Locomotion Preset (`loc:`) | Stage-Quantized World Kinematics ($S_0\text{ 8Hz} \to S_6\text{ IK}$) |
| **Code & Logic (`logic:`)** | Sensor / Gate / Math Atom (`inside`, `press`, `and`, `delay`) | Reusable Logic Sub-Circuit (`proximity-latch`, `cooldown-pulse`) | Device / AI Behaviour Preset (`auto-door`, `turret-priority`, `@hm/npcbrain`) | Structure / Encounter Logic Graph (`@hm/triggers` + `@hm/wiregraph`) | Custom Game Rules & Campaign Chain (`@hm/worldrules` + `@hm/questline`) |
| **Light & Audio (`Lx` / `sfx:`)** | Kelvin / Osc / Filter Atom (`@hm/soundlab`, `light-presets.ts`) | Pulse Pattern / Synth Voice Preset (`beacon-rotary`, `coil-hum`) | Lamp Housing / Machine Stem Role (`@hm/musicbox`) | Kit Lighting Rig & 5-Chord Harmonic Choir | Planetary Sky, Aurora & Soundscape (`@hm/sky` + `@hm/soundscape`) |
| **Flora & Biomes (`Aq`)** | Branch / Leaf / Hydro Atom (`@hm/treegen`, `@hm/hydro`) | Organ / Foliage Cluster Preset | Species Variant Preset (`spc:`) | 6-Slot Biome Flora Palette | Moon / Restored Earth `PlotBiomePreset` (`@hm/plotbiome`) |

---

## 1. THE THREE BEHAVIOURAL PRESET FACTORIES

Just as visual assets are built from `part:`, `matc:`, `lx:`, and `spc:` presets, every movement, animation, and logical rule in the game is driven by three deterministic preset families that already have pure engines in `packages/`:

| Domain | Preset Prefix | Pure Engine Packages | In-Game Controls (Lab / Drafting Sliders + 3D Preview) | In-Studio Controls (Full Graph / Track Editor) |
|---|---|---|---|---|
| **1. Locomotion & Physics** | `loc:` | `@hm/kinematic`, `@hm/physics`, `@hm/rover` | Walk/Sprint Speed, Jump Impulse, Gravity (`1.0G` Earth / `0.65G` Suit Ballast / `0.25G` Low-G), Air Control, Step-Up, Landing Spring | Full capsule collider, friction/restitution curves, per-zone gravity overrides, vehicle suspension curves |
| **2. Procedural & Skeletal Animation** | `anim:` | `@hm/anim`, `@hm/motion`, `@hm/puppet`, `@hm/ragdoll` | Cadence (`Hz`), Limb Swing, Bob, Lean, Twist, Machine Stroke Rate & Amplitude (`KitMotionSpec`) | Full keyframe `Track` & `Clip` editor, `StateMachine` crossfades, Two-Bone IK sockets, Ragdoll joint limits |
| **3. Game Logic & AI Behaviour** | `logic:` | `@hm/triggers`, `@hm/wiregraph`, `@hm/npcbrain`, `@hm/worldrules` | Auto-Door Radius & Access Mode, Turret Target Priority & Range, Monster Aggro/Patrol/Flee, Dig/Water Rules | Full node-and-wire DAG editor (`inside`/`enter`/`press`/`timer` $\to$ `and`/`delay`/`gate` $\to$ `action`) |

---

## 2. HOW ANIMATION & MOTION UPGRADE ACROSS FIDELITY STAGES ($S_0 \to S_6$)

Motion and animation are not static across the campaign—they physically upgrade alongside visual resolution (`stageAnimRateHz(stage)` and `quantizeStageTime(t, stage)` in [`packages/kinematic/src/modular-motion.ts`](../../../packages/kinematic/src/modular-motion.ts)):

| Fidelity Stage | Era / Capture Medium | Animation & Motion Fidelity (`stageAnimRateHz`) | Locomotion & Secondary Physics Feel |
|---|---|---|---|
| **Stage 0a / 0b** | Vector Wireframe / 1-Bit Dither | **8 Hz stepped pose holds** (stop-motion / vector arcade cadence; zero sub-frame interpolation) | Crisp discrete trajectory; rigid geometric posture |
| **Stage 1** | 16-Colour EGA | **12 Hz shareware flipbook stepping** | Classic shareware movement + discrete jump arc |
| **Stage 2** | 256-Colour VGA | **18 Hz Quake-era vertex-keyframe cadence** | Air-control strafing + linear pose blending |
| **Stage 3** | Gouraud Shaded | **30 Hz console skeletal blending** | Smooth locomotion crossfades + basic landing bob |
| **Stage 4–6** | Full PBR + Suit-Cam | **Unquantized 60–144 Hz continuous skeletal blending** | **Two-Bone Hand/Foot IK** + **Critically-Damped Spring-Damper** landing knee-dip (`landingDip`), weapon inertia sway, and ragdoll physics |

---

## 3. DECLARATIVE KIT MOTION (`KitMotionSpec` ON `@hm/kitspec` SOCKETS)

Previously, machine animations (`press` rams, `projector` head tilt, `drill` bit rotation, `fabricator` gantry carriage) were hardcoded `Math.sin(...)` closures inside [`apps/web/src/play/machine-props.ts`](../../../apps/web/src/play/machine-props.ts).

Under **Plan 43**:
- Any part or socket in a `@hm/kitspec` `Kit` can declare a serializable `KitMotionSpec`:
  ```ts
  export interface KitMotionSpec {
    readonly kind: 'reciprocate' | 'spin' | 'oscillate' | 'gantry-slide' | 'iris-aperture';
    readonly axis: 'x' | 'y' | 'z';
    readonly rateHz: number;
    readonly amplitude: number;
    readonly phaseRad?: number;
  }
  ```
- `evaluateKitMotion(spec, timeSec, running, stage)` evaluates the offset purely and deterministically, automatically quantizing time at low stages ($S_0 \to S_3$) and running smoothly at $S_4 \to S_6$.
- Players can tweak machine stroke speed/amplitude via sliders or in the Studio's **Animate** workspace without touching code.

---

## 4. MODULAR LOGIC & BEHAVIOUR GRAPHS (`@hm/triggers` + `@hm/wiregraph`)

Every interactive structure on the player's Moon Plot or Stage-6 Earth Plot (Doors, Airlocks, Perimeter Turrets, Relay Beacons, Stargate Iris, Monster Spawners) is backed by a **`LogicPreset`** compiled to `@hm/triggers` (`LogicGraph`):
- **In-Game (Sliders + Behaviour Cartridges)**:
  - **Auto-Door Preset**: `Trigger Radius (1..8 m)`, `Close Delay (0.5..10 s)`, `Access ('owner' | 'coop' | 'all')`.
  - **Perimeter Turret Preset**: `Target Priority ('closest' | 'sappers' | 'flyers')`, `Engagement Range (10..35 m)`, `Burst Cadence`.
  - **Stargate Iris Preset**: `Access ('open' | 'code-only' | 'closed')`, `Auto-Close on Threat`.
- **In-Studio (`@hm/triggers` + `@hm/wiregraph` Workspace)**:
  - Players and external AI agents (`window.studioAgent`) can inspect and rewire the underlying DAG (`Sensor Node` $\to$ `Logic Gate / Delay / Toggle` $\to$ `Action Node`) to build custom puzzles, arena waves, and full custom games on their restored Earth Plot and Moon Plot.
