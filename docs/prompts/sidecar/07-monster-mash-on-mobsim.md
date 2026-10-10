# Sidecar TASK-07: Monster Mash runs on @hm/mobsim and paths around the base (Gemini Flash)

> From Claude Opus, 2026-10-10. Start after TASK-06 is accepted. The pure code is landed and tested:
> - `@hm/mobsim`: a deterministic 30 Hz mob simulation with today's stats, states and shotgun, pathing with `@hm/navpath`;
> - `apps/web/src/base/navgrid.ts`: `navFor(base, center, radius)` turns the base's ground level into the mobs' blocked grid.

## Why

`apps/web/src/play/monster-mash-combat.ts` runs the mobs itself with `Math.random`:
- for spawn spots, pellet spread and damage;
- and the mobs walk straight through walls.

A synced world can't replay that, and a base gives no shelter. Keep everything the player sees and hears. Move only the rules.

## A. One simulation, many renderers

1. Hold one `Sim` in the combat manager (`createSim(seed)`).
   - The seed comes from the plot or world seed: the same plot and session give the same fight.
   - Never call `Math.random` for anything gameplay touches. Particles and audio jitter can stay random.
2. `update(dt, …)`: accumulate dt and call `step(sim, nav, player)` once per `DT` (cap 5 steps a frame).
   - Render each mob between its last two states (lerp by the accumulator), so 60 fps looks smooth.
3. Mesh views are keyed by mob id: the MD2 Ogro, the billboard Demon and the health bars.
   - Create one when a new id appears.
   - Play pain and attack animations on state changes.
   - On death, leave the corpse view where `mobsim` left it.
4. `fire()` calls `mobsim.fire(sim, origin, dir)`. Its `hits`, `damage` and `killed` feed `CombatStats` and the existing sounds and blood particles. The 0.52 s cooldown lives in the sim now: remove the manager's own `cooldownTimer`.
5. `spawnOgro(count, pos?)` and `spawnDemon(…)`: with a position, call `spawn`; without one, call `spawnNear(sim, nav, kind, count, player.x, player.z, 7, 11)`.
6. `getMobList()` reads the sim, so the HUD list stays as it is.

## B. The ground they path on

- `nav = navFor(baseWorld.base, player, 32)` on the planet. Rebuild it when the base changes (compare the world's tick or the base hash) and when the player has moved more than 12 m from the grid's centre. Throttle rebuilds to at most once a second.
- In the lab, or with no base, use an open grid around the player.
- Mob height on screen still comes from `groundHeightAt`. The sim works in x and z only.

## C. Done means

- Typecheck shows 0 errors, `npm test` is green, and `npm run build` succeeds.
- `scripts/test-planet-monstermash.mjs` still passes, and is extended to check that:
  - a mob spawned outside the starter shelter, with its airlock shut, never gets in;
  - with the airlock open, it walks in through the door;
  - two runs with the same seed and the same shots end in the same `hashSim`.
- Shots in `docs/shots/monstermash/`: `mobs-round-wall.png` (a mob going round a wall, not through it) and `shelter-safe.png`.
- Post [DONE] with the commit.
