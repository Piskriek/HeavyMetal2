// File: docs/prompts/sidecar/28-lab-choreography-and-vista.md
# TASK-28: Lab Breaker & Gate Ignition Choreography, 3D Window Vista Review 1 & Live Main Menu

## 1. Objective
Choreograph the Act I dark red-strobe wake-up, the `1.8 s` sequential overhead strip-light power-on (`02`–`04` tour shots), the `3.0 s` bottom-to-top 8-coil Gate ignition (`06-gate-open.jpg`), the 3D Window Vista spherical pockets (`05-window-view-storm-and-breach.jpg`), and the dual-contrast live 3D Lab Main Menu (`01-main-menu.jpg`, `DEC-08`, `POL-01`).

## 2. Pre-Built Drop-In Files to Wire
1. `apps/web/src/lab/lab-choreography.ts` & `apps/web/src/lab/__tests__/lab-choreography.test.ts` (Pure timeline evaluators for Act I pitch ease `+65° -> 0°`, 3-bank strip-light ignition with fluorescent ballast flicker, 8-coil Gate ignition, and Act IX Window Breach healing).
2. `apps/web/src/lab/vista-spheres-and-breach.ts` & `apps/web/src/lab/__tests__/vista-and-subbass.test.ts` (Mid-ground `45–120 m` prop setback, left-third `x = -18.5 m` Breach column, 3 spherical S-pockets, and straddling `shipping-container`).
3. `apps/web/src/shell/main-menu-live-backdrop.tsx` (`DEC-08` dual-contrast Main Menu with `POL-01` left window wasteland + Stage 4 right Gate preview + Rule 22 subsystem preload bar).
4. `packages/content/src/forensic-clutter-logs.ts` (`LOG-01..LOG-08` micro-lore hover/salvage logs and `isWindowBreachInSight()` frustum trigger).

## 3. Integration Steps
1. Wire `evaluateLabBreakerTimeline()` and `evaluateGateIgnitionTimeline()` into `apps/web/src/lab/lab-scene.ts`.
2. Apply `CANONICAL_VISTA_PROP_PLACEMENTS` and `CANONICAL_VISTA_SPHERE_POCKETS` in `apps/web/src/lab/lab-vista.ts`.
3. Mount `<MainMenuLiveOverlay />` in `apps/web/src/shell/`.

## 4. Verification Gate (Rule 25)
- `npx vitest run apps/web/src/lab packages/content`
- Regenerate `01-main-menu.jpg` through `06-gate-open.jpg` and verify dark-to-lit Lab contrast and sequential Gate coil ignition.
