# T07b: vehicle juice (boost, tyre tracks, wheel dust, print gantry) and the beam hurting monsters (TICKET-07, part B)

**Spec:** OPUS_NOTE_14 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket07/apps/web/src/play/vehicle-juice.ts` and its test (Opus's staging run: 4 of 4). Argo's `monsters.ts` (installed by T07a, Haiku) carries the beam-damage hook (`beamHit`) and the pure `beamDamage`.

## Do
1. **Install** `vehicle-juice.ts` and its test.
2. **Boost:** Shift while driving feeds `boostedInput(input, boost, energy)` before `stepRover` in `play-scene.ts`'s driving step. Drive the boost meter and show it on the existing speed readout. Pass Shift through `vehicleInput` in `play.tsx`.
3. **Tyre tracks and dust:** create Argo's `tireTracks` (on @hm/decals) and `wheelRoost` (on @hm/particles) in `play-scene.ts`. Feed them each wheel's ground contact while driving. Keep them inside the Low budget, and put them behind the Graphics settings with Auto if they cost frame rate.
4. **Print gantry:** when a fabricator prints a vehicle (`setVehicles` gains one), play `printGantry(at).play(onDone)` at the fabricator pad. The vehicle appears when it ends.
5. **Beam damage:** in `play-scene.ts`'s beam frame code (Extract mode), call `monsters.beamHit(origin, dir, range, beamDamage(mode, dt, dist))`. Seal mode does no damage.

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
`vehicle-juice.ts` and its test, `play-scene.ts`, `play.tsx` (`vehicleInput` only), and the new test. Start only after T07a has landed: it installs the `monsters.ts` this uses.
