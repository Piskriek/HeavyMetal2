# T02F2: grass at stage 2 and bushes at stage 4 (the F-06 follow-up)

**The gap:** in `test-plot-biome`, stages 2 and 4 show 0 plants. The look bible (plan 27) wants the first grass tufts at stage 2, under the plumes of working machines, and bushes by the water at stage 4. Today stages 2–4 still look the same, which is the owner's top complaint.

## Do
1. **Tufts on Low.** Auto picks Low on this laptop, so the owner never sees a tuft. Show tufts on Low too, within 20 m and capped by plotbiome's low tier. Mid keeps 30 m. Keep them cheap: crossed quads in one InstancedMesh.
2. **Machines feed the input.** `buildBiomeInput` must get every operating machine: the plot's machines and the base's hardpoint machines. Check that the plot-biome view rebuilds when one is placed or removed. That rebuild runs once, time-sliced if it takes over 8 ms, and never per frame.
3. **The gate as the first source.** Opus's call; Argo may revise it. Add the twin gate as an anchor, at radius pad + 1 m, so a fresh plot gets its first tufts round the gate at stage 2 even before a machine runs. The pad itself stays a keep-out.
4. **Water.** Pass the `water` machines' positions as sources, and the crater's water level if the old world has one at that stage.

## Verify
- **Extend `scripts/test-plot-biome.mjs`.** Before baking, place two operating machines and one `water` machine through the base or debug API, then assert:
  - stage 2: tufts > 0, on the Low tier;
  - stage 4: bushes > 0;
  - stage 6: trees > 0, with counts never falling between stages.
- Take close shots at stages 2 and 4 near a machine, and look at them: nothing floats or grows inside a machine.
- **The fps check stays on this laptop** (the min-spec target): Low at stage 6, with tufts on, must hold at least 30 fps.
- Run everything else through `scripts/test-on-3dpc.sh`: `npm test`, the build, `test-plot-biome`, `test-stage-world`, and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/play/plot-biome-view.ts`, the hook-up in `play-scene.ts`, and `scripts/test-plot-biome.mjs`.
