# Lab and story salvage list (Plan 57 §14)

> Owner, 28 Oct 2026: "strip the lab and the story for parts to build the simulation". This is the inventory: what each piece is, what it can become as a preset, and what ties it to the parked story. Nothing reusable is deleted. Made by a read-only sweep of the repo on 28 Oct; line numbers are from that day's working copy.
>
> **Done so far:** the menu's lab backdrop (`lab/lab.tsx` LabHome) is replaced by the grid room (`shell/grid-room*.ts`), and the home menu's DOM stand-in for the lab window and arch is removed.

## Pieces and what they become

| Item | Path(s) | Reusable as | Story tie |
|---|---|---|---|
| Lab room shell | `play/lab-room.ts` (ROOM, GATE_AT, createLabRoom), `lab/lab-scene.ts` | room module; panel and floor materials | "quantum-shielded… on Earth"; `Where='lab'` (play-scene) |
| Power-on timeline | `play/lab-power.ts` | light and logic preset (a power-up sequence) | the lever fires `'powered'`; the wake camera |
| Console and lever | `packages/consolemill`, `packages/labkit` operatorConsole, lab-room LEVER_AT | prop plus a lever logic rule | `atLever`, pullLever, quest step `power` |
| Labkit props | `packages/labkit` (relay cabinet, breaker panel, capacitor bank, control box, floor cover, cable tray, planet table, preset rack/bench/combiner, texture mill, LabMaterials) | props and materials | names only |
| Lab gate and dais | `play/kit-gate.ts`, `kit-gate-dais.ts`, labkit `gate()` | machine and prop kits | the lab-to-Moon portal, `atGate`, `gate:approach` |
| Stargate set | `kit-stargate.ts`, `event-horizon.ts`, `gate-logic.ts`, `gate-directory.ts`, `@hm/coopnet` gate dialer | machine, shader, logic rule: **the Plan 57 goal** | "Moon Twin Gate", Earth/Moon transit |
| Right-wall stations | `lab-machines.ts`, `kit-fabricator-frame.ts`, `kit-capacitor-bank.ts` | machines and cable props | `aimedLab` routing (play.tsx); A8-01, F-01 |
| Cartridge rules | `packages/cartlab` | logic rules (used widely) | stored as PlayState.lab (quest.ts) |
| Armory | `armory-rack.ts` | prop plus a pickup rule | A4-01 |
| Clutter | `lab-clutter.ts` | 15 salvage and fixture props plus a salvage rule | lore hover |
| Lore | `lore-logs.ts`, `lore-ui.tsx` | the card UI only | the text is story only (BRIDGE_LOGS) |
| Window vista | `lab-vista.ts`, `lab-vista-math.ts` | backdrop module, seeded math | the storm keyed to the stage |
| Planet table | `planet-table-hologram.ts`, `plot-holo.ts` | prop and hologram | A9-01/02 consensus |
| Portal shaders | `portal-shaders.ts` | material and shader (stage dither post pass) | the opening seen from the lab |
| Earth endgame | `earth-endgame.ts`, `base/biome-preset.ts`, game-presets `gateSandboxPreset` | biome presets | stage 6 saves Earth |
| Credits | `credits/*`, `music-ending*.mp3` | music, an equaliser prop | A9-03; shell `endingSeen` |
| First-play quest | `play/quest.ts` | the sync rule, the save shape | SAVE_KEY `hm.setmix.play`, FRESH step `create` |
| Campaign chain | `base/campaign-chain.ts`, `play/journal.tsx`, debug act controls | the engine is `@hm/questline` (reusable for Plan 57 quests) | STEP_TEXT, CHAIN, GATES |
| Acts VII–IX | `packages/questline/src/act789-chain.ts` | `isBiosphereCoherent` only | story only |
| Narrator | `packages/narrator`, `audio/mentor-voice.ts`, `mentor-mix.ts`, `dev/radio.ts`, `public/vo/` (51 clips), `radio-static.mp3`, `haddy-portrait.webp`, `shell/haddy-crt-portrait.tsx` | **the engine and the radio chain become the drone's "System" voice** | every line is Acts I–IX |
| Lab audio | `music-lab.mp3`, `sfx-lever`, `sfx-breaker`, `sfx-gate-hum`, `sfx-gate-spool`, `sfx-capacitor-hum` | sound presets | `lab`/`moon` music contexts |
| Radio tuner | `shell/diegetic-radio-tuner-widget.tsx` | a music widget | "Bridge FM" naming |
| Checkpoints | `public/checkpoints/act*.json`, `storage/checkpoints.ts` | none | story only |
| Wrecks | `wrecks.ts`, `wreck-sites.ts` | props | A7-03 transponders |

## Story-only text and steps to remove
- `quest.ts` `objective()`: "Who are you?", "Turn on the gate" / "Pull the main lever on the console.", "Step through the gate", "Walk back through the gate…", "Step through to your plot".
- `play.tsx`: STAGE_SAYS (Moon and Earth wording), "Lunar Portal Online", "Stage 0: Lunar Surface…", "Sync lost… refills in the lab", the `recall-zero` line, "Act VI, F-01", "E: pull the main lever", "Done: into the lab", "Simulation Bridge Alert", "Take the extraction rifle from the armory".
- Narrator triggers in `play.tsx`: look:power-wall, look:window, gate:approach, power:on, moon:enter, breaker:thrown, gate:lever, gate:open, and `wake`.
- `campaign-chain.ts` STEP_TEXT and CHAIN acts IV–IX, ACT_V_KIT; `narrator/fidelity.ts` DEFS; every `public/vo` clip.
- `shell.tsx`: "The Moon Twin Gate is still dark. Pull the console lever in the Earth lab first."
- `shell/goblin-front.tsx`: the "Expedition… campaign" and "Ending Credits" items, and the right-hand column's story copy and hard-coded numbers ("Containment integrity 98.4%", "Cycle 42", "Lunar portal", Dr. Haddy's card). The column comes back as the System HUD with real values (Plan 57 §4).
- `lore-logs.ts` LORE and BRIDGE_LOGS.

## Entry points that change for a seeded-world start
- `shell.tsx`: the Screen union, the URL boot (`?play`, `?mash`, `?base`), SetMixHome's callbacks, `spawnAt('lab'|'gate')`, `readGridView` (gateOn), Studio onPlayCampaign/onPlayPlanet.
- `play.tsx`: PlayEntry and its entry effect; `creating` → CreateScientist; the end of loading (lab music, `wake`); the initial HUD `where:'lab'`, LAB_SPAWN; `featureLock` (chain-gated build menu); the goal HUD; the debug teleport.
- `play-scene.ts` starts every session in the lab; `quest.ts` FRESH, loadState and the gateOn rules.
- **The template for the new start:** `game-mode.ts` `gamePlayState` already bypasses the story for game presets.

## E2E scripts that depend on the lab or story
- **The full story flow** (lever, narration, chain): test-playthrough, test-campaign, test-mentor-narration, test-checkpoints, e2e-smoke (its later sections), test-lab-overhaul, capture-lab-sheet21, capture-window-view, diag-lab-draws, test-grid-menus, test-ticket01-collision, test-ticket10, test-ticket07a, test-ticket16b, test-music-sfx, test-audio-buses, test-base-building, test-credits-video, test-debug-menu, test-planet-monsters, test-machine-inspector, test-beam-tool.
- **Only "Done: into the lab" to get started:** test-light-cartridge, test-material-cartridge, test-part-cartridge, test-species-cartridge, test-my-presets, test-ping-kit-e2e, test-drone-e2e, test-companion-e2e, test-harness-tab-and-zone8, test-gamebridge-e2e, test-coop-outpost, test-fidelity-sync-studio, perf-layered-material, probe-companion-body.
- **Voice pipeline:** runworld-voice and runworld-audio. `e2e-batch.sh` lists the suite.
- **Argon's rule for the strip** (28 Oct): no gate may regress. Where a test only needs to get into play, give the new start the same seam (a "start" button and the same ready hook) so those scripts change one line, not their flow.
- **Note:** e2e-smoke was already stale before the strip. It still expects the old "SetMix / Multiverse" brand and menu items. Its menu checks need rewriting for the FIDELITY menu either way.

Related docs: `docs/NARRATION_SCRIPT.md`, `NARRATION_SYSTEM.md`, `NARRATIVE_AND_LORE_BIBLE.md`, `LAB_LAYOUT_RESEARCH.md`.
