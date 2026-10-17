# T02A (TICKET-02 item A): the moon's sky and old world follow the stage

**From:** Opus. **Spec:** OPUS_NOTE_08 (Setmix Drive), item A. **Plan:** `docs/argo/plans/27-stage-look-bible.md` (the stage ladder). No Argo code is needed; this is glue.

## The bug
The old world (`apps/web/src/crafter/world.ts`) draws the moon's sky, stars, haze, light, water and neighbours. It already has a wave transition between two looks, `setTarget(look)`, then `setFront(radius)` per frame, then `settle()`, and `blendSky` blends the sky along it. But:
- `play.tsx` (about line 1302) calls `scene.setPlanet(look(PLOT, 1), look(PLOT, 1), …)`, so stage 1 is the only look ever baked.
- In `play-scene.ts`, `setPlanet` (about line 1506) calls `world.show(plot)` once. `raiseStage` (about line 1940) and `setFidelityStage` never touch the world.
- So the sky and the old world stay at the boot stage forever, and `setFidelityStage` clamps to 0–4.

## Do
1. **The scene API:** change `setPlanet(base, plot, neighbours)` to `setPlanet(base, lookFor: (stage: Stage) => StageLook, neighbours)` in the `PlayScene` interface (about line 167) and its implementation. Keep the base look as it is. `world.show(lookFor(max(1, the current stage)))`.
2. **`raiseStage(to, from)`:** call `world.setTarget(lookFor(max(1, to)))` beside the existing ground and monster calls.
3. **The wave's frame step** (about lines 2323–2326, where `waveNow()` is read):
   - while `waveTo >= 0`, call `world.setFront(r)` with the same radius the post pass uses;
   - when the wave completes (the `r > 1e6` branch), call `world.settle()`;
   - a wave overtaken by a new `raiseStage` must settle the old target first (see `if (waveTo >= 0) shown = waveTo`).
4. **`setFidelityStage(to)`:** widen the clamp to 0–6 and call `world.show(lookFor(max(1, s)))`. Check that the other callees (monsters, wrecks, `rebuildProps`, `ground.setStage`) accept 5 and 6. Clamp inside any that don't, and list them.
5. **`play.tsx` loading:** bake the plot's looks for stages 1–6 behind the loading bar, one step each ("Growing stage N"), with `bakeLookCached` through the existing `look(id, st)` helper. Pass `(st) => look(PLOT, st)` to `setPlanet`. No bake may happen mid-play: the looks are cached by then.

## Stay inside
`apps/web/src/play/play-scene.ts`, `apps/web/src/play/play.tsx`, and a new browser check `scripts/test-stage-world.mjs`. Don't edit `crafter/world.ts` or `crafter/looks.ts` unless the transition truly needs a fix there. If it does, make the smallest fix and name it.

## Verify
- **`scripts/test-stage-world.mjs`** (boot pattern: `scripts/test-base-building.mjs`):
  - teleport onto the moon with a fixed camera, sun in view, sky above the horizon;
  - for stages 1 to 6 in turn, call `__playScene.setFidelityStage(s)`, wait two frames, and screenshot to `shots-run/stage-world/s<N>.png`;
  - assert that the mean colour of the sky band (the top quarter of the frame) changes between stage 1 and 4, and between 4 and 6, by a clear delta (pick it from the real numbers and print them);
  - also raise a stage with `raiseStage` and check that the sky changes after the wave completes, with no console error.
- Then `npm run typecheck`, `npm test`, `npm run build` (note the size), `node scripts/test-stage-looks.mjs` (its turn test already fails at 16.9% against 10%, POL-49; just report whether it got better or worse), and `node scripts/test-campaign.mjs` (it must stay 40 of 40; restore the checkpoints folder afterwards).
- Look at the six shots, and describe in one line each what changes from stage to stage.
