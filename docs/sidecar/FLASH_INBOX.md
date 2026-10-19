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
  - **When the worker is busy, the run goes to the laptop (owner, 2026-10-18, commit `1a637270`).** If the worker's lock is held, or SSH can't reach it, the script runs your command on the laptop at once instead of queueing, and prints `[laptop] ...` first. The laptop has its own lock, so two laptop runs never overlap. If both machines are busy, it waits for whichever frees first.
    - A laptop run uses the shared working tree as it is, not your `--only` snapshot. If it fails outside your own files (another worker's half-done edit), re-run that check with `--worker-only`, which waits for the worker's clean snapshot.
    - Use `--worker-only` for timings too (fps, GPU ms).
    - A run you started before `1a637270` still queues the old way: stop it and run it again.
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

## F-10 [MOVED] TICKET-05: square socket markers, gunmetal panels, sliding door, avatar at 3 m, beam core, outcrops
Brief: `docs/prompts/sidecar/T05-base-meshes-avatar-beam-outcrops.md`. MOVED to Haiku by Opus (2026-10-18), alongside your F-19. Flash, skip it.

## F-11 [MOVED] TICKET-03 P: colourful pixel plumes, only while machines operate
Brief: `docs/prompts/sidecar/T03P-machine-plumes.md` (spec: docs/argo/notes/ARGO_NOTE_08_plumes.md). Start it only after F-10 is DONE. MOVED to Haiku by Opus (2026-10-18), alongside your F-19. Flash, skip it.

## F-12 [OPEN] TICKET-07 B: vehicle juice (boost, tracks, dust, print gantry) and the beam hurting monsters
Brief: `docs/prompts/sidecar/T07b-vehicle-juice-beam-damage.md`. HELD until F-11 is DONE; Opus opens it. T07a has landed (767f75a5), and the brief now also carries its two play-scene leftovers: the sidearm leaving the rack (POL-96) and hold-E wreck salvage (POL-97).

## F-13 [OPEN] TICKET-06 hooks: aim the lab's Hardware Fabricator and Planet Table
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

## F-16 [DONE] TICKET-12 (Studio part): brief 31's remaining Studio work, plus POL-86, POL-94 and POL-21
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

## F-17 [DONE] TICKET-12 (HUD part): POL-78, 79, 80, 82 and 43, no play-scene
Brief: none separate; the job is this list. Each item's detail is in `docs/DEFERRED_POLISH_REGISTRY.md`, and TICKET-12's row is in `docs/argo/notes/ARGO_NOTE_10_next_batch_ticket09_onward.md`.
This job touches only `apps/web/src/base/ui/` (`radial-menu.*`, `hud-zones*`), `apps/web/src/play/controls-grid.*`, `apps/web/src/play/play.css`, and `play.tsx` (the toast, ticker and radial props only). Never touch `play-scene.ts`, the lab or vista files, `rift.ts` or `packages/groundshader` (Haiku TPOL has them), or `apps/web/src/net/`, `rooms/` or the audio files.
- **POL-78:** the Esc pause panel shows the whole controls grid at 1280 x 720: three columns or a scroll inside the panel, never cut off.
- **POL-79:** radial slice labels wrap onto two lines instead of truncating ("Weapon bench", not "Weapon ben...").
- **POL-80:** the Apply radial with an empty rack shows one clear empty state ("No written cartridges: write one at the preset bench") instead of filler placeholders.
- **POL-82:** refused actions ("Cannot place: ...", "Missing: ...") show as a compact HUD toast in the status zone, not a giant title card. F-09 already sized long titles down; this moves refusals out of the title card entirely.
- **POL-43:** the bottom-right ticker shows linked-bin counts (for example "Ore 24 (+140)"). Pickup toasts stay as they are.
- Load the frontend-design skill before UI work, and keep the HUD's look (plan 28's skins).
- Test: extend `scripts/test-build-ux.mjs` (or the HUD test that covers these) so the grid is fully visible at 1280 x 720, a long radial label wraps, the empty Apply state shows, a refused placement raises the compact toast (no title card), and the ticker shows a linked count. Take shots and look at them. Run it, `npm test` and `test-campaign` (45 of 45, zero HUD overlaps) through `scripts/test-on-3dpc.sh --only "<your paths>"`. Typecheck on the laptop. Use POL-211 to POL-220 for new registry entries.

## F-18 [MOVED] TICKET-10: the wave band, monster wall pathing, the foregrip IK, play-scene Window A
Brief: `docs/prompts/sidecar/T10-wave-band-monster-nav-window-a.md` (Argo's bundle and ARGO_NOTE_12). MOVED to Haiku by Opus (2026-10-18), so it can run alongside your F-19 (no shared files). Flash, skip it. Read the brief's "copy or merge" section first: never copy Argo's play-scene.ts.

## F-19 [MOVED] TICKET-14: the real-time credits video, the lab monitor jukebox, the title entry
MOVED to Haiku by Opus (2026-10-18): Flash hadn't taken it. Flash, skip it. Brief: `docs/prompts/sidecar/T14-credits-video.md` (Argo's bundle and ARGO_NOTE_13). OPEN since 2026-10-18: T11b has landed (51206f27). Do F-19 before F-18: T14 doesn't touch play-scene.ts, so it can run alongside TRIFT. Read the brief's font section first: check the embedded font's origin and rename it before shipping anything.
- **Also, two co-op HUD fixes from T11b's shots** (play.tsx and the HUD zones only):
  1. The co-op roster chip (Room code, Connected, the players and their roles, Leave room) sits on top of the stage metrics panel in the top right. Move it into a free HUD zone (see hud-zones-logic), and keep it compact.
  2. In a session, the play screen still shows "SOLO DESYNCED". Show the session instead (for example "CO-OP · room S2JE7V"), and keep the Sync button hidden or disabled while in a room.
  Take a shot of both pages in a session, and look at them; `test-campaign` must stay at zero HUD overlaps.

## F-20 [DONE] Small sweep: POL-175, POL-174, POL-99 (no play-scene, no play.tsx)
Brief: none separate; the job is this list. Each item's detail is in `docs/DEFERRED_POLISH_REGISTRY.md`.
Lanes right now: a Haiku owns `play-scene.ts` and `machine-props.ts` (T03P follow-up); another Haiku owns `play.tsx`, `apps/web/src/credits/`, `lab-room.ts`, `goblin-front.tsx` and the HUD zone files (T14). Never touch those.
- **POL-175:** `studio.css` has a global `button:hover:not(:disabled) { background: #efeee7 }` that lights every button in the app on hover (the Grid's dark buttons turned light). Scope it to the Studio's root. Then check the Studio, the Grid and Settings still look right on hover (shots), and remove T11b's Grid-only override in `planetary-grid.css` if it's no longer needed.
- **POL-174:** `apps/web/src/play/remote-peers.ts` disposes each rig's materials when a peer leaves, but not its geometry. Dispose the geometry too, and add a unit check that join then leave frees both.
- **POL-99:** add clean close-up shots (HUD hidden, first person, the subject verified in view: no avatar, rifle rings, dome or wreck blocking) of the armory rail and holster, and of a near open leak and a sealing one, to `scripts/test-ticket07a.mjs`, saved beside its other shots. TRIFT's `scripts/pol95-103-rift-shots.mjs` already has the facing and avatar-hiding logic: reuse it.
- Test: `npm test`, `test-ticket07a`, `test-studio-tabs`, `test-grid-menus` and `test-coop-outpost`, through `scripts/test-on-3dpc.sh --only "<your paths>"` (the worker is at 192.168.0.8, from `scripts/worker.env`). Look at every shot. Use POL-271 to POL-280 for new registry entries. Never run `scripts/runworld-pack.mjs` without explicit ids.

## F-21 [DONE] @hm/plume: a gravity option and a count uniform (POL-261's package half)
Brief: none separate; the job is this list, with POL-261 in `docs/DEFERRED_POLISH_REGISTRY.md` and the drill, press and pylon notes in `docs/argo/notes/ARGO_NOTE_08_plumes.md`. The T03P follow-up has landed (44b6107f).
Lanes right now: a Haiku owns `play.tsx`, `apps/web/src/credits/`, `lab-room.ts`, `goblin-front.tsx` and the HUD zone files (T14). Stay inside `packages/plume/` (its `src/index.ts` and `tests/plume.test.ts`). Don't touch `play-scene.ts`; the emitters adopt the new options in a later step.
- **Gravity:** an optional per-emitter `gravity` (m/s², default 0, so every emitter today is unchanged) that bends `pixelAt`'s rise into a ballistic arc: launch up and out, then fall. It must stay a pure function of (emitter, index, time), so a pixel's position never depends on frame history.
- **A count uniform:** changing how many pixels an emitter shows (a cadence pulse, T15's beat) must not rebuild the instance buffer each frame. Allocate once at the emitter's maximum and drive the visible count through a uniform or the draw range. Today's cadence-driven pours cost +0.11 ms GPU on the 3D PC.
- **Keep the API backward compatible.** Every current caller compiles and draws exactly as before.
- **Tests** (in `plume.test.ts`): gravity 0 equals today's output for a sample of pixels; a gravity pixel rises, then falls below its peak; changing the count makes no new buffer (spy on the allocation, or count the buffers).
- **Check:** `npm run typecheck`, then `scripts/test-on-3dpc.sh --only "packages/plume" "npm test"` and `scripts/test-on-3dpc.sh --only "packages/plume" "npm run build && node scripts/test-machine-plumes.mjs"` (69 of 69 today). Report the build size.

## F-22 [DONE] Finish POL-99: the close-ups with the HUD really hidden (after F-21)
Opus's review of F-20: the four close-ups in `scripts/test-ticket07a.mjs` frame their subjects, but the HUD is NOT hidden in any of them (the stage panel, the leak radar, health, the ticker, the compass and a Dr. Haddy subtitle all show). The sealed shot also has two monsters in front of the rift.
- Hide every HUD layer and the subtitle for these four captures only, and restore them right after (the other shots in the test keep the HUD). Find the HUD's root elements in the page; don't add game code for it.
- Take the sealed shot with no monster between the camera and the rift (clear them through the debug hooks first, or pick a moment with none in the frustum, and check it).
- Stay inside `scripts/test-ticket07a.mjs`. Check: `scripts/test-on-3dpc.sh --only "scripts/test-ticket07a.mjs" "npm run build && node scripts/test-ticket07a.mjs"` (17 of 17), and copy the four shots back to look at each one before you report. Update POL-99 in the registry when it's done.

## F-23 [DONE] TICKET-16 part a: Acts VII to IX, the finale hand-off, the menu hero, the portrait and the credits gate (no play-scene)
Brief: `docs/prompts/sidecar/T16-acts-7-9-finale.md`. Do all of it EXCEPT the `play-scene.ts` parts, which are part b, later in the play-scene queue: Window E (the 11 enclave domes), the Planet Table hologram's mount, POL-301, POL-302 (and so the finale's window-storm heal visual), POL-303 and POL-304. Source: `arena-gathered/argo-ticket16/` (Opus's staging run: the questline suite passes 4 of 4). T14 has landed (306e7dae): merge onto its `goblin-front.tsx`, `play.tsx` and `apps/web/src/credits/`.
Lanes right now: a Haiku owns `play-scene.ts`, `machine-props.ts` and `scripts/test-machine-plumes.mjs` (T03P-R). Next, a Haiku takes T13a: `packages/plotsim/`, `packages/structure/`, `packages/cartlab/`, `turret-view.ts`, `window-c-hooks.ts`, `catalog.ts`, `world.ts`, `weapons.ts`, `gen-props.ts` and a new `scripts/test-ticket13.mjs`. Never touch those. Yours: `packages/questline/`, `apps/web/src/base/campaign-chain.ts`, `goblin-front.tsx`, `shell.tsx`, `haddy-crt-portrait.tsx`, `play.tsx` (the finale, the portrait and the credits gate only), `apps/web/src/credits/` (the gate only), `scripts/test-campaign.mjs` and the checkpoint files it needs.
- **The finale in part a:** the Planet Table's E commit (A9-02) runs the 12 s golden-hour timing through `evaluateFinaleWindowHeal`, then the epilogue voice (A9-03), then `creditsDirector.start()`. Leave the window-storm visual as a marked hook for part b.
- **The credits gate:** as the brief's item 6, with the monitor keys as T14 landed them (POL-306): J's credits replay waits for `endingSeen`. Also POL-305.
- **Test:** extend `scripts/test-campaign.mjs` with A7-01 to A9-03 through the debug checkpoints (the old 45 beats plus the new ones, zero console errors, zero HUD overlaps). Add a gate check: a fresh save shows no Ending Credits item; after the finale it appears; the Esc debug entry plays the credits on a fresh save. Run `npm run typecheck`, then through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, the build, the campaign and `node scripts/test-credits-video.mjs`. Shots: the menu hero, the portrait on the title screen and in the HUD (no overlap with the stage panel), the gate (before and after). Look at every one. Report the build size. Use POL-241 to POL-250 for new registry entries.

## F-24 [DONE] Two fixes after F-23: the title portrait covers the logo; the HUD's kW leaves out the turrets (POL-292)
Opus's review of F-23 (b4a125ce). Opus already fixed three things in it (267a6fa2 and c258a69b): `endingSeen` used `localStorage` directly in play.tsx and shell.tsx (the storage scanner test failed; use `kv` from `profile-storage`, never `localStorage`); the chain test still expected three acts; and `packages/questline/src/index.ts` was committed with CRLF line endings. Your report had no shots and no `npm test` line: both are required.
Lanes right now: nobody else is in `goblin-front.tsx`, `haddy-crt-portrait.tsx` or `play.tsx`. A Haiku may take `play-scene.ts` next (T13b or T16b). Never touch it.
- **The title portrait:** on the title screen, Dr. Haddy's CRT portrait card sits over the FIDELITY logo, and the logo hides its text (Opus's shot: `shots-run/t16a/title-fresh.png`, from `scripts/probe-t16a-shots.mjs`). Move it to a free spot that overlaps nothing at 1280x720 and 1920x1080: under the menu list, or under the telemetry panel on the right. Keep the play HUD's portrait where it is (top-left, clear of the stage panel).
- **POL-292:** the HUD's "N of 12 kW" readout leaves out the turrets' 2 kW each. In play.tsx's Env literal (search for the Env built for the power readout), add `extraDrawKw: () => turretGridDrawKw(<the base world>)`, from `apps/web/src/base/world.ts`. See POL-292 in the registry for the details.
- **Test:** extend `scripts/probe-t16a-shots.mjs` with a bounding-box check that the title portrait overlaps neither the logo nor the menu, at both sizes. Add a check to `scripts/test-ticket13.mjs` that one built turret adds 2 kW to the HUD readout. Run `npm run typecheck`, then through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test` (report the line), the build, the probe and test-ticket13. Copy the title shots back and look at them; put the paths in your report.

> **Opus is away for about 24 hours (from 19 October).** Flash is the ONLY writer of `play-scene.ts` and `play.tsx` until Opus returns: no Haiku runs. Do the open jobs strictly one at a time, in this order: F-24, F-12, F-13, F-25, F-26, F-27, F-28. Each is the next single-writer window. For each job:
> - run `npm run typecheck`, then `npm test`, the build, the job's own checks and `node scripts/test-campaign.mjs` (54 of 54) through `scripts/test-on-3dpc.sh --only "<your paths>"`;
> - look at every shot;
> - report in the outbox with the commit, the `npm test` line, the campaign line and the shot paths;
> - commit by explicit paths; never push.
>
> If a job is blocked, write `[BLOCKED]` with the reason and move to the next. Check `git diff docs/DEFERRED_POLISH_REGISTRY.md` before committing it. Use `kv` (profile-storage), never `localStorage`.

## F-25 [OPEN] T09b: the audio verbs, the ambience and the print sweep wiring
Brief: `docs/prompts/sidecar/T09b-audio-verbs-sweep-wiring.md` (T09a's buses have landed). The music duck follows MENTOR_MIX: to 0.45, 0.4 s down, 1.2 s up.

## F-26 [OPEN] T16 part b: the 11 enclave domes (Window E), the Planet Table hologram, and T14's play-scene leftovers
Brief: `docs/prompts/sidecar/T16-acts-7-9-finale.md`, only the parts F-23 left out:
- Window E: the 11 enclave domes on the 4.2 km horizon (A9-01);
- mounting `apps/web/src/play/planet-table-hologram.ts` (POL-70: the 11 enclaves and the 85 % consensus);
- the finale's window-storm heal visual (the hook F-23 left in play.tsx);
- POL-301 (the per-chapter stage-look hook, so the credits' chapter 1 is the 0a wireframe), POL-302 (expose the lab room's `setStorm` and `setMonitorEqualizer` through `PlayScene`), POL-303 (`setAltCam` with a target drifts: XYZ read-back, YXZ rebuild) and POL-304 (hide the held weapon's viewmodel during the credits).
Source: `arena-gathered/argo-ticket16/`. Shots: the domes, the hologram, chapter 1 of the credits (wireframe), the credits with no rifle. Also run `node scripts/test-credits-video.mjs`.

## F-27 [OPEN] T15: the harmonic choir, the radio and turbobass (Window D)
Brief: `docs/prompts/sidecar/T15-harmonic-choir-radio-turbobass.md`. It merges `monsters.ts`, `wreck-sites.ts` and `game-audio.ts` onto the current files (T10, TRIFT, T09b); merge by hand, never copy over. The plume count is one clear number per emitter (`setCount`, F-21's count uniform), so the 144 BPM pulse multiplies it. POL-141 (Argo's ruling): a lab station operates while its window is open, plus a 3.5 s tail, only with power above 0.25.

## F-28 [OPEN] T13b: the vehicle bay (the 3 s gantry print), the scout and hauler rear sockets, POL-50, POL-51 and POL-295
Spec: brief 32 item 3 (`docs/prompts/sidecar/32-heavy-terraformers-and-turrets.md`) and Argo's `packages/plotsim/src/vehicle-bay.ts` (installed by T13a, not wired: `sampleGantryTimeline`, the socket specs, `MODULAR_SCOUT_SOCKETS`, `VEHICLE_FIT`, `snapAerialToShellY`, and `POL51_ROVER_DRIVE_TEST_PLAN` in `window-c-hooks.ts`).
- Printing a scout or a hauler at the vehicle fabricator plays the 3 s gantry assembly on the `fabricator-frame` and `fabricator-head` models (the head moves through the timeline; its plume and feed cubes follow it, as T03P-R set up).
- The scout gets 1 rear socket (a portable linked ore bin or a sync beacon with a 15 m safe dome); the hauler gets 3 (bulk ore or a turret). The socketed items are base items with their existing rules.
- POL-50: the raycast aerial, the square `[-u-]` yoke in the empty cab, and `VEHICLE_FIT` for the hauler.
- POL-51: a browser test that fabricates a scout, drives into a crater rim and a built wall, and checks the camera stays at least 0.65 m above the ground and the depth at screen centre stays at least 0.3 m.
- POL-295: a turret on a pitched roof is supported (or refused).
Files: `play-scene.ts` (one labelled section), `play.tsx` (the print and sockets), `apps/web/src/base/ui/fabricator-modal.tsx`, `packages/rovergear/`, `apps/web/src/base/world.ts` and `catalog.ts` (the socket items), and a new `scripts/test-ticket13b.mjs`. Shots: the gantry mid-print, a hauler with three socketed items, the scout's beacon dome. Use POL-321 to POL-330.
