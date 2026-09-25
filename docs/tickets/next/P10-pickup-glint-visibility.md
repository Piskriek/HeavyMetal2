# P10: Pickup Visibility Pass — Slow Specular Glint and Cockpit Beacon Readability

- **ID**: `P10`
- **Priority**: Polish
- **Component**: 3D Visuals / Powerup Markers / Cockpit Readability
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
In `src/game/pickup-view.ts`, air supply pickups (fuel, shield, bounce) floating down the track currently render as small static billboard icons that blend into background track foliage and become difficult to anticipate from the low vantage point of the first-person cockpit camera. Add a slow rotating specular glint pulse, a soft ground projection glow ring, and a vertical light beacon flare to each floating pickup, ensuring players in the cockpit can easily identify and aim for powerup lanes from 500+ meters down-track.

---

## Evidence
- `src/game/pickup-view.ts:1-120`: Manages 2D billboard sprites hovering above the track surface. The sprites lack animated pulse shaders, glint reflections, or ground contact rings.
- In cockpit view (`cameraMode = 'first_person'`), the horizon is tight and low; approaching fuel and shield pickups are hard to distinguish until within 100 meters, making lane planning difficult at 200+ km/h.

---

## Solution
1. **Specular Glint Animation**:
   - In `pickup-view.ts`, add a slow cyclic brightness pulse (period ~2.2 s) and a rotating 4-point star specular flare across the pickup sprite:
     $\text{scale} = 1.0 + 0.12 \cdot \sin(t \cdot 2.8)$.
2. **Ground Projection Ring**:
   - Render a glowing circular lane decal directly below each pickup on the track surface:
     - Fuel: golden amber glow ring.
     - Shield: electric cyan glow ring.
     - Bounce: emerald green glow ring.
   - Ground projection is clearly visible even when the floating sprite is occluded by ahead marbles.
3. **Cockpit Beacon Flare**:
   - Add a subtle upward vertical light shaft (semi-transparent fading beam) ascending 150 units above the pickup to announce its presence over crests and hills.

### Files Allowed to Change
- `src/game/pickup-view.ts`
- `src/game/powerups.ts`
- `tests/pickup-view.test.ts`

### Must NOT Change
- Hitbox radius and collection collision rules in `src/game/powerups.ts`

---

## Acceptance Criteria
- [ ] Pickups are distinctly visible and identifiable from the cockpit view at least 400 meters down-track.
- [ ] Floating powerups exhibit a smooth, pulsating specular glint.
- [ ] Ground projection ring marks the exact lane target beneath each item.
- [ ] `tests/pickup-view.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/pickup-view.test.ts`
- `node scripts/check.mjs`
