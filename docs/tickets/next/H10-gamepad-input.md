# H10: Standard Gamepad Input Integration with Haptic Rumble

- **ID**: `H10`
- **Priority**: High
- **Component**: Input System / Gamepad API / Haptics
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The game currently supports only keyboard, mouse, and touch inputs; players with standard Xbox, PlayStation, or generic USB gamepads cannot control their marble. Create a modular gamepad polling adapter in `src/game/input/gamepad.ts` polled inside the engine's animation frame loop. Map thumbstick lateral deflection (>50% with hysteresis) and D-pad to lane changes, triggers and face buttons to boost and air bounce, and fire controller vibration/rumble on collisions and speed boosts via `gamepad.vibrationActuator`.

---

## Evidence
- `src/game/controls.ts:1-217`: Manages only keyboard bindings (`STORAGE_KEY = 'goblin-rally-keybindings-v1'`); has no gamepad polling or button mappings.
- `src/game/engine.ts:858-880`: The engine `frame()` loop polls no gamepad state (`navigator.getGamepads()` is unreferenced across the codebase).
- Controller players are completely unable to steer, boost, or navigate menus.

---

## Solution
1. **Gamepad Module (`src/game/input/gamepad.ts`)**:
   - Create `GamepadController` class:
     - Listen to `gamepadconnected` and `gamepaddisconnected` window events.
     - Implement `poll(dt: number)` to read `navigator.getGamepads()`.
     - Standard Gamepad Mapping:
       - **Steering**: Left thumbstick $X$ axis or D-Pad Left/Right. Trigger lane change when $|X| > 0.5$, with a reset hysteresis threshold ($|X| < 0.25$) to prevent unintended multiple lane shifts.
       - **Air Bounce**: Button A (Cross) or Left Trigger ($L2$).
       - **Turbo Boost**: Button X (Square), Right Bumper ($R1$), or Right Trigger ($R2$).
       - **Pause / Menu**: Start / Options button.
       - **Restart**: Select / Share button.
2. **Haptic Rumble**:
   - Implement `vibrate(effect: 'bump' | 'boost' | 'crash', intensity = 1)` via `gamepad.vibrationActuator.playEffect('dual-rumble', ...)`:
     - Collision hit: strong low-frequency thud (duration ~150 ms).
     - Boost activation: high-frequency motor pulse (duration ~250 ms).
     - Check option `reducedMotion` and avoid vibrating if disabled.
3. **Engine Frame Integration**:
   - Instantiate `GamepadController` in `GameEngine`.
   - In `engine.frame()`, call `this.gamepad.poll(dt)` when input is enabled.

### Files Allowed to Change
- `src/game/input/gamepad.ts` (new file)
- `src/game/engine.ts`
- `src/game/controls.ts`
- `tests/keymap.test.ts`

### Must NOT Change
- Headless keyboard bindings and existing input contracts

---

## Acceptance Criteria
- [ ] Connecting a standard gamepad is recognized with an on-screen connection notification.
- [ ] Pushing the left stick past 50% left or right triggers a single lane change; stick must return toward center before another lane change can fire (hysteresis).
- [ ] Face buttons and triggers correctly activate air bounce and turbo boost.
- [ ] Controller vibrates on rival impacts and turbo boosts on supported browsers.

---

## Tests to Run
- `node --import tsx --test tests/keymap.test.ts`
- `node --import tsx --test tests/contracts.test.ts`
- `node scripts/check.mjs`
