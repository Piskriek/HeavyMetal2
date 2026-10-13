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
| 2 | Haiku | **TASK-21 the beam tool:** a rifle with the rifle clips; Extract, Apply (cartridges) and Sculpt (terrainbrush); racked in the lab until Act IV | `21-beam-tool.md` | |
| 3 | Haiku | **TASK-22 the campaign chain:** Acts IV to VI as quests; unlocks; the narration; vehicles at stages 2, 4 and 6; the first gun from the weapon bench | `22-campaign-chain.md` | |
| 4 | Haiku | **TASK-23 the monsters:** six archetypes from leaks; legal Freedoom and LibreQuake art; seal leaks with the beam; a Monsters Off/Calm/Normal/Hard setting; drops into the substrate chain; `doom1.wad` and the Ogro removed | `23-monsters.md`, `docs/MONSTERS_PLAN.md` | `@hm/leaksim` landed; the art downloaded (owner OK) |
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
- the DLSS 5 "neural bake" pilot, if the owner says yes (`docs/DLSS5_NEURAL_BAKE_RESEARCH.md`).

**Running two sidecars at once:** TASK-19 owns the lab-vista files. Tasks 20 to 24 own `play.tsx`, `quest.ts`, `base/` and the test scripts. They never edit the same file at the same time.

## 3. Rules for the whole series
- **Keep the first hour working:** Acts I to III play exactly as now, the existing e2e tests stay green, and the dev routes (`?base&kit=1`, `?mash`) keep working as test fixtures.
- **No soft-locks:** a player can always get ore, always get back to the gate, and never loses the save by dying. No built piece is ever destroyed by monsters.
- **60 fps on Low** on the GTX 950M is the target. Log the gaps in `docs/DEFERRED_POLISH_REGISTRY.md`; don't tune endlessly.
- **Everything heavy loads behind the loading bar.**
- **Shots without overlays**, every shot looked at.
- **Never delete or weaken a check.**

## 4. The owner's calls (asked 13 October)
1. **Download the Freedoom and LibreQuake releases** (BSD-3, from their GitHub releases) for the built-in monsters?
2. **Remove `doom1.wad` and the Ogro** from the shipped game (recommended: id's licence forbids using its art in another game)?
3. **The proposals marked (P)** in `docs/MONSTERS_PLAN.md`: the sapper; sealing with the beam's Extract; Calm mode.
4. **The DLSS 5 neural-bake pilot** on 3 assets. And which GPU is in the faster machine? Native DLSS 5 needs an RTX 50.

## 5. DLSS 5
See `docs/DLSS5_NEURAL_BAKE_RESEARCH.md`. In short:
- Runtime DLSS 5 cannot run in a browser and needs an RTX 50. It belongs in the Unreal bridge build, once NVIDIA ships its UE plugin.
- The bakeable version is a "neural" texture tier, made offline (Hunyuan3D-Paint on the 3D PC) and reviewed per asset. It runs on every GPU.
