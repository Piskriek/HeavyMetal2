# Deferred Polish & Tuning Registry

> **Purpose**: Master tracking registry for all performance tuning, visual polish, and deferred tasks across *SetMix: The Resolution Crafter*.
> **Workflow**: Lead engineers (Claude Opus / Arena Agents) focus on core systems and game loops without getting bogged down in micro-polish. Items logged here can either be tackled in the final polish pass or handed off to the pair-programming sidecar agent for immediate tuning.

---

## 1. Visual & Rendering Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-01** | **Main Menu Window Vista: Desolate Wasteland + Glitch** | Owner (2026-10-07 21:02) | The window/archway in the main menu should look out onto a **desolate wasteland** (Stage 0/1) instead of the finished lush planet, with an active **out-of-sync glitch effect** (dither flicker, chromatic aberration, CRT scanlines). | Handed to the sidecar with the menu lab: `docs/handoff/prompts/sidecar/03-menu-lab.md`. |
| **POL-02** | **Plume Ground Glow** | `SETMIX_PLAN.md` §5a | Dynamic ground lighting/glow underneath pixel plume spires. Originally written, reverted to preserve Low-spec frame rate. | **Done in TASK-08** (Sidecar, 2026-10-08): added soft colored radial ground glow under pouring machines, conforming to terrain height via additive custom blending; wired behind Graphics setting `plumeGlow` (default on for High and Ultra, off for Low and Medium to preserve 60 FPS hold); verified in `scripts/e2e-smoke.mjs` and shots `docs/shots/plume-ground-glow-off.png` and `docs/shots/plume-ground-glow-on.png`. |
| **POL-03** | **Ultra Pixel Lighting** | `SETMIX_PLAN.md` §5a | Point light emission from floating voxel particles on Ultra graphics tier. | **Done in TASK-08** (Sidecar, 2026-10-08): added dynamic colored PointLight emission at the vent/plume of each pouring pixel machine with organic flicker and plume drift; wired behind Graphics setting `pixelLights` (default true on Ultra, false on Potato/Low/Med/High); verified in `scripts/e2e-smoke.mjs` and shots `docs/shots/pixel-light-off.png` and `docs/shots/pixel-light-on.png`. |
| **POL-04** | **Stage 4+ Low Spec Frame Rate (49.5 $\to$ 60 FPS)** | Claude Opus / `SETMIX_PLAN.md` | Stage 4 on Low spec measures 49.5–50 FPS on laptop (governor threshold is 48 FPS). Needs capping of Low's distant planet grid lines or ground shader LOD steps. | **Done in TASK-08** (Sidecar, 2026-10-08): capped `PLANET_LINES['low']` to 480 (from 720) and Potato to 360, preventing `cellPx` from halving to 1 on 720p/768p displays (slashes fillrate by 75% at Stage 4 while preserving 24-bit unquantized colors, sharper normal relief, specular, and water); reduced `GROUND_BUDGET.low` from 90k to 75k tris; verified 60 FPS hold in `scripts/e2e-smoke.mjs` and shot `docs/shots/play-stage-4-low.png`. |
| **POL-05** | **47-Tile Blob Transition Set** | `RELEASE_PLAN.md` M4, `STATUS.md` D20 | Replace raw 4x4 Bayer transition dither with curated 47-tile autotile blob set for smooth terrain block neighbours. | Texture agent / post-loop. |
| **POL-17** | **Twin Gate Detail on the Planet** | Claude Opus (2026-10-07) | The planet's twin gate is built once at stage-1 detail; rebuild it at full detail when the plot reaches stage 2, as the machines' props are (`rebuildProps` in `apps/web/src/play/play-scene.ts`). | **Done in TASK-08** (Sidecar, 2026-10-08): `rebuildTwin` rebuilds the twin gate at stage 6 (full detail) on reaching stage 2, preserving footing and opening mark; verified in `scripts/e2e-smoke.mjs` and shots `docs/shots/twin-gate-stage-1.png` and `docs/shots/twin-gate-stage-2.png`. |
| **POL-06** | **Console & Mill Visual Upgrades** | Arena Battle `console-mill` | Richer 3D operator console and texture mill props from concept sheet 12. | **Done in TASK-08** (Sidecar, 2026-10-08): swapped `@hm/consolemill` operator console into `apps/web/src/play/lab-room.ts` (preserving lever and CRT screen hooks) and texture mill into `apps/web/src/play/machine-props.ts` (preserving power, stack, and lamp hooks); verified in `scripts/e2e-smoke.mjs` and shots `docs/shots/console-before.png`, `docs/shots/console-after.png`, `docs/shots/mill-before.png`, `docs/shots/mill-after.png`. |

---

## 2. Lab & UI Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-07** | **Amber Hologram Planet Table** | `SETMIX_PLAN.md` Phase 4, Sheet 07 | 3D holographic projection table in the lab displaying an amber volumetric wireframe/relief of the player's active 1 km plot and machine spires. | Handed to the sidecar: `docs/handoff/prompts/sidecar/02-holo-table.md`. |
| **POL-08** | **Build Menu HUD Overlap** | Claude Opus report (2026-10-07) | When the machine build menu (`B`) is open, its top elements can visually overlap the persistent top resource/level HUD bar. | **Done in TASK-08** (Sidecar, 2026-10-08): tuned `.play-build` max-height to `min(65vh, calc(100vh - 170px))` with `z-index: 4` and centered in open space beside plot HUD on 1024–1440px (`min(680px, calc(100vw - 360px))`); verified zero overlap across 1280x720, 1366x768, and 1920x1080 in `e2e-smoke.mjs` and `docs/shots/play-build-menu.png`. |
| **POL-09** | **Gate Power-On & Sync Loss Tutorial** | Owner (2026-10-07) | Starting lab gate begins powered off. Pulling lever (E) engages power with a black-and-white dither glitch. Staying too long causes sync loss before the first machine stabilizes reality. | Planned in Quest Engine. |
| **POL-10** | **Lab Cartridge Research Stations** | `SETMIX_PLAN.md` Phase 4, Sheet 07 | Preset workbench, preset combiner, and storage rack for researching and fusing procedural cartridges in the lab. | Rules: Arena follow-up `docs/handoff/prompts/battle/cartlab.txt` (in the plotsim chat); the lab UI once it lands. |

---

## 3. Character & Avatar Pipeline

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-11** | **Scientist Sole Default Avatar** | Owner (2026-10-07 20:56) | Remove goblin and generic human from starting lab character creation. Make the Hazmat Scientist the only default choice (customizable name + visor tint). | Handed to the sidecar: `docs/handoff/prompts/sidecar/01-scientist.md`. |
| **POL-12** | **Universal 3D Avatar Drag & Drop** | `OPTIMIZATION_AND_INNOVATION.md` §4 | Allow dragging any `.glb` or `.vrm` into the Avatar Dock; auto-retarget Mixamo/VRM humanoid bones to `@hm/anim` locomotion; persist in IndexedDB. | Drag and drop into the starting creator is in sidecar task 01; retargeting to `@hm/anim` comes later. |
| **POL-18** | **Scientist Asset Stored Twice** | Claude Opus review of 1485edf2 (2026-10-08) | `apps/web/src/avatar/scientist/` holds the 1.2 MB `scientist.fbx` and the same model as a 1.6 MB base64 string in `scientist-asset.ts`, which slows the typecheck and editors. Import the .fbx with Vite `?url` (the single-file build inlines it) and delete the generated .ts. | **Done in TASK-07** (Sidecar, 2026-10-08): removed `scientist-asset.ts`, `.fbx` imported via `?url` with node fallback. |
| **POL-19** | **Hologram Reads Weak** | Claude Opus review of c1ca6c16 (2026-10-08), `docs/shots/play-holo-table.png` | The projection disc is a flat saturated orange that outshines the pale relief floating above it. Per sheet 07 the relief is the bright thing: dim the disc to a glow, and give the relief stronger contour lines and a lit rim so the plot's hills read from 2 m. | **Done in TASK-08** (Sidecar, 2026-10-08): dimmed table disc to soft glow (emissive 0.22, dark `#120c02`), relief shaded with major/minor contour lines, lit rim Fresnel, and luminous boundary ring; verified in `docs/shots/play-holo-table.png`. |
| **POL-20** | **Trees Need Shaping** (mostly done 2026-10-08: treegen v2 replaced v1; left: the oak could spread wider) | Claude Opus review of `@hm/treegen` v1 (Arena, 2026-10-08) | The skeleton, budgets and detail ladder are right, but the look is not yet a grown forest: the oak's limbs curl into loops like springs (space colonisation pulling branches round), crowns are sparse, and trunks run long under small crowns. Tune the growth (segment length, kill distance, upward tropism, crown envelope per species) and denser leaf clusters; judge against sheets 08 and 10. | A later Arena follow-up or Sidecar, with screenshots. |
| **POL-21** | **scenedoc Edits Copy the Whole Document** | Claude Opus review of `@hm/scenedoc` (2026-10-08) | One edit on a 10 000-node document costs about 15 ms (a thousand took about 15 s): every change copies the whole node record. In a big Studio scene a slider drag would cost a frame per change. Use a persistent map or per-transaction drafts with structural sharing; keep the tests. | Before the Studio's scenes get big (S2). |
| **POL-22** | **The Lab Below 60 fps on Low with the Scientist** | Sidecar TASK-07 report (2026-10-08) | The lab measured 56.8 fps on Low, the plot 60.6, after the animated scientist (about 33k triangles, skinned) arrived. Give the scientist a Low level of detail (a decimated mesh, fewer influences), skip it entirely in first person unless its shadow is drawn, and measure again. | Sidecar (TASK-08 pass). |
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
