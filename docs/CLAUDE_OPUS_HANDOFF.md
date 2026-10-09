# SETMIX: THE RESOLUTION CRAFTER — MASTER HANDOFF TO CLAUDE OPUS

> 🚀 **ACTIVE V2.0 MASTER PLAN (2026-10-09)**: **Read [`docs/V2_0_MASTER_PLAN.md`](file:///c:/MarbleGp/docs/V2_0_MASTER_PLAN.md) first!**  
> Integrates the full narrative awakening (Acts I–III), the Game Jam **"Monster Mash"** weapon/combat expansion (Act IV: perimeter anomaly, armory shotgun, mob combat, dirt mining), the Studio schema editor & multi-branch consensus (Act V), color bloom (Act VI), and the bio-splicer combiner (Act VIII).  
> Free & legal games catalog documented in **[`docs/FREE_GAMES_AND_ASSETS_RESEARCH.md`](file:///c:/MarbleGp/docs/FREE_GAMES_AND_ASSETS_RESEARCH.md)** (Freedoom BSD, LibreQuake BSD, Kenney CC0, Chex Quest freeware, shareware episodes).  
> The technical exploration spike is verified with live GPU screenshots on branch [`feat/monster-mash-exploration`](file:///c:/MarbleGp/tree/feat/monster-mash-exploration) (`@hm/shareware` package, DOOM WAD lump/sprite/sound parser, Quake MD2 loader, fidelity shaders).

> **Target Model**: Claude 3.5 / 4.5 / 5.5 Opus (Max Reasoning Enabled)  
> **Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Workspace Root**: `c:\MarbleGp`  
> **Status**: Verified on main, ready for V2.0 implementation waves.

---

## 1. THE GAME PREMISE & CORE VISION

### The Elevator Pitch
> *"A progress bar you can stand inside."*  
> *SetMix: The Resolution Crafter* is a first-person survival-crafting and engineering game combining the automation loops of ***The Planet Crafter***, the physical voxel engineering of ***Space Engineers***, and the seamless world-crossing of ***Portal***.  
> The core hook: **Terraforming physically raises the graphic rendering fidelity of reality.**

### The Dual-World Loop
1. **The White Room Lab**:
   - The player wakes in a high-tech pristine lab. In the wall is a seamless *Star Trek* archway portal. Through the opening lies a desolate, low-poly moon surrounded by stars.
   - The lab contains the **Material Synthesizer** (a node-based procedural shader DAG) and the **Fusion Matrix** (combining physical cartridges to invent new materials, biomes, and roads).
2. **The Low-Poly Moon**:
   - The player walks through the portal **with zero loading screens or camera resets**.
   - Crossing the threshold transforms the player from a scientist into a chunky low-poly Goblin astronaut. Gravity drops to $1.62\text{ m/s}^2$, and audio crushes to 8 kHz mono.
   - Armed with a mining extraction beam, the player harvests glowing **Chromatic Crystals** (Pxd/pixels) and **Topology Shards** (Vtx/geometry).
3. **The Machines & The Radial Resolution Wave**:
   - The player builds **Solar Collectors** for power and places **Pixel Chimneys**.
   - Slotting a **Regolith Cartridge** into a chimney makes it spew swirling **Pixel Plumes** (instanced cubes) into the sky.
   - A radial wave expands across the crater: the stepped blocks physically swell with $C^1$ continuity, smoothing into real terrain under the player's boots!
4. **Vehicles, Caves & Ecology**:
   - **Goblin Rover**: Powersliding around crater rims on $1.62\text{ m/s}^2$ moon gravity with real Pacejka tire physics, turbo boost, and 9-byte ghost racing.
   - **Volumetric Caves**: 3D underground digging with real-time CSG carving.
   - **Logistics Drones**: Autonomous spider-drones hauling ore and shooting cartridges through transparent vacuum tubes.
   - **Living Biosphere**: As Aquatic ($Aq$) and Light ($Lx$) metrics rise, the water table floods craters into swimmable turquoise lakes with caustics, and conifer forests sprout dynamically on the GPU.
   - **Endless Multiplayer Enclaves**: Players spawn thousands of kilometers apart across a 40,000 km planet, imprinting their custom cartridges onto their continents with seamless border blending.

---

## 2. THE CARDINAL ARCHITECTURAL CONSTITUTION

The entire universe is governed by **four floats and one formula**:
$$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$

- `Pxd` (Pixel Density): Controls texture resolution, Bayer dithering step, and palette quantization.
- `Vtx` (Vertex Density): Controls dual-contouring cell size, geomorphic swell, and mesh LOD.
- `Lx` (Light Flux): Controls shading model (unlit $\to$ Lambert $\to$ PBR $\to$ raytraced reflections) and photosynthesis.
- `Aq` (Aquatic Level): Controls sea level height, Gerstner wave steepness, and moisture diffusion.

**The Golden Rules**:
1. **Purity is load-bearing**: All sim packages are 100% deterministic pure functions (no `Date.now()`, no `Math.random()`, no direct I/O). This is why the 120 Hz rollback netcode converges, ghost replays take 9 bytes/frame, and a 40-hour planetary save fits in under 50 KB.
2. **Zero runtime dependencies**: No heavy third-party physics or audio engines. Shaders run in native WebGL2 / WebGPU WGSL; sound runs in pure procedural Web Audio API nodes.
3. **Four floats only**: Never propose a 5th global metric. Everything is derived from $\mathbf{S}$.

---

## 3. ARTIFACT INVENTORY: WHERE THE CODE LIVES

All files have been generated, extracted, and verified across `c:\MarbleGp\zips\extracted\`:

| Phase | Archive Directory | Key Deliverables & Production Code |
|---|---|---|
| **Phase 1 & 2** | `winner_plan` | `deriveBudget()`, `adaptGraph()`, copy-on-write `fuse()`, `certify()`, live Material Synthesizer & Fusion Matrix. |
| **Phase 3** | `winner_plan_extended` | `@hm/field` ($O(1)$ invertible wave kinematics), `@hm/mesh` (dual-contouring seam stitcher with boundary `minPolicy` & 1.5x skirts), 9-tier Inception Outliner. |
| **Phase 4** | `winner_plan_extended2` | `contracts.setmix.ts`, `fidelity.ts` (19-test suite), `TerrainMaterial.ts` (Three.js Uber-Shader with Bayer dither), `exportToUnreal.ts`, `import_setmix_to_ue5.py`, `setmixAudio.ts`. |
| **Phase 5** | `winner_plan_extended3` | `PortalRenderer.ts` (Star Trek stencil portal with Lengyel oblique near-plane clipping), `GoblinController.ts` (slope-IK & Verlet cape), `machines.ts` (power grid & pixel plumes), `galaxy.ts` (200 KB multi-world federation). |
| **Phase 6** | `winner_plan_extended4` | `SetMixPlayable.tsx` (unified 3D first-person playable WebGL2 game), `QuestEngine.ts` (Acts 1–4 onboarding state machine), `SetmixHUD.tsx` (cyberpunk HUD), `NetBus.ts` (120 Hz binary rollback command bus). |
| **Phase 7** | `winner_plan_extended5` | `WaterShader.ts` (Gerstner waves & Beer-Lambert absorption), `Ecosystem.ts` (cellular automata moisture & logistic growth), `VolumetricVoxelField.ts` & `VoxelWorker.ts` (sparse 32³ SDF chunks & worker meshing), `LogisticsSwarm.ts` (drone boids & vacuum pipes), `CartridgeCompiler.ts` (64-byte `.smx` binary cartridge standard & CLI). |
| **Phase 8** | `winner_plan_extended6` | `GoblinRover.ts` (Pacejka drift physics & spring-damper suspension), `RaceEngine.ts` (Catmull-Rom checkpoints & 9-byte ghost replays), `SetmixWGSL.ts` & `GpuComputePipeline.ts` (5 native WebGPU compute kernels & zero readback), `DialogueEngine.ts` (formant vocal synth), `GoblinTrader.ts` (P2P barter market), `SaveEngine.ts` (TLV binary saves < 40 KB), `desktop.ts` (Tauri 2.0 / Electron standalone). |
| **Phase 9** | `winner_plan_extended7` | `flora.ts` (parametric L-system tree growth & GPU branch unfolding, wind grass wake canvas), `fauna.ts` (Lotka-Volterra density fields & Poisson creature materialization with procedural IK), `enclaves.ts` (double-precision planetary coordinates & Gaussian cartridge blending), `federation.ts` (< 200 KB continental manifest sync). |
| **Phase 10** | `winner_plan_extended8` | `SetMixMaster.tsx` & `MasterRuntime.ts` (unified 4-mode master client: Play, Drive, Studio, Galaxy), `SetmixLiveLink.py` & `ue5-bridge.ts` (real-time 60 FPS two-way UE5 Nanite/Lumen synchronization), `verify-all.ts` (13-check CI test suite < 3s), `MERGE_MANIFEST.md` (12-PR production merge plan). |
| **Phase 11** | `winner_plan_extended9` | `M_SetMix_Nanite_Master.usf` (Substrate master material), `build_setmix_master.py`, `png.ts` (pure TS zero-dep chunk encoder), `BakeWorkerPool.ts` (4K/8K texture baker worker pool), `texgraph-patch.ts` (6-line upstream patch eliminating 40 MB/s allocation churn). |
| **Phase 12** | `winner_plan_extended910` | **The Grand Content Vault**: `presets.ts` (50 fully authored procedural cartridges across 6 tiers), `recipes.ts` (100-recipe Fusion Matrix periodic table), `avatars.ts` (8 Goblin cosmetic rigs), `events.ts` (30-day planetary weather calendar), `PresetVault.tsx` (interactive catalog browser). |

---

## 4. TARGET MONOREPO STRUCTURE (`github.com/Piskriek/HeavyMetal2`)

The destination packages in this monorepo are:
```
packages/
├── contracts/src/setmix.ts          # Core types & command opcodes (from contracts.setmix.ts)
├── fidelity/src/                    # deriveBudget, adaptGraph, fuse, certify (from fidelity.ts)
├── field/src/                       # Wave kinematics & scheduling (from field.ts / flora.ts)
├── mesh/src/                        # Dual-contouring seam stitching (from mesh.ts / VoxelWorker.ts)
├── render/src/                      # TerrainMaterial.ts & PortalRenderer.ts
├── audio/src/                       # setmixAudio.ts (pure Web Audio nodes)
├── net/src/                         # NetBus.ts rollback command bus
├── compute/src/                     # SetmixWGSL.ts & GpuComputePipeline.ts (WebGPU)
├── vehicle/src/                     # GoblinController.ts & GoblinRover.ts & RaceEngine.ts
├── ecosystem/src/                   # Ecosystem.ts, WaterShader.ts, flora.ts, fauna.ts
├── quest/src/                       # QuestEngine.ts onboarding state machine
├── cartridge/src/                   # CartridgeCompiler.ts (.smx binary standard & CLI)
├── content/src/                     # presets.ts (50 cartridges), recipes.ts (100 recipes), avatars.ts, events.ts
├── desktop/src/                     # SaveEngine.ts & desktop.ts (Tauri 2.0 configuration)
apps/
└── web/src/
    ├── routes/setmix/               # SetMixMaster.tsx (unified 4-mode entry point)
    └── components/                  # PresetVault.tsx, SetmixHUD.tsx
tools/
└── unreal/                          # SetmixLiveLink.py, build_setmix_master.py, M_SetMix_Nanite_Master.usf
scripts/
├── ue5-bridge.ts                    # 120 Hz WebSocket daemon for Unreal Live-Link
└── verify-all.ts                    # Master CI/CD test runner (< 3s budget)
```

---

## 5. IMMEDIATE ACTION PLAN FOR CLAUDE OPUS

When you take over, execute the following roadmap:

### Step 1: Verification & Dependency Sanity
Run `node scripts/verify-all.ts` (or the equivalent standalone test) to verify all 13 checks:
- 10,000 budget derivations
- `.smx` cartridge binary roundtrip & CRC-32 validation
- 4-client rollback simulation across 24 latency/loss permutations
- Save game serialization bit-exact CRC validation
- 16-package topological acyclicity

### Step 2: Monorepo Package Integration
Follow the 12-PR roadmap in [`MERGE_MANIFEST.md`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended8/src/drop/MERGE_MANIFEST.md):
- Land PR 1 & 2 (`@hm/contracts` + `@hm/fidelity`, `@hm/field`, `@hm/mesh`).
- Land PR 4 & 5 (`@hm/render` + `@hm/audio`).
- Land PR 6 & 7 (`@hm/net` rollback + `@hm/machines` + `@hm/galaxy`).
- Land PR 8 & 9 (`@hm/vehicle`, `@hm/ecosystem`, `@hm/quest`, `@hm/compute`).
- Land PR 10: Wire `SetMixMaster.tsx` and `PresetVault.tsx` into `apps/web/src/routes/setmix`.
- Land PR 11 & 12: CI gate and Unreal Engine 5.5 live-link tools.

### Step 3: Upstream `@hm/texgraph` Optimization
Apply the 6-line patch from [`texgraph-patch.ts`](file:///c:/MarbleGp/zips/extracted/winner_plan_extended9/src/drop/texgraph-patch.ts) to support `opts.into?: EvaluatedTexture`, eliminating the 40 MB/s allocation churn during tier-4 sweeps.

---

## 6. FINAL DIRECTIVE
*Remember the architect's constitution:*  
**"The planet's save state is four floats: Pxd, Vtx, Lx, Aq. Everything else in twelve thousand lines is a pure function of those four numbers and a content-hashed preset graph. Build the stage-transition sweep first. Defend purity like a load-bearing wall. Go build it."**
