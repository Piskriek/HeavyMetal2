# OPTIMIZATION & INNOVATION: THE LIVING ENGINE & INTER-GAME BRIDGING

> **Status**: Active Architecture & Implementation Directive  
> **Origin**: Owner Directives (2026-10-06 & 2026-10-07)  
> **Reference Video**: [AI Reverse-Engineering & Inter-Game Bridging (`h5zkzon0gM4`)](https://www.youtube.com/watch?v=h5zkzon0gM4&t)

---

## 1. THE CORE ENGINEERING RULE: "MAKE IT LOOK RIGHT, KEEP IT OPTIMAL, TOGGLE IF NOT OBVIOUS"

### The Principle
> *"If I say I want pixels spewing out, I mean I want it to look like pixels are spewing out and it be optimal. We should be making logical choices; if it's not an easy choice, then we make it a toggle setting, let the auto setting in the display decide, and then we move on."*

When implementing visual features (pixel plumes, geomorphic swells, water, volumetric foliage):
1. **Never sacrifice the visual fantasy**: If machines are supposed to spew colorful pixels, the player must actually see vibrant 3D pixel cubes physically billowing out of the vents into the sky, swirling with the wind, and connecting to the ground.
2. **Never choke the hardware**: High-fidelity visuals must not melt the minimum spec (the owner's laptop, 50+ FPS on Low/Potato).
3. **The Toggle Rule**: If there are competing technical approaches (e.g. 3D instanced geometry vs. GPU splats vs. fast dither bursts), **do not debate or stall**. Expose it as a setting, set `Auto` as the default (which picks based on the active device tier), and move forward.

---

## 2. THE OPTIMAL PIXEL PLUME SYSTEM

### Visual Fantasy
The terraforming machines (Harmonic Mesh Vibrators, Lumen Masts, Clathrate Sublimators, Pixel Emitters) are not passive static boxes. They are **active engines of reality creation**:
- They physically spew swirling, luminous 3D pixel cubes into the atmosphere.
- Each metric emits its own distinct color identity:
  - **Pxd (Pixel Density)**: Hot Magenta (`#ff3d8a`)
  - **Vtx (Vertex Detail)**: Neon Green (`#7cff4d`)
  - **Lx (Lumens)**: Solar Amber (`#ffc13d`)
  - **Aq (Aquatic / Water)**: Electric Cyan (`#3dc8ff`)
  - **All / Fusion**: Prismatic Violet (`#b46bff`)
- The spewing pixels drift upward along the global wind vector, interact with light, and gradually dissolve into the active radial resolution wave band.

### The Multi-Tier Implementation & Display Auto-Governor

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DISPLAY AUTO-GOVERNOR                           │
│  Detects GPU & Frame Time (Target: ≥60 FPS / Potato: ≥50 FPS)          │
└───────┬──────────────────────┬───────────────────────┬─────────────────┘
        │                      │                       │
        ▼                      ▼                       ▼
   ULTRA / HIGH               MID                 LOW / POTATO
 3D Instanced Cubes     GPU Gaussian Splats     Fast Bayer Sprites
 - True 3D geometry     - Order-independent     - Screen-aligned
 - Dynamic rotation       rasterization         - 0 overdraw cost
 - Point-light shadows  - 0 fill-rate penalty   - Sub-millisecond
```

#### Settings Schema
In the Graphics Menu (`Settings -> Graphics`):
```ts
export type PixelPlumeQuality = "auto" | "instanced_3d" | "gpu_splat" | "fast_dither" | "off";

export interface PlumeSettings {
  mode: PixelPlumeQuality;          // default: "auto"
  densityMultiplier: number;        // 0.25 to 2.0 (auto: set by tier)
  lightEmission: boolean;           // particles cast point light (Ultra only)
  windResponsiveness: number;       // drift force scaling
}
```

- **`instanced_3d` (Ultra)**: 3D rotating cube geometry (`InstancedMesh`) with per-instance color and lifetime attributes.
- **`gpu_splat` (Mid / Mobile)**: 3D Gaussian surfels / ellipsoids computed in WebGPU / WebGL2 compute passes. Eliminates alpha-blending fill-rate overdraw bottlenecks on integrated Intel/AMD GPUs.
- **`fast_dither` (Low / Potato)**: Screen-aligned point sprites with Bayer dithering. Runs at sub-millisecond speeds even on 10-year-old laptops.

---

## 3. INTER-GAME BRIDGING: RUNNING SETMIX WHILE OTHER GAMES RUN

### The Vision
As highlighted in recent gaming breakthroughs (e.g. AI-assisted decompilation, live memory hooks, and cross-game asset pipelines seen in YouTube `h5zkzon0gM4`), players are no longer locked into single, isolated game silos.

**SetMix is designed as a Universal Procedural Cartridge Engine**:
- While a player has another game running (e.g. **Minecraft, Unreal Engine 5, Roblox, Core Keeper, Unity, Godot**, or retro emulators):
- SetMix runs simultaneously as a **lightweight companion sidecar / overlay / local service**.
- The player can synthesize, tweak, and fuse procedural cartridges in SetMix, and **live-inject them into the running game without restarting it!**

---

### Architecture: The Dual-Horizon Inter-Game Bridge

```
┌──────────────────────────────────────────────────────────────┐
│                  SETMIX COMPANION / SIDECAR                  │
│       (Browser Runtime / Tauri 8.4 MB Native Overlay)         │
│                                                              │
│  [ Material Synthesizer ] ──► [ Fusion Matrix ] ──► [.smx]   │
└──────────────────────────────┬───────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   OUTBOUND (Live Injection)             INBOUND (Live Sampling)
   Pushes cartridges into games         Samples assets & telemetry
            │                                     │
            ├─► File Watcher Hot-Reload           ├─► Reads world seed
            ├─► WebSocket Live-Link (:5196)       ├─► Reads player position
            └─► Shared Memory IPC (mmap)          └─► Translates raw textures
                                                      into procedural ASTs
            │                                     │
            ▼                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                       RUNNING TARGET GAME                    │
│   (Unreal Engine 5 / Minecraft / Roblox / Core Keeper / etc) │
└──────────────────────────────────────────────────────────────┘
```

---

### 1. Outbound: Live-Applying Cartridges to Running Games

Players can use SetMix as a live asset fabricator while playing their favorite games:

#### A. Unreal Engine 5.5 (Live-Link Mode)
- **Status**: Production drop already built in [`tools/unreal/SetmixLiveLink.py`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended8/src/drop/SetmixLiveLink.py) and [`scripts/ue5-bridge.ts`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended8/src/drop/ue5-bridge.ts).
- **How it works**:
  - The player runs their UE5 project on Monitor 2.
  - As they edit noise nodes or fuse cartridges in SetMix on Monitor 1, the WebSocket daemon broadcasts binary changes at 120 Hz.
  - Unreal's Python Live-Link plugin automatically recompiles the Substrate master material ([`M_SetMix_Nanite_Master.usf`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended9/src/drop/M_SetMix_Nanite_Master.usf)) and deforms the Nanite Landscape in **real time at 60 FPS**.

#### B. Minecraft / Voxel Games (Resource Pack Hot-Reload)
- **How it works**:
  - SetMix points to the target game's active resource directory (`.minecraft/resourcepacks/SetMixLive/`).
  - When the player crafts a `Basalt Paver` or `Bioluminescent Moss` cartridge, SetMix automatically bakes and writes the block textures and JSON models to disk.
  - Triggering the game's reload key (e.g. `F3 + T` in Minecraft) instantly updates the world with the player's custom SetMix cartridges.

#### C. Godot / Unity / Open-Source Engines (File-Watch / Addon Bridge)
- SetMix runs a local HTTP/WebSocket service on `localhost:5196`.
- A simple 50-line plugin in the target engine listens for cartridge events and updates shader uniforms, heightmaps, and terrain splatmaps dynamically.

---

### 2. Inbound: Sampling Assets & Telemetry from Other Games

SetMix can read and react to external game worlds:
1. **AI-Assisted Texture Decompilation**:
   - The player drops a raw PNG texture or heightmap from another game into SetMix.
   - An integrated AST fitting algorithm decomposes the raw bitmap into an equivalent mathematical `@hm/texgraph` procedural cartridge (finding the closest combination of Perlin, Voronoi, and levels).
   - The asset is now infinite-resolution, procedural, and fusable!
2. **Telemetry-Driven World Simulation**:
   - SetMix reads the player's external coordinates, speed, or biome ID via game hooks or memory sampling.
   - SetMix's procedural audio engine ([`setmixAudio.ts`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended8/src/drop/setmixAudio.ts)) and weather harmonics run in the background, providing dynamic diegetic music, ambient soundscapes, and resolution events that react to the other game!

---

### 3. Automatic Running-Game Detection & Scanner

How does SetMix know if another game is running?
1. **Background Companion Daemon (`SetmixBridgeDaemon.ts`)**:
   - Runs locally on the host machine listening on `localhost:5196`.
   - Periodically samples running OS process signatures:
     - `UnrealEditor.exe` $\to$ **Unreal Engine 5.8** (verifies LiveLink/Python RPC on port 6766).
     - `javaw.exe` / `.minecraft/` $\to$ **Minecraft** (locates active resource pack hot-folder).
     - `Godot_v*.exe` $\to$ **Godot Engine** (locates project workspace).
     - `vrchat.exe`, `gmod.exe`, `hl2.exe` $\to$ **VRChat / Source Engine**.
2. **Zero-Configuration UI in SetMix**:
   - The SetMix browser client queries `http://localhost:5196/status`.
   - If an active game process is detected, a status pill lights up in the HUD / Cartridge Vault:
     `🟢 Connected to Unreal Engine 5.8 (LiveLink Active)`
   - No IP addresses, ports, or manual paths required from the player!
3. **Graceful Fallback ("Scan for Games" Prompt)**:
   - If the sidecar daemon is not running or the game is pure browser-based, the menu displays a subtle prompt:
     `"Connect External Game? [Scan for Games / Launch Bridge]"`
   - If standalone, players simply drag-and-drop `.glb` / `.vrm` files or download raw `.smx` cartridges.

---

## 4. UNIVERSAL AVATAR PIPELINE: CUSTOM MODEL IMPORTS & INTER-GAME BRIDGING

### Core Philosophy: Minimalist Setup, Infinite Modularity
Rather than trapping players in a complex 150-slider micro-morph character editor, SetMix empowers players to bring their identity from any game or 3D tool:
1. **Lightweight Built-In Character Selection**: Pick archetype (Hazmat Scientist, IVA/EVA Human Researcher) + color palette tinting.
2. **Universal 3D Upload (`.glb` / `.vrm` / `.gltf`)**: Drag and drop any 3D model into the browser or avatar dock; persists in browser `IndexedDB`.
3. **Inter-Game Sidecar Avatar Bridge**: Live hot-folder (`~/.setmix/bridge/avatars/`) where models exported from Unreal Engine, Blender, VRChat, or Garry's Mod instantly populate the player's active character roster.
4. **Reactive Resolution Harmonization**: Imported high-fidelity models adapt to the ambient terraforming tier via real-time Bayer dither, posterization, or wireframe quantization shaders.

---

### Audit & Rigging: Hazmat / Biohazard Scientist Model (`zips/Models/`)

- **Attribution & License**:
  - Model: ["Scientist"](https://skfb.ly/pGVYq) by Scarecrow_original
  - License: [Creative Commons Attribution (CC BY 4.0)](http://creativecommons.org/licenses/by/4.0/)
  - Documented in project [`CREDITS.md`](file:///c:/MarbleGp/CREDITS.md) and [`zips/Models/CREDITS.md`](file:///c:/MarbleGp/zips/Models/CREDITS.md).

- **Source Assets**:
  - **`scientist.glb`** (27.7 MB) & **`scientist.zip`** (25.6 MB containing `Sketchfab.fbx` + 4K PBR textures).
  - **Geometry**: 18,548 vertices, 33,274 triangles across 9 clean sub-meshes (`head`, `torso/legs`, `shoes`, `hands/arms`, `glasses/visor`). Clean manifold topology, scaled to standard human height (~1.75 m).
  - **Materials & Textures**: Full PBR set (`BaseColor.jpg`, `Metallic.jpg`, `Roughness.jpg`, `Normal_map.png` at 4096×4096).

- **Rigged Delivery (`zips/Models/rigged/Sketchfab.fbx`)**:
  - **Armature**: Fully rigged Mixamo humanoid skeleton (66 bones: `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, finger chains, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, etc.).
  - **Skinning**: 9 `SkinnedMesh` instances mapped with vertex skin weights.
  - **Status**: Verified fully parsable in Three.js (`FBXLoader`). Rigged bones map 1:1 to `@hm/anim` locomotion controller.

#### Web & Potato-Spec Optimization:
The uncompressed normal map is 22 MB alone (making the raw model ~28 MB). For web play:
- Generate a downscaled 1K/2K texture variant (~3 MB total) for instant 50ms loading on low-spec hardware.
- Retain the full 4K version for High/Ultra tiers and Unreal Engine live-sync.

---

## 5. IMMEDIATE ACTION ITEMS & LANDING PLAN

| Area | Action Item | Status / Plan |
|---|---|---|
| **Pixel Plumes** | Wire `PlumeSettings` toggle (`Auto`, `3D Cubes`, `GPU Splats`, `Dither`). Ensure 3D plumes spew from machines with high visual presence. | Planned in `@hm/particles` & WebGL/WebGPU renderer. |
| **Inter-Game Bridge** | Expose `scripts/ue5-bridge.ts` as a generalized local daemon supporting both WebSocket and directory hot-reload targets (`SetmixBridgeDaemon.ts`). | Core daemon exists; generalize target adapters. |
| **Custom Avatar Loader** | Implement drag-and-drop `.glb`/`.vrm` ingestion in `AvatarDock` with `IndexedDB` storage and Mixamo/VRM standard humanoid bone retargeting. | Verified Three.js `GLTFLoader` ready; ready for wiring. |
| **Hazmat Scientist Rig** | Add biohazard suit scientist preset using the audited model geometry and palette. | Model audited in `zips/Models/`. |
| **Display Governor** | Keep Potato/Low spec (50+ FPS) sacred by defaulting to Auto tiering with manual user override. | Fully aligns with `docs/SETMIX_LANDING.md`. |

