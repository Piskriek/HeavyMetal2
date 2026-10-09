# FIDELITY // DEFERRED POLISH & TUNING REGISTRY
> **Purpose**: Master tracking registry for all performance tuning, visual polish, and deferred tasks across *FIDELITY: The SetMix Multiverse*.  
> **Workflow**: Lead engineers (Claude Opus / Arena Agents) focus on core systems and game loops without getting bogged down in micro-polish. Items logged here can either be tackled in the final polish pass or handed off to the pair-programming sidecar agent for immediate tuning.  

---

## 1. Visual & Rendering Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-01** | **Main Menu Window Vista: Desolate Wasteland + Glitch** | Owner (2026-10-07 21:02) | The window/archway in the main menu should look out onto a **desolate wasteland** (Stage 0/1) instead of the finished lush planet, with an active **out-of-sync glitch effect** (dither flicker, chromatic aberration, CRT scanlines). | Handed to sidecar. |
| **POL-02** | **Plume Ground Glow** | Owner / Optimization Spec | Dynamic ground lighting/glow underneath pixel plume spires. Originally written, reverted to preserve Low-spec frame rate. | **Done in TASK-08** (Sidecar, 2026-10-08): added soft colored radial ground glow under pouring machines, conforming to terrain height via additive custom blending; wired behind Graphics setting `plumeGlow`. |
| **POL-03** | **Ultra Pixel Lighting** | Owner / Optimization Spec | Point light emission from floating voxel particles on Ultra graphics tier. | **Done in TASK-08** (Sidecar, 2026-10-08): added dynamic colored PointLight emission at the vent/plume of each pouring pixel machine with organic flicker; wired behind Graphics setting `pixelLights`. |
| **POL-04** | **Stage 4+ Low Spec Frame Rate (49.5 $\to$ 60 FPS)** | Claude Opus / Baseline Spec | Stage 4 on Low spec measures 49.5–50 FPS on laptop (governor threshold is 48 FPS). Needs capping of Low's distant planet grid lines or ground shader LOD steps. | **Done in TASK-08** (Sidecar, 2026-10-08): capped `PLANET_LINES['low']` to 480 (from 720) and Potato to 360, preventing fillrate penalty; reduced `GROUND_BUDGET.low` to 75k tris; verified 60 FPS hold. |
| **POL-05** | **47-Tile Blob Transition Set** | Terrain Specification | Replace raw 4x4 Bayer transition dither with curated 47-tile autotile blob set for smooth terrain block neighbours. | Texture pipeline pass. |
| **POL-17** | **Twin Gate Detail on the Planet** | Claude Opus (2026-10-07) | The planet's twin gate is built once at stage-1 detail; rebuild it at full detail when the plot reaches stage 2. | **Done in TASK-08** (Sidecar, 2026-10-08): `rebuildTwin` rebuilds twin gate at stage 6 on reaching stage 2. |
| **POL-06** | **Console & Mill Visual Upgrades** | Arena Battle `console-mill` | Richer 3D operator console and texture mill props from concept sheet 12. | **Done in TASK-08** (Sidecar, 2026-10-08): swapped `@hm/consolemill` operator console into lab room and texture mill into machine props. |

---

## 2. Lab & UI Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-07** | **Amber Hologram Planet Table** | Sheet 07 / Lab Spec | 3D holographic projection table in the lab displaying an amber volumetric wireframe/relief of the player's active 1 km plot and machine spires. | Handed to sidecar. |
| **POL-08** | **Build Menu HUD Overlap** | Claude Opus report (2026-10-07) | When the machine build menu (`B`) is open, its top elements can visually overlap the persistent top resource/level HUD bar. | **Done in TASK-08** (Sidecar, 2026-10-08): tuned `.play-build` max-height to `min(65vh, calc(100vh - 170px))` with `z-index: 4`. |
| **POL-09** | **Gate Power-On & Sync Loss Tutorial** | Owner (2026-10-07) | Starting lab gate begins powered off. Pulling lever (E) engages power with a black-and-white dither glitch. Staying too long causes sync loss before first machine stabilizes reality. | Planned in Quest Engine. |
| **POL-10** | **Lab Cartridge Research Stations** | Sheet 07 / Lab Spec | Preset workbench, preset combiner, and storage rack for researching and fusing procedural cartridges in the lab. | Lab UI integration pass. |

---

## 3. Character & Avatar Pipeline

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-11** | **Scientist Sole Default Avatar** | Owner (2026-10-07 20:56) | Hazmat Scientist is the ONLY default starting choice (customizable name + visor tint). | **Done**: Wired into avatar system and initial flow. |
| **POL-12** | **Universal 3D Avatar Drag & Drop** | Optimization Spec §4 | Allow dragging any `.glb` or `.vrm` into the Avatar Dock; auto-retarget Mixamo/VRM humanoid bones to `@hm/anim` locomotion; persist in IndexedDB. | In avatar dock. |
| **POL-18** | **Scientist Asset Stored Twice** | Claude Opus review (2026-10-08) | `apps/web/src/avatar/scientist/` holds `scientist.fbx` and duplicate base64 string in `scientist-asset.ts`. Import .fbx with Vite `?url` and delete generated .ts. | **Done in TASK-07** (Sidecar, 2026-10-08). |
| **POL-19** | **Hologram Reads Weak** | Claude Opus review (2026-10-08) | Projection disc is flat saturated orange that outshines pale relief above it. Dim disc to glow and give relief stronger contour lines and lit rim. | **Done in TASK-08** (Sidecar, 2026-10-08): dimmed table disc to soft glow; relief shaded with contour lines and luminous boundary ring. |
| **POL-20** | **Oak Crown Envelope Spreading** | Claude Opus review (2026-10-08) | The oak in `@hm/treegen` could spread wider so it reads as a spreading oak next to pine and birch. | **Done in TASK-08** (Sidecar, 2026-10-08): widened oak crown envelope radius (`crownR: 0.48`). |
| **POL-21** | **scenedoc Edits Copy the Whole Document** | Claude Opus review (2026-10-08) | One edit on a 10,000-node document copies the whole node record. In a big Studio scene a slider drag would cost a frame per change. Use persistent map or per-transaction drafts with structural sharing. | Before Studio scenes expand. |
| **POL-22** | **The Lab Below 60 fps on Low with the Scientist** | Sidecar TASK-07 report | Give the scientist a Low level of detail mesh with fewer influences, skip entirely in first person unless shadow is drawn. | Polish pass. |
| **POL-13** | **Running-Game Auto-Detector** | Optimization Spec §3 | Local bridge daemon scans OS process table (`UnrealEditor.exe`, `javaw.exe`, `Godot.exe`); displays green "Connected" status pill in UI. | Companion daemon integration. |

---

## 4. Universe & Long-Term Progression

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-14** | **Inter-Planetary Spaceflight & Galactic Traversal** | Long-Term Vision | Player constructs spaceship blueprint with physics presets to fly out of lunar orbit to other celestial bodies in the SetMix Multiverse. | Multiverse Milestone. |
| **POL-16** | **Shared Planet Grid & Gate Dialing** | Planetary Grid Spec | Expanding 1 km plot grid; dial friend gates to visit neighbor plots seamlessly. | Networking phase. |

---

## 5. Handoff Protocol for Sidecar Agent
When Claude Opus identifies a micro-polish or tuning item that would distract from architectural progress:
1. Append the item to this document under the appropriate category.
2. In the user update, provide a single-line handoff snippet:
   `"Sidecar Task: [Item ID] - [Brief Instruction]"`
3. The Antigravity Sidecar agent will immediately implement the fix, run typechecks/tests, and push to main.
