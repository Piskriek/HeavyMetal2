# The master plan: one game, tested, on main; then the Studio (2026-10-13)

The owner, 13 October:
- "get everything in so we can test, the building mechanics, the quests, guns, vehicles, everything and do lots of testing to make sure its in then push to main so i can test on the faster machine. Then we need the Studio implimented and once thats in i will try and fix and make the game pretty with the studio tools and report bugs on both that im unable to fix"
- "tools and machines, everythign hooked up pls"
- "remove the monster mash button ... i want the monsters in the game but forget this tacky \"monster mash\" idea"
- "flesh out the mobs from other games"
- "first plan everything, add that to the plans and then do the plan"

## 1. Where it stands (Opus, from the code)
- **Two games in one screen.** `play.tsx` runs the campaign: Acts I to III, the plot machines, and the quest up to "Feed your mill". Everything newer runs only when the URL has `?base`, `?building`, `?mash` or `?monstermash` (the `isBase` flag, 28 gates):
  - building (foundations, walls, roofs, plans, integrity);
  - the inventory, the hotbar and the linked bridge storage;
  - the refinery, the drafting table and the fabricator;
  - vehicles (scout, hauler, crawler) and the weapon bench and its guns;
  - the heavy hardpoint machines;
  - the monsters.

  A player who starts a normal game never sees any of these.
- **The quest stops at "Feed your mill".** The approved narration (`docs/NARRATION_SCRIPT.md`) already sets the order for the rest. `@hm/questline` is landed but unused.
- **The beam tool only extracts.** `@hm/beamkit` (the rifle-shaped prop and the beam) and `@hm/terrainbrush` (sculpt and paint, landed 55735c9a) are in. The rifle clips are in `zips/Models/rigged/anims/rifle/`.
- **The monsters:** two from the Flash spike (an Ogro and a DOOM demon) and a basic brain (`@hm/mobsim`).
  - The demon's sprites come from id's shareware `doom1.wad`, and the Ogro has no stated licence. Neither may ship (`docs/MONSTERS_PLAN.md` §2).
  - The in-game "👹 Monster Mash" button and sandbox are to go.
- **The Studio:** TASK-17 is paused, its WIP in `zips/studio-wip-2026-10-12/`; TASK-18 is waiting.

## 2. The order
| # | Who | What | Brief | Needs |
|---|---|---|---|---|
| 0 | Haiku | TASK-19 review 2: the window scene (running now) | board, 13 Oct 13:15 | |
| 1 | Haiku | **TASK-20 one game:** the base systems always on in the campaign; one build menu, interact key and save; old saves migrated; the Monster Mash button and name removed (the monsters stay); starts `scripts/test-campaign.mjs` | `docs/prompts/sidecar/20-one-game.md` | |
| 1a | Haiku | **TASK-23a the monster art pipeline** (beside TASK-20, no game files): PAK and MDL parsers, packed sprite sheets and animated models for at least 18 then about 40 monsters (3 or more per archetype), a manifest, contact sheets, the BSD and CC0 credits. Split from TASK-23 on 13 October to use the free sidecar slot | `23a-monster-art.md` | the art downloaded |
| 2 | Haiku | **TASK-21 the beam tool:** a rifle with the rifle clips; Extract, Apply (cartridges) and Sculpt (terrainbrush); racked in the lab until Act IV | `21-beam-tool.md` | |
| 3 | Haiku | **TASK-22 the campaign chain:** Acts IV to VI as quests; unlocks; the narration; vehicles at stages 2, 4 and 6; the first gun from the weapon bench | `22-campaign-chain.md` | |
| 4 | Haiku | **TASK-23 the monsters:** six archetypes with many skins (Freedoom, Blasphemer, LibreQuake, Quaternius); leaks; some walking outside the lab window; seal leaks with the beam; a Monsters Off/Calm/Normal/Hard setting; drops into the substrate chain; `doom1.wad` and the Ogro removed | `23-monsters.md`, `docs/MONSTERS_PLAN.md` | `@hm/leaksim` landed (the battle runs: arena.ai/c/01a1350f-024b-7a13-8962-014239f39525); the art is downloaded |
| 4c | Haiku | **TASK-23c the props in the world:** lab clutter you clear for salvage, wreck sites at the leaks (restored when sealed), the batch-2 wasteland pieces in the window view (28 props packed 13 Oct, plus the 10 lab clutter props) | `23c-props-in-world.md` | TASK-23b |
| 5 | Haiku | **TASK-24 test everything, fix, report:** every e2e, the campaign three times in a row, a bug sweep, fps on the real GPU | `24-campaign-e2e.md` | |
| 6 | Opus | **Review, then push `main`** (a fast-forward: main is an ancestor of the branch) | | TASK-24 green |
| 7 | Haiku | **TASK-17 the Studio shell and write-back** (resume the WIP) | `17-studio-shell.md` | |
| 8 | Haiku | **TASK-18 the asset bench and model redo** | `18-asset-bench.md` | |
| 9 | Haiku | **TASK-25 the Workshop, bring your own monsters:** your own `.wad`, `.pak`, `.md2` or `.mdl`, read in the browser, kept local, mapped to archetypes; replaces the Monster Mash spike screen | to write after TASK-23 | TASK-23 |
| 10 | Opus | **Push `main` again**, then the owner polishes with the Studio and reports bugs | | |

**Opus's own lane, beside the sidecars:**
- the Arena battle `@hm/leaksim` (`docs/prompts/battle/leaksim.txt`, tests typechecked): send it, collect the answers, land the better one;
- review each task's commits and shots;
- batch 2 of the 3D models: review a, b and c per subject, then pack the keepers;
- the DLSS 5 "neural bake" pilot is parked (the owner, 13 October).

**Moved forward (13 October): TASK-17, the Studio shell, runs now beside TASK-21.** Its files (`apps/web/src/studio/`, `studio-server/`, `studio-data/`, the write-back plugin) don't overlap with the one-game tasks, so you get the Studio sooner.

**Running two sidecars at once:** TASK-19 owns the lab-vista files. Tasks 20 to 24 own `play.tsx`, `quest.ts`, `base/` and the test scripts. They never edit the same file at the same time.

## 3. Rules for the whole series
- **Keep the first hour working:** Acts I to III play exactly as now, the existing e2e tests stay green, and the dev routes (`?base&kit=1`, `?mash`) keep working as test fixtures.
- **No soft-locks:** a player can always get ore, always get back to the gate, and never loses the save by dying. No built piece is ever destroyed by monsters.
- **60 fps on Low** on the GTX 950M is the target. Log the gaps in `docs/DEFERRED_POLISH_REGISTRY.md`; don't tune endlessly.
- **Everything heavy loads behind the loading bar.**
- **Shots without overlays**, every shot looked at.
- **Never delete or weaken a check.**

## 4. The owner's calls (answered 13 October)
- **Downloads:** "download whatever you need". Freedoom, Blasphemer, LibreQuake and Quaternius Ultimate Monsters are in `zips/monsters/` (about 93 monsters; `docs/MONSTERS_PLAN.md` §3).
- **Many monsters:** "dont get stuck on on type of moster". Each archetype gets many skins across eras.
- **Monsters outside the window:** "put some walking outside the window if you want" (TASK-23 step 4).
- **DLSS:** "leave the dlss for now, local machine is rtx3080". Parked: the RTX 3080 has no DLSS 5 (RTX 50 only); the neural-bake pilot waits.
- **Removing `doom1.wad` and the Ogro from the shipped game, and the (P) proposals:** going ahead as planned (the owner: "continue").

## 5. DLSS 5
See `docs/DLSS5_NEURAL_BAKE_RESEARCH.md`. In short:
- Runtime DLSS 5 cannot run in a browser and needs an RTX 50. It belongs in the Unreal bridge build, once NVIDIA ships its UE plugin.
- The bakeable version is a "neural" texture tier, made offline (Hunyuan3D-Paint on the 3D PC) and reviewed per asset. It runs on every GPU.

## 6. Argo's master plan (owner-approved 13 October)
Argo (creative lead) delivered `docs/argo/plans/ARGO_MASTER_PLAN.md`: an audit, the creative direction and 12 area plans. The owner approved it.

Opus's review is `docs/argo/plans/ARGO_MASTER_PLAN_REVIEW.md`: about 80% agreed, with eight objections (O1 to O8). **Argo accepted all eight the same evening** (`docs/argo/plans/ARGO_MASTER_PLAN_REPLY.md`), so nothing is held. Where the reply differs from the plan, the reply wins:
- stages 0 to 6 with five looks (4 to 6 are PBR with the water, coverage and forest blooms);
- the rifle at real size, with at most 1.15x in third person by eye;
- monsters keep their colours, with a per-skin `remapStrength` (default 0.20);
- a dormant leak to seal in Act IV, with combat only after F-03;
- D3's heavy machines (field machines: the drill, the pylon and the first mill);
- the approved audio and the owner's mix;
- TASK-22's first-hour order.

Argo's chat is open in Opus's browser for questions (owner, 13 October).
- **Wave A (now, before main):** the active queue with Argo's additions folded into the briefs:
  - TASK-21d: P0-VFX-01, the rim light, the mode rib;
  - TASK-23b-2: P0-MON-01 steps 2 and 3, P0-MON-02, P0-MON-03, P1-MON-05;
  - TASK-23c: P0-LORE-01;
  - TASK-24: P0-PROD-01;
  - Opus: done in 0e3a6f2e: the single file at 14.51 MB (Astro's mid and high in the HD pack, a duplicate QuickJS removed), the build gate at 16 MB, and the luminance gate in post and pack.
  
  Then main.
- **Wave B:** briefs 25 to 27, written 14 October (`docs/prompts/sidecar/25-hud-9zone-and-build-ribbon.md`, `26-foundation-frames-and-safe-dome.md`, `27-stage0-dither-and-rover-cam.md`), with the reply's §3 adjustments. 25 and 26 can run side by side; 27 touches the post pass and the driving camera:
  - 25: the HUD's 9 zones and the build ribbon, in play.tsx and base/ui; F fills a plan, X removes, H locks the hologram;
  - 26: industrial foundation frames, the safe dome (25 m at the gate, 15 m at a pylon), power brownout; the heavy machines mount on foundation hardpoints;
  - 27: world-locked stage-0 dither with the amber gate pool, the rover camera, the modular scout.
- **Wave C** (briefs written 14 October):
  - 28 `28-lab-choreography-and-vista.md`: the dark wake and power-on extending `powerAt`, the 3.5 s ignition, the power wall, the live menu with the stage-4 hero gate;
  - 29 `29-audio-5bus-and-juice.md`: five buses on the owner's mix, a sound for every verb (approved files first), ambience by stage, the bit-depth mirror, the print sweep, hoppers and exhausts;
  - 30 `30-monster-leak-shader-and-rifts.md`: one glitch-shard language for leaks and field nodes (POL-23), the stage wave's band, and the fps check at stages 4 to 6.
  
  23b-2 already carries the leak shader, the wind-up, the dome and era escalation.
- **Wave D** (briefs written 14 October):
  - 31 `31-studio-bench-and-sockets.md`: the review grid with fix flags into assets.json, the S0 to S6 scrubber, sockets, the two-tier material designer, the lab terminal, the monster remapStrength slider;
  - 32 `32-heavy-terraformers-and-turrets.md`: the heavy machines on hardpoints, peaceful drops, the fabricator's gantry, the sidearm and the turret.
  
  32 needs Opus's art pass first (sheets 17, 19 and 20).

## 7. Argo's expansions (14 October; decisions by Argo and Opus under the owner's delegation)
- **Lore and narration** (`docs/argo/plans/24-lore-expansion.md`):
  - Acts VII to IX: the heavy hardpoints and the blue-sky surge; the combiner's deep bus and coverage; the stage-6 finale back in the lab, where the Breach seals through the window and sandbox opens;
  - Marcus Vance only through logs (LOG-05 to LOG-10); Haddy stays the only voice.
  - **Scheduled:** A7-02 with brief 26 (the brownout); A7-01, A7-03, A8-01 and A8-02 with briefs 31 and 32; A9-01 to A9-03 and the window's heal with brief 28 (after 32's stage-6 content).
  - Each act's lines are voiced when its brief lands.
  - LOG-10 uses the player's chosen avatar name, or "the Operator" (Argo's ruling).
- **Suit-cam optics** (`docs/argo/plans/25-camera-realism.md`, the owner's idea): stages 4 to 6 as a capture medium, in brief 27's post pass, behind a Graphics setting.
- **Voiced so far:** A4-LEAK-SEAL and A6-LEAK-SURGE (481466d3). The game switches to them after TASK-23c.
