# 17 — VFX, Particles & Game Feel ("Juice") Plan: Making Every Interaction Tactile

## 1. The Goal: Turn Functional State Changes into Visceral Physical Actions

As highlighted in [`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, **placing, mining, printing, and killing currently lack the feedback (VFX, camera response, animations, shader pulses) that makes them fun**. We already have [`packages/particles/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/particles), [`packages/plume/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume), [`packages/juice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/juice), and [`packages/tooljuice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice) in the monorepo! Our goal is to wire those pure packages directly into the 6 core player interactions so every action has an **Anticipation $	o$ Impact $	o$ Aftermath** arc that runs within a strict instanced GPU particle budget on the GTX 950M.

## 2. Where It Stands Today

- **What Exists:**
  - [`packages/plume/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume) renders the rising square pixel plumes above running field machines ([`08-first-machine.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg)).
  - [`packages/beamkit/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/beamkit), [`packages/juice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/juice), [`packages/tooljuice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice), and [`packages/particles/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/particles) provide pure math for recoil springs, screen shake trauma, and particle emitters.
  - `TASK-23c` adds a dissolve effect when holding `E` on lab clutter props.
- **What Is Weak or Missing:**
  - **Juice Packages Are Under-Wired in `apps/web/src/play/`:** Mining dirt or boulders, placing foundations/machines, fabricating cartridges, and shooting monsters happen with minimal viewmodel recoil, no impact debris fountains, and no wireframe-to-solid materialization sweep.
  - **In vs. Out Plume Rule Needs Strict Enforcement:** Per [`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) and [`docs/concept/setmix/README.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/README.md), raw dark material must visibly drop into the **feed hopper**, while crisp square pixels (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`, `#b46bff`) pour exclusively out of the **separate rear/top exhaust stack**.
  - **Flat Gate Crossing:** Walking through the Gate between the Earth Lab and the Moon has no threshold screen-edge shimmer or gravity-shift camera dip (`9.81 m/s²` $	o$ `1.62 m/s²`).

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Game Feel / VFX Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) & [***Satisfactory 1.0***](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Bottom-Up Wireframe Print Sweep + Mass Settle Bounce:** When a structure or machine is placed, a bright emissive scan-plane sweeps from base to roof over `0.6–1.2 s`, followed by a `4 cm` vertical spring settle and dust ring at the feet ([Subnautica Habitat Builder](https://store.steampowered.com/app/264710/Subnautica/)). | Makes placing a `Texture Mill` or `Foundation` feel like materializing heavy industrial hardware rather than toggling `mesh.visible = true`. |
| [***Astroneer***](https://astroneer.fandom.com/wiki/Terrain_Tool) & [***Deep Rock Galactic***](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) | **Spiral Vacuum Stream Along the Mining Beam:** When excavating terrain, detached voxel chunks spiral along a Bezier curve directly from the impact crater into the tool barrel while the nozzle vibrates with micro-trauma ([Astroneer Terrain Tool Wiki](https://astroneer.fandom.com/wiki/Terrain_Tool)). | Visually connects terrain deformation (`@hm/terrainbrush`) to the player's inventory counter ticking up. |
| [***Prodeus***](https://store.steampowered.com/app/964800/Prodeus/) | **Pixel-Cube Hit Bursts & Muzzle Flash Lighting:** Hitting a retro enemy erupts a burst of stage-quantized voxel cubes that bounce once on the ground and dissolve, paired with a `40 ms` hit-flash and punchy viewmodel kickback ([Prodeus Store](https://store.steampowered.com/app/964800/Prodeus/)). | Unifies 2D sprites and 3D monster meshes in `TASK-23b` so every shot feels meaty and consistent with the simulation lore. |

## 4. Concrete Changes Ranked P0, P1, and P2

### The 6 Core Interaction Juice Recipes (`@hm/juice` + `@hm/tooljuice` + `@hm/particles`)

| Player Action | Anticipation (0–150 ms) | Impact / Active Loop | Aftermath (150–800 ms) |
| :--- | :--- | :--- | :--- |
| **1. Beam Extract (Mining Dirt / Boulders)** | Barrel coils spin up (`#ff3d8a`/`#3dc8ff`), viewmodel pulls back `1.5 cm`. | Laser core + helical ring shader (`@hm/beamkit`); dark voxel chunks spiral from ground crater into rifle muzzle (`12 chunks/sec`); `0.08` micro-shake trauma. | Glowing hot decal at beam contact point cools over `0.6 s`; inventory counter pops `1.25x` scale on each `+1` tick. |
| **2. Beam Apply / Sculpt (Painting & Shaping)** | Mode LED on rifle spine flashes (`#ff3d8a` Apply / `#7cff4d` Sculpt). | Projected ground ring decal shows exact brush radius (`@hm/terrainbrush`) with marching grid lines; square pixels spray onto vertices as height/texture updates live. | Subtle dust/pixel settle puff along modified vertices. |
| **3. Placing a Structure or Machine** | Hologram ghost pulses between `0.35` and `0.55` alpha; snapping to a socket triggers a crisp `1.04x` scale snap-lock. | Bottom-to-top `#7cff4d` wireframe print plane sweeps across the mesh over `0.65 s` while 16 green square pixels rise from the corners. | Mesh drops `4 cm` with damped spring bounce (`@hm/juice`) and emits a radial regolith dust puff around its feet/plinth. |
| **4. Machine Feeding & Plume Exhaust** | Dark ore chunks tumble into the top/side feed hopper (`#1a1c20`, inert). | Internal status window glows; separate rear/top exhaust stack emits instanced square pixels (`@hm/plume`, `64–128` cubes/machine) drifting upward with curl-noise turbulence. | If a cartridge is slotted, an immediate ring burst of the cartridge's color shoots `8 m` up the plume stack. |
| **5. Salvaging Clutter / Sealing a Leak (`Hold E` / `Seal`)** | Radial progress ring fills around crosshair (`0.8 s`); target prop vibrates with increasing scanline slice offset. | Prop de-compiles top-down into 32 glowing voxel cubes that arc into the player's hip pack (`TASK-23c`). | Leaves a brief faded wireframe ghost silhouette on the floor for `0.4 s`. |
| **6. Firing Combat Weapons & Hitting Monsters** | Crisp `1-frame` muzzle flash + `8°` pitch recoil spring (`@hm/tooljuice`). | Hit target flashes pure white/amber for `45 ms`, plays `@hm/leaksim` `pain` flinch, and bursts 12 stage-quantized pixel cubes at the hit normal. | On `dead` phase, monster either collapses via `@hm/ragdoll` or shatters into a fountain of `Anomaly Core` shards that hover with a vertical loot beam. |

### P0 — Must Fix Before First Public Test

1. **P0-VFX-01: Wire `@hm/tooljuice` Recoil, Muzzle Stream, and Brush Ring Decal to the Beam Tool (`TASK-21c/d`)**
   - **What to build:** In [`apps/web/src/play/beam-tool.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts) and [`apps/web/src/play/beam-effect.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-effect.ts):
     - Render a projected ground ring decal at the raycast hit point showing the exact `Extract / Apply / Sculpt / Seal` brush radius, colored by active mode (`#3dc8ff`, `#ff3d8a`, `#7cff4d`, `#ffc13d`).
     - Spawn an instanced stream of 16 voxel chunks spiraling from the hit point into the rifle barrel during `Extract`, and drive the first-person rifle transform with the damped harmonic oscillator in [`packages/tooljuice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/tooljuice) (sway on mouse look, bob on walk, vibration when firing).
   - **Needs:** **Code** (`apps/web/src/play/beam-tool.ts`, `apps/web/src/play/beam-effect.ts`).

2. **P0-VFX-02: Add Bottom-Up Wireframe Print Sweep & Settle Bounce to All Placed Buildings and Machines**
   - **What to build:** In [`apps/web/src/base/view.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/base/view.ts), when a foundation, wall, or machine is placed, run a `0.65 s` vertex/fragment clip-plane sweep (`y_local` from `bbox.min.y` to `bbox.max.y`) with a bright `#7cff4d` leading edge and a damped vertical settle spring (`amplitude = 0.04 m`, `stiffness = 280`, `damping = 18`).
   - **Needs:** **Code** (`apps/web/src/base/view.ts`, `packages/juice/`).

### P1 — Makes It Feel AAA

3. **P1-VFX-03: Strictly Separate Inert Hopper Feed from Neon Exhaust Plume Sockets on All Field Machines (`12-sheet-field-machines.png`)**
   - **What to build:** Audit every machine socket in [`apps/web/src/crafter/world.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts) and [`packages/plume/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plume) against [`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png):
     - Define two distinct local transform sockets per machine: `feedHopperPos` (front/top tray where dark grey ore cubes drop downward) and `exhaustVentPos` (rear/top stack where bright `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff` / `#b46bff` square pixels drift upward).
     - When a machine is unpowered or out of ore, set plume emission rate to `0` immediately (Rule 10: *"A machine that is off spews nothing"*).
   - **Needs:** **Code** (`apps/web/src/crafter/world.ts`, `packages/plume/`).

4. **P1-VFX-04: Portal Threshold Shimmer & Gravity Transition Dip**
   - **What to build:** When the player's camera crosses the plane of the freestanding Gate (`Lab <-> Moon`), trigger a `250 ms` chromatic/dither edge vignette, a subtle vertical camera spring dip reflecting the `6x` gravity change (`9.81 m/s²` $\leftrightarrow$ `1.62 m/s²`), and a burst of 24 amber coil sparks around the doorframe reveal.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/juice/`).

### P2 — Stretch Goals

5. **P2-VFX-05: Stage-Reactive Footstep & Rover Tire Roost Particles**
   - **What to build:** Emit pooled instanced particles behind the player's boots and the Rover's rear tires (`@hm/kart`) that adapt to the local stage: 1-bit white/black square pixels in Stage 0, grey regolith dust puffs in Stage 1–2, water splashes (`#3dc8ff`) when driving through Stage 3 hydro puddles, and green grass/soil flecks in Stage 4 meadows.
   - **Needs:** **Code** (`packages/particles/`, `apps/web/src/crafter/world.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 10 (Believable machines, running machines spew colourful pixel plumes, off spews nothing):** Enforces separate `feedHopperPos` and `exhaustVentPos` sockets and zero emission when off.
- **Rule 20 (GTX 950M at 60 fps on Low):** All particle systems use a single pre-allocated `THREE.InstancedMesh` pool (`max = 2,048` instances globally on Low, `8,192` on High/Ultra) with zero per-frame garbage collection.

## 6. Owner Decisions Needed

1. **Screen-Shake Intensity Default:**
   - *Question:* When firing the Shotgun, mining boulders with the Beam Tool, or standing near the Gate when it ignites, should camera micro-shake trauma default to **Subtle (`35%` amplitude)** with a `0%–100%` slider in Settings for motion-sensitive players?
   - *Recommendation:* **Yes—default camera shake to Subtle (`35%`) with a `Camera Shake` slider in Settings.** Viewmodel spring recoil (`@hm/tooljuice`) carries 80% of the punch without ever making the horizon jittery.
