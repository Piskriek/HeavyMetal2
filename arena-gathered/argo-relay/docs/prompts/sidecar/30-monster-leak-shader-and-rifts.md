// File: docs/prompts/sidecar/30-monster-leak-shader-and-rifts.md
# TASK-30: S-Space Containment Leak Shader, Vertical Glitch Rift Shards & Stage 4 Low 60 FPS Governor

## 1. Objective
Unify all 38 monsters (*Freedoom*, *Blasphemer*, *LibreQuake*, *Quaternius*) under the `S-Space Containment Leak Shader` (`DEC-02`, `17-monsters-batch1.jpg`), replace stand-in primitive leak nodes with `3.5 m` vertical glitch-sliced rift columns (`POL-23`), wire radial volumetric stage scan-waves (`P1-LIGHT-04`), and lock Stage 4 `Low` spec at `>= 60.0 FPS` (`POL-04`).

## 2. Pre-Built Drop-In Files to Wire
1. `packages/shareware/src/fidelity-mob-shader.ts` & `packages/shareware/src/__tests__/fidelity-mob-shader.test.ts` (Obsidian/gunmetal `#181c24`–`#4a5568` palette remap, archetype metric veins `#ff3d8a / #ffc13d / #3dc8ff`, horizontal scanline glitch slices, `windup` 2.0x telegraph flash, `25 m` Gate repulsion, and era staging).
2. `apps/web/src/play/glitch-rift-column.ts` (`3.5 m` 14-slice vertical glitch rift shard column + 3 orbiting rubble fragments + `3.0 s` Beam `Seal` alignment).
3. `packages/groundshader/src/radial-scan-wave.ts` & `packages/groundshader/src/__tests__/radial-scan-wave.test.ts` (`0 -> 450 m` radial stage scan-wave and `POL-04` Stage 4 Low 60 FPS governor).
4. `apps/web/src/crafter/plume-point-lights.ts` (`POL-02` / `POL-03` High/Ultra pooled plume point lights).

## 3. Integration Steps
1. Wrap all monster meshes/billboards in `apps/web/src/play/` with `injectSSpaceLeakShader()`.
2. Replace dodecahedron/torus leak markers with `GlitchRiftColumnView`.
3. Apply `getStage4LowSpecGovernor('low', s)` in `apps/web/src/crafter/world.ts`.

## 4. Verification Gate (Rule 25)
- `npx vitest run packages/shareware packages/groundshader`
- `node scripts/test-planet-monsters.mjs` & `node scripts/perf.mjs` (`>= 60.0 FPS` on Stage 4 Low).
