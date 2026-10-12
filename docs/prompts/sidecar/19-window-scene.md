# TASK-19: the view from the lab window (a 3D wasteland with fidelity pockets)

**The owner, 2026-10-12:** the window "is static with no depth so it looks like a tv screen, it needs to be a planned 3d scene that looks cool ... props flying around dust and wind, lighting with static explosions ... a waste land and have time space pockets where the fidelity is different float about".

**The design is `docs/WINDOW_SCENE_PLAN.md`:** read all of it first. This brief is the build order and the checks.

## Build order (commit after each step)
1. **The vista module.** Add `apps/web/src/play/lab-vista.ts`, exporting `createLabVista(opts)` → `{ scene, camera, update(dt, labCamera), setProgress(p), flash: { onFlash(cb) }, dispose }`.
   - Find where the lab is rendered (search for `renderer.render` and composer passes under `apps/web/src/play/`).
   - Render the vista first, then `renderer.clearDepth()`, then the lab. Use a scissor to the window's projected screen rect, and skip the vista when the window is off-screen.
   - Keep `setStorm` in `lab-room.ts` as the public API and have it call `vista.setProgress`.
   - Replace the storm plane only behind the Full and Lite settings. Static keeps today's plane.
2. **The layout (plan §3 and §4):**
   - a fixed hand-placed table for the hero pieces, plus mulberry32-seeded scatter;
   - load the gen models with the existing `loadGen` and `getGenSync` from `apps/web/src/assets/gen.ts` (low level). The vista ids are datacentre-hall, chiller-block, shipping-container, pylon-tower, overpass-segment and rubble-slab; check `registry.json`, and if one is missing, use a box of its size and say so on the board;
   - procedural: the ground (seeded low-poly, cracks in the texture), square bollards and posts, the ridge, the Breach column (a square prism, glitch-sliced, slowly turning, emissive static) and the sky dome;
   - exp2 fog in the horizon colour.
3. **The pockets (plan §5):**
   - one shared `onBeforeCompile` patch for every vista material, with a pockets uniform array (at most 6), the outside world's base S, and `uTime` and `uFlash`;
   - Pxd quantise or dither, Vtx vertex snapping, Lx shading level, Aq caustics and tint;
   - the shells (a fresnel static rim, the pocket's sky on the back faces), the drift, the breathing, and the collapse and re-form.
   - Put the pure maths (which pocket, blend weights, the palette tables) in a small testable TS function beside the GLSL, with unit tests.
4. **Wind and dust (plan §7):**
   - the instanced motes (GPU-advected), 3 curtains, the ground drift;
   - the flying props: a crosswind stream and the Breach vortex, one `InstancedMesh` per model.
5. **Static explosions (plan §6):**
   - the bolt, burst, `uFlash` light, ring and debris kick;
   - a capped flash of the lab's window light;
   - the SFX delayed by distance through `game-audio.ts`. Check there is a fitting SFX in `apps/web/public/audio`; if none, reuse the closest and say so on the board.
6. **Progress and settings:**
   - `setProgress(0..1)` per plan §8;
   - the Graphics setting "Window view: Full / Lite / Static" with Auto (follow how the existing Graphics settings and the toggle rule are done).

## Rules
- **The owner's model rules:** square sections, solid, no cloth, no heaps of small parts, no lettering. Nothing floats except the flying debris and the pockets, which the owner asked for.
- **Budget (GTX 950M min spec):** at most 40 vista draw calls, at most 120k triangles, at most 1000 dust instances. Measure with `renderer.info` and report the numbers.
- **Seeded:** no `Math.random` in the layout or the schedules, so shots repeat.
- **Visible from the lab:** the gate stands in front of the window's centre, so the Breach must sit at about a third from the left, where the gate does not hide it.

## Done when
- **Shots, looked at, from the spawn view and from beside the gate:**
  - progress 0, 0.5 and 1;
  - one frame mid-flash (the lab floor lit);
  - a pocket close-up with a crate passing through it;
  - the same view moved 2 m sideways, to prove the parallax.
- **Checks:**
  - the Lite and Static settings work;
  - `npm run typecheck` shows 0 errors;
  - the tests are green (apart from the known timing tests);
  - `npm run build` succeeds;
  - `npm run e2e` passes.
- **Report:** draw calls and triangles in the `[DONE]` post.
- **Git:** commit your own paths only (`git commit -- <paths>`), push, and post `[DONE]` on `docs/SIDECAR_COMMS.md`.
