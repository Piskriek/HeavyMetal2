// File: docs/prompts/sidecar/26-foundation-frames-and-safe-dome.md
# TASK-26: Sheet 13 Industrial Foundation Frames, 25m Coherence Safe Dome & 100 kW Gate Brownout

## 1. Objective
Retire the prototype red slab/blue ring foundations (`10-foundation-placed.jpg`) in favor of Sheet 13 gunmetal box-section frames with raycasted corner support legs, implement the `25 m` Twin Gate / `15 m` Pylon Suit Coherence Safe Dome with zero-loss emergency recall (`DEC-03`), and enforce the `100 kW` Gate baseline with proportional brownout (`P0-LOOP-02`).

## 2. Pre-Built Drop-In Files to Wire
1. `packages/plotsim/src/safe-dome-and-brownout.ts` (Pure math for `25 m` Gate / `15 m` Pylon Coherence Safe Dome, `20%/s` recharge, zero-loss recall at `0%`, `100 kW` Gate baseline, proportional brownout, and `2.5x` cartridge yield).
2. `packages/plotsim/src/__tests__/safe-dome-and-brownout.test.ts` (Vitest unit tests).
3. `packages/substrate/src/guaranteed-anti-softlock.ts` & `packages/substrate/src/__tests__/guaranteed-anti-softlock.test.ts` (Unified `Dirt -> Ore -> Cartridge` table and Rule 23 anti-soft-lock guarantee).
4. `apps/web/src/base/foundation-frame-view.ts` (Sheet 13 `#222933` box-section frame, `#323b47` grated deck, `#ffc13d` corner lugs, and raycasted telescoping corner legs + floor cable covers).

## 3. Integration Steps
1. In `apps/web/src/base/view.ts`, replace the red cylinder/ring foundation mesh builder with `buildSheet13FoundationMesh()` and `buildFloorCableCoverMesh()`.
2. Scale the standard field `Water Maker` (#5) to `3.6 m × 3.0 m` (`0.465x`) so it fits a `1x1` (`4 m × 4 m`) foundation cell (`DEC-05`).
3. Wire `stepSuitCoherence()` and `computeGridPowerState()` into the planet tick in `apps/web/src/crafter/world.ts`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/plotsim packages/substrate`
- Regenerate `10-foundation-placed.jpg` and verify Sheet 13 gunmetal frame + support legs on sloped lunar terrain.
