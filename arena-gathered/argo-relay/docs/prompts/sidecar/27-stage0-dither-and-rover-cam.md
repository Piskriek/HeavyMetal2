// File: docs/prompts/sidecar/27-stage0-dither-and-rover-cam.md
# TASK-27: Obra Dinn World-Locked Stage 0 Dither, Avatar Rim Rig & Clip-Free Rover Spring-Arm Camera

## 1. Objective
Eliminate screen-space 1-bit dither swimming on camera rotation (`07-moon-stage0.jpg`), fix the near-black Scientist avatar and small third-person rifle (`13-beam-first-person-apply-paint.jpg`, `14-beam-third-person.jpg`), cure Rover camera terrain clipping (`12-rover-driving.jpg`), and flip `USE_MODULAR_SCOUT = true`.

## 2. Pre-Built Drop-In Files to Wire
1. `packages/groundshader/src/stage-post.glsl.ts` (Cylindrical world-locked 1-bit Bayer dither, 1 px depth/normal contour recovery, and `DEC-06` `15 m` `#ffc13d` amber Gate coil pool).
2. `packages/camerarig/src/rover-spring-arm.ts` & `packages/camerarig/src/__tests__/rover-spring-arm.test.ts` (Sphere-cast `r = 0.35 m` spring arm, `25 ms` snap-in / `250 ms` ease-out, hard `terrainY + 0.65 m` floor clamp, and `0°` roll lock).
3. `apps/web/src/avatar/avatar-stage-rig.ts` & `apps/web/src/avatar/__tests__/avatar-stage-rig.test.ts` (`metalness <= 0.22` clamp when `Lx < 0.50`, 3-point hemisphere/rim rig, `1.65x` 3P rifle scale, and emissive mode rail `#3dc8ff / #ff3d8a / #7cff4d / #ffc13d`).
4. `packages/kart/src/modular-scout-fit.ts` (`USE_MODULAR_SCOUT = true`, raycast flush aerial, empty cab with `[-u-]` square yoke per `DEC-09`, and Heavy Hauler `VEHICLE_FIT`).

## 3. Integration Steps
1. Bind `STAGE_POST_FRAGMENT_GLSL` into `packages/groundshader/`.
2. Call `applyAvatarAndRifleStageLighting()` in `apps/web/src/avatar/` and `apps/web/src/play/beam-tool.ts`.
3. Replace the rover camera offset in `apps/web/src/play/` with `stepRoverSpringArmCamera()`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/camerarig apps/web/src/avatar`
- `node scripts/e2e-hud-and-luminance-gate.mjs` (`assertAvatarMinimumLuminance` must report mean RGB `>= 35/255` in `14-beam-third-person.jpg`).
