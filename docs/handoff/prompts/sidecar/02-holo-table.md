# Sidecar task 02: the planet table shows your plot as an amber hologram (POL-07)

Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Log rough spots in `docs/DEFERRED_POLISH.md`; do not tune frame rates. If task 01 (the scientist) is still in progress, stay out of `play.tsx`'s creator code.

## The target
Concept sheet `docs/concept/setmix/07-sheet-lab-power-and-machines.png`, bottom panel "PLANET TABLE — plot hologram". The art README (`docs/concept/setmix/README.md`) describes it: "shows your plot as an amber hologram. In: power via ceiling tray + data. Out: the hologram + sparse amber pixel sparkles while projecting."
- The hologram floats above the table as a round amber relief of the plot, glowing, with sparse amber sparkles drifting up round it.
- It is a projector, so it shows only when the lab has main power (the gate is on). With the gate off, the table is dark.

## Where things are
- **The table:** `kit.planetTable(m)` from `@hm/labkit` (`packages/labkit/src/index.ts`, about line 1300), placed in `apps/web/src/play/lab-room.ts` at (-3.6, -5.2).
  - Its top is at y 0.95. The projection disc (radius 0.936, at y 0.955) is `lamps[0]`.
  - The disc's material is cyan in labkit; tint it amber from our side rather than editing the package.
- **Lab power:** `room.setPower(p)` in `lab-room.ts`. `p.main` (0 to 1) is the main power.
- **The plot data:** in `apps/web/src/play/play-scene.ts`.
  - `setPlot(plot, running, connected)` receives the `@hm/plotsim` state: `plot.machines[]` with `kind, x, z, on`, plus each machine's running share and the connected set.
  - The ground's height is `ground.heightAt(x, z)` (a `PlotGround`, null until the planet has loaded).
  - The plot's centre is the planet gate's position (`twin.group.position`). The plot's radius is 500 m.
  - The stage wave is `waveRadius()`, its centre `postUniforms.uWaveCentre`.
- **Colours:** `METRIC_COLOUR` in `apps/web/src/play/quest.ts`, and `PIXELS_OF` (which metric each machine pours) in `apps/web/src/play/machine-props.ts`.

## Build: `apps/web/src/play/plot-holo.ts` (plus `plot-holo.test.ts`)
1. **The relief.** Sample the plot's height on a grid clipped to the 500 m disc: about 48 x 48, at most 4k triangles. Map the 1 km plot onto a disc of 1.7 m diameter, floating about 0.2 m above the table top. Exaggerate height so hills read: about 0.12 to 0.15 m for the plot's full height range.
   - Build it once, when the ground is ready (heights do not change).
   - Keep the sampler a pure function, unit-tested: grid size, the disc clip, the height mapping.
2. **The hologram's look.** One shader, additive blending, `depthWrite: false`, no lights:
   - amber shading by slope and height, with contour lines about every 10 m of height;
   - fine horizontal scanlines drifting up, a slight flicker, and the rim brightening (fresnel).
3. **Markers.** One `InstancedMesh`, at most 64 instances:
   - the gate at the centre as a small bright ring;
   - each machine as a thin vertical light pin in its metric's colour (amber-white for the drill, pylon and power unit), brighter and pulsing while it runs, dim when off or unconnected.
   - Faint lines between connected pylons are optional.
4. **The wave.** While a stage wave runs, a bright ring sweeps out across the relief at the wave's radius.
5. **Sparkles.** About 40 amber points rising slowly round the rim, in one `Points` draw, only while projecting.
6. **Power.** It appears with main power: a short flicker-in when the gate comes on, and nothing while the gate is off.
7. **Performance.** At most 3 draw calls. Compile its materials behind the loading bar: add them to the scene's `warm()`.
8. **Debug hook.** Add `holo(): { visible: boolean; machines: number }` to the scene's debug and to `window.hmPlay`. Add an e2e check in the Play section: after machines are placed and you are back in the lab with the gate on, the hologram is visible and its marker count equals the plot's machines.

## Report back
What changed, the triangle and draw-call counts, verify and e2e results, and a screenshot of the table from about 2 m away with three machines on the plot.
