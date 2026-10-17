# T02C0: the plot's biome input (terrain, hydro water, keep-outs) for @hm/plotbiome

**From:** Opus. **Spec:** OPUS_NOTE_08, item C. The plotbiome package comes from an Arena battle that Argo is reviewing. This job builds its input now, so the package drops straight in.

## The contract to feed
Read `docs/handoff/prompts/battle/plotbiome.txt`: `BiomeInput` is defined there exactly. Copy that interface (and `Tier`) into your module as local types for now, with a comment that they move to `@hm/plotbiome` when it lands.

## Do
1. **Write `apps/web/src/play/biome-input.ts`:**
   `buildBiomeInput(o: { heightAt(x: number, z: number): number; x0: number; z0: number; n: number; cellM: number; machines: readonly { x: number; z: number; r: number }[]; keepouts: readonly { x0: number; z0: number; x1: number; z1: number }[]; waterSources: readonly { x: number; z: number }[]; waterVolume: number; stage: number; s: { pxd: number; vtx: number; lx: number; aq: number }; seed: number; tier: Tier }): BiomeInput`
   - Sample the height at the cell centres, `(x0 + (i + 0.5) * cellM, z0 + (j + 0.5) * cellM)`, row-major `z * n + x`.
   - Compute the water with `@hm/hydro`'s `flood(terrain, sources, volume)` (read its `Terrain`, `Source` and `Water` types in `packages/hydro/src/index.ts`), and rasterise it into the n x n `water` mask.
   - Convert the machines and keep-outs from world metres into the grid frame. `BiomeInput` wants them relative to the grid origin, so subtract x0 and z0.
   - Pure: no THREE, no DOM, no randomness.
2. **Write `apps/web/src/play/biome-input.test.ts`** (`node:test`): the cell-centre sampling, the origin offset, water landing in a test bowl and nowhere else, and the keep-out conversion. Add the file to the test list in `scripts/test.mjs` if the glob doesn't already catch it.
3. **Don't wire it into the scene yet.** That comes after Argo's review of the package (item F).

## Stay inside
`apps/web/src/play/biome-input.ts`, `biome-input.test.ts`, and `scripts/test.mjs` if needed.

## Verify
`npm run typecheck`, `npm test`.
