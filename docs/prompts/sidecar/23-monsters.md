# TASK-23: the monsters (leaks, archetypes, legal art, the setting)

After TASK-22, and after Opus lands `@hm/leaksim` (the Arena battle). The plan: `docs/MONSTERS_PLAN.md` (read it first). The owner: "i want the monsters in the game but forget this tacky \"monster mash\" idea", and "flesh out the mobs from other games".

## The pieces
- **`@hm/leaksim`:** the pure brain. Six archetypes (charger, spitter, swarmer, flyer, brute, sapper), telegraphed attacks, bolts, leaks with warned waves and sealing, the aggression levels, safe zones, drops, raycast and encode.
- **`@hm/shareware`:** the WAD and MD2 parsers. Add a Quake `.mdl` parser with tests.
- **The art:** the Freedoom and LibreQuake releases (BSD-3). Opus downloads them into `zips/monsters/` once the owner agrees; never fetch them yourself.
- **`monster-mash-combat.ts`:** today's renderer and combat. Rename it `monsters.ts` as you rework it.

## Build
1. **The brain.** Replace `@hm/mobsim` in the game with leaksim. Wire its events:
   - `warn`: Dr. Haddy's radio line and a HUD marker at the leak;
   - `telegraph`: a visible wind-up (a flash, a growl, a ring on the ground);
   - `hitPlayer`: damage, the hit direction and the M-03 bark;
   - `drain`: the machine glitches and its output stalls;
   - `death`: the pixel burst (sprite era) or vertex burst (3D era), the drop into the world, and M-02 the first time;
   - `sealed`: the junk model is restored, with its sound and a line.
2. **The art, legal only.** Pack sprite sheets and baked vertex animations for the frames used (walk, attack, pain, death; 8 directions for sprites), from Freedoom and LibreQuake, by archetype as in plan §3.
   - Credits get the BSD notices (`docs/CREDITS.md` and the in-game credits).
   - **Remove** `apps/web/public/shareware/doom1.wad`, `ogro.md2`, `ogrobase.png` and `weapon.md2` from the shipped build.
   - The `?mash` fixture uses the new art.
3. **Each era renders as itself.** Sprites are instanced billboards, one draw call per archetype; 3D-era models use GPU vertex animation. Each monster carries a small fidelity aura: reuse the window scene's pocket shader on the plot ground.
4. **Leaks on the plot.**
   - Place them at junked models (the `hold` ids and `zips/runworld/assets/<id>/old/`), a few per stage, never within 30 m of the gate pad.
   - The leak zone looks janky: the junk model glitches.
   - Sealing: hold the beam's Extract on the leak (TASK-21). A sealed leak restores its model one rung up the fidelity ladder.
5. **Safe zones:** the gate pad, and every sealed room with life support (B-07).
6. **The setting: Monsters Off / Calm / Normal / Hard** (default Normal), in Settings, styled with the frontend-design skill. Off means no leaks open.
7. **Drops:** raw pixels and raw vertices go into the inventory and the bridge storage chain (refinery). Everything they buy can also be earned without fighting.
8. **Guns:** the weapon bench's guns fire through `raycast`, with parts changing damage, spread and rate (`base/weapons.ts`). The beam never damages.
9. **Budgets:** at most 8 living monsters on Low, 16 on Medium and 24 on High, by passing the cap to leaksim. 60 fps on Low with 8 fighting.

## Tests
- **Unit:** the MDL parser; the event-to-game wiring (a pure adapter with tests).
- **`scripts/test-planet-monsters.mjs`** (from TASK-20): keep every check, now with the leak flow:
  1. a warn, then a wave;
  2. a telegraph before every hit;
  3. a kill and its drop;
  4. a seal, then no more waves from it;
  5. Off spawns nothing.
- **Extend `scripts/test-campaign.mjs`** with the monster beats of TASK-22's chain.
- **Shots:** each archetype at stage 1 and stage 6, a leak before and after its seal, and a fight on Low. No overlays.

## Report
On the board:
- what changed;
- the art's sources and licences;
- the files removed;
- the budgets met;
- fps;
- the results;
- the shots.
