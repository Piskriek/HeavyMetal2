# 30 — Real-Time In-Engine Credits Music Video Plan ("Four Floats" v2)

> **File Destination in Repo:** `docs/argo/plans/30-credits-video.md`
> **Author:** Gemini Argo (Creative Lead) & Claude Opus (Engineering Lead)
> **Origin:** Owner Directive (`OWNER_ASKS.md`, 14 October 2026: *"if you can make an animation that plays over the credits"*, referencing the code-driven chapter approach of [JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo/blob/main/README.md))
> **Audio Track:** `"Four Floats"` v2 (`docs/argo/plans/26b-ending-song-v2.md`, `140 s` main track at 120 BPM + Demucs-separated looping instrumental chorus outro)
> **Target Brief:** Fold into **Sidecar Brief 28** (`28-lab-choreography-and-vista.md`) or standalone **Sidecar Brief 33** (`33-credits-video.md`)
> **Date:** 14 October 2026
> **Status:** **APPROVED FOR IMPLEMENTATION.**

## 1. Architecture: Code-Driven Chapters Rendered Live In-Engine (60 FPS)

Inspired by the modular timeline structure of [JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo/blob/main/README.md) (`src/ch/` one chapter per song section driven by a shared `timeline.ts` clock) and the split-screen telemetry layout of [Valve's Portal Credits](https://developer.valvesoftware.com/wiki/Credits.txt), our credits sequence is **not** a pre-rendered MP4 video that would bloat the repository. Instead, it is a **real-time, deterministic in-engine music video (`apps/web/src/credits/`)** driven by `audioContext.currentTime` (with a `performance.now()` fallback when offline):

    apps/web/src/credits/
      index.ts                # Mounts the credits director, audio sync clock, and skip/replay controls
      timeline.ts             # Shared 120 BPM beat grid, chapter boundaries, and lyric cue timestamps from 26b
      credits-hud.tsx         # Stage-reactive lyric pill (left) + scrolling credits roll (right)
      ch/
        ch1-cold-boot.ts      # 0:00–0:22 | Stage 0a Wireframe: Lab wake, breaker throw, wireframe Moon
        ch2-one-bit-facets.ts # 0:22–0:44 | Stage 0b -> 1 EGA: Radial facet fill, Beam mining, 12 kW brownout
        ch3-chorus-bloom.ts   # 0:44–1:06 | Stage 2 VGA: "Four floats in the dark" 4-plume quartet & grass
        ch4-archive-rifts.ts  # 1:06–1:28 | Stage 3 Gouraud: 2D sprites -> 3D .md1 brutes, Vance ridge, Rover jump
        ch5-window-heal.ts    # 1:28–1:52 | Stage 4–5 Hydro/Coverage: Lake flood, Combiner splice, Breach zips shut
        ch6-suitcam-finale.ts # 1:52–2:20 | Stage 6 Suit-Cam PBR: First-person iris blowout, forest, 11 domes
        ch7-outro-loop.ts     # 2:20–Loop | Instrumental Chorus Loop: Healed Lab/Moon dual-world diptych hold

### Why Real-Time In-Engine Wins
1. **Zero Video Megabytes (`Rule 3` & `POL-27`):** Uses our already-loaded Lab, Gate, Plot, Avatar, Machine, and Monster scenes plus our `Brief 27` post-processing shader—adding `< 12 KB` of TypeScript camera/state keyframes to `dist/index.html`.
2. **Uses the Player's Own Plot & Custom Scientist:** Because it runs in-engine, Astro wears the player's actual chosen **Visor Color** and custom **Avatar Name**, and the final shots showcase the player's actual built outpost.
3. **Interactive Camera & Replayability:** The player can watch hands-free, nudge the camera gently with the mouse (`+-8°` parallax), scroll the credits roll with the mouse wheel, or replay the music video anytime from the Main Menu (`[Credits]`) or the Lab's `old-monitor` (`Plan 29` §2.10).

## 2. Screen Layout: Viewport, Stage-Skinned Lyric Pill & Credits Roll

To ensure the 3D choreography, the synced lyrics, and the credits roll never collide (`Plan 16` / `Brief 25`):

| Screen Region | Coordinates | Visual Behavior & `data-fidelity` Skinning |
| :--- | :--- | :--- |
| **Full 3D Viewport** | `100% × 100%` (Camera framed on the left `62%` rule-of-thirds center) | Renders the active chapter's 3D scene through the exact stage shader (`Stage 0a` Wireframe $\to$ `Stage 6` Suit-Cam CMOS PBR) matching the song's current timestamp. |
| **Top-Left Telemetry Badge** | `top: 24px, left: 24px` | Displays the live stage readout (`[STAGE 0a // VECTOR WIREFRAME]` $\to$ `[STAGE 6 // SUIT-CAM CMOS PBR]`), Dr. Haddy's CRT radio portrait (pulsing gently on vocal syllables), and a 4-bar (`Pxd, Vtx, Lx, Aq`) chiptune spectrum analyzer. |
| **Bottom-Left Lyric Caption Card** | `bottom: 36px, left: 36px` (`max-width: 560px`) | **Uses the active `data-fidelity` skin from `Plan 28`!** Morphs with a `120 ms` glitch flash at each chapter boundary (`0a` hairline vector box $\to$ `0b` 1-bit dithered Mac card $\to$ `1` EGA double-line box $\to$ `2` VGA chiseled bevel $\to$ `3` Gouraud slate $\to$ `4-6` frosted Suit-Cam visor glass). Highlights each 5- and 7-syllable line on the 120 BPM beat. |
| **Right-Third Credits Roll** | `top: 0, right: 32px, width: 360px, height: 100%` | A sleek, semi-transparent vertical telemetry column (`--hud-bg`, `--hud-border`, `--hud-font-body` from the current `data-fidelity` skin) scrolling upward at `28 px/s` with top/bottom alpha feathering. |

## 3. Shot-by-Shot Storyboard Synced to `"Four Floats"` v2 (`0:00` to Loop)

> **Note for Opus:** Rough timestamps (`mm:ss`) below map to the `140 s` 120 BPM v2 track (`26b-ending-song-v2.md`) plus the Demucs-separated looping instrumental chorus outro. Snap each `tStart` / `tEnd` constant in `timeline.ts` to the exact bar/beat markers once the audio cut finishes.

### Chapter 1 — Cold Boot & Wireframe Arrival (`0:00 – 0:22`)
- **Visual Look:** **`Stage 0a` — Hidden-Line Vector Wireframe** (`uWireframeMix = 1.0`, depth/normal edges rebuilt from depth buffer + converging `2 m` `worldAt()` grid; `15 m` amber Gate pool and plumes in color).
- **HUD Skin:** `data-fidelity="0a"` (1 px phosphor-white wireframe boxes, hollow vector bars).

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-1A`** | `0:00 – 0:07` | **Chiptune & Drum Intro** | **The Dark Lab Wake (`LabScene`):** Camera starts pitched up at the dark Lab ceiling under the red `1.2 Hz` emergency strobe synced to the 120 BPM kick drum. Camera tilts down as Astro's hand reaches for the glowing red console button—Dr. Haddy's CRT portrait pops in top-left with a warning flash—and Astro instead pulls the **Power Wall Breaker**. Overhead strip lights fire back-to-front in rhythm with the chiptune arpeggio. |
| **`SHOT-1B`** | `0:07 – 0:15` | **Verse 1 (Part A)** *(5/7 meter: waking on concrete, pulling levers, stepping through the Gate)* | **Gate Ignition & Wireframe Reveal:** Camera dollies smoothly toward the freestanding Gate as its 8 ribbed amber coil blocks ignite bottom-to-top on the snare beats. Crossing the threshold reveals the **`Stage 0a` Vector Wireframe Moon**: black depth-occluded crater hills, crisp phosphor-white crease lines, and the converging `2 m × 2 m` ground grid stretching to the horizon. |
| **`SHOT-1C`** | `0:15 – 0:22` | **Verse 1 (Part B)** *(wireframe stone, lines in the dark, first drill & mill)* | **First Placement on Vector Stone:** Low-angle tracking shot circling Astro on the wireframe Gate pad. A holographic green build ghost snaps onto the grid; the `#7cff4d` wireframe print plane sweeps bottom-to-top to materialize the first **Rock Drill** and **Texture Mill**. |

### Chapter 2 — 1-Bit Facets, Dirt Mining & The 12 kW Brownout (`0:22 – 0:44`)
- **Visual Look:** **`Stage 0b` — 1-Bit Flat-Faceted Dither** (`0:22–0:33`) $\to$ **`Stage 1` — 16-Color EGA Mineral Facets** (`0:33–0:44`).
- **HUD Skin:** `data-fidelity="0b"` (1-bit Macintosh/Obra Dinn checkerboard header) $\to$ `data-fidelity="1"` (EGA double-border TUI).

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-2A`** | `0:22 – 0:30` | **Verse 2 (Part A)** *(feeding fifty dirt to the mill, "not really dirt")* | **The Radial Facet Wave (`Stage 0a -> 0b`):** On the downbeat of Verse 2, the Texture Mill spews its first `#ff3d8a` pink pixel plume and fires a radial scan-wave (`0 -> 300 m`) across the crater—filling the hollow wireframe cages into **`Stage 0b` 1-Bit Flat-Shaded Facets**! In third-person (`1.65x` rifle scale, rim-lit hazmat suit), Astro fires the **Extraction Beam Rifle**, spiraling dark voxel clumps from a crater into the muzzle. |
| **`SHOT-2B`** | `0:30 – 0:38` | **Verse 2 (Part B)** *(blowing the 12 kW gate line, dropping a Power Unit)* | **The 12 kW Brownout & EGA Upgrade (`Stage 0b -> 1`):** Cut to the Gate junction box as a 4th machine drops: the status LEDs blink amber brownout (`12 kW` exceeded) and plumes dip to 25%. Astro bolts down a **Power Unit**—white energy beads surge along the Relay Pylon cables, and a green/amber wave upgrades the terrain into **`Stage 1` 16-Color EGA Flat Facets** with a warm horizon band. |
| **`SHOT-2C`** | `0:38 – 0:44` | **Pre-Chorus** *(patching the schema in the Studio, 1-bit to 16-color)* | **The Act V Schema Patch:** Fast whip-pan through the Gate to the Lab's **Studio Terminal (`A4-03`)** where the `"dirt"` property flashes green (`PATCH ACCEPTED`), while the HUD skin glitches (`120 ms`) into `data-fidelity="1"`. |

### Chapter 3 — Chorus 1: "Four Floats in the Dark" (`0:44 – 1:06`)
- **Visual Look:** **`Stage 2` — 256-Color VGA Indexed Textures, Cast Shadows & First Grass Bloom**.
- **HUD Skin:** `data-fidelity="2"` (1990s VGA chiseled 3D bevel borders and recessed gauge wells).

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-3A`** | `0:44 – 0:55` | **Chorus 1 (Part A)** *("Four floats in the dark" — Pixels, Vertices, Light, Water)* | **The Four-Plume Quartet:** Heroic sweeping crane shot rising behind a 3×3 outpost of **Sheet 13 gunmetal box-section foundations** (`Brief 26`) with telescoping legs anchored into the lunar slope. As each float is sung in the chorus, its machine fires a synchronized burst 12 m into the sky: **Texture Mill (`#ff3d8a` Pink)**, **Shape Press (`#7cff4d` Green)**, **Light Projector (`#ffc13d` Amber)**, and **Water Maker (`#3dc8ff` Cyan)**. |
| **`SHOT-3B`** | `0:55 – 1:06` | **Chorus 1 (Part B)** *(compiling the world, proving the kernel wrong)* | **VGA Shadows & Emerald Grass Bloom:** The **`Stage 2` VGA LUT** and `1024²` directional shadow cascades snap on—long, crisp shadows sweep across the crater boulders as patches of emerald grass bloom outward beneath the running mills. |

### Chapter 4 — Leaked 90s Eras, Vance's Ridge & Rover Hang-Time (`1:06 – 1:28`)
- **Visual Look:** **`Stage 3` — 16-Bit Smooth Gouraud Shading & Rayleigh Blue Sky**.
- **HUD Skin:** `data-fidelity="3"` (Chamfered tactical slate glass with `4px` blur).

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-4A`** | `1:06 – 1:14` | **Verse 3 (Part A)** *(sealing the rifts where the nineties leaked through, old sprites charging)* | **2D Sprites to 3D `.md1` Era Escalation:** Tracking shot along the crater rim under a **`Stage 3` Rayleigh blue sky**. A `3.5 m` vertical glitch-sliced Rift Column (`Brief 30`) pulses `#ff3d8a`: a 2D billboard sprite charger (*Freedoom*) lunges out, followed by a 3D `.md1` brute (*LibreQuake*). Astro channels the Beam Rifle in `Seal` mode (`#ffc13d` amber coil rib glowing) while a foundation-mounted **Perimeter Turret** (`2 kW`) suppresses a sapper. |
| **`SHOT-4B`** | `1:14 – 1:22` | **Verse 3 (Part B)** *(Vance's notes on the ridge, hot-patching the Bridge)* | **Vance's Wreck Site & Lunar Rover Jump:** Cut to the North-West Ore Ridge where Wreck Transponder Beta (`LOG-06`) blinks beside a cracked chiller hull. The modular **Scout Rover** (`Brief 27b`, tinted cab, square `[-u-]` yoke, raycast aerial) launches off the crater crest in `1.62 m/s²` lunar gravity, hanging airborne against the alien Goblin planet overhead. |
| **`SHOT-4C`** | `1:22 – 1:28` | **Pre-Chorus 2** *(the stubborn technician with a Studio key)* | **The Combiner Deep Bus:** Inside the Lab, the **Preset Combiner**'s `#b46bff` violet plasma globe arcs as an `Anomaly Core` and two cartridges fuse into the Stage 6 Golden Master cartridge. |

### Chapter 5 — Bridge: Hydro Lakes & The Earth Window Breach Heals (`1:28 – 1:52`)
- **Visual Look:** **`Stage 4` (Hydro Lakes) $\to$ `Stage 5` (Coverage Creep) + `lab-vista.ts` Breach Heal**.
- **HUD Skin:** `data-fidelity="4-6"` (Full Suit-Cam frosted visor glass with optical halation glow).

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-5A`** | `1:28 – 1:38` | **Bridge (Part A)** *(water filling craters, clover & moss creeping)* | **The Eastern Lake Floods (`Stage 4 -> 5`):** High orbital pan over the eastern hydro basin as **Sheet 17 Heavy Terraformers** (`#28 Heavy Shape Press`, `#29 Heavy Light Projector`, `#30 Heavy Water Maker` on 8 m hardpoints) roar to life. Turquoise water (`@hm/hydro`) floods the depression with golden sun caustics while clover, moss, and fern coverage (`09-sheet-coverage-growth.png`) creeps up the banks. |
| **`SHOT-5B`** | `1:38 – 1:52` | **Bridge (Part B)** *(look out the window—the column is gone, who's running our server?)* | **The Showstopper — Healing the Earth Window (`lab-vista.ts`):** Camera dollies up to the Lab's `14.8 m × 3.1 m` armored observation window as Astro pulls the **Operator Console Master Sync Lever (`A9-02`)**. Outside the glass, the 120 m cyan glitch-sliced **Breach Column zips shut**, the 3 floating spherical S-pockets expand across the ruined datacentre halls, the storm sky lifts into warm golden hour, and green trees/turf bloom across Earth! Camera pans briefly to the disconnected red emergency button on the console (`"don't pull that thread"`). |

### Chapter 6 — Final Chorus: Suit-Cam PBR Biosphere & The 11 Domes (`1:52 – 2:20`)
- **Visual Look:** **`Stage 6` — Full Forest Biosphere (`@hm/treegen`, `@hm/fauna`) + `100%` Suit-Cam CMOS Optics (`Plan 25`)**.
- **HUD Skin:** `data-fidelity="4-6"`.

| Shot ID | Time (`mm:ss`) | Song Section (`26b`) | Camera & Scene Choreography |
| :--- | :--- | :--- | :--- |
| **`SHOT-6A`** | `1:52 – 2:06` | **Final Chorus (Part A)** *("Four floats in the dark" — full band + chiptune counter-melody)* | **The Suit-Cam Doorway Walkout (`Plan 25`):** First-person helmet-visor view stepping out of the dim Lab through the Twin Gate into **Stage 6**: the lagging auto-exposure iris momentarily blows out the sunlit sky (`+0.85 EV` white clip + halation bloom for `0.4 s`) before settling to reveal a towering L-system conifer forest (`@hm/treegen`), weathered moss-covered machines (`high.glb`), grazing fauna (`@hm/fauna`), and the **Heavy Crawler** parked along the lakeshore. |
| **`SHOT-6B`** | `2:06 – 2:20` | **Final Chorus (Part B) & Vocal Outro** *(best one-kilometre moon, Sector Four)* | **The Consensus Horizon Crane Shot:** Camera rises high above the Twin Gate's amber beacon, looking across the shimmering lake and forest canopy toward the **11 neighboring player enclave domes** glowing along the 4.2 km lunar horizon as the vocal ends on `"Sector Four"`. |

### Chapter 7 — Instrumental Chorus Loop: The Healed Dual-World Diptych (`2:20 – Loop`)
- **Visual Look:** **`Stage 6` Full PBR + Suit-Cam Optics (`uSuitCamMix = 0.75`)**.
- **The Final Hold Image (Loops seamlessly under the Demucs-separated 120 BPM Instrumental Chorus until the player clicks `[Continue to Sandbox]` or `[Main Menu]`):**
  - Camera locks onto the **Main Menu / Act I Diptych Angle inside the Lab** (`04-menu-setmix.png`), now **completely transformed on both sides**:
    - **Left Observation Window:** The healed Earth vista basking in golden-hour sunlight with green coverage over the quiet datacentre ruins.
    - **Right Freestanding Gate:** The open doorway framing the lush Stage 6 Lunar forest, turquoise lake, and gently rising `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff` pixel plumes.
    - **Foreground Center-Left:** The round **Planet Table** rotating with 12 green consensus nodes, and Dr. Haddy's CRT monitor displaying `SECTOR 04 // KERNEL COMPILED (1.00, 1.00, 1.00, 1.00)`.

## 4. Canonical Credits Roll Text & Complete License Manifest (`credits-hud.tsx`)

The scrolling right-hand column renders the following structured credits blocks (indented 4 spaces below; uses `PlayState.avatar?.name || 'Operator Astro'` for the player's callsign):

    ========================================
                   FIDELITY
            THE SETMIX MULTIVERSE
    ========================================

    CREATED & DIRECTED BY
      Francois (Piskriek)
      Original Concept, World Constitution,
      Four-Float Architecture & Direction

    CREATIVE LEAD
      Gemini Argo
      Art Direction, Stage Look Bible,
      Lore Expansion, Audio & UX Plans

    ENGINEERING LEAD
      Claude Opus
      Core Engine, Pure Simulation Packages,
      Shader Pipeline, Asset Bake & Tooling

    IMPLEMENTATION SIDECARS
      Claude Haiku Sidecar Fleet
      Sequential Brief Execution & Verification

    EARLY PROTOTYPE SCAFFOLDING
      Gemini Flash

    FIELD SYSTEMS ENGINEER (OPERATOR)
      ${avatar.name || 'Operator Astro'}

    ----------------------------------------
             VOICE & ORIGINAL MUSIC
    ----------------------------------------

    "DR. GWEN HADDY" VOICEOVER
      Generated via RUN.world Voice Pipeline
      Radio DSP Chain & Web Audio Synth

    ENDING THEME: "FOUR FLOATS" (v2)
      Lyrics & Story: Gemini Argo & Claude Opus
      Music Generation: RUN.world (ElevenLabs)
      Stem Separation & Loop: Demucs (MIT)
      Procedural Chiptune Synth: @hm/musicbox

    ----------------------------------------
          3D GENERATION & BAKE PIPELINE
    ----------------------------------------

    CONCEPT SHEETS & MULTI-VIEW PLATES
      RUN.world Image Generation

    3D MESH SYNTHESIS
      Local Hunyuan3D 2.1 Pipeline

    AUTOMATED LOD & DE-METALLED BAKING
      Blender 4.x Headless Bake Pipeline
      (low.glb / mid.glb / high.glb)

    ----------------------------------------
         OPEN-SOURCE & LEGAL ASSET CREDITS
    ----------------------------------------

    2D ARCHIVE SPRITES & RETRO AUDIO LUMPS
      Freedoom Project — BSD-3-Clause License
      Blasphemer Project — BSD-3-Clause License

    EARLY-3D VERTEX-MORPHED MONSTER MESHES
      LibreQuake Project — BSD-3-Clause License

    RIGGED 3D LOW-POLY MONSTER & PROP MESHES
      Quaternius — CC0 1.0 Public Domain

    CHARACTER RIG & RIFLE ANIMATION CLIPS
      Mixamo Scientist Rig & Standing Clips

    RENDERING & RUNTIME ENGINE
      three.js — MIT License
      React — MIT License

    TYPOGRAPHY (SIL OPEN FONT LICENSE 1.1)
      Oxanium — Severin Meyer (OFL-1.1)
      Inter — Rasmus Andersson (OFL-1.1)
      Share Tech Mono — Carrois Apostrophe (OFL-1.1)

    ----------------------------------------
       S = (Pxd 1.00, Vtx 1.00, Lx 1.00, Aq 1.00)
         "IT'S NOT REALLY DIRT, ENGINEER."
    ========================================

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** The credits video walks the entire 7-look fidelity ladder (`Stage 0a` Wireframe to `Stage 6` Suit-Cam PBR) and all 6 HUD skins (`Plan 28`) in 140 seconds.
- **Rule 3 (Single-file distribution + HD pack, `POL-27`):** Real-time in-engine choreography adds `< 12 KB` of code to `dist/index.html`, streaming the `"Four Floats"` v2 audio track from `public/hd/audio/` (with `@hm/musicbox` procedural fallback offline).
- **Rule 18 (Legal assets only):** Every external asset pack (`Freedoom`, `Blasphemer`, `LibreQuake`, `Quaternius`), AI tool (`RUN.world`, `Hunyuan3D`), library (`three.js`), and font (`OFL-1.1`) is explicitly credited with its license.
