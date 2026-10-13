# One game: everything hooked up, tested, then main (2026-10-13)

The owner: "get everything in so we can test, the building mechanics, the quests, guns, vehicles, everything and do lots of testing to make sure its in then push to main so i can test on the faster machine. Then we need the Studio implimented". And: "tools and machines, everythign hooked up pls".

## 1. Where it stands (Opus, from the code)
- **Two games in one screen.** `play.tsx` runs the campaign: Acts I to III, the plot machines, and the quest up to "Feed your mill". Everything newer runs only when the URL has `?base`, `?building`, `?mash` or `?monstermash` (the `isBase` flag, 28 gates):
  - building (foundations, walls, roofs, plans, integrity);
  - the inventory, the hotbar and the linked bridge storage;
  - the refinery, the drafting table and the fabricator;
  - vehicles (scout, hauler, crawler) and the weapon bench and its guns;
  - the heavy hardpoint machines;
  - Monster Mash.

  A player who starts a normal game never sees any of these.
- **The quest stops at "Feed your mill".** The approved narration (`docs/NARRATION_SCRIPT.md`; the owner: "a solid base") already sets the order for the rest: Act IV (the extraction rifle), Act V (the base), Act VI (fabrication), Monster Mash, and the stage milestones. `@hm/questline` (a data-driven quest engine) is landed but unused.
- **The beam tool only extracts.** `@hm/beamkit` (the rifle-shaped prop and the beam effect) and `@hm/terrainbrush` (sculpt and paint, landed 55735c9a) are in. The rifle clips are in `zips/Models/rigged/anims/rifle/`. Missing: the prop in the hands, the clips, Apply (cartridges painted on the ground) and Sculpt.
- **Tests:** the playthrough e2e reaches building and Monster Mash only through those URL routes.

## 2. The plan (sidecar tasks, in order; each adds its beats to one campaign e2e)
| Task | What | Brief |
|---|---|---|
| TASK-20 | **One game:** the base systems always on in the campaign. One build menu, one interact key, one save, old saves migrated. The URL flags only seed test fixtures. Starts `scripts/test-campaign.mjs`. | `docs/prompts/sidecar/20-one-game.md` |
| TASK-21 | **The beam tool:** held like a rifle with the rifle clips; Extract, Apply (cartridges) and Sculpt (terrainbrush); racked in the lab until Act IV. | `docs/prompts/sidecar/21-beam-tool.md` |
| TASK-22 | **The campaign chain:** Acts IV to VI and Monster Mash as quests (`@hm/questline`). Unlocks, narration lines, stage milestones; vehicles at stages 2, 4 and 6; the first gun from the weapon bench; mobs only once you can fight. | `docs/prompts/sidecar/22-campaign-chain.md` |
| TASK-23 | **Test everything, fix, report:** the full campaign e2e from a fresh profile with no URL flags; every system exercised; a bug sweep; fps on Low. | `docs/prompts/sidecar/23-campaign-e2e.md` |
| Opus | Review each task. When TASK-23 is green: fast-forward `main` to the branch and push, so the owner tests on the faster machine. | |
| TASK-17, 18 | **The Studio:** the shell and write-back (resume the WIP in `zips/studio-wip-2026-10-12/`), then the asset bench and the model redo. The owner then polishes the game with it and reports bugs. | `17-studio-shell.md`, `18-asset-bench.md` |

## 3. Rules for the whole series
- **Keep the first hour working:** Acts I to III play exactly as now, the existing e2e tests stay green, and the dev routes (`?base&kit=1`, `?mash`) keep working for their tests.
- **No soft-locks:** a player can always get ore, always get back to the gate, and never lose the save by dying.
- **60 fps on Low** on the GTX 950M is the target. Log the gaps in `docs/DEFERRED_POLISH_REGISTRY.md`; don't tune endlessly.
- **Everything heavy loads behind the loading bar.**
- **Shots without overlays**, and every shot looked at.
- **Never delete or weaken a check.**

## 4. DLSS 5
See `docs/DLSS5_NEURAL_BAKE_RESEARCH.md`. In short:
- Runtime DLSS 5 cannot run in a browser, and it needs an RTX 50.
- The bakeable version is a "neural" texture tier, made offline with Hunyuan3D-Paint and reviewed per asset. Pilot proposed: 3 assets.
