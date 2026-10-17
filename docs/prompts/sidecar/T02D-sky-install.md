# T02D: install Argo's @hm/sky and wire it into the moon's sky (TICKET-02 item D)

**Source:** `arena-gathered/argo-ticket02-sky/`, Argo's polished bundle, built from Arena answer B2. Opus has checked it: 14 of 14 on the hidden oracle, and 52 of 52 on its own tests. Install it as it is.

## Do
1. Copy `packages/sky/**` into place.
2. The bundle's `apps/web/src/crafter/world.ts` (+43/−5) and `tsconfig.json` (+7/−1) are full files, built from the snapshot at af5d5dab.
   - Run `git log --oneline af5d5dab..HEAD -- apps/web/src/crafter/world.ts tsconfig.json`. If it prints nothing, copy both files over.
   - If it prints commits, apply only Argo's changes from `git diff --no-index <repo file> <bundle file>` by hand, so nothing newer is reverted.
3. Run `npm install` so the workspace links `@hm/sky`, and commit `package-lock.json`. If `@hm/plotsim` has a Vite alias in `apps/web/vite.config.ts`, add one for `@hm/sky` the same way.
4. Check that `packages/sky/tests/*.test.ts` runs under `npm test`. The `packages/*/tests` glob should already catch it.

## Verify
- `npm run typecheck`, `npm test` and `npm run build` (note the size).
- `node scripts/test-stage-world.mjs`. Report the sky deltas against your F-01 numbers (stage 1→4: 102.37, 4→6: 21.13).
- Look at `s1` to `s6`. Describe the sky at each stage. The target: black up to stage 2, a thin blue at 3, full blue at 4–6, and a warm horizon when the sun is low.
- `node scripts/test-campaign.mjs` must stay at 45 of 45. Restore the checkpoints folder afterwards.

## Stay inside
`packages/sky/`, `apps/web/src/crafter/world.ts`, `tsconfig.json`, `package-lock.json`, and `apps/web/vite.config.ts` only if an alias is needed.
