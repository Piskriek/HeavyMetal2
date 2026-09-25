# BLD-02: Barriers placed in the builder block balls in the race

- **Priority**: High · **Conflicts with**: BLD-03b (engine obstacle list)
- **Needs art**: Optional (ART-B3 replaces the barriers' borrowed art)

## Goal
A barrier placed from the Barriers tab (spike wall, electric fence, fire pit, rock slide, mine field)
is solid in the race: balls hit it and bounce, and the kinds that hurt (fire, mines, fence) do.

## Evidence
- `src/game/gameplay-props.ts:234` compiles `isBarrier` props into barrier OBBs (`barrierOBBs`),
  and `src/game/physics/wall-ccd.ts` has the swept-sphere test, but neither is called by the engine
  or the sim: placed barriers are scenery.
- `src/game/builder/prop-catalog.ts:419-423`: the barriers' art is borrowed from other props.

## Solution
1. At race build (`engine.makeTrack`), compile the builder's props with `compileGameplayProps` and
   hand the barrier OBBs to the sim world.
2. In the per-racer step, sweep each ball against nearby barrier OBBs (`testSweptSphereOBB`,
   bucketed like the obstacles); on contact reflect the velocity with restitution and shoot the rope
   out like a hit (`ropeSince`), so the existing rope reels the ball back.
3. Kind effects: fire pit = the lava plunge feedback without the recovery (a shove + smoke); mine field
   = TNT behaviour; electric fence = a short steer lock and sparks. Presentation through the effect queue.
4. The builder shows a barrier's footprint (its OBB) while selected.

## Files allowed to change
`src/game/engine.ts`, `src/game/sim/world.ts`, `src/game/sim/racer-physics.ts`,
`src/game/gameplay-props.ts`, tests: new `barriers-in-race.test.ts`, `physics-parity` (only if the
legacy fixture needs a no-barrier guard).

## Must NOT change
Parity with the legacy fixture when there are no barriers (bit-exact), the rope timings.

## Acceptance
- [ ] A ball driven into a placed spike wall bounces off it and is reeled back into its lane (headless test).
- [ ] With no barriers placed, `tests/physics-parity.test.ts` still passes bit-exact.
- [ ] Each barrier kind triggers its own effect (test through the recording fx).

## Tests to run
`node --import tsx --test tests/barriers-in-race.test.ts tests/physics-parity.test.ts tests/t09-wall-pickups.test.ts`, then `node scripts/check.mjs`.
