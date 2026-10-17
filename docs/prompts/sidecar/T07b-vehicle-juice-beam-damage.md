# T07b: vehicle juice (boost, tyre tracks, wheel dust, print gantry) and the beam hurting monsters (TICKET-07, part B)

**Spec:** OPUS_NOTE_14 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket07/apps/web/src/play/vehicle-juice.ts` and its test (Opus's staging run: 4 of 4). Argo's `monsters.ts` (installed by T07a, Haiku) carries the beam-damage hook (`beamHit`) and the pure `beamDamage`.

## Do
1. **Install** `vehicle-juice.ts` and its test.
2. **Boost:** Shift while driving feeds `boostedInput(input, boost, energy)` before `stepRover` in `play-scene.ts`'s driving step. Drive the boost meter and show it on the existing speed readout. Pass Shift through `vehicleInput` in `play.tsx`.
3. **Tyre tracks and dust:** create Argo's `tireTracks` (on @hm/decals) and `wheelRoost` (on @hm/particles) in `play-scene.ts`. Feed them each wheel's ground contact while driving. Keep them inside the Low budget, and put them behind the Graphics settings with Auto if they cost frame rate.
4. **Print gantry:** when a fabricator prints a vehicle (`setVehicles` gains one), play `printGantry(at).play(onDone)` at the fabricator pad. The vehicle appears when it ends.
5. **Beam damage:** in `play-scene.ts`'s beam frame code (Extract mode), call `monsters.beamHit(origin, dir, range, beamDamage(mode, dt, dist))`. Seal mode does no damage.
6. **T07a's two `play-scene.ts` leftovers** (Haiku landed T07a at 767f75a5 without them; the exact hooks are in `docs/DEFERRED_POLISH_REGISTRY.md`):
   - **POL-96:** the taken sidearm leaves the armory rack. `play-scene.ts` passes the lab room's armory through (`room.armory.setTaken(...)`, the same route as `dissolveClutter`), and `play.tsx`'s `takeSidearm` calls it; a save with the sidearm taken shows an empty rack on every visit.
   - **POL-97:** hold E on a wreck truck salvages it. `play-scene.ts` reports the aimed wreck (`wrecks.aimWreck`) and exposes `salvageWreck(id)`; `play.tsx` runs the existing hold-E path from `clearProp`. Its items go to the pack, then the network; its log opens through `readLog`; the truck disappears.
   - Un-skip the two checks in `scripts/test-ticket07a.mjs` that are marked as moved to T07b, and make them pass.

## Verify
- **A new `scripts/test-ticket07b.mjs`:**
  - holding Shift while driving raises the top speed and drains the meter;
  - driving leaves track decals that fade over time;
  - wheel dust particles exist while moving fast;
  - printing a vehicle plays the gantry before it appears;
  - holding the Extract beam on a monster lowers its health, and Seal doesn't.
  Save shots of the tracks and dust, and of the gantry.
- **fps on the laptop:** stage 6 on Low while driving must hold at least 45 fps (F-09's target).
- Through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new test, `test-ticket01-collision` and `test-campaign` (45 of 45).

## Stay inside
`vehicle-juice.ts` and its test, `play-scene.ts`, `play.tsx` (`vehicleInput`, `takeSidearm` and the wreck hold-E path only), `scripts/test-ticket07a.mjs` (the two moved checks), and the new test. T07a has landed (767f75a5), with the `monsters.ts` this uses.
