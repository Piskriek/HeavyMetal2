# P3: Dynamic Goblin Arm Reactions — Flinch on Hit, Pump on Boost, and Brace in Air

- **ID**: `P3`
- **Priority**: Polish
- **Component**: Cockpit Animation / Character Expressiveness / Kinematics
- **Conflicts with**: `H6`, `H8`
- **Needs art**: No

---

## Goal
The green goblin driver arms mounted to the cockpit yoke in `src/game/cockpit.ts` and `src/components/CockpitHud.tsx` currently only mirror the static rotational angle of the steering wheel. Infuse the pilot with tactile personality by implementing dynamic arm posture reactions: a startled flinch and elbow tuck on rival impacts, an enthusiastic forward pump when nitro boost fires, and a white-knuckle, rigid brace when launching off crests and cliffs into big air.

---

## Evidence
- `src/game/cockpit.ts:285-305`: `armsAt(layout, yokeDeg)` calculates arm coordinates purely as a geometric function of `yokeDeg` grip rotation.
- `src/components/CockpitHud.tsx:69-85`: Arm styles (`left`, `top`, `transform`) only update when the steering wheel turns. The driver shows no physical response to violent collisions, 300 km/h turbo bursts, or long airborne jumps.

---

## Solution
1. **Arm State Integration (`src/game/cockpit.ts`)**:
   - Expand `armsAt()` signature to accept dynamic driver poses:
     ```typescript
     export type DriverGesture = 'normal' | 'flinch' | 'boost_pump' | 'air_brace';
     export function armsAt(layout: CockpitLayout, yokeDeg: number, gesture: DriverGesture = 'normal', intensity = 0): { left: ArmPose; right: ArmPose }
     ```
2. **Kinematic Poses**:
   - **Flinch**: Elbows flare outward, shoulders pull back ($Y - 8\text{px}$), hands grip tighter, decaying over 220 ms following a collision.
   - **Boost Pump**: Hands push aggressively forward toward the windshield ($Y + 12\text{px}$), pulsing with nitro speed.
   - **Air Brace**: Arms lock rigid, gripping the upper rim of the wheel, subtle shaking with air turbulence.
3. **HUD Animation Update (`CockpitHud.tsx`)**:
   - Sample `snapshot.status`, `snapshot.falling`, `racer.bumpAt`, and `racer.lastBoostAt`.
   - Compute current gesture and blend smoothly into arm transform offsets.

### Files Allowed to Change
- `src/game/cockpit.ts`
- `src/components/CockpitHud.tsx`
- `tests/cockpit.test.ts`
- `tests/cockpit-channel.test.ts`

### Must NOT Change
- Hand-to-grip alignment constraint (hands must never detach from the steering wheel)

---

## Acceptance Criteria
- [ ] Goblin arms visibly flinch and recoil when the player's marble is rammed.
- [ ] Activating nitro boost triggers an energetic forward arm thrust.
- [ ] During airborne flight over jumps, the driver visibly braces on the wheel.
- [ ] Hands remain anchored to the wheel grips throughout all gestures.
- [ ] `tests/cockpit.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/cockpit.test.ts`
- `node --import tsx --test tests/cockpit-channel.test.ts`
- `node scripts/check.mjs`
