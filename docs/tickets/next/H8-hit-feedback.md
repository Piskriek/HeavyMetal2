# H8: Multi-Sensory Hit Feedback — Camera Kick, Cockpit Yoke Jolt, and Audio Thud

- **ID**: `H8`
- **Priority**: High
- **Component**: Camera / Audio / Cockpit HUD / Tactile Feedback
- **Conflicts with**: `P3`, `P9`
- **Needs art**: No

---

## Goal
Rival collisions and heavy obstacle impacts currently feel mechanically detached from the cockpit and chase perspectives. Introduce impactful multi-sensory feedback scaled by collision impulse: trigger a directional camera kick (leveraging the engine's camera shake system), apply a momentary rotational and vertical recoil jolt to the cockpit steering yoke in `CockpitHud.tsx`, and synthesize a heavy acoustic thud sound in `audio.ts`, all while strictly respecting reduced-motion accessibility settings.

---

## Evidence
- `src/game/engine.ts:1020-1050`: `resolveBumps()` calculates impact closing velocity and heavy impact flags, but only sets `this.shake` and emits generic particles.
- `src/components/CockpitHud.tsx:68-73`: Yoke transform is purely a function of lateral steer `yokeAngleDeg(state.steer)`; it exhibits zero shudder, vibration, or recoil when the player marble is hit.
- `src/game/audio.ts:1, 51-60`: `SoundName` lacks a dedicated low-frequency `thud` impact sound.
- `src/game/camera-shake.ts:1-40`: Exists and calculates high-frequency shake vectors, but is not scaled specifically by bumper/rival collision impulses.

---

## Solution
1. **Audio Synthesis (`src/game/audio.ts`)**:
   - Add `'thud'` to `SoundName`.
   - Implement synthesized `thud`: low-frequency exponential sweep (140 Hz down to 35 Hz) coupled with short-burst noise envelope and low-pass filter (220 Hz cutoff), producing a resonant, heavy body impact.
2. **Cockpit Yoke Jolt (`src/components/CockpitHud.tsx`)**:
   - In `CockpitState`, track `lastImpactTime: number` and `impactForce: number`.
   - When an impact occurs, apply a decaying high-frequency rotational wobble ($\pm 4^\circ$) and downward displacement ($+6\text{px}$) to the yoke transform for 180 ms.
   - If `reducedMotion` is true, omit the rotational jitter and use a subtle opacity/contrast flash instead.
3. **Camera Kick (`src/game/renderer-3d.ts`)**:
   - Scale camera shake displacement by the normal of the collision vector ($nx, nz$) so impacts from the left kick the camera rightward and vice-versa.
   - Respect `reducedMotion` by capping displacement to $\le 10\%$ of standard intensity.

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/audio.ts`
- `src/game/cockpit.ts`
- `src/components/CockpitHud.tsx`
- `src/game/renderer-3d.ts`
- `tests/cockpit-channel.test.ts`
- `tests/camera-shake.test.ts`

### Must NOT Change
- Physical bump resolution formulas in `src/game/sim/racer-physics.ts`

---

## Acceptance Criteria
- [ ] Bumping rivals or hitting obstacles triggers an audible low-end 'thud' through `GameAudio`.
- [ ] In first-person cockpit view, collisions cause the steering wheel/yoke to visibly kick and recover over ~180 ms.
- [ ] Camera shake responds directionally according to collision impact angle.
- [ ] When reduced motion is enabled in options, screen and yoke shaking are replaced with gentle, non-disorienting feedback.

---

## Tests to Run
- `node --import tsx --test tests/camera-shake.test.ts`
- `node --import tsx --test tests/cockpit-channel.test.ts`
- `node --import tsx --test tests/cockpit.test.ts`
- `node scripts/check.mjs`
