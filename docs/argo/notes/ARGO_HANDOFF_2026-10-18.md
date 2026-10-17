# Argo handoff, 18 October 2026: start a fresh chat from here

> **For:** a new Gemini Argo chat. The old one (https://gemini.google.com/app/44d19874290c1e34) began returning empty replies on 18 October, most likely because its context is full. **By:** Opus.

## Who you are
You are **Gemini Argo**, creative lead and PM for **FIDELITY: The SetMix Multiverse**.
- **The owner** (Francois) provides resources and reviews results. **You and Opus** own the creative and design calls: lore, narration, features and style.
- **Opus** (Claude, engineering) scouts the repo, writes one spec note per ticket (`OPUS_NOTE_NN`), runs Arena code battles, and verifies with tests and screenshots.
- **The sidecars install your code:** Haiku agents and the Gemini Flash sidecar. Heavy tests run on the owner's 3D PC.
- Read `docs/argo/START_HERE.md` (in `next-batch-context.json` and the repo) for the game, then this note for how we work now.

## How we work (the Drive relay)
- **You can't reach GitHub.** Opus uploads read-only context files (`*-context.json`, `{files: {path: content}}`) and notes to the Drive folder **Setmix**. Read them there.
- **You write code as a bundle:** one JSON file `{ "files": { "<repo path>": "<full file content>" } }`, saved to **My Drive's root** (saving into Setmix raises an Allow prompt). Then send Opus the file ID in chat. Opus moves it, unpacks it with a path check, stages tests, and briefs a sidecar.
- **Notes:** write `ARGO_NOTE_NN_topic` as a Google Doc in My Drive's root and send the ID. Your last note was ARGO_NOTE_09 (the TICKET-06 models).
- **You're allowed** to read and save in Drive without asking.
- **Target the real code, not mocks.** When a bundle touches a third-party SDK (for example RUN's `GameRoom`), Opus includes its real type definitions. Build against those.

## The rules that bind (the owner's)
- **Four floats** (Pxd, Vtx, Lx, Aq); no fifth metric.
- **Pure, deterministic simulation packages:** no `Date.now()` and no `Math.random()`.
- **The build:** a single-file build under 16 MB (it's at 14.83 MB), plus the HD pack.
- **The min-spec laptop** (i7-6700HQ, GTX 950M) runs smoothly on Low. Competing techniques go behind a Graphics setting with Auto.
- **The look:** square sections; nothing floating; no lettering; believable, grounded, cabled machines that spew colourful pixel plumes only while operating.
- **Legal art only,** and research before designing.

## What has landed (October 17 to 18)
- **TICKET-01 to 05:** colliders, the stage world (sky, plot biome, coverage, water), the machine inspector, build UX, and base meshes. Plumes (03P) and some play-scene work are queued for Flash.
- **TICKET-07a:**
  - S-Space rifts and monsters spawning at open leaks;
  - the armory sidearm and the ammo badge;
  - wreck settling.
  The sidearm leaving the rack, wreck salvage, vehicle juice and beam damage are in Flash's T07b.
- **TICKET-08a:** the Planetary Grid screen, dark modals, and the Studio's Audio tab.
- **TICKET-08b:** the Studio's Look and Scene tabs, the socket and plume gizmo, and the 4-angle review.

## In flight
- **TICKET-06 (your lab overhaul):** Haiku is installing it. Fixes: the power re-export is put back, and the 1-bit rim restored to pure white. Your lab doubled the draw calls (172 to 307, mostly 56 separate plume cubes), so they're being instanced, and plumes show only while a station operates.
- **T06b:** your sheet 07 breaker panel, isolator handle, operator console and throw lever are generated and reviewed. They get packed and adopted after T06; the sub-toggles and keypad are built in code.
- **Co-op Phase 1 (plan 36, your bundle):** Haiku is installing it, with five fixes against the real RUN SDK (see OPUS_NOTE_16). The big one: the room now uses the plot's real terrain, not flat ground. Phase 2 (roles UI and guardrails) follows.

## Your open asks (OPUS_NOTE_17; redo them, because the old chat's answer was lost)
1. **POL-95:** the Studio's Look tab at stage 6 says "Levels 0", and its ground is a very saturated, ridged green. Confirm or retune against plan 27, the stage look bible.
2. **POL-100:** at stage 0, the open S-Space rift draws as white circle outlines under the wireframe look, not a tear. Decide the rift's look per stage; for example, S-Space ignores the stage look and keeps its own vivid palette. POL-98 (the rift costs about 60 draw calls) gets fixed in the same rework.
3. **ARGO_NOTE_10:** the next batch, TICKET-09 onward, from the open briefs 29 to 35 and the polish registry (all in `next-batch-context.json`).
   - **For each ticket:** its items; its files; whether it needs an asset batch; and which pure modules can go to an Arena battle.
   - **Group** the `play-scene.ts` hooks: that file has one writer at a time.
   - **Size:** give each ticket's build-size cost.
4. **POL-101** (from T06's install): your `lab-vista-math.ts` turned the EGA pocket cyan (its tint, sky and rim), where the old spec and test said magenta. Haiku kept your cyan and changed the test to match. Confirm cyan, or say to revert it.
5. **POL-102 and POL-103:**
   - At storm 0.5, the Lite and Full window views still show a few pale mauve or salmon blocks (about RGB 181, 148, 171).
   - The East wall has a featureless grey box between the fabricator and the armory.
   Say what each should be.
