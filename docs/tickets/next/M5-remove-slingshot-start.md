# M5: Remove Slingshot Start Mechanism and Aim Drag Dead Code

- **ID**: `M5`
- **Priority**: Medium
- **Component**: Engine Cleanup / Start Zone Architecture
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The game has transitioned to the starter goblin push sequence on the launch pad (`startMode = 'push'`), but legacy code from the prototype slingshot launch remains embedded throughout the simulation—including `startMode = 'sling'`, `this.launch()`, `adjustAim()`, `AIM_ANCHOR`, drag pointer calculations in `engine.ts`, and the specialized `airborneAlt` rule in `track-space.ts`. Safely remove all slingshot start pathways, retiring obsolete fields while preserving push-start timing and headless test parity.

---

## Evidence
- `src/game/engine.ts:14, 321, 534-540, 974-980`: Contains `AIM_ANCHOR`, `adjustAim`, `this.launch()`, and mouse drag sling calculations (`if (this.startMode === 'sling') { this.launch(); return; }`).
- `src/game/scene.ts:18-24`: Declares `AIM_ANCHOR = { x: 190, y: 580, maxDraw: 140, fullPowerDraw: 120 }` used solely by the slingshot.
- `src/game/track-space.ts:979, 1004, 1034`: Computes `airborneAlt` based on distance from `GROUND - RADIUS - st.y`, which was an ad-hoc fix for the slingshot parabolic arc.

---

## Solution
1. **Engine Cleanup (`src/game/engine.ts`)**:
   - Make `startMode = 'push'` the sole and unconditional start mode.
   - Remove `this.launch()`, `adjustAim()`, `pointerDown` drag sling listener, and `AIM_ANCHOR` references.
   - Simplify `start()` to execute only the starter goblin push physics and audio sequence.
2. **Scene & Track Space Cleanup**:
   - Deprecate or remove `AIM_ANCHOR` from `src/game/scene.ts`.
   - In `src/game/track-space.ts`, remove the legacy `airborneAlt` fallback rule that assumed a slingshot drop height, relying purely on the physical elevation profile and active ramp surfaces.
3. **Tests Update**:
   - Update tests in `tests/start-push.test.ts` and `tests/start-zone.test.ts` to assert against push start mode exclusively.

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/scene.ts`
- `src/game/track-space.ts`
- `src/game/types.ts`
- `tests/start-push.test.ts`
- `tests/start-zone.test.ts`

### Must NOT Change
- Push tick mechanics (`applyPushTick`, `PUSH_TICKS`)
- Qualifying push start synchronization

---

## Acceptance Criteria
- [ ] `engine.ts` contains no mouse-dragging slingshot aiming logic or references to `AIM_ANCHOR`.
- [ ] Push mode initiates cleanly when pressing Space or Launch button.
- [ ] `track-space.ts` correctly places racers on the starting pad without the synthetic `airborneAlt` slingshot offset.
- [ ] `tests/start-push.test.ts` and `tests/start-zone.test.ts` pass cleanly.

---

## Tests to Run
- `node --import tsx --test tests/start-push.test.ts`
- `node --import tsx --test tests/start-zone.test.ts`
- `node --import tsx --test tests/track-space.test.ts`
- `node scripts/check.mjs`
