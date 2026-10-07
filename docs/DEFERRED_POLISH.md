# Deferred Polish & Tuning Registry

> **Purpose**: Master tracking registry for all performance tuning, visual polish, and deferred tasks across *SetMix: The Resolution Crafter*.
> **Workflow**: Lead engineers (Claude Opus / Arena Agents) focus on core systems and game loops without getting bogged down in micro-polish. Items logged here can either be tackled in the final polish pass or handed off to the pair-programming sidecar agent for immediate tuning.

---

## 1. Visual & Rendering Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-01** | **Main Menu Window Vista: Desolate Wasteland + Glitch** | Owner (2026-10-07 21:02) | The window/archway in the main menu should look out onto a **desolate wasteland** (Stage 0/1) instead of the finished lush planet, with an active **out-of-sync glitch effect** (dither flicker, chromatic aberration, CRT scanlines). | Handed to the sidecar with the menu lab: `docs/handoff/prompts/sidecar/03-menu-lab.md`. |
| **POL-02** | **Plume Ground Glow** | `SETMIX_PLAN.md` §5a | Dynamic ground lighting/glow underneath pixel plume spires. Originally written, reverted to preserve Low-spec frame rate. | Reserved for High/Ultra presets. |
| **POL-03** | **Ultra Pixel Lighting** | `SETMIX_PLAN.md` §5a | Point light emission from floating voxel particles on Ultra graphics tier. | Parked for final polish. |
| **POL-04** | **Stage 4+ Low Spec Frame Rate (49.5 $\to$ 60 FPS)** | Claude Opus / `SETMIX_PLAN.md` | Stage 4 on Low spec measures 49.5–50 FPS on laptop (governor threshold is 48 FPS). Needs capping of Low's distant planet grid lines or ground shader LOD steps. | Tuning pass before release. |
| **POL-05** | **47-Tile Blob Transition Set** | `RELEASE_PLAN.md` M4, `STATUS.md` D20 | Replace raw 4x4 Bayer transition dither with curated 47-tile autotile blob set for smooth terrain block neighbours. | Texture agent / post-loop. |
| **POL-17** | **Twin Gate Detail on the Planet** | Claude Opus (2026-10-07) | The planet's twin gate is built once at stage-1 detail; rebuild it at full detail when the plot reaches stage 2, as the machines' props are (`rebuildProps` in `apps/web/src/play/play-scene.ts`). | Sidecar. |
| **POL-06** | **Console & Mill Visual Upgrades** | Arena Battle `console-mill` | Richer 3D operator console and texture mill props from concept sheet 12. | In progress in Arena. |

---

## 2. Lab & UI Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-07** | **Amber Hologram Planet Table** | `SETMIX_PLAN.md` Phase 4, Sheet 07 | 3D holographic projection table in the lab displaying an amber volumetric wireframe/relief of the player's active 1 km plot and machine spires. | Handed to the sidecar: `docs/handoff/prompts/sidecar/02-holo-table.md`. |
| **POL-08** | **Build Menu HUD Overlap** | Claude Opus report (2026-10-07) | When the machine build menu (`B`) is open, its top elements can visually overlap the persistent top resource/level HUD bar. | Sidecar UI fix in `studio.css` / `build-menu.tsx`. |
| **POL-09** | **Gate Power-On & Sync Loss Tutorial** | Owner (2026-10-07) | Starting lab gate begins powered off. Pulling lever (E) engages power with a black-and-white dither glitch. Staying too long causes sync loss before the first machine stabilizes reality. | Planned in Quest Engine. |
| **POL-10** | **Lab Cartridge Research Stations** | `SETMIX_PLAN.md` Phase 4, Sheet 07 | Preset workbench, preset combiner, and storage rack for researching and fusing procedural cartridges in the lab. | Rules: Arena follow-up `docs/handoff/prompts/battle/cartlab.txt` (in the plotsim chat); the lab UI once it lands. |

---

## 3. Character & Avatar Pipeline

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-11** | **Scientist Sole Default Avatar** | Owner (2026-10-07 20:56) | Remove goblin and generic human from starting lab character creation. Make the Hazmat Scientist the only default choice (customizable name + visor tint). | Handed to the sidecar: `docs/handoff/prompts/sidecar/01-scientist.md`. |
| **POL-12** | **Universal 3D Avatar Drag & Drop** | `OPTIMIZATION_AND_INNOVATION.md` §4 | Allow dragging any `.glb` or `.vrm` into the Avatar Dock; auto-retarget Mixamo/VRM humanoid bones to `@hm/anim` locomotion; persist in IndexedDB. | Drag and drop into the starting creator is in sidecar task 01; retargeting to `@hm/anim` comes later. |
| **POL-18** | **Scientist Asset Stored Twice** | Claude Opus review of 1485edf2 (2026-10-08) | `apps/web/src/avatar/scientist/` holds the 1.2 MB `scientist.fbx` and the same model as a 1.6 MB base64 string in `scientist-asset.ts`, which slows the typecheck and editors. Import the .fbx with Vite `?url` (the single-file build inlines it) and delete the generated .ts. | Sidecar cleanup. |
| **POL-13** | **Running-Game Auto-Detector** | `OPTIMIZATION_AND_INNOVATION.md` §3 | Local bridge daemon scans OS process table (`UnrealEditor.exe`, `javaw.exe`, `Godot.exe`); displays green "Connected" status pill in UI or prompts "Scan for Games". | Spec complete; wire into companion daemon. |

---

## 4. Universe & Long-Term Progression

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-14** | **Rocket Engineering & Galactic Travel** | `STATUS.md` H8, H9 | Player builds a spaceship blueprint with physics presets to fly out of their solar system to the Goblin Racing planet. | Milestone 3. |
| **POL-15** | **Standalone Goblin Racing** | Owner (2026-10-06 14:05) | Separate standalone game client with goblin planet origin, goblin avatar customization, and tournament betting. | Post-Crafter launch. |
| **POL-16** | **Shared Planet Grid & Gate Dialing** | `SETMIX_WORLD.md`, `SETMIX_PLAN.md` §3 | Expanding 1 km plot grid; dial friend gates to visit neighbor plots seamlessly. | RUN SDK deployment phase. |

---

## 5. Handoff Protocol for Sidecar Agent
When Claude Opus identifies a micro-polish or tuning item that would distract from architectural progress:
1. Append the item to this document under the appropriate category.
2. In the user update, provide a single-line handoff snippet:
   `"Sidecar Task: [Item ID] - [Brief Instruction]"`
3. The Antigravity Sidecar agent will immediately implement the fix, run typechecks/tests, and push to main.
