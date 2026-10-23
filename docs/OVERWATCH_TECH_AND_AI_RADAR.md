# FIDELITY // OVERWATCH CRITIQUE: MODULAR PRESET INCEPTION & AI/TECH RADAR
> **Role**: Standing Overwatch Audit & Technology Radar (executed whenever Antigravity / Overwatch is activated).  
> **Mandate**:
> 1. Audit all active and completed jobs in [`docs/JOB_BOARD.md`](JOB_BOARD.md) and [`docs/DEFERRED_POLISH_REGISTRY.md`](DEFERRED_POLISH_REGISTRY.md) for planning gaps, hidden bugs, or drift away from **"Modular Preset Inception"** (*every object in the Stargate campaign is built from recursive Studio presets that players can customize with sliders + 3D previews in-game and control completely in the Studio*).
> 2. Track fast-moving developments in **AI Agent Skills, WebGL2/WebGPU Visual Fidelity, and Logical/Spatial Optimization**, translating them into concrete, pure-function upgrades for the codebase.

---

## PART 1: "MODULAR PRESET INCEPTION" CRITIQUE OF CURRENT JOBS & CODEBASE (2026-10-22)

An end-to-end codebase inspection against [`docs/JOB_BOARD.md`](JOB_BOARD.md) exposed **7 critical bugs and "Modular Preset Inception" gaps** where current code or job briefs still rely on one-off hardcoded meshes or baked GLB blobs instead of the Studio's modular preset stack (`@hm/partgen` + `@hm/meshops` + `@hm/kitspec` + `@hm/matstack` + `@hm/texgraph` + `@hm/treegen` + `lx:` lights):

### 1. CRITICAL INCEPTION GAP: Cartridge `Apply` Only Hits 1 Object in the Lab (`capacitor-bank`) & 0 on the Planet by Default
- **Where in Code**:
  - [`apps/web/src/play/lab-room.ts`](../apps/web/src/play/lab-room.ts#L797-L799): The Lab's `kits` map contains **only** `['capacitor-bank', ...]`. Every other Lab station (Preset Bench, Combiner, Hardware Fabricator, Operator Console, Planet Table, Stargate, Armory Rack, Relay Cabinets) is excluded from `kits`.
  - [`apps/web/src/play/plot-kits.ts`](../apps/web/src/play/plot-kits.ts#L38): `let kitFrames = false;` is disabled by default, and [`apps/web/src/play/machine-props.ts`](../apps/web/src/play/machine-props.ts#L483-L721) falls back to baked `getGenSync()` GLBs or legacy `@hm/fieldkit` meshes for all 11 machine kinds (`drill`, `mill`, `press`, `water`, `projector`, `power`, `pylon`, and the 4 heavies).
- **Impact**: If a player prints a Part Cartridge (`part:`), Material Cartridge (`matc:`), or Light Cartridge (`lx:`) and fires their Beam Rifle (`Apply` mode) at any machine on the Moon Plot, any Lab station other than the Capacitor Bank, any vehicle, any base wall/door, or the Stargate, `aimKitPart()` returns `null`.
- **Correction Added (`JOB-08` & `JOB-17`)**:
  - Replace all 11 plot machine props, all Lab stations, the Twin/Lab Stargate, and all 3 vehicles with live `@hm/kitspec` assemblies registered in `aimKitPart()` / `setKitOverrides()` so **every machine, station, vehicle, and gate in the game is cartridge-targetable**.

### 2. CRITICAL INCEPTION GAP: Vehicles (`scout`, `hauler`, `crawler`) Bypass `@hm/kitspec` in Live Play
- **Where in Code**:
  - [`apps/web/src/play/kit-hauler.ts`](../apps/web/src/play/kit-hauler.ts) (`HAULER_KIT`) and [`apps/web/src/play/kit-crawler.ts`](../apps/web/src/play/kit-crawler.ts) (`CRAWLER_KIT`) are **only imported in `kits.test.ts`**—they are never called by [`createGenRover()`](../apps/web/src/assets/gen-props.ts#L369-L464)!
  - Even inside `HAULER_KIT` and `CRAWLER_KIT`, parts still use legacy shortcuts: `hauler-wheel` and `crawler-arm` use `{ kind: 'gen' }` baked GLBs, and `track-pod`, `cab-shell`, and `cargo-bed` misuse the capacitor `'can'` generator with flat `hull-steel` colours instead of `@hm/partgen`'s real `'wheel'` and `'track-pod'` generators, `@hm/matstack` (`mat:`), and `lx:` headlamps.
  - Meanwhile, [`assembleScoutBody()`](../apps/web/src/assets/gen-props.ts#L292-L346) ("Modular Scout" from `TICKET-19` / `POL-50`) assembles 4 static GLBs (`scout-chassis`, `scout-shell`, `headlight`, `vehicle-seat`) with non-uniform axis scaling (`[0.6977, 1, 1.0945]`) and hardcoded `THREE.BoxGeometry` instead of a `@hm/kitspec` `SCOUT_KIT`.
- **Correction Added (`JOB-08` & `JOB-17`)**:
  - Author pure `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` + `lx:` assemblies for `SCOUT_KIT`, `HAULER_KIT`, and `CRAWLER_KIT`, wire them into `createGenRover()`, and expose their `KitBuild` to `aimKitPart()` on the plot.

### 3. CRITICAL INCEPTION GAP: Base-Building Lattice Pieces (`@hm/structure`) Use 4 Competing Non-Preset Paths
- **Where in Code**: [`apps/web/src/base/kit-pieces.ts`](../apps/web/src/base/kit-pieces.ts#L126-L189) mixes:
  1. Legacy `@hm/basekit` / `@hm/basekit2` procedural slabs
  2. `panel-pieces.ts` (`GUNMETAL_KINDS`: `windowWall`, `door`, `halfWall`, `gable`) with hardcoded `BoxGeometry` lintels
  3. `swapLatticeMesh()` swapping in 18 baked GLBs (`assets/gen/<id>.glb`)
  4. `foundation-frame.ts` hardcoded `BoxGeometry` frames
- **Impact**: Players cannot fire Material Cartridges (`matc:`), Part Cartridges (`part:`), or Light Cartridges (`lx:`) to restyle their base walls, doors, foundations, roofs, or hardpoints, nor can they open base pieces as `@hm/kitspec` assemblies in the Studio.
- **Correction Added (`JOB-17`)**:
  - Define `@hm/kitspec` + `@hm/matstack` presets for core base-building pieces (starting with `wall`, `windowWall`, `door`, `foundation`, `hardpoint`, `turret`) and allow `aimKitPart()` to target built base structures so players can reskin a single wall panel (tap) or all walls of the same material (hold).

### 4. DESIGN DRIFT IN `machine-props.ts`: Hardcoded `HOUSING_LED_ANCHOR` + 76-Ray `ledMount()` Search Instead of a `statusLed` Kit Socket + `lx:` Preset
- **Where in Code**: [`apps/web/src/play/machine-props.ts`](../apps/web/src/play/machine-props.ts#L30-L42) and [`ledMount()`](../apps/web/src/play/machine-props.ts#L303-L344).
- **Critique**: Because machines were built from opaque GLBs, `fitToTable()` casts up to 76 rays at boot to glue a hardcoded `THREE.BoxGeometry` LED onto the mesh. In a true `@hm/kitspec` machine (`MILL_V2`, etc.), the status lamp is a **`lamp` part (`@hm/partgen`) mounted on a named `statusLed` socket with an `lx:` Light Preset**, eliminating runtime raycast searching.

### 5. CONCRETE CODE BUGS FOUND DURING AUDIT
- **Bug A — Inverted & Dead Duplicate `MACHINE_PLUME_GRAVITY` in [`apps/web/src/play/machine-props.ts`](../apps/web/src/play/machine-props.ts#L742-L755)**:
  - Lines 121–132 define `MACHINE_PLUME_SPECS[kind].gravity` with **positive = downward fall** (`drill: 4.5`, `press: 0.2`) and **negative = buoyant lift** (`mill: -0.4`), which `machinePlumeGravity()` (line 211) uses.
  - Lines 742–755 export a second constant `MACHINE_PLUME_GRAVITY` with **inverted signs** (`drill: -3.6`, `mill: 0.35`) that is never called anywhere.
- **Bug B — `POL-76` Marked "Deleted" in `DEFERRED_POLISH_REGISTRY.md` (Line 82), But Still Present in [`apps/web/src/assets/gen-props.ts`](../apps/web/src/assets/gen-props.ts#L536-L644)**:
  - `createGenMachineProp()` (109 lines of dead unscaled fallback code) is still in `gen-props.ts`.
- **Bug C — `POL-23`, `POL-103` & `POL-121` Reference Old Image-to-GLB Re-Baking Instead of `@hm/kitspec` Presets**:
  - `POL-121` ("re-image `operator-console` and re-run the model batch"), `POL-103` (east-wall placeholder box), and `POL-23` (Anomaly Field Nodes) must be built as **parametric `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` assemblies**, never new baked `.glb` blobs (`RULES 8a`).

### 6. PLAN 42 (`JOB-07`) INCEPTION UPGRADE: `STARGATE_KIT` & `PlotBiomePreset`
- **Critique of `JOB-07`**: `JOB-07` wired `moveGate`, `setGateAccess`, `dialRandomGate`, and `isEarthSandboxUnlocked(stage)` at the state/UI level, but did not require:
  1. **`STARGATE_KIT` (`@hm/kitspec`)**: The Stargate ring, 9 chevrons (`lx:` emissive presets), dialing pedestal, and physical **Iris shield** (which closes over the aperture when `gateAccess === 'closed'` or `'code-only'`) built from modular parts so plot owners can customize their Gate's material (`matc:`), chevron colour (`lx:`), and ring segments (`part:`).
  2. **Earth & Moon `PlotBiomePreset`**: Restoring Earth at Stage 6 unlocks a full **Biome Preset Recipe** (Terrain `matstack` + 6 Species `treegen` slots + Sky/Sun `lx:` preset) that players can tweak and share via code on both their Earth Plot and Moon Plot.

---

## PART 2: STANDING AI SKILLS, VISUAL FIDELITY & LOGICAL OPTIMIZATION RADAR

### A. AI Agent Skills & Vision-in-the-Loop Procedural Workflows (2025–2026 Frontier)
1. **Closed-Loop "Vision + Coverage + Spatial Validator" Playbooks (`CADCodeVerify` / Procedural Material Graph Agents)**:
   - **Industry Shift**: One-shot LLM generation of 3D meshes or shader graphs consistently drifts in scale, alignment, or noise coverage (as seen in `TICKET-40` v1–v4 where `rust-bloom` hit 67% coverage and `soot` hit 0%). State-of-the-art 3D/material agents use **deterministic numeric pre-gates + 4-angle + mask-channel vision-in-the-loop verification**.
   - **Direct Application to `JOB-06` (`Plan 40 BYOA` & `studio-skill.md`)**:
     - Add `studio.material.coverage(spec)` (returning exact % coverage on `top`, `side`, `edge`, `crevice`, `bottom` zones) alongside `studio.kit.validate(kit)` (checking 0 floating parts > 5 mm, 0 unresolved `mat:`/`lx:`/`vault:` ids, and socket contact) and `studio.capture({ mode: 'turntable4', includeStaged: true, maskView })`.
     - Encode a mandatory **4-Step Agent Verification Loop** in `studio-skill.md` so any external Claude/Gemini/OpenAI agent connected via `window.studioAgent` self-corrects before asking the human to accept changes.
2. **Hierarchical Composable Preset Grammar ("Inception" Schema)**:
   - Every Studio asset follows one unified 5-rung ladder:
     $$\text{Tile Graph } (\texttt{@hm/texgraph}) \to \text{Material Stack } (\texttt{@hm/matstack}) \to \text{Part + MeshOps } (\texttt{@hm/partgen} + \texttt{@hm/meshops}) \to \text{Kit Assembly } (\texttt{@hm/kitspec}) \to \text{Plot / Biome Scene } (\texttt{@hm/scenedoc})$$
   - Because every rung is a pure JSON spec + deterministic seed, any AI agent or player slider can mutate any rung without breaking higher or lower rungs.

### B. Visual Fidelity Upgrades (Retro $S_0 \to$ PBR $S_6$)
1. **Perceptually Uniform OKLab Quantization & Dithering (`POL-49` & `POL-102`)**:
   - **Problem**: Quantizing colours in linear RGB or sRGB causes hue shifts toward salmon/mauve in dusk lighting (`POL-102` at `storm = 0.5`) and high pixel-flip rates on slight camera rotation (`POL-49`: 16.5% flip on 5° yaw vs 10% target).
   - **Upgrade**: Perform Stage 1 (EGA 16-colour) and Stage 2 (VGA 256-colour) nearest-palette matching and dusk tint clamping in **OKLab space** (Björn Ottosson's fast $3\times 3$ LMS cube-root matrix in GLSL), and damp world-normal derivatives (`fwidth(vWorldNormal)`) before applying the tri-planar Bayer threshold.
2. **Screen-Space Derivative Micro-Cavity (`dFdx(vNormal)` / `dFdy(vNormal)`) for Rank-1/2 Modular Parts**:
   - **Upgrade**: In `layered-material.ts`, modulating ambient occlusion by a cheap screen-space normal-derivative cavity term (`clamp(dot(dFdx(N), dFdx(N)) + dot(dFdy(N), dFdy(N)), 0.0, 1.0)`) makes `@hm/meshops` bevels, panel seams, and bolt heads pop crisply at Stage 4–6 with **zero extra texture fetches and zero extra geometry**.

### C. Logical & GPU Performance Optimizations (GTX 950M 60 FPS Target)
1. **Two-Level AABB / BVH Accelerated Raycasting for `aimKitPart()`**:
   - **Problem**: [`aimKitPart()`](../apps/web/src/play/play-scene.ts#L4210) currently runs Three.js's $O(N_{\text{tris}})$ CPU raycast on every visible kit mesh whenever the player aims the Beam Rifle. Scaling kits to all machines, base walls, and vehicles will cause CPU frame spikes.
   - **Upgrade**: Store the precomputed world AABB on each `KitBuild` and each `PlacedPart` (already computed by `@hm/kitspec` `flatten()`), testing the ray against the kit's outer AABB first and part AABBs second before intersecting triangle ranges.
2. **Material Uniform Packing & Shared Shader Programs (`layered-material.ts`)**:
   - **Upgrade**: Cache compiled `layeredMaterial(id, rank)` instances by `(canonicalCode, rank)` and pack layer constants into compact `vec4` uniform arrays so all machines and base pieces wearing the same `@hm/matstack` preset share a single WebGLProgram and can be merged/batched per material slot.

---

## PART 3: RECURRING OVERWATCH CHECKLIST (RUN ON EVERY SESSION WAKE)
Whenever Antigravity / Overwatch is activated:
1. **Check Git & Board**: Run `git status -s` and `node scripts/agent-worker.mjs --list`.
2. **Preset Inception Audit**: Verify no new `.glb` blobs, wrapper frames, or hardcoded `THREE.BoxGeometry` / `MeshStandardMaterial` props were introduced where `@hm/partgen` + `@hm/kitspec` + `@hm/matstack` + `lx:` presets belong.
3. **Update Tech & AI Radar**: Review open jobs against this document (`docs/OVERWATCH_TECH_AND_AI_RADAR.md`) and refine job briefs so agents execute with zero architectural drift.
