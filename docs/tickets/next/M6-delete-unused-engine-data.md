# M6: Delete Never-Drawn Engine Data (Particles, AirSheep, Trail)

- **ID**: `M6`
- **Priority**: Medium
- **Component**: Engine Cleanup / Memory Optimization
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The `GameEngine` class (`src/game/engine.ts`) still allocates, updates, and filters three legacy collections on every single animation frame: `particles` (simple 2D colored dots), `airSheep` (jumping sheep from the 2D prototype), and `trail` (2D ribbon samples). The Three.js 3D renderer (`src/game/renderer-3d.ts`) and modern FX pipeline (`src/game/effects/renderer-fx.ts`) never read or draw these collections. Delete these unused data structures and their per-tick update loops, freeing up CPU time and eliminating garbage collection pressure during large races.

---

## Evidence
- `src/game/engine.ts:336`: `this.particles.length = this.airSheep.length = this.trail.length = 0;` resets three arrays.
- `src/game/engine.ts:878`: `this.updateParticles(simDt);` runs on every frame.
- `src/game/engine.ts:1319-1325`: Manages a custom alive-filtering loop for `this.airSheep`.
- `src/game/renderer-3d.ts`: Never reads `frame.particles`, `frame.sheep`, or `frame.trail`. Particle effects and sparks are handled independently via `EffectRenderer` in `src/game/effects/renderer-fx.ts`.

---

## Solution
1. **Remove Collections from `GameEngine`**:
   - Delete `private particles: Particle[] = [];`
   - Delete `private airSheep: AirSheep[] = [];`
   - Delete `private trail: TrailSample[] = [];`
2. **Remove Update and Emit Methods**:
   - Delete `updateParticles(dt: number)`.
   - Delete `emit(...)` and `spawnSheep(...)`.
   - Remove unused particle/sheep/trail fields from `SceneFrame` in `src/game/scene.ts`.
3. **Effects Verification**:
   - Verify that all game impacts, sparks, and explosions continue to trigger correctly through `this.effects.push(...)` in `src/game/effects/renderer-fx.ts`.

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/scene.ts`
- `tests/fixtures/legacy-engine-sim.ts`
- `tests/physics-parity.test.ts`

### Must NOT Change
- Visual particle rendering in `src/game/effects/renderer-fx.ts`

---

## Acceptance Criteria
- [ ] `engine.ts` no longer defines or iterates `particles`, `airSheep`, or `trail`.
- [ ] `renderer-3d.ts` visual effects (impacts, dust puffs, sparks, nitro trails) remain fully functional via `EffectRenderer`.
- [ ] Physics simulation runs cleanly with zero memory allocation for legacy 2D particles.
- [ ] `tests/physics-parity.test.ts` passes without regression.

---

## Tests to Run
- `node --import tsx --test tests/physics-parity.test.ts`
- `node --import tsx --test tests/effects.test.ts`
- `node scripts/check.mjs`
