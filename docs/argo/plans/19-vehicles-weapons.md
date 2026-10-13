# 19 — Vehicles, Weapons & Modular Hardpoints Plan: Square-Section Heavy Metal Engineering

## 1. The Goal: Grounded, Modular Industrial Hardware That Feels Heavy and Responsive

Look at [`12-rover-driving.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg), [`13-beam-first-person-apply-paint.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg), and [`14-beam-third-person.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg) in [`docs/argo/TOUR.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md), alongside Concept Sheets [`19-sheet-vehicle-fabricator.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png) and [`20-sheet-weapons.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png):
- While driving the Rover ([`12-rover-driving.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg)), **the camera clips directly into terrain geometry**, and the modular scout chassis is waiting on final switch-on (`USE_MODULAR_SCOUT` in [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4).
- In third-person ([`14-beam-third-person.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)), **the Beam Rifle is tiny (`~40%` of proper scale)** and renders dark; in first-person ([`13-beam-first-person-apply-paint.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg)), the rifle lacks clear mode-color feedback.

Our goal is to make every vehicle (Scout Rover, Heavy Hauler) and weapon (Extraction Beam Rifle, Shareware Sidearms, Base Defense Turrets) obey the owner's **Square-Section & Empty-Cab Yoke Rules** (Rules 11, 12, 15, 16), eliminate camera clipping via a sphere-cast spring arm (`@hm/camerarig`), and deliver punchy, deterministic handling across `1.62 m/s²` lunar gravity.

## 2. Where It Stands Today

- **What Exists:**
  - [`packages/kart/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/kart), [`packages/racers/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/racers), and [`packages/camerarig/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/camerarig) implement Pacejka tire drift physics, spring-damper suspension, and 9-byte deterministic ghost replays.
  - [`apps/web/src/play/beam-tool.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts), [`packages/beamkit/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/beamkit), and [`packages/toolanims/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/toolanims) implement the 4-mode rifle (`Extract`, `Apply`, `Sculpt`, `Seal`) and 11 standing Mixamo rifle clips.
  - Concept Sheets [`19-sheet-vehicle-fabricator.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png) and [`20-sheet-weapons.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png) and packed models in [`apps/web/src/assets/gen/registry.json`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) include the modular scout, redone hauler body, `[-u-]` square yoke, and weapon models.
- **What Is Weak or Missing:**
  - **Rover Camera Terrain Clipping (`12-rover-driving.jpg`):** The vehicle camera uses a fixed offset or simple point raycast without terrain-height clamping or pitch horizon leveling, plunging underground whenever the rover crests a crater rim or drives near a boulder.
  - **Tiny Third-Person Rifle & Dark Viewmodel (`13-beam-first-person-apply-paint.jpg`, `14-beam-third-person.jpg`):** Hand-socket scale in `TASK-21c` needs a `1.65x` correction in third-person and emissive mode strips along the square barrel housing.
  - **Pending Modular Vehicle Switch-On (`RESUME.md` §5.4):** `USE_MODULAR_SCOUT` needs the aerial raycast onto the shell and the packed `[-u-]` yoke verified, plus `VEHICLE_FIT` re-checked for the redone hauler body.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Vehicle & Weapon Engineering Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Space Engineers***](https://steamcommunity.com/sharedfiles/filedetails/?id=1138675837) & [***Astroneer***](https://store.steampowered.com/app/361420/ASTRONEER/) | **Spring-Arm Sphere-Cast Camera + Utility Cargo Sockets:** Vehicle cameras cast a `r = 0.35 m` sphere from the chassis pivot to the camera target, sliding smoothly forward and pitching up when a slope rises behind the vehicle; rear beds feature standardized modular sockets for ore bins or drills ([Space Engineers Rover Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1138675837)). | Permanently cures the terrain clipping in [`12-rover-driving.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg) while making the Scout and Hauler true workhorses of the core loop. |
| [***Deep Rock Galactic***](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) & [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) | **Color-Coded Tool Viewmodels & Automated Perimeter Turrets:** Tools change their physical housing glow and reticle shape immediately when switching modes; base/engineer turrets track and suppress swarmers with a visible laser sightline so solo builders never feel overwhelmed while mining. | Directly informs our Beam Rifle mode coils and Sheet 20 ([`20-sheet-weapons.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png)) defense emplacements. |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-VEH-01: Fix Rover Camera Geometry Clipping via Sphere-Cast Spring Arm & Terrain Floor Clamp (`12-rover-driving.jpg` Fix)**
   - **What to build:** In [`packages/camerarig/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/camerarig) and the rover camera controller:
     1. Cast a ray/sphere (`radius = 0.35 m`) from the rover roof anchor (`pivot = chassisPos + (0, 1.4, 0)`) to the desired camera position (`distance = 5.5 m`, `height = +2.1 m`). If the ray hits terrain or a boulder at `d < 5.5 m`, pull the camera forward to `d - 0.35 m` with fast `25 ms` snap-in and smooth `250 ms` ease-out.
     2. Enforce a hard **Heightfield Floor Clamp**: `camera.position.y = Math.max(camera.position.y, sampleTerrainHeight(camera.position.x, camera.position.z) + 0.65)` so the camera lens can never dip below the lunar surface even during extreme crater jumps (`TASK-24` edge-case check).
     3. Decouple camera roll (`roll = 0°`) and damp pitch follow (`lag = 0.12 s`) so rocky micro-bumps do not shake the horizon.
   - **Needs:** **Code** (`packages/camerarig/`, `apps/web/src/play/`).

2. **P0-VEH-02: Fix Third-Person Beam Rifle Scale (`1.65x`) & First-Person Emissive Mode Strip (`13` & `14` Tour Fixes, `TASK-21c`)**
   - **What to build:** In [`apps/web/src/avatar/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/avatar) and [`apps/web/src/play/beam-tool.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/beam-tool.ts):
     - Scale the third-person attached Beam Rifle mesh by `1.65x` and align its rear grip and forend to the Mixamo right/left hand bone sockets (`RightHand`, `LeftHand` IK target) so it reads as a substantial two-handed industrial carbine rather than a tiny pistol ([`14-beam-third-person.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/14-beam-third-person.jpg)).
     - Add a square-section emissive rib along the top/side rail of the rifle that glows `#3dc8ff` in `Extract`, `#ff3d8a` in `Apply`, `#7cff4d` in `Sculpt`, and `#ffc13d` in `Seal` mode, giving instant visual confirmation in [`13-beam-first-person-apply-paint.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/13-beam-first-person-apply-paint.jpg).
   - **Needs:** **Code** (`apps/web/src/avatar/`, `apps/web/src/play/beam-tool.ts`).

3. **P0-VEH-03: Enable `USE_MODULAR_SCOUT` with Raycast Aerial, `[-u-]` Yoke & Hauler `VEHICLE_FIT` (`RESUME.md` §5.4)**
   - **What to build:** Complete the three vehicle items listed in [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §5.4:
     1. Raycast the modular scout's antenna/aerial socket onto the top rear shell so it sits flush with zero floating gap (Rule 10, Rule 16).
     2. Verify the packed square `[-u-]` steering yoke inside the empty cab (Rule 12) and flip `USE_MODULAR_SCOUT = true`.
     3. Re-run `VEHICLE_FIT` wheel-well and suspension travel bounds for the redone Heavy Hauler body.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/kart/`).

### P1 — Makes It Feel AAA

4. **P1-VEH-04: Vehicle Fabricator Bay & Rear Cargo Socket Integration (`19-sheet-vehicle-fabricator.png`)**
   - **What to build:** Wire the **Vehicle Fabricator** hardpoint pad ([`19-sheet-vehicle-fabricator.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/19-sheet-vehicle-fabricator.png)) so building a Scout Rover or Heavy Hauler plays a 3-second gantry assembly sequence. Give the Scout Rover 1 rear modular socket (holds a portable `Linked Ore Bin` or `Coherence Beacon`) and the Heavy Hauler 3 rear sockets (holds bulk ore or a mobile turret), turning vehicles into mobile extensions of the `@hm/lattice` network.
   - **Needs:** **Code** (`packages/kart/`, `packages/lattice/`, `apps/web/src/base/`).

5. **P1-VEH-05: Handheld & Emplaced Weapons from Sheet 20 (`20-sheet-weapons.png`)**
   - **What to build:** Alongside the Beam Rifle (Slot 1), wire two distinct kinetic/energy combat archetypes from [`20-sheet-weapons.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/20-sheet-weapons.png) and `@hm/shareware`:
     - **Handheld Pulse/Scatter Sidearm (Slot 2):** Square-section industrial receiver with round barrel (Rule 11), firing high-impact kinetic/pellet bursts for close-quarters `swarmer` and `charger` defense.
     - **Automated Perimeter Defense Turret (Buildable on Sheet 13 Corner/Roof Sockets):** Uses `15 kW` grid power to automatically target `sapper` and `swarmer` leaks within `35 m` with a visible `#ffc13d` targeting laser, letting builders focus on terraforming without constant manual babysitting.
   - **Needs:** **Code** (`apps/web/src/play/`, `apps/web/src/base/`), **Art** (already in Sheet 20 asset batch).

### P2 — Stretch Goals

6. **P2-VEH-06: Cartridge-Modded Weapon Hybrids (`Scatter Excavator` & `Color Spewer`)**
   - **What to build:** Allow slotting a fused Weapon+Tool cartridge (`V2_0_MASTER_PLAN.md` Act VIII) into the Beam Rifle to unlock wide-cone crater excavation or rapid terrain painting while driving the Rover.
   - **Needs:** **Code** (`packages/beamkit/`, `packages/assembler/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 10 (Nothing floats):** Aerial, wheels, suspension arms, and rear cargo bins snap to raycasted surface sockets.
- **Rule 11 (Square sections; round only for wheels, tyres, gun barrels):** All weapon receivers, turret housings, and rover roll-cages use square/rectangular box tubing; only wheels and barrels are round.
- **Rule 12 (No lettering, numbers or logos; empty cabs with square `[-u-]` yoke):** Strictly enforced across both Scout and Hauler cabs.
- **Rule 16 (Split hard parts into their own objects):** Yoke, wheels, aerial, and roof turret are separate meshes snapped at sockets in code.

## 6. Owner Decisions Needed

1. **Player Avatar Inside the Rover Cab When Driving (`12-rover-driving.jpg`):**
   - *Question:* Rule 12 states that generated vehicle models must have **empty cabs** with a square `[-u-]` yoke (so the AI 3D generator doesn't bake a melted driver inside the mesh). At runtime in the game, when the player presses `E` to enter and drive the Rover in third-person ([`12-rover-driving.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/12-rover-driving.jpg)), should the cab stay visually empty (remote/drone-link driving with the tinted glass canopy closed), or should we seat the Scientist avatar mesh at the yoke socket?
   - *Recommendation:* Keep the cab **visually empty with a sleek tinted/amber-lit canopy or remote-telemetry HUD feed** on Low/default (since Mixamo seated driving IK clips through chunky roll-cages), or only seat the Scientist once dedicated seated IK is verified. Which do you prefer?
