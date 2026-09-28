# M7: Instanced Mesh Rendering for 100-Marble Pelotons

- **ID**: `M7`
- **Priority**: Medium
- **Component**: 3D Renderer / WebGL Draw Calls / Performance
- **Conflicts with**: `P5`
- **Needs art**: No

---

## Goal
In `src/game/renderer-3d.ts`, each racer is represented by an individual `THREE.Group` holding five distinct `THREE.Mesh` instances (core, capLeft, capRight, shadow, shield). For 100 racers, this introduces ~500 individual scene graph objects and draw calls per frame, as well as no-op `castShadow = true` flags (shadow maps are disabled). Refactor racer rendering to use shared `THREE.InstancedMesh` instances for each component part (one for marble cores, one for left caps, one for right caps, and one for ground shadows), reducing draw calls from ~500 to under 10.

---

## Evidence
- `src/game/renderer-3d.ts:1872-1940`: `ensureRacerMeshes` and `buildRacerMesh` instantiate individual `Group`, `core`, `capLeft`, `capRight`, `shadow`, and `shield` meshes for every single racer index $0 \dots N$.
- `src/game/renderer-3d.ts:1920, 1924, 1928`: `core.castShadow = true; capLeft.castShadow = true; capRight.castShadow = true;` are no-ops because WebGL shadow maps are not enabled on the Three.js renderer.
- At 100 racers, CPU scene graph traversal (`scene.updateMatrixWorld()`) and WebGL state switches cause frame drops on lower-spec hardware.

---

## Solution
1. **Instanced Architecture**:
   - In `Renderer3D`, create four master `THREE.InstancedMesh` instances:
     - `coreInstancedMesh` (geometry: `sphereGeo`, material: `material`, max count: 100)
     - `capLeftInstancedMesh` (geometry: `capLeftGeo`, material: `capMat`, max count: 100)
     - `capRightInstancedMesh` (geometry: `capRightGeo`, material: `capMat`, max count: 100)
     - `shadowInstancedMesh` (geometry: `shadowGeo`, material: `shadowMat`, max count: 100)
   - Retain a standalone mesh for the player racer if needed for special first-person hide behavior or custom texture atlas mapping.
2. **Matrix and Color Updates**:
   - In `render()`:
     - Compute world transform matrix for each instance $i$ using `placement.world` and quaternions.
     - Call `instancedMesh.setMatrixAt(i, matrix)`.
     - Set per-instance diffuse color via `instancedMesh.setColorAt(i, color)`.
     - Mark `instanceMatrix.needsUpdate = true` and `instanceColor.needsUpdate = true` once per frame.
3. **Remove Shadow Flags**:
   - Delete `castShadow = true` on all racer mesh components.

### Files Allowed to Change
- `src/game/renderer-3d.ts`
- `tests/ball-size.test.ts`
- `tests/camera-rig.test.ts`

### Must NOT Change
- Physics simulation coordinates or gyro ball roll quaternion formulas

---

## Acceptance Criteria
- [ ] 100 racers render with fewer than 10 total draw calls for all marble bodies and caps.
- [ ] Visual appearance (colors, rolling rotation, brass caps, shadows) is identical to individual meshes.
- [ ] No-op `castShadow` flags are removed.
- [ ] `tests/ball-size.test.ts` passes.

---

## Tests to Run
- `node --import tsx --test tests/ball-size.test.ts`
- `node --import tsx --test tests/camera-rig.test.ts`
- `node scripts/check.mjs`
