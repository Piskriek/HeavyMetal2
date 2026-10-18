# TRIFT: make the rift visible, and keep wrecks off the leaks (POL-142, POL-143)

**Found by:** TPOL's follow-up (f30ae51a, `scripts/pol95-103-rift-shots.mjs`, local shots in the session scratchpad's `rift-final/`). **Start only when Opus opens `play-scene.ts` for you** (after T11b).

## What's wrong
1. **POL-142, the rift never reaches the screen.**
   - TPOL put the rift on `RIFT_LAYER`, skipped it in the planet pass, and draws it in `drawRifts` after the stage-look post pass, depth-tested against `planetRT`'s depth.
   - The mesh is valid (1,392 vertices, correct offsets), visible, and faced by the camera, and the pass issues one draw call per rift. Yet no magenta, cyan, violet or amber pixel shows in any shot: not with the depth test off, not with the shader's discard off, not at `uState` 1.
   - So either the fragments never land on the canvas, or something overwrites them later in the frame.
   - **Suspects:**
     - the render target bound when `drawRifts` runs (it must be the canvas, `null`, after the post pass);
     - `autoClear` or a clear between passes;
     - a later full-screen pass or a second post draw;
     - the viewport or scissor;
     - the output colour space or tone mapping turning the colours black;
     - the HUD canvas.
2. **POL-143, a wreck truck stands on a leak.** A junked truck cab, about 6 m tall, sits right on the open leak 10 m from the start. It hides the rift even in the planet pass, and at stage 0 its white dithered outline was mistaken for the rift (T07a, TPOL).

## Do
1. **Find where the rift's fragments go.** Read the canvas pixels right after `drawRifts` (a dev hook), then again at the end of the frame. Fix the cause so the rift draws on top of the stage-look image and the ground still hides its base.
   - Keep the design: one draw per rift, unlit S-Space palette, ignoring the stage look.
2. **Keep wreck sites clear of leaks.** `wreck-sites.ts` (or wherever sites are placed) keeps every wreck at least 15 m from any leak, deterministically, from the same seed. Check that T07a's wreck salvage beats and the campaign still find their trucks.
3. **Retake the shots** with `scripts/pol95-103-rift-shots.mjs`, at stages 0a, 0b, 3 and 6, open and sealing. Look at every one, and confirm:
   - the magenta and cyan tear with the violet core;
   - the amber seam while sealing;
   - the ground hiding the tear's base;
   - no truck on the leak.

## Verify
- The shots above, copied to the laptop, with their paths in your report.
- DRAWS near an open leak stay about where TPOL left them (about 94 at stage 0a).
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>"`: `npm test`, `test-ticket07a`, `test-stage-world` and `test-campaign` (45 of 45).

## Stay inside
`play-scene.ts` (`drawRifts` and the frame order around it only), `rift.ts`, `leak-visual.ts`, `wreck-sites.ts` (or the site placement), the shot script, and the tests. Use POL-144 to POL-150 for any new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
