# P5: Align Ball Contact Shadows to Road Surface Normal and Banking

- **ID**: `P5`
- **Priority**: Polish
- **Component**: 3D Visuals / Shading / Ground Decals
- **Conflicts with**: `M7`
- **Needs art**: No

---

## Goal
The ground contact shadow plane beneath each marble in `src/game/renderer-3d.ts:1930-1933` is currently locked horizontally to the world $Y$ plane (`shadow.rotation.x = -Math.PI / 2`). As a result, when marbles drive on steep downhill slopes, banked switchbacks, or elevated wooden bridges, the contact shadow either hovers visibly in mid-air or clips through the track geometry. Orient each ball's shadow plane to match the local road surface normal (`placement.frame.up`) and track banking angle.

---

## Evidence
- `src/game/renderer-3d.ts:1930-1933`:
  ```typescript
  const shadow = new THREE.Mesh(shared.shadowGeo, shared.shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -RADIUS + 2;
  group.add(shadow);
  ```
  The shadow mesh has a fixed local rotation and sits on a static horizontal plane.
- On the Alpine switchbacks and Section 2 waterfall drops, the shadow planes slice into the banked roadbed at an awkward angle.

---

## Solution
1. **Dynamic Shadow Alignment**:
   - In `Renderer3D.render()`, for each racer mesh:
     - Read the interpolated track surface normal from `placement.frame.up`.
     - Construct an alignment quaternion rotating the shadow's default normal $(0, 1, 0)$ to match `placement.frame.up`.
     - Set `shadow.quaternion.copy(shadowQuat)`.
2. **Altitude Fading and Ground Pinning**:
   - Compute true clearance above the track surface: $\Delta y = \text{placement.world.y} - \text{surfaceAt}(x, z).y - \text{RADIUS}$.
   - Pin shadow position directly to the road surface ($+1.5\text{ units}$ offset along surface normal to prevent Z-fighting).
   - Fade shadow opacity dynamically based on airborne height: $\text{opacity} = \max(0, 0.45 \cdot (1 - \Delta y / 250))$.

### Files Allowed to Change
- `src/game/renderer-3d.ts`
- `tests/ball-size.test.ts`
- `tests/camera-decal.test.ts`

### Must NOT Change
- Physical marble bounding spheres in physics simulation

---

## Acceptance Criteria
- [ ] Marble contact shadows conform flush to banked curves and steep downward slopes.
- [ ] No visual Z-fighting or clipping through road surfaces occurs on turns.
- [ ] Shadows expand and fade naturally when marbles become airborne.
- [ ] `tests/camera-decal.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/camera-decal.test.ts`
- `node --import tsx --test tests/ball-size.test.ts`
- `node scripts/check.mjs`
