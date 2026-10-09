# SETMIX V2.0 MASTER PLAN: THE RESOLUTION CRAFTER & THE MONSTER MASH

> **Target Model**: Claude 3.5 / 4.5 / 5.5 Opus (Lead Engineer)  
> **Status**: Comprehensive V2.0 Specification & Architecture Roadmap  
> **Origin**: Owner Directives (2026-10-06 through 2026-10-09)  
> **Game Jam Theme**: **"Monster Mash"**  
> **Spike Verification**: Verified on branch [`feat/monster-mash-exploration`](file:///c:/MarbleGp/tree/feat/monster-mash-exploration) (`@hm/shareware` package, WAD/MD2 parsers, live fidelity shaders, 14/14 unit tests pass, GPU smoke verified).  

---

## 1. EXECUTIVE VISION & THE MONSTER MASH CONVERGENCE

*SetMix: The Resolution Crafter* merges first-person survival-crafting automation (*The Planet Crafter*), voxel engineering (*Space Engineers*), seamless non-Euclidean portals (*Portal*), and vintage shareware preservation.

### The Core Premise: Terraforming Is Graphical Fidelity
In conventional survival games, machines raise Oxygen, Heat, and Pressure to turn a red desert green. In SetMix:
$$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
**Terraforming physically raises the graphic rendering fidelity of reality itself.**
- Reality begins in **Stage 0**: A computationally degraded, 1-bit Bayer dithered monochrome void.
- As pixel machines, mesh polishers, and light amplifiers run, reality upgrades before your eyes:
  $$\text{Stage 0 (1-bit dither)} \longrightarrow \text{Stage 1 (16-color EGA)} \longrightarrow \text{Stage 2 (256-color VGA)} \longrightarrow \text{Stage 3 (Lit Gouraud)} \longrightarrow \text{Stage 4 (Full PBR)}$$

### The Game Jam Theme: "Monster Mash"
The theme **Monster Mash** is deeply woven into the simulation lore:
1. **The Era Mashup**: The decaying simulation leaks assets across digital history. Classic 1990s retro shareware mobs and weapons (DOOM Imps/Demons, Quake Ogres/Fiends, Wolfenstein guards) spawn alongside native Goblins.
2. **The Environmental Fidelity Mashup (The Showstopper)**: **Every imported monster and weapon dynamically inherits the fidelity of the world.** In Stage 0, an imported 3D Quake Ogre or 2D Doom Demon renders as a stark 1-bit Bayer dithered silhouette; as pixel machines terraform the world, it sharpens into 16-color EGA chunky voxels, then retro 256-color VGA with PSX integer jitter, and finally blooms into full PBR with dynamic glowing eyes and Ultra point-light emissions!
3. **The Bio-Studio & Weapon Splicer**: In the Lab, players slot two Mob or Weapon cartridges into the **Preset Combiner** to literally *mash* them together (e.g. `[Imp]` + `[Goblin]` = `[Horned Imp-Goblin]`; `[Extraction Beam]` + `[Shotgun]` = `[Scatter Excavator]`).

---

## 2. CAMPAIGN BEAT-BY-BEAT WALKTHROUGH (ACTS I – IX)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             SETMIX V2.0 CAMPAIGN ARC                             │
├────────────────────┬───────────────────────────────────┬─────────────────────────┤
│ ACT I–II: LAB WAKE │ ACT III–IV: EXPEDITION & COMBAT   │ ACT V–VII: THE STUDIO   │
│ - Dark ceiling wake│ - Step onto Stage 0 planet        │ - Dirt → Ore processor  │
│ - Emergency relay  │ - Deploy Shape Press (Stage 1)    │ - Interface schema edit │
│ - Glitch portrait  │ - Perimeter mob anomaly triggers  │ - Cartridge synthesis   │
│ - Void storm window│ - Lab Armory: Extraction Beam +   │ - First color bloom     │
│ - Gate lever pulled│   Shareware Shotgun               │ - Power generator &     │
│                    │ - Fight mobs & mine 50 dirt       │   Light Amplifier       │
├────────────────────┴───────────────────────────────────┴─────────────────────────┤
│ ACT VIII–IX: THE MONSTER MASH BIO-STUDIO, ENDGAME & MULTIVERSE                   │
│ - Preset Combiner: Splicing Mob Cartridges & Weapon Hybrids                      │
│ - Internet Archive Terminal & Drag-and-Drop WAD/PAK Ingestion                    │
│ - Stage 4 PBR, Rover Fabrication, and Goblin Racing Galaxy Portal                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### Act I: The Awakening & Emergency Power
1. **First-Person Awakening**:
   - Player eyes fade in from black; camera is locked looking straight up at a dark laboratory ceiling.
   - Ambient alarm hums; emergency red light pulses across the chamber.
   - Player smoothly sits up; first-person camera looks around the pristine high-tech white lab.
2. **Glitching Radio Portrait**:
   - Top-left HUD displays a holographic radio portrait of a female scientist, heavily glitching with scanlines and dither noise.
   - Audio static SFX + voice/radio text:  
     > *"Not that button... Be more careful, you're the only one who can still do something about this."*
3. **Emergency Objective**:
   - Narrator warns that her pocket of reality will collapse in seconds if power is not restored.
   - HUD objective & 3D waypoint: **Emergency Power Relay**.
   - Player moves to the relay switch and pulls it.
   - Power surges back: lights flicker from red emergency to bright white, machines spin up with mechanical whirs, CRT monitors hum to life.

---

### Act II: The Window & The Meta-Simulation Reveal
4. **The Void Outside the Window**:
   - Narrator: *"Look outside the observation window."*
   - Player walks to the glass: outside is a terrifying apocalyptic storm collapsing into a gravitational black-hole void in the sky.
   - Rendering fidelity degrades non-linearly toward the event horizon: crisp PBR in the foreground $\to$ digital glitch tearing $\to$ low dither $\to$ monochrome wireframe $\to$ pitch-black vortex.
   - Narrator:  
     > *"That's you if you didn't turn the power on just now. The void appeared and started swallowing everything... Turns out we're living inside a simulation."*
5. **Decoding the Simulation**:
   - Narrator explains that humanity learned to decode and manipulate the simulation substrate using cartridges, spires, and studio tools.
6. **Activating the Gate**:
   - Narrator: *"The portal is ready, you just gotta flip the lever."*
   - Player pulls the main console lever.
   - The freestanding archway portal sputters dramatically, hums to life, and reveals the desolate, monochrome, low-dither Stage 0 plot on the other side.

---

### Act III: First Expedition & The Shape Press
7. **Stage 0 Expedition & Sync Depletion**:
   - Player crosses the portal threshold seamlessly into the Stage 0 world.
   - Sync gauge begins draining slowly (data entropy in unpowered zones).
   - Narrator:  
     > *"Yeah, it's not much to look at. You might want to spend that basic cartridge in your inventory just so you can see what you're doing out here. Remember, in those conditions you will lose sync fast."*
8. **Placing the First Shape Press**:
   - Player opens the build menu, selects the free **Shape Press**, places it on the plot, and slots the basic cartridge.
   - The machine activates and emits a geometric pulse.
   - **Visual Resolution Bump**: The terrain dither steps up to Stage 1, clarifying topography and horizon perspective.

---

### Act IV: The Perimeter Anomaly, The Armory & The First Combat Mining Expedition
9. **The Perimeter Mob Anomaly**:
   - The Shape Press's resolution wave causes an uncompiled reality glitch on the plot perimeter.
   - 2 to 3 retro mobs (e.g. 1-bit Bayer dithered Imps or Glitch Demons from `@hm/shareware`) materialize at the edge of the desync barrier!
   - Narrator warns with urgency:  
     > *"Heads up! That resolution pulse triggered an entity de-compile on the perimeter! You can't mine out there with bare hands. Head back to the lab armory!"*
10. **The Lab Armory (Acquiring Tools & Weapons)**:
    - Player retreats through the portal into the safety of the lab.
    - Waypoint points to the **Tool & Weapon Rack** on the lab wall.
    - Player interacts and equips:
      1. **The Extraction Beam Tool**: Rifle-shaped terraforming tool (auto-equips to hotbar slot 1). If fired empty, triggers a hollow *"brrt"* sound. Narrator: *"You need a tool cartridge to use it for anything other than mining."*
      2. **The Shareware Combat Weapon**: A classic kinetic sidearm (e.g. Vintage Pump Shotgun or Plasma Pistol).
      - Narrator:  
        > *"Classic kinetic hardware recovered from vintage shareware archives. It'll keep those uncompiled entities off your back while you mine raw substrate."*
11. **Combat & Dirt Mining on the Plot**:
    - Player returns through the portal.
    - **Combat Phase**:
      - The mobs approach using `@hm/npcbrain` steering behaviors.
      - Player fires the combat weapon: authentic 8-bit PCM sound blast (`DSSHOTGN`), muzzle flash, and impact sparks.
      - Hits trigger flinch animations; on defeat, mobs play death animations or ragdoll collapse (`@hm/ragdoll`), dropping **Substrate Shards** and **Mob Cores**.
    - **Mining Phase**:
      - Player equips the Extraction Beam.
      - Targets the terrain to mine **50 Dirt**.
      - Ground visibly deforms in real time, carving a dug crater into the voxel heightfield.

---

### Act V: Dirt $\to$ Ore Processor & The Interface Schema Editor
12. **Building the Dirt $\to$ Ore Processor**:
    - Guided back to the lab with 50 dirt.
    - Player constructs the **Dirt $\to$ Ore Processor** machine and deposits the mined dirt to refine it into **Ore**.
13. **The Meta-Editor ("It's not really dirt")**:
    - Narrator:  
      > *"It's not really dirt, you get that right? We're just calling it that for your sake—we can change it at any time we want."*
    - Guided to the **Studio Console** in the lab: opens the expert in-game interface schema editor.
    - The editor displays the simulation's underlying variable declarations (`dirt`, `ore`, labels).
    - Player is shown how to customize labels or parameters.
    - Option prompt: *"Submit as permanent change to default game?"*
    - If yes: queued for decentralized community majority review at the end of the week.
14. **Decentralized Multi-Branch Consensus (Sync Mechanics)**:
    - Narrator explains how multi-user simulation consensus works:
      - Outside in the universe, reality is determined by majority consensus.
      - Crossing into a zone where other players run a different sync branch allows you to either sync to their branch or fork your own branch.
      - Syncing is non-destructive and reversible: you can roll back to your original desync point at any time.
      - Weekly governance: most popular community cartridges and mods get promoted into default canon.

---

### Act VI: Cartridge Synthesis & The First Color Bloom
15. **Crafting & Modding Tools in the Lab**:
    - **Cartridge Crafting Machine**: Manufacture a blank cartridge from refined ore.
    - **Sculpting Studio Machine**: Burn the `smooth ground` attribute into the cartridge and slot it into the tool gun.
    - **Painting Studio Machine**: Acquire a vibrant Grass PBR texture cartridge and equip to hotbar.
16. **Injecting Color into the World**:
    - Step outside onto the plot.
    - Use the smoothing tool mode to fill and level the mining craters dug earlier.
    - Deploy the **Texture Mill** and slot the Grass cartridge into its bay.
    - **The Visual Transformation**: Pixels spewing from the mill plume shift to radiant green!
    - Patches of lush green grass bloom outward across the facetted terrain. The black-and-white dither now sings with vibrant green!

---

### Act VII: Power Generator & Light Amplifier
17. **Powering the Grid**:
    - Deploy a Rock Drill to automate ore extraction.
    - Construct a **Power Generator**.
18. **The Chromatic Light Surge**:
    - Narrator: *"Time to put down a Light Amplifier, but we needed the generator first because they need a lot of power (not ore)."*
    - Player places the **Light Amplifier**.
    - A blinding pulse sweeps outward: the sky shifts from pitch black to rich atmospheric blue, directional sunlight floods the landscape, and full dynamic shadows cast across the rocks (Stage 2/3).
19. **Transition to Open Sandbox**:
    - Narrator transitions from linear quest guide to contextual advisor, offering tips for studio presets, advanced machines, and deep automation.

---

### Act VIII: The Monster Mash Bio-Studio & Weapon Fusion (V2.0 Expansion)
20. **Genetic Mob Splicing in the Preset Combiner**:
    - The Preset Combiner (`@hm/assembler` & `@hm/cartlab`) acts as a bio-splicer:
      - `[Mob Cartridge: Imp]` + `[Mob Cartridge: Goblin]` $\longrightarrow$ `[Fused Cartridge: Imp Goblin]`  
        *(Combines Goblin running speed with Imp fireball ranged attacks and horned voxel skin).*
      - `[Mob Cartridge: Cacodemon]` + `[Machine: Rock Drill]` $\longrightarrow$ `[Fused Entity: Floating Ore Drone]`.
    - Carrying a fused cartridge to the planet allows players to deploy summonable allies and farmable companions.
21. **Weapon Hybridization**:
    - `[Extraction Beam]` + `[Shareware Shotgun]` $\longrightarrow$ `[Scatter Excavator]`  
      *(Fires an 8-pellet cone that excavates wide craters in one blast).*
    - `[Plasma Rifle]` + `[Texture Mill]` $\longrightarrow$ `[Color Spewer]`  
      *(Sprays colored pixel pulses that paint terrain surfaces on impact).*
22. **The Internet Archive Terminal & Drag-and-Drop Ingestion**:
    - In-lab CRT terminal queries `archive.org` MS-DOS shareware collections live with open CORS.
    - Drag-and-Drop: Players drag any custom `.wad`, `.md2`, `.vox`, or `.glb` into the browser window:
      - The engine parses sprites, meshes, and sounds in milliseconds.
      - Automatically generates in-game cartridges for community mobs and weapons!

---

### Act IX: The Endgame Multiverse & Goblin Racing Portal
23. **High-Tier Terraforming (Stages 4 & 5)**:
    - Atmospheric emitters create clouds, rain, and filling turquoise lakes with buoy physics.
    - Procedural conifer and oak forests sprout across the rolling hills.
24. **Vehicle Fabrication & Goblin Racing Gate**:
    - Fabricate the **Goblin Rover** with Pacejka tire physics and $1.62\text{ m/s}^2$ moon gravity drifting.
    - Achieving Stage 2+ unlocks the **Interplanetary Gate** to Goblin Racing and community shared islands!

---

## 3. TECHNICAL ARCHITECTURE & PACKAGE INVENTORY

```
packages/
  ├── shareware/                # Pure-TS WAD lump, Quake MD2, and Archive.org client (VERIFIED)
  │     ├── src/wad.ts          # DOOM lump parser, 256-color palette, patch/sprite decoder, 8-bit PCM audio
  │     ├── src/md2.ts          # Quake 2 MD2 3D mesh loader with 199 morph animation frames
  │     ├── src/fidelity-mob.ts # Multi-stage shader material (Stage 0 dither → Stage 4 PBR)
  │     └── src/archive-client.ts # archive.org live search & metadata client
  ├── terrainbrush/             # Deformation brush engine (from develop-terrainbrush zip)
  ├── beamkit/                  # Three.js rifle-shaped extraction tool & beam shaders (landed)
  ├── npcbrain/                 # Pure steering AI (wander, patrol, chase, flee, flock)
  ├── ragdoll/                  # Verifiable ragdoll physics on entity defeat
  ├── cartlab/                  # Cartridge schema, variable declaration, and affinity logic
  ├── assembler/                # Combiner machine DAG fusion logic
  └── fidelity/                 # Global 4-float state S = (Pxd, Vtx, Lx, Aq) & stage derivation
```

---

## 4. SEQUENCED IMPLEMENTATION WAVES FOR CLAUDE OPUS

When Claude Opus resumes in ~20 hours, execute the plan in clean, verified waves:

### Wave 1: The Armory & Weapon Integration (Act IV)
- Wire `@hm/shareware` into `apps/web/src/play/lab-room.ts`: Add Tool & Weapon Rack on lab wall.
- Wire first-person weapon model (Shotgun / Extraction Beam) into `apps/web/src/play/play-scene.ts`.
- Implement left-click firing with 8-bit PCM audio playback (`DSSHOTGN`) and projectile/hitscan detection.

### Wave 2: Perimeter Mob Spawning & Combat Loop (Act IV)
- When the Shape Press is placed, spawn 2–3 mobs on plot boundary using `@hm/npcbrain`.
- Apply `createFidelityMobMaterial` to mob meshes/sprites so they dynamically match current stage.
- Implement mob hit reactions, health tracking, and defeat drop (`Mob Cores` / `Substrate Shards`).

### Wave 3: Extraction Beam Mining & Ground Deformation (Acts IV & VI)
- Land `@hm/terrainbrush` from `zips/develop-terrainbrush-typescript-package.zip`.
- Wire extraction beam to deform voxel heightfield (`plot-ground.ts`) and drop 50 dirt items.
- Wire smoothing cartridge mode to fill holes.

### Wave 4: Dirt $\to$ Ore Processor & Studio Schema Editor (Act V)
- Add Dirt $\to$ Ore processor machine to lab room.
- Implement the Studio in-game interface schema editor modal to inspect/modify variables (`dirt`, `ore`).

### Wave 5: Monster Mash Bio-Combiner & Cartridge Splicing (Act VIII)
- Extend Preset Combiner to accept Mob Cartridges and Weapon Cartridges.
- Implement fused mob recipes (`Imp Goblin`, `Scatter Excavator`).
- Expose the Internet Archive search terminal and drag-and-drop WAD/MD2 ingestion into the main game.

---

## 5. NON-NEGOTIABLE VERIFICATION CONSTRAINTS
- **Performance**: Maintain 60 FPS on Low spec (owner's laptop) across all stages.
- **Purity**: Zero runtime server dependencies; single-file bundle `apps/web/dist/index.html` must remain deployable.
- **Verification**: `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs` must pass on every commit.
