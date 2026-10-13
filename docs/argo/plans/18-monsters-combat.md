# 18 — Monsters, Containment Leaks & Combat Plan: Unifying Retro Eras Inside S-Space

## 1. The Goal: Turn 38 Imported Retro Monsters into Cohesive, Telegraphed "Simulation Leaks"

Look at [`17-monsters-batch1.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg) and [`18-monsters-batch3.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) in [`docs/argo/TOUR.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): we have a pure, deterministic combat brain in [`packages/leaksim/src/index.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts) (6 archetypes, telegraphed windups, safe zones, leak sealing) and 38 legal BSD/CC0 monsters from *Freedoom*, *Blasphemer*, *LibreQuake*, and *Quaternius* ready to wire into the world in `TASK-23b` ([`docs/prompts/sidecar/23-monsters.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/23-monsters.md)).

However, Opus rightly flagged the central creative challenge in [`docs/argo/TOUR.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): **placing gory 2D Doom-era sprites next to cute low-poly Quaternius 3D models and early-3D Quake meshes creates a jarring visual clash unless unified by art direction**. Our goal is to resolve that clash through an **S-Space Containment Leak Shader** and strict archetype-to-era mapping so every monster looks like a **corrupted digital entity leaking out of a ruptured simulation archive**, while honoring Rule 14 (no "Monster Mash" branding) and Rule 23 (monsters never destroy built structures, and peaceful players can earn every drop without fighting).

## 2. Where It Stands Today

- **What Exists:**
  - [`packages/leaksim/src/index.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/packages/leaksim/src/index.ts) defines:
    - `Archetype`: `'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper'`
    - `Aggression`: `'off' | 'calm' | 'normal' | 'hard'`
    - `Phase`: `'roam' | 'chase' | 'windup' | 'attack' | 'recover' | 'pain' | 'dead'`
  - [`packages/shareware/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/shareware) parses 2D WAD sprite patches (*Freedoom*, *Blasphemer*), `.md1` / `.md2` vertex-morphed 3D meshes (*LibreQuake*), and `.glb` rigged meshes (*Quaternius*), plus `fidelity-mob.ts` multi-stage shader hooks.
  - `TASK-23b` ([`docs/prompts/sidecar/23-monsters.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/23-monsters.md)) wires `@hm/leaksim` into the planet gameplay loop.
- **What Is Weak or Missing:**
  - **Tonal & Visual Clash (`17-monsters-batch1.jpg`, `18-monsters-batch3.jpg`):** Raw 2D sprites have baked doom-palette blood/grime, whereas *Quaternius* glTF models have clean flat pastel vertex colors. Rendered side-by-side without a unifying material pass, they look like assets from three unrelated games.
  - **Stand-In Anomaly Rift Geometry (`POL-23`):** Leak spawn points currently use basic primitives (dodecahedron, torus, icosahedron) instead of tearing vertical S-space rifts that echo the Lab Window Breach ([`05-window-view-storm-and-breach.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)).
  - **Telegraph Readability in Low-Fidelity Stages:** In Stage 0 (1-bit) and Stage 1 (EGA), a monster entering its `windup` phase (`@hm/leaksim`) needs an unmistakable high-contrast visual and audio tell so players can dodge or counter-fire.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Monster & Combat Design Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Prodeus***](https://store.steampowered.com/app/964800/Prodeus/) | **Shader-Unified Sprite/3D Rendering with Emissive Weakpoints:** 2D directional sprites and 3D meshes share the exact same normal-mapped dynamic lighting, stage palette quantization, and bright emissive eyes/projectiles ([Prodeus Technical Discussions](https://steamcommunity.com/app/964800/discussions/0/3371531264818900018/)). | Passing both 2D sprites and 3D meshes through our `createFidelityMobMaterial` with a shared **S-Space Glitch Outline & Stage Quantizer** makes them look like siblings born from the same simulation breach. |
| [***Deep Rock Galactic***](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) | **Unmistakable Silhouette + Audio Telegraph Per Archetype:** Every enemy class (Swarmer, Mactera Spitter, Praetorian Brute) has a distinct silhouette, glowing weakspot, and 0.6 s pre-attack audio/visual windup cue ([Deep Rock Galactic Steam](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/)). | Maps 1:1 to our 6 `@hm/leaksim` archetypes (`charger`, `spitter`, `swarmer`, `flyer`, `brute`, `sapper`). |
| [***Control***](https://store.steampowered.com/app/870780/Control_Ultimate_Edition/) & [***Factorio***](https://store.steampowered.com/app/427520/Factorio/) | **Compute/Pollution-Triggered Breach Waves & Non-Griefing Sappers:** High machine activity attracts localized anomalies (`Leak Waves`), and peaceful/builder modes allow full progression without losing hours of base construction ([BASE_BUILDING_RESEARCH.md](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/BASE_BUILDING_RESEARCH.md)). | Already encoded in Rule 23: `sapper` archetypes temporarily **drain/brown-out** a machine's fidelity output by latching onto its relay line rather than destroying the placed structure! |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical Archetype, Visual Era & Behavior Mapping (`@hm/leaksim` + `TASK-23b`)

| `@hm/leaksim` Archetype | Assigned Asset Family (`docs/monsters/`) | Combat Role & Telegraph (`windup` Phase) | Interaction with Player & Base (Rule 23 Compliant) |
| :--- | :--- | :--- | :--- |
| **`swarmer`** | *Quaternius* small low-poly critters (rendered with faceted wireframe/glitch shell) | Fast ankle-biters in packs of 4–6; `0.35 s` hop crouch telegraph with high-pitched chitter. | Cleared in one Shotgun blast or wide Beam sweep; never damages buildings. |
| **`charger`** | *Freedoom* / *Blasphemer* melee beasts & *LibreQuake* Fiend (`md1`) | Bull-rush line attacker; pauses `0.6 s` during `windup`, glowing `#ff3d8a` along its spine before lunging in a straight vector. | Sidestepping causes it to stagger (`recover` phase `0.8 s`) for easy critical hits. |
| **`spitter`** | *Freedoom* Imp / ranged sprites & *Blasphemer* acolytes | Mid-range artillery; raises arms for `0.7 s` (`windup`) charging a bright `#ffc13d` / `#ff3d8a` plasma orb before firing a slow dodgeable bolt. | Projectiles can be shot down mid-air or deflected with a pulse of the Beam Tool. |
| **`flyer`** | *Freedoom* floating skull/sphere sprites & *Quaternius* flying drones | Hovers `4–7 m` above craters, strafing around vertical cover; `0.65 s` sonar screech before diving or firing. | Keeps combat three-dimensional; drops high-yield `Lumen Shards` (`#ffc13d`). |
| **`brute`** | *LibreQuake* Ogre / Shambler (`md1`/`md2`) | Heavy tank spawned only at Stage 2+ leaks; `0.9 s` ground-slam windup with a visible `#ff3d8a` shockwave ring on the terrain. | High health; weak to head/back core shots or turret focus fire. |
| **`sapper`** | Glitch-tethered parasite entities | Ignores the player until aggroed; moves toward the nearest running field machine and attaches a `#3dc8ff` static tether that **halves the machine's `S` output (brownout)** without ever damaging its HP (Rule 23). | Shooting the sapper or hitting it with the Beam Tool (`Seal` mode) immediately restores 100% machine output and drops bonus `Salvage`. |

### P0 — Must Fix Before First Public Test

1. **P0-MON-01: Unify All 38 Monsters Under the `S-Space Containment Leak Shader` (`packages/shareware/src/fidelity-mob.ts` & `TASK-23b`)**
   - **What to build:** Solve the tonal clash in [`17-monsters-batch1.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg) and [`18-monsters-batch3.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/18-monsters-batch3.jpg) by passing every monster material (2D sprite billboard, `.md1`/`.md2` morph mesh, and *Quaternius* `.glb`) through a shared three-stage shader wrapper in `fidelity-mob.ts`:
     1. **Desaturate Gore / Unify Base Palette:** Remap raw blood/gore reds and cartoon pastels into the game's dark gunmetal/obsidian substrate palette (`#181c24` to `#4a5568`) with glowing metric veins (`#ff3d8a` for attackers, `#3dc8ff` for sappers, `#ffc13d` for spitters).
     2. **Dynamic Local Stage Inheritance:** A monster standing on Stage 0 terrain renders in crisp 1-bit Bayer dither with a 1 px cyan/pink silhouette edge; as it walks into a Stage 3/4 high-fidelity zone near the player's outpost, its shader upgrades live across its body into normal-mapped/lit fidelity!
     3. **Horizontal Glitch-Slice Displacement:** Apply a subtle periodic horizontal scanline tear (`2–4 px` vertex/UV offset on `pain` and `windup` phases) echoing the Window Breach column ([`05-window-view-storm-and-breach.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), visually proving they are unstable simulation leaks.
   - **Needs:** **Code** (`packages/shareware/src/fidelity-mob.ts`, `apps/web/src/play/`).

2. **P0-MON-02: High-Contrast `windup` Telegraph Flash & Audio Cue (`@hm/leaksim` Integration)**
   - **What to build:** Whenever an entity in `@hm/leaksim` transitions into `Phase: 'windup'`, pulse its emissive rim from `0.2` to `2.0` (`#ffc13d` amber for ranged bolts, `#ff3d8a` pink for melee charges) and fire a distinct `350 ms` rising FM telegraph sound (`@hm/soundpack`) so the player never takes blind damage from off-screen or in low-light Stage 0 craters.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/soundpack/`).

3. **P0-MON-03: Enforce the 25 m Twin Gate Safe Zone & Non-Destructive `sapper` Behavior (Rule 23)**
   - **What to build:** Verify in `TASK-23b` and `scripts/test-planet-monsters.mjs` (`TASK-24`) that:
     - Monsters cannot enter or fire into the `25 m` Twin Gate Coherence Safe Dome (pressing against the dome boundary repels them with an amber shield ripple).
     - Monsters never reduce structure/machine durability or delete player-built pieces; `sapper` units only apply a reversible efficiency debuff until cleared.
     - Setting `Aggression: 'off'` or `'calm'` in Settings / New Profile disables unprovoked waves while allowing players to seal dormant leaks with the Beam Tool (`Seal` mode) for the exact same drops.
   - **Needs:** **Code** (`packages/leaksim/`, `apps/web/src/play/`).

### P1 — Makes It Feel AAA

4. **P1-MON-04: Replace Primitive Leak Nodes with Vertical Glitch-Torn Rift Columns (`POL-23` Upgrade)**
   - **What to build:** Replace the stand-in dodecahedron/torus leak geometries (`POL-23`) with a miniature `3.5 m` vertical glitch-sliced shard column (reusing the exact shader language of the Lab Window Breach in [`05-window-view-storm-and-breach.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg) surrounded by 3 orbiting low-poly rubble fragments). As the player channels the Beam Tool (`Seal` mode) into the rift for `3.0 seconds`, the rift's horizontal slices lock back into alignment and compress into a collectible `Anomaly Core`.
   - **Needs:** **Code** (`apps/web/src/play/`), **Art** (concept pass + shader reuse from `WindowScene.ts`).

5. **P1-MON-05: Era-Escalation Across Fidelity Stages**
   - **What to build:** Tie leak compositions to the plot's current stage so the history of 3D graphics unfolds through combat:
     - **Stage 0–1 Leaks:** 2D directional billboard sprites (*Freedoom* / *Blasphemer* imps and chargers) emerging from flat 1-bit/EGA rifts.
     - **Stage 2–3 Leaks:** Early 3D vertex-morphed `.md1` / `.md2` monsters (*LibreQuake* Fiends and Ogres) with chunky Gouraud shading.
     - **Stage 4 Leaks:** Full 3D skeletal-rigged monsters (*Quaternius* + high-tier hybrids) with PBR materials and dynamic point-light emissions.
   - **Needs:** **Code** (`packages/leaksim/`, `apps/web/src/play/`).

### P2 — Stretch Goals

6. **P2-MON-06: Bio-Spliced Companion / Farmable Cartridges in the Preset Combiner (`V2_0_MASTER_PLAN.md` Act VIII)**
   - **What to build:** Allow slotting two recovered `Monster Cores` (or `Monster Core + Machine Cartridge`) into the Lab's **Preset Combiner** (`#b46bff`) to synthesize a tamed defender/harvester drone that patrols the outpost perimeter.
   - **Needs:** **Code** (`packages/assembler/`, `packages/leaksim/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 2 (Purity is load-bearing):** `@hm/leaksim` remains 100% pure and deterministic.
- **Rule 14 (No unrequested branding):** All UI, quest text, and code labels refer to **Containment Leaks** and **Archive Entities**, never `"Monster Mash"`.
- **Rule 18 (Legal assets only):** Uses only BSD/CC0 assets (*Freedoom*, *Blasphemer*, *LibreQuake*, *Quaternius*) documented in [`CREDITS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CREDITS.md), plus local user-dropped files in the Workshop.
- **Rule 23 (No soft-locks, monsters never destroy built pieces, peaceful alternative):** Strictly enforced by `P0-MON-03`.

## 6. Owner Decisions Needed

1. **Unifying the 2D Doom/Heretic Sprites and 3D Quaternius Models (`P0-MON-01`):**
   - *Question:* In [`17-monsters-batch1.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/17-monsters-batch1.jpg), the gory 2D *Freedoom* sprites clash with the cute pastel *Quaternius* 3D models. Do you approve our **two-part unification plan**: (a) remapping both families into the game's dark obsidian/gunmetal containment-leak palette with glowing metric veins (`#ff3d8a` / `#3dc8ff` / `#ffc13d`), and (b) staging them by computing era (2D sprites in Stage 0–1 $	o$ Quake `.md1`/`.md2` in Stage 2–3 $	o$ full 3D rigged models in Stage 4)?
   - *Recommendation:* **Approve both.** Staging 2D sprites $	o$ early 3D $	o$ full 3D across the Fidelity Stages turns a potential asset mismatch into one of the cleverest meta-jokes and visual progressions in the entire game!
