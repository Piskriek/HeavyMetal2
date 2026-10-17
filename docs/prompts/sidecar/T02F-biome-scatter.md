# T02F: plotbiome's tufts, bushes and trees in the moon world (TICKET-02 item F)

**Spec:** OPUS_NOTE_08, item F. **Look:** `docs/argo/plans/27-stage-look-bible.md`. Stage 2 has grass patches under the plumes, stage 4 bushes by the water, stage 5 creeping coverage, and stage 6 forest.
**Inputs, already installed:** `@hm/plotbiome` (`bakePlotBiome`), `apps/web/src/play/biome-input.ts` (`buildBiomeInput`), `@hm/treegen` (`growTree`, `BUDGET`, species `pine`/`oak`/`birch`) and `@hm/pbrgrass` (grass texture maps).

## The design (keep it)
- **Bake once, behind the loading bar.** Plotbiome's growth is monotone: every instance carries `appear`, and it exists at every stage at or above `appear`. So bake at stage 6 once, sort each kind's instances by `appear`, and on a stage change set each `InstancedMesh.count` to the number with `appear <= stage`. That makes a stage change free; never re-bake in play.
- **A new module, `apps/web/src/play/plot-biome-view.ts`:**
  `createPlotBiomeView(scene: THREE.Scene, o: { heightAt(x: number, z: number): number; tier: 'low' | 'mid' | 'high' }): { build(input: BiomeInput): void; setStage(stage: number): void; dispose(): void }`
  It places each instance at its `x` and `z` plus the plot origin, at `heightAt` (sunk 0.05 m, so nothing floats), with its yaw and scale.
- **Meshes:**
  - Trees: `growTree` per species, grown once at load. Use `BUDGET[1]` (2,000) near and `BUDGET[0]` (400) beyond 60 m, through two InstancedMeshes per species.
  - Bushes: oak grown with `BUDGET[0]` at scale 0.3 to 0.5.
  - Tufts: low crossed-quad clumps with an alpha-tested blade texture from `@hm/pbrgrass`. Show them only within 30 m, on mid and high.
  - No new art files, and nothing round where it doesn't belong.
- **The input:** build it with `buildBiomeInput`.
  - Machines: the plot's machines plus the base's hardpoint machines, with radius = footprint plus 1 m (use `machineFootprint` from `apps/web/src/base/machine-footprints.ts`).
  - Keep-outs: every base structure's bounding box, plus the twin gate's pad.
  - Water sources: the `water` machines. Volume: grow it with S.aq.
  - Rebuild only when the machines or structures change, and time-slice the rebuild if it takes over 8 ms.
- **The Graphics setting:** add "Vegetation: Auto / Off / Low / High", following the toggle rule; Auto picks Low on this laptop. Tiers map to the plotbiome caps of 600, 2000 and 6000 instances.

## Hook-up in `play-scene.ts`
Call `build` in `setPlanet` (behind the loading bar, through a loading step in `play.tsx`), and `setStage` in `raiseStage` (when the wave settles), in `setFidelityStage`, and in `restore`.

## Verify
- **A new `scripts/test-plot-biome.mjs`:** call `setFidelityStage` with 0, 2, 4 and 6 and assert the instance counts never decrease, are 0 below stage 2, and include trees at stage 6. Screenshot each stage, plus one close shot at stage 6. Look at them: nothing floats, nothing grows on a machine, a structure or the gate pad, and nothing grows in water.
- **Speed:** with `scripts/measure-fps-gpu.mjs` or an equivalent, Low at stage 6 must hold at least 30 fps on this laptop. Report draw calls and triangles.
- Then `npm run typecheck`, `npm test`, `npm run build`, `node scripts/test-stage-world.mjs` and `node scripts/test-campaign.mjs` (45 of 45).

## Stay inside
`apps/web/src/play/plot-biome-view.ts` (new), `play-scene.ts`, `play.tsx` (the loading step and the setting), the settings UI file that holds the Graphics options, and `scripts/test-plot-biome.mjs` (new).
