# TASK-15: the modular scout, and the new crawler

**Owner, 2026-10-11 (the modular route, `docs/RUNWORLD_PIPELINE.md` §4f):** "if the models did a chassis and a body and we combined that with head lights and ariels and what ever else to get the final model it should work better".

## The scout, assembled from parts (replaces the one-piece `scout-body`)
**Parts:** all packed. Sizes are in `registry.json`.
- `scout-chassis`: 1.69 × 0.59 × 3.00 m, a flat pan with four hub housings and two headlight pads on the front bumper.
- `scout-shell`: the empty cab, 1.29 × 1.18 × 2.40 m.
- `headlight` × 2: a square work lamp, 0.21 × 0.30 × 0.15 m. One asset; mirror it for the second side.
- `vehicle-seat`: on a low box base.
- `steering-wheel`: a square "[-u-]" yoke on a column with a flange. It lies with its column horizontal.
- `scout-wheel` × 4.
- **The aerial is procedural** (the owner's rule: thin rods do not reduce): one thin square-section mast, about 1.2 m, with a small square base, at the rear-right of the shell roof.

**The physics does not change.** `@hm/rover`'s scout keeps its hubs at x ±0.8 and z ±1.1 and its colliders, so the parts are fitted around them:
- **The chassis:** the hub housings centre on the hubs in z (±1.1). Its width fits between the wheels' inner faces: the wheel (0.46 m wide) is centred on its hub, so the inner faces are at ±(0.8 − 0.23) = ±0.57 m. Fit with a per-axis scale; report the scales.
- **The shell:** on the chassis deck (y at the chassis's top surface), centred, its length fitted to the deck between the bumpers. A uniform scale if it fits; per-axis if not, reported.
- **The headlights:** on the front bumper's two pads, lens facing +z (forward). Each lamp stays its own mesh for `setRoverLamp`.
- **The seat and yoke:** the seat on the shell floor at the driver's place, and the yoke in front of it at hand height, its column running forward into the dash. The yoke turns with steering (`parts.steeringWheel`), as now.
- **The wheels:** as now, on the hubs, axle along x.

**How:**
- Add `assembleScout(level)` to `apps/web/src/assets/gen-props.ts` and use it in `createGenRover('scout')`, with the old `scout-body` path as the fallback.
- Keep every offset and scale in ONE table at the top (`SCOUT_ASSEMBLY`), so Opus can tune numbers without touching logic.
- Add the assembled scout to the dev gallery (`apps/web/src/dev/gallery.ts`, `/gallery.html`) beside the old one.

**Shots** (`docs/shots/rovers/`), each looked at:
- the assembled scout three-quarter front, side and top, beside the old one-piece scout;
- the same at stage 1 (low) and stage 6 (high);
- the cab interior from the driver's seat;
- the scout driving on the Moon.

## The crawler (a new , remade tonight)
- **Its size:** the new body is 2.40 x 2.20 x 6.20 m. It is fitted to the kit crawler's box, centred on x and z, bottom at 0.
  - In , drop  (no squash is needed now) and re-check the offset.
- **Its front is the end with the hinge bracket** (where the drill arm mounts); the cab sits at the rear. Check which way the GLB faces, and yaw it so the hinge points +z (forward).
- **Re-place:**
  - the drill arm () on the hinge bracket;
  - the seat in the cab;
  - the lamps (the body has square lamp housings by the hinge).
- **Shot:** the crawler beside the scout and the hauler on the Moon, lit from behind the camera.

## Done when
- The shots show the assembled scout reading as one vehicle: no floating parts, no wheel through the chassis, the lamps on their pads. And the crawler at the right size with its arm on the hinge.
- The scout still drives as before: `test-base-building` and the scout drive check pass.
- Typecheck shows 0 errors, the tests are green (except the known `fieldkit`/`plotgrid` timing tests), and `npm run build` succeeds.
- Commit your own paths and push, then post `[DONE]` with the `SCOUT_ASSEMBLY` numbers you settled on.
- Git: never restore or check out files you did not change.
