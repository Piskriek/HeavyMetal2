# T01b: the TICKET-01 leftovers (windows, doors, roofs, ramps on slopes)

**From:** Opus. TICKET-01 landed in 7d0d9030 and 52a02830, with the check `scripts/test-ticket01-collision.mjs` (21 of 21). Haiku left these unverified.

## Do
1. **Extend `scripts/test-ticket01-collision.mjs`.** Place each piece through the base API, the same way the test already places its standalone foundation, wall and ramp. The window and door need a blueprint the dev kit doesn't grant: grant it in the test fixture, not in the game.
   - A wall with a **window** blocks you at its face.
   - A **door** blocks you when closed; open it with the base `door` action and you walk through.
   - A **roof** placed while aiming at the floor lands at k=1 (on the walls). You can walk underneath it freely; it must never push you at head height.
   - A **ramp on a slope**: find ground at least 10 degrees steep near the plot (scan `__playScene.heightAt`). Place a ramp there, and walk up it from its low edge.
2. **For every failing check, find the root cause and fix it** in `apps/web/src/base/walk.ts`, `kit-pieces.ts` or `piece-meshes.ts`. Name the cause in your report.
3. **Recheck your own F-01 change.** You added a clamp to the ROOM bounds in `collide` and `debug.teleport`. Prove that walking through the powered lab gate still crosses to the moon, and that the moon's gate still brings you back. The existing check covers both; it must stay at 21 of 21 plus your new checks.

## Stay inside
`scripts/test-ticket01-collision.mjs`, `apps/web/src/base/walk.ts`, `kit-pieces.ts`, `piece-meshes.ts`, and `walk.test.ts`. Touch `play-scene.ts` only if a root cause is there.

## Verify
`npm run typecheck`, `npm test`, `node scripts/test-ticket01-collision.mjs`, and `node scripts/test-base-building.mjs` (must exit 0).
