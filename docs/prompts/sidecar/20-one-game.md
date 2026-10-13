# TASK-20: one game (the base systems always on in the campaign)

Read `docs/ONE_GAME_PLAN.md` first. Today the building, inventory, refinery, fabricator, vehicles, weapon bench, heavy machines and Monster Mash run only behind URL flags (`isBase` in `apps/web/src/play/play.tsx`, 28 gates). A normal game never reaches them. Make them part of the campaign.

## Build
1. **One flag.**
   - In the campaign the base world is always on: replace the `isBase` gates.
   - The URL flags only add test fixtures: `?kit=1` (the dev seed), `?mash`/`?monstermash` (spawn mobs at once), `?base`/`?building` (start on the planet with the starter kit). Keep each fixture working for `scripts/test-base-building.mjs`, `test-planet-monstermash.mjs` and `test-playthrough.mjs`.
   - Monster Mash mobs do NOT spawn in the campaign yet; TASK-22 gates them.
2. **One save per profile.**
   - The base world (`base/save.ts`, `BASE_SAVE_KEY`) saves with the profile, like the play state.
   - An old profile with no base save starts from `createWorld()`, with the bridge store at the gate.
   - Reload keeps everything: pieces, boxes, inventory, vehicles, machines.
   - Delete-profile deletes it too.
3. **The lab and the planet.** The base HUD, hotbar and windows show on the planet. In the lab only the lab's own UI shows.
4. **One build menu (B), with tabs.**
   - **Machines:** the campaign's field machines (the texture mill and rock drill of the first hour, the pylon).
   - **Structures:** foundations, walls, roofs, stairs, doors (TASK-13's pieces).
   - **Heavy:** mill, press, projector and water, on hardpoints.
   - **Plans:** layouts.

   Style it in the game's telemetry HUD (load the frontend-design skill). The first machine of the quest stays exactly as easy as today.
5. **The machine rules.**
   - Drill, pylon and the first-hour texture mill stay field machines.
   - The heavy kinds need a hardpoint (plotsim v2).
   - If the two rule sets clash inside `@hm/plotsim`, post a [QUESTION] with the clash before you change plotsim.
6. **One interact key (E), by priority:** leave the vehicle, then enter a vehicle, then use a station or machine (refinery, fabricator, weapon bench, bin), then gather at a boulder.
   - Every other key keeps one meaning. List the keys in the Esc menu under Controls.
   - Fix any clash between the campaign's keys (B, Q, R, V, X, M, F) and the base's.
7. **Narration hooks:** the existing triggers (`fab:installed` and the like) fire in the campaign too.

## Tests
- **Unit:** the save round trip of the joined state, and migration from an old profile.
- **New:** `scripts/test-campaign.mjs`, against the production build, with a fresh profile and NO URL flags. Beats so far:
  1. menu, then the expedition;
  2. Acts I to III as in the playthrough (reuse its helpers);
  3. on the planet, open B and place a foundation from Structures;
  4. open the inventory;
  5. reload: the foundation and the inventory persist, and Act I does not replay.
- **Debug hooks for later tasks:** add `window.__dev.grant(item, n)` and `window.__dev.setStage(n)`, available only in dev or e2e builds (behind the existing debug switch), so the long beats can be fast-forwarded.
- **Every beat:** a shot without overlays, the fps over 2 s, pass or fail. Zero console errors.
- **Green:** `npm run typecheck`, `npm test` (the known timing failures excepted), `npm run build`, `npm run e2e`, `node scripts/test-base-building.mjs`, `node scripts/test-campaign.mjs`.

## Report
On the board:
- what changed;
- the key map;
- the old gates removed and the fixtures kept;
- every test's real result;
- fps on the planet (SwiftShader numbers are fine; say so);
- the shots.
