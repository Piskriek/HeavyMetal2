# Flash inbox: jobs from Opus to the Gemini Flash sidecar

Only Opus adds jobs here. Flash changes only a job's status word. The old board (`docs/SIDECAR_COMMS.md`, 2,700 lines) is history: don't read it, and don't post there.

## How this works (since 2026-10-17)
- **The team:**
  - **Argo** (Gemini, PM and creative lead) issues tickets and writes or polishes the code.
  - **Opus** specs each ticket, runs Arena battles and verifies.
  - **Sidecars** (Flash and Haiku) install and wire.
- **The loop:**
  1. Watch this file. Wake when a job heading reads `## F-NN [OPEN] title`. If your own watching fails, `node scripts/sidecar-wait.mjs --job docs/sidecar/FLASH_INBOX.md` blocks until one opens (exit 0 prints the job; exit 3 after 10 minutes means run it again).
  2. Take the job: change its heading from `[OPEN]` to `[TAKEN]`.
  3. Do the job's brief exactly.
  4. Report in `docs/sidecar/FLASH_OUTBOX.md`, then set the heading to `[DONE]`.
  5. Go back to step 1. Keep looping until the owner stops you.
- **Statuses:**
  - `[HELD]`: written but not yet yours, usually because another worker owns the same files. The wait script skips it.
  - `[OPEN]`: ready for you.
  - `[TAKEN]` and `[DONE]`: set by you.
- **Files:** stay inside the files your job names. Another worker (Haiku) may be editing others at the same moment.

## Rules, in short (full set: CLAUDE.md, then docs/prompts/sidecar/WAVE_WORKER.md)
- **Git:** the tree and index are shared.
  - Run `git diff --cached --stat` first, then `git commit -m "..." -- <your paths>`.
  - End every message with the trailer `Agent: Gemini-Flash`.
  - Never use `add -A`, `commit -a`, `stash`, `reset`, `restore`, `checkout --`, `clean` or `push`.
  - Never commit `apps/web/dist/index.html`.
  - A campaign run rewrites `apps/web/public/checkpoints/`: restore only that folder afterwards (`git restore -- apps/web/public/checkpoints/`).
- **Code:** pure deterministic simulation packages, strict TypeScript (`noUncheckedIndexedAccess`), one single-file build under 16 MB, and no fifth global metric.
- **This laptop is the min-spec** (GTX 950M, about 2 GB of RAM free):
  - one browser test at a time;
  - no dev server left running;
  - pipe long output through `tail -40`.
- **Run the heavy checks on the 3D PC worker (since 2026-10-17), not on this laptop.** The worker is 24 threads; a browser test takes about 20 s there.
  - `scripts/test-on-3dpc.sh "<command>"` tests your **working tree** as it is. No commit or push is needed: it snapshots your files through a temporary index (the shared index is untouched), sends the snapshot to the worker over SSH, and runs the command there.
  - Examples: `scripts/test-on-3dpc.sh "npm test"`, `scripts/test-on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"`.
  - When another worker (Haiku) is editing in the same tree, add `--only "<your paths>"`. The snapshot is then HEAD plus only your files, so the other worker's half-done edits don't break your run. Example: `scripts/test-on-3dpc.sh --only "packages/groundshader apps/web/src/play/play-scene.ts apps/web/src/play/plot-ground.ts" "npm test"`.
  - Use it for `npm test`, `npm run build` and every browser test. Run only quick checks on the laptop (typecheck, a single unit file).
  - Screenshots stay on the worker. To look at one, copy it back: `scp -i ~/.ssh/id_ed25519_fidelity RAMPAGE@192.168.0.8 (see scripts/worker.env):/c/MarbleGp/<path> <local path>`.
- **Verify before you report:**
  - `npm run typecheck` (0 errors);
  - `npm test` (the fieldkit and plotgrid timing tests fail on this laptop; that is known);
  - `npm run build` (note the size);
  - plus your job's own checks.
- **Report honestly:** real numbers and the failing assertion text. Look at every screenshot before citing it.

## Outbox format (append to docs/sidecar/FLASH_OUTBOX.md, 20 lines or fewer)
`### [YYYY-MM-DD HH:MM] F-NN [DONE|PARTIAL|BLOCKED] title`, then bullets:
- the commits (SHA and subject);
- each check's pass/fail line;
- the shots;
- what you changed from the brief, and why;
- what is left, and anything Opus must decide.

---

## F-01 [DONE] TICKET-02 item A: the moon's sky and world follow the stage
Opened 2026-10-17: TICKET-01 landed (7d0d9030, 52a02830), so play-scene.ts and play.tsx are free. Note that every moon teleport now lands at scene.gateExit().
Brief: `docs/prompts/sidecar/T02A-stage-world-look.md`.

## F-02 [DONE] TICKET-02 C0: the plot's biome input (terrain, hydro water, keep-outs)
Brief: `docs/prompts/sidecar/T02C0-biome-input.md`. Pure module and unit tests; no browser test.

## F-03 [DONE] TICKET-01 leftovers: windows, doors, roofs, ramps on slopes, and your F-01 clamp
Brief: `docs/prompts/sidecar/T01b-collision-leftovers.md`. Start it only after F-02 is DONE.

## F-04 [DONE] TICKET-02 D: install Argo's @hm/sky and wire it into the moon's sky
Brief: `docs/prompts/sidecar/T02D-sky-install.md`. Bundle in `arena-gathered/argo-ticket02-sky/` (verified by Opus).

## F-05 [DONE] TICKET-02 C: install Argo's @hm/plotbiome
Brief: `docs/prompts/sidecar/T02C-plotbiome-install.md`. Start it only after F-04 is DONE (both touch tsconfig and the lock).

## F-06 [DONE] TICKET-02 F: plotbiome's tufts, bushes and trees in the moon world
Brief: `docs/prompts/sidecar/T02F-biome-scatter.md`. Bake once at stage 6, show by `appear`; Vegetation setting with Auto; at least 30 fps on Low at stage 6.

## F-07 [DONE] TICKET-02 F2: grass at stage 2 and bushes at stage 4 (F-06 follow-up)
Brief: `docs/prompts/sidecar/T02F2-early-stages.md`. Tufts on Low, machines and the gate feed the input, water sources; fps on the laptop, everything else via scripts/test-on-3dpc.sh.

## F-08 [DONE] TICKET-02 B+E: Argo's coverage shader and water surfaces, wired in
Brief: `docs/prompts/sidecar/T02BE-coverage-water.md`. Start it only after F-07 is DONE. In play.tsx touch the loading step only (Haiku is on the E handler).

## F-09 [DONE] TICKET-02 P: performance pass, stage 6 on Low at 45 fps or more on the laptop
> **Reassigned to Haiku by Opus, 2026-10-18 02:50:** Flash has made no change since 17:54 on 17 October. Haiku finishes from Flash's uncommitted work in progress (play-scene.ts, plot-ground.ts, plot-biome-view.ts, water-surfaces.ts, packages/groundshader). Flash: don't resume F-09; take F-10 when it is DONE.
Brief: `docs/prompts/sidecar/T02P-performance-pass.md`. Measure per layer first; expensive looks go behind Graphics settings with Auto, never deleted.

## F-10 [HELD] TICKET-05: square socket markers, gunmetal panels, sliding door, avatar at 3 m, beam core, outcrops
Brief: `docs/prompts/sidecar/T05-base-meshes-avatar-beam-outcrops.md`. HELD by Opus (2026-10-18): play-scene.ts has one writer at a time, and Opus schedules it (Haiku is on TPOL now, then T11b). Opus opens F-10 when play-scene.ts is free for Flash.

## F-11 [HELD] TICKET-03 P: colourful pixel plumes, only while machines operate
Brief: `docs/prompts/sidecar/T03P-machine-plumes.md` (spec: docs/argo/notes/ARGO_NOTE_08_plumes.md). Start it only after F-10 is DONE.

## F-12 [HELD] TICKET-07 B: vehicle juice (boost, tracks, dust, print gantry) and the beam hurting monsters
Brief: `docs/prompts/sidecar/T07b-vehicle-juice-beam-damage.md`. HELD until F-11 is DONE; Opus opens it. T07a has landed (767f75a5), and the brief now also carries its two play-scene leftovers: the sidearm leaving the rack (POL-96) and hold-E wreck salvage (POL-97).

## F-13 [HELD] TICKET-06 hooks: aim the lab's Hardware Fabricator and Planet Table
Brief: none separate; the job is this list. HELD until Haiku's T06 (`docs/prompts/sidecar/T06-lab-overhaul.md`) has landed and F-12 is DONE; Opus opens it.
- `play-scene.ts`: replace the hardcoded `targets` list in the lab aim (the `aimedLab` block) with `room.aimStation(pos, dir)` from T06's `lab-room.ts`, and widen `LabMachineKind` to `LabStationId` (`lab-machines.ts`). The rack, bench and combiner must keep working.
- `play.tsx`: the E prompt comes from the station's `prompt`. E on `fabricator` opens the existing `FabricatorModal`; E on `planet-table` opens the Planetary Grid screen (08a's). Weapon Bench keeps its existing armory path.
- Test: extend `scripts/test-lab-overhaul.mjs` (T06's) so aiming at each of the six stations shows its prompt and E opens its window. Run it, `npm test` and `test-campaign` (45 of 45) through `scripts/test-on-3dpc.sh --only`.

## F-14 [MOVED] Co-op play-scene hooks (plan 36 Phase 1 leftovers): moved to Haiku T11b (docs/prompts/sidecar/T11b-coop-phase2-play-wiring.md); Flash, skip it
Brief: none separate; the job is this list. Co-op Phase 1 landed at ad9eacec and 955395aa (Haiku, T36P1). The details are in POL-111 to POL-117 in `docs/DEFERRED_POLISH_REGISTRY.md`. HELD until F-13 is DONE; Opus opens it.
- **POL-113:** a guest's live ground loads the host's sculpt. Add `importBeamField` (or reuse the beam-save load path) to `PlayScene`, and call it from the session's terrain event in `play.tsx`.
- **POL-112:** the gate's footing pad (`groundAt` in `play-scene.ts`, |x| < 1.9, |z| < 1.25) moves into the pure `apps/web/src/base/plot-height.ts`, and `play-scene.ts` calls it, so the room and the scene agree on the pad. Add the 50-point check: `plotHeightAt` equals `scene.heightAt` in the browser.
- **POL-111:** `plot-ground.ts` takes its terrain constants (`PAINT_ORIGIN` and the formula) from `plot-height.ts`.
- **Remote avatars:** draw each peer from `client.samplePeers()` (100 ms behind) with the existing avatar mesh, inside the Low budget.
- Test: extend `scripts/test-coop-outpost.mjs` so a guest sees the host's sculpt and the host's avatar. Run it, `npm test` and `test-campaign` (45 of 45) through `scripts/test-on-3dpc.sh --only`.

## F-15 [DONE] Studio hardening (POL-87, 88, 90 to 93): no play files
Brief: none separate; the job is this list. Each item's detail is in `docs/DEFERRED_POLISH_REGISTRY.md`. This job touches only `apps/web/src/studio/`, `apps/web/studio-server/`, `apps/web/src/shell/planetary-grid.tsx` and `audio-tab.tsx` (their CSS only), and the Studio tests. Never touch the F-09 files (Haiku has them) or anything under `apps/web/src/play/`.
- **POL-88:** add `scene-layouts` to the write-back allowlist (`apps/web/studio-server/write-back.ts`, with a schema check like the tweaks), and point the Scene tab's Save at it when the route is writable. The built game keeps its per-browser save and Copy JSON.
- **POL-91:** an error boundary around each Studio workspace that shows the error and keeps the other tabs alive.
- **POL-90:** Scene transform edits and gizmo drags go on the Studio's undo stack.
- **POL-92:** `four-angle.ts` and `studio-thumbs.ts` share one offscreen WebGL renderer (the GTX 950M can't spare a second context).
- **POL-87 and POL-93:** one style source per screen. Move the pure helpers out of `planetary-grid.tsx`, `audio-tab.tsx`, `look-tab.tsx` and `scene-tab.tsx` into modules without CSS, so their tests import only those, then import each `.css` file and drop the embedded strings.
- Test: extend `scripts/test-studio-tabs.mjs` (Save writes the project file in dev; a thrown workspace leaves the others usable; undo restores a moved copy). Run it, `test-grid-menus`, `npm test` and `test-campaign` (45 of 45) through `scripts/test-on-3dpc.sh --only "<your paths>"`. Typecheck on the laptop.

## F-16 [TAKEN] TICKET-12 (Studio part): brief 31's remaining Studio work, plus POL-86, POL-94 and POL-21
Brief: `docs/prompts/sidecar/31-studio-bench-and-sockets.md`. What's left of it is listed in `docs/argo/notes/ARGO_NOTE_10_next_batch_ticket09_onward.md` §2B and its TICKET-12 row; T08b and your F-15 already covered the 4-angle grid, the Look scrubber, the Scene tab, the gizmo, the error boundary, undo and the shared renderer.
This job touches only `apps/web/src/studio/`, `apps/web/studio-server/`, `packages/scenedoc/` and the registry generator. Never touch `apps/web/src/play/`, `apps/web/src/net/`, `apps/web/src/rooms/`, `apps/web/src/shell/planetary-grid*` (Haiku T11a) or the audio files (Haiku T09a).
- **P0-STUDIO-01 part 2:** one-click fix flags (fix: mirror-z, fix: plain-back, reach: 3, hold, lumOk) written through the Changes panel to `docs/runworld/assets.json` via studio-server, and the surface-luminance gate badge (low >= 0.18, and low/high >= 0.85).
- **P1-STUDIO-03 part 2 and POL-89:** click-to-snap socket authoring on a model's face (hopper, exhaust, cable, mount), saved through studio-server; the registry generator emits machine and structure sockets, so the gizmo shows them on machines too.
- **P1-STUDIO-04:** the two-tier Material Designer. Tier 1: macro sliders (hue, grain, weathering, roughness, bump) and a two-cartridge combiner on `@hm/vault` spheres. Tier 2: the `@hm/texgraph` node graph with a constant-mean-luminance (D21) Potato-to-Ultra preview.
- **O3:** a per-skin monster `remapStrength` slider (0 to 1, default 0.20) in the monster bench, with dev write-back.
- **POL-86:** a dev write route for `levels.json`. **POL-94:** automate a gizmo pointer drag in `test-studio-tabs.mjs`. **POL-21:** structural sharing in `@hm/scenedoc`.
- **Pure modules, with unit tests:** `apps/web/src/studio/material-macro-math.ts` (the 5-slider transform, the combiner math, the D21 preview) and `apps/web/src/studio/flag-and-socket-schema.ts` (validators for the fix flags, the luminance gate and the snapped `sockets.json`).
- Load the frontend-design skill before UI work, and keep the Studio's look.
- Test: extend `scripts/test-studio-tabs.mjs` (a flag writes `assets.json` in dev; a snapped socket persists and shows; the material sliders change the preview at constant mean luminance; the gizmo drag moves a copy). Run it, `npm test` and `test-campaign` (45 of 45) through `scripts/test-on-3dpc.sh --only "<your paths>"`. Typecheck on the laptop. Use POL-181 to POL-190 for new registry entries.
- **Added by Opus:** the Look tab half of POL-95, since you're in the Studio. In `look-tab.tsx`, add `levelsLabel` ("12" at stage 1, "24" at stage 2, "Full (24-bit)" at stages 3 to 6) in place of the literal "0". Argo's version is in `arena-gathered/argo-pol95-103/apps/web/src/studio/look-tab.tsx` and its test. Merge it onto your current file. Haiku's TPOL does the groundshader half.
