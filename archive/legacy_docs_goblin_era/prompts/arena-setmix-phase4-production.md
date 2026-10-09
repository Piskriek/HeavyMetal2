# SetMix: The Resolution Crafter — Phase 4: Production Drop, Uber-Shader, UE5 Nanite Bridge & Web Audio Synth

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `Winner_Plan_extended.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: Maximum leverage session. Extracting the ready-to-merge monorepo packages, the real-time Three.js/WebGL2 Uber-Shader, the Unreal Engine 5.5 Nanite import script, and the procedural Web Audio synthesis engine.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 4: PRODUCTION MERGE, UBER-SHADER, UE5 NANITE BRIDGE & AUDIO SYNTH

Your Phase 3 delivery (`Winner_Plan_extended.zip`) with the invertible $O(1)$ wave kinematics, the `minPolicy` boundary seam stitcher, and the 9-tier Inception Maya Outliner was masterclass systems engineering. 

We want to maximize your remaining context before we close this architecture sprint. We need four final production-grade deliverables:

---

### DELIVERABLE 1: THE MONOREPO PRODUCTION DROP (PR 1 CODE)
Give us the exact, self-contained TypeScript files ready to paste directly into our monorepo:

1. **`packages/contracts/src/setmix.ts`**:
   - The unified type definitions: `VarDecl`, `PresetHeader`, `Cartridge`, `FidelityState`, `RenderBudget`, `DeviceProfile`, `WaveSource`, `ChunkWaveSample`, `MeshPolicy`, `OutlinerNode`, `SetmixCommand`, `Certificate`.
2. **`packages/fidelity/src/index.ts`**:
   - The pure math engine with zero external dependencies (no React, no Three.js):
   - Exports: `coherence()`, `fidelityIndex()`, `stageOf()`, `normalised()`, `stepFidelity()`, `deriveBudget()`, `adaptGraph()`, `fuse()`, `certify()`, `contentHash()`.
3. **`packages/fidelity/test/fidelity.test.ts`**:
   - Production test suite (Node `node:test` or `vitest`):
   - Determinism assertions (1,000 runs produce identical FNV-1a hashes).
   - Golden-file budget tests across all 24 (stage × device) permutations.
   - Dual-contouring seam key agreement test (`seamsAgree`).
   - Round-trip `adaptGraph` validity test from Stage 1 to Stage 6.

---

### DELIVERABLE 2: THE THREE.JS / WEBGL2 UBER-TERRAIN SHADER
Our web client (`apps/web`) runs on Three.js / WebGL2. We need the actual shader code that executes your progressive fidelity visually in 3D:

Provide **`TerrainMaterial.ts`** (a custom `THREE.ShaderMaterial` or GLSL chunks):
- **Vertex Shader**:
  - Accepts terrain position and the active wave front uniforms: `u_waveOrigin`, `u_waveRadius`, `u_waveThickness`.
  - Implements the $C^1$ cubic geomorph vertex swell in the vertex shader so terrain smoothly rolls upward as the wave sweeps over it.
  - Computes triplanar projection weights with $Vtx$-driven sharpness.
- **Fragment Shader**:
  - **Stage 1 & 2 Dithering**: Executes your 4×4 Bayer ordered-dither matrix against a quantized palette uniform, creating visible retro-gradient transitions.
  - **Stage 3 & 4 Normal & Caustics**: Blends normal maps with $Lx$-scaled relief, Beer-Lambert depth absorption, and dynamic caustics.
  - **Stage 5 PBR**: Metallic/Roughness evaluation.
  - **Hydrology ($Aq$) Injection**: Dynamically blends the procedural wetness darkening and specular boost when rain/flooding occurs.

---

### DELIVERABLE 3: THE UNREAL ENGINE 5.5 NANITE EXPORT BRIDGE
The project vision has a Dual-Horizon: the game runs in real time on the web (`run.studio`), but player-authored `.setmix` bundles must export to Unreal Engine 5.5 with Nanite and Lumen.

1. **`exportToUnreal(cartridge: Cartridge, opts: ExportOptions): UnrealExportPackage`** (TypeScript):
   - Bakes the procedural `TexGraph` at 4096×4096 (16-bit Heightmap/Displacement `.png`, Albedo `.png`, and packed RMA `Roughness/Metallic/AO` `.png`).
   - Generates the high-resolution dense mesh obj/gltf payload (with maximum subdivision) for Nanite.
   - Emits `manifest.ue5.json` detailing material parameters, displacement scales, and Lumen collision settings.
2. **`import_setmix_to_ue5.py`** (Unreal Editor Python API Script):
   - A standalone Python script designed to run inside Unreal Engine 5.5 (`unreal` Python module).
   - Reads `manifest.ue5.json`, imports the 4K textures, creates a `UMaterialInstanceConstant` parented to a master Nanite PBR shader, imports the mesh asset with `nanite_settings.enable_nanite = True`, and registers it into the project Content Browser (`/Game/SetMix/Imports/...`).

---

### DELIVERABLE 4: THE PROCEDURAL WEB AUDIO SYNTH (`@hm/setmix-audio`)
In your GDD, audio fidelity is diegetically bound to the Fidelity Index ($Fi$):
- Stage 1: 4-bit square-wave footsteps, 8 kHz mono, 1-pole drone.
- Stage 2: 22 kHz stereo, 3-sample material foley, wind bed.
- Stage 3: Dynamic convolution reverb driven by chunk occupancy.
- Stage 4: Underwater low-pass bus + close-mic rain foley.
- Stage 5: Procedural biome granular ambience.
- Stage 6: Adaptive harmonic score swelling with the fidelity derivative ($dFi/dt$).

Provide **`packages/audio/src/setmixAudio.ts`**:
- A pure Web Audio API (`AudioContext`) procedural sound engine with **zero external MP3/WAV assets**:
- Binds to `FidelityState` and dynamically configures bit-crushers, filters, oscillators, and convolution nodes to deliver the 6-stage audio evolution in real time.

Provide production-ready, fully typed code for all four deliverables.
```
