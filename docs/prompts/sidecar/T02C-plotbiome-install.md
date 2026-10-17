# T02C: install Argo's @hm/plotbiome (TICKET-02 item C)

**Source:** `arena-gathered/argo-ticket02-plotbiome/`, Argo's polished bundle, built from the Arena answers. Opus has checked it: 14 of 14 on the hidden oracle, including tufts on far grass, with a bake of about 49 ms. Its own tests pass 14 of 14; one timing test can fail when the machine is busy. Install it as it is.

## Do
1. Copy `packages/plotbiome/**` into place.
2. Replace `apps/web/src/play/biome-input.ts` with the bundle's version (+2/−15). It now imports `BiomeInput` and `Tier` from `@hm/plotbiome` instead of the local copies you wrote in F-02. Your `biome-input.test.ts` must still pass.
3. Add the `@hm/plotbiome` path alias the way F-04 added `@hm/sky` (tsconfig, plus the Vite alias if any). Run `npm install`, and commit `package-lock.json`.
4. Don't wire it into the scene yet: the instancing is item F, a later job.

## Verify
`npm run typecheck` and `npm test`. No browser test is needed.

## Stay inside
`packages/plotbiome/`, `apps/web/src/play/biome-input.ts`, `tsconfig.json`, `package-lock.json`, and `apps/web/vite.config.ts` only if an alias is needed.
