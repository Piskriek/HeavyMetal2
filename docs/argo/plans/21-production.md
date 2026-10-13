# 21 — Production, Asset Pipeline, Quality Bars, Budgets & Milestones Plan

## 1. The Goal: Ship a 60 FPS Single-File Build (`< 18 MB`) with an Optional HD Pack and Zero Rule-Breaking Assets

Our production pipeline combines four engines working in concert: **Claude Opus** (architecture, briefs, reviews, asset pipeline), **Claude Haiku sidecars** (sequential brief implementation), **Arena.ai battles** (pure TypeScript modules), and the **RUN.world $	o$ local Hunyuan3D (`192.168.0.9:8082`) $	o$ Blender 3-LOD bake pipeline** ([`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §7, [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md) §3).

Right now, two production risks stand out:
1. **Bundle Size Watch (`POL-27`):** The single-file build `dist/index.html` is at **17.9–18.0 MB** ([`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, [`docs/DEFERRED_POLISH_REGISTRY.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/DEFERRED_POLISH_REGISTRY.md)), and an overnight batch of 40 subjects × 2 options (`~80 models` in `zips/runworld/overnight-ids.txt`) is finishing. Packing dozens more inline `low.glb` assets without a strict budget cap will push `index.html` past 25–30 MB and stall startup parse times on the GTX 950M laptop.
2. **Automated Quality Gates for Creative Polish:** While `npm run typecheck`, `npm test`, and `npm run e2e` verify that code compiles and runs, visual regressions (like the near-black avatar in `14-beam-third-person.jpg`, the 3-way HUD overlap in `07-moon-stage0.jpg`, or rule-breaking meshes) only get caught when Opus or the owner manually eyeballs screenshots.

Our goal is to enforce hard **Triangle, Memory, Bundle, and Frame-Time Budgets**, establish a **5-Point Asset Acceptance Gate** for the overnight batch, and sequence the exact **Post-TASK-24 Production Milestones** so every creative plan in `docs/argo/plans/` lands cleanly.

## 2. Where It Stands Today

- **What Exists:**
  - **114 generated 3D models** packed in [`apps/web/src/assets/gen/registry.json`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) (`low.glb` inline in `apps/web/src/assets/gen/`, `mid.glb` and `high.glb` in `apps/web/public/hd/<id>/` via Git LFS).
  - **38 legal monsters** imported from *Freedoom*, *Blasphemer*, *LibreQuake*, and *Quaternius* (`docs/monsters/`, [`CREDITS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/CREDITS.md)).
  - **Active Queue (`START_HERE.md` §4):** `TASK-21c/d` (avatar lighting, rifle anims, Sculpt, saving) $	o$ `TASK-22` (Acts IV–VI quests) $	o$ `TASK-23b` (monsters in game) $	o$ `TASK-23c` (props in world) $	o$ `TASK-24` (full e2e test suite, then merge `feat/monster-mash-exploration` to `main`).
  - **Overnight Asset Batch (`RESUME.md` §7):** 40 subjects × 2 options (`<id>-a`, `<id>-b`) in `zips/runworld/overnight-ids.txt` awaiting 4-angle review and selection.
- **What Is Weak or Missing:**
  - **`dist/index.html` Size Ceiling (`17.9 MB`, `POL-27`):** Inline base64/binary assets (114 `low.glb` meshes + embedded VO/audio + WAD lumps) are approaching the browser single-HTML parse sweet spot on low-spec laptops.
  - **No Automated Visual/Luminance Check in `TASK-24`:** `e2e` takes screenshots (`docs/argo/tour/*.jpg`), but does not assert that the player avatar's mean pixel luminance is `> 15%` (catching black-bake bugs) or that HUD bounding boxes have `0 px²` intersection.

## 3. What the Best Productions Do (Research & Sources)

| Industry Practice / Reference | Production & Optimization Technique | Why It Fits Our Pipeline |
| :--- | :--- | :--- |
| ** Core + Streaming HD Pack Architecture (Rule 3: `"Lean file + HD pack"`)** | Keep the single-file `dist/index.html` strictly under a **16.0 MB hard ceiling** by quantizing inline `low.glb` vertex positions to `Int16` (`EXT_meshopt_compression` / quantized attributes + `128×128` indexed/JPEG-baked colour maps) while streaming `mid.glb`, `high.glb`, and non-Act-I voiceover files on-demand from the adjacent `hd/` folder with a visible preload bar (Rule 22). | Cuts inline per-model footprint from `~95 KB` to `~28 KB`, allowing 150+ unique models inside `index.html` while actually *shrinking* total file size from `18 MB` to `~13.5 MB`. |
| **Automated Screenshot Histogram & DOM Box Assertions in E2E (`Playwright` / `Puppeteer`)** | During `npm run e2e`, query `getBoundingClientRect()` on all visible `[data-hud-zone]` elements to fail the test if any two HUD boxes overlap by `> 2 px`, and sample the center-screen avatar pixel patch in `14-beam-third-person.jpg` to assert mean luminance `> 0.12`. | Prevents HUD overlaps (`07-moon-stage0.jpg`) and black-model regressions (`14-beam-third-person.jpg`) from ever slipping past a sidecar commit again. |

## 4. Concrete Changes, Budgets & Milestones Ranked P0, P1, and P2

### Hard Technical & Art Budgets (Enforced by `scripts/verify.mjs` & `scripts/perf.mjs`)

| Budget Category | Low Spec Target (`GTX 950M Laptop @ 60 FPS`) | High / Ultra Spec Target (`RTX 3080 Desktop`) | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Frame Time & Draw Calls** | `<= 16.6 ms` (`60 FPS` hard floor), `<= 95` draw calls, `<= 180k` active triangles (Scene + `1.5 ms` Window Vista). | `<= 8.3 ms` (`120 FPS`), `<= 250` draw calls, `<= 1.2M` triangles (`high.glb` + dynamic shadows + `POL-02/03` plume lights). | `scripts/perf.mjs` + runtime `Auto` tier governor (`POL-04`). |
| **Per-Asset Triangle Budgets (`runworld-post.mjs`)** | **Small prop/clutter:** `Low <= 350 tris` \| **Medium machine/rover:** `Low <= 900 tris` \| **Large vista/heavy terraformer:** `Low <= 1,500 tris`. | **Mid:** `2.5x Low` (`800–3,500 tris`) \| **High:** `6x Low` (`2,000–9,000 tris`) with `1024²` normal/albedo maps in `public/hd/<id>/`. | Checked automatically in `scripts/runworld-post.mjs` before packing. |
| **Single-File Bundle (`dist/index.html`, `POL-27`)** | **Hard Cap: `16.0 MB` (Target: `13.5 MB`)**. Inline `low.glb` average `<= 35 KB` via `Int16` quantized vertices + `128px/256px` baked atlas; procedural Web Audio SFX (`0 MB`). | Optional `public/hd/` pack streams `mid.glb`, `high.glb`, and Act IV–VI VO archives behind a smooth preload bar (Rule 22). | `scripts/verify.mjs` fails if `dist/index.html > 16.5 MB`. |
| **RUN.world Credit Reserve** | Maintain `>= 16,000` credits (`RUNWORLD_FLOOR` in [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)) reserved for Dr. Haddy voiceover; image generation costs `~120 credits/image` from the `66.4k` balance. | Use end-of-month resetting **Meshy.ai API credits** for experimental Tier-4 max-detail containment leak restorations (`RESUME.md` §7). | Checked by `scripts/runworld-assets.mjs` before dispatching jobs. |

### The 5-Point Asset Acceptance Gate (For Triage of the 80-Model Overnight Batch)

Before any `<id>-a` or `<id>-b` model from `zips/runworld/overnight-ids.txt` is packed via `node scripts/runworld-pack.mjs`:
1. **Four-Angle Render Check (Rule 17):** Run `blender -b --factory-startup -P scripts/render-angles.py` on both `-a` and `-b`. Reject or flag with `fix: ['mirror-z' | 'plain-back']` any model with an invented, hollowed, or black back face.
2. **Square-Section & Chunky Silhouette Check (Rules 11, 15):** Reject any option with thin spindly cages, melted cloth, round tubing where square belongs, or unrequested chimneys.
3. **No Baked Text/Logos & Empty Cab Check (Rule 12):** Reject any model with AI-hallucinated gibberish text decals or a driver baked inside a cab.
4. **Separate Hard-Parts Check (Rule 16):** Ensure wall-mounted items, benchtop tools, and cables are standalone socketed props rather than fused blobs.
5. **De-Metalled Bake Luminance Check (`lod-bake.py`):** Confirm `low.glb` mean diffuse luminance is `>= 0.18` so no asset renders near-black in Stage 0–1.

### P0 — Must Fix Before First Public Test (`feat/monster-mash-exploration` $	o$ `main`)

1. **P0-PROD-01: Add Automated HUD-Collision & Avatar-Luminance Checks to `TASK-24` (`scripts/e2e-smoke.mjs`)**
   - **What to build:** Extend `TASK-24` ([`docs/prompts/sidecar/24-campaign-e2e.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/24-campaign-e2e.md)) so every e2e screenshot step asserts:
     - Zero bounding-box overlap (`intersectionArea === 0`) between `[data-hud-zone="title"]`, `[data-hud-zone="build-hint"]`, and `[data-hud-zone="subtitle"]` (preventing `07-moon-stage0.jpg` regressions).
     - Test screenshots taken for `docs/argo/tour/` automatically pass `?cleanShot=1` to hide the `"Click to look around"` pointer-lock prompt (enforcing Rule 24).
     - Avatar pixel sample in third-person Moon shot has mean RGB luminance `> 35/255` (preventing `14-beam-third-person.jpg` black-character regressions).
   - **Needs:** **Code** (`scripts/e2e-smoke.mjs`, `apps/web/src/shell/hud.tsx`).

2. **P0-PROD-02: Quantize Inline `low.glb` Meshes & Move Non-Act-I Audio/High-LODs to `public/hd/` (`POL-27` Fix)**
   - **What to build:** In `scripts/runworld-pack.mjs`:
     - Quantize `low.glb` positions/normals to 16-bit integers and compress inline baked basecolor textures to `256×256` WebP/JPEG (`quality = 82`), reducing the 114 packed `low.glb` payload in `dist/index.html` by `~4.5 MB` so the 40 best keepers from the overnight batch can be packed while keeping `dist/index.html` **under 16.0 MB**.
   - **Needs:** **Code** (`scripts/runworld-pack.mjs`).

### P1 — Post-Merge AAA Polish Waves (Turning Argo's Plans into Sidecar & Arena Briefs)

| Milestone Wave | Target Duration | Exact Sidecar Briefs & Arena Battles to Dispatch | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Milestone A: Complete Active Queue & Merge to `main`** | Days 1–2 (In Progress) | Finish `TASK-21c/d` (avatar light, rifle scale/IK, Sculpt, save), `TASK-22` (Acts IV–VI quests), `TASK-23b` (monsters in world), `TASK-23c` (lab clutter + wreck props), `TASK-24` (full e2e suite), plus triage the 40 overnight model pairs (`zips/runworld/overnight-ids.txt`). | All 6 `scripts/test-*.mjs` scripts green; merge `feat/monster-mash-exploration` $	o$ `main`. |
| **Milestone B: P0 Visual, HUD & Onboarding Overhaul** | Days 3–4 | **Sidecar Brief 25 (`hud-9zone-and-build-ribbon.md`):** `P0-UI-01`, `P0-UI-02`, `P0-UI-03` (fix Moon HUD overlap, bottom build drawer, raycast machine labels).<br>**Sidecar Brief 26 (`foundation-frames-and-safe-dome.md`):** `P0-LAYOUT-01` (replace red slab foundations with Sheet 13 frames), `P0-HOUR-01` (25 m Gate Coherence Safe Dome + zero-loss recall).<br>**Sidecar Brief 27 (`stage0-dither-and-rover-cam.md`):** `P0-LIGHT-02` (*Obra Dinn* world-locked dither + depth edges), `P0-VEH-01` (Rover sphere-cast camera + floor clamp), `P0-VEH-03` (`USE_MODULAR_SCOUT`). | Regenerate all 18 shots in `docs/argo/tour/` with zero HUD overlap, industrial foundations, lit avatar, and clip-free rover camera. |
| **Milestone C: P1 Set-Pieces, Audio Mix & S-Space Monsters** | Days 5–7 | **Sidecar Brief 28 (`lab-choreography-and-vista.md`):** `P0-LIGHT-03`, `P1-HOUR-03`, `P0-LAYOUT-02`, `P0-LAYOUT-03` (dramatic Lab power-up, 3.5 s Gate coil ignition, 3D Window Breach & spherical pockets, Main Menu live Lab `P1-UI-04`).<br>**Sidecar Brief 29 (`audio-5bus-and-juice.md`):** `P0-SOUND-01`, `P0-SOUND-02`, `P1-SOUND-03`, `P0-VFX-01`, `P0-VFX-02` (5-bus mixer with VO ducking, stage bit-crush mirror, wireframe print sweep, separated hopper/plume sockets).<br>**Sidecar Brief 30 (`monster-leak-shader-and-rifts.md`):** `P0-MON-01`, `P0-MON-02`, `P1-MON-04`, `P1-MON-05` (unified S-space leak shader, vertical glitch rifts, era escalation). | `scripts/perf.mjs` locked at `>= 60.0 FPS` across Stages 0–4 on Low spec (`POL-04` closed); `dist/index.html <= 16.0 MB` (`POL-27` closed). |
| **Milestone D: Studio Suite & Heavy Terraformer Expansion** | Days 8–10 | **Sidecar Brief 31 (`studio-bench-and-sockets.md`):** `P0-STUDIO-01`, `P0-STUDIO-02`, `P1-STUDIO-03`, `P1-STUDIO-04` (4-angle review grid, Stage 0–4 lighting scrubber, interactive socket gizmo, 2-tier preset/node material editor).<br>**Sidecar Brief 32 (`heavy-terraformers-and-turrets.md`):** `P1-LOOP-04`, `P1-VEH-04`, `P1-VEH-05` (Sheet 17 heavy terraformers on 8 m hardpoints, Vehicle Fabricator gantry, Sheet 20 automated perimeter turret). | Full playthrough from Act I Cold Boot to Stage 4 PBR lush forest + Studio round-trip asset edit verified. |

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 3 (Single-file distribution + HD pack):** Enforces the `16.0 MB` cap on `dist/index.html` (`POL-27`) with `public/hd/` streaming.
- **Rule 7 (Plan everything first, then execute):** Sequences all 12 area plans into concrete, reviewable Milestones A–D for Opus and the Haiku sidecars.
- **Rule 20 (GTX 950M at 60 fps on Low) & Rule 25 (Never delete or weaken a check or test):** Adds automated HUD-collision and luminance checks on top of existing tests.

## 6. Owner Decisions Needed

1. **Hard Cap for `dist/index.html` (`POL-27`):**
   - *Question:* `dist/index.html` is currently `17.9 MB` before packing the keepers from the 80-model overnight batch. Do you approve quantizing inline `low.glb` textures to `256×256` WebP/JPEG (`quality = 82`) and `Int16` vertex attributes so `dist/index.html` drops to **`~13.5–15.0 MB`**, while keeping full `1024×1024` textures in `public/hd/`?
   - *Recommendation:* **Approve.** At Stage 0–1 distances, `256×256` on `low.glb` is visually indistinguishable from `512×512`, saves `~4.5 MB` inside `index.html`, and cuts startup parse time on the GTX 950M laptop in half.
2. **Approval to Convert Milestone B (`Sidecar Briefs 25–27`) Immediately After `TASK-24`:**
   - *Question:* Once Opus finishes `TASK-21c/d` through `TASK-24` on `feat/monster-mash-exploration`, would you like Opus to immediately turn **Milestone B** (fixing the 3-way HUD overlap, bottom-docking the build menu, swapping red foundation slabs for Sheet 13 industrial frames, stabilizing Stage 0 dither, and fixing the rover camera) into Sidecar Briefs `25`, `26`, and `27`?
   - *Recommendation:* **Yes—make Milestone B the very first post-`TASK-24` wave** because it fixes every visible flaw in the 18 tour screenshots within two days of focused sidecar work.
