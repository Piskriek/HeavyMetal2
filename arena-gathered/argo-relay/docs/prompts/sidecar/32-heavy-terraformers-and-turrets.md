// File: docs/prompts/sidecar/32-heavy-terraformers-and-turrets.md
# TASK-32: Sheet 17 Heavy Terraformers (8m Hardpoints), Vehicle Fabricator Gantry & Sheet 20 Turrets

## 1. Objective
Replace the `1.9x` scaled stand-in heavy machines (`POL-24`) with the dedicated `8 m × 8 m` (2x2 foundation cell) Sheet 17 Heavy Terraformer tier (`#28 Heavy Shape Press`, `#29 Heavy Light Projector`, `#30 Heavy Water Maker`), wire the Sheet 19 Vehicle Fabricator gantry + rear Rover/Hauler `@hm/lattice` cargo sockets, and add the Sheet 20 handheld sidearm + `15 kW` automated perimeter defense turret.

## 2. Pre-Built Drop-In Files to Wire
1. `packages/plotsim/src/heavy-terraformers-and-turrets.ts` (Specs and pure target-selection logic for Sheet 17 Heavy Terraformers on `2x2` hardpoints, Sheet 19 Vehicle Fabricator `3.0 s` gantry print + Scout 1-socket / Hauler 3-socket cargo beds, and Sheet 20 `15 kW` Automated Perimeter Defense Turret).
2. `packages/plotsim/src/__tests__/heavy-terraformers-and-turrets.test.ts` (Vitest unit tests).
3. `packages/assembler/src/companion-drone-splicer.ts` (`P2-MON-06` Bio-Spliced Defender/Harvester Drones and `P2-VEH-06` Weapon-Tool Cartridge Hybrids).

## 3. Integration Steps
1. Register `heavy-shape-press`, `heavy-light-projector`, and `heavy-water-maker` in the `Heavy` tab of `<BuildRibbonDrawer />` requiring a `2x2` snapped foundation hardpoint.
2. Wire `selectTurretTarget()` in `apps/web/src/base/view.ts` to render the `#ffc13d` targeting laser and clear `sapper` tethers automatically.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/plotsim`
- Verify `2x2` (`8 m × 8 m`) hardpoint snap and turret `sapper` defense in planet gameplay.
