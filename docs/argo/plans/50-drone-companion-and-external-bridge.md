# Plan 50: Overwatch the Drone: Body, Fast Brain, Orders and Eyes
> **Author**: Claude Opus (engineering), on the owner's 27 Oct asks: "build everything we talked about now that's missing", the drone that fights, finds and edits beside him, and bridging other games.
> **Status**: WAVE 1 BUILT AND REVIEWED (the drone). §6 redirected by the owner on 27 Oct: the external-game work becomes Plan 51 (observe a running game, translate it into presets).
> **Branch**: `feat/studio-polish-claude-cloud`
> **Research (SOP)**: [`docs/COMBAT_DRONE_COMPANION_RESEARCH.md`](../../COMBAT_DRONE_COMPANION_RESEARCH.md), [`docs/GUNFIRE_REBORN_BRIDGE_RESEARCH.md`](../../GUNFIRE_REBORN_BRIDGE_RESEARCH.md); the existing [`ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md`](../../ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md) §3–4 and Plans 40, 46 (cross-game streaming), 48, 49.
> **Standing rule applied**: the owner's examples are categories ("find me guns" = everything a companion finds; "add rooms to the lab" = everything modular the drone edits; "Gunfire Reborn" = any moddable game).

---

## 0. What was wrong before this plan

- The companion and the player's third-person body stood **100 m above the floor**: since JOB-24 the procedural suit carries no clips, and the scientist set's hips are in centimetres. Fixed in `hipsInMetres` (scientist-model.ts) with a test over every clip.
- The companion was a second humanoid suit, not a drone, and its formation point was 2.5 m *behind* the player: never in view.
- The "two brains" design (Plan 48 research) had only half a fast brain: movement. No combat, no finding, no editing.

## 1. The body (`kit-drone.ts`)

A kit like every machine, audited by kitspec (nothing floats, nothing sinks), square sections only, no lettering.
- **Propulsion is a module, because lift must be honest:** `drone` (air, the lab) has four rotors in square shrouds; `drone-vacuum` (the Moon) has four square thruster pods whose pixel plumes show only while they thrust. The scene swaps the module when the drone crosses the gate.
- Violet lens at the nose and violet nav lamps make it readable at a glance; it leans into its travel and bobs when holding.
- **Placement** (research: off the aim, visible): follow 1.1 m right and 2.1 m ahead (about 28° off the aim: in view and clear of the HUD's right-hand column, which hid it at 40°; never behind: the owner's feedback outranks the research's "1.5 m behind"); cruise with the hull just above eye height; "float in front of me" keeps the lens at eye level (Plan 48).

## 2. The fast brain (`companion-combat.ts`, pure, in-engine at the frame rate)

Numbers from the research, all playtest starting points:
- engage at 25 m, drop at 30 m, only targets within 30 m of both drone and player;
- 4-round bursts at 10 rounds/s, 0.6 s between bursts; about 30% of the player's sustained DPS, spread over the drone's rounds;
- 250 ms to acquire; aim error 2.5° tightening to 1° over 1 s of tracking (the first burst may miss);
- target score = threat ordering + proximity to the player + who is hurting the player; sticky bonus 15%; a challenger needs a 20% lead held 400 ms; at least 1.5 s per target;
- kill-steal guard: skip a weak enemy the player is aiming at within 5°;
- **out of the way:** the body stays outside a 15° cone around the player's aim, and holds fire when the player stands in its lane (0.4 m capsule); combat station 4 to 7 m off the player on the ordered cover side; leash 25 m.
- **Barks:** one per 8 s at most, danger first (contact, target down, area clear).

## 3. Everything the drone finds and marks (`companion-scout.ts` + the scene's points of interest)

The category, mapped to what FIDELITY has today. The drone flies there and drops the Plan 49 reticle on it with a callout.

| Category | FIDELITY sources now | Built in Wave 1 |
| --- | --- | --- |
| Enemies | monsters (`getMobList`) | auto callouts + "find enemies" |
| Hazards | open and warned leak sites, sapper-latched machines | yes |
| Objectives and exits | leak sites to seal, the gate (lab) / Stargate (Moon) | yes |
| Weapons and gear | the armory sidearm (lab), fabricators (Moon) | yes |
| Resources | ore boulders | yes |
| Salvage, chests, secrets | wreck props, transponder tapes | yes |
| Vehicles | the plot's vehicles | yes |
| Ammo, health, armor, keys, currency | **none exist in FIDELITY yet** | the category is in the parser and the protocol; sources land with the game systems that create them |

## 4. Orders (the slow brain: voice, the bridge, or Claude live)

Vocabulary from the research (Bosco, Ghost Recon, Apex): follow, hold, cover left/right/rear, focus (pinged target, nearest, "the big one"), hold fire, weapons free, defend me, find <category>, light here, land, recall (cancels everything). A pinged enemy becomes the focus; standing focus orders expire after 60 s. The reflexes never wait on the slow brain.

## 5. Edits: the drone edits anything modular

- **Now:** kit parts and materials (Plan 49) on every kit (lab kits, the dais, plot machines, the Stargate), with an **undo stack** (each edit one step: "undo that"), and **AI-proposed edits staged**: an edit from the bridge shows live and the drone asks; "keep it" commits, "undo" or 30 s of silence puts it back (only the player can say "keep it": the bridge cannot approve its own proposal) (research: an AI never edits unasked; one-step undo).
- **The modularity gaps** (things the drone cannot edit because they are not modular yet, the lab's shell and layout first) are audited in §8 and planned as Wave 3: the lab rebuilt on the base-building structure pieces so rooms, doors and corridors are pieces the drone and the player both place.

## 6. Other games on the PC: the owner's redirect

- **27 Oct, the owner: "forget Gunfire Reborn".** The Gunfire-specific tiers and the `/external` order channel of the first draft are dropped; none of it was built. The research stays on record: [`GUNFIRE_REBORN_BRIDGE_RESEARCH.md`](../../GUNFIRE_REBORN_BRIDGE_RESEARCH.md) (that install is scrambled and its terms forbid plug-ins, bots and reverse engineering) and [`GAME_IN_GAME_STREAMING_RESEARCH.md`](../../GAME_IN_GAME_STREAMING_RESEARCH.md) (capture a window, touch nothing inside the game).
- **The owner's model, for Plan 51:** each game streams only what its terms allow (a per-game permission profile); the observer climbs a ladder, best channel first: official telemetry/game-state APIs, official mod SDKs and scripting, community mod loaders where the terms permit, files the game writes (logs, saves, replays), and **screenshots only as the last resort**. Fast perception turns what comes in into the shorthand; the slow AI decides in shorthand and gives shorthand back to the ego AI, which changes tactics while its instinctive behaviours keep running. This is the Reality Harness "Artificial Ego" ([`docs/prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md`](../../prompts/ARGON_REALITY_HARNESS_RESEARCH_DIRECTIVE.md):16-22).
- **Built here, as the last-resort channel and the AI's view of FIDELITY itself:** `Link window` in the comms panel mirrors a window the player picks (the browser's picker, window first, at most 720p and 15 fps) on a free-standing screen kit 4.5 m ahead (`kit-game-screen.ts`). **The AI's eyes:** while the bridge is linked, a 640x360 JPEG of the player's view, and of a linked window, goes to `POST /frame` every 3 s and lands in `shots-run/bridge/frame-<source>.jpg` (gitignored; `--frame-dir` moves it). The drone never sends input to another game.

## 7. Waves

1. **Built:** the body (air and vacuum modules); the combat brain; finding and marking (the whole category); orders by voice and bridge; one-step undo; AI edits staged for the player's "keep it" (the bridge can neither approve its own proposal nor ship a default); the eyes and the linked window; tests, e2e and an independent review whose 15 findings were fixed or recorded below.
2. Revive, light, fetch, doors where FIDELITY gains them; the lab shell as a kit (the fast step the dais took).
3. The lab on `@hm/structure` pieces (rooms, doors, corridors) and the rest of the modularity audit (§8).
4. Plan 51: observe, translate, propose, accept.

**Review findings recorded, not fixed:** undo restores its saved "before" over later beam or Studio edits on the same kit; "save as default" while an AI edit is staged writes the pre-proposal look; per-frame allocations in the combat step (small; worth pooling if the laptop's frame budget tightens); twelve plume meshes could be one instanced mesh.

## 8. Modularity audit (repo sweep, 27 Oct)

- **Editable live today:** kit parts and materials (all lab kits including the dais, plot machines by kind, the Stargate), light cartridges on lamp parts, trees, sprite cards, base structures through `BaseCommand`, terrain through the beam, locomotion.
- **Broken or lost:** vehicle part overrides are saved but never render (`plotVehicleKit` is never given them); Spore model edits are lost each session; the Studio and play do not share kits (the Studio's V2 kit paths differ), and `window.studioAgent` (Plan 40) is never installed in any page.
- **Not modular yet:** the lab shell and layout (`lab-room.ts`), the east-wall stations, the armory and furniture, lab and planet lighting, the HUD, motion and logic presets in play (`mot:` and `logic:` have no cartridge kind), and NPC brains (the companion's and the monsters').
- **Route for "the drone adds rooms":** first the lab shell as a kit; then the lab on `@hm/structure` pieces (4 m cells; misfits: the 5 m ceiling, the continuous window, a second Base in the lab frame, the lab's own colliders).
